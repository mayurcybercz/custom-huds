import { h, uid, load, save, sanitizeMarkdown } from '../core/util.js';

const TILE_COLORS = ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--accent2)', 'var(--accent3)'];
const SUGGESTIONS = ['state of open-weight LLMs this month', 'solid-state batteries 2026', 'best anime of this season', 'how does RLHF work', 'Windows 11 widget dev options'];
const HISTORY_MAX = 20;

// Split streamed markdown into a title plus "## " sections, each shown as its own tile.
function parse(md) {
  let title = '';
  const body = md.replace(/^\s*#\s+(.+)\n?/, (_m, t) => { title = t.trim(); return ''; });
  const sections = [];
  const re = /^##\s+(.+)$/gm;
  let m, last = null, intro = '';
  while ((m = re.exec(body))) {
    if (last) last.body = body.slice(last.start, m.index);
    else intro = body.slice(0, m.index);
    last = { heading: m[1].trim(), start: re.lastIndex };
    sections.push(last);
  }
  if (last) last.body = body.slice(last.start);
  else intro = body;
  return { title, intro: intro.trim(), sections };
}

export async function mount({ body: root, meta: metaSlot, slot }) {
  const meta = metaSlot || document.createElement('span');
  const historySel = slot('history') || document.createElement('select');
  let history = await load('research', []);
  let current = null; // { id, topic, md, sources, status, at }

  const input = h('input', { class: 'input', placeholder: 'enter a topic to research…', spellcheck: 'false' });
  const runBtn = h('button', { class: 'btn' }, 'ENGAGE');
  const status = h('div', { class: 'r-status' });
  const out = h('div', { class: 'r-out' });
  root.append(h('div', { class: 'r-input' }, h('span', { class: 'prompt' }, '>'), input, runBtn), status, out);

  function splash() {
    out.replaceChildren(h('div', { class: 'r-splash' },
      h('div', { class: 'ring' }),
      h('div', {}, 'RESEARCH CORE IDLE — awaiting directive', h('span', { class: 'blink' }, '_')),
      h('div', { class: 'chips' }, ...SUGGESTIONS.map((s) => h('button', { onclick: () => { input.value = s; start(); } }, s)))));
  }

  function renderHistory() {
    historySel.replaceChildren(h('option', { value: '' }, `history (${history.length})`),
      ...history.map((r) => h('option', { value: r.id }, r.topic.slice(0, 40))));
  }

  // Rendering is incremental: tiles are created once and only the tile currently
  // being written is re-rendered, so finished tiles never flash or move.
  const RENDER_EVERY_MS = 120;
  let renderTimer = 0;
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(() => { renderTimer = 0; render(); }, RENDER_EVERY_MS);
  }

  let view = null; // { id, titleEl, grid, waiting, tiles: [{ el, mdEl, src }] }

  function buildView() {
    const titleEl = h('div', { class: 'r-title' });
    const grid = h('div', { class: 'r-tiles' });
    const waiting = h('div', { class: 'empty' }, h('span', { class: 'spinner' }), '  gathering intel…');
    out.replaceChildren(titleEl, grid, waiting);
    out.scrollTop = 0;
    view = { id: current.id, titleEl, grid, waiting, tiles: [] };
  }

  // While streaming, hold back the unfinished last line (and a table until its
  // header separator arrives) so half-written markdown doesn't flip formats.
  function stableBody(body, live) {
    if (!live) return body;
    let text = body.slice(0, body.lastIndexOf('\n') + 1);
    const lines = text.split('\n');
    let tableLines = 0;
    for (let i = lines.length - 2; i >= 0 && lines[i].trim().startsWith('|'); i--) tableLines++;
    if (tableLines > 0 && tableLines < 2) text = lines.slice(0, lines.length - 1 - tableLines).join('\n') + '\n';
    return text;
  }

  function render() {
    if (!current) { view = null; return splash(); }
    if (!view || view.id !== current.id) buildView();
    const running = current.status === 'running';
    // Only parse complete lines while streaming so titles/headings never appear half-typed.
    const md = running ? current.md.slice(0, current.md.lastIndexOf('\n') + 1) : current.md;
    const { title, intro, sections } = parse(md);
    const blocks = [
      ...(intro ? [{ heading: null, body: intro }] : []),
      ...sections,
    ];

    const atBottom = out.scrollTop + out.clientHeight >= out.scrollHeight - 40;
    const titleText = title || current.topic.toUpperCase();
    if (view.titleEl.textContent !== titleText) view.titleEl.textContent = titleText;

    blocks.forEach((b, i) => {
      let tile = view.tiles[i];
      if (!tile) {
        const wide = !b.heading || /^(tl;?dr|summary)/i.test(b.heading);
        const mdEl = h('div', { class: 'md' });
        const el = h('div', { class: `r-tile${wide ? ' wide' : ''}`, style: { '--c': TILE_COLORS[i % TILE_COLORS.length] } },
          b.heading ? h('h3', {}, b.heading.toUpperCase()) : null, mdEl);
        view.grid.append(el);
        tile = view.tiles[i] = { el, mdEl, src: null };
      }
      const live = running && i === blocks.length - 1;
      tile.el.classList.toggle('live', live);
      const src = stableBody(b.body, live);
      if (src !== tile.src) {
        tile.src = src;
        tile.mdEl.innerHTML = sanitizeMarkdown(src);
      }
    });

    view.waiting.hidden = !(running && !blocks.length);
    if (running && atBottom) out.scrollTop = out.scrollHeight;
  }

  function setStatus(html) { status.innerHTML = html; }

  async function start() {
    const topic = input.value.trim();
    if (!topic) return;
    if (current && current.status === 'running') window.nexus.research.cancel(current.id);
    current = { id: uid(), topic, md: '', sources: [], searches: 0, status: 'running', at: Date.now() };
    runBtn.textContent = 'ABORT';
    setStatus('<span class="spinner"></span> engaging research core…');
    meta.textContent = '';
    render();
    window.nexus.research.run(current.id, topic);
  }

  window.nexus.research.onEvent((evt) => {
    if (!current || evt.id !== current.id) return;
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    switch (evt.type) {
      case 'text':
        current.md += evt.delta;
        setStatus('<span class="spinner"></span> compiling briefing…');
        scheduleRender();
        break;
      case 'search':
        current.searches++;
        setStatus(`<span class="spinner"></span> SCANNING [${current.searches}] <span class="q">${esc(evt.query)}</span>`);
        break;
      case 'sources':
        current.sources.push(...evt.sources);
        meta.textContent = `${current.sources.length} sources`;
        break;
      case 'done':
      case 'cancelled':
      case 'error': {
        current.status = evt.type;
        runBtn.textContent = 'ENGAGE';
        if (evt.type === 'error') setStatus(`<span class="err-text">ERROR:</span> ${esc(evt.message)}`);
        else if (evt.type === 'cancelled') setStatus('aborted.');
        else setStatus(`<span class="ok-text">BRIEFING COMPLETE</span> · ${current.searches} searches · ${current.sources.length} sources`);
        if (evt.type === 'done' && current.md) {
          history = [{ id: current.id, topic: current.topic, md: current.md, at: current.at, searches: current.searches, sourceCount: current.sources.length },
            ...history.filter((r) => r.id !== current.id)].slice(0, HISTORY_MAX);
          save('research', history);
          renderHistory();
        }
        render();
        break;
      }
    }
  });

  runBtn.addEventListener('click', () => {
    if (current && current.status === 'running') window.nexus.research.cancel(current.id);
    else start();
  });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && start());
  historySel.addEventListener('change', () => {
    const r = history.find((x) => x.id === historySel.value);
    historySel.value = '';
    if (!r) return;
    if (current && current.status === 'running') window.nexus.research.cancel(current.id);
    current = { ...r, sources: [], status: 'done' };
    input.value = r.topic;
    runBtn.textContent = 'ENGAGE';
    setStatus(`archived briefing · ${new Date(r.at).toLocaleString()}`);
    meta.textContent = r.sourceCount ? `${r.sourceCount} sources` : '';
    render();
  });

  renderHistory();
  async function showEngine() {
    if (current && current.status === 'running') return;
    const s = await window.nexus.settings.get();
    setStatus(s.ready ? `core online · <span class="ok-text">${s.engineLabel}</span>`
    : s.provider === 'ollama' ? '<span class="err-text">Ollama offline</span> — start Ollama, or click ⚙ to configure'
    : '<span class="err-text">no API key</span> — click ⚙ to add one or switch to Ollama');
  }
  document.addEventListener('settings:changed', showEngine);
  await showEngine();
  splash();
}
