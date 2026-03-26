# Timer — 计时器模块

## 基本信息
- 类型: mechanic
- 类名: `Timer`
- 注册名: `Timer`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/timer.ts`

## 功能原理

Timer 提供游戏计时功能，支持两种模式：

1. **countdown（倒计时）** — 从 `duration` 倒数到 0，到达后发出 `timer:end` 事件。适用于限时类游戏（catch、tap、shooting 等），倒计时结束触发 GameFlow 结束流程。
2. **stopwatch（正计时）** — 从 0 开始递增，无自动结束。适用于生存类游戏（dodge、runner），记录玩家存活时间作为成绩指标。

每帧发出 `timer:tick` 事件，包含 `remaining`（倒计时剩余秒数）和 `elapsed`（已过秒数），供 UIOverlay 实时更新显示。

### 内部时间管理
- elapsed 以**毫秒**存储，对外接口以**秒**返回
- countdown 模式下 elapsed 被 clamp 到 `duration * 1000`，不会超过
- `timer:end` 仅触发一次，`ended` 标志防止重复
- `gameflowPaused` 时 `update()` 不推进时间

### 业界参考
- **Fruit Ninja**：Arcade 模式 60 秒倒计时 + 时间冻结道具（+5s）
- **Candy Crush**：限步数/限时间双模式，限时模式约 60~120 秒
- **Subway Surfers**：无时间限制（纯生存模式），用正计时记录跑了多远

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| mode | select | `'countdown'` | `countdown` / `stopwatch` | — | 计时模式 |
| duration | range | `30` | 5~300s，步长 1 | 15~90s | 倒计时时长（秒），仅 countdown 模式使用 |
| onEnd | select | `'finish'` | `finish` / `none` | — | 倒计时结束后行为 |

### 参数推荐值（按游戏类型）

| 游戏类型 | mode | duration | onEnd | 说明 |
|---------|------|----------|-------|------|
| catch | countdown | 30s | finish | 标准限时，30s 是休闲游戏黄金时长 |
| tap | countdown | 20~30s | finish | 快节奏，20s 足够 |
| shooting | countdown | 45~60s | finish | 射击节奏较慢，需要更长时间 |
| dodge | stopwatch | — | — | 生存模式，记录存活时间 |
| runner | stopwatch | — | — | 跑酷模式，距离/时间为成绩 |
| quiz | countdown | 60~120s | finish | 答题时间，取决于题目数量 |
| rhythm | countdown | 歌曲时长 | finish | 与音乐时长匹配 |
| expression | countdown | 30~60s | finish | 表情识别挑战 |
| gesture | countdown | 30~60s | finish | 手势识别挑战 |

### duration 调优原则
- **15~30s**：快速轮次（catch、tap）— 适合社交场景，一轮游戏不超过半分钟
- **30~60s**：标准时长（shooting、expression）— 足够展示技巧差异
- **60~120s**：长时游戏（quiz、rhythm）— 内容驱动型需要更长时间
- **> 120s**：不推荐用于休闲游戏，玩家注意力通常在 90s 后显著下降

## 参数调优指南

### mode 选择
- **countdown** 适合：有明确目标（分数最大化）、需要紧迫感、社交分享场景
- **stopwatch** 适合：生存挑战、以"坚持多久"为目标、无限模式
- 倒计时提供心理压力，是休闲游戏最常用的时间机制

### duration 与 DifficultyRamp 的配合
- duration 决定了 DifficultyRamp（time 模式）的最大调整次数
- 例如 duration=30s, DifficultyRamp.every=10s → 最多 3 次难度调整
- 推荐 duration / DifficultyRamp.every = 4~6 次调整，让难度曲线有足够的变化空间

### onEnd 参数
- `'finish'`：倒计时结束后发出 `timer:end`，GameFlow 据此触发 `transition('finished')` 进入结算
- `'none'`：倒计时结束后只发出 `timer:end`，但不自动结束游戏。适用于倒计时只是"阶段标记"而非终止条件的场景（如倒计时结束进入 bonus time）

### 时间奖励机制（当前未内置）
当前 Timer 不支持时间增减（如 +5s 奖励或 -3s 惩罚），但可通过以下方式模拟：
- 修改 Timer.duration 参数（通过 `configure({ duration: newDuration })`）
- 注意：修改 duration 后不影响已过的 elapsed，仅改变终点

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `timer:tick` | `{ remaining: number, elapsed: number }` | **每帧**触发（非每秒），remaining 和 elapsed 均为秒 |
| `timer:end` | （无数据） | countdown 模式下 elapsed >= duration * 1000 时触发（仅一次） |

**`timer:tick` 的典型消费方**：
- UIOverlay — 更新倒计时/正计时 HUD 显示
- 自定义模块 — 基于剩余时间触发特殊行为

**`timer:end` 的典型消费方**：
- GameFlow — 监听后调用 `transition('finished')` 进入结算画面
- ResultScreen — 使用 `timer.getElapsed()` 获取用时

### 监听事件

Timer 不主动监听任何业务事件。暂停/恢复通过 BaseModule 的 `gameflowPaused` 机制统一处理。

## 跨模块联动规则

### 与 GameFlow 的联动（核心）
```
Timer                          GameFlow
┌──────────────┐              ┌──────────────┐
│ countdown 到 0 │──timer:end──→│ transition   │
│              │              │ ('finished') │
│              │←─gameflow:───│              │
│              │  pause       │ 暂停所有模块  │
└──────────────┘              └──────────────┘
```
- `timer:end` 是 countdown 游戏最重要的"游戏结束"信号
- GameFlow 也可以由 Lives（`lives:zero`）触发结束，两者是 OR 关系

### 与 UIOverlay 的联动
- UIOverlay 监听 `timer:tick` 显示时间
- countdown 模式：通常显示 remaining（倒数）
- stopwatch 模式：通常显示 elapsed（正数）
- 当 remaining < 10s 时可触发 UI 警告效果（如文字变红、闪烁）

### 与 DifficultyRamp 的联动
- DifficultyRamp（time 模式）自身追踪时间，不依赖 Timer
- 但两者共享同一个 GameFlow 暂停状态
- 间接关系：Timer.duration 限制了游戏总时长，也限制了 DifficultyRamp 的最大调整次数

### 与 Scorer 的联动
- Timer 和 Scorer 无直接联动
- stopwatch 模式下 elapsed 可作为 ResultScreen 的成绩维度之一
- Scorer 的 scorePerSecond 在 Timer 暂停后也会停止（共享 gameflowPaused）

### 与 Lives 的联动
- countdown 游戏：Timer 和 Lives 都可以触发"游戏结束"
- Timer.onEnd='finish' + Lives → 先到者触发结算
- stopwatch 游戏：通常由 Lives 触发结束，Timer 记录存活时间

## 输入适配

Timer 不处理任何输入，它是纯时间驱动模块。所有 6 种输入方式均兼容。

## 常见 Anti-Pattern

**1. stopwatch 模式设置 onEnd='finish'**
- ❌ `mode: 'stopwatch'`, `onEnd: 'finish'` — stopwatch 永远不会到达 duration，`timer:end` 永远不触发
- ✅ stopwatch 模式下 onEnd 无效（因为不会触发 `timer:end`），但不要依赖它结束游戏

**2. duration 过长导致无聊**
- ❌ `duration: 180`（3 分钟）用于简单 catch 游戏 — 玩家很快失去兴趣
- ✅ 休闲游戏 duration 保持在 20~60s，内容丰富的游戏可到 90~120s

**3. 未考虑 DifficultyRamp 的调整空间**
- ❌ `duration: 15`, DifficultyRamp.every = 10 — 只有 1 次难度调整，曲线过平
- ✅ 确保 `duration / DifficultyRamp.every >= 3`，至少 3 次调整

**4. 倒计时结束但游戏未结束**
- ❌ `onEnd: 'none'` 但没有其他结束机制（如 Lives）— 游戏永远不会结束
- ✅ 至少有一个结束触发器：Timer(onEnd:'finish') 或 Lives(count > 0)

**5. 用 Timer 做节拍计时**
- ❌ 用 Timer 的 `timer:tick` 驱动节奏游戏的节拍 — tick 频率取决于帧率，不精确
- ✅ 节奏游戏使用专门的 BeatmapPlayer 模块处理精确节拍

**6. 忽略暂停状态**
- ❌ 自定义模块读取 `timer.getElapsed()` 但不考虑暂停 — 暂停时间也被算入
- ✅ Timer 内部已处理暂停，elapsed 只在 `gameflowPaused=false` 时增长

## 常见问题 & 边界情况

- elapsed 内部以毫秒存储，对外接口（`getElapsed()`、`getRemaining()`、`timer:tick`）以秒为单位
- countdown 模式下 elapsed 不会超过 `duration * 1000`（`Math.min` clamp）
- `timer:end` 只触发一次，`ended` 标志保证，即使后续 update 继续调用也不会重复
- **`timer:tick` 每帧触发**（非每整秒），这与旧版文档描述不同。UI 侧需自行做节流/取整
- stopwatch 模式下 `remaining` 始终为 0
- `getRemaining()` 返回秒数（countdown 模式），stopwatch 模式返回 0
- `getElapsed()` 返回已过秒数
- 暂停状态下 `update()` 不推进时间（`gameflowPaused` 检查）
- `reset()` 将 elapsed 归零、ended 置 false
- 没有 `addTime(seconds)` 或 `subtractTime(seconds)` 方法 — 时间奖惩需通过 `configure()` 修改 duration
- stopwatch 模式下 duration 参数存在但不使用（不影响行为）
- 极端情况：如果一帧 dt 非常大（如浏览器切后台回来），countdown 会直接跳到结束；stopwatch 的 elapsed 会出现大跳跃
