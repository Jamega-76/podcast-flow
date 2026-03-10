'use strict';

const Parser = require('rss-parser');
const { execFile } = require('child_process');

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
 * Fetch XML via curl subprocess (bypasses Node.js TLS fingerprint detection by Cloudflare).
 * Falls back to null on failure.
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
 * Fetch and parse an RSS feed.
 * For europe1.fr RSS feeds, tries curl first to bypass Cloudflare.
 */
async function fetchFeed(url) {
  let feed;

  if (url.includes('europe1.fr/rss/')) {
    const xml = await fetchXmlWithCurl(url);
    if (xml) {
      feed = await parser.parseString(xml);
    } else {
      // Fallback to direct fetch (may fail on Cloudflare-protected servers)
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
