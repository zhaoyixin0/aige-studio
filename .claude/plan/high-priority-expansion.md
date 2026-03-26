# Implementation Plan: High-Priority Expansion (3 Tasks)

> **Date:** 2026-03-25
> **Scope:** Batch 2 (7 Shooter), Batch 3 (6 Action-RPG), Platform Physics Integration
> **Baseline:** 47 modules, 963 tests, 115+ events

---

## Task Type
- [x] Backend (Engine modules + tests)
- [ ] Frontend (deferred — renderer/editor updates in separate PR)

## Execution Order

**CRITICAL: Task 3 (Physics Integration) must come FIRST** — it wires existing modules into a working physics pipeline, unblocking both shooter and RPG modules that depend on collision, gravity, and health systems.

```
Phase A: Platform Physics Integration (Task 3)
    ↓ foundation ready
Phase B: Shooter Modules (Task 2) — depends on Collision, Health
    ↓
Phase C: Action-RPG Modules (Task 3) — depends on Health, StatusEffect
```

---

## Phase A: Platform Physics Integration

### Problem
Currently, Gravity, PlayerMovement, platforms, Jump, CoyoteTime, Dash, Knockback are individually functional but NOT wired together. Players don't land on platforms, moving platforms don't carry players, and collision doesn't update floorY.

### Solution: PlatformPhysics AutoWirer Rules

Add 6 new wiring rules to `auto-wirer.ts` that coordinate existing modules:

### Step A1: Gravity ↔ Platform Wiring

**New AutoWirer rule: `Platform* + Gravity`**

When any platform module + Gravity coexist:
- Each platform emits `platform:surface` on init with `{id, x, y, width, height, type}`
- Gravity listens to `platform:surface` and maintains a `surfaces[]` array
- In `Gravity.update()`, instead of checking only `obj.floorY`, iterate surfaces to find the highest platform below the player
- Platform contact → update `obj.floorY` dynamically, emit `gravity:landed`
- Player leaves platform horizontally → restore default floorY, set airborne

**Pseudo-code for Gravity enhancement:**
```typescript
// In Gravity.update(), after velocity calculation:
private findFloorY(obj: GravityObject): number {
  let bestFloor = this.defaultFloorY;
  for (const surface of this.surfaces) {
    // Player's X must overlap surface horizontally
    if (obj.x >= surface.x && obj.x <= surface.x + surface.width) {
      // Surface must be below player (or at player level)
      if (surface.y <= obj.y + EPSILON && surface.y > bestFloor - obj.y) {
        // For one-way platforms: only if falling (velocityY >= 0)
        if (surface.oneWay && obj.velocityY < 0) continue;
        bestFloor = surface.y;
      }
    }
  }
  return bestFloor;
}
```

### Step A2: Moving Platform → Player Carry

**New AutoWirer rule: `MovingPlatform + Gravity + PlayerMovement`**

- MovingPlatform emits `platform:move {id, x, y, dx, dy}` each frame (dx/dy = frame delta)
- Gravity tracks which surface the player is standing on (`currentPlatformId`)
- When player is on a moving platform: apply dx to player.x each frame
- PlayerMovement adds its own velocity on top of platform velocity

**Pseudo-code:**
```typescript
// AutoWirer setup:
engine.eventBus.on('platform:move', (data) => {
  const gravObj = gravity.getObject('player');
  if (gravObj && gravObj.currentPlatformId === data.id && !gravObj.airborne) {
    // Carry player with platform
    playerMovement.applyExternalForce(data.dx, 0);
    gravObj.floorY = data.y; // Update floor to new platform position
  }
});
```

### Step A3: OneWayPlatform Drop-Through

- OneWayPlatform marks its surfaces with `oneWay: true`
- Gravity's `findFloorY()` skips one-way surfaces when `velocityY < 0` (moving upward)
- Drop-through: on `input:touch:swipe:down`, temporarily remove surface from Gravity for 200ms

### Step A4: CrumblingPlatform Timer Integration

- CrumblingPlatform listens to `gravity:landed` with platform ID match
- On land → start crumble timer → emit `platform:crumble {id}` → remove surface from Gravity
- If `respawnTime > 0` → re-add surface after timer

### Step A5: Dash ↔ Gravity Interaction

**New AutoWirer rule: `Dash + Gravity`**

- `dash:start` → Gravity temporarily suspends Y velocity for dash duration
- `dash:end` → Gravity resumes (airborne state preserved)

### Step A6: Knockback ↔ PlayerMovement

**New AutoWirer rule: `Knockback + PlayerMovement`**

- `knockback:start` → PlayerMovement ignores input for knockback duration
- `knockback:end` → PlayerMovement resumes accepting input

### Key Files to Modify

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/modules/mechanic/gravity.ts` | Modify | Add `surfaces[]`, `findFloorY()`, `currentPlatformId` tracking |
| `src/engine/modules/mechanic/player-movement.ts` | Modify | Add `applyExternalForce()`, knockback lock |
| `src/engine/modules/mechanic/static-platform.ts` | Modify | Emit `platform:surface` on init |
| `src/engine/modules/mechanic/moving-platform.ts` | Modify | Emit `platform:move` with dx/dy, emit `platform:surface` |
| `src/engine/modules/mechanic/one-way-platform.ts` | Modify | Mark surfaces as oneWay, handle drop-through |
| `src/engine/modules/mechanic/crumbling-platform.ts` | Modify | Listen `gravity:landed`, remove surface on crumble |
| `src/engine/core/auto-wirer.ts` | Modify | Add 4-6 new wiring rules |
| `src/engine/core/events.ts` | Modify | Add new event constants |

### Tests (TDD)

1. **Gravity surface resolution** — player lands on platform, not default floorY
2. **Multi-platform priority** — player lands on highest platform below
3. **Moving platform carry** — player X moves with platform
4. **One-way pass-through** — jumping up passes through, falling lands
5. **Drop-through** — swipe down temporarily removes surface
6. **Crumbling lifecycle** — land → timer → crumble → fall → respawn
7. **Dash suspends gravity** — Y velocity frozen during dash
8. **Knockback locks movement** — input ignored during knockback
9. **Integration: full platformer loop** — jump between platforms, collect items, avoid hazards

**Estimated: ~15 new tests, ~200 lines of module changes**

---

## Phase B: Shooter Modules (7 New Modules)

### Module Dependency Graph

```
Aim (input mapping)
  ↓
Projectile (fires bullets) ←── BulletPattern (configures spread)
  ↓ collision:hit
Health (generic HP) ←── Shield (absorbs hits)
  ↓ health:zero
EnemyAI (behavior) ←── WaveSpawner (progressive waves)
```

### Step B1: Health Module

**File:** `src/engine/modules/mechanic/health.ts`

Generic HP system for any entity — replaces Lives for non-player entities.

```typescript
interface HealthEntity {
  id: string;
  hp: number;
  maxHp: number;
}

// Schema:
{
  maxHp: { type: 'range', default: 100, min: 1, max: 9999 },
  damageEvent: { type: 'string', default: 'collision:damage' },
  healEvent: { type: 'string', default: '' },
  showBar: { type: 'boolean', default: true },
}

// Events emitted:
// health:change { id, hp, maxHp, delta }
// health:zero { id }

// Events listened:
// ${damageEvent} → reduce HP
// ${healEvent} → increase HP
```

**Key difference from Lives:** Health is per-entity (enemies, breakables), Lives is global player lives.

### Step B2: Projectile Module

**File:** `src/engine/modules/mechanic/projectile.ts`

Fires objects from a source position toward a target direction.

```typescript
interface ProjectileConfig {
  speed: number;       // px/s
  damage: number;
  lifetime: number;    // ms, auto-destroy
  piercing: boolean;   // pass through or destroy on hit
  asset: string;
}

// Schema:
{
  speed: { type: 'range', default: 600, min: 100, max: 2000 },
  damage: { type: 'range', default: 10, min: 1, max: 100 },
  lifetime: { type: 'range', default: 3000, min: 500, max: 10000, unit: 'ms' },
  fireRate: { type: 'range', default: 200, min: 50, max: 2000, unit: 'ms' },
  fireEvent: { type: 'string', default: 'input:touch:tap' },
  layer: { type: 'string', default: 'projectiles' },
  piercing: { type: 'boolean', default: false },
  asset: { type: 'asset', label: 'Bullet Sprite' },
}

// Events emitted:
// projectile:fire { id, x, y, dx, dy, speed }
// projectile:hit { id, targetId, damage }
// projectile:destroyed { id }

// Events listened:
// ${fireEvent} → create projectile at player position toward aim direction
// aim:update → update fire direction (from Aim module)
```

**Performance:** Object pool pattern — pre-allocate 50 projectile slots, recycle instead of create/destroy.

### Step B3: BulletPattern Module

**File:** `src/engine/modules/mechanic/bullet-pattern.ts`

Configures multi-bullet patterns. Works as a decorator on Projectile.

```typescript
// Schema:
{
  pattern: { type: 'select', options: ['single', 'spread', 'spiral', 'aimed', 'burst', 'random'] },
  bulletCount: { type: 'range', default: 1, min: 1, max: 36 },
  spreadAngle: { type: 'range', default: 30, min: 5, max: 360, unit: '°' },
  spiralSpeed: { type: 'range', default: 90, min: 10, max: 360, unit: '°/s' },
  burstDelay: { type: 'range', default: 50, min: 10, max: 500, unit: 'ms' },
}

// Overrides Projectile's fire behavior:
// Instead of emitting 1 projectile, emits N projectiles with calculated angles
// spread: fan of bulletCount bullets across spreadAngle
// spiral: rotate angle by spiralSpeed each fire
// burst: fire bulletCount with burstDelay between each
// aimed: all bullets aim at nearest enemy
// random: random angles within spreadAngle
```

### Step B4: Aim Module

**File:** `src/engine/modules/mechanic/aim.ts`

Maps input to aim direction for Projectile.

```typescript
// Schema:
{
  mode: { type: 'select', options: ['auto', 'manual', 'face', 'hand'], default: 'auto' },
  autoTargetLayer: { type: 'string', default: 'enemies' },
  autoRange: { type: 'range', default: 500, min: 100, max: 2000 },
  manualEvent: { type: 'string', default: 'input:touch:hold' },
}

// auto: find nearest enemy in Collision objects, emit aim:update {dx, dy}
// manual: touch position relative to player → direction vector
// face: input:face:move → head tilt as aim direction
// hand: input:hand:move → hand position as aim target

// Events emitted:
// aim:update { dx, dy, targetId? }

// Events listened:
// Per mode: collision objects for auto, input events for manual/face/hand
```

### Step B5: Shield Module

**File:** `src/engine/modules/mechanic/shield.ts`

Absorbs hits before HP takes damage.

```typescript
// Schema:
{
  maxCharges: { type: 'range', default: 3, min: 1, max: 10 },
  rechargeCooldown: { type: 'range', default: 5000, min: 1000, max: 30000, unit: 'ms' },
  damageEvent: { type: 'string', default: 'collision:damage' },
  blockEvent: { type: 'string', default: 'shield:block' },
}

// Intercepts damageEvent BEFORE Health/Lives processes it
// If charges > 0: absorb hit, emit shield:block, decrement charges
// If charges === 0: pass through to Health/Lives
// Recharge timer: after cooldown, restore 1 charge

// Events emitted:
// shield:block { chargesRemaining }
// shield:break { } (when charges hit 0)
// shield:recharge { chargesRemaining }
```

**Implementation note:** Shield must register its event listener BEFORE Health/Lives. Use priority-based event handling or a guard event pattern.

### Step B6: EnemyAI Module

**File:** `src/engine/modules/mechanic/enemy-ai.ts`

Finite state machine for enemy behavior.

```typescript
type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead';

interface EnemyInstance {
  id: string;
  x: number;
  y: number;
  state: AIState;
  hp: number;
  maxHp: number;
  waypoints: { x: number; y: number }[];
  waypointIndex: number;
  stateTimer: number;
}

// Schema:
{
  behavior: { type: 'select', options: ['patrol', 'chase', 'stationary', 'random'], default: 'patrol' },
  speed: { type: 'range', default: 100, min: 20, max: 500 },
  detectionRange: { type: 'range', default: 200, min: 50, max: 800 },
  attackRange: { type: 'range', default: 50, min: 20, max: 200 },
  attackCooldown: { type: 'range', default: 1000, min: 200, max: 5000, unit: 'ms' },
  attackDamage: { type: 'range', default: 10, min: 1, max: 100 },
  hp: { type: 'range', default: 50, min: 1, max: 9999 },
  fleeHpThreshold: { type: 'range', default: 0.2, min: 0, max: 1, step: 0.05 },
}

// State transitions:
// idle → patrol (auto after idle timer)
// patrol → chase (player within detectionRange)
// chase → attack (player within attackRange)
// chase → patrol (player out of detectionRange × 1.5)
// attack → chase (player out of attackRange)
// any → flee (hp < maxHp × fleeHpThreshold)
// any → dead (hp <= 0)

// Events emitted:
// enemy:move { id, x, y, state }
// enemy:attack { id, targetId, damage }
// enemy:death { id, x, y }

// Events listened:
// projectile:hit { targetId } → take damage
// collision:damage → take damage (alternative)
// player:move → track player position for chase/attack
```

### Step B7: WaveSpawner Module

**File:** `src/engine/modules/mechanic/wave-spawner.ts`

Progressive wave-based enemy spawning with difficulty scaling.

```typescript
interface WaveConfig {
  enemyCount: number;
  enemyTypes: { type: string; weight: number }[];
  spawnDelay: number;  // ms between spawns within wave
  waveCooldown: number; // ms between waves
}

// Schema:
{
  waves: { type: 'object', label: 'Wave Definitions', default: [] },
  autoProgress: { type: 'boolean', default: true },
  scalingFactor: { type: 'range', default: 1.2, min: 1.0, max: 2.0, step: 0.1 },
  maxWaves: { type: 'range', default: 0, min: 0, max: 100 }, // 0 = infinite
  spawnArea: { type: 'rect', label: 'Spawn Area' },
}

// Each wave: spawn enemyCount enemies over spawnDelay intervals
// Between waves: waveCooldown pause, emit wave:complete
// Scaling: each wave multiplies enemyCount by scalingFactor
// Infinite mode: after defined waves, auto-generate using last wave × scaling

// Events emitted:
// wave:start { wave, enemyCount }
// wave:complete { wave }
// wave:allComplete { totalWaves }
// wave:spawn { enemyId, x, y, type }

// Events listened:
// enemy:death → track remaining enemies, trigger wave:complete when 0
// gameflow:resume → start first wave
```

### New AutoWirer Rules for Shooter

1. **Projectile + Collision** — auto-register projectiles in 'projectiles' layer
2. **EnemyAI + Collision** — auto-register enemies in 'enemies' layer
3. **WaveSpawner + EnemyAI** — wave:spawn creates EnemyAI instances
4. **Shield + Health** — shield intercepts damage before health

### Tests (TDD per module)

Each module: ~5-8 tests covering:
- Constructor + schema validation
- Core mechanic (fire, damage, state transitions)
- Event emission + listening
- Edge cases (empty, overflow, boundary)
- Integration with Collision

**Estimated: ~50 new tests, ~1400 lines of new code (7 modules × ~200 lines)**

---

## Phase C: Action-RPG Modules (6 New Modules)

### Module Dependency Graph

```
LevelUp (XP → level) → SkillTree (unlock abilities)
                            ↓
StatusEffect (buffs/debuffs) ←── EquipmentSlot (stat modifiers)
                            ↓
EnemyDrop (loot on death) ←── enemy:death
                            ↓
DialogueSystem (NPC interaction, branching)
```

### Step C1: LevelUp Module

**File:** `src/engine/modules/mechanic/level-up.ts`

```typescript
// Schema:
{
  xpPerLevel: { type: 'range', default: 100, min: 10, max: 10000 },
  scalingCurve: { type: 'select', options: ['linear', 'quadratic', 'exponential'], default: 'quadratic' },
  maxLevel: { type: 'range', default: 50, min: 1, max: 999 },
  xpSource: { type: 'string', default: 'enemy:death' },
  statGrowth: { type: 'object', default: { hp: 10, attack: 2, defense: 1 } },
}

// XP formulas:
// linear: xpPerLevel * level
// quadratic: xpPerLevel * level^1.5
// exponential: xpPerLevel * 1.5^level

// Events emitted:
// levelup:xp { xp, totalXp, level, xpToNext }
// levelup:levelup { level, stats }

// Events listened:
// ${xpSource} → gain XP (amount from event data or default 10)
```

### Step C2: StatusEffect Module

**File:** `src/engine/modules/mechanic/status-effect.ts`

```typescript
type EffectType = 'buff' | 'debuff';
type StatModifier = { stat: string; multiplier: number } | { stat: string; flat: number };

interface ActiveEffect {
  id: string;
  type: EffectType;
  name: string;
  modifiers: StatModifier[];
  duration: number;     // remaining ms
  maxDuration: number;
  stacks: number;
  maxStacks: number;
  tickInterval?: number; // for DoT/HoT effects
  tickTimer?: number;
  tickValue?: number;
}

// Schema:
{
  definitions: { type: 'object', label: 'Effect Definitions', default: [] },
  maxEffects: { type: 'range', default: 10, min: 1, max: 30 },
  immunities: { type: 'object', default: [] }, // effect names that can't apply
}

// Events emitted:
// status:apply { id, name, type, duration, stacks }
// status:tick { id, name, value } (DoT/HoT)
// status:expire { id, name }
// status:immunity { name } (blocked effect)
// status:stats { modifiers } (aggregated stat modifiers for other modules)

// Events listened:
// status:apply:${name} → apply specific effect
// powerup:activate → convert to buff status
// collision:damage → apply debuff (e.g., poison on hazard contact)
```

### Step C3: EquipmentSlot Module

**File:** `src/engine/modules/mechanic/equipment-slot.ts`

```typescript
type SlotType = 'weapon' | 'armor' | 'accessory' | 'helmet' | 'boots';

interface Equipment {
  id: string;
  name: string;
  slot: SlotType;
  stats: Record<string, number>; // { attack: 5, defense: 3 }
  asset: string;
}

// Schema:
{
  slots: { type: 'object', default: ['weapon', 'armor', 'accessory'] },
  equipment: { type: 'object', label: 'Available Equipment', default: [] },
  equipEvent: { type: 'string', default: 'collectible:pickup' },
}

// Events emitted:
// equipment:equip { slot, item, totalStats }
// equipment:unequip { slot, item }
// equipment:stats { aggregatedStats } (for Health/Projectile to read)

// Events listened:
// ${equipEvent} → auto-equip if matching slot available
// inventory:change → sync with inventory
```

### Step C4: EnemyDrop Module

**File:** `src/engine/modules/mechanic/enemy-drop.ts`

```typescript
interface LootEntry {
  item: string;       // asset or item ID
  weight: number;
  minCount: number;
  maxCount: number;
  type: 'collectible' | 'equipment' | 'xp' | 'health';
}

// Schema:
{
  lootTable: { type: 'object', label: 'Loot Table', default: [] },
  dropChance: { type: 'range', default: 0.8, min: 0, max: 1, step: 0.05 },
  triggerEvent: { type: 'string', default: 'enemy:death' },
  xpAmount: { type: 'range', default: 10, min: 0, max: 1000 },
}

// On enemy:death → roll dropChance → pick from lootTable (weighted) → emit drop events
// XP always awarded on kill (no roll needed)

// Events emitted:
// drop:spawn { x, y, item, count, type }
// levelup:xp { amount } (direct XP award, bypasses drop)

// Events listened:
// ${triggerEvent} → spawn drops at enemy position
```

### Step C5: SkillTree Module

**File:** `src/engine/modules/mechanic/skill-tree.ts`

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  prerequisites: string[];  // skill IDs
  cost: number;             // skill points
  cooldown: number;         // ms
  effect: string;           // event name to emit when activated
  effectData: Record<string, any>;
}

// Schema:
{
  skills: { type: 'object', label: 'Skill Definitions', default: [] },
  pointsPerLevel: { type: 'range', default: 1, min: 1, max: 5 },
  activateEvent: { type: 'string', default: 'input:touch:doubleTap' },
}

// Points awarded on levelup:levelup
// Prerequisites checked before unlock
// Active skills have cooldowns
// Passive skills apply permanent StatusEffects

// Events emitted:
// skill:unlock { id, name }
// skill:activate { id, name, effectData }
// skill:cooldown { id, remaining }

// Events listened:
// levelup:levelup → award skill points
// ${activateEvent} → activate selected skill
```

### Step C6: DialogueSystem Module

**File:** `src/engine/modules/mechanic/dialogue-system.ts`

```typescript
interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: { text: string; next: string; condition?: string }[];
  next?: string;  // auto-advance to next node
  effects?: { event: string; data: any }[];  // side effects
}

// Schema:
{
  dialogues: { type: 'object', label: 'Dialogue Trees', default: {} },
  triggerEvent: { type: 'string', default: 'collision:hit' },
  triggerLayer: { type: 'string', default: 'npcs' },
  autoAdvanceDelay: { type: 'range', default: 0, min: 0, max: 5000, unit: 'ms' },
  advanceEvent: { type: 'string', default: 'input:touch:tap' },
}

// Trigger: collision with NPC → pause gameflow → show dialogue
// Choices: emit choice events, advance to selected node
// Effects: emit configured events (give item, change state, etc.)

// Events emitted:
// dialogue:start { dialogueId, speaker }
// dialogue:node { nodeId, speaker, text, choices }
// dialogue:choice { nodeId, choiceIndex }
// dialogue:end { dialogueId }

// Events listened:
// ${triggerEvent} with layer matching → start dialogue
// ${advanceEvent} → advance to next node
```

### New AutoWirer Rules for RPG

1. **EnemyDrop + EnemyAI** — enemy:death triggers loot spawn
2. **LevelUp + SkillTree** — levelup awards skill points
3. **EquipmentSlot + StatusEffect** — equipment stats as permanent buffs
4. **StatusEffect + Health** — stat modifiers affect max HP

### Tests (TDD per module)

Each module: ~6-10 tests
- LevelUp: XP gain, level curve, stat growth, max level
- StatusEffect: apply, stack, expire, immunity, DoT tick
- EquipmentSlot: equip, unequip, stat aggregation, slot conflict
- EnemyDrop: weighted roll, drop spawn, XP award
- SkillTree: unlock, prerequisites, cooldown, activation
- DialogueSystem: start, advance, choice, effects, end

**Estimated: ~55 new tests, ~1600 lines of new code (6 modules × ~250 lines)**

---

## Registration & Infrastructure

### module-setup.ts Changes

Add 13 new module registrations:
```typescript
// Shooter modules
registry.register('Health', Health);
registry.register('Projectile', Projectile);
registry.register('BulletPattern', BulletPattern);
registry.register('Aim', Aim);
registry.register('Shield', Shield);
registry.register('EnemyAI', EnemyAI);
registry.register('WaveSpawner', WaveSpawner);

// RPG modules
registry.register('LevelUp', LevelUp);
registry.register('StatusEffect', StatusEffect);
registry.register('EquipmentSlot', EquipmentSlot);
registry.register('EnemyDrop', EnemyDrop);
registry.register('SkillTree', SkillTree);
registry.register('DialogueSystem', DialogueSystem);
```

### events.ts New Constants

~30 new event constants for shooter + RPG systems.

### auto-wirer.ts New Rules

~8 new wiring rules (4 shooter + 4 RPG).

### skill-loader.ts Category Update

Add to `findCategory()`:
```typescript
const mechanic = ['Health', 'Projectile', 'BulletPattern', 'Aim', 'Shield',
  'EnemyAI', 'WaveSpawner', 'LevelUp', 'StatusEffect', 'EquipmentSlot',
  'EnemyDrop', 'SkillTree', 'DialogueSystem'];
```

### Knowledge Files (13 new)

```
src/knowledge/modules/mechanic/health.md
src/knowledge/modules/mechanic/projectile.md
src/knowledge/modules/mechanic/bullet-pattern.md
src/knowledge/modules/mechanic/aim.md
src/knowledge/modules/mechanic/shield.md
src/knowledge/modules/mechanic/enemy-ai.md
src/knowledge/modules/mechanic/wave-spawner.md
src/knowledge/modules/mechanic/level-up.md
src/knowledge/modules/mechanic/status-effect.md
src/knowledge/modules/mechanic/equipment-slot.md
src/knowledge/modules/mechanic/enemy-drop.md
src/knowledge/modules/mechanic/skill-tree.md
src/knowledge/modules/mechanic/dialogue-system.md
```

---

## Performance Considerations

### Bullet Hell (100+ projectiles)

**Risk:** O(n²) collision check with 100+ projectiles × 20 enemies = 2000+ pairs per frame.

**Mitigation:**
1. **Object pool** in Projectile — pre-allocate, recycle, no GC pressure
2. **Spatial hash** in Collision — partition into grid cells, only check adjacent cells
3. **Lifetime auto-destroy** — projectiles expire after configurable ms, keeping count bounded
4. **Layer filtering** — projectiles only check vs enemies layer, not all objects

**Implementation:** Add optional `SpatialGrid` utility to Collision module, activated when object count > 50.

### Platform Physics (20+ platforms)

**Risk:** Every frame: iterate all surfaces to find floorY.

**Mitigation:**
1. **Sorted surfaces** — pre-sort by Y, binary search for candidates
2. **X-range filter** — skip surfaces not overlapping player X
3. **Active subset** — only check platforms within camera viewport + margin

### Status Effects (stacking)

**Risk:** N effects × M stat modifiers recalculated every frame.

**Mitigation:**
1. **Dirty flag** — only recalculate aggregated stats when effects change, not every frame
2. **Emit once** — `status:stats` emitted only on change, other modules cache the values

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Event ordering (Shield before Health) | HIGH | Add priority parameter to EventBus.on(), or use guard events |
| Bullet hell performance | MEDIUM | Object pool + spatial hash + lifetime limit |
| Physics tunneling (fast objects pass through platforms) | MEDIUM | CCD (continuous collision) for fast-moving objects, or cap velocity |
| Module interaction complexity (13 new × 47 existing) | MEDIUM | Comprehensive integration tests, AutoWirer handles standard wiring |
| Status effect stat calculation loop | LOW | Dirty flag pattern, cache aggregated stats |
| Dialogue pausing gameflow | LOW | Use gameflow:pause/resume, tested pattern |

---

## Summary

| Phase | Modules | New Tests | New Code | Dependencies |
|-------|---------|-----------|----------|-------------|
| A: Physics Integration | 0 new, 7 modified | ~15 | ~200 lines modified | None (existing modules) |
| B: Shooter | 7 new | ~50 | ~1400 lines | Phase A (Collision, Health) |
| C: Action-RPG | 6 new | ~55 | ~1600 lines | Phase B (Health, EnemyAI) |
| Infrastructure | module-setup, auto-wirer, events, knowledge | — | ~300 lines | All phases |
| **Total** | **13 new, 7 modified** | **~120** | **~3500 lines** | — |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
