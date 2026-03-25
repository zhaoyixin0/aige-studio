# Conversational UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the wizard/ModeB/GuidedCreator with a unified conversational game creation UI inspired by Google AI Studio — centered input → two-panel chat+preview → dynamic suggestion chips.

**Architecture:** New `ConversationAgent` wraps Claude API with tool_use for create/modify/suggest. New `MainLayout` has two phases: landing (centered input) and studio (chat+preview). Dynamic chips component reads state from store. Editor panel toggles via a button.

**Tech Stack:** React, Zustand, Tailwind CSS, Claude API (tool_use), existing engine/module infrastructure

**Design Doc:** `docs/plans/2026-03-25-conversational-ui-design.md`

---

## Task 1: Update EditorStore — add layout phase + chips state

**Files:**
- Modify: `src/store/editor-store.ts`

**Step 1: Add new state fields and actions**

Add to the store:
- `layoutPhase: 'landing' | 'studio'` — controls which layout to show
- `suggestionChips: Chip[]` — current suggestion buttons
- `editorExpanded: boolean` — whether editor panel is visible
- `setSuggestionChips`, `setLayoutPhase`, `toggleEditor` actions

```ts
// Add to EditorStore interface:
export interface Chip {
  id: string;
  label: string;
  emoji?: string;
}

// In interface EditorStore:
layoutPhase: 'landing' | 'studio';
suggestionChips: Chip[];
editorExpanded: boolean;
setLayoutPhase: (phase: 'landing' | 'studio') => void;
setSuggestionChips: (chips: Chip[]) => void;
toggleEditor: () => void;
```

Add default game type chips:
```ts
const DEFAULT_CHIPS: Chip[] = [
  { id: 'catch', label: '接住游戏', emoji: '🎯' },
  { id: 'shooting', label: '射击游戏', emoji: '🔫' },
  { id: 'dodge', label: '躲避游戏', emoji: '💨' },
  { id: 'quiz', label: '答题游戏', emoji: '❓' },
  { id: 'runner', label: '跑酷游戏', emoji: '🏃' },
  { id: 'tap', label: '点击游戏', emoji: '👆' },
  { id: 'rhythm', label: '节奏游戏', emoji: '🎵' },
  { id: 'platformer', label: '平台跳跃', emoji: '🎮' },
  { id: 'random-wheel', label: '幸运转盘', emoji: '🎰' },
  { id: 'expression', label: '表情挑战', emoji: '😊' },
];
```

**Step 2: Commit**

```bash
git add src/store/editor-store.ts
git commit -m "feat: add layout phase, suggestion chips, editor toggle to EditorStore"
```

---

## Task 2: Create SuggestionChips component

**Files:**
- Create: `src/ui/chat/suggestion-chips.tsx`

**Step 1: Implement the chips component**

```tsx
import { useEditorStore } from '@/store/editor-store';
import type { Chip } from '@/store/editor-store';

const selectChips = (s: { suggestionChips: Chip[] }) => s.suggestionChips;

interface Props {
  onChipClick: (chip: Chip) => void;
}

export function SuggestionChips({ onChipClick }: Props) {
  const chips = useEditorStore(selectChips);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onChipClick(chip)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full
            bg-white/5 hover:bg-white/10 border border-white/10
            text-sm text-gray-300 hover:text-white transition-colors"
        >
          {chip.emoji && <span>{chip.emoji}</span>}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/chat/suggestion-chips.tsx
git commit -m "feat: add SuggestionChips component"
```

---

## Task 3: Create ConversationAgent

**Files:**
- Create: `src/agent/conversation-agent.ts`

**Step 1: Implement the agent**

The ConversationAgent uses Claude API tool_use with 3 tools:
- `create_game` — builds a GameConfig from parameters
- `modify_game` — applies changes to existing config
- `suggest_enhancements` — returns chip suggestions

Key behaviors:
- Reuses existing `getGamePreset()`, `getModuleParams()`, module registry
- Constructs GameConfig from tool call parameters
- Keeps conversation history for context (max 10 messages)
- System prompt instructs Claude to infer what it can, ask ≤3 rounds

The system prompt should:
- List all 15 game types with short descriptions
- List all available modules
- List 5 themes and 6 art styles
- Instruct: "Infer defaults for anything the user doesn't specify. Only ask follow-up if critical info is missing. Max 3 follow-up questions."
- Instruct: "After creating a game, call suggest_enhancements to provide next-step chips."

Tool definitions:
```ts
const TOOLS = [
  {
    name: 'create_game',
    description: 'Create a new game with specified parameters',
    input_schema: {
      type: 'object',
      properties: {
        game_type: { type: 'string', enum: ALL_GAME_TYPES },
        theme: { type: 'string', enum: ['fruit','space','ocean','halloween','candy'] },
        art_style: { type: 'string', enum: ['cartoon','pixel','flat','realistic','watercolor','chibi'] },
        duration: { type: 'number', description: 'Game duration in seconds, 0 for no timer' },
        modules: { type: 'array', items: { type: 'string' }, description: 'Additional module types to include' },
        want_background: { type: 'boolean' },
      },
      required: ['game_type'],
    },
  },
  {
    name: 'modify_game',
    description: 'Modify the current game configuration',
    input_schema: {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['add_module','remove_module','change_theme','change_style','change_duration','change_param'] },
              module_type: { type: 'string' },
              param_name: { type: 'string' },
              param_value: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
      required: ['changes'],
    },
  },
  {
    name: 'suggest_enhancements',
    description: 'Analyze current game config and suggest enhancement chips',
    input_schema: {
      type: 'object',
      properties: {
        current_modules: { type: 'array', items: { type: 'string' } },
        game_type: { type: 'string' },
      },
      required: ['current_modules', 'game_type'],
    },
  },
];
```

Process method:
1. Add user message to conversation history
2. Call Claude API with tools
3. If tool_use response → execute tool, return config + chips
4. If text response → return as reply (follow-up question) + update chips
5. After create_game → auto-call suggest_enhancements for chips

**Step 2: Commit**

```bash
git add src/agent/conversation-agent.ts
git commit -m "feat: add ConversationAgent with Claude tool_use for game creation"
```

---

## Task 4: Create Landing Page component

**Files:**
- Create: `src/ui/landing/landing-page.tsx`

**Step 1: Build the centered landing page**

```tsx
// Full-screen centered layout with:
// - AIGE Studio title/logo
// - Input box with placeholder "描述你想做的游戏..."
// - Send button
// - SuggestionChips below
// - Input box matches Google AI Studio style: rounded, subtle border, dark bg
```

The landing page has its own input handling:
- On submit or chip click → calls ConversationAgent.process()
- When config is returned → setLayoutPhase('studio'), setConfig(config)
- When follow-up question → show AI reply + new chips (stay on landing with chat below input)

**Step 2: Commit**

```bash
git add src/ui/landing/landing-page.tsx
git commit -m "feat: add LandingPage component with centered input + chips"
```

---

## Task 5: Refactor MainLayout — two-phase layout

**Files:**
- Modify: `src/ui/layout/main-layout.tsx`

**Step 1: Implement phase-based layout**

```tsx
export function MainLayout() {
  const engine = useEngine();
  const layoutPhase = useEditorStore(selectLayoutPhase);
  const previewMode = useEditorStore(selectPreviewMode);
  const editorExpanded = useEditorStore(selectEditorExpanded);

  return (
    <EngineContext.Provider value={engine}>
      {layoutPhase === 'landing' ? (
        <LandingPage />
      ) : (
        <div className="h-screen w-screen flex bg-gray-950 text-white overflow-hidden">
          {/* Chat Panel — 40% */}
          {previewMode === 'edit' && (
            <div className="w-[40%] shrink-0 border-r border-white/5">
              <StudioChatPanel />
            </div>
          )}

          {/* Preview — fills remaining */}
          <div className="flex-1 min-w-0">
            <PreviewCanvas />
          </div>

          {/* Editor — collapsible 30% */}
          {previewMode === 'edit' && editorExpanded && (
            <div className="w-80 shrink-0 border-l border-white/5">
              <EditorPanel />
            </div>
          )}

          {/* Editor toggle button */}
          {previewMode === 'edit' && !editorExpanded && (
            <button onClick={toggleEditor} className="absolute right-2 top-2 ...">
              Editor ▸
            </button>
          )}
        </div>
      )}

      {previewMode === 'fullscreen' && <FullscreenMode />}
    </EngineContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add src/ui/layout/main-layout.tsx
git commit -m "feat: two-phase MainLayout — landing page → studio view"
```

---

## Task 6: Create StudioChatPanel — in-studio chat

**Files:**
- Create: `src/ui/chat/studio-chat-panel.tsx`

**Step 1: Build the studio chat panel**

This is a simplified version of the old ChatPanel, focused on:
- Message history display (scrollable)
- Input box at bottom
- SuggestionChips above input
- Calls ConversationAgent for all interactions
- Triggers asset generation after config changes
- Shows loading state during LLM calls

Key difference from old ChatPanel:
- No wizard logic — everything goes through ConversationAgent
- Chips are dynamic, managed by store
- Simpler message rendering (no wizard step tracking)

**Step 2: Commit**

```bash
git add src/ui/chat/studio-chat-panel.tsx
git commit -m "feat: add StudioChatPanel for in-studio conversation"
```

---

## Task 7: Wire asset generation + engine sync

**Files:**
- Modify: `src/ui/chat/studio-chat-panel.tsx` (or shared hook)
- Modify: `src/ui/landing/landing-page.tsx`

**Step 1: Shared asset fulfillment logic**

Both LandingPage and StudioChatPanel need to trigger asset generation when a config is created/modified. Extract shared logic:

```ts
function useAssetFulfillment() {
  const batchUpdateAssets = useGameStore(selectBatchUpdateAssets);
  const { engineRef } = useEngineContext();

  const fulfill = useCallback(async (config: GameConfig) => {
    const agent = new AssetAgent();
    const assets = await agent.fulfillAssets(config);
    if (Object.keys(assets).length > 0) {
      batchUpdateAssets(assets);
      const engine = engineRef.current;
      if (engine) {
        engine.getConfig().assets = { ...engine.getConfig().assets, ...assets };
      }
    }
    return assets;
  }, [batchUpdateAssets, engineRef]);

  return fulfill;
}
```

**Step 2: Commit**

```bash
git add src/ui/chat/studio-chat-panel.tsx src/ui/landing/landing-page.tsx
git commit -m "feat: wire asset generation and engine sync in new UI"
```

---

## Task 8: Update CLAUDE.md + cleanup

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update documentation**

- Update interaction modes section (3 modes → 1 conversational mode)
- Update UI file descriptions
- Add ConversationAgent to agent section
- Note: old wizard.ts/agent.ts kept as internal utilities

**Step 2: Commit and run full test suite**

```bash
npx vitest run
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for conversational UI redesign"
```

---

## Summary

| Task | Component | New/Modify | Deps |
|------|-----------|------------|------|
| 1 | EditorStore | Modify | — |
| 2 | SuggestionChips | New | 1 |
| 3 | ConversationAgent | New | — |
| 4 | LandingPage | New | 1, 2, 3 |
| 5 | MainLayout | Modify | 1, 4 |
| 6 | StudioChatPanel | New | 1, 2, 3 |
| 7 | Asset wiring | Modify | 4, 6 |
| 8 | Docs + cleanup | Modify | all |

Tasks 1-3 can be done in parallel (no file overlap).
Tasks 4-6 depend on 1-3.
Tasks 7-8 are final integration.
