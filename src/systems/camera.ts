/** @entry Camera system - follow, pan, zoom with mouse wheel */

import Phaser from 'phaser';
import type { CameraConfig } from '../types';

const DEFAULT_CONFIG: CameraConfig = {
  lerpX: 0.1,
  lerpY: 0.1,
  minZoom: 0.5,
  maxZoom: 3,
  zoomStep: 0.1,
};

export class CameraSystem {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private config: CameraConfig;
  private target: Phaser.GameObjects.Components.Transform | null = null;

  constructor(scene: Phaser.Scene, config?: Partial<CameraConfig>) {
    this.camera = scene.cameras.main;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupZoom(scene);
  }

  /** Start following a game object with smooth lerp */
  follow(target: Phaser.GameObjects.Components.Transform): void {
    this.target = target;
    // Phaser startFollow accepts a GameObject, cast as needed
    this.camera.startFollow(
      target as unknown as Phaser.GameObjects.GameObject,
      false,
      this.config.lerpX,
      this.config.lerpY,
    );
  }

  /** Stop following */
  stopFollow(): void {
    this.target = null;
    this.camera.stopFollow();
  }

  /** Pan camera to a specific position */
  panTo(x: number, y: number, duration = 500): void {
    this.camera.pan(x, y, duration, 'Quad.easeInOut');
  }

  /** Set zoom level directly */
  setZoom(zoom: number): void {
    const clamped = Phaser.Math.Clamp(zoom, this.config.minZoom, this.config.maxZoom);
    this.camera.setZoom(clamped);
  }

  /** Animate zoom to target level */
  zoomTo(zoom: number, duration = 300): void {
    const clamped = Phaser.Math.Clamp(zoom, this.config.minZoom, this.config.maxZoom);
    this.camera.zoomTo(clamped, duration, 'Quad.easeInOut');
  }

  /** Set world bounds to constrain camera movement */
  setBounds(x: number, y: number, width: number, height: number): void {
    this.camera.setBounds(x, y, width, height);
  }

  /** Get current zoom level */
  getZoom(): number {
    return this.camera.zoom;
  }

  /** Get underlying Phaser camera */
  getCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.camera;
  }

  private setupZoom(scene: Phaser.Scene): void {
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: unknown[], _dx: number, dy: number) => {
      const newZoom = this.camera.zoom - Math.sign(dy) * this.config.zoomStep;
      this.setZoom(newZoom);
    });
  }
}
