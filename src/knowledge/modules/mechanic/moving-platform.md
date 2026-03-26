# MovingPlatform — 移动平台模块

## 基本信息
- 类型: mechanic
- 类名: `MovingPlatform`
- 注册名: `MovingPlatform`
- 文件: `src/engine/modules/mechanic/moving-platform.ts`
- 依赖: 无（独立模块）
- 可选联动: Gravity, Jump, PlayerMovement, StaticPlatform, CameraFollow

## 功能原理

MovingPlatform 管理一组按预设路径运动的矩形平台。每个平台定义运动模式（horizontal/vertical/circular）、速度和范围，模块在每帧更新平台位置并发出位置变化事件。

**PlatformDef 定义：**
- `x, y`: 起始位置（路径中心点或起点）
- `width, height`: 平台尺寸
- `pattern`: 运动模式
- `speed`: 运动速度
- `range`: 运动范围

**三种运动模式：**

### 1. Horizontal（水平往返）
```
currentX += speed * dtSec * direction
当 |currentX - startX| >= range → 翻转 direction

轨迹: 水平来回移动，中心在 (startX, startY)
周期: T = 2 * range / speed (秒)
```

### 2. Vertical（垂直往返）
```
currentY += speed * dtSec * direction
当 |currentY - startY| >= range → 翻转 direction

轨迹: 垂直来回移动，中心在 (startX, startY)
周期: T = 2 * range / speed (秒)
```

### 3. Circular（环形运动）
```
progress += speed * dtSec
currentX = startX + cos(progress) * range
currentY = startY + sin(progress) * range

轨迹: 以 (startX, startY) 为圆心，range 为半径的圆形路径
周期: T = 2π / speed (秒)
角速度: ω = speed (rad/s)
线速度: v = speed * range (px/s)
```

**PingPong 翻转机制（horizontal/vertical）：**
- 到达边界时，位置被钳制到 `startX/Y + range * direction`
- direction 从 1 变为 -1 或反之
- 这意味着平台不会超过边界，但翻转是突变的（无缓动）

**每帧更新流程：**
1. 检查 `gameflowPaused`
2. 计算 dtSec = dt / 1000
3. 遍历所有 states，根据 pattern 更新 currentX/currentY
4. 对每个移动的平台发出 `platform:move` 事件

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| platforms | object | `[]` | PlatformDef 数组 | — | 移动平台定义列表 |
| layer | string | `'platforms'` | 任意字符串 | `'platforms'` | 碰撞图层名 |
| asset | asset | `''` | 资源 ID | — | 平台贴图资源 |
| tileMode | select | `'stretch'` | stretch / repeat | — | 贴图模式 |

### PlatformDef 结构

| 字段 | 类型 | 说明 | 有效范围 |
|------|------|------|----------|
| x | number | 起始 X (px) | 0 ~ canvasWidth |
| y | number | 起始 Y (px) | 0 ~ canvasHeight |
| width | number | 平台宽度 (px) | 40 ~ 400 |
| height | number | 平台高度 (px) | 15 ~ 60 |
| pattern | string | 运动模式 | `'horizontal'` / `'vertical'` / `'circular'` |
| speed | number | 运动速度 | 20 ~ 300 (px/s for h/v; rad/s for circular) |
| range | number | 运动范围 | 50 ~ 500 (px for h/v; px radius for circular) |

### 运动模式参数推荐

| 模式 | speed | range | 周期 | 手感 | 参考游戏 |
|------|-------|-------|------|------|----------|
| horizontal（慢） | 40 ~ 60 | 100 ~ 200 | 3.3 ~ 10s | 稳定，可轻松站立 | Mario 标准移动平台 |
| horizontal（中） | 80 ~ 120 | 150 ~ 300 | 2.5 ~ 7.5s | 需要时机跳跃 | Donkey Kong Country |
| horizontal（快） | 150 ~ 250 | 200 ~ 400 | 1.6 ~ 5.3s | 快速追赶，高挑战 | Super Meat Boy |
| vertical（慢） | 30 ~ 50 | 80 ~ 150 | 3.2 ~ 10s | 电梯感 | Mega Man 升降台 |
| vertical（中） | 60 ~ 100 | 100 ~ 200 | 2 ~ 6.7s | 标准节奏 | — |
| circular（慢） | 1.0 ~ 1.5 | 60 ~ 100 | 4.2 ~ 6.3s | 旋转木马 | — |
| circular（中） | 2.0 ~ 3.0 | 80 ~ 150 | 2.1 ~ 3.1s | 明显旋转 | — |
| circular（快） | 4.0 ~ 6.0 | 50 ~ 80 | 1.0 ~ 1.6s | 高速旋转，极难 | — |

## 参数调优指南

### 速度与跳跃时机的关系

玩家需要在移动平台之间跳跃时，跳跃的 window（时间窗口）由平台速度和跳跃滞空时间决定：

```
平台横穿时间 = platformWidth / speed（玩家能站稳的时间窗口）
跳跃滞空时间 = 2 * jumpForce / gravity * 1000 (ms)

安全原则: 平台横穿时间 > 跳跃滞空时间 * 1.5（留出反应时间）
```

| speed | platform width=120 | 推荐 Jump 滞空 | 难度 |
|-------|--------------------|---------------|------|
| 40 | 3.0s | 任意 | 简单 |
| 80 | 1.5s | < 1.0s | 中等 |
| 150 | 0.8s | < 0.5s | 困难 |
| 250 | 0.48s | < 0.3s | 极难 |

### Circular 模式的线速度

circular 模式的实际移动速度取决于 speed (角速度) 和 range (半径):

```
线速度 = speed * range (px/s)
最大线速度不应超过 600 px/s（防止低帧率下穿透）
```

| speed (rad/s) | range (px) | 线速度 (px/s) | 安全性 |
|---------------|-----------|---------------|--------|
| 1.0 | 100 | 100 | 安全 |
| 2.0 | 150 | 300 | 安全 |
| 3.0 | 150 | 450 | 注意 |
| 4.0 | 200 | 800 | 危险 (可能穿透) |

### 玩家速度继承（velocity inheritance）

**当前限制**: MovingPlatform 不自动将自身速度传递给站在上面的玩家。

**理想行为（业界最佳实践）：**
1. 玩家站在移动平台上时，应自动继承平台的速度
2. 跳离平台时，保留平台的速度分量
3. 着陆在平台上时，玩家速度叠加平台速度

**当前解决方案**: 渲染器需要手动将玩家位置绑定到平台:
```
若玩家在移动平台上:
  playerRenderX = platformCurrentX + playerRelativeOffsetX
  playerRenderY = platformY - playerHeight
```

### 多个移动平台的节奏设计

**等间隔节奏**: 多个相邻移动平台使用相同 speed 和 range，但 progress 偏移不同:
```
platform[0].progress = 0
platform[1].progress = T / 3  (1/3 周期偏移)
platform[2].progress = 2T / 3 (2/3 周期偏移)
```

**渐进难度**: 后续平台 speed 递增 20% ~ 30%:
```
platform[0].speed = 60
platform[1].speed = 78  (+30%)
platform[2].speed = 100 (+30%)
```

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `platform:move` | `PLATFORM_MOVE` | `{ id: number, x: number, y: number, width: number, height: number }` | 每帧对每个移动平台发出 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:resume` | 恢复物理更新 |
| `gameflow:pause` | 暂停物理更新 |

### 事件流转示意

```
MovingPlatform.update() 每帧
  → 更新 states[i].currentX/Y
  → emit('platform:move', { id: i, x, y, width, height })
    → 渲染器: 更新平台 sprite 位置
    → 渲染器: 如果玩家在平台上，同步移动玩家

渲染器 每帧:
  movingPlatform.checkCollision(playerX, playerY)
    → true: 玩家在移动平台上
      → 更新 Gravity.floorY 到平台 y
      → 绑定玩家 X 位置到平台
    → false: 玩家不在平台上
      → 取消绑定
```

## 跨模块联动规则

### 与 Gravity 模块

- 玩家站在移动平台上时，Gravity.floorY 需要每帧更新为当前平台 Y
- 对于 vertical 模式，floorY 持续变化
- **注意**: 如果 vertical 平台向下移动（floorY 增大），玩家不会自动跟随下降——需要外部代码同步 Y 位置
- 平台从玩家脚下移开时，需要将 Gravity 对象标记为 airborne

### 与 Jump 模块

- 在移动平台上起跳时，Jump 不感知平台速度
- 如果平台向上移动（vertical），跳跃效果会被叠加（看起来跳得更高）
- 如果平台向下移动，跳跃效果会被抵消（看起来跳得更低）
- **理想方案**: 起跳时将平台 velocityY 叠加到 Jump.velocityY

### 与 PlayerMovement 模块

- 水平移动平台 (horizontal) 的速度不会叠加到 PlayerMovement.velocityX
- 玩家在快速水平移动平台上可能"滑出"平台
- **解决方案**: 渲染器将玩家坐标绑定为相对于平台的偏移量

### 与 StaticPlatform 模块

- 两者共享相同的 `layer` 参数
- 碰撞检测需要分别调用两个模块的 checkCollision
- 渲染器应统一管理所有平台的碰撞优先级

### 与 CameraFollow 模块

- 移动平台可能将玩家带出 CameraFollow 的 dead zone
- CameraFollow 监听 `player:move` 更新目标位置
- **建议**: 在移动平台上也需要持续发出 `player:move` 事件以更新相机

### 与 CrumblingPlatform 模块

- 一般不将同一个平台同时设为移动和碎裂的（语义冲突）
- 但可以在关卡中混合使用不同类型

## 输入适配

MovingPlatform 本身不响应输入事件，但输入精度影响玩家在移动平台上的操作能力：

| 输入方式 | 建议 |
|----------|------|
| TouchInput | 标准速度即可 (speed 40~150)，触摸操作足够精确 |
| FaceInput | 降低平台速度 20%~30%，增大平台宽度 |
| HandInput | 降低速度 10%~20% |
| DeviceInput | 大幅降低速度，增大平台宽度至 200px+ |

## 常见 Anti-Pattern

**速度过快导致玩家无法站稳**
- 错误: `speed: 300, width: 80` → 平台在 0.27s 内移过自身宽度，玩家来不及反应
- 正确: 确保 `width / speed >= 0.8s`（至少 0.8 秒的站稳时间）

**circular 模式的 range 过大**
- 错误: `speed: 3.0, range: 300` → 线速度 900 px/s，玩家无法站稳且可能穿透检测
- 正确: `speed * range <= 400`（线速度上限）

**vertical 平台不同步 Gravity.floorY**
- 错误: 玩家站在垂直移动平台上，Gravity.floorY 不随平台更新 → 角色"悬浮"或"沉入"平台
- 正确: 每帧同步 floorY = currentPlatformY

**忘记处理平台移开导致的空中状态**
- 错误: horizontal 平台移走，玩家仍标记为 grounded → 角色悬停在空中
- 正确: 每帧重新检测平台碰撞，无碰撞时标记为 airborne

**所有移动平台同相位**
- 错误: 多个相邻 horizontal 平台 progress 相同 → 所有平台同步移动，无跳跃挑战
- 正确: 错开初始 progress 或使用不同 speed，创造跳跃节奏

**PingPong 翻转的抖动**
- 已知问题: horizontal/vertical 模式在边界翻转时是突变的（无缓动），高速时可能出现视觉抖动
- 缓解: 降低边界附近的速度或使用 circular 模式替代

## 常见问题 & 边界情况

- `platform:move` 事件对每个平台**每帧**都发出，平台数量多时注意性能
- `platform:move` 的 id 是数组索引（0, 1, 2...），不是唯一标识符
- `checkCollision()` 是点-矩形测试，与 StaticPlatform 一致
- circular 模式的 speed 是角速度 (rad/s)，不是线速度 (px/s)
- circular 模式的 progress 会持续增长（无上限），长时间运行后可能出现浮点精度问题
- horizontal/vertical 模式使用 direction 翻转，不保证精确对称（浮点累积误差）
- `buildStates()` 在 init() 和 reset() 时被调用，重建所有平台状态
- `reset()` 将所有平台恢复到起始位置和初始方向
- platforms 数组在 init 后不可动态修改
- checkCollision() 不返回碰撞到的具体平台信息（只返回 boolean），与 StaticPlatform 不同
- 不支持 waypoint 路径——当前只有 pingpong 和 circular 两种路径模式
