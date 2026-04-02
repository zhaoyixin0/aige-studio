# Interaction Redesign: P0→P3 Implementation Plan

Inspired by Effect House Figma designs. Multi-model validated (Codex + Gemini).

## Overview

| Priority | Feature | New Files | Modified Files |
|----------|---------|-----------|---------------|
| P0 | Interactive Parameter Cards in Chat | `param-card.tsx` | `conversation-defs.ts`, `editor-store.ts`, `studio-chat-panel.tsx`, `schema-renderer.tsx`, `conversation-agent.ts`, `game-store.ts`, `preview-canvas.tsx` |
| P1 | Three-View Layout | `chat-preview-page.tsx`, `sandbox-page.tsx` | `editor-store.ts`, `main-layout.tsx`, `landing-page.tsx` |
| P2 | Context-Aware Suggestions | `suggestion-engine.ts` | `conversation-agent.ts`, `suggestion-chips.tsx`, `studio-chat-panel.tsx` |
| P3 | Intent Extraction Layer | `intent-extractor.ts` | `conversation-agent.ts`, `landing-page.tsx` |

Each P level is independently shippable. All changes are additive (no breaking changes).

---

## P0: Interactive Parameter Cards in Chat

### Goal
Replace text-only bot responses with structured "game setting cards" containing dropdowns, sliders, and emoji selectors. User adjustments update the live preview immediately.

### Type Changes (`conversation-defs.ts`)

```typescript
export type ParamCardField =
  | { kind: 'select'; label: string; options: string[]; value?: string }
  | { kind: 'slider'; label: string; min: number; max: number; step?: number; value?: number; unit?: string }
  | { kind: 'emoji'; label: string; options: string[]; value?: string }
  | { kind: 'toggle'; label: string; value?: boolean };

export interface ParamCardSchema {
  title?: string;
  fields: ParamCardField[];
}

// Extend existing ChatMessage (additive)
export interface ChatMessage {
  // ... existing fields
  paramCard?: ParamCardSchema;
}
```

### Store Changes (`editor-store.ts`)

```typescript
// Add action to update config from param card (debounced → preview)
updateGameConfigFromCard: (changes: Array<{moduleType: string; param: string; value: unknown}>) => void;
```

### New Component (`src/ui/chat/param-card.tsx`)

```tsx
function ParamCard({ schema, onChange }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      {schema.title && <div className="text-sm font-medium mb-2">{schema.title}</div>}
      {schema.fields.map(field => {
        switch (field.kind) {
          case 'select': return <SelectField ... />;
          case 'slider': return <SliderField ... />;
          case 'emoji': return <EmojiField ... />;
          case 'toggle': return <ToggleField ... />;
        }
      })}
    </div>
  );
}
```

Reuse SchemaRenderer's existing controls via `context="chat"` prop (compact spacing).

### Agent Changes (`conversation-agent.ts`)

Add helper `mapConfigToParamCard(config, gameType)` that generates a ParamCardSchema from the created config, exposing only user-friendly knobs:
- Mode (game flow type)
- Duration (timer)
- Difficulty (mapped to DifficultyRamp params)
- Operation (input method)

### Chat Render (`studio-chat-panel.tsx`)

```tsx
{message.paramCard && (
  <ParamCard
    schema={message.paramCard}
    onChange={(changes) => store.updateGameConfigFromCard(changes)}
  />
)}
```

### Parameter Hot-Update Path (Engine-Level)

ParamCard sliders need live updates without full engine reload. Pattern follows existing asset hot-swap design.

**`game-store.ts`** — Add `updateModuleParamLive()`:
```typescript
updateModuleParamLive: (moduleId: string, param: string, value: unknown) => {
  // 1. Update persisted config WITHOUT incrementing configVersion
  set((state) => ({
    config: state.config ? {
      ...state.config,
      modules: state.config.modules.map((m) =>
        m.id === moduleId ? { ...m, params: { ...m.params, [param]: value } } : m,
      ),
    } : state.config,
    // NOTE: configVersion NOT incremented — no engine reload
  }));

  // 2. Push value to running engine module via configure()
  const engine = window.__engine;  // or via ref from use-engine hook
  if (engine) {
    const mod = engine.getModule(moduleId);
    if (mod) {
      mod.configure({ [param]: value });
    }
  }
}
```

**Structural key handling**: Params that affect event subscriptions (e.g., keys ending with `Event`, `hitEvent`, `damageEvent`) cannot be hot-updated because modules bind listeners in `init()` and `configure()` doesn't rebind them. These keys must trigger a targeted module reload:
```typescript
const STRUCTURAL_KEYS = new Set(['hitEvent', 'damageEvent', 'activateEvent', 'shakeEvent', 'toggleEvent', 'continuousEvent']);

if (STRUCTURAL_KEYS.has(param)) {
  // Fall back to full configVersion bump for this module
  // This triggers engine reload which rebinds event listeners
  get().updateModuleParam(moduleId, param, value); // existing path with configVersion++
} else {
  // Safe for hot-update via configure()
  // ... live path above
}
```

**Why this works**: `mod.configure()` updates the module's internal `params` object. Most modules read `this.params.*` each `update()` tick (speed, duration, followSpeed, etc.), so changes take effect next frame. For structural params that affect event bindings, we fall back to the existing reload path.

**Debounce**: ParamCard slider `onChange` throttled at 50ms (leading edge: `configure()` immediately; trailing edge: persist to store). On `pointerUp`, run final reconciliation.

### P2 Contract Integration (Bonus)

The ContractRegistry from Phase 6 can power dynamic suggestions:
```typescript
// In suggestion-engine.ts:
import { ContractRegistry } from '@/engine/core/contract-registry';

function getContractBasedSuggestions(config: GameConfig, contracts: ContractRegistry): Chip[] {
  const enabledModules = config.modules.filter(m => m.enabled !== false);
  const emitsPool = new Set<string>();
  for (const m of enabledModules) {
    for (const e of contracts.getEmits(m.type)) emitsPool.add(e);
  }
  
  const suggestions: Chip[] = [];
  for (const m of enabledModules) {
    for (const event of contracts.getConsumes(m.type)) {
      if (!emitsPool.has(event) && event !== 'gameflow:resume' && event !== 'gameflow:pause') {
        // Find which module type emits this event
        for (const type of contracts.getKnownTypes()) {
          if (contracts.getEmits(type).includes(event)) {
            suggestions.push({ id: `add-${type}`, label: `添加 ${type} 以提供 ${event}`, emoji: '🔗' });
            break;
          }
        }
      }
    }
  }
  return suggestions;
}
```

This gives users actionable suggestions like "添加 Collision 以提供 collision:hit" when Scorer is present but Collision is missing.

### Build Order
1. Types in `conversation-defs.ts`
2. Store actions in `editor-store.ts` + `game-store.ts` (including `updateModuleParamLive`)
3. `ParamCard` component
4. Chat render integration
5. Agent `mapConfigToParamCard` helper
6. Preview hot-update path in `preview-canvas.tsx`
7. Debounced preview sync

---

## P1: Three-View Layout

### Goal
Landing → Chat+Preview → Sandbox, with navigation between views.

### State Change (`editor-store.ts`)

```typescript
type LayoutPhase = 'landing' | 'chatPreview' | 'sandbox';
// Backward compat: 'studio' maps to 'chatPreview'
```

### Layout (`main-layout.tsx`)

```tsx
function MainLayout() {
  const phase = useEditorStore(s => s.layoutPhase);
  return (
    <div className="flex h-dvh flex-col">
      {phase !== 'landing' && <TopBar />}
      {phase === 'landing' && <LandingPage />}
      {phase === 'chatPreview' && <ChatPreviewPage />}
      {phase === 'sandbox' && <SandboxPage />}
    </div>
  );
}
```

### New Pages

**ChatPreviewPage** (`src/ui/pages/chat-preview-page.tsx`):
- Left: StudioChatPanel (resizable)
- Right: PreviewCanvas + optional timeline
- Extracted from current `main-layout.tsx` studio branch

**SandboxPage** (`src/ui/pages/sandbox-page.tsx`):
- Left: Objects panel (ModuleList + AssetBrowser merged)
- Center: PreviewCanvas (larger)
- Right: Chat copilot (narrower)

### Landing Enhancement

Add template cards (game type gallery with preview images + tags like "Trending", "Easy to edit") above the existing input. Clicking a card seeds `gameType` and transitions to `chatPreview`.

### Build Order
1. Store `LayoutPhase` union + setter
2. Extract `ChatPreviewPage` from existing studio layout
3. `MainLayout` phase switcher + TopBar
4. `SandboxPage` skeleton
5. Landing template cards

---

## P2: Context-Aware Suggestions

### Goal
Suggestions specific to game type and current config state, not generic module names.

### New File (`src/agent/suggestion-engine.ts`)

```typescript
const GAME_SUGGESTIONS: Record<string, Array<(cfg: GameConfig) => Chip | null>> = {
  catch: [
    () => ({ id: 'drop-speed', label: '调整掉落速度', emoji: '⬇️' }),
    () => ({ id: 'player-size', label: '调整玩家大小', emoji: '📏' }),
    () => ({ id: 'theme', label: '更换主题风格', emoji: '🎨' }),
    (cfg) => cfg.modules.some(m => m.type === 'DifficultyRamp')
      ? null
      : ({ id: 'add-difficulty', label: '添加难度递增', emoji: '📈' }),
  ],
  racing: [
    () => ({ id: 'obstacles', label: '调整障碍车辆数量', emoji: '🔢' }),
    () => ({ id: 'speed', label: '调整行驶速度', emoji: '🚅' }),
    () => ({ id: 'lanes', label: '调整车道数量', emoji: '🔢' }),
    () => ({ id: 'bg-style', label: '调整背景风格', emoji: '🖼️' }),
  ],
  // ... other 14 game types
};

export function getSuggestions(gameType: string, config: GameConfig): Chip[] {
  const rules = GAME_SUGGESTIONS[gameType] ?? GAME_SUGGESTIONS['_default'];
  return rules.map(r => r(config)).filter(Boolean) as Chip[];
}
```

### Integration
- `conversation-agent.ts`: Replace `ALL_MODULE_SUGGESTIONS` usage with `getSuggestions(gameType, config, contracts)`
- `suggestion-chips.tsx`: Add optional `category` prop for colored chips (tweak=blue, add=green, help=gray)
- **DI pattern**: `getSuggestions` accepts optional `ContractRegistry` parameter (injected by agent from its cached instance). No top-level module instantiation — avoids circular imports and bundle weight.
- **Backward compat**: Re-export `generateSuggestions` from agent with same signature, delegating to `suggestion-engine.ts` internally. Existing tests continue to work.

### Build Order
1. `suggestion-engine.ts` with rules for all 16 game types
2. Agent integration
3. Chip component enhancement (optional categories)

---

## P3: Intent Extraction Layer

### Goal
Deterministic pre-processing before Claude tool_use. Three levels of user intent.

### New File (`src/agent/intent-extractor.ts`)

**NOTE**: Move existing `KEYWORD_MAP` and `detectGameTypeFromMessage` from `conversation-defs.ts` INTO this file. Re-export from `conversation-defs.ts` for backward compatibility. This avoids duplication.

```typescript
export type IntentLevel = 1 | 2 | 3;

export interface ParsedIntent {
  level: IntentLevel;
  gameType?: string;
  params?: Record<string, unknown>;
}

// Moved from conversation-defs.ts (single source of truth)
export const TYPE_KEYWORDS: Record<string, string[]> = {
  catch: ['接住', '抓', '捕捉', '接水果', 'catch'],
  racing: ['赛车', '竞速', '飙车', 'racing'],
  dodge: ['躲避', '闪避', 'dodge'],
  platformer: ['跳台', '平台', '马里奥', 'platformer'],
  // ... all 16 types (migrated from KEYWORD_MAP)
};

export function extractIntent(input: string): ParsedIntent {
  const text = input.trim();
  const gameType = detectGameType(text, TYPE_KEYWORDS);
  const params = {
    duration: parseDuration(text),    // "60秒" → 60
    lanes: parsePattern(text, /(\d+)\s*条?\s*车道/),
    difficulty: parseDifficulty(text), // "简单/困难" → level
  };
  const hasParams = Object.values(params).some(v => v != null);

  if (!gameType && !hasParams) return { level: 1 };
  if (gameType && !hasParams) return { level: 2, gameType };
  return { level: 3, gameType, params: compact(params) };
}
```

### Agent Integration (`conversation-agent.ts`)

```typescript
// Before Claude API call:
const intent = extractIntent(userText);

if (intent.level === 1) {
  // Skip Claude, return recommendation chips directly
  return { reply: '你想做哪种类型的游戏？试试这些：', chips: gameTypeChips() };
}

if (intent.level === 2) {
  // Call create_game with type only, return paramCard
  // ...existing tool_use flow with gameType pre-filled
}

if (intent.level === 3) {
  // Call create_game with type + extracted params
  // ...existing flow with params pre-filled in tool input
}
```

For level 1, this avoids an unnecessary Claude API round-trip (faster + cheaper).

### Build Order
1. `intent-extractor.ts` with keyword detection + param parsing
2. Agent integration (pre-tool routing)
3. Landing page: show template cards for level-1 intents

---

## Global Dependency Order

```
P0 Types → P0 Store → P0 ParamCard → P0 Chat render → P0 Agent mapping
    ↓
P1 Store phase → P1 Layout → P1 ChatPreviewPage → P1 SandboxPage → P1 Landing cards
    ↓
P2 SuggestionEngine → P2 Agent integration → P2 Chip categories
    ↓
P3 IntentExtractor → P3 Agent routing → P3 Reuse P0 paramCard + P2 suggestions
```

## Risks and Mitigation (Updated after dual-model review)

| Risk | Severity | Mitigation |
|------|----------|------------|
| ~~Store writes don't reach engine modules~~ | **CRITICAL (fixed)** | Use `mod.configure()` not direct param write. Added to plan. |
| Structural params (hitEvent etc.) need event rebinding | HIGH | STRUCTURAL_KEYS whitelist → fall back to configVersion reload |
| Current updateModuleParam always bumps configVersion | HIGH | Split API: `updateModuleParamLive` (no bump) vs `updateModuleParam` (bump) |
| "studio" hardcoded in multiple files | HIGH | Store alias: `setLayoutPhase('studio')` → `'chatPreview'` |
| ParamCard needs scope control | HIGH | Wrapper with field allowlist, not raw SchemaRenderer |
| P3 duplicates existing KEYWORD_MAP | MEDIUM | Move to intent-extractor.ts, re-export from conversation-defs |
| suggestion-engine circular imports | MEDIUM | DI: accept ContractRegistry as parameter |
| Debounce slider flooding | LOW | Leading-edge configure() + trailing-edge store persist |
| Mobile layout | LOW | Mobile stays in chatPreview only |

## SESSION_ID
- CODEX_SESSION: 019d4b4f-2eaa-7fc1-acd2-ff0154e1a826
- GEMINI_SESSION: (read-only analysis)
