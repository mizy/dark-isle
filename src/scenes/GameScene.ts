/** @entry Main game scene - isometric map with WASD + click-to-move + combat */

import Phaser from 'phaser';
import { generateTextures } from '../assets/textureGenerator';
import { worldToScreen, screenToWorld, TILE_WIDTH } from '../systems/isometric';
import { TileMap } from '../systems/tileMap';
import { EntityRenderer } from '../systems/entityRenderer';
import { CameraSystem } from '../systems/camera';
import { generateWorld } from '../systems/worldGenerator';
import { updateEnemyAI, removeAIData, clearAllAIData } from '../systems/enemyAI';
import { CombatSystem } from '../systems/combat';
import { addAmbientParticles } from '../systems/ambientParticles';
import { addTorchLighting, addLavaGlow } from '../systems/ambientLighting';
import { HUD } from '../ui/hud';
import type { GameEntity, WorldGeneratorResult } from '../types';
import {
  TILE_GRASS, TILE_STONE, TILE_WATER, TILE_OBSTACLE_ROCK, TILE_OBSTACLE_TREE,
  TILE_WALL, TILE_DEEP_WATER, TILE_SHALLOW_WATER, TILE_GRASS_DARK, TILE_DIRT, TILE_LAVA,
  TILE_SAND, TILE_MOUNTAIN, TILE_MOUNTAIN_PATH, TILE_TOWN_ROAD,
  TILE_VILLAGE_DIRT, TILE_FARMLAND, TILE_MANOR_FLOOR, TILE_MANOR_GARDEN,
  DECO_TORCH, DECO_CHEST, DECO_TABLE, DECO_BARREL, DECO_BONES, DECO_PILLAR,
  DECO_HOUSE, DECO_SHOP, DECO_FENCE, DECO_CABIN,
  DECO_MANOR_WALL, DECO_MANOR_BUILDING, DECO_FLOWER, DECO_BUSH, DECO_CITY_WALL,
} from '../types';

const MAP_SIZE = 64;
const MOVE_SPEED = 3;
const LERP_FACTOR = 0.08;
const ARRIVAL_THRESHOLD = 0.05;
const MAX_ENEMIES = 15;
const RESPAWN_DELAY = 5000;

export class GameScene extends Phaser.Scene {
  private tileMap!: TileMap;
  private entityRenderer!: EntityRenderer;
  private cameraSystem!: CameraSystem;
  private combatSystem!: CombatSystem;
  private hud!: HUD;
  private player!: GameEntity;
  private enemies: GameEntity[] = [];
  private cursors!: Record<string, Phaser.Input.Keyboard.Key>;
  private worldData?: WorldGeneratorResult;
  private enemyCounter = 0;

  private targetX = 0;
  private targetY = 0;
  private isMovingToTarget = false;
  private hasSpritesheets = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#08070f');
    clearAllAIData();
    generateTextures(this);
    this.createTileAnimations();
    this.hasSpritesheets = this.textures.exists('sheet-player') && this.textures.exists('sheet-enemy');
    this.entityRenderer = new EntityRenderer();
    this.entityRenderer.setScene(this);
    this.buildMap();
    addTorchLighting(this, this.worldData!);
    addLavaGlow(this, this.worldData!);
    this.spawnPlayer();
    this.spawnEnemies();
    this.setupCamera();
    this.setupInput();
    this.combatSystem = new CombatSystem(this, this.player, this.enemies);
    this.combatSystem.setOnKill((enemy) => this.scheduleRespawn(enemy));
    this.combatSystem.setOnPlayerDeath(() => this.handlePlayerDeath());
    this.hud = new HUD(this);
    addAmbientParticles(this);
    this.addVignette();
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    if (this.player.alive) {
      this.handleKeyboardMovement(dt);
      this.handleClickMovement(dt);
      const aliveEnemies = this.enemies.filter((e) => e.alive);
      updateEnemyAI(aliveEnemies, this.player, this.tileMap, dt);
      this.combatSystem.update(dt);
    }
    this.hud.update(this.player.hp, this.player.maxHp, this.combatSystem.getKillCount());
    this.entityRenderer.update(worldToScreen);
  }

  private createTileAnimations(): void {
    const mkFrames = (prefix: string) =>
      Array.from({ length: 4 }, (_, i) => ({ key: `${prefix}-f${i}` }));

    this.anims.create({
      key: 'anim-water', frames: mkFrames('tile-water'), frameRate: 2.5, repeat: -1,
    });
    this.anims.create({
      key: 'anim-deep-water', frames: mkFrames('tile-deep-water'), frameRate: 2, repeat: -1,
    });
    this.anims.create({
      key: 'anim-shallow-water', frames: mkFrames('tile-shallow-water'), frameRate: 3, repeat: -1,
    });
    this.anims.create({
      key: 'anim-lava', frames: mkFrames('tile-lava'), frameRate: 3.5, repeat: -1,
    });

    // Torch flame animation
    this.anims.create({
      key: 'anim-torch',
      frames: Array.from({ length: 4 }, (_, i) => ({ key: `deco-torch-f${i}` })),
      frameRate: 6,
      repeat: -1,
    });
  }

  private buildMap(): void {
    const world = generateWorld(MAP_SIZE, MAP_SIZE);
    this.worldData = world;

    this.tileMap = new TileMap(MAP_SIZE, MAP_SIZE);

    // Register tile textures with variants — original terrain
    this.tileMap.setTileTexture(TILE_GRASS, 'tile-grass-0', 'tile-grass-1', 'tile-grass-2');
    this.tileMap.setTileTexture(TILE_STONE, 'tile-stone-0', 'tile-stone-1', 'tile-stone-2');
    this.tileMap.setTileTexture(TILE_WATER, 'tile-water');
    this.tileMap.setTileTexture(TILE_DEEP_WATER, 'tile-deep-water');
    this.tileMap.setTileTexture(TILE_SHALLOW_WATER, 'tile-shallow-water');

    // Animated water/lava tiles
    this.tileMap.setTileAnimation(TILE_WATER, 'anim-water', 'tile-water-f0');
    this.tileMap.setTileAnimation(TILE_DEEP_WATER, 'anim-deep-water', 'tile-deep-water-f0');
    this.tileMap.setTileAnimation(TILE_SHALLOW_WATER, 'anim-shallow-water', 'tile-shallow-water-f0');
    this.tileMap.setTileTexture(TILE_GRASS_DARK, 'tile-grass-dark-0', 'tile-grass-dark-1', 'tile-grass-dark-2');
    this.tileMap.setTileTexture(TILE_DIRT, 'tile-dirt-0', 'tile-dirt-1', 'tile-dirt-2');
    this.tileMap.setTileTexture(TILE_LAVA, 'tile-lava');
    this.tileMap.setTileAnimation(TILE_LAVA, 'anim-lava', 'tile-lava-f0');

    // World map terrain
    this.tileMap.setTileTexture(TILE_SAND, 'tile-sand-0', 'tile-sand-1', 'tile-sand-2');
    this.tileMap.setTileTexture(TILE_MOUNTAIN, 'tile-mountain-0', 'tile-mountain-1', 'tile-mountain-2');
    this.tileMap.setTileTexture(TILE_MOUNTAIN_PATH, 'tile-mountain-path-0', 'tile-mountain-path-1', 'tile-mountain-path-2');
    this.tileMap.setTileTexture(TILE_TOWN_ROAD, 'tile-town-road-0', 'tile-town-road-1', 'tile-town-road-2');
    this.tileMap.setTileTexture(TILE_VILLAGE_DIRT, 'tile-village-dirt-0', 'tile-village-dirt-1', 'tile-village-dirt-2');
    this.tileMap.setTileTexture(TILE_FARMLAND, 'tile-farmland-0', 'tile-farmland-1', 'tile-farmland-2');
    this.tileMap.setTileTexture(TILE_MANOR_FLOOR, 'tile-manor-floor-0', 'tile-manor-floor-1', 'tile-manor-floor-2');
    this.tileMap.setTileTexture(TILE_MANOR_GARDEN, 'tile-manor-garden-0', 'tile-manor-garden-1', 'tile-manor-garden-2');

    // Obstacles
    this.tileMap.setTileTexture(TILE_OBSTACLE_ROCK, 'obstacle-rock');
    this.tileMap.setTileTexture(TILE_OBSTACLE_TREE, 'obstacle-tree');
    this.tileMap.setTileTexture(TILE_WALL, 'tile-wall-0', 'tile-wall-1', 'tile-wall-2', 'tile-wall-3');

    // Original decorations
    this.tileMap.setTileTexture(DECO_TORCH, 'deco-torch');
    this.tileMap.setTileAnimation(DECO_TORCH, 'anim-torch', 'deco-torch-f0');
    this.tileMap.setTileTexture(DECO_CHEST, 'deco-chest');
    this.tileMap.setTileTexture(DECO_TABLE, 'deco-table');
    this.tileMap.setTileTexture(DECO_BARREL, 'deco-barrel');
    this.tileMap.setTileTexture(DECO_BONES, 'deco-bones');
    this.tileMap.setTileTexture(DECO_PILLAR, 'deco-pillar');

    // World map decorations
    this.tileMap.setTileTexture(DECO_HOUSE, 'deco-house');
    this.tileMap.setTileTexture(DECO_SHOP, 'deco-shop');
    this.tileMap.setTileTexture(DECO_FENCE, 'deco-fence');
    this.tileMap.setTileTexture(DECO_CABIN, 'deco-cabin');
    this.tileMap.setTileTexture(DECO_MANOR_WALL, 'deco-manor-wall');
    this.tileMap.setTileTexture(DECO_MANOR_BUILDING, 'deco-manor-building');
    this.tileMap.setTileTexture(DECO_FLOWER, 'deco-flower');
    this.tileMap.setTileTexture(DECO_BUSH, 'deco-bush');
    this.tileMap.setTileTexture(DECO_CITY_WALL, 'deco-city-wall');

    this.tileMap.addLayer(world.ground);      // layer 0: ground
    this.tileMap.addLayer(world.obstacles);    // layer 1: obstacles/walls
    this.tileMap.addLayer(world.decorations);  // layer 2: decorations

    this.tileMap.renderAllWithModes(this, ['ground', 'obstacle', 'decoration']);

    // Terrain edge transitions (soft blending between different biomes)
    this.tileMap.renderTerrainEdges(this, 0);

    // Wall shadows on adjacent floor tiles
    this.tileMap.renderWallShadows(this, 1);
  }

  private spawnPlayer(): void {
    const { x: wx, y: wy } = this.worldData!.playerSpawn;
    const { sx, sy } = worldToScreen(wx, wy);

    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    if (this.hasSpritesheets) {
      const s = this.add.sprite(sx, sy, 'sheet-player', 16);
      s.setScale(0.25);
      s.play('player-idle');
      sprite = s;
    } else {
      sprite = this.add.image(sx, sy, 'char-player');
    }
    sprite.setOrigin(0.5, 0.8);

    // Add shadow below character
    const shadow = this.add.ellipse(sx, sy + 8, 12, 5, 0x000000, 0.3);
    shadow.setOrigin(0.5);
    (sprite as any).__shadow = shadow;

    this.player = {
      id: 'player', sprite, worldX: wx, worldY: wy,
      hp: 100, maxHp: 100, attack: 25, attackRange: 1.5,
      attackCooldown: 0.8, lastAttackTime: 0, isEnemy: false, alive: true,
    };
    this.targetX = wx;
    this.targetY = wy;
    this.entityRenderer.add(this.player, this.hasSpritesheets ? 'player' : undefined);
  }

  private spawnEnemies(): void {
    const spawns = this.worldData!.enemySpawns.slice(0, MAX_ENEMIES);
    spawns.forEach((pos) => this.createEnemy(pos.x, pos.y));
  }

  private createEnemy(wx: number, wy: number): GameEntity {
    const { sx, sy } = worldToScreen(wx, wy);

    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    if (this.hasSpritesheets) {
      const s = this.add.sprite(sx, sy, 'sheet-enemy', 16);
      s.setScale(0.25);
      s.play('enemy-idle');
      sprite = s;
    } else {
      sprite = this.add.image(sx, sy, 'char-enemy');
    }
    sprite.setOrigin(0.5, 0.8);
    // Slight red tint to distinguish enemies
    sprite.setTint(0xff8888);

    // Add shadow
    const shadow = this.add.ellipse(sx, sy + 8, 12, 5, 0x000000, 0.3);
    shadow.setOrigin(0.5);
    (sprite as any).__shadow = shadow;

    const enemy: GameEntity = {
      id: `enemy-${this.enemyCounter++}`, sprite, worldX: wx, worldY: wy,
      hp: 50, maxHp: 50, attack: 10, attackRange: 1.5,
      attackCooldown: 1.5, lastAttackTime: 0, isEnemy: true, alive: true,
    };
    this.enemies.push(enemy);
    this.entityRenderer.add(enemy, this.hasSpritesheets ? 'enemy' : undefined);
    return enemy;
  }

  private scheduleRespawn(deadEnemy: GameEntity): void {
    this.entityRenderer.remove(deadEnemy.id);
    removeAIData(deadEnemy.id);
    const idx = this.enemies.indexOf(deadEnemy);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.time.delayedCall(RESPAWN_DELAY, () => {
      if (!this.player.alive) return;
      const pos = this.findRandomSpawnPosition();
      if (pos) this.createEnemy(pos.x, pos.y);
    });
  }

  private handlePlayerDeath(): void {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const overlay = this.add.rectangle(cx, cy, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.6);
    overlay.setScrollFactor(0);
    overlay.setDepth(11000);

    const gameOverText = this.add.text(cx, cy - 20, '你死了', {
      fontSize: '32px', color: '#ff4444', fontStyle: 'bold',
    });
    gameOverText.setOrigin(0.5);
    gameOverText.setScrollFactor(0);
    gameOverText.setDepth(11001);

    const restartText = this.add.text(cx, cy + 30, '点击重新开始', {
      fontSize: '16px', color: '#cccccc',
    });
    restartText.setOrigin(0.5);
    restartText.setScrollFactor(0);
    restartText.setDepth(11001);

    this.input.once('pointerdown', () => this.scene.restart());
  }

  private findRandomSpawnPosition(): { x: number; y: number } | null {
    const spawns = this.worldData!.enemySpawns;
    for (let attempt = 0; attempt < 20; attempt++) {
      const base = spawns[Math.floor(Math.random() * spawns.length)];
      const x = base.x + Math.floor(Math.random() * 3) - 1;
      const y = base.y + Math.floor(Math.random() * 3) - 1;
      if (!this.tileMap.isWalkable(x, y)) continue;
      const dx = x - this.player.worldX;
      const dy = y - this.player.worldY;
      if (Math.sqrt(dx * dx + dy * dy) < 3) continue;
      return { x, y };
    }
    return spawns[Math.floor(Math.random() * spawns.length)];
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
    this.cameraSystem.setZoom(0.5); // Zoom out more for large world map
  }

  private setupInput(): void {
    this.cursors = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      if (this.combatSystem.tryClickAttack()) return;

      const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const { wx, wy } = screenToWorld(worldPos.x, worldPos.y);
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
      this.isMovingToTarget = false;
      const len = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / len) * MOVE_SPEED * dt;
      dy = (dy / len) * MOVE_SPEED * dt;
      const newX = this.player.worldX + dx;
      const newY = this.player.worldY + dy;

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

    const t = 1 - Math.pow(1 - LERP_FACTOR, dt * 60);
    this.player.worldX += dx * t;
    this.player.worldY += dy * t;
  }

  private addVignette(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Generate vignette texture using radial gradient
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Radial gradient: transparent center -> dark edges
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Add slight warm tint at bottom for ground glow
    const bottomGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    bottomGrad.addColorStop(0, 'rgba(20, 10, 5, 0)');
    bottomGrad.addColorStop(1, 'rgba(20, 10, 5, 0.15)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, 0, w, h);

    // Register as Phaser texture and overlay as fixed UI element
    if (this.textures.exists('vignette')) this.textures.remove('vignette');
    this.textures.addCanvas('vignette', canvas);
    const vignette = this.add.image(w / 2, h / 2, 'vignette');
    vignette.setScrollFactor(0);
    vignette.setDepth(9999);
    vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
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
