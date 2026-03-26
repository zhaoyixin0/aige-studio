# Jump — 跳跃模块

## 基本信息
- 类型: mechanic
- 类名: `Jump`
- 注册名: `Jump`
- 文件: `src/engine/modules/mechanic/jump.ts`
- 依赖: 无（独立物理循环）
- 可选联动: Gravity, CoyoteTime, StaticPlatform, WallDetect

## 功能原理

Jump 模块实现了完整的单次跳跃物理，包含起跳、上升、到达顶点、下落和落地的完整周期。模块内部维护自己的 Y 轴物理系统（独立于 Gravity 模块）。

**跳跃周期：**
1. **起跳**: 收到 triggerEvent → 设置 velocityY 为负值（向上），标记 grounded = false
2. **上升**: 每帧施加 gravity 使 velocityY 趋向 0
3. **顶点**: velocityY 从负变正时，发出 `jump:peak` 事件
4. **下落**: gravity 继续加速 velocityY 向下
5. **落地**: y >= groundY 时，重置所有状态，发出 `jump:land`

**物理实现细节：**
- jumpForce 除以 1000 转为 per-ms 单位: `velocityY = -jumpForce / 1000`
- gravity 除以 1000 转为 per-ms 单位，再乘以 `dt / 1000`
- 实际公式: `velocityY += (gravity / 1000) * (dt / 1000)`
- Y 轴正方向为向下（屏幕坐标系），所以跳跃初速度为负值

**核心物理公式（基于当前实现的换算）：**

```
实际重力加速度 g_eff = gravity / 1_000_000  (px/ms²)
实际初速度 v₀ = -jumpForce / 1000  (px/ms)

跳跃高度 H = jumpForce² / (2 * gravity)  (px) — 这是最实用的简化公式
到达顶点时间 t_apex = jumpForce / gravity * 1000  (ms)
总滞空时间 t_air = 2 * jumpForce / gravity * 1000  (ms)

设计者常用形式（反推参数）:
  gravity = jumpForce² / (2 * H)
  jumpForce = sqrt(2 * gravity * H)
  gravity = 2 * H / (t_apex / 1000)²  （从期望高度和时间反推）
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| jumpForce | range | `500` | 100 ~ 1000，步长 10 | 400 ~ 700 | 跳跃力度，值越大跳得越高 |
| gravity | range | `980` | 200 ~ 2000，步长 10 | 600 ~ 1200 | 跳跃过程中的重力加速度 |
| groundY | range | `0.8` | 0 ~ 1，步长 0.05 | 0.7 ~ 0.85 | 地面 Y 位置（归一化值，0=顶部，1=底部）|
| triggerEvent | select | `'input:touch:tap'` | 预设事件列表 | — | 触发跳跃的输入事件 |

### 经典游戏参数参考

| 游戏风格 | jumpForce | gravity | 跳跃高度 (px) | 滞空时间 (ms) | 手感描述 |
|----------|-----------|---------|---------------|--------------|----------|
| Mario 风格 | 600 | 980 | 184 | 1224 | 标准、扎实 |
| Celeste 风格 | 500 | 700 | 179 | 1429 | 轻盈、滞空久 |
| Hollow Knight 风格 | 700 | 1400 | 175 | 1000 | 快速、果断 |
| 休闲轻松 | 400 | 600 | 133 | 1333 | 慢速、易控制 |
| 硬核精密 | 800 | 1600 | 200 | 1000 | 高跳、快落 |

### 跳跃高度速查表

| jumpForce \ gravity | 600 | 800 | 980 | 1200 | 1600 |
|---------------------|-----|-----|-----|------|------|
| 300 | 75px | 56px | 46px | 38px | 28px |
| 400 | 133px | 100px | 82px | 67px | 50px |
| 500 | 208px | 156px | 128px | 104px | 78px |
| 600 | 300px | 225px | 184px | 150px | 113px |
| 700 | 408px | 306px | 250px | 204px | 153px |
| 800 | 533px | 400px | 327px | 267px | 200px |

## 参数调优指南

### 跳跃高度与平台间距

跳跃高度决定了关卡设计中平台之间的最大垂直间距：

```
最大可达平台高度 = 跳跃高度 * 0.85  （留 15% 安全余量）
推荐平台垂直间距 = 跳跃高度 * 0.6 ~ 0.8  （舒适跳跃区间）
```

以默认参数 (jumpForce=500, gravity=980) 为例：
- 跳跃高度 ≈ 128px
- 推荐平台间距: 77 ~ 102px
- 最大安全间距: 109px

### groundY 与画布尺寸

groundY 是归一化值（0~1），实际像素位置 = groundY * canvasHeight。

| 画布尺寸 | groundY | 地面 Y (px) | 可跳跃区域高度 |
|----------|---------|------------|--------------|
| 1080x1920 | 0.78 | 1498px | 1498px |
| 720x1280 | 0.80 | 1024px | 1024px |
| 800x600 | 0.85 | 510px | 510px |

**已知问题**: groundY 是固定值，不会随平台位置动态变化。当玩家站在高处平台上时，Jump 的落地检测仍然使用 groundY，导致：
- 从高台跳跃后，角色会下落到 groundY 而非高台表面
- 需要外部代码在每帧动态更新 groundY 以匹配当前站立的平台高度

### gravity / jumpForce 比值的影响

```
比值 R = gravity / jumpForce
```

| R 值 | 跳跃特征 | 适用场景 |
|------|---------|---------|
| < 1.5 | 跳得高、落得慢、空中时间长 | 探索型平台游戏 |
| 1.5 ~ 2.0 | 平衡手感 | 通用平台游戏 |
| 2.0 ~ 3.0 | 跳得低、落得快、手感紧凑 | 动作/战斗向平台游戏 |
| > 3.0 | 极短跳跃 | 需要精密操作的关卡 |

### 跳跃手感进阶技巧

**业界最佳实践（当前实现未支持，未来可扩展）：**

1. **可变跳跃高度**: 松开按钮时立即增大 gravity（通常 2~3 倍），实现短按小跳、长按大跳
2. **顶点半重力**: 在速度接近 0 时将 gravity 减半，增加空中调整时间（Celeste 做法）
3. **下落加速**: 下落时使用比上升时更大的 gravity（通常 1.5~2 倍），使下落更果断
4. **挤压拉伸**: 根据 velocityY 缩放角色 sprite，增加视觉冲击力

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `jump:start` | `JUMP_START` | `{ y: number }` | 起跳瞬间 |
| `jump:peak` | `JUMP_PEAK` | `{ y: number }` | velocityY 从负变正时（到达最高点） |
| `jump:land` | `JUMP_LAND` | `{ y: number }` | y >= groundY 时（落地） |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `{triggerEvent}` | — | 调用 triggerJump()，仅在 grounded 时生效 |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复物理更新 |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停物理更新 |

### 事件流转示意

```
用户输入 → emit(triggerEvent)
  → Jump.triggerJump()
    → 设置 velocityY = -jumpForce/1000
    → emit('jump:start', { y })
      → Gravity 监听 → 标记对象 airborne
      → SoundFX 监听 → 播放跳跃音效
      → ParticleVFX 监听 → 起跳特效

Jump.update() 每帧
  → velocityY 过零 → emit('jump:peak', { y })
  → y >= groundY → emit('jump:land', { y })
    → CoyoteTime 可选监听
    → ParticleVFX 监听 → 落地特效
```

## 跨模块联动规则

### 与 Gravity 模块

**双重物理系统问题**: Jump 和 Gravity 各自有独立的 Y 轴物理循环。

- Jump 管理自己的 y 和 velocityY，使用自己的 gravity 参数
- Gravity 管理 GravityObject 的 y 和 velocityY，使用 strength 参数
- `jump:start` 事件会通知 Gravity 标记对象为 airborne
- **关键**: 两个模块可能同时修改同一个对象的 Y 位置，需要确保只有一个模块在活跃管理某个时刻的物理状态
- **建议**: Jump.gravity 和 Gravity.strength 使用相同值

### 与 CoyoteTime 模块

CoyoteTime 需要在 Jump 触发跳跃之前拦截输入:
- CoyoteTime 监听与 Jump 相同的 triggerEvent
- 当在 coyote window 内时，CoyoteTime 发出 `coyote:jump` 代替原始跳跃
- **重要**: CoyoteTime 的 jumpEvent 应该与 Jump 的 triggerEvent 保持一致
- CoyoteTime 不直接调用 Jump.triggerJump()，而是通过事件间接触发

### 与 StaticPlatform / MovingPlatform

**已知问题**: Jump 使用固定 groundY 判断落地，不感知平台位置。

- 玩家从平台边缘走下时，Jump 不知道脚下没有平台
- 玩家跳跃后着陆在平台上时，Jump 的 groundY 可能不等于平台 Y
- **当前解决方案**: 由渲染器/物理管理器在每帧同步平台碰撞结果到 Jump 的内部状态
- **理想方案**: Jump 应该接受动态 floorY（类似 Gravity 的 GravityObject.floorY）

### 与 WallDetect 模块

- WallDetect 在检测到墙壁接触时可以触发 wall:jump
- wall:jump 事件包含 forceX 和 forceY
- Jump 模块本身不监听 wall:jump（WallDetect 独立处理）

### 与 Dash 模块

- Dash 激活期间通常需要禁止跳跃（当前实现未处理）
- Dash 结束后如果在空中，Jump 的 grounded 状态需要正确同步

## 输入适配

| 输入方式 | triggerEvent | 用户体验 | 特殊说明 |
|----------|-------------|---------|---------|
| TouchInput | `input:touch:tap` | 点击屏幕跳跃 | 最自然的跳跃触发方式 |
| FaceInput | `input:face:mouthOpen` | 张嘴跳跃 | 延迟较高（~100ms），需增大 coyote time |
| FaceInput | `input:face:browRaise` | 抬眉跳跃 | 误触发率较高 |
| HandInput | `input:hand:gesture:open` | 张手跳跃 | 延迟中等 |
| AudioInput | `input:audio:blow` | 吹气跳跃 | 延迟较高，适合休闲游戏 |
| DeviceInput | `input:device:shake` | 抖手机跳跃 | 不推荐——精度差、误触发多 |

**输入延迟补偿**: 当使用非触摸输入时（面部/手势/声音），建议：
- CoyoteTime.coyoteFrames 增加 2~3 帧
- CoyoteTime.bufferFrames 增加 2~3 帧
- 这可以补偿追踪延迟带来的时机偏差

## 常见 Anti-Pattern

**groundY 与平台不匹配**
- 错误: `Jump.groundY: 0.8`（1536px）但 StaticPlatform 的地面在 y=1500 → 角色悬浮或沉入平台
- 正确: groundY 换算后的像素值应与最低平台的 y 坐标一致

**jumpForce 过大导致飞出画布**
- 错误: `jumpForce: 1000, gravity: 600` → 跳跃高度 833px，在 600px 高的横屏画布上完全飞出视口
- 正确: 确保跳跃高度 < 画布高度 * 0.4（保持角色可见）

**triggerEvent 与 CoyoteTime.jumpEvent 不匹配**
- 错误: `Jump.triggerEvent: 'input:touch:tap'`, `CoyoteTime.jumpEvent: 'input:face:mouthOpen'` → CoyoteTime 监听的事件和实际跳跃事件不同
- 正确: 两者使用相同的事件名

**连续跳跃（无落地间隔）**
- 当前实现 `if (!this.grounded) return` 确保不能二段跳
- 如果需要二段跳功能，需要扩展模块（追加 maxJumps 参数）

**Jump 和 Gravity 同时更新 Y 位置**
- 错误: 两个模块同时对同一对象施加物理 → Y 位置被双重更新
- 正确: 确保在跳跃过程中只有 Jump 管理 Y 位置，或只有 Gravity 管理

## 常见问题 & 边界情况

- `triggerJump()` 仅在 `grounded = true` 时执行，有效防止二段跳
- velocityY 使用 per-ms 单位（jumpForce / 1000），与 Gravity 的 per-second 单位不同
- `peakReached` 标记确保 `jump:peak` 事件只发出一次
- `reset()` 将 y 恢复到 groundY，不发出任何事件
- 当 dt 极大（如 tab 切回）时，可能在一帧内完成整个跳跃周期（起跳 → 落地）
- groundY 是归一化值（0~1），内部直接使用此值（不乘以画布高度），这意味着 Jump 的 Y 坐标范围是 0~1 而非 0~canvasHeight
- `getY()` 返回归一化的 y 值，渲染器需要乘以画布高度来定位 sprite
- 跳跃过程中不检查任何平台碰撞——碰撞检测完全由外部负责
- `triggerEvent` 参数的 select options 只有两个预设值（touch:tap 和 face:mouthOpen），实际可以通过 string 类型接收任何事件名
