# M5 Expert Data Ingest — Implementation Plan

> Synthesized from Codex (backend pipeline) + Gemini (UI/UX strategy) dual-model analysis.
> Expert data: 80 JSON files at `G:/claude code/AIGE_DEMO/expert-data/json/`

---

## Overview

Convert 80 Effect House expert JSON files into AIGE Studio Recipe Runner `PresetTemplate` format. Offline precompile pipeline producing `.preset.json` artifacts, registered in a separate ExpertRegistry.

**5 steps, TDD, estimated 2-3 hours sequential.**

---

## Task Type
- [x] Backend (Codex authority)
- [ ] Frontend (Gemini authority — deferred to M6)
- [x] Fullstack (Pipeline + minimal registry wiring)

---

## Expert Data Classification

| Format | Count | Key Fields | Example |
|--------|-------|------------|---------|
| Knowledge/Scene Tree | ~41 | `game_type`, `root`, `description`, `examples` | `CardMatching_knowledge.json` |
| Command Sequence | ~24 | `command_sequence`, `decompose_inputs` | `2D_AngryBirds_Slingshot_Game.json` |
| Utility/Fragment | ~15 | templates, settings, prefabs, UI parts | `player_template.json`, `health_bar.json` |

Utility files are NOT converted to presets — indexed as fragments only.

---

## Dependency Graph

```
Step 1 (Detector + Mapper + IR) ──→ Step 2 (Synthesizer)
                                      ──→ Step 3 (Validator + CLI)
                                            ──→ Step 4 (Expert Registry)
                                                  ──→ Step 5 (Cross-links)
```

---

## Step 1: Detector + Game Type Mapper + IR Builder

### Goal
Classify 80 JSONs, map `game_type` → AIGE gameType, build intermediate representation (IR).

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `tools/m5/detector.ts` | Create | Format detection (knowledge/sequence/utility) |
| `tools/m5/game-type-mapper.ts` | Create | EH game_type → AIGE gameType string mapping |
| `tools/m5/ir-builder.ts` | Create | Build ExpertIR from both formats |
| `tools/m5/types.ts` | Create | ExpertIR type + VarSpec |
| `tools/m5/__tests__/detector.test.ts` | Create | Classification tests |
| `tools/m5/__tests__/game-type-mapper.test.ts` | Create | Mapping table tests |

### ExpertIR Type

```ts
interface ExpertIR {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly gameTypeHint: string | null;
  readonly aigeGameType: string;
  readonly tags: readonly string[];
  readonly params: readonly ParamSpec[];
  readonly assets: readonly { id: string; type: AssetType; src: string }[];
  readonly moduleHints: readonly { type: string; params: Record<string, unknown> }[];
  readonly unmappedComponents: readonly string[];
  readonly sourcePath: string;
  readonly confidence: number;
}
```

### Game Type Mapping Table (key rules)

| Pattern | AIGE gameType |
|---------|---------------|
| `/Slingshot\|Ball_Launch/i` | slingshot |
| `/whack\|mole/i` | whack-a-mole |
| `/CardMatching\|Puzzle_Memory\|TheOddOne\|AssembleMe/i` | puzzle |
| `/MazeChase\|Obstacle.*Dodge/i` | dodge |
| `/SugarInserting/i` | sugar-insert |
| `/perfect_pitch\|scale/i` | scale-matching |
| `/Spinning_Wheel\|randomPicker\|wheel/i` | random-wheel |
| `/Racing\|Swipe_Car/i` | racing |
| `/Laser_Trajectory/i` | trajectory |
| `/Flip.*Guess\|Image_Flip/i` | flip-guess |
| `/CharacterDress\|Makeup/i` | dress-up |
| `/Swimmer\|Chimpion/i` | swimmer |
| `/Jelly/i` | jelly |
| `/parkour\|Jump_Jump/i` | platformer |
| `/drawing\|screen_drawing/i` | drawing |
| `/Light.*stars/i` | tap |
| `/cross.*stree/i` | cross-road |
| `/Sliding.*Puzzle/i` | jigsaw |
| `/BiscuitChallenge\|ClearBlocks/i` | tap |
| `/WaterBlaster/i` | shooting |
| `/Quiz.*Dash/i` | quiz |

### Test Strategy (8 tests)
- detectFormat() classifies knowledge, sequence, utility correctly
- mapGameType() maps 10+ known expert game_types to AIGE types
- buildIR() extracts description, assets, params from knowledge format
- buildIR() extracts variables from decompose_inputs in sequence format
- buildIR() returns null for utility files

### Size: M

---

## Step 2: Preset Synthesizer

### Goal
Convert ExpertIR → PresetTemplate with proper command sequences.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `tools/m5/synthesizer.ts` | Create | IR → PresetTemplate conversion |
| `tools/m5/asset-extractor.ts` | Create | Walk scene tree / command args to find assets |
| `tools/m5/__tests__/synthesizer.test.ts` | Create | Synthesis tests |

### Synthesis Algorithm

1. `setMeta` — source path, description, original game_type
2. `configureCanvas` — 1080x1920 (AIGE standard)
3. `addAsset` — for each extracted asset (src may be empty → pendingAsset)
4. `addModule` — base modules from `PRESETS[gameType]` (game-presets.ts)
5. `addModule` — extra modules from moduleHints (derived from EH components)
6. `setParam` / `batchSetParams` — pipe user variables to module params where mapping exists

### Variable → Module Param Piping

| Variable | Module | Param |
|----------|--------|-------|
| duration | Timer | duration |
| projectileSpeed | Projectile | speed |
| gravityScale | Gravity | scale |
| pairCount | MatchEngine | gridSize |
| moleCount / spawnCount | Spawner | maxCount |
| speed | Runner / PlayerMovement | speed |

### Confidence Scoring

```
signals = [
  gameType mapped (not fallback),     // +0.25
  >= 1 asset found,                   // +0.15
  >= 3 core modules present,          // +0.35
  zero critical unmapped components,  // +0.25
]
confidence = sum(matched signals)
```

### Test Strategy (6 tests)
- synthesize() produces valid PresetTemplate shape
- synthesize() includes base modules from PRESETS
- synthesize() maps variables to setParam commands
- synthesize() extracts assets from scene tree
- synthesize() computes confidence correctly
- synthesize() tags with 'expert-import' and source info

### Size: M

---

## Step 3: Validator + CLI Runner

### Goal
CLI tool that runs the full pipeline: read 80 JSONs → classify → build IR → synthesize → validate → write `.preset.json`.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `tools/m5/cli.ts` | Create | CLI entry point |
| `tools/m5/expert-index.ts` | Create | Generate expert-index.json manifest |
| `tools/m5/__tests__/cli-integration.test.ts` | Create | End-to-end pipeline test on 5 representative files |

### CLI Output

```
src/knowledge/recipes-runner/experts/
  ├── expert-slingshot-launch.preset.json
  ├── expert-puzzle-memory.preset.json
  ├── expert-whack-a-mole.preset.json
  ├── ... (~45 files)
  └── expert-index.json   // manifest: { source, presetId, gameType, confidence }
```

### Validation Pipeline

For each generated preset:
1. `validateSequence(preset.sequence)` — structural validity
2. `RecipeExecutor.execute(preset.sequence, baseConfig, defaults)` — execution test
3. Confidence >= 0.6 → auto-register; < 0.6 → generate but mark as draft

### Test Strategy (5 tests)
- Pipeline classifies 80 files without crash
- Pipeline generates valid PresetTemplate for CardMatching_knowledge.json
- Pipeline generates valid PresetTemplate for 2D_AngryBirds_Slingshot_Game.json
- All generated presets pass validateSequence()
- expert-index.json contains correct source→preset mapping

### Size: M | Depends on: Steps 1-2

---

## Step 4: Expert Registry Wiring

### Goal
Load expert presets into a separate registry, accessible via facade.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/engine/systems/recipe-runner/index.ts` | Modify | Add EXPERT_PRESETS glob + createExpertRegistry() |
| `src/engine/systems/recipe-runner/facade.ts` | Modify | resolvePreset() optionally searches expert registry |
| `src/engine/systems/recipe-runner/__tests__/expert-registry.test.ts` | Create | Expert registry tests |

### Implementation

```ts
// index.ts — add expert preset loading
const expertPresetFiles = import.meta.glob(
  '/src/knowledge/recipes-runner/experts/*.preset.json',
  { eager: true, import: 'default' },
);
export const EXPERT_PRESETS: readonly PresetTemplate[] =
  Object.values(expertPresetFiles) as PresetTemplate[];

export function createExpertRegistry(): PresetRegistry {
  const registry = new PresetRegistry();
  registry.registerAll(EXPERT_PRESETS);
  return registry;
}
```

```ts
// facade.ts — extend resolvePreset to search expert registry
let _expertRegistry: PresetRegistry = createExpertRegistry();

export function resolvePreset(input: PresetInput): PresetTemplate | null {
  const registry = getHeroRegistry();
  // ... existing hero lookup ...
  // Fallback to expert registry
  if (input.presetId) return _expertRegistry.get(input.presetId) ?? null;
  if (input.gameType) {
    const matches = _expertRegistry.findByGameType(input.gameType);
    if (matches.length > 0) return matches[0];
  }
  return null;
}
```

### Test Strategy (4 tests)
- createExpertRegistry() loads expert presets
- resolvePreset() finds hero preset first (priority)
- resolvePreset() falls back to expert preset
- Expert presets tagged with 'expert-import'

### Size: S | Depends on: Step 3

---

## Step 5: Knowledge Cross-Links + Minimal Agent Hook

### Goal
Generate cross-link data and add expert preset info to system prompt.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/conversation-defs.ts` | Modify | Add expert preset summary to system prompt |
| `src/agent/__tests__/expert-preset-prompt.test.ts` | Create | System prompt includes expert info |

### System Prompt Addition

```
## 专家模板（实验性）
以下模板从 ${EXPERT_PRESETS.length} 款专业游戏中提取，可通过 use_preset 工具使用：
当用户描述的游戏类型匹配专家模板时，可推荐使用。
专家模板标记为 expert-import，质量因数据来源不同可能有差异。
```

### Test Strategy (2 tests)
- System prompt mentions expert presets when available
- EXPERT_PRESETS are tagged correctly

### Size: S | Depends on: Step 4

---

## Execution Order (TDD)

```
Step 1: Detector + Mapper + IR (RED → GREEN) — ~45min
Step 2: Synthesizer + Asset Extractor (RED → GREEN) — ~45min
Step 3: CLI + Validation (RED → GREEN) — ~30min
Step 4: Expert Registry Wiring (RED → GREEN) — ~20min
Step 5: Cross-links + Agent Hook (RED → GREEN) — ~15min
Build verification + full test run
```

### Estimated New Tests: ~25

---

## Deferred to M6 (Gemini recommendations)

| Feature | Rationale |
|---------|-----------|
| "Browse Expert Presets" panel/modal | Needs design iteration, M5 focuses on data pipeline |
| GameTypeSelector "Expert Available" badges | Requires EXPERT_PRESETS count per game type |
| "Featured Expert" rotating chip on landing | Needs curation logic |
| Expert metadata display (source, confidence, module count) | Needs PresetSuggestionBlock extension |

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| EH components without AIGE equivalents | Weak presets | Fall back to PRESETS defaults; store unmapped as setMeta tags |
| Variable expression mismatch ($position.x) | Broken substitution | VariableNormalizer collapses to vec2 objects |
| 3D game files (3D_Jump_Jump, etc.) | Not representable | Map to nearest 2D type or exclude; tag as 3d-source |
| Low confidence presets pollute recommendations | Bad UX | Confidence gate >= 0.6; separate registry |
| Large preset count slows import.meta.glob | Bundle size | Expert presets lazy-loaded or code-split |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d60c2-6aa4-7f41-b973-f0ef2d1fe705
- GEMINI_SESSION: (policy mode, no persistent session)
