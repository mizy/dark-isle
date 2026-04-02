/** @entry Chunk-based TileMap - dynamic loading/unloading for infinite map */

import Phaser from 'phaser';
import type { TileData, TileMapConfig } from '../types';
import { TILE_SHALLOW_WATER } from '../types';
import { worldToScreen, calcDepth, TILE_WIDTH, TILE_HEIGHT } from './isometric';
import { TERRAIN_BLEND_COLORS } from '../assets/textureGenerator';
import type { ChunkData } from './chunkManager';
import { CHUNK_SIZE, worldToChunkCoord, worldToLocalCoord } from './chunkManager';

export type LayerMode = 'ground' | 'obstacle' | 'decoration';

interface TileAnimConfig {
  animKey: string;
  textureKey: string;
}

export class ChunkTileMap {
  private textureMap: Map<number, string[]> = new Map();
  private animMap: Map<number, TileAnimConfig> = new Map();
  private chunkRenderGroups: Map<string, Phaser.GameObjects.Group> = new Map();
  private chunkDataMap: Map<string, ChunkData> = new Map();
  private loadedChunks: Set<string> = new Set();

  constructor() {}

  setTileTexture(type: number, ...textureKeys: string[]): void {
    this.textureMap.set(type, textureKeys);
  }

  setTileAnimation(type: number, animKey: string, textureKey: string): void {
    this.animMap.set(type, { animKey, textureKey });
  }

  private getTextureKey(tile: TileData): string | null {
    const keys = this.textureMap.get(tile.type);
    if (!keys || keys.length === 0) return null;
    if (keys.length === 1) return keys[0];
    const idx = (tile.variant ?? 0) % keys.length;
    return keys[idx];
  }

  renderChunk(scene: Phaser.Scene, chunk: ChunkData, mode: LayerMode = 'ground'): void {
    const key = `${chunk.coord.cx},${chunk.coord.cy}`;
    
    const existing = this.chunkRenderGroups.get(key);
    if (existing) existing.destroy(true);

    const group = scene.add.group();
    const layers = [chunk.ground, chunk.obstacles, chunk.decorations];
    const layerModes: LayerMode[] = ['ground', 'obstacle', 'decoration'];

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];
      const currentMode = layerModes[layerIdx];

      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const tile = layer[y][x];
          if (tile.type === -1) continue;

          const worldX = chunk.coord.cx * CHUNK_SIZE + x;
          const worldY = chunk.coord.cy * CHUNK_SIZE + y;
          const { sx, sy } = worldToScreen(worldX, worldY);

          const anim = this.animMap.get(tile.type);
          const texKey = anim ? anim.textureKey : this.getTextureKey(tile);
          if (!texKey) continue;

          let obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
          if (anim) {
            const sprite = scene.add.sprite(sx, sy, texKey);
            sprite.play(anim.animKey);
            sprite.anims.setProgress(Math.random());
            obj = sprite;
          } else {
            obj = scene.add.image(sx, sy, texKey);
          }

          const baseDepth = calcDepth(worldX, worldY);
          const scale = TILE_WIDTH / obj.width;
          obj.setScale(scale);

          if (currentMode === 'ground') {
            obj.setOrigin(0.5, 0.40);
            obj.setDepth(baseDepth + layerIdx * 0.1);
          } else if (currentMode === 'obstacle') {
            obj.setOrigin(0.5, 0.85);
            obj.setDepth(baseDepth + layerIdx * 0.1);
            const shadow = scene.add.ellipse(
              sx + TILE_WIDTH * 0.12,
              sy + TILE_HEIGHT * 0.15,
              TILE_WIDTH * 0.35 * scale,
              TILE_HEIGHT * 0.2 * scale,
              0x000000,
              0.25,
            );
            shadow.setDepth(baseDepth + layerIdx * 0.1 - 0.01);
            group.add(shadow);
          } else {
            obj.setOrigin(0.5, 0.75);
            obj.setDepth(baseDepth + layerIdx * 0.1 + 0.05);
          }
          group.add(obj);
        }
      }
    }

    this.renderRiverEdges(scene, chunk, group);
    this.chunkRenderGroups.set(key, group);
    this.chunkDataMap.set(key, chunk);
    this.loadedChunks.add(key);
  }

  private renderRiverEdges(scene: Phaser.Scene, chunk: ChunkData, group: Phaser.GameObjects.Group): void {
    const ground = chunk.ground;
    const neighbors: Array<[number, number, string]> = [
      [0, -1, 'edge-ne'],
      [1, 0, 'edge-se'],
      [0, 1, 'edge-sw'],
      [-1, 0, 'edge-nw'],
    ];

    const waterTypes = new Set([TILE_SHALLOW_WATER]);

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = ground[y][x];
        if (!waterTypes.has(tile.type)) continue;

        for (const [dx, dy, edgeKey] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;

          let neighborType = -1;
          if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_SIZE) {
            neighborType = ground[ny][nx].type;
          }

          if (!waterTypes.has(neighborType) && neighborType !== -1) {
            const worldX = chunk.coord.cx * CHUNK_SIZE + x;
            const worldY = chunk.coord.cy * CHUNK_SIZE + y;
            const { sx, sy } = worldToScreen(worldX, worldY);

            const overlay = scene.add.image(sx, sy, edgeKey);
            overlay.setOrigin(0.5, 0.40);
            const scale = TILE_WIDTH / overlay.width;
            overlay.setScale(scale);
            overlay.setTint(TERRAIN_BLEND_COLORS[neighborType] ?? 0x8B4513);
            overlay.setDepth(calcDepth(worldX, worldY) + 0.02);
            group.add(overlay);
          }
        }
      }
    }
  }

  unloadChunk(scene: Phaser.Scene, cx: number, cy: number): void {
    const key = `${cx},${cy}`;
    const existing = this.chunkRenderGroups.get(key);
    if (existing) {
      existing.destroy(true);
      this.chunkRenderGroups.delete(key);
    }
    this.chunkDataMap.delete(key);
    this.loadedChunks.delete(key);
  }

  unloadAll(scene: Phaser.Scene): void {
    for (const [key, group] of this.chunkRenderGroups) {
      group.destroy(true);
    }
    this.chunkRenderGroups.clear();
    this.loadedChunks.clear();
  }

  isChunkLoaded(cx: number, cy: number): boolean {
    return this.loadedChunks.has(`${cx},${cy}`);
  }

  getLoadedChunkCoords(): { cx: number; cy: number }[] {
    return Array.from(this.loadedChunks).map(key => {
      const [cx, cy] = key.split(',').map(Number);
      return { cx, cy };
    });
  }

  isWalkable(worldX: number, worldY: number): boolean {
    const { cx, cy } = worldToChunkCoord(worldX, worldY);
    const key = `${cx},${cy}`;
    const chunkData = this.chunkDataMap.get(key);
    if (!chunkData) return false;

    const { lx, ly } = worldToLocalCoord(worldX, worldY);
    const g = chunkData.ground[ly]?.[lx];
    const o = chunkData.obstacles[ly]?.[lx];
    const d = chunkData.decorations[ly]?.[lx];

    return (g?.walkable ?? true) && (o?.type === -1 || o?.walkable !== false) && (d?.type === -1 || d?.walkable !== false);
  }

  destroy(): void {
    this.chunkRenderGroups.forEach((g) => g.destroy(true));
    this.chunkRenderGroups.clear();
    this.chunkDataMap.clear();
    this.loadedChunks.clear();
  }
}
