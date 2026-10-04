// Shared skin bootstrap. A skin's HTML declares panels like:
//
//   <section data-widget="todo">
//     <header> … <span data-slot="meta"></span> <button data-slot="refresh"></button> <button data-max></button> </header>
//     <div data-body></div>
//   </section>
//
// and calls mountWidgets(registry). Each widget gets { panel, body, meta, slot(name) }.
import { closeModal, openSettings } from './modal.js';

export function mountWidgets(registry, root = document) {
  const jobs = [];
  for (const panel of root.querySelectorAll('[data-widget]')) {
    const name = panel.dataset.widget;
    const mount = registry[name];
    if (!mount) {
      console.warn(`[hud] unknown widget "${name}"`);
      continue;
    }
    const body = panel.querySelector('[data-body]') || panel;
    body.classList.add(`w-${name}`);
    const slot = (n) => panel.querySelector(`[data-slot="${n}"]`);
    // Optional per-skin options, e.g. data-opts='{"runLabel":"search"}'.
    let opts = {};
    try { opts = panel.dataset.opts ? JSON.parse(panel.dataset.opts) : {}; } catch { console.warn(`[hud] bad data-opts on "${name}"`); }
    const ctx = { panel, body, meta: slot('meta') || panel.paneMeta || null, slot, opts };
    // Each widget starts independently so one failure doesn't take down the HUD.
    jobs.push(Promise.resolve().then(() => mount(ctx)).catch((err) => console.error(`[${name}] failed to start`, err)));
  }
  return Promise.all(jobs);
}

// Maximize toggles: [data-max] buttons, or double-click a panel header. Esc restores / closes dialogs.
export function wirePanels(root = document) {
  const toggle = (panel) => {
    root.querySelectorAll('.maximized').forEach((p) => p !== panel && p.classList.remove('maximized'));
    panel.classList.toggle('maximized');
  };
  for (const panel of root.querySelectorAll('[data-widget], .panel, [data-tabcard]')) {
    const btn = panel.querySelector('[data-max]');
    if (!btn) continue;
    btn.addEventListener('click', () => toggle(panel));
    const header = panel.querySelector('header');
    if (header) header.addEventListener('dblclick', (e) => !e.target.closest('button, select, input') && toggle(panel));
  }
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('modal');
    if (modal && !modal.hidden) closeModal();
    else root.querySelectorAll('.maximized').forEach((p) => p.classList.remove('maximized'));
  });
}

// Window controls: any element with data-action="settings|minimize|quit|skins".
export function wireWindowControls(root = document) {
  const actions = {
    settings: openSettings,
    minimize: () => window.hud.win.minimize(),
    quit: () => window.hud.win.quit(),
  };
  root.querySelectorAll('[data-action]').forEach((el) => {
    const fn = actions[el.dataset.action];
    if (fn) el.addEventListener('click', fn);
  });
}

// Tabbed cards: one card hosting several widgets, one visible at a time.
//
//   <section class="panel" data-tabcard>
//     <header> <nav><button data-tab>tasks</button><button data-tab>projects</button></nav> </header>
//     <div data-widget="todo"><div data-body></div></div>
//     <div data-widget="projects"><div data-body></div></div>
//   </section>
//
// Each pane gets its own meta span in the header (shown only while its tab is active).
export function wireTabCards(root = document) {
  for (const card of root.querySelectorAll('[data-tabcard]')) {
    const buttons = [...card.querySelectorAll('[data-tab]')];
    const panes = [...card.querySelectorAll(':scope > [data-widget]')];
    const header = card.querySelector('header');
    const metaHost = card.querySelector('[data-slot="tab-meta"]') || header;
    panes.forEach((pane) => {
      pane.paneMeta = document.createElement('span');
      pane.paneMeta.className = 'meta';
      metaHost.append(pane.paneMeta);
    });
    const show = (i) => {
      panes.forEach((p, j) => { p.hidden = j !== i; p.paneMeta.hidden = j !== i; });
      buttons.forEach((b, j) => b.classList.toggle('on', j === i));
      try { localStorage.setItem(`tabcard:${card.id || panes.map((p) => p.dataset.widget).join('+')}`, String(i)); } catch { /* storage off */ }
    };
    buttons.forEach((b, i) => b.addEventListener('click', () => show(i)));
    let saved = 0;
    try { saved = Number(localStorage.getItem(`tabcard:${card.id || panes.map((p) => p.dataset.widget).join('+')}`)) || 0; } catch { /* storage off */ }
    show(Math.min(saved, panes.length - 1));
  }
}

// Shared pieces every skin needs: a #modal host plus the wiring above.
export function bootHud(registry) {
  if (!document.getElementById('modal')) {
    const m = document.createElement('div');
    m.id = 'modal';
    m.hidden = true;
    document.body.append(m);
  }
  wireTabCards();
  wirePanels();
  wireWindowControls();
  return mountWidgets(registry);
}
