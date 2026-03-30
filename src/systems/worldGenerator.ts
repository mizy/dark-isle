/** @entry World map generator - produces large terrain via noise-based heightmap */

import type { TileData, WorldGeneratorResult } from '../types';
import {
  TILE_EMPTY, TILE_GRASS, TILE_GRASS_DARK, TILE_SAND, TILE_DEEP_WATER,
  TILE_MOUNTAIN, TILE_MOUNTAIN_PATH, TILE_TOWN_ROAD, TILE_VILLAGE_DIRT,
  TILE_FARMLAND, TILE_MANOR_FLOOR, TILE_OBSTACLE_ROCK, TILE_OBSTACLE_TREE,
  DECO_HOUSE, DECO_SHOP, DECO_FENCE, DECO_CABIN,
  DECO_MANOR_WALL, DECO_MANOR_BUILDING, DECO_CITY_WALL,
  DECO_FLOWER, DECO_BUSH,
} from '../types';

// --- Seedable RNG (same as dungeonGenerator) ---

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

// --- 2D Value Noise with permutation table ---

function buildPermTable(rng: ReturnType<typeof createRng>): number[] {
  const p = Array.from({ length: 256 }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p]; // double for overflow
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

/** Fractal Brownian Motion - layered noise */
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

  // Normalize to 0-1
  return (value / maxAmp + 1) * 0.5;
}

// --- Terrain classification ---

interface TerrainBand {
  maxHeight: number;
  tile: number;
  walkable: boolean;
}

const TERRAIN_BANDS: TerrainBand[] = [
  { maxHeight: 0.20, tile: TILE_DEEP_WATER, walkable: false },
  { maxHeight: 0.30, tile: TILE_SAND, walkable: true },
  { maxHeight: 0.55, tile: TILE_GRASS, walkable: true },
  { maxHeight: 0.65, tile: TILE_GRASS_DARK, walkable: true },
  { maxHeight: 0.80, tile: TILE_MOUNTAIN_PATH, walkable: true },
  { maxHeight: 1.01, tile: TILE_MOUNTAIN, walkable: false },
];

function classifyTerrain(h: number): TerrainBand {
  for (const band of TERRAIN_BANDS) {
    if (h < band.maxHeight) return band;
  }
  return TERRAIN_BANDS[TERRAIN_BANDS.length - 1];
}

// --- Transition tiles for smooth borders ---

function applyTransition(
  ground: TileData[][], heightMap: number[][],
  w: number, h: number, rng: ReturnType<typeof createRng>,
): void {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const cur = heightMap[y][x];
      const tile = ground[y][x];
      // Sand-grass transition
      if (tile.type === TILE_GRASS && cur < 0.35) {
        // Near sand border, use lighter grass variant
        ground[y][x] = { ...tile, variant: 2 };
      }
      // Grass-mountain transition
      if (tile.type === TILE_MOUNTAIN_PATH && cur < 0.70) {
        ground[y][x] = { ...tile, variant: 1 };
      }
      // Add variant diversity
      if (tile.variant === undefined) {
        ground[y][x] = { ...tile, variant: rng.nextInt(0, 2) };
      }
    }
  }
}

// --- Town placement ---

interface Zone { cx: number; cy: number; radius: number }

function findTownCenter(
  heightMap: number[][], w: number, h: number,
  perm2: number[], rng: ReturnType<typeof createRng>,
): Zone | null {
  // Use second noise layer to score candidate positions
  let bestScore = -1;
  let best: Zone | null = null;
  const radius = 5;

  for (let attempt = 0; attempt < 40; attempt++) {
    const cx = rng.nextInt(radius + 2, w - radius - 3);
    const cy = rng.nextInt(radius + 2, h - radius - 3);
    const ch = heightMap[cy][cx];

    // Must be in 0.35-0.55 height range (flat grassland)
    if (ch < 0.35 || ch > 0.55) continue;

    // Check flatness: all cells in radius should be walkable terrain
    let flat = true;
    let totalH = 0;
    let count = 0;
    for (let dy = -radius; dy <= radius && flat; dy++) {
      for (let dx = -radius; dx <= radius && flat; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const h2 = heightMap[cy + dy][cx + dx];
        if (h2 < 0.25 || h2 > 0.70) flat = false;
        totalH += h2;
        count++;
      }
    }
    if (!flat) continue;

    const avgH = totalH / count;
    const nv = fbm(perm2, cx * 0.1, cy * 0.1, 2);
    const score = nv + (1 - Math.abs(avgH - 0.45) * 4);
    if (score > bestScore) {
      bestScore = score;
      best = { cx, cy, radius };
    }
  }
  return best;
}

function placeTown(
  town: Zone, ground: TileData[][], obstacles: TileData[][],
  decorations: TileData[][], rng: ReturnType<typeof createRng>,
  w: number, h: number,
): void {
  const { cx, cy, radius } = town;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const tx = cx + dx, ty = cy + dy;
      if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;

      // City wall on perimeter
      if (dist > radius - 1.2) {
        decorations[ty][tx] = { type: DECO_CITY_WALL, walkable: false };
        obstacles[ty][tx] = { type: TILE_EMPTY, walkable: false };
        ground[ty][tx] = { type: TILE_TOWN_ROAD, walkable: true, variant: 0 };
        continue;
      }

      ground[ty][tx] = { type: TILE_TOWN_ROAD, walkable: true, variant: rng.nextInt(0, 2) };
      obstacles[ty][tx] = { type: TILE_EMPTY, walkable: true };

      // Place buildings away from center
      if (dist > 2 && dist < radius - 2 && rng.next() < 0.25) {
        const deco = rng.next() < 0.7 ? DECO_HOUSE : DECO_SHOP;
        decorations[ty][tx] = { type: deco, walkable: false };
        obstacles[ty][tx] = { type: TILE_EMPTY, walkable: false };
      }
    }
  }

  // Clear center area for player spawn
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx, ty = cy + dy;
      if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
        decorations[ty][tx] = { type: TILE_EMPTY, walkable: true };
        obstacles[ty][tx] = { type: TILE_EMPTY, walkable: true };
      }
    }
  }
}

// --- Village placement ---

function placeVillage(
  heightMap: number[][], ground: TileData[][], obstacles: TileData[][],
  decorations: TileData[][], townCenter: Zone,
  rng: ReturnType<typeof createRng>, w: number, h: number,
): void {
  // Find a spot near town in 0.45-0.60 height
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = townCenter.radius + rng.nextInt(5, 12);
    const vx = Math.round(townCenter.cx + Math.cos(angle) * dist);
    const vy = Math.round(townCenter.cy + Math.sin(angle) * dist);

    if (vx < 3 || vx >= w - 3 || vy < 3 || vy >= h - 3) continue;
    const vh = heightMap[vy][vx];
    if (vh < 0.40 || vh > 0.60) continue;

    const vRadius = 3;
    for (let dy = -vRadius; dy <= vRadius; dy++) {
      for (let dx = -vRadius; dx <= vRadius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > vRadius + 1) continue;
        const tx = vx + dx, ty = vy + dy;
        if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;

        ground[ty][tx] = { type: TILE_FARMLAND, walkable: true, variant: rng.nextInt(0, 2) };
        obstacles[ty][tx] = { type: TILE_EMPTY, walkable: true };

        // Fence on border
        if (Math.abs(dx) + Math.abs(dy) === vRadius + 1) {
          decorations[ty][tx] = { type: DECO_FENCE, walkable: false };
          obstacles[ty][tx] = { type: TILE_EMPTY, walkable: false };
        } else if (rng.next() < 0.15) {
          decorations[ty][tx] = { type: DECO_CABIN, walkable: false };
          obstacles[ty][tx] = { type: TILE_EMPTY, walkable: false };
        }
      }
    }
    return; // placed one village
  }
}

// --- Manor placement ---

function placeManor(
  heightMap: number[][], ground: TileData[][], obstacles: TileData[][],
  decorations: TileData[][], rng: ReturnType<typeof createRng>,
  w: number, h: number,
): void {
  for (let attempt = 0; attempt < 30; attempt++) {
    const mx = rng.nextInt(5, w - 6);
    const my = rng.nextInt(5, h - 6);
    const mh = heightMap[my][mx];
    if (mh < 0.55 || mh > 0.70) continue;

    const mRadius = 3;
    for (let dy = -mRadius; dy <= mRadius; dy++) {
      for (let dx = -mRadius; dx <= mRadius; dx++) {
        const tx = mx + dx, ty = my + dy;
        if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;

        ground[ty][tx] = { type: TILE_MANOR_FLOOR, walkable: true, variant: rng.nextInt(0, 2) };
        obstacles[ty][tx] = { type: TILE_EMPTY, walkable: true };

        // Wall on border
        if (Math.abs(dx) === mRadius || Math.abs(dy) === mRadius) {
          decorations[ty][tx] = { type: DECO_MANOR_WALL, walkable: false };
          obstacles[ty][tx] = { type: TILE_EMPTY, walkable: false };
        } else if (dx === 0 && dy === 0) {
          decorations[ty][tx] = { type: DECO_MANOR_BUILDING, walkable: false };
          obstacles[ty][tx] = { type: TILE_EMPTY, walkable: false };
        }
      }
    }
    return; // placed one manor
  }
}

// --- Enemy spawn placement ---

function placeEnemySpawns(
  heightMap: number[][], obstacles: TileData[][],
  rng: ReturnType<typeof createRng>, w: number, h: number,
  townCenter: Zone,
): { x: number; y: number }[] {
  const spawns: { x: number; y: number }[] = [];
  const minDist = 8; // minimum distance from town

  for (let attempt = 0; attempt < 200 && spawns.length < 20; attempt++) {
    const x = rng.nextInt(2, w - 3);
    const y = rng.nextInt(2, h - 3);
    const h2 = heightMap[y][x];

    // Mountain edge (0.72-0.82) or grassland (0.32-0.50)
    const isMtnEdge = h2 >= 0.72 && h2 <= 0.82;
    const isGrass = h2 >= 0.32 && h2 <= 0.50;
    if (!isMtnEdge && !isGrass) continue;

    // Not too close to town
    const dx = x - townCenter.cx;
    const dy = y - townCenter.cy;
    if (Math.sqrt(dx * dx + dy * dy) < minDist) continue;

    // Must be walkable
    if (!obstacles[y][x].walkable) continue;

    // Not too close to other spawns
    const tooClose = spawns.some(s =>
      Math.abs(s.x - x) + Math.abs(s.y - y) < 4,
    );
    if (tooClose) continue;

    spawns.push({ x, y });
  }

  return spawns;
}

// --- Scatter natural decorations ---

function scatterNatureDecos(
  ground: TileData[][], obstacles: TileData[][], decorations: TileData[][],
  heightMap: number[][], rng: ReturnType<typeof createRng>,
  w: number, h: number,
): void {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!obstacles[y][x].walkable) continue;
      if (decorations[y][x].type !== TILE_EMPTY) continue;
      const ht = heightMap[y][x];

      // Trees on grass
      if ((ground[y][x].type === TILE_GRASS || ground[y][x].type === TILE_GRASS_DARK)
          && rng.next() < 0.06) {
        obstacles[y][x] = { type: TILE_OBSTACLE_TREE, walkable: false };
        continue;
      }
      // Rocks near mountains
      if (ht > 0.65 && ht < 0.82 && rng.next() < 0.04) {
        obstacles[y][x] = { type: TILE_OBSTACLE_ROCK, walkable: false };
        continue;
      }
      // Flowers on grass
      if (ground[y][x].type === TILE_GRASS && rng.next() < 0.03) {
        decorations[y][x] = { type: DECO_FLOWER, walkable: true };
      }
      // Bushes on dark grass
      if (ground[y][x].type === TILE_GRASS_DARK && rng.next() < 0.03) {
        decorations[y][x] = { type: DECO_BUSH, walkable: true };
      }
    }
  }
}

// --- Main generator ---

export function generateWorld(
  width = 64,
  height = 64,
  seed?: number,
): WorldGeneratorResult {
  const rng = createRng(seed ?? Math.floor(Math.random() * 2147483647));

  // Build two independent permutation tables
  const perm1 = buildPermTable(rng);
  const perm2 = buildPermTable(rng);

  // Generate heightmap via FBM
  const scale = 0.045; // controls feature size
  const heightMap: number[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      fbm(perm1, x * scale, y * scale, 5, 2.0, 0.5),
    ),
  );

  // Classify terrain
  const ground: TileData[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const band = classifyTerrain(heightMap[y][x]);
      return { type: band.tile, walkable: band.walkable, variant: rng.nextInt(0, 2) };
    }),
  );

  const obstacles: TileData[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const band = classifyTerrain(heightMap[y][x]);
      if (!band.walkable) {
        return { type: band.tile === TILE_MOUNTAIN ? TILE_OBSTACLE_ROCK : TILE_EMPTY, walkable: false };
      }
      return { type: TILE_EMPTY, walkable: true };
    }),
  );

  const decorations: TileData[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: TILE_EMPTY, walkable: true })),
  );

  // Terrain transitions
  applyTransition(ground, heightMap, width, height, rng);

  // Find and place town
  const town = findTownCenter(heightMap, width, height, perm2, rng);
  const townCenter = town ?? { cx: Math.floor(width / 2), cy: Math.floor(height / 2), radius: 5 };

  placeTown(townCenter, ground, obstacles, decorations, rng, width, height);

  // Place village near town
  placeVillage(heightMap, ground, obstacles, decorations, townCenter, rng, width, height);

  // Place manor in foothills
  placeManor(heightMap, ground, obstacles, decorations, rng, width, height);

  // Natural decorations (trees, rocks, flowers)
  scatterNatureDecos(ground, obstacles, decorations, heightMap, rng, width, height);

  // Spawns
  const playerSpawn = { x: townCenter.cx, y: townCenter.cy };
  const enemySpawns = placeEnemySpawns(heightMap, obstacles, rng, width, height, townCenter);

  return { ground, obstacles, decorations, playerSpawn, enemySpawns, heightMap };
}
