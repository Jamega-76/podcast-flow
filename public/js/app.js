/* ============================================
   PODCASTFLOW - Main Application v3.0
   ============================================ */

'use strict';

// ===== DATA VERSION (bump to force localStorage reset) =====
const DATA_VERSION = '3.0';

// ===== STATE =====
const state = {
  feeds: [],
  episodes: [],          // tous les contenus (podcasts + articles)
  alertHistory: [],
  telegramConfig: { token: '', chatId: '', connected: false },
  contentFilter: 'all',  // 'all' | 'podcast' | 'article'
  schedules: [
    { time: '08:00', label: 'Matin',      enabled: true,  lastSent: null },
    { time: '10:00', label: 'Matinée',    enabled: true,  lastSent: null },
    { time: '12:00', label: 'Midi',       enabled: true,  lastSent: null },
    { time: '14:00', label: 'Déjeuner',   enabled: true,  lastSent: null },
    { time: '16:00', label: 'Après-midi', enabled: true,  lastSent: null },
    { time: '18:00', label: 'Soir',       enabled: true,  lastSent: null },
    { time: '20:00', label: 'Soirée',     enabled: true,  lastSent: null },
  ],
  defaultFeedsLoaded: false,
};

// ===== STORAGE =====
function saveState() {
  localStorage.setItem('pf_version', DATA_VERSION);
  localStorage.setItem('pf_feeds', JSON.stringify(state.feeds));
  localStorage.setItem('pf_schedules', JSON.stringify(state.schedules));
  localStorage.setItem('pf_telegram', JSON.stringify(state.telegramConfig));
  localStorage.setItem('pf_history', JSON.stringify(state.alertHistory.slice(0, 50)));
}

function loadState() {
  try {
    const version = localStorage.getItem('pf_version');
    if (version !== DATA_VERSION) {
      localStorage.removeItem('pf_feeds');
      localStorage.removeItem('pf_schedules');
      localStorage.setItem('pf_version', DATA_VERSION);
      console.log('🔄 Migration localStorage v' + DATA_VERSION);
    }

    const feeds = localStorage.getItem('pf_feeds');
    if (feeds) state.feeds = JSON.parse(feeds);

    const schedules = localStorage.getItem('pf_schedules');
    if (schedules) {
      const saved = JSON.parse(schedules);
      state.schedules = state.schedules.map(s => {
        const sv = saved.find(x => x.time === s.time);
        return sv ? { ...s, ...sv } : s;
      });
    }

    const tg = localStorage.getItem('pf_telegram');
    if (tg) state.telegramConfig = JSON.parse(tg);

    const hist = localStorage.getItem('pf_history');
    if (hist) state.alertHistory = JSON.parse(hist);
  } catch (e) {
    console.warn('Load state error:', e);
  }
}

// ===== NAVIGATION =====
function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`view-${viewName}`);
  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (view) view.classList.add('active');
  if (navItem) navItem.classList.add('active');

  if (viewName === 'home')   refreshHome();
  if (viewName === 'alerts') renderAlerts();
}

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ===== MODAL =====
function openModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'flex'; }
function closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; }
window.closeModal = closeModal;

// ===== HOME =====
function refreshHome() {
  updateStats();
  loadEpisodes();
}

function dateOnly(d) {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

function updateStats() {
  const now    = new Date();
  const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d1Ts    = todayTs - 86400000;
  const d2Ts    = todayTs - 2 * 86400000;

  const pods = state.episodes.filter(e => e.type !== 'article');
  const arts = state.episodes.filter(e => e.type === 'article');

  const count = (arr, ts) => arr.filter(e => dateOnly(e.date) === ts).length;

  // Podcasts
  document.getElementById('stat-pod-today').textContent = count(pods, todayTs);
  document.getElementById('stat-pod-d1').textContent    = count(pods, d1Ts);
  document.getElementById('stat-pod-d2').textContent    = count(pods, d2Ts);

  // Articles
  document.getElementById('stat-art-today').textContent = count(arts, todayTs);
  document.getElementById('stat-art-d1').textContent    = count(arts, d1Ts);
  document.getElementById('stat-art-d2').textContent    = count(arts, d2Ts);

  // Ratio bar (basé sur le total)
  const totalToday = count(pods, todayTs) + count(arts, todayTs);
  const podToday   = count(pods, todayTs);
  const podPct = totalToday > 0 ? Math.round((podToday / totalToday) * 100) : 50;
  const artPct = 100 - podPct;

  document.getElementById('ratio-bar-pod').style.width = podPct + '%';
  document.getElementById('ratio-bar-art').style.width = artPct + '%';
  document.getElementById('ratio-label-pod').textContent = `🎙️ ${podPct}%`;
  document.getElementById('ratio-label-art').textContent = `📰 ${artPct}%`;

  document.getElementById('header-feed-count').textContent =
    `${state.feeds.length} flux actif${state.feeds.length !== 1 ? 's' : ''}`;
}

// ===== FILTER =====
window.setFilter = function(type) {
  state.contentFilter = type;
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === type);
  });
  renderFilteredEpisodes();
};

function getFilteredEpisodes() {
  if (state.contentFilter === 'podcast') return state.episodes.filter(e => e.type !== 'article');
  if (state.contentFilter === 'article') return state.episodes.filter(e => e.type === 'article');
  return state.episodes;
}

function renderFilteredEpisodes() {
  const filtered = getFilteredEpisodes();
  renderEpisodes(filtered.slice(0, 25));
}

// ===== EPISODES =====
async function loadEpisodes() {
  if (state.feeds.length === 0) { renderEpisodes([]); return; }

  const container = document.getElementById('episodes-scroll');
  container.innerHTML = `<div class="episodes-loading"><div class="spinner"></div><p>Chargement des contenus...</p></div>`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const res = await fetch('/api/episodes/recent', { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
    const data = await res.json();

    const allItems = data.episodes || [];
    const userFeedUrls = new Set(state.feeds.map(f => f.url));
    const filtered = allItems.filter(e => userFeedUrls.has(e.feedUrl));
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    state.episodes = filtered;
    const updatedAt = data.updatedAt || new Date().toISOString();
    state.feeds.forEach(f => { f.lastFetched = updatedAt; });

    saveState();
    updateStats();
    renderFilteredEpisodes();

  } catch (e) {
    console.error('loadEpisodes error:', e.message);
    container.innerHTML = `
      <div class="empty-state" style="width:100%">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Chargement impossible</p>
        <span>Le serveur initialise les données, réessayez dans quelques secondes.</span>
        <button onclick="loadEpisodes()" style="margin-top:12px;padding:8px 20px;background:var(--orange);color:#fff;border-radius:20px;border:none;font-size:13px;cursor:pointer">Réessayer</button>
      </div>`;
  }
}

function renderEpisodes(episodes) {
  const container = document.getElementById('episodes-scroll');

  if (episodes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="width:100%">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/></svg>
        <p>Aucun contenu</p>
        <span>Aucun résultat pour ce filtre</span>
      </div>`;
    return;
  }

  container.innerHTML = episodes.map(ep => {
    const isArticle = ep.type === 'article';
    const isNewEp = isNew(ep.date);
    return `
    <div class="episode-card ${isArticle ? 'article-card' : ''}" onclick="openEpisode('${escapeAttr(ep.link)}')">
      <div class="episode-thumb">
        ${ep.image && !isArticle
          ? `<img src="${escapeAttr(ep.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'episode-thumb-placeholder\\'>${isArticle ? '📰' : '🎙️'}</div>'">`
          : `<div class="episode-thumb-placeholder">${isArticle ? '<span style="font-size:28px">📰</span>' : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/></svg>'}</div>`
        }
        ${isNewEp ? '<span class="episode-new-badge">Nouveau</span>' : ''}
        <span class="episode-type-badge ${isArticle ? 'badge-article' : 'badge-podcast'}">${isArticle ? '📰' : '🎙️'}</span>
      </div>
      <div class="episode-info">
        <div class="episode-podcast-name">${escapeHtml(ep.feedName)}</div>
        <div class="episode-title">${escapeHtml(ep.title)}</div>
        <div class="episode-date">${formatDate(ep.date)}</div>
      </div>
    </div>`;
  }).join('');
}

window.openEpisode = function(url) {
  if (url) window.open(url, '_blank', 'noopener');
};

function isNew(dateStr) {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr)) < 24 * 60 * 60 * 1000;
}

// ===== DEFAULT FEEDS (Europe 1 — 124 flux) =====
async function loadDefaultFeeds() {
  if (state.defaultFeedsLoaded || state.feeds.length > 0) return;

  try {
    const res = await fetch('/api/feeds/default?all=1');
    if (!res.ok) return;
    const data = await res.json();

    state.feeds = data.feeds.map(f => ({ ...f, lastFetched: null }));
    state.defaultFeedsLoaded = true;
    saveState();

    fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeds: state.feeds }),
    }).catch(() => {});

    updateStats();
    showToast(`${state.feeds.length} flux Europe 1 chargés`, 'success');
  } catch (e) {
    console.warn('Could not load default feeds:', e.message);
  }
}

// ===== ALERTS =====
function renderAlerts() {
  renderTelegramStatus();
  renderSchedules();
  renderHistory();
  loadTelegramForm();
}

function loadTelegramForm() {
  if (state.telegramConfig.token) document.getElementById('telegram-token').value = state.telegramConfig.token;
  if (state.telegramConfig.chatId) document.getElementById('telegram-chat-id').value = state.telegramConfig.chatId;
}

function renderTelegramStatus() {
  const dot  = document.getElementById('telegram-status-dot');
  const text = document.getElementById('telegram-status-text');
  if (state.telegramConfig.connected) {
    dot.className = 'telegram-status-dot connected';
    text.textContent = 'Connecté · Chat ID ' + state.telegramConfig.chatId;
  } else if (state.telegramConfig.token) {
    dot.className = 'telegram-status-dot';
    text.textContent = 'Token enregistré, non testé';
  } else {
    dot.className = 'telegram-status-dot';
    text.textContent = 'Non configuré';
  }
}

function renderSchedules() {
  const list = document.getElementById('schedule-list');
  list.innerHTML = state.schedules.map((s, i) => `
    <div class="schedule-item ${s.enabled ? 'active-schedule' : ''}">
      <span class="schedule-time">${s.time}</span>
      <div class="schedule-desc">
        <div>${s.label}</div>
        ${s.lastSent ? `<div class="schedule-last-sent">Dernier envoi: ${formatDate(s.lastSent)}</div>` : ''}
      </div>
      <label class="toggle">
        <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSchedule(${i}, this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

window.toggleSchedule = function(index, enabled) {
  state.schedules[index].enabled = enabled;
  document.querySelectorAll('.schedule-item')[index]?.classList.toggle('active-schedule', enabled);
  saveState();
  fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules: state.schedules }),
  }).catch(() => {});
};

function renderHistory() {
  const container = document.getElementById('alert-history');
  if (state.alertHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <p>Aucune alerte envoyée</p>
      </div>`;
    return;
  }
  container.innerHTML = state.alertHistory.slice(0, 10).map(h => `
    <div class="history-item">
      <div class="history-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </div>
      <div class="history-content">
        <div class="history-text">${escapeHtml(h.message)}</div>
        <div class="history-time">${formatDate(h.sentAt)}</div>
      </div>
      <span class="history-count">${h.count}</span>
    </div>
  `).join('');
}

// ===== TELEGRAM CONFIG =====
document.getElementById('btn-save-telegram').addEventListener('click', async () => {
  const token  = document.getElementById('telegram-token').value.trim();
  const chatId = document.getElementById('telegram-chat-id').value.trim();
  if (!token || !chatId) { showToast('Veuillez renseigner le token et le Chat ID', 'error'); return; }

  const btn = document.getElementById('btn-save-telegram');
  btn.disabled = true;
  btn.textContent = 'Test en cours...';

  try {
    const res  = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId }),
    });
    const data = await res.json();

    if (data.ok) {
      state.telegramConfig = { token, chatId, connected: true };
      saveState();
      await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId }),
      });
      renderTelegramStatus();
      showToast('Telegram configuré avec succès !', 'success');
    } else {
      state.telegramConfig.connected = false;
      saveState();
      renderTelegramStatus();
      showToast(`Erreur: ${data.error || 'Token ou Chat ID invalide'}`, 'error');
    }
  } catch { showToast('Impossible de se connecter au serveur', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Sauvegarder`;
  }
});

// ===== TEST ALERT =====
document.getElementById('btn-test-alert').addEventListener('click', async () => {
  if (!state.telegramConfig.connected) { showToast('Configurez d\'abord Telegram', 'error'); return; }
  try {
    const res  = await fetch('/api/alert/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual: true }) });
    const data = await res.json();
    if (data.ok) {
      const entry = { message: data.message || 'Alerte envoyée', count: data.count || 0, sentAt: new Date().toISOString() };
      state.alertHistory.unshift(entry);
      saveState();
      renderHistory();
      showToast('Alerte envoyée !', 'success');
    } else { showToast('Erreur lors de l\'envoi', 'error'); }
  } catch { showToast('Impossible de se connecter au serveur', 'error'); }
});

window.showTelegramHelp = function() { openModal('modal-telegram-help'); };

// ===== SEARCH =====
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'flex' : 'none';
  if (!q) { renderFilteredEpisodes(); return; }
  const ql = q.toLowerCase();
  const results = getFilteredEpisodes().filter(e =>
    e.title.toLowerCase().includes(ql) || e.feedName.toLowerCase().includes(ql)
  );
  renderEpisodes(results.slice(0, 25));
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  renderFilteredEpisodes();
});

// ===== PROFILE =====
window.clearAllData = function() {
  if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
  state.feeds = [];
  state.episodes = [];
  state.alertHistory = [];
  state.telegramConfig = { token: '', chatId: '', connected: false };
  state.defaultFeedsLoaded = false;
  localStorage.clear();
  refreshHome();
  showToast('Données réinitialisées', 'info');
};

// ===== NAVIGATION EVENTS =====
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

document.getElementById('btn-explore').addEventListener('click', () => navigateTo('alerts'));
document.getElementById('btn-view-all-episodes').addEventListener('click', () => {
  window.setFilter('all');
  searchInput.value = '';
  searchClear.style.display = 'none';
  renderFilteredEpisodes();
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// ===== SSE =====
function connectSSE() {
  try {
    const evtSource = new EventSource('/api/events');
    evtSource.addEventListener('alert-sent', (e) => {
      const data = JSON.parse(e.data);
      state.alertHistory.unshift({ message: data.message, count: data.count, sentAt: data.sentAt });
      saveState();
      const badge = document.getElementById('notif-badge');
      badge.textContent = (parseInt(badge.textContent || '0') + 1).toString();
      badge.style.display = 'flex';
      if (document.querySelector('#view-alerts.active')) renderHistory();
    });
    evtSource.addEventListener('error', () => setTimeout(connectSSE, 5000));
  } catch { /* SSE not available */ }
}

// ===== UTILS =====
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}
function timeAgo(dateStr) {
  if (!dateStr) return 'jamais';
  const diff = Date.now() - new Date(dateStr);
  if (diff < 60000) return 'à l\'instant';
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
  return `il y a ${Math.floor(diff / 86400000)}j`;
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// ===== INIT =====
loadState();
connectSSE();

loadDefaultFeeds().then(() => refreshHome());
if (state.feeds.length > 0) refreshHome();

if (state.telegramConfig.token) {
  fetch('/api/telegram/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: state.telegramConfig.token, chatId: state.telegramConfig.chatId }),
  }).catch(() => {});
}

if (state.schedules) {
  fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules: state.schedules }),
  }).catch(() => {});
}
