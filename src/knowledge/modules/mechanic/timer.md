# Timer — 计时器模块

## 基本信息
- 类型: mechanic
- 类名: Timer
- 注册名: `Timer`

## 功能原理

Timer 提供倒计时和正计时两种模式。倒计时模式（countdown）从 duration 开始递减，到 0 时发出 `timer:end` 事件；正计时模式（stopwatch）从 0 开始递增，无自动结束。每经过一整秒发出 `timer:tick` 事件，包含已过时间和剩余时间。支持暂停/恢复控制。onEnd 参数控制倒计时结束后的行为。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| mode | select | `'countdown'` | `countdown / stopwatch` | 计时模式 |
| duration | range | `30` | `5 ~ 300`，步长 1 | 时长（秒），countdown 模式使用 |
| onEnd | select | `'finish'` | `finish / none` | 倒计时结束后的行为 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `timer:tick` | `{ remaining: number, elapsed: number }` | 每经过一整秒时触发，remaining 为倒计时剩余秒数（stopwatch 模式为 0） |
| `timer:end` | （无数据） | countdown 模式下时间耗尽时触发（仅触发一次） |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:pause` | 暂停计时 |
| `gameflow:resume` | 恢复计时 |

## 与其他模块连接方式

- **GameFlow**: `timer:end` → GameFlow 监听后调用 `transition('finished')`
- **UIOverlay**: `timer:tick` → UIOverlay 更新倒计时/计时显示
- **DifficultyRamp**: Timer 的 elapsed 时间驱动 DifficultyRamp 的 time 模式
- **ResultScreen**: 游戏结束后 ResultScreen 调用 `timer.getElapsed()` 获取用时

## 适用游戏类型

- **catch**（接住类）— 倒计时限制游戏时长
- **dodge**（躲避类）— 倒计时限制生存时间
- **quiz**（答题类）— 每题倒计时（由 QuizEngine 管理）+ 总时间
- **tap**（点击类）— 倒计时限制点击时间
- **shooting**（射击类）— 倒计时限制射击时间
- **rhythm**（节奏类）— 正计时记录演奏时间
- **gesture**（手势互动类）— 倒计时限制挑战时间

## 常见问题 & 边界情况

- elapsed 内部以毫秒存储，对外接口以秒为单位
- countdown 模式下 elapsed 不会超过 `duration * 1000`
- `timer:end` 只触发一次，即使后续 update 继续调用也不会重复
- `timer:tick` 通过 lastTickSecond 计数器确保每整秒恰好触发一次
- stopwatch 模式下 `remaining` 始终为 0
- `getRemaining()` 返回秒数（countdown 模式），stopwatch 模式返回 0
- `getElapsed()` 返回已过秒数
- 暂停状态下 `update()` 不推进时间
