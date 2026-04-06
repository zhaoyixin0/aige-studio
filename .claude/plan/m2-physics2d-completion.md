# M2: Physics2D Module — Completion Plan

## Status: Core Engine DONE, Integration Gaps Remaining

### Already Complete (62 tests, all passing)
- `src/engine/modules/mechanic/physics2d.ts` — Physics2D module (BaseModule, 133 lines)
- `src/engine/systems/physics2d/` — Physics2DSystem + PlanckAdapter + types + 5 test files
- planck.js v1.4.2 in package.json
- `src/engine/module-setup.ts` — Physics2D registered (L148)
- `src/engine/core/events.ts` — physics2d:contact-begin/end, physics2d:add/remove-body with payload types
- API: addBody, removeBody, getBodyPosition, getBodyVelocity, setBodyVelocity, applyImpulse, raycast
- Collider shapes: Circle, Box, Edge (with sensor, density, restitution, friction, tag)

### Dual-Model Analysis (2026-04-05)
- Codex SESSION: 019d6014-5dc3-78e2-8273-90e2011f3a4a
- Gemini: policy-constrained read-only analysis

---

## Task Type
- [x] Backend (Codex authority: renderer sync, bridges, debug renderer)
- [x] Frontend (Gemini authority: debug renderer visuals, knowledge file)

## Technical Approach

### Renderer Sync (CRITICAL)
**Pattern**: Direct query per-frame in GameObjectRenderer.syncSpawnedObjects()
**Why not events**: Per-body per-frame events would be too chatty and create GC pressure
**Transform semantics**: Physics2D provides absolute x/y/rotation; Tween x/y offsets are additive on top

### Physics2D + Collision Coexistence
- **Collision**: High-level game logic (hit detection, damage routing, scoring via contracts)
- **Physics2D**: Realistic physics simulation (bouncing, arcs, rigid body dynamics)
- **Together**: Physics2D drives positions → mirrored into Collision via preUpdateHook → Collision remains single source for hit/damage events
- **Rule**: Do NOT emit collision:hit from Physics2D when Collision is present

### PhysicsDebugRenderer
**Pattern**: New sub-renderer class, single PixiJS Graphics, clear+redraw each frame
**Color coding**: Green=static, Red=dynamic, Blue=kinematic (Gemini insight)
**Toggle**: `physics2d:debug:toggle` event
**Body tracking**: Listen for physics2d:add-body/remove-body to cache collider shapes; query positions per-frame

---

## Implementation Steps

### Step 1: Module Export + Agent Integration (TRIVIAL)
**Files:**
| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/modules/index.ts` | Modify | Add `export { Physics2D } from './mechanic/physics2d'` |
| `src/agent/conversation-defs.ts` | Modify | Add `'Physics2D'` to ALL_MODULES |

---

### Step 2: Renderer Physics2D Sync (HIGH)
**File:** `src/engine/renderer/game-object-renderer.ts`
**Operation:** Modify `syncSpawnedObjects()` to override sprite positions from Physics2D when present

**Pseudo-code:**
```typescript
// In syncSpawnedObjects(), after setting wrapper.x = obj.x; wrapper.y = obj.y;
// Query Physics2D for body position override
const physics2d = engine.getModulesByType('Physics2D')[0] as Physics2D | undefined;
if (physics2d) {
  const bodyPos = physics2d.getBodyPosition(obj.id);
  if (bodyPos) {
    wrapper.x = bodyPos.x;
    wrapper.y = bodyPos.y;
  }
}
// Tween offsets applied AFTER in applyTweenOffsets() (additive x/y)
```

**Note**: ShooterRenderer does NOT need Physics2D sync initially — projectile/enemy motion is handled by their own modules. Can be added later if needed.

**Tests:**
| File | Tests |
|------|-------|
| `src/engine/renderer/__tests__/physics2d-renderer.test.ts` | Physics2D position overrides sprite x/y, no override when Physics2D absent, tween offsets still additive after physics |

---

### Step 3: AutoWirer Physics2D Bridges (HIGH)
**File:** `src/engine/core/auto-wirer.ts`
**Operation:** Add 3 new BRIDGE_RULES entries

**Bridge 1: Spawner + Physics2D — auto body management**
```typescript
{
  requires: ['Spawner', 'Physics2D'],
  setup: (engine, modules, on) => {
    const sp = modules.get('Spawner') as any;
    const spriteSize = (sp.getParams().spriteSize ?? 48) as number;
    on('spawner:created', (data?: unknown) => {
      const d = asRecord(data);
      if (d.id != null && d.x != null && d.y != null) {
        engine.eventBus.emit('physics2d:add-body', {
          entityId: String(d.id),
          body: { type: 'dynamic', linearDamping: 0.1, fixedRotation: false },
          colliders: [{ shape: { kind: 'Circle', radius: spriteSize * 0.5 }, restitution: 0.6, friction: 0.2 }],
          x: Number(d.x), y: Number(d.y),
        });
      }
    });
    on('spawner:destroyed', (data?: unknown) => {
      const d = asRecord(data);
      if (d.id != null) {
        engine.eventBus.emit('physics2d:remove-body', { entityId: String(d.id) });
      }
    });
  },
},
```

**Bridge 2: Physics2D + Collision — position mirroring**
```typescript
{
  requires: ['Physics2D', 'Collision'],
  setup: (_engine, modules) => {
    const phys = modules.get('Physics2D') as any;
    const collision = modules.get('Collision') as any;
    // Mirror physics positions into Collision objects before each detection pass
    collision.addPreUpdateHook(() => {
      for (const id of collision.getObjectIds?.() ?? []) {
        const p = phys.getBodyPosition(id);
        if (p) collision.updateObject(id, { x: p.x, y: p.y });
      }
    });
  },
},
```

**Bridge 3: Physics2D + Tween — contact feedback (guarded)**
```typescript
{
  requires: ['Physics2D', 'Tween'],
  setup: (engine, modules, on) => {
    // Only map contacts to tween when Collision is absent (avoid double hit effects)
    if (modules.has('Collision')) return;
    on('physics2d:contact-begin', (data?: unknown) => {
      const d = asRecord(data);
      const entityId = d.entityIdB ?? d.entityIdA;
      if (entityId != null) {
        engine.eventBus.emit('tween:trigger', { clipId: 'hit', entityId: String(entityId) });
      }
    });
  },
},
```

**Tests:**
| File | Tests |
|------|-------|
| `src/engine/modules/__tests__/physics2d-bridge.test.ts` | spawner:created adds physics body, spawner:destroyed removes body, Physics2D+Collision mirrors positions, Physics2D+Tween maps contacts to tween (no Collision), Physics2D+Tween skips when Collision present, no bridge without Physics2D |

---

### Step 4: PhysicsDebugRenderer (MEDIUM)
**File:** `src/engine/renderer/physics-debug-renderer.ts` (Create)

**Pseudo-code:**
```typescript
export class PhysicsDebugRenderer {
  private g = new Graphics();
  private enabled = false;
  private colliderDefs = new Map<string, Collider2DConfig[]>();

  constructor(parent: Container) {
    parent.addChild(this.g);
    this.g.visible = false;
  }

  wire(listen: (event: string, handler: (data?: any) => void) => void): void {
    listen('physics2d:debug:toggle', () => {
      this.enabled = !this.enabled;
      this.g.visible = this.enabled;
    });
    listen('physics2d:add-body', (data?: any) => {
      if (data?.entityId && Array.isArray(data?.colliders)) {
        this.colliderDefs.set(data.entityId, data.colliders);
      }
    });
    listen('physics2d:remove-body', (data?: any) => {
      if (data?.entityId) this.colliderDefs.delete(data.entityId);
    });
  }

  sync(engine: Engine): void {
    if (!this.enabled) return;
    const phys = engine.getModulesByType('Physics2D')[0] as Physics2D | undefined;
    if (!phys) return;
    this.g.clear();
    for (const [id, colliders] of this.colliderDefs) {
      const pos = phys.getBodyPosition(id);
      if (!pos) continue;
      for (const c of colliders) {
        const color = this.getBodyColor(id); // green/red/blue by type
        this.drawCollider(pos.x, pos.y, c, color);
      }
    }
  }

  private drawCollider(x: number, y: number, c: Collider2DConfig, color: number): void {
    const [ox, oy] = c.shape.offset ?? [0, 0];
    switch (c.shape.kind) {
      case 'Circle':
        this.g.circle(x + ox, y + oy, c.shape.radius).stroke({ color, width: 1, alpha: 0.7 });
        break;
      case 'Box':
        this.g.rect(x + ox - c.shape.width / 2, y + oy - c.shape.height / 2, c.shape.width, c.shape.height)
          .stroke({ color, width: 1, alpha: 0.7 });
        break;
      case 'Edge':
        for (let i = 0; i < c.shape.points.length - 1; i++) {
          const [ax, ay] = c.shape.points[i];
          const [bx, by] = c.shape.points[i + 1];
          this.g.moveTo(x + ax, y + ay).lineTo(x + bx, y + by).stroke({ color, width: 1, alpha: 0.7 });
        }
        break;
    }
  }
}
```

**PixiRenderer integration:**
- Construct `PhysicsDebugRenderer` in `init()`
- Call `.wire(listen)` in `connectToEngine()`
- Call `.sync(engine)` in `render()` after game layers

**Tests:**
| File | Tests |
|------|-------|
| `src/engine/renderer/__tests__/physics-debug-renderer.test.ts` | toggle shows/hides, add-body tracks colliders, remove-body clears colliders, sync draws shapes when enabled |

---

### Step 5: Knowledge File (MEDIUM)
**File:** `src/knowledge/modules/mechanic/physics2d.md` (Create)

Content structure:
- Module overview: planck.js 2D rigid body physics with Box/Circle/Edge colliders
- Parameters: gravityX, gravityY, pixelsPerMeter, bodies
- Events: physics2d:contact-begin/end, physics2d:add/remove-body
- API: addBody, removeBody, getBodyPosition, getBodyVelocity, setBodyVelocity, applyImpulse, raycast
- Collider config: shape kinds, sensor, density, restitution, friction, tag
- AutoWirer bridges: Spawner+Physics2D, Physics2D+Collision, Physics2D+Tween
- Collision coexistence: Physics2D drives positions, Collision handles hit/damage routing
- Common patterns: slingshot, bouncing ball, dropping objects
- Best practices: ppm=33.33, fixedTimeStep=1/60, avoid heavy bodies count (>50)

---

### Step 6: Preset Conversions (MEDIUM — Phase 1: 2 types)
**File:** `src/agent/game-presets.ts` (Modify)

Convert 2 physics-centric presets to use Physics2D:

**slingshot:**
- Add `Physics2D: { gravityX: 0, gravityY: 9.81, pixelsPerMeter: 33.33 }`
- Keep Spawner for target objects
- Keep Collision for hit detection/scoring
- Add Tween with 'hit' and 'spawn-in' clips

**bouncing:**
- Add `Physics2D: { gravityX: 0, gravityY: 5.0, pixelsPerMeter: 33.33 }`
- Spawner items → dynamic circle bodies via bridge (restitution ~0.8 for bouncy)
- Keep Collision for scoring

**Tests:**
| File | Tests |
|------|-------|
| `src/agent/__tests__/preset-physics2d.test.ts` | Presets with Physics2D have valid gravity config, slingshot/bouncing include Physics2D |

---

### Step 7: Collision getObjectIds() helper (LOW)
**File:** `src/engine/modules/mechanic/collision.ts` (Modify)
**Operation:** Add `getObjectIds(): string[]` method for Physics2D+Collision bridge to iterate registered objects

```typescript
getObjectIds(): string[] {
  return Array.from(this.objects.keys());
}
```

This is needed by Bridge 2 (Physics2D+Collision position mirroring).

---

## Key Files

| File | Operation | Step |
|------|-----------|------|
| `src/engine/modules/index.ts` | Modify | 1 |
| `src/agent/conversation-defs.ts` | Modify | 1 |
| `src/engine/renderer/game-object-renderer.ts` | Modify | 2 |
| `src/engine/core/auto-wirer.ts` | Modify | 3 |
| `src/engine/renderer/physics-debug-renderer.ts` | Create | 4 |
| `src/engine/renderer/pixi-renderer.ts` | Modify | 4 |
| `src/knowledge/modules/mechanic/physics2d.md` | Create | 5 |
| `src/agent/game-presets.ts` | Modify | 6 |
| `src/engine/modules/mechanic/collision.ts` | Modify | 7 |
| `src/engine/renderer/__tests__/physics2d-renderer.test.ts` | Create | 2 |
| `src/engine/modules/__tests__/physics2d-bridge.test.ts` | Create | 3 |
| `src/engine/renderer/__tests__/physics-debug-renderer.test.ts` | Create | 4 |
| `src/agent/__tests__/preset-physics2d.test.ts` | Create | 6 |

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Double hit events when Physics2D+Collision both present | Scorer counts twice | Physics2D+Tween bridge guarded by `!mods.has('Collision')`, Collision remains single hit source |
| Physics body positions desync from sprites | Visual jitter | Direct per-frame query in sync(), not event-driven |
| Many bodies degrade performance | FPS drop | Recommend <50 bodies; planck.js maxSubSteps=5 prevents spiral of death |
| Debug renderer draws rotated Box incorrectly | Misaligned wireframes | Phase 1: axis-aligned boxes; Phase 2: add rotation support with matrix transforms |
| Spawner creates objects before Physics2D init | Missing bodies | Bridge listens for events; init-time bodies created from config params |

## Dependencies
- Step 1 (Exports) is independent — can start immediately
- Step 2 (Renderer sync) is independent — can parallel with Step 3
- Step 3 (Bridges) depends on Step 7 (Collision.getObjectIds for Bridge 2)
- Step 4 (Debug renderer) is independent
- Step 5 (Knowledge) is independent
- Step 6 (Presets) depends on Steps 2, 3 (needs bridges wired first)

## Execution Strategy
```
Parallel:
  Agent A: Step 1 (Exports) + Step 2 (Renderer sync) + Step 7 (Collision helper)
  Agent B: Step 3 (Bridges) + Step 4 (Debug renderer)
  Agent C: Step 5 (Knowledge file)
Sequential after A+B:
  Step 6 (Preset conversions)
```

Estimated test count: ~20 new tests across 4 test files

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d6014-5dc3-78e2-8273-90e2011f3a4a
- GEMINI_SESSION: (policy mode, no persistent session)
