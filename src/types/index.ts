/** @entry Core type definitions for Dark Isle */

export interface Position {
  x: number;
  y: number;
}

export interface ScreenPosition {
  sx: number;
  sy: number;
}

export interface WorldPosition {
  wx: number;
  wy: number;
}

export interface TileData {
  type: number;
  walkable: boolean;
  variant?: number; // tile variant index for visual diversity
}

export interface TileMapConfig {
  width: number;
  height: number;
  layers: TileData[][][];
}

export interface Entity {
  id: string;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  worldX: number;
  worldY: number;
}

export interface GameEntity extends Entity {
  hp: number;
  maxHp: number;
  attack: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  isEnemy: boolean;
  alive: boolean;
}

export interface CameraConfig {
  lerpX: number;
  lerpY: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
}

/** Tile type constants */
export const TILE_EMPTY = -1;
export const TILE_GRASS = 0;
export const TILE_STONE = 1;
export const TILE_WATER = 2;
export const TILE_OBSTACLE_ROCK = 3;
export const TILE_OBSTACLE_TREE = 4;
// New tile types
export const TILE_WALL = 5;
export const TILE_DEEP_WATER = 6;
export const TILE_SHALLOW_WATER = 7;
export const TILE_GRASS_DARK = 8;
export const TILE_DIRT = 9;
export const TILE_LAVA = 10;
// Decoration types (layer 2)
export const DECO_TORCH = 20;
export const DECO_CHEST = 21;
export const DECO_TABLE = 22;
export const DECO_BARREL = 23;
export const DECO_BONES = 24;
export const DECO_PILLAR = 25;

// World map tile types
export const TILE_SAND = 11;
export const TILE_MOUNTAIN = 12;
export const TILE_MOUNTAIN_PATH = 13;
export const TILE_TOWN_ROAD = 14;
export const TILE_VILLAGE_DIRT = 15;
export const TILE_FARMLAND = 16;
export const TILE_MANOR_FLOOR = 17;
export const TILE_MANOR_GARDEN = 18;

// World map decoration types
export const DECO_HOUSE = 26;
export const DECO_SHOP = 27;
export const DECO_FENCE = 28;
export const DECO_CABIN = 29;
export const DECO_MANOR_WALL = 30;
export const DECO_MANOR_BUILDING = 31;
export const DECO_FLOWER = 32;
export const DECO_BUSH = 33;
export const DECO_CITY_WALL = 34;

export interface WorldGeneratorResult {
  ground: TileData[][];
  obstacles: TileData[][];
  decorations: TileData[][];
  playerSpawn: { x: number; y: number };
  enemySpawns: { x: number; y: number }[];
  heightMap: number[][];
}
