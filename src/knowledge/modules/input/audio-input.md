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

## 常见问题 & 边界情况

- 初始化时自动请求麦克风权限，权限被拒绝时模块静默不输出
- RMS 音量乘以 4 再 clamp 到 1，使 level 值更适合游戏使用
- 吹气检测通过低频/高频能量比判断，低频 > 高频 * 1.5 时判定为吹气
- frequency 模式的频率计算为近似值：`binIndex * (sampleRate / fftSize)`
- fftSize 固定为 256，频率分辨率约 172Hz（44100/256）
- `destroy()` 会停止所有麦克风 track 并关闭 AudioContext
- 在无麦克风设备或 SSR 环境下自动跳过初始化
