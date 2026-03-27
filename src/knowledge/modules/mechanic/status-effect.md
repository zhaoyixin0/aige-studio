# StatusEffect — 状态效果模块

## 基本信息
- 类型: mechanic
- 类名: `StatusEffect`
- 注册名: `StatusEffect`
- 文件: `src/engine/modules/mechanic/status-effect.ts`
- 依赖: 无（独立运行）
- 可选联动: EnemyAI, Health, Projectile, Collision, SkillTree, UIOverlay, ParticleVFX, SoundFX

## 模块定义

StatusEffect 管理作用于实体的持续性状态效果（增益 buff 和减益 debuff）。每个效果可携带属性修改器（flat/multiply 两种模式）、持续时间、可叠加层数，以及周期性跳动（tick）伤害或治疗。模块在每帧 `update(dt)` 中递减所有效果的剩余时间，触发 tick 事件，并在效果到期时自动移除并发出过期通知。

**工作流程：**
1. 外部调用 `applyEffect(config)` 申请施加效果
2. 检查免疫列表 `immunities` — 若免疫则发出 `status:immunity` 并拒绝
3. 若同名效果已存在 → 尝试叠加（stacks + 1，上限 maxStacks）并刷新持续时间
4. 若为新效果 → 检查 `maxEffects` 上限 → 创建 `ActiveEffect` → 发出 `status:apply`
5. 每帧 `update(dt)` 递减 duration，处理 tickInterval 计时 → 触发 `status:tick`
6. duration <= 0 时移除效果 → 发出 `status:expire`

**典型状态效果设计参考：**

| 效果类型 | 经典案例 | 机制 | 常见参数 |
|----------|---------|------|---------|
| 中毒 (Poison) | Zelda 毒沼、Dark Souls 毒 | 持续掉血 (DOT) | tickInterval: 1000, tickValue: -5 |
| 燃烧 (Burn) | 火焰伤害 + 可扩散 | DOT + 接触传播 | tickInterval: 500, tickValue: -8 |
| 减速 (Slow) | 冰霜效果 | 移动速度惩罚 | modifier: speed × 0.5 |
| 冻结 (Freeze) | 冰系控制技 | 完全眩晕 | modifier: speed × 0, duration: 2000 |
| 流血 (Bleed) | Elden Ring 出血 | 叠加后爆发伤害 | maxStacks: 3, tickValue: -3 |
| 加速 (Haste) | 增益 buff | 移动速度提升 | modifier: speed × 1.5 |
| 护甲增强 (Armor) | 防御 buff | 减伤 | modifier: defense + 10 |

## 核心参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxEffects | number (range) | `10` | 同时存在的最大效果数量，超过上限时新效果被忽略 |
| immunities | string[] (object) | `[]` | 免疫效果名称列表，匹配的效果不会被施加 |

### ActiveEffect 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 自增唯一标识 |
| name | string | 效果名称（用于叠加判定和免疫匹配） |
| type | `'buff' \| 'debuff'` | 效果类型 |
| modifiers | `{ stat, value, mode }[]` | 属性修改器数组，mode 为 `flat`(加减) 或 `multiply`(乘除) |
| duration | number | 剩余持续时间 (ms) |
| maxDuration | number | 原始总持续时间 (ms) |
| stacks | number | 当前叠加层数 |
| maxStacks | number | 最大叠加层数 |
| tickInterval | number | tick 间隔 (ms)，0 表示无 tick |
| tickTimer | number | 当前 tick 计时器 |
| tickValue | number | 每次 tick 的数值（正=治疗，负=伤害） |

## 事件

### 发出事件

| 事件名 | 数据结构 | 触发条件 |
|--------|----------|---------|
| `status:apply` | `{ name, type, duration, stacks }` | 新效果被成功施加时 |
| `status:expire` | `{ name }` | 效果持续时间耗尽被移除时 |
| `status:tick` | `{ name, value }` | 效果的 tickInterval 到期时（可每帧触发多次） |
| `status:stack` | `{ name, stacks }` | 同名效果叠加层数增加时 |
| `status:immunity` | `{ name }` | 尝试施加被免疫的效果时 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:pause` | 暂停 update（BaseModule 统一处理） |
| `gameflow:resume` | 恢复 update（BaseModule 统一处理） |

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| EnemyAI | 触发源 | 敌人攻击时调用 `applyEffect()` 施加减益效果 |
| Health | 联动 | `status:tick` 的 tickValue 可连接到 Health 的伤害/治疗逻辑 |
| Projectile | 触发源 | 投射物命中时可附带状态效果（如毒箭、火球） |
| Collision | 触发源 | 碰撞事件触发效果施加（如踩入毒沼） |
| SkillTree | 联动 | 技能激活时可施加增益效果（如加速、护甲） |
| LevelUp | 间接 | 升级时可解锁新的效果免疫或增强效果数值 |
| UIOverlay | 显示 | 监听 `status:apply`/`status:expire` 显示效果图标和倒计时 |
| ParticleVFX | 视觉 | 监听 `status:apply` 播放对应特效（毒雾、火焰光环等） |
| SoundFX | 音效 | 监听 `status:apply`/`status:tick` 播放效果音效 |

### 关键联动链路

```
[施加效果链路]
projectile:hit / collision:hit / skill:activate
  → StatusEffect.applyEffect({ name: 'poison', type: 'debuff', duration: 5000, tickInterval: 1000, tickValue: -5 })
    → 免疫检查 → emit('status:apply', { name, type, duration, stacks })
      → UIOverlay 显示效果图标
      → ParticleVFX 播放中毒特效

[持续伤害链路]
update(dt)
  → tickTimer 累计达到 tickInterval
    → emit('status:tick', { name: 'poison', value: -5 })
      → Health 模块监听并扣血
      → SoundFX 播放毒伤音效

[效果过期链路]
update(dt)
  → duration <= 0
    → 从 effects 列表移除
      → emit('status:expire', { name: 'poison' })
        → UIOverlay 移除效果图标
        → ParticleVFX 停止特效
```

## 公共 API

| 方法 | 签名 | 说明 |
|------|------|------|
| applyEffect | `(config: ApplyConfig) → void` | 施加新效果或叠加已有效果 |
| removeEffect | `(name: string) → void` | 按名称强制移除效果 |
| hasEffect | `(name: string) → boolean` | 检查是否存在指定效果 |
| getActiveEffects | `() → ActiveEffect[]` | 返回所有活跃效果的副本 |
| getAggregatedModifiers | `() → { stat, value, mode }[]` | 汇总所有效果的属性修改器（考虑叠加层数） |

## 示例配置

```json
{
  "type": "StatusEffect",
  "params": {
    "maxEffects": 5,
    "immunities": ["freeze"]
  }
}
```

### 常见效果配置示例

```json
{
  "name": "poison",
  "type": "debuff",
  "duration": 5000,
  "maxStacks": 3,
  "tickInterval": 1000,
  "tickValue": -5,
  "modifiers": []
}
```

```json
{
  "name": "slow",
  "type": "debuff",
  "duration": 3000,
  "maxStacks": 1,
  "tickInterval": 0,
  "tickValue": 0,
  "modifiers": [{ "stat": "speed", "value": 0.5, "mode": "multiply" }]
}
```

```json
{
  "name": "burn",
  "type": "debuff",
  "duration": 4000,
  "maxStacks": 2,
  "tickInterval": 500,
  "tickValue": -8,
  "modifiers": []
}
```

```json
{
  "name": "haste",
  "type": "buff",
  "duration": 6000,
  "maxStacks": 1,
  "tickInterval": 0,
  "tickValue": 0,
  "modifiers": [{ "stat": "speed", "value": 1.5, "mode": "multiply" }]
}
```

## 常见 Anti-Pattern

**tick 伤害未连接 Health 模块**
- 错误: `status:tick` 事件发出但无模块监听 → 毒/烧效果无实际伤害
- 正确: Health 或上层逻辑监听 `status:tick` 并调用 `Health.takeDamage(value)`

**maxStacks 设置过高导致秒杀**
- 错误: `maxStacks: 10, tickValue: -5` → 满层后每 tick 50 伤害，几乎秒杀
- 正确: `maxStacks * tickValue` 应与目标 HP 总量成合理比例

**免疫列表未覆盖关键效果**
- 错误: Boss 未设置 `immunities: ['freeze']` → 玩家可无限冻结 Boss
- 正确: 根据敌人类型设置合理的免疫列表

**效果叠加时不刷新持续时间**
- 注意: 当前实现中叠加时会刷新 duration，这是有意设计（鼓励持续攻击维持效果）

## 常见问题 & 边界情况

- `maxEffects` 达到上限后新效果被静默忽略，不发出任何事件
- 同名效果已达 `maxStacks` 时，重复施加只刷新持续时间，不增加层数
- `tickInterval: 0` 的效果不会触发 `status:tick`，仅通过 modifiers 提供属性修改
- `getAggregatedModifiers()` 返回值中 value 已乘以叠加层数
- `reset()` 清空所有效果和 ID 计数器，不发出过期事件
- `update()` 在 `gameflowPaused` 时跳过，效果持续时间暂停
- 一帧内可能触发多次 tick（如 dt 远大于 tickInterval 时）
