'use strict';

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'PodcastFlow/1.0 (RSS Reader)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
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
 * Fetch and parse an RSS feed
 */
async function fetchFeed(url) {
  const feed = await parser.parseURL(url);

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
        image: item.itunesImage?.$ ?.href || item.itunesImage || null,
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
