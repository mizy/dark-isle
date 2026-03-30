/** @entry EntityRenderer - depth-sorted entity rendering + animation state + enemy HP bars */

import Phaser from 'phaser';
import type { Entity, GameEntity } from '../types';
import { calcDepth } from './isometric';

/** Small offset so entities render above ground tiles but interleave correctly with obstacles */
const ENTITY_DEPTH_OFFSET = 0.5;

/** Enemy HP bar constants */
const HP_BAR_W = 28;
const HP_BAR_H = 3;
const HP_BAR_OFFSET_Y = -30;

export type AnimState = 'idle' | 'walk' | 'attack';

interface AnimEntity extends Entity {
  /** Animation prefix: 'player' or 'enemy' */
  animPrefix?: string;
  /** Current animation state */
  animState?: AnimState;
  /** Previous world position for movement detection */
  prevWorldX?: number;
  prevWorldY?: number;
  /** Floating HP bar graphics (enemies only) */
  hpBarBg?: Phaser.GameObjects.Graphics;
  hpBarFill?: Phaser.GameObjects.Graphics;
}

/** Play attack animation on an entity sprite, then return to idle */
export function playAttackAnim(entity: Entity): void {
  const e = entity as AnimEntity;
  if (!e.animPrefix) return;
  const sprite = e.sprite;
  if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;

  e.animState = 'attack';
  sprite.play(`${e.animPrefix}-attack`);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    if (e.animState === 'attack') {
      e.animState = 'idle';
      sprite.play(`${e.animPrefix}-idle`);
    }
  });
}

export class EntityRenderer {
  private entities: Map<string, AnimEntity> = new Map();

  private scene: Phaser.Scene | null = null;

  /** Set the scene reference for creating HP bar graphics */
  setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /** Register an entity for depth-sorted rendering */
  add(entity: Entity, animPrefix?: string): void {
    const e = entity as AnimEntity;
    e.animPrefix = animPrefix;
    e.animState = 'idle';
    e.prevWorldX = e.worldX;
    e.prevWorldY = e.worldY;

    // Create floating HP bar for enemies
    const ge = entity as GameEntity;
    if (ge.isEnemy && this.scene) {
      e.hpBarBg = this.scene.add.graphics();
      e.hpBarBg.setScrollFactor(1);
      e.hpBarFill = this.scene.add.graphics();
      e.hpBarFill.setScrollFactor(1);
    }

    this.entities.set(e.id, e);
  }

  /** Remove an entity and clean up HP bar */
  remove(id: string): void {
    const e = this.entities.get(id);
    if (e) {
      e.hpBarBg?.destroy();
      e.hpBarFill?.destroy();
    }
    this.entities.delete(id);
  }

  /** Get entity by id */
  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Update depth for all entities based on world position.
   * Call this every frame to ensure correct front-to-back ordering.
   */
  updateDepth(): void {
    for (const entity of this.entities.values()) {
      const depth = calcDepth(entity.worldX, entity.worldY) + ENTITY_DEPTH_OFFSET;
      entity.sprite.setDepth(depth);
    }
  }

  /**
   * Sync sprite screen position from world coordinates.
   * Call after entity movement to update visual position.
   */
  syncPositions(worldToScreenFn: (wx: number, wy: number) => { sx: number; sy: number }): void {
    for (const entity of this.entities.values()) {
      const { sx, sy } = worldToScreenFn(entity.worldX, entity.worldY);
      entity.sprite.setPosition(sx, sy);
      const shadow = (entity.sprite as any).__shadow;
      if (shadow) {
        shadow.setPosition(sx, sy + 8);
      }
      // Update floating HP bar position
      this.updateHpBar(entity, sx, sy);
    }
  }

  /** Draw/update enemy floating HP bar */
  private updateHpBar(entity: AnimEntity, sx: number, sy: number): void {
    if (!entity.hpBarBg || !entity.hpBarFill) return;
    const ge = entity as unknown as GameEntity;
    if (!ge.alive) {
      entity.hpBarBg.setVisible(false);
      entity.hpBarFill.setVisible(false);
      return;
    }

    const ratio = Math.max(0, ge.hp / ge.maxHp);
    // Don't show bar at full health
    if (ratio >= 1) {
      entity.hpBarBg.setVisible(false);
      entity.hpBarFill.setVisible(false);
      return;
    }

    const barX = sx - HP_BAR_W / 2;
    const barY = sy + HP_BAR_OFFSET_Y;
    const depth = entity.sprite.depth + 0.1;

    entity.hpBarBg.setVisible(true);
    entity.hpBarBg.clear();
    entity.hpBarBg.setDepth(depth);
    // Dark background
    entity.hpBarBg.fillStyle(0x000000, 0.7);
    entity.hpBarBg.fillRect(barX - 1, barY - 1, HP_BAR_W + 2, HP_BAR_H + 2);

    entity.hpBarFill.setVisible(true);
    entity.hpBarFill.clear();
    entity.hpBarFill.setDepth(depth + 0.01);
    // Color based on HP ratio
    const color = ratio > 0.5 ? 0xcc3333 : ratio > 0.25 ? 0xcc8833 : 0xff2222;
    entity.hpBarFill.fillStyle(color, 0.9);
    entity.hpBarFill.fillRect(barX, barY, HP_BAR_W * ratio, HP_BAR_H);
    // Bright top line
    entity.hpBarFill.fillStyle(0xffffff, 0.2);
    entity.hpBarFill.fillRect(barX, barY, HP_BAR_W * ratio, 1);
  }

  private dustTimer = 0;
  private readonly DUST_INTERVAL = 250; // ms between dust puffs

  /**
   * Auto-detect movement and switch walk/idle animations.
   * Attack animation is triggered externally via playAttackAnim().
   */
  updateAnimations(): void {
    this.dustTimer += 16; // approximate frame time

    for (const entity of this.entities.values()) {
      if (!entity.animPrefix) continue;
      const sprite = entity.sprite;
      if (!(sprite instanceof Phaser.GameObjects.Sprite)) continue;

      // Don't interrupt attack animation
      if (entity.animState === 'attack') {
        entity.prevWorldX = entity.worldX;
        entity.prevWorldY = entity.worldY;
        continue;
      }

      const dx = entity.worldX - (entity.prevWorldX ?? entity.worldX);
      const dy = entity.worldY - (entity.prevWorldY ?? entity.worldY);
      const moved = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001;

      if (moved) {
        if (entity.animState !== 'walk') {
          entity.animState = 'walk';
          sprite.play(`${entity.animPrefix}-walk`);
        }
        // Flip sprite based on movement direction (positive dx = moving right in world)
        sprite.setFlipX(dx > 0);

        // Footstep dust puff (only for player, throttled)
        if (entity.animPrefix === 'player' && this.scene && this.dustTimer >= this.DUST_INTERVAL) {
          this.dustTimer = 0;
          this.spawnFootDust(sprite.x, sprite.y + 4);
        }
      } else if (entity.animState === 'walk') {
        entity.animState = 'idle';
        sprite.play(`${entity.animPrefix}-idle`);
      }

      entity.prevWorldX = entity.worldX;
      entity.prevWorldY = entity.worldY;
    }
  }

  /** Spawn a small dust puff at the character's feet */
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

  /** Update positions, depth, and animations in one call */
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
