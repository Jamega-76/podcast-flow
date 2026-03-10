'use strict';

const Parser = require('rss-parser');
const { execFile, execSync } = require('child_process');
const { existsSync } = require('fs');

// Parser pour les flux de podcasts (audiomeans.fr, etc.)
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  },
  customFields: {
    feed: ['image', 'itunes:image'],
    item: [
      ['itunes:image', 'itunesImage'],
      ['itunes:duration', 'duration'],
      ['itunes:summary', 'summary'],
    ],
  },
});

/**
 * Fetch XML via curl subprocess (bypass TLS fingerprint de Node.js).
 * Retourne null en cas d'échec.
 */
function fetchXmlWithCurl(url) {
  return new Promise((resolve) => {
    execFile('curl', [
      '-s',
      '--max-time', '10',
      '-L',
      '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H', 'Accept: application/rss+xml, application/xml, text/xml, */*',
      '-H', 'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8',
      '-H', 'Referer: https://www.europe1.fr/',
      url,
    ], { maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout || !stdout.includes('<item>')) return resolve(null);
      resolve(stdout);
    });
  });
}

// ─── Singleton Chromium (Puppeteer-core) pour bypass du JS challenge Cloudflare ─

let _browser = null;

/**
 * Trouve le chemin de Chromium installé par nixpacks ou via une variable d'env.
 */
function findChromiumPath() {
  // 1. Variables d'environnement explicites
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  // 2. Cherche dans le PATH
  for (const cmd of ['chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome']) {
    try {
      const p = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim();
      if (p) return p;
    } catch { /* noop */ }
  }

  // 3. Chemins courants sur Linux/NixOS
  for (const p of [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/run/current-system/sw/bin/chromium',
  ]) {
    if (existsSync(p)) return p;
  }

  return null;
}

/**
 * Retourne (ou démarre) l'instance Puppeteer partagée.
 * Lance un seul navigateur, réutilisé pour tous les fetches.
 */
async function getBrowser() {
  if (_browser) {
    try {
      await _browser.pages(); // Throws si le navigateur a planté
      return _browser;
    } catch {
      _browser = null;
    }
  }

  const executablePath = findChromiumPath();
  if (!executablePath) {
    throw new Error('Chromium introuvable. Définissez CHROMIUM_PATH ou ajoutez chromium dans nixpacks.toml.');
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    throw new Error('puppeteer-core non installé (npm install puppeteer-core).');
  }

  console.log('[rss] Lancement Chromium:', executablePath);
  _browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',   // Évite les crashes sur /dev/shm limité (Railway)
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--mute-audio',
      '--no-default-browser-check',
    ],
  });

  // Auto-reset si le navigateur se déconnecte (crash)
  _browser.on('disconnected', () => {
    console.warn('[rss] Chromium déconnecté, réinitialisation.');
    _browser = null;
  });

  return _browser;
}

/**
 * Fetch XML via un vrai Chromium headless pour bypass du JS challenge Cloudflare.
 * Retourne le XML brut, ou null en cas d'échec.
 */
async function fetchXmlWithBrowser(url) {
  try {
    const b = await getBrowser();
    const page = await b.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    // Navigation directe — Chrome exécute automatiquement le JS challenge Cloudflare
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

    // Extraction du XML.
    // Après résolution du challenge CF, document.documentElement est la racine RSS/Atom.
    const xml = await page.evaluate(() => {
      try {
        const rootTag = document.documentElement.tagName.toLowerCase();
        if (rootTag === 'rss' || rootTag === 'feed') {
          // Document XML propre — on le sérialise
          return new XMLSerializer().serializeToString(document);
        }
        // Toujours sur une page HTML (challenge en cours ou erreur) — retourner le texte brut
        return document.body ? document.body.innerText : '';
      } catch {
        return document.documentElement.outerHTML || '';
      }
    });

    await page.close();

    if (xml && xml.includes('<item>')) return xml;
    return null;
  } catch (e) {
    console.error('[rss] browser fetch échoué pour', url, '—', e.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch et parse un flux RSS.
 * Pour les flux europe1.fr/rss/ : essaie Chromium en premier (bypass Cloudflare),
 * puis curl comme fallback, puis fetch direct en dernier recours.
 */
async function fetchFeed(url) {
  let feed;

  if (url.includes('europe1.fr/rss/')) {
    // 1. Navigateur réel (passe le JS challenge Cloudflare)
    let xml = await fetchXmlWithBrowser(url);
    // 2. Fallback curl (TLS bypass, peut suffire selon la config CF)
    if (!xml) xml = await fetchXmlWithCurl(url);
    // 3. Fetch direct
    if (xml) {
      feed = await parser.parseString(xml);
    } else {
      feed = await parser.parseURL(url);
    }
  } else {
    feed = await parser.parseURL(url);
  }

  return {
    title: feed.title || 'Podcast sans nom',
    description: feed.description || '',
    link: feed.link || '',
    image: feed.image?.url || feed['itunes:image']?.$ ?.href || null,
    items: (feed.items || []).map(item => ({
      title: item.title || 'Sans titre',
      link: item.link || item.guid || '',
      pubDate: item.pubDate || item.isoDate || null,
      isoDate: item.isoDate || null,
      description: item.contentSnippet || item.content || '',
      itunes: {
        image: item.itunesImage?.$ ?.href || (typeof item.itunesImage === 'string' ? item.itunesImage : null),
        duration: item.duration || null,
        summary: item.summary || null,
      },
    })),
  };
}

/**
 * Map a feed + rss-parser result → array of episode objects
 */
function mapEpisodes(feed, data) {
  return (data.items || []).map((item, idx) => ({
    id: `${feed.id}-${idx}`,
    feedId: feed.id,
    feedUrl: feed.url,
    feedName: feed.name,
    category: feed.category || '',
    type: feed.type || 'podcast',       // 'podcast' | 'article'
    title: item.title || 'Sans titre',
    date: item.isoDate || item.pubDate || null,
    link: item.link || '',
    image: item.itunes?.image || data.image || null,
  }));
}

/**
 * Fetch multiple feeds in sequential batches (avoids overwhelming external servers).
 * batchSize controls how many feeds are fetched in parallel per batch.
 */
async function fetchAllFeedsInBatches(feeds, batchSize = 15) {
  const allEpisodes = [];

  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (feed) => {
        const data = await fetchFeed(feed.url);
        return mapEpisodes(feed, data);
      })
    );
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) allEpisodes.push(...r.value);
    });
  }

  return allEpisodes.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Fetch multiple feeds all at once (used by scheduler for alerting)
 */
async function fetchAllFeeds(feeds) {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const data = await fetchFeed(feed.url);
      return mapEpisodes(feed, data);
    })
  );

  const allEpisodes = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) allEpisodes.push(...r.value);
  });

  return allEpisodes.sort((a, b) => new Date(b.date) - new Date(a.date));
}

module.exports = { fetchFeed, fetchAllFeeds, fetchAllFeedsInBatches };
