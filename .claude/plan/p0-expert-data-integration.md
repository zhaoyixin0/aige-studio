# P0 Implementation Plan: Expert Data Integration & Capability Gap Closure

## Context & Evidence

**Data Sources Analyzed:**
- Session 2026-04-03: ~40 Effect House game projects (zip files, Admin machine)
- Session 2026-04-04: 80 JSON files (41 knowledge, 19 command sequences, 16 templates, 7 snapshots)
- Total: 120+ expert games, 38 game types, 30 ECS components, 23 build commands

**Dual-Model Analysis (4 rounds):**
- Round 1 (04-03): Codex + Gemini analysis of zip game data
- Round 2 (04-04): Codex + Gemini analysis of 80 JSON files + delta comparison
- Round 3 (04-04): Codex architecture plan + Gemini frontend plan (module implementation)
- Round 4 (04-04): Codex knowledge architecture + Gemini knowledge UX (knowledge application layer)

**Core Finding (confirmed across all analyses):**
AIGE Studio's gap vs professional games is NOT module count (60+ sufficient) but "Game Feel" — the absence of animation/tween, expanded collision shapes, parallax depth, and expert-calibrated presets.

---

## Task Type
- [x] Frontend (→ Gemini authority)
- [x] Backend (→ Codex authority)
- [x] Fullstack (→ Parallel)

---

## Implementation Order

```
M1: Tween Module        ─── zero deps, unblocks M2/M3/M4
     ↓
M2: Physics2D Expansion ─── depends on Tween for collision→animation bridges
     ↓
M3: ScrollingLayers     ─── optional Tween hooks for speed control
     ↓
M4: Recipe Runner       ─── depends on all above (command targets)
     ↓
M5: Expert Data Ingest  ���── depends on Recipe Runner types
```

**Rationale (Codex order, validated):**
- Tween is the smallest scope with highest ROI — every expert game uses it
- Physics2D is the heaviest but benefits from Tween bridges being ready
- ScrollingLayers reuses TilingSprite + optional Tween speed control
- Recipe Runner orchestrates all modules — must be last

---

## Shared Conventions

- **Timestep**: Fixed 1/60s for physics; renderer delta interpolates visuals; Tween uses real time × timeScale
- **Units**: Physics uses meters internally; `pixelsPerMeter` defaults to 33.33 (≈0.03x, matching expert `2D_Bounded_Area_Bounce_Game.json`)
- **Contracts**: Provide new contracts only; do not change existing CollisionProviderContract etc.
- **File org**: Module classes as flat files in `src/engine/modules/mechanic/` (existing convention); complex multi-file systems in `src/engine/systems/<name>/`
- **Immutability**: All state updates create new objects (project rule)
- **Tests**: TDD — write tests RED first, then implement GREEN

---

## M1: Tween Module

### 1.1 Engine (Backend — Codex authority)

**New Files:**
| File | Purpose |
|------|---------|
| `src/engine/modules/mechanic/tween.ts` | TweenModule class extending BaseModule |
| `src/engine/systems/tween/tween-system.ts` | Runtime: update active tweens each frame |
| `src/engine/systems/tween/easings.ts` | Robert Penner easing functions (12 types) |
| `src/engine/systems/tween/types.ts` | TweenClip, TweenTrack, TweenInstance, EasingName |
| `src/engine/core/events.ts` | Add: tween:start, tween:stop, tween:complete, tween:update |
| `src/knowledge/modules/mechanic/tween.md` | LLM knowledge for ConversationAgent |

**Modify:**
| File | Change |
|------|--------|
| `src/engine/core/module-setup.ts` | Register TweenModule in createModuleRegistry() |
| `src/engine/core/auto-wirer.ts` | Add Bridge: collision:hit + tag match → tween:start; tween:complete → recipe:execute |
| `src/engine/core/contracts.ts` | Add TweenProviderContract interface |

**Data Model (types.ts):**
```typescript
type EasingName = "Linear"|"QuadIn"|"QuadOut"|"QuadInOut"|
  "CubicIn"|"CubicOut"|"CubicInOut"|"ExpoIn"|"ExpoOut"|"ExpoInOut"|
  "SineIn"|"SineOut"|"SineInOut"|"BounceIn"|"BounceOut"|"BounceInOut";

interface TweenTrack {
  targetPath: "x"|"y"|"scaleX"|"scaleY"|"rotation"|"alpha";
  easing: EasingName;
  from: number;
  to: number;
  keys?: Array<{ t: number; value: number }>; // stepped keyframes
  bezierPath?: { points: [number,number][]; closed?: boolean; orientToTangent?: boolean };
}

interface TweenClip {
  id: string;
  duration: number;         // seconds
  loop?: number | "infinite";
  pingPong?: boolean;
  delay?: number;
  timeScale?: number;       // default 1
  tracks: readonly TweenTrack[];
  onComplete?: { eventName?: string };
  startOnCollision?: { withTag?: string };
}

interface TweenComponent { clips: readonly TweenClip[]; active: boolean }
```

**Module Schema:**
```typescript
getSchema(): ModuleSchema {
  return {
    id: 'Tween',
    name: 'Tween Animation',
    category: 'feedback',
    fields: [
      { key: 'clips', type: 'object', label: 'Animation Clips', fields: [
        { key: 'duration', type: 'range', min: 0.1, max: 10, step: 0.1, default: 1 },
        { key: 'easing', type: 'select', options: EASING_NAMES, default: 'SineInOut' },
        { key: 'loop', type: 'select', options: ['once','infinite','2','3','5'], default: 'once' },
        { key: 'pingPong', type: 'boolean', default: false },
        { key: 'targetPath', type: 'select', options: TARGET_PATHS, default: 'y' },
        { key: 'from', type: 'number', default: 0 },
        { key: 'to', type: 'number', default: 100 },
      ]},
    ],
  };
}
```

**Contracts:**
```typescript
getContracts(): ModuleContracts {
  return {
    emits: ['tween:start', 'tween:complete', 'tween:update'],
    consumes: ['collision:*', 'gameflow:pause', 'gameflow:resume'],
    capabilities: ['tween-provider'],
  };
}
```

**Core Algorithm (pseudo-code):**
```
update(dt):
  for each TweenInstance inst:
    if inst.state != "playing": continue
    inst.t += dt * inst.clip.timeScale * inst.dir
    handleLoopPingPong(inst)
    u = clamp01(inst.t / inst.clip.duration)
    for track in inst.clip.tracks:
      if track.bezierPath:
        pos = sampleCubicBezier(track.bezierPath, u)
        applyPosition(entity, pos)
      else:
        v = lerp(track.from, track.to, ease(track.easing, u))
        setProperty(entity, track.targetPath, v)
    emit("tween:update", { entityId, u })
    if completed: emit("tween:complete", { entityId, clipId })
```

### 1.2 Frontend (Gemini authority)

**New Components:**
| Component | File | Purpose |
|-----------|------|---------|
| EasingSelector | `src/ui/controls/easing-selector.tsx` | Dropdown with mini SVG curve preview per easing |

**Renderer Changes:**
- NO new Pixi renderer needed — TweenSystem mutates sprite transform properties BEFORE existing renderers run
- Existing GameObjectRenderer/ShooterRenderer will render the tweened positions naturally

**Schema Extensions:**
- Add `EasingType` enum to SchemaRenderer select options
- Add `TweenTargetProperty` enum (position, scale, rotation, alpha)

**Store Changes:**
- `game-store.ts`: No change needed — tween state lives in engine runtime, not Zustand

### 1.3 Tests
| Test File | Scope |
|-----------|-------|
| `src/engine/systems/tween/__tests__/easings.test.ts` | Truth tables: ease(name, 0)=0, ease(name, 1)=1, monotonic for In/Out |
| `src/engine/systems/tween/__tests__/tween-system.test.ts` | Loop, pingPong, delay, timeScale, onComplete event |
| `src/engine/systems/tween/__tests__/bezier.test.ts` | Path sampling, orientToTangent |
| `src/engine/modules/__tests__/tween-bridge.test.ts` | CollisionEnter → starts tween by tag |

### 1.4 APJS Export
- `src/engine/exporters/apjs-translators/tween.ts`
- Map TweenClip → APJS Timeline/Animation nodes
- Easing name translation table
- Bezier path → sampled keyframes at 30Hz if APJS lacks native Bezier

---

## M2: Physics2D Expansion

### 2.1 Engine (Codex authority)

**New Files:**
| File | Purpose |
|------|---------|
| `src/engine/modules/mechanic/physics2d.ts` | Physics2DModule extending BaseModule |
| `src/engine/systems/physics2d/physics2d-system.ts` | Fixed-step physics loop with accumulator |
| `src/engine/systems/physics2d/adapters/i-physics2d-adapter.ts` | Interface: createWorld, createBody, step, raycast |
| `src/engine/systems/physics2d/adapters/planck-adapter.ts` | planck.js implementation |
| `src/engine/systems/physics2d/types.ts` | RigidBody2D, ColliderShape2D, RaycastHit |
| `src/engine/core/events.ts` | Add: physics2d:contact-begin, physics2d:contact-end |
| `src/knowledge/modules/mechanic/physics2d.md` | LLM knowledge |

**Modify:**
| File | Change |
|------|--------|
| `src/engine/core/module-setup.ts` | Register Physics2DModule |
| `src/engine/core/auto-wirer.ts` | Bridge: physics contact → existing CollisionProvider; RigidBody(player) → PlayerPosition |
| `src/engine/core/contracts.ts` | Add Physics2DProviderContract, RaycastQueryContract |
| `package.json` | Add dependency: `planck` |

**Data Model:**
```typescript
type BodyType2D = "static" | "dynamic" | "kinematic";

interface RigidBody2DComponent {
  type: BodyType2D;
  linearDamping?: number;
  angularDamping?: number;
  fixedRotation?: boolean;
  gravityScale?: number;     // default 1
  bounciness?: number;       // restitution
  friction?: number;
  mass?: number;
}

type ColliderShape2D =
  | { kind: "Circle"; radius: number; offset?: [number,number] }
  | { kind: "Box"; width: number; height: number; offset?: [number,number] }
  | { kind: "Edge"; points: [number,number][] };

interface Collider2DComponent {
  shape: ColliderShape2D;
  isSensor?: boolean;
  density?: number;
  restitution?: number;
  friction?: number;
  layerMask?: number;
  tag?: string;
}

interface RaycastHit {
  point: [number,number];
  normal: [number,number];
  distance: number;
  entityId: string;
  colliderTag?: string;
}
```

**Key Design Decisions:**
- Keep current circle collision module INTACT — Physics2D is additive
- Entities with Physics2D colliders use planck contact events; legacy entities use circle brute-force
- If entity has both RigidBody2D and Gravity module, disable Gravity force (physics world owns gravity)
- Adapter interface allows future Matter.js swap without changing module code
- Fixed step accumulator with max 5 sub-steps to avoid spiral of death

### 2.2 Frontend (Gemini authority)

**New Components:**
| Component | File | Purpose |
|-----------|------|---------|
| PhysicsDebugToggle | `src/ui/preview/physics-debug-toggle.tsx` | Button in preview toolbar to show/hide collider wireframes |
| ColliderShapeSelector | `src/ui/controls/collider-shape-selector.tsx` | Dropdown: Circle/Box/Edge with shape-specific fields |

**Renderer Changes:**
| Renderer | File | Purpose |
|----------|------|---------|
| PhysicsDebugRenderer | `src/engine/renderer/physics-debug-renderer.ts` | PixiJS Graphics: green wireframes for colliders, red dots for pivots |

**Store Changes:**
- `editor-store.ts`: Add `showPhysicsDebug: boolean`

**Schema Extensions:**
- Add `ColliderShape` enum to SchemaRenderer
- Shape-specific conditional fields (radius for Circle, width/height for Box, points array for Edge)

### 2.3 Tests
| Test File | Scope |
|-----------|-------|
| `src/engine/systems/physics2d/__tests__/planck-adapter.test.ts` | Create world, bodies, colliders, step, raycast |
| `src/engine/systems/physics2d/__tests__/contact-bridge.test.ts` | Contact → CollisionProvider + Damage routing |
| `src/engine/systems/physics2d/__tests__/scale.test.ts` | Pixel↔meter conversion (0.03x cases) |
| `src/engine/systems/physics2d/__tests__/edge-collider.test.ts` | MazeChase-style edge wall containment |
| `src/engine/systems/physics2d/__tests__/box-bounce.test.ts` | Bounded area bounce with restitution |

### 2.4 APJS Export
- `src/engine/exporters/apjs-translators/physics2d.ts`
- Box/Circle/Edge → Effect House Collider2D components
- RigidBody attributes mapping
- Auto 1.5x scale (720×1280 → 1080×1920)

---

## M3: ScrollingLayers (Parallax)

### 3.1 Engine (Codex authority)

**New Files:**
| File | Purpose |
|------|---------|
| `src/engine/modules/mechanic/scrolling-layers.ts` | ScrollingLayersModule extending BaseModule |
| `src/engine/systems/scrolling-layers/scrolling-layers-system.ts` | Dual-group infinite tiling loop |
| `src/engine/systems/scrolling-layers/types.ts` | ParallaxLayerConfig, ScrollingLayersComponent |
| `src/knowledge/modules/mechanic/scrolling-layers.md` | LLM knowledge |

**Modify:**
| File | Change |
|------|--------|
| `src/engine/core/module-setup.ts` | Register ScrollingLayersModule |
| `src/engine/core/contracts.ts` | Add ParallaxControllerContract |

**Data Model:**
```typescript
type ScrollAxis = "horizontal" | "vertical" | "both";

interface ParallaxLayerConfig {
  textureId: string;
  ratio: number;        // 0..1 (foreground=1, background<1)
  spacing?: number;     // pixels between tiles
}

interface ScrollingLayersComponent {
  axis: ScrollAxis;
  baseSpeed: number;    // pixels/sec
  layers: readonly ParallaxLayerConfig[];
  loop: boolean;        // default true
  direction: 1 | -1;   // +1 right/down, -1 left/up
}
```

**Core Algorithm (dual-group loop):**
```
init():
  for each layer:
    groupA = new PIXI.TilingSprite(texture, viewWidth, viewHeight)
    groupB = clone of groupA, offset by totalSpan
    
update(dt):
  for each layer:
    delta = direction * baseSpeed * layer.ratio * dt
    groupA.tilePosition.x += delta (or .y for vertical)
    groupB.tilePosition.x += delta
    if groupA fully offscreen: reposition by +2*totalSpan, swap refs
```

### 3.2 Frontend (Gemini authority)

**New Components:**
| Component | File | Purpose |
|-----------|------|---------|
| ParallaxLayerControl | `src/ui/controls/parallax-layer-control.tsx` | Reorderable layer list with texture thumbnail + speed slider |

**Renderer Changes:**
| Renderer | File | Purpose |
|----------|------|---------|
| ParallaxRenderer | `src/engine/renderer/parallax-renderer.ts` | PixiJS TilingSprite layers, inserted BEFORE cameraLayer in stage |

**Key UX:** Editor shows parallax scrolling via internal `editorTime` ticker even when game is not playing — instant feedback on speed/ratio tuning.

### 3.3 Tests
| Test File | Scope |
|-----------|-------|
| `src/engine/systems/scrolling-layers/__tests__/loop.test.ts` | Repositioning at span edges |
| `src/engine/systems/scrolling-layers/__tests__/ratios.test.ts` | Multi-layer depth ratio correctness |
| `src/engine/systems/scrolling-layers/__tests__/template-ingest.test.ts` | backgroundGroups_template.json → component parity |

### 3.4 APJS Export
- `src/engine/exporters/apjs-translators/scrolling-layers.ts`
- Two groups per layer with UV/tiling or node translation loop scripts

---

## M4: Recipe Runner

### 4.1 Engine (Codex authority)

**New Files:**
| File | Purpose |
|------|---------|
| `src/engine/modules/mechanic/recipe-runner.ts` | RecipeRunnerModule (editor-side, not runtime) |
| `src/engine/systems/recipe-runner/recipe-executor.ts` | Command interpreter with param substitution + rollback |
| `src/engine/systems/recipe-runner/preset-registry.ts` | Loads preset index, exposes query API |
| `src/engine/systems/recipe-runner/types.ts` | PresetTemplate, CommandSequence, ParamSpec, CommandName |
| `src/engine/systems/recipe-runner/validators.ts` | Per-command argument validation |

**Data Model:**
```typescript
type ParamType = "number"|"string"|"boolean"|"enum"|"vec2"|"color"|"assetId";

interface ParamSpec {
  name: string;
  type: ParamType;
  required?: boolean;
  default?: unknown;
  enumValues?: readonly string[];
  min?: number; max?: number;
  description?: string;
}

type CommandName =
  | "AddSceneObject" | "SetComponentProperty" | "AddCollider2D"
  | "AddRigidBody2D" | "AddTweenClip" | "StartTween"
  | "CreateScrollingLayers" | "Raycast" | "SetTag"
  | "SetParameter" | "AddChild" | "RemoveObject"
  | "DuplicateObject" | "CreatePrefab";

interface Command {
  name: CommandName;
  args: Record<string, unknown>;
  comment?: string;
  when?: string;  // conditional expression
}

interface CommandSequence {
  id: string;
  commands: readonly Command[];
}

interface PresetTemplate {
  id: string;
  title: string;
  description?: string;
  tags: readonly string[];
  params: readonly ParamSpec[];
  sequence: CommandSequence;
  requiredModules?: readonly string[];
}
```

**Core Algorithm (interpreter with rollback):**
```
execute(sequence, paramValues):
  ctx = { created: [], variables: { ...paramValues } }
  for cmd of sequence.commands:
    if cmd.when && !evalExpr(cmd.when, ctx.variables): continue
    validated = validators[cmd.name](cmd.args, ctx.variables)
    try:
      handlers[cmd.name](validated, ctx)
    catch e:
      rollback(ctx.created)  // destroy in reverse order
      throw e
  return ctx
```

### 4.2 Frontend (Gemini authority)

**New Components:**
| Component | File | Purpose |
|-----------|------|---------|
| SmartAssetsPanel | `src/ui/editor/smart-assets-panel.tsx` | Sidebar tab: draggable template cards |
| RecipeBrowserModal | `src/ui/landing/recipe-browser-modal.tsx` | Masonry grid filtered by game type/tags |
| GameWizardModal | `src/ui/chat/game-wizard-modal.tsx` | Step-by-step parameter form from ParamSpec |

**Store Changes:**
- `editor-store.ts`: Add `activeRecipe: PresetTemplate | null`, `wizardStepIndex: number`
- `game-store.ts`: Add `applyRecipePayload(entities)` batch action

**Interaction Flows:**
1. **Wizard Flow**: Select game type → RecipeBrowserModal → choose template → GameWizardModal fills ParamSpec → execute → canvas renders
2. **Smart Assets Flow**: Open panel → drag "Health Bar" card onto canvas → onDrop resolves coordinates → inject template

### 4.3 Tests
| Test File | Scope |
|-----------|-------|
| `src/engine/systems/recipe-runner/__tests__/validation.test.ts` | ParamSpec required/defaults/enums |
| `src/engine/systems/recipe-runner/__tests__/commands.test.ts` | All commands happy path + rollback |
| `src/engine/systems/recipe-runner/__tests__/triggers.test.ts` | collision→StartTween; tweenComplete→sequence chain |

---

## M5: Expert Data Ingestion

### 5.1 Ingestion Script

**New File:** `tools/ingest-expert-data.ts`

**Pipeline:**
1. Read `expert-data/json/**/*.json` (80 files)
2. Classify by format (knowledge / command-sequence / template / snapshot)
3. Normalize command sequences to Recipe Runner `CommandSequence` format
4. Map Effect House commands → AIGE `CommandName`:
   - `AddSceneObjectByConfig` → `AddSceneObject`
   - `SetComponentProperty` → `SetComponentProperty`
   - `AddCollider2DComponent` → `AddCollider2D`
   - `AddRigidbody2DComponent` → `AddRigidBody2D`
   - `DuplicateSceneObject` → `DuplicateObject`
   - `CreatePrefabBySceneObject` → `CreatePrefab`
   - `GenerateAndImport2DAssetByAI` → (skip, P2)
5. Extract ParamSpec from `decompose_inputs`
6. Apply coordinate scale factor 1.5x (720×1280 → 1080×1920)
7. Write normalized files:
   - `src/presets/templates/*.json` (PresetTemplate)
   - `src/presets/sequences/*.json` (CommandSequence)
   - `src/presets/index.json` (registry with tags)
8. Generate/update knowledge markdown cross-links

### 5.2 Knowledge Base Updates

**New Knowledge Files:**
| File | Content |
|------|---------|
| `src/knowledge/modules/mechanic/tween.md` | Easing curves → Game Feel mapping |
| `src/knowledge/modules/mechanic/physics2d.md` | RigidBody params, collider types, pixel→meter scale |
| `src/knowledge/modules/mechanic/scrolling-layers.md` | Layer depth ratios, dual-group pattern |
| `src/knowledge/recipes.md` | Master index of expert templates for ConversationAgent |
| `src/knowledge/relations/module-wiring.md` | Update: add Tween↔Collision, Physics2D↔Gravity bridges |

### 5.3 Tests
| Test File | Scope |
|-----------|-------|
| `tools/__tests__/ingest-expert-data.test.ts` | 10 representative JSONs → expected normalized structures |

---

## Key Files Summary

### Create (~35 files)
```
src/engine/modules/mechanic/tween.ts
src/engine/modules/mechanic/physics2d.ts
src/engine/modules/mechanic/scrolling-layers.ts
src/engine/modules/mechanic/recipe-runner.ts
src/engine/systems/tween/tween-system.ts
src/engine/systems/tween/easings.ts
src/engine/systems/tween/types.ts
src/engine/systems/physics2d/physics2d-system.ts
src/engine/systems/physics2d/types.ts
src/engine/systems/physics2d/adapters/i-physics2d-adapter.ts
src/engine/systems/physics2d/adapters/planck-adapter.ts
src/engine/systems/scrolling-layers/scrolling-layers-system.ts
src/engine/systems/scrolling-layers/types.ts
src/engine/systems/recipe-runner/recipe-executor.ts
src/engine/systems/recipe-runner/preset-registry.ts
src/engine/systems/recipe-runner/types.ts
src/engine/systems/recipe-runner/validators.ts
src/engine/renderer/physics-debug-renderer.ts
src/engine/renderer/parallax-renderer.ts
src/engine/exporters/apjs-translators/tween.ts
src/engine/exporters/apjs-translators/physics2d.ts
src/engine/exporters/apjs-translators/scrolling-layers.ts
src/ui/controls/easing-selector.tsx
src/ui/controls/collider-shape-selector.tsx
src/ui/controls/parallax-layer-control.tsx
src/ui/preview/physics-debug-toggle.tsx
src/ui/editor/smart-assets-panel.tsx
src/ui/landing/recipe-browser-modal.tsx
src/ui/chat/game-wizard-modal.tsx
src/knowledge/modules/mechanic/tween.md
src/knowledge/modules/mechanic/physics2d.md
src/knowledge/modules/mechanic/scrolling-layers.md
src/knowledge/recipes.md
src/presets/ (directory + index.json)
tools/ingest-expert-data.ts
```

### Modify (~8 files)
```
src/engine/core/module-setup.ts    — register 4 new modules
src/engine/core/auto-wirer.ts      — add bridges (collision→tween, physics→collision, tween→recipe)
src/engine/core/contracts.ts       — add TweenProvider, Physics2DProvider, RaycastQuery, ParallaxController
src/engine/core/events.ts          — add tween:*, physics2d:* events
src/engine/renderer/pixi-renderer.ts — insert ParallaxRenderer before cameraLayer
src/store/editor-store.ts          — add showPhysicsDebug, activeRecipe, wizardStepIndex
src/knowledge/relations/module-wiring.md — update bridge documentation
package.json                       — add planck dependency
```

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| planck.js bundle size (~80KB gzip) | Larger initial load | Tree-shake; lazy-load Physics2DModule only when enabled |
| Fixed physics step spiral of death | Game freezes on slow devices | Cap max 5 sub-steps per frame; warn in diagnostics |
| Tween competing with Gravity for position control | Entity jumps between two systems | If RigidBody2D exists on entity, Tween targets velocity not position directly |
| Recipe Runner rollback complexity | Partial state on failure | Track created entity IDs; destroy in reverse order; atomic batch in game-store |
| Expert data scale factor drift | Misaligned layouts | Validate 1.5x scale in ingestion tests; add bounds checking |
| APJS export parity for new modules | Effect House incompatibility | Start with Web HTML export; APJS translators can lag one milestone |

---

## Milestones & Estimates

| Milestone | Deliverables | Test Count (est.) |
|-----------|-------------|-------------------|
| **M1 Tween** | Module + System + Easings + Schema + Knowledge + APJS translator | ~30 tests |
| **M2 Physics2D** | Module + Planck adapter + Colliders + Raycast + Debug renderer + Bridge | ~40 tests |
| **M3 ScrollingLayers** | Module + TilingSprite renderer + Layer controls + Template ingest | ~20 tests |
| **M4 Recipe Runner** | Executor + Validators + PresetRegistry + Wizard UI + Smart Assets | ~30 tests |
| **M5 Expert Ingest** | Ingestion script + 80 JSON normalized + Knowledge cross-links | ~15 tests |
| **Total** | 4 modules, 3 renderers, 6 UI components, ~35 new files | **~135 tests** |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d5a38-e15c-7bc0-a3d8-1665268c518f
- GEMINI_SESSION: (policy mode, no persistent session)
