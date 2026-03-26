# FaceInput — 面部追踪输入模块

## 基本信息
- 类型: input
- 类名: FaceInput
- 注册名: `FaceInput`

## 功能原理

FaceInput 通过 MediaPipe FaceMesh 追踪用户面部位置和表情。模块将摄像头画面中的面部关键点转化为游戏内坐标，支持头部位置追踪（headXY）、张嘴检测（mouthOpen）、眨眼检测（eyeBlink）和微笑检测（smile）。输出经过指数平滑和灵敏度调节，X 轴做镜像映射以实现自然的左右移动体验。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| tracking | select | `'headXY'` | `headXY / mouthOpen / eyeBlink / smile` | 追踪模式 |
| smoothing | range | `0.3` | `0 ~ 0.95`，步长 0.05 | 指数平滑系数，越大越平滑 |
| sensitivity | range | `1` | `0.5 ~ 3`，步长 0.1 | 灵敏度倍率，围绕中心点放大 |
| outputTo | string | `'player'` | — | 输出目标 ID |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `input:face:move` | `{ x, y, raw: { headX, headY } }` | 每帧追踪到面部时发出，x/y 为画布坐标 |
| `input:face:mouthOpen` | `{ value: number }` | 张嘴程度 > 0.5 时触发 |
| `input:face:blink` | `{ left: number, right: number }` | 左眼或右眼闭合程度 > 0.5 时触发 |
| `input:face:smile` | `{ value: number }` | 微笑程度 > 0.5 时触发 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | FaceInput 不监听其他模块事件 |

## 与其他模块连接方式

- **Collision**: `input:face:move` 的 `{ x, y }` 用于更新玩家碰撞对象位置 → `collision.updateObject(playerId, { x, y })`
- **Spawner**: 玩家位置用于接住/躲避判定
- **Randomizer**: `input:face:mouthOpen` 可作为转盘触发事件（trigger = `'mouthOpen'`）

## 适用游戏类型

- **catch**（接住类）— 头部控制接住容器
- **dodge**（躲避类）— 头部控制角色躲避障碍
- **shooting**（射击类）— 头部控制准星位置
- **expression**（表情触发类）— 张嘴/微笑/眨眼触发游戏事件
- **dress-up**（换装/贴纸类）— 面部位置用于贴纸定位

## 参数调优指南

| 游戏类型 | tracking | smoothing | sensitivity | 说明 |
|----------|----------|-----------|-------------|------|
| catch | headXY | 0.2 ~ 0.35 | 1.2 ~ 1.5 | 接住游戏需要快速响应但不能太抖 |
| dodge | headXY | 0.15 ~ 0.25 | 1.0 ~ 1.3 | 躲避需要更快响应，降低平滑 |
| shooting | headXY | 0.3 ~ 0.4 | 0.8 ~ 1.0 | 准星控制需要稳定，降低灵敏度 |
| expression | mouthOpen/smile/eyeBlink | 0.1 ~ 0.2 | 1.0 | 表情检测需要快速响应 |
| dress-up | headXY | 0.4 ~ 0.5 | 0.7 ~ 0.9 | 贴纸定位需要稳定，提高平滑 |
| runner | headXY | 0.2 ~ 0.3 | 1.5 ~ 2.0 | 头部小幅移动控制左右，需要高灵敏度 |
| platformer | headXY | 0.25 ~ 0.35 | 1.3 ~ 1.8 | 连续位置控制，中等平滑+高灵敏度 |
| random-wheel | mouthOpen | 0.1 | 1.0 | 张嘴触发转盘，快速响应 |

### smoothing 与 sensitivity 的交互效果

```
smoothing 高 + sensitivity 低 = 稳定但迟钝（适合精确定位场景）
smoothing 低 + sensitivity 高 = 灵敏但抖动（适合快速反应场景）
smoothing 中 + sensitivity 中 = 平衡方案（大多数游戏的默认选择）

指数平滑公式: smoothX = smoothX * s + rawX * (1 - s)
  s=0.3 时，新输入权重 = 0.7（快速跟随）
  s=0.7 时，新输入权重 = 0.3（慢速跟随）
```

### sensitivity 围绕中心放大

sensitivity 是以 0.5 为中心的缩放：`rawX = 0.5 + (headX - 0.5) * sensitivity`
- sensitivity = 1.0: 1:1 映射
- sensitivity = 2.0: 偏移量放大 2 倍（头部移动一半距离即可到达边缘）
- sensitivity = 3.0: 极度灵敏，轻微头部偏转即大幅移动
- sensitivity > 2.0 时需要配合较高的 smoothing（>= 0.3）来抑制抖动

## 跨模块联动规则

### 与 Collision 模块
- `input:face:move` 的 `{ x, y }` 直接用于更新玩家碰撞对象位置：`collision.updateObject(playerId, { x, y })`
- 坐标已经过镜像映射和画布缩放，是最终的画布坐标
- 每帧发出（只要检测到面部），Collision 会在每帧用最新位置做碰撞检测

### 与 PlayerMovement 模块
- `remapEventsForInput` 将 PlayerMovement 的 `continuousEvent` 映射为 `input:face:move`
- PlayerMovement 读取 `{ x }` 坐标设置玩家水平位置
- **注意**: FaceInput 的 move 事件每帧发出绝对位置，而非增量，PlayerMovement 需要以绝对位置模式工作

### 与 Jump 模块
- `remapEventsForInput` 将 Jump 的 `triggerEvent` 映射为 `input:face:mouthOpen`
- 张嘴 → 跳跃（阈值 0.5）
- 如果张嘴持续时间长，mouthOpen 事件会每帧发出 → 需要 Jump 模块做去重（只响应第一次）

### 与 Dash 模块
- `remapEventsForInput` 将 Dash 的 `triggerEvent` 映射为 `input:face:blink`
- 眨眼 → 冲刺
- 注意: 左右眼任一闭合 > 0.5 都会触发，不区分左右眼

### 与 Randomizer 模块
- `input:face:mouthOpen` 可作为 Randomizer 的触发事件
- 张嘴触发转盘旋转

### 与 Spawner 模块
- 面部位置通过 Collision 间接与 Spawner 的生成物交互
- 头部移动位置用于接住/躲避判定

### 多输入组合时的冲突处理
- FaceInput + TouchInput: 面部控制位置移动，触摸用于 UI 交互（推荐）
- FaceInput + AudioInput: 面部控制位置，声音触发动作（如张嘴 + 发声双重确认）
- FaceInput + HandInput: 不推荐同时使用，两者都控制位置会冲突
- FaceInput + DeviceInput: 不推荐，两者都是连续位置输入，会互相干扰

## 输入适配

### 适合的游戏类型
- **catch**（接住类）— 头部左右移动控制接住容器，体验自然直观
- **dodge**（躲避类）— 头部移动控制角色躲避，动作感强
- **shooting**（射击类）— 头部控制准星，免手操作
- **expression**（表情触发类）— FaceInput 的核心优势，张嘴/微笑/眨眼直接作为游戏事件
- **dress-up**（换装/贴纸类）— 面部位置用于贴纸的 AR 定位

### 不适合的游戏类型
- **quiz**（答题类）— 需要精确点选答案，头部位置不够精确
- **puzzle**（拼图/配对类）— 需要精确的选择操作，面部追踪精度不足
- **narrative**（分支叙事类）— 选择分支需要精确交互
- **rhythm**（节奏类）— 面部追踪延迟较大，不适合精确时间的节拍操作

## 常见 Anti-Pattern

- ❌ **smoothing 设为 0 用于 catch 游戏** → 头部微小晃动导致角色剧烈抖动，无法稳定接住物体
  ✅ catch 类游戏 smoothing >= 0.2

- ❌ **sensitivity 设为 3 但不提高 smoothing** → 极度灵敏+无平滑=角色疯狂抖动
  ✅ sensitivity > 1.5 时，smoothing 至少为 0.25

- ❌ **用 mouthOpen 触发频繁动作（如射击）** → 张嘴事件每帧发出（只要张嘴程度 > 0.5），会导致每帧触发
  ✅ 在接收端加节流（throttle），或用 mouthOpen 触发非频繁动作（如跳跃/转盘）

- ❌ **不处理摄像头权限拒绝** → 模块静默不输出，用户看到角色完全不动但不知道原因
  ✅ 检测 tracker 初始化状态，提示用户授权摄像头

- ❌ **假设面部追踪在所有设备上都流畅** → MediaPipe FaceMesh 在低端设备上可能降到 10fps
  ✅ 在低端设备上增大 smoothing 补偿低帧率造成的跳变

## 常见问题 & 边界情况

- 需要先调用 `setTracker(tracker)` 注入 FaceTracker 实例，否则 update 不会输出任何事件
- smoothing 设为 0 时无平滑，响应最快但会抖动；设为 0.9+ 会有明显延迟
- X 轴做了镜像映射 `(1 - smoothX) * canvasW`，所以用户向右移头，角色也向右移
- 表情检测阈值固定为 0.5，暂不支持自定义阈值
- 如果摄像头权限被拒绝，tracker 不会初始化，模块静默不输出
- `getPosition()` 返回当前平滑后的画布坐标，即使 tracker 无数据时也返回基于上次平滑值的位置
- `reset()` 将平滑值重置为 0.5（中心点），下一帧从中心开始跟随
- gameflowPaused 为 true 时 update 不执行，面部追踪暂停
- 源码中暴露了 `playerSize` 参数（默认 64px），供渲染器读取控制角色大小
