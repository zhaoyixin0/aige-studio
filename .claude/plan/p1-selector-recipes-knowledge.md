# P1: GameTypeSelector + Recipe Knowledge + M5 Hero Recipes

> Synthesized from Codex (backend) + Gemini (frontend) dual-model analysis.

---

## Overview

3 tasks ordered by impact/effort ratio:
1. GameTypeSelector full wiring (S) — immediate UX win
2. Recipe card injection in system prompt (S) — agent quality
3. M5 Hero Recipes as PresetTemplate (M) — curated 8-10 playable templates

**Estimated 2-3 hours sequential.**

---

## Step 1: GameTypeSelector Full Wiring

### Goal
Vague intent handler shows all 38 game types (not hardcoded 10) with category/emoji/supportedToday.

### Analysis
- `GameTypeSelector` component ALREADY supports search, category tabs, progressive disclosure, "Coming Soon" badges
- Problem: callers pass hardcoded 10 types instead of full 38

### Implementation

#### 1a. Create shared options builder

```ts
// src/agent/game-type-options.ts (new, small utility)
import { ALL_GAME_TYPES, GAME_TYPE_META } from './game-presets';
import type { GameTypeOption } from '@/ui/chat/game-type-selector';

export function buildGameTypeOptions(): GameTypeOption[] {
  return ALL_GAME_TYPES
    .map((id) => {
      const meta = GAME_TYPE_META[id];
      return {
        id,
        name: meta.displayName,
        emoji: meta.emoji,
        category: meta.category,
        supportedToday: meta.supportedToday,
      };
    })
    // Supported types first, then alphabetical by category
    .sort((a, b) => {
      if (a.supportedToday !== b.supportedToday) return a.supportedToday ? -1 : 1;
      return (a.category ?? '').localeCompare(b.category ?? '');
    });
}
```

#### 1b. Wire in use-conversation-manager.ts

Replace hardcoded 10 types in vague intent handler (L134):
```ts
// Before: hardcoded array of 10 GameTypeOption objects
// After:
import { buildGameTypeOptions } from '@/agent/game-type-options';
assistantMsg.gameTypeOptions = buildGameTypeOptions();
```

#### 1c. Wire in conversation-agent.ts processWithoutApi

Replace hardcoded 8 typeChips in fallback (L732):
```ts
// Before: const typeChips: Chip[] = [...8 hardcoded...]
// After: map from GAME_TYPE_META, keep as Chip[]
const typeChips: Chip[] = ALL_GAME_TYPES
  .filter(id => GAME_TYPE_META[id].supportedToday !== false)
  .slice(0, 12)
  .map(id => ({
    id, label: GAME_TYPE_META[id].displayName,
    emoji: GAME_TYPE_META[id].emoji, type: 'game_type' as const,
  }));
```

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/game-type-options.ts` | Create | Shared options builder |
| `src/app/hooks/use-conversation-manager.ts` | Modify | Use buildGameTypeOptions() |
| `src/agent/conversation-agent.ts` | Modify | Dynamic typeChips from META |

### Test Strategy
- buildGameTypeOptions() returns 38 items
- All items have id, name, category
- Supported types appear before unsupported
- processWithoutApi returns chips from GAME_TYPE_META

### Size: S

---

## Step 2: Recipe Card Injection in System Prompt

### Goal
When a game type is selected, inject top 2-3 relevant recipe summaries into system prompt.

### Implementation (Codex authority)

#### 2a. Add loadRecipeCardSummaries to SkillLoader

```ts
// skill-loader.ts — new method
async loadRecipeCardSummaries(gameType: string, limit = 3): Promise<string[]> {
  const prefix = '/src/knowledge/cards/recipe/';
  const entries = Object.entries(expertCardFiles)
    .filter(([p]) => p.startsWith(prefix));

  const cards = await Promise.all(
    entries.map(async ([, loader]) => {
      try { return JSON.parse((await loader()) as string); }
      catch { return null; }
    }),
  );

  const terms = [gameType, ...gameType.split('-')].map(t => t.toLowerCase());
  const ranked = cards
    .filter(Boolean)
    .map((c: any) => ({
      c,
      score: terms.reduce((s, t) => s + (
        `${c.id} ${c.source} ${c.description}`.toLowerCase().includes(t) ? 1 : 0
      ), 0),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || String(a.c.id).localeCompare(String(b.c.id)))
    .slice(0, limit);

  return ranked.map(({ c }) =>
    `- ${c.id}: ${String(c.description ?? '').slice(0, 120)} (${c.stepCount} steps, ${c.complexity})`
  );
}
```

#### 2b. Inject in buildSystemPrompt

After expert card block:
```ts
if (gameType) {
  const recipeLines = await loader.loadRecipeCardSummaries(gameType, 3).catch(() => []);
  if (recipeLines.length > 0) {
    prompt += '\n\n## 相关配方参考\n' + recipeLines.join('\n');
    prompt += '\n\n当用户询问"怎么做"时，参考以上配方；使用 push_expert_insight 推送建议。';
  }
}
```

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/skill-loader.ts` | Modify | Add loadRecipeCardSummaries() |
| `src/agent/conversation-agent.ts` | Modify | Inject recipe block |
| `src/agent/__tests__/conversation-agent-knowledge.test.ts` | Modify | Test recipe injection |

### Test Strategy
- loadRecipeCardSummaries('shooting') returns ≤ 3 lines
- Each line ≤ 140 chars
- buildSystemPrompt('shooting', []) includes "相关配方参考"
- buildSystemPrompt(null, []) does NOT include recipe block

### Size: S

---

## Step 3: M5 Hero Recipes as PresetTemplate

### Goal
Curate 8-10 high-value recipes as RecipeRunner PresetTemplate, register in PresetRegistry.

### Strategy (Gemini authority: curate, not auto-convert)

Hand-author 8-10 hero recipes targeting the most popular/demonstrable game patterns.
Do NOT auto-convert all 28 M0 recipes — too many are EH-specific.

### Curated List

| Recipe ID | Game Pattern | Key Modules |
|-----------|-------------|-------------|
| `hero-catch-fruit` | Catch falling items | Spawner, Collision, Scorer, Timer, Lives |
| `hero-shooter-wave` | Wave-based shooter | WaveSpawner, Projectile, EnemyAI, Health |
| `hero-platformer-basic` | Platform jump & collect | Gravity, Jump, StaticPlatform, Collectible |
| `hero-whack-a-mole` | Tap popping targets | Spawner, Collision, Scorer, Tween |
| `hero-slingshot-launch` | Drag-release physics | Aim, Projectile, Gravity, Collision |
| `hero-match-pairs` | Card memory matching | MatchEngine(pairs), Tween, Scorer |
| `hero-endless-runner` | Side-scrolling dodge | Runner, Spawner, Collision, DifficultyRamp |
| `hero-quiz-challenge` | Timed Q&A | QuizEngine, Timer, Scorer |

### Implementation

Each hero recipe is a `PresetTemplate` JSON file in `src/knowledge/recipes-runner/`:

```ts
// Example: hero-catch-fruit.preset.json
{
  "id": "hero-catch-fruit",
  "title": "经典接水果",
  "description": "从天而降的水果接住得分，混合好坏物品",
  "gameType": "catch",
  "tags": ["casual", "beginner", "spawner"],
  "params": [
    { "name": "duration", "type": "number", "default": 30, "min": 10, "max": 120 },
    { "name": "spawnRate", "type": "number", "default": 1.5, "min": 0.5, "max": 3 }
  ],
  "sequence": {
    "id": "hero-catch-fruit",
    "commands": [
      { "name": "addModule", "args": { "type": "GameFlow" } },
      { "name": "addModule", "args": { "type": "Spawner" } },
      { "name": "setParam", "args": { "target": "Spawner", "path": "frequency", "value": "$spawnRate" } },
      { "name": "addModule", "args": { "type": "Collision" } },
      { "name": "addModule", "args": { "type": "Scorer" } },
      { "name": "addModule", "args": { "type": "Timer" } },
      { "name": "setParam", "args": { "target": "Timer", "path": "duration", "value": "$duration" } },
      { "name": "addModule", "args": { "type": "Lives" } },
      { "name": "addModule", "args": { "type": "UIOverlay" } },
      { "name": "addModule", "args": { "type": "ResultScreen" } }
    ]
  },
  "requiredModules": ["GameFlow", "Spawner", "Collision", "Scorer", "Timer", "Lives"]
}
```

### Registration

Load hero presets into PresetRegistry at startup:
```ts
// src/engine/systems/recipe-runner/preset-registry.ts — modify
import heroPresets from '@/knowledge/recipes-runner/*.preset.json'; // glob
for (const preset of heroPresets) registry.register(preset);
```

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/knowledge/recipes-runner/*.preset.json` | Create (8-10 files) | Hero recipe PresetTemplates |
| `src/engine/systems/recipe-runner/preset-registry.ts` | Modify | Load hero presets |
| `src/engine/systems/recipe-runner/__tests__/hero-presets.test.ts` | Create | Validate all hero presets |

### Test Strategy
- Each hero preset passes PresetRegistry validation
- Executor produces valid GameConfig from each hero preset
- All required modules present after execution
- Determinism: same inputs → same config

### Size: M

---

## Execution Order

```
Phase 1 (sequential):
  Step 1: GameTypeSelector wiring (S) — immediate UX win
  Step 2: Recipe card injection (S)
  Step 3: M5 Hero Recipes (M)

Phase 2:
  Build verification
  Full test suite
```

### SESSION_ID
- CODEX_SESSION: 019d5c79-70a5-72e1-b0d9-044ffa57283a
- GEMINI_SESSION: (policy mode, no persistent session)
