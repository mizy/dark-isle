/** @entry Procedural pixel-art texture generation for dungeon game */

import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from '../systems/isometric';

const PADDING = 2;
const TEX_W = TILE_WIDTH + PADDING * 2;
const TEX_H = TILE_HEIGHT + PADDING * 2;

function diamondPoints(cx: number, cy: number) {
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}

function drawDiamond(g: Phaser.GameObjects.Graphics, fill: number, stroke: number, alpha = 1) {
  const cx = TEX_W / 2;
  const cy = TEX_H / 2;
  const pts = diamondPoints(cx, cy);
  g.fillStyle(fill, alpha);
  g.lineStyle(1, stroke, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Directional isometric lighting: upper-left highlight, lower-right shadow
  // Light comes from upper-left, creating depth on the isometric surface
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;

  // Upper-left highlight triangle (top + left quadrant)
  g.fillStyle(0xffffff, 0.06);
  g.beginPath();
  g.moveTo(cx, cy - hh);        // top
  g.lineTo(cx - hw, cy);         // left
  g.lineTo(cx, cy);              // center
  g.closePath();
  g.fillPath();

  // Lower-right shadow triangle (bottom + right quadrant)
  g.fillStyle(0x000000, 0.08);
  g.beginPath();
  g.moveTo(cx, cy + hh);        // bottom
  g.lineTo(cx + hw, cy);         // right
  g.lineTo(cx, cy);              // center
  g.closePath();
  g.fillPath();

  // Subtle edge highlight along top-left edges
  g.lineStyle(1, 0xffffff, 0.08);
  g.beginPath();
  g.moveTo(cx - hw + 1, cy);
  g.lineTo(cx, cy - hh + 1);
  g.strokePath();

  // Subtle edge shadow along bottom-right edges
  g.lineStyle(1, 0x000000, 0.12);
  g.beginPath();
  g.moveTo(cx + hw - 1, cy);
  g.lineTo(cx, cy + hh - 1);
  g.strokePath();
}

function insideDiamond(px: number, py: number): boolean {
  const cx = TEX_W / 2;
  const cy = TEX_H / 2;
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  return Math.abs(px - cx) / hw + Math.abs(py - cy) / hh <= 1;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateAndSave(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  // Skip if already loaded from preload (e.g. real DCSS sprites)
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ─── Tile generators (isometric diamonds) ───

function genGrassTile(scene: Phaser.Scene, key: string, seed: number, baseColor: number, strokeColor: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, baseColor, strokeColor);
    const rand = seededRandom(seed);

    const groundTones = [0x5a9a48, 0x4a8a3d, 0x68a855, 0x52924a];
    for (let i = 0; i < 8; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(groundTones[Math.floor(rand() * groundTones.length)], 0.25 + rand() * 0.2);
      g.fillEllipse(px, py, 6 + rand() * 8, 3 + rand() * 4);
    }

    for (let i = 0; i < 10; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x3a6a30, 0.3 + rand() * 0.2);
      g.fillCircle(px, py, 2 + rand() * 2);
    }

    const bladeColors = [0x5aaa48, 0x68b856, 0x4e9840, 0x72c460, 0x44903a, 0x7ecc68, 0x58b050, 0x86d470];
    for (let i = 0; i < 65; i++) {
      const bx = rand() * TEX_W, by = rand() * TEX_H;
      if (!insideDiamond(bx, by)) continue;
      const bladeLen = 2 + rand() * 4;
      const lean = (rand() - 0.5) * 3;
      const tipX = bx + lean;
      const tipY = by - bladeLen;
      if (!insideDiamond(tipX, tipY)) continue;
      g.lineStyle(1, bladeColors[Math.floor(rand() * bladeColors.length)], 0.55 + rand() * 0.4);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(tipX, tipY);
      g.strokePath();
    }

    for (let i = 0; i < 22; i++) {
      const bx = rand() * TEX_W, by = rand() * TEX_H;
      if (!insideDiamond(bx, by)) continue;
      const len = 1.5 + rand() * 2.5;
      const tipX = bx + (rand() - 0.5) * 1.5;
      const tipY = by - len;
      if (!insideDiamond(tipX, tipY)) continue;
      g.lineStyle(1, 0x90e080, 0.3 + rand() * 0.3);
      g.beginPath(); g.moveTo(bx, by); g.lineTo(tipX, tipY); g.strokePath();
    }

    for (let i = 0; i < 4; i++) {
      const cx2 = rand() * TEX_W, cy2 = rand() * TEX_H;
      if (!insideDiamond(cx2, cy2)) continue;
      for (let j = 0; j < 3; j++) {
        const angle = (j / 3) * Math.PI * 2 + rand() * 0.5;
        const dx = Math.cos(angle) * 1.5;
        const dy = Math.sin(angle) * 1.5;
        g.fillStyle(0x60b850, 0.4 + rand() * 0.2);
        g.fillCircle(cx2 + dx, cy2 + dy, 1);
      }
    }

    for (let i = 0; i < 5; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      const flowerColors = [0xffdd44, 0xee88bb, 0xff9955, 0xffee66, 0xffaadd];
      g.fillStyle(flowerColors[Math.floor(rand() * flowerColors.length)], 0.5 + rand() * 0.4);
      g.fillPoint(px, py, 1 + rand() * 0.5);
    }

    for (let i = 0; i < 10; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x6a5a3a, 0.2 + rand() * 0.2);
      g.fillPoint(px, py, 0.8 + rand() * 0.5);
    }

    for (let i = 0; i < 8; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0xddffcc, 0.25 + rand() * 0.2);
      g.fillPoint(px, py, 0.6);
    }
  });
}

function genStoneTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    // Dark dungeon stone floor
    drawDiamond(g, 0x252320, 0x181614);
    const rand = seededRandom(seed);
    const cx = TEX_W / 2;
    const cy = TEX_H / 2;

    // Stone block seam lines (isometric grid pattern)
    g.lineStyle(1, 0x141210, 0.7);
    for (let row = -3; row <= 3; row++) {
      const baseY = cy + row * 7;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 2; dx < TILE_WIDTH / 2 - 2; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH;
        if (!insideDiamond(px, py)) { started = false; continue; }
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }

    // Darker crack lines
    for (let i = 0; i < 5; i++) {
      const x1 = rand() * TEX_W, y1 = rand() * TEX_H;
      if (!insideDiamond(x1, y1)) continue;
      const x2 = x1 + (rand() - 0.5) * 10, y2 = y1 + (rand() - 0.5) * 6;
      if (!insideDiamond(x2, y2)) continue;
      g.lineStyle(1, 0x0e0c0a, 0.8);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }

    // Subtle stone color variation with more contrast
    const stoneColors = [0x2e2c28, 0x323028, 0x1e1c18, 0x3a3832, 0x28261e, 0x454239];
    for (let i = 0; i < 60; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(stoneColors[Math.floor(rand() * stoneColors.length)], 0.5 + rand() * 0.5);
      g.fillPoint(px, py, 1.2 + rand() * 0.7);
    }

    // Mineral glints and highlights
    for (let i = 0; i < 10; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x5a5850, 0.4 + rand() * 0.3);
      g.fillPoint(px, py, 1);
    }

    // Dark shadow crevices
    for (let i = 0; i < 6; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x0a0805, 0.6);
      g.fillPoint(px, py, 1.5);
    }

    // Occasional damp puddle — subtle dark wet patch
    if (rand() > 0.6) {
      const px = cx + (rand() - 0.5) * TILE_WIDTH * 0.4;
      const py = cy + (rand() - 0.5) * TILE_HEIGHT * 0.3;
      if (insideDiamond(px, py)) {
        g.fillStyle(0x1a2030, 0.2 + rand() * 0.1);
        g.fillEllipse(px, py, 4 + rand() * 3, 2 + rand() * 1.5);
        // Wet highlight
        g.fillStyle(0x4a5a70, 0.15);
        g.fillPoint(px - 1, py - 0.5, 0.8);
      }
    }

    // Moss specks in cracks between stones
    for (let i = 0; i < 4; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x2a4a28, 0.25 + rand() * 0.2);
      g.fillPoint(px, py, 0.8 + rand() * 0.5);
    }
  });
}

function genWaterTile(scene: Phaser.Scene, key: string, seed: number, baseColor: number, strokeColor: number, waveColor: number, phase = 0) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, baseColor, strokeColor);
    const cx = TEX_W / 2, cy = TEX_H / 2;
    // Isometric wave ripples
    for (let row = -3; row <= 3; row++) {
      const baseY = cy + row * 5;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 4; dx < TILE_WIDTH / 2 - 4; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH + Math.sin(dx * 0.4 + seed + phase) * 1.2;
        if (!insideDiamond(px, py)) { started = false; continue; }
        g.lineStyle(1, waveColor, 0.35 + Math.abs(Math.sin(dx * 0.3)) * 0.2);
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }
    const rand = seededRandom(seed);
    // Bright reflection specks
    for (let i = 0; i < 12; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0xc0e8ff, 0.25 + rand() * 0.3);
      g.fillPoint(px, py, 0.8);
    }
  });
}

function genDirtTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    // Dark damp earth
    drawDiamond(g, 0x3a2e22, 0x281e14);
    const rand = seededRandom(seed);
    const browns = [0x4a3a28, 0x352818, 0x503e2a, 0x2a2016, 0x453422];
    for (let i = 0; i < 45; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(browns[Math.floor(rand() * browns.length)], 0.45 + rand() * 0.5);
      g.fillPoint(px, py, 1 + rand() * 0.8);
    }
    // Small pebbles
    for (let i = 0; i < 8; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x504238, 0.5);
      g.fillCircle(px, py, 1.2);
    }
  });
}

function genLavaTile(scene: Phaser.Scene, key: string, phase = 0) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    // Dark crust base
    drawDiamond(g, 0x3a1200, 0x280a00);
    const rand = seededRandom(666);
    const cx = TEX_W / 2, cy = TEX_H / 2;

    // Lava flow lines
    for (let row = -2; row <= 2; row++) {
      const baseY = cy + row * 6;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 6; dx < TILE_WIDTH / 2 - 6; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH + Math.sin(dx * 0.3 + row + phase) * 2;
        if (!insideDiamond(px, py)) { started = false; continue; }
        g.lineStyle(1, 0xcc3300, 0.5 + Math.abs(Math.sin(dx * 0.2)) * 0.4);
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }

    // Bright molten hotspots
    for (let i = 0; i < 18; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      const bright = rand() > 0.6;
      const color = bright ? 0xffaa00 : (rand() > 0.5 ? 0xff6600 : 0xff3300);
      g.fillStyle(color, 0.5 + rand() * 0.5);
      g.fillCircle(px, py, bright ? 1.5 + rand() * 1.5 : 0.8 + rand() * 1.2);
    }
  });
}

// ─── World map ground tiles ───

function genSandTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0xe8d090, 0xd0b870);
    const rand = seededRandom(seed);
    const sandColors = [0xe0c878, 0xf0d898, 0xd8c068, 0xf4e0a0, 0xccb458];
    for (let i = 0; i < 60; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(sandColors[Math.floor(rand() * sandColors.length)], 0.4 + rand() * 0.5);
      g.fillPoint(px, py, 0.8 + rand() * 0.8);
    }
    // Shell / pebble spots
    for (let i = 0; i < 4; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x8a7a5a, 0.5 + rand() * 0.3);
      g.fillCircle(px, py, 1 + rand() * 0.5);
    }
  });
}

function genMountainTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x5a5550, 0x3e3a36);
    const rand = seededRandom(seed);
    const rockColors = [0x4a4540, 0x64605a, 0x3a3530, 0x524e48, 0x2e2a26];
    for (let i = 0; i < 50; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(rockColors[Math.floor(rand() * rockColors.length)], 0.5 + rand() * 0.5);
      g.fillPoint(px, py, 1 + rand() * 1.2);
    }
    // Crack lines
    for (let i = 0; i < 6; i++) {
      const x1 = rand() * TEX_W, y1 = rand() * TEX_H;
      if (!insideDiamond(x1, y1)) continue;
      const x2 = x1 + (rand() - 0.5) * 12, y2 = y1 + (rand() - 0.5) * 8;
      if (!insideDiamond(x2, y2)) continue;
      g.lineStyle(1, 0x2a2622, 0.7);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
    // Snow highlights on upper portion
    for (let i = 0; i < 10; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H * 0.5;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0xe8e4e0, 0.3 + rand() * 0.3);
      g.fillPoint(px, py, 1 + rand());
    }
  });
}

function genMountainPathTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x7a7068, 0x5e5650);
    const rand = seededRandom(seed);
    const pathColors = [0x6a6058, 0x8a8078, 0x5a5048, 0x746a62];
    for (let i = 0; i < 40; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(pathColors[Math.floor(rand() * pathColors.length)], 0.4 + rand() * 0.5);
      g.fillPoint(px, py, 0.8 + rand() * 0.8);
    }
    // Small gravel
    for (let i = 0; i < 12; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x504840, 0.5 + rand() * 0.3);
      g.fillCircle(px, py, 0.8 + rand() * 0.6);
    }
  });
}

function genTownRoadTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x9a9088, 0x807868);
    const rand = seededRandom(seed);
    const cx = TEX_W / 2, cy = TEX_H / 2;

    g.lineStyle(1, 0x706860, 0.7);
    for (let row = -3; row <= 3; row++) {
      const baseY = cy + row * 6;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 2; dx < TILE_WIDTH / 2 - 2; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH;
        if (!insideDiamond(px, py)) { started = false; continue; }
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }
    // Cross seams
    for (let col = -3; col <= 3; col++) {
      const baseX = cx + col * 8;
      let started = false;
      for (let dy = -TILE_HEIGHT / 2 + 2; dy < TILE_HEIGHT / 2 - 2; dy += 1) {
        const px = baseX + (dy * TILE_WIDTH) / TILE_HEIGHT;
        const py = cy + dy;
        if (!insideDiamond(px, py)) { started = false; continue; }
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }
    const colors = [0xa09888, 0x908070, 0xb0a898, 0x888070];
    for (let i = 0; i < 30; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(colors[Math.floor(rand() * colors.length)], 0.3 + rand() * 0.4);
      g.fillPoint(px, py, 1 + rand() * 0.5);
    }
  });
}

function genVillageDirtTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x3a2e22, 0x281e14);
    const rand = seededRandom(seed);
    const cx = TEX_W / 2, cy = TEX_H / 2;
    const browns = [0x4a3a28, 0x352818, 0x503e2a, 0x2a2016, 0x453422];
    for (let i = 0; i < 40; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(browns[Math.floor(rand() * browns.length)], 0.45 + rand() * 0.5);
      g.fillPoint(px, py, 1 + rand() * 0.8);
    }
    // Cart rut lines
    g.lineStyle(1, 0x28200e, 0.6);
    for (const offset of [-3, 3]) {
      const baseY = cy + offset;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 4; dx < TILE_WIDTH / 2 - 4; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH + Math.sin(dx * 0.2) * 0.5;
        if (!insideDiamond(px, py)) { started = false; continue; }
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }
    // Grass tufts in cracks
    for (let i = 0; i < 6; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x4a7050, 0.5 + rand() * 0.3);
      g.fillPoint(px, py, 1);
      g.fillPoint(px + 1, py - 1, 0.8);
    }
  });
}

function genFarmlandTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x3e2e1a, 0x2a1e10);
    const rand = seededRandom(seed);
    const cx = TEX_W / 2, cy = TEX_H / 2;

    // Plow furrow lines
    g.lineStyle(1, 0x2a1e0e, 0.7);
    for (let row = -4; row <= 4; row++) {
      const baseY = cy + row * 4;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 3; dx < TILE_WIDTH / 2 - 3; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH;
        if (!insideDiamond(px, py)) { started = false; continue; }
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }
    // Small green plant dots
    for (let i = 0; i < 8; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0x4a8a40, 0.5 + rand() * 0.3);
      g.fillPoint(px, py, 1 + rand() * 0.5);
    }
    // Soil variation
    const soilColors = [0x4a3620, 0x352414, 0x503c24, 0x3a2a16];
    for (let i = 0; i < 30; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(soilColors[Math.floor(rand() * soilColors.length)], 0.3 + rand() * 0.4);
      g.fillPoint(px, py, 0.8 + rand() * 0.6);
    }
  });
}

function genManorFloorTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x8a8480, 0x6e6a66);
    const rand = seededRandom(seed);
    const cx = TEX_W / 2, cy = TEX_H / 2;

    // Elegant slab seams
    g.lineStyle(1, 0x605c58, 0.6);
    for (let row = -2; row <= 2; row++) {
      const baseY = cy + row * 8;
      let started = false;
      for (let dx = -TILE_WIDTH / 2 + 2; dx < TILE_WIDTH / 2 - 2; dx += 1) {
        const px = cx + dx;
        const py = baseY + (dx * TILE_HEIGHT) / TILE_WIDTH;
        if (!insideDiamond(px, py)) { started = false; continue; }
        if (!started) { g.beginPath(); g.moveTo(px, py); started = true; }
        else g.lineTo(px, py);
      }
      if (started) g.strokePath();
    }
    // Smooth stone variation
    const stoneColors = [0x908a86, 0x7a7672, 0x9a9490, 0x84807c];
    for (let i = 0; i < 25; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(stoneColors[Math.floor(rand() * stoneColors.length)], 0.25 + rand() * 0.3);
      g.fillPoint(px, py, 1 + rand() * 0.5);
    }
    // Polished highlights
    for (let i = 0; i < 6; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(0xb0aaa6, 0.2 + rand() * 0.2);
      g.fillPoint(px, py, 1.2);
    }
  });
}

function genManorGardenTile(scene: Phaser.Scene, key: string, seed: number) {
  generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
    drawDiamond(g, 0x5a9a60, 0x4a8a50);
    const rand = seededRandom(seed);
    // Neat lawn texture
    const greens = [0x58a058, 0x68b068, 0x4e9050, 0x70b870, 0x60a860];
    for (let i = 0; i < 50; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(greens[Math.floor(rand() * greens.length)], 0.4 + rand() * 0.4);
      g.fillPoint(px, py, 0.8 + rand() * 0.8);
    }
    // Small flower dots
    const flowerColors = [0xff6688, 0xffaa44, 0xeedd44, 0xcc66ff, 0xff4466];
    for (let i = 0; i < 5; i++) {
      const px = rand() * TEX_W, py = rand() * TEX_H;
      if (!insideDiamond(px, py)) continue;
      g.fillStyle(flowerColors[Math.floor(rand() * flowerColors.length)], 0.6 + rand() * 0.3);
      g.fillCircle(px, py, 1);
    }
  });
}

// ─── Wall texture (isometric block - taller than ground tile) ───

function genWallTile(scene: Phaser.Scene, key: string, seed: number) {
  const wallW = 48;
  const wallH = 64;
  generateAndSave(scene, key, wallW, wallH, (g) => {
    const rand = seededRandom(seed);

    g.fillStyle(0x9a9488, 1);
    g.beginPath();
    g.moveTo(24, 8); g.lineTo(44, 18); g.lineTo(24, 28); g.lineTo(4, 18);
    g.closePath(); g.fillPath();

    g.lineStyle(1, 0x807a70, 0.5);
    g.beginPath(); g.moveTo(14, 13); g.lineTo(34, 23); g.strokePath();
    g.beginPath(); g.moveTo(14, 18); g.lineTo(24, 13); g.strokePath();

    g.fillStyle(0x787068, 1);
    g.beginPath();
    g.moveTo(4, 18); g.lineTo(24, 28); g.lineTo(24, 56); g.lineTo(4, 46);
    g.closePath(); g.fillPath();

    g.fillStyle(0x605850, 1);
    g.beginPath();
    g.moveTo(24, 28); g.lineTo(44, 18); g.lineTo(44, 46); g.lineTo(24, 56);
    g.closePath(); g.fillPath();

    // Brick courses on left face
    g.lineStyle(1, 0x161310, 0.9);
    for (let row = 0; row < 4; row++) {
      const y = 29 + row * 7;
      if (y < 56) {
        g.beginPath(); g.moveTo(4, y); g.lineTo(24, y + 10); g.strokePath();
      }
    }
    // Vertical brick seams on left face (alternating offsets)
    for (let row = 0; row < 3; row++) {
      const seam = row % 2 === 0 ? 12 : 7;
      const y = 32 + row * 7;
      if (y < 52) {
        g.beginPath(); g.moveTo(4 + seam * 0.45, y); g.lineTo(4 + seam * 0.45, y + 6); g.strokePath();
      }
    }

    // Brick courses on right face
    for (let row = 0; row < 4; row++) {
      const y = 29 + row * 7;
      if (y < 56) {
        g.beginPath(); g.moveTo(44, y); g.lineTo(24, y + 10); g.strokePath();
      }
    }
    // Vertical brick seams on right face
    for (let row = 0; row < 3; row++) {
      const seam = row % 2 === 0 ? 14 : 8;
      const y = 32 + row * 7;
      if (y < 52) {
        const sx = 44 - seam * 0.45;
        g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + 6); g.strokePath();
      }
    }

    // Top edge rim highlight (moonlight effect)
    g.lineStyle(1, 0x6a6058, 0.9);
    g.beginPath();
    g.moveTo(4, 18); g.lineTo(24, 8); g.lineTo(44, 18);
    g.strokePath();

    // Stone cracks — jagged multi-segment
    for (let i = 0; i < 3; i++) {
      const x1 = 5 + rand() * 38, y1 = 20 + rand() * 28;
      g.lineStyle(1, 0x100e0c, 0.6 + rand() * 0.2);
      g.beginPath(); g.moveTo(x1, y1);
      const mid1x = x1 + (rand() - 0.5) * 4, mid1y = y1 + rand() * 3;
      g.lineTo(mid1x, mid1y);
      g.lineTo(mid1x + (rand() - 0.5) * 4, mid1y + rand() * 4);
      g.strokePath();
    }

    // Water stain drips — dark vertical streaks running down faces
    for (let i = 0; i < 2; i++) {
      const isLeft = rand() > 0.5;
      const startY = 22 + rand() * 10;
      const dripLen = 8 + rand() * 12;
      const baseX = isLeft ? (6 + rand() * 12) : (26 + rand() * 14);
      g.lineStyle(1, 0x1a1816, 0.25 + rand() * 0.15);
      g.beginPath(); g.moveTo(baseX, startY);
      g.lineTo(baseX + (rand() - 0.5) * 2, startY + dripLen);
      g.strokePath();
    }

    // Moss at wall base — green patches clinging to lower bricks
    const mossColors = [0x2a4a28, 0x1e3a1c, 0x345030, 0x284622];
    for (let i = 0; i < 8; i++) {
      const isLeft = rand() > 0.5;
      let mx: number, my: number;
      if (isLeft) {
        mx = 5 + rand() * 16;
        my = 40 + rand() * 10;
      } else {
        mx = 26 + rand() * 16;
        my = 38 + rand() * 12;
      }
      g.fillStyle(mossColors[Math.floor(rand() * mossColors.length)], 0.35 + rand() * 0.25);
      g.fillCircle(mx, my, 1 + rand() * 1.5);
    }

    // Subtle stone color variation on faces
    const stoneColors = [0x322e2a, 0x252220, 0x3a3530, 0x1c1a18];
    for (let i = 0; i < 25; i++) {
      const x = 5 + rand() * 38, y = 20 + rand() * 32;
      g.fillStyle(stoneColors[Math.floor(rand() * stoneColors.length)], 0.25 + rand() * 0.15);
      g.fillPoint(x, y, 1 + rand() * 0.5);
    }

    // Dark outline
    g.lineStyle(1, 0x0c0a08, 1);
    g.strokePoints([
      { x: 24, y: 8 }, { x: 44, y: 18 }, { x: 44, y: 46 },
      { x: 24, y: 56 }, { x: 4, y: 46 }, { x: 4, y: 18 }, { x: 24, y: 8 },
    ], true);
  });
}

// ─── Obstacles ───

function genRockObstacle(scene: Phaser.Scene) {
  // Only generate if DCSS boulder wasn't preloaded
  generateAndSave(scene, 'obstacle-rock', 32, 40, (g) => {
    // Dungeon rock — dark with chipped edges
    g.fillStyle(0x5a5450, 1);
    g.beginPath(); g.moveTo(16, 4); g.lineTo(28, 10); g.lineTo(16, 16); g.lineTo(4, 10); g.closePath(); g.fillPath();
    g.fillStyle(0x3e3a36, 1);
    g.beginPath(); g.moveTo(4, 10); g.lineTo(16, 16); g.lineTo(16, 34); g.lineTo(4, 28); g.closePath(); g.fillPath();
    g.fillStyle(0x2c2824, 1);
    g.beginPath(); g.moveTo(16, 16); g.lineTo(28, 10); g.lineTo(28, 28); g.lineTo(16, 34); g.closePath(); g.fillPath();
    // Highlight on top edge
    g.lineStyle(1, 0x6e6a64, 0.8);
    g.beginPath(); g.moveTo(4, 10); g.lineTo(16, 4); g.lineTo(28, 10); g.strokePath();
    g.lineStyle(1, 0x1c1816, 0.9);
    g.strokePoints([{ x: 16, y: 4 }, { x: 28, y: 10 }, { x: 28, y: 28 }, { x: 16, y: 34 }, { x: 4, y: 28 }, { x: 4, y: 10 }, { x: 16, y: 4 }], true);
  });
}

function genTreeObstacle(scene: Phaser.Scene) {
  generateAndSave(scene, 'obstacle-tree', 32, 48, (g) => {
    g.fillStyle(0x6b4226, 1);
    g.fillRect(13, 28, 6, 18);
    g.lineStyle(1, 0x5a3418, 0.8);
    g.beginPath(); g.moveTo(13, 44); g.lineTo(8, 48); g.strokePath();
    g.beginPath(); g.moveTo(19, 44); g.lineTo(24, 48); g.strokePath();
    g.fillStyle(0x3a8a30, 1);
    g.beginPath(); g.moveTo(16, 2); g.lineTo(30, 18); g.lineTo(16, 30); g.lineTo(2, 18); g.closePath(); g.fillPath();
    g.fillStyle(0x50a848, 0.9);
    g.beginPath(); g.moveTo(16, 6); g.lineTo(24, 17); g.lineTo(16, 25); g.lineTo(8, 17); g.closePath(); g.fillPath();
    const rand = seededRandom(55);
    const leafColors = [0x3a9a30, 0x4aaa40, 0x2e8828, 0x58b850];
    for (let i = 0; i < 16; i++) {
      const px = 5 + rand() * 22, py = 6 + rand() * 20;
      g.fillStyle(leafColors[Math.floor(rand() * leafColors.length)], 0.5 + rand() * 0.4);
      g.fillCircle(px, py, 1.5 + rand() * 1.5);
    }
    for (let i = 0; i < 6; i++) {
      const px = 8 + rand() * 16, py = 8 + rand() * 16;
      g.fillStyle(0x70cc60, 0.4);
      g.fillCircle(px, py, 1);
    }
  });
}

// ─── Decorations ───

function genTorchFrame(scene: Phaser.Scene, key: string, frame: number) {
  generateAndSave(scene, key, 16, 32, (g) => {
    // Wooden handle
    g.fillStyle(0x6b4226, 1);
    g.fillRect(6, 10, 4, 20);
    // Metal bracket
    g.fillStyle(0x888888, 1);
    g.fillRect(5, 8, 6, 3);

    // Animated flame — shape varies per frame
    const flicker = [0, 1, 2, 1][frame];
    const flameH = 8 + flicker;
    const flameW = 4 + (frame % 2);
    const baseY = 8;

    // Outer glow
    g.fillStyle(0xff6600, 0.18);
    g.fillCircle(8, baseY - flameH / 2, 7 + flicker);
    // Flame body (teardrop shape via overlapping ellipses)
    g.fillStyle(0xff6600, 0.9);
    g.fillEllipse(8 + (frame === 1 ? 1 : frame === 3 ? -1 : 0), baseY - flameH / 2, flameW * 2, flameH);
    // Mid flame
    g.fillStyle(0xff8800, 0.9);
    g.fillEllipse(8, baseY - flameH / 2 - 1, flameW * 1.4, flameH * 0.7);
    // Inner bright core
    g.fillStyle(0xffcc00, 0.85);
    g.fillEllipse(8, baseY - flameH / 2, flameW, flameH * 0.45);
    // White-hot tip
    g.fillStyle(0xffeedd, 0.6);
    g.fillCircle(8, baseY - flameH + 2, 1.5);
  });
}

function genTorch(scene: Phaser.Scene) {
  // Static fallback
  genTorchFrame(scene, 'deco-torch', 0);
  // Animation frames
  for (let f = 0; f < 4; f++) {
    genTorchFrame(scene, `deco-torch-f${f}`, f);
  }
}

function genChest(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-chest', 20, 18, (g) => {
    g.fillStyle(0x8b6914, 1);
    g.fillRect(2, 6, 16, 10);
    g.fillStyle(0xa07818, 1);
    g.fillRect(2, 4, 16, 4);
    g.fillStyle(0xcccccc, 1);
    g.fillRect(2, 8, 16, 1);
    g.fillRect(9, 4, 2, 12);
    g.fillStyle(0xffcc00, 1);
    g.fillRect(9, 7, 2, 3);
    g.lineStyle(1, 0x5a3a0a, 0.8);
    g.strokeRect(2, 4, 16, 12);
  });
}

function genTable(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-table', 24, 20, (g) => {
    g.fillStyle(0x8b6c42, 1);
    g.beginPath();
    g.moveTo(12, 2); g.lineTo(22, 7); g.lineTo(12, 12); g.lineTo(2, 7);
    g.closePath(); g.fillPath();
    g.fillStyle(0x6b4c22, 1);
    g.fillRect(3, 7, 2, 12);
    g.fillRect(19, 7, 2, 12);
    g.fillRect(11, 12, 2, 8);
    g.lineStyle(1, 0x4a3a1a, 0.6);
    g.strokePoints([{ x: 12, y: 2 }, { x: 22, y: 7 }, { x: 12, y: 12 }, { x: 2, y: 7 }, { x: 12, y: 2 }], true);
  });
}

function genBarrel(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-barrel', 18, 22, (g) => {
    g.fillStyle(0x8b5a2b, 1);
    g.fillEllipse(9, 12, 14, 18);
    g.lineStyle(2, 0x888888, 0.8);
    g.beginPath(); g.arc(9, 8, 6, 0, Math.PI, true); g.strokePath();
    g.beginPath(); g.arc(9, 16, 6, 0, Math.PI, true); g.strokePath();
    g.fillStyle(0x6b3a1b, 1);
    g.fillEllipse(9, 4, 12, 5);
    g.lineStyle(1, 0x4a2a0b, 0.6);
    g.strokeEllipse(9, 12, 14, 18);
  });
}

function genBones(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-bones', 18, 14, (g) => {
    // Crossed bones — aged yellow-ivory
    g.lineStyle(2, 0xc8c098, 1);
    g.beginPath(); g.moveTo(2, 2); g.lineTo(16, 12); g.strokePath();
    g.beginPath(); g.moveTo(16, 2); g.lineTo(2, 12); g.strokePath();
    g.fillStyle(0xd8d0a8, 1);
    g.fillCircle(2, 2, 2.5); g.fillCircle(16, 2, 2.5);
    g.fillCircle(2, 12, 2.5); g.fillCircle(16, 12, 2.5);
    // Center skull hint
    g.fillStyle(0xe0d8b0, 1);
    g.fillCircle(9, 7, 3.5);
    g.fillStyle(0x1a1208, 1);
    g.fillCircle(7.5, 6.5, 1); g.fillCircle(10.5, 6.5, 1);
    // Jaw hint
    g.lineStyle(1, 0x1a1208, 0.7);
    g.beginPath(); g.moveTo(7, 9); g.lineTo(11, 9); g.strokePath();
  });
}

function genPillar(scene: Phaser.Scene) {
  // Only generate if DCSS zot_pillar wasn't preloaded
  generateAndSave(scene, 'deco-pillar', 20, 44, (g) => {
    // Dark dungeon pillar
    g.fillStyle(0x302e2a, 1);
    g.beginPath();
    g.moveTo(10, 36); g.lineTo(18, 40); g.lineTo(10, 44); g.lineTo(2, 40);
    g.closePath(); g.fillPath();
    // Shaft — slightly lighter front face
    g.fillStyle(0x3e3a34, 1);
    g.fillRect(7, 8, 6, 30);
    // Shadow side
    g.fillStyle(0x28261e, 1);
    g.fillRect(13, 8, 3, 30);
    // Capital (top block)
    g.fillStyle(0x48443e, 1);
    g.fillRect(4, 4, 12, 5);
    // Capital shadow
    g.fillStyle(0x302e28, 1);
    g.fillRect(4, 8, 12, 2);
    // Edge highlight on capital
    g.lineStyle(1, 0x5a5650, 0.8);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(16, 4); g.strokePath();
    // Carved groove lines
    g.lineStyle(1, 0x201e18, 0.6);
    g.beginPath(); g.moveTo(9, 14); g.lineTo(9, 28); g.strokePath();
    g.beginPath(); g.moveTo(13, 12); g.lineTo(13, 30); g.strokePath();
    g.lineStyle(1, 0x1a1814, 0.8);
    g.strokeRect(7, 8, 9, 30);
  });
}

// ─── World map decorations ───

function genHouse(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-house', 48, 64, (g) => {
    g.fillStyle(0xcc4422, 1);
    g.beginPath();
    g.moveTo(24, 4); g.lineTo(44, 14); g.lineTo(24, 24); g.lineTo(4, 14);
    g.closePath(); g.fillPath();
    g.fillStyle(0xaa3818, 1);
    g.beginPath();
    g.moveTo(14, 9); g.lineTo(34, 19); g.lineTo(24, 24); g.lineTo(4, 14);
    g.closePath(); g.fillPath();
    g.fillStyle(0xf0e4cc, 1);
    g.beginPath();
    g.moveTo(4, 14); g.lineTo(24, 24); g.lineTo(24, 52); g.lineTo(4, 42);
    g.closePath(); g.fillPath();
    g.fillStyle(0xd8c8a8, 1);
    g.beginPath();
    g.moveTo(24, 24); g.lineTo(44, 14); g.lineTo(44, 42); g.lineTo(24, 52);
    g.closePath(); g.fillPath();
    g.fillStyle(0x6b4226, 1);
    g.fillRect(30, 36, 6, 14);
    g.fillStyle(0xd4a840, 1);
    g.fillRect(34, 42, 1, 2);
    g.fillStyle(0x88ccee, 0.8);
    g.fillRect(10, 24, 6, 5);
    g.fillStyle(0x6b4226, 1);
    g.fillRect(12, 24, 1, 5);
    g.fillRect(10, 26, 6, 1);
    g.fillStyle(0xffcc44, 0.3);
    g.fillRect(10, 24, 6, 5);
    g.lineStyle(1, 0x5a3a1a, 0.8);
    g.strokePoints([
      { x: 24, y: 4 }, { x: 44, y: 14 }, { x: 44, y: 42 },
      { x: 24, y: 52 }, { x: 4, y: 42 }, { x: 4, y: 14 }, { x: 24, y: 4 },
    ], true);
  });
}

function genShop(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-shop', 48, 64, (g) => {
    g.fillStyle(0xb85028, 1);
    g.beginPath();
    g.moveTo(24, 4); g.lineTo(44, 14); g.lineTo(24, 24); g.lineTo(4, 14);
    g.closePath(); g.fillPath();
    g.fillStyle(0xe8d8b0, 1);
    g.beginPath();
    g.moveTo(4, 14); g.lineTo(24, 24); g.lineTo(24, 52); g.lineTo(4, 42);
    g.closePath(); g.fillPath();
    g.fillStyle(0xccb890, 1);
    g.beginPath();
    g.moveTo(24, 24); g.lineTo(44, 14); g.lineTo(44, 42); g.lineTo(24, 52);
    g.closePath(); g.fillPath();
    g.fillStyle(0x7a5020, 1);
    g.fillRect(28, 20, 12, 6);
    g.fillStyle(0xffcc00, 0.9);
    g.fillCircle(34, 23, 2);
    g.fillStyle(0x5a3a10, 1);
    g.fillRect(10, 30, 6, 12);
    g.fillStyle(0xd4a840, 1);
    g.fillRect(14, 36, 1, 2);
    g.fillStyle(0x88ccee, 0.8);
    g.fillRect(30, 30, 5, 4);
    g.lineStyle(1, 0x5a3a1a, 0.8);
    g.strokePoints([
      { x: 24, y: 4 }, { x: 44, y: 14 }, { x: 44, y: 42 },
      { x: 24, y: 52 }, { x: 4, y: 42 }, { x: 4, y: 14 }, { x: 24, y: 4 },
    ], true);
  });
}

function genFence(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-fence', 32, 24, (g) => {
    const postColor = 0x6a5030;
    const railColor = 0x8a7050;
    // Posts
    g.fillStyle(postColor, 1);
    g.fillRect(4, 4, 3, 16);
    g.fillRect(14, 8, 3, 14);
    g.fillRect(25, 4, 3, 16);
    // Rails
    g.fillStyle(railColor, 1);
    g.fillRect(4, 6, 24, 2);
    g.fillRect(4, 14, 24, 2);
    // Post caps
    g.fillStyle(0x9a8060, 1);
    g.fillRect(3, 2, 5, 3);
    g.fillRect(24, 2, 5, 3);
    // Outline
    g.lineStyle(1, 0x4a3020, 0.6);
    g.strokeRect(4, 4, 3, 16);
    g.strokeRect(25, 4, 3, 16);
  });
}

function genCabin(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-cabin', 40, 52, (g) => {
    // Log cabin — smaller than house
    // Roof
    g.fillStyle(0x5a4020, 1);
    g.beginPath();
    g.moveTo(20, 4); g.lineTo(36, 12); g.lineTo(20, 20); g.lineTo(4, 12);
    g.closePath(); g.fillPath();
    // Left wall — logs
    g.fillStyle(0x6a4a28, 1);
    g.beginPath();
    g.moveTo(4, 12); g.lineTo(20, 20); g.lineTo(20, 42); g.lineTo(4, 34);
    g.closePath(); g.fillPath();
    // Log lines
    g.lineStyle(1, 0x4a3018, 0.7);
    for (let i = 0; i < 4; i++) {
      const y = 22 + i * 5;
      g.beginPath(); g.moveTo(4, y); g.lineTo(20, y + 8); g.strokePath();
    }
    // Right wall
    g.fillStyle(0x5a3a18, 1);
    g.beginPath();
    g.moveTo(20, 20); g.lineTo(36, 12); g.lineTo(36, 34); g.lineTo(20, 42);
    g.closePath(); g.fillPath();
    // Small window
    g.fillStyle(0x88aacc, 0.6);
    g.fillRect(8, 22, 4, 3);
    // Outline
    g.lineStyle(1, 0x3a2010, 0.8);
    g.strokePoints([
      { x: 20, y: 4 }, { x: 36, y: 12 }, { x: 36, y: 34 },
      { x: 20, y: 42 }, { x: 4, y: 34 }, { x: 4, y: 12 }, { x: 20, y: 4 },
    ], true);
  });
}

function genManorWall(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-manor-wall', 48, 40, (g) => {
    // Top face
    g.fillStyle(0x908880, 1);
    g.beginPath();
    g.moveTo(24, 4); g.lineTo(44, 12); g.lineTo(24, 20); g.lineTo(4, 12);
    g.closePath(); g.fillPath();
    // Left face
    g.fillStyle(0x7a7268, 1);
    g.beginPath();
    g.moveTo(4, 12); g.lineTo(24, 20); g.lineTo(24, 36); g.lineTo(4, 28);
    g.closePath(); g.fillPath();
    // Right face
    g.fillStyle(0x5a5448, 1);
    g.beginPath();
    g.moveTo(24, 20); g.lineTo(44, 12); g.lineTo(44, 28); g.lineTo(24, 36);
    g.closePath(); g.fillPath();
    // Top edge highlight
    g.lineStyle(1, 0xa8a098, 0.8);
    g.beginPath(); g.moveTo(4, 12); g.lineTo(24, 4); g.lineTo(44, 12); g.strokePath();
    // Outline
    g.lineStyle(1, 0x4a4438, 0.8);
    g.strokePoints([
      { x: 24, y: 4 }, { x: 44, y: 12 }, { x: 44, y: 28 },
      { x: 24, y: 36 }, { x: 4, y: 28 }, { x: 4, y: 12 }, { x: 24, y: 4 },
    ], true);
  });
}

function genManorBuilding(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-manor-building', 64, 80, (g) => {
    // Large manor building
    // Roof
    g.fillStyle(0x6a3020, 1);
    g.beginPath();
    g.moveTo(32, 4); g.lineTo(58, 18); g.lineTo(32, 32); g.lineTo(6, 18);
    g.closePath(); g.fillPath();
    // Left wall
    g.fillStyle(0xc8b898, 1);
    g.beginPath();
    g.moveTo(6, 18); g.lineTo(32, 32); g.lineTo(32, 68); g.lineTo(6, 54);
    g.closePath(); g.fillPath();
    // Right wall
    g.fillStyle(0xa89878, 1);
    g.beginPath();
    g.moveTo(32, 32); g.lineTo(58, 18); g.lineTo(58, 54); g.lineTo(32, 68);
    g.closePath(); g.fillPath();
    // Windows on left wall
    g.fillStyle(0x88bbdd, 0.7);
    for (let i = 0; i < 2; i++) {
      g.fillRect(12 + i * 8, 34, 4, 5);
    }
    // Windows on right wall
    for (let i = 0; i < 2; i++) {
      g.fillRect(36 + i * 8, 30, 4, 5);
    }
    // Grand door
    g.fillStyle(0x4a2a0a, 1);
    g.fillRect(14, 46, 8, 12);
    g.fillStyle(0xffcc00, 0.8);
    g.fillCircle(20, 52, 1); // doorknob
    // Roof highlight
    g.lineStyle(1, 0x8a5030, 0.8);
    g.beginPath(); g.moveTo(6, 18); g.lineTo(32, 4); g.lineTo(58, 18); g.strokePath();
    // Outline
    g.lineStyle(1, 0x3a2a1a, 0.8);
    g.strokePoints([
      { x: 32, y: 4 }, { x: 58, y: 18 }, { x: 58, y: 54 },
      { x: 32, y: 68 }, { x: 6, y: 54 }, { x: 6, y: 18 }, { x: 32, y: 4 },
    ], true);
  });
}

function genFlower(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-flower', 16, 16, (g) => {
    const rand = seededRandom(77);
    const colors = [0xff6688, 0xffaa44, 0xeedd44, 0xcc66ff, 0xff4466, 0x66aaff];
    // Stems
    for (let i = 0; i < 4; i++) {
      const cx = 4 + rand() * 8, cy = 8 + rand() * 4;
      g.lineStyle(1, 0x3a7a3a, 0.8);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (rand() - 0.5) * 3, cy + 4 + rand() * 3); g.strokePath();
      // Flower head
      g.fillStyle(colors[Math.floor(rand() * colors.length)], 0.8 + rand() * 0.2);
      g.fillCircle(cx, cy, 1.5 + rand());
      // Center
      g.fillStyle(0xffee88, 0.8);
      g.fillCircle(cx, cy, 0.8);
    }
  });
}

function genBush(scene: Phaser.Scene) {
  generateAndSave(scene, 'deco-bush', 24, 20, (g) => {
    const rand = seededRandom(88);
    // Bush mass
    g.fillStyle(0x2a6030, 1);
    g.fillCircle(12, 12, 8);
    g.fillCircle(8, 10, 5);
    g.fillCircle(16, 10, 5);
    // Leaf detail
    const greens = [0x3a7840, 0x2a5830, 0x4a8850, 0x1e4a28];
    for (let i = 0; i < 20; i++) {
      const px = 4 + rand() * 16, py = 4 + rand() * 12;
      const dist = Math.sqrt((px - 12) ** 2 + (py - 10) ** 2);
      if (dist > 10) continue;
      g.fillStyle(greens[Math.floor(rand() * greens.length)], 0.5 + rand() * 0.4);
      g.fillCircle(px, py, 1 + rand() * 1.5);
    }
    // Highlight
    for (let i = 0; i < 4; i++) {
      const px = 6 + rand() * 12, py = 4 + rand() * 8;
      g.fillStyle(0x5aa860, 0.3);
      g.fillCircle(px, py, 1);
    }
  });
}

function genCityWall(scene: Phaser.Scene) {
  const wallW = 48;
  const wallH = 72;
  generateAndSave(scene, 'deco-city-wall', wallW, wallH, (g) => {
    const rand = seededRandom(500);
    g.fillStyle(0xb0a898, 1);
    g.beginPath();
    g.moveTo(24, 4); g.lineTo(44, 14); g.lineTo(24, 24); g.lineTo(4, 14);
    g.closePath(); g.fillPath();
    g.fillStyle(0x90887a, 1);
    g.beginPath();
    g.moveTo(4, 14); g.lineTo(24, 24); g.lineTo(24, 62); g.lineTo(4, 52);
    g.closePath(); g.fillPath();
    g.fillStyle(0x78706a, 1);
    g.beginPath();
    g.moveTo(24, 24); g.lineTo(44, 14); g.lineTo(44, 52); g.lineTo(24, 62);
    g.closePath(); g.fillPath();
    g.lineStyle(1, 0x685e54, 0.7);
    for (let row = 0; row < 5; row++) {
      const y = 26 + row * 7;
      g.beginPath(); g.moveTo(4, y); g.lineTo(24, y + 10); g.strokePath();
    }
    for (let row = 0; row < 5; row++) {
      const y = 26 + row * 7;
      g.beginPath(); g.moveTo(44, y); g.lineTo(24, y + 10); g.strokePath();
    }
    g.fillStyle(0xc0b8a8, 1);
    g.fillRect(8, 6, 4, 6);
    g.fillRect(20, 8, 4, 6);
    g.fillRect(34, 6, 4, 6);
    g.lineStyle(1, 0xc8c0b0, 0.8);
    g.beginPath(); g.moveTo(4, 14); g.lineTo(24, 4); g.lineTo(44, 14); g.strokePath();
    for (let i = 0; i < 20; i++) {
      const x = 5 + rand() * 38, y = 16 + rand() * 40;
      g.fillStyle(0xa09888, 0.3);
      g.fillPoint(x, y, 1);
    }
    g.lineStyle(1, 0x4a4438, 0.8);
    g.strokePoints([
      { x: 24, y: 4 }, { x: 44, y: 14 }, { x: 44, y: 52 },
      { x: 24, y: 62 }, { x: 4, y: 52 }, { x: 4, y: 14 }, { x: 24, y: 4 },
    ], true);
  });
}

// ─── Characters (multi-direction: down=front, up=back, side=profile) ───

function drawPlayerDown(g: Phaser.GameObjects.Graphics, legL: number, legR: number, armL: number, armR: number, sword: number) {
  g.fillStyle(0x8b5a2b, 1);
  g.fillRect(10 + legL, 36, 5, 8); g.fillRect(17 + legR, 36, 5, 8);
  g.fillStyle(0x5a6678, 1);
  g.fillRect(10 + Math.floor(legL * 0.5), 28, 5, 10);
  g.fillRect(17 + Math.floor(legR * 0.5), 28, 5, 10);
  g.fillStyle(0x4488cc, 1);
  g.fillRect(8, 14, 16, 16);
  g.fillStyle(0x3670b0, 1);
  g.fillRect(8, 14, 2, 16); g.fillRect(22, 14, 2, 16);
  g.fillStyle(0x8b6914, 1);
  g.fillRect(8, 27, 16, 3);
  g.fillStyle(0xddb040, 1);
  g.fillRect(14, 27, 4, 3);
  g.fillStyle(0x4488cc, 1);
  g.fillRect(3, 16 + armL, 6, 7); g.fillRect(23, 16 + armR, 6, 7);
  g.fillStyle(0xf0c898, 1);
  g.fillRect(4, 23 + armL, 4, 4); g.fillRect(24, 23 + armR, 4, 4);
  g.fillStyle(0xf0c898, 1); g.fillCircle(16, 8, 7);
  g.fillStyle(0x5a3820, 1);
  g.fillRect(9, 0, 14, 7); g.fillRect(9, 3, 2, 6); g.fillRect(21, 3, 2, 6);
  g.fillStyle(0x222222, 1);
  g.fillRect(12, 7, 2, 3); g.fillRect(18, 7, 2, 3);
  g.fillStyle(0xffffff, 0.8);
  g.fillRect(12, 7, 1, 1); g.fillRect(18, 7, 1, 1);
  g.fillStyle(0xd0a070, 1);
  g.fillRect(14, 13, 4, 1);
  if (sword > 0) {
    const sy = (sword - 2) * 6;
    g.fillStyle(0x8a7040, 1); g.fillRect(27, 12 + sy, 3, 5);
    g.fillStyle(0xcccccc, 1); g.fillRect(28, 2 + sy, 2, 14);
    g.fillStyle(0xeeeeee, 0.6); g.fillRect(28, 5 + sy, 1, 6);
  }
}

function drawPlayerUp(g: Phaser.GameObjects.Graphics, legL: number, legR: number, armL: number, armR: number) {
  g.fillStyle(0x8b5a2b, 1);
  g.fillRect(10 + legL, 36, 5, 8); g.fillRect(17 + legR, 36, 5, 8);
  g.fillStyle(0x5a6678, 1);
  g.fillRect(10 + Math.floor(legL * 0.5), 28, 5, 10);
  g.fillRect(17 + Math.floor(legR * 0.5), 28, 5, 10);
  g.fillStyle(0x4488cc, 1);
  g.fillRect(8, 14, 16, 16);
  g.fillStyle(0x3670b0, 1);
  g.fillRect(8, 14, 2, 16); g.fillRect(22, 14, 2, 16);
  g.fillStyle(0x3670b0, 1);
  g.fillRect(15, 16, 2, 12);
  g.fillStyle(0x8b6914, 1);
  g.fillRect(8, 27, 16, 3);
  g.fillStyle(0x4488cc, 1);
  g.fillRect(3, 16 + armL, 6, 7); g.fillRect(23, 16 + armR, 6, 7);
  g.fillStyle(0xf0c898, 1);
  g.fillRect(4, 23 + armL, 4, 4); g.fillRect(24, 23 + armR, 4, 4);
  g.fillStyle(0xf0c898, 1); g.fillCircle(16, 8, 7);
  g.fillStyle(0x5a3820, 1);
  g.fillRect(9, 0, 14, 10); g.fillRect(9, 3, 2, 8); g.fillRect(21, 3, 2, 8);
  g.fillStyle(0xf0c898, 1);
  g.fillRect(9, 6, 2, 3); g.fillRect(21, 6, 2, 3);
}

function drawPlayerSide(g: Phaser.GameObjects.Graphics, legF: number, legB: number, armF: number, armB: number, sword: number) {
  g.fillStyle(0x4a5568, 1);
  g.fillRect(14 + legB, 36, 5, 8);
  g.fillStyle(0x4e5a6a, 1);
  g.fillRect(14 + Math.floor(legB * 0.5), 28, 5, 10);
  g.fillStyle(0x8b5a2b, 1);
  g.fillRect(12 + legF, 36, 5, 8);
  g.fillStyle(0x5a6678, 1);
  g.fillRect(12 + Math.floor(legF * 0.5), 28, 5, 10);
  g.fillStyle(0x3670b0, 1);
  g.fillRect(13, 16 + armB, 6, 7);
  g.fillStyle(0xe0b880, 1);
  g.fillRect(14, 23 + armB, 4, 4);
  g.fillStyle(0x4488cc, 1);
  g.fillRect(10, 14, 12, 16);
  g.fillStyle(0x3670b0, 1);
  g.fillRect(10, 14, 2, 16);
  g.fillStyle(0x8b6914, 1);
  g.fillRect(10, 27, 12, 3);
  g.fillStyle(0xddb040, 1);
  g.fillRect(10, 28, 3, 2);
  g.fillStyle(0x4488cc, 1);
  g.fillRect(18, 16 + armF, 6, 7);
  g.fillStyle(0xf0c898, 1);
  g.fillRect(19, 23 + armF, 4, 4);
  g.fillStyle(0xf0c898, 1); g.fillCircle(16, 8, 7);
  g.fillStyle(0x5a3820, 1);
  g.fillRect(9, 0, 10, 7); g.fillRect(9, 3, 3, 6);
  g.fillStyle(0x222222, 1);
  g.fillRect(19, 7, 2, 3);
  g.fillStyle(0xffffff, 0.8);
  g.fillRect(19, 7, 1, 1);
  g.fillStyle(0xe0b880, 1);
  g.fillRect(11, 6, 2, 4);
  g.fillStyle(0xe0b080, 1);
  g.fillRect(22, 8, 2, 2);
  if (sword > 0) {
    const sy = (sword - 2) * 6;
    g.fillStyle(0x8a7040, 1); g.fillRect(22, 12 + sy, 3, 5);
    g.fillStyle(0xcccccc, 1); g.fillRect(23, 2 + sy, 2, 14);
    g.fillStyle(0xeeeeee, 0.6); g.fillRect(23, 5 + sy, 1, 6);
  }
}

function generatePlayerFrames(scene: Phaser.Scene) {
  const W = 32, H = 48;
  const dirs: Array<{ tag: string; fn: (...a: any[]) => void; hasSword: boolean }> = [
    { tag: 'down', fn: drawPlayerDown, hasSword: true },
    { tag: 'up', fn: drawPlayerUp, hasSword: false },
    { tag: 'side', fn: drawPlayerSide, hasSword: true },
  ];
  for (const { tag, fn, hasSword } of dirs) {
    const s = hasSword;
    generateAndSave(scene, `char-player-${tag}-idle-0`, W, H, (g) => fn(g, 0, 0, 0, 0, ...(s ? [0] : [])));
    generateAndSave(scene, `char-player-${tag}-idle-1`, W, H, (g) => fn(g, 0, 0, 0, -1, ...(s ? [0] : [])));
    generateAndSave(scene, `char-player-${tag}-walk-0`, W, H, (g) => fn(g, -2, 2, -1, 1, ...(s ? [0] : [])));
    generateAndSave(scene, `char-player-${tag}-walk-1`, W, H, (g) => fn(g, 0, 0, 0, 0, ...(s ? [0] : [])));
    generateAndSave(scene, `char-player-${tag}-walk-2`, W, H, (g) => fn(g, 2, -2, 1, -1, ...(s ? [0] : [])));
    generateAndSave(scene, `char-player-${tag}-walk-3`, W, H, (g) => fn(g, 0, 0, 0, 0, ...(s ? [0] : [])));
    generateAndSave(scene, `char-player-${tag}-attack-0`, W, H, (g) => fn(g, 0, 0, 0, -4, ...(s ? [1] : [])));
    generateAndSave(scene, `char-player-${tag}-attack-1`, W, H, (g) => fn(g, 0, 0, 0, 2, ...(s ? [2] : [])));
    generateAndSave(scene, `char-player-${tag}-attack-2`, W, H, (g) => fn(g, 0, 0, 0, 4, ...(s ? [3] : [])));
  }
}

function drawEnemyDown(g: Phaser.GameObjects.Graphics, legL: number, legR: number, armL: number, armR: number) {
  g.fillStyle(0x4a3018, 1);
  g.fillRect(10 + legL, 36, 5, 8); g.fillRect(17 + legR, 36, 5, 8);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(11 + Math.floor(legL * 0.5), 28, 4, 10);
  g.fillRect(18 + Math.floor(legR * 0.5), 28, 4, 10);
  g.fillStyle(0xcc3333, 1);
  g.fillRect(8, 14, 16, 14);
  g.fillStyle(0x992222, 1);
  g.fillRect(8, 14, 2, 14); g.fillRect(22, 14, 2, 14);
  g.fillStyle(0xaa2828, 1);
  g.fillRect(10, 18, 12, 2); g.fillRect(10, 23, 12, 2);
  g.fillStyle(0xcc3333, 1);
  g.fillRect(3, 16 + armL, 6, 6); g.fillRect(23, 16 + armR, 6, 6);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(4, 22 + armL, 4, 4); g.fillRect(24, 22 + armR, 4, 4);
  g.fillStyle(0xe8e0c0, 1); g.fillCircle(16, 8, 7);
  g.fillStyle(0x180000, 1);
  g.fillRect(11, 5, 4, 5); g.fillRect(17, 5, 4, 5);
  g.fillStyle(0xff2020, 0.9);
  g.fillRect(12, 6, 2, 3); g.fillRect(18, 6, 2, 3);
  g.fillStyle(0x180000, 1);
  g.fillRect(15, 11, 2, 2);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(12, 13, 8, 2);
  g.fillStyle(0x180000, 0.7);
  g.fillRect(13, 13, 1, 2); g.fillRect(16, 13, 1, 2); g.fillRect(19, 13, 1, 2);
}

function drawEnemyUp(g: Phaser.GameObjects.Graphics, legL: number, legR: number, armL: number, armR: number) {
  g.fillStyle(0x4a3018, 1);
  g.fillRect(10 + legL, 36, 5, 8); g.fillRect(17 + legR, 36, 5, 8);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(11 + Math.floor(legL * 0.5), 28, 4, 10);
  g.fillRect(18 + Math.floor(legR * 0.5), 28, 4, 10);
  g.fillStyle(0xcc3333, 1);
  g.fillRect(8, 14, 16, 14);
  g.fillStyle(0x992222, 1);
  g.fillRect(8, 14, 2, 14); g.fillRect(22, 14, 2, 14);
  g.fillStyle(0x772020, 1);
  g.fillRect(15, 16, 2, 10);
  g.fillStyle(0xcc3333, 1);
  g.fillRect(3, 16 + armL, 6, 6); g.fillRect(23, 16 + armR, 6, 6);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(4, 22 + armL, 4, 4); g.fillRect(24, 22 + armR, 4, 4);
  g.fillStyle(0xe8e0c0, 1); g.fillCircle(16, 8, 7);
  g.fillStyle(0xc8c0a0, 1);
  g.fillRect(11, 3, 10, 8);
  g.fillStyle(0x998870, 1);
  g.fillRect(14, 2, 2, 6);
}

function drawEnemySide(g: Phaser.GameObjects.Graphics, legF: number, legB: number, armF: number, armB: number) {
  g.fillStyle(0x3a2010, 1);
  g.fillRect(14 + legB, 36, 5, 8);
  g.fillStyle(0xc0b890, 1);
  g.fillRect(14 + Math.floor(legB * 0.5), 28, 4, 10);
  g.fillStyle(0x4a3018, 1);
  g.fillRect(12 + legF, 36, 5, 8);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(12 + Math.floor(legF * 0.5), 28, 4, 10);
  g.fillStyle(0x992222, 1);
  g.fillRect(13, 16 + armB, 6, 6);
  g.fillStyle(0xc0b890, 1);
  g.fillRect(14, 22 + armB, 4, 4);
  g.fillStyle(0xcc3333, 1);
  g.fillRect(10, 14, 12, 14);
  g.fillStyle(0x992222, 1);
  g.fillRect(10, 14, 2, 14);
  g.fillStyle(0xaa2828, 1);
  g.fillRect(12, 18, 8, 2);
  g.fillStyle(0xcc3333, 1);
  g.fillRect(18, 16 + armF, 6, 6);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(19, 22 + armF, 4, 4);
  g.fillStyle(0xe8e0c0, 1); g.fillCircle(16, 8, 7);
  g.fillStyle(0x180000, 1);
  g.fillRect(18, 5, 4, 5);
  g.fillStyle(0xff2020, 0.9);
  g.fillRect(19, 6, 2, 3);
  g.fillStyle(0xd8d0a8, 1);
  g.fillRect(16, 12, 6, 3);
  g.fillStyle(0x180000, 0.7);
  g.fillRect(17, 12, 1, 2); g.fillRect(19, 12, 1, 2);
  g.fillStyle(0x180000, 1);
  g.fillRect(21, 9, 2, 2);
}

function generateEnemyFrames(scene: Phaser.Scene) {
  const W = 32, H = 48;
  const dirs: Array<{ tag: string; fn: (g: Phaser.GameObjects.Graphics, a: number, b: number, c: number, d: number) => void }> = [
    { tag: 'down', fn: drawEnemyDown },
    { tag: 'up', fn: drawEnemyUp },
    { tag: 'side', fn: drawEnemySide },
  ];
  for (const { tag, fn } of dirs) {
    generateAndSave(scene, `char-enemy-${tag}-idle-0`, W, H, (g) => fn(g, 0, 0, 0, 0));
    generateAndSave(scene, `char-enemy-${tag}-idle-1`, W, H, (g) => fn(g, 0, 0, 0, -1));
    generateAndSave(scene, `char-enemy-${tag}-walk-0`, W, H, (g) => fn(g, -2, 2, -1, 1));
    generateAndSave(scene, `char-enemy-${tag}-walk-1`, W, H, (g) => fn(g, 0, 0, 0, 0));
    generateAndSave(scene, `char-enemy-${tag}-walk-2`, W, H, (g) => fn(g, 2, -2, 1, -1));
    generateAndSave(scene, `char-enemy-${tag}-walk-3`, W, H, (g) => fn(g, 0, 0, 0, 0));
    generateAndSave(scene, `char-enemy-${tag}-attack-0`, W, H, (g) => fn(g, 0, 0, 0, -4));
    generateAndSave(scene, `char-enemy-${tag}-attack-1`, W, H, (g) => fn(g, 0, 0, 0, 2));
    generateAndSave(scene, `char-enemy-${tag}-attack-2`, W, H, (g) => fn(g, 0, 0, 0, 4));
  }
}

function generateAttackEffect(scene: Phaser.Scene) {
  generateAndSave(scene, 'fx-attack', 16, 16, (g) => {
    g.fillStyle(0xffcc00, 1); g.fillCircle(8, 8, 3);
    const rand = seededRandom(99);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const len = 4 + rand() * 3;
      g.fillStyle(0xff8800, 0.7 + rand() * 0.3);
      g.fillCircle(8 + Math.cos(angle) * len, 8 + Math.sin(angle) * len, 1 + rand());
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0xffee44, 0.4 + rand() * 0.4);
      g.fillPoint(2 + rand() * 12, 2 + rand() * 12, 1);
    }
  });
}

function genParticle(scene: Phaser.Scene) {
  generateAndSave(scene, 'particle-glow', 8, 8, (g) => {
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 2.5);
  });
}

function genDustMote(scene: Phaser.Scene) {
  generateAndSave(scene, 'particle-dust', 6, 6, (g) => {
    g.fillStyle(0xccbb99, 0.3);
    g.fillCircle(3, 3, 3);
    g.fillStyle(0xddccaa, 0.5);
    g.fillCircle(3, 3, 1.5);
  });
}

function genFogWisp(scene: Phaser.Scene) {
  generateAndSave(scene, 'particle-fog', 16, 16, (g) => {
    // Soft diffuse fog blob
    for (let r = 8; r > 0; r -= 1) {
      const t = 1 - r / 8;
      g.fillStyle(0xaabbcc, t * t * 0.15);
      g.fillCircle(8, 8, r);
    }
  });
}

// ─── Terrain edge blend overlays ───
// White diamond with directional alpha gradient — tinted at render time for terrain transitions

function genEdgeBlends(scene: Phaser.Scene) {
  const cx = TEX_W / 2;
  const cy = TEX_H / 2;
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;

  const edges: Array<{ key: string; calc: (px: number, py: number) => number }> = [
    { key: 'edge-ne', calc: (px, py) => (px - cx) / hw + (cy - py) / hh },
    { key: 'edge-se', calc: (px, py) => (px - cx) / hw + (py - cy) / hh },
    { key: 'edge-sw', calc: (px, py) => (cx - px) / hw + (py - cy) / hh },
    { key: 'edge-nw', calc: (px, py) => (cx - px) / hw + (cy - py) / hh },
  ];

  for (const { key, calc } of edges) {
    generateAndSave(scene, key, TEX_W, TEX_H, (g) => {
      for (let py = 0; py < TEX_H; py++) {
        for (let px = 0; px < TEX_W; px++) {
          if (!insideDiamond(px, py)) continue;
          const d = Math.max(0, calc(px, py));
          const alpha = d * d * 0.5; // Quadratic falloff, max 50% at edge
          if (alpha > 0.02) {
            g.fillStyle(0xffffff, alpha);
            g.fillPoint(px, py, 1);
          }
        }
      }
    });
  }
}

// ─── Torch ground glow texture ───

function genTorchGlow(scene: Phaser.Scene) {
  const glowSize = TILE_WIDTH * 3;
  generateAndSave(scene, 'torch-ground-glow', glowSize, glowSize, (g) => {
    const cx = glowSize / 2;
    const cy = glowSize / 2;
    const maxR = glowSize / 2;
    for (let r = maxR; r > 0; r -= 1) {
      const t = 1 - r / maxR;
      const alpha = t * t * 0.12;
      g.fillStyle(0xff9940, alpha);
      g.fillCircle(cx, cy, r);
    }
  });
}

function genLavaGlow(scene: Phaser.Scene) {
  const glowSize = TILE_WIDTH * 2;
  generateAndSave(scene, 'lava-ground-glow', glowSize, glowSize, (g) => {
    const cx = glowSize / 2;
    const cy = glowSize / 2;
    const maxR = glowSize / 2;
    for (let r = maxR; r > 0; r -= 1) {
      const t = 1 - r / maxR;
      const alpha = t * t * 0.08;
      g.fillStyle(0xff4400, alpha);
      g.fillCircle(cx, cy, r);
    }
  });
}

// ─── Public API ───

/** Terrain base colors for edge blending — exported for tileMap */
export const TERRAIN_BLEND_COLORS: Record<number, number> = {
  0: 0x7ec850,   // TILE_GRASS
  1: 0x8a8478,   // TILE_STONE
  2: 0x4a8ec8,   // TILE_WATER
  6: 0x2a5e98,   // TILE_DEEP_WATER
  7: 0x6abee8,   // TILE_SHALLOW_WATER
  8: 0x5aA048,   // TILE_GRASS_DARK
  9: 0x6a5a3a,   // TILE_DIRT
  10: 0x3a1200,  // TILE_LAVA
  11: 0xe8d090,  // TILE_SAND
  12: 0x7a7568,  // TILE_MOUNTAIN
  13: 0x9a9080,  // TILE_MOUNTAIN_PATH
  14: 0x8a8070,  // TILE_TOWN_ROAD
  15: 0x6a5a3a,  // TILE_VILLAGE_DIRT
  16: 0x5e4e2a,  // TILE_FARMLAND
  17: 0xaaa498,  // TILE_MANOR_FLOOR
  18: 0x6aba68,  // TILE_MANOR_GARDEN
};

/** Terrain group IDs — same group = no edge transition needed */
export function terrainGroup(type: number): number {
  if (type === 0 || type === 8 || type === 18) return 1;  // greens
  if (type === 2 || type === 6 || type === 7) return 2;   // waters
  if (type === 1 || type === 14 || type === 17) return 3;  // stone/road
  if (type === 9 || type === 15 || type === 16) return 4;  // earth
  if (type === 12 || type === 13) return 5;                // mountain
  if (type === 11) return 6;                                // sand
  if (type === 10) return 7;                                // lava
  return type + 100; // unique group for unknown types
}

/** Generate all procedural textures */
export function generateTextures(scene: Phaser.Scene): void {
  // Ground tiles with variants
  genGrassTile(scene, 'tile-grass-0', 42, 0x7ec850, 0x6ab840);
  genGrassTile(scene, 'tile-grass-1', 137, 0x7ec850, 0x6ab840);
  genGrassTile(scene, 'tile-grass-2', 281, 0x7ec850, 0x6ab840);

  genStoneTile(scene, 'tile-stone-0', 123);
  genStoneTile(scene, 'tile-stone-1', 456);
  genStoneTile(scene, 'tile-stone-2', 789);

  genWaterTile(scene, 'tile-water', 77, 0x4a8ec8, 0x3a7ab0, 0x7ac0ee);
  genWaterTile(scene, 'tile-deep-water', 33, 0x2a5e98, 0x1a4a78, 0x4a90cc);
  genWaterTile(scene, 'tile-shallow-water', 55, 0x6abee8, 0x5aaad0, 0x9adcf8);

  genGrassTile(scene, 'tile-grass-dark-0', 91, 0x5aA048, 0x4a903a);
  genGrassTile(scene, 'tile-grass-dark-1', 192, 0x5aA048, 0x4a903a);
  genGrassTile(scene, 'tile-grass-dark-2', 303, 0x5aA048, 0x4a903a);

  genDirtTile(scene, 'tile-dirt-0', 111);
  genDirtTile(scene, 'tile-dirt-1', 222);
  genDirtTile(scene, 'tile-dirt-2', 333);

  genLavaTile(scene, 'tile-lava');

  // Animated water/lava frames (4 frames per type for ripple/flow animation)
  for (let f = 0; f < 4; f++) {
    const p = f * Math.PI / 2;
    genWaterTile(scene, `tile-water-f${f}`, 77, 0x4a8ec8, 0x3a7ab0, 0x7ac0ee, p);
    genWaterTile(scene, `tile-deep-water-f${f}`, 33, 0x2a5e98, 0x1a4a78, 0x4a90cc, p);
    genWaterTile(scene, `tile-shallow-water-f${f}`, 55, 0x6abee8, 0x5aaad0, 0x9adcf8, p);
    genLavaTile(scene, `tile-lava-f${f}`, p);
  }

  // Walls (4 variants)
  genWallTile(scene, 'tile-wall-0', 100);
  genWallTile(scene, 'tile-wall-1', 200);
  genWallTile(scene, 'tile-wall-2', 300);
  genWallTile(scene, 'tile-wall-3', 400);

  // World map ground tiles
  genSandTile(scene, 'tile-sand-0', 501);
  genSandTile(scene, 'tile-sand-1', 502);
  genSandTile(scene, 'tile-sand-2', 503);

  genMountainTile(scene, 'tile-mountain-0', 601);
  genMountainTile(scene, 'tile-mountain-1', 602);
  genMountainTile(scene, 'tile-mountain-2', 603);

  genMountainPathTile(scene, 'tile-mountain-path-0', 701);
  genMountainPathTile(scene, 'tile-mountain-path-1', 702);
  genMountainPathTile(scene, 'tile-mountain-path-2', 703);

  genTownRoadTile(scene, 'tile-town-road-0', 801);
  genTownRoadTile(scene, 'tile-town-road-1', 802);
  genTownRoadTile(scene, 'tile-town-road-2', 803);

  genVillageDirtTile(scene, 'tile-village-dirt-0', 901);
  genVillageDirtTile(scene, 'tile-village-dirt-1', 902);
  genVillageDirtTile(scene, 'tile-village-dirt-2', 903);

  genFarmlandTile(scene, 'tile-farmland-0', 1001);
  genFarmlandTile(scene, 'tile-farmland-1', 1002);
  genFarmlandTile(scene, 'tile-farmland-2', 1003);

  genManorFloorTile(scene, 'tile-manor-floor-0', 1101);
  genManorFloorTile(scene, 'tile-manor-floor-1', 1102);
  genManorFloorTile(scene, 'tile-manor-floor-2', 1103);

  genManorGardenTile(scene, 'tile-manor-garden-0', 1201);
  genManorGardenTile(scene, 'tile-manor-garden-1', 1202);
  genManorGardenTile(scene, 'tile-manor-garden-2', 1203);

  // Obstacles
  genRockObstacle(scene);
  genTreeObstacle(scene);

  // Decorations
  genTorch(scene);
  genChest(scene);
  genTable(scene);
  genBarrel(scene);
  genBones(scene);
  genPillar(scene);

  // World map decorations
  genHouse(scene);
  genShop(scene);
  genFence(scene);
  genCabin(scene);
  genManorWall(scene);
  genManorBuilding(scene);
  genFlower(scene);
  genBush(scene);
  genCityWall(scene);

  // Particles
  genParticle(scene);
  genDustMote(scene);
  genFogWisp(scene);

  // Edge blend overlays for terrain transitions
  genEdgeBlends(scene);

  // Torch ground glow
  genTorchGlow(scene);

  // Lava ground glow
  genLavaGlow(scene);

  // Characters & effects
  generatePlayerFrames(scene);
  generateEnemyFrames(scene);
  generateAttackEffect(scene);
}
