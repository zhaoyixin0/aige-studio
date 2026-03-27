# Shield — 护盾系统模块

## 基本信息
- 类型: mechanic
- 类名: `Shield`
- 注册名: `Shield`
- 文件: `src/engine/modules/mechanic/shield.ts`
- 依赖: Collision（requires）
- 可选联动: Health, IFrames, Lives, UIOverlay, ParticleVFX, SoundFX

## 功能原理

Shield 管理玩家的护盾资源（charges 制），在 Health 之前拦截伤害。护盾有固定层数（charges），每次受伤消耗 1 层；耗尽后伤害穿透给 Health。护盾在冷却时间后自动回充 1 层，直到充满。模块同时具有事件驱动（absorb）和帧驱动（recharge timer）两个工作模式。

**工作流程：**
1. `init()` 时将 `charges` 设为 `params.maxCharges`（满盾初始化），监听 `damageEvent`
2. 收到 damageEvent → 检查 `absorb()`:
   - 有 charges → charges -= 1 → 发出 `shield:block` + `shield:absorbed`（伤害被吸收）
   - charges 降至 0 → 额外发出 `shield:break`
   - 无 charges → 发出 `shield:damage:passthrough`（伤害穿透给 Health）
3. `update(dt)` 中：charges < maxCharges 时，累加 `rechargeTimer`
4. `rechargeTimer >= rechargeCooldown` 时 → charges += 1 → 发出 `shield:recharge`

**经典护盾设计参考：**

| 游戏风格 | maxCharges | rechargeCooldown | 设计理由 |
|----------|-----------|-----------------|---------|
| Halo 风格 | 3 ~ 5 | 3000 ~ 5000ms | 快速回充，鼓励交替战斗/躲避 |
| Dark Souls 风格 | 1 ~ 2 | 8000 ~ 15000ms | 稀有护盾，战略使用 |
| FPS 竞技 | 2 ~ 3 | 5000ms | 中等节奏，攻守平衡 |
| 休闲射击 | 5 ~ 8 | 2000 ~ 3000ms | 宽容，适合新手 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| maxCharges | number | `3` | 1 ~ 10 | 最大护盾层数 |
| rechargeCooldown | number | `5000` | 1000 ~ 30000 | 每层回充冷却时间（ms） |
| damageEvent | string | `'collision:damage'` | — | 监听的伤害事件名 |

### 不同游戏类型的参数推荐

| 游戏类型 | maxCharges | rechargeCooldown | 设计理由 |
|----------|-----------|-----------------|---------|
| shooting | 3 | 5000 | 标准射击护盾节奏 |
| action-rpg | 2 | 8000 | RPG 中护盾是战略资源 |
| platformer | 2 ~ 3 | 6000 | 平台动作中提供额外容错 |
| dodge (休闲) | 5 | 3000 | 高容错，保护新手 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `shield:block` | `SHIELD_BLOCK` | `{ chargesRemaining: number }` | 护盾成功吸收一次伤害 |
| `shield:break` | `SHIELD_BREAK` | （无数据） | charges 刚好降至 0 |
| `shield:recharge` | `SHIELD_RECHARGE` | `{ chargesRemaining: number }` | 冷却结束，回充 1 层 |
| `shield:absorbed` | `SHIELD_ABSORBED` | 原始 damageEvent data | 伤害被护盾完全吸收（透传原事件数据） |
| `shield:damage:passthrough` | `SHIELD_DAMAGE_PASSTHROUGH` | 原始 damageEvent data | 护盾已破，伤害穿透（透传原事件数据） |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `collision:damage`（默认 damageEvent） | `COLLISION_DAMAGE` | 尝试 absorb()，成功则吸收，失败则穿透 |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[护盾吸收链路]
collision:damage { targetId, amount }
  → Shield.absorb()
    → charges > 0:
      → charges -= 1
      → emit('shield:block', { chargesRemaining })
        → UIOverlay 更新护盾 HUD
        → ParticleVFX 播放护盾特效
        → SoundFX 播放护盾音效
      → emit('shield:absorbed', originalData)
      → 若 charges === 0:
        → emit('shield:break')
          → UIOverlay 显示护盾破碎提示

[伤害穿透链路]
collision:damage { targetId, amount }
  → Shield.absorb() 返回 false（charges === 0）
    → emit('shield:damage:passthrough', originalData)
      → Health 监听 passthrough → damage(targetId, amount)

[护盾回充链路 — 帧驱动]
update(dt)
  → charges < maxCharges 且未暂停:
    → rechargeTimer += dt
    → rechargeTimer >= rechargeCooldown:
      → rechargeTimer = 0
      → charges = min(charges + 1, maxCharges)
      → emit('shield:recharge', { chargesRemaining })
        → UIOverlay 更新护盾 HUD
```

## 跨模块联动规则

### Shield + Health 护盾优先（核心联动）

Shield 和 Health 共同监听 damageEvent。Shield 在有 charges 时吸收伤害并发出 `shield:absorbed`；无 charges 时发出 `shield:damage:passthrough`，Health 应监听 passthrough 事件而非直接监听 collision:damage，避免双重扣血。

**关键协调点：**

| 问题 | 解决方案 |
|------|---------|
| Shield 和 Health 同时监听 collision:damage | Health 应改为监听 `shield:damage:passthrough`，或在上层做事件路由 |
| 护盾回充期间受到连续伤害 | rechargeTimer 归零重新计时，每次 absorb 不影响 timer |
| 护盾满了还在计时 | `charges >= maxCharges` 时 update() 直接返回 |

### Shield + IFrames 无敌帧

护盾吸收后可配合 IFrames 提供短暂无敌，防止护盾被连续消耗。

### Shield + Lives 混合制

Shield 保护 Lives/Health → 护盾破碎后 Lives 开始消耗 → 全部耗尽后游戏结束。

### 与 UIOverlay 的关系

- `shield:block` → 更新护盾图标/层数显示
- `shield:break` → 显示护盾破碎动画
- `shield:recharge` → 显示护盾回充动画

## 输入适配

Shield 本身不直接依赖输入方式。但间接受输入精度影响（控制精度低 → 被击率高 → 护盾消耗快）：

| 输入方式 | 建议 maxCharges 调整 | 理由 |
|----------|---------------------|------|
| TouchInput | 标准（3） | 触摸精度高 |
| FaceInput | +1 ~ +2 | 追踪延迟导致被击率上升 |
| HandInput | +1 | 手势追踪边缘抖动 |
| DeviceInput | +1 ~ +2 | 陀螺仪漂移导致控制不稳 |

## 常见 Anti-Pattern

**Shield 和 Health 双重扣血**
- 错误: Shield 和 Health 都监听 `collision:damage` → Shield 消耗 charge 但 Health 也扣血
- 正确: 通过 `shield:absorbed` / `shield:damage:passthrough` 事件分流，Health 仅在穿透时扣血

**rechargeCooldown 太短导致护盾无限**
- 错误: `rechargeCooldown: 500ms` → 护盾几乎不会破，游戏无挑战
- 正确: rechargeCooldown 应 >= 受击间隔的 2~3 倍，确保护盾有破碎窗口

**gameflowPaused 时护盾继续回充**
- 注意: `update()` 已正确检查 `gameflowPaused`，暂停时不回充

**reset() 后 rechargeTimer 残留**
- 注意: `reset()` 同时重置 `charges` 和 `rechargeTimer`，状态干净

## 常见问题 & 边界情况

- `charges <= 0` 时 `absorb()` 返回 false，不会减到负数
- `rechargeTimer` 在 charges 充满后停止累加（`charges >= maxCharges` 直接返回）
- `shield:break` 只在 charges 刚好降到 0 时触发一次
- `reset()` 将 charges 恢复为 maxCharges，rechargeTimer 归零
- `isActive()` 返回 `charges > 0`，可被外部查询护盾状态
- `shield:absorbed` 和 `shield:damage:passthrough` 透传原始事件数据，下游模块可直接解析

## 示例配置

```json
{
  "type": "Shield",
  "params": {
    "maxCharges": 3,
    "rechargeCooldown": 5000,
    "damageEvent": "collision:damage"
  }
}
```
