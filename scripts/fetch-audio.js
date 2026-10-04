// Downloads the optional CC0 recordings used by the SATOYAMA skin into skins/v3-satoyama/audio/.
// They are not kept in git (to keep the repo small); the skin falls back to synthesised sound without them.
//   npm run fetch-audio
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'skins', 'v3-satoyama', 'audio');
const FILES = [
  {
    file: 'children.mp3',
    url: 'https://cdn.freesound.org/previews/545/545873_1050391-hq.mp3',
    credit: '"Kids Playing at Playground November 11 2020" by kvgarlic, https://freesound.org/people/kvgarlic/sounds/545873/ (CC0)',
  },
  {
    file: 'bell.mp3',
    url: 'https://cdn.freesound.org/previews/397/397352_3200265-hq.mp3',
    credit: '"Montbell (Bonshō) von Japan" by Vurca, recorded at Hida no Sato, https://freesound.org/people/Vurca/sounds/397352/ (CC0)',
  },
];

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const { file, url, credit } of FILES) {
    const dest = path.join(DIR, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { console.log(`✓ ${file} already present`); continue; }
    process.stdout.write(`↓ ${file} … `);
    const res = await fetch(url, { headers: { 'User-Agent': 'CustomHUDs/3.0 (fetch-audio)' } });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`${(buf.length / 1048576).toFixed(1)} MB  (${credit})`);
  }
}

main().catch((e) => { console.error('fetch-audio failed:', e.message); process.exit(1); });
