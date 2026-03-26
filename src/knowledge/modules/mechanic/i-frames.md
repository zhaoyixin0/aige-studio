# IFrames — 无敌帧模块

## 基本信息
- 类型: mechanic
- 类名: `IFrames`
- 注册名: `IFrames`
- 文件: `src/engine/modules/mechanic/i-frames.ts`
- 依赖: Collision（requires）
- 可选联动: Lives, Knockback, PowerUp, ParticleVFX, SoundFX

## 功能原理

IFrames（Invincibility Frames / 无敌帧）在玩家受伤后提供短暂的无敌时间，防止连续伤害导致瞬间死亡。这是几乎所有动作游戏的标配机制，源自 1980 年代的街机传统（Pac-Man, Mega Man）。

**工作流程：**
1. 监听 `triggerEvent`（默认 `collision:damage`）
2. 收到事件时，若当前未在无敌状态，则激活无敌:
   - `active = true`, `elapsed = 0`
   - 发出 `iframes:start` 事件（携带 duration）
3. 每帧累加 `elapsed`，直到 `elapsed >= duration`
4. 超时后 `active = false`，发出 `iframes:end` 事件

**设计哲学（参考 Celeste, Hollow Knight, Mega Man）：**

无敌帧的核心目的是**给予玩家恢复窗口**——在受伤后有时间重新定位、脱离危险区域。没有无敌帧，持续碰撞的伤害源会在几帧内耗尽所有生命值。

| 游戏 | 无敌帧时长 | 视觉效果 | 设计特点 |
|------|-----------|---------|---------|
| Mega Man 系列 | ~1.5s (90帧@60fps) | 角色闪烁 | 经典设计，足够跳离危险 |
| Hollow Knight | ~1.0s | 角色白闪 + 击退 | 配合击退物理分离 |
| Mario 系列 | ~2.0s | 角色半透明闪烁 | 较长，保护新手 |
| Celeste | 0（无） | 无 | 一碰即死设计，不需要 iframes |
| Terraria | ~0.67s (40帧) | 角色闪烁 | 不同伤害源可有不同 iframe 时长 |

**闪烁效果实现原理：**

当 `flashEffect: true` 时，渲染器根据 `iframes:start` / `iframes:end` 事件控制角色的可见性。典型实现是在无敌帧期间以固定间隔（100~150ms）切换角色 sprite 的 alpha 值（0 / 1 交替），产生经典的"闪烁"效果。

```
闪烁次数 = duration / (flashInterval * 2)
默认: 1000ms / (150ms * 2) ≈ 3.3 次闪烁
```

**重要**: IFrames 模块本身只管理状态和计时，不执行闪烁渲染。闪烁效果由 PixiRenderer 根据事件实现。

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| duration | range | `1000` | 200 ~ 3000，步长 100 | 800 ~ 1500 | 无敌持续时间（ms） |
| triggerEvent | string | `'collision:damage'` | 任意事件名 | `collision:damage` | 触发无敌帧的事件 |
| flashEffect | boolean | `true` | — | `true` | 是否启用闪烁视觉效果 |

### 不同游戏类型的参数推荐

| 游戏类型 | duration | flashEffect | 设计理由 |
|----------|----------|-------------|---------|
| dodge | 1000 ~ 1500 | true | 障碍物密集，需要足够恢复时间 |
| runner | 800 ~ 1200 | true | 持续跑动，短暂保护 |
| platformer (标准) | 1000 ~ 1500 | true | 经典动作游戏节奏 |
| platformer (硬核) | 500 ~ 800 | true | 减少容错窗口 |
| platformer (一碰即死) | 不使用 | — | Celeste 风格不需要 iframes |
| catch | 800 ~ 1000 | true | 防止连续碰到坏物品 |

### duration 的精确调优

**太短的问题 (< 500ms):**
- 玩家来不及脱离碰撞区域 → 无敌帧结束后立刻再次受伤
- 在持续碰撞源（如锯齿地面）上几乎无保护效果

**太长的问题 (> 2000ms):**
- 玩家可以利用无敌帧穿过大量障碍 → "无敌突破"策略
- 游戏紧张感降低，受伤惩罚感弱

**黄金法则:**
```
推荐 duration = Knockback.duration * 3 ~ 5
```
- Knockback 物理分离: ~200ms 完成位移
- IFrames 保护: ~1000ms 允许玩家重新定位
- 确保 iframes.duration > knockback.duration，否则击退未结束时无敌已消失

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `iframes:start` | `IFRAMES_START` | `{ duration: number }` | 无敌帧激活时 |
| `iframes:end` | `IFRAMES_END` | （无数据） | 无敌帧超时结束时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `{triggerEvent}` | — | 激活无敌帧（默认 `collision:damage`） |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复计时（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停计时（BaseModule 统一处理） |

### 事件流转示意

```
collision:damage 发生
  → IFrames 收到事件
    → 若 active == false:
      → active = true, elapsed = 0
      → emit('iframes:start', { duration: 1000 })
        → PixiRenderer 开始闪烁效果
        → SoundFX 可选播放受伤音效
    → 若 active == true:
      → 忽略（不重置计时器，不叠加）

IFrames.update() 每帧
  → elapsed >= duration:
    → active = false
    → emit('iframes:end')
      → PixiRenderer 停止闪烁，恢复正常显示
```

## 跨模块联动规则

### 与 Lives 的核心联动（当前实现的关键问题）

**问题**: 当前实现中，IFrames 和 Lives 都监听 `collision:damage`，但 IFrames 不会阻止 Lives 收到事件。

```
collision:damage
  → IFrames: 激活无敌帧 ✓
  → Lives: 减血 ✓（即使 IFrames 已 active）
  → 问题: 无敌帧期间的碰撞仍然扣血
```

**解决方案选项：**

| 方案 | 实现位置 | 说明 |
|------|---------|------|
| A. Lives 检查 IFrames | Lives.decrease() | 在减血前调用 `iframes.isActive()`，active 时跳过 |
| B. Collision 过滤 | Collision.update() | 碰撞检测时检查玩家是否在 iframes 中 |
| C. 事件拦截 | EventBus 中间件 | 在事件传递层拦截无敌帧内的 damage 事件 |

**推荐方案 A**: 最小改动，由 Lives 模块在 decrease() 入口检查 IFrames 状态。

### 与 Knockback 的时序配合

```
时间轴:
0ms    collision:damage 发生
       ├─ Knockback 开始 (duration: 200ms)
       ├─ IFrames 开始 (duration: 1000ms)
       └─ Lives 减血

200ms  Knockback 结束 → 玩家恢复控制
       IFrames 仍然 active → 玩家可以安全移动

1000ms IFrames 结束 → 玩家恢复为可受伤状态
```

**关键**: `IFrames.duration > Knockback.duration` 确保玩家在击退结束后仍有安全窗口重新定位。

### 与 Collision 的关系

- IFrames 不直接修改 Collision 的碰撞体
- 闪烁期间碰撞体仍然存在，碰撞事件仍然会触发
- **设计意图**: 碰撞检测照常运行，由上层逻辑（Lives）决定是否消费伤害
- 某些实现会在 iframes 期间从 Collision 移除玩家碰撞体（hitbox-removing iframes），但当前实现不采用此方式

### 与 PowerUp 的关系

- PowerUp `type: 'shield'` 激活时，collision:damage 被 shield 消费 → 不触发 IFrames
- shield 消失时若仍在碰撞中 → 下一次 collision:damage 才触发 IFrames
- **特殊**: PowerUp `type: 'invincibility'` 可以与 IFrames 功能重叠——建议使用 IFrames 的 API 实现道具无敌，而非重复逻辑

### 与 Hazard 的关系

- Hazard 是持续碰撞源（玩家站在刺上）
- IFrames 对 Hazard 的保护至关重要——没有 IFrames，站在 Hazard 上每帧扣血
- 推荐: Hazard 场景下 IFrames.duration >= 1000ms

### 与 UIOverlay 的关系

- `iframes:start` / `iframes:end` 可用于 HUD 显示无敌状态指示器
- 常见 UI: 生命图标在无敌帧期间闪烁

## 输入适配

IFrames 本身不依赖输入方式，但 duration 应根据输入精度补偿：

| 输入方式 | duration 调整 | 理由 |
|----------|-------------|------|
| TouchInput | 标准（1000ms） | 精度高，标准保护即可 |
| FaceInput | +200 ~ +300ms | 追踪延迟导致脱离危险区需要更多时间 |
| HandInput | +100 ~ +200ms | 手势追踪有轻微延迟 |
| DeviceInput | +200 ~ +300ms | 陀螺仪响应慢，需要更长保护窗口 |
| AudioInput | 不适用 | 声音不控制位置 |

## 常见 Anti-Pattern

**无敌帧期间仍然扣血（当前实现的核心问题）**
- 错误: IFrames 和 Lives 同时监听 collision:damage，Lives 不检查 IFrames 状态 → 无敌帧形同虚设
- 正确: Lives 在 decrease() 前检查 `iframes.isActive()`

**duration 太短无法脱离碰撞区域**
- 错误: `duration: 200, knockback.force: 100` → 击退距离不够 + 保护时间不够 → 无敌帧结束时仍在碰撞体内
- 正确: `duration >= knockback.duration * 3` 且 knockback.force 足以推出碰撞半径

**triggerEvent 与 Lives 不一致**
- 错误: `IFrames.triggerEvent: 'lives:change'`, `Lives 监听 collision:damage` → IFrames 在 Lives 减血之后才触发，第一次伤害无保护
- 正确: IFrames.triggerEvent 和 Lives 的监听事件都使用 `collision:damage`

**flashEffect 关闭但无替代视觉反馈**
- 错误: `flashEffect: false` 且没有其他受伤指示 → 玩家不知道自己处于无敌状态
- 正确: 至少提供一种视觉反馈（闪烁/变色/粒子/音效）

**IFrames 激活期间重新触发不重置计时器**
- 当前行为: 无敌帧期间再次收到 triggerEvent 会被忽略（`if (!this.active)` 守卫）
- 这是正确的设计: 防止玩家通过连续碰撞无限延长无敌帧

**游戏重启时 IFrames 未 reset**
- 错误: 新一局游戏开始时 IFrames 仍为 active → 角色一开始就在闪烁
- 正确: GameFlow 重启时确保所有模块 reset()，IFrames.reset() 会将 active 设为 false

## 常见问题 & 边界情况

- `isActive()` 返回 boolean，其他模块可通过引用查询无敌状态
- 无敌帧期间 `active == true` 时，重复触发被忽略（不会重置计时器）
- `gameflowPaused` 时 `update()` 不执行 → 无敌帧暂停期间不消耗
- `elapsed` 使用毫秒累加（dt 单位为 ms）
- `reset()` 将 active 设为 false、elapsed 设为 0
- flashEffect 参数只是标志位，实际闪烁渲染由 PixiRenderer 负责
- IFrames 不影响碰撞检测本身——碰撞事件照常触发，只是 Lives 应忽略 iframes 期间的伤害
- 如果 dt 极大（tab 切回），可能在一帧内直接跳过整个 iframes 周期（立即结束）
- getDependencies() 声明 requires: ['Collision']，因为 triggerEvent 默认依赖碰撞事件
