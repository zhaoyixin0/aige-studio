# PowerUp — 增益道具模块

## 基本信息
- 类型: mechanic
- 类名: `PowerUp`
- 注册名: `PowerUp`
- 文件: `src/engine/modules/mechanic/power-up.ts`
- 依赖: 无
- 可选联动: Collision, Lives, IFrames, Scorer, PlayerMovement, Spawner, UIOverlay, ParticleVFX, SoundFX

## 功能原理

PowerUp 管理限时增益效果。当玩家拾取增益道具时，激活对应类型的 power-up 效果；效果持续一定时间后自动过期。

**工作流程：**
1. 监听 `collision:hit` 事件
2. 收到事件后检查 `data.powerUpType` 字段
3. 在 `params.powerUpTypes` 中查找匹配的定义
4. 调用 `activate(type, duration, multiplier)`:
   - 移除同类型的已激活 power-up（同类型不叠加，刷新计时器）
   - 创建新的 `ActivePowerUp` 对象推入数组
   - 发出 `powerup:activate` 事件
5. 每帧在 `update()` 中倒计时所有 active power-ups
6. `remaining <= 0` 时移除并发出 `powerup:expire` 事件

**Power-Up 设计最佳实践（参考 Temple Run, Mario, Pac-Man）：**

| 设计原则 | 说明 |
|----------|------|
| 明确视觉区分 | 每种 power-up 有独特的颜色/形状/图标 |
| 即时可感知 | 拾取后立刻有视觉/音效反馈 |
| 持续时间可视 | HUD 显示剩余时间（进度条/倒计时） |
| 到期预警 | 快过期时闪烁/变色/加速提示音 |
| 叠加规则清晰 | 同类刷新计时器 vs 不同类可并存 |

**Power-Up 类型分类（业界常见）：**

| 类型 | 效果 | 经典案例 | 当前支持 |
|------|------|---------|---------|
| Speed Boost | 移动速度 x 倍率 | Sonic 跑鞋 | 有 (type: 'speed') |
| Shield | 吸收一次伤害 | Mario 蘑菇 | 有 (type: 'shield') |
| Magnet | 自动吸引附近收集品 | Temple Run 磁铁 | 可通过 type 扩展 |
| Score Multiplier | 得分翻倍 | Temple Run 2x | 可通过 multiplier 实现 |
| Invincibility | 完全无敌 | Mario 星星 | 可通过 type 扩展 |
| Size Change | 变大/变小 | Mario 蘑菇 | 可通过 type 扩展 |
| Extra Life | +1 命 | Mario 1UP 蘑菇 | 可通过 type 扩展 |
| Time Freeze | 敌人/障碍物暂停 | 各种 | 可通过 type 扩展 |
| Heal | 回复生命值 | Hollow Knight 灵魂 | 可通过 type 扩展 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| powerUpTypes | object (PowerUpDef[]) | `[{type:'speed',multiplier:2,duration:5000},{type:'shield',duration:3000}]` | — | 1 ~ 5 种类型 | Power-up 类型定义数组 |

### PowerUpDef 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | Power-up 类型标识符（如 `'speed'`, `'shield'`, `'magnet'`） |
| multiplier | number | 否 | 倍率值（speed/score 类使用） |
| duration | number | 是 | 持续时间（ms） |

### ActivePowerUp 结构（运行时状态）

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | Power-up 类型 |
| multiplier | number (可选) | 倍率值 |
| duration | number | 总持续时间（ms） |
| remaining | number | 剩余时间（ms） |

### 不同游戏类型的参数推荐

| 游戏类型 | 推荐 PowerUp 类型 | duration | 设计理由 |
|----------|------------------|----------|---------|
| catch | speed (x0.5 减速), shield | 3000 ~ 5000 | 减速便于接住，shield 防扣命 |
| dodge | shield, invincibility | 3000 ~ 5000 | 防御性 power-up 缓解压力 |
| runner | magnet, shield, speed (x1.5) | 5000 ~ 8000 | 跑酷标配三件套 |
| platformer | speed, shield, heal | 5000 ~ 10000 | 探索中拾取，持续时间较长 |
| shooting | rapid-fire, damage-up, shield | 5000 ~ 8000 | 增强火力 |
| tap | score-multiplier (x2/x3) | 3000 ~ 5000 | 短暂高分机会 |

### 经典游戏 Power-Up 参考

| 游戏 | Power-Up | 持续时间 | 叠加规则 | 视觉指示 |
|------|----------|---------|---------|---------|
| Pac-Man | Power Pellet | ~6s | 不叠加，刷新 | 幽灵变蓝 |
| Mario | 星星（无敌） | ~10s | 不叠加，刷新 | 角色闪烁+BGM 变化 |
| Temple Run | 磁铁 | ~5s | 同类刷新 | HUD 图标+倒计时 |
| Temple Run | Shield | ~6s 或 1 次碰撞 | 不叠加 | 玩家外圈光环 |
| Sonic | 跑鞋（加速） | ~15s | 不叠加 | BGM 加速 |
| Diablo III | Shrine | ~60s | 同类刷新，最多 3 层 | 角色光效 |

## 参数调优指南

### duration 的黄金法则

```
推荐 duration = 游戏平均事件周期 * 3 ~ 5
```

- catch 类（frequency=1.5s）: duration = 4500 ~ 7500ms → 约 3~5 次接住机会
- dodge 类（frequency=1.0s）: duration = 3000 ~ 5000ms → 约 3~5 个障碍周期
- runner 类（obstacle 间距 ~2s）: duration = 6000 ~ 10000ms → 覆盖一段区域

**太短** (< 2s): 玩家刚拾取就过期，感觉不到效果
**太长** (> 15s): 降低稀缺感，游戏变无聊
**理想**: 让玩家 "享受到明显优势但又渴望更多"

### multiplier 的平衡

| multiplier | 效果 | 适合场景 |
|-----------|------|---------|
| 1.5x | 轻微增强 | 频繁出现的 power-up |
| 2.0x | 明显增强 | 标准 power-up |
| 3.0x | 强力增强 | 稀有 power-up |
| 5.0x+ | 碾压 | boss 战/特殊事件限定 |

### 叠加规则（当前实现）

当前实现的叠加策略:
- **同类型**: 移除旧的，添加新的（**刷新计时器**，不叠加倍率）
- **不同类型**: 可以并存（速度+护盾同时生效）

```
示例:
  T=0: 拾取 speed(x2, 5000ms) → active: [speed(remaining:5000)]
  T=2000: 拾取 shield(3000ms)  → active: [speed(remaining:3000), shield(remaining:3000)]
  T=3000: 拾取 speed(x2, 5000ms) → 移除旧 speed → active: [shield(remaining:2000), speed(remaining:5000)]
```

**业界替代叠加策略（未实现）：**

| 策略 | 说明 | 适用 |
|------|------|------|
| 刷新计时器（当前） | 同类重新开始计时 | 最常见 |
| 叠加倍率 | x2 + x2 = x4 | 高风险高回报 |
| 延长时间 | 5s + 5s = 10s | 保守但稳定 |
| 忽略 | 已有同类时不生效 | 防止滥用 |
| 升级 | x2 → x3 → x4（最多 N 层）| Diablo 风格 |

### PowerUp 出现频率与游戏平衡

PowerUp 本身不生成——由 Spawner 或 Collectible 生成并赋予 `powerUpType` 属性。平衡建议：

```
Power-Up 出现频率 = 总物体生成频率 * power-up 权重 / 总权重
```

- 休闲游戏: power-up 权重 = 20~30%（频繁给好处）
- 标准游戏: power-up 权重 = 10~15%（适度奖励）
- 硬核游戏: power-up 权重 = 5~8%（稀缺珍贵）

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `powerup:activate` | `POWERUP_ACTIVATE` | `{ type: string, duration: number, multiplier?: number }` | Power-up 激活时 |
| `powerup:expire` | `POWERUP_EXPIRE` | `{ type: string }` | Power-up 到期时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `collision:hit` | `COLLISION_HIT` | 检查 data.powerUpType → 查找定义 → 激活 |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复倒计时 |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停倒计时 |

### 事件流转示意

```
[拾取链路]
Collision 检测玩家碰到 power-up 物体
  → emit('collision:hit', { targetId: 'spawn-42', powerUpType: 'shield' })
    → Spawner: removeObject('spawn-42') → 物体消失
    → Scorer: 可选加分
    → PowerUp: handleCollision({ powerUpType: 'shield' })
      → 查找 definition: { type: 'shield', duration: 3000 }
      → activate('shield', 3000)
        → emit('powerup:activate', { type: 'shield', duration: 3000 })
          → UIOverlay: 显示 shield 图标+倒计时
          → ParticleVFX: 播放 shield 激活特效
          → SoundFX: 播放拾取音效
          → PixiRenderer: 显示护盾视觉效果

[过期链路]
PowerUp.update() 每帧
  → remaining -= dt
  → remaining <= 0:
    → emit('powerup:expire', { type: 'shield' })
      → UIOverlay: 移除 shield 图标
      → ParticleVFX: 播放 shield 消失特效
      → SoundFX: 播放过期音效
      → PixiRenderer: 移除护盾视觉效果

[shield 防护链路（需上层实现）]
collision:damage 发生
  → 上层逻辑检查: powerUp.isActive('shield')
    → 若 true: 消费 shield → emit('powerup:expire', { type: 'shield' })
      → 不传递给 Lives（伤害被吸收）
    → 若 false: 正常传递给 Lives.decrease()
```

## 跨模块联动规则

### 与 Lives 的关系

**Shield Power-Up:**
- 激活后吸收一次伤害
- **当前实现未集成**: collision:damage 仍然直接传给 Lives
- **需要上层逻辑**: 在 Lives 减血前检查 `powerUp.isActive('shield')`

**Heal Power-Up:**
- 拾取后恢复生命值
- 需要在 handleCollision 中调用 `Lives.increase(amount)`
- **当前实现未集成**: PowerUp 不引用 Lives 模块

**Extra Life Power-Up:**
- 拾取后增加最大生命数
- 需要扩展 Lives 模块支持动态修改 count

### 与 IFrames 的关系

**Invincibility Power-Up:**
- 功能与 IFrames 重叠——建议通过 IFrames 的 API 实现
- 方案: PowerUp.activate('invincibility') → 触发一个自定义事件 → IFrames 监听并启动较长时间的无敌帧
- 避免两套无敌逻辑

**Shield vs IFrames:**
- Shield 是一次性消费（吸收 1 次伤害后消失）
- IFrames 是时间窗口（持续时间内所有伤害无效）
- 两者可以共存：Shield 先消费 → IFrames 再提供窗口

### 与 Scorer 的关系

**Score Multiplier Power-Up:**
- 激活后 Scorer 的分数计算乘以 multiplier
- 需要 Scorer 在计分时查询 `powerUp.isActive('score-multiplier')` 和 `getMultiplier()`
- **当前实现**: Scorer 不检查 PowerUp 状态

### 与 PlayerMovement 的关系

**Speed Power-Up:**
- 激活后 PlayerMovement 的速度乘以 multiplier
- PlayerMovement 需要在移动计算时查询 `powerUp.isActive('speed')`
- **当前实现**: PlayerMovement 不检查 PowerUp 状态

### 与 Spawner / Collectible 的关系

- Power-up 道具由 Spawner 或 Collectible 生成
- 碰撞事件的 `data.powerUpType` 需要由生成系统附加
- Spawner items 中可以混入 power-up 物体（需要扩展 Spawner 的 item 数据结构）

### 与 Collision 的关系

- PowerUp 监听 `collision:hit`（非 `collision:damage`）
- collision:hit 用于积极碰撞（拾取），collision:damage 用于消极碰撞（受伤）
- Power-up 物体通常在碰撞后销毁（`destroy: ['b']`）

### 与 UIOverlay 的关系

- `powerup:activate` → 显示 power-up 图标 + 倒计时条
- `powerup:expire` → 移除图标
- 快过期时应有视觉预警（闪烁）

## 输入适配

PowerUp 本身不依赖输入方式，但某些 power-up 效果与输入相关：

| Power-Up 类型 | 输入相关性 | 调整建议 |
|--------------|-----------|---------|
| speed | 高 | 低精度输入下 multiplier 降低（避免失控） |
| shield | 无 | 适用所有输入方式 |
| magnet | 无 | 适用所有输入方式 |
| score-multiplier | 无 | 适用所有输入方式 |
| invincibility | 无 | 低精度输入下 duration 可增加 |

## 常见 Anti-Pattern

**collision:hit 事件中缺少 powerUpType 字段**
- 错误: Spawner/Collectible 生成的物体没有 powerUpType → PowerUp 永远不激活
- 正确: 确保碰撞事件数据包含 `powerUpType` 字段

**所有 power-up 使用相同 duration**
- 错误: speed/shield/magnet 都是 5000ms → 无差异化
- 正确: 根据影响力设置不同时长——强力效果短时间，弱效果长时间

**multiplier 过高导致游戏失衡**
- 错误: `speed: { multiplier: 5 }` → 角色移动速度 5 倍，完全失控
- 正确: speed 的 multiplier 通常 1.3 ~ 2.0；score 的 multiplier 可以 2 ~ 5

**powerUpTypes 为空数组**
- 错误: `powerUpTypes: []` → 所有 collision:hit 事件被接收但 find 失败 → 无效模块
- 正确: 至少定义 1 种 power-up 类型

**Shield 未真正拦截伤害**
- 错误: PowerUp 记录了 shield active 状态，但 Lives 不检查 → shield 是假护盾
- 正确: 上层逻辑在 collision:damage → Lives 之前检查 shield 状态

**Power-up 效果未在过期时清理**
- 错误: speed power-up 过期后 PlayerMovement 仍然使用 2x 速度
- 正确: `powerup:expire` 事件触发后，相关模块恢复原始参数

**同时激活过多 power-up 导致效果混乱**
- 错误: 同时有 speed + invincibility + magnet + score-multiplier → 游戏体验混乱
- 正确: 限制同时激活的 power-up 数量（建议 <= 2），或用更强的单一 power-up

## 常见问题 & 边界情况

- `handleCollision(data)` 在 `data.powerUpType` 不存在时直接返回 → 无副作用
- 同类型 power-up 重复拾取: 旧的被移除，新的加入（刷新计时器，不叠加）
- `activate()` 是公开方法，可由外部直接调用（不需要碰撞事件）
- `isActive(type)` 返回 boolean，其他模块可实时查询
- `getActivePowerUps()` 返回浅拷贝数组，外部修改不影响内部
- `remaining` 直接修改 ActivePowerUp 对象的属性（可变操作）
- 多个 power-up 在同一帧过期时，会逐个发出 `powerup:expire` 事件
- `reset()` 清空所有活跃的 power-up，不发出 expire 事件
- `gameflowPaused` 时不倒计时 → 暂停期间 power-up 冻结
- 如果 dt 极大（tab 切回），多个 power-up 可能同时过期
- getDependencies() 未覆写 → 默认 requires: [], optional: []
- PowerUp 模块不直接修改其他模块的参数——它只提供状态查询接口，实际效果由其他模块自行实现
