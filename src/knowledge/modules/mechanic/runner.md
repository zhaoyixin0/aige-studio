# Runner — 无尽跑酷模块

## 基本信息
- 类型: mechanic
- 类名: `Runner`
- 注册名: `Runner`
- 文件: `src/engine/modules/mechanic/runner.ts`
- 依赖: 无
- 可选联动: Spawner, Collision, Jump, Gravity, DifficultyRamp, Scorer

## 功能原理

Runner 模块实现了无尽跑酷（endless runner）的核心机制：自动向前跑动 + 多车道切换。角色始终自动前进（无需玩家控制前进），玩家通过左右 swipe 切换车道来躲避障碍物和收集道具。

**核心状态：**
- `currentLane`: 当前所在车道（0-indexed）
- `distance`: 累计前进距离 (px)
- `currentSpeed`: 当前速度 (px/s)，随时间加速
- `started`: 是否已开始跑步

**运行流程：**
1. 调用 `start()` → 初始化到中间车道，设置初始速度
2. 每帧:
   - 速度增加: `currentSpeed += acceleration * dtSec`
   - 距离累加: `distance += currentSpeed * dtSec`
   - 发出 `runner:distance` 事件（包含 distance, speed, lane）
3. 收到 swipe 事件 → 检查车道边界 → 切换车道 → 发出 `runner:laneChange`

**速度增长模型：**

```
速度公式: v(t) = v₀ + a * t
  v₀ = 初始速度 (speed 参数)
  a = 加速度 (acceleration 参数)
  t = 时间 (秒)

距离公式: d(t) = v₀ * t + ½ * a * t²

到达某速度的时间: t = (v_target - v₀) / a
到达某距离的时间: t = (-v₀ + √(v₀² + 2*a*d)) / a
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| laneCount | range | `3` | 2 ~ 5，步长 1 | 3 ~ 4 | 车道数量 |
| speed | range | `300` | 100 ~ 1000，步长 10 | 200 ~ 400 | 初始速度 (px/s) |
| acceleration | range | `10` | 0 ~ 50，步长 1 | 5 ~ 20 | 速度增长率 (px/s²) |

### 速度增长参考表

以 speed=300, acceleration=10 为例：

| 时间 | 速度 (px/s) | 累计距离 (px) | 速度倍率 |
|------|-----------|-------------|---------|
| 0s | 300 | 0 | 1.0x |
| 10s | 400 | 3,500 | 1.33x |
| 30s | 600 | 13,500 | 2.0x |
| 60s | 900 | 36,000 | 3.0x |
| 120s | 1500 | 108,000 | 5.0x |

### 不同节奏的参数组合

| 游戏节奏 | speed | acceleration | 30s后速度 | 60s后速度 | 适合 |
|----------|-------|-------------|----------|----------|------|
| 休闲慢跑 | 200 | 5 | 350 | 500 | 儿童/休闲玩家 |
| 标准跑酷 | 300 | 10 | 600 | 900 | 通用（默认） |
| 快速紧张 | 400 | 15 | 850 | 1300 | 有经验玩家 |
| 极限挑战 | 500 | 25 | 1250 | 2000 | 硬核玩家 |

## 参数调优指南

### acceleration 与游戏寿命

acceleration 决定了游戏的"寿命"——玩家在速度变得不可能反应之前能坚持多久。

```
人类平均反应时间 ≈ 250ms
最小反应距离 = 反应时间 * 当前速度 = 0.25 * v
当反应距离 < 障碍物间距时，游戏变为"不可能"
```

**设计建议**:
- 确定"目标游戏时间"（大多数玩家能坚持多久）
- 计算目标时间点的速度: `v_target = speed + acceleration * t_target`
- 确保 v_target 仍然在人类可反应范围内

| 目标游戏时间 | acceleration 建议 | 说明 |
|-------------|-----------------|------|
| 30s | 15 ~ 25 | 短局快速，适合短视频式体验 |
| 60s | 8 ~ 15 | 标准 |
| 120s | 3 ~ 8 | 长局，渐进式难度 |
| 300s+ | 1 ~ 3 | 马拉松式，难度增长几乎不可察觉 |

### laneCount 与画布宽度

```
车道宽度 = canvasWidth / laneCount
车道中心 X = (laneIndex + 0.5) * canvasWidth / laneCount
```

| 画布宽度 | laneCount | 车道宽度 | 每车道可容纳障碍物数 |
|----------|-----------|---------|-------------------|
| 1080 | 3 | 360px | 5~7 个标准大小 |
| 1080 | 4 | 270px | 4~5 个 |
| 1080 | 5 | 216px | 3~4 个 |
| 720 | 3 | 240px | 3~5 个 |
| 800 | 3 | 267px | 4~5 个 |

**建议**:
- 3 车道: 最经典配置（Subway Surfers、Temple Run）
- 2 车道: 极简，适合需要快速切换的快节奏游戏
- 4~5 车道: 更复杂，需要更长的反应时间

### 速度与 Spawner 频率的配合

障碍物的出现频率需要与速度匹配：

```
障碍物间距 (px) = currentSpeed / Spawner.frequency 的等效频率
安全反应距离 = 反应时间 * currentSpeed
最小间距 = 安全反应距离 + 障碍物宽度 + 切道动画时间 * currentSpeed
```

**经验法则**: `Spawner.frequency` 应该随 Runner 速度增长。DifficultyRamp 可以同时调整两者。

### 难度曲线设计

业界最佳实践的难度曲线：

1. **热身期** (0~15s): 纯直道或极少障碍物，让玩家适应
2. **学习期** (15~30s): 引入基础障碍物模式
3. **正常期** (30~60s): 标准难度，多种障碍物组合
4. **挑战期** (60~120s): 速度快、障碍物密
5. **极限期** (120s+): 只有顶级玩家能到达

**休息区**: 每 15~20s 应有一段 3~5s 的安全区间，让玩家喘息。可通过控制 Spawner 的生成时机实现。

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `runner:laneChange` | `RUNNER_LANE_CHANGE` | `{ from: number, to: number, laneCount: number }` | 车道切换成功时 |
| `runner:distance` | `RUNNER_DISTANCE` | `{ distance: number, speed: number, lane: number }` | 每帧发出 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `input:touch:swipe` | 根据 data.direction (left/right) 切换车道 |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
start() 初始化
  → currentLane = Math.floor(laneCount / 2)
  → currentSpeed = speed

用户左滑 → emit('input:touch:swipe', { direction: 'left' })
  → Runner.handleSwipe()
    → currentLane > 0 → currentLane--
    → emit('runner:laneChange', { from, to, laneCount })
      → 渲染器播放切道动画
      → SoundFX 监听 → 播放切道音效

Runner.update() 每帧
  → speed += acceleration * dt
  → distance += speed * dt
  → emit('runner:distance', { distance, speed, lane })
    → Scorer 可按 distance 计分
    → 渲染器根据 speed 调整背景滚动速度
    → DifficultyRamp 可读取 distance 来调整难度
```

## 跨模块联动规则

### 与 Spawner 模块

Runner 游戏的障碍物和道具通常由 Spawner 生成：
- Spawner 的 `direction` 应设为 `'left'`（物体从右侧进入，模拟角色向前跑）
- Spawner 的 `speed` 应接近或等于 `Runner.currentSpeed`，保持相对静止或接近
- **动态调速**: 理想情况下，Spawner.speed 应随 Runner.currentSpeed 同步增长

### 与 Collision 模块

- Runner 管理车道逻辑，Collision 管理实际碰撞检测
- 碰撞规则: player vs obstacles → `collision:damage`，player vs coins → `collision:hit`
- 玩家碰撞体的 X 坐标应对应当前车道中心

### 与 Jump 模块

Runner 游戏中的跳跃（跳过障碍物）：
- Jump 模块独立管理 Y 轴跳跃
- Runner 管理 X 轴（车道切换）
- 两者正交，不冲突
- **常见组合**: swipe up → Jump, swipe left/right → Runner 切道

### 与 Gravity 模块

- 如果跑酷游戏有跳跃功能，需要 Gravity 配合 Jump
- 纯车道切换（无跳跃）的游戏不需要 Gravity

### 与 DifficultyRamp 模块

DifficultyRamp 可以根据 distance 或时间调整 Runner 和 Spawner 参数：

| 可调参数 | 策略 | 说明 |
|----------|------|------|
| Spawner.frequency | 每 10s 减少 0.1 | 增加障碍物密度 |
| Spawner.maxCount | 每 15s +1 | 增加屏幕上的障碍物数量 |
| Runner.acceleration | 不建议动态调整 | 速度增长应该是平滑曲线 |

**注意**: Runner 本身有内置的速度增长（acceleration），不需要 DifficultyRamp 额外调整速度。DifficultyRamp 主要负责调整障碍物生成参数。

### 与 Scorer 模块

计分方式选择：
- **距离计分**: 以 `runner:distance` 的 distance 值直接作为分数
- **道具计分**: `collision:hit` → Scorer 的 perHit 加分
- **混合计分**: 距离提供基础分，道具提供额外分

### 与 StaticPlatform / MovingPlatform

Runner 模块与平台模块通常**不同时使用**：
- Runner 是**车道制**（离散 X 位置），平台游戏是**自由移动制**
- 如果需要跑酷 + 平台跳跃的混合体（如 Geometry Dash），需要自定义集成
- 纯 Runner 模式不需要任何平台模块

## 输入适配

| 输入方式 | 左切道 | 右切道 | 跳跃（可选）| 特殊说明 |
|----------|--------|--------|-----------|---------|
| TouchInput | swipe left | swipe right | tap/swipe up | 最自然的跑酷控制 |
| FaceInput | head turn left | head turn right | mouth open | 延迟较高，需降低初始 speed |
| HandInput | swipe left gesture | swipe right gesture | gesture up | 适合体感游戏 |
| DeviceInput | tilt left | tilt right | shake | 适合手机体感 |
| AudioInput | — | — | — | 不适合跑酷类游戏 |

**跑酷游戏的特殊输入需求**:
- 切道操作必须是**低延迟**的（< 100ms），否则体验很差
- 在高速度时，输入延迟会直接导致来不及切道
- 建议: 非触摸输入的游戏降低 speed 20~30%

## 常见 Anti-Pattern

**acceleration 过高导致速度暴涨**
- 错误: `acceleration: 50` → 60s 后速度 = 300 + 50*60 = 3300 px/s → 完全不可反应
- 正确: acceleration <= 20，除非游戏设计时间很短（< 30s）

**没有速度上限**
- 当前实现: `currentSpeed` 没有上限（maxSpeed），会无限增长
- **问题**: 长时间游戏后速度超过渲染能力（一帧移动超过一个屏幕宽度）
- **建议**: 外部添加速度上限: `currentSpeed = min(currentSpeed, maxSpeed)`

**laneCount 偶数但初始车道不在中间**
- 4 车道时: `Math.floor(4/2) = 2`（第 3 车道，偏右）
- 不是 bug，但 4 车道游戏玩家可能期望从中间两车道之一开始
- 可以通过设置初始 lane 来覆盖

**Spawner 速度与 Runner 速度不同步**
- 错误: Runner.speed 在增长但 Spawner.speed 固定 → 障碍物相对变慢，游戏难度反而降低
- 正确: Spawner.speed 应随 Runner.currentSpeed 同步增长

**start() 不会自动调用**
- Runner 需要外部调用 `start()` 才开始跑步
- 不调用 start() → update() 直接返回，游戏不会开始
- 通常在 `gameflow:resume` 事件后由游戏管理器调用

**只监听 swipe，不支持其他输入方式的车道切换**
- 当前实现只硬编码了 `input:touch:swipe` 监听
- 使用其他输入方式时需要额外配置或让输入模块发出兼容的 swipe 事件

## 常见问题 & 边界情况

- `start()` 必须被外部调用，不会自动启动
- 初始车道 = `Math.floor(laneCount / 2)`，3 车道时是第 1 号（中间），5 车道时是第 2 号
- 车道切换是**即时的**（没有过渡动画），动画由渲染器处理
- 在最左（lane=0）时 swipe left 或最右（lane=laneCount-1）时 swipe right 无效，不发事件
- `runner:distance` 每帧发出，是高频事件。如果 Scorer 监听此事件来实时计分，注意性能
- `currentSpeed` 永远递增，没有内置最大速度限制
- `reset()` 将 started 设为 false，再次游戏需要重新调用 `start()`
- distance 是纯数值累加，不对应实际画布位置（渲染器可据此决定背景滚动）
- swipe up/down 方向不被处理（当前只响应 left/right）
- 没有"滑铲"（duck/slide）机制的内置支持，需要额外实现
- acceleration 使用真实时间递增（dt/1000），不受帧率影响
- 游戏暂停时（gameflowPaused），速度和距离不会继续增长
