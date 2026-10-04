// Image feed sources for the "images" widget:
//  - Pinterest boards via their public RSS (https://www.pinterest.com/<user>/<board>.rss)
//  - Wallhaven search API, SFW-only (purity=100)
const Parser = require('rss-parser');

const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CustomHUDs/2.0' } });
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map();

// Accepts a board URL, "user/board", or a full .rss URL.
function pinterestRss(src) {
  let s = src.trim().replace(/^https?:\/\/(www\.)?pinterest\.[a-z.]+\//i, '').replace(/\/+$/, '');
  if (s.endsWith('.rss')) s = s.slice(0, -4);
  return `https://www.pinterest.com/${s}.rss`;
}

async function pinterest(src) {
  const feed = await parser.parseURL(pinterestRss(src));
  return feed.items.map((it) => {
    const m = /<img[^>]+src="([^"]+)"/.exec(it.content || it['content:encoded'] || '');
    if (!m) return null;
    // RSS ships 236px thumbnails; the 564px rendition lives at the same path.
    const src564 = m[1].replace(/\/(236x|474x)\//, '/564x/');
    return { src: src564, link: it.link, title: (it.title || '').trim(), source: 'pinterest' };
  }).filter(Boolean);
}

async function wallhaven(query) {
  const url = `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(query)}&categories=010&purity=100&sorting=relevance&page=${1 + Math.floor(Math.random() * 3)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'CustomHUDs/2.0' } });
  if (!res.ok) throw new Error(`wallhaven ${res.status}`);
  const json = await res.json();
  return json.data.map((w) => ({ src: w.thumbs.large, link: w.url, title: query, ratio: w.dimension_y / w.dimension_x, source: 'wallhaven' }));
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// sources: [{ type: 'pinterest' | 'wallhaven', value: string }]
async function fetchImages(sources) {
  const results = await Promise.allSettled(sources.map(async (s) => {
    const key = `${s.type}:${s.value}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
    const items = s.type === 'pinterest' ? await pinterest(s.value) : await wallhaven(s.value);
    cache.set(key, { at: Date.now(), items });
    return items;
  }));
  const failed = sources.filter((_, i) => results[i].status === 'rejected').map((s) => s.value);
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return { items: shuffle(items).slice(0, 80), failed };
}

module.exports = { fetchImages };
