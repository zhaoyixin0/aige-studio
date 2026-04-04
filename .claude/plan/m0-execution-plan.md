# M0 Knowledge Application Layer - Execution Plan

> Concrete step-by-step plan synthesized from Codex (backend) + Gemini (frontend) dual-model analysis.
> Source architecture: `.claude/plan/p0-expert-data-integration-v2.md`

---

## Overview

- **22 total steps** (12 backend + 10 frontend)
- **3 parallel tracks** possible (up to 3 agents in worktrees)
- **Each step ~30 min**, produces testable artifact
- **TDD**: write test RED first, then implement GREEN
- **Zero new engine modules** -- only data, knowledge, and UI

---

## Dependency Graph

```
BACKEND                              FRONTEND
========                             ========

B1 Scaffold ------+                  F1 GamePreset expansion ---+
     |            |                       |                     |
B2 JSON Inventory |                  F2 Search & Categories     |
     |            |                       |                     |
B3 Normalizer     |                  F3 Progressive Disclosure  |
     |            |                                             |
B4 Param Extract  +-- B8 Module     F4 Chat UI Primitives -----+
     |            |   Capabilities       |                     |
B5 Calibration    |        |        F5 ModuleCombinationCard   |
     |            |        |             |                     |
B6 Preset Overlay |   B7 Taxonomy   F6 Chat Integration        |
     |            |        |             |                     |
     +------------+--------+-- B9   F7 SkillLoader Wiring  F8 Game Feel State
                  |   Recipes            (needs B10)             |
                  |        |                                F9 Game Feel UI
              B10 Knowledge Cards                               |
                  |                                        F10 Dashboard Integration
              B11 Feel Score Engine
                  |
              B12 Integration Smoke
```

---

## BACKEND STEPS (Codex authority)

### B1: Scaffold & Test Harness
- **Input**: Repo structure, Vitest config
- **Output**: `tools/m0/`, `tools/m0/__tests__/00-smoke.test.ts`
- **Action**: Create M0 tools directory with placeholder exports and smoke test
- **Verify**: `npx vitest run tools/m0/__tests__/00-smoke.test.ts`
- **Deps**: None
- **Parallel**: Baseline; do first
- **Size**: S

### B2: Expert JSON Inventory & Loader
- **Input**: `expert-data/json/` (80 files)
- **Output**: `tools/m0/io/expert-inventory.ts`, `tools/m0/__tests__/01-inventory.test.ts`
- **Action**: Loader that reads 80 JSONs, buckets by format (knowledge/commands/templates/snapshots). Returns `Inventory` object with 4 arrays.
- **Verify**: `npx vitest run tools/m0/__tests__/01-inventory.test.ts` -- assert counts >= 41/19/16/7
- **Deps**: B1
- **Parallel**: With B8
- **Size**: S

### B3: Schema Guards & Normalizer
- **Input**: B2 output
- **Output**: `tools/m0/schema/expert-types.ts`, `tools/m0/schema/guards.ts`, `tools/m0/__tests__/02-normalize.test.ts`
- **Action**: TS interfaces for 4 expert kinds. Runtime type guards + `normalizeExpert(doc)` (trim, lowercase, coerce). Apply 1.5x scale factor (720x1280 -> 1080x1920).
- **Verify**: `npx vitest run tools/m0/__tests__/02-normalize.test.ts` -- all 80 docs pass guards
- **Deps**: B2
- **Parallel**: With B8
- **Size**: S

### B4: Parameter Extractor
- **Input**: Normalized docs (B3)
- **Output**: `tools/m0/calibration/extract-params.ts`, `tools/m0/calibration/param-catalog.ts`, `tools/m0/__tests__/03-extract-params.test.ts`
- **Action**: Define canonical param vocabulary mapped from Effect House component names (module-aliases.json). Implement `extractParams(doc): Partial<CanonicalParams>`. Golden tests on Water_Blaster, BoundedBounce, MazeChase.
- **Verify**: `npx vitest run tools/m0/__tests__/03-extract-params.test.ts`
- **Deps**: B3
- **Parallel**: With B7, B8, B9
- **Size**: M

### B5: Calibration Math
- **Input**: Extracted params (B4)
- **Output**: `tools/m0/calibration/calibrate.ts`, `tools/m0/__tests__/04-calibrate.test.ts`
- **Action**: Empirical-Bayes shrinkage: `suggested = (w0*default + we*expertMedian) / (w0+we)`. Compute median, MAD, P10/P90, confidence per param. Property tests for monotonicity, range bounds.
- **Verify**: `npx vitest run tools/m0/__tests__/04-calibrate.test.ts`
- **Deps**: B4
- **Parallel**: With B7, B8, B9
- **Size**: M

### B6: Preset Overlay Builder
- **Input**: `src/agent/game-presets.ts` (15 presets), calibrations (B5)
- **Output**: `src/knowledge/overlays/presets.overlay.json`, `tools/m0/calibration/apply-overlays.ts`, `tools/m0/__tests__/05-overlays.test.ts`
- **Action**: `buildPresetOverlays()` maps expert calibrations to closest preset by game-type. `applyOverlays(base, overlays)` returns merged (immutable). Test: count stays 15; specific param changes match expectations.
- **Verify**: `npx vitest run tools/m0/__tests__/05-overlays.test.ts`
- **Deps**: B5
- **Parallel**: With B7, B9
- **Size**: M

### B7: Game Type Taxonomy v2
- **Input**: Existing presets, module directory (60 modules)
- **Output**: `src/knowledge/taxonomy/game-types.v2.json`, `tools/m0/__tests__/06-taxonomy.test.ts`
- **Action**: Author 38 game types with: id, group (8 categories), displayName, description, requiredModules, supportedToday, missingModules, evidence. Feasibility matrix: 20 supported today, 5 need Tween, 7 need Physics2D, 3 need ScrollingLayers.
- **Verify**: `npx vitest run tools/m0/__tests__/06-taxonomy.test.ts` -- assert 38 types, 8 groups
- **Deps**: B1 (optionally B8 for capability keys)
- **Parallel**: With B2-B6, B8, B9
- **Size**: M

### B8: Module Capability Digest
- **Input**: `src/engine/modules/mechanic/` (60 modules)
- **Output**: `tools/m0/taxonomy/module-capabilities.ts`, `tools/m0/__tests__/07-capabilities.test.ts`
- **Action**: Scan 60 module files, extract capabilities from getSchema()/getContracts()/getDependencies(). Produce `CapabilityIndex { moduleName -> Set<capability> }`. Validate 10 representative modules.
- **Verify**: `npx vitest run tools/m0/__tests__/07-capabilities.test.ts` -- index length = 60
- **Deps**: B1
- **Parallel**: With B2-B7, B9
- **Size**: M

### B9: Recipe Builder
- **Input**: Expert commands/templates (B2/B3)
- **Output**: `tools/m0/recipes/recipe-types.ts`, `tools/m0/recipes/from-expert.ts`, `src/knowledge/recipes/*.json`, `tools/m0/__tests__/08-recipes.test.ts`
- **Action**: Parse 19 command sequences + 16 templates into structured recipes. Map Effect House commands -> AIGE command names. Extract ParamSpec from `decompose_inputs`. Output ~35 recipe JSON files.
- **Verify**: `npx vitest run tools/m0/__tests__/08-recipes.test.ts` -- assert ~35 recipes, required fields present
- **Deps**: B2, B3
- **Parallel**: With B4-B8
- **Size**: M

### B10: Knowledge Cards Generator
- **Input**: Taxonomy (B7), Recipes (B9), Calibrations (B6)
- **Output**: `src/knowledge/cards/game-type/*.card.json` (38), `src/knowledge/cards/recipe/*.card.json` (~35), `src/knowledge/index/expert-knowledge.index.json`, `tools/m0/__tests__/09-cards.test.ts`
- **Action**: Generate game-type cards (topModules, signatureParams, confidence) and recipe cards (steps, params, expected feel). Master index with hashes + timestamps.
- **Verify**: `npx vitest run tools/m0/__tests__/09-cards.test.ts` -- 38 game-type + ~35 recipe cards
- **Deps**: B6, B7, B9
- **Parallel**: With B11
- **Size**: M

### B11: Game Feel Score Engine
- **Input**: Calibrations (B5), Capabilities (B8)
- **Output**: `src/engine/diagnostics/game-feel-scorer.ts`, `tools/m0/__tests__/10-feel-score.test.ts`
- **Action**: 8 dimensions (Responsiveness, Motion Fidelity, Collision Fairness, Timing, Feedback Richness, Difficulty Ramp, Consistency, UI Clarity). Weighted sigmoid scoring 0-100. Property tests: bounds, sensitivity, stability.
- **Verify**: `npx vitest run tools/m0/__tests__/10-feel-score.test.ts`
- **Deps**: B5, B8
- **Parallel**: With B10
- **Size**: M

### B12: Integration Smoke Test
- **Input**: All B2-B11 outputs
- **Output**: `tools/m0/__tests__/11-integration.test.ts`, `tools/m0/artifacts.manifest.json`
- **Action**: End-to-end pipeline: load inventory -> normalize -> extract -> calibrate -> overlay -> taxonomy -> recipes -> cards -> feel score for 2 sample recipes. Validate manifest with SHA-256 hashes.
- **Verify**: `npx vitest run tools/m0/__tests__/11-integration.test.ts`
- **Deps**: B2, B4-B11
- **Parallel**: None (final gate)
- **Size**: M

---

## FRONTEND STEPS (Gemini authority)

### F1: GamePreset Data Expansion
- **Input**: `src/agent/game-presets.ts`, `src/agent/conversation-defs.ts`
- **Output**: Modified `game-presets.ts`, `conversation-defs.ts`, `src/agent/__tests__/game-presets-expanded.test.ts`
- **Action**: Extend GamePreset interface with `category`, `description`, `tags`. Add 23 new preset stubs (mark `supportedToday`). Update ALL_GAME_TYPES from 15 -> 38.
- **Verify**: `npx vitest run src/agent/__tests__/game-presets-expanded.test.ts`
- **Deps**: None (can use B7 taxonomy data if ready, else hardcode)
- **Parallel**: With F4, F8, B1-B9
- **Size**: S

### F2: GameTypeSelector Search & Categories
- **Input**: Expanded game-presets (F1)
- **Output**: New `src/ui/chat/game-search-bar.tsx`, modified `src/ui/chat/game-type-selector.tsx`
- **Action**: Create `GameSearchBar` (Tailwind rounded input, focus ring). Add local state for `searchQuery` + `activeCategory`. Horizontal scrollable category tabs (8 groups). Filter rendered presets.
- **Verify**: Visual: search filters, category tabs switch content
- **Deps**: F1
- **Parallel**: No
- **Size**: M

### F3: GameTypeSelector Progressive Disclosure
- **Input**: Modified game-type-selector (F2)
- **Output**: Modified `src/ui/chat/game-type-selector.tsx`
- **Action**: Convert to Tailwind grid (grid-cols-2 mobile, grid-cols-3 desktop). Show top 6 by default, "Show More (32)" button to expand. Visual thumbnail cards with gradient placeholders. "Supported" / "Coming Soon" badges.
- **Verify**: Visual: grid layout, expansion toggle, badge rendering
- **Deps**: F2
- **Parallel**: No
- **Size**: M

### F4: Expert Chat UI Primitives
- **Input**: Reference `gui-param-card.tsx` styling
- **Output**: New `src/ui/chat/parameter-pill.tsx`, `src/ui/chat/expert-insight-block.tsx`
- **Action**: `ParameterPill` -- inline clickable chip (text-xs, rounded-full, bg-primary/10) showing param name + value. `ExpertInsightBlock` -- tinted collapsible wrapper with sparkle icon for expert citations.
- **Verify**: Render with mock data, verify Tailwind styling
- **Deps**: None
- **Parallel**: With F1-F3, F8
- **Size**: S

### F5: Module Combination Card
- **Input**: F4 components
- **Output**: New `src/ui/chat/module-combination-card.tsx`
- **Action**: Card listing 2-3 interacting modules with `ParameterPill` badges. "Apply Expert Tuning" button. Wrap in `ExpertInsightBlock`.
- **Verify**: Visual: hover states, button click fires mock action
- **Deps**: F4
- **Parallel**: No
- **Size**: M

### F6: Chat Message Integration
- **Input**: F5 components, `src/ui/chat/message-list.tsx`, `src/agent/conversation-defs.ts`
- **Output**: Modified `message-list.tsx`, `conversation-defs.ts`
- **Action**: Extend ChatMessage type with `type: 'expert_insight' | 'module_tuning'`. Update MessageList rendering to handle new types using ExpertInsightBlock / ModuleCombinationCard.
- **Verify**: Inject hardcoded expert message into chat, confirm rendering
- **Deps**: F5
- **Parallel**: No
- **Size**: M

### F7: SkillLoader JSON Wiring
- **Input**: Backend cards (B10), `src/agent/skill-loader.ts`
- **Output**: Modified `skill-loader.ts`, `src/agent/__tests__/skill-loader-cards.test.ts`
- **Action**: Extend SkillLoader to load `src/knowledge/cards/**/*.card.json` alongside markdown. Map card data into ConversationAgent prompt context. Async lazy-load by path + hash cache.
- **Verify**: `npx vitest run src/agent/__tests__/skill-loader-cards.test.ts`
- **Deps**: **B10** (backend cards must exist)
- **Parallel**: With F8-F10
- **Size**: M

### F8: Game Feel State Management
- **Input**: `src/store/editor-store.ts`
- **Output**: Modified `editor-store.ts`
- **Action**: Add `gameFeel: { score: number; dimensions: Record<string, number>; suggestions: Array<{ id, title, description, delta }>; badge: 'bronze'|'silver'|'gold'|'expert'|null }` to EditorStore. Populate with mock data.
- **Verify**: Check Zustand devtools
- **Deps**: None
- **Parallel**: With F1-F6, B steps
- **Size**: S

### F9: Game Feel UI Components
- **Input**: Game Feel state (F8)
- **Output**: New `src/ui/editor/game-feel-score.tsx`, `src/ui/editor/game-feel-suggestions.tsx`
- **Action**: `GameFeelScore` -- SVG radial progress (red <50, yellow 50-80, green >80) with badge display. `GameFeelSuggestions` -- vertical list with inline "Apply" action buttons.
- **Verify**: Render with dummy scores (30, 75, 95), verify color transitions
- **Deps**: F8
- **Parallel**: No
- **Size**: L

### F10: Game Feel Dashboard Integration
- **Input**: F9 components, `src/ui/editor/editor-panel.tsx`
- **Output**: Modified `editor-panel.tsx`
- **Action**: Add collapsible "Game Feel" section in EditorPanel. Mount GameFeelScore + GameFeelSuggestions. Wire to `useEditorStore(s => s.gameFeel)`.
- **Verify**: Visual: opens alongside PropertiesPanel, cohesive layout
- **Deps**: F9
- **Parallel**: No
- **Size**: S

---

## Parallel Execution Strategy

### 3 Agent Worktrees

```
Agent A (Backend Calibration)     Agent B (Backend Knowledge)     Agent C (Frontend)
==============================    ============================    ==================
B1 Scaffold                       B7 Taxonomy                     F1 Preset Expansion
B2 JSON Inventory                 B8 Module Capabilities          F4 Chat Primitives
B3 Normalizer                     B9 Recipe Builder               F8 Game Feel State
B4 Param Extract                       |                          F2 Search & Categories
B5 Calibration                    B10 Knowledge Cards (wait B6)   F3 Progressive Disclosure
B6 Preset Overlay                 B11 Feel Score Engine           F5 ModuleCombinationCard
     |                                 |                          F6 Chat Integration
     +------- B12 Integration ---------+                          F7 SkillLoader (wait B10)
                                                                  F9 Game Feel UI
                                                                  F10 Dashboard Integration
```

### Critical Path

**Longest sequential chain:**
`B1 -> B2 -> B3 -> B4 -> B5 -> B6 -> B10 -> B12` (8 steps, ~4 hours)

**Frontend critical path:**
`F1 -> F2 -> F3` (3 steps, ~1.5 hours) and `F4 -> F5 -> F6` (3 steps, ~1.5 hours) -- can run in parallel

### Estimated Total Time

| Track | Steps | Sequential Time |
|-------|-------|----------------|
| Agent A (Backend Calibration) | B1-B6, B12 | ~3.5 hours |
| Agent B (Backend Knowledge) | B7-B11 | ~2.5 hours |
| Agent C (Frontend) | F1-F10 | ~4 hours |
| **Wall Clock (parallel)** | | **~4 hours** |
| **Wall Clock (sequential)** | | **~11 hours** |

---

## Checkpoints

| After Step | Checkpoint | Command |
|------------|-----------|---------|
| B6 | 15 presets have expert overlays | `npx vitest run tools/m0/__tests__/05-overlays.test.ts` |
| B10 | 38 game-type cards + ~35 recipe cards generated | `ls src/knowledge/cards/game-type/ \| wc -l` (expect 38) |
| B12 | Full pipeline smoke passes | `npx vitest run tools/m0/__tests__/11-integration.test.ts` |
| F3 | GameTypeSelector shows 38 types with categories | Visual check in browser |
| F6 | Expert blocks render in chat | Inject test message, visual check |
| F10 | Game Feel dashboard visible in editor | Visual check in browser |

---

## Rollback Strategy

- **Per-step**: Commit at green test. If verification fails, `git restore -SW .` in worktree
- **Generated artifacts** (JSON): confined under `src/knowledge/` and `tools/m0/` -- `git clean -fx` to revert
- **Frontend**: All new components are additive. Revert `message-list.tsx` switch/case to restore standard rendering. Revert `game-type-selector.tsx` to restore 15-button layout.
- **Cross-step**: If param vocabulary changes, update types + re-run `npx vitest run tools/m0/__tests__/*{extract,calibrate,overlays}*`

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d5a4e-5501-74a2-a5d4-1d9812bd2628
- GEMINI_SESSION: (policy mode, no persistent session)
