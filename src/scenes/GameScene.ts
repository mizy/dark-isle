/** @entry Main game scene - isometric map with WASD + click-to-move + combat */

import Phaser from 'phaser';
import { generateTextures } from '../assets/textureGenerator';
import { registerLpcSheet, registerLpcAnims, lpcFrameKey, lpcAnimKey, movementToLpcDir } from '../assets/lpcSprites';
import type { LpcDir } from '../assets/lpcSprites';
import { SpriteCompositor } from '../assets/spriteCompositor';
import { registerKenneyAnims, kenneyAnimKey, kenneyFrameKey } from '../assets/kenneyIsoChar';
import { worldToScreen, screenToWorld, TILE_WIDTH, TILE_HEIGHT, DEPTH_UI } from '../systems/isometric';
import { TileMap } from '../systems/tileMap';
import { ChunkTileMap } from '../systems/chunkTileMap';
import { EntityRenderer } from '../systems/entityRenderer';
import { CameraSystem } from '../systems/camera';
import { generateWorld } from '../systems/worldGenerator';
import { updateEnemyAI, removeAIData, clearAllAIData } from '../systems/enemyAI';
import { CombatSystem } from '../systems/combat';
import { addAmbientParticles } from '../systems/ambientParticles';
import { addTorchLighting, addLavaGlow } from '../systems/ambientLighting';
import { HUD } from '../ui/hud';
import { ChunkManager, CHUNK_SIZE, worldToChunkCoord, worldToLocalCoord, CHUNK_VIEW_DISTANCE } from '../systems/chunkManager';
import { ChunkWorldGenerator } from '../systems/chunkWorldGenerator';
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

/**
 * LPC frames are 256×256 but the character content only occupies roughly the
 * top-left 110×140 px region.
 */
const LPC_SCALE = (TILE_HEIGHT * 4.5) / 256; // ≈ 1.16

/**
 * Kenney Isometric Miniature frames are 256×512.
 * The character occupies roughly the bottom 35% of the frame (~180px).
 * Target ~5 tiles tall in game-space (TILE_HEIGHT * 5 = 330px / 512 ≈ 0.64).
 */
const KENNEY_SCALE = (TILE_HEIGHT * 6) / 512; // ≈ 0.77
const LERP_FACTOR = 0.08;
const ARRIVAL_THRESHOLD = 0.05;
const MAX_ENEMIES = 25;
const RESPAWN_DELAY = 5000;

export class GameScene extends Phaser.Scene {
  private tileMap!: TileMap;
  private chunkTileMap?: ChunkTileMap;
  private entityRenderer!: EntityRenderer;
  private cameraSystem!: CameraSystem;
  private combatSystem!: CombatSystem;
  private hud!: HUD;
  private player!: GameEntity;
  private enemies: GameEntity[] = [];
  private cursors!: Record<string, Phaser.Input.Keyboard.Key>;
  private worldData?: WorldGeneratorResult;
  private enemyCounter = 0;
  private chunkManager?: ChunkManager;
  private useChunkSystem = false;

  private targetX = 0;
  private targetY = 0;
  private isMovingToTarget = false;

  /** LPC compositors for player (layered) and enemy (single sheet) */
  private playerComp!: SpriteCompositor;
  private lpcReady = false;
  /** True when Kenney isometric character frames are loaded */
  private kenneyReady = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#08070f');
    clearAllAIData();
    generateTextures(this);
    this.createTileAnimations();
    this.setupLpcSprites();
    this.setupKenneySprites();
    this.entityRenderer = new EntityRenderer();
    this.entityRenderer.setScene(this);
    
    if (this.useChunkSystem && this.chunkManager) {
      this.player = {
        id: 'player', sprite: null as any, worldX: 0, worldY: 0,
        hp: 100, maxHp: 100, attack: 25, attackRange: 1.5,
        attackCooldown: 0.8, lastAttackTime: 0, isEnemy: false, alive: true,
      };
      this.setupChunkMap();
      this.setupCamera();
    } else {
      this.buildMap();
      addTorchLighting(this, this.worldData!);
      addLavaGlow(this, this.worldData!);
      this.spawnPlayer();
      this.setupCamera();
    }
    
    this.spawnEnemies();
    this.setupInput();
    this.combatSystem = new CombatSystem(this, this.player, this.enemies);
    this.combatSystem.setOnKill((enemy) => this.scheduleRespawn(enemy));
    this.combatSystem.setOnPlayerDeath(() => this.handlePlayerDeath());
    this.hud = new HUD(this);
    addAmbientParticles(this);
    // addVignette must come BEFORE wireHudCamera so the vignette image
    // is in this.children.list when we collect world objects to ignore.
    this.addVignette();
    this.wireHudCamera();
  }

  /**
   * Tell the UI camera (added by HUD) to ignore all world objects,
   * so it only renders the HUD elements that the main camera ignores.
   * Must be called AFTER all world objects (including vignette) are created.
   */
  private wireHudCamera(): void {
    const uiCam = (this as any).__uiCam as Phaser.Cameras.Scene2D.Camera | undefined;
    if (!uiCam) return;
    const hudObjects = new Set<Phaser.GameObjects.GameObject>((this as any).__hudObjects ?? []);
    // Everything NOT in the HUD set → ui camera should ignore it
    const worldObjects = this.children.list.filter((obj) => !hudObjects.has(obj));
    uiCam.ignore(worldObjects);
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

    this.tileMap.setTileTexture(TILE_GRASS, 'tile-grass-0', 'tile-grass-1', 'tile-grass-2');
    this.tileMap.setTileTexture(TILE_STONE, 'tile-stone-0', 'tile-stone-1', 'tile-stone-2');
    this.tileMap.setTileTexture(TILE_WATER, 'tile-water');
    this.tileMap.setTileTexture(TILE_DEEP_WATER, 'tile-deep-water');
    this.tileMap.setTileTexture(TILE_SHALLOW_WATER, 'tile-shallow-water');
    this.tileMap.setTileAnimation(TILE_WATER, 'anim-water', 'tile-water-f0');
    this.tileMap.setTileAnimation(TILE_DEEP_WATER, 'anim-deep-water', 'tile-deep-water-f0');
    this.tileMap.setTileAnimation(TILE_SHALLOW_WATER, 'anim-shallow-water', 'tile-shallow-water-f0');
    this.tileMap.setTileTexture(TILE_GRASS_DARK, 'tile-grass-dark-0', 'tile-grass-dark-1', 'tile-grass-dark-2');
    this.tileMap.setTileTexture(TILE_DIRT, 'tile-dirt-0', 'tile-dirt-1', 'tile-dirt-2');
    this.tileMap.setTileTexture(TILE_LAVA, 'tile-lava');
    this.tileMap.setTileAnimation(TILE_LAVA, 'anim-lava', 'tile-lava-f0');
    this.tileMap.setTileTexture(TILE_SAND, 'tile-sand-0', 'tile-sand-1', 'tile-sand-2');
    this.tileMap.setTileTexture(TILE_MOUNTAIN, 'tile-mountain-0', 'tile-mountain-1', 'tile-mountain-2');
    this.tileMap.setTileTexture(TILE_MOUNTAIN_PATH, 'tile-mountain-path-0', 'tile-mountain-path-1', 'tile-mountain-path-2');
    this.tileMap.setTileTexture(TILE_TOWN_ROAD, 'tile-town-road-0', 'tile-town-road-1', 'tile-town-road-2');
    this.tileMap.setTileTexture(TILE_VILLAGE_DIRT, 'tile-village-dirt-0', 'tile-village-dirt-1', 'tile-village-dirt-2');
    this.tileMap.setTileTexture(TILE_FARMLAND, 'tile-farmland-0', 'tile-farmland-1', 'tile-farmland-2');
    this.tileMap.setTileTexture(TILE_MANOR_FLOOR, 'tile-manor-floor-0', 'tile-manor-floor-1', 'tile-manor-floor-2');
    this.tileMap.setTileTexture(TILE_MANOR_GARDEN, 'tile-manor-garden-0', 'tile-manor-garden-1', 'tile-manor-garden-2');

    this.tileMap.setTileTexture(TILE_OBSTACLE_ROCK, 'obstacle-rock');
    this.tileMap.setTileTexture(TILE_OBSTACLE_TREE, 'obstacle-tree');
    this.tileMap.setTileTexture(TILE_WALL, 'tile-wall-0', 'tile-wall-1', 'tile-wall-2');

    this.tileMap.setTileTexture(DECO_TORCH, 'deco-torch');
    this.tileMap.setTileAnimation(DECO_TORCH, 'anim-torch', 'deco-torch-f0');
    this.tileMap.setTileTexture(DECO_CHEST, 'deco-chest');
    this.tileMap.setTileTexture(DECO_TABLE, 'deco-table');
    this.tileMap.setTileTexture(DECO_BARREL, 'deco-barrel');
    this.tileMap.setTileTexture(DECO_BONES, 'deco-bones');
    this.tileMap.setTileTexture(DECO_PILLAR, 'deco-pillar');
    this.tileMap.setTileTexture(DECO_HOUSE, 'deco-house');
    this.tileMap.setTileTexture(DECO_SHOP, 'deco-shop');
    this.tileMap.setTileTexture(DECO_FENCE, 'deco-fence');
    this.tileMap.setTileTexture(DECO_CABIN, 'deco-cabin');
    this.tileMap.setTileTexture(DECO_MANOR_WALL, 'deco-manor-wall');
    this.tileMap.setTileTexture(DECO_MANOR_BUILDING, 'deco-manor-building');
    this.tileMap.setTileTexture(DECO_FLOWER, 'deco-flower');
    this.tileMap.setTileTexture(DECO_BUSH, 'deco-bush');
    this.tileMap.setTileTexture(DECO_CITY_WALL, 'deco-city-wall');

    this.tileMap.addLayer(world.ground);
    this.tileMap.addLayer(world.obstacles);
    this.tileMap.addLayer(world.decorations);

    this.tileMap.renderAllWithModes(this, ['ground', 'obstacle', 'decoration']);
    this.tileMap.renderTerrainEdges(this, 0);
    this.tileMap.renderWallShadows(this, 1);
  }

  private async setupChunkMap(): Promise<void> {
    const generator = new ChunkWorldGenerator(12345);
    this.chunkManager = new ChunkManager(generator);
    this.chunkTileMap = new ChunkTileMap();
    
    this.registerTileTextures(this.chunkTileMap);
    
    const playerCX = worldToChunkCoord(this.player.worldX, this.player.worldY).cx;
    const playerCY = worldToChunkCoord(this.player.worldX, this.player.worldY).cy;
    
    const preloadChunks = this.chunkManager.getChunksInRadius(playerCX, playerCY, CHUNK_VIEW_DISTANCE);
    
    for (const coord of preloadChunks) {
      const chunk = await this.chunkManager.getChunk(coord.cx, coord.cy);
      this.chunkTileMap.renderChunk(this, chunk);
    }
    
    this.setupChunkUpdateLoop();
  }

  private registerTileTextures(tileMap: TileMap | ChunkTileMap): void {
    tileMap.setTileTexture(TILE_GRASS, 'tile-grass-0', 'tile-grass-1', 'tile-grass-2');
    tileMap.setTileTexture(TILE_STONE, 'tile-stone-0', 'tile-stone-1', 'tile-stone-2');
    tileMap.setTileTexture(TILE_WATER, 'tile-water');
    tileMap.setTileTexture(TILE_DEEP_WATER, 'tile-deep-water');
    tileMap.setTileTexture(TILE_SHALLOW_WATER, 'tile-shallow-water');
    tileMap.setTileAnimation(TILE_WATER, 'anim-water', 'tile-water-f0');
    tileMap.setTileAnimation(TILE_DEEP_WATER, 'anim-deep-water', 'tile-deep-water-f0');
    tileMap.setTileAnimation(TILE_SHALLOW_WATER, 'anim-shallow-water', 'tile-shallow-water-f0');
    tileMap.setTileTexture(TILE_GRASS_DARK, 'tile-grass-dark-0', 'tile-grass-dark-1', 'tile-grass-dark-2');
    tileMap.setTileTexture(TILE_DIRT, 'tile-dirt-0', 'tile-dirt-1', 'tile-dirt-2');
    tileMap.setTileTexture(TILE_LAVA, 'tile-lava');
    tileMap.setTileAnimation(TILE_LAVA, 'anim-lava', 'tile-lava-f0');
    tileMap.setTileTexture(TILE_SAND, 'tile-sand-0', 'tile-sand-1', 'tile-sand-2');
    tileMap.setTileTexture(TILE_MOUNTAIN, 'tile-mountain-0', 'tile-mountain-1', 'tile-mountain-2');
    tileMap.setTileTexture(TILE_MOUNTAIN_PATH, 'tile-mountain-path-0', 'tile-mountain-path-1', 'tile-mountain-path-2');
    tileMap.setTileTexture(TILE_OBSTACLE_ROCK, 'obstacle-rock');
    tileMap.setTileTexture(TILE_OBSTACLE_TREE, 'obstacle-tree');
    tileMap.setTileTexture(DECO_FLOWER, 'deco-flower');
    tileMap.setTileTexture(DECO_BUSH, 'deco-bush');
  }

  private setupChunkUpdateLoop(): void {
    this.time.addEvent({
      delay: 500,
      callback: () => this.updateChunks(),
      loop: true,
    });
  }

  private async updateChunks(): Promise<void> {
    if (!this.chunkManager || !this.chunkTileMap) return;
    
    const playerCX = worldToChunkCoord(this.player.worldX, this.player.worldY).cx;
    const playerCY = worldToChunkCoord(this.player.worldX, this.player.worldY).cy;
    
    const preloadChunks = this.chunkManager.getChunksInRadius(playerCX, playerCY, CHUNK_VIEW_DISTANCE);
    const loadedCoords = this.chunkTileMap.getLoadedChunkCoords();
    
    for (const coord of preloadChunks) {
      if (!this.chunkTileMap.isChunkLoaded(coord.cx, coord.cy)) {
        const chunk = await this.chunkManager.getChunk(coord.cx, coord.cy);
        this.chunkTileMap.renderChunk(this, chunk);
      }
    }
    
    const unloadCoords = this.chunkManager.getChunksToUnload(this.player.worldX, this.player.worldY);
    for (const coord of unloadCoords) {
      this.chunkTileMap.unloadChunk(this, coord.cx, coord.cy);
      this.chunkManager.unloadChunk(coord.cx, coord.cy);
    }
  }

  /**
   * Register LPC spritesheets, cut frames, build compositor, and create Phaser anims.
   * Falls back to procedural textures if LPC sheets didn't load.
   */
  private setupLpcSprites(): void {
    const baseTex = this.textures.get('male_base');
    if (!baseTex || baseTex.key === '__MISSING') {
      // LPC sheets not loaded — fall back to procedural character anims
      this.createProceduralCharacterAnimations();
      return;
    }

    // Register frame cuts for player layers
    const playerSheets = ['male_base', 'male_light', 'male_longsword'];
    for (const s of playerSheets) registerLpcSheet(this, s);

    // Register frame cuts for enemy (skeleton)
    registerLpcSheet(this, 'skeleton');

    // Build composited player textures
    this.playerComp = new SpriteCompositor(this, 'player', {
      body: 'male_base',
      armor: 'male_light',
      weapon: 'male_longsword',
    });
    this.playerComp.buildTextures();

    // Register Phaser animations from composited frames
    this.registerLpcCompositorAnims('player', this.playerComp);
    // Enemy: raw skeleton sheet (no compositing needed)
    registerLpcAnims(this, 'skeleton');

    this.lpcReady = true;
  }

  /** Register idle/walk/attack Phaser animations that pull from compositor frame keys */
  private registerLpcCompositorAnims(id: string, comp: SpriteCompositor): void {
    const dirs: LpcDir[] = ['se', 's', 'sw', 'w', 'nw', 'n', 'ne', 'e'];
    for (const dir of dirs) {
      this.anims.create({
        key: `comp:${id}:${dir}:idle`,
        frames: [
          { key: comp.frameKey(dir, 'walk', 0) },
          { key: comp.frameKey(dir, 'walk', 1) },
        ],
        frameRate: 1.5,
        repeat: -1,
      });
      this.anims.create({
        key: `comp:${id}:${dir}:walk`,
        frames: [0, 1, 2, 3].map((i) => ({ key: comp.frameKey(dir, 'walk', i) })),
        frameRate: 7,
        repeat: -1,
      });
      this.anims.create({
        key: `comp:${id}:${dir}:attack`,
        frames: [{ key: comp.frameKey(dir, 'attack', 0) }],
        frameRate: 8,
        repeat: 0,
      });
    }
  }

  /** Register Kenney Isometric Miniature character animations */
  private setupKenneySprites(): void {
    // Check if the first frame loaded successfully
    const testKey = kenneyFrameKey('Male', 4, 'idle', 0);
    if (!this.textures.exists(testKey)) return;
    registerKenneyAnims(this, 'Male');
    this.kenneyReady = true;
  }

  /** Fallback: old procedurally-generated directional animations */
  private createProceduralCharacterAnimations(): void {
    const prefixes = ['player', 'enemy'];
    const dirs = ['down', 'up', 'side'];
    for (const prefix of prefixes) {
      for (const dir of dirs) {
        const tag = `${prefix}-${dir}`;
        const charTag = `char-${tag}`;
        this.anims.create({
          key: `${tag}-idle`,
          frames: [{ key: `${charTag}-idle-0` }, { key: `${charTag}-idle-1` }],
          frameRate: 2, repeat: -1,
        });
        this.anims.create({
          key: `${tag}-walk`,
          frames: [
            { key: `${charTag}-walk-0` }, { key: `${charTag}-walk-1` },
            { key: `${charTag}-walk-2` }, { key: `${charTag}-walk-3` },
          ],
          frameRate: 6, repeat: -1,
        });
        this.anims.create({
          key: `${tag}-attack`,
          frames: [
            { key: `${charTag}-attack-0` }, { key: `${charTag}-attack-1` },
            { key: `${charTag}-attack-2` },
          ],
          frameRate: 10, repeat: 0,
        });
      }
    }
  }

  private spawnPlayer(): void {
    const { x: wx, y: wy } = this.worldData!.playerSpawn;
    const { sx, sy } = worldToScreen(wx, wy);

    let sprite: Phaser.GameObjects.Sprite;
    let animPrefix: string;

    if (this.kenneyReady) {
      // Kenney Isometric Miniature: 256×512 frames, character in lower ~35%
      // Feet are at ~94% from top of the 512px frame
      const initKey = kenneyFrameKey('Male', 4, 'idle', 0);
      sprite = this.add.sprite(sx, sy, initKey);
      sprite.setOrigin(0.5, 0.94);
      sprite.setScale(KENNEY_SCALE);
      sprite.play(kenneyAnimKey('Male', 'se', 'idle'));
      animPrefix = 'player-kenney';
    } else if (this.lpcReady) {
      const initKey = this.playerComp.frameKey('se', 'walk', 0);
      sprite = this.add.sprite(sx, sy, initKey);
      sprite.setOrigin(0.30, 0.62);
      sprite.setScale(LPC_SCALE);
      sprite.play('comp:player:se:idle');
      animPrefix = 'player-lpc';
    } else {
      sprite = this.add.sprite(sx, sy, 'char-player-down-idle-0');
      sprite.setOrigin(0.5, 0.95);
      sprite.setScale(2);
      sprite.play('player-down-idle');
      animPrefix = 'player';
    }

    const shadow = this.add.ellipse(sx, sy + 4, 36, 10, 0x000000, 0.28);
    shadow.setOrigin(0.5);
    (sprite as any).__shadow = shadow;

    this.player = {
      id: 'player', sprite, worldX: wx, worldY: wy,
      hp: 100, maxHp: 100, attack: 25, attackRange: 1.5,
      attackCooldown: 0.8, lastAttackTime: 0, isEnemy: false, alive: true,
    };
    this.targetX = wx;
    this.targetY = wy;
    this.entityRenderer.add(this.player, animPrefix);
  }

  private spawnEnemies(): void {
    const spawns = this.useChunkSystem 
      ? [] 
      : this.worldData!.enemySpawns.slice(0, MAX_ENEMIES);
    spawns.forEach((pos) => this.createEnemy(pos.x, pos.y));
  }

  private createEnemy(wx: number, wy: number): GameEntity {
    const { sx, sy } = worldToScreen(wx, wy);

    let sprite: Phaser.GameObjects.Sprite;
    let animPrefix: string;

    if (this.kenneyReady) {
      // Reuse the same Male variant for enemies (tinted red to distinguish)
      const initKey = kenneyFrameKey('Male', 4, 'idle', 0);
      sprite = this.add.sprite(sx, sy, initKey);
      sprite.setOrigin(0.5, 0.94);
      sprite.setScale(KENNEY_SCALE * 0.9); // slightly smaller than player
      sprite.setTint(0xff8888); // red tint to distinguish enemies
      sprite.play(kenneyAnimKey('Male', 'se', 'idle'));
      animPrefix = 'enemy-kenney';
    } else if (this.lpcReady) {
      const initKey = lpcFrameKey('skeleton', 'se', 'walk', 0);
      sprite = this.add.sprite(sx, sy, initKey);
      sprite.setOrigin(0.30, 0.62);
      sprite.setScale(LPC_SCALE);
      sprite.play(lpcAnimKey('skeleton', 'se', 'idle'));
      animPrefix = 'enemy-lpc';
    } else {
      sprite = this.add.sprite(sx, sy, 'char-enemy-down-idle-0');
      sprite.setOrigin(0.5, 0.95);
      sprite.setScale(2);
      sprite.play('enemy-down-idle');
      animPrefix = 'enemy';
    }

    const shadow = this.add.ellipse(sx, sy + 4, 32, 9, 0x000000, 0.25);
    shadow.setOrigin(0.5);
    (sprite as any).__shadow = shadow;

    const enemy: GameEntity = {
      id: `enemy-${this.enemyCounter++}`, sprite, worldX: wx, worldY: wy,
      hp: 50, maxHp: 50, attack: 10, attackRange: 1.5,
      attackCooldown: 1.5, lastAttackTime: 0, isEnemy: true, alive: true,
    };
    this.enemies.push(enemy);
    this.entityRenderer.add(enemy, animPrefix);
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
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.6);
    overlay.setScrollFactor(0);
    overlay.setDepth(DEPTH_UI + 200);

    const gameOverText = this.add.text(cx, cy - 20, '你死了', {
      fontSize: '32px', color: '#ff4444', fontStyle: 'bold',
    });
    gameOverText.setOrigin(0.5);
    gameOverText.setScrollFactor(0);
    gameOverText.setDepth(DEPTH_UI + 201);

    const restartText = this.add.text(cx, cy + 30, '点击重新开始', {
      fontSize: '16px', color: '#cccccc',
    });
    restartText.setOrigin(0.5);
    restartText.setScrollFactor(0);
    restartText.setDepth(DEPTH_UI + 201);

    this.input.once('pointerdown', () => this.scene.restart());
  }

  private findRandomSpawnPosition(): { x: number; y: number } | null {
    if (this.useChunkSystem) {
      return null;
    }
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

    const bounds = this.useChunkSystem 
      ? this.calcDynamicChunkBounds() 
      : this.calcWorldBounds();
    this.cameraSystem.setBounds(
      bounds.minX - TILE_WIDTH,
      bounds.minY - TILE_WIDTH,
      bounds.maxX - bounds.minX + TILE_WIDTH * 2,
      bounds.maxY - bounds.minY + TILE_WIDTH * 2,
    );

    this.cameraSystem.follow(this.player.sprite);
    this.cameraSystem.setZoom(0.55);
  }

  private calcDynamicChunkBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const loaded = this.chunkTileMap?.getLoadedChunkCoords() ?? [];
    if (loaded.length === 0) {
      return { minX: -500, maxX: 500, minY: -500, maxY: 500 };
    }
    
    let minCX = Infinity, maxCX = -Infinity, minCY = Infinity, maxCY = -Infinity;
    for (const { cx, cy } of loaded) {
      minCX = Math.min(minCX, cx);
      maxCX = Math.max(maxCX, cx);
      minCY = Math.min(minCY, cy);
      maxCY = Math.max(maxCY, cy);
    }
    
    const worldMinX = minCX * CHUNK_SIZE;
    const worldMinY = minCY * CHUNK_SIZE;
    const worldMaxX = (maxCX + 1) * CHUNK_SIZE;
    const worldMaxY = (maxCY + 1) * CHUNK_SIZE;
    
    const corners = [
      worldToScreen(worldMinX, worldMinY),
      worldToScreen(worldMaxX, worldMinY),
      worldToScreen(worldMinX, worldMaxY),
      worldToScreen(worldMaxX, worldMaxY),
    ];
    
    return {
      minX: Math.min(...corners.map(c => c.sx)),
      maxX: Math.max(...corners.map(c => c.sx)),
      minY: Math.min(...corners.map(c => c.sy)),
      maxY: Math.max(...corners.map(c => c.sy)),
    };
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

      const walkable = this.useChunkSystem && this.chunkTileMap
        ? this.chunkTileMap.isWalkable(tx, ty)
        : this.tileMap.isWalkable(tx, ty);
      if (walkable) {
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

      const canWalk = this.useChunkSystem && this.chunkTileMap
        ? this.chunkTileMap.isWalkable(Math.round(newX), Math.round(newY))
        : this.tileMap.isWalkable(Math.round(newX), Math.round(newY));

      if (canWalk) {
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
    const w = this.scale.width;
    const h = this.scale.height;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const bottomGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
    bottomGrad.addColorStop(0, 'rgba(20, 10, 5, 0)');
    bottomGrad.addColorStop(1, 'rgba(20, 10, 5, 0.15)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, 0, w, h);

    if (this.textures.exists('vignette')) this.textures.remove('vignette');
    this.textures.addCanvas('vignette', canvas);

    // Vignette belongs to the UI camera (1:1 screen pixels, no scroll/zoom issues).
    // Add it to __hudObjects so wireHudCamera keeps it in UI cam and out of main cam.
    const vignette = this.add.image(w / 2, h / 2, 'vignette');
    vignette.setDepth(DEPTH_UI - 1); // behind HUD panels but above world
    vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.cameras.main.ignore(vignette);
    const hudObjects: Phaser.GameObjects.GameObject[] = (this as any).__hudObjects ?? [];
    hudObjects.push(vignette);
    (this as any).__hudObjects = hudObjects;
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
