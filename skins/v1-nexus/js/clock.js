import { h } from '../../../shared/core/util.js';

// Arc-reactor style clock with day / week / year progress.
export function mount({ body: root }) {
  const C = 2 * Math.PI * 64;
  root.innerHTML = `
    <div class="reactor">
      <svg viewBox="0 0 150 150">
        <g class="r3"><circle cx="75" cy="75" r="72" fill="none" stroke="rgba(0,229,255,.25)" stroke-width="1" stroke-dasharray="2 6"/></g>
        <circle cx="75" cy="75" r="64" fill="none" stroke="rgba(0,229,255,.1)" stroke-width="4"/>
        <circle id="sec-arc" cx="75" cy="75" r="64" fill="none" stroke="#00e5ff" stroke-width="4"
          stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 75 75)" style="filter:drop-shadow(0 0 4px #00e5ff);transition:stroke-dashoffset .3s"/>
        <g class="r1"><circle cx="75" cy="75" r="55" fill="none" stroke="rgba(57,255,136,.5)" stroke-width="1.5" stroke-dasharray="30 12 4 12"/></g>
        <g class="r2"><circle cx="75" cy="75" r="48" fill="none" stroke="rgba(0,229,255,.35)" stroke-width="6" stroke-dasharray="1 5"/></g>
      </svg>
      <div class="core"><div class="time" id="clk-time">--:--</div><div class="sec" id="clk-sec">--</div></div>
    </div>
    <div class="clock-side">
      <div><div class="date" id="clk-date"></div><div class="day" id="clk-day"></div></div>
      <div id="clk-bars"></div>
    </div>`;
  const arc = root.querySelector('#sec-arc');
  const bars = root.querySelector('#clk-bars');
  const parts = ['DAY', 'WEEK', 'MONTH', 'YEAR'].map((name) => {
    const fill = h('i');
    const pct = h('span');
    bars.append(h('div', { style: { marginBottom: '5px' } },
      h('div', { class: 'row' }, h('span', {}, name), pct),
      h('div', { class: 'bar seg' }, fill)));
    return { fill, pct };
  });

  function tick() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    root.querySelector('#clk-time').textContent = `${hh}:${mm}`;
    root.querySelector('#clk-sec').textContent = String(d.getSeconds()).padStart(2, '0');
    arc.style.strokeDashoffset = C * (1 - (d.getSeconds() + d.getMilliseconds() / 1000) / 60);
    root.querySelector('#clk-date').textContent = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    root.querySelector('#clk-day').textContent = d.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();

    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayP = (d - dayStart) / 864e5;
    const weekP = (((d.getDay() + 6) % 7) + dayP) / 7;
    const monthDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const monthP = (d.getDate() - 1 + dayP) / monthDays;
    const y0 = new Date(d.getFullYear(), 0, 1), y1 = new Date(d.getFullYear() + 1, 0, 1);
    const yearP = (d - y0) / (y1 - y0);
    [dayP, weekP, monthP, yearP].forEach((p, i) => {
      parts[i].fill.style.width = `${(p * 100).toFixed(1)}%`;
      parts[i].pct.textContent = `${(p * 100).toFixed(1)}%`;
    });
  }
  tick();
  setInterval(tick, 250);
}
