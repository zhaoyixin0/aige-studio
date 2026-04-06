# Figma Design Alignment — Implementation Plan

> Synthesized from Codex (architecture + data flow) + Gemini (component design + interactions).
> Target: Figma node 3018:45708 "GameParameter" — 三层渐进参数系统.

---

## Overview

对齐 Figma 设计的 7 个前端差距，按优先级分 4 个 Phase 执行。

**8 steps, TDD, estimated 4-6 hours sequential.**

---

## Dependency Graph

```
Phase 1 (P0):
  Step 1 (L1 Controls) ──→ Step 2 (L1 Integration)
  Step 3 (Chip Thumbnails + Board Mode)

Phase 2 (P1):
  Step 4 (Preview Stepper)
  Step 5 (L2 Card Router + Scaffolds) ──→ Step 6 (L2 Card Details)

Phase 3 (P2):
  Step 7 (L3 Grouped Pills)

Phase 4 (Deferred):
  Step 8 (Expert Browser entry wiring)
```

---

## Phase 1: P0 — L1 视觉对齐 + Chip 增强

### Step 1: L1 Control Primitives

**Goal:** 创建 3 个新控件替代现有文字 SegmentedControl。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/controls/emoji-icon-group.tsx` | Create | 4 emoji 图标按钮组（选中白底，未选 #34383c） |
| `src/ui/controls/gradient-slider.tsx` | Create | 渐变轨道滑块 + 左右 emoji + Radix Tooltip |
| `src/ui/controls/style-carousel.tsx` | Create | 115x115px 画风轮播卡片，选中 3px 白边 |
| `src/ui/controls/__tests__/l1-controls.test.tsx` | Create | 控件单元测试 |

**EmojiIconGroup (~100 lines):**
```tsx
interface EmojiIconGroupProps {
  readonly items: readonly { value: string; emoji: string }[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}
// 4 个圆角按钮，选中 bg-white text-black，未选 bg-[#34383c]
// aria-pressed 无障碍属性
```

**GradientSlider (~120 lines):**
```tsx
interface GradientSliderProps {
  readonly value: number; // 0-100
  readonly onChange: (value: number) => void;
  readonly leftIcon: string;  // 🐱
  readonly rightIcon: string; // 🐇
  readonly tooltipText?: string;
}
// Radix Slider.Root + gradient track
// Thumb 包裹 Radix Tooltip，拖拽时显示
```

**StyleCarousel (~120 lines):**
```tsx
interface StyleCarouselProps {
  readonly items: readonly { id: string; label: string; thumbnail?: string }[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}
// overflow-x-auto snap-x 横向滚动
// 选中卡片：border-3 border-white rounded-[20px]
// 卡片尺寸：115x115px
```

**Test Strategy (8 tests):**
- EmojiIconGroup: 选中/未选中样式切换、onChange 回调、aria-pressed
- GradientSlider: 值更新、tooltip 显示、左右图标渲染
- StyleCarousel: 选中边框、点击选择、横向滚动

**Size: M**

---

### Step 2: L1 Card Integration

**Goal:** 将新控件集成到 L1ExperienceCard，替换 SegmentedControl。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/l1-experience-card.tsx` | Modify | 使用新控件替换 SegmentedControl |
| `src/ui/chat/__tests__/l1-experience-card.test.tsx` | Modify | 更新测试 |

**Integration:**
- Difficulty → EmojiIconGroup (4 emoji: 😀😄😊🤩 或类似渐进难度表情)
- Pacing → GradientSlider (0-100, 🐱→🐇)
- Emotion/Style → StyleCarousel (cartoon/pixel/realistic 等)

**Test Strategy (4 tests):**
- 各控件正确渲染
- onChange 回调正确传递
- 与 L1State store 正确绑定

**Size: S | Depends on: Step 1**

---

### Step 3: Chip Thumbnails + Board Mode Enhancement

**Goal:** Chip 类型支持缩略图，Board Mode chip 显示 flow 图标。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/store/editor-store.ts` | Modify | Chip 类型增加 `thumbnail?: string` |
| `src/ui/chat/suggestion-chips.tsx` | Modify | 渲染缩略图 img |
| `src/ui/chat/__tests__/suggestion-chips-thumbnail.test.tsx` | Create | 缩略图测试 |

**Chip Type Extension:**
```ts
export interface Chip {
  // ...existing fields
  thumbnail?: string; // 28x24px image URL (optional, backward compatible)
}
```

**Rendering:**
```tsx
{chip.thumbnail && (
  <img src={chip.thumbnail} alt="" className="w-[28px] h-[24px] object-cover rounded" />
)}
```

**Test Strategy (4 tests):**
- 有缩略图时渲染 img
- 无缩略图时不渲染 img（向后兼容）
- Board Mode chip 特殊样式
- 布局不因缩略图有无而跳变

**Size: S**

---

## Phase 2: P1 — 预览状态条 + L2 卡片

### Step 4: Preview Progress Indicator

**Goal:** 预览区底部 4 步状态指示器。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/store/editor-store.ts` | Modify | 添加 `previewPhase` 状态 |
| `src/ui/preview/step-indicator.tsx` | Create | 4 步进度条组件 |
| `src/ui/preview/preview-canvas.tsx` | Modify | 底部挂载 StepIndicator |
| `src/ui/preview/__tests__/step-indicator.test.tsx` | Create | 测试 |

**PreviewPhase Type:**
```ts
export type PreviewPhase = 'tuning' | 'playing' | 'success' | 'fail';
```

**StepIndicator (~80 lines):**
```tsx
const STEPS = [
  { key: 'tuning', label: '调式状态' },
  { key: 'playing', label: '游戏状态' },
  { key: 'success', label: '成功' },
  { key: 'fail', label: '失败' },
] as const;
// 横向 4 步，连接线，当前步高亮，前步完成态
```

**Test Strategy (4 tests):**
- 默认状态为 tuning
- 各 phase 正确高亮
- 与 PreviewCanvas 底部布局不冲突
- Store action 不可变更新

**Size: S**

---

### Step 5: L2 Card Router + Scaffolds

**Goal:** GuiParamCard 路由到专属 L2 卡片，创建 6 个卡片骨架。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/gui-param-card.tsx` | Modify | 添加路由逻辑 |
| `src/ui/chat/cards/game-conditions-card.tsx` | Create | 游戏条件卡片 |
| `src/ui/chat/cards/player-actor-card.tsx` | Create | 玩家角色卡片 |
| `src/ui/chat/cards/enemy-actor-card.tsx` | Create | 敌人角色卡片 |
| `src/ui/chat/cards/sfx-card.tsx` | Create | 音效系统卡片 |
| `src/ui/chat/cards/visual-styles-card.tsx` | Create | 视觉风格卡片 |
| `src/ui/chat/cards/feedback-effect-card.tsx` | Create | 粒子反馈卡片 |
| `src/ui/chat/cards/__tests__/l2-cards.test.tsx` | Create | 路由 + 渲染测试 |

**Router Logic (in GuiParamCard):**
```tsx
const CARD_MAP: Record<string, ComponentType<CardProps>> = {
  game_mechanics: GameConditionsCard,
  player: PlayerActorCard,
  enemy: EnemyActorCard,
  audio: SfxCard,
  visual: VisualStylesCard,
  particles: FeedbackEffectCard,
};
// If category matches → render bespoke card
// Otherwise → fallback to generic ParamRow layout
```

**Each Card Scaffold (~80-150 lines):**
- 标题栏 + 图标
- 组合现有控件（Slider, Dropdown, Toggle, ImagePicker）
- Props: `{ values, onChange }` 透传
- 每个文件 < 200 行

**Test Strategy (8 tests):**
- 路由正确分发到对应卡片
- 未知 category 回退到通用布局
- 每个卡片骨架可渲染
- onChange 回调正确传递

**Size: L | Depends on: Steps 1-3**

---

### Step 6: L2 Card Detail Implementation

**Goal:** 补全 6 个 L2 卡片的内部控件和交互。

**Files:** 同 Step 5 的 6 个卡片文件

**Per-Card Details:**
- **GameConditions:** 模式 dropdown(icon+desc) + 时长 slider(+input "15s") + 目标分数
- **PlayerActor:** 模式 enum + 速度 slider + 碰撞 dropdown + 77px 外观图片
- **EnemyActor:** 90x90 外观图片 + 生成规则 + 速度 slider + "Add spawn" 按钮
- **SFX:** 音调 multi-slider + 音量 slider+input + 静音 toggle + "更多音效" 按钮
- **VisualStyles:** 复用 VisualStyleSelector + 方向箭头 + 4 预设按钮
- **FeedbackEffect:** 粒子效果 toggle + 速率 slider

**Test Strategy (6 tests):** 每卡片 1 个交互测试

**Size: L | Depends on: Step 5**

---

## Phase 3: P2 — L3 分组 Pills

### Step 7: Grouped Color-Coded Parameter Pills

**Goal:** L3 参数按分类着色分组，点击跳转 Board Mode。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/chat/parameter-pill.tsx` | Modify | 添加 colorVariant prop |
| `src/ui/chat/l3-pills-panel.tsx` | Create | 按 ParamCategory 分组渲染 pills |
| `src/ui/parameters/board-mode-panel.tsx` | Modify | 暴露 scrollToCategory |
| `src/ui/chat/__tests__/l3-pills.test.tsx` | Create | 分组 + 颜色测试 |

**Category Color Map:**
```ts
const CATEGORY_COLORS: Record<string, string> = {
  game_mechanics: 'bg-amber-500/20 text-amber-300',
  objects: 'bg-sky-500/20 text-sky-300',
  visual_audio: 'bg-fuchsia-500/20 text-fuchsia-300',
  input: 'bg-emerald-500/20 text-emerald-300',
};
```

**Test Strategy (4 tests):**
- 按分类正确分组
- 颜色正确映射
- 点击触发 Board Mode 跳转
- 空分类不渲染

**Size: M**

---

## Phase 4: Deferred

### Step 8: Expert Browser Entry Wiring

**Goal:** 将已实现的 ExpertBrowser 连接到 UI 入口（Landing chip + GameTypeSelector badge）。

**Files:**
| File | Operation | Purpose |
|------|-----------|---------|
| `src/ui/landing/landing-page.tsx` | Modify | 添加 "浏览专家模板" action chip |
| `src/ui/chat/game-type-selector.tsx` | Modify | Badge click 打开 ExpertBrowser |
| `src/ui/chat/studio-chat-panel.tsx` | Modify | 挂载 ExpertBrowser 状态 |

**Size: S | Depends on: M6 Expert Browser**

---

## Execution Order

```
Phase 1 (P0): ~2h
  Step 1: L1 Primitives (RED → GREEN) — ~45min
  Step 2: L1 Integration (RED → GREEN) — ~20min
  Step 3: Chip Thumbnails (RED → GREEN) — ~20min

Phase 2 (P1): ~2-3h
  Step 4: Preview Stepper (RED → GREEN) — ~20min
  Step 5: L2 Card Router + Scaffolds (RED → GREEN) — ~45min
  Step 6: L2 Card Details (RED → GREEN) — ~60min

Phase 3 (P2): ~45min
  Step 7: L3 Grouped Pills (RED → GREEN) — ~45min

Phase 4 (Deferred):
  Step 8: Expert Browser Wiring — ~15min
```

### Estimated New Tests: ~38

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| 新控件而非增强 SegmentedControl | Codex 建议增强，Gemini 建议新建；**采用新建**避免通用组件膨胀 |
| GuiParamCard 路由而非替换 | 保持向后兼容，未知 category 回退通用布局 |
| PreviewPhase 放 editor-store | 轻量 UI 状态，不需 engine 耦合 |
| Category color map 硬编码 | 分类有限（5-6 种），不值得 registry 扩展 |
| 复用 VisualStyleSelector | 已有轮播逻辑，添加 115px 变体 |

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Radix Slider gradient 定制难 | tooltip 定位偏移 | asChild 包裹 Thumb，Tailwind arbitrary values |
| L2 卡片代码膨胀 | 6 个卡片总量大 | 抽取 Label+Slider/Dropdown 行组件到 controls/ |
| Store backward compat | 旧 chip 数据无 thumbnail | 所有新字段 optional，渲染分支 guard |
| L3 Pills 分类名与 Figma 不匹配 | Road/Obstacles 非现有 category | 映射 registry category → 显示分组名 |
| Preview stepper 与 Toolbar 重叠 | 布局挤压 | absolute bottom-0 独立层，z-index 管理 |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d610e-a56d-7bd0-aef5-ceb4003c4412
- GEMINI_SESSION: (policy mode, no persistent session)
