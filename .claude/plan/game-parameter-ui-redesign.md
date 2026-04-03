# Game Parameter UI Redesign — 完整需求分析（V1 + V2）

## 1. 概述

将 AIGE Studio 的前端交互从当前的"模块列表 + 平铺参数面板"重构为 Figma 设计稿定义的 **Effect House 风格三层参数体系**，支持**两条用户路径**和**四种参数编辑方式**。

**核心变化**：从"技术导向的模块编辑器"变为"体验导向的参数调节器"。

---

## 2. 两条用户路径（V2 核心架构）

### 路径 A — 用户意图明确

```
1. 用户输入 prompt（如"做一个赛车游戏，复古像素风"）
   ↓
2. 系统生成游戏初稿 + 展示 L1 控件（难度/节奏/风格）
   ↓
3. 四种编辑方式（渐进式披露）：
   ├── 3.1 直接调节 L1 → 实时预览
   ├── 3.2 自然语言输入 → NLU → Chat 内推送参数卡片
   ├── 3.3 点击 Suggestion Chip → Chat 内推送参数卡片
   └── 3.4 点击"GUI 面板" → 打开完整参数面板（Board Mode）
```

### 路径 B — 用户意图模糊

```
1. 用户输入模糊 prompt（如"做个好玩的游戏"）
   ↓
2. 系统生成游戏初稿 + 给出更多游戏类型选项（缩略图卡片 + 确定按钮）
   ↓
3a. 用户满意当前初稿 → 继续修改 → 进入路径 A 的 3.x 编辑流程
3b. 用户更换游戏类型 → 画布实时渲染新类型 → 进入路径 A 的 3.x 编辑流程
```

---

## 3. 四种参数编辑方式（V2 详细设计）

### 3.1 L1 直接调节（Chat 内嵌控件）

**触发**：游戏生成后自动出现在 Chat 中
**位置**：Chat 消息流内，作为系统回复的一部分
**控件**：
- Gameplay Difficulty: 5 级表情 Segmented（😐 → 🤬）
- Gameplay Pacing: Slider（慢 → 快），带标签提示（如"Fast-paced game"）
- Emotion Styles: 3 个视觉风格缩略图选择
**行为**：调节任一控件 → 实时更新游戏预览

### 3.2 自然语言 → 参数卡片

**触发**：用户在 Chat 输入自然语言（如"我想切换到计分类游戏"）
**流程**：
1. 用户输入文本
2. 系统 NLU 解析意图，识别关联参数
3. 在 Chat 中推送 **GUI 参数卡片**（如"游戏机制"卡片）
4. 卡片内嵌实际控件（下拉菜单、滑块等）
5. 用户在卡片中调节 → 实时预览更新

**参数卡片示例**（来自截图5）：
```
┌─ 游戏机制 ─────────────────┐
│  游戏模式                    │
│  ┌─────────────────────┐   │
│  │ 生存模式          ▼ │   │
│  ├─────────────────────┤   │
│  │ ✓ 生存模式          │   │
│  │   计分模式    [Tag]  │   │
│  │   淘汰模式          │   │
│  └─────────────────────┘   │
└────────────────────────────┘
```

### 3.3 Suggestion Chip → 参数卡片

**触发**：用户点击底部 Suggestion Chip
**Chip 类型**（V2 设计）：
- 参数级："障碍物数量"、"车道宽度"、"添加连击奖励"、"添加道具"
- 功能级："GUI 面板"（进入 Board Mode）
- 游戏体验级："子弹时间效果"
**流程**：点击 Chip → 系统推送对应参数卡片到 Chat → 用户在卡片中调节

### 3.4 完整 GUI 面板（Board Mode）

**触发**：点击"GUI 面板" Suggestion Chip 或 Chat 中的按钮
**布局**（来自截图8 - 3.4）：
```
┌──────────────────────┬─────────────────────┐
│  ← 一个神秘的特效      │                     │
│                      │                     │
│  [Clay] [Pixel] [3D] │   游戏预览画布        │
│  视觉风格缩略图选择     │                     │
│                      │                     │
│  ▾ L1 基础调节         │                     │
│    难度 ●━━━━━━━      │                     │
│    节奏 ━━●━━━━━      │                     │
│                      │                     │
│  ▾ 游戏系统            │                     │
│    游戏模式 [下拉]      │                     │
│    生命值  [步进器]     │                     │
│    碰撞   [开关]       │                     │
│                      │                     │
│  ▾ 视觉效果            │                     │
│    粒子   [开关]       │                     │
│    ...               │                     │
│                      │                     │
├──────────────────────┤                     │
│ [GUI面板] [连击] [道具] │     控制点           │
│ 描述你想要的内容...   ↑ │                     │
└──────────────────────┴─────────────────────┘
```

**面板内容**：
- 顶部：视觉风格缩略图（3 个选择）
- L1 基础调节：Difficulty + Pacing 控件
- L2 分类组：按类别折叠展示（游戏系统、视觉效果等）
- 每个参数按 exposure 过滤：直接暴露的显示，不暴露的隐藏
- 控件类型按 Excel 定义渲染

---

## 4. 三层参数体系（V1 基础架构）

### 4.1 层级定义

```
L1 抽象感受层（普通用户可调）
  ├── Gameplay Difficulty / 难度  →  Segmented（5级表情图标）
  ├── Gameplay Pacing / 节奏    →  Slider（慢/中/快）
  └── Emotion Styles / 情绪     →  缩略图选择（3种视觉风格）
      ↓ 组合映射
L2 分子层（入门用户会调）
  ├── 游戏机制  → 碰撞、生命、计分、跳跃、难度递增...
  ├── 游戏对象  → Player Actor、Enemy Actor、形状/颜色/速度
  ├── 粒子系统  → 粒子开关、特效预览
  ├── 音效系统  → BGM、音效包
  ├── 天气系统  → 环境效果
  └── 输入模式  → 触控、倾斜、表情识别
      ↓ 直接暴露 / 不暴露
L3 原子层（专业用户好调）
  └── 229 个细粒度参数（道路数量、弹夹容量、粒子速度...）
```

### 4.2 参数暴露策略（来自 Excel 229 个参数）

| 暴露类型 | 数量 | 说明 | UI 位置 |
|---------|------|------|---------|
| 组合映射 | ~5 | L1 控件映射到多个 L2/L3 参数 | Chat 内嵌 L1 控件 |
| 直接暴露 | ~120 | 用户可直接调节 | 参数卡片 / Board Mode |
| 不暴露 | ~104 | 由系统/AI 自动推导 | 隐藏 |

**MVP 优先级**：P0(13) → P1(25) → P2(155) → P3(36)

**控件类型**：Toggle(42), Slider(72), Segmented(28), Stepper(25), Asset Picker(58), InputField(1)

### 4.3 参数依赖关系

参数之间存在 DAG 依赖（来自 Excel 的"依赖参数"+"依赖条件"列）：
- L1 → L2：游戏难度 → 难度递增系统、碰撞系统、生命系统...
- L2 → L3：碰撞系统(开启) → 碰撞体逻辑、安全区宽度...
- L3 → L3：跳跃(开启) → 二段跳、跳跃高度、落地缓冲...

**依赖影响 UI 行为**：当父参数关闭时，子参数应灰显/隐藏。

---

## 5. 当前代码架构

### 5.1 现有布局

```
Landing Phase: LandingPage（居中输入 + 建议 Chips）
    ↓ 游戏生成后
Studio Phase:
  ├── 左面板 (480px): StudioChatPanel — AI 对话 + Suggestion Chips
  ├── 中面板: PreviewCanvas — 游戏预览
  └── 右面板 (320px, 可折叠): EditorPanel — 模块列表 + 参数编辑
```

### 5.2 现有参数编辑

```
EditorPanel
  ├── Tab: Modules
  │   └── ModuleList → 平铺所有模块（Toggle 开关）
  │       └── 选中模块 → PropertiesPanel
  │           └── SchemaRenderer → 根据 SchemaField type 渲染控件
  └── Tab: Assets
```

SchemaRenderer 控件：range, number, boolean, select, color, string, object, rect, asset[], collision-rules

### 5.3 状态管理

- `editor-store.ts`: selectedModuleId, previewMode, chatMessages, suggestionChips, layoutPhase
- `game-store.ts`: config (GameConfig), configVersion, updateModuleParam(), toggleModule()

### 5.4 已有能力（可复用）

- ConversationAgent (Claude tool_use) — 已支持 create_game / modify_game / suggest_enhancements
- SuggestionChips — 已有基础组件，需扩展为参数级
- SchemaRenderer — 已有 range/boolean/select，需增加 segmented/stepper/asset_picker
- ParamCard (chat/param-card.tsx) — **已存在参数卡片组件**，需大幅升级
- 实时参数更新 → 引擎刷新链路已通

---

## 6. 差距分析（Gap Analysis）

### 6.1 交互流程差距

| 维度 | 当前 | V2 目标 | 差距级别 |
|------|------|---------|---------|
| 意图模糊路径 | 无（直接生成） | 游戏类型选择卡片 + 确定按钮 | **新增** |
| L1 Chat 内嵌控件 | 无 | Difficulty/Rhythm/Emotion 在 Chat 中 | **新增** |
| NLU → 参数卡片 | 无 | 自然语言识别 → 推送 GUI 参数卡片 | **新增** |
| Chip → 参数卡片 | Chip 仅文本提交 | Chip 触发参数卡片推送 | **升级** |
| Board Mode | 不存在 | 完整 GUI 参数面板 | **新增** |
| 游戏类型切换 | 需重新创建 | 缩略图选择 + 画布实时渲染 | **新增** |

### 6.2 组件差距

| 组件 | 当前 | V2 目标 | 变更 |
|------|------|---------|------|
| Chat 消息 | 纯文本 + 简单 ParamCard | 内嵌 L1 控件 + GUI 参数卡片 | **大幅升级** |
| ParamCard | 简单滑块/开关 | 完整参数编辑器（下拉、分段、步进等） | **大幅升级** |
| Suggestion Chips | 游戏类型推荐 | 参数级建议 + 功能入口 | **扩展** |
| 左面板 | 纯 Chat | Chat + L1 控件 + Board Mode | **重构** |
| 右面板 EditorPanel | 模块列表 + 属性 | 移除/整合到 Board Mode | **废弃/替代** |
| 游戏类型选择器 | 无可视化选择 | 缩略图卡片 + 确定按钮 | **新增** |
| Segmented 控件 | 无 | 表情图标分段选择器 | **新增** |
| Stepper 控件 | 无 | +/- 步进器 | **新增** |
| AssetPicker Grid | 无（只有列表） | 缩略图网格选择器 | **新增** |

### 6.3 数据层差距

| 数据 | 当前 | V2 目标 | 差距 |
|------|------|---------|------|
| 参数元数据 | SchemaField (type/min/max) | +层级+暴露+MVP+依赖+分类+控件类型 | **扩展** |
| 参数注册表 | 无 | 229 个参数完整元数据 | **新建** |
| L1 映射规则 | 无 | Difficulty/Rhythm/Emotion → 参数值 | **新建** |
| NLU 参数识别 | 无 | 自然语言 → 关联参数 ID 列表 | **新建** |
| 游戏类型预览 | 无 | 缩略图/预览图 | **新建** |

---

## 7. 实施需求清单

### Phase 1 — 数据基础（P0）

#### 7.1 参数注册表（Parameter Registry）
- `src/data/parameter-registry.ts` — 229 个参数元数据
- 数据结构见第 9 节
- 从 Excel 导入：id, name, layer, category, mvp, exposure, controlType, gameTypes, default, dependencies
- API：`getParamsForGameType(type)`, `getParamsByLayer(layer)`, `getParamsByCategory(cat)`

#### 7.2 L1 组合映射引擎
- `src/engine/core/composite-mapper.ts`
- 3 个 L1 参数映射规则表（Difficulty/Rhythm/Emotion → L2/L3 参数值）
- API：`applyL1Preset(l1Values) → Map<paramId, value>`
- 每个游戏类型可有不同的映射权重

#### 7.3 参数依赖解析器
- `src/engine/core/dependency-resolver.ts`
- 解析 Excel 依赖关系，计算参数可见性/可用性
- API：`resolveVisibility(currentValues) → Map<paramId, {visible, enabled}>`

### Phase 2 — Chat 参数交互（P0）

#### 7.4 Chat 内嵌 L1 控件
- 升级 `studio-chat-panel.tsx` 和消息渲染
- 游戏生成后，在 Chat 系统消息中内嵌 L1 Game Experience 控件
- 控件变更 → CompositeMapper → 批量更新参数 → 引擎实时刷新

#### 7.5 GUI 参数卡片升级
- 大幅升级 `param-card.tsx`
- 支持内嵌控件：Dropdown/Select, Slider, Toggle, Segmented, Stepper
- 支持按分类分组显示参数
- 卡片标题对应 L2 分类名（游戏机制、游戏对象等）

#### 7.6 NLU 参数识别
- 扩展 ConversationAgent 的 tool_use 能力
- 新增 tool：`push_parameter_card(category, paramIds[])` — 在 Chat 中推送参数卡片
- Agent 根据用户自然语言识别关联参数，调用 tool 推送卡片

#### 7.7 Suggestion Chips 升级
- 从游戏类型推荐 → 参数级建议
- 新增 Chip 类型：
  - `{ type: 'board_mode', label: 'GUI 面板' }` → 打开 Board Mode
  - `{ type: 'param', label: '障碍物数量', paramId: 'obstacle_count' }` → 推送参数卡片
  - `{ type: 'action', label: '添加连击奖励' }` → 触发参数修改
- ConversationAgent 根据上下文动态生成 chips

### Phase 3 — Board Mode（P1）

#### 7.8 Board Mode 面板
- `src/ui/parameters/board-mode-panel.tsx`
- 替代当前 EditorPanel 的功能
- 布局：视觉风格选择 → L1 控件 → L2 分类折叠组 → 每组内参数控件
- 按当前游戏类型过滤显示适用参数
- 按 exposure 过滤：直接暴露显示，不暴露隐藏
- 参数依赖驱动显隐

#### 7.9 新增 UI 控件
- `src/ui/controls/segmented-control.tsx` — 分段选择器（支持表情图标/文字/图片）
- `src/ui/controls/stepper-control.tsx` — +/- 步进器
- `src/ui/controls/asset-picker-grid.tsx` — 缩略图网格选择
- 整合到 SchemaRenderer + ParamCard

### Phase 4 — 意图模糊路径（P1）

#### 7.10 游戏类型选择卡片
- 当系统判断用户意图模糊时，推送游戏类型选择卡片
- 卡片包含：游戏类型缩略图 + 名称 + "确定"按钮
- 选择后 → 生成对应游戏 → 进入 L1 编辑流程

#### 7.11 游戏类型实时切换
- 在 Chat 中提供切换游戏类型的入口
- 切换后画布实时重新渲染
- 保留已有的参数调整（映射到新类型的对应参数）

### Phase 5 — 布局重构（P1）

#### 7.12 主布局调整
- 左面板：Chat 消息流（含内嵌 L1/参数卡片）+ 底部输入框 + Suggestion Chips
- 中/右面板：Preview Canvas
- Board Mode：点击"GUI 面板" Chip → 左面板切换为 Board Mode 面板
- 废弃/隐藏当前 EditorPanel（右面板）

### Phase 6 — 增强（P2）

#### 7.13 视觉风格选择器
- 顶部固定 3 个风格缩略图（如 Cartoon / Pixel / 3D Clay）
- 切换风格 → 批量更新视觉相关参数 + 触发资产重新生成

#### 7.14 L3 原子参数
- 仅在 Board Mode 高级模式可见
- 以 Chip/Tag 形式展示，点击弹出编辑弹窗
- 按 MVP P2/P3 分优先级显示

#### 7.15 完成度提醒（TODO from Figma）
#### 7.16 素材管理系统（TODO from Figma）

---

## 8. 关键设计决策（需确认）

1. **Board Mode 入口**：仅通过 Suggestion Chip "GUI 面板" 进入，还是增加固定按钮？
2. **L1 控件位置**：仅在 Chat 消息中出现（随对话滚动），还是同时在面板顶部固定显示？
3. **参数卡片推送**：Agent 自动识别推送 vs 用户主动请求？
4. **右面板 EditorPanel**：完全废弃 vs 保留为 Board Mode 的备用入口？
5. **L1 映射精度**：每个游戏类型独立映射表 vs 通用映射 + 游戏类型修正系数？
6. **NLU 实现**：扩展现有 ConversationAgent tool_use vs 新建独立 NLU 模块？
7. **游戏类型缩略图**：静态预渲染图 vs 动态截屏？
8. **视觉风格选择器**：与 L1 Emotion 合并 vs 独立控件？

---

## 9. 数据结构（草案）

### 9.1 参数元数据

```typescript
interface ParameterMeta {
  id: string;                    // 唯一标识 e.g. "gameplay_difficulty"
  name: string;                  // 显示名 e.g. "游戏难度"
  nameEn: string;                // English name e.g. "Gameplay Difficulty"
  layer: 'L1' | 'L2' | 'L3';
  category: 'game_mechanics' | 'game_objects' | 'particles' | 'sound' | 'weather' | 'input' | 'abstract';
  mvp: 'P0' | 'P1' | 'P2' | 'P3';
  exposure: 'direct' | 'composite' | 'hidden';
  controlType: 'toggle' | 'slider' | 'segmented' | 'stepper' | 'asset_picker' | 'input_field';
  gameTypes: string[];           // ['ALL'] or ['catch', 'shooting', ...]
  defaultValue: string | number | boolean;
  options?: string[];            // For segmented/select: ['简单', '普通', '困难']
  range?: { min: number; max: number; step?: number };  // For slider/stepper
  dependsOn?: {
    paramId: string;
    condition: string;           // '开启', '任意', '显示'
  };
  associatedL1?: string[];       // 关联的 L1 参数 e.g. ['游戏难度', '游戏节奏']
  description: string;
}
```

### 9.2 参数卡片消息类型

```typescript
interface ParamCardMessage {
  type: 'param_card';
  category: string;              // L2 分类名
  title: string;                 // 卡片标题
  params: Array<{
    meta: ParameterMeta;
    currentValue: any;
  }>;
}
```

### 9.3 Suggestion Chip 类型扩展

```typescript
interface SuggestionChip {
  type: 'game_type' | 'param' | 'action' | 'board_mode';
  label: string;
  icon?: string;
  // For param type:
  paramId?: string;
  category?: string;
  // For action type:
  action?: string;
}
```

### 9.4 L1 状态

```typescript
interface L1State {
  difficulty: 'easy' | 'normal' | 'hard' | 'very_hard' | 'extreme';
  pacing: number;    // 0-100 slider value
  emotion: string;   // style ID: 'cartoon' | 'pixel' | 'clay' | ...
}
```

---

## 10. 模块扩展计划 — 实现 1:1 参数映射

### 10.1 范围划分

| 期次 | 参数数 | 范围 | 说明 |
|------|--------|------|------|
| **一期** | 194 | 所有非赛车专属参数 | P0(12) + P1(25) + P2(129) + P3(28) |
| **二期** | 34 | 赛车游戏专属参数 | 漂移/车辆物理/赛道几何/天气等 |
| **合计** | 228 | 全量覆盖 | 1 个重复参数（联机系统出现 2 次） |

### 10.2 一期 — 新增模块

| 模块 | 参数数 | 关键参数 | 对应游戏类型 |
|------|--------|---------|-------------|
| **SpinWheel** | 14 | 扇区数量、转速、停稳时长、指针宽度、减速曲线、奖池权重、中奖倍率、指针震颤 | 幸运转盘 |

> 幸运转盘是一期中唯一需要**新建模块**的游戏类型。random-wheel 类型已存在但无专用模块。
>
> 联机系统(P3)、排行榜(P2/P3)、天气/环境(P3) 参数在一期中注册到 Registry 但标记为 `coming_soon`，不阻塞 UI 重构。

### 10.3 一期 — 现有模块参数扩展

以下模块需要在 `getSchema()` 中**新增参数**以匹配 Excel 定义：

| 现有模块 | 需新增的参数 | 说明 |
|---------|-------------|------|
| **Scorer** | comboWindow, comboMultiplierStep, scorePerSecond 细化, critMultiplier, deductOnMiss 细化 | 连击窗口/倍率/暴击/漏接惩罚 |
| **Spawner** | obstacleVariant(type/size), spawnSafeZone, dropShadow, maxConcurrent 暴露 | 障碍物类型、掉落预告阴影、最大并发 |
| **Collision** | hitboxWidth/hitboxHeight(矩形碰撞), collisionBuffer | 替代 circle radius |
| **Lives** | damageAmount 细化, shieldDuration | 受击惩罚细化、护盾时长 |
| **QuizEngine** | optionCount, questionLength, shuffleOptions, questionPool difficulty | 选项数量/题干长度/洗牌/题库难度 |
| **Runner** | trackWidth, steeringSensitivity, slideDistance | 赛道宽度/方向灵敏度/滑铲距离 |
| **Jump** | doubleJumpWindow, landingBuffer, jumpScoreMultiplier | 二段跳窗口/落地缓冲/跳跃倍率 |
| **ExpressionDetector** | recognitionFrameRate, mirrorCamera, targetCount, matchDuration, toleranceTime, streakMultiplier | 识别帧率/镜像/目标数/匹配时长 |
| **PlayerMovement** | defaultY 暴露, followLerp 暴露 | 已有参数但未在 schema 中暴露 |
| **DifficultyRamp** | initialDifficulty, maxDifficulty 暴露 | 已有 rules 但缺少直观的初始/最大难度参数 |
| **SoundFX** | bgmAsset, hitSoundAsset, countdownWarningSound, feedbackVolume | 背景音乐/受击音效/倒计时警示/反馈音量 |
| **ParticleVFX** | burstScale, hitFlashEffect, scorePopup, clickRipple | 粒子爆发规模/命中闪烁/计分飘字/点击涟漪 |
| **UIOverlay** | healthBarStyle, retryGuide, idleHint, buttonPressEffect, blurIntensity | 血量样式/重试引导/空闲提示/按压感/模糊 |
| **ResultScreen** | winAnimation, winText, displayContent, resultDelay, resultMaskColor | 胜负动画/文案/展现内容/延时/遮罩 |
| **GameFlow** | failRestartDelay, pauseAllowed, completionReminder | 失败重启延时/暂停/完成度提醒 |
| **CameraFollow** | viewDistance, cameraHeight | 视野距离/镜头高度 |
| **PowerUp** | dropRate, magnetSpeed, duration 细化 | 道具掉落率/磁吸速率/持续时长 |
| **BeatMap** | preGeneratedBeats 暴露, hitWindow, streakMultiplier | 节拍预生成/判定窗口/连击倍率 |
| **Aim** | crosshairWidth, crosshairPattern | 准星宽度/图案 |
| **Projectile** | clipCapacity, recoil, burstLimit, fireInterval | 弹夹容量/后坐力/连射上限/连射间隔 |
| **WaveSpawner** | waveInterval, maxBulletsPerWave | 波次间隔/每波最大子弹 |
| **GestureMatch** | accuracyTolerance | 手势识别精度 |
| **DeviceInput** | tiltSensitivity | 倾斜灵敏度 |
| **Gravity** | gravityValue(直接数值输入) | 重力数值设定 |

### 10.4 一期 — 参数只需注册（无需模块改动）

以下参数已存在于模块中，只需在 Parameter Registry 中创建映射：

- Spawner.frequency → 生成频率 / 接物频率
- Spawner.speed → 物体移动速度 / 接物速度 / 障碍速度
- Spawner.maxCount → 最大并发
- Lives.count → 生命值
- Timer.duration → 答题限时 / 计时器
- Scorer.perHit → 计分系统
- Collision.hitboxScale → 判定宽度 / 命中半径
- Runner.laneCount → 车道数量
- Runner.speed/maxSpeed → 车速 / 前进速度 / 最高车速
- Jump.jumpForce → 跳跃高度
- Jump.doubleJump → 二段跳
- IFrames.duration → 无敌时间
- Health.maxHp → 生命值
- Projectile.speed → 弹速
- Projectile.fireRate → 弹幕频率
- BulletPattern.bulletCount → 子弹连射上限

### 10.5 二期 — 赛车游戏模块（Batch 4）

赛车与跑酷的**核心差异**：Runner 是离散车道切换（swipe），赛车是连续转向 + 物理模拟。

| 新模块 | 参数数 | 关键参数 |
|--------|--------|---------|
| **VehiclePhysics** | 8 | 轮胎抓地力、悬挂硬度、制动响应、过弯减速、漂移触发/角度、路面摩擦、空气阻力 |
| **TrackGeometry** | 6 | 赛道曲率、赛道坡度、路缘宽度、终点线、车流密度、生成安全区 |
| **RacingVFX** | 5 | 碰撞火花、碰撞特效强度、速度感特效、漂移音效、引擎音量 |
| **WeatherSystem** | 2 | 天气效果、昼夜切换 |
| **扩展 Runner** | 4 | 赛道宽度、方向灵敏度、最高车速、可用车道数 |
| **扩展 CameraFollow** | 2 | 视野距离、镜头高度 |
| **扩展 Collision** | 3 | 碰撞缓冲、车辆碰撞体宽/长 |
| **扩展 Lives** | 2 | 事故惩罚、碰撞惩罚 |
| **扩展 PowerUp** | 1 | 氮气时长 |
| **资产类** | 4 | 车辆外观、车身尺寸、障碍类型/尺寸 |

> 赛车模块完成后注册到 Parameter Registry，UI 自动接入，无需额外前端改动。

### 10.6 一期完成后 Registry 覆盖率

| 状态 | 数量 | 说明 |
|------|------|------|
| **1:1 映射完成** | ~170 | 已有模块 + 扩展参数 + SpinWheel |
| **注册但标记 coming_soon** | ~24 | 联机、排行榜、天气、部分 P3 参数 |
| **二期实现** | 34 | 赛车专属 |

---

## 11. 文件变更预估

### 新增文件（~22 个）

**数据/引擎层：**

| 文件 | 说明 | Phase |
|------|------|-------|
| `src/data/parameter-registry.ts` | 229 个参数元数据 | 1 |
| `src/data/l1-mapping-rules.ts` | L1 组合映射规则表 | 1 |
| `src/engine/core/composite-mapper.ts` | L1 映射引擎 | 1 |
| `src/engine/core/dependency-resolver.ts` | 参数依赖解析器 | 1 |
| `src/engine/modules/mechanic/spin-wheel.ts` | 幸运转盘模块 | 1 |
| `src/store/parameter-store.ts` | 参数层级状态管理 | 1 |

**UI 层：**

| 文件 | 说明 | Phase |
|------|------|-------|
| `src/ui/chat/l1-experience-card.tsx` | Chat 内嵌 L1 控件 | 2 |
| `src/ui/chat/gui-param-card.tsx` | 升级版 GUI 参数卡片 | 2 |
| `src/ui/chat/game-type-selector.tsx` | 游戏类型选择卡片 | 4 |
| `src/ui/parameters/board-mode-panel.tsx` | Board Mode 面板 | 3 |
| `src/ui/parameters/param-category-group.tsx` | L2 分类折叠组 | 3 |
| `src/ui/parameters/visual-style-selector.tsx` | 视觉风格选择器 | 6 |
| `src/ui/controls/segmented-control.tsx` | 分段选择器 | 3 |
| `src/ui/controls/stepper-control.tsx` | 步进器 | 3 |
| `src/ui/controls/asset-picker-grid.tsx` | 资产缩略图网格 | 3 |

**测试：**

| 文件 | 说明 | Phase |
|------|------|-------|
| `src/__tests__/parameter-registry.test.ts` | 注册表 + schema 一致性测试 | 1 |
| `src/__tests__/composite-mapper.test.ts` | 映射引擎测试 | 1 |
| `src/__tests__/dependency-resolver.test.ts` | 依赖 DAG 验证 + 可见性测试 | 1 |
| `src/__tests__/spin-wheel.test.ts` | SpinWheel 模块测试 | 1 |
| `src/__tests__/param-card.test.ts` | 参数卡片测试 | 2 |
| `src/__tests__/board-mode.test.ts` | Board Mode 测试 | 3 |
| `src/__tests__/integration/param-registry-schema.test.ts` | Registry vs getSchema() 一致性 | 1 |

### 修改文件（~30+ 个）

**模块参数扩展（~20 个模块文件）：**

| 文件 | 新增参数数 |
|------|----------|
| `src/engine/modules/mechanic/scorer.ts` | +5 |
| `src/engine/modules/mechanic/spawner.ts` | +4 |
| `src/engine/modules/mechanic/collision.ts` | +3 |
| `src/engine/modules/mechanic/lives.ts` | +2 |
| `src/engine/modules/mechanic/quiz-engine.ts` | +5 |
| `src/engine/modules/mechanic/runner.ts` | +3 |
| `src/engine/modules/mechanic/jump.ts` | +3 |
| `src/engine/modules/mechanic/expression-detector.ts` | +6 |
| `src/engine/modules/mechanic/player-movement.ts` | +2 |
| `src/engine/modules/mechanic/difficulty-ramp.ts` | +2 |
| `src/engine/modules/mechanic/projectile.ts` | +4 |
| `src/engine/modules/mechanic/wave-spawner.ts` | +2 |
| `src/engine/modules/mechanic/aim.ts` | +2 |
| `src/engine/modules/mechanic/gesture-match.ts` | +1 |
| `src/engine/modules/mechanic/beat-map.ts` | +3 |
| `src/engine/modules/mechanic/power-up.ts` | +3 |
| `src/engine/modules/input/device-input.ts` | +1 |
| `src/engine/modules/feedback/sound-fx.ts` | +4 |
| `src/engine/modules/feedback/particle-vfx.ts` | +4 |
| `src/engine/modules/feedback/ui-overlay.ts` | +5 |
| `src/engine/modules/feedback/result-screen.ts` | +5 |
| `src/engine/modules/feedback/game-flow.ts` | +3 |
| `src/engine/modules/feedback/camera-follow.ts` | +2 |
| `src/engine/core/gravity.ts` | +1 |

**UI/Store/Agent 修改（~10 个）：**

| 文件 | 变更 | Phase |
|------|------|-------|
| `src/ui/layout/main-layout.tsx` | 布局调整，Board Mode 切换 | 5 |
| `src/ui/chat/studio-chat-panel.tsx` | 支持内嵌 L1/参数卡片渲染 | 2 |
| `src/ui/chat/suggestion-chips.tsx` | 扩展 Chip 类型 | 2 |
| `src/ui/chat/param-card.tsx` | 升级为完整参数编辑器 | 2 |
| `src/ui/editor/schema-renderer.tsx` | 增加 segmented/stepper/asset_picker | 3 |
| `src/store/editor-store.ts` | 增加 boardModeOpen, l1State 等 | 2 |
| `src/store/game-store.ts` | 增加 batchUpdateParams、L1 状态 | 1 |
| `src/agent/conversation-agent.ts` | 新增 push_parameter_card tool | 2 |
| `src/agent/conversation-defs.ts` | 定义新 tool schema | 2 |
| `src/engine/core/types.ts` | 扩展 SchemaField 类型 | 1 |
| `src/engine/module-setup.ts` | 注册 SpinWheel 模块 | 1 |
| `src/agent/game-presets.ts` | 更新 random-wheel preset 使用 SpinWheel | 1 |

---

## 12. 双模型分析关键结论

### 12.1 Codex（后端）推荐方案：Option A — Minimal Overlay

- Parameter Registry 作为 UI/meta 覆盖层，**不替代** ModuleSchema
- ModuleSchema 保持类型/默认值/验证的权威来源
- L1 组合映射通过 `ConfigLoader.applyChanges()` 单次批量更新（已有 API）
- CI 一致性测试确保 Registry 与 `getSchema()` 不漂移
- ConversationAgent 新增 `push_parameter_card` tool，用 Registry 同义词做 NLU 映射

### 12.2 Gemini（前端）关键建议

- Chat 参数卡片需**全局状态绑定** — 旧卡片自动折叠为只读摘要
- Board Mode 用 **Slide-Over** 动画，打开时 dim Chat 面板
- 新控件基于 **Radix UI** 原语，确保键盘导航和 ARIA
- Chat 长列表需**虚拟化**（react-virtuoso），旧卡片 tombstone 化
- 移动端 Board Mode 用 **Bottom Sheet Drawer**

### 12.3 Top 5 风险

1. Registry-Schema 漂移 → CI 一致性测试
2. Chat 参数卡状态过时 → 全局状态绑定 + 旧卡片折叠
3. NLU 参数识别歧义 → 低置信度回退到 Chip
4. 依赖 DAG 循环 → 启动时 DAG 验证
5. 4 条编辑路径认知过载 → 严格视觉层次

### 12.4 设计决策答案

| # | 决策 | 结论 |
|---|------|------|
| 1 | Board Mode 入口 | Suggestion Chip + Chat 按钮，不需固定按钮 |
| 2 | L1 控件位置 | Chat 消息中 + Board Mode 顶部固定 |
| 3 | 参数卡片推送 | Agent 自动 + Chip 手动，低置信度只给 Chip |
| 4 | EditorPanel | 保留为 power user 入口，默认隐藏 |
| 5 | L1 映射精度 | 通用映射 + 游戏类型修正系数 |
| 6 | NLU 实现 | 扩展 ConversationAgent tool_use + Registry 同义词 |
| 7 | 游戏类型缩略图 | 静态预渲染图（先期） |
| 8 | 视觉风格选择器 | 与 L1 Emotion 合并 |

### 12.5 SESSION_ID

- CODEX_SESSION: `019d508e-94b8-7d00-9e97-d8547f5706c2`
