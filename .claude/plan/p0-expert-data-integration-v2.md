# P0 Implementation Plan v2: Expert Knowledge Application + Capability Gap Closure

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
AIGE Studio's gap vs professional games is NOT module count (60+ sufficient) but "Game Feel" -- the absence of expert-calibrated defaults, animation/tween, expanded collision shapes, parallax depth, and domain abstractions.

---

## Task Type
- [x] Frontend (Gemini authority)
- [x] Backend (Codex authority)
- [x] Fullstack (Parallel)

---

## Implementation Order

```
M0: Knowledge Application --- NO new modules, zero code risk, highest immediate ROI
     |                        Calibrates existing 60 modules, expands 15->38 game types,
     |                        enhances ConversationAgent, builds quality benchmark
     v
M1: Tween Module          --- zero deps, unblocks M2/M3/M4
     v
M2: Physics2D Expansion   --- depends on Tween for collision->animation bridges
     v
M3: ScrollingLayers       --- optional Tween hooks for speed control
     v
M4: Recipe Runner         --- depends on all above (command targets)
     v
M5: Expert Data Ingest    --- depends on Recipe Runner types + M0 data pipeline
```

**Rationale:**
- **M0 first** -- highest ROI with zero code risk. Uses existing 60 modules + existing UI. Outputs: recalibrated presets, expanded game types, enhanced LLM knowledge, quality benchmarks.
- M1-M5 unchanged from v1 plan (see below).

---

## Shared Conventions

- **Timestep**: Fixed 1/60s for physics; renderer delta interpolates visuals; Tween uses real time x timeScale
- **Units**: Physics uses meters internally; `pixelsPerMeter` defaults to 33.33 (approx 0.03x, matching expert `2D_Bounded_Area_Bounce_Game.json`)
- **Scale**: Effect House 720x1280 -> AIGE Studio 1080x1920 = 1.5x factor
- **Contracts**: Provide new contracts only; do not change existing CollisionProviderContract etc.
- **File org**: Module classes as flat files in `src/engine/modules/mechanic/` (existing convention); complex multi-file systems in `src/engine/systems/<name>/`
- **Immutability**: All state updates create new objects (project rule)
- **Tests**: TDD -- write tests RED first, then implement GREEN

---

# M0: Knowledge Application Layer (NEW)

> No new engine modules. No new renderers. Only data extraction, calibration, and knowledge enhancement using existing infrastructure.

## 0.1 Expert Parameter Calibration (Codex authority)

### Data Pipeline

```
expert-data/json/ (80 raw JSONs)
     |
     v  [Extract & Normalize]
data/experts/normalized/*.json (canonical units, moduleId mapping)
     |
     v  [Aggregate & Calibrate]
data/experts/derived/calibrations/*.json (L2/L3 stats per param)
     |
     v  [Publish]
src/knowledge/overlays/*.json (runtime-consumable overlays)
```

### Extraction Script

**New File:** `tools/extract-expert-params.ts`

Pipeline:
1. Read 80 JSONs, classify by format
2. Map Effect House component names -> AIGE module IDs (alias table: `data/experts/derived/module-aliases.json`)
3. Extract parameter values with context (gameTypeId, componentId, paramPath)
4. Normalize units (pixels, seconds, degrees); apply 1.5x scale where applicable
5. Output: `data/experts/normalized/*.json`

### Calibration Algorithm

For each parameter `p` in module `m`:
1. Collect values `V` from all normalized files with matching `moduleId`
2. Compute: median, MAD, P10/P90, sample count `n`
3. Empirical-Bayes shrinkage vs current default:
   - `suggested = (w0 * currentDefault + we * expertMedian) / (w0 + we)`
   - `w0 = 5` (prior weight), `we = min(n, 20)` (expert weight, capped)
   - `confidence = sigmoid(n/5) * qualityFactor`
4. Persist at L2 (cross-type) if low dispersion; else at L3 (per-type)

### Overlay Data Model

**File:** `src/knowledge/overlays/module-defaults.overlay.json`
```json
[
  {
    "moduleId": "Spawner",
    "param": "spawnRate",
    "suggested": 1.5,
    "rangeP10P90": [1.0, 2.2],
    "source": "experts:Water_Blaster,Runner_SetA",
    "stat": "median",
    "n": 16,
    "confidence": 0.78
  }
]
```

**File:** `src/knowledge/overlays/presets.overlay.json`
```json
[
  {
    "presetId": "shooting",
    "overrides": [
      { "moduleId": "Aim", "param": "sensitivity", "value": 1.2, "source": "experts:Water_Blaster", "confidence": 0.81 },
      { "moduleId": "Spawner", "param": "spawnInterval", "value": 1.5, "source": "experts:shooting_set", "confidence": 0.73 }
    ]
  }
]
```

### Apply to Existing Presets

**Modify:** `src/agent/game-presets.ts`
- Load `presets.overlay.json` at startup
- Merge expert overrides into existing 15 preset defaults (overlay wins when confidence >= 0.6)
- No schema changes needed -- just better default values

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `tools/extract-expert-params.ts` | Create | Extraction + normalization script |
| `data/experts/normalized/` | Create | Normalized expert data |
| `data/experts/derived/calibrations/` | Create | L2/L3 statistical aggregates |
| `data/experts/derived/module-aliases.json` | Create | Effect House -> AIGE module name map |
| `src/knowledge/overlays/module-defaults.overlay.json` | Create | Module-level param suggestions |
| `src/knowledge/overlays/presets.overlay.json` | Create | Per-preset expert calibration deltas |
| `src/knowledge/overlays/new-presets.proposed.json` | Create | 23 new game type presets (alpha) |
| `src/agent/game-presets.ts` | Modify | Load and merge overlay at startup |

### Tests
| Test | Scope |
|------|-------|
| `tools/__tests__/extract-expert-params.test.ts` | 10 representative JSONs -> expected normalized output |
| `tools/__tests__/calibration.test.ts` | Shrinkage algorithm correctness, confidence bounds |
| `src/agent/__tests__/preset-overlay.test.ts` | Overlay merge produces valid GameConfig |

---

## 0.2 Game Type Taxonomy Expansion (Codex + Gemini)

### Backend: Taxonomy Registry (Codex)

**New File:** `src/knowledge/taxonomy/game-types.v2.json`

Expand from 15 -> 38 game types with grouping:

| Group | Types | Count |
|-------|-------|-------|
| **Physics & Action** | Slingshot, Pendulum, BoundedBounce, RopeCutting, CrossStreet | 5 |
| **Endless Motion** | Runner (existing), SideScroller, CarRacing, SwimmerScroller | 4 |
| **Aim & Shoot** | Shooting (existing), WaterBlaster, LaserTrajectory, TargetPractice | 4 |
| **Spin & Chance** | RandomWheel (existing), CarouselSelector, SpinningWheelMatch, BlinkRandom | 4 |
| **Puzzle & Match** | Puzzle (existing), SlidingPuzzle, CardMatching, OddOneOut, LightUpStars, AssembleMe | 6 |
| **Social & Avatar** | Expression (existing), DressUp (existing), HeadTiltChoice, MakeupMatch, FriendFlipGuess | 5 |
| **Tap & Timing** | Tap (existing), Rhythm (existing), MoleWhack, SugarInserting, StepOnCans | 5 |
| **Classic Arcade** | Catch (existing), Dodge (existing), MazeChase, FruitCut, BrushMaze | 5 |

Per-type record:
```json
{
  "gameTypeId": "slingshot",
  "group": "Physics & Action",
  "displayName": "Slingshot Launch",
  "description": "Pull back and release to launch projectiles at targets",
  "variantOf": null,
  "requiredModules": ["Physics2D", "Collision", "Tween", "Scorer"],
  "supportedToday": false,
  "missingModules": ["Physics2D", "Tween"],
  "topModules": ["Physics2D", "Collision", "Tween", "Scorer", "Spawner"],
  "evidence": { "nGames": 3, "nTemplates": 1 },
  "expertSources": ["birdf.json", "2D_AngryBirds_Slingshot_Game.json"]
}
```

**Feasibility matrix:**
- **Supported TODAY (existing modules)**: ~20 types (existing 15 + MoleWhack, CardMatching, OddOneOut, CarouselSelector, FriendFlipGuess)
- **Need P0 Tween only**: SpinningWheelMatch, BlinkRandom, LightUpStars, SugarInserting, StepOnCans (~5 types)
- **Need P0 Physics2D**: Slingshot, Pendulum, BoundedBounce, RopeCutting, CrossStreet, MazeChase, BrushMaze (~7 types)
- **Need P0 ScrollingLayers**: SideScroller, CarRacing, SwimmerScroller (~3 types)

### Frontend: GameTypeHub (Gemini)

**Modify:** `src/ui/chat/game-type-selector.tsx`

Design changes:
- Group 38 types into 8 Macro-Categories (tabs/sections)
- Progressive disclosure: show "Top 8 Popular" by default, expand per category
- Fuzzy search bar at top (type "slingshot" or "angry birds style")
- Visual thumbnail cards replacing flat buttons
- Badge: "Supported" (green) / "Coming Soon" (gray) based on `supportedToday`
- Types marked `supportedToday: false` show which modules are missing

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/knowledge/taxonomy/game-types.v2.json` | Create | 38 game types with grouping + feasibility |
| `src/ui/chat/game-type-selector.tsx` | Modify | Category grouping + search + progressive disclosure |
| `src/agent/game-presets.ts` | Modify | Add 23 new preset entries (from `new-presets.proposed.json`) |
| `src/agent/conversation-defs.ts` | Modify | Update ALL_GAME_TYPES from 15 -> 38 |

---

## 0.3 ConversationAgent Knowledge Enhancement (Codex + Gemini)

### Backend: Knowledge Cards (Codex)

New machine-readable knowledge alongside existing markdown:

**Directory:** `src/knowledge/cards/`

```
src/knowledge/cards/
  game-type/
    water_blaster.card.json
    slingshot.card.json
    ... (38 files)
  module/
    tween.card.json       (when module exists)
    physics2d.card.json   (when module exists)
    spawner.card.json     (existing module, new expert data)
    ...
  recipe/
    aim_pingpong.card.json
    rigidbody_with_collider.card.json
    background_horizontal.card.json
    ... (from 19 command sequences + 16 templates)
```

Card example (`game-type/water_blaster.card.json`):
```json
{
  "gameTypeId": "water_blaster",
  "topModules": ["Aim", "Spawner", "Collision", "Scorer", "Timer"],
  "signatureParams": [
    { "moduleId": "Spawner", "param": "spawnRate", "suggested": 6.0, "unit": "per_second" },
    { "moduleId": "Aim", "param": "sensitivity", "suggested": 1.2, "range": [1.0, 1.5] }
  ],
  "recipes": ["recipes/aim_with_spawner.card.json"],
  "examples": ["data/experts/normalized/water_blaster_001.json"],
  "confidence": 0.81,
  "description": "Swipe to aim laser at floating targets. Release to eliminate."
}
```

### Frontend: Agent UX Enhancements (Gemini)

**Chat Enhancements in `src/ui/chat/studio-chat-panel.tsx`:**

1. **ExpertInsightBlock**: When ConversationAgent references expert data, render a tinted collapsible box: "Based on analysis of 120+ expert games, here is the optimal Slingshot architecture"
2. **ModuleCombinationCard**: Visual wiring diagram of suggested modules (e.g., Input -> Aim -> Collision -> Scorer)
3. **ParameterPill**: Clickable parameter badge in chat (e.g., `[Spawn Rate: 1.5/s]`) -> shows expert range + confidence on click
4. **"Apply Expert Tuning" button**: One-click to load expert overlay for current game type

**Agent Tool Additions (spec only, wire later):**
- `tool:get_parameter_calibration(gameTypeId?, moduleId, param)` -> suggested + range + confidence
- `tool:get_module_combo(gameTypeId)` -> ordered modules with expert evidence
- `tool:get_recipe(recipeId)` -> command sequence with slots

**Prompting Policy:**
- Agent prefers L3 calibrations when confidence >= 0.6; else falls back to L2
- Agent cites evidence counts when suggesting parameters
- Agent surfaces rangeP10P90 so users understand flexibility

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/knowledge/cards/game-type/*.card.json` | Create | 38 game type cards |
| `src/knowledge/cards/recipe/*.card.json` | Create | ~35 recipe cards |
| `src/knowledge/index/expert-knowledge.index.json` | Create | Master index with hashes + timestamps |
| `src/agent/skill-loader.ts` | Modify | Add JSON card loading alongside markdown |
| `src/agent/conversation-agent.ts` | Modify | Use cards for expert-grounded suggestions |
| `src/ui/chat/studio-chat-panel.tsx` | Modify | Add ExpertInsightBlock, ModuleCombinationCard, ParameterPill |
| `src/ui/chat/expert-insight-block.tsx` | Create | Expert citation UI block |
| `src/ui/chat/module-combination-card.tsx` | Create | Visual module wiring card |

---

## 0.4 Quality Benchmark System (Codex + Gemini)

### Backend: Game Feel Score (Codex)

**8 scoring dimensions (0-100 each):**

| Dimension | What it Measures | Expert Reference |
|-----------|-----------------|-----------------|
| Input Responsiveness | Latency, buffering window | Expert input timing profiles |
| Motion Fidelity | Velocity/accel curves vs expert | DTW distance to reference curves |
| Collision Fairness | Overlap error vs collider bounds | False positive/negative rates |
| Timing & Cadence | Spawn rate stability, tween durations | EMD/KS test vs expert distributions |
| Feedback Richness | Presence of flash, scale-punch, screenshake | Weighted feature flags |
| Difficulty Ramp | Slope over time vs reference curve | Curve similarity score |
| Consistency/Polish | Frame pacing jitter, param drift | Variance metrics |
| UI/State Clarity | HUD latency, hit/miss signalling | Response time thresholds |

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `data/experts/benchmarks/scoring-rubric.v1.json` | Create | Weights + thresholds per dimension |
| `data/experts/benchmarks/references/` | Create | Per game-type reference signals |

### Frontend: Game Feel Dashboard (Gemini)

**New Component:** `src/ui/editor/game-feel-score.tsx`

- Persistent widget in editor toolbar showing dynamic 0-100 score
- Dropdown with per-dimension breakdown
- Actionable suggestions: "Add PingPong tween to targets (+15 Score) [Apply Now]"
- Progressive badges: Bronze (40+) / Silver (60+) / Gold (80+) / Expert (90+)
- "Compare with Expert" toggle: side-by-side param comparison table

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/editor/game-feel-score.tsx` | Create | Score dashboard + actionable suggestions |
| `src/engine/diagnostics/game-feel-scorer.ts` | Create | Score calculator from config vs reference |

---

## 0.5 Module Combination Patterns (Codex)

### Recipe Knowledge Base

Convert 19 command sequences + 16 templates into structured recipes:

**Directory:** `src/knowledge/recipes/`

Recipe schema:
```json
{
  "id": "rigidbody_with_collider",
  "version": "1.0",
  "applicability": { "gameTypes": ["bounded_bounce", "platformer"] },
  "slots": [{ "name": "target", "type": "SceneObject" }],
  "preconditions": [{ "check": "!hasComponent", "component": "Collider2D" }],
  "steps": [
    { "op": "AddComponent", "target": "$target", "component": "Collider2D", "params": { "shape": "Box" } },
    { "op": "AddComponent", "target": "$target", "component": "RigidBody2D", "params": { "gravityScale": 1.0 } }
  ],
  "hints": {
    "autowire": [
      { "when": { "has": ["RigidBody2D", "Collider2D"] }, "connect": { "from": "collision:hit", "to": "tween:start" } }
    ]
  }
}
```

### AutoWirer Enhancement

Derive "graph grammar" rules from recipe hints:
- Store in `src/knowledge/recipes/autowire.rules.json`
- AutoWirer can propose bridges before applying (preview mode)
- ConversationAgent explains "why this bridge" using recipe evidence

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/knowledge/recipes/*.json` | Create | ~35 structured recipes |
| `src/knowledge/recipes/autowire.rules.json` | Create | Derived bridge rules from patterns |
| `tools/convert-sequences-to-recipes.ts` | Create | Command sequence -> recipe converter |

---

# M1-M5: Module Implementation (unchanged from v1)

> The following milestones are identical to v1 plan. See `.claude/plan/p0-expert-data-integration.md` for full details.

## M1: Tween Module
- TweenModule + TweenSystem + easings + types
- 12 easing functions, Bezier paths, PingPong/Loop
- AutoWirer bridge: collision:hit -> tween:start
- ~30 tests

## M2: Physics2D Expansion
- Physics2DModule + planck.js adapter
- Box/Circle/Edge colliders + RigidBody2D + Raycast
- PhysicsDebugRenderer (wireframe overlay)
- ~40 tests

## M3: ScrollingLayers (Parallax)
- ScrollingLayersModule + dual-group infinite tiling
- ParallaxRenderer (TilingSprite before cameraLayer)
- ~20 tests

## M4: Recipe Runner
- RecipeExecutor (command interpreter + rollback)
- PresetRegistry + SmartAssetsPanel + GameWizardModal
- ~30 tests

## M5: Expert Data Ingest
- Full 80 JSON normalization into Recipe Runner format
- Knowledge base cross-links
- ~15 tests

---

## Complete File Summary

### M0 Create (~25 files)
```
tools/extract-expert-params.ts
tools/convert-sequences-to-recipes.ts
data/experts/normalized/ (directory)
data/experts/derived/calibrations/ (directory)
data/experts/derived/module-aliases.json
data/experts/benchmarks/scoring-rubric.v1.json
data/experts/benchmarks/references/ (directory)
src/knowledge/overlays/module-defaults.overlay.json
src/knowledge/overlays/presets.overlay.json
src/knowledge/overlays/new-presets.proposed.json
src/knowledge/taxonomy/game-types.v2.json
src/knowledge/cards/game-type/*.card.json (38 files)
src/knowledge/cards/recipe/*.card.json (~35 files)
src/knowledge/recipes/*.json (~35 files)
src/knowledge/recipes/autowire.rules.json
src/knowledge/index/expert-knowledge.index.json
src/ui/chat/expert-insight-block.tsx
src/ui/chat/module-combination-card.tsx
src/ui/editor/game-feel-score.tsx
src/engine/diagnostics/game-feel-scorer.ts
```

### M0 Modify (~6 files)
```
src/agent/game-presets.ts          -- merge expert overlays into 15 existing + add 23 new
src/agent/conversation-defs.ts     -- ALL_GAME_TYPES 15 -> 38
src/agent/skill-loader.ts          -- add JSON card loading
src/agent/conversation-agent.ts    -- use cards for expert-grounded suggestions
src/ui/chat/game-type-selector.tsx -- category grouping + search + progressive disclosure
src/ui/chat/studio-chat-panel.tsx  -- ExpertInsightBlock, ModuleCombinationCard, ParameterPill
```

### M1-M5 Create (~35 files) -- from v1 plan
```
(see v1 plan for complete list)
```

### M1-M5 Modify (~8 files) -- from v1 plan
```
(see v1 plan for complete list)
```

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Expert data quality varies | Bad calibrations | Shrinkage to prior + confidence thresholds (>= 0.6) |
| Module alias mapping errors | Wrong param assignments | Manual validation of top-10 modules; alias table with tests |
| Game type taxonomy too granular | Overwhelming UI | Progressive disclosure; "Top 8" default; fuzzy search |
| Overlay merge conflicts with user customizations | User params overwritten | Overlay only applies to NEW games; existing configs untouched |
| Game Feel Score too opinionated | User frustration | Score is advisory only; "suggestions" not "requirements" |
| planck.js bundle size (~80KB gzip) | Larger initial load | Tree-shake; lazy-load Physics2DModule only when enabled |
| Fixed physics step spiral of death | Game freezes | Cap max 5 sub-steps per frame; warn in diagnostics |

---

## Milestones & Deliverables

| Milestone | Deliverables | Test Count (est.) |
|-----------|-------------|-------------------|
| **M0 Knowledge** | Expert calibration + 38 game types + knowledge cards + Game Feel Score + recipes | ~25 tests |
| **M1 Tween** | Module + System + Easings + Schema + APJS translator | ~30 tests |
| **M2 Physics2D** | Module + Planck adapter + Colliders + Raycast + Debug renderer | ~40 tests |
| **M3 ScrollingLayers** | Module + TilingSprite renderer + Layer controls | ~20 tests |
| **M4 Recipe Runner** | Executor + Validators + PresetRegistry + Wizard UI | ~30 tests |
| **M5 Expert Ingest** | Full 80 JSON normalization + Knowledge cross-links | ~15 tests |
| **Total** | M0 knowledge layer + 4 modules + 3 renderers + 9 UI components | **~160 tests** |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION (knowledge): 019d5a43-b23d-7770-b094-ad83f8723195
- CODEX_SESSION (modules): 019d5a38-e15c-7bc0-a3d8-1665268c518f
- GEMINI_SESSION: (policy mode, no persistent session)
