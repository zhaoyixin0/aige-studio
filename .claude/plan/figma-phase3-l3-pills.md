# Figma Phase 3 — L3 分组色标参数药丸实施计划

> Synthesized from Codex (data flow + store integration) + Gemini (visual design + hover states).
> Scope: Step 7 of figma-alignment.md

---

## 📋 实施计划：L3 Grouped Color-Coded Parameter Pills

### 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)

### 技术方案

**核心思路：增强 ParameterPill + 新建 L3PillsPanel + 持久性集成到 StudioChatPanel**

1. 给现有 `ParameterPill` 增加 `colorVariant` prop（默认 `'blue'` 向后兼容）
2. 新建 `L3PillsPanel`：复用 BoardModePanel 的数据派生模式，按 category 分组渲染色标 pills
3. 在 `StudioChatPanel` 中作为持久性组件插入（MessageList 和 SuggestionChips 之间）
4. 点击 pill → 打开 Board Mode

### 实施步骤

#### Step 1: 增强 ParameterPill — colorVariant prop (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/parameter-pill.tsx` | Modify | 添加 colorVariant prop + 颜色映射 |
| `src/ui/chat/__tests__/l3-pills.test.tsx` | Create | pill 颜色测试 |

**颜色映射：**
```ts
type PillColorVariant = 'blue' | 'amber' | 'sky' | 'fuchsia' | 'emerald';

const COLOR_CLASSES: Record<PillColorVariant, { bg: string; text: string; border: string; value: string; hover: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-300',    border: 'border-blue-500/20',    value: 'text-blue-400/70',    hover: 'hover:bg-blue-500/20 hover:text-blue-100' },
  amber:   { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30',   value: 'text-amber-400/70',   hover: 'hover:bg-amber-500/30 hover:text-amber-100' },
  sky:     { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/30',     value: 'text-sky-400/70',     hover: 'hover:bg-sky-500/30 hover:text-sky-100' },
  fuchsia: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30', value: 'text-fuchsia-400/70', hover: 'hover:bg-fuchsia-500/30 hover:text-fuchsia-100' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', value: 'text-emerald-400/70', hover: 'hover:bg-emerald-500/30 hover:text-emerald-100' },
};
```

**向后兼容：** 默认 `colorVariant='blue'`，现有使用处（ModuleCombinationCard）无需改动。

**测试 (3)：**
- 默认蓝色样式
- 指定 amber 时应用 amber 类名
- onClick 时有 hover 类名

---

#### Step 2: 创建 L3PillsPanel (M)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/l3-pills-panel.tsx` | Create | L3 参数药丸面板 |
| `src/ui/chat/__tests__/l3-pills-panel.test.tsx` | Create | 面板测试 |

**数据流（复用 BoardModePanel 模式）：**
```ts
1. config = useGameStore(s => s.config)
2. gameType = config?.meta?.name?.toLowerCase()
3. values = extractRegistryValueMap(config)
4. applicableParams = getParamsForGameType(gameType).filter(p => p.layer === 'L3' && p.exposure !== 'hidden')
5. visibility = resolveVisibility(applicableParams, values)
6. visibleParams = applicableParams.filter(p => visibility.get(p.id)?.visible === true)
7. groups = CATEGORY_ORDER.filter(cat => has params).map(...)
```

**Category → Color 映射：**
```ts
const CATEGORY_VARIANT: Record<string, PillColorVariant> = {
  game_mechanics: 'amber',
  game_objects: 'sky',
  visual_audio: 'fuchsia',
  input: 'emerald',
};
// fallback: 'blue'
```

**值格式化：**
- boolean → '开' / '关'
- number/string → String(value)

**容器样式（Gemini 建议 — 扁平无阴影，与 L1/L2 区分层级）：**
```tsx
<div className="px-4 py-3 space-y-3">
  {groups.map(({ category, params }) => (
    <div key={category}>
      <div className="text-[11px] uppercase text-gray-500 font-semibold tracking-wide mb-1.5">
        {CATEGORY_LABELS[category]}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {params.map(p => <ParameterPill ... colorVariant={variant} onClick={() => setBoardModeOpen(true)} />)}
      </div>
    </div>
  ))}
</div>
```

**空状态：** groups.length === 0 → return null

**测试 (5)：**
- 按 category 正确分组
- 每个 category 使用正确颜色
- 空 category 不渲染
- 无 L3 参数时整个面板不渲染
- 点击 pill 调用 setBoardModeOpen(true)

---

#### Step 3: 集成到 StudioChatPanel (S)

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/studio-chat-panel.tsx` | Modify | 插入 L3PillsPanel |

**位置：** MessageList 和 SuggestionChips 之间，border-t 分隔。

**变更：**
```tsx
<MessageList ... />
<L3PillsPanel />
<SuggestionChips ... />
```

**测试：** 现有 StudioChatPanel 测试通过即可

---

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/parameter-pill.tsx` | Modify | colorVariant prop |
| `src/ui/chat/l3-pills-panel.tsx` | Create | L3 面板 |
| `src/ui/chat/__tests__/l3-pills.test.tsx` | Create | pill 颜色测试 |
| `src/ui/chat/__tests__/l3-pills-panel.test.tsx` | Create | 面板测试 |
| `src/ui/chat/studio-chat-panel.tsx` | Modify | 集成 |

### 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据派生与 BoardModePanel 逻辑漂移 | 复用相同的 getParamsForGameType + resolveVisibility 模式 |
| CATEGORY_ORDER 重复定义 | 可接受（2 处）；若后续第 3 处使用则提取为共享常量 |
| extractRegistryValueMap 缺少某些参数值 | fallback 到 param.defaultValue |
| boolean 值显示 | 统一格式化为 '开'/'关' |

### 预估测试增量: ~8 tests

### Execution Order
```
Step 1: ParameterPill colorVariant — ~15min
Step 2: L3PillsPanel — ~30min
Step 3: StudioChatPanel 集成 — ~10min
```

Total: ~1h

### SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d614d-5d28-7f53-ba90-cd037b7a97a7
- GEMINI_SESSION: (policy mode, no persistent session)
