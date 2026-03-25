/** @entry AssetLoader - procedural placeholder texture generation */

import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from '../systems/isometric';

/** Generate all placeholder textures. Call in scene preload or create. */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  generateDiamondTile(scene, 'tile-grass', 0x4a7c59, 0x3d6b4a);
  generateDiamondTile(scene, 'tile-stone', 0x808080, 0x666666);
  generateDiamondTile(scene, 'tile-water', 0x3a6ea5, 0x2d5a8a);
  generateCharacter(scene, 'char-player', 0xe06040);
  generateCharacter(scene, 'char-npc', 0x4080e0);
}

/**
 * Generate a diamond-shaped tile texture.
 * Draws a filled diamond with a slightly darker border.
 */
function generateDiamondTile(
  scene: Phaser.Scene,
  key: string,
  fillColor: number,
  strokeColor: number,
): void {
  const g = scene.add.graphics();
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  // Padding so the texture has room for the full diamond
  const padding = 2;
  const cx = hw + padding;
  const cy = hh + padding;

  // Diamond points: top, right, bottom, left
  const points = [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];

  g.fillStyle(fillColor, 1);
  g.lineStyle(1, strokeColor, 1);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  g.lineTo(points[1].x, points[1].y);
  g.lineTo(points[2].x, points[2].y);
  g.lineTo(points[3].x, points[3].y);
  g.closePath();
  g.fillPath();
  g.strokePath();

  g.generateTexture(key, TILE_WIDTH + padding * 2, TILE_HEIGHT + padding * 2);
  g.destroy();
}

/**
 * Generate a simple colored rectangle for character placeholder.
 * Slightly taller than a tile, centered at bottom for foot positioning.
 */
function generateCharacter(scene: Phaser.Scene, key: string, color: number): void {
  const g = scene.add.graphics();
  const w = 24;
  const h = 36;

  g.fillStyle(color, 1);
  g.lineStyle(1, 0x000000, 0.5);
  g.fillRect(0, 0, w, h);
  g.strokeRect(0, 0, w, h);

  // Small head circle
  g.fillStyle(0xf0c090, 1);
  g.fillCircle(w / 2, 6, 5);

  g.generateTexture(key, w, h);
  g.destroy();
}
