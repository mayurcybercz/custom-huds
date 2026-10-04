const os = require('os');
const fs = require('fs');

let prevCpu = snapshot();

function snapshot() {
  return os.cpus().map((c) => {
    const t = c.times;
    return { idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq };
  });
}

// CPU usage per core since the previous call, 0-100.
function cpuUsage() {
  const now = snapshot();
  const cores = now.map((c, i) => {
    const p = prevCpu[i] || c;
    const total = c.total - p.total;
    const idle = c.idle - p.idle;
    return total > 0 ? Math.round((1 - idle / total) * 100) : 0;
  });
  prevCpu = now;
  const avg = cores.reduce((a, b) => a + b, 0) / (cores.length || 1);
  return { avg: Math.round(avg), cores };
}

async function disk() {
  try {
    const s = await fs.promises.statfs(process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\');
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return { total, used: total - free };
  } catch {
    return null;
  }
}

async function stats() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    host: os.hostname(),
    user: os.userInfo().username,
    platform: `${os.type()} ${os.release()}`,
    cpuModel: (os.cpus()[0] || {}).model || 'CPU',
    cpu: cpuUsage(),
    mem: { total, used: total - free },
    disk: await disk(),
    uptime: os.uptime(),
  };
}

module.exports = { stats };
