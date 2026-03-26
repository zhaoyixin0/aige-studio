# BranchStateMachine — 分支状态机模块

## 基本信息
- 类型: mechanic
- 类名: `BranchStateMachine`
- 注册名: `BranchStateMachine`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/branch-state-machine.ts`

## 功能原理

BranchStateMachine 实现互动叙事/视觉小说的分支逻辑。管理一个状态树（state tree），每个状态包含一段文本和若干选项（choices），每个选项指向另一个状态。玩家通过点击选项推进故事，到达无选项的节点（终端节点）或不存在的状态时游戏结束。

### 核心流程
```
BranchStateMachine.start()
    ↓ goToState(startState)
    ↓ 查找 states[startState]
    ├── 存在 → currentState = startState
    │   ↓ emit branch:stateChange { from: null, to, text, choices }
    │   ↓ choices.length > 0 ?
    │   │   ├── 是 → 等待玩家选择
    │   │   └── 否 → emit branch:end { stateId, text } → started = false
    │   ↓
    │   input:touch:tap { choiceIndex }
    │   ↓
    │   choose(choiceIndex)
    │   ↓ emit branch:choice { stateId, choiceIndex, label, target }
    │   ↓ goToState(target) → 循环
    │
    └── 不存在 → emit branch:end { reason: 'state_not_found' } → started = false
```

### 状态树结构
```typescript
states: Record<string, BranchState>
// 其中
BranchState = {
  text: string;              // 节点文本（对话/叙述/描述）
  choices: BranchChoice[];   // 选项数组
}
BranchChoice = {
  label: string;  // 选项显示文本
  target: string; // 目标状态 ID
}
```

### 终止条件
1. **终端节点**：choices 为空数组或 undefined → branch:end + started=false
2. **状态缺失**：target 指向的状态在 states 中不存在 → branch:end + reason='state_not_found'

### 业界参考
- **Twine**：基于 passage（节点）+ link（选项）的超文本叙事引擎
- **Ren'Py**：Python 驱动的视觉小说引擎，支持 label（状态）+ menu（选项）+ 变量
- **Ink (Inkle)**：支持变量追踪、条件分支、隧道（子流程）
- **Yarn Spinner**：Unity 生态的对话系统，node（节点）+ option（选项）+ 变量
- **Narrat**：YAML 驱动的叙事引擎，支持 RPG 元素

### 与更复杂引擎的差异
当前 BranchStateMachine 是一个**最小化实现**：
- 无变量系统（Ink/Ren'Py 有 flags/counters）
- 无条件分支（不能根据变量隐藏/显示选项）
- 无文本模板（不能在文本中嵌入变量值）
- 无子状态/嵌套（每个节点是扁平的）
- 无回退/历史（选了就不能撤回）

这些特性可通过外部逻辑或未来扩展实现。

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| states | object | `{}` | Record<string, BranchState> | — | 状态树（所有节点及其选项） |
| startState | string | `'start'` | 任意字符串 | — | 起始状态 ID |

### states 结构示例
```json
{
  "start": {
    "text": "你站在一个十字路口。左边是幽暗的森林，右边是明亮的草原。",
    "choices": [
      { "label": "走向森林", "target": "forest" },
      { "label": "走向草原", "target": "plains" }
    ]
  },
  "forest": {
    "text": "森林中传来狼嚎声。你看到一条小径和一个山洞。",
    "choices": [
      { "label": "沿小径前进", "target": "path" },
      { "label": "进入山洞", "target": "cave" }
    ]
  },
  "cave": {
    "text": "山洞里有一只沉睡的龙。你悄悄地退了出来。故事结束。",
    "choices": []
  }
}
```

### 状态树设计指南

| 故事规模 | 节点数 | 分支数 | 结局数 | 适合场景 |
|---------|-------|-------|-------|---------|
| 微型 | 3~5 | 1~2 层 | 2~3 | 社交小游戏、教程 |
| 小型 | 6~12 | 2~3 层 | 3~5 | 短篇互动故事 |
| 中型 | 13~25 | 3~4 层 | 5~8 | 标准视觉小说章节 |
| 大型 | 25+ | 4+ 层 | 8+ | 完整互动小说（需工具辅助编辑） |

### 分支结构模式

**1. 树形分支（最常见）**
```
     start
    /      \
  A          B
 / \        / \
C   D      E   F (结局)
```
- 每次选择导向不同路径，无交叉
- 节点数指数增长：深度 D, 每层 K 选项 → 最多 K^D 个叶节点

**2. 钻石形（汇聚）**
```
     start
    /      \
  A          B
    \      /
     merge
    /      \
  C          D (结局)
```
- 不同路径最终汇聚到同一节点
- 控制节点总数，减少内容创作量

**3. 平行线（假选择）**
```
start → A1/A2 → B → C1/C2 → D (结局)
```
- 选择改变当前节点文本但不影响主线走向
- 提供选择感但减少分支管理复杂度

## 参数调优指南

### states 设计
- 每个节点的 text 长度建议 50~200 字（手机屏幕可读性）
- 每个节点提供 2~4 个选项（2 最常见，>4 会让玩家选择疲劳）
- 避免死循环：不要让选项 target 指向已访问的节点（当前无防死循环机制）
- 终端节点的 text 应明确暗示"故事结束"

### startState 设计
- 通常使用 `'start'` 或 `'intro'`
- 如果 states 中不存在 startState 对应的键，游戏立即结束（branch:end）

### 选项文本设计
- 选项 label 应简短明了（10~30 字）
- 让玩家能预测选择的大致方向，但保留悬念
- 避免明显的"正确/错误"暗示（除非有意设计道德困境）

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `branch:stateChange` | `{ from: string\|null, to: string, text: string, choices: BranchChoice[] }` | 每次状态转移时（含初始进入） |
| `branch:choice` | `{ stateId: string, choiceIndex: number, label: string, target: string }` | 玩家做出选择时 |
| `branch:end` | `{ stateId?: string, text?: string, reason?: string }` | 到达终端节点或状态缺失时 |

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `input:touch:tap` | TouchInput | data.choiceIndex 触发 choose() |

## 跨模块联动规则

### 与 TouchInput 的联动（上游）
```
TouchInput → input:touch:tap { choiceIndex: 0 }
    ↓
BranchStateMachine.choose(0) → 选择第一个选项
```
- 需要渲染层/UI 层将点击坐标映射为 choiceIndex（选项按钮的点击）
- 没有 choiceIndex 的 tap 事件被忽略

### 与 GameFlow 的联动
- branch:end 可触发 GameFlow.transition('finished')
- 叙事游戏通常不需要 Timer（故事节奏由玩家控制）
- GameFlow.countdown 可设为 0（无开场倒计时，直接进入故事）

### 与 Scorer 的联动
- 叙事游戏通常不计分（scoring.correct = 0, scoring.wrong = 0）
- 可选：根据选择路径在终端节点加分（需自定义逻辑）
- 可选：Scorer 监听 `branch:choice` 根据 choiceIndex 给不同分数

### 与 Timer 的联动
- 通常不使用 Timer（让玩家自由阅读）
- 可选：Timer（countdown）限制每个节点的阅读时间（超时自动选择第一个选项）
- 可选：Timer（stopwatch）记录通关总时长

### 与反馈模块的联动
- **UIOverlay**：监听 branch:stateChange 显示文本和选项按钮
- **SoundFX**：branch:choice → 翻页/选择音效，branch:end → 结局音效
- **ParticleVFX**：branch:stateChange → 场景转换特效
- **ResultScreen**：branch:end → 显示到达的结局信息

### 与 QuizEngine 的互斥
- 旧版 narrative 游戏类型使用 QuizEngine 模拟分支（将选项包装为问答题）
- BranchStateMachine 是专用替代品，提供真正的状态树和分支逻辑
- 不应同时使用两者处理叙事（会有事件冲突和 UI 混乱）

## 输入适配

| 输入方式 | 适配策略 |
|---------|---------|
| TouchInput | 原生支持，通过 `input:touch:tap` 的 choiceIndex |
| FaceInput | 可扩展：特定表情选择选项（如微笑=选项1, 张嘴=选项2），需自定义映射 |
| HandInput | 可扩展：手势选择选项（如竖拇指=选项1, 比耶=选项2），需自定义映射 |
| BodyInput | 不适用（身体姿势不适合精确选择） |
| DeviceInput | 可扩展：设备倾斜选择 + 摇动确认 |
| AudioInput | 可扩展：语音识别选择选项（未来特性） |

## 常见 Anti-Pattern

**1. 状态树中存在死循环**
- ❌ states: `{ A: { choices: [{ target: 'B' }] }, B: { choices: [{ target: 'A' }] } }` — 玩家永远走不出
- ✅ 确保所有路径最终到达终端节点（choices 为空的节点）

**2. target 指向不存在的状态**
- ❌ choice.target = 'missing_state' → 游戏突然结束（branch:end reason='state_not_found'）
- ✅ 在设计时验证所有 target 都有对应的 states 键

**3. startState 未在 states 中定义**
- ❌ `startState = 'intro'` 但 states 中只有 'start' 键 → 游戏立即结束
- ✅ 确保 startState 对应 states 中的一个有效键

**4. 选项过多导致 UI 溢出**
- ❌ 一个节点有 8 个选项 → 手机屏幕放不下
- ✅ 每节点最多 4 个选项，超过需分页或重新设计叙事结构

**5. 叙事游戏添加不必要的 Timer**
- ❌ Timer countdown=30s 在叙事游戏中 → 玩家来不及阅读就超时
- ✅ 叙事游戏不加 Timer，或设足够长的阅读时间（60s+ per node）

**6. 同时使用 QuizEngine 和 BranchStateMachine**
- ❌ 两者都处理选项/选择逻辑 → UI 显示混乱，事件冲突
- ✅ 叙事游戏选一个：QuizEngine（简单线性）或 BranchStateMachine（真实分支）

## 常见问题 & 边界情况

- `start()` 必须外部调用，init 时不自动启动
- `goToState()` 是 public 方法，外部可调用实现"跳转到指定节点"
- `choose()` 在 started=false 或 currentState=null 时静默返回
- choiceIndex 越界（< 0 或 >= choices.length）时静默返回
- branch:stateChange 的 from 在首次进入时为 null
- 终端节点（choices 为空）触发 branch:end 后 started=false，不再响应输入
- `getCurrentStateData()` 返回当前节点的完整 BranchState（text + choices）
- update() 是 no-op（纯事件驱动模块）
- `reset()` 仅清空 currentState 和 started，不清空 states 参数（配置保留）
- states 对象从 params 中引用（非深拷贝），修改 params.states 会影响运行时行为
- 无历史记录/撤销机制，选择不可回退
- 无变量/条件系统，所有选项始终可见（不能基于之前的选择隐藏选项）
- 状态树的复杂度受限于 JSON 配置的手动编辑能力，大型故事建议使用外部编辑工具生成
