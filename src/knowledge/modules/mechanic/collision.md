# Collision — 碰撞检测模块

## 基本信息
- 类型: mechanic
- 类名: `Collision`
- 注册名: `Collision`
- 文件: `src/engine/modules/mechanic/collision.ts`

## 功能原理

Collision 是 AIGE Studio 的碰撞检测核心，使用**圆形碰撞体（Circle Collider）**在每帧检测物体间的重叠。

**工作流程：**
1. 各模块通过 `registerObject(id, layer, { x, y, radius })` 注册碰撞体到指定图层
2. 每帧遍历所有碰撞规则（rules），按规则中的图层 a/b 收集对应物体
3. 对图层 a 和图层 b 的物体做笛卡尔积检测（O(n*m) 暴力遍历）
4. 碰撞判定: `distance(a, b) < a.radius + b.radius`（两圆心距离 < 半径之和）
5. 碰撞发生时：
   - 计算碰撞点（两物体中点）
   - 发出 `collision:{rule.event}` 事件，携带双方 ID、图层、碰撞坐标
   - 按 `rule.destroy` 配置标记物体待销毁
6. 所有规则检测完毕后，批量删除标记的物体
7. 同一帧内，已被标记销毁的物体不会再触发后续碰撞

**碰撞检测算法特点：**
- 暴力遍历，无空间分区优化（Grid / QuadTree）
- 每帧执行，不依赖 dt（纯位置检测，非连续碰撞检测）
- 不处理碰撞响应（弹开、滑动等），仅触发事件
- targetId 始终为 objectB（规则中 b 图层的对象）

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| rules | collision-rules | `[]` | 至少 1 条规则 | 碰撞规则数组 |

### 碰撞规则结构 (CollisionRule)

| 字段 | 类型 | 必填 | 有效值 | 说明 |
|------|------|------|--------|------|
| a | string | 是 | 任意图层名 | 图层A名称（通常是主动方，如 `'player'`） |
| b | string | 是 | 任意图层名，且 a !== b | 图层B名称（通常是被动方，如 `'items'`） |
| event | string | 是 | 英文标识符 | 碰撞事件后缀，完整事件名为 `collision:{event}` |
| destroy | string[] | 否 | `[]`, `['a']`, `['b']`, `['a','b']` | 碰撞后销毁哪一方，空数组或不填表示不销毁 |

### 碰撞体结构 (CollisionObject)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识符（如 `'player_1'`, `'spawn-42'`） |
| layer | string | 所属图层名（如 `'player'`, `'items'`, `'collectibles'`） |
| x | number | 碰撞体中心 x 坐标（px） |
| y | number | 碰撞体中心 y 坐标（px） |
| radius | number | 碰撞体半径（px） |

### 碰撞半径设定指南

碰撞半径直接影响游戏手感（Game Feel）。业界最佳实践如下：

| 角色/物体 | 碰撞半径建议 | 说明 |
|-----------|-------------|------|
| 玩家（catch 类） | spriteSize * 0.6~0.75 | 大于视觉让接住更容易 |
| 玩家（dodge 类） | spriteSize * 0.35~0.45 | 小于视觉让躲避更宽容 |
| 玩家（tap/shooting） | 点击半径 25~35px | 固定值匹配手指精度 |
| 掉落物（catch） | spriteSize * 0.4~0.5 | 略小于视觉，配合玩家大碰撞体 |
| 障碍物（dodge） | spriteSize * 0.35~0.45 | 缩小让擦边躲过的爽快感 |
| 目标（shooting） | spriteSize * 0.5~0.6 | 适中，太大无挑战太小太难 |

**核心原则（来自 N++、Touhou 等经典游戏的设计经验）：**
- 对玩家有利的碰撞（catch）→ 碰撞体偏大
- 对玩家不利的碰撞（dodge/damage）→ 碰撞体偏小
- 这种"不对称宽容度"是休闲游戏好手感的关键

**当前实现的限制：**
- AutoWirer 设置物体碰撞半径 = `spriteSize / 2`（1:1 对应视觉大小）
- 渲染器设置玩家碰撞半径 = `playerSize / 2`（catch/dodge）或固定 30px（tap）
- 没有 per-rule 或 per-layer 的半径缩放因子

## 事件协议

### 发出事件

| 事件名 | 数据结构 | 触发条件 |
|--------|----------|---------|
| `collision:{rule.event}` | `CollisionPayload` | 两个碰撞体重叠时 |

**CollisionPayload 结构：**
```typescript
{
  objectA: string;   // 图层A的物体ID
  objectB: string;   // 图层B的物体ID
  layerA: string;    // 规则中的图层A名称
  layerB: string;    // 规则中的图层B名称
  targetId: string;  // 始终等于 objectB（被动方）
  x: number;         // 碰撞点x（两物体中点）
  y: number;         // 碰撞点y（两物体中点）
}
```

**常见事件名实例：**

| 事件名 | event 字段 | 使用场景 |
|--------|-----------|---------|
| `collision:hit` | `hit` | catch/tap/shooting/rhythm — 积极碰撞，触发得分 |
| `collision:damage` | `damage` | dodge/runner/platformer — 消极碰撞，触发扣血 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:resume` | 恢复碰撞检测（BaseModule 统一处理） |
| `gameflow:pause` | 暂停碰撞检测（BaseModule 统一处理） |

### 完整事件链路

```
[catch 类游戏]
collision:hit
  → Spawner 监听 → removeObject(targetId) → spawner:destroyed
  → Scorer 监听 → 加分 → scorer:update
  → ParticleVFX 监听 → 在 (x, y) 播放特效
  → SoundFX 监听 → 播放音效

[dodge 类游戏]
collision:damage
  → Spawner 监听 → removeObject(targetId) → spawner:destroyed
  → Lives 监听 → 减生命 → lives:change (→ lives:zero → gameflow:state)
  → ParticleVFX 监听 → 在玩家位置播放爆炸特效
  → SoundFX 监听 → 播放受伤音效

[platformer 类游戏]
collision:hit (玩家 vs 收集品)
  → Collectible 监听 → 标记已拾取
  → Scorer → 加分

collision:damage (玩家 vs 危害物)
  → IFrames 检查 → 如果在无敌帧内则忽略
  → Lives → 减生命
  → Knockback → 击退玩家
```

## 跨模块联动规则

### 与 Spawner 组合（通过 AutoWirer 自动连线）

**自动行为（AutoWirer 处理）：**
- `spawner:created` → 自动 `registerObject(id, 'items', { x, y, radius: spriteSize/2 })`
- `spawner:destroyed` → 自动 `unregisterObject(id)`
- `collision:hit` → Spawner 自动 `removeObject(targetId)`

**关键联动参数：**

| Spawner 参数 | 影响 Collision 的方面 | 联动规则 |
|-------------|---------------------|---------|
| spriteSize | 碰撞半径 = spriteSize / 2 | 改大 spriteSize → 碰撞半径变大 → 更容易碰到 |
| maxCount | 碰撞检测对数 = maxCount * 1 (单玩家) | maxCount > 20 时碰撞检测开销显著 |
| speed | 隧穿风险 | speed > 600 + 帧率低时，物体可能穿过碰撞体（无 CCD） |
| frequency | 间接影响碰撞频率 | frequency 低 → 物体多 → 碰撞检测频繁 |

### 与 DifficultyRamp 组合

DifficultyRamp 不直接修改 Collision 参数，但通过修改 Spawner 间接影响：
- Spawner frequency 降低 → 物体更密 → 碰撞更频繁
- Spawner maxCount 增加 → 碰撞检测对数增加 → 性能压力增大

**建议**: DifficultyRamp 调整 Spawner 参数时，确保 `maxCount * 玩家数 <= 200`（碰撞检测对数上限）

### 与 Lives 组合

- `collision:damage` → Lives 监听并减生命
- rules 中 `event: 'damage'` 专用于扣血类碰撞
- `destroy: ['b']` 通常在 damage 规则中设置（障碍物碰后消失）
- 也可设置 `destroy: []`（障碍物不消失，持续伤害——需配合 IFrames）

### 与 IFrames 组合

- IFrames 模块在玩家受伤后提供无敌时间
- **当前实现无 IFrames 集成**：Collision 模块不检查 IFrames 状态
- 需要在碰撞后由 Lives 或上层逻辑检查 `iframes.isActive()` 来决定是否真正扣血

### 与 ParticleVFX / SoundFX 组合

- 碰撞事件携带 `(x, y)` 坐标，ParticleVFX 在此位置播放特效
- 确保 ParticleVFX 配置中的事件名与 Collision 的 `collision:{event}` 匹配

### 与输入模块组合

所有输入模块（Face/Hand/Touch/Device/Audio）更新玩家位置后，渲染器同步调用 `collision.updateObject('player_1', { x, y, radius })` 更新玩家碰撞体。

## 输入适配

Collision 本身不需要针对输入方式修改参数，但碰撞**半径**应根据输入精度调整：

### TouchInput（触摸输入）
- **catch/dodge**: 玩家碰撞半径 = playerSize / 2（标准）
- **tap**: 玩家碰撞半径固定 30px（匹配手指点击范围）
- 触摸精度高，碰撞半径可以保持标准值

### FaceInput（面部追踪）
- 面部追踪有 smoothing 延迟（30~50ms），位置更新滞后
- **建议**: 玩家碰撞半径增大 20%~30%，补偿追踪延迟
- **建议**: dodge 类中障碍物碰撞半径缩小 10%~20%，提高宽容度

### HandInput（手势输入）
- 手势追踪精度优于面部，但有边缘抖动
- **建议**: 玩家碰撞半径增大 10%~15%
- **建议**: spawnArea 避开画布边缘 15%（手势追踪边缘不稳定区域）

### DeviceInput（设备传感器）
- 陀螺仪控制有延迟和飘移
- **建议**: 玩家碰撞半径增大 15%~25%
- **建议**: dodge 类中障碍物碰撞半径缩小 15%

### AudioInput（声音输入）
- 不直接控制位置，通常不影响碰撞配置
- 可用于触发特殊碰撞规则（如吹气激活护盾，改变碰撞行为）

## 常见 Anti-Pattern

**碰撞规则中 a 和 b 使用相同图层**
- 错误: `{ a: 'items', b: 'items', event: 'hit' }` → 物体互相碰撞，但 `objA.id === objB.id` 跳过自碰只适用于同一物体，不同物体之间会大量碰撞
- 正确: 确保 a 和 b 是不同语义的图层（如 `player` vs `items`）

**destroy 配置错误导致玩家被销毁**
- 错误: `{ a: 'player', b: 'items', event: 'hit', destroy: ['a'] }` → 碰撞后玩家被从碰撞系统移除
- 正确: catch 类使用 `destroy: ['b']`（销毁物品），dodge 类使用 `destroy: ['b']` 或 `destroy: []`

**碰撞半径为 0 或负数**
- 错误: `registerObject(id, layer, { x, y, radius: 0 })` → 永远不会碰撞
- 正确: radius 最小应为 5~10px

**遗忘 unregisterObject 导致幽灵碰撞**
- 错误: 物体被视觉移除但未从 Collision 注销 → 不可见的碰撞体仍会触发碰撞
- 正确: 每次物体销毁时确保调用 `unregisterObject(id)`；AutoWirer 已自动处理 Spawner 的情况

**rules 数组为空**
- 错误: `rules: []` → 碰撞模块存在但不做任何检测，浪费资源
- 正确: 至少配置 1 条规则；不需要碰撞检测就不要添加 Collision 模块

**多条规则覆盖相同图层对导致重复事件**
- 错误: 同时存在 `{ a: 'player', b: 'items', event: 'hit' }` 和 `{ a: 'player', b: 'items', event: 'damage' }` → 同一次碰撞触发两个事件
- 正确: 每对图层只配一条规则；如需区分好坏物体，用不同图层（如 `goods` vs `bads`）

**高速物体穿透（隧穿效应）**
- 错误: speed > 600px/s，碰撞半径 < 24px，帧率 30fps → 物体每帧移动 20px，可能跳过碰撞体
- 正确: 确保 `speed * (1/fps) < radius_a + radius_b`；或降低 speed；或增大碰撞半径
- 公式: 安全最大速度 = (radius_a + radius_b) * fps

**碰撞事件中 targetId 始终是 objectB**
- 错误: 假设 targetId 是"被碰撞的物体"（可能是玩家）
- 正确: targetId 始终是规则中 b 图层的对象。如果 `a: 'player', b: 'items'`，则 targetId 是物品 ID

## 常见问题 & 边界情况

- 碰撞检测复杂度为 O(n*m)（图层A物体数 * 图层B物体数），大量物体时注意性能
- 同一个物体不会与自身碰撞（`objA.id === objB.id` 跳过）
- 已被标记销毁的物体在同一帧内不会再触发碰撞（`toDestroy.has()` 检查）
- `targetId` 始终指向 objectB（规则中 b 图层的对象）
- 碰撞体为圆形，不支持矩形或多边形碰撞——对于方形物体，圆形碰撞体会在角落产生误差
- `registerObject(id, layer, { x, y, radius })` 注册碰撞体
- `updateObject(id, { x, y })` 更新碰撞体位置（可选更新 radius）
- `unregisterObject(id)` 取消注册
- `reset()` 清空所有已注册对象
- 碰撞检测是离散的（每帧一次），不支持连续碰撞检测（CCD），高速物体可能穿透
- 碰撞点 (x, y) 是两物体中点，非精确接触点
- 没有碰撞分离/推出机制，两个物体重叠后不会自动分开
- `updateObject()` 直接修改内部对象属性（可变操作），无需创建新对象
- 碰撞规则按数组顺序执行，同一帧内前面的规则可能先标记物体销毁，导致后面的规则跳过该物体

## 性能参考

| 场景 | 图层A物体数 | 图层B物体数 | 碰撞对数/帧 | 预期影响 |
|------|-----------|-----------|------------|---------|
| 轻量 | 1 (player) | 5~8 (items) | 5~8 | 忽略不计 |
| 中等 | 1 (player) | 10~15 | 10~15 | 可忽略 |
| 较重 | 1 (player) | 20~30 | 20~30 | 轻微影响 |
| 多规则 | 1+5 (player+bullets) | 10+10 (items+enemies) | 60+ | 需要关注 |
| 危险 | 10 (bullets) | 50 (enemies) | 500 | 需要空间分区优化 |

**优化建议**（当碰撞对数 > 100 时）：
1. 减少 maxCount（最直接）
2. 增大物体碰撞半径减少重叠检查次数（不推荐，影响手感）
3. 未来可添加空间分区（Grid Partitioning）优化，将 O(n*m) 降至 O(n+m)

## 图层命名约定

| 图层名 | 用途 | 常见规则组合 |
|--------|------|------------|
| `player` | 玩家碰撞体 | a: player |
| `items` | Spawner 生成的物体 | b: items |
| `collectibles` | 收集品（platformer） | b: collectibles |
| `hazards` | 危害物（platformer） | b: hazards |
| `bullets` | 子弹（shooting） | a: bullets |
| `platforms` | 平台（platformer） | 通常不通过 Collision 模块 |
| `enemies` | 敌人（未来 Batch 2） | b: enemies |
