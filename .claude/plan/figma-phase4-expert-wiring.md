# Figma Phase 4 — Expert Browser Entry Wiring 实施计划

> Synthesized from Codex (store API + data flow) + Gemini (UX + visual design).
> Scope: Step 8 of figma-alignment.md

---

## 📋 实施计划：Expert Browser Entry Wiring

### 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)

### 技术方案

**核心思路：editor-store 全局状态 + 两处挂载 + 三个触发入口**

1. editor-store 新增 `expertBrowserOpen` / `expertBrowserGameType` / `setExpertBrowserOpen`
2. LandingPage: "浏览专家模板" 按钮 + 挂载 ExpertBrowser
3. GameTypeSelector: expert badge 变为可点击按钮 → 打开 ExpertBrowser filtered
4. StudioChatPanel: 挂载 ExpertBrowser

### 实施步骤

#### Step 1: editor-store 状态扩展 (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/store/editor-store.ts` | Modify | 添加 expert browser 状态 |

**新增状态：**
```ts
expertBrowserOpen: boolean;           // default: false
expertBrowserGameType: string | null; // default: null
setExpertBrowserOpen: (open: boolean, gameType?: string | null) => void;
```

**setExpertBrowserOpen 逻辑：**
- open=true: set `expertBrowserOpen: true, expertBrowserGameType: gameType ?? null`
- open=false: set `expertBrowserOpen: false, expertBrowserGameType: null`

**测试 (2)：**
- setExpertBrowserOpen(true, 'catch') → opens with gameType
- setExpertBrowserOpen(false) → closes and resets gameType to null

---

#### Step 2: LandingPage 入口 + ExpertBrowser 挂载 (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/landing/landing-page.tsx` | Modify | 添加浏览按钮 + 挂载 ExpertBrowser |

**变更：**
1. 在 FeaturedExpertChip 旁添加 "浏览专家模板" 按钮（紫色次要风格，与 FeaturedExpertChip 同区域）
2. 挂载 ExpertBrowser，连接 store 状态
3. onUsePreset → 调用已有 handleSubmit("使用模板 <id>") + close modal

**按钮样式（Gemini 建议 — 次要紫色调，与 FeaturedExpertChip 协调）：**
```tsx
<button
  type="button"
  onClick={() => setExpertBrowserOpen(true)}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
    text-purple-400 hover:text-purple-200 hover:bg-purple-500/10
    border border-purple-500/20 hover:border-purple-400/40
    transition-colors duration-200"
>
  浏览全部专家模板
</button>
```

**测试 (2)：**
- 浏览按钮点击 → expertBrowserOpen = true
- onUsePreset 提交 "使用模板 xxx" 并关闭 modal

---

#### Step 3: GameTypeSelector badge 可点击 (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/game-type-selector.tsx` | Modify | Badge 改为 button, 点击打开 ExpertBrowser |

**变更：**
- expert badge `<span>` → `<button>` with `onClick + e.stopPropagation()`
- 点击 → `setExpertBrowserOpen(true, option.id)` (filtered by game type)
- 添加 hover 交互反馈

**测试 (2)：**
- badge 点击打开 ExpertBrowser with correct gameType
- badge 点击不触发 game type 选择（stopPropagation）

---

#### Step 4: StudioChatPanel 挂载 ExpertBrowser (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/studio-chat-panel.tsx` | Modify | 挂载 ExpertBrowser |

**变更：**
```tsx
<ExpertBrowser
  isOpen={expertBrowserOpen}
  onClose={() => setExpertBrowserOpen(false)}
  onUsePreset={(id) => { setExpertBrowserOpen(false); submitMessage(`使用模板 ${id}`); }}
  initialGameType={expertBrowserGameType ?? undefined}
/>
```

**测试：** 现有 StudioChatPanel 测试通过即可

---

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/store/editor-store.ts` | Modify | expert browser 状态 |
| `src/ui/landing/landing-page.tsx` | Modify | 浏览按钮 + 挂载 ExpertBrowser |
| `src/ui/chat/game-type-selector.tsx` | Modify | Badge 可点击 |
| `src/ui/chat/studio-chat-panel.tsx` | Modify | 挂载 ExpertBrowser |

### 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| ExpertBrowser 在两处挂载 | isOpen=false 时返回 null，零渲染开销；两阶段布局同一时间仅一个活跃 |
| Badge stopPropagation 可能影响其他事件 | 仅阻止 click 冒泡到 card confirm，不影响 hover/focus |
| onUsePreset 提交消息后 landing→studio 过渡 | 复用现有 handleSubmit 流程，config 创建后自动过渡 |

### 预估测试增量: ~6 tests

### Execution Order
```
Step 1: editor-store 状态 — ~5min
Step 2: LandingPage 入口 — ~15min
Step 3: GameTypeSelector badge — ~10min
Step 4: StudioChatPanel 挂载 — ~5min
```

Total: ~35min

### SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d6160-9ec3-7f73-8e44-53f8fa18ecd7
- GEMINI_SESSION: (policy mode, no persistent session)
