// Keyless web search for the local research pipeline.
// Search engines serve captchas to plain HTTP clients, so results are read from a hidden
// Chromium window (DuckDuckGo, then Bing), topped up with Wikipedia's official API.
const { BrowserWindow } = require('electron');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const STOPWORDS = new Set('a an and are as at be by for from how in is it of on or that the this to was what when where which who why will with vs'.split(' '));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z#0-9]+);/gi, (m, k) => (k in ENTITIES ? ENTITIES[k] : m));
}

// ---------- hidden browser ----------
let searchWin = null;
let queue = Promise.resolve();

function browser() {
  if (!searchWin || searchWin.isDestroyed()) {
    searchWin = new BrowserWindow({
      show: false,
      webPreferences: { partition: 'persist:nexus-search', sandbox: true, contextIsolation: true },
    });
    searchWin.webContents.setUserAgent(searchWin.webContents.getUserAgent().replace(/ Electron\/\S+| nexus-hud\/\S+/g, ''));
    searchWin.webContents.setAudioMuted(true);
    searchWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }
  return searchWin;
}

const EXTRACT = `(() => {
  const txt = (el) => (el && el.innerText || '').replace(/\\s+/g, ' ').trim();
  const ddg = [...document.querySelectorAll('article[data-testid="result"]')].map((a) => {
    const link = a.querySelector('a[data-testid="result-title-a"]');
    return { url: link && link.href, title: txt(link), snippet: txt(a.querySelector('[data-result="snippet"]')) };
  });
  const bing = [...document.querySelectorAll('li.b_algo')].map((li) => {
    const link = li.querySelector('h2 a');
    return { url: link && link.href, title: txt(li.querySelector('h2')), snippet: txt(li.querySelector('.b_caption p, p')) };
  });
  return { ddg, bing, blocked: /captcha|unusual traffic|are you a robot/i.test(document.body ? document.body.innerText.slice(0, 3000) : '') };
})()`;

// Bing wraps result links as bing.com/ck/a?...&u=a1<base64url(target)>
function bingTarget(href) {
  const m = /[?&]u=a1([^&]+)/.exec(href || '');
  if (!m) return href;
  try {
    return Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return href;
  }
}

async function scrape(url, key, signal) {
  const win = browser();
  await win.loadURL(url).catch(() => {}); // SPA navigations can reject even when the page renders
  for (let i = 0; i < 24; i++) {
    if (signal && signal.aborted) throw new Error('aborted');
    const r = await win.webContents.executeJavaScript(EXTRACT).catch(() => null);
    if (r && (r[key].length || r.blocked)) return r[key];
    await new Promise((s) => setTimeout(s, 400));
  }
  return [];
}

// One search at a time through the shared window.
function browserSearch(query, signal) {
  const task = queue.then(async () => {
    let results = await scrape(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web&kl=us-en`, 'ddg', signal);
    if (!results.length) {
      results = (await scrape(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`, 'bing', signal))
        .map((r) => ({ ...r, url: bingTarget(r.url) }));
    }
    return results.filter((r) => /^https?:\/\//.test(r.url || '') && !/duckduckgo\.com|bing\.com/.test(r.url));
  });
  queue = task.catch(() => {});
  return task;
}

async function wikipedia(query, signal) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=2&srsearch=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'NexusHUD/0.1 (personal desktop app)' }, signal });
    const json = await res.json();
    return json.query.search.map((s) => ({
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
      title: `${s.title} - Wikipedia`,
      snippet: decode(s.snippet.replace(/<[^>]+>/g, '')),
    }));
  } catch {
    return [];
  }
}

// Drop results that share no meaningful words with the query (engines sometimes return junk).
function relevant(query, results) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (!terms.length) return results;
  return results.filter((r) => {
    const hay = `${r.title} ${r.snippet} ${r.url}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}

async function search(query, { limit = 6, signal } = {}) {
  const [web, wiki] = await Promise.all([browserSearch(query, signal).catch(() => []), wikipedia(query, signal)]);
  const merged = relevant(query, web).slice(0, limit);
  for (const w of relevant(query, wiki)) if (merged.length < limit + 1 && !merged.some((m) => m.url === w.url)) merged.push(w);
  return merged;
}

// ---------- page reading ----------
async function pageText(url, { maxChars = 2800, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok || !/html|text/.test(res.headers.get('content-type') || '')) return '';
    let html = await res.text();
    const article = /<(article|main)[\s>][\s\S]*?<\/\1>/i.exec(html);
    if (article && article[0].length > 1500) html = article[0];
    const text = decode(html
      .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '))
      .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 40)
      .join('\n');
    return text.slice(0, maxChars);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

module.exports = { search, pageText };
