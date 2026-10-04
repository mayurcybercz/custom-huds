import { h, load, save, emit, dayKey, notify, pad2 } from '../core/util.js';

// Pomodoro focus timer. Optionally linked to an open task; finished focus sessions are
// counted per day and announced on the bus ('pomo:done') so the pet can celebrate.
const MODES = {
  focus: { label: 'FOCUS', key: 'focusMin', color: 'var(--accent)' },
  short: { label: 'SHORT BREAK', key: 'shortMin', color: 'var(--ok)' },
  long: { label: 'LONG BREAK', key: 'longMin', color: 'var(--accent3)' },
};
const DEFAULTS = { focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoStart: false };

export async function mount({ body: root, meta }) {
  const cfg = { ...DEFAULTS, ...(await load('pomodoroCfg', {})) };
  let stats = await load('pomodoro', { day: dayKey(), sessions: 0, minutes: 0, history: {} });
  let mode = 'focus';
  let remaining = cfg.focusMin * 60;
  let endsAt = 0; // timestamp while running, 0 when paused
  let taskId = '';
  let todos = await load('todos', []);

  const R = 70, C = 2 * Math.PI * R;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 170 170');
  ring.innerHTML = `
    <circle cx="85" cy="85" r="${R}" fill="none" stroke="var(--line)" stroke-width="8"/>
    <circle class="pomo-arc" cx="85" cy="85" r="${R}" fill="none" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 85 85)"/>`;
  const arc = ring.querySelector('.pomo-arc');
  const time = h('div', { class: 'pomo-time' });
  const modeEl = h('div', { class: 'pomo-mode' });
  const startBtn = h('button', { class: 'btn pomo-start', onclick: () => (endsAt ? pause() : start()) });
  const taskSel = h('select', { class: 'pomo-task', title: 'Link a task', onchange: () => { taskId = taskSel.value; persistState(); } });
  const dots = h('div', { class: 'pomo-dots' });

  root.append(
    h('div', { class: 'pomo-dial' }, ring, h('div', { class: 'pomo-center' }, modeEl, time)),
    h('div', { class: 'pomo-ctrl' },
      h('button', { class: 'btn', title: 'Reset', onclick: reset }, '↺'),
      startBtn,
      h('button', { class: 'btn', title: 'Skip to next', onclick: () => finish(true) }, '⏭')),
    taskSel,
    dots);

  const total = () => cfg[MODES[mode].key] * 60;
  const persist = () => save('pomodoro', stats);
  // The running timer survives reloads and skin switches.
  const persistState = () => save('pomodoroState', { mode, endsAt, remaining, taskId });

  function rollDay() {
    if (stats.day !== dayKey()) {
      stats.history = stats.history || {};
      stats.history[stats.day] = { sessions: stats.sessions, minutes: stats.minutes };
      stats = { day: dayKey(), sessions: 0, minutes: 0, history: stats.history };
      persist();
    }
  }

  function renderTasks() {
    const open = todos.filter((t) => !t.done);
    taskSel.replaceChildren(h('option', { value: '' }, '— no task linked —'),
      ...open.map((t) => h('option', { value: t.id, selected: t.id === taskId }, t.text)));
  }

  function render() {
    const secs = Math.max(0, Math.ceil(endsAt ? (endsAt - Date.now()) / 1000 : remaining));
    time.textContent = `${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`;
    modeEl.textContent = MODES[mode].label;
    arc.style.stroke = MODES[mode].color;
    arc.style.strokeDashoffset = String(C * (1 - secs / total()));
    startBtn.textContent = endsAt ? 'PAUSE' : remaining < total() ? 'RESUME' : 'START';
    root.classList.toggle('running', Boolean(endsAt));
    const inCycle = stats.sessions % cfg.longEvery;
    dots.replaceChildren(...Array.from({ length: cfg.longEvery }, (_, i) => h('i', { class: i < inCycle ? 'on' : '' })),
      h('span', {}, `${stats.sessions} today · ${stats.minutes} min`));
    if (meta) meta.textContent = endsAt ? `${MODES[mode].label.toLowerCase()} · ${time.textContent}` : `${stats.sessions} sessions today`;
  }

  function start() {
    endsAt = Date.now() + remaining * 1000;
    persistState();
    render();
  }
  function pause() {
    remaining = Math.max(0, (endsAt - Date.now()) / 1000);
    endsAt = 0;
    persistState();
    render();
  }
  function reset() {
    endsAt = 0;
    remaining = total();
    persistState();
    render();
  }
  function setMode(m) {
    mode = m;
    endsAt = 0;
    remaining = total();
  }

  function finish(skipped = false) {
    rollDay();
    if (mode === 'focus') {
      if (!skipped) {
        stats.sessions += 1;
        stats.minutes += cfg.focusMin;
        persist();
        const task = todos.find((t) => t.id === taskId);
        emit('pomo:done', { minutes: cfg.focusMin, task });
        notify('Focus session complete 🍅', task ? `Nice work on "${task.text}". Take a break.` : 'Take a short break.');
      }
      setMode(stats.sessions > 0 && stats.sessions % cfg.longEvery === 0 && !skipped ? 'long' : 'short');
    } else {
      if (!skipped) notify('Break over', 'Ready for another focus session?');
      setMode('focus');
    }
    persistState();
    if (cfg.autoStart && !skipped) start();
    render();
  }

  setInterval(() => {
    if (endsAt && Date.now() >= endsAt) finish();
    else if (endsAt) render();
  }, 250);
  // Keep the task list fresh when todos change in another widget.
  setInterval(async () => {
    const fresh = await load('todos', []);
    if (JSON.stringify(fresh.map((t) => [t.id, t.done, t.text])) !== JSON.stringify(todos.map((t) => [t.id, t.done, t.text]))) {
      todos = fresh;
      renderTasks();
    }
  }, 5000);

  rollDay();
  const saved = await load('pomodoroState', null);
  if (saved && MODES[saved.mode]) {
    mode = saved.mode;
    taskId = saved.taskId || '';
    if (saved.endsAt > Date.now()) endsAt = saved.endsAt; // still running
    else if (saved.endsAt) { remaining = 0; renderTasks(); finish(); return; } // finished while the HUD was closed
    else remaining = Math.min(total(), saved.remaining > 0 ? saved.remaining : total());
  } else {
    remaining = total();
  }
  renderTasks();
  render();
}
