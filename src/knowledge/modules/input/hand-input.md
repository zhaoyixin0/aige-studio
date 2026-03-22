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

## 常见问题 & 边界情况

- 需要先调用 `setTracker(tracker)` 注入 HandTracker 实例
- 当 `result.detected` 为 false 时不会发出任何事件
- 手势过滤器为 `'any'` 时响应所有非 `'none'` 的手势
- 手势事件只在手势变化时触发一次，持续同一手势不会重复发出
- X 轴做了镜像映射 `(1 - result.x) * canvasW`
- 手部未检测到时 `getPosition()` 返回 null
