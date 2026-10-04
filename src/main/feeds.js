const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NexusHUD/0.1' },
  customFields: { item: [['media:thumbnail', 'mediaThumb'], ['media:content', 'mediaContent']] },
});

const TECH_FEEDS = [
  { name: 'HN', url: 'https://hnrss.org/frontpage?points=150' },
  { name: 'VERGE', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TC', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'ARS', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'MIT', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
];

const ANIME_FEEDS = [
  { name: 'ANN', url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w' },
  { name: 'CR', url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss' },
  { name: 'MAL', url: 'https://myanimelist.net/rss/news.xml' },
];

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function thumbOf(item) {
  const m = item.mediaThumb || item.mediaContent;
  if (m && m.$ && m.$.url) return m.$.url;
  if (item.enclosure && item.enclosure.url && /image/.test(item.enclosure.type || 'image')) return item.enclosure.url;
  const img = /<img[^>]+src="([^"]+)"/.exec(item.content || '');
  return img ? img[1] : null;
}

async function readFeeds(list, limit) {
  const results = await Promise.allSettled(list.map(async (f) => {
    const feed = await parser.parseURL(f.url);
    return feed.items.slice(0, 15).map((it) => ({
      source: f.name,
      title: (it.title || '').trim(),
      link: it.link,
      date: it.isoDate || it.pubDate || null,
      thumb: thumbOf(it),
    }));
  }));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const failed = list.filter((_, i) => results[i].status === 'rejected').map((f) => f.name);
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return { items: items.slice(0, limit), failed };
}

const techNews = () => cached('tech', () => readFeeds(TECH_FEEDS, 40));
const animeNews = () => cached('anime', () => readFeeds(ANIME_FEEDS, 40));

// Episodes airing from 12h ago to 24h ahead, from AniList (no key needed).
const AIRING_QUERY = `
query ($from: Int, $to: Int) {
  Page(perPage: 50) {
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      airingAt
      episode
      media {
        id
        isAdult
        popularity
        siteUrl
        title { english romaji }
        coverImage { medium color }
        externalLinks { site url }
      }
    }
  }
}`;

function airingToday() {
  return cached('airing', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: AIRING_QUERY, variables: { from: now - 12 * 3600, to: now + 24 * 3600 } }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const json = await res.json();
    return json.data.Page.airingSchedules
      .filter((s) => s.media && !s.media.isAdult && s.media.popularity > 2000)
      .map((s) => {
        const cr = (s.media.externalLinks || []).find((l) => /crunchyroll/i.test(l.site));
        return {
          at: s.airingAt * 1000,
          episode: s.episode,
          title: s.media.title.english || s.media.title.romaji,
          cover: s.media.coverImage.medium,
          color: s.media.coverImage.color,
          url: s.media.siteUrl,
          crunchyroll: cr ? cr.url : null,
        };
      });
  });
}

module.exports = { techNews, animeNews, airingToday };
