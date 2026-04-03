/** @entry Boot scene - preload DCSS sprites for tiles and characters */
import Phaser from 'phaser';
import { preloadLpcSheets } from '../assets/lpcSprites';
import { preloadKenneyChar } from '../assets/kenneyIsoChar';

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

    // Player character - DCSS deep elf blademaster (32x32 single frame, not spritesheet)
    this.load.image('char-player', 'assets/dcss/monster/deep_elf_blademaster.png');

    // Enemy - DCSS skeleton
    this.load.image('char-enemy', 'assets/dcss/monster/skeleton.png');

    // LPC isometric character spritesheets (Clint Bellanger, CC0)
    preloadLpcSheets(this);

    // Kenney Isometric Miniature Dungeon characters (CC0)
    preloadKenneyChar(this, 'Male');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08070f');

    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Dark Isle',
      { fontSize: '48px', color: '#e0e0e0', fontFamily: 'monospace' }
    );
    text.setOrigin(0.5);

    this.time.delayedCall(500, () => {
      this.scene.start('GameScene');
    });
  }
}
