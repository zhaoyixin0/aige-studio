# ComboSystem — 连击信号系统模块

## 基本信息
- 类型: mechanic
- 类名: `ComboSystem`
- 注册名: `ComboSystem`
- 依赖: `requires: ['Scorer']`, `optional: []`
- 源码: `src/engine/modules/mechanic/combo-system.ts`

## 功能原理

ComboSystem 是一个**独立的连击事件信号模块**，专职于向引擎广播 combo 状态变化（`combo:hit` / `combo:break`），供视觉特效、音效、HUD 等下游模块消费。

它监听 `scorer:update` 事件，独立维护 combo 计数和时间窗口。当连续得分事件在 `comboWindow` 时间内发生时，combo 计数递增并计算当前倍率（线性公式）；当窗口超时后重置并发出 `combo:break`。

### 与 Scorer 内置 combo 的根本区别

| 维度 | Scorer 内置 combo | ComboSystem |
|------|-------------------|-------------|
| **职责** | 计算分数倍率（影响实际得分） | 广播 combo 信号（不影响分数） |
| **倍率模型** | 数组索引（离散阶梯式） | 线性递增公式（连续式） |
| **输出** | 直接修改 delta 值 | 发出 `combo:hit` / `combo:break` 事件 |
| **适用场景** | 简单的分数倍率需求 | 需要 combo 驱动视觉/音效/多模块联动 |

### 倍率计算公式
```
multiplier = min(1 + (comboCount - 1) * multiplierStep, maxMultiplier)
```
例如：multiplierStep=0.5, maxMultiplier=5 时：
- combo 1 → 1.0x
- combo 2 → 1.5x
- combo 3 → 2.0x
- combo 9 → 5.0x（达到上限）

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| comboWindow | range | `2000` | 500~5000ms，步长 100 | 1000~3000ms | 连击时间窗口（毫秒） |
| multiplierStep | range | `0.5` | 0.1~1.0，步长 0.1 | 0.2~0.5 | 每次连击增加的倍率 |
| maxMultiplier | range | `5` | 2~10，步长 0.5 | 3~6 | 倍率上限 |

### 参数推荐值（按游戏类型）

| 游戏类型 | comboWindow | multiplierStep | maxMultiplier | 说明 |
|---------|-------------|---------------|---------------|------|
| catch | 2000ms | 0.5 | 5 | 中等窗口，给予玩家足够反应时间 |
| tap | 1500ms | 0.3 | 4 | 快速点击但窗口不宜过窄 |
| shooting | 2500ms | 0.4 | 6 | 射击频率低，窗口稍宽 |
| runner | 2000ms | 0.5 | 5 | 收集物间隔可控，标准配置 |
| rhythm | 1000ms | 0.2 | 3 | 节拍密集但倍率不宜过高 |

### 参数间关联

- **comboWindow vs Spawner.frequency**：comboWindow 应 >= 目标出现间隔 * 1.5，否则 combo 难以维持
- **multiplierStep vs maxMultiplier**：到达 maxMultiplier 所需的 combo 数 = `(maxMultiplier - 1) / multiplierStep + 1`。例如 step=0.5, max=5 时需要 9 连击达到上限
- **comboWindow 与 Scorer.combo.window 的关系**：如果 ComboSystem 和 Scorer 内置 combo 同时存在（不推荐），两者窗口独立，可能导致 combo 状态不同步

## 参数调优指南

### comboWindow 调优
- 参考业界标准：Fruit Ninja combo 窗口约 1000ms，Subway Surfers 约 2000ms
- **休闲游戏**（catch/tap）：1500~2500ms — 宽松窗口降低挫败感
- **技巧游戏**（rhythm/shooting）：800~1500ms — 紧凑窗口体现技术差距
- **生存游戏**（dodge/runner）：2000~3000ms — 长窗口持续奖励存活
- 经验法则：comboWindow = Spawner.frequency * 2（两个目标间隔的 2 倍）

### multiplierStep 调优
- **线性平缓**（0.1~0.2）：适合长时间游戏，防止分数爆炸
- **线性标准**（0.3~0.5）：适合中等时长，combo 感知明显
- **线性激进**（0.6~1.0）：适合短时爆发型游戏，每次连击奖励显著

### maxMultiplier 调优
- 参考 Subway Surfers 最大 30x（含永久+临时加成），但休闲小游戏建议 3~6x
- 过高的 maxMultiplier 会导致高手和新手分数差距过大
- 推荐公式：`maxMultiplier = 游戏时长(秒) / 20 + 2`（30 秒游戏 ≈ 3.5x，60 秒 ≈ 5x）

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `combo:hit` | `{ count: number, multiplier: number }` | 每次收到 `scorer:update` 且在窗口内时 |
| `combo:break` | （无数据） | combo 窗口超时后在 update() 中触发 |

**`combo:hit` 的典型消费方**：
- ParticleVFX — combo 数越高特效越华丽
- SoundFX — combo 连击音效升调
- UIOverlay — 显示 "x3 COMBO!" 等 HUD 提示
- FloatText — 在碰撞点弹出连击数字

**`combo:break` 的典型消费方**：
- ParticleVFX — 停止 combo 特效
- SoundFX — 播放 combo 断裂音效
- UIOverlay — 隐藏 combo 显示

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `scorer:update` | Scorer | 触发 onHit()，更新 combo 计数和倍率 |

## 跨模块联动规则

### 与 Scorer 的职责划分（最重要）

```
Scorer（计分核心）          ComboSystem（combo 信号中心）
┌───────────────────┐      ┌───────────────────┐
│ 拥有 score 状态    │      │ 拥有 combo 状态    │
│ 计算 delta 并累加  │      │ 追踪 combo 计数    │
│ 可选内置 combo 倍率 │─────→│ 监听 scorer:update │
│ 发出 scorer:update │      │ 发出 combo:hit     │
│                   │      │ 发出 combo:break   │
└───────────────────┘      └───────────────────┘
         ↓                          ↓
    UIOverlay 分数显示        ParticleVFX/SoundFX/HUD
```

**黄金规则**：
1. 如果只需要 combo 影响分数 → 用 Scorer 内置 combo（`combo.enabled = true`），不加 ComboSystem
2. 如果需要 combo 驱动特效/音效/HUD → 用 ComboSystem，关闭 Scorer 内置 combo（`combo.enabled = false`）
3. **永远不要两者同时启用** — 会导致双重追踪、窗口不同步、显示混乱

### 与反馈模块的联动
- **ParticleVFX**：监听 `combo:hit`，combo count 越高粒子越多/颜色越亮
- **SoundFX**：监听 `combo:hit`，可按 multiplier 调整音效频率或音量
- **UIOverlay**：监听 `combo:hit` 显示 combo 计数器，监听 `combo:break` 隐藏

### 与 DifficultyRamp 的联动
- DifficultyRamp 不直接与 ComboSystem 交互
- 但 DifficultyRamp 修改 Spawner 参数会间接影响 combo 维持难度（目标出现越频繁，combo 越容易维持）

## 输入适配

ComboSystem 不直接处理输入，它是纯信号模块。事件链为：

```
任意输入 → Collision → scorer:update → ComboSystem → combo:hit/combo:break
```

所有 6 种输入方式均兼容，无需特殊适配。

## 常见 Anti-Pattern

**1. 与 Scorer 内置 combo 同时使用**
- ❌ `Scorer.combo.enabled = true` + 添加 ComboSystem 模块
- ✅ 关闭 `Scorer.combo.enabled = false`，仅使用 ComboSystem

**2. 期望 ComboSystem 影响实际得分**
- ❌ 以为 ComboSystem 的 multiplier 会影响 Scorer 的 delta 计算
- ✅ ComboSystem 只发信号，不修改分数。如需倍率影响分数，用 Scorer 内置 combo

**3. comboWindow 设置过短**
- ❌ `comboWindow = 500ms` 在 Spawner.frequency = 2s 的游戏中 — combo 永远到不了 2
- ✅ comboWindow >= Spawner.frequency * 1.5

**4. maxMultiplier 设置过高**
- ❌ `maxMultiplier = 10`, `multiplierStep = 0.1` — 需要 91 连击才到上限，无意义
- ✅ 设计合理的"天花板"：典型游戏中玩家平均连击数 * 2 = maxMultiplier 对应的连击数

**5. 忘记处理 combo:break**
- ❌ 只监听 `combo:hit` 显示 combo 特效，但不监听 `combo:break` 清除
- ✅ 成对处理 `combo:hit` 和 `combo:break`，确保 UI/特效状态一致

**6. 在无 Scorer 的场景使用 ComboSystem**
- ❌ ComboSystem 依赖 `scorer:update` 事件，没有 Scorer 模块时永远不会触发
- ✅ 确保 Scorer 模块已添加并正确配置

## 常见问题 & 边界情况

- ComboSystem 监听**所有** `scorer:update` 事件，包括扣分（delta < 0）和生存计分（combo=0）。当前实现中，扣分事件也会触发 onHit() 导致 combo 递增 — 这是一个已知问题
- combo:break 在 update() 中触发，不是在 onHit() 中。如果窗口刚好超时后立即收到新 hit，可能出现短暂的"先 break 再 hit"序列
- `getComboCount()` 和 `getMultiplier()` 是同步查询接口，适合 ResultScreen 在游戏结束时读取
- `reset()` 将 comboCount 和 lastHitTime 归零
- comboCount=0 时 `getMultiplier()` 返回 1（非 0）
- `void dt` 语句用于消除 TypeScript 未使用参数警告，无实际逻辑
- combo:hit 在每次 `scorer:update` 时都发出（只要在窗口内），不做最小 combo 数过滤。UI 侧可自行过滤（如只在 count >= 3 时显示）
