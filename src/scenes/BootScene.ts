/** @entry Boot scene - splash screen before game */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Dark Isle',
      { fontSize: '48px', color: '#e0e0e0', fontFamily: 'monospace' }
    );
    text.setOrigin(0.5);

    // Transition to GameScene after 1 second
    this.time.delayedCall(1000, () => {
      this.scene.start('GameScene');
    });
  }
}
