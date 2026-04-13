/** @entry Boot scene - preload DCSS sprites for tiles and characters */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // DCSS floor tiles - stone floor variants
    const floorTiles = [
      'floor_cobble_blood_1_new', 'floor_cobble_blood_2_new', 'floor_cobble_blood_3_new',
      'floor_crypt_10', 'floor_crypt_11', 'floor_dirt_0_new', 'floor_dirt_1_new',
      'floor_limestone_0', 'floor_limestone_1', 'floor_limestone_2',
      'floor_sand_1', 'floor_sand_2', 'floor_sand_3',
    ];
    for (const tile of floorTiles) {
      this.load.image(`dcss-${tile}`, `assets/dcss/dungeon/floor/${tile}.png`);
    }

    // DCSS grass tiles
    this.load.image('dcss-grass-full', 'assets/dcss/dungeon/floor/grass/grass_full_new.png');
    this.load.image('dcss-grass-north', 'assets/dcss/dungeon/floor/grass/grass_north_new.png');
    this.load.image('dcss-grass-south', 'assets/dcss/dungeon/floor/grass/grass_south_new.png');
    this.load.image('dcss-grass-east', 'assets/dcss/dungeon/floor/grass/grass_east_new.png');
    this.load.image('dcss-grass-west', 'assets/dcss/dungeon/floor/grass/grass_west_new.png');

    // DCSS wall tiles (brick variants that exist)
    const wallTiles = [
      'brick_brown_0', 'brick_brown_1', 'brick_brown_2', 'brick_brown_3',
      'brick_brown-vines_1', 'brick_brown-vines_2',
    ];
    for (const tile of wallTiles) {
      this.load.image(`dcss-wall-${tile}`, `assets/dcss/dungeon/wall/${tile}.png`);
    }

    // DCSS doors
    this.load.image('dcss-door-closed', 'assets/dcss/dungeon/doors/closed_door.png');
    this.load.image('dcss-door-open', 'assets/dcss/dungeon/doors/open_door.png');

    // DCSS decorations
    this.load.image('dcss-tree', 'assets/dcss/dungeon/trees/tree_1_red.png');
    this.load.image('dcss-rock', 'assets/dcss/dungeon/floor/boulder.png');
    this.load.image('dcss-chest', 'assets/dcss/dungeon/chest.png');
    this.load.image('dcss-pillar', 'assets/dcss/dungeon/zot_pillar.png');

    // Player character - Kenney roguelike spritesheet (male longsword, cartoon style)
    this.load.spritesheet('sheet-player', 'assets/characters/male_longsword.png', {
      frameWidth: 64,
      frameHeight: 128,
      margin: 0,
      spacing: 0,
    });

    // Enemy - Kenney roguelike skeleton spritesheet
    this.load.spritesheet('sheet-enemy', 'assets/characters/skeleton.png', {
      frameWidth: 64,
      frameHeight: 128,
      margin: 0,
      spacing: 0,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#08070f');
    this.createCharacterAnimations();

    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Dark Isle',
      { fontSize: '48px', color: '#e0e0e0', fontFamily: 'monospace' }
    );
    text.setOrigin(0.5);

    this.time.delayedCall(1000, () => {
      this.scene.start('GameScene');
    });
  }

  private createCharacterAnimations(): void {
    this.anims.create({
      key: 'player-idle',
      frames: [{ key: 'sheet-player', frame: 16 }],
      frameRate: 1,
      repeat: -1,
    });
    this.anims.create({
      key: 'player-walk',
      frames: this.anims.generateFrameNumbers('sheet-player', { start: 16, end: 23 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'player-attack',
      frames: this.anims.generateFrameNumbers('sheet-player', { start: 24, end: 29 }),
      frameRate: 12,
      repeat: 0,
    });

    this.anims.create({
      key: 'enemy-idle',
      frames: [{ key: 'sheet-enemy', frame: 16 }],
      frameRate: 1,
      repeat: -1,
    });
    this.anims.create({
      key: 'enemy-walk',
      frames: this.anims.generateFrameNumbers('sheet-enemy', { start: 16, end: 23 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'enemy-attack',
      frames: this.anims.generateFrameNumbers('sheet-enemy', { start: 24, end: 29 }),
      frameRate: 12,
      repeat: 0,
    });
  }
}
