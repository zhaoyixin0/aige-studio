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

## 参数调优指南

### 不同游戏类型的推荐音效映射

| 游戏类型 | 推荐事件→音效映射 |
|----------|------------------|
| catch | `collision:hit` → sfx_catch, `collision:damage` → sfx_hurt, `scorer:update` → sfx_score |
| dodge | `collision:damage` → sfx_hurt, `scorer:update` → sfx_score |
| shooting | `collision:hit` → sfx_hit, `collision:damage` → sfx_hurt |
| quiz | `quiz:correct` → sfx_correct, `quiz:wrong` → sfx_wrong |
| random-wheel | `randomizer:spinning` → sfx_spin, `randomizer:result` → sfx_result |
| tap | `collision:hit` → sfx_pop, `scorer:update` → sfx_score |
| rhythm | `collision:hit` → sfx_note, `scorer:combo:*` → sfx_combo |
| runner | `collision:hit` → sfx_collect, `collision:damage` → sfx_hurt |
| platformer | `collision:hit` → sfx_collect, `collision:damage` → sfx_hurt, `jump:start` → sfx_jump |
| expression | `scorer:update` → sfx_score |
| gesture | `scorer:update` → sfx_score |
| narrative | `gameflow:state` → sfx_transition（场景切换音效） |
| dress-up | `scorer:update` → sfx_place（放置音效） |

### volume 调优

```
volume = 0.0: 静音（等同于 muted: true）
volume = 0.3: 低音量（背景/辅助音效）
volume = 0.5: 中等音量
volume = 0.8: 默认值（推荐）
volume = 1.0: 最大音量

注意: volume 仅供外部音频系统读取
  SoundFX 本身不做音量控制
  实际音量 = volume * 外部音频系统的主音量
```

### muted 参数

- `muted: true` 时 `playSound()` 直接返回，不加入队列
- 适合在设置菜单中提供静音开关
- 运行时可通过修改 params.muted 动态切换

## 跨模块联动规则

### 与 Collision 模块
- `collision:hit` → 正面音效（接住/击中/收集）
- `collision:damage` → 负面音效（受伤/失误）
- 高频碰撞可能导致大量音效堆叠

### 与 Scorer / ComboSystem 模块
- `scorer:update` → 得分音效
- `scorer:combo:*` → 连击音效（不同连击数可以映射不同音效）
- 频繁得分事件可能导致音效堆叠

### 与 Timer 模块
- `timer:tick` → 倒计时滴答音效
- **注意**: tick 事件每秒触发一次，对应的音效不应太长（< 500ms），否则会重叠

### 与 QuizEngine 模块
- `quiz:correct` → 正确音效
- `quiz:wrong` → 错误音效

### 与 Randomizer 模块
- `randomizer:spinning` → 旋转中的持续音效
- `randomizer:result` → 结果揭晓音效
- spinning 事件可能每帧触发 → 需要在音频系统侧做去重

### 与 GameFlow 模块
- `gameflow:state` → 状态变化音效（如开始/结束提示音）
- SoundFX 的 `gameflowPaused` 在 init 时设为 false（**始终响应事件**）
- 即使游戏暂停，音效仍然可以播放（如结束提示音在 finished 时播放）

### 性能优化

```
音效队列模式: 事件触发 → assetId 入队 → 外部系统消费
  getSoundQueue() 返回队列后立即清空
  调用方需一次性消费所有待播放音效

高频事件的音效堆叠问题:
  collision:hit 每帧触发 → 每帧入队一个 sfx_catch → 音效叠加

解决方案（需在外部音频系统实现）:
  1. 去重: 同一 assetId 在 N ms 内只播放一次
  2. 优先级: 重要音效优先，低优先级音效丢弃
  3. 并发上限: 同时播放的音效数量 <= 8
```

## 输入适配

SoundFX 不直接响应输入事件，但不同输入方式对音效设计有间接影响：

| 输入方式 | 对音效的影响 | 建议 |
|----------|-------------|------|
| TouchInput | 触摸音效反馈直接（如点击音） | 添加 `input:touch:tap` → sfx_click 的映射 |
| FaceInput | 无特殊影响 | 标准配置 |
| HandInput | 手势切换时可以添加音效 | 可选: `input:hand:gesture` → sfx_gesture |
| BodyInput | 姿势匹配成功可以添加音效 | 可选: `input:body:pose` → sfx_match |
| DeviceInput | 摇晃可以添加音效 | 可选: `input:device:shake` → sfx_shake |
| AudioInput | **注意**: 如果 AudioInput 和 SoundFX 同时使用，音效播放可能被麦克风拾取 → 反馈循环 | 使用耳机或降低 SoundFX 音量 |

**AudioInput + SoundFX 的反馈循环风险**:
- SoundFX 播放音效 → 麦克风拾取 → AudioInput 检测到声音 → 触发事件 → SoundFX 再次播放
- 缓解: 使用耳机、降低音量、或在 AudioInput 端加延迟窗口忽略刚播放的音效

## 常见 Anti-Pattern

- ❌ **高频事件映射长音效** → `timer:tick` (每秒) 映射 2 秒的音效 → 声音不断叠加变成噪音
  ✅ 高频事件对应的音效应短于事件间隔

- ❌ **getSoundQueue() 调用多次而不消费** → 每次调用清空队列，第二次调用返回空数组
  ✅ 每帧只调用一次 getSoundQueue()，一次性消费所有待播放音效

- ❌ **events 映射的 assetId 在素材系统中不存在** → 音效入队但无法播放，静默失败
  ✅ 确保 events 中的每个 assetId 在素材库中有对应资源

- ❌ **AudioInput + SoundFX 不做反馈循环防护** → 声音反馈循环（上面已说明）
  ✅ 使用耳机或在事件链中加延迟/去重

- ❌ **所有事件都映射同一个音效** → 无法区分正面/负面反馈
  ✅ 不同类型的事件映射不同音效（至少区分正面和负面）

- ❌ **muted 为 true 但仍然配置大量 events** → 事件监听器仍然会注册（只是 playSound 提前返回）
  ✅ 如果确定不需要音效，不添加 SoundFX 模块比设 muted=true 更节省
