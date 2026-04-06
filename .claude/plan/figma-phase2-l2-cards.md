# Figma Phase 2 — L2 模块定制卡片实施计划

> Synthesized from Codex (router architecture + backward compat) + Gemini (UX grouping + visual consistency).
> Scope: Step 5-6 of figma-alignment.md

---

## 📋 实施计划：L2 Module Bespoke Cards

### 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

### 技术方案

**核心思路：Category-Keyed Router + 2 Bespoke Cards + Generic Fallback**

1. 新增 `BespokeParamCard` 路由器，按 `ParamCategory` 分发到定制卡片
2. 别名映射兼容原计划类别名（`player`→`game_objects`，`visual`→`visual_audio`）
3. 2 个定制卡片：`GameMechanicsCard`、`VisualAudioCard`
4. 其余类别（`game_objects`、`input`、`online`）回退到现有通用 `GuiParamCard`
5. 定制卡片内部按逻辑子分组组织参数，但不做折叠/渐进披露
6. 复用现有 `ParamRow`/`ParamControl` 控件，不重写

### 实施步骤

#### Step 1: 提取可复用内部组件 (S)

**目标：** 从 `gui-param-card.tsx` 导出 `ParamRow`、`ParamControl`、`TombstoneCard` 供定制卡片复用。

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/gui-param-card.tsx` | Modify | 导出 `ParamRow`, `TombstoneCard`, `formatDefaultValue`, `categoryLabel` |

**变更：**
- 将 `ParamRow`、`TombstoneCard`、`formatDefaultValue`、`categoryLabel` 从内部函数改为 `export`
- 不改变任何行为

**测试：** 无新测试（现有测试覆盖）

---

#### Step 2: 创建共享卡片壳 + 子分组组件 (S)

**目标：** 统一定制卡片的外观壳（与 L1ExperienceCard 一致）。

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/bespoke-cards/card-shell.tsx` | Create | 共享卡片壳 + Section 子分组 |

**CardShell (~40 lines):**
```tsx
interface CardShellProps {
  readonly icon: string;
  readonly title: string;
  readonly children: React.ReactNode;
}
// rounded-xl bg-white/5 border border-white/10 p-5 space-y-5
// shadow-[0px_6px_32px_0px_rgba(0,0,0,0.16)]
// Header: icon + title (text-sm font-medium text-gray-400)
```

**Section (~20 lines):**
```tsx
interface SectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}
// text-[11px] uppercase text-gray-500 tracking-wide + gap-2
```

**测试 (2):** CardShell 渲染 title+children, Section 渲染 title+children

---

#### Step 3: 创建路由器 BespokeParamCard (M)

**目标：** 按 category 路由到定制卡片或回退通用。

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/bespoke-cards/index.tsx` | Create | BespokeParamCard 路由器 |
| `src/ui/chat/bespoke-cards/category-aliases.ts` | Create | 别名映射 |
| `src/ui/chat/message-list.tsx` | Modify | GuiParamCard → BespokeParamCard |
| `src/ui/chat/bespoke-cards/__tests__/card-router.test.tsx` | Create | 路由测试 |

**别名映射：**
```ts
const CATEGORY_ALIASES: Record<string, string> = {
  visual: 'visual_audio',
  audio: 'visual_audio',
  particles: 'visual_audio',
  player: 'game_objects',
  enemy: 'game_objects',
};
```

**路由器 (~30 lines):**
```tsx
const BESPOKE_REGISTRY: Record<string, ComponentType<GuiParamCardProps>> = {
  game_mechanics: GameMechanicsCard,
  visual_audio: VisualAudioCard,
};

export function BespokeParamCard(props: GuiParamCardProps) {
  const canonical = CATEGORY_ALIASES[props.category] ?? props.category;
  const Card = BESPOKE_REGISTRY[canonical];
  if (Card) return <Card {...props} category={canonical} />;
  return <GuiParamCard {...props} />;
}
```

**测试 (5):**
- `game_mechanics` → 渲染 GameMechanicsCard (via data-testid)
- `visual_audio` → 渲染 VisualAudioCard
- `visual` (别名) → 路由到 VisualAudioCard
- `player` (别名) → 路由到通用 GuiParamCard (game_objects 无定制)
- `online` (未知) → 回退通用 GuiParamCard

---

#### Step 4: GameMechanicsCard 定制卡片 (M)

**目标：** game_mechanics 类别使用分组布局。

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/bespoke-cards/game-mechanics-card.tsx` | Create | 游戏机制定制卡片 |
| `src/ui/chat/bespoke-cards/__tests__/game-mechanics-card.test.tsx` | Create | 测试 |

**子分组：**
```ts
const SECTIONS = [
  { title: '核心规则', ids: ['game_mechanics_001', 'game_mechanics_002', 'game_mechanics_003'] },
  { title: '移动与物理', ids: ['game_mechanics_008', 'game_mechanics_011', 'game_mechanics_014', 'game_mechanics_016'] },
  { title: '生成与难度', ids: ['game_mechanics_005', 'game_mechanics_006', 'game_mechanics_007'] },
] as const;
```

**行为：**
- Active 模式：CardShell + Section 子分组 + ParamRow 渲染
- Tombstone 模式：复用 TombstoneCard
- 不在 SECTIONS 中的 paramIds → 放入 "其他" section（兜底）

**测试 (4):**
- 渲染 Section 标题（核心规则、移动与物理、生成与难度）
- 不在分组中的参数显示在"其他"
- onChange 正确传递
- isActive=false 渲染 tombstone

---

#### Step 5: VisualAudioCard 定制卡片 (M)

**目标：** visual_audio 类别使用分组布局。

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/bespoke-cards/visual-audio-card.tsx` | Create | 视觉音频定制卡片 |
| `src/ui/chat/bespoke-cards/__tests__/visual-audio-card.test.tsx` | Create | 测试 |

**子分组：**
```ts
const SECTIONS = [
  { title: '视觉风格', ids: ['visual_audio_003', 'visual_audio_006', 'visual_audio_009'] },
  { title: '界面', ids: ['visual_audio_001', 'visual_audio_004', 'visual_audio_005', 'visual_audio_010'] },
  { title: '结果页', ids: ['visual_audio_002', 'visual_audio_011', 'visual_audio_012', 'visual_audio_013', 'visual_audio_014'] },
  { title: '音效', ids: ['visual_audio_007', 'visual_audio_008'] },
  { title: '特效', ids: ['visual_audio_015', 'visual_audio_016', 'visual_audio_017', 'visual_audio_020'] },
] as const;
```

**行为：** 同 GameMechanicsCard 模式。

**测试 (4):**
- 渲染 Section 标题（视觉风格、界面、结果页、音效、特效）
- 不在分组中的参数显示在"其他"
- onChange 正确传递
- isActive=false 渲染 tombstone

---

#### Step 6: 集成接线 (S)

**目标：** 在 message-list.tsx 中将 GuiParamCard 替换为 BespokeParamCard。

**文件：**
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/message-list.tsx` | Modify | import BespokeParamCard，替换 GuiParamCard 调用 |
| `src/ui/chat/__tests__/message-list.test.tsx` | Modify | 更新 mock 或 import |

**变更：**
- Line ~9: `import { BespokeParamCard } from './bespoke-cards'`
- Line ~192: `<BespokeParamCard .../>` 替换 `<GuiParamCard .../>`

**测试：** 现有 message-list 测试通过即可

---

### 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/chat/gui-param-card.tsx` | Modify | 导出内部组件 |
| `src/ui/chat/bespoke-cards/card-shell.tsx` | Create | 共享卡片壳 |
| `src/ui/chat/bespoke-cards/category-aliases.ts` | Create | 别名映射 |
| `src/ui/chat/bespoke-cards/index.tsx` | Create | 路由器 |
| `src/ui/chat/bespoke-cards/game-mechanics-card.tsx` | Create | 游戏机制卡片 |
| `src/ui/chat/bespoke-cards/visual-audio-card.tsx` | Create | 视觉音频卡片 |
| `src/ui/chat/bespoke-cards/__tests__/card-router.test.tsx` | Create | 路由测试 |
| `src/ui/chat/bespoke-cards/__tests__/game-mechanics-card.test.tsx` | Create | 机制卡片测试 |
| `src/ui/chat/bespoke-cards/__tests__/visual-audio-card.test.tsx` | Create | 音频卡片测试 |
| `src/ui/chat/message-list.tsx` | Modify | 接线 |

### 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 子分组 paramIds 与实际注册表不同步 | 兜底 "其他" section 捕获未分组参数 |
| message-list 测试因 import 变化失败 | Step 6 同步更新 mock |
| 未来新 category 无定制卡片 | 路由器 fallback 到通用 GuiParamCard |
| 定制卡片与通用卡片视觉不一致 | CardShell 统一样式 |

### 预估测试增量: ~15 tests

### Execution Order
```
Step 1: 导出内部组件 — ~10min
Step 2: CardShell + Section — ~15min  
Step 3: 路由器 + 别名 + 测试 — ~30min
Step 4: GameMechanicsCard + 测试 — ~30min
Step 5: VisualAudioCard + 测试 — ~30min
Step 6: 集成接线 — ~10min
```

Total: ~2h

### SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: 019d6130-567b-77e3-9697-70def5bd00eb
- GEMINI_SESSION: (policy mode, no persistent session)
