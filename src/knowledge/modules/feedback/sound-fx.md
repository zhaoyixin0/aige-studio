# SoundFX — 音效系统模块

## 基本信息
- 类型: feedback
- 类名: SoundFX
- 注册名: `SoundFX`

## 功能原理

SoundFX 将游戏事件映射为音效播放。通过 events 参数配置事件名到音效资源 ID 的映射关系：当指定事件触发时，将音效 ID 加入播放队列。外部音频系统通过 `getSoundQueue()` 获取待播放列表并执行实际播放。支持全局音量控制和静音开关。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| events | object | `{}` | — | 事件→音效资源ID映射表 |
| volume | range | `0.8` | `0 ~ 1`，步长 0.1 | 全局音量 |
| muted | boolean | `false` | — | 是否静音 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| （无） | SoundFX 不发出事件 | |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| 由 events 参数配置 | 监听配置中的每个事件名，触发时将对应 assetId 加入播放队列 |

常见监听事件示例：
- `collision:hit` → 播放接住/击中音效
- `collision:damage` → 播放受伤音效
- `scorer:update` → 播放得分音效
- `timer:tick` → 播放倒计时滴答音效
- `quiz:correct` → 播放正确音效
- `quiz:wrong` → 播放错误音效
- `randomizer:spinning` → 播放旋转音效
- `randomizer:result` → 播放结果揭晓音效

## 与其他模块连接方式

- **Collision**: 监听碰撞事件播放对应音效
- **Scorer**: 监听得分事件播放加分音效
- **Timer**: 监听 tick 播放倒计时音效
- **QuizEngine**: 监听答题正确/错误播放反馈音效
- **Randomizer**: 监听旋转和结果事件播放音效
- **GameFlow**: 监听状态变化播放开始/结束音效

## 适用游戏类型

所有游戏类型都应包含 SoundFX 模块以提升游戏体验。

## 常见问题 & 边界情况

- muted 为 true 时 `playSound()` 直接返回，不加入队列
- `getSoundQueue()` 返回队列后立即清空，调用方需确保一次性消费
- volume 参数供外部音频系统读取使用，SoundFX 本身不做音量控制
- events 中的 value 为 asset ID 字符串，需要在素材系统中有对应资源
- `update()` 为空操作，音效完全由事件驱动
- `reset()` 清空播放队列

### 配置示例

```json
{
  "events": {
    "collision:hit": "sfx_catch",
    "collision:damage": "sfx_hurt",
    "scorer:update": "sfx_score",
    "timer:tick": "sfx_tick"
  },
  "volume": 0.8,
  "muted": false
}
```
