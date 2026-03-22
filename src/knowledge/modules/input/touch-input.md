# TouchInput — 触屏/鼠标输入模块

## 基本信息
- 类型: input
- 类名: TouchInput
- 注册名: `TouchInput`

## 功能原理

TouchInput 监听 HTML 元素上的 Pointer 事件（兼容鼠标和触屏），将触摸/点击行为转化为游戏事件。支持四种手势：点击（tap）、滑动（swipe）、长按（longPress）和双击（doubleTap）。手势识别基于位移距离、时间间隔自动判断：位移 > 30px 为滑动，< 300ms 为点击，500ms 内不移动为长按，两次点击间隔 < 300ms 为双击。坐标为相对于画布的局部坐标。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| gesture | select | `'tap'` | `tap / swipe / longPress / doubleTap` | 主要手势类型（配置用，实际所有手势都会检测和发出） |
| action | string | `''` | — | 触发的动作标识 |
| area | rect | — | — | 激活区域（可选，未设置时整个画布有效） |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `input:touch:tap` | `{ x, y }` | 按下后位移 < 30px 且时间 < 300ms |
| `input:touch:doubleTap` | `{ x, y }` | 两次 tap 间隔 < 300ms |
| `input:touch:swipe` | `{ x, y, direction, distance }` | 按下后位移 > 30px，direction 为 `up/down/left/right` |
| `input:touch:longPress` | `{ x, y }` | 按下后 500ms 不移动 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | TouchInput 不监听其他模块事件 |

## 与其他模块连接方式

- **Randomizer**: `input:touch:tap` 触发转盘旋转（trigger = `'tap'`）
- **QuizEngine**: `input:touch:tap` 用于选择答题选项
- **Spawner**: 点击位置用于点击消除类游戏
- **Scorer**: 通过 Collision 间接连接

## 适用游戏类型

- **quiz**（答题类）— 点击选项
- **random-wheel**（随机转盘类）— 点击触发转盘
- **tap**（点击类）— 点击消除目标
- **runner**（跑酷类）— 滑动/点击控制跳跃和闪避
- **puzzle**（拼图/配对类）— 点击选择配对项
- **rhythm**（节奏类）— 按节拍点击
- **dress-up**（换装/贴纸类）— 拖拽贴纸
- **narrative**（分支叙事类）— 点击选择分支
- **shooting**（射击类）— 点击射击

## 常见问题 & 边界情况

- 需要调用 `setCanvas(element)` 绑定 DOM 元素，否则不会接收任何输入
- 所有手势类型都会被检测和发出，`gesture` 参数仅作为配置标记
- 坐标是相对于画布元素的局部坐标（clientX - rect.left）
- 滑动方向由水平/垂直位移较大者决定
- 双击后会重置 lastTapTime 防止三击误判
- 长按定时器在手指移动后自动取消
- `destroy()` 会解绑所有 DOM 事件监听器
