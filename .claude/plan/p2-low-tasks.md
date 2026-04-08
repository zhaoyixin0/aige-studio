## 实施计划：P2-Low 任务

### 双模型验证结果（Codex + Gemini 2026-04-07）

| 任务 | 状态 | 缺口 |
|------|------|------|
| 4.2 Suggestion Engine | 部分完成 | 缺 missing/enhancement/polish 分层 |
| 4.3 Intent Extraction | 部分完成 | LLM-based，缺 rule-first 兜底 |
| 5.3 L2 Bespoke Cards | 部分完成 | 6 个中只有 2 个（game_mechanics, visual_audio）|
| 5.4 Game Feel Dashboard | **已完成** | tab 替代 collapsible，可接受 |
| 5.5 Diagnostic Popover | 部分完成 | popover 已有，缺 Quick Fix 按钮 |
| 5.6 Chat 验证反馈 | 部分完成 | warning chips 被 V2 chips 覆盖 |

### 优先级评估

按 ROI 排序，选择高价值低成本的修复，跳过过度工程化任务：

| 任务 | 修复价值 | 工作量 | 决策 |
|------|---------|--------|------|
| 5.6 合并 warning chips | 高 | 极小（<10 行）| **执行** |
| 5.5 Quick Fix 按钮 | 高 | 小（~50 行）| **执行** |
| 4.3 Rule-first 意图 | 中 | 小（~30 行）| **执行** |
| 4.2 分层标记 | 低 | 中 | 跳过（V2 设计已替代）|
| 5.3 剩余 4 个 bespoke 卡片 | 中 | 大 | 跳过（2 个已覆盖核心场景）|
| 4.3 Preview 上下文菜单 | 高 | 大 | 跳过（需要 engine hit-test）|

---

## 任务 5.6: Chat 验证反馈 — 合并 warning chips

### 任务类型
- [x] 后端（Agent 层）

### 问题
ConversationAgent.process() 在 create_game 后总是用 `generateV2CreationChips` 设置 `chips`，导致 warning chips 注入逻辑（line 383-389）的 `if (!chips && ...)` 守卫永远不触发。用户看不到 warning chips。

### 实施步骤
**文件：** `src/agent/conversation-agent.ts:383-389`

修改 warning chips 注入逻辑，从"无 chips 才注入"改为"附加在已有 chips 之后（去重）":
```typescript
// Append warning-derived chips to existing chips (deduplicated)
if (this._lastValidationReport && this._lastValidationReport.warnings.length > 0) {
  const warningChips = mapWarningsToChips(this._lastValidationReport.warnings, 2);
  if (warningChips.length > 0) {
    const existingIds = new Set((chips ?? []).map(c => c.id));
    const newWarningChips = warningChips.filter(c => !existingIds.has(c.id));
    if (newWarningChips.length > 0) {
      chips = [...(chips ?? []), ...newWarningChips];
    }
  }
}
```

注意：把 maxChips 降到 2，避免 chip 行过长。

### 关键文件
| 文件 | 操作 |
|------|------|
| src/agent/conversation-agent.ts:383-389 | 修改 warning chips 注入逻辑 |
| src/agent/__tests__/warning-chips.test.ts | 更新（如需要）|

---

## 任务 5.5: Diagnostic Popover — Quick Fix 按钮

### 任务类型
- [x] 前端（UI 层）

### 问题
`src/ui/preview/diagnostic-badge.tsx` 中的 DiagnosticPopover 已显示问题列表，但每个问题没有"Quick Fix"按钮。

### 实施步骤
**文件：** `src/ui/preview/diagnostic-badge.tsx`

在 issue 列表渲染处为每个 warning 添加 Quick Fix 按钮，按 issue.category 分发：
- `missing-input` → 添加 TouchInput 模块（dispatchUIAction 或直接 batchUpdateConfig）
- `event-chain-break` / `invalid-param` → 打开 Board Mode（setBoardModeOpen(true)）
- `module-conflict` → 移除指定 moduleId

参考 `mapWarningsToChips` 的现有 mapping 逻辑保持一致。

伪代码：
```tsx
{issue.category === 'missing-input' && (
  <button onClick={() => handleQuickFix('add-input')} className="quick-fix-btn">
    添加输入模块
  </button>
)}
{issue.category === 'event-chain-break' && (
  <button onClick={() => setBoardModeOpen(true)} className="quick-fix-btn">
    打开调试面板
  </button>
)}
```

### 关键文件
| 文件 | 操作 |
|------|------|
| src/ui/preview/diagnostic-badge.tsx | 添加 Quick Fix 按钮 + handlers |

---

## 任务 4.3: Intent Extraction — Rule-first 兜底

### 任务类型
- [x] 后端（Agent 层）

### 问题
`src/agent/intent-parser.ts` 直接调用 Claude API 做意图分类，每次用户消息都触发 LLM 调用，增加延迟和成本。`src/agent/local-patterns.ts` 已有 regex 规则但未被 intent-parser 利用。

### 实施步骤
**文件：** `src/agent/intent-parser.ts`

在 LLM 调用前加 rule-first 检查：
```typescript
import { tryLocalMatch } from './local-patterns';

async classify(message: string, currentConfig?: GameConfig): Promise<ParsedIntent> {
  // Try rule-based first (zero cost, instant)
  const localMatch = tryLocalMatch(message, currentConfig);
  if (localMatch) {
    return localMatch;
  }
  
  // Fall back to LLM
  // ... existing Claude API code
}
```

需要先确认 `local-patterns.ts` 的 `tryLocalMatch` 签名是否兼容 ParsedIntent 类型，如不兼容则添加 adapter 函数。

### 关键文件
| 文件 | 操作 |
|------|------|
| src/agent/intent-parser.ts | classify() 添加 rule-first 兜底 |

---

### 跳过的任务

**4.2 Suggestion Engine 分层** — 当前 V2 设计是"创建后展示固定 board_mode + L1 控件"的简洁路径，分层会让 chip 行变得复杂。MASTER-PLAN 的分层设计与 V2 演化方向冲突，跳过。

**5.3 剩余 4 个 bespoke 卡片** — game_mechanics 和 visual_audio 已覆盖核心场景，sfx/feedback-effect 等属于细分优化，工作量大但用户感知小，跳过。

**4.3 Preview 上下文菜单** — 需要在 PixiJS engine 中实现 hit-test + DOM 上下文菜单的协调，工作量大且 P2-Low 优先级低。当前用户已可通过 Board Mode 编辑，跳过。

---

### 验证
- `npx vitest run`
- `npm run build`

### SESSION_ID
- CODEX_SESSION: 019d6b8e-d6db-71b2-8515-7a4fb40ead82
- GEMINI_SESSION: N/A
