# 实施计划：5.6 + 7.2 + 5.2 + 4.1 四任务联合规划

> 双模型协作分析（Codex + Gemini）→ Claude 综合
> 生成日期：2026-04-09
> 预估总工时：~6h（原估 ~14h，5.2/4.1 大幅缩减因已有基础设施）

---

## 📋 Task 5.6 — Chat ValidationReport 反馈 (~1h)

### 任务类型
- [x] 前端
- [ ] 后端
- [x] 全栈（store + hook + UI）

### 技术方案

新增 `validation-summary` ChatBlock 类型，在 config 验证后注入 assistant 消息。支持可更新状态（修正后 block 变为"已解决"）。

**核心逻辑**：`use-conversation-manager.ts` 在 `validateConfig` 后检查 `report.errors.length + report.warnings.length > 0`，如果有 → 构建 validation-summary block → 通过 `addChatMessage` 注入 assistant 消息。

### 实施步骤

**Step 1: 扩展 ChatBlock 类型定义**
- 文件：`src/agent/conversation-defs.ts`
- 新增 ChatBlock 变体：
```typescript
| {
    kind: 'validation-summary';
    summary: string;
    issues: ReadonlyArray<{
      severity: 'error' | 'warning';
      title: string;
      description: string;
    }>;
    fixable: boolean;       // 是否有可自动修复的项
    resolved?: boolean;     // 修正后更新为 true
  }
```

**Step 2: 创建 ValidationSummaryBlock 渲染组件**
- 文件：`src/ui/chat/validation-summary-block.tsx`（新建，~80 行）
- 渲染：severity 图标（红/黄）+ issue 列表 + 两个 action 按钮
- "修正这个"按钮：调用 `applyFixes` + `setConfig` + `loadConfig` + 更新 block.resolved=true
- "我了解了"按钮：折叠/隐藏 block
- resolved 状态下显示绿色"已修正 N 项"

**Step 3: 注册到 ChatBlockRenderer**
- 文件：`src/ui/chat/chat-block-renderer.tsx`
- 添加 `case 'validation-summary':` → `<ValidationSummaryBlock />`

**Step 4: use-conversation-manager 注入验证消息**
- 文件：`src/app/hooks/use-conversation-manager.ts`（~lines 99-101 后）
- 在 `const report = validateConfig(fixedConfig)` 后：
```typescript
if (report.errors.length + report.warnings.length > 0) {
  const issues = [...report.errors, ...report.warnings].map(issue => ({
    severity: issue.severity,
    title: translateIssue(issue).title,
    description: translateIssue(issue).description,
  }));
  addChatMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `配置验证发现 ${report.errors.length} 个错误和 ${report.warnings.length} 个警告`,
    blocks: [{
      kind: 'validation-summary',
      summary: `${report.errors.length} 错误, ${report.warnings.length} 警告`,
      issues,
      fixable: report.fixes.length > 0,
    }],
    timestamp: Date.now(),
  });
}
```

**Step 5: 更新 editor-store**
- 文件：`src/store/editor-store.ts`
- 新增 `updateChatMessageBlock(messageId, blockIndex, updater)` action（如不存在）
- 用于 "修正这个" 后把 resolved 设为 true

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/conversation-defs.ts` | 修改 | 扩展 ChatBlock union |
| `src/ui/chat/validation-summary-block.tsx` | 新建 | 验证摘要渲染 + 操作按钮 |
| `src/ui/chat/chat-block-renderer.tsx` | 修改 | 注册新 block 类型 |
| `src/app/hooks/use-conversation-manager.ts` | 修改 | 注入验证消息逻辑 |
| `src/store/editor-store.ts` | 修改 | updateChatMessageBlock action |
| `src/ui/preview/diagnostic-messages.ts` | 读取 | 复用 translateIssue |

### 风险与缓解

| 风险 | 缓解 |
|------|------|
| 与 DiagnosticBadge 信息重复 | Chat block 只做轻量摘要 + 操作入口，详细信息仍由 badge popover 承载 |
| 连续多轮验证消息堆积 | applyFixes 后更新现有 block.resolved 而非发新消息 |
| translateIssue 可能不在公开 export | 检查是否需要 re-export |

---

## 📋 Task 7.2 — AI Cancel 按钮 (~1h)

### 任务类型
- [x] 前端
- [x] 后端（service 层）
- [x] 全栈

### 技术方案

AbortSignal 全链路穿透：`gemini-image.ts` / `claude-proxy.ts` 的 `fetch` 接受 signal → `asset-agent.ts` 传入 → `useStreamingAssetFulfillment` 暴露 `cancel()` + `isActive` → UI 在生成中将发送按钮替换为停止按钮。

### 实施步骤

**Step 1: gemini-image.ts 接受 AbortSignal**
- 文件：`src/services/gemini-image.ts`
- `callAPI(promptText, options?)` → `callAPI(promptText, options?, signal?: AbortSignal)`
- 在 `fetch('/api/gemini', ...)` 的 init 对象里加 `signal`
- `generateImage` / `generateImageWithChromaKey` 等公开方法也透传 signal

**Step 2: claude-proxy.ts 接受 AbortSignal**
- 文件：`src/services/claude-proxy.ts`
- `create(params)` → `create(params, signal?: AbortSignal)`
- 在 `fetch('/api/claude', ...)` 的 init 对象里加 `signal`

**Step 3: asset-agent.ts 传递 signal 到下游**
- 文件：`src/services/asset-agent.ts`
- `fulfillAssets` 循环中的 Gemini 调用已有 signal 检查点，补上 `this.abortController.signal` 传入 `geminiService.generateImage(..., signal)`
- bg-removal 阶段（`@imgly/background-removal`）不支持 AbortSignal，保持现有行为：signal 在 bg-removal 前后各检查一次

**Step 4: useStreamingAssetFulfillment 暴露 cancel**
- 文件：`src/app/hooks/use-streaming-asset-fulfillment.ts`
- 新增状态：`const [isActive, setIsActive] = useState(false)`
- 新增 ref：`agentRef`（当前 AssetAgent 实例）、`messageIdRef`（当前进度消息 ID）
- 新增 `cancel()` 方法：
  1. `agentRef.current?.abortController?.abort()`
  2. `setIsActive(false)`
  3. 更新 progress message：内容改为 `"已取消，保留 ${appliedCount}/${total} 张素材"`
  4. 移除 progress-log block，保留 asset-preview block
- 返回值扩展：`{ triggerStreamingFulfillment, cancel, isActive }`

**Step 5: UI 发送→停止按钮切换**
- 文件：`src/ui/chat/studio-chat-panel.tsx`
- 从 hook 获取 `{ cancel, isActive }`
- 在 chat input 的发送按钮区域：
  - `isActive && !isChatLoading` → 渲染 `Square`（停止）图标按钮，onClick=cancel
  - 否则 → 保持原发送按钮
- 样式：红色底 ghost button，与 ChatGPT 停止按钮范式一致

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/gemini-image.ts` | 修改 | callAPI + 公开方法加 signal 参数 |
| `src/services/claude-proxy.ts` | 修改 | create 加 signal 参数 |
| `src/services/asset-agent.ts` | 修改 | 传 signal 到 gemini/claude 调用 |
| `src/app/hooks/use-streaming-asset-fulfillment.ts` | 修改 | 暴露 cancel() + isActive |
| `src/ui/chat/studio-chat-panel.tsx` | 修改 | 发送/停止按钮切换 |

### 风险与缓解

| 风险 | 缓解 |
|------|------|
| bg-removal 期间取消，半成品素材 | signal 在 bg-removal 前后检查，不会生成中间状态的 asset |
| 取消后 fetch 仍在 pending | 乐观 UI 更新，fetch resolve 后 AssetAgent 检查 signal.aborted 直接 return |
| 多次快速点击取消 | cancel() 幂等，abort 已 aborted 的 controller 是 no-op |

---

## 📋 Task 5.2 — GameTypeSelector 数据补全 (~30min，降级自 1h)

### 任务类型
- [x] 前端
- [ ] 后端

### 技术方案

**UI 层已完整**（search + category tabs + show-more + card layout 全部存在）。只需补全数据层：从完整游戏类型目录构建 options，标记 `supportedToday` 和 `category`，可选加 `thumbnailUrl`。

### 实施步骤

**Step 1: 创建完整游戏类型目录适配器**
- 文件：`src/agent/game-type-options.ts`（已存在，检查是否有 `buildFullGameTypeOptions`）
- 如不存在，新建一个 helper：从 `conversation-defs.ts` 的 `GAME_TYPE_DESCRIPTIONS` + `ALL_MODULES` 提取所有游戏类型
- 标记 `supportedToday`：检查是否在 `game-presets.ts` 中有对应 preset
- 标记 `category`：从已有分组数据（如果有）或手动映射 8 个分类

**Step 2: StudioChatPanel 传递完整 options**
- 文件：`src/ui/chat/studio-chat-panel.tsx`
- 构建 GameTypeSelector 时，使用 `buildFullGameTypeOptions()` 替代从 chips 提取的子集
- 保持 DEFAULT_CHIPS 不变（用于 landing page suggestion chips）

**Step 3: GameTypeOption 接口扩展（如需）**
- 文件：`src/ui/chat/game-type-selector.tsx`
- 检查 `GameTypeOption` 是否已有 `thumbnailUrl?: string` 字段
- 如无，新增可选字段；`GameTypeCard` 组件增加 `<img>` fallback 逻辑

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/game-type-options.ts` | 修改/新建 helper | 完整目录 → GameTypeOption[] |
| `src/ui/chat/studio-chat-panel.tsx` | 修改 | 传完整 options 给 selector |
| `src/ui/chat/game-type-selector.tsx` | 可能微调 | thumbnailUrl 字段 + img fallback |

### 风险与缓解

| 风险 | 缓解 |
|------|------|
| 某些游戏类型缺少 category 映射 | 兜底为 "其他" 分类 |
| 暂无缩略图资源 | thumbnailUrl 可选，fallback 到 emoji |

---

## 📋 Task 4.1 — Three-View Layout + Asset Browser 集成 (~2.5h，降级自 3h)

### 任务类型
- [x] 前端
- [ ] 后端

### 技术方案

**Paste/Drop 已通过 `useChatInputPaste` 实现**，无需重做。核心改动：
1. 双分隔条三面板布局（Chat / Preview / Editor 独立可见、可调宽）
2. Asset Browser 从 chat 面板可访问（drawer 或 modal）

### 实施步骤

**Step 1: editor-store 扩展面板状态**
- 文件：`src/store/editor-store.ts`
- 新增状态：
```typescript
chatVisible: boolean;      // default true
editorVisible: boolean;    // default false (原 editorExpanded 重命名)
chatWidth: number;         // default 480
editorWidth: number;       // default 320
```
- 新增 actions：`toggleChatVisible`, `toggleEditorVisible`, `setChatWidth`, `setEditorWidth`
- 保持 `editorExpanded` 作为 `editorVisible` 的别名以向后兼容
- 可选：persist widths 到 localStorage

**Step 2: main-layout.tsx 双分隔条布局**
- 文件：`src/ui/layout/main-layout.tsx`
- Studio 阶段布局改为：
```
[Chat (chatWidth, if chatVisible)]
[Divider A]
[Preview (flex-1, always visible)]
[Divider B (if editorVisible)]
[Editor (editorWidth, if editorVisible)]
```
- 左分隔条：复用现有 `useResizeDivider`，绑定 `setChatWidth`
- 右分隔条：新建第二个 `useResizeDivider` 实例，绑定 `setEditorWidth`，方向翻转（拖右=缩小）
- 面板切换工具栏：在 Preview 顶部或底部加小按钮组 `[Chat] [Editor]` toggle
- fullscreen 模式下只渲染 Preview
- Board Mode overlay 只在 `chatVisible` 时挂载

**Step 3: useResizeDivider 支持方向参数**
- 文件：`src/app/hooks/use-resize-divider.ts`（如已存在）
- 检查是否支持 `direction: 'left' | 'right'`；右侧分隔条需要反转 delta
- 如不支持，添加方向参数 + min/max 约束

**Step 4: Asset Browser drawer**
- 文件：`src/ui/chat/studio-chat-panel.tsx`
- 在 chat input 区域加一个"素材库"按钮（Image 图标）
- 点击后在 chat 面板内显示 `<AssetBrowser />` 作为 slide-up drawer（类似 Board Mode 的 absolute 定位）
- 选中素材后：关闭 drawer + 把素材信息附加到当前消息上下文
- 复用现有 `src/ui/assets/asset-browser.tsx` 组件

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/store/editor-store.ts` | 修改 | 新增面板可见性/宽度状态 |
| `src/ui/layout/main-layout.tsx` | 修改 | 双分隔条 + 面板切换 |
| `src/app/hooks/use-resize-divider.ts` | 修改 | 方向参数支持 |
| `src/ui/chat/studio-chat-panel.tsx` | 修改 | Asset Browser 按钮 + drawer |

### 风险与缓解

| 风险 | 缓解 |
|------|------|
| 三面板在窄屏下挤压 | min-width 约束（chat≥280, editor≥240, preview≥400）；面板可完全隐藏 |
| Board Mode 与 chatVisible 冲突 | chatVisible=false 时自动关闭 boardModeOpen |
| 双分隔条拖拽性能 | useResizeDivider 已用 pointer capture + requestAnimationFrame |
| editorExpanded 向后兼容 | 保留为 editorVisible 的 selector 别名 |

---

## 执行顺序 & 依赖

```
5.6 ValidationReport ─────────────────┐
                                      ├──→ 完成后 npm run build 验证
7.2 AI Cancel ────────────────────────┘
            ↓ (共享 studio-chat-panel.tsx)
5.2 GameTypeSelector 数据补全 ──────────→ 独立，可并行
            ↓
4.1 Three-View Layout ─────────────────→ 最后做（涉及 main-layout 大改）
```

**建议**：5.6 → 7.2 顺序执行（共享文件），5.2 可与前两个并行。4.1 最后。

---

## SESSION_ID

- CODEX_SESSION: `019d7082-8437-7433-be27-049b9a9ca395`
- GEMINI_SESSION: N/A（直接调用，无可复用 session）
