# WallDetect — 墙壁检测模块

## 基本信息
- 类型: mechanic
- 类名: `WallDetect`
- 注册名: `WallDetect`
- 文件: `src/engine/modules/mechanic/wall-detect.ts`
- 依赖: 无（独立模块）
- 可选联动: Jump, Gravity, PlayerMovement, StaticPlatform, CoyoteTime, CameraFollow

## 功能原理

WallDetect 模块实现了贴墙滑行（wall slide）和蹬墙跳（wall jump）两个核心平台跳跃机制。模块不自行做碰撞检测，而是提供接口让外部代码报告墙壁接触状态，然后基于该状态执行滑行和蹬墙跳逻辑。

**核心状态：**
- `touching`: boolean — 是否接触墙壁
- `side`: 'left' | 'right' | null — 接触的是左墙还是右墙

**贴墙滑行（Wall Slide）流程：**
1. 外部代码检测到角色侧面碰撞墙壁 → 调用 `setWallContact(side)`
2. 设置 `touching = true, side = 'left' 或 'right'`
3. 发出 `wall:contact` 事件
4. `update()` 每帧检查: `touching && wallSlide 参数为 true`
5. 满足条件时每帧发出 `wall:slide` 事件（含 side 和 slideSpeed）
6. 外部代码（渲染器）收到 `wall:slide` 后将角色 velocityY 限制为 slideSpeed

```
贴墙滑行物理:
  if (velocityY > slideSpeed) velocityY = slideSpeed

  含义: 限制下落速度不超过 slideSpeed
        但不影响上升速度（跳起后贴墙不会被减速）

  参考值:
    Celeste: slideSpeed ≈ 40~60 px/s（非常慢的滑行）
    Hollow Knight: slideSpeed ≈ 80~120 px/s（中等滑行）
    Super Meat Boy: slideSpeed ≈ 150~200 px/s（快速滑行）
```

**蹬墙跳（Wall Jump）流程：**
1. 玩家在贴墙状态下（touching = true）
2. 收到 wallJumpEvent 输入事件
3. 调用 `tryWallJump()`:
   a. 检查 `touching === true`（必须贴墙中）
   b. 计算跳离方向: awaySide = side 的反方向（左墙→向右跳，右墙→向左跳）
   c. 发出 `wall:jump` 事件（含 forceX, forceY, awaySide, fromSide）
   d. 调用 `clearWallContact()`（跳离后清除贴墙状态）

```
蹬墙跳物理:
  velocityX = forceX * (side === 'left' ? 1 : -1)  // 向远离墙壁的方向
  velocityY = -forceY / 1000  // 向上（与 Jump 模块单位一致）

蹬墙跳轨迹是一个抛物线:
  水平距离 = forceX * (2 * forceY / gravity) / 1000
  垂直高度 = forceY² / (2 * gravity)

参考值:
  Celeste: forceX ≈ 350, forceY ≈ 500, 角度 ≈ 55°（偏垂直，容易连续蹬墙）
  Mega Man X: forceX ≈ 400, forceY ≈ 600, 角度 ≈ 56°（标准）
  Super Meat Boy: forceX ≈ 500, forceY ≈ 400, 角度 ≈ 39°（偏水平，远距离）
```

**蹬墙跳角度计算：**
```
跳跃角度 θ = atan2(forceY, forceX) * (180 / π)

θ > 45°: 偏垂直 → 容易在两面墙之间连续蹬墙
θ = 45°: 均衡 → 等距水平/垂直位移
θ < 45°: 偏水平 → 跳离墙壁距离远，但向上距离有限
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| wallSlide | boolean | `true` | true / false | true | 是否启用贴墙滑行 |
| slideSpeed | range | `100` | 50 ~ 300，步长 10 | 60 ~ 150 | 贴墙最大下落速度 (px/s) |
| wallJump | boolean | `true` | true / false | true | 是否启用蹬墙跳 |
| wallJumpForce | object | `{ x: 400, y: 600 }` | 见子字段 | 见风格参考 | 蹬墙跳力度 |
| wallJumpForce.x | range | `400` | 200 ~ 600，步长 10 | 300 ~ 500 | 水平弹出力 (px/s) |
| wallJumpForce.y | range | `600` | 300 ~ 800，步长 10 | 400 ~ 700 | 垂直跳跃力（与 Jump.jumpForce 类似含义） |
| wallJumpEvent | string | `'input:touch:tap'` | 任意事件名 | — | 触发蹬墙跳的输入事件 |

### 手感风格参数参考

| 风格 | slideSpeed | forceX | forceY | 角度 | 体验 | 参考游戏 |
|------|-----------|--------|--------|------|------|----------|
| 轻盈精准 | 50 ~ 70 | 300 ~ 350 | 500 ~ 600 | ~55° | 慢速滑行，容易连续蹬墙 | Celeste |
| 标准平衡 | 80 ~ 120 | 350 ~ 450 | 500 ~ 650 | ~50° | 中速滑行，适中跳跃 | Mega Man X |
| 快速弹射 | 120 ~ 200 | 450 ~ 550 | 400 ~ 500 | ~42° | 快速滑落，远距离弹射 | Super Meat Boy |
| 沉重有力 | 150 ~ 250 | 250 ~ 350 | 600 ~ 800 | ~65° | 快速滑落，高弹跳但近距离 | Hollow Knight |

### 蹬墙跳力度速查表

| forceX \ forceY | 400 | 500 | 600 | 700 | 800 |
|-----------------|-----|-----|-----|-----|-----|
| 200 | 63° | 68° | 72° | 74° | 76° |
| 300 | 53° | 59° | 63° | 67° | 69° |
| 400 | 45° | 51° | 56° | 60° | 63° |
| 500 | 39° | 45° | 50° | 54° | 58° |
| 600 | 34° | 40° | 45° | 49° | 53° |

角度 > 60°: 几乎垂直弹跳，适合墙壁交替攀爬
角度 45° ~ 60°: 均衡，通用
角度 < 45°: 远距离水平弹射，适合到达远处平台

## 参数调优指南

### slideSpeed 与 Gravity 的关系

```
贴墙滑行是通过限制下落速度实现的:
  max_fall_speed_on_wall = slideSpeed
  正常最大下落速度 = Gravity.terminalVelocity

减速比 = slideSpeed / terminalVelocity
```

| Gravity.terminalVelocity | slideSpeed | 减速比 | 手感 |
|--------------------------|-----------|--------|------|
| 800 | 60 | 7.5% | 几乎悬停，非常缓慢的滑行 |
| 800 | 100 | 12.5% | 标准平台游戏滑行 |
| 800 | 200 | 25% | 较快滑行，仅轻微减速 |
| 800 | 300 | 37.5% | 贴墙仅稍微减速，区别不大 |

**推荐**: 减速比 5% ~ 20% 能产生明显的贴墙效果

### wallJumpForce.y 与 Jump.jumpForce 的关系

```
比值 R = wallJumpForce.y / Jump.jumpForce

R < 0.8: 蹬墙跳比正常跳弱 → 无法用蹬墙跳到达正常跳跃能到的高度
R = 1.0: 蹬墙跳与正常跳等高 → 最常见设计
R > 1.2: 蹬墙跳比正常跳更强 → 奖励蹬墙跳技巧
```

**推荐**: `wallJumpForce.y = Jump.jumpForce * 0.9 ~ 1.1`（接近等高）

### wallJumpForce.x 与关卡宽度

```
蹬墙跳水平距离 = forceX * airTime
airTime ≈ 2 * forceY / gravity (秒)

示例 (forceX=400, forceY=600, gravity=980):
  airTime = 2 * 600 / 980 ≈ 1.22s
  水平距离 = 400 * 1.22 ≈ 490px

两面墙的最小间距应 >= 水平距离 * 0.5（允许蹬墙攀升）
```

| forceX | forceY | gravity | 水平距离 | 推荐墙间距 |
|--------|--------|---------|---------|-----------|
| 300 | 500 | 980 | 306px | 150 ~ 250px |
| 400 | 600 | 980 | 490px | 245 ~ 400px |
| 500 | 600 | 980 | 612px | 300 ~ 500px |

### Coyote Time on Wall（墙壁 Coyote Time）

**业界最佳实践**（当前实现未内置，需要扩展）:

在蹬墙跳中，玩家离开墙壁后应有短暂的蹬墙跳宽容时间:
```
wall_coyote_time ≈ 3~6 帧 (50~100ms)

效果: 玩家按跳跃键时如果刚离开墙壁不到 wall_coyote_time，
      仍然执行蹬墙跳而非普通空中跳（如果有双跳）
```

**Celeste 的蹬墙机制额外细节:**
- 蹬墙跳后有约 6 帧的"锁定"时间——玩家不能立即改变水平方向
- 这防止了玩家蹬墙跳后立即贴回同一面墙
- 锁定结束后恢复正常空中控制

### Wall Jump 连续攀爬设计

在两面相对的墙壁之间，蹬墙跳可以实现交替攀爬:

```
攀爬条件:
  每次蹬墙跳的净高度增益 > 两次蹬墙跳之间的滑行距离

净高度增益 = forceY² / (2 * gravity)
两次跳跃间滑行 ≈ slideSpeed * 反应时间 (约 0.3~0.5s)

示例 (forceY=600, gravity=980, slideSpeed=100):
  净高度 = 600²/(2*980) ≈ 184px
  滑行损失 = 100 * 0.4 = 40px
  每次攀爬净增 = 184 - 40 = 144px → 可以稳定攀爬
```

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `wall:contact` | `WALL_CONTACT` | `{ side: 'left' \| 'right' }` | setWallContact() 被调用时 |
| `wall:slide` | `WALL_SLIDE` | `{ side: 'left' \| 'right', speed: number }` | 每帧 touching && wallSlide 时 |
| `wall:jump` | `WALL_JUMP` | `{ forceX: number, forceY: number, awaySide: string, fromSide: string }` | tryWallJump() 成功执行时 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `{wallJumpEvent}` | 调用 tryWallJump()（仅 wallJump 参数为 true 时注册） |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
墙壁接触:
  渲染器: 检测到角色侧面碰撞
    → wallDetect.setWallContact('left')
      → emit('wall:contact', { side: 'left' })
        → 渲染器: 播放贴墙动画
        → 可选: 角色朝向翻转

贴墙滑行 (每帧):
  wallDetect.update()
    → touching && wallSlide → emit('wall:slide', { side: 'left', speed: 100 })
      → 渲染器: velocityY = min(velocityY, slideSpeed)
      → 渲染器: 播放滑行粒子效果

蹬墙跳:
  用户输入 → emit(wallJumpEvent)
    → wallDetect.tryWallJump()
      → touching === true → 执行跳跃
        → emit('wall:jump', { forceX: 400, forceY: 600, awaySide: 'right', fromSide: 'left' })
          → 渲染器: 设置 velocityX = forceX (向 awaySide 方向)
          → 渲染器: 设置 velocityY = -forceY / 1000 (向上)
          → ParticleVFX: 蹬墙特效
          → SoundFX: 蹬墙音效
        → clearWallContact() → touching = false
```

## 跨模块联动规则

### 与 Jump 模块

- WallDetect 和 Jump 监听相同的输入事件（wallJumpEvent 通常 = Jump.triggerEvent）
- 当贴墙时，输入事件触发蹬墙跳；不贴墙时，触发普通跳跃
- **事件优先级问题**: 如果两者都监听 `input:touch:tap`，两个模块都会响应
  - WallDetect.tryWallJump() 在 touching=false 时直接 return，不执行
  - Jump.triggerJump() 在 grounded=false 时直接 return，不执行
  - 在贴墙状态下: WallDetect 执行蹬墙跳，Jump 不执行（因为不在地面）
- **wallJumpForce.y 应接近 Jump.jumpForce**: 保持跳跃高度一致

### 与 Gravity 模块

- 贴墙滑行时，需要外部代码将 Gravity 的 velocityY 限制为 slideSpeed
- `wall:slide` 事件提供了 speed 值，渲染器应据此 clamp velocityY
- Gravity 模块本身不感知墙壁状态——限速逻辑在渲染器中

### 与 PlayerMovement 模块

- 贴墙时应阻止玩家继续向墙壁方向移动
- PlayerMovement 不自动响应 `wall:contact`——需要外部代码阻止
- 蹬墙跳后的 forceX 需要叠加到 PlayerMovement 的 velocityX 或直接设置位置
- **蹬墙跳锁定期**: 理想情况下，蹬墙跳后短暂锁定 PlayerMovement 的方向输入

### 与 StaticPlatform 模块

- 墙壁碰撞检测需要外部代码检查 PlayerMovement.x 是否与 StaticPlatform 的竖直边重叠
- StaticPlatform.checkCollision() 是点-矩形测试，可以用于检测侧面碰撞
- **检测逻辑示例**:
  ```
  如果 playerX - playerRadius < platform.x → 左侧碰墙 → setWallContact('right')?
  如果 playerX + playerRadius > platform.x + platform.width → 右侧碰墙 → setWallContact('left')?
  ```
  注意: 墙壁 side 指的是墙壁在玩家的哪一侧（left = 墙在玩家左边）

### 与 CoyoteTime 模块

- CoyoteTime 当前不与 WallDetect 集成
- **理想扩展**: 离开墙壁后有 wall coyote time（3~6 帧内仍可蹬墙跳）
- 当前实现: clearWallContact() 后 touching = false，立即无法蹬墙跳

### 与 CameraFollow 模块

- 蹬墙跳会产生快速的方向变化（先贴墙向一侧，跳后向另一侧）
- CameraFollow 的 look-ahead 模式在蹬墙跳时会频繁切换方向 → 相机摇摆
- **建议**: 在蹬墙跳密集的区域使用 dead-zone 模式或较高的 smoothing 值

## 输入适配

### wallJumpEvent 适配

| 输入方式 | wallJumpEvent | 体验 | 特殊说明 |
|----------|-------------|------|---------|
| TouchInput | `input:touch:tap` | 最佳——与普通跳跃同键，自动区分 | 默认设置 |
| FaceInput | `input:face:mouthOpen` | 可用——张嘴蹬墙跳 | 延迟 ~100ms，增加 slideSpeed |
| HandInput | `input:hand:gesture:open` | 可用——张手蹬墙跳 | 中等延迟 |
| AudioInput | `input:audio:blow` | 不推荐——延迟太大无法精准蹬墙 | — |
| DeviceInput | `input:device:shake` | 不推荐——抖动触发不精确 | — |

**建议**: wallJumpEvent 应与 Jump.triggerEvent 相同——两者共享输入，由状态决定执行哪个:
- 在地面 → Jump.triggerJump()
- 在空中贴墙 → WallDetect.tryWallJump()
- 在空中不贴墙 → 两者都不执行（除非有双跳）

### 墙壁检测方向与输入

| 输入方式 | 墙壁检测 | 说明 |
|----------|---------|------|
| TouchInput | 按住屏幕左/右半侧朝墙壁方向 | 自然操作 |
| FaceInput | 头部转向墙壁方向 | 需要玩家理解 |
| HandInput | 手势指向墙壁方向 | — |
| DeviceInput | 手机倾斜向墙壁方向 | — |

## 常见 Anti-Pattern

**wallJumpEvent 与 Jump.triggerEvent 不同**
- 错误: `wallJumpEvent: 'input:touch:tap'`, `Jump.triggerEvent: 'input:face:mouthOpen'` → 两种跳跃需要不同输入，反直觉
- 正确: 两者使用相同事件，由贴墙状态自动切换

**slideSpeed 接近或大于 terminalVelocity**
- 错误: `slideSpeed: 800, terminalVelocity: 800` → 贴墙滑行与自由下落速度相同，无减速效果
- 正确: `slideSpeed <= terminalVelocity * 0.2`

**wallJumpForce.x 过大导致弹出画布**
- 错误: `forceX: 600` + 窄关卡 (画布宽 400px) → 蹬墙跳直接飞出画面
- 正确: `forceX * airTime < canvasWidth * 0.5`

**不调用 clearWallContact()**
- 错误: 角色离开墙壁区域但不调用 clearWallContact → 仍标记为贴墙 → 在空中执行"蹬墙跳"
- 正确: 外部代码在每帧检查碰撞，不再接触墙壁时调用 clearWallContact()

**蹬墙跳后立即贴回同一面墙**
- 错误: forceX 太小，蹬墙跳后角色迅速减速贴回墙壁 → 快速连点可以"蹭墙飞升"
- 正确: forceX 至少 300，或在蹬墙跳后添加方向锁定期

**wall:slide 事件每帧发出的性能问题**
- 如果有多个监听者且处理逻辑复杂，每帧发出的 wall:slide 可能影响性能
- 建议: 只在首次进入贴墙状态时做复杂处理，wall:slide 的渲染器处理应尽量轻量

## 常见问题 & 边界情况

- `setWallContact(side)` 和 `clearWallContact()` 需要外部代码调用——模块不自行检测碰撞
- `wall:slide` 事件每帧发出（只要 touching && wallSlide），不只是首次
- `tryWallJump()` 在 touching=false 时直接 return，不发出任何事件
- `wall:jump` 事件发出后立即调用 `clearWallContact()`——跳离后不再贴墙
- `wall:jump` 的 awaySide 是跳跃方向（远离墙壁的方向），fromSide 是墙壁所在方向
- `wallJumpForce` 的 forceX 始终为正值——方向由 awaySide 决定
- `reset()` 清除 touching 和 side 状态
- wallJump=false 时不注册 wallJumpEvent 监听——只支持滑行不支持蹬墙跳
- wallSlide=false 时 update() 不发出 wall:slide 事件——但 touching 状态仍然存在
- 同时 wallSlide=false 且 wallJump=false 时，模块仅维护 touching/side 状态供外部查询
- wallJumpEvent 监听器在 init() 时注册，wallJump 参数变化后不会动态更新
