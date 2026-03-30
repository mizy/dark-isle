/** @entry Ambient atmosphere particles — dust motes and fog wisps */

import Phaser from 'phaser';

/** Add floating dust motes and fog wisps for dungeon atmosphere */
export function addAmbientParticles(scene: Phaser.Scene): void {
  const camCX = scene.cameras.main.scrollX + scene.cameras.main.width / 2;
  const camCY = scene.cameras.main.scrollY + scene.cameras.main.height / 2;

  // Dust motes: slow-drifting warm specks
  const dustEmitter = scene.add.particles(camCX, camCY, 'particle-dust', {
    speed: { min: 3, max: 12 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0.2 },
    lifespan: { min: 4000, max: 8000 },
    frequency: 300,
    tint: [0xddccaa, 0xccbb88, 0xbbaa77],
    alpha: { start: 0.4, end: 0 },
    quantity: 1,
    emitZone: {
      type: 'random',
      source: new Phaser.Geom.Rectangle(-400, -300, 800, 600),
    },
  });
  dustEmitter.setDepth(9000);
  dustEmitter.setScrollFactor(0.8);

  // Fog wisps: larger, slower, more translucent
  const fogEmitter = scene.add.particles(camCX, camCY, 'particle-fog', {
    speed: { min: 2, max: 6 },
    angle: { min: 160, max: 200 },
    scale: { start: 1.5, end: 0.5 },
    lifespan: { min: 6000, max: 12000 },
    frequency: 800,
    alpha: { start: 0.15, end: 0 },
    quantity: 1,
    emitZone: {
      type: 'random',
      source: new Phaser.Geom.Rectangle(-400, -300, 800, 600),
    },
  });
  fogEmitter.setDepth(9001);
  fogEmitter.setScrollFactor(0.6);
}
