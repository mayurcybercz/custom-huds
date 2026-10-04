// Time-of-day lighting. Each keyframe: hour, sky top, sky middle, horizon, ambient light, sun glow.
// Rain (0..1) greys and darkens everything; dawn adds mist.
import { clamp, mix, lum } from './util.js';

const KF = [
  [0.0, [10, 13, 34], [22, 28, 62], [42, 46, 86], [62, 74, 132], [0, 0, 0]],
  [4.3, [10, 13, 34], [22, 28, 62], [42, 46, 86], [62, 74, 132], [0, 0, 0]],
  [5.2, [26, 32, 74], [70, 66, 118], [190, 130, 140], [120, 112, 150], [255, 150, 110]],
  [6.2, [70, 104, 168], [170, 150, 170], [255, 190, 150], [200, 180, 180], [255, 190, 130]],
  [7.5, [96, 150, 214], [160, 196, 230], [240, 222, 200], [245, 236, 224], [255, 230, 190]],
  [10.0, [80, 148, 232], [140, 192, 242], [206, 228, 246], [255, 255, 255], [255, 250, 230]],
  [15.0, [86, 150, 228], [146, 194, 238], [214, 230, 244], [255, 252, 244], [255, 246, 222]],
  [17.2, [92, 120, 196], [190, 170, 180], [255, 196, 140], [255, 222, 182], [255, 200, 130]],
  [18.3, [60, 56, 128], [176, 104, 128], [252, 132, 96], [214, 160, 162], [255, 140, 80]],
  [19.3, [32, 32, 84], [70, 52, 104], [130, 76, 108], [120, 104, 160], [200, 90, 90]],
  [20.6, [12, 16, 42], [26, 30, 68], [48, 48, 92], [68, 80, 140], [0, 0, 0]],
  [24.0, [10, 13, 34], [22, 28, 62], [42, 46, 86], [62, 74, 132], [0, 0, 0]],
];

function overcast(c, k) {
  const l = lum(c);
  return mix(c, [l * 0.95, l, l * 1.07], 0.82).map((v) => v * k);
}

export function environment(hour, rain = 0) {
  hour = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KF.length - 2 && hour >= KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1];
  const t = clamp((hour - a[0]) / (b[0] - a[0] || 1), 0, 1);
  let top = mix(a[1], b[1], t), mid = mix(a[2], b[2], t), horizon = mix(a[3], b[3], t), ambient = mix(a[4], b[4], t);
  const glow = mix(a[5], b[5], t);
  if (rain > 0) {
    top = mix(top, overcast(top, 0.72), rain);
    mid = mix(mid, overcast(mid, 0.74), rain);
    horizon = mix(horizon, overcast(horizon, 0.78), rain);
    ambient = mix(ambient, overcast(ambient, 0.8), rain);
  }
  const dark = 1 - lum(ambient) / 255;
  // sun and moon arcs across the sky (screen-space, independent of camera)
  const sunK = (hour - 5.6) / 13.2;               // 0 at sunrise, 1 at sunset
  const moonH = hour >= 18 ? hour - 18.4 : hour + 5.6;
  const moonK = moonH / 12;
  return {
    hour, rain, top, mid, horizon, ambient, glow, dark,
    lights: clamp((dark - 0.14) / 0.3, 0, 1),                 // lanterns & windows
    stars: clamp((dark - 0.38) / 0.22, 0, 1) * (1 - rain),
    mist: clamp(1 - Math.abs(hour - 6.3) / 1.8, 0, 1) * 0.8 + rain * 0.45 + (dark > 0.5 ? 0.15 : 0),
    sun: { k: sunK, vis: sunK > -0.02 && sunK < 1.02 ? 1 - rain * 0.9 : 0, x: 60 + sunK * 520, y: 230 - Math.sin(clamp(sunK, 0, 1) * Math.PI) * 190 },
    moon: { vis: moonK > 0 && moonK < 1 ? (1 - rain * 0.95) * clamp(dark * 2, 0, 1) : 0, x: 80 + moonK * 480, y: 220 - Math.sin(clamp(moonK, 0, 1) * Math.PI) * 170 },
    warm: clamp(1 - Math.abs(hour - 18.1) / 1.4, 0, 1) + clamp(1 - Math.abs(hour - 6) / 1.2, 0, 1) * 0.7,
  };
}

export function phaseName(h) {
  h = ((h % 24) + 24) % 24;
  if (h >= 4.5 && h < 6.6) return ['夜明け', 'dawn'];
  if (h >= 6.6 && h < 10) return ['朝', 'morning'];
  if (h >= 10 && h < 15.3) return ['昼', 'midday'];
  if (h >= 15.3 && h < 17.4) return ['午後', 'afternoon'];
  if (h >= 17.4 && h < 19.5) return ['夕暮れ', 'dusk'];
  if (h >= 19.5 && h < 23.3) return ['夜', 'night'];
  return ['深夜', 'late night'];
}
