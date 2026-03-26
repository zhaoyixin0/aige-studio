# DifficultyRamp — 难度递增模块

## 基本信息
- 类型: mechanic
- 类名: `DifficultyRamp`
- 注册名: `DifficultyRamp`
- 依赖: `requires: []`, `optional: ['Scorer']`
- 源码: `src/engine/modules/mechanic/difficulty-ramp.ts`

## 功能原理

DifficultyRamp 随时间或分数递进修改目标模块的数值型参数，实现渐进式难度提升。它是连接游戏进程和参数调节的桥梁模块。

### 两种触发模式

1. **time 模式**（默认） — 每隔 `rule.every` 秒执行一次参数调整。基于 `update(dt)` 累积时间计算，精度取决于帧率。
2. **score 模式** — 每达到 `rule.every` 分的里程碑执行一次调整。监听 `scorer:update` 事件获取当前分数，通过 `lastScoreMilestone` 追踪确保每个里程碑只触发一次。

### 执行流程
```
update(dt) 每帧调用
  ├── time 模式: 累积时间 → 达到 every 秒 → applyRule()
  └── score 模式: 检查 currentScore → 达到里程碑 → applyRule()

applyRule(rule):
  1. engine.getModule(target) 获取目标模块
  2. 读取目标参数当前值
  3. 应用 increase / decrease
  4. clamp 到 min / max
  5. target.configure({ [field]: newValue })
  6. emit('difficulty:update', { field, value, target })
```

### 难度曲线类型

DifficultyRamp 通过规则参数的配置，可以实现多种难度曲线：

| 曲线类型 | 实现方式 | 适用场景 |
|---------|---------|---------|
| **线性递增** | 固定 increase/decrease + min/max 边界 | 最常见，适合大多数休闲游戏 |
| **阶梯式** | 多条规则，不同 every 间隔 | 明确的难度"关卡"感 |
| **对数式** | 初始 increase 大，后期设置接近 max 的上限 | 前期快速变难，后期趋于稳定 |
| **分数驱动** | score 模式 + 合理里程碑 | 技巧越好难度越高，自适应体验 |

**业界参考**：
- Subway Surfers — 速度线性递增直到上限，属于线性 + 天花板模式
- Fruit Ninja — 随时间增加水果密度和炸弹频率，带上限
- Candy Crush — 关卡设计（阶梯式），非实时递增

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| target | string | `''` | 任意模块 ID | — | 目标模块的实例 ID（非 type） |
| rules | object | `[]` | DifficultyRule[] | 1~5 条 | 难度递增规则数组 |
| mode | select | `'time'` | `time` / `score` | — | 触发模式 |

### DifficultyRule 结构

| 字段 | 类型 | 必填 | 有效范围 | 说明 |
|------|------|------|----------|------|
| every | number | 是 | > 0 | 触发间隔：time 模式为秒，score 模式为分数里程碑 |
| field | string | 是 | — | 目标模块的参数名（如 `frequency`、`speed`） |
| increase | number | 否 | 任意正数 | 每次增加量 |
| decrease | number | 否 | 任意正数 | 每次减少量 |
| min | number | 否 | — | 参数下限 |
| max | number | 否 | — | 参数上限 |

**注意**：`increase` 和 `decrease` 可以同时存在（先加后减），但通常只需设其一。

### 参数推荐值（按游戏类型和目标模块）

| 游戏类型 | target | 目标参数 | mode | every | increase/decrease | min/max |
|---------|--------|---------|------|-------|-------------------|---------|
| catch | spawner | frequency | time | 10s | decrease: 0.1 | min: 0.5 |
| catch | spawner | speed.min/max | time | 15s | increase: 20 | max: 400 |
| dodge | spawner | frequency | time | 8s | decrease: 0.15 | min: 0.3 |
| shooting | spawner | speed.min/max | score | 100 | increase: 15 | max: 350 |
| runner | spawner | frequency | time | 5s | decrease: 0.05 | min: 0.2 |
| tap | spawner | frequency | time | 10s | decrease: 0.1 | min: 0.8 |
| rhythm | spawner | speed.min/max | time | 20s | increase: 10 | max: 300 |

## 参数调优指南

### every 间隔设计
- **time 模式**：
  - 30 秒游戏 → every = 5~8s（约 4~6 次调整）
  - 60 秒游戏 → every = 8~15s（约 4~8 次调整）
  - 无限模式 → every = 10~20s（持续递增直到上限）
  - 经验法则：游戏总时长 / 5 ≈ every
- **score 模式**：
  - every 应设为期望平均分的 15%~25%
  - 例如目标平均分 500 → every = 100（每 100 分难度递增一次，共 5 级）

### increase/decrease 幅度
- **渐进策略**：每次调整量 = 参数总范围 / 预期调整次数
  - 例如 frequency 从 2.0 降到 0.5（范围 1.5），预期 10 次调整 → decrease = 0.15
- **Spawner.frequency**：decrease 推荐 0.05~0.2，不要一次性下降太多
- **Spawner.speed**：increase 推荐 10~30 像素/秒
- 过大的 increase/decrease 会导致"突然变难"的体验，破坏流畅感

### min/max 边界（关键）
- **务必设置 min/max**，否则参数会无限增减导致游戏不可玩
- Spawner.frequency 的 min 建议 >= 0.3（每 0.3 秒生成一个，已经非常密集）
- Spawner.speed 的 max 建议 <= 500（超过后玩家几乎无法反应）
- 良好的 max 设计参考 Fruit Ninja：最高难度下仍给玩家约 500ms 的反应时间

### mode 选择
- **time 模式**（推荐用于大多数游戏）：可预测，设计师完全掌控节奏
- **score 模式**：自适应，高手更快遇到高难度，新手在低难度停留更久
- 竞技公平性需求 → time 模式（所有人面对相同难度曲线）
- 个性化体验 → score 模式（技术越好越有挑战）

### 多规则协调
- 多条规则可以不同 every 值：如 frequency 每 10s 调一次，speed 每 15s 调一次
- 避免多条规则同时叠加导致"难度峰值"：错开 every 值
- 推荐用质数或不同公倍数的 every 值避免同步触发

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `difficulty:update` | `{ field: string, value: number, target: string }` | 每次成功应用规则后 |

**`difficulty:update` 的典型消费方**：
- UIOverlay — 可显示"难度提升!"提示
- 调试/分析 — 追踪难度变化轨迹

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `scorer:update` | Scorer | score 模式下获取 `data.score` 更新 currentScore |

## 跨模块联动规则

### 与 Spawner 的联动（最常见）
- DifficultyRamp 的主要目标是 Spawner，通过修改 `frequency`（生成频率）和 `speed`（物体速度）实现难度递增
- target 必须是 Spawner 实例的 **ID**（非类型名），例如 `'spawner1'`
- 可修改的 Spawner 参数：`frequency`、`speed`（注意 speed 是对象 `{ min, max }`，需要修改 `speed` 下的子字段或直接设置整个对象）

### 与 Scorer 的联动
- **score 模式**：监听 `scorer:update` 获取分数驱动递增
- DifficultyRamp 不直接修改 Scorer 参数（perHit 等），但可以通过修改 Spawner 间接影响得分节奏
- 如需动态调整 perHit，可添加额外 DifficultyRamp 实例以 Scorer 为 target

### 与 Timer 的联动
- time 模式下 DifficultyRamp 自身追踪时间（不依赖 Timer 模块）
- 但 GameFlow 暂停时 DifficultyRamp 的 `update()` 也暂停（`gameflowPaused` 检查）
- Timer.duration 限制了 time 模式下最大调整次数：`Math.floor(duration / every)`

### 与 ComboSystem 的联动
- 无直接联动
- 但 DifficultyRamp 加快 Spawner.frequency 后，目标出现更频繁，间接有利于维持 combo

### 多个 DifficultyRamp 实例
- 可以为不同目标模块各添加一个 DifficultyRamp 实例
- 例如：DifficultyRamp(target:spawner1) + DifficultyRamp(target:spawner2)
- 也可以一个实例通过多条 rules 修改同一目标的多个参数

## 输入适配

DifficultyRamp 不直接处理输入，它是纯后台调节模块。所有输入方式均兼容。

## 常见 Anti-Pattern

**1. target 使用 type 名而非实例 ID**
- ❌ `target: 'Spawner'` — `engine.getModule('Spawner')` 可能找不到（取决于注册方式）
- ✅ `target: 'spawner1'` — 使用模块配置中的实际 ID

**2. 不设置 min/max 边界**
- ❌ `{ every: 5, field: 'frequency', decrease: 0.2 }` — frequency 最终降到 0 甚至负数
- ✅ `{ every: 5, field: 'frequency', decrease: 0.2, min: 0.3 }` — 有合理下限

**3. increase 和 decrease 同时设置（非预期）**
- ❌ `{ increase: 10, decrease: 5 }` — 实际效果是 +5（先加后减），令人困惑
- ✅ 只设 `increase: 5` 或只设 `decrease: 5`

**4. every 间隔过短**
- ❌ `every: 1`（每秒调整一次）— 难度变化过快，玩家无法适应
- ✅ `every: 8~15` — 给玩家 8~15 秒适应当前难度

**5. rules 为空数组**
- ❌ `rules: []` — 模块存在但什么都不做，浪费资源
- ✅ 至少配置 1 条规则，或不添加 DifficultyRamp 模块

**6. score 模式但无 Scorer 模块**
- ❌ `mode: 'score'` 但未添加 Scorer 模块 — currentScore 永远为 0
- ✅ score 模式必须确保 Scorer 模块已添加

**7. 目标参数为非数值类型**
- ❌ `field: 'direction'`（string 类型）— `typeof currentValue !== 'number'` 导致跳过
- ✅ 只能修改数值型参数：`frequency`、`speed`、`maxCount` 等

## 常见问题 & 边界情况

- target 必须与目标模块的 **id**（非 type）匹配
- 目标参数必须为 number 类型，非数值类型会被静默跳过
- 同一条规则中 increase 和 decrease 都存在时先加后减（不推荐此用法）
- min/max 为可选参数，设置后参数值会被 clamp
- time 模式的 dt 以毫秒输入，内部转为秒（`dt / 1000`）
- time 模式使用 `while` 循环处理：如果一帧 dt 非常大（如切后台回来），可能一次触发多次规则
- score 模式通过 lastScoreMilestone 追踪，确保每个里程碑只触发一次
- score 模式下如果分数快速增长，也会通过 `while` 循环一次触发多个里程碑
- `reset()` 重置所有计时器、分数追踪和 warnedMissingTarget 标志
- 如果目标模块不存在，首次调用 applyRule 时打印 console.warn，后续静默跳过（`warnedMissingTarget` 标志）
- `configure()` 是直接修改目标模块参数（mutation），非不可变更新
- 嵌套参数（如 `speed.min`）当前实现不支持点号路径解析，只能修改顶层参数

### 常见规则示例

**线性递增（catch 游戏）：**
```json
{
  "target": "spawner1",
  "mode": "time",
  "rules": [
    { "every": 10, "field": "frequency", "decrease": 0.1, "min": 0.5 },
    { "every": 15, "field": "speed", "increase": 20, "max": 400 }
  ]
}
```
每 10 秒生成间隔减少 0.1（最快 0.5 秒），每 15 秒速度增加 20（最高 400）。

**分数驱动（shooting 游戏）：**
```json
{
  "target": "spawner1",
  "mode": "score",
  "rules": [
    { "every": 200, "field": "frequency", "decrease": 0.15, "min": 0.4 },
    { "every": 300, "field": "speed", "increase": 25, "max": 350 }
  ]
}
```
每 200 分生成间隔减少 0.15，每 300 分速度增加 25。技术好的玩家更快遇到高难度。
