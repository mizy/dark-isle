import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/dark-isle-frames';
const GIF_OUT = '/tmp/dark-isle-gameplay.gif';

if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
console.log('Page loaded, waiting for game...');
await page.waitForSelector('canvas', { timeout: 15000 });
console.log('Canvas found, waiting for game init...');
await page.waitForTimeout(4000);

let frameIdx = 0;
async function takeShot(label) {
  const buf = await page.screenshot({ type: "png" });
  const fname = path.join(OUT_DIR, `frame-${String(frameIdx).padStart(4, '0')}-${label}.png`);
  fs.writeFileSync(fname, buf);
  frameIdx++;
}

// Scene 1: Idle
console.log('Scene 1: Idle');
for (let i = 0; i < 6; i++) { await takeShot('idle'); await page.waitForTimeout(200); }

// Scene 2: Move SE (D key)
console.log('Move SE');
await page.keyboard.down('d');
for (let i = 0; i < 12; i++) { await takeShot('move-se'); await page.waitForTimeout(120); }
await page.keyboard.up('d');

// Scene 3: Move NW (W key)
console.log('Move NW');
await page.keyboard.down('w');
for (let i = 0; i < 12; i++) { await takeShot('move-nw'); await page.waitForTimeout(120); }
await page.keyboard.up('w');

// Scene 4: Move S
console.log('Move S');
await page.keyboard.down('s');
for (let i = 0; i < 12; i++) { await takeShot('move-s'); await page.waitForTimeout(120); }
await page.keyboard.up('s');

// Scene 5: Move NE (A+W)
console.log('Move NE');
await page.keyboard.down('a');
await page.keyboard.down('w');
for (let i = 0; i < 12; i++) { await takeShot('move-ne'); await page.waitForTimeout(120); }
await page.keyboard.up('a');
await page.keyboard.up('w');

// Scene 6: Pause
console.log('Pause');
for (let i = 0; i < 4; i++) { await takeShot('pause'); await page.waitForTimeout(200); }

// Scene 7: Attacks
console.log('Attacks');
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('Space');
  await takeShot('atk1'); await page.waitForTimeout(100);
  await takeShot('atk2'); await page.waitForTimeout(300);
  await takeShot('atk3'); await page.waitForTimeout(150);
}

// Scene 8: Click to move
console.log('Click to move');
const canvas = await page.$('canvas');
if (canvas) {
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
    for (let i = 0; i < 10; i++) { await takeShot('click-move'); await page.waitForTimeout(150); }
  }
}

// Scene 9: Final idle
console.log('Final idle');
for (let i = 0; i < 6; i++) { await takeShot('final'); await page.waitForTimeout(200); }

await browser.close();
console.log(`Captured ${frameIdx} frames. Creating GIF...`);

execSync(
  `ffmpeg -y -framerate 8 -pattern_type glob -i '${OUT_DIR}/frame-*.png' -vf "fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer" -loop 0 '${GIF_OUT}'`,
  { stdio: 'inherit', timeout: 60000 }
);

const size = (fs.statSync(GIF_OUT).size / 1024 / 1024).toFixed(1);
console.log(`GIF created: ${GIF_OUT} (${size} MB)`);
