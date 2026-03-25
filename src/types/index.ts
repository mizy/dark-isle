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

export interface CameraConfig {
  lerpX: number;
  lerpY: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
}
