# GameFlow — 游戏流程控制模块

## 基本信息
- 类型: feedback
- 类名: GameFlow
- 注册名: `GameFlow`

## 功能原理

GameFlow 管理游戏的状态机，控制游戏从准备到结束的完整生命周期。状态流转为：`ready` → `countdown` → `playing` → `finished`。倒计时阶段（countdown）会自动递减计时器，到 0 后自动进入 playing 状态。进入 playing 状态时发出 `gameflow:resume`，进入 finished 状态时发出 `gameflow:pause`。监听 `timer:end` 和 `lives:zero` 事件自动触发游戏结束。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| countdown | number | `3` | `0 ~ 10` | 开场倒计时秒数，设为 0 跳过倒计时直接进入 playing |
| onFinish | select | `'show_result'` | `show_result / restart / none` | 游戏结束后的行为 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `gameflow:state` | `{ state: GameState, previous: GameState }` | 每次状态切换时发出 |
| `gameflow:resume` | （无数据） | 进入 `playing` 状态时发出 |
| `gameflow:pause` | （无数据） | 进入 `finished` 状态时发出 |

GameState 可选值：`'ready'` | `'countdown'` | `'playing'` | `'finished'`

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `timer:end` | 当前状态为 playing 时转入 finished |
| `lives:zero` | 当前状态为 playing 时转入 finished |

## 与其他模块连接方式

- **Timer**: `timer:end` → GameFlow 结束游戏
- **Lives**: `lives:zero` → GameFlow 结束游戏
- **Spawner**: `gameflow:pause/resume` → Spawner 暂停/恢复生成
- **Collision**: `gameflow:pause/resume` → Collision 暂停/恢复检测
- **ResultScreen**: `gameflow:state` 中 state = `'finished'` → ResultScreen 显示结算
- **UIOverlay**: `gameflow:state` → 更新界面状态显示

## 适用游戏类型

所有游戏类型都应包含 GameFlow 模块，它是游戏生命周期管理的核心。

## 参数调优指南

| 游戏类型 | countdown | onFinish | 说明 |
|----------|-----------|----------|------|
| catch/dodge/shooting | 3 | show_result | 标准体验：3秒倒计时让玩家准备 |
| quiz | 3 | show_result | 倒计时让玩家阅读规则 |
| random-wheel | 0 | show_result | 转盘游戏无需准备时间 |
| tap | 3 | show_result | 标准倒计时 |
| runner/platformer | 3 ~ 5 | show_result | 平台游戏可能需要更长准备时间 |
| rhythm | 3 | show_result | 标准倒计时，让玩家听前奏 |
| expression | 3 | show_result | 表情游戏标准倒计时 |
| narrative | 0 | none | 叙事类无需倒计时也无需结算 |
| dress-up | 0 | show_result 或 none | 换装类通常无时间限制 |
| gesture | 3 | show_result | 标准倒计时 |

### countdown 选择指南

```
countdown = 0: 跳过倒计时直接开始（适合非实时类游戏）
  注意: transition('countdown') 会递归调用 transition('playing')

countdown = 3: 标准值（3, 2, 1, GO!）
  足够玩家准备但不会等太久

countdown = 5: 较长倒计时
  适合需要阅读规则或准备姿势的游戏（如 body-input 游戏）

countdown = 10: 最大值
  极少使用，仅在特殊场景（如组队游戏等待所有人就绪）
```

### onFinish 选择指南

```
show_result: 显示结算画面（分数、星级、操作按钮）
  适合: 几乎所有有分数的游戏

restart: 自动重新开始
  适合: 无限循环型游戏（如抽奖转盘的"再来一次"）
  注意: GameFlow 本身不自动执行 restart，需要上层 UI 读取配置后实现

none: 什么都不做
  适合: 叙事类、演示类、无结束条件的游戏
```

## 跨模块联动规则

### 与所有模块的暂停/恢复控制（核心职责）

GameFlow 是**全局状态控制器**，通过 `gameflow:pause` / `gameflow:resume` 控制所有模块的暂停/恢复：

| 模块类别 | 受影响的模块 | 暂停时的行为 |
|----------|-------------|-------------|
| Input | FaceInput, HandInput, BodyInput, DeviceInput, AudioInput | 停止发出输入事件（但硬件仍在采集） |
| Input | TouchInput | 不受 gameflowPaused 影响（始终可接收触摸，用于 UI 交互） |
| Mechanic | Spawner | 暂停生成新物体 |
| Mechanic | Collision | 暂停碰撞检测 |
| Mechanic | Timer | 暂停计时 |
| Mechanic | Scorer | 暂停计分 |
| Mechanic | DifficultyRamp | 暂停难度递增 |
| Mechanic | Runner | 暂停自动奔跑 |
| Mechanic | Gravity, Jump, PlayerMovement | 暂停物理和移动 |
| Mechanic | 所有 Platform 模块 | 暂停移动/崩塌 |
| Feedback | ParticleVFX | 暂停粒子更新（冻结） |
| Feedback | UIOverlay | **不暂停**（始终更新 HUD） |
| Feedback | ResultScreen | **不暂停**（始终监听 gameflow:state） |
| Feedback | SoundFX | **不暂停**（始终响应事件播放音效） |
| Feedback | CameraFollow | 暂停相机跟随 |

**机制**: BaseModule 默认 `gameflowPaused = true`，收到 `gameflow:resume` 后设为 false，收到 `gameflow:pause` 后设为 true。GameFlow 自身设 `gameflowPaused = false`（自己不受暂停影响）。

### 与 Timer 模块
- `timer:end` → GameFlow 从 playing 转入 finished
- Timer 响应 `gameflow:pause/resume` 暂停/恢复计时
- 因此 countdown 阶段 Timer 不会开始计时（直到 playing 状态的 resume 信号）

### 与 Lives 模块
- `lives:zero` → GameFlow 从 playing 转入 finished
- Lives 响应 `gameflow:pause/resume` 暂停/恢复伤害接收

### 与 ResultScreen 模块
- `gameflow:state` 中 state = `'finished'` → ResultScreen 显示结算
- ResultScreen 设 `gameflowPaused = false`（始终监听状态变化）

### 与 UIOverlay 模块
- `gameflow:state` → UIOverlay 可据此更新界面显示（如显示倒计时/GAME OVER）
- UIOverlay 设 `gameflowPaused = false`（始终更新 HUD 数据）

### 与 Spawner / Collision 模块
- `gameflow:resume` → Spawner 开始生成，Collision 开始检测
- `gameflow:pause` → Spawner 停止生成，Collision 停止检测
- 确保 finished 后不会继续生成/碰撞

### 状态机流转图

```
  [ready]
     ↓  transition('countdown')
  [countdown]
     ↓  countdownTimer 递减到 0
     ↓  （或 countdown=0 时直接递归）
  [playing]  ← emit('gameflow:resume')
     ↓  timer:end 或 lives:zero
  [finished] ← emit('gameflow:pause')
     ↓  （上层 UI 读取 onFinish 决定后续行为）
  [ready]   ← reset() 由外部调用
```

## 输入适配

GameFlow 本身不直接响应输入事件，但它控制着所有其他模块对输入的响应能力：

| 输入方式 | 对 GameFlow 的影响 | 建议 |
|----------|-------------------|------|
| TouchInput | 触摸用于启动游戏（click to start → transition('countdown')） | countdown >= 3 给用户准备时间 |
| FaceInput | 面部追踪需要初始化时间 | countdown >= 3 让 tracker 稳定 |
| HandInput | 手部追踪需要初始化时间 | countdown >= 3 让 tracker 稳定 |
| BodyInput | 身体追踪性能开销大，需要更长准备时间 | countdown >= 5 让玩家就位 |
| DeviceInput | 设备需要权限授权 | 在 ready 阶段完成权限请求，countdown >= 3 |
| AudioInput | 麦克风需要权限授权 | 在 ready 阶段完成权限请求，countdown >= 3 |

**多输入场景**: 使用摄像头/设备传感器输入时，建议增加 countdown 值，让硬件初始化完成后再开始游戏。

## 常见 Anti-Pattern

- ❌ **模块不监听 gameflow:pause/resume** → 游戏结束后 Spawner 继续生成物体，Collision 继续检测
  ✅ 所有游戏逻辑模块通过 BaseModule 的 `gameflowPaused` 机制自动暂停

- ❌ **在 countdown 阶段就开始生成物体** → 物体在玩家准备时就出现，不公平
  ✅ Spawner 等模块默认 gameflowPaused = true，只在 playing 后才活跃

- ❌ **在非 playing 状态响应 timer:end / lives:zero** → 可能导致从 ready/countdown 直接跳到 finished
  ✅ 源码已保护：只有 `this.state === 'playing'` 时才响应这两个事件

- ❌ **期望 onFinish='restart' 自动重启游戏** → GameFlow 不自动执行 restart
  ✅ 上层 UI 组件读取 `onFinish` 值并实现对应行为

- ❌ **countdown=0 时发送两次 gameflow:state** → 会发出 state=countdown 和 state=playing 两次事件
  ✅ 这是预期行为，接收端应只关心最终状态，或用去重逻辑

- ❌ **在 finished 后直接调用 transition('playing') 而不 reset()** → state 直接从 finished 跳到 playing，跳过了 ready 和 countdown
  ✅ 先调用 `reset()`，再走完整流程 `transition('countdown')`

## 常见问题 & 边界情况

- countdown 设为 0 时，`transition('countdown')` 会直接递归调用 `transition('playing')`
- 状态切换通过 `transition(newState)` 方法，可从外部调用
- playing 状态才会响应 `timer:end` 和 `lives:zero`，其他状态下忽略
- `gameflow:pause` 和 `gameflow:resume` 是全局暂停信号，所有可暂停模块都应监听
- `getState()` 返回当前状态
- `reset()` 将状态重置为 `'ready'`，计时器归零
- onFinish 的值由上层业务逻辑读取，GameFlow 本身不自动执行 restart 等操作
- GameFlow 自身的 `gameflowPaused` 在 init 时设为 false（自己不受暂停影响）
- `getCountdownRemaining()` 返回当前倒计时剩余秒数
- `getDependencies()` 声明 Timer 和 Lives 为可选依赖
