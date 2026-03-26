# Knockback — 击退模块

## 基本信息
- 类型: mechanic
- 类名: `Knockback`
- 注册名: `Knockback`
- 文件: `src/engine/modules/mechanic/knockback.ts`
- 依赖: Collision（requires）
- 可选联动: Lives, IFrames, PlayerMovement, Jump, Gravity

## 功能原理

Knockback 在受伤瞬间将玩家向伤害源反方向推出，提供物理分离和视觉反馈。这是 Damage Response Triad（Lives + IFrames + Knockback）的第三个核心组件。

**工作流程：**
1. 监听 `triggerEvent`（默认 `collision:damage`）
2. 收到事件时，从事件数据的 `(x, y)` 计算击退方向:
   - 若 `magnitude > 0`: 方向 = `(dx, dy)` 归一化
   - 若 `magnitude === 0`: 默认向右推 `{ x: 1, y: 0 }`
3. `active = true`, `elapsed = 0`，发出 `knockback:start`
4. 每帧累加 `elapsed`，直到 `elapsed >= duration`
5. 超时后 `active = false`，发出 `knockback:end`

**方向计算详解：**

当前实现直接使用碰撞事件中的 `(x, y)` 作为方向向量。但 Collision 模块的 `(x, y)` 是**碰撞点坐标**（两物体中点），不是方向向量。

```
碰撞事件: { objectA: 'player_1', objectB: 'spawn-42', x: 200, y: 300 }
Knockback 接收: dx=200, dy=300 → 归一化为方向
```

**问题**: 这个方向是碰撞点到原点的方向，不是「从伤害源到玩家」的方向。理想实现应该是:

```
正确方向 = normalize(player.position - hazard.position)
```

当前实现在大多数情况下仍然有效（碰撞点偏向伤害源一侧），但在极端情况下方向可能不直觉。

**设计参考（Hollow Knight 的击退哲学）：**

Hollow Knight 中每次攻击都会产生击退，这是游戏最核心的设计之一。击退迫使玩家：
- 内化每次攻击后的位移距离
- 在小平台上谨慎出招（避免被推下平台）
- 学会利用击退做"碰弹跳"（pogo bounce）

Heavy Blow 护符增加敌人击退距离，Steady Body 护符消除玩家自身击退——说明击退本身可以作为可调参数，不同场景下给予玩家选择权。

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| force | range | `300` | 100 ~ 800，步长 10 | 200 ~ 500 | 击退力度（px/s，概念值，实际位移由渲染器处理） |
| duration | range | `200` | 50 ~ 500，步长 10 | 150 ~ 300 | 击退持续时间（ms） |
| triggerEvent | string | `'collision:damage'` | 任意事件名 | `collision:damage` | 触发击退的事件 |
| applyTo | select | `'player'` | `player` / `items` / `all` | `player` | 击退应用目标 |

### 物理参数解读

```
概念位移距离 = force * (duration / 1000)  (px)

force=300, duration=200 → 60px
force=500, duration=200 → 100px
force=300, duration=300 → 90px
```

**注意**: Knockback 模块本身只管理状态和方向信息，不直接修改任何物体的坐标。实际位移由渲染器或 PlayerMovement 根据 `knockback:start` 事件和 `getDirection()`/`isActive()` 查询实现。

### 不同游戏类型的参数推荐

| 游戏类型 | force | duration | applyTo | 设计理由 |
|----------|-------|----------|---------|---------|
| dodge | 200 ~ 300 | 150 ~ 200 | player | 轻推，不打断节奏 |
| runner | 300 ~ 400 | 200 ~ 250 | player | 稍强推力，减速效果 |
| platformer (标准) | 300 ~ 500 | 200 ~ 300 | player | 经典动作手感 |
| platformer (Hollow Knight) | 400 ~ 600 | 250 ~ 350 | player | 强力击退，增加策略深度 |
| platformer (宽容) | 150 ~ 250 | 100 ~ 150 | player | 轻微反馈，不影响操作 |
| shooting | 200 ~ 300 | 150 | all | 双方击退增加动感 |

### 经典游戏击退参数参考

| 游戏风格 | 概念位移 (px) | duration | 手感描述 |
|----------|-------------|----------|---------|
| Mega Man | ~80 ~ 100px | ~250ms | 强力后退，可能落坑 |
| Hollow Knight | ~60 ~ 80px | ~200ms | 适中击退，需要补偿 |
| Celeste | 0（无击退） | 0 | 一碰即死，无需击退 |
| Mario | ~40 ~ 60px | ~150ms | 轻微后退 |
| 休闲 dodge | ~30 ~ 50px | ~100ms | 几乎无感的微推 |

## 参数调优指南

### force 与平台宽度的关系

```
安全force = 平台宽度 * 0.3 / (duration / 1000)
```

确保击退不会把玩家推下平台:
- 平台宽度 200px: force <= 300（200ms 内推 60px，小于平台半宽）
- 平台宽度 100px: force <= 150（200ms 内推 30px，小于平台半宽）

### duration 与 IFrames 的配合

```
必须满足: IFrames.duration > Knockback.duration
推荐比例: IFrames.duration = Knockback.duration * 3 ~ 5
```

如果击退还没结束无敌帧就消失，玩家可能在被推动过程中再次受伤。

### duration 与玩家输入的关系

击退期间玩家输入应该被**抑制或减弱**。这创造了"被击中的失控感"——太短无感觉，太长令人沮丧。

| duration | 体验 | 适合 |
|----------|------|------|
| 50 ~ 100ms | 几乎无感的微推 | 休闲游戏 |
| 150 ~ 250ms | 短暂失控后快速恢复 | 标准动作游戏 |
| 300 ~ 500ms | 明显的惩罚感 | 硬核/魂类 |

### applyTo 参数详解

| 值 | 行为 | 使用场景 |
|----|------|---------|
| `player` | 只击退玩家 | dodge/runner/platformer——玩家碰到障碍被推开 |
| `items` | 只击退碰撞物 | 玩家主动攻击敌人，击飞敌人 |
| `all` | 双方都击退 | Hollow Knight 风格——攻击时双方都有反馈 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `knockback:start` | `KNOCKBACK_START` | `{ force: number, direction: { x: number, y: number } }` | 击退激活时 |
| `knockback:end` | `KNOCKBACK_END` | （无数据） | 击退持续时间结束时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `{triggerEvent}` | — | 计算方向并激活击退（默认 `collision:damage`） |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复计时 |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停计时 |

### 事件流转示意

```
collision:damage 发生 (data: { x, y, objectA, objectB })
  → Knockback.activate(data)
    → 计算方向: normalize(data.x, data.y)
    → active = true, elapsed = 0
    → emit('knockback:start', { force: 300, direction: { x: 0.6, y: 0.8 } })
      → PlayerMovement: 抑制玩家移动输入
      → PixiRenderer: 应用位移动画
  → [同时] IFrames.activate() → 闪烁开始
  → [同时] Lives.decrease() → 扣血

Knockback.update() 每帧
  → elapsed >= duration:
    → active = false
    → emit('knockback:end')
      → PlayerMovement: 恢复玩家移动输入
```

## 跨模块联动规则

### Lives + IFrames + Knockback 三件套

三者同时监听 `collision:damage`，各自独立响应。执行顺序由 EventBus 的监听注册顺序决定（通常是模块 init() 的顺序）。

**时序图（推荐参数组合）：**

```
  collision:damage
  |
  ├── Lives.decrease()     [即时]
  ├── IFrames.start()      [即时 → 持续 1000ms]
  └── Knockback.start()    [即时 → 持续 200ms]

  0ms ───────── 200ms ──────────── 1000ms
  [击退中]     [击退结束]        [无敌帧结束]
  [输入抑制]   [恢复输入]        [恢复可受伤]
  [无敌]       [仍然无敌]        [可受伤]
```

### 与 PlayerMovement 的关系

- `knockback:start` → PlayerMovement 应将 movement state 切换为 "stunned"
- 击退期间，玩家的水平/垂直移动输入应被**完全禁用**或**大幅减弱**
- `knockback:end` → 恢复正常 movement state
- **当前实现**: Knockback 不直接修改 PlayerMovement 状态，需要上层协调

### 与 Jump 的关系

- 击退期间是否允许跳跃? 取决于游戏设计:
  - Mega Man: 击退期间不能跳 → 可能被推入坑中
  - Hollow Knight: 击退期间不能攻击但可以跳
- **建议**: 击退期间禁止跳跃（Jump 检查 `knockback.isActive()`）

### 与 Gravity / StaticPlatform 的关系

- 击退的 Y 方向分量可能将玩家推到空中
- 如果玩家被向上击退，需要 Gravity 模块接管后续下落
- 如果玩家站在平台上被水平击退，可能被推出平台边缘 → 需要 Gravity 处理自由落体

### 与 Hazard 的关系

- 被 Hazard 触发 collision:damage → Knockback 将玩家推离 Hazard
- 这是 Knockback 最重要的功能: **物理分离**确保玩家不会持续站在 Hazard 上
- 推力方向应该是「从 Hazard 中心到玩家中心」（当前实现的方向计算可能不准确）

### 与 Collision 的关系

- Knockback 不直接修改碰撞体位置（由渲染器处理）
- 击退期间碰撞体仍然存在 → 配合 IFrames 防止重复伤害

## 输入适配

Knockback 击退力度应根据输入精度调整——低精度输入下玩家恢复位置更困难：

| 输入方式 | force 调整 | duration 调整 | 理由 |
|----------|-----------|-------------|------|
| TouchInput | 标准 | 标准 | 触摸精度高，快速恢复 |
| FaceInput | -20% ~ -30% | -10% | 面部追踪恢复位置慢 |
| HandInput | -10% ~ -20% | 标准 | 手势追踪精度适中 |
| DeviceInput | -20% ~ -30% | -15% | 倾斜控制恢复位置困难 |
| AudioInput | 不适用 | 不适用 | 声音不控制位置 |

## 常见 Anti-Pattern

**击退方向计算使用碰撞点坐标而非相对方向**
- 错误: `direction = normalize(collisionPoint.x, collisionPoint.y)` → 方向是碰撞点到原点的向量，不是击退方向
- 正确: `direction = normalize(player.position - hazard.position)` → 从伤害源指向玩家
- **注意**: 当前实现使用碰撞事件的 (x, y) 作为方向向量，这在 (x, y) 是碰撞点坐标时是不准确的

**击退期间未禁用玩家输入**
- 错误: 击退200ms 但玩家可以立即反向移动抵消击退 → 击退毫无效果
- 正确: Knockback.isActive() 期间 PlayerMovement 抑制输入

**force 过大导致穿墙或掉坑**
- 错误: `force: 800, duration: 300` → 240px 位移，可能穿过碰撞体或飞出平台
- 正确: 限制 force 使得最大位移 < 最窄平台宽度的 50%

**Knockback 连续触发导致玩家被锁死**
- 错误: 无 IFrames 配合 → 每帧 collision:damage → 每帧重新激活 Knockback → 玩家被反复推拉
- 正确: 必须配合 IFrames，确保 Knockback 期间不会再次触发

**applyTo 使用 'all' 但 Spawner 物体不受物理控制**
- 错误: `applyTo: 'all'` 但 Spawner 的物体按固定方向移动 → 击退 items 无实际效果
- 正确: applyTo: 'all' 只在双方都有物理系统时有意义

**duration > IFrames.duration**
- 错误: `knockback.duration: 500, iframes.duration: 300` → 击退未结束时无敌帧已消失 → 可能在击退过程中再次受伤
- 正确: `iframes.duration >= knockback.duration * 3`

## 常见问题 & 边界情况

- `activate()` 被重复调用时会覆盖当前击退（不像 IFrames 的忽略策略）
- 方向归一化: 当 `(dx, dy)` 都为 0 时默认向右推 `{ x: 1, y: 0 }`
- `getDirection()` 返回方向的浅拷贝（`{ ...this.direction }`），外部修改不影响内部状态
- `isActive()` 可被其他模块查询，用于决定是否抑制输入
- `gameflowPaused` 时不累加 elapsed → 暂停期间击退冻结
- `reset()` 将 active 设为 false、elapsed 设为 0、direction 归零
- Knockback 模块不直接修改任何坐标——它只提供状态和方向信息，实际位移由外部实现
- 如果 dt 极大（tab 切回），可能在一帧内跳过整个击退周期
- getDependencies() 声明 requires: ['Collision']，因为 triggerEvent 默认依赖碰撞事件
