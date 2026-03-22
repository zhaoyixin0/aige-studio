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

## 常见问题 & 边界情况

- countdown 设为 0 时，`transition('countdown')` 会直接递归调用 `transition('playing')`
- 状态切换通过 `transition(newState)` 方法，可从外部调用
- playing 状态才会响应 `timer:end` 和 `lives:zero`，其他状态下忽略
- `gameflow:pause` 和 `gameflow:resume` 是全局暂停信号，所有可暂停模块都应监听
- `getState()` 返回当前状态
- `reset()` 将状态重置为 `'ready'`，计时器归零
- onFinish 的值由上层业务逻辑读取，GameFlow 本身不自动执行 restart 等操作
