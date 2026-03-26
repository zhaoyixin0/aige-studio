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

## 参数调优指南

| 游戏类型 | skeleton | matchPose | tolerance | 说明 |
|----------|----------|-----------|-----------|------|
| world-ar | true | — | — | 显示骨骼用于 AR 互动，不需要姿势匹配 |
| gesture（全身姿势） | true | `handsUp` / `tPose` | 0.25 ~ 0.35 | 姿势匹配作为核心玩法 |
| 健身/运动类 | true | 自定义 | 0.2 ~ 0.3 | 较严格的匹配保证运动质量 |
| 舞蹈类 | true | 自定义 | 0.35 ~ 0.45 | 较宽松的匹配降低难度 |

### tolerance 调优

```
tolerance = 0.1: 极严格，需要非常精确的姿势（专业用途）
tolerance = 0.2: 严格，有一定容错但要求大致准确
tolerance = 0.3: 默认值，大多数玩家能通过
tolerance = 0.4: 宽松，只要大致方向正确即可
tolerance = 0.5: 极宽松，几乎任何接近的姿势都能匹配

handsUp 姿势匹配逻辑:
  leftWrist.y < leftShoulder.y - tolerance
  rightWrist.y < rightShoulder.y - tolerance
  即: 手腕需要高于肩膀至少 tolerance 个归一化单位

tPose 姿势匹配逻辑:
  |leftWrist.y - leftShoulder.y| < tolerance
  |rightWrist.y - rightShoulder.y| < tolerance
  即: 手腕和肩膀在同一水平线上，误差不超过 tolerance
```

### skeleton 参数

- `skeleton: true` 时渲染器会绘制骨骼线条，有助于玩家理解自己的姿态
- 对于 AR 类游戏建议开启
- 对于纯姿势判定游戏可关闭以减少视觉干扰

## 跨模块联动规则

### 与 Collision 模块
- 身体关键点可用于注册多个碰撞区域（如左手、右手、头部等独立碰撞体）
- landmarks 提供 33 个关键点坐标，可选择任意子集作为碰撞对象
- **注意**: landmarks 坐标是归一化的 (0~1)，需要乘以画布尺寸转为像素坐标

### 与 Scorer 模块
- 通过 `input:body:pose` 的 `matched: true` 间接触发计分
- 可以用自定义 wiring 监听 pose 事件：`matched === true` → 加分

### 与 Spawner 模块
- 身体位置用于 world-AR 类游戏中的物体互动
- 可以将特定关键点（如双手）的位置用于碰撞检测，实现"双手接东西"的效果

### 与 GameFlow 模块
- gameflowPaused 为 true 时 update 不执行
- 但 tracker 本身不受暂停影响，恢复后立即有追踪数据

### 与其他 Input 模块的关系
- BodyInput 可以与 TouchInput 组合使用：身体姿势用于持续交互，触摸用于 UI 操作
- BodyInput + FaceInput 理论上可以同时使用（分别用 PoseTracker 和 FaceTracker），但性能开销大
- **不建议** BodyInput + HandInput 同时使用：HandInput 的手部追踪精度高于 BodyInput 的手部关键点

### 多输入组合时的冲突处理
- BodyInput 提供的是全身关键点数据而非单一位置，与其他输入模块的位置输出模式不同
- 当同时使用 BodyInput 和其他位置输入时，需要在 wiring 层面指定哪个模块控制玩家主位置

## 输入适配

### 适合的游戏类型
- **world-ar**（世界AR类）— 身体与虚拟物体的全身交互，BodyInput 的核心应用
- **gesture**（手势互动类）— 全身姿势匹配（举手、T-Pose 等）
- **expression**（表情触发类）— 搭配全身动作增强互动性
- **运动/健身类**（自定义）— 身体姿势匹配用于运动判定

### 不适合的游戏类型
- **quiz**（答题类）— 不需要身体追踪
- **random-wheel**（随机转盘类）— 不需要身体追踪
- **puzzle**（拼图/配对类）— 精确操作需求，身体追踪精度不足
- **narrative**（分支叙事类）— 不需要身体追踪
- **rhythm**（节奏类）— 身体追踪延迟较大，不适合精确节拍
- **catch/dodge**（接住/躲避类）— FaceInput 或 HandInput 更适合，BodyInput 性能开销过大

## 常见 Anti-Pattern

- ❌ **在所有游戏中默认启用 BodyInput** → MediaPipe Pose 性能开销大（尤其移动端），不需要全身追踪的游戏白白浪费资源
  ✅ 只在需要全身交互的游戏（world-ar、gesture）中启用

- ❌ **直接用 landmarks 数组的原始坐标做碰撞检测** → landmarks 是归一化坐标 (0~1)，未经画布尺寸缩放
  ✅ 乘以 canvasWidth/canvasHeight 转为像素坐标后再用于碰撞

- ❌ **matchPose 设为不存在的姿势名称** → checkPoseMatch 只支持 `handsUp` 和 `tPose`，其他名称始终返回 false
  ✅ 只使用内置姿势名称，或扩展 checkPoseMatch 方法支持新姿势

- ❌ **tolerance 设为 0.1 给普通玩家** → 太严格，大多数玩家无法精确匹配姿势
  ✅ 普通玩家 tolerance >= 0.25，专业训练类可以降到 0.15

- ❌ **期望 pose 事件只在匹配成功时触发** → 配置了 matchPose 后每帧都会发出 pose 事件（matched 可能为 true 或 false）
  ✅ 在接收端过滤 `matched === true` 的事件

## 常见问题 & 边界情况

- 需要先调用 `setTracker(tracker)` 注入 BodyTracker 实例
- landmarks 数组索引遵循 MediaPipe Pose 标准：11=左肩, 12=右肩, 15=左手腕, 16=右手腕
- 当 `result.detected` 为 false 时不发出任何事件
- 内置姿势匹配仅支持 `handsUp` 和 `tPose`，其他姿势名称会返回 `matched: false`
- 身体追踪在 Web 端性能开销较大，建议在移动设备上降低帧率
- matchPose 为空字符串时不会发出 `input:body:pose` 事件
- `getLandmarks()` 在无检测结果时返回 null
- gameflowPaused 为 true 时 update 不执行
- `input:body:pose` 事件每帧发出（当 matchPose 非空时），包含 `matched: boolean`
