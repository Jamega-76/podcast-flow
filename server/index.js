'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { fetchFeed, fetchAllFeedsInBatches } = require('./rss');
const telegram = require('./telegram');
const scheduler = require('./scheduler');
const { DEFAULT_FEEDS, ARTICLES_E1, MONITORED_FEEDS } = require('./feeds-config');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ===== INIT FROM ENV =====
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  telegram.setConfig(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID);
  console.log('✅ Telegram configured from .env');
}

// Monitored feeds: 86 podcasts comptabilisés + 25 articles = 111 flux
scheduler.setFeeds(MONITORED_FEEDS);
console.log(`📡 Surveillance: ${DEFAULT_FEEDS.length} podcasts comptabilisés + ${ARTICLES_E1.length} articles = ${MONITORED_FEEDS.length} flux`);

// ===== EPISODES CACHE =====
// Cache partagé en mémoire — rafraîchi toutes les 5 minutes
let episodesCache = { episodes: [], updatedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshEpisodesCache() {
  try {
    console.log('🔄 Rafraîchissement du cache (111 flux surveillés)...');
    const episodes = await fetchAllFeedsInBatches(MONITORED_FEEDS, 15);
    episodesCache = { episodes, updatedAt: Date.now() };
    const pods = episodes.filter(e => e.type === 'podcast').length;
    const arts = episodes.filter(e => e.type === 'article').length;
    console.log(`✅ Cache prêt: ${pods} épisodes + ${arts} articles (total: ${episodes.length})`);
  } catch (err) {
    console.error('❌ Cache refresh error:', err.message);
  }
}

// Pré-chargement 2 secondes après le démarrage (rapide)
setTimeout(refreshEpisodesCache, 2000);
// Rafraîchissement automatique toutes les 5 minutes
setInterval(refreshEpisodesCache, CACHE_TTL);

// ===== HELPER PARIS TZ =====
function parisMidnight(now, daysAgo) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  const str = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const [day, month, year] = str.split('/');
  const offset = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', timeZoneName: 'short' }).includes('+2') ? '+02:00' : '+01:00';
  return new Date(`${year}-${month}-${day}T00:00:00${offset}`);
}

// ===== API ROUTES =====

/**
 * GET /api/rss?url=...
 * Proxy RSS feed parsing
 */
app.get('/api/rss', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  try {
    const data = await fetchFeed(url);
    res.json(data);
  } catch (err) {
    console.error('RSS fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch RSS feed', details: err.message });
  }
});

/**
 * GET /api/stats
 * Comptages J / J-1 / J-2 en heure Europe/Paris
 * Réponse légère : juste les chiffres, pas la liste complète
 */
app.get('/api/stats', (req, res) => {
  if (episodesCache.episodes.length === 0) {
    return res.status(503).json({ error: 'Cache en cours d\'initialisation, réessayez dans quelques secondes.' });
  }

  const now = new Date();
  const t0 = parisMidnight(now, 0); // aujourd'hui 00:00
  const t1 = parisMidnight(now, 1); // hier 00:00
  const t2 = parisMidnight(now, 2); // avant-hier 00:00

  const pods = episodesCache.episodes.filter(e => e.type !== 'article');
  const arts = episodesCache.episodes.filter(e => e.type === 'article');

  const cnt = (arr, from, to) => arr.filter(e => {
    const d = new Date(e.date);
    return !isNaN(d) && d >= from && d < to;
  }).length;

  res.json({
    pods: { today: cnt(pods, t0, now), d1: cnt(pods, t1, t0), d2: cnt(pods, t2, t1) },
    arts: { today: cnt(arts, t0, now), d1: cnt(arts, t1, t0), d2: cnt(arts, t2, t1) },
    updatedAt: episodesCache.updatedAt ? new Date(episodesCache.updatedAt).toISOString() : null,
  });
});

/**
 * GET /api/episodes/recent
 * Liste complète des épisodes — utilisée par le scheduler Telegram
 */
app.get('/api/episodes/recent', async (req, res) => {
  if (episodesCache.episodes.length > 0 && (Date.now() - episodesCache.updatedAt) < CACHE_TTL) {
    return res.json({
      episodes: episodesCache.episodes,
      total: episodesCache.episodes.length,
      fromCache: true,
      updatedAt: new Date(episodesCache.updatedAt).toISOString(),
    });
  }
  try {
    await refreshEpisodesCache();
    res.json({
      episodes: episodesCache.episodes,
      total: episodesCache.episodes.length,
      fromCache: false,
      updatedAt: new Date(episodesCache.updatedAt).toISOString(),
    });
  } catch (err) {
    if (episodesCache.episodes.length > 0) {
      return res.json({
        episodes: episodesCache.episodes,
        total: episodesCache.episodes.length,
        fromCache: true,
        stale: true,
        updatedAt: new Date(episodesCache.updatedAt).toISOString(),
      });
    }
    res.status(503).json({ error: 'Episodes not available yet', episodes: [] });
  }
});

/**
 * POST /api/telegram/test
 */
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId } = req.body;
  if (!token || !chatId) return res.status(400).json({ ok: false, error: 'Token and chatId required' });
  const result = await telegram.testConnection(token, chatId);
  res.json(result);
});

/**
 * POST /api/telegram/config
 */
app.post('/api/telegram/config', (req, res) => {
  const { token, chatId } = req.body;
  if (!token || !chatId) return res.status(400).json({ ok: false, error: 'Token and chatId required' });
  telegram.setConfig(token, chatId);
  console.log('📱 Telegram config updated');
  res.json({ ok: true });
});

/**
 * POST /api/schedules
 */
app.post('/api/schedules', (req, res) => {
  const { schedules } = req.body;
  if (!Array.isArray(schedules)) return res.status(400).json({ error: 'schedules must be array' });
  scheduler.updateSchedules(schedules);
  res.json({ ok: true });
});

/**
 * POST /api/alert/send
 */
app.post('/api/alert/send', async (req, res) => {
  try {
    const result = await scheduler.sendManualAlert();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Manual alert error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/events
 * Server-Sent Events pour les notifications en temps réel
 */
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('event: connected\ndata: {"status":"ok"}\n\n');

  const keepAlive = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(keepAlive); }
  }, 30000);

  scheduler.addListener(res);
  req.on('close', () => { clearInterval(keepAlive); });
});

/**
 * GET /api/status
 */
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    version: '4.0.0',
    uptime: process.uptime(),
    monitoredFeeds: MONITORED_FEEDS.length,
    cacheSize: episodesCache.episodes.length,
    cacheAge: episodesCache.updatedAt ? Math.round((Date.now() - episodesCache.updatedAt) / 1000) + 's' : 'not ready',
    timestamp: new Date().toISOString(),
  });
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ===== START =====
app.listen(PORT, () => {
  console.log('\n🎙️  ============================================');
  console.log('    PodcastFlow Server v4.0');
  console.log('    ============================================');
  console.log(`\n🚀  Running at: http://localhost:${PORT}`);
  console.log(`📱  Open on mobile: http://<your-ip>:${PORT}\n`);
  scheduler.startScheduler();
});

process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err.message); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason?.message || reason); });
