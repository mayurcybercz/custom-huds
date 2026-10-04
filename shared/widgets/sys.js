import { h, fmtBytes, cssVar, emit } from '../core/util.js';

export function mount({ body: root, meta }) {
  const spark = h('canvas');
  const cores = h('div', { class: 'cores' });
  const cpuTxt = h('b'), memTxt = h('b'), diskTxt = h('b'), upTxt = h('b');
  const memBar = h('i'), diskBar = h('i');
  root.append(
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'CPU'), cpuTxt),
    spark, cores,
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'MEM'), memTxt),
    h('div', { class: 'bar seg', style: { '--c': 'var(--ok)' } }, memBar),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'DISK'), diskTxt),
    h('div', { class: 'bar seg', style: { '--c': 'var(--warn)' } }, diskBar),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'UPTIME'), upTxt),
  );
  const history = [];
  const ctx = spark.getContext('2d');

  function draw() {
    const w = spark.width = spark.clientWidth * devicePixelRatio;
    const ht = spark.height = spark.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, w, ht);
    if (history.length < 2) return;
    const step = w / 59;
    const grad = ctx.createLinearGradient(0, 0, 0, ht);
    grad.addColorStop(0, cssVar('--spark-fill', 'rgba(0,229,255,.45)'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    history.forEach((v, i) => ctx.lineTo(w - (history.length - 1 - i) * step, ht - (v / 100) * ht));
    ctx.strokeStyle = cssVar('--accent', '#00e5ff');
    ctx.lineWidth = 1.5 * devicePixelRatio;
    ctx.stroke();
    ctx.lineTo(w, ht);
    ctx.lineTo(w - (history.length - 1) * step, ht);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  let host = false;
  async function tick() {
    const s = await window.nexus.sys.stats();
    if (!host) {
      if (meta) meta.textContent = `${s.user}@${s.host}`;
      host = true;
    }
    history.push(s.cpu.avg);
    if (history.length > 60) history.shift();
    cpuTxt.textContent = `${s.cpu.avg}%  ·  ${s.cpu.cores.length} threads`;
    if (cores.children.length !== s.cpu.cores.length) {
      cores.replaceChildren(...s.cpu.cores.map(() => h('i')));
    }
    s.cpu.cores.forEach((v, i) => {
      const bar = cores.children[i];
      bar.style.height = `${Math.max(4, v)}%`;
      bar.style.background = v > 85 ? 'var(--danger)' : v > 60 ? 'var(--warn)' : 'var(--accent)';
    });
    memTxt.textContent = `${fmtBytes(s.mem.used)} / ${fmtBytes(s.mem.total)}`;
    memBar.style.width = `${(s.mem.used / s.mem.total) * 100}%`;
    if (s.disk) {
      diskTxt.textContent = `${fmtBytes(s.disk.used)} / ${fmtBytes(s.disk.total)}`;
      diskBar.style.width = `${(s.disk.used / s.disk.total) * 100}%`;
    }
    const u = s.uptime;
    upTxt.textContent = `${Math.floor(u / 86400)}d ${Math.floor((u % 86400) / 3600)}h ${Math.floor((u % 3600) / 60)}m`;
    draw();
    emit('sys:stats', s);
  }
  tick();
  setInterval(tick, 2000);
}
