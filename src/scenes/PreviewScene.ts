/** entry Preview scene - character sprite/animation debugger */
import Phaser from "phaser";

const CHARACTERS = [
  { key: "sheet-player", label: "Player (male_longsword)", prefix: "player"  },
  { key: "sheet-enemy",  label: "Enemy (skeleton)",        prefix: "enemy"  },
];

const ANIM_STATES = ["idle", "walk", "attach"] as const;

export class PreviewScene extends Phaser.Scene {
  private sprites: Phaser.GameObjects.Sprite[] = [];

  constructor() { super({ key: "PreviewScene" }); }

  preload() {
    this.load.spritesheet("sheet-player", "assets/characters/male_longsword.png", { frameWidth: 64, frameHeight: 128, margin: 0, spacing: 0 });
    this.load.spritesheet("sheet-enemy",  "assets/characters/skeleton.png",        { frameWidth: 64, frameHeight: 128, margin: 0, spacing: 0 });
  }

  create() {
    this.cameras.main.setBackgroundColor("#1a1a2e");
    this.add.text(this.cameras.main.centerX, 20, "Character Preview", { fontSize: "24px", color: "#fffffff", fontFamily: "monospace" }).setOrigin(0.5, 0);
    this.createAnimations();
    this.buildGrid();
    this.addNavHints();
  }

  private createAnimations(): void {
    for (const { key, prefix } of CHARACTERS) {
      this.anims.create({ key: prefix + "-idle",   frames: [ { key, frame: 16 }],                                                                     frameRate: 1,  repeat: -1 });
      this.anims.create({ key: prefix + "-walk",   frames: this.anims.generateFrameNumbers(key, { start: 16, end: 23 }),                                                   frameRate: 8,  repeat: -1 });
      this.anims.create({ key: prefix + "-attack", frames: this.anims.generateFrameNumbers(key, { start: 24, end: 29 }),                                                    frameRate: 12, repeat: 0 });
    }
  }

  private buildGrid(): void {
    CHARACTERS.forEach((char, charIdx) => {
      const col  = charIdx % 2;
      const x    = (col == 0 ? 80 : 400);
      const y    = (charIdx == 0 ? 70 : 250);
      this.add.text(x, y, char.label, { fontSize: "14px", color: "#ffd700", fontFamily: "monospace" });
      const spr = this.add.sprite(x + 80, y + 90, char.key, 16);
      spr.setScale(2.0);
      this.sprites.push(spr);
      spr.play(char.prefix + "-idle");
      ANIM_STATES.forEach((state, idx) => {
        this.makeButton(x + idx * 90, y + 180, state, charIdx);
      });
    });
  }

  private makeButton(x: number, y: number, state: string, charIdx: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x334455, 1);
    bg.fillRoundedRect(0, 0, 85, 30, 6);
    bg.lineStyle(1, 0x88aacc, 1);
    bg.strokeRoundedRect(0, 0, 85, 30, 6);
    const lbl = this.add.text(42, 15, state.toUpperCase(), { fontSize: "12px", color: "#fffffff", fontFamily: "monospace" }).setOrigin(0.5, 0.5);
    const cont = this.add.container(x, y, [bg, lbl]);
    cont.setSize(85, 30);
    cont.setInteractive({ useHandCursor: true });
    cont.on("pointerover", () => { bg.clear(); bg.fillStyle(0x556677, 1); bg.fillRoundedRect(0, 0, 85, 30, 6); bg.lineStyle(1, 0x88aacc, 1); bg.strokeRoundedRect(0, 0, 85, 30, 6); });
    cont.on("pointerout",  () => { bg.clear(); bg.fillStyle(0x334455, 1); bg.fillRoundedRect(0, 0, 85, 30, 6); bg.lineStyle(1, 0x88aacc, 1); bg.strokeRoundedRect(0, 0, 85, 30, 6); });
    cont.on("pointerdown", () => {
      const prefix = CHARACTERS[charIdx].prefix;
      const spr = this.sprites[charIdx];
      spr.play(prefix + "-" + state);
      if (state !== "idle") {
        spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.play(prefix + "-idle"));
      }
    });
  }

  private addNavHints(): void {
    this.add.text(this.cameras.main.centerX, 450, "Click buttons to preview animations", { fontSize: "12px", color: "#666688", fontFamily: "monospace" }).setOrigin(0.5, 0);
  }
}
