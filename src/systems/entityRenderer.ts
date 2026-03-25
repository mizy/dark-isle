/** @entry EntityRenderer - depth-sorted entity rendering */

import type { Entity } from '../types';
import { calcDepth } from './isometric';

const ENTITY_DEPTH_OFFSET = 1000;

export class EntityRenderer {
  private entities: Map<string, Entity> = new Map();

  /** Register an entity for depth-sorted rendering */
  add(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  /** Remove an entity */
  remove(id: string): void {
    this.entities.delete(id);
  }

  /** Get entity by id */
  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Update depth for all entities based on world position.
   * Call this every frame to ensure correct front-to-back ordering.
   * Entities use a depth offset so they render above tiles.
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
    }
  }

  /** Update both positions and depth in one call */
  update(worldToScreenFn: (wx: number, wy: number) => { sx: number; sy: number }): void {
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
