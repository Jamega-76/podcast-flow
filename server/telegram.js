'use strict';

const https = require('https');

let config = { token: null, chatId: null };

/**
 * Set Telegram credentials
 */
function setConfig(token, chatId) {
  config.token = token;
  config.chatId = chatId;
}

/**
 * Send a message via Telegram Bot API
 */
function sendMessage(text, chatId = null) {
  return new Promise((resolve, reject) => {
    if (!config.token) return reject(new Error('No Telegram token configured'));

    const target = chatId || config.chatId;
    if (!target) return reject(new Error('No Chat ID configured'));

    const body = JSON.stringify({
      chat_id: target,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${config.token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) resolve(parsed);
          else reject(new Error(parsed.description || 'Telegram API error'));
        } catch {
          reject(new Error('Invalid Telegram response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Test the Telegram connection
 */
async function testConnection(token, chatId) {
  const savedToken = config.token;
  config.token = token;

  try {
    await sendMessage(
      '✅ <b>PodcastFlow</b> connecté avec succès !\n\nVous recevrez vos alertes de podcasts ici.',
      chatId
    );
    return { ok: true };
  } catch (err) {
    config.token = savedToken;
    return { ok: false, error: err.message };
  }
}

/**
 * Format and send daily summary alert (podcasts + articles)
 * Filters content published TODAY (depuis minuit heure Paris)
 */
async function sendPodcastAlert(episodes, scheduleTime) {
  if (!config.token || !config.chatId) {
    throw new Error('Telegram not configured');
  }

  const now = new Date();
  // Minuit aujourd'hui en heure Europe/Paris
  const parisDate = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const [day, month, year] = parisDate.split('/');
  // Gère heure d'été (+2) et hiver (+1)
  const offset = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', timeZoneName: 'short' }).includes('+2') ? '+02:00' : '+01:00';
  const todayMidnight = new Date(`${year}-${month}-${day}T00:00:00${offset}`);

  const todayItems = episodes.filter(ep => {
    const d = new Date(ep.date);
    return d >= todayMidnight && d <= now;
  });

  const pods = todayItems.filter(e => e.type !== 'article');
  const arts = todayItems.filter(e => e.type === 'article');
  const total = todayItems.length;

  const timeStr = scheduleTime || now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });

  if (total === 0) {
    const msg = `🎙️ <b>PodcastFlow – ${dateStr}</b>\n⏰ Rapport de ${timeStr}\n\nAucun contenu publié aujourd'hui pour le moment.`;
    await sendMessage(msg);
    return { count: 0, message: msg };
  }

  // Calcul des pourcentages
  const podPct = total > 0 ? Math.round((pods.length / total) * 100) : 0;
  const artPct = 100 - podPct;

  const msg = [
    `🎙️ <b>PodcastFlow – ${dateStr}</b>`,
    `⏰ Rapport de ${timeStr}`,
    ``,
    `📊 <b>Bilan du jour — ${total} contenus publiés</b>`,
    ``,
    `🎙️ Épisodes : <b>${pods.length}</b>  (${podPct}%)`,
    `📰 Articles  : <b>${arts.length}</b>  (${artPct}%)`,
  ].join('\n');

  await sendMessage(msg);
  return {
    count: total,
    message: `${pods.length} épisodes · ${arts.length} articles – ${timeStr}`,
  };
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { setConfig, sendMessage, testConnection, sendPodcastAlert };
