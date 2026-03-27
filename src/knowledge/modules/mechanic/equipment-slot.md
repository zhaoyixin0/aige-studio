# EquipmentSlot — 装备系统模块

## 基本信息
- 类型: mechanic
- 类名: `EquipmentSlot`
- 注册名: `EquipmentSlot`
- 文件: `src/engine/modules/mechanic/equipment-slot.ts`
- 依赖: 无（独立运行）
- 可选联动: EnemyDrop, Health, Projectile, LevelUp, Collectible, UIOverlay, SoundFX

## 模块定义

EquipmentSlot 管理玩家的装备槽位和背包系统。支持多种槽位类型（武器、护甲、饰品、头盔、鞋子），每个槽位同一时间只能装备一件物品。装备提供属性加成（stats），模块自动聚合所有已装备物品的属性并通过事件通知其他模块。支持通过监听事件（如 `collectible:pickup`）实现自动装备——当拾取的新装备总属性优于当前装备时自动替换。

**工作流程：**
1. `init()` 时监听 `equipEvent`（默认 `collectible:pickup`）用于自动装备判定
2. 通过 `addEquipment(item)` 将装备加入可用列表（背包）
3. 调用 `equip(itemId)` 装备指定物品 → 检查槽位是否允许 → 替换旧装备（退回背包）→ 发出 `equipment:equip` 和 `equipment:stats`
4. 调用 `unequip(slot)` 卸下指定槽位装备 → 退回背包 → 发出 `equipment:unequip` 和 `equipment:stats`
5. `getAggregatedStats()` 汇总所有已装备物品的属性加成

**装备系统设计参考：**

| 设计模式 | 经典案例 | 特点 | 适用场景 |
|----------|---------|------|---------|
| 固定槽位 | Diablo, WoW | 武器/头/胸/腿/鞋/饰品 | 传统 RPG |
| 简化槽位 | 手游 RPG | 武器/护甲/饰品 3 槽 | 休闲 RPG |
| 无槽位 | Roguelike | 任意装备叠加，无限制 | 快节奏 |
| 套装系统 | Diablo 套装 | 集齐多件获额外加成 | 中重度 RPG |
| 强化系统 | 韩式 MMO | 装备升级/附魔 | 养成向 |

## 核心参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| slots | SlotType[] (object) | `['weapon', 'armor', 'accessory']` | 允许的装备槽位类型列表 |
| equipEvent | string | `'collectible:pickup'` | 触发自动装备判定的事件名 |

### SlotType 可选值

`'weapon'` | `'armor'` | `'accessory'` | `'helmet'` | `'boots'`

### Equipment 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 装备唯一标识 |
| name | string | 装备显示名称 |
| slot | SlotType | 装备对应的槽位类型 |
| stats | Record<string, number> | 属性加成字典（如 `{ attack: 10, defense: 5 }`） |
| asset | string | 装备素材 ID |

## 事件

### 发出事件

| 事件名 | 数据结构 | 触发条件 |
|--------|----------|---------|
| `equipment:equip` | `{ slot, item, totalStats }` | 装备被成功穿戴时 |
| `equipment:unequip` | `{ slot, item }` | 装备被卸下时 |
| `equipment:stats` | `{ stats: Record<string, number> }` | 装备属性总和变化时（equip/unequip 后均触发） |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `[equipEvent]` | 检查拾取物品是否为已知装备，若属性优于当前则自动替换 |
| `gameflow:pause` | 暂停模块（BaseModule 统一处理） |
| `gameflow:resume` | 恢复模块（BaseModule 统一处理） |

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| EnemyDrop | 装备来源 | 敌人死亡掉落装备 → `drop:spawn` → 上层添加到 EquipmentSlot.addEquipment |
| Health | 联动 | `equipment:stats` 中的 defense 属性影响受伤减免 |
| Projectile | 联动 | `equipment:stats` 中的 attack 属性影响弹幕伤害 |
| LevelUp | 联动 | 升级解锁更高等级装备，或装备提供经验加成 |
| Collectible | 触发 | `collectible:pickup` 触发自动装备判定 |
| StatusEffect | 间接 | 装备属性修改器与效果属性修改器叠加计算 |
| UIOverlay | 显示 | 监听 `equipment:equip`/`equipment:unequip` 渲染装备栏 UI |
| SoundFX | 音效 | 监听 `equipment:equip` 播放装备穿戴音效 |

### 关键联动链路

```
[装备获取链路]
enemy:death → EnemyDrop.rollDrop()
  → emit('drop:spawn', { x, y, item, type: 'equipment' })
    → 上层逻辑创建 Equipment 对象 → EquipmentSlot.addEquipment(item)

[自动装备链路]
collectible:pickup (data: { id: 'sword_01' })
  → EquipmentSlot.handleAutoEquip()
    → 在 available 列表中查找 id 匹配的装备
      → 检查槽位是否允许
        → 比较新旧装备 stats 总和
          → 新装备更好时: equip(itemId)
            → emit('equipment:equip', { slot, item, totalStats })
            → emit('equipment:stats', { stats })

[属性应用链路]
equipment:stats ({ stats: { attack: 15, defense: 10 } })
  → Projectile 模块读取 attack 修正伤害
  → Health 模块读取 defense 修正减伤
```

## 公共 API

| 方法 | 签名 | 说明 |
|------|------|------|
| addEquipment | `(item: Equipment) → void` | 将装备加入可用列表（背包），已存在则忽略 |
| equip | `(itemId: string) → boolean` | 装备指定物品，返回是否成功 |
| unequip | `(slot: SlotType) → Equipment \| undefined` | 卸下指定槽位装备，返回被卸下的装备 |
| getEquipped | `(slot: SlotType) → Equipment \| undefined` | 获取指定槽位当前装备 |
| getAllEquipped | `() → Equipment[]` | 获取所有已装备物品列表 |
| getAggregatedStats | `() → Record<string, number>` | 汇总所有已装备物品的属性加成 |

## 示例配置

```json
{
  "type": "EquipmentSlot",
  "params": {
    "slots": ["weapon", "armor", "accessory"],
    "equipEvent": "collectible:pickup"
  }
}
```

### 装备数据示例

```json
[
  {
    "id": "iron_sword",
    "name": "铁剑",
    "slot": "weapon",
    "stats": { "attack": 10 },
    "asset": "sword_01"
  },
  {
    "id": "leather_armor",
    "name": "皮甲",
    "slot": "armor",
    "stats": { "defense": 8, "hp": 20 },
    "asset": "armor_01"
  },
  {
    "id": "speed_ring",
    "name": "疾风戒指",
    "slot": "accessory",
    "stats": { "speed": 5, "attack": 3 },
    "asset": "ring_01"
  }
]
```

## 常见 Anti-Pattern

**available 列表未填充导致自动装备失效**
- 错误: `equipEvent` 触发时 data.id 对应的装备不在 available 列表中 → 自动装备静默失败
- 正确: 确保 EnemyDrop/上层逻辑在触发 equipEvent 之前先调用 `addEquipment()`

**slots 配置缺少对应装备类型**
- 错误: 掉落 `slot: 'helmet'` 的装备但 `slots` 未包含 `'helmet'` → 无法装备
- 正确: `slots` 必须覆盖所有可能掉落的装备槽位类型

**属性名不统一导致聚合失效**
- 错误: 武器用 `{ atk: 10 }`，护甲用 `{ attack: 5 }` → 不同 key 无法正确聚合
- 正确: 统一使用标准属性名（attack, defense, speed, hp 等）

**卸下装备后未更新战斗属性**
- 注意: `unequip()` 会自动发出 `equipment:stats` 事件，但消费方必须监听并更新

**equip 替换旧装备时的属性闪烁**
- 注意: `equip()` 是原子操作——先退回旧装备再穿戴新装备，最终只发出一次 `equipment:stats`

## 常见问题 & 边界情况

- `addEquipment()` 对同 id 物品去重，不会重复添加
- `equip()` 时若目标槽位已有装备，旧装备自动退回 available 列表
- `equip()` 返回 false 的情况: 物品不在 available 列表、物品 slot 不在允许列表
- `unequip()` 返回 undefined 表示该槽位本就没有装备
- `getAggregatedStats()` 遍历所有已装备物品的 stats 并累加同名属性
- 自动装备比较逻辑: 新装备 stats 值总和 > 当前装备 stats 值总和时替换
- `reset()` 清空已装备和可用列表，不发出任何事件
- `update()` 为空操作，模块完全事件驱动
