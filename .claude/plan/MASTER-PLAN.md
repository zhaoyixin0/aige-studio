# AIGE Studio — 未完成任务总表

> 整合自 42 个计划文件，仅保留经验证尚未完成的任务。
> 更新日期：2026-04-08（审计后大规模收敛）
> **本次审计删除了 17 项已实现条目**，详见底部"2026-04-08 审计存档"

---

## 一、引擎可靠性与质量 (Engine Reliability)

### 1.3 Asset fulfillment 竞态保护
**来源：** engine-reliability-hardening.md M5
**状态：** 未完成（`studio-chat-panel.tsx` 中无 configVersion 校验）
**文件：** `src/ui/chat/studio-chat-panel.tsx`
**操作：** triggerAssetFulfillment 中捕获 configVersion，callback 中校验 currentVersion === capturedVersion 再应用，防止旧素材注入新游戏
**风险：** 用户连续创建多个游戏时，旧的 Gemini 异步回调可能把过时素材写入新游戏

---

## 四、交互设计剩余阶段 (Interaction Redesign P1-P3)

### 4.1 P1: Three-View Layout + Paste/Drop
**来源：** interaction-redesign-p0-p3-v2.md P1
**状态：** 未开始（无 chat-preview-page.tsx / sandbox-page.tsx；layoutPhase 仅 'landing'|'studio'）
**新文件：** `chat-preview-page.tsx`, `sandbox-page.tsx`
**修改文件：** `main-layout.tsx`, `landing-page.tsx`, `editor-store.ts`, `studio-chat-panel.tsx`, `asset-browser.tsx`
**内容：**
- 三视图布局（Chat + Preview + Editor 可独立切换）
- 图片粘贴/拖拽到聊天输入框 → 自动附加为 Attachment
- Asset browser 面板与聊天集成

### 4.2 P2: Context-Aware Suggestions
**来源：** interaction-redesign-p0-p3-v2.md P2
**状态：** 未开始（无 suggestion-engine.ts）
**新文件：** `src/agent/suggestion-engine.ts`
**修改文件：** `conversation-agent.ts`, `suggestion-chips.tsx`, `studio-chat-panel.tsx`
**内容：**
- 动态建议引擎：根据当前配置状态、缺失模块、素材状态生成上下文感知建议
- 建议分层：missing → enhancement → polish
- 替换硬编码 chip 列表

### 4.3 P3: Intent Extraction + Board Interaction
**来源：** interaction-redesign-p0-p3-v2.md P3
**状态：** 未开始（无 intent-extractor.ts）
**新文件：** `src/agent/intent-extractor.ts`
**修改文件：** `conversation-agent.ts`, `landing-page.tsx`, `preview-canvas.tsx`
**内容：**
- 意图提取器：从自由文本中解析结构化意图（不依赖 LLM）
- 预览画布交互：点击游戏元素触发上下文菜单（修改参数/替换素材）
- Landing 页面意图引导

---

## 五、UI 增强 (UI Enhancements)

### 5.2 GameTypeSelector 搜索 & 分类
**来源：** m0-execution-plan.md F2-F3
**状态：** 未开始（无 game-search-bar.tsx）
**新文件：** `src/ui/chat/game-search-bar.tsx`
**修改文件：** `src/ui/chat/game-type-selector.tsx`
**操作：**
- 搜索栏（Tailwind 圆角输入框）+ 8 分类标签横向滚动
- 默认显示 Top 6，"Show More (32)" 展开按钮
- 缩略图卡片 + "Supported"/"Coming Soon" 徽章

### 5.3 L2 Bespoke 参数卡片（设计可能已收敛）
**来源：** figma-alignment.md Step 5-6
**状态：** ⚠️ PARTIAL — 已存在 `src/ui/chat/bespoke-cards/`，含 `game-mechanics-card.tsx` + `visual-audio-card.tsx` 两个大类卡片，但原计划列的 6 个细分卡片（game-conditions, player-actor, enemy-actor, sfx, visual-styles, feedback-effect）未实现
**待决策：** 当前 2 大类设计是有意收敛还是缺失？需要确认是否还要拆出 6 个细分卡片
**如果需要继续做：**
- 新文件：`src/ui/chat/bespoke-cards/{game-conditions,player-actor,enemy-actor,sfx,visual-styles,feedback-effect}.tsx`
- 路由：`card-shell.tsx` 中根据 category 分发到专属组件
- 每卡片含特定控件组合（Slider+Dropdown+Toggle+ImagePicker）

### 5.6 Chat 验证反馈
**来源：** game-quality-validation.md Step 7
**状态：** 未完成（ValidationReport 已在 useEngine 处理但未注入 chat 消息）
**文件：** `src/ui/chat/studio-chat-panel.tsx`
**操作：** 配置生成后如有 ValidationReport warnings → 添加 assistant 消息 + suggestion chips（"修正这个" / "我了解了"）

---

## 六、E2E 测试 (End-to-End Testing)

### 6.1 Playwright E2E 测试套件 — P1/P2 扩展
**来源：** e2e-test-plan.md
**状态：** ⚠️ PARTIAL — `qa-e2e/tests/` 已有 5 个 spec（landing / game creation / preview lifecycle / multi-gametype / bug discovery），覆盖 P0；P1/P2 spec 未写
**剩余：**
- `06-expert-presets.spec.ts` — Expert Browser 搜索/过滤/使用
- `07-module-editor.spec.ts` — 模块列表/属性/参数修改
- `08-board-mode.spec.ts` — 打开/调参/关闭/回归
- `09-share-link.spec.ts` — 生成/加载/中文保留
- `10-asset-management.spec.ts` — 上传/删除
- `11-conversation-agent.spec.ts` — [需 API] 多轮对话
- `12-responsive.spec.ts` — 桌面/平板/手机布局
**关键约束（2026-04-08 加入）：** 任何覆盖 AI 生成路径的 spec，**单步 timeout 必须 ≥ 180 秒**。Gemini-3-pro-image-preview 单张 50-95s，5 张串行 ~150s。如果用 Playwright 默认 30s 会触发 ERR_ABORTED 假阴性（参见 memory/project_e2e_v2_issues.md 教训）。

---

## 七、AI 生成 UX 优化 (AI Generation UX)

> 来源：E2E V2 investigation 2026-04-08。原 memory 误报"AI 链路崩溃 8/100"实际是后端正常但前端反馈缺失的 UX 问题。
> 三条任务文件耦合度高（共享 asset-agent.ts / studio-chat-panel.tsx / conversation-agent.ts），建议合并为一个 PR。

### 7.1 AI 生成进度反馈
**来源：** E2E V2 investigation 2026-04-08
**Why:** Gemini-3-pro-image-preview 单张 50-95s，5 张串行 ~150s 是已知现实。当前 UI 只有"思考中..."占位，用户在 60+ 秒无任何信号时会认为应用挂了 → 刷新页面 → 全部状态丢失。
**文件：**
- `src/services/asset-agent.ts` — 新增 progress 事件 emit
- `src/agent/conversation-agent.ts` — 桥接进度到 chat 状态
- `src/ui/chat/studio-chat-panel.tsx` — 渲染进度文本
**操作：**
1. asset-agent 在每张 sprite 开始/结束时 emit `{phase:'asset', current:N, total:M, label:'草莓'}` 事件
2. ConversationAgent 把进度状态写入 active assistant message 的 metadata
3. Chat panel 把"思考中..."替换为"Generating sprite 2/5: 草莓..."
**测试：** 单元测试 asset-agent 的 progress emit 顺序；E2E 测试观察 chat message 文本变化

### 7.2 AI 请求 Cancel 按钮
**来源：** E2E V2 investigation 2026-04-08
**Why:** 用户中途想放弃只能刷新页面，丢失输入和已生成素材。
**文件：**
- `src/services/gemini-image.ts` — `callAPI` 接受 `AbortSignal`
- `src/services/claude-proxy.ts` — `messages.create` 接受 `AbortSignal`
- `src/services/asset-agent.ts` — 持有 AbortController + 暴露 `cancel()`
- `src/ui/chat/studio-chat-panel.tsx` — 进行中显示"取消生成"按钮
**操作：**
1. 所有 fetch 调用透传 AbortSignal
2. asset-agent 单实例化 AbortController per generation session
3. cancel 后保留之前已成功的 sprite，只丢弃未完成的
4. UI 显示"已取消，保留 N 张素材"提示
**测试：** mock fetch + AbortController 测试取消后 promise rejects with AbortError 且已生成的 sprite 保留

### 7.3 Per-asset 流式预览
**来源：** E2E V2 investigation 2026-04-08
**Why:** 每张素材成功后立即可见比等到 150s 全部完成更让人安心。已经在 99-final.png 看到 chat panel 有 asset 占位区，只缺增量绑定。
**文件：**
- `src/services/asset-agent.ts` — emit `asset:ready {id, dataUrl}` 事件
- `src/ui/chat/studio-chat-panel.tsx` — 接收事件 → 更新 message blocks 中的 asset 缩略图
**操作：**
1. asset-agent 完成单张 sprite → 立即 emit `asset:ready` 事件并把素材写入 game store（不等其他完成）
2. Chat panel 在生成中的 message 内嵌入 N×缩略图 grid（占位 → 真实图渐进显示）
3. PixiRenderer 已支持 hot-swap，自动反映新素材
**测试：** 时序测试验证 sprite N 在 Promise.all 完成前已写入 store；视觉回归测试缩略图 grid 渲染

---

## 优先级排序（审计后）

| 优先级 | 任务 | 估算 | 风险/价值 |
|--------|------|------|----------|
| **P0-Critical** | 1.3 Asset 竞态保护 | 30min | 数据错乱 |
| **P1-Medium** | 7.1 AI 生成进度反馈 | 1.5h | V2 8/100 假阴性根因，最大感知改善 |
| **P1-Medium** | 5.6 Chat 验证反馈 | 1h | 闭环 ConfigValidator |
| **P2-Medium** | 7.2 AI 请求 Cancel 按钮 | 1h | 用户控制权 |
| **P2-Medium** | 7.3 Per-asset 流式预览 | 1.5h | 减少感知延迟 |
| **P2-Medium** | 4.1 Three-View Layout | 3h | 布局增强 |
| **P2-Medium** | 5.2 GameType 搜索 | 1h | 38 类型导航 |
| **P2-Low** | 4.2 P2 建议引擎 | 2h | 智能建议 |
| **P2-Low** | 4.3 P3 Intent Extraction | 2h | 深层交互 |
| **P3-Decision** | 5.3 L2 卡片细分 | 2h | 设计待决：2 大类 vs 6 细分 |
| **P3-Low** | 6.1 E2E 测试 P1/P2 扩展 | 3h | 扩展覆盖 |

**合计：** 9 项实现 + 1 项设计决策 + 1 项测试扩展 = 11 项 ≈ **18 小时工时**

---

## 2026-04-08 审计存档 — 已验证完成的 17 项

通过子代理对每条任务的文件/符号做了直接验证，以下 17 项已在 2026-04-07 之前完成，本次从 MASTER-PLAN 移除：

| 编号 | 原任务 | 验证证据 |
|------|--------|---------|
| 1.1 | touch-action:none | `use-engine.ts:121` `canvas.style.touchAction = 'none'` |
| 1.2 | useEngine 卸载安全 | `use-engine.ts:145` cleanup 中 `engineRef.current?.restart()` |
| 1.4 | ConfigLoader strict 模式 | `config-loader.ts:49` strict flag + 错误 throw |
| 1.5 | ConversationAgent 验证集成 | `conversation-agent.ts:164` `buildGameConfig()` 调用 validateConfig |
| 1.6 | gameflowPaused 合规审计 | 多模块已有 gameflowPaused 检查 + BaseModule 基础设施 |
| 1.7 | Per-frame asset hash 优化 | `game-object-renderer.ts` 使用引用相等 `lastAssetsRef !== currentAssets` |
| 2.1 | Renderer config 不可变性 | `pixi-renderer.ts:122-187` `syncBackgroundImage` 只读不写 |
| 2.2 | Shield/Camera/Gravity 动态 consumes | `shield.ts:35`, `gravity.ts:68`, `camera-follow.ts:76` 均有动态参数 |
| 2.3 | EventBus error 日志门控 | `event-bus.ts:44,62` console.error 已被 debug 模式门控 |
| 3.1 | SkillLoader 集成 | `conversation-helpers.ts` 调用 `loadForConversation` |
| 3.2 | UI-intent 工具定义 | `conversation-defs.ts` 含 `request_asset_replace`/`generate`/`show_previews` |
| 3.3 | mapConfigToParamCard | `conversation-helpers.ts` 定义，`conversation-agent.ts:168` 调用 |
| 5.1 | FPS 计数器 Overlay | `src/ui/preview/fps-overlay.tsx` 存在，`editor-store.ts` 含 showFpsOverlay |
| 5.4 | Game Feel Dashboard 集成 | `editor-panel.tsx` 已 import + mount `GameFeelScore` |
| 5.5 | Diagnostic Popover | `diagnostic-badge.tsx:45` 点击触发 DiagnosticPopover |
| 6.1 | E2E 测试 P0 部分 | `qa-e2e/tests/` 已有 5 个 P0 spec |

---

## 已完成计划存档（历史）

以下计划已通过 git 提交完全实现，原文件已删除：

| 计划 | 完成提交 | 说明 |
|------|---------|------|
| m0-execution-plan | baa456b, f989ea6 | M0 知识应用层 22 步全部完成 |
| m1-tween-completion | 852a869 | Tween 渲染器 + 桥接 + 预设 |
| m2-physics2d-completion | 01a65a4 | Physics2D 渲染器 + 桥接 + 调试 |
| m3-scrolling-layers-completion | fa73bef, e46ffe8 | 视差渲染器 + 桥接 |
| m4-recipe-runner-completion | f78fbeb, 505af6d | Facade + use_preset + UI |
| m5-expert-data-ingest | 3a65376 | 80 JSON → 60 专家预设 |
| m6-expert-ui | 679a9d0 | Expert Browser + 徽章 + 精选 |
| figma-alignment (Phase 1-4) | f157490, 575a72d, 06bda85, 2ad6fb3 | L1 控件 + L3 Pills + Expert 连线 |
| p0-chatblock-infrastructure | d75305b | 类型 + 渲染器 + Store 扩展 |
| p0-runtime-wiring | baa456b | M0 管线运行时桥接 |
| p0-remaining-presets-knowledge-chips | f989ea6, 99099d2 | 38 游戏类型 + 知识扩展 |
| p1-selector-recipes-knowledge | 58f5a05 | GameTypeSelector + Recipe 注入 |
| contract-based-autowiring | 多次提交 | 4 阶段自动连线 |
| contract-full-migration | 多次提交 | 71 个模块 getContracts() |
| game-quality-fix | 多次提交 | Shooting/RPG 可玩 |
| high-priority-expansion | 多次提交 | 3 批次 29 个模块 |
| shooter-rpg-rendering | 多次提交 | ShooterRenderer + RPGOverlay |
| hud-refactor-knowledge-review | 多次提交 | HUD 拆分为 4 个子渲染器 |
| fix-player-movement-follow | 多次提交 | 双监听冲突 + 坐标修复 |
| fix-preset-offline | c462078 | 模板离线回退 |
| board-mode-4-controls-fix | 442a22c | Board Mode 控制修复 |
| board-mode-asset-bugfix | 3bca50d | Asset 预览刷新 |
| phase6-delete-hardcoded-maps | 多次提交 | KNOWN_MODULE_TYPES 已删除 |
