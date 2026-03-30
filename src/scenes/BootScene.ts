/** @entry Boot scene - preload character spritesheets, all tiles are procedurally generated */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Only load character spritesheets — all tile/decoration textures are procedurally generated
    this.load.spritesheet('sheet-player', 'assets/characters/male_heavy.png', {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.spritesheet('sheet-enemy', 'assets/characters/skeleton.png', {
      frameWidth: 256,
      frameHeight: 256,
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
