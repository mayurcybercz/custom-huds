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
    const ctx = { panel, body, meta: slot('meta'), slot };
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
  for (const panel of root.querySelectorAll('[data-widget], .panel')) {
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
    minimize: () => window.nexus.win.minimize(),
    quit: () => window.nexus.win.quit(),
  };
  root.querySelectorAll('[data-action]').forEach((el) => {
    const fn = actions[el.dataset.action];
    if (fn) el.addEventListener('click', fn);
  });
}

// Shared pieces every skin needs: a #modal host plus the wiring above.
export function bootHud(registry) {
  if (!document.getElementById('modal')) {
    const m = document.createElement('div');
    m.id = 'modal';
    m.hidden = true;
    document.body.append(m);
  }
  wirePanels();
  wireWindowControls();
  return mountWidgets(registry);
}
