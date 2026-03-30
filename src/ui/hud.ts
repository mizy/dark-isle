/** @entry HUD - dark fantasy style health bar with ornamental frame, kill counter */

import Phaser from 'phaser';

const BAR_X = 24;
const BAR_Y = 24;
const BAR_W = 200;
const BAR_H = 18;
const FRAME_PAD = 5;

export class HUD {
  private barBg: Phaser.GameObjects.Graphics;
  private barFill: Phaser.GameObjects.Graphics;
  private barFrame: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private skullIcon: Phaser.GameObjects.Graphics;
  private lastHp = -1;
  private lastMaxHp = -1;
  private lastKillCount = -1;

  constructor(scene: Phaser.Scene) {
    const cam = scene.cameras.main;

    // HP bar background
    this.barBg = scene.add.graphics();
    this.barBg.setScrollFactor(0);
    this.barBg.setDepth(10000);

    // HP bar fill
    this.barFill = scene.add.graphics();
    this.barFill.setScrollFactor(0);
    this.barFill.setDepth(10001);

    // Ornamental frame overlay
    this.barFrame = scene.add.graphics();
    this.barFrame.setScrollFactor(0);
    this.barFrame.setDepth(10002);
    this.drawFrame();

    // HP text with shadow
    this.hpText = scene.add.text(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, '100/100', {
      fontSize: '12px',
      color: '#f5e6d0',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', fill: true, blur: 3 },
    });
    this.hpText.setOrigin(0.5);
    this.hpText.setScrollFactor(0);
    this.hpText.setDepth(10003);

    // Skull icon for kill counter
    this.skullIcon = scene.add.graphics();
    this.skullIcon.setScrollFactor(0);
    this.skullIcon.setDepth(10000);
    this.drawSkullIcon(cam.width - 90, 22);

    // Kill counter text
    this.killText = scene.add.text(cam.width - 20, 24, '0', {
      fontSize: '16px',
      color: '#e8c44a',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', fill: true, blur: 4 },
    });
    this.killText.setOrigin(1, 0);
    this.killText.setScrollFactor(0);
    this.killText.setDepth(10000);

    // Control hints
    this.hintText = scene.add.text(cam.width / 2, cam.height - 22, 'WASD 移动 · 空格 攻击 · 点击移动', {
      fontSize: '11px',
      color: '#776655',
      fontFamily: 'monospace',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', fill: true, blur: 2 },
    });
    this.hintText.setOrigin(0.5);
    this.hintText.setScrollFactor(0);
    this.hintText.setDepth(10000);
    this.hintText.setAlpha(0.6);

    this.drawBar(100, 100);
  }

  update(hp: number, maxHp: number, killCount: number): void {
    if (hp !== this.lastHp || maxHp !== this.lastMaxHp) {
      this.drawBar(hp, maxHp);
      this.hpText.setText(`${Math.ceil(hp)}/${maxHp}`);
      this.lastHp = hp;
      this.lastMaxHp = maxHp;
    }
    if (killCount !== this.lastKillCount) {
      this.killText.setText(`${killCount}`);
      this.lastKillCount = killCount;
    }
  }

  private drawFrame(): void {
    const g = this.barFrame;
    const x = BAR_X - FRAME_PAD;
    const y = BAR_Y - FRAME_PAD;
    const w = BAR_W + FRAME_PAD * 2;
    const h = BAR_H + FRAME_PAD * 2;

    // Outer dark shadow border
    g.lineStyle(2, 0x000000, 0.8);
    g.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 5);

    // Main ornamental border — warm bronze
    g.lineStyle(2, 0x8a6e3e, 0.9);
    g.strokeRoundedRect(x, y, w, h, 4);

    // Inner highlight line — gold accent
    g.lineStyle(1, 0xc4a44a, 0.5);
    g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 3);

    // Corner studs (small circles at corners for ornamental feel)
    const studs = [
      { cx: x + 3, cy: y + 3 },
      { cx: x + w - 3, cy: y + 3 },
      { cx: x + 3, cy: y + h - 3 },
      { cx: x + w - 3, cy: y + h - 3 },
    ];
    for (const s of studs) {
      g.fillStyle(0xc4a44a, 0.7);
      g.fillCircle(s.cx, s.cy, 2);
      g.fillStyle(0xffe088, 0.4);
      g.fillCircle(s.cx - 0.5, s.cy - 0.5, 1);
    }

    // Small heart/cross icon left of bar
    const iconX = BAR_X - 2;
    const iconY = BAR_Y + BAR_H / 2;
    g.fillStyle(0xcc3333, 0.9);
    g.fillCircle(iconX - 5, iconY - 2, 3);
    g.fillCircle(iconX - 1, iconY - 2, 3);
    g.fillTriangle(iconX - 8, iconY - 1, iconX + 2, iconY - 1, iconX - 3, iconY + 4);
  }

  private drawBar(hp: number, maxHp: number): void {
    const ratio = Math.max(0, hp / maxHp);

    this.barBg.clear();
    // Deep dark inner background
    this.barBg.fillStyle(0x0a0608, 0.95);
    this.barBg.fillRoundedRect(BAR_X - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2, 3);
    // Subtle inner shadow groove
    this.barBg.fillStyle(0x000000, 0.5);
    this.barBg.fillRect(BAR_X, BAR_Y, BAR_W, 2);

    this.barFill.clear();
    if (ratio > 0) {
      const fillW = BAR_W * ratio;
      // Color gradient based on health level
      let mainColor: number;
      let brightColor: number;
      let pulseColor: number;

      if (ratio > 0.5) {
        mainColor = 0x8a2222;
        brightColor = 0xcc3333;
        pulseColor = 0xdd5544;
      } else if (ratio > 0.25) {
        mainColor = 0x886622;
        brightColor = 0xcc8833;
        pulseColor = 0xddaa44;
      } else {
        mainColor = 0xaa1111;
        brightColor = 0xdd2222;
        pulseColor = 0xff3333;
      }

      // Main fill gradient simulation
      this.barFill.fillStyle(mainColor, 1);
      this.barFill.fillRoundedRect(BAR_X, BAR_Y, fillW, BAR_H, 2);

      // Top bright highlight strip
      this.barFill.fillStyle(brightColor, 0.5);
      this.barFill.fillRect(BAR_X + 1, BAR_Y + 1, fillW - 2, BAR_H * 0.3);

      // Middle bright line
      this.barFill.fillStyle(pulseColor, 0.2);
      this.barFill.fillRect(BAR_X + 1, BAR_Y + BAR_H * 0.35, fillW - 2, 1);

      // Bottom shadow
      this.barFill.fillStyle(0x000000, 0.4);
      this.barFill.fillRect(BAR_X + 1, BAR_Y + BAR_H * 0.75, fillW - 2, BAR_H * 0.25);

      // Right edge glow (damage indicator position)
      if (ratio < 1) {
        this.barFill.fillStyle(brightColor, 0.3);
        this.barFill.fillRect(BAR_X + fillW - 2, BAR_Y + 1, 2, BAR_H - 2);
      }
    }
  }

  private drawSkullIcon(x: number, y: number): void {
    const g = this.skullIcon;

    // Decorative bracket around kill counter
    g.lineStyle(1, 0x8a6e3e, 0.6);
    g.beginPath(); g.moveTo(x - 4, y - 2); g.lineTo(x - 4, y + 16); g.strokePath();
    g.beginPath(); g.moveTo(x - 4, y - 2); g.lineTo(x, y - 2); g.strokePath();
    g.beginPath(); g.moveTo(x - 4, y + 16); g.lineTo(x, y + 16); g.strokePath();

    // Skull cranium
    g.fillStyle(0xccaa77, 0.9);
    g.fillCircle(x + 8, y + 5, 6);
    // Jaw
    g.fillRoundedRect(x + 3, y + 8, 10, 5, 1);
    // Eye sockets
    g.fillStyle(0x110808, 1);
    g.fillCircle(x + 6, y + 5, 2);
    g.fillCircle(x + 10, y + 5, 2);
    // Eye glow
    g.fillStyle(0xff4400, 0.4);
    g.fillCircle(x + 6, y + 5, 1);
    g.fillCircle(x + 10, y + 5, 1);
    // Nose
    g.fillStyle(0x110808, 0.9);
    g.fillTriangle(x + 7, y + 7, x + 9, y + 7, x + 8, y + 9);
    // Teeth
    g.fillStyle(0xbbaa88, 0.8);
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + 4 + i * 2.5, y + 10, 1.5, 2.5);
    }
  }
}
