/** @entry EntityRenderer - depth-sorted entity rendering + animation state + enemy HP bars */

import Phaser from 'phaser';
import type { Entity, GameEntity } from '../types';
import { calcDepth, DEPTH_OBSTACLE } from './isometric';
import { movementToLpcDir } from '../assets/lpcSprites';
import type { LpcDir } from '../assets/lpcSprites';
import { movementToKenneyDir, kenneyAnimKey } from '../assets/kenneyIsoChar';
import type { KenneyDir } from '../assets/kenneyIsoChar';

/**
 * Within the DEPTH_OBSTACLE band, entities sit at +0.25 relative to the row base,
 * putting them in front of same-cell obstacles but behind obstacles one row ahead.
 * This mirrors how a character standing on a cell should be "in front of" that
 * cell's obstacle but "behind" the obstacle of the next cell toward the camera.
 */
const ENTITY_DEPTH_OFFSET = 0.25;

/** Pixels to lift entity sprites above the tile center so feet sit on the surface */
const ENTITY_Y_LIFT = 0;

/** Enemy HP bar constants */
const HP_BAR_W = 38;
const HP_BAR_H = 4;
const HP_BAR_OFFSET_Y = -70;

export type AnimState = 'idle' | 'walk' | 'attack';
/** 3-dir for procedural sprites */
export type FaceDir = 'down' | 'up' | 'side';

interface AnimEntity extends Entity {
  /** Animation prefix: 'player' | 'enemy' | 'player-lpc' | 'enemy-lpc' | 'player-kenney' | 'enemy-kenney' */
  animPrefix?: string;
  animState?: AnimState;
  /** 3-dir for procedural mode */
  faceDir?: FaceDir;
  /** 8-dir for LPC mode */
  lpcDir?: LpcDir;
  /** 8-dir for Kenney mode */
  kenneyDir?: KenneyDir;
  prevWorldX?: number;
  prevWorldY?: number;
  hpBarBg?: Phaser.GameObjects.Graphics;
  hpBarFill?: Phaser.GameObjects.Graphics;
}

/** Whether this prefix uses the LPC 8-direction system */
function isLpcPrefix(prefix: string): boolean {
  return prefix.endsWith('-lpc');
}

/** Whether this prefix uses the Kenney 8-direction system */
function isKenneyPrefix(prefix: string): boolean {
  return prefix.endsWith('-kenney');
}

/** Kenney anim key for a given prefix, direction, and state */
function kenneyAnimKeyFor(prefix: string, dir: KenneyDir, state: AnimState | 'idle'): string {
  // Both player and enemy use the same Male variant
  return kenneyAnimKey('Male', dir, state);
}

/** Strip '-lpc' suffix to get the base id (e.g. 'player-lpc' → 'player') */
function lpcId(prefix: string): string {
  return prefix.replace(/-lpc$/, '');
}

/** 3-dir procedural anim key */
function procAnimKey(prefix: string, dir: FaceDir, state: AnimState): string {
  return `${prefix}-${dir}-${state}`;
}

/** 8-dir LPC composited anim key for player; raw sheet anim for enemy */
function lpcAnimKeyFor(prefix: string, dir: LpcDir, state: AnimState | 'idle'): string {
  const id = lpcId(prefix);
  // Player uses compositor keys; enemies use raw sheet keys
  if (id === 'player') return `comp:player:${dir}:${state}`;
  // Enemies: raw skeleton sheet
  return `lpc:skeleton:${dir}:${state}`;
}

/**
 * Determine procedural 3-dir facing from world-space delta.
 */
function calcFaceDir(dx: number, dy: number): { dir: FaceDir; flipX: boolean } {
  const sdx = dx - dy;
  const sdy = dx + dy;
  if (Math.abs(sdy) >= Math.abs(sdx)) {
    return { dir: sdy >= 0 ? 'down' : 'up', flipX: false };
  }
  return { dir: 'side', flipX: sdx < 0 };
}

/** Play attack animation on an entity sprite, then return to idle */
export function playAttackAnim(entity: Entity): void {
  const e = entity as AnimEntity;
  if (!e.animPrefix) return;
  const sprite = e.sprite;
  if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;

  e.animState = 'attack';

  if (isKenneyPrefix(e.animPrefix)) {
    const dir = e.kenneyDir ?? 'se';
    sprite.play(kenneyAnimKeyFor(e.animPrefix, dir, 'attack'));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (e.animState === 'attack') {
        e.animState = 'idle';
        sprite.play(kenneyAnimKeyFor(e.animPrefix!, e.kenneyDir ?? 'se', 'idle'));
      }
    });
  } else if (isLpcPrefix(e.animPrefix)) {
    const dir = e.lpcDir ?? 'se';
    sprite.play(lpcAnimKeyFor(e.animPrefix, dir, 'attack'));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (e.animState === 'attack') {
        e.animState = 'idle';
        sprite.play(lpcAnimKeyFor(e.animPrefix!, e.lpcDir ?? 'se', 'idle'));
      }
    });
  } else {
    const dir = e.faceDir ?? 'down';
    sprite.play(procAnimKey(e.animPrefix, dir, 'attack'));
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (e.animState === 'attack') {
        e.animState = 'idle';
        sprite.play(procAnimKey(e.animPrefix!, e.faceDir ?? 'down', 'idle'));
      }
    });
  }
}

export class EntityRenderer {
  private entities: Map<string, AnimEntity> = new Map();

  private scene: Phaser.Scene | null = null;

  setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  add(entity: Entity, animPrefix?: string): void {
    const e = entity as AnimEntity;
    e.animPrefix = animPrefix;
    e.animState = 'idle';
    e.faceDir = 'down';
    e.lpcDir = 'se';
    e.kenneyDir = 'se';
    e.prevWorldX = e.worldX;
    e.prevWorldY = e.worldY;

    const ge = entity as GameEntity;
    if (ge.isEnemy && this.scene) {
      e.hpBarBg = this.scene.add.graphics();
      e.hpBarBg.setScrollFactor(1);
      e.hpBarFill = this.scene.add.graphics();
      e.hpBarFill.setScrollFactor(1);
    }

    this.entities.set(e.id, e);
  }

  remove(id: string): void {
    const e = this.entities.get(id);
    if (e) {
      e.hpBarBg?.destroy();
      e.hpBarFill?.destroy();
    }
    this.entities.delete(id);
  }

  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  updateDepth(): void {
    for (const entity of this.entities.values()) {
      const depth = DEPTH_OBSTACLE + calcDepth(entity.worldX, entity.worldY) + ENTITY_DEPTH_OFFSET;
      entity.sprite.setDepth(depth);
    }
  }

  syncPositions(worldToScreenFn: (wx: number, wy: number) => { sx: number; sy: number }): void {
    for (const entity of this.entities.values()) {
      const { sx, sy } = worldToScreenFn(entity.worldX, entity.worldY);
      entity.sprite.setPosition(sx, sy - ENTITY_Y_LIFT);
      const shadow = (entity.sprite as any).__shadow;
      if (shadow) {
        shadow.setPosition(sx, sy + 2);
      }
      this.updateHpBar(entity, sx, sy - ENTITY_Y_LIFT);
    }
  }

  private updateHpBar(entity: AnimEntity, sx: number, sy: number): void {
    if (!entity.hpBarBg || !entity.hpBarFill) return;
    const ge = entity as unknown as GameEntity;
    if (!ge.alive) {
      entity.hpBarBg.setVisible(false);
      entity.hpBarFill.setVisible(false);
      return;
    }

    const ratio = Math.max(0, ge.hp / ge.maxHp);
    if (ratio >= 1) {
      entity.hpBarBg.setVisible(false);
      entity.hpBarFill.setVisible(false);
      return;
    }

    const barX = sx - HP_BAR_W / 2;
    const barY = sy + HP_BAR_OFFSET_Y;
    // HP bar always above the entity sprite
    const depth = entity.sprite.depth + 0.05;

    entity.hpBarBg.setVisible(true);
    entity.hpBarBg.clear();
    entity.hpBarBg.setDepth(depth);
    entity.hpBarBg.fillStyle(0x000000, 0.7);
    entity.hpBarBg.fillRect(barX - 1, barY - 1, HP_BAR_W + 2, HP_BAR_H + 2);

    entity.hpBarFill.setVisible(true);
    entity.hpBarFill.clear();
    entity.hpBarFill.setDepth(depth + 0.01);
    const color = ratio > 0.5 ? 0xcc3333 : ratio > 0.25 ? 0xcc8833 : 0xff2222;
    entity.hpBarFill.fillStyle(color, 0.9);
    entity.hpBarFill.fillRect(barX, barY, HP_BAR_W * ratio, HP_BAR_H);
    entity.hpBarFill.fillStyle(0xffffff, 0.2);
    entity.hpBarFill.fillRect(barX, barY, HP_BAR_W * ratio, 1);
  }

  private dustTimer = 0;
  private readonly DUST_INTERVAL = 250;

  updateAnimations(): void {
    this.dustTimer += 16;

    for (const entity of this.entities.values()) {
      if (!entity.animPrefix) continue;
      const sprite = entity.sprite;
      if (!(sprite instanceof Phaser.GameObjects.Sprite)) continue;

      if (entity.animState === 'attack') {
        entity.prevWorldX = entity.worldX;
        entity.prevWorldY = entity.worldY;
        continue;
      }

      const dx = entity.worldX - (entity.prevWorldX ?? entity.worldX);
      const dy = entity.worldY - (entity.prevWorldY ?? entity.worldY);
      const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;

      if (moved) {
        if (isKenneyPrefix(entity.animPrefix)) {
          // Kenney 8-direction mode
          const newDir = movementToKenneyDir(dx, dy);
          const dirChanged = newDir !== entity.kenneyDir;
          entity.kenneyDir = newDir;
          sprite.setFlipX(false);

          if (entity.animState !== 'walk' || dirChanged) {
            entity.animState = 'walk';
            sprite.play(kenneyAnimKeyFor(entity.animPrefix, newDir, 'walk'));
          }
        } else if (isLpcPrefix(entity.animPrefix)) {
          // LPC 8-direction mode
          const newDir = movementToLpcDir(dx, dy);
          const dirChanged = newDir !== entity.lpcDir;
          entity.lpcDir = newDir;
          sprite.setFlipX(false);

          if (entity.animState !== 'walk' || dirChanged) {
            entity.animState = 'walk';
            sprite.play(lpcAnimKeyFor(entity.animPrefix, newDir, 'walk'));
          }
        } else {
          // Procedural 3-direction mode
          const { dir, flipX } = calcFaceDir(dx, dy);
          const dirChanged = dir !== entity.faceDir;
          entity.faceDir = dir;
          sprite.setFlipX(flipX);

          if (entity.animState !== 'walk' || dirChanged) {
            entity.animState = 'walk';
            sprite.play(procAnimKey(entity.animPrefix, dir, 'walk'));
          }
        }

        if (entity.animPrefix === 'player-kenney' || entity.animPrefix === 'player-lpc' || entity.animPrefix === 'player') {
          if (this.scene && this.dustTimer >= this.DUST_INTERVAL) {
            this.dustTimer = 0;
            this.spawnFootDust(sprite.x, sprite.y + ENTITY_Y_LIFT);
          }
        }
      } else if (entity.animState === 'walk') {
        entity.animState = 'idle';
        if (isKenneyPrefix(entity.animPrefix)) {
          sprite.play(kenneyAnimKeyFor(entity.animPrefix, entity.kenneyDir ?? 'se', 'idle'));
        } else if (isLpcPrefix(entity.animPrefix)) {
          sprite.play(lpcAnimKeyFor(entity.animPrefix, entity.lpcDir ?? 'se', 'idle'));
        } else {
          sprite.play(procAnimKey(entity.animPrefix, entity.faceDir ?? 'down', 'idle'));
        }
      }

      entity.prevWorldX = entity.worldX;
      entity.prevWorldY = entity.worldY;
    }
  }

  private spawnFootDust(x: number, y: number): void {
    if (!this.scene) return;
    this.scene.add.particles(x, y, 'particle-dust', {
      speed: { min: 5, max: 15 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 400 },
      alpha: { start: 0.4, end: 0 },
      tint: [0x998877, 0x887766, 0xaa9988],
      quantity: 2,
      emitting: false,
    }).explode(2, x, y);
  }

  update(worldToScreenFn: (wx: number, wy: number) => { sx: number; sy: number }): void {
    this.updateAnimations();
    this.syncPositions(worldToScreenFn);
    this.updateDepth();
  }

  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  clear(): void {
    this.entities.clear();
  }
}
