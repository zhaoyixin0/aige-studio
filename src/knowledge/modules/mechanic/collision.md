# Collision — 碰撞检测模块

## 基本信息
- 类型: mechanic
- 类名: Collision
- 注册名: `Collision`

## 功能原理

Collision 使用圆形碰撞体进行碰撞检测。所有可碰撞对象通过 `registerObject()` 注册到指定图层（layer），每帧按碰撞规则（rules）检查图层间的对象对。碰撞判定为两圆心距离 < 两半径之和。碰撞发生时发出自定义事件（如 `collision:hit`、`collision:damage`），碰撞点为两对象中点。可配置碰撞后自动销毁哪一方。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| rules | collision-rules | `[]` | — | 碰撞规则数组 |

### 碰撞规则结构 (CollisionRule)

| 字段 | 类型 | 说明 |
|------|------|------|
| a | string | 图层A名称 |
| b | string | 图层B名称 |
| event | string | 碰撞时发出的事件后缀，完整事件名为 `collision:{event}` |
| destroy | string[] | 碰撞后销毁哪一方，可选值 `['a']`、`['b']`、`['a','b']` |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `collision:{rule.event}` | `{ objectA, objectB, layerA, layerB, targetId, x, y }` | 两个碰撞体重叠时，targetId 为 objectB 的 id |

常见事件名示例：
- `collision:hit` — 接住/击中（catch/shooting 类游戏）
- `collision:damage` — 受到伤害（dodge/runner 类游戏）

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:pause` | 暂停碰撞检测 |
| `gameflow:resume` | 恢复碰撞检测 |

## 与其他模块连接方式

- **Spawner**: Spawner 生成的物体需注册到 Collision → 碰撞后 Spawner 监听 `collision:hit` 移除物体
- **Scorer**: `collision:hit` → Scorer 加分
- **Lives**: `collision:damage` → Lives 减少生命
- **ParticleVFX**: 碰撞事件触发特效（在碰撞点 x, y）
- **SoundFX**: 碰撞事件触发音效
- **FaceInput/HandInput**: 输入模块更新玩家碰撞体位置 → `collision.updateObject()`

## 适用游戏类型

- **catch**（接住类）— player 层 vs items 层 → `collision:hit`
- **dodge**（躲避类）— player 层 vs obstacles 层 → `collision:damage`
- **shooting**（射击类）— bullets 层 vs targets 层 → `collision:hit`
- **runner**（跑酷类）— player vs obstacles → `collision:damage`，player vs coins → `collision:hit`
- **rhythm**（节奏类）— hitzone vs notes → `collision:hit`
- **world-ar**（世界AR类）— body vs objects → `collision:hit`

## 常见问题 & 边界情况

- 碰撞检测为 O(n*m)（图层A物体数 * 图层B物体数），大量物体时注意性能
- 同一个物体不会与自身碰撞（`objA.id === objB.id` 跳过）
- 已被标记销毁的物体在同一帧内不会再触发碰撞
- `targetId` 始终指向 objectB（规则中 b 图层的对象）
- 碰撞体为圆形，不支持矩形或多边形碰撞
- `registerObject(id, layer, { x, y, radius })` 注册碰撞体
- `updateObject(id, { x, y })` 更新碰撞体位置
- `unregisterObject(id)` 取消注册
- `reset()` 清空所有已注册对象
