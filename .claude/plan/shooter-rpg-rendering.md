# Implementation Plan: Shooter/RPG PixiJS Rendering

## Task Type
- [x] Frontend (PixiJS rendering layer)
- [ ] Backend
- [ ] Fullstack

## Overview

13 modules (7 shooter + 6 RPG) have complete logic/state management but zero visual rendering. This plan adds PixiJS rendering for all of them following the existing pull-based sub-renderer pattern.

## Technical Solution

### Architecture Decision: 2 New Sub-Renderers + HUD Extensions

Follow the established pattern (GameObjectRenderer, ParticleRenderer, etc.):

1. **ShooterRenderer** — renders projectiles, enemies, aim crosshair, shield visual overlay
2. **RPGOverlayRenderer** — renders dialogue box, drop items, status effect icons
3. **HudRenderer extensions** — wave counter, player health bar, shield charges, XP bar, level display

This mirrors how GameObjectRenderer handles spawner+platformer visuals, and HudRenderer handles per-game-type UI.

### Data Flow

```
Engine.tick()
  → PixiRenderer.render(engine, dt)
    → shooterRenderer.sync(engine)       // NEW: reads Projectile, EnemyAI, Aim, Shield
    → rpgOverlayRenderer.sync(engine, dt) // NEW: reads DialogueSystem, StatusEffect, EnemyDrop
    → gameObjectRenderer.sync(engine)     // EXISTING (spawner/platformer)
    → hudRenderer.sync(engine, dt)        // EXTENDED: +wave, +health bar, +shield, +XP, +level
    → particleRenderer.update(dt)
    → floatTextRenderer.update(dt)
```

---

## Implementation Steps

### Phase 1: Shooter Rendering (Steps 1-5)

#### Step 1: Create ShooterRenderer — projectiles + collision sync
**File:** `src/engine/renderer/shooter-renderer.ts` (NEW, ~200 lines)

Read `Projectile.getActiveProjectiles()` each frame:
- Render each projectile as theme `bulletEmoji` or small circle Graphics
- Position at `(proj.x, proj.y)`, rotate toward `(proj.dx, proj.dy)`
- Register each projectile with Collision: `collision.updateObject(proj.id, {x, y, radius: collisionRadius})`
- Remove sprites for destroyed projectiles (diff against previous frame IDs)
- Use sprite pooling (reuse Container objects) for performance with up to 50 projectiles

Read `EnemyAI.getActiveEnemies()` each frame:
- Render each enemy as theme `badEmojis[0]` or AI-generated enemy asset
- Position at `(enemy.x, enemy.y)`
- Draw mini health bar above enemy (Graphics: green fill proportional to `hp/maxHp`)
- Register with Collision: `collision.updateObject(enemy.id, {x, y, radius, layer: 'enemies'})`
- State-based visual hints: alpha=0.3 for dead, tint red for flee, normal otherwise
- Remove sprites for dead/removed enemies

**Pseudo-code:**
```typescript
class ShooterRenderer {
  private container: Container;
  private projectileSprites = new Map<string, Container>();
  private enemySprites = new Map<string, Container>();

  sync(engine: Engine): void {
    const projectile = engine.getModulesByType('Projectile')[0] as Projectile | undefined;
    const enemyAI = engine.getModulesByType('EnemyAI')[0] as EnemyAI | undefined;
    const collision = engine.getModulesByType('Collision')[0] as Collision | undefined;
    if (!projectile && !enemyAI) { this.container.visible = false; return; }
    this.container.visible = true;

    // Sync projectiles
    this.syncProjectiles(projectile, collision, engine);
    // Sync enemies
    this.syncEnemies(enemyAI, collision, engine);
  }
}
```

**Expected deliverable:** Bullets fly across screen, enemies visible with health bars, collision working.

#### Step 2: Add aim crosshair + shield visual to ShooterRenderer
**Extend:** `src/engine/renderer/shooter-renderer.ts`

Aim crosshair:
- Read `Aim.getAimDirection()` → `{dx, dy}`
- Draw crosshair sprite at `playerPos + direction * 80px` offset
- Use Graphics: circle with cross lines, semi-transparent
- Only visible when Aim module exists

Shield visual:
- Read `Shield.getCharges()` and `Shield.isActive()`
- Draw shield indicator around player: semi-transparent circle/arc
- Opacity proportional to charges/maxCharges
- Flash animation on `shield:absorbed` event (handled in Step 4)

**Expected deliverable:** Crosshair shows aim direction, shield glow visible on player.

#### Step 3: Extend HudRenderer for shooter HUD
**Modify:** `src/engine/renderer/hud-renderer.ts`

Add shooter-specific HUD container (conditional, like quiz/wheel containers):

Wave counter:
- Read `WaveSpawner.getCurrentWave()`, `WaveSpawner.getEnemiesRemaining()`
- Display: `"Wave {n}"` top-center-left, `"Enemies: {remaining}"` below
- Pulse animation on `wave:start` event

Player health bar:
- Read `Health.getEntity('player_1')` → `{hp, maxHp}`
- Draw horizontal bar below lives display: green→yellow→red gradient
- Width proportional to `hp/maxHp`

Shield charges:
- Read `Shield.getCharges()` and config `maxCharges`
- Draw N circles/dots: filled = active charge, empty = depleted
- Position below health bar

**Expected deliverable:** Wave info, health bar, shield dots visible in HUD.

#### Step 4: Add shooter event effects in connectToEngine
**Modify:** `src/engine/renderer/pixi-renderer.ts`

Add new event listeners:

```typescript
listen('enemy:death', (data) => {
  particleRenderer.burst(data.x, data.y, 0xFF6B6B, 12);  // red burst
  floatTextRenderer.spawn(data.x, data.y - 30, 'KILL!', 0xFF4500);
  soundSynth.playScore();
});

listen('shield:block', (data) => {
  // Flash shield visual
  shooterRenderer?.flashShield();
  soundSynth.playHit();
});

listen('shield:break', () => {
  particleRenderer.burst(playerX, playerY, 0x4488FF, 15);  // blue burst
});

listen('wave:start', (data) => {
  floatTextRenderer.spawn(540, 400, `WAVE ${data.wave}`, 0xFFFFFF);
  soundSynth.playCombo(data.wave);
});

listen('projectile:fire', () => {
  soundSynth.playScore();  // or add shootSound to SoundSynth
});
```

**Expected deliverable:** Visual/audio feedback for kills, shields, wave starts.

#### Step 5: Register ShooterRenderer in PixiRenderer
**Modify:** `src/engine/renderer/pixi-renderer.ts`

- Import and instantiate `ShooterRenderer` in `init()`
- Add to `render()` pipeline
- Add to `destroy()` cleanup
- Reset on `connectToEngine()`

**Expected deliverable:** Full shooter rendering pipeline integrated.

---

### Phase 2: RPG Rendering (Steps 6-9)

#### Step 6: Create RPGOverlayRenderer — dialogue box
**File:** `src/engine/renderer/rpg-overlay-renderer.ts` (NEW, ~250 lines)

Read `DialogueSystem.getCurrentNode()` each frame:
- If null: hide overlay
- If active: show dialogue box at bottom 25% of screen
  - Semi-transparent dark background (0x000000, alpha 0.7)
  - Speaker name (bold, top-left of box)
  - Dialogue text (white, word-wrapped, center of box)
  - If choices: render choice buttons (rounded rect + text)
  - "Tap to continue" hint for linear nodes
  - Choice selection via touch events on choice containers

Read `EnemyDrop` events for drop item visuals:
- Listen to `drop:spawn` event → create floating item sprite at (x,y)
- Item drifts down slightly, then fades after 2 seconds
- Uses theme goodEmojis for collectible drops, heart emoji for health drops

**Pseudo-code:**
```typescript
class RPGOverlayRenderer {
  private container: Container;
  private dialogueBox: Container | null = null;
  private dropSprites: Map<string, { sprite: Container; lifetime: number }>;

  sync(engine: Engine, dt: number): void {
    this.syncDialogue(engine);
    this.updateDrops(dt);
  }
}
```

**Expected deliverable:** Dialogue box shows during conversations, loot drops visible.

#### Step 7: Add status effect icons to RPGOverlayRenderer
**Extend:** `src/engine/renderer/rpg-overlay-renderer.ts`

Status effect display:
- Read `StatusEffect.getActiveEffects()` each frame
- Render icon row below player (or top-right corner)
- Each effect: colored square (green=buff, red=debuff) + name abbreviation
- Duration bar underneath each icon (shrinks as duration decreases)
- Stack count badge if stacks > 1

**Expected deliverable:** Active buffs/debuffs visible as icons with duration bars.

#### Step 8: Extend HudRenderer for RPG HUD
**Modify:** `src/engine/renderer/hud-renderer.ts`

Add RPG-specific HUD container:

XP bar:
- Read `LevelUp.getLevel()`, `LevelUp.getCurrentXp()`, `LevelUp.xpToNextLevel()`
- Draw thin bar at very top of screen (or below score)
- Purple/blue gradient fill proportional to `currentXp / xpToNext`
- Text: `"Lv.{level}"` left-aligned

Equipment summary (simplified):
- Read `EquipmentSlot.getAllEquipped()` (if exists)
- Show small icons for equipped weapon/armor slots (2-3 slots max in HUD)
- Full equipment UI would be a separate panel (out of scope for this plan)

Skill points indicator:
- Read `SkillTree.getAvailablePoints()`
- If > 0: show pulsing badge `"SP: {n}"` next to level display

**Expected deliverable:** XP bar, level display, skill point indicator in HUD.

#### Step 9: Register RPGOverlayRenderer + RPG events in PixiRenderer
**Modify:** `src/engine/renderer/pixi-renderer.ts`

Register RPGOverlayRenderer:
- Instantiate in `init()`, add to render pipeline
- Add to `destroy()` cleanup

Add RPG event effects:
```typescript
listen('levelup:levelup', (data) => {
  floatTextRenderer.spawn(540, 600, `LEVEL UP! Lv.${data.level}`, 0xFFD700);
  particleRenderer.burst(540, 800, 0xFFD700, 20);
  soundSynth.playCombo(data.level);
});

listen('skill:activate', (data) => {
  floatTextRenderer.spawn(540, 700, data.name, 0x00BFFF);
});

listen('drop:spawn', (data) => {
  rpgOverlayRenderer?.addDrop(data);
});

listen('dialogue:start', () => {
  // Dim game layer slightly during dialogue
});

listen('dialogue:end', () => {
  // Restore game layer
});
```

**Expected deliverable:** Full RPG rendering pipeline integrated.

---

### Phase 3: Tests (Step 10)

#### Step 10: Unit tests for both renderers
**Files:**
- `src/engine/renderer/__tests__/shooter-renderer.test.ts` (NEW)
- `src/engine/renderer/__tests__/rpg-overlay-renderer.test.ts` (NEW)

Test approach (mock PixiJS containers, real module instances):
- ShooterRenderer: projectile sprite creation/removal, enemy health bar proportions, aim crosshair positioning, shield visual state
- RPGOverlayRenderer: dialogue box visibility toggling, choice rendering, drop sprite lifecycle, status effect icon count
- HUD extensions: wave counter text, health bar width, XP bar fill, level text

**Expected deliverable:** 30+ tests, all passing.

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/renderer/shooter-renderer.ts` | Create | Projectile + enemy + aim + shield rendering |
| `src/engine/renderer/rpg-overlay-renderer.ts` | Create | Dialogue box + drop items + status effects |
| `src/engine/renderer/pixi-renderer.ts` | Modify | Register new renderers, add event listeners |
| `src/engine/renderer/hud-renderer.ts` | Modify | Wave counter, health bar, shield, XP, level |
| `src/engine/renderer/__tests__/shooter-renderer.test.ts` | Create | Shooter renderer tests |
| `src/engine/renderer/__tests__/rpg-overlay-renderer.test.ts` | Create | RPG overlay tests |

## Module → Renderer API Mapping

| Module | Public API for Renderer | Renderer |
|--------|------------------------|----------|
| `Projectile` | `getActiveProjectiles(): ProjectileInstance[]` | ShooterRenderer |
| `EnemyAI` | `getActiveEnemies(): EnemyInstance[]` | ShooterRenderer |
| `Aim` | `getAimDirection(): {dx, dy, targetId?}` | ShooterRenderer |
| `Shield` | `getCharges(): number`, `isActive(): boolean` | ShooterRenderer + HUD |
| `Health` | `getEntity(id): {hp, maxHp}` | ShooterRenderer (enemy bars) + HUD (player bar) |
| `WaveSpawner` | `getCurrentWave(): number`, `getEnemiesRemaining(): number` | HUD |
| `BulletPattern` | (no direct rendering — works through Projectile) | — |
| `DialogueSystem` | `getCurrentNode(): DialogueNode \| null` | RPGOverlayRenderer |
| `StatusEffect` | `getActiveEffects(): ActiveEffect[]` | RPGOverlayRenderer |
| `EnemyDrop` | (event-driven: `drop:spawn`) | RPGOverlayRenderer |
| `LevelUp` | `getLevel()`, `getCurrentXp()`, `xpToNextLevel()` | HUD |
| `SkillTree` | `getAvailablePoints()`, `getUnlockedSkills()` | HUD |
| `EquipmentSlot` | `getEquipped(slot): Equipment` | HUD (simplified) |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| 50 projectiles at 60fps could lag | Sprite pooling + reuse Containers instead of destroy/create each frame |
| Enemy health bars are many small Graphics | Use single Graphics object for all health bars, clear+redraw each frame |
| Dialogue box touch events conflict with game input | DialogueSystem already emits `gameflow:pause`, disable game input during dialogue |
| HudRenderer is already 16K lines | Add shooter/RPG sections as isolated methods, consider extracting to separate file if >20K |
| Theme emoji mapping for enemies | Use `badEmojis[0]` for enemies, `bulletEmoji` for projectiles (already in theme) |
| RPG modules may not all be present in a game | Guard every module read with `if (!module) return` — renderers only activate when modules exist |

## Estimated New Code

| File | Lines |
|------|-------|
| shooter-renderer.ts | ~250 |
| rpg-overlay-renderer.ts | ~280 |
| pixi-renderer.ts changes | ~50 |
| hud-renderer.ts changes | ~200 |
| shooter-renderer.test.ts | ~150 |
| rpg-overlay-renderer.test.ts | ~150 |
| **Total** | **~1,080** |

## SESSION_ID
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
