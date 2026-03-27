# SkillTree — 技能树模块

## 基本信息
- 类型: mechanic
- 类名: `SkillTree`
- 注册名: `SkillTree`
- 文件: `src/engine/modules/mechanic/skill-tree.ts`
- 依赖: 无（独立运行）
- 可选联动: LevelUp, Projectile, PlayerMovement, StatusEffect, UIOverlay, SoundFX

## 模块定义

SkillTree 实现技能点分配和主动技能系统。玩家通过升级获取技能点，消耗技能点解锁技能树中的技能节点。每个技能可设置前置条件（prerequisites）、冷却时间和自定义效果。技能激活时会发出通用 `skill:activate` 事件和技能定义中的自定义 effect 事件，从而驱动其他模块执行具体行为（如发射弹幕、施加状态、提升属性等）。

**工作流程：**
1. `init()` 时监听 `levelup:levelup` 事件 → 累加 `availablePoints`（来自 `data.skillPoints`）
2. `init()` 时监听 `activateEvent`（默认 `input:touch:doubleTap`）→ 激活选中技能
3. 调用 `unlockSkill(skillId)` 时检查前置条件、技能点余额 → 解锁技能 → 发出 `skill:unlock`
4. 调用 `activateSkill(skillId)` 时检查冷却 → 发出 `skill:activate` + 技能自定义 effect 事件
5. 每帧 `update(dt)` 递减所有已解锁技能的冷却时间

**技能树设计参考（游戏设计最佳实践）：**

| 设计模式 | 经典案例 | 特点 | 适用场景 |
|----------|---------|------|---------|
| 线性技能树 | Diablo 2 经典 | 每个分支线性前进 | 简单 RPG |
| 网状技能树 | Path of Exile | 节点相互连接 | 深度构建 |
| 三分支 | 魔兽世界天赋 | 3 条互斥路线 | 职业分化 |
| 层级解锁 | 手游常见 | 按等级解锁层 | 休闲 RPG |
| 自由点数 | Skyrim | 无固定树形，自由分配 | 沙盒 RPG |

## 核心参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| skills | SkillDef[] (object) | `[]` | 技能定义数组，每个元素描述一个可解锁的技能 |
| pointsPerLevel | number (range) | `1` | 每次升级获得的技能点数（范围 1~5） |
| activateEvent | string | `'input:touch:doubleTap'` | 触发技能激活的输入事件名 |
| selectedSkillIndex | number (range) | `0` | 当前选中的技能在 skills 数组中的索引（范围 0~10） |

### SkillDef 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 技能唯一标识 |
| name | string | 技能显示名称 |
| prerequisites | string[] | 前置技能 ID 列表，必须全部解锁后才能学习 |
| cost | number | 解锁所需技能点数 |
| cooldown | number | 技能冷却时间 (ms)，0 表示无冷却 |
| effect | string | 激活时发出的自定义事件名 |
| effectData | Record<string, any> | 随 effect 事件发送的数据 |

## 事件

### 发出事件

| 事件名 | 数据结构 | 触发条件 |
|--------|----------|---------|
| `skill:unlock` | `{ id, name }` | 技能被成功解锁时 |
| `skill:activate` | `{ id, name, effectData }` | 技能被成功激活时 |
| `skill:cooldown` | `{ id, remaining }` | 尝试激活冷却中的技能时 |
| `[skill.effect]` | `skill.effectData` | 技能激活时发出技能定义中的自定义事件 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `levelup:levelup` | 从 `data.skillPoints` 累加可用技能点 |
| `[activateEvent]` | 激活 `selectedSkillIndex` 对应的已解锁技能 |
| `gameflow:pause` | 暂停 update（BaseModule 统一处理） |
| `gameflow:resume` | 恢复 update（BaseModule 统一处理） |

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| LevelUp | 技能点来源 | `levelup:levelup` 事件提供 `skillPoints`，驱动技能解锁 |
| Projectile | 效果目标 | 技能 effect 可发出 `projectile:fire` 等事件触发弹幕 |
| PlayerMovement | 效果目标 | 技能可修改移动速度、解锁冲刺等能力 |
| StatusEffect | 效果目标 | 技能激活时可调用 `StatusEffect.applyEffect()` 施加增益 |
| Health | 效果目标 | 治疗技能可通过 effect 事件恢复生命值 |
| UIOverlay | 显示 | 监听 `skill:unlock`/`skill:activate`/`skill:cooldown` 渲染技能 UI |
| SoundFX | 音效 | 监听 `skill:activate` 播放技能释放音效 |

### 关键联动链路

```
[技能点获取链路]
enemy:death → LevelUp.addXp()
  → 经验值达到阈值 → emit('levelup:levelup', { level, skillPoints })
    → SkillTree 监听 → availablePoints += skillPoints
      → UIOverlay 提示可分配技能点

[技能解锁链路]
用户选择技能 → SkillTree.unlockSkill(skillId)
  → 前置条件检查 → 技能点扣减
    → emit('skill:unlock', { id, name })
      → UIOverlay 更新技能树显示
      → SoundFX 播放解锁音效

[技能激活链路]
input:touch:doubleTap（或自定义 activateEvent）
  → SkillTree 激活 selectedSkillIndex 对应技能
    → 冷却检查 → 设置冷却 → emit('skill:activate', { id, name, effectData })
      → emit(skill.effect, skill.effectData)  ← 自定义效果事件
        → Projectile/StatusEffect/Health/... 响应具体效果
```

## 公共 API

| 方法 | 签名 | 说明 |
|------|------|------|
| unlockSkill | `(skillId: string) → boolean` | 解锁指定技能，返回是否成功 |
| activateSkill | `(skillId: string) → boolean` | 激活指定技能，返回是否成功 |
| getUnlockedSkills | `() → string[]` | 返回所有已解锁技能的 ID 列表 |
| getAvailablePoints | `() → number` | 返回当前可用技能点数 |
| isUnlocked | `(skillId: string) → boolean` | 检查指定技能是否已解锁 |
| getCooldownRemaining | `(skillId: string) → number` | 获取指定技能的剩余冷却时间 |

## 示例配置

```json
{
  "type": "SkillTree",
  "params": {
    "pointsPerLevel": 1,
    "activateEvent": "input:touch:doubleTap",
    "selectedSkillIndex": 0,
    "skills": [
      {
        "id": "fireball",
        "name": "火球术",
        "prerequisites": [],
        "cost": 1,
        "cooldown": 3000,
        "effect": "projectile:fire",
        "effectData": { "damage": 20, "element": "fire" }
      },
      {
        "id": "ice_armor",
        "name": "冰甲",
        "prerequisites": [],
        "cost": 1,
        "cooldown": 10000,
        "effect": "status:apply_buff",
        "effectData": { "name": "ice_armor", "stat": "defense", "value": 15, "duration": 8000 }
      },
      {
        "id": "meteor",
        "name": "陨石术",
        "prerequisites": ["fireball"],
        "cost": 3,
        "cooldown": 15000,
        "effect": "projectile:fire",
        "effectData": { "damage": 80, "element": "fire", "aoe": true }
      }
    ]
  }
}
```

## 常见 Anti-Pattern

**前置条件形成环路**
- 错误: 技能 A 前置条件为 B，技能 B 前置条件为 A → 两者都无法解锁
- 正确: 技能前置条件必须形成有向无环图 (DAG)

**技能点总量不足以解锁关键技能**
- 错误: `maxLevel: 10, pointsPerLevel: 1, 关键技能 cost: 15` → 永远无法解锁
- 正确: 确保 `maxLevel * pointsPerLevel >= 关键路径总 cost`

**activateEvent 与其他模块输入冲突**
- 错误: `activateEvent: 'input:touch:tap'` 与 DialogueSystem 的 advanceEvent 相同 → 对话中误触发技能
- 正确: 使用独立的输入事件（如 doubleTap）或在技能激活前检查游戏状态

**cooldown 为 0 导致技能无限释放**
- 错误: 强力技能 cooldown 设为 0 → 玩家可每帧触发，破坏平衡
- 正确: 强力技能设置合理冷却（3000~15000ms）

**selectedSkillIndex 超出 skills 数组范围**
- 注意: 超出范围时技能查找返回 undefined，激活操作静默失败

## 常见问题 & 边界情况

- 前置条件中引用不存在的 skillId 时，`unlockSkill` 因找不到已解锁记录而返回 false
- 已解锁的技能不能重复解锁（直接返回 false，不扣技能点）
- 技能点余额不足时 `unlockSkill` 返回 false
- 冷却中的技能被激活时发出 `skill:cooldown` 通知 UI 显示冷却提示
- `reset()` 清空所有已解锁技能和技能点，不发出任何事件
- `update()` 在 `gameflowPaused` 时跳过，冷却时间暂停
- `activateSkill` 同时发出通用事件 `skill:activate` 和自定义事件 `skill.effect`
