/** @entry Chunk World Generator - biome-based infinite map generation */

import type { TileData } from '../types';
import {
  TILE_EMPTY, TILE_GRASS, TILE_GRASS_DARK, TILE_SAND, TILE_DEEP_WATER,
  TILE_SHALLOW_WATER, TILE_MOUNTAIN, TILE_MOUNTAIN_PATH,
  TILE_OBSTACLE_ROCK, TILE_OBSTACLE_TREE,
  DECO_FLOWER, DECO_BUSH, DECO_TORCH,
} from '../types';
import type { ChunkData, ChunkCoord, Biome, TerrainBand, DecorationRule } from './chunkManager';
import { CHUNK_SIZE } from './chunkManager';

function createRng(seed: number) {
  let s = seed;
  return {
    next(): number {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}

function buildPermTable(rng: ReturnType<typeof createRng>): number[] {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad2d(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : -x;
  const v = h === 0 || h === 3 ? y : -y;
  return u + v;
}

function noise2d(perm: number[], x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];

  return lerp(
    lerp(grad2d(aa, xf, yf), grad2d(ba, xf - 1, yf), u),
    lerp(grad2d(ab, xf, yf - 1), grad2d(bb, xf - 1, yf - 1), u),
    v,
  );
}

function fbm(
  perm: number[], x: number, y: number,
  octaves = 4, lacunarity = 2.0, gain = 0.5,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2d(perm, x * frequency, y * frequency);
    maxAmp += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return (value / maxAmp + 1) * 0.5;
}

const BIOMES: Biome[] = [
  {
    id: 'deep_ocean',
    name: 'Deep Ocean',
    heightRange: [0, 0.20],
    moistureRange: [0, 1],
    terrainBands: [
      { maxHeight: 0.20, tile: TILE_DEEP_WATER, walkable: false },
    ],
    decorationRules: [],
    color: 0x000080,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    heightRange: [0.20, 0.35],
    moistureRange: [0, 1],
    terrainBands: [
      { maxHeight: 0.30, tile: TILE_SHALLOW_WATER, walkable: false },
      { maxHeight: 0.35, tile: TILE_SAND, walkable: true },
    ],
    decorationRules: [],
    color: 0x006994,
  },
  {
    id: 'grassland',
    name: 'Grassland',
    heightRange: [0.35, 0.50],
    moistureRange: [0.3, 0.7],
    terrainBands: [
      { maxHeight: 0.45, tile: TILE_GRASS, walkable: true },
      { maxHeight: 0.50, tile: TILE_GRASS_DARK, walkable: true },
    ],
    decorationRules: [
      { type: TILE_OBSTACLE_TREE, density: 0.04, minHeight: 0.35, maxHeight: 0.50 },
      { type: DECO_FLOWER, density: 0.03, minHeight: 0.40, maxHeight: 0.50 },
    ],
    color: 0x228b22,
  },
  {
    id: 'forest',
    name: 'Forest',
    heightRange: [0.45, 0.65],
    moistureRange: [0.6, 1],
    terrainBands: [
      { maxHeight: 0.50, tile: TILE_GRASS, walkable: true },
      { maxHeight: 0.65, tile: TILE_GRASS_DARK, walkable: true },
    ],
    decorationRules: [
      { type: TILE_OBSTACLE_TREE, density: 0.12, minHeight: 0.45, maxHeight: 0.65 },
      { type: DECO_BUSH, density: 0.05, minHeight: 0.45, maxHeight: 0.60 },
    ],
    color: 0x006400,
  },
  {
    id: 'desert',
    name: 'Desert',
    heightRange: [0.30, 0.50],
    moistureRange: [0, 0.3],
    terrainBands: [
      { maxHeight: 0.45, tile: TILE_SAND, walkable: true },
      { maxHeight: 0.50, tile: TILE_GRASS, walkable: true },
    ],
    decorationRules: [],
    color: 0xc2b280,
  },
  {
    id: 'highland',
    name: 'Highland',
    heightRange: [0.60, 0.80],
    moistureRange: [0.2, 0.8],
    terrainBands: [
      { maxHeight: 0.70, tile: TILE_GRASS_DARK, walkable: true },
      { maxHeight: 0.80, tile: TILE_MOUNTAIN_PATH, walkable: true },
    ],
    decorationRules: [
      { type: TILE_OBSTACLE_ROCK, density: 0.04, minHeight: 0.60, maxHeight: 0.80 },
    ],
    color: 0x8fbc8f,
  },
  {
    id: 'mountain',
    name: 'Mountain',
    heightRange: [0.80, 1.0],
    moistureRange: [0, 1],
    terrainBands: [
      { maxHeight: 0.90, tile: TILE_MOUNTAIN_PATH, walkable: true },
      { maxHeight: 1.01, tile: TILE_MOUNTAIN, walkable: false },
    ],
    decorationRules: [
      { type: TILE_OBSTACLE_ROCK, density: 0.08, minHeight: 0.80, maxHeight: 0.95 },
    ],
    color: 0x808080,
  },
];

function findBiome(height: number, moisture: number): Biome {
  for (const biome of BIOMES) {
    if (height >= biome.heightRange[0] && height < biome.heightRange[1]) {
      return biome;
    }
  }
  return BIOMES[2]; // grassland fallback
}

function classifyTerrain(biome: Biome, h: number): TerrainBand {
  for (const band of biome.terrainBands) {
    if (h < band.maxHeight) return band;
  }
  return biome.terrainBands[biome.terrainBands.length - 1];
}

interface RiverSegment {
  points: { x: number; y: number }[];
  width: number;
  depth: number;
}

function computeGradient(perm: number[], x: number, y: number, scale: number): { dx: number; dy: number } {
  const eps = 0.01;
  const hCenter = fbm(perm, x * scale, y * scale, 4);
  const hRight = fbm(perm, (x + eps) * scale, y * scale, 4);
  const hUp = fbm(perm, x * scale, (y + eps) * scale, 4);
  return {
    dx: (hRight - hCenter) / eps,
    dy: (hUp - hCenter) / eps,
  };
}

function findLowestNeighbor(
  perm: number[], wx: number, wy: number, scale: number, visited: Set<string>
): { x: number; y: number } | null {
  const candidates: { x: number; y: number; h: number }[] = [];
  const baseH = fbm(perm, wx * scale, wy * scale, 4);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const key = `${wx + dx},${wy + dy}`;
      if (visited.has(key)) continue;

      const h = fbm(perm, (wx + dx) * scale, (wy + dy) * scale, 4);
      if (h < baseH) {
        candidates.push({ x: dx, y: dy, h });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.h - b.h);
  return { x: candidates[0].x, y: candidates[0].y };
}

function generateRiverFromSource(
  perm: number[], sourceX: number, sourceY: number,
  worldOffsetX: number, worldOffsetY: number,
  chunkCX: number, chunkCY: number,
  maxLength: number = 32,
): RiverSegment | null {
  const visited = new Set<string>();
  const points: { x: number; y: number }[] = [];
  const scale = 0.015;

  let wx = sourceX;
  let wy = sourceY;
  let width = 1;

  for (let i = 0; i < maxLength; i++) {
    const localX = wx - worldOffsetX - chunkCX * CHUNK_SIZE;
    const localY = wy - worldOffsetY - chunkCY * CHUNK_SIZE;

    if (localX >= -2 && localX < CHUNK_SIZE + 2 && localY >= -2 && localY < CHUNK_SIZE + 2) {
      points.push({ x: localX, y: localY });
    }

    if (localX < -5 || localX > CHUNK_SIZE + 5 || localY < -5 || localY > CHUNK_SIZE + 5) {
      break;
    }

    visited.add(`${wx},${wy}`);

    const next = findLowestNeighbor(perm, wx, wy, scale, visited);
    if (!next) break;

    const turbulence = noise2d(perm, wx * 0.1, wy * 0.1);
    wx += next.x + turbulence * 0.5;
    wy += next.y + turbulence * 0.3;

    if (Math.random() < 0.03 && width < 3) {
      width++;
    }
  }

  if (points.length < 4) return null;

  const depth = 0.3 + Math.random() * 0.4;
  return { points, width, depth };
}

function generateRiverPath(
  perm: number[], worldOffsetX: number, worldOffsetY: number,
  chunkCX: number, chunkCY: number,
): RiverSegment[] {
  const rivers: RiverSegment[] = [];
  const scale = 0.02;

  for (let attempt = 0; attempt < 5; attempt++) {
    const seedOffset = attempt * 1000 + chunkCX * 317 + chunkCY * 743;
    const sourceNoise = noise2d(perm, seedOffset * 0.1, 0);

    if (sourceNoise > 0.3) {
      const sourceX = (noise2d(perm, seedOffset, 100) * 2 - 1) * 0.5 + 0.5;
      const sourceY = (noise2d(perm, seedOffset, 200) * 2 - 1) * 0.5 + 0.5;

      const worldSourceX = worldOffsetX + chunkCX * CHUNK_SIZE + sourceX * CHUNK_SIZE * 2;
      const worldSourceY = worldOffsetY + chunkCY * CHUNK_SIZE + sourceY * CHUNK_SIZE * 2;

      const h = fbm(perm, worldSourceX * scale, worldSourceY * scale, 4);
      if (h > 0.3 && h < 0.6) {
        const river = generateRiverFromSource(
          perm, worldSourceX, worldSourceY,
          worldOffsetX, worldOffsetY,
          chunkCX, chunkCY,
          40 + Math.floor(noise2d(perm, seedOffset, 300) * 20),
        );
        if (river) {
          rivers.push(river);
        }
      }
    }
  }

  return rivers;
}

export class ChunkWorldGenerator {
  private seed: number;
  private permHeight: number[];
  private permMoisture: number[];
  private permDetail: number[];

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    const rng = createRng(this.seed);
    this.permHeight = buildPermTable(rng);
    this.permMoisture = buildPermTable(rng);
    this.permDetail = buildPermTable(rng);
  }

  getBiomeAt(worldX: number, worldY: number): Biome {
    const scale = 0.02;
    const h = fbm(this.permHeight, worldX * scale, worldY * scale, 4);
    const m = fbm(this.permMoisture, worldX * scale + 500, worldY * scale + 500, 4);
    return findBiome(h, m);
  }

  async generateChunk(coord: ChunkCoord): Promise<ChunkData> {
    const worldOffsetX = coord.cx * CHUNK_SIZE;
    const worldOffsetY = coord.cy * CHUNK_SIZE;
    
    const chunkSeed = this.seed + coord.cx * 73856093 + coord.cy * 19349663;
    const rng = createRng(chunkSeed);
    
    const heightMap: number[][] = [];
    const moistureMap: number[][] = [];
    const biomeMap: Biome[][] = [];
    
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      heightMap[ly] = [];
      moistureMap[ly] = [];
      biomeMap[ly] = [];
      
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = worldOffsetX + lx;
        const wy = worldOffsetY + ly;
        
        const h = fbm(this.permHeight, wx * 0.02, wy * 0.02, 4);
        const m = fbm(this.permMoisture, wx * 0.02 + 500, wy * 0.02 + 500, 4);
        
        heightMap[ly][lx] = h;
        moistureMap[ly][lx] = m;
        biomeMap[ly][lx] = findBiome(h, m);
      }
    }
    
    const ground: TileData[][] = Array.from({ length: CHUNK_SIZE }, () =>
      Array.from({ length: CHUNK_SIZE }, () => ({ type: TILE_EMPTY, walkable: true })),
    );
    const obstacles: TileData[][] = Array.from({ length: CHUNK_SIZE }, () =>
      Array.from({ length: CHUNK_SIZE }, () => ({ type: TILE_EMPTY, walkable: true })),
    );
    const decorations: TileData[][] = Array.from({ length: CHUNK_SIZE }, () =>
      Array.from({ length: CHUNK_SIZE }, () => ({ type: TILE_EMPTY, walkable: true })),
    );
    
    const rivers = generateRiverPath(
      this.permHeight, worldOffsetX, worldOffsetY,
      coord.cx, coord.cy,
    );

    const riverCells = new Map<string, { width: number; depth: number }>();
    for (const river of rivers) {
      for (const p of river.points) {
        const key = `${Math.floor(p.x)},${Math.floor(p.y)}`;
        riverCells.set(key, { width: river.width, depth: river.depth });
      }
    }

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const biome = biomeMap[ly][lx];
        const h = heightMap[ly][lx];
        const m = moistureMap[ly][lx];
        
        const cellKey = `${lx},${ly}`;
        const riverInfo = riverCells.get(cellKey);
        
        let isRiver = false;
        let isRiverBank = false;
        let tile: number;
        let walkable: boolean;
        
        if (riverInfo) {
          if (biome.id === 'desert') {
            tile = TILE_SAND;
            walkable = true;
            isRiver = false;
          } else {
            isRiver = true;
          }
        } else {
          for (const river of rivers) {
            for (const p of river.points) {
              const dist = Math.sqrt((p.x - lx) ** 2 + (p.y - ly) ** 2);
              if (dist < river.width + 1.5 && dist >= river.width) {
                isRiverBank = true;
                break;
              }
            }
            if (isRiverBank) break;
          }
        }
        
        if (isRiver) {
          tile = TILE_SHALLOW_WATER;
          walkable = false;
        } else if (isRiverBank) {
          if (biome.id === 'ocean' || biome.id === 'deep_ocean') {
            tile = TILE_SAND;
          } else if (biome.id === 'grassland' || biome.id === 'forest') {
            tile = TILE_GRASS_DARK;
          } else {
            tile = classifyTerrain(biome, h).tile;
          }
          walkable = true;
        } else {
          const band = classifyTerrain(biome, h);
          tile = band.tile;
          walkable = band.walkable;
        }
        
        ground[ly][lx] = { type: tile, walkable, variant: rng.nextInt(0, 3) };
        
        if (walkable && !isRiverBank) {
          for (const rule of biome.decorationRules) {
            if (h >= rule.minHeight && h < rule.maxHeight && rng.next() < rule.density) {
              obstacles[ly][lx] = { type: rule.type, walkable: false };
              break;
            }
          }
        }
      }
    }
    
    let dominantBiome = BIOMES[2];
    let maxCount = 0;
    const biomeCounts = new Map<string, number>();
    
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const bid = biomeMap[ly][lx].id;
        biomeCounts.set(bid, (biomeCounts.get(bid) || 0) + 1);
      }
    }
    
    for (const [bid, count] of biomeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantBiome = BIOMES.find(b => b.id === bid) || BIOMES[2];
      }
    }
    
    return {
      coord,
      ground,
      obstacles,
      decorations,
      heightMap,
      biomeId: dominantBiome.id,
      generated: true,
      lastAccess: Date.now(),
    };
  }
}
