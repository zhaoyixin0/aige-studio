# Health — 血量系统模块

## 基本信息
- 类型: mechanic
- 类名: `Health`
- 注册名: `Health`
- 文件: `src/engine/modules/mechanic/health.ts`
- 依赖: Collision（requires）
- 可选联动: Lives, IFrames, Shield, EnemyAI, UIOverlay, ParticleVFX, SoundFX

## 功能原理

Health 管理实体级别的血量资源（HP 制），支持多实体独立管理。与 Lives（生命计数制）不同，Health 面向连续血条场景——每个实体拥有独立的 `hp / maxHp` 属性，受伤时按实际 damage 扣除，而非固定扣 1 命。模块完全事件驱动（`update()` 为空操作），通过 `registerEntity()` 注册实体，监听可配置的 damageEvent / healEvent 驱动血量变化。

**工作流程：**
1. `init()` 时监听 `damageEvent`（默认 `collision:damage`）和可选的 `healEvent`
2. 外部调用 `registerEntity(id, maxHp?)` 注册实体，hp 初始化为 maxHp
3. 收到 damageEvent → `extractDamageData(data)` 解析 `{ targetId, amount }` → 调用 `damage(id, amount)`
4. `damage()` 中 `hp = Math.max(0, hp - amount)` → 发出 `health:change`
5. 当 `hp <= 0` 时，额外发出 `health:zero`
6. 收到 healEvent → 调用 `heal(id, amount)`，`hp = Math.min(maxHp, hp + amount)` → 发出 `health:change`

**Health vs Lives 对比：**

| 维度 | Health | Lives |
|------|--------|-------|
| 适用场景 | 射击、RPG、动作（连续血条） | 街机、跑酷、闪避（离散生命数） |
| 粒度 | 每个实体独立 hp/maxHp | 全局 count |
| 伤害模型 | 按 amount 扣除 | 固定 abs(damage) |
| 多实体 | 支持（Map 管理） | 不支持（单一计数器） |
| 典型 maxHp | 50 ~ 9999 | 1 ~ 10 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| maxHp | number | `100` | 1 ~ 9999 | 默认最大 HP，registerEntity 可覆盖 |
| damageEvent | string | `'collision:damage'` | — | 监听的伤害事件名 |
| healEvent | string | `''`（空） | — | 监听的治疗事件名，为空则不监听 |
| showBar | boolean | `true` | — | 是否显示血条 UI |

### 不同游戏类型的参数推荐

| 游戏类型 | maxHp | damageEvent | healEvent | showBar | 设计理由 |
|----------|-------|-------------|-----------|---------|---------|
| shooting | 100 | collision:damage | — | true | 标准射击血条 |
| action-rpg | 200 ~ 500 | collision:damage | item:heal | true | RPG 高血量 + 可回复 |
| platformer (Mega Man 风格) | 28 | collision:damage | powerup:heal | true | 经典平台动作 |
| boss rush | 1000 ~ 5000 | projectile:hit | — | true | Boss 高血量耐打 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `health:change` | `HEALTH_CHANGE` | `{ id: string, hp: number, maxHp: number, delta: number }` | 血量任意变化时（增/减） |
| `health:zero` | `HEALTH_ZERO` | `{ id: string }` | hp 刚好降至 0 时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `collision:damage`（默认 damageEvent） | `COLLISION_DAMAGE` | 解析 targetId + amount，调用 damage() |
| 自定义 healEvent | — | 解析 targetId + amount，调用 heal() |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[受伤链路 — shooting/action-rpg]
collision:damage { targetId, amount }
  → Health.damage(targetId, amount)
    → emit('health:change', { id, hp, maxHp, delta })
      → UIOverlay 更新血条 HUD
      → ParticleVFX 播放受伤特效
      → SoundFX 播放受伤音效
    → 若 hp <= 0:
      → emit('health:zero', { id })
        → 若为玩家: GameFlow 监听 → transition('finished')
        → 若为敌人: EnemyAI 监听 → emit('enemy:death')

[治疗链路 — action-rpg]
item:heal / powerup:heal { targetId, amount }
  → Health.heal(targetId, amount)
    → emit('health:change', { id, hp, maxHp, delta })
      → UIOverlay 更新血条 HUD

[Shield 联动链路]
collision:damage
  → Shield 先处理:
    → 有 charges → emit('shield:absorbed') → Health 不收到伤害
    → 无 charges → emit('shield:damage:passthrough') → Health 收到伤害
```

## 跨模块联动规则

### Health + Shield 护盾优先（核心联动）

Shield 模块监听同一 damageEvent，若有 charges 则吸收伤害并发出 `shield:absorbed`，否则发出 `shield:damage:passthrough`。Health 应配合 Shield 使用，避免同一事件被双重消费。

| 问题 | 解决方案 |
|------|---------|
| Shield 和 Health 同时监听 collision:damage | Shield 先拦截；Health 仅在 Shield 无 charges 时扣血 |
| Shield 耗尽后 Health 无保护 | UI 提示玩家护盾已破，IFrames 提供短暂保护 |

### Health + IFrames 无敌帧

受伤后启动 IFrames 防止连续伤害，确保 damageEvent 一致。

### Health + EnemyAI 敌人血量

EnemyAI 通过 `registerEntity()` 注册敌人实体，各敌人独立管理 hp。敌人 `health:zero` → `enemy:death` → 触发 EnemyDrop / 计分。

### Health + Lives 混合制

可同时使用 Health（血条）+ Lives（命数）。`health:zero` → 扣一命 + Health.reset() → 血条恢复满血。典型 Mega Man 风格。

### 与 UIOverlay 的关系

- `health:change` → UIOverlay 渲染血条
- `showBar: true` 时显示 hp / maxHp 进度条

## 输入适配

Health 本身不直接依赖输入方式。但间接受输入精度影响（控制精度低 → 被击率高 → 血量消耗快）：

| 输入方式 | 建议 maxHp 调整 | 理由 |
|----------|----------------|------|
| TouchInput | 标准（100） | 触摸精度高 |
| FaceInput | +50 ~ +100 | 追踪延迟导致被击率上升 |
| HandInput | +30 ~ +50 | 手势追踪边缘抖动 |
| DeviceInput | +50 ~ +100 | 陀螺仪漂移导致控制不稳 |

## 常见 Anti-Pattern

**Shield 和 Health 双重扣血**
- 错误: Shield 和 Health 都监听 `collision:damage` → Shield 消耗 charge 但 Health 也扣血
- 正确: Shield 拦截后发出 `shield:absorbed`，Health 仅在 `shield:damage:passthrough` 时扣血

**registerEntity 未调用**
- 错误: 监听事件但实体未注册 → damage() 中 `entities.get(id)` 返回 undefined，静默忽略
- 正确: 在实体创建时（如 EnemyAI spawn、玩家初始化）调用 registerEntity()

**reset() 清空所有实体**
- 注意: `reset()` 调用 `entities.clear()`，游戏重启后需要重新 registerEntity

**healEvent 为空时期望治疗生效**
- 错误: healEvent 未配置但期望 `heal()` 被事件触发
- 正确: 显式配置 healEvent，或在上层逻辑直接调用 `health.heal(id, amount)`

## 常见问题 & 边界情况

- `hp <= 0` 时 `damage()` 直接返回，不会减到负数
- `heal()` 不会超过 `maxHp` 上限，delta 为 0 时不触发事件
- `extractDamageData()` 安全解析：data 不是对象时返回 `{ targetId: undefined, amount: 1 }`
- `targetId` 为 undefined 时 damage/heal 不执行（需显式传入 targetId）
- `health:zero` 在 hp 刚降到 0 时触发（之后 damage 直接返回不重复触发）
- update() 为空操作，模块完全事件驱动，不消耗帧时间
- 每个实体通过不可变更新 `{ ...entity, hp: newHp }` 保持数据不变性

## 示例配置

```json
{
  "type": "Health",
  "params": {
    "maxHp": 100,
    "damageEvent": "collision:damage",
    "healEvent": "",
    "showBar": true
  }
}
```
