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

## 参数调优指南

TouchInput 参数较少，核心调优在于 gesture 类型选择和与其他模块的事件映射：

| 游戏类型 | 推荐 gesture | 关键事件 | 说明 |
|----------|-------------|----------|------|
| catch/dodge | — | `input:touch:hold` (每帧) | 按住屏幕左/右半区持续控制移动 |
| tap | tap | `input:touch:tap` | 点击消除目标 |
| quiz | tap | `input:touch:tap` | 点击选择答案 |
| random-wheel | tap | `input:touch:tap` | 点击触发转盘 |
| runner | swipe + hold | `input:touch:swipe` + `input:touch:hold` | 滑动跳跃/闪避 + 按住控制方向 |
| platformer | hold + swipe | `input:touch:hold` + `input:touch:swipe` | 按住左/右移动 + 上滑跳跃 |
| shooting | tap | `input:touch:tap` | 点击射击 |
| rhythm | tap | `input:touch:tap` | 按节拍点击 |
| puzzle | tap | `input:touch:tap` | 点击选择/翻转 |
| dress-up | — | `input:touch:tap` + hold 拖拽 | 选择并拖放贴纸 |
| narrative | tap | `input:touch:tap` | 点击选择分支 |

### hold/release 事件（源码新增）

源码中 TouchInput 还发出了 `input:touch:hold` 和 `input:touch:release` 事件（skill 基本信息中未列出）：
- `input:touch:hold`：pointerDown 时立即发出 + 每帧持续发出（当 pointer 保持按下时），携带 `{ x, y, side: 'left'|'right' }`
- `input:touch:release`：pointerUp 时发出
- `side` 由触摸位置在画布左/右半区决定，用于 platformer 的连续移动控制

### playerSize 参数

TouchInput 还暴露了 `playerSize` 参数（默认 64px，范围 24~128px），供渲染器读取控制玩家角色大小。

## 跨模块联动规则

### 与 Collision 模块
- TouchInput 的 tap 坐标 `{ x, y }` 可直接用于 Collision 的点碰撞检测
- 对于 catch/dodge 游戏，需通过中间模块（PlayerMovement 或自定义 wiring）将 hold 事件的 side 转为玩家位置更新，再由 Collision 检测碰撞
- **注意**: TouchInput 的坐标**不做镜像映射**（与 FaceInput/HandInput 不同），因为触摸是直接交互

### 与 PlayerMovement 模块
- `input:touch:hold` 的 `{ side }` 用于 platformer 的连续移动：left → 向左，right → 向右
- `input:touch:release` 通知 PlayerMovement 停止移动
- PlayerMovement 监听 `input:touch:hold` 替代 `input:touch:swipe` 实现连续移动

### 与 Jump 模块
- 默认 Jump 监听 `input:touch:tap` 作为跳跃触发
- 可通过 `remapEventsForInput` 将 Jump 的 triggerEvent 映射到 `input:touch:swipe`（上滑跳跃）

### 与 Randomizer 模块
- `input:touch:tap` 作为 Randomizer 的 trigger 事件，点击触发转盘旋转

### 与 QuizEngine 模块
- `input:touch:tap` 的 `{ x, y }` 坐标用于判断点击了哪个选项区域

### 与 Spawner 模块
- tap 类游戏中，`input:touch:tap` 的坐标用于判断是否点击了 Spawner 生成的目标

### 多输入组合时的冲突处理
- TouchInput 是最通用的输入方式，通常作为"兜底"方案
- 当 TouchInput 与 FaceInput/HandInput 同时存在时，建议将 TouchInput 限制为 UI 交互（选择答案、触发转盘），将位置控制交给摄像头输入
- 避免 TouchInput 和 DeviceInput 同时控制玩家移动，会导致位置冲突

## 输入适配

### 适合的游戏类型
- **所有游戏类型**都支持 TouchInput，它是最通用的输入方式
- 特别适合: quiz、random-wheel、tap、puzzle、narrative（基于点击的交互）
- 对于 catch/dodge/runner/platformer，hold 事件提供了连续控制能力

### 不适合的场景
- 需要双手同时操作的复杂交互（受限于单点触控的手势识别）
- 需要精确的连续位置追踪（如 AR 游戏）— 此时 FaceInput/HandInput 更合适
- 无屏幕设备（如纯语音交互场景）

## 常见 Anti-Pattern

- ❌ **在 platformer 中只用 tap 控制移动** → 只能点击一次，无法持续移动
  ✅ 使用 `input:touch:hold` 的 side 判断实现持续移动

- ❌ **不调用 setCanvas() 就期望接收输入** → 模块完全静默，无任何事件发出
  ✅ 在 PixiRenderer 初始化后调用 `touchInput.setCanvas(canvasElement)`

- ❌ **同时用 tap 和 doubleTap 触发不同功能** → 每次 doubleTap 前都会先触发一次 tap，导致误触
  ✅ 如果需要区分单击和双击，在接收端加延迟窗口判断；或只使用其中一种

- ❌ **在 swipe 回调中读取起始位置** → swipe 事件数据只包含结束位置和方向，不包含起始位置
  ✅ 读取 `direction` 和 `distance` 而非起始坐标

- ❌ **假设 longPress 和 tap 互斥** → 长按过程中如果手指移动超过 10px 会取消长按，松手后如果 elapsed < 300ms 还会触发 tap
  ✅ 理解手势判断的优先级: 移动 > 30px = swipe，不动 500ms = longPress，< 300ms = tap

## 常见问题 & 边界情况

- 需要调用 `setCanvas(element)` 绑定 DOM 元素，否则不会接收任何输入
- 所有手势类型都会被检测和发出，`gesture` 参数仅作为配置标记
- 坐标经过 CSS→Canvas 分辨率缩放（`cssX * (canvas.width / rect.width)`），适配高 DPI 屏幕
- 滑动方向由水平/垂直位移较大者决定
- 双击后会重置 lastTapTime 防止三击误判
- 长按定时器在手指移动超过 10px 后自动取消（注意: 是 10px 而非 30px）
- `input:touch:hold` 每帧重复发出（pointerState 存在时），用于连续移动
- `input:touch:release` 在 pointerUp 时无条件发出（不受手势判断影响）
- `destroy()` 会解绑所有 DOM 事件监听器
- 设置 `touchAction: 'none'` 阻止浏览器默认触摸行为（如滚动、缩放）
