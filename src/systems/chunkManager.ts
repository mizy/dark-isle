/** @entry Chunk Manager - infinite map system with dynamic loading/unloading */

import type { TileData, WorldGeneratorResult } from '../types';
import { TILE_EMPTY } from '../types';

export const CHUNK_SIZE = 16;
export const CHUNK_VIEW_DISTANCE = 3;
export const CHUNK_UNLOAD_DISTANCE = 5;
export const MAX_CACHED_CHUNKS = 64;

export interface ChunkCoord {
  cx: number;
  cy: number;
}

export interface ViewportBounds {
  minCX: number;
  maxCX: number;
  minCY: number;
  maxCY: number;
}

export interface ChunkData {
  coord: ChunkCoord;
  ground: TileData[][];
  obstacles: TileData[][];
  decorations: TileData[][];
  heightMap: number[][];
  biomeId: string;
  generated: boolean;
  lastAccess: number;
}

function coordKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function parseKey(key: string): ChunkCoord {
  const [cx, cy] = key.split(',').map(Number);
  return { cx, cy };
}

export class ChunkManager {
  private chunks: Map<string, ChunkData> = new Map();
  private accessOrder: string[] = [];
  private generator: IWorldGenerator;
  private preloadRadius = CHUNK_VIEW_DISTANCE + 1;
  private unloadRadius = CHUNK_UNLOAD_DISTANCE;

  constructor(generator: IWorldGenerator) {
    this.generator = generator;
  }

  setPreloadRadius(radius: number): void {
    this.preloadRadius = radius;
  }

  setUnloadRadius(radius: number): void {
    this.unloadRadius = radius;
  }

  calculateViewportBounds(worldX: number, worldY: number, viewWidth: number, viewHeight: number): ViewportBounds {
    const playerCX = worldToChunkCoord(worldX, worldY).cx;
    const playerCY = worldToChunkCoord(worldX, worldY).cy;
    const viewChunksX = Math.ceil(viewWidth / (CHUNK_SIZE * 66)) + 2;
    const viewChunksY = Math.ceil(viewHeight / (CHUNK_SIZE * 33)) + 2;

    return {
      minCX: playerCX - viewChunksX,
      maxCX: playerCX + viewChunksX,
      minCY: playerCY - viewChunksY,
      maxCY: playerCY + viewChunksY,
    };
  }

  getChunksInRadius(cx: number, cy: number, radius: number): ChunkCoord[] {
    const chunks: ChunkCoord[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        chunks.push({ cx: cx + dx, cy: cy + dy });
      }
    }
    return chunks;
  }

  getPreloadChunks(worldX: number, worldY: number): ChunkCoord[] {
    const playerCX = worldToChunkCoord(worldX, worldY).cx;
    const playerCY = worldToChunkCoord(worldX, worldY).cy;
    return this.getChunksInRadius(playerCX, playerCY, this.preloadRadius);
  }

  getChunksToUnload(worldX: number, worldY: number): ChunkCoord[] {
    const playerCX = worldToChunkCoord(worldX, worldY).cx;
    const playerCY = worldToChunkCoord(worldX, worldY).cy;
    const loaded = this.getLoadedChunks();
    return loaded.filter(coord => {
      const dx = Math.abs(coord.cx - playerCX);
      const dy = Math.abs(coord.cy - playerCY);
      return dx > this.unloadRadius || dy > this.unloadRadius;
    });
  }

  isInViewRange(checkCX: number, checkCY: number, worldX: number, worldY: number): boolean {
    const playerCX = worldToChunkCoord(worldX, worldY).cx;
    const playerCY = worldToChunkCoord(worldX, worldY).cy;
    const dx = Math.abs(checkCX - playerCX);
    const dy = Math.abs(checkCY - playerCY);
    return dx <= this.preloadRadius && dy <= this.preloadRadius;
  }

  private evictOldest(): void {
    while (this.chunks.size >= MAX_CACHED_CHUNKS && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      this.chunks.delete(oldestKey);
    }
  }

  private touch(cx: number, cy: number): void {
    const key = coordKey(cx, cy);
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
    
    const chunk = this.chunks.get(key);
    if (chunk) chunk.lastAccess = Date.now();
  }

  async getChunk(cx: number, cy: number): Promise<ChunkData> {
    const key = coordKey(cx, cy);
    const existing = this.chunks.get(key);
    
    if (existing) {
      this.touch(cx, cy);
      return existing;
    }

    this.evictOldest();
    
    const chunk = await this.generator.generateChunk({ cx, cy });
    this.chunks.set(key, chunk);
    this.accessOrder.push(key);
    return chunk;
  }

  hasChunk(cx: number, cy: number): boolean {
    return this.chunks.has(coordKey(cx, cy));
  }

  getLoadedChunks(): ChunkCoord[] {
    return Array.from(this.chunks.keys()).map(parseKey);
  }

  unloadChunk(cx: number, cy: number): void {
    const key = coordKey(cx, cy);
    this.chunks.delete(key);
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
  }

  unloadDistant(playerCX: number, playerCY: number): void {
    const toUnload: string[] = [];
    
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.coord.cx - playerCX);
      const dy = Math.abs(chunk.coord.cy - playerCY);
      if (dx > CHUNK_UNLOAD_DISTANCE || dy > CHUNK_UNLOAD_DISTANCE) {
        toUnload.push(key);
      }
    }
    
    for (const key of toUnload) {
      this.chunks.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx !== -1) this.accessOrder.splice(idx, 1);
    }
  }
}

export interface IWorldGenerator {
  generateChunk(coord: ChunkCoord): Promise<ChunkData>;
  getBiomeAt(worldX: number, worldY: number): Biome;
}

export interface Biome {
  id: string;
  name: string;
  heightRange: [number, number];
  moistureRange: [number, number];
  terrainBands: TerrainBand[];
  decorationRules: DecorationRule[];
  color: number;
}

export interface TerrainBand {
  maxHeight: number;
  tile: number;
  walkable: boolean;
}

export interface DecorationRule {
  type: number;
  density: number;
  minHeight: number;
  maxHeight: number;
}

export function worldToChunkCoord(worldX: number, worldY: number): ChunkCoord {
  return {
    cx: Math.floor(worldX / CHUNK_SIZE),
    cy: Math.floor(worldY / CHUNK_SIZE),
  };
}

export function worldToLocalCoord(worldX: number, worldY: number): { lx: number; ly: number } {
  const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return { lx, ly };
}

export function chunkCoordToWorld(cx: number, cy: number): { wx: number; wy: number } {
  return {
    wx: cx * CHUNK_SIZE,
    wy: cy * CHUNK_SIZE,
  };
}
