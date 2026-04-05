# M1: Tween Module — Completion Plan

## Status: Core Engine DONE, Integration Gaps Remaining

### Already Complete (69 tests, all passing)
- `src/engine/systems/tween/` — types, easings (16), bezier, tween-system (loop/pingPong/delay/timeScale/bezier)
- `src/engine/modules/mechanic/tween.ts` — TweenModule (BaseModule)
- `src/engine/module-setup.ts` — Tween registered
- `src/engine/core/auto-wirer.ts` — Collision+Tween bridge (collision:hit → tween:trigger)
- `src/engine/core/events.ts` — tween:start/complete/update/trigger with payload types
- `src/agent/game-presets.ts` — 6+ presets reference Tween clips

### Dual-Model Analysis (2026-04-05)
- Codex SESSION: 019d5fee-c306-7dc3-a98b-51370f6cd756
- Gemini: policy-constrained read-only analysis

---

## Task Type
- [x] Backend (Codex authority: renderer integration, bridges, APJS)
- [x] Frontend (Gemini authority: knowledge file, EasingSelector UI)

## Technical Approach

### Renderer Integration (CRITICAL)
**Pattern**: Central listener in PixiRenderer → route to sub-renderers (Codex A2)
**Transform semantics**: x/y ADDITIVE (offsets on top of sync positions), scaleX/scaleY/rotation/alpha ABSOLUTE (Gemini insight)
**Performance**: Pending map per sub-renderer, applied during sync() to coalesce per-frame updates

### AutoWirer Bridges
3 new bridges (conditional on Tween presence):
1. `spawner:created` → `tween:trigger { clipId: 'spawn-in', entityId }`
2. `spawner:destroyed` → `tween:trigger { clipId: 'despawn-out', entityId }`
3. `enemy:death` → `tween:trigger { clipId: 'death-fade', entityId }`

---

## Implementation Steps

### Step 1: Renderer Tween Integration (HIGH)
**Files:**
| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/renderer/game-object-renderer.ts` | Modify | Add `applyTweenUpdate(entityId, props)` + pending map + apply in sync() |
| `src/engine/renderer/shooter-renderer.ts` | Modify | Add `applyTweenUpdate(entityId, props)` for projectiles/enemies |
| `src/engine/renderer/pixi-renderer.ts` | Modify | Add `listen('tween:update', ...)` routing to sub-renderers, `listen('tween:complete', ...)` for cleanup |

**Pseudo-code (GameObjectRenderer):**
```typescript
// State
private tweenOffsets = new Map<string, Partial<Record<TweenProperty, number>>>();

// Called by PixiRenderer on tween:update
applyTweenUpdate(entityId: string, properties: Record<string, number>): boolean {
  const sprite = this.sprites.get(entityId) || (entityId === 'player_1' ? this.playerSprite : null);
  if (!sprite) return false;
  this.tweenOffsets.set(entityId, { ...this.tweenOffsets.get(entityId), ...properties });
  return true;
}

clearTweenOffset(entityId: string): void {
  this.tweenOffsets.delete(entityId);
}

// In sync(), after setting base positions:
// Apply tween offsets
for (const [id, offsets] of this.tweenOffsets) {
  const sprite = this.sprites.get(id) || (id === 'player_1' ? this.playerSprite : null);
  if (!sprite) continue;
  if (offsets.x != null) sprite.x += offsets.x;       // ADDITIVE
  if (offsets.y != null) sprite.y += offsets.y;       // ADDITIVE
  if (offsets.scaleX != null) sprite.scale.x = offsets.scaleX;  // ABSOLUTE
  if (offsets.scaleY != null) sprite.scale.y = offsets.scaleY;  // ABSOLUTE
  if (offsets.rotation != null) sprite.rotation = offsets.rotation;
  if (offsets.alpha != null) sprite.alpha = offsets.alpha;
}
```

**Tests:**
| File | Tests |
|------|-------|
| `src/engine/renderer/__tests__/tween-renderer.test.ts` | applyTweenUpdate sets pending, sync applies offsets, clearTweenOffset resets, additive x/y, absolute scale/alpha, unknown entityId returns false |

---

### Step 2: AutoWirer Tween Bridges (HIGH)
**File:** `src/engine/core/auto-wirer.ts`
**Operation:** Add 3 new BRIDGE_RULES entries

```typescript
{
  requires: ['Spawner', 'Tween'],
  setup: (engine, _modules, on) => {
    on('spawner:created', (data?: unknown) => {
      const d = asRecord(data);
      if (d.id != null) {
        engine.eventBus.emit('tween:trigger', { clipId: 'spawn-in', entityId: String(d.id) });
      }
    });
    on('spawner:destroyed', (data?: unknown) => {
      const d = asRecord(data);
      if (d.id != null) {
        engine.eventBus.emit('tween:trigger', { clipId: 'despawn-out', entityId: String(d.id) });
      }
    });
  },
},
{
  requires: ['EnemyAI', 'Tween'],
  setup: (engine, _modules, on) => {
    on('enemy:death', (data?: unknown) => {
      const d = asRecord(data);
      if (d.id != null) {
        engine.eventBus.emit('tween:trigger', { clipId: 'death-fade', entityId: String(d.id) });
      }
    });
  },
},
```

**Tests:**
| File | Tests |
|------|-------|
| `src/engine/modules/__tests__/tween-bridge.test.ts` | Add: spawner:created triggers spawn-in, spawner:destroyed triggers despawn-out, enemy:death triggers death-fade, no trigger without Tween module |

---

### Step 3: Module Export + Agent Integration (MEDIUM)
**Files:**
| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/modules/index.ts` | Modify | Add `export { Tween } from './mechanic/tween'` |
| `src/agent/conversation-defs.ts` | Modify | Add 'Tween' to ALL_MODULES |

**Tests:** Existing registration tests already cover this.

---

### Step 4: Knowledge File (MEDIUM)
**File:** `src/knowledge/modules/mechanic/tween.md` (Create)

Content structure:
- Module overview: animation system with 16 easings, bezier paths, loop/pingPong
- Events: tween:start, tween:complete, tween:update, tween:trigger
- Property targets: x, y, scaleX, scaleY, rotation, alpha
- Clip configuration: JSON schema with examples
- AutoWirer bridges: collision:hit, spawner:created/destroyed, enemy:death
- Common patterns: hit flash, spawn pop-in, death fade, bounce, squash-stretch
- Best practices: short durations (0.1-0.5s for feedback), longer for motion (1-3s)

---

### Step 5: Preset Clip Alignment (MEDIUM)
**File:** `src/agent/game-presets.ts` (Modify)

Normalize existing Tween clips to use bridge-compatible clip IDs where applicable:
- Whack-a-mole: ensure 'spawn-in'/'despawn-out' clips exist alongside 'pop-up'/'pop-down'
- Add 'spawn-in' clips to presets with Spawner+Tween (catch, dodge, shooting, etc.)
- Add 'death-fade' clips to presets with EnemyAI+Tween (shooting, action-rpg)
- Review random-wheel Tween clips (may be redundant with HUD animation)

**Tests:**
| File | Tests |
|------|-------|
| `src/agent/__tests__/preset-tween-clips.test.ts` | Presets with Spawner+Tween have spawn-in clip, presets with EnemyAI+Tween have death-fade clip |

---

### Step 6: APJS Export Translator (LOW — deferred)
**File:** `src/exporters/apjs-translators/tween.ts` (Create)
**Approach:** Script-based (Codex C2) — emit stepper code per clip with easing functions
**Deferred because:** APJS export is not on the critical path for current development

---

### Step 7: EasingSelector UI (LOW — deferred)
**File:** `src/ui/controls/easing-selector.tsx` (Create)
**Approach:** Grid of buttons with SVG curve thumbnails
**Deferred because:** Generic select dropdown works; this is UX polish

---

## Key Files

| File | Operation | Step |
|------|-----------|------|
| `src/engine/renderer/game-object-renderer.ts` | Modify | 1 |
| `src/engine/renderer/shooter-renderer.ts` | Modify | 1 |
| `src/engine/renderer/pixi-renderer.ts` | Modify | 1 |
| `src/engine/core/auto-wirer.ts` | Modify | 2 |
| `src/engine/modules/index.ts` | Modify | 3 |
| `src/agent/conversation-defs.ts` | Modify | 3 |
| `src/knowledge/modules/mechanic/tween.md` | Create | 4 |
| `src/agent/game-presets.ts` | Modify | 5 |
| `src/engine/renderer/__tests__/tween-renderer.test.ts` | Create | 1 |
| `src/engine/modules/__tests__/tween-bridge.test.ts` | Modify | 2 |
| `src/agent/__tests__/preset-tween-clips.test.ts` | Create | 5 |

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tween x/y fighting with sync() positions | Sprites jitter | Additive semantics: tween x/y are offsets, not absolute positions |
| Many concurrent tweens degrade perf | FPS drop on mobile | Pending map coalescing: apply once per frame in sync(), not per event |
| Bridge fires tween:trigger but preset lacks matching clipId | No visual effect (silent fail) | Tween.startClip() silently ignores unknown clipIds — safe. Add preset validation test |
| ShooterRenderer sprite maps use different key patterns | applyTweenUpdate misses | Verify entity ID naming convention: spawner uses `item_{n}`, shooter uses enemy/projectile IDs |

## Dependencies
- Step 1 (Renderer) is independent — can start immediately
- Step 2 (Bridges) is independent — can parallel with Step 1
- Step 3 (Exports) is trivial — do alongside Step 1/2
- Step 4 (Knowledge) is independent
- Step 5 (Presets) depends on Step 2 (needs bridge clip IDs defined first)
- Step 6-7 deferred

## Execution Strategy
```
Parallel:
  Agent A: Step 1 (Renderer Integration) + Step 3 (Exports)
  Agent B: Step 2 (AutoWirer Bridges) + Step 4 (Knowledge File)
Sequential after both:
  Step 5 (Preset Clip Alignment)
```

Estimated test count: ~15 new tests across 3 test files

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d5fee-c306-7dc3-a98b-51370f6cd756
- GEMINI_SESSION: (policy mode, no persistent session)
