# M4 Recipe Runner — Integration Completion Plan

> Synthesized from Codex (backend) + Gemini (frontend) dual-model analysis.
> Core system already complete: RecipeExecutor + PresetRegistry + 8 Hero Presets + 91 tests.

---

## Overview

M4 core engine is done. This plan closes the **integration gap**: wiring the Recipe Runner into ConversationAgent and the conversational UI.

**4 tasks, ~6 TDD steps, estimated 2-3 hours sequential.**

---

## Task Type
- [x] Backend (Codex authority)
- [x] Frontend (Gemini authority)
- [x] Fullstack (Parallel)

---

## Dependency Graph

```
Step 1 (Facade) ──┬── Step 2 (use_preset tool)
                  └── Step 3 (Preset UI blocks)
                        └── Step 4 (Landing chips + system prompt)
```

---

## Step 1: Recipe Facade — `runPresetToConfig()`

### Goal
Single entry point bridging PresetRegistry → RecipeExecutor → GameConfig output.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/engine/systems/recipe-runner/facade.ts` | Create | Facade: resolve preset + execute + extract pending assets |
| `src/engine/systems/recipe-runner/__tests__/facade.test.ts` | Create | Unit tests for facade |

### Implementation (Codex authority)

```ts
// src/engine/systems/recipe-runner/facade.ts

import { createHeroRegistry, RecipeExecutor } from './index';
import type { PresetRegistry } from './preset-registry';
import type { PresetTemplate } from './types';
import type { GameConfig } from '../../core/types';

// Memoized registry
let _registry: PresetRegistry | null = null;
function getHeroRegistry(): PresetRegistry {
  if (!_registry) _registry = createHeroRegistry();
  return _registry;
}

export interface PresetInput {
  readonly presetId?: string;
  readonly gameType?: string;
  readonly tags?: readonly string[];
  readonly params?: Record<string, unknown>;
}

export interface PresetResult {
  readonly config: GameConfig;
  readonly presetId: string;
  readonly pendingAssets: readonly string[]; // assetIds with empty src
}

export function resolvePreset(input: PresetInput): PresetTemplate | null {
  const registry = getHeroRegistry();
  if (input.presetId) return registry.getById(input.presetId) ?? null;
  if (input.gameType) {
    const matches = registry.findByGameType(input.gameType);
    if (matches.length > 0) return matches[0];
  }
  if (input.tags?.length) {
    const matches = registry.findByTags([...input.tags]);
    if (matches.length > 0) return matches[0];
  }
  return null;
}

export function runPresetToConfig(
  input: PresetInput,
  baseConfig: GameConfig,
): PresetResult {
  const preset = resolvePreset(input);
  if (!preset) throw new Error(`No preset found for: ${JSON.stringify(input)}`);

  // Build variables from preset defaults + user overrides
  const variables: Record<string, unknown> = {};
  for (const p of preset.params) {
    variables[p.name] = p.default;
  }
  if (input.params) {
    Object.assign(variables, input.params);
  }

  const result = RecipeExecutor.execute(preset.sequence, baseConfig, variables);
  if (!result.success) {
    throw new Error(`Preset execution failed: ${result.error}`);
  }

  // Extract assets with empty src
  const pendingAssets = Object.entries(result.config.assets)
    .filter(([, entry]) => !entry.src)
    .map(([id]) => id);

  return {
    config: result.config,
    presetId: preset.id,
    pendingAssets,
  };
}

// For testing: reset memoized registry
export function _resetRegistry(): void {
  _registry = null;
}
```

### Test Strategy
- resolvePreset({ presetId: 'hero-catch-fruit' }) returns correct preset
- resolvePreset({ gameType: 'catch' }) returns catch preset
- resolvePreset({ presetId: 'nonexistent' }) returns null
- runPresetToConfig() returns valid GameConfig with modules
- runPresetToConfig() does not mutate baseConfig (immutability)
- runPresetToConfig() collects pendingAssets for empty-src assets
- runPresetToConfig() applies param overrides correctly
- runPresetToConfig() throws on missing preset

### Size: S

---

## Step 2: ConversationAgent `use_preset` Tool

### Goal
New Claude tool_use tool that lets LLM select a preset + provide param overrides.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/conversation-defs.ts` | Modify | Add use_preset tool schema |
| `src/agent/conversation-agent.ts` | Modify | Handle use_preset tool result → build config via facade |
| `src/agent/__tests__/use-preset-tool.test.ts` | Create | Tool schema + handler tests |

### Tool Schema (Codex authority)

```ts
{
  name: 'use_preset',
  description: '使用预设模板快速创建游戏。当用户提到"模板"、"快速开始"或匹配已有预设时使用。',
  input_schema: {
    type: 'object',
    properties: {
      preset_id: {
        type: 'string',
        description: '预设模板 ID，如 hero-catch-fruit、hero-shooter-wave 等',
        enum: ['hero-catch-fruit', 'hero-shooter-wave', 'hero-platformer-basic',
               'hero-whack-a-mole', 'hero-slingshot-launch', 'hero-match-pairs',
               'hero-endless-runner', 'hero-quiz-challenge']
      },
      params: {
        type: 'object',
        description: '参数覆盖（可选）。键为参数名，值为用户指定的值。',
        additionalProperties: true
      },
      game_type: {
        type: 'string',
        description: '游戏类型（可选）。若未提供 preset_id，根据类型匹配最佳预设。'
      }
    },
    required: ['preset_id']
  }
}
```

### Handler (Codex authority)

```ts
// In conversation-agent.ts, tool result switch:
case 'use_preset': {
  const { preset_id, params, game_type } = toolInput;
  const baseConfig = buildBaseConfig(game_type ?? 'catch', theme, artStyle);
  const { config, presetId, pendingAssets } = runPresetToConfig(
    { presetId: preset_id, params, gameType: game_type },
    baseConfig,
  );
  // Trigger asset generation for pending assets (reuse existing pipeline)
  gameConfig = config;
  assistantMsg.text = `已使用模板「${presetId}」创建游戏`;
  if (pendingAssets.length > 0) {
    assistantMsg.text += `，${pendingAssets.length} 个素材待生成`;
  }
  break;
}
```

### System Prompt Addition

```
## 可用游戏模板
以下预设模板可通过 use_preset 工具快速创建游戏：
- hero-catch-fruit: 经典接水果（接住得分）
- hero-shooter-wave: 太空射击（波次射击）
- hero-platformer-basic: 平台跳跃（跳跃收集）
- hero-whack-a-mole: 打地鼠（点击消灭）
- hero-slingshot-launch: 弹弓发射（拖放物理）
- hero-match-pairs: 记忆配对（翻牌匹配）
- hero-endless-runner: 无尽跑酷（横向闪避）
- hero-quiz-challenge: 答题挑战（限时问答）

当用户意图明确匹配以上模板时，优先使用 use_preset 而非 create_game。
```

### Test Strategy
- use_preset tool present in TOOLS array
- Tool schema has preset_id (required) + params (optional)
- Handler calls runPresetToConfig with correct args
- Handler returns valid GameConfig
- Backward compat: create_game still works unchanged

### Size: M | Depends on: Step 1

---

## Step 3: Preset UI Blocks in Chat

### Goal
Render preset suggestions and execution feedback in conversational chat.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/preset-suggestion-block.tsx` | Create | Chat block showing matched presets |
| `src/ui/chat/message-list.tsx` | Modify | Render preset blocks for use_preset results |
| `src/ui/chat/__tests__/preset-suggestion-block.test.tsx` | Create | UI tests |

### Implementation (Gemini authority)

#### PresetSuggestionBlock

```tsx
// Shows after use_preset execution — confirms which template was used
interface PresetSuggestionBlockProps {
  readonly presetId: string;
  readonly title: string;
  readonly pendingAssets: number;
}

function PresetSuggestionBlock({ presetId, title, pendingAssets }: Props) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 mt-2">
      <div className="text-sm font-medium text-blue-800">
        基于模板创建
      </div>
      <div className="text-sm text-blue-600 mt-1">
        {title}
      </div>
      {pendingAssets > 0 && (
        <div className="text-xs text-blue-400 mt-1">
          {pendingAssets} 个素材待生成
        </div>
      )}
    </div>
  );
}
```

#### MessageList Integration

```tsx
// In MessageBubble, after moduleTuning block:
{!isUser && message.presetUsed && (
  <PresetSuggestionBlock
    presetId={message.presetUsed.presetId}
    title={message.presetUsed.title}
    pendingAssets={message.presetUsed.pendingAssets}
  />
)}
```

### ChatMessage Extension

Add to ChatMessage type:
```ts
presetUsed?: {
  presetId: string;
  title: string;
  pendingAssets: number;
};
```

### Test Strategy
- PresetSuggestionBlock renders title and pending assets count
- PresetSuggestionBlock renders nothing when not provided
- MessageBubble renders block when message.presetUsed is set

### Size: S | Depends on: Step 2

---

## Step 4: Landing Chips + System Prompt Sync

### Goal
Surface preset templates as "Quick Start" chips on landing page.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/store/editor-store.ts` | Modify | Add preset chips to DEFAULT_CHIPS |
| `src/agent/conversation-agent.ts` | Modify | Add preset info to system prompt |
| `src/agent/__tests__/preset-chips.test.ts` | Create | Verify chips + prompt content |

### Implementation (Gemini authority)

#### Preset Chips

Add 3-4 preset chips after game type chips:
```ts
// In DEFAULT_CHIPS array:
{ id: 'preset:hero-catch-fruit', label: '快速开始：接水果', type: 'preset' as const },
{ id: 'preset:hero-shooter-wave', label: '快速开始：射击', type: 'preset' as const },
{ id: 'preset:hero-platformer-basic', label: '快速开始：平台跳跃', type: 'preset' as const },
```

#### Chip Handler

In use-conversation-manager.ts, detect `preset:` prefix:
```ts
if (chipId.startsWith('preset:')) {
  const presetId = chipId.replace('preset:', '');
  // Send as user message: "使用模板 hero-catch-fruit"
  // Agent will recognize and call use_preset tool
}
```

### Test Strategy
- DEFAULT_CHIPS includes preset-type chips
- All preset chip IDs reference valid hero preset IDs
- System prompt includes preset template list

### Size: S | Depends on: Step 2

---

## Execution Order (TDD)

```
Step 1: Facade (RED → GREEN) — ~30min
Step 2: use_preset tool (RED → GREEN) — ~45min
Step 3: UI blocks (RED → GREEN) — ~30min
Step 4: Chips + prompt (RED → GREEN) — ~20min
Build verification
```

### Estimated New Tests: ~20-25

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Facade breaks existing RecipeExecutor tests | Medium | Facade is additive; does not modify executor internals |
| use_preset conflicts with create_game | Low | Separate tool, no shared state |
| LLM ignores use_preset for matching intents | Medium | System prompt explicitly instructs preference |
| Preset chips confuse users unfamiliar with templates | Low | Label as "快速开始" for clarity |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d6053-ac95-7713-9076-38a40749f334
- GEMINI_SESSION: (policy mode, no persistent session)
