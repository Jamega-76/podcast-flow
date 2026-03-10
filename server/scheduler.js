'use strict';

const cron = require('node-cron');
const telegram = require('./telegram');
const { fetchAllFeeds } = require('./rss');

// In-memory state (synced from frontend)
let feeds = [];
let schedules = [
  { time: '08:00', label: 'Matin',      enabled: true,  cron: '0 8 * * *'  },
  { time: '10:00', label: 'Matinée',    enabled: true,  cron: '0 10 * * *' },
  { time: '12:00', label: 'Midi',       enabled: true,  cron: '0 12 * * *' },
  { time: '14:00', label: 'Déjeuner',   enabled: true,  cron: '0 14 * * *' },
  { time: '16:00', label: 'Après-midi', enabled: true,  cron: '0 16 * * *' },
  { time: '18:00', label: 'Soir',       enabled: true,  cron: '0 18 * * *' },
  { time: '20:00', label: 'Soirée',     enabled: true,  cron: '0 20 * * *' },
];

// Event listeners for SSE
const listeners = new Set();

// Registered cron tasks
const tasks = new Map();

/**
 * Register an SSE client
 */
function addListener(res) {
  listeners.add(res);
  res.on('close', () => listeners.delete(res));
}

/**
 * Broadcast an event to all SSE clients
 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  listeners.forEach(res => {
    try { res.write(payload); } catch { listeners.delete(res); }
  });
}

/**
 * Update feeds list
 */
function setFeeds(newFeeds) {
  feeds = newFeeds;
}

/**
 * Update schedule configuration from frontend (matched by time string)
 */
function updateSchedules(newSchedules) {
  newSchedules.forEach((s) => {
    const found = schedules.find(sc => sc.time === s.time);
    if (found) found.enabled = s.enabled;
  });
  console.log('📅 Schedules updated:', schedules.map(s => `${s.time}=${s.enabled ? 'ON' : 'OFF'}`).join(' '));
}

/**
 * Execute the alert for a given time slot
 */
async function runAlert(time, label) {
  console.log(`\n⏰ [${new Date().toLocaleTimeString('fr-FR')}] Running alert for ${time} - ${label}`);

  if (feeds.length === 0) {
    console.log('   No feeds configured, skipping.');
    return;
  }

  try {
    const episodes = await fetchAllFeeds(feeds);
    const result = await telegram.sendPodcastAlert(episodes, time);

    console.log(`   ✅ Sent: ${result.count} episodes`);

    broadcast('alert-sent', {
      time,
      count: result.count,
      message: result.message,
      sentAt: new Date().toISOString(),
    });

    return result;
  } catch (err) {
    console.error(`   ❌ Alert failed: ${err.message}`);
    throw err;
  }
}

/**
 * Manual alert trigger
 */
async function sendManualAlert() {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return runAlert(time, 'Manuel');
}

/**
 * Start all cron jobs
 */
function startScheduler() {
  // Clean up existing tasks
  tasks.forEach(t => t.destroy());
  tasks.clear();

  schedules.forEach((s, i) => {
    const task = cron.schedule(s.cron, async () => {
      if (!schedules[i].enabled) {
        console.log(`⏭️  Skipping ${s.time} (disabled)`);
        return;
      }
      await runAlert(s.time, s.label);
    }, {
      timezone: 'Europe/Paris',
    });

    tasks.set(s.time, task);
    console.log(`⏰ Scheduled: ${s.time} (${s.cron}) [${s.enabled ? 'ON' : 'OFF'}]`);
  });

  console.log('✅ Scheduler started with', tasks.size, 'jobs (timezone: Europe/Paris)');
}

module.exports = {
  startScheduler,
  addListener,
  broadcast,
  setFeeds,
  updateSchedules,
  sendManualAlert,
  runAlert,
};
