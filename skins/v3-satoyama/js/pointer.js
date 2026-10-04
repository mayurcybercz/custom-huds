// Mouse → scene coordinates. The canvas is scaled with object-fit: cover, so map through that.
import { W, H } from './engine/util.js';

export function createPointer(el) {
  const p = { active: false, sx: 0, sy: 0, wx: 0, wy: 0, dx: 0, dy: 0, down: false, pressed: false, inSky: false };
  let pressQueued = false;

  function toArt(e) {
    const vw = el.clientWidth, vh = el.clientHeight;
    const scale = Math.max(vw / W, vh / H);
    const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
    const r = el.getBoundingClientRect();
    return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale];
  }
  el.addEventListener('pointermove', (e) => {
    const [x, y] = toArt(e);
    if (p.active) { p.dx += x - p.sx; p.dy += y - p.sy; }
    p.sx = x; p.sy = y; p.active = true;
  });
  el.addEventListener('pointerleave', () => { p.active = false; p.down = false; });
  el.addEventListener('pointerdown', (e) => { const [x, y] = toArt(e); p.sx = x; p.sy = y; p.active = true; p.down = true; pressQueued = true; });
  addEventListener('pointerup', () => { p.down = false; });

  return {
    p,
    // call once per frame before rendering
    beginFrame(camX) {
      p.wx = camX + p.sx; p.wy = p.sy;
      p.inSky = p.active && p.sy < 150;
      p.pressed = pressQueued; pressQueued = false;
    },
    endFrame() { p.dx = 0; p.dy = 0; p.pressed = false; },
  };
}
