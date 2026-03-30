/** @entry TileMap system - multi-layer isometric tile rendering */

import Phaser from 'phaser';
import type { TileData } from '../types';
import { TILE_WALL } from '../types';
import { worldToScreen, calcDepth, TILE_WIDTH, TILE_HEIGHT } from './isometric';
import { TERRAIN_BLEND_COLORS, terrainGroup } from '../assets/textureGenerator';

/** Rendering mode for a layer */
export type LayerMode = 'ground' | 'obstacle' | 'decoration';

interface TileAnimConfig {
  animKey: string;
  textureKey: string;
}

export class TileMap {
  private width: number;
  private height: number;
  private layers: TileData[][][];
  private renderGroups: Map<number, Phaser.GameObjects.Group> = new Map();

  // Tile type to texture key mapping (supports variants: type -> [key0, key1, key2])
  private textureMap: Map<number, string[]> = new Map();
  // Tile type to animation config (for animated tiles like water/lava)
  private animMap: Map<number, TileAnimConfig> = new Map();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.layers = [];
  }

  /** Register texture key(s) for a tile type. Multiple keys = variants. */
  setTileTexture(type: number, ...textureKeys: string[]): void {
    this.textureMap.set(type, textureKeys);
  }

  /** Register animation for a tile type. Animated tiles use sprites instead of images. */
  setTileAnimation(type: number, animKey: string, textureKey: string): void {
    this.animMap.set(type, { animKey, textureKey });
  }

  addLayer(data: TileData[][]): number {
    this.layers.push(data);
    return this.layers.length - 1;
  }

  getTile(layer: number, x: number, y: number): TileData | null {
    if (layer < 0 || layer >= this.layers.length) return null;
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) return null;
    return this.layers[layer][y][x];
  }

  isWalkable(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
    return this.layers.every((layer) => layer[iy][ix].walkable);
  }

  /** Get texture key for a tile, respecting variants */
  private getTextureKey(tile: TileData): string | null {
    const keys = this.textureMap.get(tile.type);
    if (!keys || keys.length === 0) return null;
    if (keys.length === 1) return keys[0];
    const idx = (tile.variant ?? 0) % keys.length;
    return keys[idx];
  }

  /**
   * Render a layer.
   * Kenney isometric tiles are 132px wide. Heights vary:
   *   - ground tiles: 83px (66px diamond + 17px side)
   *   - tall tiles: 99-131px (with raised features)
   * The diamond face center is at approximately y=33 from top for 83px tiles.
   */
  renderLayer(scene: Phaser.Scene, layerIndex: number, mode: LayerMode = 'ground'): Phaser.GameObjects.Group {
    const layer = this.layers[layerIndex];
    if (!layer) throw new Error(`Layer ${layerIndex} does not exist`);

    const existing = this.renderGroups.get(layerIndex);
    if (existing) existing.destroy(true);

    const group = scene.add.group();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = layer[y][x];
        const anim = this.animMap.get(tile.type);
        const texKey = anim ? anim.textureKey : this.getTextureKey(tile);
        if (!texKey) continue;

        const { sx, sy } = worldToScreen(x, y);
        let obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
        if (anim) {
          const sprite = scene.add.sprite(sx, sy, texKey);
          sprite.play(anim.animKey);
          sprite.anims.setProgress(Math.random());
          obj = sprite;
        } else {
          obj = scene.add.image(sx, sy, texKey);
        }
        const baseDepth = calcDepth(x, y);

        const scale = TILE_WIDTH / obj.width;
        obj.setScale(scale);

        if (mode === 'ground') {
          obj.setOrigin(0.5, 0.40);
          obj.setDepth(baseDepth + layerIndex * 0.1);
        } else if (mode === 'obstacle') {
          obj.setOrigin(0.5, 0.85);
          obj.setDepth(baseDepth + layerIndex * 0.1);
          // Cast shadow for obstacles (trees, rocks) — offset to lower-right for isometric light
          const shadow = scene.add.ellipse(
            sx + TILE_WIDTH * 0.12,
            sy + TILE_HEIGHT * 0.15,
            TILE_WIDTH * 0.35 * scale,
            TILE_HEIGHT * 0.2 * scale,
            0x000000,
            0.25,
          );
          shadow.setDepth(baseDepth + layerIndex * 0.1 - 0.01);
          group.add(shadow);
        } else {
          obj.setOrigin(0.5, 0.75);
          obj.setDepth(baseDepth + layerIndex * 0.1 + 0.05);
        }
        group.add(obj);
      }
    }

    this.renderGroups.set(layerIndex, group);
    return group;
  }

  /** Render all layers with specified modes */
  renderAllWithModes(scene: Phaser.Scene, modes: LayerMode[]): void {
    for (let i = 0; i < this.layers.length; i++) {
      this.renderLayer(scene, i, modes[i] ?? 'ground');
    }
  }

  /**
   * Render all layers in order (backward compat).
   * @param obstacleLayerIndices Layer indices that contain upright objects
   */
  renderAll(scene: Phaser.Scene, obstacleLayerIndices: number[] = []): void {
    for (let i = 0; i < this.layers.length; i++) {
      const mode: LayerMode = obstacleLayerIndices.includes(i) ? 'obstacle' : 'ground';
      this.renderLayer(scene, i, mode);
    }
  }

  /**
   * Render terrain edge transitions on the ground layer.
   * Places tinted overlay sprites where different terrain types meet.
   */
  renderTerrainEdges(scene: Phaser.Scene, groundLayerIndex: number): void {
    const layer = this.layers[groundLayerIndex];
    if (!layer) return;

    // neighbor offsets: [dx, dy, overlay-texture-key]
    // Each maps a grid neighbor to the edge of the current tile facing it
    const neighbors: Array<[number, number, string]> = [
      [0, -1, 'edge-ne'],   // y-1 → upper-right in screen
      [1, 0, 'edge-se'],    // x+1 → lower-right in screen
      [0, 1, 'edge-sw'],    // y+1 → lower-left in screen
      [-1, 0, 'edge-nw'],   // x-1 → upper-left in screen
    ];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = layer[y][x];
        const myGroup = terrainGroup(tile.type);

        for (const [dx, dy, edgeKey] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

          const neighbor = layer[ny][nx];
          if (terrainGroup(neighbor.type) === myGroup) continue;

          const neighborColor = TERRAIN_BLEND_COLORS[neighbor.type];
          if (neighborColor === undefined) continue;

          const { sx, sy } = worldToScreen(x, y);
          const overlay = scene.add.image(sx, sy, edgeKey);
          overlay.setOrigin(0.5, 0.40);
          const scale = TILE_WIDTH / overlay.width;
          overlay.setScale(scale);
          overlay.setTint(neighborColor);
          overlay.setDepth(calcDepth(x, y) + 0.02);
        }
      }
    }
  }

  /**
   * Render shadows cast by wall tiles onto adjacent floor tiles.
   * Light from upper-left → shadows fall to SE (x+1) and SW (y+1).
   */
  renderWallShadows(scene: Phaser.Scene, wallLayerIndex: number): void {
    const walls = this.layers[wallLayerIndex];
    if (!walls) return;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (walls[y][x].type !== TILE_WALL) continue;

        // Shadow on SE neighbor (x+1, y) — primary shadow direction
        if (x + 1 < this.width && walls[y][x + 1].type !== TILE_WALL) {
          const { sx, sy } = worldToScreen(x + 1, y);
          const shadow = scene.add.image(sx, sy, 'edge-nw');
          shadow.setOrigin(0.5, 0.40);
          shadow.setScale(TILE_WIDTH / shadow.width);
          shadow.setTint(0x000000);
          shadow.setAlpha(0.3);
          shadow.setDepth(calcDepth(x + 1, y) + 0.01);
        }

        // Weaker shadow on SW neighbor (x, y+1)
        if (y + 1 < this.height && walls[y + 1][x].type !== TILE_WALL) {
          const { sx, sy } = worldToScreen(x, y + 1);
          const shadow = scene.add.image(sx, sy, 'edge-ne');
          shadow.setOrigin(0.5, 0.40);
          shadow.setScale(TILE_WIDTH / shadow.width);
          shadow.setTint(0x000000);
          shadow.setAlpha(0.2);
          shadow.setDepth(calcDepth(x, y + 1) + 0.01);
        }
      }
    }
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
  getLayerCount(): number { return this.layers.length; }

  destroy(): void {
    this.renderGroups.forEach((g) => g.destroy(true));
    this.renderGroups.clear();
  }
}
