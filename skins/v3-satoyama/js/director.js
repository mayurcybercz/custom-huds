// What time it is in the village, where the camera looks, and the weather.
// "Auto" runs the whole day as a sequence of scenes, each with its own length; other modes hold one scene.
import { ZONES } from './engine/world.js';
import { lerp, clamp, W, WORLD_W } from './engine/util.js';

// One village day in auto mode (~12½ minutes). Camera moves between zones within each scene.
export const DAY = [
  { id: 'dawn', name: 'Dawn mist', from: 4.8, to: 7.0, secs: 100, cam: ['temple', 'temple'] },
  { id: 'morning', name: 'Morning in the village', from: 7.0, to: 10.4, secs: 95, cam: ['temple', 'village'], rainable: true },
  { id: 'midday', name: 'Midday', from: 10.4, to: 15.4, secs: 130, cam: ['village', 'fields'], rainable: true },
  { id: 'dusk', name: 'Coming home', from: 15.4, to: 19.3, secs: 130, cam: ['fields', 'village'], rainable: true },
  { id: 'evening', name: 'Evening', from: 19.3, to: 22.9, secs: 150, cam: ['village', 'village'], festival: true },
  { id: 'night', name: 'Forest night', from: 22.9, to: 28.8, secs: 150, cam: ['forest', 'forest'] },
];

export const MODES = [
  { id: 'auto', label: 'Auto day', icon: '⟳', hint: 'Cycles through the whole day' },
  { id: 'dawn', label: 'Dawn', icon: '🌅', hour: 6.1, cam: 'temple' },
  { id: 'midday', label: 'Midday', icon: '☀️', hour: 12.3, cam: 'village' },
  { id: 'dusk', label: 'Dusk', icon: '🌆', hour: 18.05, cam: 'fields' },
  { id: 'festival', label: 'Festival night', icon: '🏮', hour: 20.8, cam: 'village', festival: true },
  { id: 'rain', label: 'Rainy afternoon', icon: '☔', hour: 15.3, cam: 'village', rain: 1 },
  { id: 'forest', label: 'Forest night', icon: '🌲', hour: 23.7, cam: 'forest' },
  { id: 'clock', label: 'Real clock', icon: '🕰️', hint: 'Follows your computer clock' },
];
const BELL_HOURS = [6, 12, 18];

export function createDirector(initialMode = 'auto') {
  const st = {
    mode: initialMode, hour: 4.9, rain: 0, festival: false, camX: ZONES.temple, sceneName: '',
    day: 0, seg: 0, segT: 0, rainDay: false,
  };
  let camTarget = st.camX, rainTarget = 0, lastHour = st.hour, sinceStart = 0;

  function planDay() { st.rainDay = st.day % 3 === 1; }
  planDay();

  function setMode(id) {
    if (!MODES.some((m) => m.id === id)) id = 'auto';
    st.mode = id;
    const m = MODES.find((x) => x.id === id);
    if (m.hour !== undefined) {
      st.hour = m.hour; lastHour = m.hour;
      st.festival = Boolean(m.festival);
      rainTarget = m.rain || 0;
      st.sceneName = m.label;
    }
    if (id === 'auto') { st.seg = 0; st.segT = 0; st.hour = DAY[0].from; lastHour = st.hour; }
  }

  function nextScene() {
    if (st.mode !== 'auto') return;
    st.segT = 0;
    st.seg = (st.seg + 1) % DAY.length;
    if (st.seg === 0) { st.day++; planDay(); }
  }

  function update(dt) {
    const events = { bell: false };
    sinceStart += dt;
    const drift = Math.sin(sinceStart * 0.045) * 28 + Math.sin(sinceStart * 0.017) * 18;
    if (st.mode === 'auto') {
      st.segT += dt;
      let s = DAY[st.seg];
      if (st.segT >= s.secs) nextScene();
      s = DAY[st.seg];
      const p = clamp(st.segT / s.secs, 0, 1);
      st.hour = lerp(s.from, s.to, p) % 24;
      st.festival = Boolean(s.festival) && !st.rainDay;
      rainTarget = st.rainDay && s.rainable ? (p > 0.08 || s.id !== 'morning' ? 1 : 0) : 0;
      if (st.rainDay && s.id === 'dusk' && p > 0.7) rainTarget = 0; // clears up before evening
      camTarget = lerp(ZONES[s.cam[0]], ZONES[s.cam[1]], p * p * (3 - 2 * p)) + drift;
      st.sceneName = st.rainDay && s.rainable && st.rain > 0.5 ? `${s.name} · rain` : st.festival && s.id === 'evening' ? 'Festival night' : s.name;
    } else if (st.mode === 'clock') {
      const d = new Date();
      st.hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      st.festival = d.getDay() === 6 || (d.getMonth() === 7 && d.getDate() >= 13 && d.getDate() <= 16); // Saturdays and Obon
      rainTarget = 0;
      camTarget = (st.hour >= 22.9 || st.hour < 4.8 ? ZONES.forest : st.hour < 8 ? ZONES.temple : ZONES.village) + drift;
      st.sceneName = 'Real clock';
    } else {
      const m = MODES.find((x) => x.id === st.mode);
      camTarget = ZONES[m.cam] + drift * 1.3;
    }
    st.rain += (rainTarget - st.rain) * Math.min(1, dt * 0.12);
    if (Math.abs(rainTarget - st.rain) < 0.002) st.rain = rainTarget;
    st.camX += (clamp(camTarget, 0, WORLD_W - W) - st.camX) * Math.min(1, dt * 0.35);
    for (const bh of BELL_HOURS) if (lastHour < bh && st.hour >= bh && st.hour - lastHour < 1) events.bell = true;
    lastHour = st.hour;
    return events;
  }

  return { state: st, setMode, nextScene, update };
}
