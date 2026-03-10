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
 * Format and send a podcast summary alert
 */
async function sendPodcastAlert(episodes, scheduleTime) {
  if (!config.token || !config.chatId) {
    throw new Error('Telegram not configured');
  }

  const now = new Date();
  const last24h = episodes.filter(ep => {
    const d = new Date(ep.date);
    return (now - d) < 24 * 60 * 60 * 1000;
  });

  const total = last24h.length;
  const timeStr = scheduleTime || now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (total === 0) {
    const msg = `🎙️ <b>PodcastFlow - ${timeStr}</b>\n\nAucun nouvel épisode dans les dernières 24h.`;
    await sendMessage(msg);
    return { count: 0, message: msg };
  }

  // Group by feed
  const byFeed = {};
  last24h.forEach(ep => {
    if (!byFeed[ep.feedName]) byFeed[ep.feedName] = [];
    byFeed[ep.feedName].push(ep);
  });

  const lines = Object.entries(byFeed).map(([feed, eps]) => {
    const epList = eps.slice(0, 3).map(e => `  • ${truncate(e.title, 60)}`).join('\n');
    return `📻 <b>${escapeHtml(feed)}</b> (${eps.length} ép.)\n${epList}`;
  });

  const msg = [
    `🎙️ <b>PodcastFlow - ${timeStr}</b>`,
    `📊 <b>${total} nouvel${total > 1 ? 'aux' : ''} épisode${total > 1 ? 's' : ''}</b> dans les 24 dernières heures\n`,
    lines.join('\n\n'),
  ].join('\n');

  await sendMessage(msg);
  return { count: total, message: `${total} épisode${total > 1 ? 's' : ''} - ${timeStr}` };
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
