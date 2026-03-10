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

// ===== ARTICLE FEEDS (client-side list — mirrors server/feeds-config ARTICLE_FEEDS_V2) =====
const ARTICLE_FEEDS_CLIENT = [
  { id: 'art-01', name: 'Société',             url: 'https://www.europe1.fr/rss/societe',               category: 'Société' },
  { id: 'art-02', name: 'Politique',           url: 'https://www.europe1.fr/rss/politique',             category: 'Politique' },
  { id: 'art-03', name: 'Sport',               url: 'https://www.europe1.fr/rss/sport',                 category: 'Sport' },
  { id: 'art-04', name: 'Culture',             url: 'https://www.europe1.fr/rss/culture',               category: 'Culture' },
  { id: 'art-05', name: 'Faits divers',        url: 'https://www.europe1.fr/rss/faits-divers',          category: 'Faits divers' },
  { id: 'art-06', name: 'Médias',              url: 'https://www.europe1.fr/rss/medias',                category: 'Médias' },
  { id: 'art-07', name: 'Économie',            url: 'https://www.europe1.fr/rss/economie',              category: 'Économie' },
  { id: 'art-08', name: 'International',       url: 'https://www.europe1.fr/rss/international',         category: 'International' },
  { id: 'art-09', name: 'Santé',               url: 'https://www.europe1.fr/rss/sante',                 category: 'Santé' },
  { id: 'art-10', name: 'People',              url: 'https://www.europe1.fr/rss/people',                category: 'People' },
  { id: 'art-11', name: 'Immobilier',          url: 'https://www.europe1.fr/rss/immobilier',            category: 'Immobilier' },
  { id: 'art-12', name: 'Guide shopping',      url: 'https://www.europe1.fr/rss/Guide%20shopping',      category: 'Guide shopping' },
  { id: 'art-13', name: 'Police-Justice',      url: 'https://www.europe1.fr/rss/police%20-%20justice',  category: 'Police-Justice' },
  { id: 'art-14', name: 'Sciences',            url: 'https://www.europe1.fr/rss/sciences',              category: 'Sciences' },
  { id: 'art-15', name: 'Environnement',       url: 'https://www.europe1.fr/rss/environnement',         category: 'Environnement' },
  { id: 'art-16', name: 'Technologies',        url: 'https://www.europe1.fr/rss/technologies',          category: 'Technologies' },
  { id: 'art-17', name: 'Animaux',             url: 'https://www.europe1.fr/rss/animaux',               category: 'Animaux' },
  { id: 'art-18', name: 'Cuisine',             url: 'https://www.europe1.fr/rss/cuisine',               category: 'Cuisine' },
  { id: 'art-19', name: 'Maison',              url: 'https://www.europe1.fr/rss/maison',                category: 'Maison' },
  { id: 'art-20', name: 'Lifestyle',           url: 'https://www.europe1.fr/rss/lifestyle',             category: 'Lifestyle' },
  { id: 'art-21', name: 'Insolite',            url: 'https://www.europe1.fr/rss/insolite',              category: 'Insolite' },
  { id: 'art-22', name: 'Horoscope',           url: 'https://www.europe1.fr/rss/horoscope',             category: 'Horoscope' },
  { id: 'art-23', name: 'Météo',               url: 'https://www.europe1.fr/rss/m%C3%A9t%C3%A9o',       category: 'Météo' },
  { id: 'art-24', name: 'Voyage',              url: 'https://www.europe1.fr/rss/voyage',                category: 'Voyage' },
  { id: 'art-25', name: 'Vie professionnelle', url: 'https://www.europe1.fr/rss/vie%20professionnelle', category: 'Vie pro' },
];

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

  if (viewName === 'ginette')  refreshGinette();
  if (viewName === 'home')     refreshHome();
  if (viewName === 'articles') refreshArticles();
  if (viewName === 'alerts')   renderAlerts();
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

// ===== GINETTE =====
let ginetteRetryTimer = null;

window.refreshGinette = async function() {
  const btn = document.getElementById('btn-refresh-ginette');
  if (btn) { btn.style.opacity = '0.4'; btn.disabled = true; }
  document.getElementById('ginette-updated').textContent = 'Actualisation…';
  clearTimeout(ginetteRetryTimer);
  await loadGinetteStats();
  if (btn) { btn.style.opacity = ''; btn.disabled = false; }
};

async function loadGinetteStats() {
  try {
    // Fetch podcast stats (server) + article stats (client-side browser) in parallel
    const podProm = fetch('/api/stats');
    const artProm = loadArticlesClientSide();

    const podRes = await podProm;
    if (podRes.status === 503) {
      document.getElementById('ginette-updated').textContent = 'Initialisation…';
      ginetteRetryTimer = setTimeout(loadGinetteStats, 5000);
      return;
    }

    const [pod, artData] = await Promise.all([podRes.json(), artProm]);

    // Labels de dates
    const now  = new Date();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const fmtDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('tug-date-today').textContent = fmtDate(now);
    document.getElementById('tug-date-yest').textContent  = fmtDate(yest);

    // Mise à jour des deux tug bars (articles depuis le navigateur = vrai compte)
    updateTug(pod.pods.today, artData.todayCount, '');   // J
    updateTug(pod.pods.d1,    artData.d1Count,    '-y'); // J-1

    const hm = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('ginette-updated').textContent = `Mis à jour ${hm}`;
  } catch (e) {
    console.error('loadGinetteStats error:', e.message);
    document.getElementById('ginette-updated').textContent = 'Erreur de chargement';
  }
}

function updateTug(pods, arts, suffix) {
  const total = pods + arts;
  document.getElementById(`tug-pod-num${suffix}`).textContent = pods;
  document.getElementById(`tug-art-num${suffix}`).textContent = arts;

  if (total === 0) {
    document.getElementById(`tug-pod-pct${suffix}`).textContent = '—';
    document.getElementById(`tug-art-pct${suffix}`).textContent = '—';
    document.getElementById(`tug-fill-pod${suffix}`).style.width = '50%';
    document.getElementById(`tug-fill-art${suffix}`).style.width = '50%';
    document.getElementById(`tug-fill-pod-pct${suffix}`).textContent = '';
    document.getElementById(`tug-fill-art-pct${suffix}`).textContent = '';
    return;
  }

  const podPct = Math.round((pods / total) * 100);
  const artPct = 100 - podPct;

  document.getElementById(`tug-pod-pct${suffix}`).textContent = podPct + '%';
  document.getElementById(`tug-art-pct${suffix}`).textContent = artPct + '%';
  document.getElementById(`tug-fill-pod${suffix}`).style.width = podPct + '%';
  document.getElementById(`tug-fill-art${suffix}`).style.width = artPct + '%';
  // Affiche le % dans la barre seulement si elle est assez large
  document.getElementById(`tug-fill-pod-pct${suffix}`).textContent = podPct >= 20 ? podPct + '%' : '';
  document.getElementById(`tug-fill-art-pct${suffix}`).textContent = artPct >= 20 ? artPct + '%' : '';
}

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

// ===== CLIENT-SIDE ARTICLE FETCHING =====
// Articles from europe1.fr are blocked by Cloudflare when fetched from Railway (datacenter IP).
// We fetch them directly from the browser via CORS proxies — same approach as podcasts_v2_3.html.

let _artCache = { data: null, expiresAt: 0 };
let _artFetchPromise = null; // coalesces concurrent callers

/** Midnight Paris time, N days ago. */
function parisMidnightClient(now, daysAgo) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  const str = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const [day, month, year] = str.split('/');
  const tzStr = d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', timeZoneName: 'short' });
  const offset = tzStr.includes('+2') ? '+02:00' : '+01:00';
  return new Date(`${year}-${month}-${day}T00:00:00${offset}`);
}

/** Fetch RSS XML via CORS proxies (corsproxy.io → allorigins raw → allorigins JSON). */
async function fetchArticleXML(url) {
  const t = Math.floor(Date.now() / 60000);
  const sep = url.includes('?') ? '&' : '?';
  const busted = `${url}${sep}_t=${t}`;
  const enc = encodeURIComponent(busted);

  const proxies = [
    () => fetch(`https://corsproxy.io/?url=${enc}`, { headers: { 'cache-control': 'no-store' } })
            .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    () => fetch(`https://api.allorigins.win/raw?url=${enc}`)
            .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    () => fetch(`https://api.allorigins.win/get?url=${enc}`)
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(j => { if (!j?.contents) throw new Error('no contents'); return j.contents; }),
  ];

  for (const attempt of proxies) {
    try {
      const xml = await attempt();
      if (xml && xml.includes('<item>')) return xml;
    } catch { /* try next proxy */ }
  }
  return null;
}

/** Parse <item> elements from RSS XML using DOMParser. */
function parseArticleItems(xml) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    return Array.from(doc.querySelectorAll('item')).map(item => {
      const rawDate = item.querySelector('pubDate')?.textContent?.trim();
      return {
        title: item.querySelector('title')?.textContent?.trim() || 'Sans titre',
        link:  item.querySelector('link')?.textContent?.trim()  || '',
        date:  rawDate ? new Date(rawDate) : null,
      };
    }).filter(i => i.date && !isNaN(i.date.getTime()));
  } catch { return []; }
}

/** Load all 25 article feeds client-side. Returns { todayCount, d1Count, d2Count, feeds }. */
async function loadArticlesClientSide() {
  if (_artCache.data && Date.now() < _artCache.expiresAt) return _artCache.data;
  if (_artFetchPromise) return _artFetchPromise;

  _artFetchPromise = (async () => {
    const now = new Date();
    const t0  = parisMidnightClient(now, 0); // today 00:00 Paris
    const t1  = parisMidnightClient(now, 1); // yesterday 00:00 Paris
    const t2  = parisMidnightClient(now, 2); // day-before 00:00 Paris

    const BATCH = 8;
    const feedResults = [];

    for (let i = 0; i < ARTICLE_FEEDS_CLIENT.length; i += BATCH) {
      const batch = ARTICLE_FEEDS_CLIENT.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (feed) => {
          const xml = await fetchArticleXML(feed.url);
          return { feed, items: xml ? parseArticleItems(xml) : [] };
        })
      );
      settled.forEach(r => { if (r.status === 'fulfilled') feedResults.push(r.value); });
    }

    let todayCount = 0, d1Count = 0, d2Count = 0;
    const feeds = feedResults.map(({ feed, items }) => {
      const todayItems = items.filter(i => i.date >= t0 && i.date < now);
      const d1Items    = items.filter(i => i.date >= t1 && i.date < t0);
      const d2Items    = items.filter(i => i.date >= t2 && i.date < t1);
      todayCount += todayItems.length;
      d1Count    += d1Items.length;
      d2Count    += d2Items.length;
      const last = todayItems[0] || null; // items already newest-first in RSS
      return {
        id:        feed.id,
        name:      feed.name,
        category:  feed.category,
        today:     todayItems.length,
        lastDate:  last ? last.date.toISOString() : null,
        lastTitle: last ? last.title : null,
        feedUrl:   feed.url,
      };
    });

    feeds.sort((a, b) => {
      if (a.lastDate && b.lastDate) return new Date(b.lastDate) - new Date(a.lastDate);
      if (a.lastDate) return -1;
      if (b.lastDate) return 1;
      return a.name.localeCompare(b.name, 'fr');
    });

    const data = { todayCount, d1Count, d2Count, feeds };
    _artCache = { data, expiresAt: Date.now() + 5 * 60 * 1000 };
    return data;
  })().finally(() => { _artFetchPromise = null; });

  return _artFetchPromise;
}

// ===== ARTICLES VIEW =====
let artRetryTimer = null;

window.refreshArticles = async function() {
  const btn = document.getElementById('btn-refresh-art');
  if (btn) { btn.style.opacity = '0.4'; btn.disabled = true; }
  document.getElementById('art-header-updated').textContent = 'Actualisation…';
  clearTimeout(artRetryTimer);
  await Promise.all([loadArticleStats(), loadArticleMonitoring()]);
  if (btn) { btn.style.opacity = ''; btn.disabled = false; }
};

async function loadArticleStats() {
  try {
    // Articles are fetched client-side (browser → CORS proxy → europe1.fr)
    // This bypasses Railway datacenter IP blocking by Cloudflare
    const data = await loadArticlesClientSide();
    document.getElementById('stat-art-today').textContent = data.todayCount;
    document.getElementById('stat-art-d1').textContent    = data.d1Count;
    document.getElementById('stat-art-d2').textContent    = data.d2Count;
    const hm = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('art-header-updated').textContent = `Mis à jour ${hm}`;
  } catch (e) {
    console.error('loadArticleStats error:', e.message);
    document.getElementById('art-header-updated').textContent = 'Erreur de chargement';
  }
}

async function loadArticleMonitoring() {
  try {
    const data = await loadArticlesClientSide();
    renderArticleMonitoring(data.feeds);
  } catch (e) {
    console.error('loadArticleMonitoring error:', e.message);
  }
}

function renderArticleMonitoring(feeds) {
  const list = document.getElementById('art-monitoring-list');
  const counter = document.getElementById('art-monitoring-active');
  if (!list) return;

  const activeCount = feeds.filter(f => f.today > 0).length;
  if (counter) counter.textContent = `${activeCount} / ${feeds.length} actifs`;

  list.innerHTML = feeds.map(f => {
    const active = f.today > 0;
    const timeStr = f.lastDate
      ? new Date(f.lastDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
      : null;
    const nameEl = f.feedUrl
      ? `<a class="monitor-name monitor-link" href="${escapeHtml(f.feedUrl)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>`
      : `<span class="monitor-name">${escapeHtml(f.name)}</span>`;
    return `
      <div class="monitor-row ${active ? 'monitor-active' : 'monitor-inactive'}">
        <div class="monitor-dot ${active ? 'dot-green' : 'dot-gray'}"></div>
        <div class="monitor-info">
          ${nameEl}
          ${timeStr ? `<span class="monitor-time">${timeStr}</span>` : ''}
          ${f.lastTitle ? `<span class="monitor-episode">${escapeHtml(f.lastTitle)}</span>` : ''}
        </div>
        <div class="monitor-badge ${active ? 'badge-active' : 'badge-none'}">
          ${active ? f.today : '—'}
        </div>
      </div>`;
  }).join('');
}

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
    const imgSrc = typeof f.image === 'string' && f.image ? f.image : null;
    const thumb = imgSrc
      ? `<img class="monitor-thumb" src="${escapeHtml(imgSrc)}" alt="" loading="lazy" width="36" height="36" onerror="this.style.display='none'">`
      : `<div class="monitor-thumb monitor-thumb-fallback">${escapeHtml((f.name || '?').charAt(0))}</div>`;
    const nameEl = f.feedUrl
      ? `<a class="monitor-name monitor-link" href="${escapeHtml(f.feedUrl)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>`
      : `<span class="monitor-name">${escapeHtml(f.name)}</span>`;
    return `
      <div class="monitor-row ${active ? 'monitor-active' : 'monitor-inactive'}">
        ${thumb}
        <div class="monitor-dot ${active ? 'dot-green' : 'dot-gray'}"></div>
        <div class="monitor-info">
          ${nameEl}
          ${timeStr ? `<span class="monitor-time">${timeStr}</span>` : ''}
          ${f.lastTitle ? `<span class="monitor-episode">${escapeHtml(f.lastTitle)}</span>` : ''}
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

window.clearAllData = function() {
  if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
  state.alertHistory = [];
  state.telegramConfig = { token: '', chatId: '', connected: false };
  localStorage.clear();
  navigateTo('ginette');
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

// Démarre sur Ginette, charge le monitoring podcasts en parallèle
navigateTo('ginette');
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
