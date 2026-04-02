# Interaction Redesign V2: P0-P3 Implementation Plan

Inspired by Effect House Figma designs. Multi-model validated (Codex + Gemini).
V2: Integrates asset management into chat flow, block-based messages, UI-intent tools.

## Architecture Decision

**Option C — UI-intent tools + ChatMessage blocks (recommended by Codex, adopted)**

- Agent stays lightweight: emits structured `uiActions`, never executes heavy asset operations
- UI layer handles: AssetAgent, file upload, library search, AI generation, bg removal
- ChatMessage evolves from text-only to block-based (backward compatible)
- Deterministic chip actions replace text-to-LLM round-trips for known operations

**Why:** Preserves agent purity and bundle size. Avoids circular dependencies with services. Enables rich UX (previews, upload prompts, progress logs) without agent coupling. Aligns with existing pattern where UI triggers AssetAgent post-config.

---

## Overview

| Priority | Feature | New Files | Modified Files |
|----------|---------|-----------|---------------|
| P0 | Chat Blocks + ParamCard + Asset Integration | `param-card.tsx`, `asset-preview-block.tsx`, `upload-request-block.tsx`, `progress-log-block.tsx`, `ui-action-executor.ts` | `conversation-defs.ts`, `conversation-agent.ts`, `editor-store.ts`, `game-store.ts`, `studio-chat-panel.tsx`, `schema-renderer.tsx`, `suggestion-chips.tsx` |
| P1 | Three-View Layout + Paste/Drop + Asset Panels | `chat-preview-page.tsx`, `sandbox-page.tsx` | `main-layout.tsx`, `landing-page.tsx`, `editor-store.ts`, `studio-chat-panel.tsx`, `asset-browser.tsx` |
| P2 | Context-Aware Suggestions + Visual Enhancements | `suggestion-engine.ts` | `conversation-agent.ts`, `suggestion-chips.tsx`, `studio-chat-panel.tsx`, `schema-renderer.tsx` |
| P3 | Intent Extraction + Board Interaction | `intent-extractor.ts` | `conversation-agent.ts`, `landing-page.tsx`, `preview-canvas.tsx` |

Each P level is independently shippable. All changes are additive (no breaking changes).

---

## P0: Chat Blocks + Interactive ParamCard + Asset Integration

### Goal
Replace text-only bot responses with structured blocks: parameter cards, asset previews, upload prompts, and progress logs. User adjustments update the live preview immediately. Assets can be browsed, uploaded, and regenerated from within the chat.

### 0.1 Type Changes (`conversation-defs.ts`)

```typescript
// ── Chat Block types (union for message content) ──

export type ChatBlock =
  | { kind: 'text'; text: string }
  | { kind: 'param-card'; title?: string; fields: ParamCardField[] }
  | { kind: 'asset-preview'; items: AssetPreviewItem[]; allowApplyAll?: boolean }
  | { kind: 'upload-request'; target: string; accept: ('image'|'audio')[]; hint?: string }
  | { kind: 'progress-log'; entries: ProgressEntry[] };

export type ParamCardField =
  | { kind: 'select'; key: string; label: string; options: string[]; value?: string }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step?: number; value?: number; unit?: string }
  | { kind: 'emoji'; key: string; label: string; options: string[]; value?: string }
  | { kind: 'toggle'; key: string; label: string; value?: boolean }
  | { kind: 'asset'; key: string; label: string; thumbnail?: string; accept?: ('image'|'audio')[] };

export interface AssetPreviewItem {
  key: string;
  label: string;
  src: string;
  source: 'prebuilt' | 'library' | 'ai' | 'upload';
}

export interface ProgressEntry {
  key: string;
  message: string;
  status: 'pending' | 'generating' | 'removing-bg' | 'done' | 'error';
}

export interface Attachment {
  id: string;
  type: 'image' | 'audio';
  src: string;           // blob: or data: URL
  from: 'user' | 'library' | 'generated';
  target?: string;       // asset key this maps to
}

// ── UI Actions (agent → UI intent channel) ──

export type UIAction =
  | { type: 'REQUEST_ASSET_REPLACE'; target: string; accept: ('image'|'audio')[]; preferredSource?: 'library'|'upload'|'ai' }
  | { type: 'REQUEST_ASSETS_GENERATE'; missingOnly?: boolean; keys?: string[]; showPreview?: boolean }
  | { type: 'SHOW_ASSET_PREVIEWS'; items: AssetPreviewItem[] };

// ── Chip with action payload ──

export interface ChipAction {
  type: string;
  payload?: Record<string, unknown>;
}

export interface Chip {
  id: string;
  label: string;
  emoji?: string;
  action?: ChipAction;  // NEW: deterministic dispatch (optional, falls back to text)
}

// ── Extended ConversationResult ──

export interface ConversationResult {
  reply: string;                    // text fallback (backward compat)
  blocks?: ChatBlock[];             // NEW: structured content
  config?: GameConfig;
  chips?: Chip[];
  uiActions?: UIAction[];           // NEW: UI-intent channel
  needsMoreInfo?: boolean;
}
```

### 0.2 New Tool Definitions (`conversation-defs.ts` TOOLS array)

Add 3 UI-intent tools alongside existing create_game/modify_game/suggest_enhancements:

```typescript
{
  name: 'request_asset_replace',
  description: '请求用户替换指定素材。UI 会打开素材选择器/上传/AI生成对话框。',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Asset key to replace (e.g., "player", "star", "background")' },
      accept: { type: 'array', items: { enum: ['image', 'audio'] } },
      preferredSource: { enum: ['library', 'upload', 'ai'], description: 'Preferred source method' },
    },
    required: ['target', 'accept'],
  },
},
{
  name: 'request_assets_generate',
  description: '请求生成/重新生成游戏素材。UI 会调用 AssetAgent 并展示进度和预览。',
  input_schema: {
    type: 'object',
    properties: {
      missingOnly: { type: 'boolean', description: 'Only generate assets that are missing' },
      keys: { type: 'array', items: { type: 'string' }, description: 'Specific asset keys to generate' },
      showPreview: { type: 'boolean', description: 'Show preview grid after generation' },
    },
  },
},
{
  name: 'show_asset_previews',
  description: '在聊天中展示素材预览网格。用于主题/画风更改后展示新素材。',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            src: { type: 'string' },
            source: { enum: ['prebuilt', 'library', 'ai', 'upload'] },
          },
          required: ['key', 'label'],
        },
      },
    },
    required: ['items'],
  },
}
```

### 0.3 System Prompt Update (`conversation-defs.ts`)

Add "Asset Operations" section to SYSTEM_PROMPT_BASE:

```
## 素材操作规则

你不直接执行素材操作。当用户提到素材相关需求时，使用以下工具：

1. **request_asset_replace** — 用户想替换特定素材（"换个主角"、"背景太单调"）
   - target: 素材 key（如 'player', 'background', 'star'）
   - accept: ['image'] 或 ['audio']
   - preferredSource: 根据上下文选择 'ai'（用户没有素材时）、'upload'（用户说"我有图片"时）、'library'（用户想从库中选时）

2. **request_assets_generate** — 生成/重新生成素材
   - 主题/画风变更后自动调用：missingOnly=false, showPreview=true
   - 用户说"补齐素材"：missingOnly=true, showPreview=true
   - 针对特定素材：keys=['player', 'star'], showPreview=true

3. **show_asset_previews** — 仅在需要展示已有素材时使用

**重要规则：**
- 使用 modify_game 的 set_theme/set_art_style 后，必须紧跟 request_assets_generate
- 创建游戏后，素材会自动生成，不需要额外调用
- 用户上传图片（attachments）时，用 modify_game 的 set_asset action 应用到对应 key
```

### 0.4 Agent Changes (`conversation-agent.ts`)

Map UI-intent tool_use blocks to `uiActions` (NOT executed in agent):

```typescript
// In process() response handling:
if (block.type === 'tool_use') {
  switch (block.name) {
    case 'create_game': { /* existing */ break; }
    case 'modify_game': { /* existing */ break; }
    case 'suggest_enhancements': { /* existing */ break; }
    // NEW: UI-intent tools → uiActions (not executed here)
    case 'request_asset_replace': {
      const input = block.input as { target: string; accept: string[]; preferredSource?: string };
      uiActions.push({ type: 'REQUEST_ASSET_REPLACE', ...input });
      break;
    }
    case 'request_assets_generate': {
      const input = block.input as { missingOnly?: boolean; keys?: string[]; showPreview?: boolean };
      uiActions.push({ type: 'REQUEST_ASSETS_GENERATE', ...input });
      break;
    }
    case 'show_asset_previews': {
      const input = block.input as { items: AssetPreviewItem[] };
      uiActions.push({ type: 'SHOW_ASSET_PREVIEWS', items: input.items });
      break;
    }
  }
}

// Build result with blocks
return {
  reply,
  blocks: buildBlocks(reply, paramCard),  // text block + optional param-card block
  config,
  chips,
  uiActions: uiActions.length > 0 ? uiActions : undefined,
};
```

Add `mapConfigToParamCard()` helper (from V1 plan) that now includes asset fields:

```typescript
function mapConfigToParamCard(config: GameConfig, gameType: string): ChatBlock {
  const fields: ParamCardField[] = [
    { kind: 'select', key: 'mode', label: '游戏模式', options: ['...'], value: '...' },
    { kind: 'slider', key: 'duration', label: '时长', min: 15, max: 120, step: 5, value: 60, unit: '秒' },
    { kind: 'slider', key: 'difficulty', label: '难度', min: 1, max: 10, step: 1, value: 5 },
    // NEW: asset fields
    { kind: 'asset', key: 'player', label: '主角', thumbnail: config.assets['player']?.src },
    { kind: 'asset', key: 'background', label: '背景', thumbnail: config.assets['background']?.src },
  ];
  // Add game-type-specific asset fields (e.g., catch → good items, bad items)
  return { kind: 'param-card', title: '游戏设置', fields };
}
```

### 0.5 Store Changes (`editor-store.ts`)

```typescript
// Extend ChatMessage to support blocks and attachments
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;              // text fallback (backward compat, always populated)
  blocks?: ChatBlock[];         // NEW: structured content
  attachments?: Attachment[];   // NEW: user-uploaded images/audio
  // ... existing optional fields (suggestions, wizardChoices, etc.)
  timestamp: number;
}

// Chip type now imported from conversation-defs (with action field)

// New store actions
interface EditorStore {
  // ... existing
  addAttachmentToMessage: (messageId: string, attachment: Attachment) => void;  // NEW
  pendingAttachments: Attachment[];  // NEW: attachments for next user message
  addPendingAttachment: (attachment: Attachment) => void;
  clearPendingAttachments: () => void;
}
```

### 0.6 Store Changes (`game-store.ts`)

Add `updateModuleParamLive()` (from V1 plan, unchanged):

```typescript
updateModuleParamLive: (moduleId: string, param: string, value: unknown) => {
  const STRUCTURAL_KEYS = new Set([
    'hitEvent', 'damageEvent', 'activateEvent',
    'shakeEvent', 'toggleEvent', 'continuousEvent',
  ]);

  if (STRUCTURAL_KEYS.has(param)) {
    // Fall back to full configVersion bump (engine reload)
    get().updateModuleParam(moduleId, param, value);
    return;
  }

  // 1. Update persisted config WITHOUT incrementing configVersion
  set((state) => ({
    config: state.config ? {
      ...state.config,
      modules: state.config.modules.map((m) =>
        m.id === moduleId ? { ...m, params: { ...m.params, [param]: value } } : m,
      ),
    } : state.config,
  }));

  // 2. Push to running engine via configure()
  const engine = window.__engine;
  if (engine) {
    const mod = engine.getModule(moduleId);
    if (mod) {
      mod.configure({ [param]: value });
    }
  }
}
```

### 0.7 New Component: ParamCard (`src/ui/chat/param-card.tsx`)

```tsx
interface ParamCardProps {
  block: Extract<ChatBlock, { kind: 'param-card' }>;
  onParamChange: (key: string, value: unknown) => void;
  onAssetAction: (key: string, action: 'replace' | 'regenerate' | 'browse') => void;
}

function ParamCard({ block, onParamChange, onAssetAction }: ParamCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
      {block.title && <div className="text-sm font-medium text-white/80">{block.title}</div>}
      {block.fields.map(field => {
        switch (field.kind) {
          case 'select': return <SelectField key={field.key} {...field} onChange={v => onParamChange(field.key, v)} />;
          case 'slider': return <SliderField key={field.key} {...field} onChange={v => onParamChange(field.key, v)} />;
          case 'emoji':  return <EmojiField key={field.key} {...field} onChange={v => onParamChange(field.key, v)} />;
          case 'toggle': return <ToggleField key={field.key} {...field} onChange={v => onParamChange(field.key, v)} />;
          case 'asset':  return <AssetField key={field.key} {...field} onAction={a => onAssetAction(field.key, a)} />;
        }
      })}
    </div>
  );
}

// Asset field: 64x64 thumbnail + action buttons
function AssetField({ label, thumbnail, onAction }: {
  label: string; thumbnail?: string;
  onAction: (action: 'replace' | 'regenerate' | 'browse') => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-12 h-12 rounded-lg border border-white/10 bg-white/5 overflow-hidden flex-shrink-0">
        {thumbnail
          ? <img src={thumbnail} alt={label} className="w-full h-full object-contain" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">?</div>
        }
      </div>
      <span className="text-sm text-white/70 flex-1">{label}</span>
      <div className="flex gap-1">
        <button onClick={() => onAction('replace')} className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/60">替换</button>
        <button onClick={() => onAction('regenerate')} className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/60">重新生成</button>
        <button onClick={() => onAction('browse')} className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/60">上传</button>
      </div>
    </div>
  );
}
```

### 0.8 New Component: AssetPreviewBlock (`src/ui/chat/asset-preview-block.tsx`)

```tsx
function AssetPreviewBlock({ items, allowApplyAll, onApply, onApplyAll }: {
  items: AssetPreviewItem[];
  allowApplyAll?: boolean;
  onApply: (key: string, src: string) => void;
  onApplyAll: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      {allowApplyAll && items.length > 1 && (
        <div className="flex justify-end mb-2">
          <button onClick={onApplyAll} className="text-xs text-blue-400 hover:text-blue-300">
            全部应用
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {items.map(item => (
          <div key={item.key} className="flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              <img src={item.src} alt={item.label} className="w-full h-full object-contain" loading="lazy" />
            </div>
            <span className="text-[10px] text-white/50 truncate max-w-16">{item.label}</span>
            <button onClick={() => onApply(item.key, item.src)}
              className="text-[10px] text-blue-400 hover:text-blue-300">应用</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 0.9 New Component: UploadRequestBlock (`src/ui/chat/upload-request-block.tsx`)

```tsx
function UploadRequestBlock({ target, accept, hint, onUpload }: {
  target: string; accept: ('image'|'audio')[];
  hint?: string; onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mimeTypes = accept.map(a => a === 'image' ? 'image/*' : 'audio/*').join(',');

  return (
    <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center"
         onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400'); }}
         onDragLeave={e => e.currentTarget.classList.remove('border-blue-400')}
         onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onUpload(f); }}>
      <p className="text-sm text-white/60">{hint ?? `请上传 ${target} 的素材`}</p>
      <button onClick={() => inputRef.current?.click()}
        className="mt-2 px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30">
        选择文件
      </button>
      <p className="mt-1 text-[10px] text-white/30">或直接拖拽/粘贴图片到此处</p>
      <input ref={inputRef} type="file" accept={mimeTypes} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
    </div>
  );
}
```

### 0.10 UI Action Executor (`src/ui/chat/ui-action-executor.ts`)

Handles uiActions dispatched by agent, bridges to existing asset services:

```typescript
export function executeUIActions(
  actions: UIAction[],
  deps: {
    config: GameConfig;
    addChatMessage: (msg: ChatMessage) => void;
    batchUpdateAssets: (assets: Record<string, AssetEntry>) => void;
    updateAsset: (id: string, src: string) => void;
    openAssetBrowser: (target: string) => void;
    openUploadDialog: (target: string) => void;
    openAIGenerateDialog: (target: string) => void;
  }
): void {
  for (const action of actions) {
    switch (action.type) {
      case 'REQUEST_ASSET_REPLACE': {
        if (action.preferredSource === 'upload') deps.openUploadDialog(action.target);
        else if (action.preferredSource === 'library') deps.openAssetBrowser(action.target);
        else deps.openAIGenerateDialog(action.target);
        break;
      }
      case 'REQUEST_ASSETS_GENERATE': {
        // Trigger AssetAgent with progress streaming
        const agent = new AssetAgent();
        const progressEntries: ProgressEntry[] = [];
        deps.addChatMessage({
          id: crypto.randomUUID(), role: 'assistant',
          content: '正在生成素材...',
          blocks: [{ kind: 'progress-log', entries: progressEntries }],
          timestamp: Date.now(),
        });
        agent.fulfillAssets(deps.config, (p) => {
          progressEntries.push({ key: p.key, message: `${p.key}: ${p.status}`, status: p.status });
          // Update message in-place (or append new message on completion)
        }).then((assets) => {
          const count = Object.keys(assets).length;
          if (count > 0) {
            deps.batchUpdateAssets(assets);
            if (action.showPreview) {
              const items = Object.entries(assets).map(([k, v]) => ({
                key: k, label: k, src: v.src, source: 'ai' as const,
              }));
              deps.addChatMessage({
                id: crypto.randomUUID(), role: 'assistant',
                content: `已生成 ${count} 个素材`,
                blocks: [{ kind: 'asset-preview', items, allowApplyAll: true }],
                timestamp: Date.now(),
              });
            }
          }
        });
        break;
      }
      case 'SHOW_ASSET_PREVIEWS': {
        deps.addChatMessage({
          id: crypto.randomUUID(), role: 'assistant',
          content: '当前素材预览',
          blocks: [{ kind: 'asset-preview', items: action.items, allowApplyAll: false }],
          timestamp: Date.now(),
        });
        break;
      }
    }
  }
}
```

### 0.11 Chat Render Integration (`studio-chat-panel.tsx`)

```tsx
// Block rendering in MessageBubble
function MessageBubble({ message }: { message: ChatMessage }) {
  const blocks = message.blocks ?? [{ kind: 'text' as const, text: message.content }];

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-2">
        {blocks.map((block, i) => (
          <ChatBlockRenderer key={i} block={block} />
        ))}
        {message.attachments?.map(att => (
          <AttachmentPreview key={att.id} attachment={att} />
        ))}
      </div>
    </div>
  );
}

function ChatBlockRenderer({ block }: { block: ChatBlock }) {
  switch (block.kind) {
    case 'text': return <p className="text-sm text-white/90">{block.text}</p>;
    case 'param-card': return <ParamCard block={block} onParamChange={...} onAssetAction={...} />;
    case 'asset-preview': return <AssetPreviewBlock items={block.items} allowApplyAll={block.allowApplyAll} ... />;
    case 'upload-request': return <UploadRequestBlock target={block.target} accept={block.accept} hint={block.hint} ... />;
    case 'progress-log': return <ProgressLogBlock entries={block.entries} />;
  }
}

// Chat input: add paste/drop handler + paperclip button
function ChatInput({ onSend }: Props) {
  const addPending = useEditorStore(s => s.addPendingAttachment);
  const pendingAttachments = useEditorStore(s => s.pendingAttachments);

  const handlePaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    for (const file of files) {
      if (file.type.startsWith('image/') || file.type.startsWith('audio/')) {
        addPending({
          id: crypto.randomUUID(), type: file.type.startsWith('image/') ? 'image' : 'audio',
          src: URL.createObjectURL(file), from: 'user',
        });
      }
    }
  };

  // ... render textarea + paperclip button + pending attachment previews
}
```

### 0.12 Chip Action Dispatch (`suggestion-chips.tsx`)

```tsx
export function SuggestionChips({ onChipClick, onChipAction }: Props) {
  const chips = useEditorStore(s => s.suggestionChips);

  const handleClick = (chip: Chip) => {
    if (chip.action) {
      onChipAction(chip.action);  // deterministic dispatch
    } else {
      onChipClick(chip);  // legacy text submission
    }
  };

  // ... render chips with action-aware click handler
}
```

### 0.13 Parameter Hot-Update Path (from V1, unchanged)

ParamCard sliders → `updateModuleParamLive()` → `mod.configure()` (no engine reload).
STRUCTURAL_KEYS → fall back to `updateModuleParam()` (configVersion bump).
Debounce: 50ms throttle (leading: configure(); trailing: store persist).

### P0 Build Order
1. Types in `conversation-defs.ts` (ChatBlock, ParamCardField, UIAction, Attachment, Chip.action)
2. Tool definitions in `conversation-defs.ts` (3 new UI-intent tools)
3. System prompt update (Asset Operations section)
4. Store changes: `editor-store.ts` (blocks, attachments, pendingAttachments) + `game-store.ts` (updateModuleParamLive)
5. Agent changes: `conversation-agent.ts` (UI-intent tool handling, mapConfigToParamCard with asset fields)
6. `ParamCard` component (including AssetField)
7. `AssetPreviewBlock` component
8. `UploadRequestBlock` component
9. `ProgressLogBlock` component (simple list)
10. `UIActionExecutor` (bridges uiActions → asset services)
11. Chat render integration (block renderer, paste/drop)
12. Chip action dispatch
13. Debounced preview sync (ParamCard → engine hot-update)

---

## P1: Three-View Layout + Paste/Drop + Asset Panels

### Goal
Landing → Chat+Preview → Sandbox, with navigation. Chat input supports paste/drop images. SandboxPage has merged Objects+Assets panel.

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

### ChatPreviewPage (`src/ui/pages/chat-preview-page.tsx`)
- Left: StudioChatPanel (resizable, with paste/drop support)
- Right: PreviewCanvas + optional timeline

### SandboxPage (`src/ui/pages/sandbox-page.tsx`)
- Left: Objects panel (ModuleList + AssetBrowser merged)
  - Tab 1: Modules — list of enabled modules with toggle
  - Tab 2: Assets — AssetBrowser with search/filter + upload/AI generate buttons
  - Drag from asset grid → preview canvas to bind asset to target
- Center: PreviewCanvas (larger)
- Right: Chat copilot (narrower)

### Chat Input Enhancement (P1 level)
- Paperclip button next to send button → opens file picker
- Drop zone: entire chat area becomes drop target
- Paste handler: Ctrl+V images from clipboard
- Pending attachments shown as thumbnails above input before sending
- On send: attachments included in message, agent sees them as context

### Batch Asset Preview
- After theme/style change → AssetAgent regenerates → show AssetPreviewBlock with `allowApplyAll: true`
- Per-item "Apply" replaces individual asset (hot-swap, no reload)
- "Apply All" batch updates all assets at once

### Landing Enhancement
- Template cards (game type gallery with preview images + tags)
- Clicking a card seeds `gameType` and transitions to `chatPreview`

### P1 Build Order
1. Store `LayoutPhase` union + setter
2. Extract `ChatPreviewPage` from existing studio layout
3. `MainLayout` phase switcher + TopBar
4. `SandboxPage` with merged Objects+Assets panel
5. Chat input paste/drop/paperclip
6. Pending attachments UI
7. Batch asset preview (Apply All / per-item Apply)
8. Landing template cards
9. Drag from AssetBrowser → preview canvas (basic)

---

## P2: Context-Aware Suggestions + Visual Enhancements

### Goal
Game-type and theme-aware suggestions. Asset-related chips with thumbnails. Visual enhancements (sparkline, HUD presets).

### Suggestion Engine (`src/agent/suggestion-engine.ts`)

```typescript
const GAME_SUGGESTIONS: Record<string, Array<(cfg: GameConfig) => Chip | null>> = {
  catch: [
    () => ({ id: 'drop-speed', label: '调整掉落速度', emoji: '⬇️' }),
    () => ({ id: 'player-size', label: '调整玩家大小', emoji: '📏' }),
    () => ({ id: 'theme', label: '更换主题风格', emoji: '🎨' }),
    // Asset-related chips
    () => ({ id: 'replace-player', label: '替换主角形象', emoji: '🧑‍🚀',
             action: { type: 'REQUEST_ASSET_REPLACE', payload: { target: 'player', accept: ['image'] } } }),
    () => ({ id: 'regen-assets', label: '重新生成素材', emoji: '🎨',
             action: { type: 'REQUEST_ASSETS_GENERATE', payload: { missingOnly: false, showPreview: true } } }),
    (cfg) => cfg.modules.some(m => m.type === 'DifficultyRamp')
      ? null
      : ({ id: 'add-difficulty', label: '添加难度递增', emoji: '📈' }),
  ],
  // ... other 15 game types
};

export function getSuggestions(gameType: string, config: GameConfig, contracts?: ContractRegistry): Chip[] {
  const rules = GAME_SUGGESTIONS[gameType] ?? GAME_SUGGESTIONS['_default'];
  const chips = rules.map(r => r(config)).filter(Boolean) as Chip[];

  // Contract-based suggestions (unfulfilled events)
  if (contracts) {
    // ... add chips for missing event emitters
  }

  return chips.slice(0, 8);
}
```

### DifficultyRamp Sparkline
- In ParamCard slider for DifficultyRamp params (rate, startDelay, maxMultiplier)
- Tiny SVG sparkline (40x20px) showing the curve shape
- Updates on slider drag

### HUD Preset Chips
- Suggestion chips for HUD customization: "显示心形生命值", "右上角计分", "底部计时器"
- Each chip has action payload that maps to UIOverlay module params
- Deterministic dispatch (no LLM round-trip)

### Asset Prompt Editing
- When user wants to customize AI generation ("把星星改成南瓜")
- Agent updates `config.meta.assetDescriptions` via modify_game
- Then calls `request_assets_generate` with `keys: ['star']`
- AssetAgent uses updated descriptions for generation

### P2 Build Order
1. `suggestion-engine.ts` with rules for all 16 game types + asset chips
2. Agent integration (replace generateSuggestions with getSuggestions)
3. Chip categories (optional colored variants: tweak=blue, add=green, asset=purple)
4. DifficultyRamp sparkline in ParamCard
5. HUD preset chips
6. Asset prompt editing flow (meta.assetDescriptions → regenerate)

---

## P3: Intent Extraction + Board Interaction

### Goal
Deterministic pre-processing for asset intents. Board/canvas drag-drop for object placement.

### Intent Extractor (`src/agent/intent-extractor.ts`)

Move existing `KEYWORD_MAP` from `conversation-defs.ts`. Add asset intent patterns:

```typescript
export type IntentLevel = 1 | 2 | 3;

export interface ParsedIntent {
  level: IntentLevel;
  gameType?: string;
  params?: Record<string, unknown>;
  uiActions?: UIAction[];  // NEW: deterministic asset intents
}

// Asset intent patterns
const ASSET_PATTERNS: Array<{ pattern: RegExp; action: (match: RegExpMatchArray) => UIAction }> = [
  { pattern: /换个?(主角|角色|玩家)(形象|图片|素材)?/,
    action: () => ({ type: 'REQUEST_ASSET_REPLACE', target: 'player', accept: ['image'], preferredSource: 'ai' }) },
  { pattern: /换个?(背景|场景)(图片|素材)?/,
    action: () => ({ type: 'REQUEST_ASSET_REPLACE', target: 'background', accept: ['image'], preferredSource: 'ai' }) },
  { pattern: /(补齐|生成|重新生成)(所有)?素材/,
    action: () => ({ type: 'REQUEST_ASSETS_GENERATE', missingOnly: true, showPreview: true }) },
  { pattern: /把(.+?)改成(.+)/,
    action: (m) => ({ type: 'REQUEST_ASSET_REPLACE', target: m[1], accept: ['image'], preferredSource: 'ai' }) },
];

export function extractIntent(input: string): ParsedIntent {
  const text = input.trim();

  // Check asset intents first
  for (const { pattern, action } of ASSET_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { level: 3, uiActions: [action(match)] };
    }
  }

  // Existing game type detection
  const gameType = detectGameType(text, TYPE_KEYWORDS);
  const params = { duration: parseDuration(text), lanes: parsePattern(text, /(\d+)\s*条?\s*车道/) };
  const hasParams = Object.values(params).some(v => v != null);

  if (!gameType && !hasParams) return { level: 1 };
  if (gameType && !hasParams) return { level: 2, gameType };
  return { level: 3, gameType, params: compact(params) };
}
```

### Agent Integration

```typescript
const intent = extractIntent(userText);

// Level 3 with uiActions → execute directly, skip LLM for asset-only intents
if (intent.uiActions?.length) {
  return {
    reply: '好的，正在处理...',
    blocks: [{ kind: 'text', text: '好的，正在处理...' }],
    uiActions: intent.uiActions,
  };
}

// Level 1 → skip Claude, return game type chips
if (intent.level === 1) {
  return { reply: '你想做哪种类型的游戏？', chips: gameTypeChips() };
}

// Level 2/3 → proceed with Claude API
```

### Board/Canvas Interaction (Advanced, P3)
- Drag objects from AssetBrowser onto preview canvas
- Click on canvas object → select it → show properties in editor panel
- Move objects by dragging on canvas
- Snap to grid (optional, for grid-based games)
- This is the most complex feature — defer detailed design to P3 execution

### P3 Build Order
1. `intent-extractor.ts` with asset patterns + game type detection
2. Agent integration (pre-tool routing for asset intents)
3. Landing page: show template cards for level-1 intents
4. Board/canvas basic interaction (click to select, drag to move)

---

## Global Dependency Order

```
P0 Types → P0 Tools → P0 Store → P0 Agent → P0 ParamCard → P0 AssetPreview
    → P0 UploadRequest → P0 UIActionExecutor → P0 Chat Render → P0 Chips
    ↓
P1 LayoutPhase → P1 Layout → P1 ChatPreviewPage → P1 SandboxPage
    → P1 PasteDrop → P1 BatchPreview → P1 LandingCards
    ↓
P2 SuggestionEngine → P2 Agent Integration → P2 ChipCategories
    → P2 Sparkline → P2 HUDPresets → P2 AssetPromptEdit
    ↓
P3 IntentExtractor → P3 Agent Routing → P3 BoardInteraction
```

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Agent calling heavy asset services directly | CRITICAL | UI-intent tools: agent emits uiActions, UI executes. Zero asset imports in agent. |
| Chat message payload bloat (thumbnails) | HIGH | Lazy loading, size caps (thumbnails < 64x64), revoke blob URLs on disposal |
| Circular dependency: agent ↔ services | HIGH | One-way flow: agent → types only; UI → services. Agent never imports AssetAgent. |
| ParamCard asset field needs scope control | HIGH | Wrapper with field allowlist, not raw SchemaRenderer |
| STRUCTURAL_KEYS need engine reload | HIGH | Whitelist → configVersion bump (existing path). Non-structural → mod.configure() |
| Paste/drop security | MEDIUM | Accept-list by MIME (image/*, audio/*), block executables, sanitize filenames |
| "studio" hardcoded in multiple files | MEDIUM | Store alias: setLayoutPhase('studio') → 'chatPreview' |
| P3 duplicates existing KEYWORD_MAP | MEDIUM | Move to intent-extractor.ts, re-export from conversation-defs |
| suggestion-engine circular imports | MEDIUM | DI: accept ContractRegistry as parameter |
| Debounce slider flooding | LOW | Leading-edge configure() + trailing-edge store persist |
| Mobile layout | LOW | Mobile stays in chatPreview only; asset preview uses single-column grid |
| Gemini API rate limits during batch generation | LOW | AssetAgent already has retry + cancellation support |

## Conversation System Changes Summary

| Component | Before | After |
|-----------|--------|-------|
| ChatMessage | Text-only content | Block-based (text + param-card + asset-preview + upload-request + progress-log) + attachments |
| Tools | 3 (create/modify/suggest) | 6 (+request_asset_replace, +request_assets_generate, +show_asset_previews) |
| Chips | Text-only, stringify to agent | Action payload dispatch (deterministic) + text fallback |
| ConversationResult | reply + config + chips | + blocks + uiActions |
| System Prompt | Game creation only | + Asset Operations section |
| Agent Responsibility | Config creation + modification | + Emit asset intents (NOT execute) |
| UI Responsibility | Trigger AssetAgent post-config | + Execute uiActions, handle paste/drop, render blocks |

## Appendix: UX Design Specifications (Gemini, with Policy enforcement)

### Asset Preview Block
- Grid: `grid grid-cols-2 sm:grid-cols-3 gap-2 w-full p-2 bg-white/5 rounded-lg border border-white/10`
- Thumbnails: `w-full aspect-square object-cover rounded-md bg-black/40 border border-white/5`
- Action buttons below each thumbnail: `flex items-center justify-between w-full mt-1.5`
- Buttons: `p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors` (lucide RefreshCw/Sparkles icons)
- "Apply All": `w-full mt-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium`

### Upload Request Block
- Container: `w-full flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer`
- Default: `bg-black/20 border-white/20 text-gray-400 hover:border-white/40 hover:bg-white/5`
- Drag over: `bg-blue-500/10 border-blue-500 text-blue-400 scale-[1.02]`
- Wrap entire block in `<label>` pointing to hidden `<input type="file">` for full-zone click
- After file selected: show preview `w-16 h-16 rounded-md object-cover` + Confirm/Cancel buttons

### ParamCard Asset Field
- Row: `flex items-center gap-2.5 p-2 bg-black/20 border border-white/5 rounded-md hover:border-white/10 group`
- Thumbnail: `w-8 h-8 rounded object-cover shrink-0 bg-white/5 border border-white/10`
- Label: `text-xs text-gray-300 truncate flex-1 min-w-0`
- Action buttons: `flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`
- Each button: `w-6 h-6 flex items-center justify-center rounded hover:bg-white/15 text-gray-400 hover:text-white`

### Chat Input Enhancement
- Paperclip button left of textarea: `p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/5 shrink-0`
- Pending attachments strip above textarea: `flex gap-2 p-2 overflow-x-auto border-b border-white/5`
- Attachment preview: `w-10 h-10 relative shrink-0`, image `w-full h-full object-cover rounded border border-white/10`
- Remove button: `absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-800 border border-white/10 rounded-full`

### Suggestion Chips Color Coding
- Standard (parameter): existing `bg-white/5 border-white/10 text-gray-300`
- Asset/AI (purple): `bg-purple-500/10 border-purple-500/30 text-purple-200 hover:bg-purple-500/20`
- Micro-thumbnail in chip (for specific assets): `w-4 h-4 rounded-sm object-cover shrink-0`
- General generation chips: `<Sparkles size={14} className="text-purple-400"/>` icon

### Mobile (< 360px)
- Asset preview: force `grid-cols-2`
- Upload request: change "Drag & Drop" to "Tap to choose image", remove scale effect
- ParamCard: actions always visible (no hover reveal), label `truncate`
- Restrict to single file upload per interaction

### Animation
- Block appearance: `animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out`
- Asset swap: `animate-in zoom-in-95 duration-200 fill-mode-both`
- Drop zone: `transition-all duration-200 ease-in-out`

### Accessibility
- Grid: `role="group" aria-label="Asset options"`
- Thumbnails: `aria-label="Asset: {name}. Press to preview or select."`
- Icon buttons: `<span className="sr-only">{action description}</span>`
- Focus: return to textarea after asset selection/upload confirmation

## SESSION_ID
- CODEX_SESSION: 019d4c84-6925-7491-a39a-06265e98501a
- GEMINI_SESSION: fc8d9705-4995-41b2-9a09-6e53e60b4548
