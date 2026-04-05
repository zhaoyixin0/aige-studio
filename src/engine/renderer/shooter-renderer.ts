import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Engine } from '@/engine/core/engine';
import type { Projectile } from '@/engine/modules/mechanic/projectile';
import type { EnemyAI } from '@/engine/modules/mechanic/enemy-ai';
import type { Aim } from '@/engine/modules/mechanic/aim';
import type { Shield } from '@/engine/modules/mechanic/shield';
import type { GameFlow } from '@/engine/modules/feedback/game-flow';
import { getTheme } from './theme-registry';
import { loadDataUrlIntoContainer } from './image-utils';

// ── Pure helper functions (exported for testing) ────────────────

/** Compute rotation angle from direction vector (radians). */
export function computeProjectileRotation(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

/** Compute health bar fill width proportional to hp ratio. */
export function computeHealthBarWidth(
  hp: number,
  maxHp: number,
  barMaxWidth: number,
): number {
  if (maxHp <= 0) return 0;
  const ratio = Math.max(0, Math.min(hp / maxHp, 1));
  return Math.round(ratio * barMaxWidth);
}

/** Compute aim crosshair position offset from player. */
export function computeAimIndicatorPos(
  playerX: number,
  playerY: number,
  dx: number,
  dy: number,
  offset: number,
): { x: number; y: number } {
  return {
    x: playerX + dx * offset,
    y: playerY + dy * offset,
  };
}

/** Compute shield visual alpha from charge count. */
export function computeShieldAlpha(
  charges: number,
  maxCharges: number,
): number {
  if (maxCharges <= 0) return 0;
  return Math.max(0, Math.min(charges / maxCharges, 1));
}

/** Diff current sprite IDs against active IDs to find adds/removes. */
export function diffSpriteIds(
  currentIds: ReadonlySet<string>,
  activeIds: ReadonlySet<string>,
): { toAdd: string[]; toRemove: string[] } {
  const toAdd: string[] = [];
  const toRemove: string[] = [];
  for (const id of activeIds) {
    if (!currentIds.has(id)) toAdd.push(id);
  }
  for (const id of currentIds) {
    if (!activeIds.has(id)) toRemove.push(id);
  }
  return { toAdd, toRemove };
}

export interface PositionProvider {
  getPosition(): { x: number; y: number } | null;
}

const DEFAULT_PLAYER_POS = { x: 540, y: 1600 };

/** Resolve player position from available input modules (face > hand > touch > default). */
export function resolvePlayerPosition(
  faceInput: PositionProvider | undefined,
  handInput: PositionProvider | undefined,
  touchInput: PositionProvider | undefined,
): { x: number; y: number } {
  const input = faceInput ?? handInput ?? touchInput;
  return input?.getPosition() ?? DEFAULT_PLAYER_POS;
}

/** Get health bar color based on hp ratio: green > 0.6, yellow > 0.3, red otherwise. */
export function getHealthBarColor(ratio: number): number {
  if (ratio > 0.6) return 0x44CC44; // green
  if (ratio > 0.3) return 0xCCCC44; // yellow
  return 0xCC4444; // red
}

// ── Constants ───────────────────────────────────────────────────

const PROJECTILE_FONT_SIZE = 20;
const ENEMY_FONT_SIZE = 40;
const HEALTH_BAR_WIDTH = 40;
const HEALTH_BAR_HEIGHT = 4;
const HEALTH_BAR_OFFSET_Y = -30;
const AIM_CROSSHAIR_OFFSET = 80;
const AIM_CROSSHAIR_RADIUS = 18;
const SHIELD_RADIUS = 45;

// ── ShooterRenderer class ───────────────────────────────────────

export class ShooterRenderer {
  private container: Container;
  private projectileSprites = new Map<string, Container>();
  private enemySprites = new Map<string, Container>();
  private aimCrosshair: Graphics | null = null;
  private shieldCircle: Graphics | null = null;
  private shieldFlashTimer = 0;
  /** Pending tween offsets applied during sync() */
  private tweenOffsets = new Map<string, Partial<Record<string, number>>>();

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);
  }

  sync(engine: Engine, dt?: number): void {
    const projectile = engine.getModulesByType('Projectile')[0] as Projectile | undefined;
    const enemyAI = engine.getModulesByType('EnemyAI')[0] as EnemyAI | undefined;

    // Only activate when shooter modules are present
    if (!projectile && !enemyAI) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    const gameFlow = engine.getModulesByType('GameFlow')[0] as GameFlow | undefined;
    const state = gameFlow?.getState() ?? 'playing';
    if (state !== 'playing' && state !== 'finished') {
      this.container.visible = false;
      return;
    }

    const themeName = engine.getConfig().meta.theme ?? 'fruit';
    const theme = getTheme(themeName);
    const configAssets = engine.getConfig().assets ?? {};

    if (projectile) {
      const bulletAssetKey = (projectile.getParams().asset ?? 'bullet') as string;
      const bulletSrc = configAssets[bulletAssetKey]?.src;
      this.syncProjectiles(projectile, theme.bulletEmoji, bulletSrc);
    }
    if (enemyAI) {
      const enemyAssetKey = (enemyAI.getParams().asset ?? 'enemy_1') as string;
      const enemySrc = configAssets[enemyAssetKey]?.src;
      this.syncEnemies(enemyAI, theme.badEmojis[0] ?? '👾', enemySrc);
    }

    // Aim crosshair
    const aim = engine.getModulesByType('Aim')[0] as Aim | undefined;
    this.syncAimCrosshair(aim, engine);

    // Shield visual
    const shield = engine.getModulesByType('Shield')[0] as Shield | undefined;
    this.syncShieldVisual(shield, engine, dt);

    // Apply tween offsets on top of base positions (once per frame)
    this.applyTweenOffsets();
  }

  private applyTweenOffsets(): void {
    for (const [id, offsets] of this.tweenOffsets) {
      const sprite = this.enemySprites.get(id) ?? this.projectileSprites.get(id) ?? null;
      if (!sprite) continue;
      if (offsets.x != null) sprite.x += offsets.x;
      if (offsets.y != null) sprite.y += offsets.y;
      if (offsets.scaleX != null) sprite.scale.x = offsets.scaleX;
      if (offsets.scaleY != null) sprite.scale.y = offsets.scaleY;
      if (offsets.rotation != null) sprite.rotation = offsets.rotation;
      if (offsets.alpha != null) sprite.alpha = offsets.alpha;
    }
  }

  /** Store pending tween offsets for an entity. Returns false if entity sprite not found. */
  applyTweenUpdate(entityId: string, properties: Record<string, number>): boolean {
    const sprite = this.enemySprites.get(entityId) ?? this.projectileSprites.get(entityId) ?? null;
    if (!sprite) return false;
    this.tweenOffsets.set(entityId, { ...this.tweenOffsets.get(entityId), ...properties });
    return true;
  }

  /** Remove all tween offsets for an entity. */
  clearTweenOffset(entityId: string): void {
    this.tweenOffsets.delete(entityId);
  }

  /** Flash shield visual (called from event handler). */
  flashShield(): void {
    this.shieldFlashTimer = 0.2; // 200ms flash
  }

  private syncProjectiles(
    projectile: Projectile,
    bulletEmoji: string,
    imageSrc?: string,
  ): void {
    const active = projectile.getActiveProjectiles();
    const activeIds = new Set(active.map((p) => p.id));
    const { toAdd, toRemove } = diffSpriteIds(
      new Set(this.projectileSprites.keys()),
      activeIds,
    );

    // Remove destroyed projectiles
    for (const id of toRemove) {
      const sprite = this.projectileSprites.get(id);
      if (sprite) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.projectileSprites.delete(id);
        this.tweenOffsets.delete(id);
      }
    }

    // Add new projectiles
    for (const id of toAdd) {
      const wrapper = new Container();
      if (imageSrc?.startsWith('data:')) {
        loadDataUrlIntoContainer(wrapper, imageSrc, PROJECTILE_FONT_SIZE);
      } else {
        const text = new Text({
          text: bulletEmoji,
          style: new TextStyle({ fontSize: PROJECTILE_FONT_SIZE }),
        });
        text.anchor.set(0.5);
        wrapper.addChild(text);
      }
      this.container.addChild(wrapper);
      this.projectileSprites.set(id, wrapper);
    }

    // Update positions
    for (const proj of active) {
      const sprite = this.projectileSprites.get(proj.id);
      if (sprite) {
        sprite.x = proj.x;
        sprite.y = proj.y;
        sprite.rotation = computeProjectileRotation(proj.dx, proj.dy);
      }
      // Collision sync now handled by AutoWirer via Projectile contract
    }
  }

  private syncEnemies(
    enemyAI: EnemyAI,
    enemyEmoji: string,
    imageSrc?: string,
  ): void {
    const active = enemyAI.getActiveEnemies();
    const activeIds = new Set(active.map((e) => e.id));
    const { toAdd, toRemove } = diffSpriteIds(
      new Set(this.enemySprites.keys()),
      activeIds,
    );

    // Remove dead/removed enemies
    for (const id of toRemove) {
      const sprite = this.enemySprites.get(id);
      if (sprite) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.enemySprites.delete(id);
        this.tweenOffsets.delete(id);
      }
    }

    // Add new enemies
    for (const id of toAdd) {
      const wrapper = new Container();
      if (imageSrc?.startsWith('data:')) {
        loadDataUrlIntoContainer(wrapper, imageSrc, ENEMY_FONT_SIZE);
      } else {
        const text = new Text({
          text: enemyEmoji,
          style: new TextStyle({ fontSize: ENEMY_FONT_SIZE }),
        });
        text.anchor.set(0.5);
        wrapper.addChild(text);
      }

      // Health bar background (dark)
      const hpBg = new Graphics();
      hpBg.rect(-HEALTH_BAR_WIDTH / 2, HEALTH_BAR_OFFSET_Y, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT)
        .fill({ color: 0x333333 });
      wrapper.addChild(hpBg);

      // Health bar fill (green)
      const hpFill = new Graphics();
      hpFill.rect(-HEALTH_BAR_WIDTH / 2, HEALTH_BAR_OFFSET_Y, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT)
        .fill({ color: 0x44CC44 });
      wrapper.addChild(hpFill);

      this.container.addChild(wrapper);
      this.enemySprites.set(id, wrapper);
    }

    // Update positions and health bars
    for (const enemy of active) {
      const wrapper = this.enemySprites.get(enemy.id);
      if (!wrapper) continue;

      wrapper.x = enemy.x;
      wrapper.y = enemy.y;

      // State-based visual hints
      if (enemy.state === 'dead') {
        wrapper.alpha = 0.3;
      } else if (enemy.state === 'flee') {
        wrapper.alpha = 0.6;
      } else {
        wrapper.alpha = 1.0;
      }

      // Update health bar fill (last child is fill Graphics)
      const hpFill = wrapper.children[wrapper.children.length - 1] as Graphics;
      if (hpFill instanceof Graphics) {
        const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(enemy.hp / enemy.maxHp, 1)) : 0;
        const fillWidth = computeHealthBarWidth(enemy.hp, enemy.maxHp, HEALTH_BAR_WIDTH);
        const color = getHealthBarColor(ratio);
        hpFill.clear();
        if (fillWidth > 0) {
          hpFill.rect(-HEALTH_BAR_WIDTH / 2, HEALTH_BAR_OFFSET_Y, fillWidth, HEALTH_BAR_HEIGHT)
            .fill({ color });
        }
      }

      // Collision sync now handled by AutoWirer via EnemyAI contract
    }
  }

  private syncAimCrosshair(aim: Aim | undefined, engine: Engine): void {
    if (!aim) {
      if (this.aimCrosshair) {
        this.aimCrosshair.visible = false;
      }
      return;
    }

    if (!this.aimCrosshair) {
      this.aimCrosshair = new Graphics();
      this.container.addChild(this.aimCrosshair);
    }

    const dir = aim.getAimDirection();
    const playerPos = resolvePlayerPosition(
      engine.getModulesByType('FaceInput')[0] as unknown as PositionProvider | undefined,
      engine.getModulesByType('HandInput')[0] as unknown as PositionProvider | undefined,
      engine.getModulesByType('TouchInput')[0] as unknown as PositionProvider | undefined,
    );

    const pos = computeAimIndicatorPos(
      playerPos.x,
      playerPos.y,
      dir.dx,
      dir.dy,
      AIM_CROSSHAIR_OFFSET,
    );

    this.aimCrosshair.clear();
    this.aimCrosshair.circle(pos.x, pos.y, AIM_CROSSHAIR_RADIUS)
      .stroke({ color: 0x00FF88, width: 2, alpha: 0.6 });
    this.aimCrosshair.moveTo(pos.x - 10, pos.y).lineTo(pos.x + 10, pos.y)
      .stroke({ color: 0x00FF88, width: 1, alpha: 0.6 });
    this.aimCrosshair.moveTo(pos.x, pos.y - 10).lineTo(pos.x, pos.y + 10)
      .stroke({ color: 0x00FF88, width: 1, alpha: 0.6 });
    this.aimCrosshair.visible = true;
  }

  private syncShieldVisual(
    shield: Shield | undefined,
    engine: Engine,
    dt?: number,
  ): void {
    if (!shield) {
      if (this.shieldCircle) {
        this.shieldCircle.visible = false;
      }
      return;
    }

    if (!this.shieldCircle) {
      this.shieldCircle = new Graphics();
      this.container.addChild(this.shieldCircle);
    }

    const charges = shield.getCharges();
    const maxCharges = (shield.getParams().maxCharges ?? 3) as number;
    const alpha = computeShieldAlpha(charges, maxCharges);

    // Flash timer
    if (dt != null) {
      this.shieldFlashTimer = Math.max(0, this.shieldFlashTimer - dt / 1000);
    }
    const flashBoost = this.shieldFlashTimer > 0 ? 0.4 : 0;

    const playerPos = resolvePlayerPosition(
      engine.getModulesByType('FaceInput')[0] as unknown as PositionProvider | undefined,
      engine.getModulesByType('HandInput')[0] as unknown as PositionProvider | undefined,
      engine.getModulesByType('TouchInput')[0] as unknown as PositionProvider | undefined,
    );

    this.shieldCircle.clear();
    if (alpha > 0 || flashBoost > 0) {
      const finalAlpha = Math.min(alpha * 0.3 + flashBoost, 1);
      this.shieldCircle.circle(playerPos.x, playerPos.y, SHIELD_RADIUS)
        .stroke({ color: 0x4488FF, width: 3, alpha: finalAlpha });
      this.shieldCircle.visible = true;
    } else {
      this.shieldCircle.visible = false;
    }
  }

  reset(): void {
    this.tweenOffsets.clear();
    for (const sprite of this.projectileSprites.values()) {
      this.container.removeChild(sprite);
      sprite.destroy();
    }
    this.projectileSprites.clear();

    for (const sprite of this.enemySprites.values()) {
      this.container.removeChild(sprite);
      sprite.destroy();
    }
    this.enemySprites.clear();

    if (this.aimCrosshair) {
      this.container.removeChild(this.aimCrosshair);
      this.aimCrosshair.destroy();
      this.aimCrosshair = null;
    }

    if (this.shieldCircle) {
      this.container.removeChild(this.shieldCircle);
      this.shieldCircle.destroy();
      this.shieldCircle = null;
    }

    this.shieldFlashTimer = 0;
  }

  destroy(): void {
    this.reset();
    this.container.destroy();
  }
}
