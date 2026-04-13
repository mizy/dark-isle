/**
 * @entry SpriteCompositor - layer-based character sprite compositing
 *
 * Composites multiple LPC spritesheet layers (body, armor, weapon…)
 * into a single texture per frame using Phaser RenderTexture.
 *
 * Usage:
 *   const comp = new SpriteCompositor(scene, 'player', {
 *     body: 'male_base',
 *     armor: 'male_light',
 *     weapon: 'male_longsword',
 *   });
 *   comp.buildTextures();   // call once after all sheets are registered
 *   sprite.setTexture(comp.frameKey('se', 'walk', 0));
 */

import Phaser from 'phaser';
import { lpcFrameKey, LpcDir, LpcAnim, LPC_FRAME_SIZE, LPC_DIR_ROWS, LPC_ANIM_COLS } from './lpcSprites';

/** Layer ordering — bottom to top */
const LAYER_ORDER = ['body', 'armor', 'weapon', 'shield'] as const;
export type LayerName = typeof LAYER_ORDER[number];

export interface CharacterLayers {
  body?: string;    // spritesheet key, e.g. 'male_base'
  armor?: string;   // e.g. 'male_light' | 'male_heavy'
  weapon?: string;  // e.g. 'male_longsword' | 'male_staff'
  shield?: string;  // e.g. 'male_shield'
}

export class SpriteCompositor {
  private scene: Phaser.Scene;
  private id: string;
  private layers: CharacterLayers;

  /**
   * @param id   Unique identifier used in generated texture keys
   * @param layers  Map of layer name to spritesheet key
   */
  constructor(scene: Phaser.Scene, id: string, layers: CharacterLayers) {
    this.scene = scene;
    this.id = id;
    this.layers = { ...layers };
  }

  /** Update one layer and rebuild textures (e.g. on equip change) */
  setLayer(name: LayerName, sheetKey: string | undefined): void {
    this.layers[name] = sheetKey;
    this.buildTextures();
  }

  /** The generated composite frame texture key */
  frameKey(dir: LpcDir, anim: LpcAnim | 'idle', frame: number): string {
    return `comp:${this.id}:${dir}:${anim}:${frame}`;
  }

  /**
   * Composite all combinations of direction × animation × frame.
   * Must be called after all source sheets are registered via registerLpcSheet().
   */
  buildTextures(): void {
    const dirs = Object.keys(LPC_DIR_ROWS) as LpcDir[];

    for (const dir of dirs) {
      for (const [animName, cols] of Object.entries(LPC_ANIM_COLS) as [LpcAnim, readonly number[]][]) {
        cols.forEach((_col, frameIdx) => {
          this.buildFrame(dir, animName, frameIdx);
        });
        // Idle = walk frames 0 + 1 (already covered above for 'walk')
      }
    }
  }

  private buildFrame(dir: LpcDir, anim: LpcAnim, frameIdx: number): void {
    const key = this.frameKey(dir, anim, frameIdx);
    const size = LPC_FRAME_SIZE;

    // Remove old texture if rebuilding
    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }

    const rt = this.scene.add.renderTexture(0, 0, size, size);
    rt.setVisible(false);

    for (const layerName of LAYER_ORDER) {
      const sheetKey = this.layers[layerName as LayerName];
      if (!sheetKey) continue;

      const srcKey = lpcFrameKey(sheetKey, dir, anim, frameIdx);
      if (!this.scene.textures.exists(srcKey)) continue;

      rt.draw(srcKey, 0, 0);
    }

    rt.saveTexture(key);
    rt.destroy();
  }
}
