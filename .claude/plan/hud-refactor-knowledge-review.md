# Implementation Plan: HUD Refactoring + Knowledge Expansion + Code Review Fixes

## Task Overview

Three sequential tasks to improve code quality and completeness:
1. **T1: HUD Renderer Refactoring** — Split 1648-line hud-renderer.ts into <800-line sub-renderers
2. **T2: Knowledge Base Expansion** — Add NPC portrait + drop item prompt templates
3. **T3: Code Review M-level Fixes** — Fix `as any` casts, magic numbers, type safety

### Task Type
- [x] Frontend (renderer refactoring + knowledge files)
- [ ] Backend
- [ ] Fullstack

---

## T1: HUD Renderer Refactoring (H4)

### Problem
`hud-renderer.ts` is 1648 lines — exceeds 800-line guideline by 2x. Contains 10 game-type HUDs, 2 combat HUDs, 3 game-flow overlays, and core HUD all in one file.

### Architecture: Sub-renderer Extraction

Current structure analysis (line ranges):
```
L1-55:     Imports + constants
L56-165:   Class fields (~110 fields)
L167-349:  Constructor (builds 15+ containers)
L351-461:  Expression + Gesture build (110 lines)
L463-541:  Puzzle + DressUp build (80 lines)
L543-612:  Narrative build (70 lines)
L614-765:  Main sync() dispatcher (150 lines)
L769-1033: Expression/Gesture/Puzzle/DressUp/Narrative sync (265 lines)
L1034-1177: Runner + Rhythm build+sync (144 lines)
L1178-1236: AR build+sync (59 lines)
L1237-1465: Countdown + Start + Result build+sync (229 lines)
L1466-1630: Shooter + RPG HUD build+sync (165 lines)
L1632-1648: Reset (17 lines)
```

### Proposed Split (4 files, each <600 lines)

| New File | Contents | Est. Lines |
|----------|----------|-----------|
| `hud-renderer.ts` | Core HUD (score/timer/lives/combo) + Quiz inline + Wheel inline + shooter HUD + RPG HUD + sync orchestration + reset | ~550 |
| `challenge-hud-renderer.ts` | Expression, Gesture, Puzzle, DressUp, Narrative (build+sync) | ~530 |
| `activity-hud-renderer.ts` | Runner, Rhythm, World-AR (build+sync) | ~210 |
| `game-flow-overlay-renderer.ts` | Countdown, Start, Result (build+sync) | ~350 |

### Sub-renderer Interface Pattern

```typescript
// Each sub-renderer follows this contract:
export class ChallengeHudRenderer {
  constructor(parent: Container, width: number, height: number);
  sync(engine: Engine, dt?: number): void;
  reset(): void;
}
```

### Implementation Steps

**Step 1: Create `challenge-hud-renderer.ts`** (~530 lines)
- Move constants: `GESTURE_EMOJI`, `EXPRESSION_EMOJI`, `LAYER_EMOJI`, `LAYER_LABEL`, `CARD_COLORS`
- Move fields: expression*, gesture*, puzzle*, dressUp*, narrative* (all related fields)
- Move methods: `buildExpressionContainer`, `buildGestureContainer`, `buildPuzzleContainer`, `buildDressUpContainer`, `buildNarrativeContainer`
- Move sync methods: `syncExpression`, `syncGesture`, `syncPuzzle`, `syncDressUp`, `syncNarrative`
- Export class `ChallengeHudRenderer` with `constructor(parent, w, h)`, `sync(engine)`, `reset()`

**Step 2: Create `activity-hud-renderer.ts`** (~210 lines)
- Move methods: `buildRunnerContainer`, `buildRhythmContainer`, `buildARContainer`
- Move sync methods: `syncRunner`, `syncRhythm`, `syncAR`
- Move fields: runner*, rhythm*, ar*
- Export class `ActivityHudRenderer`

**Step 3: Create `game-flow-overlay-renderer.ts`** (~350 lines)
- Move methods: `buildCountdownContainer`, `buildStartContainer`, `buildResultContainer`
- Move sync methods: `syncCountdown`, `syncStart`, `syncResult`
- Move fields: countdown*, start*, result*
- Export class `GameFlowOverlayRenderer`

**Step 4: Refactor `hud-renderer.ts`** (~550 lines)
- Keep: Core HUD (score/timer/lives/combo), Quiz inline, Wheel inline + drawWheel
- Keep: Shooter HUD (build+sync), RPG HUD (build+sync) — recently added, tightly coupled
- Add: Import and instantiate 3 sub-renderers in constructor
- Modify `sync()`: Route to sub-renderers
  ```typescript
  sync(engine: Engine, dt = 16): void {
    // Core HUD sync (score, timer, lives, combo) — inline
    // Quiz sync — inline
    // Wheel sync — inline
    this.challengeHud.sync(engine, dt);
    this.activityHud.sync(engine, dt);
    this.syncShooterHud(engine);
    this.syncRpgHud(engine);
    this.gameFlowOverlay.sync(engine, dt);
  }
  ```
- Modify `reset()`: delegate to sub-renderers

**Step 5: Write tests for any extracted pure functions** (if applicable)
- Check if any logic in challenge/activity/flow renderers should be extracted as pure functions
- Game flow overlay may have pure logic for star calculation, countdown formatting

**Step 6: Verify no regressions**
- `npx vitest run` — all existing tests pass
- `npx tsc --noEmit` — no type errors
- Manual test: verify all 15 game types render correctly

### Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Circular dependency between sub-renderers | Each sub-renderer is self-contained, no cross-references |
| Field access across files | Move ALL related fields + constants with each sub-renderer |
| Constructor order matters (addChild) | Sub-renderers add children to parent container in their constructors |
| Quiz/Wheel inline in constructor | Keep in main file — extraction ROI too low for ~150 lines |

---

## T2: Knowledge Base Expansion

### Problem
`src/knowledge/asset-prompts/` has templates for player, enemy, collectible, obstacle, projectile, background, UI — but missing NPC portrait and drop item templates despite code supporting these roles since batch 3.

### Current Coverage vs. Code Roles

| PromptBuilder Role | Knowledge File | Status |
|--------------------|---------------|--------|
| `good` | item.md (Collectible) | Done |
| `bad` | item.md (Obstacle) | Done |
| `player` | character.md (Player) | Done |
| `bullet` | item.md (Projectile) | Done |
| `background` | background.md | Done |
| `enemy` | character.md (Enemy) | Done |
| **`npc`** | **Missing** | **NEW** |
| **`drop`** | **Missing** | **NEW** |

### Implementation Steps

**Step 1: Add NPC Portrait section to `character.md`**
- Append NPC Portrait Template after Enemy Character Template
- Focus: bust shot, expressive face, dialogue system context
- Size guidance: 64x64 readability (matches `buildNpcPrompt` in prompt-builder.ts)
- Include NPC Design Principles subsection

**Step 2: Add Drop Item section to `item.md`**
- Append Drop Item Template after Projectile Template
- Focus: loot reward, sparkle/glow, valuable appearance
- Size guidance: 32x32 readability (matches `buildDropPrompt` in prompt-builder.ts)
- Include Drop Design Principles subsection

**Step 3: Verify prompt alignment**
- Cross-reference knowledge templates with actual `buildNpcPrompt()` and `buildDropPrompt()` in prompt-builder.ts
- Ensure size hints, composition, and aesthetic descriptions match

### Files to Modify

| File | Operation | Description |
|------|-----------|-------------|
| `src/knowledge/asset-prompts/character.md` | Append | NPC Portrait Template + design principles |
| `src/knowledge/asset-prompts/item.md` | Append | Drop Item Template + design principles |

---

## T3: Code Review M-level Fixes

### Identified Issues

**M1: `as any` casts in hud-renderer.ts** (6 occurrences)
- L672: `(question as any).question` — QuizEngine.getCurrentQuestion() returns untyped
- L673: `(question as any).options` — same issue
- L713: `(result as any).item?.label` — Randomizer.getResult() returns untyped
- L1071: `(runner.getParams() as any).laneCount` — getParams() returns Record<string, unknown>
- L1125: `(beatMap.getParams() as any).tolerance` — same pattern
- L1414: `(scorers[0] as any)` — Scorer module cast

**Fix approach:** Use proper module type imports. For `getParams()` pattern, cast to specific param shape or use type-safe access with `as number ?? default`.

**M2: `as any` casts in pixi-renderer.ts** (4 occurrences)
- L101: `(window as any).__gameStore` — global store access
- L306: `gameFlows[0] as any` — should cast to GameFlow
- L313-314: `(mod as any).gameflowPaused` / `(mod as any).reset?.()` — should use BaseModule interface

**Fix approach:** L101 is a legitimate escape hatch (global). L306 should use `as GameFlow`. L313-314 should use `(mod as BaseModule)` since `gameflowPaused` and `reset()` are on BaseModule.

**M3: Magic number for maxLives in hud-renderer.ts**
- L647: `const maxLives = 3;` — hardcoded instead of reading from Lives module

**Fix approach:** Read from Lives module's params or keep constant but add comment explaining it's a display default.

**M4: Timer style mutation in hud-renderer.ts**
- L638-642: `(this.timerText.style as TextStyle).fill = '#ff4757'` — direct style mutation

**Fix approach:** This is PixiJS's API pattern — mutating style properties is the standard approach. Mark as acceptable.

**M5: `as any` in game-object-renderer.ts**
- L37: `(assets as any)[k]?.src` — assets type is Record<string, unknown>

**Fix approach:** Cast to `Record<string, { src?: string }>` at the point of access.

**M6: Missing type exports for module interfaces**
- Shooter/RPG renderers import module types but cast with `as Type | undefined`
- Better: create a utility type for `engine.getModulesByType()` return

**Fix approach:** This is the established project pattern — not worth changing as it requires Engine type system redesign.

### Implementation Steps

**Step 1: Fix `as any` in hud-renderer.ts (M1)**
- Import QuizQuestion type or create inline interface for quiz question shape
- Use `as Record<string, unknown>` + nullish coalescing for getParams() access pattern:
  ```typescript
  const laneCount = (runner.getParams().laneCount as number | undefined) ?? 3;
  ```
- Fix Scorer cast to use proper type

**Step 2: Fix `as any` in pixi-renderer.ts (M2)**
- L306: Cast to `GameFlow` (already imported)
- L313-314: Import `BaseModule` from engine core, cast to `BaseModule`

**Step 3: Fix magic maxLives constant (M3)**
- Read from Lives module: `engine.getModulesByType('Lives')[0]` → params.maxLives
- Fallback to 3 if module not present

**Step 4: Fix `as any` in game-object-renderer.ts (M5)**
- Properly type the assets parameter

**Step 5: Verify all fixes**
- `npx tsc --noEmit` — no type errors
- `npx vitest run` — all tests pass

### Files to Modify

| File | Operation | Description |
|------|-----------|-------------|
| `src/engine/renderer/hud-renderer.ts` | Modify | Fix 6x `as any` casts, magic maxLives |
| `src/engine/renderer/pixi-renderer.ts` | Modify | Fix 3x `as any` casts (L306, L313, L314) |
| `src/engine/renderer/game-object-renderer.ts` | Modify | Fix 1x `as any` cast |

---

## Execution Order

1. **T1 first** — HUD refactoring (largest change, no external deps)
2. **T2 second** — Knowledge expansion (independent, quick)
3. **T3 last** — Code review fixes (applied to refactored files from T1)

Note: T3 `as any` fixes in hud-renderer.ts will be applied to the POST-refactoring version, so some occurrences may end up in different sub-renderer files.

## Estimated File Impact

| File | Lines Before | Lines After | Change |
|------|-------------|------------|--------|
| hud-renderer.ts | 1648 | ~550 | -1098 |
| challenge-hud-renderer.ts | NEW | ~530 | +530 |
| activity-hud-renderer.ts | NEW | ~210 | +210 |
| game-flow-overlay-renderer.ts | NEW | ~350 | +350 |
| character.md | 70 | ~120 | +50 |
| item.md | 83 | ~130 | +47 |
| pixi-renderer.ts | ~370 | ~370 | ~0 (type fixes) |
| game-object-renderer.ts | ~100 | ~100 | ~0 (type fix) |

---

## SESSION_ID
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
