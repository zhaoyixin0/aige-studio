# P0 Runtime Wiring — Execution Plan

> Synthesized from Codex (backend) + Gemini (frontend) dual-model analysis.
> Bridges M0 build-time pipeline → runtime consumption.

---

## Overview

M0-M4 code is complete and tested (2661 tests). But the knowledge artifacts
exist only in-memory (tools/m0/) — nothing is written to src/knowledge/, and
runtime doesn't consume expert data. This plan closes the gap.

**5 tasks, ~8 TDD steps, estimated 3-4 hours sequential.**

---

## Dependency Graph

```
A1 (build:knowledge CLI)
 ├── A2 (overlay loader/merger) ── A4 (Apply Expert Tuning button)
 └── (optional: SkillLoader card path)

A5 (runtime feel scorer + sync hook) ── independent

C4 (push_expert_insight tool) ── independent
```

**Parallel tracks:** A1→A2→A4 | A5 | C4

---

## Step 1: A1 — Knowledge Artifact Writers

### Goal
CLI script runs full M0 pipeline, writes JSON artifacts to `src/knowledge/`.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `tools/m0/cli/build-knowledge.ts` | Create | CLI entry point |
| `tools/m0/__tests__/12-build-knowledge.test.ts` | Create | Artifact smoke + determinism |
| `package.json` | Modify | Add `"build:knowledge"` script |

### Output Artifacts
```
src/knowledge/
  overlays/
    presets.overlay.json          — per-gameType expert calibrations
  cards/
    game-type/*.card.json         — 38 game type knowledge cards
    recipe/*.card.json            — ~30 recipe cards
  index/
    expert-knowledge.index.json   — master index with SHA-256 hashes
```

### Implementation (Codex authority)

```ts
// tools/m0/cli/build-knowledge.ts
// Reuses all existing tools/m0 exports:
import { loadInventory, normalizeAll, extractAllParams,
         calibrateAll, buildPresetOverlays, loadTaxonomy,
         generateGameTypeCards, generateRecipeCards, buildRecipes } from '../index';

// 1) Load inventory from expert-data/json/
// 2) Normalize → extract params → calibrate
// 3) Generate overlays, cards, recipes
// 4) Write to src/knowledge/ with stableStringify (sorted keys)
// 5) Build index with SHA-256 content hashes

// Deterministic: stableStringify = JSON.stringify(obj, sortedKeys, 2)
// Idempotent: same input → byte-identical output
```

### Test Strategy
- Run CLI to temp dir, assert: 38 game-type cards, ≥20 recipe cards, overlay is valid JSON array
- Run twice, verify byte-equal outputs (determinism)
- Index hash count matches file count

### Size: M

---

## Step 2: A2 — Runtime Overlay Loader/Merger

### Goal
Load `presets.overlay.json` at startup, immutably merge into PRESETS.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/preset-overlays.ts` | Create | Pure merge helpers + JSON import |
| `src/agent/game-presets.ts` | Modify | getGamePreset calls overlay-aware getter |
| `src/agent/__tests__/overlay-merge.test.ts` | Create | Merge correctness + immutability |

### Key Interface (Codex authority)

```ts
// src/agent/preset-overlays.ts
export interface OverlayParam {
  readonly value: unknown;
  readonly confidence: number;
}
export interface OverlayEntry {
  readonly gameType: string;
  readonly source: string;
  readonly params: Record<string, Record<string, OverlayParam>>;
}

// Static import (Vite resolveJsonModule)
import rawOverlays from '@/knowledge/overlays/presets.overlay.json';

export function mergePresetWithOverlay(
  base: GamePreset,
  gameType: string,
): GamePreset;
// - structuredClone(base) for immutability
// - Only apply when confidence >= 0.6
// - Returns new object, never mutates PRESETS
```

### Modify game-presets.ts (minimal change)

```ts
// In getGamePreset():
// Before: return PRESETS[gameType as GameType];
// After:
import { applyOverlay } from './preset-overlays';
const base = PRESETS[gameType as GameType];
return base ? applyOverlay(base, gameType) : undefined;
```

### Test Strategy
- overlay confidence=0.7 → param overridden
- overlay confidence=0.5 → base value preserved
- original PRESETS object not mutated (reference check)

### Size: M | Depends on: A1

---

## Step 3: A4 — "Apply Expert Tuning" Button Wiring

### Goal
Wire the TODO onApply in message-list.tsx to actually apply parameter changes.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/message-list.tsx` | Modify | Implement onApply handler |

### Implementation (Gemini authority)

```ts
// In MessageList component:
const config = useGameStore(s => s.config);
const batchUpdateParams = useGameStore(s => s.batchUpdateParams);

const handleApplyTuning = useCallback((tuning: ModuleTuningPayload) => {
  if (!config) return;
  const updates: Array<{ moduleId: string; changes: Record<string, unknown> }> = [];

  for (const mod of tuning.modules) {
    // Match by type name (LLM outputs type names, not instance IDs)
    const target = config.modules.find(m =>
      m.type.toLowerCase() === mod.name.toLowerCase()
    );
    if (!target) continue;

    const changes: Record<string, unknown> = {};
    for (const p of mod.params) {
      changes[p.name] = typeof p.value === 'string' && !isNaN(Number(p.value))
        ? Number(p.value)
        : p.value;
    }
    updates.push({ moduleId: target.id, changes });
  }

  if (updates.length > 0) batchUpdateParams(updates);
}, [config, batchUpdateParams]);
```

### Edge Cases
- Module name mismatch (LLM returns Chinese name) → fallback: skip with warning
- String→Number coercion for numeric params
- Empty modules array → no-op

### Test Strategy
- Mock config with known modules, fire onApply, assert batchUpdateParams called with correct IDs

### Size: S | Depends on: existing ModuleCombinationCard

---

## Step 4: A5 — Runtime Game Feel Scorer

### Goal
Compute Game Feel score from live GameConfig, update Zustand, show in UI.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/engine/diagnostics/game-feel-scorer.ts` | Create | Score calculator (Codex authority) |
| `src/hooks/use-game-feel-sync.ts` | Create | React hook for state sync (Gemini authority) |
| `src/ui/editor/editor-panel.tsx` | Modify | Mount hook + wire suggestion onApply |
| `src/store/editor-store.ts` | Modify | Extend GameFeelSuggestion with payload |
| `src/engine/diagnostics/__tests__/game-feel-scorer.test.ts` | Create | Score tests |

### Backend: Scorer (Codex authority)

```ts
// src/engine/diagnostics/game-feel-scorer.ts
export interface FeelScoreResult {
  readonly total: number;                          // 0-100
  readonly dimensions: Readonly<Record<string, number>>;
  readonly badge: 'bronze' | 'silver' | 'gold' | 'expert' | null;
  readonly suggestions: ReadonlyArray<FeelSuggestion>;
}

export interface FeelSuggestion {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly delta: number;
  readonly payload?: ReadonlyArray<{ moduleType: string; params: Record<string, unknown> }>;
}

// 8 dimensions: Responsiveness, MotionFidelity, CollisionFairness,
// Timing, FeedbackRichness, DifficultyRamp, Consistency, UIClarity
// Weighted sigmoid scoring, derive signals from module presence + params
// Badge: null(<40), bronze(40+), silver(60+), gold(80+), expert(90+)

export function computeFeelScore(config: GameConfig): FeelScoreResult;
```

### Frontend: Sync Hook (Gemini authority)

```ts
// src/hooks/use-game-feel-sync.ts
export function useGameFeelSync(): void {
  const config = useGameStore(s => s.config);
  const setGameFeel = useEditorStore(s => s.setGameFeel);

  useEffect(() => {
    if (!config) return;
    // Debounce: requestIdleCallback or 300ms debounce
    const id = requestIdleCallback(() => {
      const result = computeFeelScore(config);
      setGameFeel({
        score: result.total,
        dimensions: result.dimensions,
        suggestions: result.suggestions,
        badge: result.badge,
      });
    });
    return () => cancelIdleCallback(id);
  }, [config, setGameFeel]);
}
```

### EditorPanel: Suggestion Apply (Gemini authority)

```ts
const handleApplySuggestion = (id: string) => {
  const suggestion = gameFeel.suggestions.find(s => s.id === id);
  if (suggestion?.payload) {
    // Map moduleType → add module or update params
    // e.g., "Add ParticleVFX" → addModule to config
  }
};
```

### Test Strategy
- Empty config → score near 0, badge null
- Config with 8+ modules including ParticleVFX/SoundFX → score > 60
- Badge thresholds: 39→null, 40→bronze, 60→silver, 80→gold, 90→expert
- Determinism: same config → same score

### Size: M (scorer) + S (hook) | Independent of A1/A2

---

## Step 5: C4 — ConversationAgent Expert Tool

### Goal
Enable LLM to push expert insights and module tuning payloads into chat.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/conversation-defs.ts` | Modify | Add push_expert_insight tool schema |
| `src/agent/conversation-agent.ts` | Modify | Handle tool result → ChatMessage fields |
| `src/agent/__tests__/conversation-expert-tool.test.ts` | Create | Tool schema + handler test |

### Tool Schema (Codex authority)

```ts
{
  name: 'push_expert_insight',
  description: '推送专家洞见与参数调优建议到聊天界面',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '洞见标题' },
      body: { type: 'string', description: '详细说明' },
      modules: {
        type: 'array',
        description: '推荐的模块参数调整',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            params: { type: 'array', items: {
              type: 'object',
              properties: { name: { type: 'string' }, value: {} },
              required: ['name', 'value']
            }}
          },
          required: ['name', 'params']
        }
      }
    },
    required: ['title']
  }
}
```

### Agent Handler (Gemini authority)

```ts
// conversation-agent.ts, in tool result switch:
case 'push_expert_insight': {
  const input = toolResult.input as PushExpertInsightInput;
  // Set on the assistant ChatMessage being built:
  assistantMsg.expertInsight = input.body
    ? { title: input.title, body: input.body }
    : undefined;
  assistantMsg.moduleTuning = input.modules?.length
    ? { title: input.title, modules: input.modules }
    : undefined;
  break;
}
```

### Data Flow
```
User asks "优化射击游戏手感" →
  Claude calls push_expert_insight(title, body, modules) →
    Agent parses → sets expertInsight/moduleTuning on ChatMessage →
      MessageList renders ExpertInsightBlock + ModuleCombinationCard →
        User clicks "应用专家调参" → A4 handler fires
```

### Test Strategy
- Tool present in TOOLS array
- Simulated tool result → ChatMessage has expertInsight and moduleTuning fields

### Size: S | Independent

---

## Bonus: A9-partial — Suggestion Chips Update

### Files
| File | Operation |
|------|-----------|
| `src/store/editor-store.ts` | Modify DEFAULT_CHIPS (add 4 representative new types) |
| `src/agent/conversation-agent.ts` | Modify typeChips fallback array |

### Size: S | Independent

---

## Execution Order (TDD)

```
Phase 1 (parallel):
  Track A: A1 (build:knowledge CLI) → A2 (overlay merger) → A4 (Apply button)
  Track B: A5 (feel scorer + sync hook)
  Track C: C4 (expert tool)

Phase 2:
  A9-partial (chips update)
  Build verification (npm run build)
```

### SESSION_ID
- CODEX_SESSION: 019d5c79-70a5-72e1-b0d9-044ffa57283a
- GEMINI_SESSION: (policy mode, no persistent session)
