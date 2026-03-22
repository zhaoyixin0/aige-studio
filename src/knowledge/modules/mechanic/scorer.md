# Scorer — 计分系统模块

## 基本信息
- 类型: mechanic
- 类名: Scorer
- 注册名: `Scorer`

## 功能原理

Scorer 管理游戏分数，支持连击（combo）系统。收到 `collision:hit` 事件时加分，加分值 = perHit * 连击倍率。连击系统通过时间窗口判断：如果两次 hit 之间的间隔在 combo.window 内则连击数+1，否则重置。连击倍率从 multiplier 数组中按连击次数索引取值。可选开启扣分功能：当物体出界（`spawner:destroyed`）时扣除指定分数。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| perHit | number | `10` | min: 1 | 每次击中的基础得分 |
| combo | object | `{ enabled: false, window: 1000, multiplier: [1, 1.5, 2] }` | — | 连击系统配置 |
| combo.enabled | boolean | `false` | — | 是否启用连击 |
| combo.window | number | `1000` | min: 100 | 连击时间窗口（毫秒） |
| combo.multiplier | number[] | `[1, 1.5, 2]` | — | 连击倍率数组，索引对应连击次数-1 |
| deductOnMiss | boolean | `false` | — | 是否在物体出界时扣分 |
| deductAmount | number | `5` | min: 0 | 扣分量 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `scorer:update` | `{ score: number, delta: number, combo: number }` | 每次得分或扣分时发出 |
| `scorer:combo:{N}` | （无数据） | 连击次数 >= 3 时发出，N 为连击数 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `collision:hit` | 触发 onHit()，增加分数并计算连击 |
| `spawner:destroyed` | 当 deductOnMiss 为 true 时触发 onMiss()，扣分 |

## 与其他模块连接方式

- **Collision**: 监听 `collision:hit` 加分
- **Spawner**: 监听 `spawner:destroyed` 扣分（可选）
- **UIOverlay**: `scorer:update` → UIOverlay 更新分数显示
- **DifficultyRamp**: `scorer:update` → DifficultyRamp 以分数为触发模式调整难度
- **ResultScreen**: 游戏结束后 ResultScreen 调用 `scorer.getScore()` 获取最终分数

## 适用游戏类型

- **catch**（接住类）— 接住物体加分，漏接扣分
- **dodge**（躲避类）— 存活加时间分
- **quiz**（答题类）— 答对加分（通过 QuizEngine 的 `quiz:score`）
- **tap**（点击类）— 点中目标加分
- **shooting**（射击类）— 击中目标加分
- **runner**（跑酷类）— 收集金币加分
- **rhythm**（节奏类）— 按中节拍加分
- **gesture**（手势互动类）— 正确手势加分

## 常见问题 & 边界情况

- 分数不会低于 0，`Math.max(0, score + delta)` 保证下限
- 连击倍率数组不够长时取最后一个值：`multiplierArray[Math.min(comboCount-1, length-1)]`
- 连击超时判断在 `update()` 中执行，超出 window 后 comboCount 归零
- 连击事件 `scorer:combo:{N}` 仅在 N >= 3 时发出
- delta 会四舍五入 `Math.round(perHit * multiplier)`
- deductOnMiss 需在 `init()` 时就设置好，因为事件监听在 init 中注册
