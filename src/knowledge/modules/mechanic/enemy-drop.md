# EnemyDrop — 战利品掉落模块

## 基本信息
- 类型: mechanic
- 类名: `EnemyDrop`
- 注册名: `EnemyDrop`
- 文件: `src/engine/modules/mechanic/enemy-drop.ts`
- 依赖: 无强依赖
- 可选联动: LevelUp, Collectible, Collision, EnemyAI, UIOverlay, SoundFX, ParticleVFX

## 功能原理

EnemyDrop 管理敌人死亡后的战利品掉落和经验奖励。模块完全事件驱动（`update()` 为空操作），监听可配置的触发事件（默认 `enemy:death`），每次触发时自动奖励经验值，并按概率从权重掉落表中抽取物品生成掉落。

**工作流程：**
1. `init()` 时监听 `triggerEvent`（默认 `enemy:death`）
2. 收到事件 → 从 data 中解析 `{ x, y }` → 调用 `rollDrop(x, y)`
3. `rollDrop()` 首先无条件发出 `levelup:xp`（经验奖励）
4. 然后按 `dropChance` 概率判定是否掉落物品
5. 掉落时从 `lootTable` 按权重抽取 → 随机 count → 发出 `drop:spawn`

**掉落表设计参考：**

| 类型 | 说明 | 典型权重 |
|------|------|---------|
| collectible | 可拾取物品（金币、宝石） | 5 ~ 10（常见） |
| health | 回复道具（药水） | 2 ~ 3（稍少） |
| equipment | 装备（武器、防具） | 1（稀有） |
| xp | 额外经验球 | 3 ~ 5（中等） |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| lootTable | object (LootEntry[]) | `[]` | — | 掉落表，每项含 item/weight/minCount/maxCount/type |
| dropChance | range | `0.8` | 0 ~ 1（步长 0.05） | 物品掉落概率（0=不掉落，1=必掉） |
| triggerEvent | string | `'enemy:death'` | — | 监听的触发事件名 |
| xpAmount | range | `10` | 0 ~ 1000 | 每次击杀奖励的经验值 |

### LootEntry 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| item | string | 物品标识符（如 `'gold_coin'`, `'health_potion'`） |
| weight | number | 权重值，越大越常见 |
| minCount | number | 最少掉落数量 |
| maxCount | number | 最多掉落数量 |
| type | `'collectible'` \| `'equipment'` \| `'xp'` \| `'health'` | 物品类型分类 |

### 不同游戏类型的参数推荐

| 游戏类型 | dropChance | xpAmount | lootTable 策略 | 设计理由 |
|----------|-----------|---------|---------------|---------|
| action-rpg | 0.8 | 10 ~ 25 | 金币(8)+药水(3)+装备(1) | 丰富掉落驱动探索 |
| shooting | 0.5 | 5 ~ 10 | 弹药(6)+回复(3) | 资源管理紧张感 |
| platformer | 0.6 | 5 | 金币(10)+生命(2) | 简单掉落，奖励探索 |
| idle/放置 | 1.0 | 1 ~ 3 | 金币(10)+材料(5)+稀有(1) | 必掉，挂机积累 |
| boss rush | 1.0 | 50 ~ 100 | 装备(5)+稀有(3)+传说(1) | Boss 必掉高价值 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `levelup:xp` | `LEVELUP_XP` | `{ amount: number }` | 每次触发时无条件发出（经验奖励） |
| `drop:spawn` | `DROP_SPAWN` | `{ x: number, y: number, item: string, count: number, type: string }` | 概率判定通过且从掉落表抽取成功时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `enemy:death`（默认 triggerEvent） | `ENEMY_DEATH` | 解析 x/y 坐标，调用 rollDrop() |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[掉落链路 — action-rpg]
enemy:death { x, y }
  → EnemyDrop.rollDrop(x, y)
    → emit('levelup:xp', { amount: xpAmount })
      → LevelUp 监听 → addXp()（注意：若 LevelUp 也监听 enemy:death 则经验重复）
    → Math.random() < dropChance?
      → 否: 结束（无物品掉落）
      → 是: pickWeighted(lootTable)
        → rollCount(minCount, maxCount)
        → emit('drop:spawn', { x, y, item, count, type })
          → Collectible 监听 → 在 (x,y) 位置生成可拾取物品
          → ParticleVFX 播放掉落特效
          → SoundFX 播放掉落音效

[拾取链路 — 下游]
drop:spawn { x, y, item, count, type }
  → Collectible 在场景中创建实体
  → 玩家碰撞 → collision:hit { objectA, objectB }
    → type === 'health' → Health.heal()
    → type === 'xp' → LevelUp.addXp()
    → type === 'equipment' → EquipmentSlot.equip()
    → type === 'collectible' → Inventory.add() / Scorer.add()
```

## 跨模块联动规则

### EnemyDrop + EnemyAI 击杀触发

EnemyAI 管理敌人行为，敌人死亡时发出 `enemy:death { x, y }`。EnemyDrop 监听此事件，在敌人死亡位置生成掉落物。

### EnemyDrop + LevelUp 经验分配

EnemyDrop 每次触发自动发出 `levelup:xp { amount }`。

**关键协调点：**

| 问题 | 解决方案 |
|------|---------|
| LevelUp 和 EnemyDrop 都监听 enemy:death → 双重经验 | 方案 A: LevelUp 的 xpSource 改为 `levelup:xp`（由 EnemyDrop 转发）；方案 B: EnemyDrop 的 xpAmount 设为 0，经验全部由 LevelUp 处理 |

### EnemyDrop + Collectible 物品生成

`drop:spawn` 事件携带位置和物品信息，Collectible 模块监听后在场景中创建可拾取的实体。

### EnemyDrop + Collision 碰撞拾取

掉落物生成后需要 Collision 模块支持拾取碰撞检测。玩家接触掉落物 → `collision:hit` → 触发对应效果。

### 与 UIOverlay 的关系

- `drop:spawn` → 在掉落位置显示物品图标 + 浮动文字（+10 XP）
- 稀有掉落可触发全屏特效提示

## 输入适配

EnemyDrop 不直接依赖输入方式，但间接受击杀速度影响（击杀越快 → 掉落越多 → 资源越丰富）。

## 常见 Anti-Pattern

**lootTable 为空但 dropChance > 0**
- 错误: 概率判定通过但无物品可抽 → 静默无效
- 正确: 确保 lootTable 至少有一项，或将 dropChance 设为 0

**经验重复计算**
- 错误: EnemyDrop 发出 `levelup:xp` + LevelUp 监听 `enemy:death` → 同一次击杀获得双倍经验
- 正确: 只保留一条经验通路（见 LevelUp + EnemyDrop 联动）

**weight 全为 0**
- 错误: lootTable 中所有 weight 为 0 → total = 0 → `Math.random() * 0 = 0` → 总是选最后一项
- 正确: weight 应为正数，默认回退为 1

**minCount > maxCount**
- 注意: 源码已处理——`rollCount()` 内部做 `Math.min/max` 交换，不会报错

**triggerEvent 与 EnemyAI 不匹配**
- 错误: EnemyAI 发出 `ai:enemy:death` 但 EnemyDrop 监听 `enemy:death`
- 正确: 确保 triggerEvent 与上游事件名一致

## 常见问题 & 边界情况

- xpAmount = 0 时仍发出 `levelup:xp { amount: 0 }`，LevelUp 的 addXp(0) 会直接返回
- lootTable 为空数组时，跳过物品掉落，仅奖励经验
- dropChance = 0 时永远不掉落物品，但仍奖励经验
- dropChance = 1 时必定掉落物品
- `pickWeighted()` 使用权重随机：总权重 = sum(weight)，随机值落在哪个区间就选哪个
- `rollCount()` 在 [minCount, maxCount] 范围内均匀随机（含两端）
- 事件 data 中无 x/y 时默认为 (0, 0)
- reset() 为空操作——模块无状态（stateless）
- update() 为空操作——模块完全事件驱动

## 示例配置

```json
{
  "type": "EnemyDrop",
  "params": {
    "lootTable": [
      { "item": "gold_coin", "weight": 8, "type": "collectible", "minCount": 1, "maxCount": 5 },
      { "item": "health_potion", "weight": 3, "type": "health", "minCount": 1, "maxCount": 1 },
      { "item": "iron_sword", "weight": 1, "type": "equipment", "minCount": 1, "maxCount": 1 }
    ],
    "dropChance": 0.8,
    "triggerEvent": "enemy:death",
    "xpAmount": 10
  }
}
```
