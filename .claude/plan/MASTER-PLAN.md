# AIGE Studio — 未完成任务总表

> 整合自 42 个计划文件，仅保留经验证尚未完成的任务。
> 已完成的计划（M0-M6、Figma Phase 1-4、P0 ChatBlock、Board Mode 修复、API 代理、引擎加固基础、Contract 迁移、HUD 拆分等）已移除。
> 更新日期：2026-04-07

---

## 一、引擎可靠性与质量 (Engine Reliability)

### 1.1 touch-action:none（移动端手势拦截）
**来源：** engine-reliability-hardening.md H2
**状态：** 未完成（use-engine.ts 中未设置）
**文件：** `src/app/hooks/use-engine.ts`
**操作：** Canvas 元素添加 `canvas.style.touchAction = 'none'`，防止移动端浏览器滚动拦截游戏触控

### 1.2 useEngine 卸载安全
**来源：** engine-reliability-hardening.md M1
**文件：** `src/app/hooks/use-engine.ts`
**操作：** cleanup 中调用 `engineRef.current?.restart()` 确保所有模块 destroy()，防止定时器/DOM 监听泄漏

### 1.3 Asset fulfillment 竞态保护
**来源：** engine-reliability-hardening.md M5
**文件：** `src/ui/chat/studio-chat-panel.tsx`
**操作：** triggerAssetFulfillment 中捕获 configVersion，callback 中校验 currentVersion === capturedVersion 再应用，防止旧素材注入新游戏

### 1.4 ConfigLoader strict 模式
**来源：** game-quality-validation.md Step 3
**文件：** `src/engine/core/config-loader.ts`
**操作：** 运行 ConfigValidator → 硬错误 throw → 自动修复附加 meta → 微仿真 preflight（300ms tick + synthetic input）→ strict 标志（Studio=true, export=false）

### 1.5 ConversationAgent 验证集成
**来源：** game-quality-validation.md Step 4
**文件：** `src/agent/conversation-agent.ts`
**操作：** buildGameConfig() 后运行 ConfigValidator，自动修复低风险问题，剩余 warning 注入 enhancementSuggestions chips

### 1.6 gameflowPaused 合规审计
**来源：** engine-reliability-hardening.md M7
**操作：** CI 测试扫描 63 个模块的 update() 方法，确认 gameflowPaused 检查覆盖

### 1.7 Per-frame asset hash 优化
**来源：** engine-reliability-hardening.md M4
**文件：** `src/engine/renderer/game-object-renderer.ts`
**操作：** 替换字符串拼接 hash 为引用相等检查 `lastAssetsRef !== currentAssets`

---

## 二、代码审查遗留修复 (Code Review Fixes)

### 2.1 Renderer config 不可变性修复
**来源：** code-review-fixes.md H1
**文件：** `src/engine/renderer/pixi-renderer.ts:120-121`
**操作：** 删除 syncBackgroundImage 中对 engine config 的写回操作

### 2.2 Shield/CameraFollow/Gravity 动态 consumes
**来源：** code-review-fixes.md Fix 4 (H4 + H6 + M6)
**文件：** `shield.ts`, `camera-follow.ts`, `gravity.ts`
**操作：** getContracts() 中根据 params 动态声明 consumes 事件（damageEvent, shakeEvent, toggleEvent）

### 2.3 EventBus error 日志门控
**来源：** code-review-fixes.md Fix 5 (M2)
**文件：** `src/engine/core/event-bus.ts`
**操作：** handler 异常的 console.error 改为只在 debug 模式触发

---

## 三、Agent 智能增强 (Agent Intelligence)

### 3.1 SkillLoader 集成到 ConversationAgent
**来源：** skillloader-integration.md + agent-skill-integration.md
**状态：** 未完成（conversation-agent.ts 中无 loadForConversation 调用）
**文件：** `src/agent/conversation-agent.ts`, `src/agent/skill-loader.ts`
**操作：**
1. 在 process() 中根据当前 gameType + 活跃模块调用 SkillLoader.loadForConversation()
2. 加载游戏类型文档（4-9KB）+ 模块接线子集 + 模块协同
3. 构建 system prompt = COMPACT_BASE + loaded knowledge + current config
4. 回退：SkillLoader 失败时降级到硬编码 SYSTEM_PROMPT
**效果：** 知识库 78 个文档 ~697KB 动态注入，替代浅层硬编码，提升配置生成质量

### 3.2 UI-intent 工具定义
**来源：** interaction-redesign-p0-p3-v2.md §0.2-0.4
**文件：** `src/agent/conversation-defs.ts`, `src/agent/conversation-agent.ts`
**操作：**
1. 添加 3 个 UI-intent tool_use 工具：request_asset_replace, request_assets_generate, show_asset_previews
2. Agent 将工具调用映射为 uiActions（不执行），UI 层处理实际操作
3. 系统提示添加素材操作规则
**效果：** Agent 可指示 UI 进行素材替换/生成/预览，闭合对话中的素材操作循环

### 3.3 mapConfigToParamCard 助手函数
**来源：** interaction-redesign-p0-p3-v2.md §0.4
**文件：** `src/agent/conversation-agent.ts`
**操作：** Agent 创建/修改游戏后，自动生成 param-card ChatBlock（含 asset 字段），嵌入到回复消息的 blocks 中

---

## 四、交互设计剩余阶段 (Interaction Redesign P1-P3)

### 4.1 P1: Three-View Layout + Paste/Drop
**来源：** interaction-redesign-p0-p3-v2.md P1
**新文件：** `chat-preview-page.tsx`, `sandbox-page.tsx`
**修改文件：** `main-layout.tsx`, `landing-page.tsx`, `editor-store.ts`, `studio-chat-panel.tsx`, `asset-browser.tsx`
**内容：**
- 三视图布局（Chat + Preview + Editor 可独立切换）
- 图片粘贴/拖拽到聊天输入框 → 自动附加为 Attachment
- Asset browser 面板与聊天集成

### 4.2 P2: Context-Aware Suggestions
**来源：** interaction-redesign-p0-p3-v2.md P2
**新文件：** `suggestion-engine.ts`
**修改文件：** `conversation-agent.ts`, `suggestion-chips.tsx`, `studio-chat-panel.tsx`
**内容：**
- 动态建议引擎：根据当前配置状态、缺失模块、素材状态生成上下文感知建议
- 建议分层：missing → enhancement → polish
- 替换硬编码 chip 列表

### 4.3 P3: Intent Extraction + Board Interaction
**来源：** interaction-redesign-p0-p3-v2.md P3
**新文件：** `intent-extractor.ts`
**修改文件：** `conversation-agent.ts`, `landing-page.tsx`, `preview-canvas.tsx`
**内容：**
- 意图提取器：从自由文本中解析结构化意图（不依赖 LLM）
- 预览画布交互：点击游戏元素触发上下文菜单（修改参数/替换素材）
- Landing 页面意图引导

---

## 五、UI 增强 (UI Enhancements)

### 5.1 FPS 计数器 Overlay
**来源：** fps-counter-overlay.md
**状态：** 未完成（无 fps-overlay.tsx）
**文件：**
- `src/store/editor-store.ts` — 添加 `showFpsOverlay` toggle
- `src/app/hooks/use-game-loop.ts` — 暴露 fpsRef metrics
- `src/ui/preview/fps-overlay.tsx` — 新建 FPS 显示组件
- PreviewToolbar — 添加 FPS 按钮
**操作：** Loop-Piggyback 模式，useFps hook 以 ~1Hz 采样到 React 状态，全局 store 仅控制可见性

### 5.2 GameTypeSelector 搜索 & 分类
**来源：** m0-execution-plan.md F2-F3
**状态：** 未完成（无 game-search-bar.tsx）
**新文件：** `src/ui/chat/game-search-bar.tsx`
**修改文件：** `src/ui/chat/game-type-selector.tsx`
**操作：**
- 搜索栏（Tailwind 圆角输入框）+ 8 分类标签横向滚动
- 默认显示 Top 6，"Show More (32)" 展开按钮
- 缩略图卡片 + "Supported"/"Coming Soon" 徽章

### 5.3 L2 Bespoke 参数卡片
**来源：** figma-alignment.md Step 5-6
**状态：** Git 提交存在但 cards/ 目录不存在，需验证
**新文件：** `src/ui/chat/cards/` — game-conditions, player-actor, enemy-actor, sfx, visual-styles, feedback-effect
**操作：**
- GuiParamCard 路由到专属 L2 卡片（GameConditionsCard 等）
- 每卡片含特定控件组合（Slider+Dropdown+Toggle+ImagePicker）
- 未知 category 回退通用布局

### 5.4 Game Feel Dashboard 集成
**来源：** m0-execution-plan.md F9-F10
**状态：** game-feel-score.tsx 存在，需验证是否集成到 EditorPanel
**文件：** `src/ui/editor/editor-panel.tsx`
**操作：** EditorPanel 中添加可折叠 "Game Feel" 区段，挂载 GameFeelScore + GameFeelSuggestions

### 5.5 Diagnostic Popover
**来源：** game-quality-validation.md Step 6
**状态：** diagnostic-badge.tsx 存在，popover 未验证
**新文件：** `src/ui/preview/diagnostic-popover.tsx`
**操作：** 点击 badge → popover 显示人类可读问题列表 + "Quick Fix" 按钮

### 5.6 Chat 验证反馈
**来源：** game-quality-validation.md Step 7
**文件：** `src/ui/chat/studio-chat-panel.tsx`
**操作：** 配置生成后如有 ValidationReport warnings → 添加 assistant 消息 + suggestion chips

---

## 六、E2E 测试 (End-to-End Testing)

### 6.1 Playwright E2E 测试套件
**来源：** e2e-test-plan.md
**状态：** 未开始（无 qa-e2e/ 目录）
**结构：**
```
qa-e2e/
├── playwright.config.ts
├── helpers/selectors.ts
├── tests/
│   ├── 01-landing.spec.ts          # P0: 页面加载、chips、输入创建
│   ├── 02-game-creation-no-api.spec.ts  # P0: regex fallback 创建 6 种游戏
│   ├── 03-preview-lifecycle.spec.ts     # P0: Edit/Play/Fullscreen 切换
│   ├── 04-export.spec.ts               # P0: HTML/APJS/Share 导出
│   ├── 05-multi-gametype.spec.ts        # P0: 6 种核心游戏冒烟
│   ├── 06-expert-presets.spec.ts        # P1: Expert Browser 搜索/过滤/使用
│   ├── 07-module-editor.spec.ts         # P1: 模块列表/属性/参数修改
│   ├── 08-board-mode.spec.ts            # P1: 打开/调参/关闭/回归
│   ├── 09-share-link.spec.ts            # P1: 生成/加载/中文保留
│   ├── 10-asset-management.spec.ts      # P2: 上传/删除
│   ├── 11-conversation-agent.spec.ts    # P2: [需API] 多轮对话
│   └── 12-responsive.spec.ts            # P2: 桌面/平板/手机布局
```
**总计：** ~46 个测试用例
**回归检测：** btoa Unicode、React key collision、Fullscreen user gesture、Board mode overlay 拦截

---

## 优先级排序

| 优先级 | 任务 | 估算 | 风险 |
|--------|------|------|------|
| **P0-Critical** | 1.1 touch-action:none | 5min | 移动端完全不可用 |
| **P0-Critical** | 1.3 Asset 竞态保护 | 30min | 数据错乱 |
| **P0-High** | 2.1 Renderer 不可变性 | 10min | 违反架构原则 |
| **P0-High** | 2.2 动态 consumes contracts | 30min | Contract 准确性 |
| **P0-High** | 2.3 EventBus 日志门控 | 5min | 生产性能 |
| **P1-High** | 3.1 SkillLoader 集成 | 2h | Agent 质量提升最大 ROI |
| **P1-High** | 3.2 UI-intent 工具 | 1.5h | 素材操作闭环 |
| **P1-High** | 6.1 E2E 测试（P0 部分） | 3h | 质量守门 |
| **P1-Medium** | 1.2 useEngine 卸载 | 20min | 内存泄漏 |
| **P1-Medium** | 1.4 ConfigLoader strict | 1.5h | 无效配置静默加载 |
| **P1-Medium** | 1.5 Agent 验证集成 | 1h | 生成质量 |
| **P1-Medium** | 5.1 FPS overlay | 30min | 开发体验 |
| **P2-Medium** | 3.3 mapConfigToParamCard | 1h | 参数卡片自动生成 |
| **P2-Medium** | 4.1 P1 Three-View Layout | 3h | 布局增强 |
| **P2-Medium** | 5.2 GameType 搜索 | 1h | 38 类型导航 |
| **P2-Low** | 4.2 P2 建议引擎 | 2h | 智能建议 |
| **P2-Low** | 4.3 P3 Intent Extraction | 2h | 深层交互 |
| **P2-Low** | 5.3 L2 卡片（需验证） | 2h | UI 精细化 |
| **P2-Low** | 5.4 Game Feel Dashboard | 30min | 编辑器增强 |
| **P2-Low** | 5.5 Diagnostic Popover | 1h | 诊断 UI |
| **P2-Low** | 5.6 Chat 验证反馈 | 1h | 验证闭环 |
| **P3-Low** | 1.6 gameflowPaused 审计 | 30min | CI 保障 |
| **P3-Low** | 1.7 Asset hash 优化 | 20min | 微性能 |
| **P3-Low** | 6.1 E2E 测试（P1-P2） | 3h | 扩展覆盖 |

---

## 已完成计划存档

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
| game-quality-audit | — | 审计报告（无实施步骤） |
| nine-game-type-bugs | — | Bug 报告（无实施步骤） |
| execution-plan | — | 总览文档 |
| high-priority-expansion | 多次提交 | 3 批次 29 个模块 |
| shooter-rpg-rendering | 多次提交 | ShooterRenderer + RPGOverlay |
| hud-refactor-knowledge-review | 多次提交 | HUD 拆分为 4 个子渲染器 |
| fix-player-movement-follow | 多次提交 | 双监听冲突 + 坐标修复 |
| fix-preset-offline | c462078 | 模板离线回退 |
| board-mode-4-controls-fix | 442a22c | Board Mode 控制修复 |
| board-mode-asset-bugfix | 3bca50d | Asset 预览刷新 |
| phase6-delete-hardcoded-maps | 多次提交 | KNOWN_MODULE_TYPES 已删除 |
| interaction-redesign-p0-p3 | — | 被 v2 取代（过时） |
| p0-expert-data-integration | — | 被 v2 取代（过时） |
| game-parameter-ui-redesign | 多次提交 | 被 Figma 系列取代 |
