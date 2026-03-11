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
  if (viewName === 'articles') initArticlesView();
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
    const podRes = await fetch('/api/stats');
    if (podRes.status === 503) {
      document.getElementById('ginette-updated').textContent = 'Initialisation…';
      ginetteRetryTimer = setTimeout(loadGinetteStats, 5000);
      return;
    }
    const pod = await podRes.json();

    // Articles : données du dernier comptage manuel (cache session)
    const artTodayCount = _artCache.data?.todayCount ?? 0;
    // J-1 articles : snapshot localStorage du jour précédent (figé) > cache session
    const snapYest   = getArticleSnapshot(1);
    const artD1Count = snapYest?.count ?? _artCache.data?.d1Count ?? 0;

    // Labels de dates
    const now  = new Date();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const fmtDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('tug-date-today').textContent = fmtDate(now);
    document.getElementById('tug-date-yest').textContent  = fmtDate(yest);

    updateTug(pod.pods.today, artTodayCount, '');   // J
    updateTug(pod.pods.d1,    artD1Count,    '-y'); // J-1

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
// Méthode identique à podcasts_v2_3.html :
//   - isValidXML() pour rejeter les pages d'erreur HTML de Cloudflare
//   - parseRSSDate() pour gérer CET/CEST (timezones nommées ignorées par new Date())
//   - Support RSS 2.0 (<item>) + Atom (<entry>) + fallback text/html si XML mal formé
//   - Stratégie paires [[0,1],[2,3],[4]] : 2 proxies en simultané, plus rapide et robuste
//   - AbortSignal.timeout(8000) : aucun proxy ne bloque indéfiniment
//   - _feedCache : cache session par URL (évite de re-fetcher lors du recomptage)

let _artCache     = { data: null, expiresAt: 0 };
const _feedCache  = {}; // cache session : url → xml|null (vidé à chaque nouveau comptage)

/** Vérifie que le texte est du XML RSS/Atom et non une page HTML d'erreur. */
function isValidXML(text) {
  if (!text || text.length < 50) return false;
  const lower = text.trimStart().toLowerCase();
  if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) return false;
  return text.includes('<rss') || text.includes('<feed') || text.includes('<channel>') || text.includes('<?xml');
}

/** Parse une date RSS en gérant les timezones nommées (CET, CEST…) ignorées par new Date(). */
function parseRSSDate(str) {
  if (!str) return null;
  let d = new Date(str);
  if (!isNaN(d)) return d;
  // Remplace les noms de timezone par leur offset numérique
  const tzMap = { CET: '+0100', CEST: '+0200', GMT: '+0000', UTC: '+0000', EST: '-0500', PST: '-0800' };
  const fixed = str.replace(/(CEST|CET|GMT|UTC|EST|PST)/, m => tzMap[m] || '+0000');
  d = new Date(fixed);
  if (!isNaN(d)) return d;
  return null;
}

/** Extrait les items d'un document RSS/Atom parsé (supporte RSS 2.0 et Atom). */
function extractItemsFromDoc(doc) {
  const items = [];
  // RSS 2.0 : <item> + <pubDate>
  doc.querySelectorAll('item').forEach(item => {
    const rawDate = item.querySelector('pubDate')?.textContent?.trim()
                 || item.querySelector('date')?.textContent?.trim();
    const d = parseRSSDate(rawDate);
    if (!d) return;
    items.push({
      title: item.querySelector('title')?.textContent?.trim() || 'Sans titre',
      link:  item.querySelector('link')?.textContent?.trim()  || '',
      date:  d,
      ts:    d.getTime(),
    });
  });
  // Atom : <entry> + <updated> ou <published>
  doc.querySelectorAll('entry').forEach(entry => {
    const rawDate = (entry.querySelector('updated') || entry.querySelector('published'))?.textContent?.trim();
    const d = parseRSSDate(rawDate);
    if (!d) return;
    items.push({
      title: entry.querySelector('title')?.textContent?.trim() || 'Sans titre',
      link:  entry.querySelector('link')?.getAttribute('href') || entry.querySelector('link')?.textContent?.trim() || '',
      date:  d,
      ts:    d.getTime(),
    });
  });
  return items.sort((a, b) => b.ts - a.ts); // plus récent en premier
}

/** Parse le XML RSS/Atom avec fallback text/html si XML mal formé. */
function parseArticleItems(xml) {
  try {
    const parser = new DOMParser();
    let doc = parser.parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) {
      // XML mal formé → tentative en mode HTML (certains flux ont des caractères non échappés)
      doc = parser.parseFromString(xml, 'text/html');
    }
    return extractItemsFromDoc(doc);
  } catch { return []; }
}

/**
 * Fetch RSS XML via CORS proxies.
 * Stratégie paires (identique à podcasts_v2_3.html) :
 *   Round 1 : corsproxy.io  + allorigins raw   (simultané)
 *   Round 2 : allorigins JSON + cors.sh        (simultané)
 *   Round 3 : fetch direct
 */
async function fetchArticleXML(url) {
  if (_feedCache[url] !== undefined) return _feedCache[url];

  const t   = Math.floor(Date.now() / 60000);
  const sep = url.includes('?') ? '&' : '?';
  const enc = encodeURIComponent(`${url}${sep}_t=${t}`);

  const proxies = [
    async () => { // 0 — corsproxy.io
      const r = await fetch(`https://corsproxy.io/?url=${enc}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const t = await r.text(); if (!isValidXML(t)) throw new Error('invalid'); return t;
    },
    async () => { // 1 — allorigins raw
      const r = await fetch(`https://api.allorigins.win/raw?url=${enc}`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(r.status);
      const t = await r.text(); if (!isValidXML(t)) throw new Error('invalid'); return t;
    },
    async () => { // 2 — allorigins JSON wrapper
      const r = await fetch(`https://api.allorigins.win/get?url=${enc}`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(); if (!j?.contents || !isValidXML(j.contents)) throw new Error('invalid'); return j.contents;
    },
    async () => { // 3 — cors.sh
      const r = await fetch(`https://proxy.cors.sh/${url}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'x-cors-api-key': 'temp_' + Math.random().toString(36).slice(2) },
      });
      if (!r.ok) throw new Error(r.status);
      const t = await r.text(); if (!isValidXML(t)) throw new Error('invalid'); return t;
    },
    async () => { // 4 — accès direct
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(r.status);
      const t = await r.text(); if (!isValidXML(t)) throw new Error('invalid'); return t;
    },
  ];

  const pairs = [[0, 1], [2, 3], [4]]; // 2 proxies en simultané par round
  let text = null;
  for (const pair of pairs) {
    if (text) break;
    const settled = await Promise.allSettled(pair.map(i => proxies[i]()));
    for (const r of settled) { if (r.status === 'fulfilled' && r.value) { text = r.value; break; } }
  }

  _feedCache[url] = text; // met en cache (même si null = échec)
  return text;
}

/** Load all 25 article feeds client-side. Returns { todayCount, d1Count, d2Count, feeds }. */
async function loadArticlesClientSide() {
  if (_artCache.data && Date.now() < _artCache.expiresAt) return _artCache.data;
  if (_artFetchPromise) return _artFetchPromise;

  _artFetchPromise = (async () => {
    const now = new Date();
    const t0  = new Date(); t0.setHours(0, 0, 0, 0);
    const t1  = new Date(t0); t1.setDate(t1.getDate() - 1);
    const t2  = new Date(t1); t2.setDate(t2.getDate() - 1);

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

    const t0ms = t0.getTime(), t1ms = t1.getTime(), t2ms = t2.getTime(), nowMs = now.getTime();
    let todayCount = 0, d1Count = 0, d2Count = 0;
    const feeds = feedResults.map(({ feed, items }) => {
      const todayItems = items.filter(i => i.ts >= t0ms && i.ts <= nowMs);
      const d1Items    = items.filter(i => i.ts >= t1ms && i.ts < t0ms);
      const d2Items    = items.filter(i => i.ts >= t2ms && i.ts < t1ms);
      todayCount += todayItems.length;
      d1Count    += d1Items.length;
      d2Count    += d2Items.length;
      const last = todayItems[0] || null; // trié du plus récent au plus ancien
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

// ===== ARTICLE SNAPSHOTS (localStorage) =====
// Sauvegarde le comptage du jour dans localStorage pour figer J-1 le lendemain.
// La clé est la date Paris (YYYY-MM-DD), donc le snapshot du 11/03 reste accessible le 12/03 comme J-1.

function getParisDateStr(daysAgo = 0) {
  const d = new Date();
  if (daysAgo) d.setDate(d.getDate() - daysAgo);
  const parts = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }).split('/');
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function saveArticleSnapshot(feeds, total) {
  try {
    const dateStr = getParisDateStr(0);
    localStorage.setItem(`art_snap_${dateStr}`, JSON.stringify({
      count: total,
      feeds: feeds.map(f => ({ id: f.id, name: f.name, today: f.today, lastTitle: f.lastTitle, lastDate: f.lastDate })),
      savedAt: new Date().toISOString(),
    }));
    // Nettoyage : on garde 7 jours
    for (let d = 7; d <= 30; d++) localStorage.removeItem(`art_snap_${getParisDateStr(d)}`);
  } catch { /* localStorage plein */ }
}

function getArticleSnapshot(daysAgo) {
  try {
    const raw = localStorage.getItem(`art_snap_${getParisDateStr(daysAgo)}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ===== ARTICLES VIEW =====

/** Affiche l'état initial de l'onglet Articles (données en cache ou snapshot J-1). */
function initArticlesView() {
  // Si on a déjà compté dans cette session, afficher les résultats
  if (_artCache.data) {
    const d = _artCache.data;
    document.getElementById('stat-art-today').textContent = d.todayCount;
    document.getElementById('stat-art-d1').textContent    = d.d1Count;
    document.getElementById('stat-art-d2').textContent    = d.d2Count;
    renderArticleMonitoring(d.feeds);
    const hm = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('art-header-updated').textContent = `Compté à ${hm}`;
    const btn = document.getElementById('btn-count-articles');
    if (btn) btn.textContent = 'Recompter';
    return;
  }
  // Sinon afficher le snapshot J-1 dans la stat (sans comptage réseau)
  const snapYest = getArticleSnapshot(1);
  if (snapYest) {
    document.getElementById('stat-art-d1').textContent = snapYest.count;
  }
  document.getElementById('art-header-updated').textContent = 'Appuie sur Compter';
}

let _artCounting = false;

/** Comptage progressif rubrique par rubrique avec mise à jour en temps réel. */
window.countArticles = async function() {
  if (_artCounting) return;
  _artCounting = true;

  const btn       = document.getElementById('btn-count-articles');
  const btnHeader = document.getElementById('btn-refresh-art');
  if (btn)       { btn.disabled = true; btn.textContent = '⏳ En cours…'; }
  if (btnHeader) { btnHeader.style.opacity = '0.4'; btnHeader.disabled = true; }
  document.getElementById('art-header-updated').textContent = 'Comptage en cours…';

  // Vide le cache session pour forcer un re-fetch complet (même méthode que podcasts_v2_3.html)
  Object.keys(_feedCache).forEach(k => delete _feedCache[k]);
  _artCache = { data: null, expiresAt: 0 };

  const now  = new Date();
  const t0   = new Date(now.getFullYear(), now.getMonth(), now.getDate());          // minuit ce matin
  const t1   = new Date(t0); t1.setDate(t1.getDate() - 1);                         // minuit hier
  const t2   = new Date(t1); t2.setDate(t2.getDate() - 1);                         // minuit avant-hier
  const t0ms = t0.getTime(), t1ms = t1.getTime(), t2ms = t2.getTime(), nowMs = now.getTime();

  // Snapshot d'hier pour les données J-1 par rubrique (figées depuis le comptage précédent)
  const snapYest = getArticleSnapshot(1);
  const snapMap  = {};
  if (snapYest?.feeds) snapYest.feeds.forEach(f => { snapMap[f.id] = f; });

  let todayTotal = 0, d1Total = 0, d2Total = 0;
  const allFeeds = [];

  // Initialise la liste avec toutes les rubriques en état "en attente"
  const list = document.getElementById('art-monitoring-list');
  if (list) {
    list.innerHTML = ARTICLE_FEEDS_CLIENT.map(f => `
      <div class="monitor-row monitor-inactive" id="art-row-${f.id}">
        <div class="monitor-dot dot-gray"></div>
        <div class="monitor-info"><span class="monitor-name">${escapeHtml(f.name)}</span></div>
        <div class="art-count-j badge-none">…</div>
        <div class="art-count-d1 badge-d1-none">${snapMap[f.id] !== undefined ? (snapMap[f.id].today || '—') : '…'}</div>
      </div>`).join('');
  }

  document.getElementById('stat-art-today').textContent = '0';
  document.getElementById('stat-art-d1').textContent    = snapYest ? snapYest.count : '—';
  document.getElementById('stat-art-d2').textContent    = '—';

  // Traitement en batches de 8 en parallèle (même stratégie que podcasts_v2_3.html)
  const BATCH = 8;
  for (let i = 0; i < ARTICLE_FEEDS_CLIENT.length; i += BATCH) {
    const batch = ARTICLE_FEEDS_CLIENT.slice(i, i + BATCH);
    await Promise.all(batch.map(async (feed) => {
      let today = 0, d1 = 0, d2 = 0, last = null;
      try {
        const xml = await fetchArticleXML(feed.url);
        if (xml) {
          const items      = parseArticleItems(xml);
          const todayItems = items.filter(i => i.ts >= t0ms && i.ts <= nowMs);
          const d1Live     = items.filter(i => i.ts >= t1ms && i.ts <  t0ms);
          const d2Items    = items.filter(i => i.ts >= t2ms && i.ts <  t1ms);
          today = todayItems.length;
          // J-1 : snapshot figé si disponible, sinon flux live
          d1    = snapMap[feed.id] !== undefined ? (snapMap[feed.id].today ?? d1Live.length) : d1Live.length;
          d2    = d2Items.length;
          last  = todayItems[0] || null;
        }
      } catch { /* erreur réseau — on laisse à 0 */ }

      todayTotal += today;
      d1Total    += d1;
      d2Total    += d2;
      allFeeds.push({ id: feed.id, name: feed.name, category: feed.category, today, d1,
        lastDate:  last ? last.date.toISOString() : null,
        lastTitle: last ? last.title : null,
        feedUrl:   feed.url,
      });

      // Mise à jour immédiate de la ligne (sans attendre la fin du batch)
      const row = document.getElementById(`art-row-${feed.id}`);
      if (row) {
        const active   = today > 0;
        const d1Active = d1 > 0;
        const timeStr  = last
          ? last.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
          : null;
        row.className = `monitor-row ${active ? 'monitor-active' : 'monitor-inactive'}`;
        row.innerHTML = `
          <div class="monitor-dot ${active ? 'dot-green' : 'dot-gray'}"></div>
          <div class="monitor-info">
            <a class="monitor-name monitor-link" href="${escapeHtml(feed.url)}" target="_blank" rel="noopener">${escapeHtml(feed.name)}</a>
            ${timeStr ? `<span class="monitor-time">${timeStr}</span>` : ''}
            ${last ? `<span class="monitor-episode">${escapeHtml(last.title)}</span>` : ''}
          </div>
          <div class="art-count-j ${active   ? 'badge-active'    : 'badge-none'}">${active   ? today : '—'}</div>
          <div class="art-count-d1 ${d1Active ? 'badge-d1-active' : 'badge-d1-none'}">${d1Active ? d1 : '—'}</div>`;
      }
    }));
    // Mise à jour des totaux après chaque batch
    document.getElementById('stat-art-today').textContent = todayTotal;
    document.getElementById('stat-art-d1').textContent    = d1Total;
  }

  // Sauvegarde le snapshot du jour (les articles d'aujourd'hui seront J-1 demain)
  saveArticleSnapshot(allFeeds, todayTotal);

  // Met en cache le résultat complet
  _artCache = {
    data: { todayCount: todayTotal, d1Count: d1Total, d2Count: d2Total, feeds: allFeeds },
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  document.getElementById('stat-art-d2').textContent = d2Total;
  const activeCount = allFeeds.filter(f => f.today > 0).length;
  const counter = document.getElementById('art-monitoring-active');
  if (counter) counter.textContent = `${activeCount} / ${allFeeds.length} actifs`;

  const hm = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('art-header-updated').textContent = `Compté à ${hm}`;

  if (btn)       { btn.disabled = false; btn.textContent = 'Recompter'; }
  if (btnHeader) { btnHeader.style.opacity = ''; btnHeader.disabled = false; }
  _artCounting = false;
};

function renderArticleMonitoring(feeds) {
  const list    = document.getElementById('art-monitoring-list');
  const counter = document.getElementById('art-monitoring-active');
  if (!list) return;

  const activeCount = feeds.filter(f => f.today > 0).length;
  if (counter) counter.textContent = `${activeCount} / ${feeds.length} actifs`;

  list.innerHTML = feeds.map(f => {
    const active   = f.today > 0;
    const d1Active = (f.d1 ?? 0) > 0;
    const timeStr  = f.lastDate
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
        <div class="art-count-j ${active   ? 'badge-active'    : 'badge-none'}">${active   ? f.today : '—'}</div>
        <div class="art-count-d1 ${d1Active ? 'badge-d1-active' : 'badge-d1-none'}">${d1Active ? f.d1 : '—'}</div>
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
