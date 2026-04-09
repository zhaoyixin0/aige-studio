# AIGE Studio — 未完成任务总表

> 整合自 42 个计划文件，仅保留经验证尚未完成的任务。
> 更新日期：2026-04-09（5.6/7.2/5.2/4.1 四任务落地后三次收敛）
> **审计累计移除 24 项已实现条目**（17 项 2026-04-08 审计 + 3 项 `fe7826b` 流式资产 + 4 项 2026-04-09 四任务），详见底部"审计存档"

---

## 四、交互设计剩余阶段 (Interaction Redesign P1-P3)

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

### 5.3 L2 Bespoke 参数卡片（设计可能已收敛）
**来源：** figma-alignment.md Step 5-6
**状态：** ⚠️ PARTIAL — 已存在 `src/ui/chat/bespoke-cards/`，含 `game-mechanics-card.tsx` + `visual-audio-card.tsx` 两个大类卡片，但原计划列的 6 个细分卡片（game-conditions, player-actor, enemy-actor, sfx, visual-styles, feedback-effect）未实现
**待决策：** 当前 2 大类设计是有意收敛还是缺失？需要确认是否还要拆出 6 个细分卡片
**如果需要继续做：**
- 新文件：`src/ui/chat/bespoke-cards/{game-conditions,player-actor,enemy-actor,sfx,visual-styles,feedback-effect}.tsx`
- 路由：`card-shell.tsx` 中根据 category 分发到专属组件
- 每卡片含特定控件组合（Slider+Dropdown+Toggle+ImagePicker）

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
> **7.1 + 7.2 + 7.3 + 1.3（加强版）全部落地**（`fe7826b` + `62b9825`）。本章已清空。

---

## 优先级排序（2026-04-09 四任务落地后）

| 优先级 | 任务 | 估算 | 风险/价值 |
|--------|------|------|----------|
| **P2-Low** | 4.2 P2 建议引擎 | 2h | 智能建议 |
| **P2-Low** | 4.3 P3 Intent Extraction | 2h | 深层交互 |
| **P3-Decision** | 5.3 L2 卡片细分 | 2h | 设计待决：2 大类 vs 6 细分 |
| **P3-Low** | 6.1 E2E 测试 P1/P2 扩展 | 3h | 扩展覆盖 |

**合计：** 2 项实现 + 1 项设计决策 + 1 项测试扩展 = 4 项 ≈ **9 小时工时**

---

## 审计存档 — 已完成的 24 项

### 2026-04-08 审计（17 项）

通过子代理对每条任务的文件/符号做了直接验证，以下 17 项已在 2026-04-07 之前完成：

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

### 2026-04-08 `fe7826b` 流式资产落地（3 项）

commit `fe7826b feat: streaming asset fulfillment with per-sprite hot-swap (7.1 + 7.3)` 一次性完成以下三项：

| 编号 | 原任务 | 验证证据 |
|------|--------|---------|
| 1.3 | Asset 竞态保护 | `use-asset-stream-applier.ts` `makeStreamingApplier` monotonic race guard（v0 + applied），外部 configVersion bump 时静默 abort；比原计划方案更强 |
| 7.1 | AI 生成进度反馈 | `asset-agent.ts:fulfillAssets` 新 `FulfillOptions {onProgress}`；`progress-log-block.tsx` active-entry 高亮 + `aria-live`；`useStreamingAssetFulfillment` 把进度写入 chat message |
| 7.3 | Per-asset 流式预览 | `asset-agent.ts` onAsset callback 逐张回调；`asset-preview-block.tsx` 骨架占位 → 实际图渐进显示；`GameObjectRenderer.applyAssetUpdate` 通过 `assets:updated` 事件实现 per-sprite 热交换；首 sprite 可见时间 145s → ~30s |

**效果：** 104 个新测试通过，Playwright spec `asset-streaming.spec.ts` 验证首 sprite ≤ 45s、5+ sprite ≤ 180s。

### 2026-04-09 四任务联合落地（4 项）

双模型协作规划 + 三波 Agent 并行 TDD 执行，5 个 commit 分拆交付（详见 `.claude/plan/p1-p2-four-tasks.md`）：

| 编号 | 原任务 | 完成 commit | 验证证据 |
|------|--------|------------|---------|
| 5.6 | Chat 验证反馈 | `502bf8b feat(chat): surface ValidationReport issues as a dismissible chat block` | 新增 `validation-summary` ChatBlock + `validation-summary-block.tsx` 渲染 + use-conversation-manager 注入；12 个新测试 |
| 7.2 | AI 请求 Cancel 按钮 | `62b9825 feat(ai): add cancel button for in-progress asset generation` | AbortSignal 全链路穿透（gemini-image / claude-proxy / asset-agent）+ 独立 `asset-fulfillment-store` + 发送/停止按钮切换；18 个新测试 |
| 5.2 | GameTypeSelector 搜索 & 分类 | `edb4787 feat(chat): wire full 38-game catalog into GameTypeSelector` | UI 层早已完整（search/tabs/show-more/cards），只需数据层补全：`buildFullGameTypeOptions` 从 38 款目录构建（8 分类 + supportedToday + thumbnailUrl）；顺手修复 5.6 `messageId` prop 透传；7 个测试变更 |
| 4.1 | Three-View Layout + Paste/Drop | `44f080c feat(layout): three-view layout with dual dividers and asset browser drawer` | Paste/Drop 早已有 `useChatInputPaste`；本次加双分隔条 + 独立面板可见性/宽度 state + `useResizeDivider` direction 参数 + chat 面板内 AssetBrowser drawer；17 个新测试 |

**效果：** 54 个新测试，3691/3694 total passing，`npm run build` 通过。原估 6h，实际发现前置基础设施已完整，5.2 降级到 ~30min，4.1 降级到 ~2.5h。

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
