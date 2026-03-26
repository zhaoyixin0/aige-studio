# Lives — 生命系统模块

## 基本信息
- 类型: mechanic
- 类名: `Lives`
- 注册名: `Lives`
- 文件: `src/engine/modules/mechanic/lives.ts`
- 依赖: Collision（requires）
- 可选联动: IFrames, Knockback, PowerUp, UIOverlay, ParticleVFX, SoundFX, GameFlow

## 功能原理

Lives 管理玩家的生命值资源。模块是纯事件驱动的（`update()` 为空操作），通过监听 `collision:damage` 事件来减少生命值，通过 `increase()` 方法来恢复生命值。

**工作流程：**
1. `init()` 时将 `current` 设为 `params.count`（满血初始化）
2. 监听 `collision:damage` 事件 → 调用 `decrease(amount)`
3. `decrease()` 中 `current = Math.max(0, current - amount)` → 发出 `lives:change`
4. 当 `current === 0` 时，额外发出 `lives:zero`
5. `increase()` 中 `current = Math.min(count, current + amount)` → 发出 `lives:change`

**设计哲学对比（参考 Wikipedia: Health (game terminology)）：**

| 模式 | 特点 | 适用类型 | 经典案例 |
|------|------|----------|---------|
| Lives 制（固定生命数） | 每次受伤减 1 命，有限续命 | dodge, runner, catch | Pac-Man, Mario |
| HP 制（血条） | 每次受伤减少 damage 量 | platformer, RPG | Zelda, Mega Man |
| 混合制（Lives + HP） | 血条归零减 1 命 | 经典平台 | Mega Man（血条+3命）|
| 无限续命 + 惩罚 | 死亡后原地/存档点复活 | 探索型 | Celeste, Hollow Knight |
| Shield + HP | 护盾优先吸收伤害 | FPS, 动作 | Halo, Fortnite |

**当前实现**: Lives 同时支持 Lives 制和简易 HP 制——`count` 为生命/HP 总量，`events.damage` 为每次受伤减少量。设为 `count:3, damage:-1` 是 Lives 制；设为 `count:100, damage:-10` 则是 HP 制。

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| count | number | `3` | 1 ~ 10 | 3 ~ 5 | 初始/最大生命数 |
| events | object | `{ damage: -1 }` | — | — | 事件配置对象 |
| events.damage | number | `-1` | -10 ~ -1 | -1 | 每次受伤减少量（取绝对值使用） |
| onZero | select | `'finish'` | `finish` / `none` | `finish` | 生命归零后行为 |

### 不同游戏类型的参数推荐

| 游戏类型 | count | events.damage | onZero | 设计理由 |
|----------|-------|---------------|--------|---------|
| dodge | 3 | -1 | finish | 经典街机风格，3 条命 |
| runner | 3 ~ 5 | -1 | finish | 跑酷容错率稍高 |
| catch | 3 | -1 | finish | 漏接扣命（通过 spawner:destroyed） |
| platformer | 5 ~ 10 | -1 ~ -2 | finish | HP 制，多次受击 |
| platformer (Celeste 风格) | 1 | -1 | finish | 一碰即死，依赖 Checkpoint |

### 经典游戏参数参考

| 游戏风格 | count | damage | 有无 IFrames | 有无 Shield | 手感 |
|----------|-------|--------|-------------|------------|------|
| Mega Man 风格 | 28 (HP) | -2 ~ -8 | 有（~1.5s） | 无 | 血条制，不同敌人不同伤害 |
| Celeste 风格 | 1 | -1 | 无 | 无 | 一碰即死，快速重生 |
| Hollow Knight 风格 | 5 (Mask) | -1 | 有（~1s） | 无 | 面具制，可回复 |
| Mario 风格 | 3 (Lives) | -1 | 有（~2s） | 有（蘑菇 power-up） | 经典 Lives + Power-up 护甲 |
| 休闲 dodge | 3 ~ 5 | -1 | 有（~1s） | 可选 | 宽容，适合新手 |

## 参数调优指南

### count 与游戏时长的关系

```
平均存活时间 = count / (受击频率 * abs(damage))
受击频率 ≈ 1 / (玩家技巧 * 躲避难度)
```

经验法则：
- 30 秒游戏: count = 3, damage = -1 → 允许 3 次失误
- 60 秒游戏: count = 5, damage = -1 → 允许 5 次失误
- 无限模式: count = 3 + DifficultyRamp 导致的渐增风险

### count 与 IFrames duration 的配合

```
有效生存时间下限 = count * iframes.duration
```

如果 `count = 3, iframes.duration = 1000ms`，玩家在最差情况下（连续碰撞）可以存活 3 秒。确保此值 > 游戏最短有意义周期。

### events.damage 与 PowerUp shield 的关系

当 PowerUp 的 shield 生效时，Lives 模块仍然会收到 `collision:damage` 事件。**shield 拦截需要在上层逻辑实现**——当前实现中 Lives 不检查 PowerUp 状态。

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `lives:change` | `LIVES_CHANGE` | `{ current: number, max: number }` | 生命值任意变化时（增/减） |
| `lives:zero` | `LIVES_ZERO` | （无数据） | current 刚好降至 0 时（仅触发一次） |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `collision:damage` | `COLLISION_DAMAGE` | 减少生命值，减少量 = `abs(events.damage ?? 1)` |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[受伤链路 — dodge/runner/platformer]
collision:damage
  → IFrames 检查: 若 iframes.isActive() 则拦截（需上层实现）
  → Lives.decrease(amount)
    → emit('lives:change', { current, max })
      → UIOverlay 更新生命 HUD
      → ParticleVFX 播放受伤特效
      → SoundFX 播放受伤音效
    → 若 current === 0:
      → emit('lives:zero')
        → GameFlow 监听 → transition('finished')
  → Knockback.activate() (同时触发击退)
  → IFrames.activate() (同时触发无敌帧)

[回复链路 — platformer/runner]
powerup:activate (type: 'heal')
  → Lives.increase(amount) （需上层集成）
    → emit('lives:change', { current, max })
      → UIOverlay 更新生命 HUD

[catch 类漏接链路]
spawner:destroyed (物体出界)
  → 上层逻辑调用 Lives.decrease(1)
  → 同上
```

## 跨模块联动规则

### Lives + IFrames + Knockback 三件套（核心联动）

这三个模块共同构成完整的「受伤反馈系统」，业界称为 **Damage Response Triad**。

```
collision:damage 发生
  ├─ Lives: 减血
  ├─ IFrames: 启动无敌帧（防止连续伤害）
  └─ Knockback: 击退玩家（物理分离 + 视觉反馈）
```

**关键协调点：**

| 问题 | 解决方案 |
|------|---------|
| IFrames 期间是否还会收到 collision:damage? | 当前实现: 会收到。需要在 Lives.decrease 或上层检查 `iframes.isActive()` |
| Knockback 期间玩家输入是否生效? | Knockback.isActive() 期间应禁用玩家移动输入 |
| 三者 triggerEvent 是否一致? | 必须一致，都使用 `collision:damage` |

**推荐三件套参数组合：**

| 游戏风格 | Lives.count | IFrames.duration | Knockback.force | Knockback.duration |
|----------|-------------|-----------------|----------------|-------------------|
| 宽容休闲 | 5 | 1500ms | 200 | 150ms |
| 标准动作 | 3 | 1000ms | 300 | 200ms |
| Mega Man 风格 | 28 (HP) | 1500ms | 400 | 250ms |
| Hollow Knight 风格 | 5 | 1000ms | 350 | 200ms |
| 硬核 | 1 ~ 2 | 500ms | 500 | 300ms |

### 与 Collision 的关系

- Collision 发出 `collision:damage` → Lives 监听并减血
- rules 中 `event: 'damage'` 专用于扣血碰撞
- `destroy: ['b']` 使碰撞物消失；`destroy: []` 使碰撞物持续存在（需配合 IFrames 防连续伤害）

### 与 PowerUp 的关系

- PowerUp `type: 'shield'` 应在 collision:damage 之前拦截伤害
- PowerUp `type: 'heal'` 触发时应调用 `Lives.increase()`
- **当前实现未集成**: 需要上层逻辑协调 PowerUp → Lives 的交互

### 与 Scorer 的关系

- dodge 类: 存活越久越高分，Lives 归零结束计分
- catch 类: `spawner:destroyed` 同时扣分和扣命

### 与 GameFlow 的关系

- `lives:zero` + `onZero: 'finish'` → GameFlow 监听后调用 `transition('finished')`
- `onZero: 'none'` 时 Lives 归零不会结束游戏（需要其他结束条件）

### 与 UIOverlay 的关系

- `lives:change` → UIOverlay 渲染心形/生命图标
- HUD 显示 `current / max`（如 3/5）

## 输入适配

Lives 本身不直接依赖输入方式。但间接受输入精度影响（输入精度低 → 被碰撞频率高 → 消耗生命快）：

| 输入方式 | 建议 count 调整 | 理由 |
|----------|----------------|------|
| TouchInput | 标准（3） | 触摸精度高 |
| FaceInput | +1 ~ +2 | 追踪延迟导致被击率上升 |
| HandInput | +1 | 手势追踪边缘抖动 |
| DeviceInput | +1 ~ +2 | 陀螺仪漂移导致控制不稳 |
| AudioInput | 不适用 | 声音输入不直接控制位置 |

## 常见 Anti-Pattern

**IFrames 未集成导致连续扣血**
- 错误: Lives 监听 collision:damage 但不检查 IFrames 状态 → 持续碰撞每帧扣血，3 条命瞬间耗尽
- 正确: 在 decrease() 前检查 `iframes.isActive()`，或在 Collision 层过滤无敌帧内的碰撞

**count 和 damage 不匹配导致生命浪费**
- 错误: `count: 3, damage: -5` → 第一次受伤就从 3 直接降到 0
- 正确: 确保 `count >= abs(damage) * 预期容错次数`

**onZero='none' 但没有其他结束条件**
- 错误: 生命归零后游戏继续但玩家已无法游玩 → 僵尸状态
- 正确: `onZero: 'none'` 仅在有 Timer 或其他结束条件时使用

**PowerUp shield 未拦截 collision:damage**
- 错误: 玩家有 shield 但 collision:damage 仍然直接传递给 Lives → shield 无实际效果
- 正确: 在事件流中，PowerUp shield 应在 Lives 之前消费 collision:damage 事件

**reset() 后 IFrames 仍为 active**
- 错误: 游戏重启时 Lives.reset() 恢复满血但 IFrames 未 reset → 新游戏开始时角色闪烁
- 正确: 确保 GameFlow 重启时所有联动模块同步 reset

## 常见问题 & 边界情况

- `current <= 0` 时 `decrease()` 直接返回，不会减到负数
- `increase()` 不会超过 `count` 上限
- `events.damage` 取绝对值 `Math.abs(events.damage ?? 1)`，配置为负数也能正常工作
- `lives:zero` 只在 current 刚好降到 0 时触发一次（之后 decrease 直接返回）
- `reset()` 将 current 恢复为 count，不发出任何事件
- `onZero: 'finish'` 由 GameFlow 监听 `lives:zero` 实现，Lives 本身不处理结束逻辑
- update() 为空操作，模块完全事件驱动，不消耗帧时间
- getDependencies() 声明 requires: ['Collision']，但实际上 Lives 不直接调用 Collision API，仅监听其事件
