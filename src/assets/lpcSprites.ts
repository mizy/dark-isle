/**
 * @entry LPC (Isometric Hero) spritesheet parser
 *
 * Clint Bellanger "Isometric Hero and Creatures" (CC-BY 3.0 / CC0)
 * https://opengameart.org/content/isometric-hero-and-creatures
 *
 * Sheet layout: 2048×2048, 256×256 per frame, 8 cols × 8 rows
 *   Rows = 8 directions (SE, S, SW, W, NW, N, NE, E)
 *   Cols:
 *     0-3  Walk cycle (4 frames)
 *     4    Attack
 *     5    Special
 *     6    Hit
 *     7    Dead
 */

import Phaser from 'phaser';

export const LPC_FRAME_SIZE = 256;
export const LPC_COLS = 8;
export const LPC_ROWS = 8;

/**
 * 8 isometric directions as row indices.
 * Empirically verified from male_base.png visual inspection:
 *   row0 = SE, row1 = E, row2 = NE, row3 = N,
 *   row4 = NW, row5 = W, row6 = SW, row7 = S
 * "Facing" here means the direction the character body is aimed in world space.
 */
export const LPC_DIR_ROWS = {
  se: 0,
  e:  1,
  ne: 2,
  n:  3,
  nw: 4,
  w:  5,
  sw: 6,
  s:  7,
} as const;

export type LpcDir = keyof typeof LPC_DIR_ROWS;

/** Column ranges for each animation state */
export const LPC_ANIM_COLS = {
  walk:    [0, 1, 2, 3],
  attack:  [4],
  special: [5],
  hit:     [6],
  dead:    [7],
} as const;

export type LpcAnim = keyof typeof LPC_ANIM_COLS;

/**
 * Load and register all character layer spritesheets.
 * Call this in BootScene.preload().
 */
export function preloadLpcSheets(scene: Phaser.Scene): void {
  const layers = [
    'male_base',
    'male_light',
    'male_heavy',
    'male_unarmored',
    'male_longsword',
    'male_longbow',
    'male_staff',
    'male_shield',
  ];
  for (const layer of layers) {
    scene.load.image(layer, `assets/characters/${layer}.png`);
  }
  // Creature sheets (single layer, no compositing needed)
  const creatures = ['skeleton', 'goblin', 'zombie', 'werewolf', 'ogre', 'slime', 'elemental'];
  for (const c of creatures) {
    scene.load.image(c, `assets/characters/${c}.png`);
  }
}

/**
 * Cut all frames from a loaded LPC sheet and register them as Phaser textures.
 * Generates keys like: "lpc:male_base:se:walk:0"
 */
export function registerLpcSheet(scene: Phaser.Scene, sheetKey: string): void {
  const tex = scene.textures.get(sheetKey);
  if (!tex || tex.key === '__MISSING') return;

  const src = tex.getSourceImage() as HTMLImageElement;
  const totalW = src.width;
  const totalH = src.height;
  const fw = totalW / LPC_COLS;
  const fh = totalH / LPC_ROWS;

  for (const [dirName, row] of Object.entries(LPC_DIR_ROWS) as [LpcDir, number][]) {
    for (const [animName, cols] of Object.entries(LPC_ANIM_COLS) as [LpcAnim, readonly number[]][]) {
      cols.forEach((col, frameIdx) => {
        const key = lpcFrameKey(sheetKey, dirName, animName, frameIdx);
        if (scene.textures.exists(key)) return;

        const canvas = document.createElement('canvas');
        canvas.width = fw;
        canvas.height = fh;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(src, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
        scene.textures.addCanvas(key, canvas);
      });
    }
  }
}

/** Build the texture key for a specific frame */
export function lpcFrameKey(sheet: string, dir: LpcDir, anim: LpcAnim, frame: number): string {
  return `lpc:${sheet}:${dir}:${anim}:${frame}`;
}

/**
 * Register all Phaser animations for a given sheet + direction subset.
 * Generates anim keys like: "lpc:male_base:se:walk"
 */
export function registerLpcAnims(scene: Phaser.Scene, sheetKey: string): void {
  const dirs = Object.keys(LPC_DIR_ROWS) as LpcDir[];

  for (const dir of dirs) {
    // Walk (4-frame loop)
    scene.anims.create({
      key: lpcAnimKey(sheetKey, dir, 'walk'),
      frames: [0, 1, 2, 3].map((i) => ({ key: lpcFrameKey(sheetKey, dir, 'walk', i) })),
      frameRate: 7,
      repeat: -1,
    });

    // Attack (single frame, but we repeat it briefly)
    scene.anims.create({
      key: lpcAnimKey(sheetKey, dir, 'attack'),
      frames: [{ key: lpcFrameKey(sheetKey, dir, 'attack', 0) }],
      frameRate: 8,
      repeat: 0,
    });

    // Idle: reuse walk frame 0 as a 2-frame breathe (frame 0 + 1 slow)
    scene.anims.create({
      key: lpcAnimKey(sheetKey, dir, 'idle'),
      frames: [
        { key: lpcFrameKey(sheetKey, dir, 'walk', 0) },
        { key: lpcFrameKey(sheetKey, dir, 'walk', 1) },
      ],
      frameRate: 1.5,
      repeat: -1,
    });
  }
}

export function lpcAnimKey(sheet: string, dir: LpcDir, anim: LpcAnim | 'idle'): string {
  return `lpc:${sheet}:${dir}:${anim}`;
}

/**
 * Map a world-space movement delta to the closest LPC sprite direction.
 *
 * World axes: +x = SE on screen, +y = SW on screen.
 * Compass convention (world-space angle, 0° = +x axis / East-world):
 *   dx>0, dy=0  → E   (screen right-down diagonal)
 *   dx>0, dy>0  → SE
 *   dx=0, dy>0  → S   (screen left-down diagonal)
 *   dx<0, dy>0  → SW
 *   dx<0, dy=0  → W
 *   dx<0, dy<0  → NW
 *   dx=0, dy<0  → N
 *   dx>0, dy<0  → NE
 *
 * WASD in GameScene: S → (dx+1,dy+1)=SE, W → (-1,-1)=NW,
 *                    A → (-1,+1)=SW,     D → (+1,-1)=NE
 */
export function movementToLpcDir(dx: number, dy: number): LpcDir {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180..180, 0=+x world
  const a = (angle + 360) % 360; // 0..360

  // 8 equal sectors, clockwise from East (0°)
  if (a < 22.5 || a >= 337.5) return 'e';
  if (a < 67.5)  return 'se';
  if (a < 112.5) return 's';
  if (a < 157.5) return 'sw';
  if (a < 202.5) return 'w';
  if (a < 247.5) return 'nw';
  if (a < 292.5) return 'n';
  return 'ne';
}
