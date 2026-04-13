/**
 * @entry Kenney Isometric Miniature Dungeon — character loader
 *
 * Kenney "Isometric Miniature Dungeon" (CC0)
 * https://kenney.nl/assets/isometric-miniature-dungeon
 *
 * Format: individual 256×512 PNG per frame
 *   Male_<dir>_Idle0.png   — 1 idle frame per direction
 *   Male_<dir>_Run0..9.png — 10 run frames per direction
 *   dir 0..7 = NW, W, SW, S, SE, E, NE, N
 */

import Phaser from 'phaser';

/** Kenney dir index → compass name (verified by visual inspection) */
const KENNEY_DIR_MAP = {
  nw: 0,
  w:  1,
  sw: 2,
  s:  3,
  se: 4,
  e:  5,
  ne: 6,
  n:  7,
} as const;

export type KenneyDir = keyof typeof KENNEY_DIR_MAP;

const RUN_FRAMES = 10;
const BASE_PATH = 'assets/kenney/isometric-miniature-dungeon/characters';

/** Load all frames for a Kenney character variant (e.g. "Male") */
export function preloadKenneyChar(scene: Phaser.Scene, variant = 'Male'): void {
  for (const [, dirIdx] of Object.entries(KENNEY_DIR_MAP)) {
    scene.load.image(
      kenneyFrameKey(variant, dirIdx as KenneyDirIdx, 'idle', 0),
      `${BASE_PATH}/${variant}_${dirIdx}_Idle0.png`,
    );
    for (let f = 0; f < RUN_FRAMES; f++) {
      scene.load.image(
        kenneyFrameKey(variant, dirIdx as KenneyDirIdx, 'run', f),
        `${BASE_PATH}/${variant}_${dirIdx}_Run${f}.png`,
      );
    }
  }
}

type KenneyDirIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type KenneyAnim = 'idle' | 'run';

export function kenneyFrameKey(variant: string, dirIdx: KenneyDirIdx, anim: KenneyAnim, frame: number): string {
  return `kenney:${variant}:${dirIdx}:${anim}:${frame}`;
}

export function kenneyAnimKey(variant: string, dir: KenneyDir, anim: KenneyAnim | 'walk' | 'attack'): string {
  return `kenney:${variant}:${dir}:${anim}`;
}

/** Register Phaser animations for a loaded Kenney character variant */
export function registerKenneyAnims(scene: Phaser.Scene, variant = 'Male'): void {
  for (const [dirName, dirIdx] of Object.entries(KENNEY_DIR_MAP) as [KenneyDir, KenneyDirIdx][]) {
    // Idle: single frame, slow breathe
    scene.anims.create({
      key: kenneyAnimKey(variant, dirName, 'idle'),
      frames: [{ key: kenneyFrameKey(variant, dirIdx, 'idle', 0) }],
      frameRate: 1,
      repeat: -1,
    });

    // Walk: run animation at moderate speed
    scene.anims.create({
      key: kenneyAnimKey(variant, dirName, 'walk'),
      frames: Array.from({ length: RUN_FRAMES }, (_, f) => ({
        key: kenneyFrameKey(variant, dirIdx, 'run', f),
      })),
      frameRate: 12,
      repeat: -1,
    });

    // Attack: reuse run frames 0-3 at high speed (no dedicated attack anim in pack)
    scene.anims.create({
      key: kenneyAnimKey(variant, dirName, 'attack'),
      frames: [0, 1, 2, 3].map((f) => ({
        key: kenneyFrameKey(variant, dirIdx, 'run', f),
      })),
      frameRate: 16,
      repeat: 0,
    });
  }
}

/**
 * Map world-space movement delta to the closest Kenney 8-direction key.
 * World axes: +x = SE on screen, +y = SW on screen.
 */
export function movementToKenneyDir(dx: number, dy: number): KenneyDir {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const a = (angle + 360) % 360;

  if (a < 22.5 || a >= 337.5) return 'e';
  if (a < 67.5)  return 'se';
  if (a < 112.5) return 's';
  if (a < 157.5) return 'sw';
  if (a < 202.5) return 'w';
  if (a < 247.5) return 'nw';
  if (a < 292.5) return 'n';
  return 'ne';
}
