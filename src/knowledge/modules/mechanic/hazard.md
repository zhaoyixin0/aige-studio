# Hazard — 危险物模块

## 基本信息
- 类型: mechanic
- 类名: `Hazard`
- 注册名: `Hazard`
- 文件: `src/engine/modules/mechanic/hazard.ts`
- 依赖: 无（独立运行）
- 可选联动: Collision, Lives, IFrames, Knockback, ParticleVFX, SoundFX

## 功能原理

Hazard 管理关卡中的危险物——固定或动态的伤害区域。与 Spawner 生成的临时物体不同，Hazard 是关卡的永久组成部分（如尖刺、锯片、岩浆坑），在关卡加载时初始化，不会被碰撞销毁。

**工作流程：**
1. `init()` 时从 `params.hazards` 数组构建 `HazardState[]`
2. 每帧根据 `pattern` 更新每个 Hazard 的位置:
   - `static`: 不移动
   - `oscillate`: 在 X 轴正弦振荡（`x + sin(t * speed/range) * range`）
   - `rotate`: 绕初始点圆周运动（`cos(angle)*range, sin(angle)*range`）
3. 提供 `checkCollision(px, py)` 方法进行矩形碰撞检测
4. 碰撞时发出 `collision:damage` 事件

**Hazard 与 Spawner 的区别：**

| 特征 | Hazard | Spawner |
|------|--------|---------|
| 生命周期 | 永久存在（关卡级） | 临时（生成 → 出界/碰撞后销毁） |
| 数量 | 固定（关卡设计时确定） | 动态（按频率持续生成） |
| 碰撞后行为 | 不销毁，持续伤害 | 通常销毁 |
| 碰撞方式 | 自带 checkCollision() | 通过 Collision 模块 |
| 运动模式 | static / oscillate / rotate | 单方向匀速移动 |
| IFrames 需求 | 必须（持续碰撞源） | 可选（碰撞后通常销毁） |

**危险物设计分类（游戏设计最佳实践）：**

| 类型 | 示例 | 伤害模式 | 当前支持 |
|------|------|---------|---------|
| 静态表面 | 尖刺、荆棘、岩浆地面 | 接触即伤害 | static pattern |
| 振荡障碍 | 左右移动的锯片 | 接触即伤害 | oscillate pattern |
| 旋转障碍 | 旋转的火球链 | 接触即伤害 | rotate pattern |
| 坠落物 | 从天花板掉落的石块 | 碰撞伤害 | 未支持（用 Spawner） |
| 射弹 | 固定炮台发射的子弹 | 碰撞伤害 | 未支持（用 Spawner） |
| 区域效果 | 毒雾、电场 | 持续伤害/s | 未支持 |
| 陷阱 | 消失的地板、弹射器 | 间接致死 | 未支持（用 CrumblingPlatform） |
| 即死坑 | 无底洞、岩浆池 | 一碰即死 | static + damage=MAX |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| hazards | object (HazardDef[]) | `[]` | — | 至少 1 个 | 危险物定义数组 |
| damage | range | `1` | 1 ~ 10，步长 1 | 1 ~ 3 | 碰撞伤害值 |
| damageEvent | string | `'collision:damage'` | 任意事件名 | `collision:damage` | 碰撞时发出的事件名 |
| layer | string | `'hazards'` | — | `hazards` | 碰撞图层名（预留，当前未用于 Collision 模块） |
| asset | asset | `''` | — | — | 危险物素材 |
| oscillateSpeed | range | `100` | 0 ~ 500，步长 1 | 50 ~ 200 | 振荡/旋转速度 |
| oscillateRange | range | `100` | 0 ~ 300，步长 1 | 50 ~ 150 | 振荡/旋转幅度（px） |

### HazardDef 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| x | number | 是 | 初始 X 坐标（px） |
| y | number | 是 | 初始 Y 坐标（px） |
| width | number | 是 | 碰撞宽度（px） |
| height | number | 是 | 碰撞高度（px） |
| pattern | `'static'` / `'oscillate'` / `'rotate'` | 是 | 运动模式 |

### 不同游戏类型的参数推荐

| 游戏类型 | damage | pattern | oscillateSpeed | oscillateRange | 设计理由 |
|----------|--------|---------|----------------|---------------|---------|
| platformer (标准) | 1 | static + oscillate 混合 | 80 ~ 120 | 80 ~ 120 | 经典平台关卡 |
| platformer (Mega Man) | 2 ~ 4 | static | — | — | 高伤害尖刺 |
| platformer (一碰即死) | 999 | static | — | — | Celeste 风格尖刺 |
| platformer (动态) | 1 | oscillate + rotate | 100 ~ 200 | 100 ~ 200 | 复杂运动模式 |
| runner | 1 | static | — | — | 固定障碍物 |
| dodge | 不适用 | — | — | — | dodge 用 Spawner 而非 Hazard |

### 运动模式详解

**Static（静态）：**
```
位置不变: (currentX, currentY) = (def.x, def.y)
```
尖刺、岩浆池、带电栅栏等固定危险物。

**Oscillate（振荡）：**
```
currentX = def.x + sin(elapsed * speed / range) * range
currentY = def.y  (不变)
```
左右移动的锯片、上下跳动的火焰柱。

| speed | range | 振荡周期 | 最大速度 | 手感 |
|-------|-------|---------|---------|------|
| 50 | 50 | ~6.3s | 50 px/s | 缓慢摆动 |
| 100 | 100 | ~6.3s | 100 px/s | 标准 |
| 200 | 100 | ~3.1s | 200 px/s | 快速 |
| 200 | 200 | ~6.3s | 200 px/s | 大范围快速 |

振荡角频率 = speed / range (rad/s)，周期 = 2π * range / speed (s)

**Rotate（旋转）：**
```
angle = elapsed * speed / range
currentX = def.x + cos(angle) * range
currentY = def.y + sin(angle) * range
```
绕中心旋转的火球链、旋转锯片。旋转半径 = range，角速度 = speed / range。

## 参数调优指南

### damage 与 Lives.count 的关系

```
容错次数 = Lives.count / Hazard.damage
```

| Lives.count | Hazard.damage | 容错次数 | 适合 |
|-------------|---------------|---------|------|
| 5 | 1 | 5 次 | 休闲/标准 |
| 5 | 2 | 2 次 | 中等难度 |
| 3 | 1 | 3 次 | 经典街机 |
| 1 | 1 (或 999) | 1 次 | 一碰即死 |

### 即死坑设计

对于无底洞/岩浆池等即死陷阱：
- 设置 `damage` 等于或大于 `Lives.count`（如 `damage: 999`）
- 或使用特殊 damageEvent（如 `collision:instant-kill`）让 Lives 直接归零
- 配合 Checkpoint 系统，玩家死亡后从最近存档点重生

### oscillateSpeed 与 oscillateRange 的配合

```
最大线速度 = speed (px/s)  // 振荡时近似
安全通过窗口 ≈ range * 2 / speed (s)  // 从一端到另一端的时间
```

- 窗口 > 1s: 从容通过（休闲）
- 窗口 0.5 ~ 1s: 需要把握时机（标准）
- 窗口 < 0.5s: 极难精确通过（硬核）

### Hazard 布局与关卡设计

**垂直间距**: 尖刺之间的间隙应 >= 玩家碰撞体高度 * 1.5（安全通过）
**水平间距**: 移动 Hazard 之间留出玩家宽度 * 2 的安全区
**组合模式**:
- 静态 + 静态: 需要精确跳跃/移动通过间隙
- 静态 + 振荡: 需要观察节奏 + 精确移动
- 振荡 + 旋转: 高难度组合，需要同时观察多个运动模式

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `{damageEvent}` | — | `{ damage: number, x: number, y: number }` | `checkCollision()` 检测到碰撞时 |

默认 damageEvent = `collision:damage`，与 Collision 模块发出的事件名一致。

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复 update（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停 update（BaseModule 统一处理） |

### 事件流转示意

```
[碰撞检测方式 — 由外部每帧调用]
PixiRenderer / PhysicsManager 每帧:
  → 获取玩家位置 (px, py)
  → 调用 hazard.checkCollision(px, py)
    → 若碰撞:
      → emit('collision:damage', { damage: 1, x: px, y: py })
        → IFrames: 激活无敌帧
        → Lives: 减血
        → Knockback: 击退
        → ParticleVFX: 受伤特效
        → SoundFX: 受伤音效
```

**注意**: Hazard 使用自己的矩形碰撞检测（`checkCollision()`），不通过 Collision 模块的圆形碰撞系统。这意味着：
- Hazard 碰撞与 Collision 碰撞是两套独立系统
- 需要外部代码每帧调用 `checkCollision()`
- `layer` 参数目前未被 Collision 模块使用

## 跨模块联动规则

### 与 IFrames 的关键联动

**Hazard 是持续碰撞源** — 如果玩家站在尖刺上，每帧都会调用 `checkCollision()` 并返回 true。没有 IFrames，每帧都会发出 `collision:damage`，生命值瞬间耗尽。

```
无 IFrames:
  Frame 1: checkCollision → damage → Lives: 3→2
  Frame 2: checkCollision → damage → Lives: 2→1
  Frame 3: checkCollision → damage → Lives: 1→0 → GAME OVER
  (50ms 内死亡)

有 IFrames (1000ms):
  Frame 1: checkCollision → damage → Lives: 3→2, IFrames 激活
  Frame 2~59: checkCollision → damage → IFrames active → 忽略
  Frame 60: IFrames 结束
  Frame 61: checkCollision → damage → Lives: 2→1, IFrames 再次激活
  ...
```

**关键**: 使用 Hazard 时**必须**配合 IFrames，除非设计为一碰即死。

### 与 Knockback 的联动

- Knockback 将玩家推离 Hazard → 物理分离
- 确保 `knockback.force` 足以将玩家推出 Hazard 的碰撞区域
- 所需最小 force: `hazard.width / (knockback.duration / 1000) / 2`

### 与 Collision 模块的关系

当前实现中 Hazard 和 Collision 是两个独立的碰撞系统:

| 对比 | Hazard | Collision |
|------|--------|-----------|
| 碰撞形状 | 矩形（AABB） | 圆形 |
| 检测方式 | 外部手动调用 | 每帧自动检测 |
| 对象管理 | 内部 HazardState[] | 外部 registerObject/unregisterObject |
| 销毁行为 | 不销毁 | 可配置 destroy |

**统一方案**: 未来可以将 Hazard 注册到 Collision 模块的 `hazards` 图层，使用统一的碰撞检测。需要:
1. Hazard.init() 中将每个 hazard 注册到 Collision（`registerObject`）
2. Hazard.update() 中同步位置到 Collision（`updateObject`）
3. 在 Collision 中添加矩形碰撞支持（当前仅支持圆形）

### 与 StaticPlatform / MovingPlatform 的关系

- Hazard 和 Platform 都是关卡级物体
- 常见组合: 平台表面放置尖刺（platform.y - hazard.height = hazard.y）
- 移动平台上的 Hazard 需要跟随平台移动（当前不支持）

### 与 Checkpoint 的关系

- 一碰即死的 Hazard（damage >= Lives.count）需要 Checkpoint
- 玩家死亡后从 Checkpoint 重生而非重新开始
- 确保 Checkpoint 位置在 Hazard 之前

## 输入适配

Hazard 本身不依赖输入方式，但碰撞区域大小应根据输入精度调整：

| 输入方式 | Hazard 碰撞区域调整 | 理由 |
|----------|-------------------|------|
| TouchInput | 标准 | 精确控制 |
| FaceInput | width/height 缩小 15% ~ 20% | 追踪延迟降低精度 |
| HandInput | width/height 缩小 10% ~ 15% | 手势追踪有抖动 |
| DeviceInput | width/height 缩小 15% ~ 25% | 陀螺仪控制不精确 |
| AudioInput | 不适用 | — |

## 常见 Anti-Pattern

**未配合 IFrames 导致瞬间死亡**
- 错误: 玩家碰到 Hazard 后每帧 checkCollision 都返回 true → 几帧内生命耗尽
- 正确: Hazard 场景必须使用 IFrames，且上层代码在 `iframes.isActive()` 时跳过 checkCollision

**oscillate 参数导致 Hazard 移出屏幕**
- 错误: `x: 500, oscillateRange: 600` → Hazard 移动范围 -100 ~ 1100，超出画布
- 正确: 确保 `x - oscillateRange >= 0` 且 `x + oscillateRange <= canvasWidth`

**hazards 数组为空**
- 错误: `hazards: []` → 模块存在但无任何 Hazard → 浪费资源
- 正确: 不需要 Hazard 就不要添加此模块

**damage 值与 Lives 系统不匹配**
- 错误: `hazard.damage: 5`, `lives.count: 3` → 第一次碰撞就死亡，IFrames 无意义
- 正确: 对于多次碰撞设计，`hazard.damage < lives.count`

**checkCollision 使用点碰撞但玩家有碰撞半径**
- 当前实现: `checkCollision(px, py)` 只检测单点 → 不考虑玩家碰撞体大小
- 正确: 应该用 `px +/- playerRadius` 扩展检测范围，或改用 AABB vs Circle 碰撞
- 这是当前实现的已知限制

**static Hazard 使用了 oscillateSpeed/oscillateRange**
- 错误: 全局 oscillateSpeed=200 但大部分 Hazard 是 static → 参数浪费
- 正确: oscillateSpeed/oscillateRange 只对 `oscillate` 和 `rotate` pattern 生效，static 忽略这些参数

## 常见问题 & 边界情况

- `buildStates()` 对每个 HazardDef 做浅拷贝（`{ ...def }`），修改 state 不影响原始配置
- 振荡使用 `Math.sin(elapsed * speed / range) * range`，角频率 = speed/range
- `checkCollision()` 是点检测（单点 px, py），不考虑玩家碰撞体大小
- `checkCollision()` 在碰撞时立即发出 damageEvent，由调用方控制调用频率
- `getHazardPositions()` 返回新数组和新对象，外部修改不影响内部状态
- `reset()` 重新调用 `buildStates()`，恢复所有 Hazard 到初始位置
- `gameflowPaused` 时 update 不执行 → 振荡/旋转 Hazard 暂停移动
- `elapsed` 使用秒为单位（`dt / 1000`），而非其他模块常用的毫秒
- Hazard 没有 getDependencies() 覆写 → 默认 requires: [], optional: []
- 当 dt 极大（tab 切回）时，振荡/旋转位置可能大幅跳变
- 碰撞事件中 `(x, y)` 是玩家坐标（传入的 px, py），不是碰撞中点
