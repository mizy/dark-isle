/** @entry Isometric coordinate system - diamond projection */

import type { ScreenPosition, WorldPosition } from '../types';

// Diamond tile dimensions
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

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
 * Calculate depth value for sorting. Higher world Y = rendered later (in front).
 * Adding wx ensures consistent ordering within the same row.
 */
export function calcDepth(wx: number, wy: number): number {
  return (wx + wy) * HALF_H;
}
