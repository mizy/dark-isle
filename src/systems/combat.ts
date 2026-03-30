/** @entry CombatSystem - attack detection, damage, effects, death */

import Phaser from 'phaser';
import type { GameEntity } from '../types';
import { setOnAttack } from './enemyAI';
import { playAttackAnim } from './entityRenderer';

export class CombatSystem {
  private scene: Phaser.Scene;
  private player: GameEntity;
  private enemies: GameEntity[];
  private killCount = 0;
  private onKillCallback: ((enemy: GameEntity) => void) | null = null;
  private onPlayerDeathCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene, player: GameEntity, enemies: GameEntity[]) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.setupInput();
    this.setupEnemyAttackCallback();
  }

  getKillCount(): number {
    return this.killCount;
  }

  /** Set callback when an enemy is killed (for respawn logic) */
  setOnKill(cb: (enemy: GameEntity) => void): void {
    this.onKillCallback = cb;
  }

  /** Set callback when player dies */
  setOnPlayerDeath(cb: () => void): void {
    this.onPlayerDeathCallback = cb;
  }

  /** Per-frame update (reserved for future cooldown/buff systems) */
  update(_dt: number): void {
    // Currently combat is event-driven; this hook exists for future extensions
  }

  private setupInput(): void {
    this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', () => this.playerMeleeSwing());
  }

  /** Try player attack on click, returns true if hit an enemy (so click-to-move can be skipped) */
  tryClickAttack(): boolean {
    return this.playerAttack();
  }

  /** Space bar melee: always swing (with effect), even if no enemy hit */
  private playerMeleeSwing(): void {
    const now = this.scene.time.now;
    if (now - this.player.lastAttackTime < this.player.attackCooldown * 1000) return;
    this.player.lastAttackTime = now;

    playAttackAnim(this.player);
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (worldDistance(this.player, enemy) <= this.player.attackRange) {
        this.dealDamage(enemy, this.player.attack);
      }
    }
    this.spawnAttackEffect(this.player);
  }

  private setupEnemyAttackCallback(): void {
    setOnAttack((enemyId: string) => {
      const enemy = this.enemies.find((e) => e.id === enemyId);
      if (!enemy || !enemy.alive || !this.player.alive) return;
      // Cooldown check: prevent per-frame damage
      const now = this.scene.time.now;
      if (now - enemy.lastAttackTime < enemy.attackCooldown * 1000) return;
      enemy.lastAttackTime = now;
      playAttackAnim(enemy);
      this.dealDamage(this.player, enemy.attack);
      this.spawnAttackEffect(enemy);
    });
  }

  private playerAttack(): boolean {
    const now = this.scene.time.now;
    if (now - this.player.lastAttackTime < this.player.attackCooldown * 1000) return false;

    // Check if any enemy is in range before consuming cooldown
    const targetsInRange = this.enemies.filter(
      (e) => e.alive && worldDistance(this.player, e) <= this.player.attackRange,
    );
    if (targetsInRange.length === 0) return false;

    this.player.lastAttackTime = now;
    playAttackAnim(this.player);
    for (const enemy of targetsInRange) {
      this.dealDamage(enemy, this.player.attack);
    }

    this.spawnAttackEffect(this.player);
    return true;
  }

  private dealDamage(target: GameEntity, amount: number): void {
    target.hp = Math.max(0, target.hp - amount);

    // White flash: setTintFill produces solid white overlay
    target.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (!target.alive) return;
      // Restore enemy tint, clear player tint
      if (target.isEnemy) {
        target.sprite.setTint(0xff8888);
      } else {
        target.sprite.clearTint();
      }
    });

    this.spawnDamageText(target, amount);

    if (target.hp <= 0) {
      if (target.isEnemy) {
        this.killEnemy(target);
      } else {
        this.handlePlayerDeath(target);
      }
    }
  }

  private spawnAttackEffect(source: GameEntity): void {
    const fx = this.scene.add.image(source.sprite.x, source.sprite.y - 10, 'fx-attack');
    fx.setDepth(source.sprite.depth + 1);
    fx.setAlpha(0.9);

    this.scene.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 300,
      onComplete: () => fx.destroy(),
    });
  }

  private spawnDamageText(target: GameEntity, amount: number): void {
    const text = this.scene.add.text(
      target.sprite.x + (Math.random() - 0.5) * 10,
      target.sprite.y - 22,
      `-${amount}`,
      {
        fontSize: '14px',
        color: target.isEnemy ? '#ff4444' : '#ffcc00',
        fontStyle: 'bold',
        fontFamily: 'monospace',
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', fill: true, blur: 2 },
      },
    );
    text.setOrigin(0.5);
    text.setDepth(9999);
    text.setScale(0.5);

    // Pop-in scale then float up and fade
    this.scene.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          y: text.y - 28,
          scaleX: 0.8,
          scaleY: 0.8,
          alpha: 0,
          duration: 700,
          ease: 'Cubic.easeOut',
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  private handlePlayerDeath(player: GameEntity): void {
    player.alive = false;
    player.sprite.setTint(0x888888);
    this.scene.tweens.add({
      targets: player.sprite,
      alpha: 0.4,
      duration: 500,
    });
    if (this.onPlayerDeathCallback) this.onPlayerDeathCallback();
  }

  private killEnemy(enemy: GameEntity): void {
    enemy.alive = false;
    this.killCount++;

    // Death particle burst — red/orange soul fragments
    const sx = enemy.sprite.x;
    const sy = enemy.sprite.y;
    this.scene.add.particles(sx, sy - 10, 'particle-glow', {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 300, max: 600 },
      tint: [0xff4444, 0xff6622, 0xffaa00, 0xcc2222],
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      quantity: 8,
      emitting: false,
    }).explode(8, sx, sy - 10);

    // Small screen shake for impact feedback
    this.scene.cameras.main.shake(120, 0.004);

    this.scene.tweens.add({
      targets: enemy.sprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        // Destroy shadow
        const shadow = (enemy.sprite as any).__shadow;
        if (shadow) shadow.destroy();
        enemy.sprite.destroy();
        if (this.onKillCallback) this.onKillCallback(enemy);
      },
    });
  }
}

function worldDistance(a: GameEntity, b: GameEntity): number {
  const dx = a.worldX - b.worldX;
  const dy = a.worldY - b.worldY;
  return Math.sqrt(dx * dx + dy * dy);
}
