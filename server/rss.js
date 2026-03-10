'use strict';

const Parser = require('rss-parser');
const { execFile } = require('child_process');
const nodeFetch = require('node-fetch');

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
 * Fetch XML via curl subprocess (bypass TLS fingerprint Node.js).
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

/**
 * Fetch XML via services CORS proxy pour les flux europe1.fr bloqués par Cloudflare.
 * Les proxies (corsproxy.io, allorigins.win) peuvent accéder à europe1.fr depuis leurs serveurs.
 *
 * Stratégie identique à podcasts_v2_3.html qui fonctionne en production :
 *  - Cache-buster injecté dans l'URL cible pour forcer le refetch côté proxy
 *  - Essai séquentiel : corsproxy.io → allorigins raw → allorigins JSON wrapper
 */
async function fetchXmlViaProxy(url) {
  // Buster par minute — force les proxies à refetcher l'URL source (bypass leur cache interne)
  const t = Math.floor(Date.now() / 60000);
  const sep = url.includes('?') ? '&' : '?';
  const busted = `${url}${sep}_t=${t}`;
  const enc = encodeURIComponent(busted);

  const proxies = [
    // 1 — corsproxy.io (prioritaire, pas de cache serveur)
    async () => {
      const r = await nodeFetch(`https://corsproxy.io/?url=${enc}`, {
        timeout: 10000,
        headers: { 'cache-control': 'no-store' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      if (!text.includes('<item>')) throw new Error('no <item>');
      return text;
    },
    // 2 — allorigins raw
    async () => {
      const r = await nodeFetch(`https://api.allorigins.win/raw?url=${enc}`, { timeout: 10000 });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      if (!text.includes('<item>')) throw new Error('no <item>');
      return text;
    },
    // 3 — allorigins JSON wrapper
    async () => {
      const r = await nodeFetch(`https://api.allorigins.win/get?url=${enc}`, { timeout: 10000 });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!j?.contents) throw new Error('contents vide');
      if (!j.contents.includes('<item>')) throw new Error('no <item>');
      return j.contents;
    },
  ];

  for (const attempt of proxies) {
    try {
      const xml = await attempt();
      console.log('[rss] proxy OK pour', url);
      return xml;
    } catch (e) {
      console.warn('[rss] proxy failed:', e.message);
    }
  }

  console.error('[rss] tous les proxies ont échoué pour', url);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch et parse un flux RSS.
 * Pour les flux europe1.fr/rss/ : passe par des CORS proxies (Cloudflare bypass).
 * Pour tous les autres (audiomeans.fr, etc.) : fetch direct.
 */
async function fetchFeed(url) {
  let feed;

  if (url.includes('europe1.fr/rss/')) {
    // Essai via proxies (prouvé fonctionnel dans podcasts_v2_3.html)
    const xml = await fetchXmlViaProxy(url);
    if (xml) {
      feed = await parser.parseString(xml);
    } else {
      // Dernier recours : curl puis fetch direct (échoueront probablement à cause de Cloudflare)
      const xmlCurl = await fetchXmlWithCurl(url);
      if (xmlCurl) feed = await parser.parseString(xmlCurl);
      else feed = await parser.parseURL(url);
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
