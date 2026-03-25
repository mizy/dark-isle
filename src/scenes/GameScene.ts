/** @entry Main game scene - isometric map with WASD + click-to-move */

import Phaser from 'phaser';
import { generatePlaceholderTextures } from '../assets/assetLoader';
import { worldToScreen, screenToWorld, TILE_WIDTH } from '../systems/isometric';
import { TileMap } from '../systems/tileMap';
import { EntityRenderer } from '../systems/entityRenderer';
import { CameraSystem } from '../systems/camera';
import type { Entity } from '../types';
import type { TileData } from '../types';

const MAP_SIZE = 10;
const MOVE_SPEED = 3; // world units per second
const LERP_FACTOR = 0.08;
const ARRIVAL_THRESHOLD = 0.05;

export class GameScene extends Phaser.Scene {
  private tileMap!: TileMap;
  private entityRenderer!: EntityRenderer;
  private cameraSystem!: CameraSystem;
  private player!: Entity;
  private npcs: Entity[] = [];
  private cursors!: Record<string, Phaser.Input.Keyboard.Key>;

  // Smooth movement state
  private targetX = 0;
  private targetY = 0;
  private isMovingToTarget = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    generatePlaceholderTextures(this);
    this.entityRenderer = new EntityRenderer();
    this.buildMap();
    this.spawnPlayer();
    this.spawnNPCs();
    this.setupCamera();
    this.setupInput();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.handleKeyboardMovement(dt);
    this.handleClickMovement(dt);
    this.entityRenderer.update(worldToScreen);
  }

  private buildMap(): void {
    this.tileMap = new TileMap(MAP_SIZE, MAP_SIZE);
    this.tileMap.setTileTexture(0, 'tile-grass');
    this.tileMap.setTileTexture(1, 'tile-stone');
    this.tileMap.setTileTexture(2, 'tile-water');

    const ground: TileData[][] = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      const row: TileData[] = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        let type = 0;
        let walkable = true;

        // Stone path cross in the middle
        if (x === 5 || y === 5) type = 1;
        // Small water pond
        if (x >= 7 && x <= 8 && y >= 1 && y <= 2) {
          type = 2;
          walkable = false;
        }

        row.push({ type, walkable });
      }
      ground.push(row);
    }

    this.tileMap.addLayer(ground);
    this.tileMap.renderAll(this);
  }

  private spawnPlayer(): void {
    const wx = 5;
    const wy = 5;
    const { sx, sy } = worldToScreen(wx, wy);
    const sprite = this.add.image(sx, sy, 'char-player');
    sprite.setOrigin(0.5, 0.8);

    this.player = { id: 'player', sprite, worldX: wx, worldY: wy };
    this.targetX = wx;
    this.targetY = wy;
    this.entityRenderer.add(this.player);
  }

  private spawnNPCs(): void {
    const npcPositions = [
      { x: 2, y: 3 },
      { x: 7, y: 6 },
      { x: 3, y: 8 },
    ];

    npcPositions.forEach((pos, i) => {
      const { sx, sy } = worldToScreen(pos.x, pos.y);
      const sprite = this.add.image(sx, sy, 'char-npc');
      sprite.setOrigin(0.5, 0.8);

      const npc: Entity = { id: `npc-${i}`, sprite, worldX: pos.x, worldY: pos.y };
      this.npcs.push(npc);
      this.entityRenderer.add(npc);
    });
  }

  private setupCamera(): void {
    this.cameraSystem = new CameraSystem(this);

    const bounds = this.calcWorldBounds();
    this.cameraSystem.setBounds(
      bounds.minX - TILE_WIDTH,
      bounds.minY - TILE_WIDTH,
      bounds.maxX - bounds.minX + TILE_WIDTH * 2,
      bounds.maxY - bounds.minY + TILE_WIDTH * 2,
    );

    this.cameraSystem.follow(this.player.sprite);
    this.cameraSystem.setZoom(1.5);
  }

  private setupInput(): void {
    // WASD keys
    this.cursors = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Click to move
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const { wx, wy } = screenToWorld(worldPos.x, worldPos.y);

      // Snap to nearest tile center for target
      const tx = Math.round(wx);
      const ty = Math.round(wy);

      if (this.tileMap.isWalkable(tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        this.isMovingToTarget = true;
      }
    });
  }

  private handleKeyboardMovement(dt: number): void {
    let dx = 0;
    let dy = 0;

    if (this.cursors.W.isDown) { dx -= 1; dy -= 1; }
    if (this.cursors.S.isDown) { dx += 1; dy += 1; }
    if (this.cursors.A.isDown) { dx -= 1; dy += 1; }
    if (this.cursors.D.isDown) { dx += 1; dy -= 1; }

    if (dx !== 0 || dy !== 0) {
      // Cancel click-to-move when using keyboard
      this.isMovingToTarget = false;

      // Normalize diagonal movement
      const len = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / len) * MOVE_SPEED * dt;
      dy = (dy / len) * MOVE_SPEED * dt;

      const newX = this.player.worldX + dx;
      const newY = this.player.worldY + dy;

      // Only move if destination is walkable
      if (this.tileMap.isWalkable(Math.round(newX), Math.round(newY))) {
        this.player.worldX = newX;
        this.player.worldY = newY;
      }
    }
  }

  private handleClickMovement(dt: number): void {
    if (!this.isMovingToTarget) return;

    const dx = this.targetX - this.player.worldX;
    const dy = this.targetY - this.player.worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVAL_THRESHOLD) {
      this.player.worldX = this.targetX;
      this.player.worldY = this.targetY;
      this.isMovingToTarget = false;
      return;
    }

    // Frame-rate independent exponential lerp
    const t = 1 - Math.pow(1 - LERP_FACTOR, dt * 60);
    this.player.worldX += dx * t;
    this.player.worldY += dy * t;
  }

  private calcWorldBounds() {
    const corners = [
      worldToScreen(0, 0),
      worldToScreen(MAP_SIZE, 0),
      worldToScreen(0, MAP_SIZE),
      worldToScreen(MAP_SIZE, MAP_SIZE),
    ];
    return {
      minX: Math.min(...corners.map((c) => c.sx)),
      maxX: Math.max(...corners.map((c) => c.sx)),
      minY: Math.min(...corners.map((c) => c.sy)),
      maxY: Math.max(...corners.map((c) => c.sy)),
    };
  }
}
