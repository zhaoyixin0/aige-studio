# LevelUp — 升级系统模块

## 基本信息
- 类型: mechanic
- 类名: `LevelUp`
- 注册名: `LevelUp`
- 文件: `src/engine/modules/mechanic/level-up.ts`
- 依赖: 无强依赖
- 可选联动: EnemyAI, EnemyDrop, UIOverlay, SkillTree, EquipmentSlot

## 功能原理

LevelUp 管理角色的等级和经验值系统。模块监听可配置的经验来源事件（默认 `enemy:death`），累积经验值后自动升级并分配成长属性。支持三种经验曲线（linear / quadratic / exponential），可配置每级所需经验、最大等级和属性成长。

**工作流程：**
1. `init()` 时监听 `xpSource` 事件（默认 `enemy:death`）
2. 收到事件 → 取事件 data 中的 `amount`（若无则用 `params.xpAmount`）→ 调用 `addXp(amount)`
3. `addXp()` 累加 currentXp 和 totalXp → 发出 `levelup:xp`
4. 循环检查：若 currentXp >= 当前等级所需经验 → currentXp 减去阈值，level += 1，skillPoints += 1 → 发出 `levelup:levelup`
5. 到达 maxLevel 后，多余经验值清零

**经验曲线公式：**

| 曲线 | 公式 | 特点 |
|------|------|------|
| linear | `base * level` | 线性增长，每级递增固定量 |
| quadratic | `floor(base * level^1.5)` | 中后期需求加速增长 |
| exponential | `floor(base * 1.5^level)` | 后期急剧增长，高等级极难达到 |

示例（base = 100）：

| 等级 | linear | quadratic | exponential |
|------|--------|-----------|-------------|
| 1 | 100 | 100 | 150 |
| 5 | 500 | 1118 | 759 |
| 10 | 1000 | 3162 | 5766 |
| 20 | 2000 | 8944 | 332525 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| xpPerLevel | range | `100` | 10 ~ 10000（步长 10） | 经验曲线基础值 |
| scalingCurve | select | `'quadratic'` | `linear` / `quadratic` / `exponential` | 经验需求增长曲线 |
| maxLevel | range | `50` | 1 ~ 999 | 最大等级上限 |
| xpSource | string | `'enemy:death'` | — | 监听的经验来源事件名 |
| xpAmount | range | `10` | 1 ~ 1000 | 每次事件获得的默认经验值 |
| statGrowth | object | `{ hp: 10, attack: 2, defense: 1 }` | — | 每级属性成长量 |

### 不同游戏类型的参数推荐

| 游戏类型 | xpPerLevel | scalingCurve | maxLevel | xpAmount | 设计理由 |
|----------|-----------|-------------|---------|---------|---------|
| action-rpg | 100 | quadratic | 50 | 10 ~ 25 | 标准 RPG 节奏，中后期放缓 |
| shooting (roguelike) | 50 | linear | 10 ~ 15 | 5 ~ 10 | 单局升级，快速获得增强 |
| idle/放置 | 20 | exponential | 999 | 1 ~ 5 | 指数曲线制造长期目标 |
| platformer (Metroidvania) | 200 | quadratic | 30 | 15 ~ 30 | 探索驱动，升级间隔适中 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `levelup:xp` | `LEVELUP_XP` | `{ xp: number, totalXp: number, level: number, xpToNext: number }` | 获得经验时（每次 addXp 调用） |
| `levelup:levelup` | `LEVELUP_LEVELUP` | `{ level: number, stats: Record<string, number>, skillPoints: number }` | 升级时（可能一次 addXp 触发多次升级） |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `enemy:death`（默认 xpSource） | `ENEMY_DEATH` | 获取事件 data.amount 或使用 params.xpAmount，调用 addXp() |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[升级链路 — action-rpg]
enemy:death { amount?: number }
  → LevelUp.addXp(amount ?? xpAmount)
    → emit('levelup:xp', { xp, totalXp, level, xpToNext })
      → UIOverlay 更新经验条
    → 若 currentXp >= threshold:
      → level++, skillPoints++
      → emit('levelup:levelup', { level, stats, skillPoints })
        → UIOverlay 显示升级动画
        → SkillTree 解锁新技能点
        → Health 根据 stats.hp 提升最大生命

[EnemyDrop 联动链路]
enemy:death { x, y }
  → EnemyDrop 监听 → rollDrop() → emit('levelup:xp', { amount: xpAmount })
    → LevelUp 监听 levelup:xp? 不——EnemyDrop 直接发出 levelup:xp
  → LevelUp 同时监听 enemy:death → addXp()
  注意: 需避免 LevelUp 和 EnemyDrop 同时监听 enemy:death 导致双重加经验
```

## 跨模块联动规则

### LevelUp + EnemyAI 经验来源

EnemyAI 管理敌人生成和行为，敌人死亡时发出 `enemy:death`，LevelUp 监听并获得经验。

**关键协调点：**

| 问题 | 解决方案 |
|------|---------|
| EnemyDrop 和 LevelUp 都监听 enemy:death 导致双重经验 | EnemyDrop 的 xpAmount 走 `levelup:xp` 事件，LevelUp 的 xpSource 改为 `levelup:xp`；或禁用其中一方的经验功能 |
| 不同敌人给不同经验 | 在 enemy:death 事件 data 中传入 amount 字段 |

### LevelUp + EnemyDrop 战利品经验

EnemyDrop 每次击杀自动发出 `levelup:xp` 事件奖励经验。若同时使用 LevelUp 直接监听 `enemy:death`，需注意经验重复问题。

### LevelUp + SkillTree 技能点

升级时 `skillPoints++`，SkillTree 监听 `levelup:levelup` 获取可用技能点，玩家可分配到不同技能。

### LevelUp + UIOverlay 界面

- `levelup:xp` → 更新经验条进度
- `levelup:levelup` → 显示升级特效/动画 + 新等级数字

### 与 Health 的关系

- `statGrowth.hp` 每级增加 HP → 升级时通知 Health 提升 maxHp
- 需要上层逻辑协调 `levelup:levelup` → Health.registerEntity() 更新

## 输入适配

LevelUp 不直接依赖输入方式，但间接受游戏节奏影响（击杀速度快 → 经验获取快 → 升级快）。

## 常见 Anti-Pattern

**经验重复计算**
- 错误: LevelUp 监听 `enemy:death` + EnemyDrop 也发出 `levelup:xp` → 经验翻倍
- 正确: 只保留一条经验来源通路

**maxLevel 后经验溢出**
- 注意: 源码已处理——到达 maxLevel 后 `currentXp = 0`，多余经验清零

**scalingCurve 选择不当**
- 错误: `exponential` + 高 maxLevel → 后期经验需求天文数字，玩家永远无法升级
- 正确: exponential 适合低 maxLevel（10~20），高 maxLevel 用 linear 或 quadratic

**statGrowth 未被下游消费**
- 错误: statGrowth 配置了 hp/attack/defense，但 Health/Damage 模块未监听 levelup:levelup
- 正确: 需要上层逻辑将 stats 应用到实际模块参数

## 常见问题 & 边界情况

- `addXp(0)` 或负值直接返回，不触发事件
- 一次 addXp 可能触发多次升级（while 循环），每次都发出独立的 `levelup:levelup`
- `getXpToNextLevel()` 在满级时返回 0
- `getStats()` 返回累计属性 = `baseValue * level`（从 1 级开始计算）
- `reset()` 将 level/currentXp/totalXp/skillPoints 全部归零（level 回到 1）
- update() 中检查 gameflowPaused，暂停时不执行逻辑（当前 update 无帧逻辑）
- totalXp 为累计总经验（不因升级减少），currentXp 为当前等级内剩余经验

## 示例配置

```json
{
  "type": "LevelUp",
  "params": {
    "xpPerLevel": 100,
    "scalingCurve": "quadratic",
    "maxLevel": 50,
    "xpSource": "enemy:death",
    "xpAmount": 10,
    "statGrowth": {
      "hp": 10,
      "attack": 2,
      "defense": 1
    }
  }
}
```
