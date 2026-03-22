# Randomizer — 随机抽取器模块

## 基本信息
- 类型: mechanic
- 类名: Randomizer
- 注册名: `Randomizer`

## 功能原理

Randomizer 实现随机抽取/转盘功能。从候选项列表（items）中按权重随机选取结果。支持四种动画类型：转盘（wheel）、老虎机（slot）、卡牌翻转（card）和即时显示（instant）。触发方式可配置为点击（tap）、自动（auto）或张嘴（mouthOpen）。旋转过程中发出 `randomizer:spinning`，结束后发出 `randomizer:result`。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| items | asset[] | `[]` | — | 候选项列表，每项包含 `{ asset: string, label: string, weight: number }` |
| animation | select | `'wheel'` | `wheel / slot / card / instant` | 动画类型 |
| spinDuration | range | `3` | `1 ~ 10`，单位秒 | 旋转/动画时长 |
| trigger | select | `'tap'` | `tap / auto / mouthOpen` | 触发方式 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `randomizer:spinning` | （无数据） | 开始旋转时触发 |
| `randomizer:result` | `{ item: RandomizerItem, index: number }` | 旋转结束、结果确定时触发 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `input:touch:tap` | trigger 为 `'tap'` 时启动旋转 |
| `input:face:mouthOpen` | trigger 为 `'mouthOpen'` 时启动旋转 |

## 与其他模块连接方式

- **TouchInput**: trigger = `'tap'` 时，TouchInput 发出 `input:touch:tap` → Randomizer 开始旋转
- **FaceInput**: trigger = `'mouthOpen'` 时，FaceInput 发出 `input:face:mouthOpen` → Randomizer 开始旋转
- **SoundFX**: `randomizer:spinning` 和 `randomizer:result` 可映射音效
- **ParticleVFX**: `randomizer:result` 可触发庆祝特效

## 适用游戏类型

- **random-wheel**（随机转盘类）— 核心模块

## 常见问题 & 边界情况

- items 为空时调用 `spin()` 不执行任何操作
- 旋转过程中再次调用 `spin()` 会被忽略（spinning = true 时返回）
- 加权随机：weight 默认为 1，weight 越大被选中概率越高
- spinDuration 内部以秒为单位，update 中 `dt / 1000` 转换
- auto 模式暂未在 init 中实现自动触发逻辑，需外部调用 `spin()`
- `getResult()` 返回最近一次旋转结果，未旋转时返回 null
- `isSpinning()` 可查询当前是否在旋转中
- `reset()` 清空旋转状态和结果
