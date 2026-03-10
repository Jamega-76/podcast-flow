'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { fetchFeed } = require('./rss');
const telegram = require('./telegram');
const scheduler = require('./scheduler');
const { DEFAULT_FEEDS, ALL_FEEDS } = require('./feeds-config');

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

// Pre-load all Europe 1 feeds into the scheduler
scheduler.setFeeds(DEFAULT_FEEDS);
console.log(`📡 Pre-loaded ${DEFAULT_FEEDS.length} feeds (Europe 1)`);

// ===== API ROUTES =====

/**
 * GET /api/rss?url=...
 * Proxy RSS feed parsing (avoids CORS issues on the frontend)
 */
app.get('/api/rss', async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'URL required' });

  // Basic URL validation
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
 * POST /api/telegram/test
 * Test Telegram configuration
 */
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId } = req.body;

  if (!token || !chatId) {
    return res.status(400).json({ ok: false, error: 'Token and chatId required' });
  }

  const result = await telegram.testConnection(token, chatId);
  res.json(result);
});

/**
 * POST /api/telegram/config
 * Save Telegram configuration
 */
app.post('/api/telegram/config', (req, res) => {
  const { token, chatId } = req.body;

  if (!token || !chatId) {
    return res.status(400).json({ ok: false, error: 'Token and chatId required' });
  }

  telegram.setConfig(token, chatId);
  console.log('📱 Telegram config updated');
  res.json({ ok: true });
});

/**
 * POST /api/feeds
 * Sync feeds list with server (for scheduled alerts)
 */
app.post('/api/feeds', (req, res) => {
  const { feeds } = req.body;
  if (!Array.isArray(feeds)) return res.status(400).json({ error: 'feeds must be array' });

  scheduler.setFeeds(feeds);
  console.log(`📡 Feeds synced: ${feeds.length} feeds`);
  res.json({ ok: true, count: feeds.length });
});

/**
 * POST /api/schedules
 * Update schedule enabled states
 */
app.post('/api/schedules', (req, res) => {
  const { schedules } = req.body;
  if (!Array.isArray(schedules)) return res.status(400).json({ error: 'schedules must be array' });

  scheduler.updateSchedules(schedules);
  res.json({ ok: true });
});

/**
 * POST /api/alert/send
 * Manually trigger an alert
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
 * Server-Sent Events for real-time notifications to the frontend
 */
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write('event: connected\ndata: {"status":"ok"}\n\n');

  // Keep alive every 30s
  const keepAlive = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(keepAlive); }
  }, 30000);

  scheduler.addListener(res);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

/**
 * GET /api/feeds/default
 * Return the pre-configured Europe 1 feeds (for frontend first-load)
 */
app.get('/api/feeds/default', (req, res) => {
  const { statut } = req.query; // optional filter: ?statut=comptabilisé or ?statut=hors-comptage
  const feeds = statut ? ALL_FEEDS.filter(f => f.statut === statut) : ALL_FEEDS;
  res.json({ feeds, total: feeds.length });
});

/**
 * GET /api/status
 * Server health check
 */
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    version: '1.0.0',
    uptime: process.uptime(),
    feeds: DEFAULT_FEEDS.length,
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
  console.log('    PodcastFlow Server');
  console.log('    ============================================');
  console.log(`\n🚀  Running at: http://localhost:${PORT}`);
  console.log(`📱  Open on mobile: http://<your-ip>:${PORT}\n`);

  scheduler.startScheduler();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason?.message || reason);
});
