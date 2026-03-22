# DifficultyRamp — 难度递增模块

## 基本信息
- 类型: mechanic
- 类名: DifficultyRamp
- 注册名: `DifficultyRamp`

## 功能原理

DifficultyRamp 随时间或分数递进修改目标模块的参数，实现渐进式难度提升。支持两种触发模式：时间模式（time）按固定间隔调整，分数模式（score）按分数里程碑调整。每条规则（rule）指定目标参数、增减量和上下限。模块通过 `engine.getModule(target)` 获取目标模块并调用 `configure()` 修改参数。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| target | string | `''` | — | 目标模块 ID |
| rules | object | `[]` | — | 难度递增规则数组 |
| mode | select | `'time'` | `time / score` | 触发模式 |

### 难度规则结构 (DifficultyRule)

| 字段 | 类型 | 说明 |
|------|------|------|
| every | number | 触发间隔：time 模式为秒数，score 模式为分数里程碑 |
| field | string | 目标模块的参数名（如 `'frequency'`、`'speed'`） |
| increase | number | 每次增加的量（可选） |
| decrease | number | 每次减少的量（可选） |
| min | number | 参数下限（可选） |
| max | number | 参数上限（可选） |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `difficulty:update` | `{ field: string, value: number, target: string }` | 每次应用规则修改参数后发出 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `scorer:update` | score 模式下获取当前分数用于里程碑判断 |

## 与其他模块连接方式

- **Spawner**: 常见目标，修改 `frequency`（加快生成）或 `speed`（提高速度）
- **Scorer**: score 模式下监听 `scorer:update` 获取分数
- **Timer**: time 模式下根据经过时间触发规则

## 适用游戏类型

- **runner**（跑酷类）— 核心模块，随时间加速
- **catch**（接住类）— 随分数增加下落速度
- **dodge**（躲避类）— 随时间增加障碍物频率
- **shooting**（射击类）— 随分数增加目标速度
- **rhythm**（节奏类）— 随进度加快节拍

## 常见问题 & 边界情况

- target 必须与目标模块的 id（非 type）匹配
- 目标参数必须为 number 类型，非数值类型会被跳过
- 同一条规则中 increase 和 decrease 都存在时先加后减
- min/max 为可选参数，设置后参数值会被 clamp
- time 模式的 elapsed 以毫秒输入（dt），内部转为秒
- score 模式通过 lastScoreMilestone 追踪，确保每个里程碑只触发一次
- `reset()` 会重置所有计时器和分数追踪
- 如果目标模块不存在（`engine.getModule()` 返回 null），规则静默跳过

### 常见规则示例

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
上述配置：每 10 秒将 Spawner 的生成间隔减少 0.1（最快 0.5 秒），每 15 秒将速度增加 20（最高 400）。
