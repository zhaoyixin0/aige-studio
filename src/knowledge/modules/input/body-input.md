# BodyInput — 身体追踪输入模块

## 基本信息
- 类型: input
- 类名: BodyInput
- 注册名: `BodyInput`

## 功能原理

BodyInput 通过 MediaPipe Pose 追踪用户全身骨骼关键点。模块将 33 个身体关键点（landmarks）转化为归一化坐标并发出事件。支持姿势匹配功能，可配置目标姿势名称，模块会判断当前身体姿态是否匹配。内置 `handsUp`（双手举过头顶）和 `tPose`（T 字形展开双臂）两种预设姿势。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| skeleton | boolean | `true` | — | 是否显示骨骼线条 |
| matchPose | string | `''` | — | 目标姿势名称，如 `'handsUp'`、`'tPose'`，空字符串表示不匹配 |
| tolerance | range | `0.3` | `0.1 ~ 0.5`，步长 0.05 | 姿势匹配容差，越大越容易匹配 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `input:body:move` | `{ landmarks: BodyLandmark[] }` | 每帧检测到身体时发出完整关键点数组 |
| `input:body:pose` | `{ pose: string, matched: boolean }` | 配置了 matchPose 时每帧发出匹配结果 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | BodyInput 不监听其他模块事件 |

## 与其他模块连接方式

- **Collision**: 身体关键点可用于注册多个碰撞区域（如左手、右手）
- **Scorer**: 通过姿势匹配间接触发计分
- **Spawner**: 身体位置用于世界 AR 类游戏中的物体互动

## 适用游戏类型

- **world-ar**（世界AR类）— 身体与虚拟物体的交互
- **gesture**（手势互动类）— 全身姿势作为输入（扩展用法）

## 常见问题 & 边界情况

- 需要先调用 `setTracker(tracker)` 注入 BodyTracker 实例
- landmarks 数组索引遵循 MediaPipe Pose 标准：11=左肩, 12=右肩, 15=左手腕, 16=右手腕
- 当 `result.detected` 为 false 时不发出任何事件
- 内置姿势匹配仅支持 `handsUp` 和 `tPose`，其他姿势名称会返回 `matched: false`
- 身体追踪在 Web 端性能开销较大，建议在移动设备上降低帧率
- matchPose 为空字符串时不会发出 `input:body:pose` 事件
