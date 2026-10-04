// Short fake boot log shown on launch.
const LINES = [
  'NEXUS BIOS v0.1 .......................... OK',
  'probing neural lattice ..................... OK',
  'mounting /dev/hud0 ......................... OK',
  'linking research core [claude] ............. OK',
  'spawning companion process ................. OK',
  'tuning feeds: ai | tech | anime ............ OK',
  'handshake with media session ............... OK',
  '',
  '> WELCOME BACK, OPERATOR.',
];

export function boot() {
  const box = document.getElementById('boot');
  const log = document.getElementById('boot-log');
  let i = 0;
  const tick = () => {
    if (i < LINES.length) {
      log.textContent += LINES[i++] + '\n';
      setTimeout(tick, 90 + Math.random() * 90);
    } else {
      setTimeout(() => box.classList.add('gone'), 350);
      setTimeout(() => box.remove(), 1100);
    }
  };
  tick();
}
