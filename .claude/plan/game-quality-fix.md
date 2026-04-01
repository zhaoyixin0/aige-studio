# Implementation Plan: Game Quality Fix (All Game Types)

## Task Type
- [x] Backend (Engine modules, auto-wirer, presets)
- [x] Frontend (Renderer)
- [x] Fullstack (Parallel)

---

## Systemic Root Causes

All bugs stem from **3 architectural issues**, not individual mistakes:

### RC1: Spawner-centric architecture assumption
The pipeline (renderer, auto-wirer, input→position) was designed around ONE game pattern:
"Spawner drops objects + InputModule provides player position." When Batch 2/3 introduced
different patterns (WaveSpawner+EnemyAI, PlayerMovement for shooting), the infrastructure
was NOT generalized. Every C/H bug traces to this.

### RC2: Module-isolated TDD without end-to-end integration
Each module passes unit tests. But integration tests either test the OLD Spawner-based
shooting pattern (`shooting-game.test.ts` still uses `type: 'Spawner'`!) or manually wire
state (`health.registerEntity('enemy-1')`) instead of testing that auto-wirer creates the
connections. Nobody tested "create shooting game → play → enemies appear → fire → score."

### RC3: Batch 2/3 modules don't declare dependencies
Batch 1 modules declare `getDependencies()` (Scorer→Collision, Lives→Collision). Batch 2/3
modules (Projectile, EnemyAI, WaveSpawner, Aim) inherit the empty default `{ requires: [],
optional: [] }`. Without declarations, the auto-wirer had no signal about what rules to add.

### Strategic fixes (prevent recurrence)
1. Wiring matrix: every module pair that needs connection must have an auto-wirer rule
2. Renderer mode abstraction: route by "game pattern" not by module name
3. Shared event payload types: compile-time enforcement of `player:move { x, y }`
4. Integration tests per game type: use ACTUAL preset config, verify end-to-end flow
5. New module checklist: getDependencies + auto-wirer rule + rendering path + integration test

---

## Symptom-Level Root Cause Analysis

### CRITICAL (Game is broken — zero playability)

**C1: WaveSpawner → EnemyAI wiring is MISSING**
- `WaveSpawner` emits `wave:spawn { id, x, y }` but nobody calls `EnemyAI.addEnemy(id, x, y)`
- Auto-wirer rule at `auto-wirer.ts:224-257` only registers enemies with Collision, NOT with EnemyAI
- Result: `enemyAI.getActiveEnemies()` always returns `[]` → no enemies rendered
- Affects: shooting, action-rpg

**C2: PlayerMovement doesn't emit Y coordinate in `player:move`**
- `player-movement.ts:190`: emits `{ x, direction, speed }` — NO `y`
- `projectile.ts:103`: checks `typeof data.y === 'number'` → fails → source stays at `(0, 0)`
- `enemy-ai.ts:74`: sets `this.playerY = data.y` → `undefined` → all distance calculations are NaN
- `aim.ts`: auto-aim uses playerX/playerY → broken targeting
- Result: Projectiles fire from top-left corner; enemies can't detect player
- Affects: shooting, action-rpg

**C3: Shooting/action-rpg incorrectly routed to platformer rendering path**
- `game-object-renderer.ts:58-71`: if PlayerMovement exists → syncPlatformerScene()
- Shooting preset includes PlayerMovement → goes through platformer renderer
- Player starts at x=0 (left edge!) because `PlayerMovement.x = 0` initial value
- Platform/collectible/hazard drawing code runs but finds nothing (harmless but wrong path)
- Result: Player rendered at wrong position, rendering logic mismatch
- Affects: shooting, action-rpg

**C4: Projectile fireEvent is `input:touch:tap` (manual fire)**
- Shooting preset: `fireEvent: 'input:touch:tap'`
- Users must manually tap for each bullet — not intuitive for a shooter
- Expected: auto-fire or continuous fire while touching
- Affects: shooting (action-rpg uses `input:touch:doubleTap` — also problematic)

### HIGH (Significantly degrades experience)

**H1: EnemyAI patrol with empty waypoints → enemies freeze at spawn position**
- Shooting preset: `behavior: 'patrol', waypoints: []`
- `enemy-ai.ts:119`: `if (waypoints.length === 0) break;` — patrol does nothing
- Even after C1 fix, enemies will sit still at spawn Y=100
- Fix: Change to downward movement pattern for vertical shooter

**H2: No default Y position for vertical shoot-em-up player**
- PlayerMovement only tracks X (horizontal) — no Y state at all
- Vertical shooter player should be fixed at ~85% canvas height
- Even with C2 fix, we need Y to have a sensible value

**H3: WaveSpawner enemy death not tracked by EnemyAI**
- WaveSpawner tracks `enemiesRemaining` via `enemy:death` event listener
- But WaveSpawner doesn't listen to `enemy:death` — it only has a `completeWave()` method
- Need to wire `enemy:death` → decrement `enemiesRemaining` → trigger `completeWave`

### MEDIUM (Degraded experience for specific game types)

**M1: Default playerSize too small across presets**
- TouchInput presets are `{}` (empty) — defaults to schema value
- Player character appears tiny on 1080x1920 canvas
- Fix: Set explicit `playerSize: 64` or higher in presets

**M2: Aim `queryTargets` callback pattern may not be responded to**
- Aim emits `aim:queryTargets` with callback
- Need to verify Collision responds (it should via auto-wirer or internal)

**M3: catch/dodge — player invisible until first touch**
- `TouchInput.currentPosition` starts as `null`
- `syncPlayer()` checks `if (pos)` — null means player not rendered
- User sees no character at game start, doesn't know where to touch
- Fix: TouchInput.getPosition() should return a default center-bottom position when null

**M4: runner — player rendering disconnected from lane system**
- Runner module tracks `currentLane` via `runner:laneChange` events
- But `syncPlayer()` uses `TouchInput.getPosition()` for player position
- Player visually follows finger, not the lane Runner says they're in
- Fix: game-object-renderer should read Runner.getCurrentLane() and compute lane X

**M5: platformer/shooting — PlayerMovement.x starts at 0 (left edge)**
- `private x = 0;` — player spawns at left edge of canvas
- Should initialize to `canvas.width / 2` (center)
- Affects all games using PlayerMovement: shooting, action-rpg, platformer

---

## Game Type Status Matrix

| Game Type | Status | Blocking Issues |
|-----------|--------|----------------|
| catch | Degraded | M1, M3 (player invisible until touch) |
| dodge | Degraded | M1, M3 (player invisible until touch) |
| tap | OK (minor) | M1 |
| **shooting** | **BROKEN** | **C1, C2, C3, C4, H1, H2, H3, M5** |
| quiz | OK | — |
| random-wheel | OK | — |
| expression | OK | — |
| runner | Degraded | M1, M4 (player vs lane disconnect) |
| gesture | OK | — |
| rhythm | OK (minor) | M1 |
| puzzle | OK | — |
| dress-up | OK | — |
| world-ar | OK | — |
| narrative | OK | — |
| platformer | Degraded | M5 (player starts at x=0) |
| **action-rpg** | **BROKEN** | **C1, C2, C3, C4, H1, H2, H3, M5** |

---

## Implementation Steps

### Step 1: Auto-wirer — WaveSpawner + EnemyAI wiring (C1 + H3)
**File:** `src/engine/core/auto-wirer.ts`
**Operation:** Add new wiring rule

```typescript
{
  // WaveSpawner + EnemyAI: spawn enemies into AI system, track deaths
  requires: ['WaveSpawner', 'EnemyAI'],
  setup: (engine, modules) => {
    const enemyAI = modules.get('EnemyAI') as EnemyAI;
    const waveSpawner = modules.get('WaveSpawner') as WaveSpawner;

    engine.eventBus.on('wave:spawn', (data?: any) => {
      if (data?.id != null) {
        enemyAI.addEnemy(data.id, data.x ?? 0, data.y ?? 0);
      }
    });

    engine.eventBus.on('enemy:death', (data?: any) => {
      if (data?.id != null) {
        enemyAI.removeEnemy(data.id);
        waveSpawner.enemyKilled(); // decrement remaining count
      }
    });
  },
},
```

Also need to add `enemyKilled()` method to WaveSpawner if not existing.

**Tests:** Verify wave:spawn → addEnemy → getActiveEnemies includes the enemy.

---

### Step 2: PlayerMovement — emit Y coordinate + defaultY param (C2 + H2)
**File:** `src/engine/modules/mechanic/player-movement.ts`
**Operation:** Modify

- Add `defaultY` param to schema (default: `0.85` as fraction of canvas height)
- Track `this.y` in addition to `this.x`
- In `update()`, resolve Y from defaultY * canvasHeight if not overridden by external input
- Emit `{ x, y, direction, speed }` in `player:move` event

```typescript
// Schema addition:
defaultY: { type: 'range', label: 'Default Y (fraction)', default: 0.85, min: 0, max: 1, step: 0.05 }

// In update():
const canvasH = this.engine?.getCanvas().height ?? 1920;
const y = this.y ?? (this.params.defaultY ?? 0.85) * canvasH;

this.emit('player:move', {
  x: this.x,
  y,
  direction: this.direction,
  speed: Math.abs(this.velocityX),
});
```

**Tests:** Verify player:move includes y coordinate.

---

### Step 3: Fix rendering path routing for shooter games (C3)
**File:** `src/engine/renderer/game-object-renderer.ts`
**Operation:** Modify `sync()` routing logic

Current logic: `if (playerMovement) → syncPlatformerScene()` catches shooting games.
Need a third path: shooter games have PlayerMovement but NOT StaticPlatform/Jump.

```typescript
sync(engine: Engine): void {
  const playerMovement = engine.getModulesByType('PlayerMovement')[0] as PlayerMovement | undefined;
  const hasPlatforms = engine.getModulesByType('StaticPlatform').length > 0
    || engine.getModulesByType('MovingPlatform').length > 0;

  if (playerMovement && hasPlatforms) {
    // Platformer path
    this.syncPlatformerScene(engine, playerMovement);
  } else if (playerMovement) {
    // Shooter/RPG path: render player from PlayerMovement position, no platforms
    this.syncShooterPlayer(engine, playerMovement);
  } else {
    // Spawner path (catch/dodge/tap)
    this.syncSpawnedObjects(engine);
    this.syncPlayer(engine);
  }
}
```

New `syncShooterPlayer()`: reads PlayerMovement.getX() and defaultY for position,
renders player sprite (same emoji/image logic), registers collision as 'player'.

**Tests:** Verify shooter games render player at center-bottom, not at x=0.

---

### Step 4: Auto-fire for shooting (C4)
**File:** `src/engine/modules/mechanic/projectile.ts`
**Operation:** Add `autoFire` parameter

```typescript
// Schema:
autoFire: { type: 'boolean', label: 'Auto Fire', default: false }

// In update():
if (this.params.autoFire && !this.gameflowPaused) {
  this.fire(); // fire() already handles cooldown via fireTimer
}
```

**File:** `src/agent/game-presets.ts`
**Operation:** Update shooting and action-rpg presets

```typescript
// shooting preset:
Projectile: { speed: 600, damage: 10, lifetime: 3000, fireRate: 200,
              autoFire: true, layer: 'projectiles', maxProjectiles: 50 }

// action-rpg preset:
Projectile: { speed: 500, damage: 15, lifetime: 2000, fireRate: 300,
              autoFire: true, layer: 'projectiles', maxProjectiles: 30 }
```

**Tests:** Verify projectiles fire automatically without input events.

---

### Step 5: Enemy behavior — downward patrol for vertical shooter (H1)
**File:** `src/agent/game-presets.ts`
**Operation:** Update shooting and action-rpg EnemyAI config

For vertical shoot-em-up, enemies should move downward toward the player:

```typescript
// Option A: Change behavior to 'chase' so enemies move toward player
EnemyAI: { behavior: 'chase', speed: 80, detectionRange: 2000, attackRange: 150, ... }

// Option B: Add vertical waypoints so patrol moves enemies downward
EnemyAI: { behavior: 'patrol', speed: 100, waypoints: [
  { x: 540, y: 200 }, { x: 540, y: 1400 }
], ... }
```

Recommend Option A (chase) since it's more dynamic and doesn't depend on fixed positions.
Set `detectionRange: 2000` (basically always detect player on 1920px canvas).

**Tests:** Verify enemies move toward player position.

---

### Step 6: Character size and preset polish (M1)
**File:** `src/agent/game-presets.ts`
**Operation:** Update TouchInput params across presets

```typescript
// All game types with TouchInput:
TouchInput: { playerSize: 64 }  // instead of {}
```

Also update shooting preset to not include Timer (or keep as safety):
- Keep Timer but increase to 120s as a safety timeout, not the primary end condition
- Primary end: `wave:allComplete` event → GameFlow finish

---

### Step 7: WaveSpawner enemyKilled() method (dependency for Step 1)
**File:** `src/engine/modules/mechanic/wave-spawner.ts`
**Operation:** Add public method

```typescript
enemyKilled(): void {
  if (this.enemiesRemaining > 0) {
    this.enemiesRemaining -= 1;
    if (this.enemiesRemaining === 0 && this.spawnedInWave >= this.currentWaveEnemyCount) {
      this.completeWave();
    }
  }
}
```

**Tests:** Verify wave completes after all enemies killed.

---

### Step 8: PlayerMovement initial X = canvas center (M5)
**File:** `src/engine/modules/mechanic/player-movement.ts`
**Operation:** Initialize X to canvas center in init()

```typescript
init(engine: GameEngine): void {
  super.init(engine);
  // Start at horizontal center
  this.x = (engine.getCanvas?.().width ?? 1080) / 2;
  // ... rest of init
}
```

**Tests:** Verify getX() returns center after init.

---

### Step 9: TouchInput default position for catch/dodge (M3)
**File:** `src/engine/modules/input/touch-input.ts`
**Operation:** Set default position on init

```typescript
init(engine: GameEngine): void {
  super.init(engine);
  const canvas = engine.getCanvas();
  // Default to center-bottom so player is visible before first touch
  this.currentPosition = { x: canvas.width / 2, y: canvas.height * 0.85 };
  // ... rest of init
}
```

**Tests:** Verify getPosition() returns non-null after init.

---

### Step 10: Runner lane-based player rendering (M4)
**File:** `src/engine/renderer/game-object-renderer.ts`
**Operation:** Modify syncPlayer() to check for Runner module

When Runner module exists, compute player X from lane position instead of touch:

```typescript
const runner = engine.getModulesByType('Runner')[0] as Runner | undefined;
if (runner && runner.isStarted()) {
  const laneCount = runner.getParams().laneCount ?? 3;
  const lane = runner.getCurrentLane();
  const canvas = engine.getCanvas();
  const laneWidth = canvas.width / laneCount;
  pos = { x: laneWidth * (lane + 0.5), y: canvas.height * 0.8 };
}
```

**Tests:** Verify runner player position matches current lane.

---

### Step 11: Aim queryTargets response (M2)
**File:** `src/engine/core/auto-wirer.ts`
**Operation:** Verify or add Collision response to `aim:queryTargets`

Collision module should respond to `aim:queryTargets` by returning objects in the requested layer:

```typescript
// If not already handled:
engine.eventBus.on('aim:queryTargets', (data?: any) => {
  if (data?.layer && data?.callback) {
    const objects = collision.getObjectsInLayer(data.layer);
    data.callback(objects);
  }
});
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/core/auto-wirer.ts` | Modify | Add WaveSpawner+EnemyAI wiring + aim:queryTargets |
| `src/engine/modules/mechanic/player-movement.ts` | Modify | Y tracking, defaultY param, init x=center |
| `src/engine/renderer/game-object-renderer.ts` | Modify | 3-path routing (platformer/shooter/spawner), runner lane rendering |
| `src/engine/modules/mechanic/projectile.ts` | Modify | Add autoFire parameter |
| `src/engine/modules/mechanic/wave-spawner.ts` | Modify | Add enemyKilled() method |
| `src/engine/modules/input/touch-input.ts` | Modify | Default position on init |
| `src/agent/game-presets.ts` | Modify | Fix shooting/action-rpg presets, playerSize |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| PlayerMovement Y change breaks platformer | Platformer uses Gravity for Y — defaultY only applies when Gravity absent |
| Auto-fire too fast/slow | fireRate param already controls timing; 200ms = 5 shots/sec is reasonable |
| Enemy chase too aggressive | Tune speed + attackRange; add cooldown between attacks |
| game-object-renderer changes affect catch/dodge | Guard: Spawner path unchanged; new PlayerMovement path is additive |
| Build errors from new types | Run `npx tsc -b` before push (not `tsc --noEmit`) |

## Execution Order

**Phase A: Make shooting/action-rpg playable (CRITICAL)**
1. Step 7 (WaveSpawner.enemyKilled) — dependency for Step 1
2. Step 1 (Auto-wirer WaveSpawner+EnemyAI) — enemies actually appear
3. Step 8 (PlayerMovement init x = center) — player starts at center
4. Step 2 (PlayerMovement Y + defaultY) — player position complete
5. Step 3 (Renderer routing fix) — correct rendering path for shooter
6. Step 4 (Auto-fire) — gameplay feels right
7. Step 5 (Enemy behavior chase) — enemies are dynamic

**Phase B: Fix other game types (MEDIUM)**
8. Step 9 (TouchInput default position) — catch/dodge player visible at start
9. Step 10 (Runner lane rendering) — runner player matches lane
10. Step 6 (Preset polish) — character sizes, timer tuning

**Phase C: Verification**
11. Step 11 (Aim targets) — auto-aim works
12. Full test run across all 16 game types

## SESSION_ID
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
