/** @entry HUD - positioned via a fixed UI camera (zoom=1, no scroll)
 *
 * Pattern:
 *  1. Create a UI camera that covers the full canvas, zoom=1, no scroll.
 *  2. Tag all HUD game objects with a custom name via setName().
 *  3. Tell the MAIN camera to ignore those objects.
 *  4. Tell the UI camera to ignore everything EXCEPT those objects —
 *     achieved by giving world objects a shared group and ignoring the group.
 *
 * Simpler shortcut used here:
 *  - All HUD objects go into a Phaser.GameObjects.Container.
 *  - main camera ignores the container.
 *  - UI camera ignores nothing (renders everything), BUT we set the
 *    container's position to (0,0) and the UI camera has no scroll, so
 *    world tiles appear behind (since the UI camera also has depth > world).
 *
 * Actually the cleanest Phaser pattern for fixed HUD:
 *  - Create UI cam with scene.cameras.add().setName('ui')
 *  - All HUD objects: scene.cameras.main.ignore(obj)   ← main skips them
 *  - All world objects: uiCam.ignore(obj)              ← ui skips them
 *
 * We achieve this by ignoring the hud Container in main, and ignoring the
 * hud container's children list in ui is automatic since only the container
 * (not its children) needs to be visible to the ui camera.
 *
 * FINAL simple approach: put all HUD into a Container at (0,0),
 * main camera ignores the container, UI camera (zoom=1,scroll=0) renders it.
 * UI camera also needs to ignore all the world tiles — we do this by setting
 * uiCam to only render objects at depth >= DEPTH_UI. Unfortunately Phaser
 * doesn't have depth filtering per camera. So we use the ignore list properly.
 */

import Phaser from 'phaser';
import { DEPTH_UI } from '../systems/isometric';

const PAD = 16;
const PANEL_H = 44;
const PANEL_W = 220;
const BAR_H = 14;
const BAR_W = 140;
const AVATAR_R = 18;

const C_PANEL_BG   = 0x1a1a2e;
const C_PANEL_EDGE = 0x4a3f6b;
const C_HP_HIGH    = 0x44dd66;
const C_HP_MID     = 0xeeaa22;
const C_HP_LOW     = 0xff3333;
const C_HP_BG      = 0x0d0d1a;
const C_GOLD       = 0xffd700;
const C_SKULL_BG   = 0x2a1a1a;
const C_SKULL_EDGE = 0x6b3f3f;

export class HUD {
  private barFill: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;

  private lastHp = -1;
  private lastMaxHp = -1;
  private lastKillCount = -1;

  // Bar geometry in screen pixels
  private barX = 0;
  private barY = 0;

  constructor(scene: Phaser.Scene) {
    const W = scene.scale.width;
    const H = scene.scale.height;

    // ── UI camera: zoom=1, no scroll, renders on top ──────────────────────
    const uiCam = scene.cameras.add(0, 0, W, H);
    uiCam.setName('hud');
    uiCam.setScroll(0, 0);
    // uiCam has no zoom so coords are screen pixels 1:1

    // All objects added to the scene are visible to ALL cameras by default.
    // We will ignore world objects in uiCam by keeping track of them and
    // calling uiCam.ignore() AFTER the HUD is built (done in GameScene).
    // For now, build the HUD objects and ignore them in the main camera.

    const all: Phaser.GameObjects.GameObject[] = [];

    const mkG = (depth = DEPTH_UI): Phaser.GameObjects.Graphics => {
      const g = scene.add.graphics();
      g.setDepth(depth);
      all.push(g);
      return g;
    };

    const mkT = (
      x: number, y: number, txt: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
      depth = DEPTH_UI,
    ): Phaser.GameObjects.Text => {
      const t = scene.add.text(x, y, txt, style);
      t.setDepth(depth);
      all.push(t);
      return t;
    };

    // ── HP panel (top-left, screen pixels) ───────────────────────────────
    const px = PAD;
    const py = PAD;

    const panel = mkG();
    this.drawPanel(panel, px, py, PANEL_W, PANEL_H);
    const avX = px + PAD + AVATAR_R;
    const avY = py + PANEL_H / 2;
    this.drawAvatar(panel, avX, avY);

    this.barX = avX + AVATAR_R + 10;
    this.barY = avY - BAR_H / 2 - 4;

    const barBg = mkG(DEPTH_UI + 1);
    barBg.fillStyle(C_HP_BG, 1);
    barBg.fillRoundedRect(this.barX, this.barY, BAR_W, BAR_H, 7);
    barBg.lineStyle(1, 0x000000, 0.6);
    barBg.strokeRoundedRect(this.barX, this.barY, BAR_W, BAR_H, 7);

    this.barFill = mkG(DEPTH_UI + 2);

    this.hpText = mkT(
      this.barX + BAR_W / 2, this.barY + BAR_H + 5,
      '100 / 100',
      { fontSize: '11px', color: '#cccccc', fontFamily: 'Arial, sans-serif',
        shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true, blur: 2 } },
      DEPTH_UI + 3,
    );
    this.hpText.setOrigin(0.5, 0);

    // ── Kill panel (top-right) ────────────────────────────────────────────
    const kpW = 90; const kpH = PANEL_H;
    const kpX = W - PAD - kpW;
    const kpY = PAD;

    const killPanel = mkG();
    this.drawPanel(killPanel, kpX, kpY, kpW, kpH, C_SKULL_BG, C_SKULL_EDGE);
    this.drawSkullIcon(killPanel, kpX + 14, kpY + kpH / 2);

    mkT(kpX + 34, kpY + 7, 'KILLS', {
      fontSize: '9px', color: '#aa7777', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
    }, DEPTH_UI + 1);

    this.killText = mkT(kpX + 34, kpY + 18, '0', {
      fontSize: '18px',
      color: `#${C_GOLD.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true, blur: 4 },
    }, DEPTH_UI + 1);

    // ── Hint (bottom-center) ──────────────────────────────────────────────
    const hint = mkT(W / 2, H - 10, 'WASD · 空格攻击 · 点击移动', {
      fontSize: '10px', color: '#556677', fontFamily: 'Arial, sans-serif',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true, blur: 2 },
    });
    hint.setOrigin(0.5, 1).setAlpha(0.55);

    // ── Wire up cameras ───────────────────────────────────────────────────
    // Main camera ignores all HUD objects
    scene.cameras.main.ignore(all);
    // UI camera needs to ignore world objects — store list for GameScene to use
    (scene as any).__hudObjects = all;
    (scene as any).__uiCam = uiCam;

    this.drawBar(100, 100);
  }

  update(hp: number, maxHp: number, killCount: number): void {
    if (hp !== this.lastHp || maxHp !== this.lastMaxHp) {
      this.drawBar(hp, maxHp);
      this.hpText.setText(`${Math.ceil(hp)} / ${maxHp}`);
      this.lastHp = hp;
      this.lastMaxHp = maxHp;
    }
    if (killCount !== this.lastKillCount) {
      this.killText.setText(`${killCount}`);
      this.lastKillCount = killCount;
    }
  }

  private drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
    bg = C_PANEL_BG, edge = C_PANEL_EDGE): void {
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x + 2, y + 2, w, h, 10);
    g.fillStyle(bg, 0.88);
    g.fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(0xffffff, 0.06);
    g.fillRoundedRect(x + 1, y + 1, w - 2, h / 2, { tl: 9, tr: 9, bl: 0, br: 0 });
    g.lineStyle(1.5, edge, 0.8);
    g.strokeRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, 0xffffff, 0.07);
    g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 9);
  }

  private drawAvatar(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.lineStyle(2, 0xdd4466, 0.9);
    g.strokeCircle(cx, cy, AVATAR_R);
    g.fillStyle(0x2a0d1a, 0.9);
    g.fillCircle(cx, cy, AVATAR_R - 2);
    const s = 5;
    g.fillStyle(0xff4477, 1);
    g.fillCircle(cx - s * 0.55, cy - s * 0.3, s * 0.6);
    g.fillCircle(cx + s * 0.55, cy - s * 0.3, s * 0.6);
    g.fillTriangle(cx - s, cy - s * 0.1, cx + s, cy - s * 0.1, cx, cy + s * 1.1);
    g.fillStyle(0xff88aa, 0.6);
    g.fillCircle(cx - s * 0.4, cy - s * 0.5, s * 0.25);
  }

  private drawBar(hp: number, maxHp: number): void {
    const bx = this.barX, by = this.barY;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const fw = BAR_W * ratio;
    this.barFill.clear();
    if (fw <= 0) return;

    const color = ratio > 0.5 ? C_HP_HIGH : ratio > 0.25 ? C_HP_MID : C_HP_LOW;
    this.barFill.fillStyle(color, 1);
    this.barFill.fillRoundedRect(bx, by, fw, BAR_H, 7);
    this.barFill.fillStyle(0xffffff, 0.25);
    this.barFill.fillRoundedRect(bx + 1, by + 1, Math.max(0, fw - 2), BAR_H * 0.35, { tl: 5, tr: 5, bl: 0, br: 0 });
    this.barFill.fillStyle(0x000000, 0.2);
    this.barFill.fillRoundedRect(bx + 1, by + BAR_H * 0.65, Math.max(0, fw - 2), BAR_H * 0.3, { tl: 0, tr: 0, bl: 5, br: 5 });
    for (let i = 1; i < 5; i++) {
      const tx = bx + (BAR_W / 5) * i;
      if (tx < bx + fw - 1) {
        this.barFill.lineStyle(1, 0x000000, 0.2);
        this.barFill.beginPath();
        this.barFill.moveTo(tx, by + 2);
        this.barFill.lineTo(tx, by + BAR_H - 2);
        this.barFill.strokePath();
      }
    }
  }

  private drawSkullIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.fillStyle(0xddccaa, 1); g.fillCircle(cx, cy - 2, 8);
    g.fillStyle(0xccbb99, 1); g.fillRoundedRect(cx - 5.6, cy + 3, 11.2, 6.4, 2);
    g.fillStyle(0x1a0a0a, 1); g.fillCircle(cx - 3, cy - 3, 2.5); g.fillCircle(cx + 3, cy - 3, 2.5);
    g.fillStyle(0xff5500, 0.7); g.fillCircle(cx - 3, cy - 3, 1.2); g.fillCircle(cx + 3, cy - 3, 1.2);
    g.fillStyle(0x1a0a0a, 0.8); g.fillTriangle(cx - 1.5, cy, cx + 1.5, cy, cx, cy + 2.5);
    g.fillStyle(0xeeddcc, 1);
    for (let i = 0; i < 3; i++) g.fillRect(cx - 4 + i * 3.2, cy + 4, 2, 3);
  }
}
