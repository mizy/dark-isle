/** @entry BSP dungeon generator - produces TileData[][] for TileMap */

import type { TileData } from '../types';
import {
  TILE_EMPTY, TILE_GRASS, TILE_STONE, TILE_WATER, TILE_OBSTACLE_ROCK, TILE_OBSTACLE_TREE,
  TILE_WALL, TILE_DEEP_WATER, TILE_SHALLOW_WATER, TILE_GRASS_DARK, TILE_DIRT, TILE_LAVA,
  DECO_TORCH, DECO_CHEST, DECO_TABLE, DECO_BARREL, DECO_BONES, DECO_PILLAR,
} from '../types';

// Re-export for backward compat
export { TILE_GRASS, TILE_STONE, TILE_WATER };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BSPNode {
  bounds: Rect;
  room?: Rect;
  left?: BSPNode;
  right?: BSPNode;
}

interface DungeonResult {
  ground: TileData[][];
  obstacles: TileData[][];
  decorations: TileData[][];
  playerSpawn: { x: number; y: number };
  enemySpawns: { x: number; y: number }[];
  rooms: Rect[];
}

/** Simple seedable RNG */
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

const MIN_ROOM_SIZE = 4;
const MIN_PARTITION_SIZE = 7;

/** Recursively split space into BSP tree */
function splitBSP(bounds: Rect, rng: ReturnType<typeof createRng>, depth: number): BSPNode {
  const node: BSPNode = { bounds };

  if (depth <= 0 || bounds.w < MIN_PARTITION_SIZE * 2 || bounds.h < MIN_PARTITION_SIZE * 2) {
    // Leaf - create room with 1-cell wall margin
    const margin = 2;
    const roomX = bounds.x + margin;
    const roomY = bounds.y + margin;
    const maxW = bounds.w - margin * 2;
    const maxH = bounds.h - margin * 2;
    const roomW = rng.nextInt(MIN_ROOM_SIZE, Math.max(MIN_ROOM_SIZE, maxW));
    const roomH = rng.nextInt(MIN_ROOM_SIZE, Math.max(MIN_ROOM_SIZE, maxH));
    node.room = { x: roomX, y: roomY, w: roomW, h: roomH };
    return node;
  }

  const splitH = bounds.w > bounds.h ? false : bounds.h > bounds.w ? true : rng.next() > 0.5;

  if (splitH) {
    const split = rng.nextInt(MIN_PARTITION_SIZE, bounds.h - MIN_PARTITION_SIZE);
    node.left = splitBSP({ x: bounds.x, y: bounds.y, w: bounds.w, h: split }, rng, depth - 1);
    node.right = splitBSP({ x: bounds.x, y: bounds.y + split, w: bounds.w, h: bounds.h - split }, rng, depth - 1);
  } else {
    const split = rng.nextInt(MIN_PARTITION_SIZE, bounds.w - MIN_PARTITION_SIZE);
    node.left = splitBSP({ x: bounds.x, y: bounds.y, w: split, h: bounds.h }, rng, depth - 1);
    node.right = splitBSP({ x: bounds.x + split, y: bounds.y, w: bounds.w - split, h: bounds.h }, rng, depth - 1);
  }

  return node;
}

function collectRooms(node: BSPNode): Rect[] {
  if (node.room) return [node.room];
  const rooms: Rect[] = [];
  if (node.left) rooms.push(...collectRooms(node.left));
  if (node.right) rooms.push(...collectRooms(node.right));
  return rooms;
}

function roomCenter(r: Rect): { x: number; y: number } {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
}

function getRepresentativeRoom(node: BSPNode): Rect {
  if (node.room) return node.room;
  if (node.left) return getRepresentativeRoom(node.left);
  return getRepresentativeRoom(node.right!);
}

/** Carve a corridor 2 tiles wide for better walkability */
function carveCorridor(
  grid: number[][],
  x1: number, y1: number,
  x2: number, y2: number,
  rng: ReturnType<typeof createRng>,
  width: number, height: number,
): void {
  const hFirst = rng.next() > 0.5;

  const setFloor = (x: number, y: number) => {
    // Carve 2-wide corridor
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < height && nx >= 0 && nx < width && grid[ny][nx] === -1) {
          grid[ny][nx] = TILE_STONE;
        }
      }
    }
  };

  if (hFirst) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) setFloor(x, y1);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) setFloor(x2, y);
  } else {
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) setFloor(x1, y);
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) setFloor(x, y2);
  }
}

function connectBSP(node: BSPNode, grid: number[][], rng: ReturnType<typeof createRng>, w: number, h: number): void {
  if (!node.left || !node.right) return;
  connectBSP(node.left, grid, rng, w, h);
  connectBSP(node.right, grid, rng, w, h);

  const roomL = getRepresentativeRoom(node.left);
  const roomR = getRepresentativeRoom(node.right);
  const cL = roomCenter(roomL);
  const cR = roomCenter(roomR);
  carveCorridor(grid, cL.x, cL.y, cR.x, cR.y, rng, w, h);
}

/** Check if cell is adjacent to a floor cell */
function isAdjacentToFloor(grid: number[][], x: number, y: number, w: number, h: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[ny][nx] >= 0) {
        return true;
      }
    }
  }
  return false;
}

/** Pick a room floor type with variation */
function pickRoomFloor(rng: ReturnType<typeof createRng>): number {
  const r = rng.next();
  if (r < 0.35) return TILE_STONE;
  if (r < 0.55) return TILE_GRASS;
  if (r < 0.70) return TILE_GRASS_DARK;
  if (r < 0.85) return TILE_DIRT;
  return TILE_STONE;
}

/**
 * Generate a random dungeon map.
 * @param width Map width in tiles (default 24)
 * @param height Map height in tiles (default 24)
 * @param seed Random seed
 */
export function generateDungeon(
  width = 24,
  height = 24,
  seed?: number,
): DungeonResult {
  const rng = createRng(seed ?? Math.floor(Math.random() * 2147483647));

  // -1 = wall/void, >= 0 = floor type
  const grid: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => -1),
  );

  // BSP split with depth 5 for more rooms
  const root = splitBSP({ x: 0, y: 0, w: width, h: height }, rng, 5);
  const rooms = collectRooms(root);

  // Carve rooms with varied floor types
  const roomFloors: Map<Rect, number> = new Map();
  for (const room of rooms) {
    const floorType = pickRoomFloor(rng);
    roomFloors.set(room, floorType);
    for (let y = room.y; y < room.y + room.h && y < height; y++) {
      for (let x = room.x; x < room.x + room.w && x < width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          grid[y][x] = floorType;
        }
      }
    }
  }

  // Connect rooms via BSP corridors
  connectBSP(root, grid, rng, width, height);

  // Build ground layer with variants
  const ground: TileData[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const v = grid[y][x];
      if (v === -1) {
        // Under-wall base: dark grass
        return { type: TILE_GRASS_DARK, walkable: true, variant: rng.nextInt(0, 2) };
      }
      return { type: v, walkable: true, variant: rng.nextInt(0, 2) };
    }),
  );

  // Build obstacle layer: walls on cells adjacent to floor
  const obstacles: TileData[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (grid[y][x] === -1) {
        if (isAdjacentToFloor(grid, x, y, width, height)) {
          // Visible wall
          return { type: TILE_WALL, walkable: false, variant: rng.nextInt(0, 3) };
        }
        // Hidden void - still blocked
        return { type: TILE_OBSTACLE_ROCK, walkable: false };
      }
      return { type: TILE_EMPTY, walkable: true };
    }),
  );

  // Build decoration layer
  const decorations: TileData[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: TILE_EMPTY, walkable: true })),
  );

  // Place water features in some rooms
  for (const room of rooms) {
    if (rng.next() > 0.35) continue;
    // Water pool: cluster of 2-4 water tiles
    const poolSize = rng.nextInt(1, 3);
    const cx = room.x + rng.nextInt(1, Math.max(1, room.w - 3));
    const cy = room.y + rng.nextInt(1, Math.max(1, room.h - 3));
    for (let dy = 0; dy < poolSize; dy++) {
      for (let dx = 0; dx < poolSize; dx++) {
        const wx = cx + dx, wy = cy + dy;
        if (wx > 0 && wx < width - 1 && wy > 0 && wy < height - 1 && grid[wy][wx] >= 0) {
          const isEdge = dx === 0 || dy === 0 || dx === poolSize - 1 || dy === poolSize - 1;
          ground[wy][wx] = { type: isEdge ? TILE_SHALLOW_WATER : TILE_DEEP_WATER, walkable: false };
          obstacles[wy][wx] = { type: TILE_EMPTY, walkable: false };
        }
      }
    }
  }

  // Place lava in one random room (rare)
  if (rng.next() < 0.25 && rooms.length > 3) {
    const lavaRoom = rng.pick(rooms.slice(2));
    const lx = lavaRoom.x + rng.nextInt(1, Math.max(1, lavaRoom.w - 2));
    const ly = lavaRoom.y + rng.nextInt(1, Math.max(1, lavaRoom.h - 2));
    if (lx > 0 && lx < width - 1 && ly > 0 && ly < height - 1 && grid[ly][lx] >= 0) {
      ground[ly][lx] = { type: TILE_LAVA, walkable: false };
      obstacles[ly][lx] = { type: TILE_EMPTY, walkable: false };
    }
  }

  // Place decorations in rooms
  for (const room of rooms) {
    // Torches on walls adjacent to room
    placeWallTorches(room, grid, decorations, rng, width, height);

    // Room furniture
    if (rng.next() < 0.5) {
      placeRoomFurniture(room, grid, obstacles, decorations, rng, width, height);
    }

    // Bones scattered
    if (rng.next() < 0.3) {
      const bx = room.x + rng.nextInt(0, Math.max(0, room.w - 1));
      const by = room.y + rng.nextInt(0, Math.max(0, room.h - 1));
      if (bx >= 0 && bx < width && by >= 0 && by < height
          && grid[by][bx] >= 0 && obstacles[by][bx].type === TILE_EMPTY
          && decorations[by][bx].type === TILE_EMPTY) {
        decorations[by][bx] = { type: DECO_BONES, walkable: true };
      }
    }
  }

  // Sprinkle trees on grass/dark-grass floor tiles near room edges
  for (const room of rooms) {
    if (rng.next() > 0.4) continue;
    const numTrees = rng.nextInt(1, 2);
    for (let t = 0; t < numTrees; t++) {
      const tx = room.x + rng.nextInt(0, Math.max(0, room.w - 1));
      const ty = room.y + rng.nextInt(0, Math.max(0, room.h - 1));
      if (tx > 0 && tx < width - 1 && ty > 0 && ty < height - 1
          && grid[ty][tx] >= 0 && obstacles[ty][tx].type === TILE_EMPTY
          && (ground[ty][tx].type === TILE_GRASS || ground[ty][tx].type === TILE_GRASS_DARK)
          && ground[ty][tx].walkable) {
        obstacles[ty][tx] = { type: TILE_OBSTACLE_TREE, walkable: false };
      }
    }
  }

  // Player spawn: center of first room
  const playerSpawn = roomCenter(rooms[0]);
  // Clear decorations/obstacles around spawn
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = playerSpawn.x + dx, sy = playerSpawn.y + dy;
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        obstacles[sy][sx] = { type: TILE_EMPTY, walkable: true };
        decorations[sy][sx] = { type: TILE_EMPTY, walkable: true };
        ground[sy][sx] = { ...ground[sy][sx], walkable: true };
      }
    }
  }

  // Enemy spawns: centers of other rooms
  const enemySpawns = rooms.slice(1).map((r) => roomCenter(r));

  return { ground, obstacles, decorations, playerSpawn, enemySpawns, rooms };
}

function placeWallTorches(
  room: Rect, grid: number[][], decorations: TileData[][],
  rng: ReturnType<typeof createRng>, w: number, h: number,
): void {
  // Place torches on wall cells adjacent to room edges
  const torchChance = 0.2;
  // Top wall
  for (let x = room.x; x < room.x + room.w; x++) {
    const wy = room.y - 1;
    if (wy >= 0 && wy < h && x >= 0 && x < w && grid[wy][x] === -1 && rng.next() < torchChance) {
      decorations[wy][x] = { type: DECO_TORCH, walkable: false };
    }
  }
  // Left wall
  for (let y = room.y; y < room.y + room.h; y++) {
    const wx = room.x - 1;
    if (wx >= 0 && wx < w && y >= 0 && y < h && grid[y][wx] === -1 && rng.next() < torchChance) {
      decorations[y][wx] = { type: DECO_TORCH, walkable: false };
    }
  }
}

function placeRoomFurniture(
  room: Rect, grid: number[][], obstacles: TileData[][], decorations: TileData[][],
  rng: ReturnType<typeof createRng>, w: number, h: number,
): void {
  const furniture = [DECO_CHEST, DECO_TABLE, DECO_BARREL, DECO_PILLAR];
  const numItems = rng.nextInt(1, 3);

  for (let i = 0; i < numItems; i++) {
    const fx = room.x + rng.nextInt(0, Math.max(0, room.w - 1));
    const fy = room.y + rng.nextInt(0, Math.max(0, room.h - 1));
    if (fx >= 0 && fx < w && fy >= 0 && fy < h
        && grid[fy][fx] >= 0 && obstacles[fy][fx].type === TILE_EMPTY
        && decorations[fy][fx].type === TILE_EMPTY) {
      const deco = rng.pick(furniture);
      const blocks = deco === DECO_PILLAR || deco === DECO_TABLE;
      decorations[fy][fx] = { type: deco, walkable: !blocks };
      if (blocks) {
        obstacles[fy][fx] = { type: TILE_EMPTY, walkable: false };
      }
    }
  }
}
