// Small DOM + formatting helpers shared by the panels.
export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') {
      // Object.assign can't set custom properties (--x), so route those through setProperty.
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function timeAgo(date) {
  if (!date) return '';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function fmtBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i > 2 ? 1 : 0)}${u[i]}`;
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// App-wide event bus (e.g. a finished todo makes the pet happy).
export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const listen = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));

// Load a persisted value, falling back to a default.
export async function load(key, fallback) {
  const v = await window.nexus.store.get(key);
  return v === undefined || v === null ? fallback : v;
}
export const save = (key, value) => window.nexus.store.set(key, value);

export function sanitizeMarkdown(md) {
  const html = window.marked.parse(md, { gfm: true, breaks: false });
  return window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}

// Read a CSS custom property from :root (skins define the palette there).
export function cssVar(name, fallback = '') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
