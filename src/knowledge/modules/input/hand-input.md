# HandInput — 手部追踪输入模块

## 基本信息
- 类型: input
- 类名: HandInput
- 注册名: `HandInput`

## 功能原理

HandInput 通过 MediaPipe Hands 追踪用户手部位置和手势。模块将手部关键点转化为游戏画布坐标，支持手部位置追踪和手势识别（张开手掌、握拳、竖大拇指、比耶）。手势识别带有过滤器，可以只响应特定手势。X 轴做镜像映射实现自然移动。只有当手势发生变化时才会发出手势事件，避免重复触发。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| gesture | select | `'any'` | `any / open / closed / thumbsUp / peace` | 手势过滤器，`any` 表示响应所有手势 |
| confidence | range | `0.7` | `0.5 ~ 0.95`，步长 0.05 | 手势识别置信度阈值 |
| outputTo | string | `'player'` | — | 输出目标 ID |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `input:hand:move` | `{ x, y }` | 每帧检测到手部时发出，x/y 为画布坐标 |
| `input:hand:gesture` | `{ gesture: string }` | 识别到新手势且通过过滤器时触发（仅在手势变化时触发） |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | HandInput 不监听其他模块事件 |

## 与其他模块连接方式

- **Collision**: `input:hand:move` 的 `{ x, y }` 用于更新玩家碰撞对象位置
- **Scorer**: 手势触发可间接触发计分（通过 Collision hit 事件）
- **Spawner**: 手部位置用于接住物体的碰撞检测

## 适用游戏类型

- **catch**（接住类）— 用手接住下落物体
- **gesture**（手势互动类）— 手势识别作为核心玩法
- **shooting**（射击类）— 手部位置控制准星

## 参数调优指南

| 游戏类型 | gesture | confidence | 说明 |
|----------|---------|------------|------|
| catch | any | 0.7 | 手部位置控制接住容器，手势作为辅助操作 |
| gesture（核心玩法） | any | 0.8 ~ 0.9 | 手势识别是核心，提高置信度减少误判 |
| shooting | open/closed | 0.7 | open=瞄准，closed=射击（握拳触发） |
| dodge | any | 0.65 | 主要用位置控制，手势次要 |
| platformer | open | 0.75 | open 手掌控制移动，握拳跳跃 |

### gesture 过滤器选择指南

| 过滤器 | 响应的手势 | 适用场景 |
|--------|-----------|---------|
| `any` | open, closed, thumbsUp, peace | 所有手势都有意义的游戏 |
| `open` | 仅 open | 张开手掌作为唯一交互方式 |
| `closed` | 仅 closed | 握拳作为触发器（如射击、确认） |
| `thumbsUp` | 仅 thumbsUp | 竖大拇指作为确认/选择 |
| `peace` | 仅 peace | 比耶手势作为特殊触发 |

### confidence 调优

```
confidence = 0.5: 最宽松，容易误判，但几乎不会漏判
confidence = 0.7: 默认值，平衡误判与漏判
confidence = 0.85: 严格，需要清晰的手势才能识别
confidence = 0.95: 极严格，只有非常标准的手势才能通过
```

实际经验：
- 光线良好时 0.7 即可
- 光线不足或背景复杂时建议 0.8+
- 用于核心交互（如手势游戏的得分判定）时建议 0.85+

## 跨模块联动规则

### 与 Collision 模块
- `input:hand:move` 的 `{ x, y }` 直接用于更新玩家碰撞对象位置
- 坐标已经过镜像映射和画布缩放，是最终的画布坐标
- 每帧发出（只要检测到手部），Collision 会在每帧用最新位置做碰撞检测

### 与 PlayerMovement 模块
- `remapEventsForInput` 将 PlayerMovement 的 `continuousEvent` 映射为 `input:hand:move`
- 手部 X 坐标控制玩家水平位置

### 与 Jump / Dash 模块
- `remapEventsForInput` 将 Jump 和 Dash 的 `triggerEvent` 都映射为 `input:hand:gesture`
- **注意**: Jump 和 Dash 共用同一个触发事件 → 任何手势变化都会同时触发跳跃和冲刺
- 建议通过 gesture 过滤器区分：比如 closed（握拳）→ 跳跃，peace（比耶）→ 冲刺

### 与 Scorer 模块
- 手势触发通过 Collision hit 事件间接触发计分
- 也可以直接将 `input:hand:gesture` 映射到 Scorer 的事件（自定义 wiring）

### 与 Spawner 模块
- 手部位置通过 Collision 与 Spawner 生成物交互

### 多输入组合时的冲突处理
- HandInput + TouchInput: 手部控制位置移动，触摸用于 UI 交互（推荐）
- HandInput + FaceInput: **不推荐**，两者都输出位置信息，会冲突
- HandInput + AudioInput: 手部控制位置，声音触发动作（兼容良好）
- HandInput + DeviceInput: **不推荐**，位置输入冲突

## 输入适配

### 适合的游戏类型
- **catch**（接住类）— 手部直接"接住"下落物体，非常直观
- **gesture**（手势互动类）— HandInput 的核心优势，手势识别作为主要交互
- **shooting**（射击类）— 手部位置控制准星，握拳射击
- **dodge**（躲避类）— 手部位置控制角色移动

### 不适合的游戏类型
- **quiz**（答题类）— 手部位置不够精确，无法可靠选择答案
- **puzzle**（拼图/配对类）— 精确选择困难
- **rhythm**（节奏类）— 手势变化检测有延迟，不适合精确时间操作
- **narrative**（分支叙事类）— 选择分支需要精确交互
- **dress-up**（换装类）— 单手操作限制了拖放的精度

## 常见 Anti-Pattern

- ❌ **在手势游戏中设 gesture='any' 且不在接收端区分** → 所有手势都触发同一个动作，失去手势玩法的意义
  ✅ 使用 `input:hand:gesture` 事件的 `gesture` 字段在接收端区分不同手势对应的操作

- ❌ **依赖 gesture 事件的持续发送** → 手势事件只在变化时触发一次，持续同一手势不会重复发出
  ✅ 用 `input:hand:move` 做持续追踪，`input:hand:gesture` 只做触发

- ❌ **confidence 设太低（0.5）** → 手部自然姿态被误判为特定手势
  ✅ 核心交互 confidence >= 0.7，判分交互 >= 0.85

- ❌ **假设 getPosition() 始终有值** → 手未检测到时返回 null
  ✅ 调用 `getPosition()` 前检查返回值

- ❌ **在 Jump 和 Dash 都用 gesture 触发而不区分** → 任何手势同时触发跳跃和冲刺
  ✅ 自定义 wiring 让不同手势触发不同动作，或只映射其中一个

## 常见问题 & 边界情况

- 需要先调用 `setTracker(tracker)` 注入 HandTracker 实例
- 当 `result.detected` 为 false 时不会发出任何事件
- 手势过滤器为 `'any'` 时响应所有非 `'none'` 的手势
- 手势事件只在手势变化时触发一次，持续同一手势不会重复发出
- X 轴做了镜像映射 `(1 - result.x) * canvasW`
- 手部未检测到时 `getPosition()` 返回 null
- `getGesture()` 返回最后识别到的手势名称，手势变为 none 后重置为 null
- gameflowPaused 为 true 时 update 不执行，手部追踪暂停
- `reset()` 只重置 currentGesture 为 null，不影响 tracker 连接
