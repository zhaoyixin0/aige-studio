# CameraFollow — 相机跟随模块

## 基本信息
- 类型: feedback
- 类名: `CameraFollow`
- 注册名: `CameraFollow`
- 文件: `src/engine/modules/feedback/camera-follow.ts`
- 依赖: 无（独立模块）
- 可选联动: PlayerMovement, Jump, Gravity, StaticPlatform, MovingPlatform, CrumblingPlatform

## 功能原理

CameraFollow 实现了 2D 平台游戏的相机跟随系统，支持三种跟随模式（center/look-ahead/dead-zone），带平滑插值、边界约束和屏幕震动功能。模块监听 `player:move` 事件获取玩家位置，每帧计算相机目标位置并通过 lerp 平滑跟随。

**核心状态：**
- `x, y`: 当前相机位置（世界坐标中心点）
- `targetX, targetY`: 目标跟随位置（来自 player:move 事件）
- `playerDirection`: 玩家朝向（-1/0/1，用于 look-ahead 模式）
- `shaking`: 是否正在震动
- `shakeElapsed`: 震动已持续时间 (ms)

**三种跟随模式：**

### 1. Center（中心跟随）
```
goalX = targetX
goalY = targetY

相机目标直接等于玩家位置，通过 smoothing 平滑跟随
最简单的模式，适合节奏快速的游戏
```

参考: Super Meat Boy 使用类似的中心跟随（快速 smoothing）

### 2. Look-Ahead（前瞻跟随）
```
goalX = targetX + playerDirection * lookAheadDistance
goalY = targetY

根据玩家朝向偏移相机，让玩家看到更多前方内容
playerDirection = -1 → 相机偏左（看到左边更多）
playerDirection = +1 → 相机偏右（看到右边更多）
playerDirection = 0 → 无偏移
```

参考: Celeste 使用类似机制，偏移量约 1.5~2 个角色宽度

**Look-Ahead 的数学分析:**
```
有效可视范围:
  前方可视 = (screenWidth / 2) + lookAheadDistance
  后方可视 = (screenWidth / 2) - lookAheadDistance

lookAheadDistance = 80px, screenWidth = 1080px:
  前方可视 = 620px（比默认多 80px）
  后方可视 = 460px（比默认少 80px）

过大的 lookAheadDistance 会导致后方盲区过大
推荐: lookAheadDistance <= screenWidth * 0.15
```

### 3. Dead-Zone（死区跟随）
```
halfW = deadZone.width / 2
halfH = deadZone.height / 2

goalX = camera.x（默认不移动）
goalY = camera.y（默认不移动）

diffX = targetX - camera.x
diffY = targetY - camera.y

如果 diffX > halfW  → goalX = targetX - halfW  （玩家超出右边界，拉回）
如果 diffX < -halfW → goalX = targetX + halfW  （玩家超出左边界，拉回）
如果 diffY > halfH  → goalY = targetY - halfH  （玩家超出下边界，拉回）
如果 diffY < -halfH → goalY = targetY + halfH  （玩家超出上边界，拉回）
```

Dead Zone 的核心理念: 玩家在死区内移动时相机不动，只有超出死区才触发相机跟随。这大幅减少了小范围移动时的相机抖动。

参考游戏:
- **Hollow Knight**: 使用较大的死区，相机非常稳定，只在大幅移动时跟随
- **Mario 3**: 使用水平死区，垂直方向锁定到特定高度
- **Fez**: 宽松的死区，玩家可以在区域内自由探索而相机几乎不动

**Dead Zone 尺寸推荐:**

```
               ┌──────────────────────┐
               │                      │
               │   ┌──────────────┐   │
               │   │  Dead Zone   │   │
               │   │   W × H      │   │
               │   │              │   │
               │   └──────────────┘   │
               │                      │
               └──────────────────────┘
                    Screen W × H

标准比例:
  deadZone.width = screenWidth * 0.15 ~ 0.30
  deadZone.height = screenHeight * 0.10 ~ 0.25

竖屏 (1080x1920):
  width: 160 ~ 320px, height: 190 ~ 480px

横屏 (1280x720):
  width: 190 ~ 380px, height: 72 ~ 180px
```

**Lerp 平滑跟随（所有模式共用）:**
```
t = 1 - smoothing
camera.x += (goalX - camera.x) * t
camera.y += (goalY - camera.y) * t

这是指数衰减式插值（exponential smoothing）:
  smoothing = 0    → t = 1.0 → 瞬间到达目标（无平滑）
  smoothing = 0.1  → t = 0.9 → 快速跟随（~3帧达到 90%）
  smoothing = 0.5  → t = 0.5 → 中等跟随（~7帧达到 90%）
  smoothing = 0.9  → t = 0.1 → 极慢跟随（~22帧达到 90%）
  smoothing = 0.99 → t = 0.01 → 几乎不移动

达到目标 90% 的帧数 ≈ log(0.1) / log(smoothing)

重要: 当前 lerp 未乘以 dt，因此跟随速度与帧率相关:
  60fps 时的体感 ≠ 30fps 时的体感
  高帧率下相机跟随更快（更多帧被更新）
```

**屏幕震动（Screen Shake）:**
```
触发: 收到 shakeEvent → shaking = true, shakeElapsed = 0
持续: 每帧 shakeElapsed += dt，直到 >= shakeDuration
偏移: getShakeOffset() 返回随机偏移 (±intensity, ±intensity)

震动模型: 纯随机（白噪声），每帧独立随机方向
  这是最简单的震动实现，视觉上偏"毛躁"

更高级的震动模型（当前未实现）:
  正弦衰减: offset = sin(t * freq) * intensity * (1 - t/duration)
  Perlin 噪声: 更自然的抖动
  方向性震动: 爆炸方向的偏移更大
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| mode | select | `'center'` | center / look-ahead / dead-zone | 见场景 | 跟随模式 |
| smoothing | range | `0.1` | 0 ~ 0.99，步长 0.01 | 0.05 ~ 0.3 | 平滑系数（越大跟随越慢） |
| deadZone | object | `{ width: 100, height: 50 }` | 见下文 | 见分辨率参考 | 死区尺寸 (px)，仅 dead-zone 模式有效 |
| deadZone.width | number | `100` | 0 ~ 500 | 100 ~ 300 | 死区宽度 (px) |
| deadZone.height | number | `50` | 0 ~ 300 | 50 ~ 200 | 死区高度 (px) |
| lookAheadDistance | range | `80` | 0 ~ 200，步长 1 | 50 ~ 120 | 前瞻偏移距离 (px)，仅 look-ahead 模式有效 |
| bounds | object | (undefined) | 见下文 | — | 相机移动边界 |
| bounds.minX | number | — | 任意 | 0 | 相机 X 最小值 |
| bounds.maxX | number | — | 任意 | levelWidth | 相机 X 最大值 |
| bounds.minY | number | — | 任意 | 0 | 相机 Y 最小值 |
| bounds.maxY | number | — | 任意 | levelHeight | 相机 Y 最大值 |
| shakeEvent | string | `''` | 任意事件名 | `'collision:damage'` | 触发震动的事件 |
| shakeDuration | range | `200` | 50 ~ 500，步长 10 | 100 ~ 300 | 震动持续时间 (ms) |
| shakeIntensity | range | `5` | 1 ~ 20，步长 1 | 3 ~ 10 | 震动幅度 (px) |

### 模式选择指南

| 模式 | 适用场景 | 优势 | 劣势 |
|------|---------|------|------|
| center | 快速动作游戏 | 简单，始终看到玩家 | 相机频繁移动 |
| look-ahead | 水平向为主的关卡 | 前方可视范围大 | 垂直方向无前瞻 |
| dead-zone | 探索型/精密平台 | 相机稳定，小动作不晃 | 大幅移动时可能跟不上 |

### smoothing 参数参考

| smoothing | 帧数达到 90% | 手感 | 适用场景 | 参考游戏 |
|-----------|-------------|------|---------|----------|
| 0 ~ 0.05 | 1 ~ 2 | 几乎立即跟随 | 快节奏动作 | Super Meat Boy |
| 0.05 ~ 0.15 | 2 ~ 5 | 快速平滑 | 标准平台 | Celeste |
| 0.15 ~ 0.3 | 5 ~ 10 | 明显延迟 | 探索型 | Hollow Knight |
| 0.3 ~ 0.5 | 10 ~ 20 | 缓慢跟随 | 电影感 | — |
| 0.5 ~ 0.9 | 20+ | 极慢 | 特殊效果 | Boss 战场景 |

### 震动参数参考

| 场景 | shakeEvent | shakeDuration | shakeIntensity | 体验 |
|------|-----------|--------------|----------------|------|
| 受伤 | `collision:damage` | 150 ~ 250 | 3 ~ 6 | 轻微震动，提示受击 |
| 落地 | `jump:land` | 100 ~ 150 | 2 ~ 4 | 微弱震感，增加重量感 |
| 碎裂平台崩塌 | `platform:crumble` | 200 ~ 300 | 5 ~ 8 | 中等震动，戏剧效果 |
| Boss 攻击 | 自定义 | 300 ~ 500 | 8 ~ 15 | 强烈震动 |
| 蹬墙跳 | `wall:jump` | 80 ~ 120 | 2 ~ 3 | 微弱，增加力度感 |

## 参数调优指南

### 水平 vs 垂直跟随的差异

业界最佳实践（参考 Celeste、Hollow Knight 的相机设计）:
- **水平方向**: 快速跟随（smoothing 低），死区较小
- **垂直方向**: 较慢跟随（smoothing 高），死区较大

原因: 跳跃导致频繁的垂直位置变化，如果相机垂直方向跟随太快会产生令人不适的抖动。

**当前限制**: CameraFollow 的 smoothing 是 X/Y 统一的，不支持分轴不同的平滑速度。

**建议**: 使用 dead-zone 模式，将 deadZone.height 设得比 deadZone.width 大，间接实现垂直方向更宽容的跟随。

```
推荐比例: deadZone.height >= deadZone.width * 1.5 ~ 2.5

示例 (1080x1920):
  deadZone.width = 150
  deadZone.height = 300 (2x)

效果: 水平移动 75px 才触发相机跟随
      垂直移动 150px 才触发相机跟随 → 跳跃时相机更稳
```

### Bounds 设置与关卡边界

```
关卡尺寸 vs 屏幕尺寸:

如果关卡 = 屏幕尺寸（单屏关卡）:
  → 不需要 CameraFollow（相机固定）
  → 或设 bounds.minX = bounds.maxX = screenWidth/2

如果关卡 > 屏幕尺寸:
  bounds.minX = screenWidth / 2（不超出关卡左边界）
  bounds.maxX = levelWidth - screenWidth / 2（不超出关卡右边界）
  bounds.minY = screenHeight / 2
  bounds.maxY = levelHeight - screenHeight / 2

如果关卡很大（多屏):
  确保 bounds 覆盖所有可达区域
```

### 相机模式与平台类型的配合

| 平台类型 | 推荐相机模式 | 原因 |
|----------|-------------|------|
| 水平向为主的关卡 | look-ahead | 前方可视范围大 |
| 垂直攀爬关卡 | dead-zone (大 height) | 跳跃时不抖 |
| 混合方向关卡 | dead-zone | 最稳定 |
| 快速追逐关卡 | center (低 smoothing) | 紧跟玩家 |
| 碎裂平台密集区 | dead-zone + 较高 smoothing | 减少崩塌引起的相机震荡 |
| 蹬墙跳攀爬 | dead-zone + 大 width | 左右蹬墙不晃 |

### 帧率依赖问题与缓解

当前 lerp 实现 `camera += (goal - camera) * (1 - smoothing)` 未乘以 dt:

```
60fps: 每帧 camera 靠近目标 (1-smoothing) 的比例
30fps: 每帧靠近相同比例，但帧数减半

效果: 低帧率下相机跟随整体更慢

缓解方案（渲染器侧）:
  t_framerate_independent = 1 - smoothing^(dt/16.67)
  这保证无论帧率如何，单位时间内的跟随距离一致
```

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `camera:move` | `CAMERA_MOVE` | `{ x: number, y: number, shaking: boolean }` | 每帧发出（包含当前相机位置和震动状态） |
| `camera:shake` | `CAMERA_SHAKE` | `{}` | 收到 shakeEvent 时（震动开始瞬间） |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `player:move` | 更新 targetX, targetY, playerDirection |
| `{shakeEvent}` | 触发屏幕震动 |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
PlayerMovement.update()
  → emit('player:move', { x, direction, speed })
    → CameraFollow: 更新 targetX = x, targetY = y, playerDirection = direction

CameraFollow.update() 每帧:
  → 根据 mode 计算 goalX, goalY
  → lerp 平滑: camera += (goal - camera) * (1 - smoothing)
  → clamp 到 bounds
  → 处理 shake 计时器
  → emit('camera:move', { x, y, shaking })
    → 渲染器: 设置 PixiJS stage 的 pivot/position 实现相机偏移
    → 渲染器: 如果 shaking → 叠加 getShakeOffset()

震动流程:
  collision:damage / platform:crumble / wall:jump
    → CameraFollow 收到 shakeEvent
      → emit('camera:shake')
      → shaking = true, shakeElapsed = 0
    → 每帧: shakeElapsed += dt
      → 到期后: shaking = false
```

## 跨模块联动规则

### 与 PlayerMovement 模块

- CameraFollow 监听 `player:move` 获取玩家位置和方向
- PlayerMovement 发出的 `player:move` 包含 `{ x, direction, speed }`
- **注意**: `player:move` 只包含 x 坐标，不包含 y 坐标
- targetY 只在 `data.y !== undefined` 时更新——如果 PlayerMovement 不提供 y，需要其他模块提供（Jump/Gravity）

### 与 Jump / Gravity 模块

- Jump 和 Gravity 管理 Y 轴位置，但不直接发送 `player:move` 事件
- **当前问题**: CameraFollow 的 targetY 可能不会被更新（取决于 player:move 是否包含 y）
- **解决方案**: 渲染器在每帧计算玩家最终位置后，通过 `player:move` 事件同时发送 x 和 y

### 与 StaticPlatform / MovingPlatform 模块

- 相机不直接与平台交互
- 但 bounds 应根据关卡平台的范围设置
- MovingPlatform 将玩家带动时，CameraFollow 通过 `player:move` 自动跟随

### 与 CrumblingPlatform 模块

- 平台崩塌导致玩家突然下落 → targetY 快速变化
- smoothing 过低时相机会急速下降 → 视觉不适
- **建议**: `shakeEvent: 'platform:crumble'` 在崩塌时添加微震增强反馈
- smoothing >= 0.1 确保相机不会立即跳到新位置

### 与 WallDetect 模块

- 蹬墙跳会导致快速的水平方向变化
- look-ahead 模式下 playerDirection 翻转 → 相机前瞻方向翻转
- 频繁的方向翻转导致相机左右摇摆
- **建议**: 在蹬墙跳密集区域使用 center 或 dead-zone 模式

## 输入适配

CameraFollow 本身不直接响应输入事件，但 shakeEvent 间接与输入关联。相机参数也应根据输入精度调整：

| 输入方式 | 推荐 mode | smoothing 调整 | 说明 |
|----------|----------|---------------|------|
| TouchInput | 任意 | 标准 (0.1) | 精确操控，标准跟随即可 |
| FaceInput | dead-zone | +0.05 (0.15) | 面部追踪抖动 → 需要更多平滑 |
| HandInput | dead-zone | +0.03 (0.13) | 手势抖动 |
| DeviceInput | dead-zone (大死区) | +0.05 (0.15) | 陀螺仪飘移 → 大死区+高平滑 |
| AudioInput | center | 标准 | 声音不控制位置 |

**对于非触摸输入**:
- 增大 deadZone 尺寸 20%~30%（补偿输入抖动引起的相机抖动）
- 增大 smoothing（更多平滑=更少抖动）

## 常见 Anti-Pattern

**smoothing = 0 导致相机抖动**
- 错误: `smoothing: 0` + 跳跃频繁 → 相机每帧精确跟随玩家 → 垂直方向剧烈抖动
- 正确: `smoothing >= 0.05`（至少轻微平滑）

**dead-zone 过小等于 center 模式**
- 错误: `deadZone: { width: 5, height: 5 }` → 任何微小移动都触发相机跟随，等于 center 模式
- 正确: `deadZone.width >= screenWidth * 0.1, deadZone.height >= screenHeight * 0.05`

**lookAheadDistance 过大**
- 错误: `lookAheadDistance: 200` + `screenWidth: 1080` → 后方只能看到 340px → 大量盲区
- 正确: `lookAheadDistance <= screenWidth * 0.15`

**不设置 bounds 导致看到关卡外部**
- 错误: bounds 未设置 → 相机可以移动到关卡边界之外 → 显示空白/黑色区域
- 正确: 设置 bounds 限制相机在关卡范围内

**shakeIntensity 过大导致晕眩**
- 错误: `shakeIntensity: 20, shakeDuration: 500` → 持续 0.5 秒的剧烈晃动 → 玩家不适
- 正确: 受伤震动 `intensity: 3~6, duration: 150~250`

**忘记发送包含 y 的 player:move 事件**
- 错误: PlayerMovement 只发送 `{ x, direction }` → CameraFollow 的 targetY 永远为 0 → 相机固定在顶部
- 正确: 渲染器发送 `player:move` 时包含 x 和 y 坐标

**相机跟随速度与帧率关联**
- 已知问题: smoothing 的实际效果随帧率变化
- 60fps 时 smoothing=0.1 的跟随感 ≠ 30fps 时 smoothing=0.1 的跟随感
- 低帧率时需要降低 smoothing 补偿

## 常见问题 & 边界情况

- `camera:move` 事件每帧发出，即使相机位置没有变化
- `getShakeOffset()` 使用 `Math.random()`——相同帧调用两次会得到不同值
- `getPosition()` 返回的是未加震动偏移的位置；震动偏移需要额外调用 `getShakeOffset()`
- `camera:shake` 事件在震动开始时发出一次，不在每帧发出
- bounds 的 minX/maxX/minY/maxY 各字段可以独立设置或省略
- 如果 bounds 中某个字段为 undefined，则该方向不做限制
- smoothing 基于指数衰减，不基于 dt — 帧率依赖
- `player:move` 事件中的 `data.direction` 可以是 -1、0 或 1，undefined 时保持上次值
- `reset()` 将所有状态归零（x=0, y=0, 无震动，无方向）
- 相机位置 (x, y) 是世界坐标，渲染器需要将其转换为 stage 的偏移量
- 不支持相机旋转（仅平移和震动）
- 不支持相机缩放（zoom in/out）
- 不支持多目标跟随（split-screen、双人模式）
- dead-zone 模式下如果初始 targetX/Y 在死区外，首帧相机会跳动
