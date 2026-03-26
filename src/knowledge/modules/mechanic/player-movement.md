# PlayerMovement — 玩家移动模块

## 基本信息
- 类型: mechanic
- 类名: `PlayerMovement`
- 注册名: `PlayerMovement`
- 文件: `src/engine/modules/mechanic/player-movement.ts`
- 依赖: 无
- 可选联动: Dash, Jump, Gravity, StaticPlatform, WallDetect

## 功能原理

PlayerMovement 模块处理玩家角色的水平移动，支持两种模式：
1. **离散输入模式**: 通过方向事件（left/right）设置 direction（-1/0/+1），每帧根据 acceleration/deceleration 更新 velocityX
2. **连续输入模式**: 通过 continuousEvent 直接映射输入位置到 X 坐标（面部追踪、手势追踪、陀螺仪等）

**离散输入模式（核心流程）：**
1. 收到方向输入事件 → 设置 `direction` 和 `inputActive = true`
2. `update()` 检查 `inputActive`:
   - true: 加速 → `velocityX` 趋向 `direction * speed`，然后**重置 inputActive = false**
   - false: 减速 → `velocityX` 趋向 0
3. 速度限制: `|velocityX| <= speed`
4. 位置更新: `x += velocityX * dtSec`
5. 事件发出: 移动中发 `player:move`，停止时发一次 `player:stop`

**关键实现细节：**
- inputActive 是**单帧消费模式**: 每次 update 后重置为 false。这意味着需要持续的输入事件才能保持移动（适合 swipe 但不适合 hold）
- 加速度使用线性模型: `velocityX += sign(diff) * acceleration * dtSec`
- 没有惯性系统: 停止输入后立即开始减速（deceleration），不存在"滑行"过渡
- 连续输入模式绕过整个加速/减速系统，直接设置 x 坐标

**加速度物理：**

```
从静止到满速时间 = speed / acceleration
从满速到静止时间 = speed / deceleration
加速距离 = speed² / (2 * acceleration)
减速距离 = speed² / (2 * deceleration)
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| speed | range | `300` | 100 ~ 800，步长 10 | 200 ~ 500 | 最大移动速度 (px/s) |
| acceleration | range | `1000` | 0 ~ 2000，步长 10 | 800 ~ 1500 | 加速度 (px/s²)。0 = 瞬间达到满速 |
| deceleration | range | `800` | 0 ~ 2000，步长 10 | 600 ~ 1200 | 减速度 (px/s²)。0 = 永不停止（滑冰） |
| moveLeftEvent | string | `'input:touch:swipe:left'` | 任意事件名 | — | 向左移动触发事件 |
| moveRightEvent | string | `'input:touch:swipe:right'` | 任意事件名 | — | 向右移动触发事件 |
| continuousEvent | string | （无默认值） | 任意事件名 | — | 连续位置映射事件（面部/手势/陀螺仪等） |

### 手感风格参考

| 手感风格 | speed | acceleration | deceleration | 加速时间 | 减速时间 | 参考 |
|----------|-------|-------------|-------------|---------|---------|------|
| 瞬间响应 | 300 | 2000 | 2000 | 150ms | 150ms | Celeste |
| 标准平台 | 300 | 1000 | 800 | 300ms | 375ms | Mario |
| 滑行手感 | 300 | 1000 | 400 | 300ms | 750ms | 冰面 |
| 坦克手感 | 200 | 600 | 600 | 333ms | 333ms | 重型角色 |
| 高速灵活 | 500 | 1500 | 1200 | 333ms | 417ms | Mega Man |

### acceleration vs deceleration 比值

```
比值 R = deceleration / acceleration
```

| R 值 | 手感 | 适用场景 |
|------|------|---------|
| > 1.0 | 急停，感觉"紧绷" | 精密平台跳跃 |
| = 1.0 | 对称，自然 | 通用 |
| 0.5 ~ 0.8 | 有惯性，滑行感 | 速度感强的游戏 |
| < 0.3 | 大量滑行，"溜冰" | 冰面特殊场景 |

## 参数调优指南

### 加速时间的体感参考

根据业界最佳实践，不同加速时间对应的体感：

| 加速时间 | 感受 | 说明 |
|---------|------|------|
| < 50ms | 瞬间 | 几乎无法察觉加速过程 |
| 50 ~ 100ms | 紧凑 | 动作游戏标准 |
| 100 ~ 200ms | 标准 | 大多数平台游戏 |
| 200 ~ 500ms | 缓慢 | 需要过渡动画辅助，否则会感觉"迟钝" |
| > 500ms | 飘浮 | 一般不推荐，除非是太空/水下主题 |

### speed 与画布宽度

角色横穿画布的时间决定了游戏节奏：

```
横穿时间 = canvasWidth / speed
```

| 画布宽度 | speed | 横穿时间 | 适合 |
|----------|-------|---------|------|
| 1080 | 200 | 5.4s | 探索向 |
| 1080 | 300 | 3.6s | 平台标准 |
| 1080 | 500 | 2.2s | 动作/追逐向 |
| 800 | 300 | 2.7s | 横屏平台 |

### 空中控制

**当前实现不区分地面和空中状态**。无论角色是否在地面，acceleration 和 deceleration 都相同。

**业界最佳实践**:
- 空中加速度应为地面的 50% ~ 80%
- 空中不应有自动减速（松开按钮后保持水平速度）
- 这样可以增加跳跃的承诺感（commitment）和重量感

**当前影响**: 玩家在空中可以和地面上一样快速改变方向，减少了跳跃的策略性。

### 连续输入模式的平滑

连续输入模式（continuousEvent）支持三种输入类型：
- **位置输入** (data.x): 归一化 0~1 → 直接映射到 canvasWidth
- **频率输入** (data.frequency): 200~800 Hz → 归一化映射到 canvasWidth
- **倾斜输入** (data.tiltX): -1 ~ +1 → 映射到 canvasWidth

**注意**: 连续输入绕过加速度系统，角色位置瞬间跟随输入，可能导致视觉跳跃。建议在渲染层做 lerp 平滑。

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `player:move` | `PLAYER_MOVE` | `{ x: number, direction: -1\|0\|1, speed: number }` | velocityX != 0 时每帧发出 |
| `player:stop` | `PLAYER_STOP` | `{ x: number }` | velocityX 从非零变为零时发出一次 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `input:touch:hold` | 根据 data.side (left/right) 设置 direction 和 inputActive |
| `input:touch:release` | 设置 inputActive = false |
| `input:touch:swipe` | 根据 data.direction (left/right) 设置 direction 和 inputActive |
| `{moveLeftEvent}` | direction = -1, inputActive = true（仅非 touch 事件） |
| `{moveRightEvent}` | direction = 1, inputActive = true（仅非 touch 事件） |
| `{continuousEvent}` | 直接映射位置 → x |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
触摸输入:
  TouchInput → emit('input:touch:hold', { side: 'left' })
    → PlayerMovement 设置 direction=-1, inputActive=true

  TouchInput → emit('input:touch:release')
    → PlayerMovement 设置 inputActive=false → 开始减速

PlayerMovement.update() 每帧
  → velocityX != 0 → emit('player:move', { x, direction, speed })
    → 渲染器更新 sprite 位置
    → WallDetect 可检测墙壁碰撞
  → velocityX 变为 0 → emit('player:stop', { x })
```

## 跨模块联动规则

### 与 Dash 模块

**当前实现**: Dash 和 PlayerMovement 完全独立。Dash 的位移通过 `getDisplacement()` 获取，不直接修改 PlayerMovement 的 x。

- **速度叠加 vs 替换**: 当前未实现自动叠加。如需叠加，渲染器需要在定位时 `x = playerMovement.getX() + dash.getDisplacement().x`
- **Dash 期间的移动**: 当前 Dash 激活时 PlayerMovement 仍然照常更新，导致两者同时移动
- **建议方案**: Dash 激活期间应该暂停 PlayerMovement 的加速度更新，只保留 Dash 的位移

### 与 Jump / Gravity 模块

- PlayerMovement 只管理 X 轴，Jump/Gravity 管理 Y 轴，两者正交，不冲突
- **空中移动**: 当角色在空中时（Jump.isGrounded() = false），PlayerMovement 仍使用相同的 acceleration/deceleration
- **建议**: 添加 airAcceleration 和 airDeceleration 参数，在空中使用不同的移动参数

### 与 StaticPlatform / MovingPlatform

- PlayerMovement 不做任何水平碰撞检测
- 角色可以自由穿过平台的垂直面
- **需要 WallDetect 模块配合**: WallDetect 检测墙壁碰撞后发出 `wall:contact`，外部代码需要阻止 PlayerMovement 继续移动
- **StaticPlatform.friction**: 不同材质的摩擦力（normal: 0.8, ice: 0.1, sticky: 1.0）当前不影响 PlayerMovement 的减速度

### 与 WallDetect 模块

- WallDetect 检测角色是否接触墙壁
- PlayerMovement 不直接响应 `wall:contact` 事件
- **需要外部代码**在 WallDetect 报告墙壁接触时阻止 PlayerMovement 继续向该方向移动

### 与 CameraFollow 模块

- CameraFollow 监听玩家位置来平滑跟随
- PlayerMovement 发出的 `player:move` 事件包含 x 坐标
- CameraFollow 的 smoothing 参数影响镜头跟随的延迟感

## 输入适配

### 离散输入（方向控制）

| 输入方式 | moveLeftEvent | moveRightEvent | 特殊说明 |
|----------|--------------|---------------|---------|
| TouchInput | `input:touch:swipe:left` | `input:touch:swipe:right` | 默认方式；也支持 hold 左/右半屏 |
| HandInput | `input:hand:gesture:left` | `input:hand:gesture:right` | 手势方向识别 |
| FaceInput | `input:face:turnLeft` | `input:face:turnRight` | 头部转向控制 |
| DeviceInput | — | — | 倾斜更适合连续输入模式 |

### 连续输入（位置映射）

| 输入方式 | continuousEvent | 数据字段 | 延迟 |
|----------|----------------|---------|------|
| FaceInput | `input:face:position` | `data.x` (0~1) | ~100ms |
| HandInput | `input:hand:position` | `data.x` (0~1) | ~80ms |
| DeviceInput | `input:device:tilt` | `data.tiltX` (-1~1) | ~50ms |
| AudioInput | `input:audio:pitch` | `data.frequency` (Hz) | ~200ms |

**选择建议**:
- 平台跳跃类游戏 → 离散输入（方向键感，更精确）
- catch/dodge 类游戏 → 连续输入（直接映射，更直觉）
- 休闲/表演类 → 连续输入（面部/手势追踪好玩）

## 常见 Anti-Pattern

**acceleration = 0 导致瞬间满速**
- 不是 bug，但在有精密平台跳跃的游戏中，瞬间满速可能导致操作过于灵敏
- 建议: 即使追求快速响应，也设置至少 800 ~ 1000 的 acceleration

**deceleration = 0 导致永不停止**
- 错误: 角色一旦移动就永远滑行，只能通过反方向输入来减速
- 除非有意设计冰面效果，否则 deceleration 不应为 0

**inputActive 单帧消费导致 hold 无效**
- 当前实现: `inputActive` 在每次 update 后重置为 false
- 影响: 如果输入事件不是每帧都触发（如 swipe 只触发一次），角色只会加速一帧然后开始减速
- `input:touch:hold` 事件是**持续触发**的，所以 hold 模式正常工作
- **但**: 离散事件（如 swipe、gesture）是一次性的，角色只会短暂加速

**没有边界限制**
- 当前实现: x 可以超出画布范围，角色会移动到不可见区域
- 需要外部代码（渲染器或碰撞系统）做边界钳制

**连续输入和离散输入混用**
- 同时设置 continuousEvent 和 moveLeftEvent 时，两者会互相覆盖 x 坐标
- 建议: 同一时刻只使用一种输入模式

## 常见问题 & 边界情况

- `x` 初始值为 0（画布最左侧），不是画布中心。需要外部代码在游戏开始时设置初始位置
- `reset()` 将 x 重置为 0，而非玩家初始位置（可能需要配合 Checkpoint 恢复位置）
- `player:move` 事件每帧都发出（只要 velocityX != 0），注意高频监听的性能影响
- `player:stop` 事件只发出一次（从移动变为停止），不会重复发出
- `getX()` 返回像素坐标（不是归一化值），与 Jump 的 `getY()` 返回归一化值不同
- 连续输入模式下，`velocityX` 不会被更新（因为是直接设置 x），`player:move` 可能不会被正确发出
- touch:hold 事件的 `data.side` 判断基于触摸位置在屏幕左半或右半
- 对于非 `input:touch:` 前缀的自定义事件，模块会额外注册监听器（避免与内置 touch 事件重复）
