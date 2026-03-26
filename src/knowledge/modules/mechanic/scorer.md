# Scorer — 计分系统模块

## 基本信息
- 类型: mechanic
- 类名: `Scorer`
- 注册名: `Scorer`
- 依赖: `requires: ['Collision']`, `optional: ['ComboSystem']`
- 源码: `src/engine/modules/mechanic/scorer.ts`

## 功能原理

Scorer 是游戏计分的核心模块，负责分数的计算、累积和广播。支持两种计分模式：

1. **事件计分** — 监听 hitEvent（默认 `collision:hit`），每次触发加 `perHit * comboMultiplier` 分
2. **生存计分** — 通过 `scorePerSecond` 参数按时间持续累积分数（适用于 dodge/runner 类）

内置可选的 combo 子系统（`combo.enabled`），通过时间窗口判断连击：两次 hit 间隔在 `combo.window` 内则连击数+1，否则重置为 1。连击倍率从 `combo.multiplier` 数组按索引取值（索引 = comboCount - 1，超出数组长度取最后一个值）。

可选扣分功能：监听 `spawner:destroyed` 事件，物体出界时扣除指定分数（分数下限为 0）。

### 计分公式
```
单次得分 = Math.round(perHit * multiplierArray[min(comboCount-1, arrayLength-1)])
生存得分 = scorePerSecond * (dt / 1000)，累积到整数后发出
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| perHit | number | `10` | min: 1 | 5~100 | 每次击中的基础得分 |
| combo | object | `{ enabled: false, window: 1000, multiplier: [1, 1.5, 2] }` | — | — | 内置 combo 配置对象 |
| combo.enabled | boolean | `false` | — | — | 是否启用内置 combo |
| combo.window | number | `1000` | min: 100 | 800~2000ms | 连击时间窗口（毫秒） |
| combo.multiplier | number[] | `[1, 1.5, 2]` | 每项 >= 0 | 3~6 项 | 连击倍率数组，索引对应 comboCount-1 |
| deductOnMiss | boolean | `false` | — | — | 是否在物体出界时扣分 |
| deductAmount | number | `5` | min: 0 | 1~20 | 每次扣分量 |
| hitEvent | string | `'collision:hit'` | 任意事件名 | — | 触发加分的事件名 |
| scorePerSecond | number | `0` | min: 0 | 1~10 | 生存计分速率（分/秒），0=关闭 |

### 参数推荐值（按游戏类型）

| 游戏类型 | perHit | combo.window | combo.multiplier | deductOnMiss | scorePerSecond |
|---------|--------|-------------|-----------------|--------------|---------------|
| catch | 10 | 1000ms | [1, 1.5, 2, 3] | true (deductAmount: 5) | 0 |
| tap | 10 | 800ms | [1, 1.5, 2, 2.5] | false | 0 |
| shooting | 25 | 1500ms | [1, 1.2, 1.5, 2] | false | 0 |
| dodge | 0 | — | — | false | 5 |
| runner | 5 | 1200ms | [1, 1.5, 2] | false | 2 |
| rhythm | 50 | 600ms | [1, 1.2, 1.5, 2, 3] | false | 0 |

## 参数调优指南

### perHit 与 combo.multiplier 的关系
- `perHit` 决定基础分数粒度，`combo.multiplier` 决定连击奖励幅度
- **高 perHit + 低 multiplier**：分数差距小，适合休闲向（如 Candy Crush 风格）
- **低 perHit + 高 multiplier**：分数严重依赖连击，适合技巧向（如 Fruit Ninja 风格）
- 推荐最大 multiplier 不超过 5x，否则分数方差过大失去平衡感

### combo.window 调优
- **< 800ms**：硬核节奏游戏，要求快速连续操作
- **800~1500ms**：标准休闲游戏窗口，Fruit Ninja 约 1000ms
- **1500~3000ms**：宽松模式，适合儿童向或低操作频率的游戏
- combo.window 应略大于游戏中两个目标的平均出现间隔，否则玩家难以维持连击

### combo.multiplier 数组设计
- 数组长度决定 combo 的"天花板"，建议 3~6 项
- 参考 Subway Surfers 的设计：前几级涨幅大（激励开始连击），后几级涨幅趋缓（防止分数爆炸）
- 示例渐进式：`[1, 1.5, 2, 2.5, 3]` — 线性增长
- 示例激进式：`[1, 2, 3, 5]` — 指数增长，适合技巧向

### scorePerSecond 与事件计分的配合
- dodge 类游戏通常只用 `scorePerSecond`（perHit=0 或不触发 hitEvent）
- runner 类游戏两者结合：存活给底分 + 收集物加分
- 两者同时工作时，生存得分的 combo 字段为 0（不参与 combo 计算）

### deductOnMiss 影响
- 开启扣分增加游戏惩罚性，适合 catch 类
- `deductAmount` 建议设为 `perHit` 的 30%~80%，过高会让玩家感觉惩罚过重
- 扣分不会触发 combo 重置（当前实现），但 combo 字段在 `scorer:update` 中为 0

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `scorer:update` | `{ score: number, delta: number, combo: number }` | 每次得分或扣分时发出 |
| `scorer:combo:{N}` | `{ combo: number }` | comboCount >= 3 时发出，N 为当前连击数 |

**`scorer:update` 是整个引擎最高频的下游信号之一**，被以下模块消费：
- UIOverlay — 更新分数 HUD 显示
- DifficultyRamp（score 模式） — 驱动难度递增
- ComboSystem — 追踪 combo 事件信号
- ResultScreen — 最终分数来源

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `collision:hit`（或自定义 hitEvent） | Collision | 触发 onHit()，加分 + combo 计算 |
| `spawner:destroyed` | Spawner | 当 deductOnMiss=true 时触发 onMiss()，扣分 |

## 跨模块联动规则

### Scorer 内置 combo vs 独立 ComboSystem — 选择决策树

```
需要 combo 功能吗？
├── 否 → combo.enabled = false，不添加 ComboSystem
└── 是 → combo 只用于分数倍率吗？
    ├── 是 → 使用 Scorer 内置 combo（combo.enabled = true）
    │        不要添加 ComboSystem 模块
    └── 否 → 需要以下任何功能吗？
        ├── combo 信号驱动视觉特效（ParticleVFX、ScreenShake）
        ├── combo 信号驱动音效变化（SoundFX）
        ├── combo 倍率公式为线性递增（而非数组索引）
        ├── combo 需要不同于分数计算的独立窗口时间
        └── combo 需要 combo:break 事件通知其他模块
            └── 是 → 使用独立 ComboSystem 模块
                     Scorer.combo.enabled = false（关闭内置 combo）
```

**关键原则：不要同时使用 Scorer 内置 combo 和 ComboSystem 模块。** 两者独立追踪 combo 计数，会导致：
1. 双重 combo 计数 — 两套独立的 comboCount 和 lastHitTime
2. 不同步的窗口 — Scorer.combo.window 和 ComboSystem.comboWindow 可能不同
3. 令人困惑的 combo 显示 — UIOverlay 从 `scorer:update.combo` 读取，特效从 `combo:hit.count` 读取，数值可能不一致

### 与 DifficultyRamp 的联动
- DifficultyRamp（score 模式）监听 `scorer:update` 获取当前分数
- DifficultyRamp 可修改 Spawner 的 frequency/speed，间接影响 Scorer 的得分节奏
- 注意：DifficultyRamp 不会修改 Scorer 自身的参数（perHit 等），如需动态调整分数需额外规则

### 与 Timer 的联动
- Timer 不直接与 Scorer 交互
- 但 `timer:end` → GameFlow → 暂停所有模块（包括 Scorer）
- 生存计分（scorePerSecond）依赖 update() 循环，GameFlow 暂停后自动停止

## 输入适配

Scorer 不直接处理输入，通过 hitEvent 间接响应。不同输入方式的事件链：

| 输入方式 | 事件链 |
|---------|-------|
| TouchInput | touch → 移动 player 位置 → Collision 检测 → `collision:hit` → Scorer |
| FaceInput | 面部追踪 → 更新 player 位置 → Collision 检测 → `collision:hit` → Scorer |
| HandInput | 手部追踪 → 更新 player 位置 → Collision 检测 → `collision:hit` → Scorer |
| DeviceInput | 设备倾斜 → 移动 player → Collision 检测 → `collision:hit` → Scorer |
| BodyInput | 身体追踪 → 更新 player 位置 → Collision 检测 → `collision:hit` → Scorer |
| AudioInput | 音量/音高 → 移动 player → Collision 检测 → `collision:hit` → Scorer |

## 常见 Anti-Pattern

**1. Scorer 内置 combo 和 ComboSystem 同时启用**
- ❌ `Scorer.combo.enabled = true` + 添加 ComboSystem 模块
- ✅ 二选一：简单需求用 Scorer 内置 combo，复杂需求用独立 ComboSystem

**2. 连击倍率数组只有一个元素**
- ❌ `combo.multiplier = [2]` — 任何连击数都是 2x，失去渐进感
- ✅ `combo.multiplier = [1, 1.5, 2, 2.5]` — 提供清晰的连击成长曲线

**3. 生存计分和事件计分混淆**
- ❌ dodge 类游戏设置 `perHit = 10` 但没有 `collision:hit` 事件源
- ✅ dodge 类设置 `scorePerSecond = 5`，`perHit` 保持默认但无实际触发

**4. combo.window 远小于目标出现间隔**
- ❌ Spawner.frequency = 3s 但 combo.window = 500ms — 玩家永远无法连击
- ✅ combo.window 应 >= Spawner.frequency * 1.2（给予缓冲）

**5. deductAmount 大于 perHit**
- ❌ `perHit = 10`, `deductAmount = 20` — 玩家一次失误抵两次成功，过于惩罚
- ✅ `deductAmount` <= `perHit * 0.8`

**6. 忘记 hitEvent 自定义**
- ❌ QuizEngine 发出 `quiz:correct` 但 Scorer 监听默认 `collision:hit` — 永远不加分
- ✅ 设置 `hitEvent = 'quiz:correct'` 匹配实际事件源

## 常见问题 & 边界情况

- 分数下限为 0，`Math.max(0, score + delta)` 保证不会出现负分
- 连击倍率数组不够长时取最后一个值：`multiplierArray[Math.min(comboCount-1, length-1)]`
- 连击超时判断在 `update()` 中执行，超出 window 后 comboCount 归零
- 连击事件 `scorer:combo:{N}` 仅在 N >= 3 时发出
- delta 使用 `Math.round()` 四舍五入，可能导致 perHit=7, multiplier=1.5 时得分为 11 而非 10.5
- deductOnMiss 在 `init()` 中注册监听，运行时切换无效
- scorePerSecond 使用累加器避免浮点精度丢失，累积到整数才发出 `scorer:update`
- 生存计分的 `scorer:update` 中 combo 字段固定为 0
- `reset()` 清零 score、comboCount、lastHitTime、scoreAccumulator
- combo.enabled=false 时 comboCount 固定为 1（不是 0），multiplier 取数组[0]
