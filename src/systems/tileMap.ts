/** @entry TileMap system - multi-layer isometric tile rendering */

import Phaser from 'phaser';
import type { TileData } from '../types';
import { worldToScreen, calcDepth, TILE_WIDTH, TILE_HEIGHT } from './isometric';

export class TileMap {
  private width: number;
  private height: number;
  private layers: TileData[][][];
  private renderGroups: Map<number, Phaser.GameObjects.Group> = new Map();

  // Tile type to texture key mapping
  private textureMap: Map<number, string> = new Map();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.layers = [];
  }

  /** Register a texture key for a tile type */
  setTileTexture(type: number, textureKey: string): void {
    this.textureMap.set(type, textureKey);
  }

  /** Add a layer of tile data (2D array [y][x]) */
  addLayer(data: TileData[][]): number {
    this.layers.push(data);
    return this.layers.length - 1;
  }

  /** Get tile at position in a specific layer */
  getTile(layer: number, x: number, y: number): TileData | null {
    if (layer < 0 || layer >= this.layers.length) return null;
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) return null;
    return this.layers[layer][y][x];
  }

  /** Check if a world position is walkable (all layers) */
  isWalkable(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
    return this.layers.every((layer) => layer[iy][ix].walkable);
  }

  /**
   * Render a specific layer using painter's algorithm (back to front).
   * Iterates rows top-to-bottom, left-to-right for correct overlap.
   */
  renderLayer(scene: Phaser.Scene, layerIndex: number): Phaser.GameObjects.Group {
    const layer = this.layers[layerIndex];
    if (!layer) throw new Error(`Layer ${layerIndex} does not exist`);

    // Clean up previous render group for this layer
    const existing = this.renderGroups.get(layerIndex);
    if (existing) existing.destroy(true);

    const group = scene.add.group();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = layer[y][x];
        const textureKey = this.textureMap.get(tile.type);
        if (!textureKey) continue;

        const { sx, sy } = worldToScreen(x, y);
        const image = scene.add.image(sx, sy, textureKey);
        image.setDepth(calcDepth(x, y) + layerIndex * 0.1);
        image.setDisplaySize(TILE_WIDTH, TILE_HEIGHT);
        group.add(image);
      }
    }

    this.renderGroups.set(layerIndex, group);
    return group;
  }

  /** Render all layers in order */
  renderAll(scene: Phaser.Scene): void {
    for (let i = 0; i < this.layers.length; i++) {
      this.renderLayer(scene, i);
    }
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
  getLayerCount(): number { return this.layers.length; }

  /** Destroy all render groups */
  destroy(): void {
    this.renderGroups.forEach((g) => g.destroy(true));
    this.renderGroups.clear();
  }
}
