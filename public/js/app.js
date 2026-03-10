/* ============================================
   PODCASTFLOW - Main Application v4.0
   Stats uniquement : podcasts comptabilisés + articles
   ============================================ */

'use strict';

// ===== DATA VERSION (bump = reset localStorage) =====
const DATA_VERSION = '4.0';

// ===== STATE =====
const state = {
  alertHistory: [],
  telegramConfig: { token: '', chatId: '', connected: false },
  schedules: [
    { time: '08:00', label: 'Matin',      enabled: true,  lastSent: null },
    { time: '10:00', label: 'Matinée',    enabled: true,  lastSent: null },
    { time: '12:00', label: 'Midi',       enabled: true,  lastSent: null },
    { time: '14:00', label: 'Déjeuner',   enabled: true,  lastSent: null },
    { time: '16:00', label: 'Après-midi', enabled: true,  lastSent: null },
    { time: '18:00', label: 'Soir',       enabled: true,  lastSent: null },
    { time: '20:00', label: 'Soirée',     enabled: true,  lastSent: null },
  ],
};

// ===== STORAGE =====
function saveState() {
  localStorage.setItem('pf_version', DATA_VERSION);
  localStorage.setItem('pf_schedules', JSON.stringify(state.schedules));
  localStorage.setItem('pf_telegram', JSON.stringify(state.telegramConfig));
  localStorage.setItem('pf_history', JSON.stringify(state.alertHistory.slice(0, 50)));
}

function loadState() {
  try {
    const version = localStorage.getItem('pf_version');
    if (version !== DATA_VERSION) {
      localStorage.clear();
      localStorage.setItem('pf_version', DATA_VERSION);
      console.log('🔄 Migration localStorage v' + DATA_VERSION);
    }

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
  loadStats();
}

// ===== STATS =====
let statsRetryTimer = null;

async function loadStats() {
  try {
    const res = await fetch('/api/stats');

    if (res.status === 503) {
      // Cache serveur pas encore prêt — réessai automatique dans 5 secondes
      setHeaderUpdated('Initialisation…');
      clearTimeout(statsRetryTimer);
      statsRetryTimer = setTimeout(loadStats, 5000);
      return;
    }

    if (!res.ok) throw new Error(`Erreur ${res.status}`);

    const data = await res.json();
    updateStats(data);
  } catch (e) {
    console.error('loadStats error:', e.message);
    setHeaderUpdated('Erreur de chargement');
  }
}

function updateStats(data) {
  const pods = data.pods || {};

  document.getElementById('stat-pod-today').textContent = pods.today ?? '—';
  document.getElementById('stat-pod-d1').textContent    = pods.d1    ?? '—';
  document.getElementById('stat-pod-d2').textContent    = pods.d2    ?? '—';

  if (data.updatedAt) {
    const t = new Date(data.updatedAt);
    setHeaderUpdated(`Mis à jour ${t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`);
  } else {
    setHeaderUpdated('Données chargées');
  }
}

function setHeaderUpdated(text) {
  const el = document.getElementById('header-updated');
  if (el) el.textContent = text;
}

window.refreshStats = async function() {
  const btn = document.getElementById('btn-refresh');
  if (btn) { btn.style.opacity = '0.4'; btn.disabled = true; }
  setHeaderUpdated('Actualisation…');
  clearTimeout(statsRetryTimer);
  await Promise.all([loadStats(), loadMonitoring()]);
  if (btn) { btn.style.opacity = ''; btn.disabled = false; }
};

// ===== MONITORING LIST =====
async function loadMonitoring() {
  try {
    const res = await fetch('/api/monitoring');
    if (!res.ok) return;
    const data = await res.json();
    renderMonitoring(data.feeds);
  } catch (e) {
    console.error('loadMonitoring error:', e.message);
  }
}

function renderMonitoring(feeds) {
  const list = document.getElementById('monitoring-list');
  const counter = document.getElementById('monitoring-active');
  if (!list) return;

  const activeCount = feeds.filter(f => f.today > 0).length;
  if (counter) counter.textContent = `${activeCount} / ${feeds.length} actifs`;

  list.innerHTML = feeds.map(f => {
    const active = f.today > 0;
    const timeStr = f.lastDate
      ? new Date(f.lastDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
      : null;
    return `
      <div class="monitor-row ${active ? 'monitor-active' : 'monitor-inactive'}">
        <div class="monitor-dot ${active ? 'dot-green' : 'dot-gray'}"></div>
        <div class="monitor-info">
          <span class="monitor-name">${escapeHtml(f.name)}</span>
          ${timeStr ? `<span class="monitor-time">${timeStr}</span>` : ''}
        </div>
        <div class="monitor-badge ${active ? 'badge-active' : 'badge-none'}">
          ${active ? f.today : '—'}
        </div>
      </div>`;
  }).join('');
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

// ===== PROFILE =====
window.clearAllData = function() {
  if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
  state.alertHistory = [];
  state.telegramConfig = { token: '', chatId: '', connected: false };
  localStorage.clear();
  navigateTo('home');
  showToast('Données réinitialisées', 'info');
};

// ===== NAVIGATION EVENTS =====
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
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
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// ===== INIT =====
loadState();
connectSSE();

// Affiche la vue Home et charge les stats + monitoring immédiatement
navigateTo('home');
loadMonitoring();

// Sync Telegram config au serveur
if (state.telegramConfig.token) {
  fetch('/api/telegram/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: state.telegramConfig.token, chatId: state.telegramConfig.chatId }),
  }).catch(() => {});
}

// Sync schedules au serveur
if (state.schedules) {
  fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules: state.schedules }),
  }).catch(() => {});
}
