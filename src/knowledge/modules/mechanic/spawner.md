# Spawner — 物体生成器模块

## 基本信息
- 类型: mechanic
- 类名: `Spawner`
- 注册名: `Spawner`
- 文件: `src/engine/modules/mechanic/spawner.ts`

## 功能原理

Spawner 是 AIGE Studio 中最核心的 mechanic 模块之一，负责在游戏运行期间按固定频率在指定区域内生成游戏物体。

**工作流程：**
1. 每帧累加 `spawnTimer`，当 `spawnTimer >= frequency * 1000` 且当前物体数 < `maxCount` 时触发生成
2. 从 `items` 列表中按 weight 加权随机选取一个素材
3. 在 `spawnArea` 矩形范围内随机确定初始坐标 (x, y)
4. 根据 `speed.min` ~ `speed.max` 随机分配速度
5. 确定运动方向（固定方向或 random 逐个随机）
6. 创建 `SpawnedObject` 并加入内部数组，发出 `spawner:created` 事件
7. 每帧按 speed 和 direction 移动所有物体，超出画布 100px 缓冲区时自动销毁
8. 监听 `collision:hit` 事件，收到后按 `targetId` 移除对应物体

**关键实现细节：**
- 计时器使用减法重置（`spawnTimer -= frequency`），而非归零，保证长期频率精确
- 物体移动直接修改 `SpawnedObject` 的 x/y（引擎内部可变，外部通过 `getObjects()` 返回浅拷贝）
- 出界缓冲区固定为 100px（四个方向），确保物体完全离开视口后才销毁
- `spawnCounter` 是模块级变量（非实例级），在游戏重启时不会重置，避免 ID 冲突

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 危险值 | 说明 |
|------|------|--------|----------|--------|------|
| items | asset[] | `[]` | 至少 1 项 | 空数组导致不生成任何物体 | 生成物体列表，每项 `{ asset: string, weight: number }`，weight 默认 1 |
| speed | object | `{ min: 100, max: 200 }` | min >= 0, max >= min | min > max 导致负速度；max > 800 在手机上难以反应 | 物体速度范围（px/s） |
| frequency | range | `1.5` | `0.3 ~ 5`，步长 0.1 | < 0.3 会导致屏幕拥挤；> 3 会让玩家无聊 | 生成间隔（秒） |
| spawnArea | rect | `{ x: 0, y: 0, width: 800, height: 0 }` | x/y >= 0, width/height >= 0 | width=0 导致所有物体在同一 x 坐标生成；超出画布范围的区域会导致物体生成在不可见区域 | 生成区域矩形 |
| direction | select | `'down'` | `down / up / left / right / random` | — | 物体运动方向 |
| maxCount | number | `10` | `1 ~ 50` | > 30 在低端设备上可能掉帧；= 1 导致场面空旷 | 同时存在的最大物体数 |
| rotation | boolean | `false` | — | — | 是否启用旋转动画 |
| rotationSpeed | range | `0` | `0 ~ 10`，步长 0.1 | > 5 视觉上令人晕眩 | 旋转速度（弧度/秒），仅当 rotation=true 时生效 |
| spriteSize | range | `48` | `16 ~ 128`，步长 4 | < 24 在手机上看不清；> 96 遮挡大量屏幕面积 | 素材渲染大小（px），同时决定碰撞半径 |

## 参数调优指南

### 画布尺寸适配

| 画布 | spawnArea.width | spriteSize | maxCount | speed.max | frequency |
|------|----------------|------------|----------|-----------|-----------|
| 1080x1920 (竖屏标准) | 920 (留 80px 边距) | 48~64 | 8~12 | 200~350 | 1.0~1.5 |
| 720x1280 (低分辨率) | 620 (留 50px 边距) | 36~48 | 6~10 | 150~280 | 1.2~1.8 |
| 800x600 (横屏) | 700 | 40~56 | 5~8 | 150~250 | 1.0~1.5 |

**核心公式：**
- 边距 = spriteSize 的 1~2 倍（避免物体贴边生成被截断）
- spawnArea.x = 边距
- spawnArea.width = 画布宽度 - 2 * 边距

### 不同游戏类型的推荐参数

| 游戏类型 | frequency | speed | maxCount | direction | spriteSize | 说明 |
|----------|-----------|-------|----------|-----------|------------|------|
| catch | 1.0~1.5 | 200~300 | 5~8 | down | 48~64 | 中速下落，留反应时间 |
| dodge | 0.8~1.2 | 150~350 | 6~12 | down | 40~56 | 更密集更快，制造压力 |
| tap | 0.8~1.2 | 0 | 6~10 | down | 48~64 | speed=0 静止靶标 |
| shooting | 0.8~1.0 | 100~250 | 5~8 | random | 40~56 | 多方向移动增加难度 |
| runner | 0.8~1.0 | 200~350 | 8~12 | left | 48~64 | 物体从右侧进入 |
| rhythm | 0.4~0.6 | 300 | 8~12 | down | 32~48 | 固定速度匹配 BPM |
| world-ar | 1.5~2.5 | 0 | 3~5 | down | 56~80 | 慢速/静止，大尺寸 |

### 参数间的关联关系

1. **frequency vs maxCount**: 实际屏幕密度 = maxCount / (频率 * 平均物体存活时间)。如果 maxCount 太小而 frequency 太快，实际生成速率受 maxCount 限制
2. **speed vs frequency**: 物体存活时间 ≈ 画布高度 / speed。若存活时间 < frequency，屏幕上永远只有 1 个物体
3. **spriteSize vs spawnArea**: spriteSize 大时要缩小 spawnArea 的 width，避免物体贴边被截断
4. **speed.min vs speed.max**: 差距越大，物体速度越不均匀，增加混乱感。catch 类建议差距不超过 1.5x，dodge 类可以更大

### 屏幕覆盖率参考

- **舒适密度**: 屏幕面积的 3%~8% 被物体覆盖
- **高压密度**: 8%~15%（dodge 类后期）
- **过饱和**: > 15%，玩家会感到无法应对
- 计算: `覆盖率 = (maxCount * spriteSize^2 * π/4) / (canvasWidth * canvasHeight)`

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `spawner:created` | `SPAWNER_CREATED` | `{ id: string, asset: string, x: number, y: number }` | 成功生成新物体时 |
| `spawner:destroyed` | `SPAWNER_DESTROYED` | `{ id: string }` | 物体出界被自动销毁时；或物体被 `removeObject()` 移除时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `gameflow:resume` | `GAMEFLOW_RESUME` | 设置 `gameflowPaused = false`，恢复生成和移动（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 设置 `gameflowPaused = true`，暂停生成和移动（BaseModule 统一处理） |
| `collision:hit` | `COLLISION_HIT` | 通过 `data.targetId` 移除被击中的物体 |

### 事件流转示意

```
Spawner.spawn()
  → emit('spawner:created', { id, asset, x, y })
  → AutoWirer 监听 → Collision.registerObject(id, 'items', { x, y, radius })

Spawner.update() 每帧
  → 物体出界 → emit('spawner:destroyed', { id })
  → AutoWirer 监听 → Collision.unregisterObject(id)

Collision.update()
  → 检测碰撞 → emit('collision:hit', { targetId, ... })
  → Spawner 监听 → removeObject(targetId)
  → emit('spawner:destroyed', { id })
```

## 跨模块联动规则

### 与 Collision 组合（核心联动）

- **碰撞半径 = spriteSize / 2**: 由 AutoWirer 在 `spawner:created` 事件中自动计算
- **重要**: Spawner 的 `spriteSize` 同时决定视觉大小和碰撞半径，修改 `spriteSize` 会同时影响两者
- **hitbox 容差建议**: 当前实现中碰撞半径 = 视觉半径（1:1），对于 catch 类游戏偏严格。业界最佳实践：
  - catch 类: 碰撞半径 = spriteSize * 0.6~0.75（让玩家更容易接到）
  - dodge 类: 碰撞半径 = spriteSize * 0.4~0.5（让玩家更容易躲开）
  - tap 类: 碰撞半径 = spriteSize * 0.5~0.6（匹配点击精度）
- **碰撞层**: 生成的物体自动注册到 `'items'` 层，玩家在 `'player'` 层

### 与 DifficultyRamp 组合

DifficultyRamp 可通过 `target: 'spawner_1'` 动态修改以下字段：

| 可调参数 | 典型调整 | 安全范围 | 说明 |
|----------|---------|----------|------|
| frequency | 每 10s 减少 0.1~0.2 | min: 0.3~0.5 | 加快生成速度 |
| maxCount | 每 15s 增加 1~2 | max: 15~20 | 增加屏幕密度 |
| speed.min / speed.max | 不支持（DifficultyRamp 只能调顶层字段） | — | 需要修改 DifficultyRamp 支持嵌套路径 |

**注意**: DifficultyRamp 的 `field` 只支持顶层参数名。`speed` 是嵌套对象，当前无法用 `field: 'speed.min'` 来调整。

### 与 Scorer 组合

- `collision:hit` → Scorer 通过 `perHit` 加分
- `spawner:destroyed`（物体出界）→ Scorer 通过 `deductOnMiss` 扣分
- catch 类: `perHit: 10`, `deductOnMiss: true`
- dodge 类: `perHit: 0`, `scorePerSecond: 10`（存活计分）

### 与 ComboSystem 组合

- combo 窗口应 > 平均两次碰撞间隔（= frequency * 0.8）
- frequency=1.0 时，comboWindow 建议 >= 1200ms

### 与 Lives 组合

- dodge 类: `collision:damage` → Lives 减少
- catch 类: `spawner:destroyed`（物体出界漏接）→ 可选扣生命

## 输入适配

不同输入方式下，Spawner 参数需要做以下调整：

### TouchInput（触摸输入）
- **catch/dodge**: 玩家位置锁定在屏幕底部 85%，Spawner 从顶部生成，direction='down'
- **tap**: speed 设为 0（静止靶标），spawnArea 覆盖全屏中央区域
- **shooting**: 类似 tap，但物体有缓慢移动
- 建议 speed 偏低（200~300），因为触摸拖动有延迟

### FaceInput（面部追踪）
- 玩家位置映射到全屏范围，spawnArea 需要覆盖更大区域
- **建议**: speed 降低 20%（面部追踪有 smoothing 延迟）
- **建议**: spriteSize 增大 10~20%（面部控制精度低于手指）
- frequency 可适当放慢（面部控制反应速度慢于手指）

### HandInput（手势输入）
- 类似 FaceInput，但精度更高
- **建议**: speed 降低 10%
- **建议**: spriteSize 维持标准
- spawnArea 建议覆盖画布中央 70% 区域（手势追踪边缘不稳定）

### DeviceInput（设备传感器）
- 陀螺仪/加速度计控制玩家位置
- **建议**: speed 降低 15%（设备倾斜响应有延迟）
- **建议**: spawnArea 留更大边距（倾斜控制边缘精度差）
- maxCount 减少 20%（设备控制下玩家操作范围受限）

### AudioInput（声音输入）
- 通常用于特殊触发（吹气、说话），不直接控制位置
- Spawner 参数不需要针对性调整
- 可用于触发特殊生成模式（如吹气触发大波生成）

## 常见 Anti-Pattern

**生成频率过高导致卡死**
- 错误: `frequency: 0.3, maxCount: 50` → 大量物体同时存在，碰撞检测 O(n*m) 暴涨
- 正确: `frequency: 0.3` 时 `maxCount` 不超过 15；或 `maxCount: 50` 时 `frequency` 不低于 2.0
- 经验法则: `maxCount / frequency <= 20`（每秒不超过 20 个物体同时存在的理论上限）

**spawnArea 超出画布范围**
- 错误: 画布 1080 宽，设置 `spawnArea: { x: 0, y: 0, width: 1080, height: 0 }` → 边缘物体被截断
- 正确: `spawnArea: { x: 80, y: 0, width: 920, height: 0 }` → 留出 spriteSize 的边距

**speed.min > speed.max**
- 错误: `speed: { min: 300, max: 100 }` → `Math.random() * (max - min)` 产生负值，物体反向移动
- 正确: 始终保证 `min <= max`

**tap 类游戏设置了 direction 但 speed 为 0**
- 错误: `speed: { min: 0, max: 0 }, direction: 'down'` → 物体静止，direction 无效但不报错
- 正确: speed=0 时 direction 无意义，但不会造成 bug，只是容易混淆意图

**items 数组为空**
- 错误: `items: []` → `spawn()` 返回 null，游戏中永远没有物体出现
- 正确: items 至少包含 1 个有效 asset

**rotation 开启但 rotationSpeed 为 0**
- 错误: `rotation: true, rotationSpeed: 0` → 旋转逻辑执行但无可见效果，浪费计算
- 正确: 开启 rotation 时 rotationSpeed 设为 1~3

**没有考虑 DifficultyRamp 的 min 边界**
- 错误: DifficultyRamp 持续降低 frequency，没有设 min → frequency 趋近于 0，生成速度无限快
- 正确: 始终设置 `min: 0.3`（frequency 下限）和 `max: 20`（maxCount 上限）

**spawnArea.height=0 时 direction='left'/'right'**
- 错误: 水平方向游戏 spawnArea.height=0 → 所有物体在同一 y 坐标生成，形成一条线
- 正确: 非 down/up 方向时，确保 spawnArea 在垂直方向有足够范围

## 常见问题 & 边界情况

- items 数组为空时 `spawn()` 返回 null，不会生成任何物体
- frequency 在内部转为毫秒 `frequency * 1000`
- 物体出界判定为超出画布边界 100px（四个方向都有 100px 缓冲区）
- maxCount 限制只影响生成，不影响已存在物体的移动和销毁
- 加权随机：每个 item 的 weight 默认为 1，weight 越大被选中概率越高
- direction 为 `'random'` 时每个物体独立随机选择方向（四个方向等概率）
- 调用 `reset()` 会清空所有物体并重置计时器，但不重置 `spawnCounter`
- `spawnCounter` 是模块级全局变量，跨游戏实例递增，保证 ID 全局唯一
- 生成的物体没有使用对象池（Object Pooling），频繁创建/销毁可能产生 GC 压力
- `spawner:created` 事件不包含 speed 和 direction 信息，渲染器需要通过 `getObjects()` 获取完整数据
- `gameflowPaused` 初始为 true，只有收到 `gameflow:resume` 后才开始生成
- 当 frequency 非常小（如 0.3s）且帧率低时，单帧内可能触发多次生成（因为 while 循环式计时器减法）——当前实现是 `if` 而非 `while`，所以实际每帧最多生成 1 个物体

## 性能参考

| 场景 | maxCount | frequency | 预期 FPS (移动端) | 备注 |
|------|----------|-----------|-------------------|------|
| 轻量 | 5~8 | 1.5 | 60 | catch 类标准配置 |
| 中等 | 10~15 | 1.0 | 55~60 | dodge 类中期 |
| 较重 | 15~25 | 0.5 | 45~55 | 需要配合碰撞优化 |
| 危险 | 25~50 | 0.3 | < 40 | 不建议，碰撞检测成为瓶颈 |
