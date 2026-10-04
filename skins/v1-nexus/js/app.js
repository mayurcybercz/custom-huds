// v1 "NEXUS": hacker HUD skin. Shared widgets + a skin-specific arc-reactor clock.
import { bootHud } from '../../../shared/core/hud.js';
import { widgets } from '../../../shared/widgets/index.js';
import { h, listen } from '../../../shared/core/util.js';
import { startBackground } from './bg.js';
import { boot } from './boot.js';
import { mount as clock } from './clock.js';

startBackground();
boot();

// Staggered entry animation.
document.querySelectorAll('.panel').forEach((p, i) => p.style.setProperty('--i', i));

// Headline ticker + CPU/MEM readout in the top bar.
listen('tech:headlines', (items) => {
  document.getElementById('ticker').replaceChildren(...items.slice(0, 20).flatMap((it) => [
    h('b', {}, `[${it.source}] `), it.title, h('span', { class: 'sep' }, '◆'),
  ]));
});
listen('sys:stats', (s) => {
  document.getElementById('topstatus').innerHTML =
    `CPU <span class="ok">${s.cpu.avg}%</span> · MEM <span class="ok">${Math.round((s.mem.used / s.mem.total) * 100)}%</span>`;
});

bootHud({ ...widgets, clock });
