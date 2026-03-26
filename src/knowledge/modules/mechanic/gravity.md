# Gravity — 重力模块

## 基本信息
- 类型: mechanic
- 类名: `Gravity`
- 注册名: `Gravity`
- 文件: `src/engine/modules/mechanic/gravity.ts`
- 依赖: 无（独立模块）
- 可选联动: Jump, CoyoteTime, StaticPlatform, MovingPlatform

## 功能原理

Gravity 模块为注册的游戏对象施加 Y 轴方向的重力加速度。它维护一个 `objects` Map，每个对象包含位置 (x, y)、垂直速度 (velocityY)、地面高度 (floorY) 和空中状态 (airborne)。

**每帧更新流程：**
1. 检查 `gameflowPaused` 和 `enabled` 状态
2. 遍历所有已注册对象，跳过非 airborne 的对象
3. 对 airborne 对象发出 `gravity:falling` 事件
4. 施加重力加速度: `velocityY += strength * dtSec`
5. 限制终端速度: `velocityY = min(velocityY, terminalVelocity)`
6. 更新位置: `y += velocityY * dtSec`
7. 落地检测: 当 `y >= floorY` 时，将对象钳制到 floorY，重置 velocityY 和 airborne，发出 `gravity:landed`

**物理模型说明：**
- Y 轴正方向为**向下**（屏幕坐标系）
- 重力加速度单位: px/s²（每秒每秒像素数）
- 速度单位: px/s
- 使用欧拉积分法（Euler integration），在高帧率下足够精确

**核心物理公式：**

```
下落距离:  d = v₀t + ½gt²
下落速度:  v = v₀ + gt
到达终端速度时间:  t_terminal = (terminalVelocity - v₀) / strength
到达终端速度前的下落距离:  d_terminal = v₀ * t_terminal + ½ * strength * t_terminal²
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| strength | range | `980` | 200 ~ 2000，步长 10 | 600 ~ 1200 | 重力加速度 (px/s²)，980 接近地球重力的像素等效值 |
| terminalVelocity | range | `800` | 100 ~ 2000，步长 10 | 600 ~ 1000 | 最大下落速度 (px/s)，防止高速穿透地面 |
| applyTo | select | `'player'` | player / items / all | — | 重力作用目标（当前为配置标记，实际由外部调用 addObject 决定） |
| toggleEvent | string | `''` | 任意事件名 | — | 接收此事件时切换重力开关 |

### 参数推荐值对照表

| 手感风格 | strength | terminalVelocity | 参考游戏 |
|----------|----------|------------------|----------|
| 轻盈/飘浮 | 400 ~ 600 | 400 ~ 600 | Celeste（无 FastFall） |
| 标准/扎实 | 800 ~ 1200 | 600 ~ 900 | Super Mario Bros |
| 沉重/快速 | 1400 ~ 2000 | 800 ~ 1200 | Hollow Knight |
| 月球漫步 | 200 ~ 400 | 200 ~ 400 | 低重力关卡 |

## 参数调优指南

### strength 与跳跃模块的数学关系

当与 Jump 模块配合时（Jump 自带独立 gravity 参数），跳跃高度和滞空时间由以下公式决定：

```
跳跃高度 H = jumpForce² / (2 * gravity)
到达顶点时间 t_apex = jumpForce / gravity
总滞空时间 t_air = 2 * t_apex = 2 * jumpForce / gravity
```

**重要**: Jump 模块有自己的 `gravity` 参数，Gravity 模块的 `strength` 参数作用于**非跳跃状态**的下落（如从平台边缘走下）。理想情况下两者应保持一致。

示例计算（Jump.gravity = 980, Jump.jumpForce = 600）:
- 跳跃高度 = 600² / (2 * 980) ≈ 183.7 px
- 到达顶点时间 = 600 / 980 ≈ 0.612 s
- 总滞空时间 ≈ 1.224 s

### terminalVelocity 的设置原则

```
到达终端速度时间 = terminalVelocity / strength
```

| strength | terminalVelocity | 到达时间 | 感受 |
|----------|------------------|---------|------|
| 980 | 600 | 0.61s | 很快限速，下落匀速感强 |
| 980 | 800 | 0.82s | 适中 |
| 980 | 1200 | 1.22s | 长时间加速，高处坠落非常快 |

**防穿透原则**: `terminalVelocity * dtMax < minPlatformThickness`。假设最低帧率 30fps（dt ≈ 33ms），平台厚度 30px：
- terminalVelocity 最大安全值 ≈ 30 / 0.033 ≈ 909 px/s
- 超过此值在低帧率下可能穿透薄平台

### 画布尺寸缩放

| 画布高度 | strength 推荐 | terminalVelocity 推荐 | 说明 |
|----------|--------------|----------------------|------|
| 1920 | 800 ~ 1200 | 600 ~ 1000 | 标准竖屏 |
| 1280 | 600 ~ 900 | 400 ~ 700 | 低分辨率 |
| 600 | 400 ~ 600 | 300 ~ 500 | 横屏 |

**缩放公式**: `调整后 strength = 基准 strength * (画布高度 / 1920)`

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `gravity:falling` | `GRAVITY_FALLING` | `{ id: string }` | 每帧对每个 airborne 对象触发（注意：是每帧都触发，不只是首帧） |
| `gravity:landed` | `GRAVITY_LANDED` | `{ id: string, y: number }` | 对象 y >= floorY 时触发，同时重置对象状态 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `jump:start` | `JUMP_START` | 将 data.id 对应的对象标记为 airborne |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复物理更新 |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停物理更新 |
| `{toggleEvent}` | — | 切换 enabled 开关 |

### 事件流转示意

```
外部调用 addObject(id, { x, y, floorY, airborne })
  → 对象注册到 Gravity 管理

Jump.triggerJump()
  → emit('jump:start', { id }) → Gravity 标记对象为 airborne

Gravity.update() 每帧
  → airborne 对象 → emit('gravity:falling', { id })
    → CoyoteTime 监听 → 启动 coyote 计时器
  → 落地 → emit('gravity:landed', { id, y })
    → CoyoteTime 监听 → 重置为 grounded + 检查 buffer 跳跃
```

## 跨模块联动规则

### 与 Jump 模块

**关键问题**: Jump 模块有独立的 gravity 参数和独立的 Y 轴物理循环，与 Gravity 模块**并行运行**。

- Jump.gravity 控制跳跃过程中的重力
- Gravity.strength 控制非跳跃下落的重力
- **建议**: 两者设为相同值，否则跳跃下落和自然下落的感受不一致
- Jump 通过 `jump:start` 事件通知 Gravity 标记对象为 airborne

### 与 StaticPlatform / MovingPlatform

**当前限制**: Gravity 使用固定的 `floorY` 作为地面检测。平台模块使用 AABB 碰撞检测。两者**没有自动集成**。

- Gravity 的 `floorY` 决定重力系统的"地面"位置
- StaticPlatform 的 `checkCollision()` 是独立的碰撞检测方法
- **集成方式**: 需要外部代码（如渲染器或物理管理器）在每帧检查平台碰撞，手动更新 `floorY` 或停止下落
- **已知问题**: 当前没有自动将平台碰撞结果反馈给 Gravity 的机制

### 与 CoyoteTime

- CoyoteTime 监听 `gravity:falling` 启动离地计时
- CoyoteTime 监听 `gravity:landed` 重置为 grounded
- **注意**: `gravity:falling` 每帧都发出，CoyoteTime 内部用 `this.grounded` 标记确保只在首次离地时启动计时

### 与 OneWayPlatform

- OneWayPlatform 的 `checkLanding()` 需要 velocityY（来自 Gravity 对象的 velocityY）
- 只在 velocityY > 0（下落中）时检测着陆

### 与 CrumblingPlatform

- 玩家站在 CrumblingPlatform 上时，平台崩塌后玩家需要重新变为 airborne
- 需要外部代码在 `platform:crumble` 事件后手动将 Gravity 对象标记为 airborne

### 非平台游戏中的独立使用

Gravity 可以不与 Jump 或平台模块配合，独立用于：
- **下落物体**: 生成的物体受重力影响自然下落（catch/dodge 类游戏）
- **抛物线弹道**: 给物体初始 velocityY 和 velocityX 制造弧形轨迹
- **重力翻转谜题**: 通过 toggleEvent 切换重力开/关

## 输入适配

Gravity 模块本身不直接响应输入事件，但其行为通过 `toggleEvent` 参数间接关联输入：

| 输入方式 | toggleEvent 推荐 | 用例 |
|----------|-----------------|------|
| TouchInput | `input:touch:doubleTap` | 双击切换重力 |
| FaceInput | `input:face:mouthOpen` | 张嘴切换重力 |
| HandInput | `input:hand:gesture:fist` | 握拳切换重力 |
| AudioInput | `input:audio:blow` | 吹气切换重力 |
| DeviceInput | `input:device:shake` | 摇晃手机切换重力 |

## 常见 Anti-Pattern

**Gravity 和 Jump 的 gravity 值不一致**
- 错误: `Gravity.strength: 980, Jump.gravity: 600` → 跳跃下落慢，自然下落快，手感割裂
- 正确: 两者保持一致，或有意设计不同值时确保体验连贯

**terminalVelocity 过高导致穿透**
- 错误: `terminalVelocity: 2000` + 薄平台 (30px) → 低帧率下物体穿过平台
- 正确: `terminalVelocity <= 900`，或增加平台厚度

**floorY 设置不合理**
- 错误: `floorY` 设在画布外（> 1.0 的归一化值或 > canvasHeight）→ 物体永远不落地
- 正确: `floorY` 应该与 Jump.groundY 或平台 Y 坐标一致

**每帧 `gravity:falling` 的性能问题**
- 错误: 大量 airborne 对象时，每帧发出 N 次 `gravity:falling` 事件
- 注意: 如果有大量监听者或复杂处理逻辑，这会成为性能瓶颈

**忘记调用 addObject**
- 错误: 只设置了 Gravity 参数但未调用 `addObject()` → 没有对象受重力影响
- 正确: 由渲染器或物理管理器负责在游戏开始时注册对象

## 常见问题 & 边界情况

- `gravity:falling` 事件**每帧**都会对每个 airborne 对象发出，而非仅在首次变为 airborne 时发出
- 当 `enabled = false` 时，所有物理更新停止，airborne 对象悬停在空中
- `addObject()` 直接使用引用修改对象状态（非 immutable），属于引擎内部性能优化
- 当帧间隔极大（如 dt > 200ms，tab 切后台）时，欧拉积分可能产生跳跃现象
- `applyTo` 参数当前仅是标记，实际重力作用由 `addObject()` 调用方决定
- `reset()` 清空所有已注册对象并恢复 enabled，但不会发出任何事件
- 负 strength 值理论上可以产生"反重力"效果（物体向上加速），但未经测试
- 物体 velocityY 可以被外部直接修改（如 Jump 设置初始上升速度），不会与 Gravity 冲突
