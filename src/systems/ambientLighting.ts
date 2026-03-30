/** Ambient lighting effects — torch glow/particles and lava glow */

import Phaser from 'phaser';
import type { WorldGeneratorResult } from '../types';
import { DECO_TORCH, TILE_LAVA } from '../types';
import { worldToScreen, calcDepth, TILE_WIDTH } from './isometric';

export function addTorchLighting(scene: Phaser.Scene, worldData: WorldGeneratorResult): void {
  const decos = worldData.decorations;
  for (let y = 0; y < decos.length; y++) {
    for (let x = 0; x < decos[y].length; x++) {
      if (decos[y][x].type !== DECO_TORCH) continue;
      const { sx, sy } = worldToScreen(x, y);
      const depth = calcDepth(x, y) + 0.3;

      // Ground-level warm light pool
      const groundGlow = scene.add.image(sx, sy, 'torch-ground-glow');
      groundGlow.setBlendMode(Phaser.BlendModes.ADD);
      groundGlow.setAlpha(0.15);
      groundGlow.setDepth(depth - 0.2);
      scene.tweens.add({
        targets: groundGlow,
        alpha: { from: 0.15, to: 0.08 },
        duration: 1200 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Warm ambient light glow
      const glow = scene.add.circle(sx, sy - 6, TILE_WIDTH * 1.2, 0xff8800, 0.08);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(depth - 0.1);

      // Inner brighter core
      const core = scene.add.circle(sx, sy - 10, TILE_WIDTH * 0.5, 0xffaa44, 0.12);
      core.setBlendMode(Phaser.BlendModes.ADD);
      core.setDepth(depth - 0.05);

      // Flickering glow
      scene.tweens.add({
        targets: [glow, core],
        alpha: { from: glow.alpha, to: glow.alpha * 0.6 },
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Fire particles
      scene.add.particles(sx, sy - 14, 'particle-glow', {
        speed: { min: 5, max: 20 },
        angle: { min: 255, max: 285 },
        scale: { start: 0.6, end: 0 },
        lifespan: { min: 300, max: 700 },
        frequency: 100,
        tint: [0xff6600, 0xff8800, 0xffaa00, 0xffcc00],
        alpha: { start: 0.8, end: 0 },
        blendMode: 'ADD',
        quantity: 1,
      }).setDepth(depth);
    }
  }
}

export function addLavaGlow(scene: Phaser.Scene, worldData: WorldGeneratorResult): void {
  const ground = worldData.ground;
  for (let y = 0; y < ground.length; y++) {
    for (let x = 0; x < ground[y].length; x++) {
      if (ground[y][x].type !== TILE_LAVA) continue;
      const { sx, sy } = worldToScreen(x, y);
      const depth = calcDepth(x, y) + 0.03;

      const glow = scene.add.image(sx, sy, 'lava-ground-glow');
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setAlpha(0.12);
      glow.setDepth(depth);

      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.12, to: 0.06 },
        duration: 1500 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
