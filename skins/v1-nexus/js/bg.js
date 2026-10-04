// Ambient background: drifting hex grid with travelling data pulses.
export function startBackground() {
  const c = document.getElementById('bg');
  const ctx = c.getContext('2d');
  let w, hgt, hexes = [], pulses = [];
  const R = 26;

  function resize() {
    w = c.width = innerWidth;
    hgt = c.height = innerHeight;
    hexes = [];
    const dx = R * Math.sqrt(3), dy = R * 1.5;
    for (let row = -1; row * dy < hgt + R; row++) {
      for (let col = -1; col * dx < w + R; col++) {
        hexes.push({ x: col * dx + (row % 2 ? dx / 2 : 0), y: row * dy, a: Math.random() * 0.05, t: Math.random() * 1000 });
      }
    }
  }

  function hex(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 3 * i + Math.PI / 6;
      ctx.lineTo(x + r * Math.cos(ang), y + r * Math.sin(ang));
    }
    ctx.closePath();
  }

  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < 50) return; // ~20fps is plenty for ambience
    last = t;
    ctx.clearRect(0, 0, w, hgt);
    const g = ctx.createRadialGradient(w / 2, hgt / 2, 0, w / 2, hgt / 2, Math.max(w, hgt) / 1.2);
    g.addColorStop(0, '#04121a');
    g.addColorStop(1, '#010305');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hgt);

    ctx.lineWidth = 1;
    for (const hx of hexes) {
      const glow = 0.04 + 0.04 * Math.sin(t / 2400 + hx.t) + hx.a;
      ctx.strokeStyle = `rgba(0,229,255,${glow.toFixed(3)})`;
      hex(hx.x, hx.y, R - 2);
      ctx.stroke();
    }
    if (Math.random() < 0.08) {
      const hx = hexes[(Math.random() * hexes.length) | 0];
      pulses.push({ x: hx.x, y: hx.y, life: 1, hue: Math.random() < 0.15 ? '255,43,214' : '0,229,255' });
    }
    pulses = pulses.filter((p) => (p.life -= 0.02) > 0);
    for (const p of pulses) {
      ctx.fillStyle = `rgba(${p.hue},${(p.life * 0.18).toFixed(3)})`;
      hex(p.x, p.y, R - 2);
      ctx.fill();
    }
  }
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
}
