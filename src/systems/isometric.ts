/** @entry Isometric coordinate system - diamond projection */

import type { ScreenPosition, WorldPosition } from '../types';

// Diamond tile dimensions — matches Kenney isometric tile size (132x66 diamond face)
export const TILE_WIDTH = 132;
export const TILE_HEIGHT = 66;

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

/**
 * Convert world grid coordinates to screen pixel coordinates.
 * Uses standard diamond (staggered) isometric projection.
 */
export function worldToScreen(wx: number, wy: number): ScreenPosition {
  return {
    sx: (wx - wy) * HALF_W,
    sy: (wx + wy) * HALF_H,
  };
}

/**
 * Convert screen pixel coordinates back to world grid coordinates.
 */
export function screenToWorld(sx: number, sy: number): WorldPosition {
  return {
    wx: (sx / HALF_W + sy / HALF_H) / 2,
    wy: (sy / HALF_H - sx / HALF_W) / 2,
  };
}

/**
 * Depth layer bands — added on top of the isometric row value so that
 * objects in the same row are still sorted correctly relative to each other,
 * but different semantic layers never overlap.
 *
 * World coordinate range: 0..128 tiles → row value 0..128*33 ≈ 4224.
 * Each band is separated by 10 000 so there is no cross-band bleed.
 */
export const DEPTH_GROUND   = 0;        // flat tiles: grass, water, road …
export const DEPTH_OBSTACLE = 10_000;   // upright objects: trees, rocks, buildings
export const DEPTH_ENTITY   = 10_500;   // characters (always above same-row ground)
export const DEPTH_DECO_TOP = 20_000;   // decorations that sit above characters (torches, etc.)
export const DEPTH_UI       = 90_000;   // HUD, vignette

/**
 * Calculate base isometric sort value. Higher world (wx+wy) = rendered later.
 * Add one of the DEPTH_* band constants to place the object in the right layer.
 */
export function calcDepth(wx: number, wy: number): number {
  return (wx + wy) * HALF_H;
}
