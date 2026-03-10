/* ============================================
   PODCASTFLOW - Main Application
   ============================================ */

'use strict';

// ===== STATE =====
const state = {
  feeds: [],
  episodes: [],
  alertHistory: [],
  telegramConfig: { token: '', chatId: '', connected: false },
  schedules: [
    { time: '08:00', label: 'Matin',     enabled: true,  lastSent: null },
    { time: '10:00', label: 'Matinée',   enabled: true,  lastSent: null },
    { time: '12:00', label: 'Midi',      enabled: true,  lastSent: null },
    { time: '16:00', label: 'Après-midi',enabled: true,  lastSent: null },
    { time: '18:00', label: 'Soir',      enabled: true,  lastSent: null },
    { time: '20:00', label: 'Soirée',    enabled: true,  lastSent: null },
  ],
  categories: [
    { name: 'Émissions',       icon: '🎙️', count: 0 },
    { name: 'Info',            icon: '📰', count: 0 },
    { name: 'Éditos',          icon: '✍️',  count: 0 },
    { name: 'Interviews',      icon: '🎤', count: 0 },
    { name: 'Culture',         icon: '🎭', count: 0 },
    { name: 'Histoire',        icon: '📜', count: 0 },
    { name: 'Faits divers',    icon: '🔍', count: 0 },
    { name: 'Divertissement',  icon: '😄', count: 0 },
    { name: 'Musique',         icon: '🎵', count: 0 },
    { name: 'Médias',          icon: '📡', count: 0 },
    { name: 'Sport',           icon: '⚽', count: 0 },
    { name: 'Économie',        icon: '📈', count: 0 },
  ],
  popularPodcasts: [],
  defaultFeedsLoaded: false,
};

// ===== STORAGE =====
function saveState() {
  localStorage.setItem('pf_feeds', JSON.stringify(state.feeds));
  localStorage.setItem('pf_schedules', JSON.stringify(state.schedules));
  localStorage.setItem('pf_telegram', JSON.stringify(state.telegramConfig));
  localStorage.setItem('pf_history', JSON.stringify(state.alertHistory.slice(0, 50)));
}

function loadState() {
  try {
    const feeds = localStorage.getItem('pf_feeds');
    if (feeds) state.feeds = JSON.parse(feeds);

    const schedules = localStorage.getItem('pf_schedules');
    if (schedules) {
      const saved = JSON.parse(schedules);
      state.schedules = state.schedules.map((s, i) => saved[i] ? { ...s, ...saved[i] } : s);
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

  if (viewName === 'home') refreshHome();
  if (viewName === 'discover') renderPopular();
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
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'flex';
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

window.closeModal = closeModal;

// ===== HOME =====
function refreshHome() {
  updateStats();
  renderCategories();
  renderFeeds();
  loadEpisodes();
}

function updateStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEps = state.episodes.filter(e => new Date(e.date) >= today).length;

  document.getElementById('stat-feeds').textContent = state.feeds.length;
  document.getElementById('stat-episodes').textContent = state.episodes.length;
  document.getElementById('stat-today').textContent = todayEps;
  document.getElementById('header-feed-count').textContent =
    `${state.feeds.length} flux actif${state.feeds.length !== 1 ? 's' : ''}`;
}

// ===== CATEGORIES =====
function renderCategories() {
  const counts = {};
  state.feeds.forEach(f => {
    counts[f.category] = (counts[f.category] || 0) + 1;
  });

  state.categories.forEach(c => { c.count = counts[c.name] || 0; });

  const grid = document.getElementById('categories-grid');
  grid.innerHTML = state.categories.map(cat => `
    <div class="category-card" onclick="filterByCategory('${cat.name}')">
      <div class="category-left">
        <span class="category-icon">${cat.icon}</span>
        <div>
          <div class="category-name">${cat.name}</div>
          <div class="category-count">${cat.count} flux</div>
        </div>
      </div>
      <svg class="category-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `).join('');
}

window.filterByCategory = function(catName) {
  showToast(`Catégorie: ${catName}`, 'info');
};

// ===== FEEDS =====
function renderFeeds() {
  const list = document.getElementById('feeds-list');
  const empty = document.getElementById('feeds-empty');

  if (state.feeds.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty || createEmptyState());
    empty && (empty.style.display = 'flex');
    return;
  }

  if (empty) empty.style.display = 'none';

  const cat = state.categories.find(c => c.name);
  list.innerHTML = state.feeds.map(feed => {
    const catInfo = state.categories.find(c => c.name === feed.category);
    const newCount = state.episodes.filter(e => e.feedUrl === feed.url && isNew(e.date)).length;
    return `
    <div class="feed-item" onclick="showFeedDetail('${feed.id}')">
      <div class="feed-icon">${catInfo ? catInfo.icon : '🎙️'}</div>
      <div class="feed-info">
        <div class="feed-name">${escapeHtml(feed.name)}</div>
        <div class="feed-meta">${feed.category} · ${timeAgo(feed.lastFetched)}</div>
      </div>
      ${newCount > 0 ? `<span class="feed-badge">+${newCount}</span>` : ''}
      <div class="feed-actions">
        <button class="feed-delete-btn" onclick="deleteFeed('${feed.id}', event)" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
  `}).join('');
}

function isNew(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (now - d) < 24 * 60 * 60 * 1000;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'jamais';
  const d = new Date(dateStr);
  const diff = Date.now() - d;
  if (diff < 60000) return 'à l\'instant';
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
  return `il y a ${Math.floor(diff / 86400000)}j`;
}

window.showFeedDetail = function(id) {
  const feed = state.feeds.find(f => f.id === id);
  if (feed) showToast(`${feed.name}`, 'info');
};

window.deleteFeed = function(id, event) {
  event.stopPropagation();
  state.feeds = state.feeds.filter(f => f.id !== id);
  state.episodes = state.episodes.filter(e => e.feedId !== id);
  saveState();
  renderFeeds();
  updateStats();
  renderCategories();
  showToast('Flux supprimé', 'info');
};

// ===== EPISODES =====
async function loadEpisodes() {
  if (state.feeds.length === 0) {
    renderEpisodes([]);
    return;
  }

  const container = document.getElementById('episodes-scroll');
  container.innerHTML = `<div class="episodes-loading"><div class="spinner"></div><p>Chargement...</p></div>`;

  try {
    const results = await Promise.allSettled(
      state.feeds.map(feed => fetchEpisodes(feed))
    );

    const allEpisodes = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        allEpisodes.push(...r.value);
        state.feeds[i].lastFetched = new Date().toISOString();
      }
    });

    allEpisodes.sort((a, b) => new Date(b.date) - new Date(a.date));
    state.episodes = allEpisodes;
    saveState();
    updateStats();
    renderEpisodes(allEpisodes.slice(0, 15));
    renderFeeds();
  } catch (e) {
    renderEpisodes([]);
  }
}

async function fetchEpisodes(feed) {
  try {
    const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
    if (!res.ok) throw new Error('RSS fetch failed');
    const data = await res.json();
    return (data.items || []).slice(0, 10).map((item, idx) => ({
      id: `${feed.id}-${idx}`,
      feedId: feed.id,
      feedUrl: feed.url,
      feedName: feed.name,
      title: item.title || 'Sans titre',
      date: item.pubDate || item.isoDate || new Date().toISOString(),
      image: item.itunes?.image || data.image?.url || null,
      link: item.link || '',
    }));
  } catch {
    return [];
  }
}

function renderEpisodes(episodes) {
  const container = document.getElementById('episodes-scroll');

  if (episodes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="width:100%">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
        <p>Aucun épisode</p>
        <span>Ajoutez des flux RSS pour commencer</span>
      </div>`;
    return;
  }

  container.innerHTML = episodes.map(ep => {
    const isNewEp = isNew(ep.date);
    return `
    <div class="episode-card" onclick="openEpisode('${escapeAttr(ep.link)}')">
      <div class="episode-thumb">
        ${ep.image
          ? `<img src="${escapeAttr(ep.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'episode-thumb-placeholder\\'><svg width=\\'32\\' height=\\'32\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><rect x=\\'9\\' y=\\'2\\' width=\\'6\\' height=\\'12\\' rx=\\'3\\'/><path d=\\'M19 10a7 7 0 0 1-14 0\\'/></svg></div>'">`
          : `<div class="episode-thumb-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/></svg>
             </div>`
        }
        ${isNewEp ? '<span class="episode-new-badge">Nouveau</span>' : ''}
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

// ===== ADD FEED =====
window.validateAndAddFeed = async function() {
  const name = document.getElementById('feed-name').value.trim();
  const url = document.getElementById('feed-url').value.trim();
  const category = document.getElementById('feed-category').value;
  const resultEl = document.getElementById('feed-validate-result');
  const btn = document.getElementById('btn-validate-feed');

  if (!url) {
    resultEl.className = 'error';
    resultEl.textContent = 'Veuillez entrer une URL RSS.';
    resultEl.style.display = 'block';
    return;
  }

  if (state.feeds.some(f => f.url === url)) {
    resultEl.className = 'error';
    resultEl.textContent = 'Ce flux est déjà dans votre liste.';
    resultEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Validation...`;
  resultEl.style.display = 'none';

  try {
    const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('Flux invalide');
    const data = await res.json();

    const feedName = name || data.title || 'Podcast sans nom';
    const newFeed = {
      id: Date.now().toString(),
      name: feedName,
      url,
      category,
      lastFetched: new Date().toISOString(),
    };

    state.feeds.push(newFeed);
    saveState();

    resultEl.className = 'success';
    resultEl.textContent = `✓ "${feedName}" ajouté avec succès (${data.items?.length || 0} épisodes)`;
    resultEl.style.display = 'block';

    setTimeout(() => {
      closeModal('modal-add-feed');
      document.getElementById('feed-name').value = '';
      document.getElementById('feed-url').value = '';
      resultEl.style.display = 'none';
      renderFeeds();
      updateStats();
      renderCategories();
      loadEpisodes();
      showToast(`"${feedName}" ajouté !`, 'success');
    }, 1200);
  } catch (e) {
    resultEl.className = 'error';
    resultEl.textContent = 'Flux RSS invalide ou inaccessible. Vérifiez l\'URL.';
    resultEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Ajouter`;
  }
};

// ===== DEFAULT FEEDS (Europe 1) =====
async function loadDefaultFeeds() {
  if (state.defaultFeedsLoaded || state.feeds.length > 0) return;

  try {
    const res = await fetch('/api/feeds/default');
    if (!res.ok) return;
    const data = await res.json();

    // Add all feeds with lastFetched = null (will be fetched on demand)
    state.feeds = data.feeds.map(f => ({
      ...f,
      lastFetched: null,
    }));
    state.defaultFeedsLoaded = true;
    saveState();

    // Sync with scheduler
    fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeds: state.feeds }),
    }).catch(() => {});

    renderFeeds();
    updateStats();
    renderCategories();
    showToast(`${state.feeds.length} flux Europe 1 chargés`, 'success');
  } catch (e) {
    console.warn('Could not load default feeds:', e.message);
  }
}

// ===== POPULAR PODCASTS (Discover tab — shows all E1 feeds not yet added) =====
async function renderPopular() {
  const grid = document.getElementById('popular-grid');

  // Show loading
  grid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 10px"></div><p>Chargement...</p></div>`;

  try {
    const res = await fetch('/api/feeds/default');
    const data = await res.json();

    const catIcons = {
      'Émissions': '🎙️', 'Info': '📰', 'Éditos': '✍️', 'Interviews': '🎤',
      'Culture': '🎭', 'Histoire': '📜', 'Faits divers': '🔍',
      'Divertissement': '😄', 'Musique': '🎵', 'Médias': '📡',
      'Sport': '⚽', 'Économie': '📈',
    };

    grid.innerHTML = data.feeds.map((p, i) => {
      const alreadyAdded = state.feeds.some(f => f.url === p.url);
      const icon = catIcons[p.category] || '🎙️';
      return `
      <div class="popular-card">
        <div class="popular-thumb">
          <span style="font-size:28px">${icon}</span>
          ${!alreadyAdded
            ? `<button class="popular-add-btn" onclick="addDefaultFeed(${i})" title="Ajouter">+</button>`
            : `<span class="popular-add-btn" style="background:var(--success);font-size:12px">✓</span>`
          }
        </div>
        <div class="popular-info">
          <div class="popular-name">${escapeHtml(p.name)}</div>
          <div class="popular-cat">${p.category}${p.statut === 'hors-comptage' ? ' · hors-comptage' : ''}</div>
        </div>
      </div>`;
    }).join('');

    window._discoverFeeds = data.feeds;
  } catch {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-muted)">Impossible de charger les flux.</div>`;
  }
}

window.addDefaultFeed = function(index) {
  const feeds = window._discoverFeeds || [];
  const p = feeds[index];
  if (!p) return;
  if (state.feeds.some(f => f.url === p.url)) {
    showToast('Déjà dans votre liste', 'info');
    return;
  }
  state.feeds.push({ ...p, lastFetched: null });
  saveState();
  renderPopular();
  showToast(`"${p.name}" ajouté`, 'success');
};

window.addPopularFeed = window.addDefaultFeed;

// ===== ALERTS =====
function renderAlerts() {
  renderTelegramStatus();
  renderSchedules();
  renderHistory();
  loadTelegramForm();
}

function loadTelegramForm() {
  if (state.telegramConfig.token) {
    document.getElementById('telegram-token').value = state.telegramConfig.token;
  }
  if (state.telegramConfig.chatId) {
    document.getElementById('telegram-chat-id').value = state.telegramConfig.chatId;
  }
}

function renderTelegramStatus() {
  const dot = document.getElementById('telegram-status-dot');
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
  const item = document.querySelectorAll('.schedule-item')[index];
  if (item) item.classList.toggle('active-schedule', enabled);
  saveState();

  // Sync with backend
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

// ===== SAVE TELEGRAM CONFIG =====
document.getElementById('btn-save-telegram').addEventListener('click', async () => {
  const token = document.getElementById('telegram-token').value.trim();
  const chatId = document.getElementById('telegram-chat-id').value.trim();

  if (!token || !chatId) {
    showToast('Veuillez renseigner le token et le Chat ID', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-telegram');
  btn.disabled = true;
  btn.textContent = 'Test en cours...';

  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId }),
    });
    const data = await res.json();

    if (data.ok) {
      state.telegramConfig = { token, chatId, connected: true };
      saveState();

      // Sync with backend
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
  } catch (e) {
    showToast('Impossible de se connecter au serveur', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Sauvegarder`;
  }
});

// ===== TEST ALERT =====
document.getElementById('btn-test-alert').addEventListener('click', async () => {
  if (!state.telegramConfig.connected) {
    showToast('Configurez d\'abord Telegram', 'error');
    return;
  }

  try {
    const count = state.episodes.filter(e => isNew(e.date)).length;
    const res = await fetch('/api/alert/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual: true }),
    });
    const data = await res.json();

    if (data.ok) {
      const entry = { message: 'Alerte de test envoyée', count, sentAt: new Date().toISOString() };
      state.alertHistory.unshift(entry);
      saveState();
      renderHistory();
      showToast(`Alerte envoyée ! (${count} épisodes)`, 'success');
    } else {
      showToast('Erreur lors de l\'envoi', 'error');
    }
  } catch {
    showToast('Impossible de se connecter au serveur', 'error');
  }
});

// ===== TELEGRAM HELP =====
window.showTelegramHelp = function() {
  openModal('modal-telegram-help');
};

// ===== SEARCH =====
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.style.display = q ? 'flex' : 'none';
  filterEpisodes(q);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  renderEpisodes(state.episodes.slice(0, 15));
});

function filterEpisodes(query) {
  if (!query) {
    renderEpisodes(state.episodes.slice(0, 15));
    return;
  }
  const q = query.toLowerCase();
  const filtered = state.episodes.filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.feedName.toLowerCase().includes(q)
  );
  renderEpisodes(filtered.slice(0, 15));
}

// ===== PROFILE =====
window.exportData = function() {
  const data = {
    feeds: state.feeds,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  const opml = generateOPML(data.feeds);
  downloadFile(opml, 'podcastflow-feeds.opml', 'text/xml');
  showToast('Export OPML téléchargé', 'success');
};

function generateOPML(feeds) {
  const items = feeds.map(f =>
    `  <outline text="${escapeXml(f.name)}" type="rss" xmlUrl="${escapeXml(f.url)}" category="${escapeXml(f.category)}"/>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>PodcastFlow Export</title></head>
  <body>\n${items}\n  </body>
</opml>`;
}

window.importData = function() {
  document.getElementById('import-file').click();
};

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const outlines = doc.querySelectorAll('outline[xmlUrl]');

    let added = 0;
    outlines.forEach(o => {
      const url = o.getAttribute('xmlUrl');
      const name = o.getAttribute('text') || o.getAttribute('title') || 'Podcast';
      const category = o.getAttribute('category') || 'Autre';

      if (!state.feeds.some(f => f.url === url)) {
        state.feeds.push({
          id: Date.now().toString() + Math.random(),
          name,
          url,
          category,
          lastFetched: null,
        });
        added++;
      }
    });

    saveState();
    showToast(`${added} flux importés`, 'success');
    navigateTo('home');
  } catch {
    showToast('Erreur lors de l\'import', 'error');
  }
  e.target.value = '';
});

window.clearAllData = function() {
  if (!confirm('Supprimer tous vos flux et paramètres ? Cette action est irréversible.')) return;
  state.feeds = [];
  state.episodes = [];
  state.alertHistory = [];
  state.telegramConfig = { token: '', chatId: '', connected: false };
  localStorage.clear();
  refreshHome();
  showToast('Données réinitialisées', 'info');
};

// ===== NAVIGATION EVENTS =====
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

document.getElementById('btn-add-feed').addEventListener('click', () => {
  document.getElementById('feed-name').value = '';
  document.getElementById('feed-url').value = '';
  document.getElementById('feed-validate-result').style.display = 'none';
  openModal('modal-add-feed');
});

document.getElementById('btn-explore').addEventListener('click', () => navigateTo('discover'));
document.getElementById('btn-view-all-episodes').addEventListener('click', () => {
  showToast('Affichage de tous les épisodes', 'info');
});

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// ===== SERVER-SENT EVENTS (live updates from server) =====
function connectSSE() {
  try {
    const evtSource = new EventSource('/api/events');

    evtSource.addEventListener('alert-sent', (e) => {
      const data = JSON.parse(e.data);
      state.alertHistory.unshift({
        message: data.message,
        count: data.count,
        sentAt: data.sentAt,
      });
      saveState();

      const badge = document.getElementById('notif-badge');
      const currentCount = parseInt(badge.textContent || '0') + 1;
      badge.textContent = currentCount;
      badge.style.display = 'flex';

      if (document.querySelector('#view-alerts.active')) {
        renderHistory();
      }
    });

    evtSource.addEventListener('error', () => {
      setTimeout(connectSSE, 5000);
    });
  } catch (e) {
    // SSE not available, skip
  }
}

// ===== UTILS =====
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ===== INIT =====
loadState();
connectSSE();

// On first launch (no feeds saved): auto-load all Europe 1 feeds
loadDefaultFeeds().then(() => {
  refreshHome();
});

// If feeds already exist, render immediately
if (state.feeds.length > 0) {
  refreshHome();
}

// Sync Telegram config with server
if (state.telegramConfig.token) {
  fetch('/api/telegram/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: state.telegramConfig.token,
      chatId: state.telegramConfig.chatId,
    }),
  }).catch(() => {});
}

// Sync schedules with server
if (state.schedules) {
  fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules: state.schedules }),
  }).catch(() => {});
}

// Sync feeds with server scheduler
if (state.feeds.length > 0) {
  fetch('/api/feeds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feeds: state.feeds }),
  }).catch(() => {});
}
