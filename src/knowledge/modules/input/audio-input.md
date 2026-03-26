# AudioInput — 麦克风音频输入模块

## 基本信息
- 类型: input
- 类名: AudioInput
- 注册名: `AudioInput`

## 功能原理

AudioInput 通过 Web Audio API 获取麦克风输入，使用 AnalyserNode 进行实时音频分析。支持三种模式：音量检测（volume）通过 RMS 计算归一化音量值；吹气检测（blow）在音量超过阈值时分析频率分布，低频能量 > 高频能量 1.5 倍判定为吹气；频率检测（frequency）查找主频率并输出频率值和强度。FFT 大小固定为 256。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| mode | select | `'volume'` | `volume / blow / frequency` | 分析模式 |
| threshold | range | `0.3` | `0 ~ 1`，步长 0.05 | 触发阈值 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `input:audio:volume` | `{ level: number }` | 每帧（mode 为 volume 或 blow 时），level 范围 0~1 |
| `input:audio:blow` | `{ level: number }` | mode 为 blow 且音量 > threshold 且低频主导时触发 |
| `input:audio:frequency` | `{ frequency: number, level: number }` | mode 为 frequency 且主频强度 > threshold 时触发 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | AudioInput 不监听其他模块事件 |

## 与其他模块连接方式

- **Scorer**: 音量或吹气事件可触发计分
- **Spawner**: 音量控制物体生成速度（需自定义 wiring）
- **DifficultyRamp**: 可根据音量调整难度

## 适用游戏类型

- **expression**（表情触发类）— 声音作为辅助输入
- **rhythm**（节奏类）— 声音节拍检测（扩展用法）
- **tap**（点击类）— 声音作为替代输入方式

## 参数调优指南

| 游戏类型 | mode | threshold | 说明 |
|----------|------|-----------|------|
| expression（声音辅助） | volume | 0.3 | 声音大小作为交互触发 |
| 吹蜡烛/吹气球 | blow | 0.25 ~ 0.35 | 吹气作为核心玩法 |
| 音高游戏 | frequency | 0.4 ~ 0.5 | 唱/说不同频率控制游戏 |
| rhythm（声音触发） | volume | 0.2 ~ 0.3 | 发声作为节拍输入 |
| tap（声音替代） | volume | 0.35 ~ 0.45 | 声音替代点击 |
| 大声喊/加油类 | volume | 0.5 ~ 0.7 | 高阈值只响应大声 |

### threshold 调优

```
threshold = 0.0: 任何声音都触发（包括环境噪声）
threshold = 0.2: 轻声说话可触发
threshold = 0.3: 默认值，正常说话音量可触发
threshold = 0.5: 需要较大声说话/喊叫
threshold = 0.7: 需要大声喊叫
threshold = 0.9: 极高阈值，需要非常大声

注意: level 值经过 RMS * 4 再 clamp(0,1) 处理
  实际 RMS 0.075 → level 0.3
  实际 RMS 0.125 → level 0.5
  实际 RMS 0.25+  → level 1.0
```

### mode 选择指南

| mode | 输出事件 | 频率 | 适用场景 |
|------|---------|------|---------|
| volume | `input:audio:volume` 每帧 | 持续 | 音量大小控制（如音量越大移动越快） |
| blow | `input:audio:volume` 每帧 + `input:audio:blow` 条件触发 | 持续+条件 | 吹气检测（会同时输出音量） |
| frequency | `input:audio:frequency` 条件触发 | 条件 | 主频率检测（如音高游戏） |

### 吹气检测原理

```
吹气的频率特征: 低频能量占主导
检测逻辑:
  1. 先检查音量 > threshold（有声音输入）
  2. 获取频率数据，分为低频区和高频区（以 1/4 点为分界）
  3. 低频能量 > 高频能量 * 1.5 → 判定为吹气

分界点: fftSize=256, frequencyBinCount=128
  低频区: bin 0~31 (约 0~5500Hz)
  高频区: bin 32~127 (约 5500~22050Hz)

注意: 说话声也包含低频成分，复杂环境下可能误判
```

## 跨模块联动规则

### 与 Scorer 模块
- 音量或吹气事件可直接触发计分（自定义 wiring）
- 例如: `input:audio:blow` → 加分
- 音量值可以乘以分数系数实现"声音越大分越多"

### 与 Spawner 模块
- 音量可控制物体生成速度（需自定义 wiring）
- 例如: 音量 > 0.5 时加速生成，音量 < 0.2 时减速

### 与 DifficultyRamp 模块
- 可根据音量调整游戏难度
- 例如: 持续高音量 → 难度上升

### 与 PlayerMovement 模块
- `remapEventsForInput` 将 PlayerMovement 的 `continuousEvent` 映射为 `input:audio:frequency`
- 频率值可映射为水平位置：低频 → 左侧，高频 → 右侧

### 与 Jump / Dash 模块
- `remapEventsForInput` 将 Jump 的 `triggerEvent` 映射为 `input:audio:volume`
- `remapEventsForInput` 将 Dash 的 `triggerEvent` 映射为 `input:audio:blow`
- 大声说话 → 跳跃，吹气 → 冲刺

### 多输入组合时的冲突处理
- AudioInput + TouchInput: 声音触发动作，触摸用于 UI 和位置控制（**最推荐的组合**）
- AudioInput + FaceInput: 声音触发动作，面部控制位置（兼容良好，注意张嘴说话时 mouthOpen 也会触发）
- AudioInput + HandInput: 声音触发动作，手部控制位置（兼容良好）
- AudioInput + DeviceInput: 声音触发+设备倾斜移动（兼容但体验一般）
- **注意**: AudioInput 与 FaceInput 的 mouthOpen 功能有重叠——张嘴说话同时触发 mouthOpen 和 volume 事件

## 输入适配

### 适合的游戏类型
- **expression**（表情触发类）— 声音作为辅助输入，配合面部/身体追踪
- **rhythm**（节奏类）— 声音节拍检测（发声 vs 沉默作为节奏输入）
- **tap**（点击类）— 声音作为点击的替代方式（无障碍设计）
- **吹气类（自定义）**— 吹蜡烛、吹气球等核心声音交互
- **音高游戏（自定义）**— 唱歌/发声控制游戏元素

### 不适合的游戏类型
- **quiz**（答题类）— 不需要声音输入（选择答案用触摸更好）
- **puzzle**（拼图/配对类）— 精确操作需求，声音不够精确
- **narrative**（分支叙事类）— 选择分支需要精确交互
- **dress-up**（换装类）— 需要精确的拖放操作
- **shooting**（射击类）— 声音控制准星不够精确
- **在嘈杂环境中的任何游戏** — 背景噪音会严重干扰声音输入

## 常见 Anti-Pattern

- ❌ **threshold 设为 0，期望只响应有意义的声音** → 环境噪声持续触发事件
  ✅ threshold >= 0.2，嘈杂环境 >= 0.4

- ❌ **用 volume 模式触发离散动作（如跳跃）** → volume 事件每帧发出，单次喊叫会触发数十帧的高音量事件
  ✅ 在接收端加节流/边沿检测（只在音量从低到高的上升沿触发一次）

- ❌ **blow 模式下不告诉用户"对着麦克风吹气"** → 用户不知道如何触发，或者对着屏幕吹（远离麦克风）
  ✅ 提供明确的 UI 提示指导用户靠近麦克风

- ❌ **frequency 模式期望精确音高识别** → fftSize=256 时频率分辨率约 172Hz，无法区分半音（约 6%频率差异）
  ✅ 只区分粗略的频率范围（低/中/高），不做精确音高识别

- ❌ **不处理麦克风权限拒绝** → 模块静默不输出，用户无法知道为什么声音没有反应
  ✅ 检测 isActive 状态，权限被拒时提示用户

- ❌ **在 destroy 后继续读取数据** → AudioContext 已关闭，analyser 为 null
  ✅ destroy 后不再调用 update 或读取分析数据

## 常见问题 & 边界情况

- 初始化时自动请求麦克风权限，权限被拒绝时模块静默不输出
- RMS 音量乘以 4 再 clamp 到 1，使 level 值更适合游戏使用
- 吹气检测通过低频/高频能量比判断，低频 > 高频 * 1.5 时判定为吹气
- frequency 模式的频率计算为近似值：`binIndex * (sampleRate / fftSize)`
- fftSize 固定为 256，频率分辨率约 172Hz（44100/256）
- `destroy()` 会停止所有麦克风 track 并关闭 AudioContext
- 在无麦克风设备或 SSR 环境下自动跳过初始化
- `reset()` 保持音频资源（AudioContext、MediaStream）不变，只重置 isActive 标志
- gameflowPaused 为 true 时 update 不执行，但麦克风仍在采集（资源不释放直到 destroy）
- blow 模式下同时发出 `input:audio:volume` 和 `input:audio:blow` 两种事件
- volume 模式下只发出 `input:audio:volume`，不做频率分析（性能更好）
