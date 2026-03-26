# DeviceInput — 设备传感器输入模块

## 基本信息
- 类型: input
- 类名: DeviceInput
- 注册名: `DeviceInput`

## 功能原理

DeviceInput 利用移动设备的陀螺仪和加速度计传感器作为游戏输入。通过 DeviceOrientationEvent 获取设备倾斜角度（gamma 控制左右，beta 控制前后），经过灵敏度缩放和死区过滤后输出归一化的倾斜值。同时通过 DeviceMotionEvent 检测摇晃动作，当加速度合力超过阈值（15）时触发摇晃事件。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| sensor | select | `'gyroscope'` | `gyroscope / accelerometer` | 传感器类型 |
| sensitivity | range | `1` | `0.5 ~ 3`，步长 0.1 | 倾斜灵敏度倍率 |
| deadzone | range | `0.1` | `0 ~ 0.3`，步长 0.01 | 死区，低于此值的倾斜被忽略 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `input:device:tilt` | `{ x: number, y: number }` | 每帧当倾斜值非零时发出，x/y 为归一化倾斜量 |
| `input:device:shake` | `{ magnitude: number }` | 加速度合力 > 15 时触发 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | DeviceInput 不监听其他模块事件 |

## 与其他模块连接方式

- **Collision**: `input:device:tilt` 的 `{ x, y }` 可用于控制玩家角色移动
- **Spawner**: 摇晃事件可触发特殊生成逻辑
- **Scorer**: 摇晃次数可作为计分依据

## 适用游戏类型

- **catch**（接住类）— 倾斜手机控制接住容器（移动端替代方案）
- **dodge**（躲避类）— 倾斜手机控制角色移动
- **runner**（跑酷类）— 倾斜控制左右移动

## 参数调优指南

| 游戏类型 | sensor | sensitivity | deadzone | 说明 |
|----------|--------|-------------|----------|------|
| catch | gyroscope | 1.0 ~ 1.5 | 0.08 ~ 0.12 | 倾斜手机接住物品，灵敏度中等 |
| dodge | gyroscope | 1.2 ~ 1.8 | 0.05 ~ 0.1 | 需要快速反应，提高灵敏度 |
| runner | gyroscope | 0.8 ~ 1.2 | 0.1 ~ 0.15 | 跑酷中左右移动，中等灵敏度 |
| platformer | gyroscope | 1.0 ~ 1.5 | 0.1 ~ 0.15 | 水平移动控制 |
| shake 类玩法 | accelerometer | — | — | 主要用摇晃触发，不关心倾斜 |

### sensitivity 与 deadzone 的交互

```
sensitivity 高 + deadzone 低 = 极灵敏，手机微倾即大幅移动（适合快节奏）
sensitivity 高 + deadzone 高 = 矛盾组合，避免使用
sensitivity 低 + deadzone 高 = 需要大幅倾斜才触发，操作费力
sensitivity 中 + deadzone 中 = 平衡方案（推荐默认值）

tilt 计算:
  rawX = (gamma / 90) * sensitivity
  rawY = (beta / 90) * sensitivity
  实际输出 = |rawX| > deadzone ? rawX : 0

gamma 范围: -90° ~ 90°（左右倾斜）
beta 范围: -180° ~ 180°（前后倾斜），但 /90 后范围超过 ±1
```

### shake 触发阈值

shakeThreshold 固定为 15（加速度合力，单位 m/s²）：
- 正常手持手机: 加速度合力约 9.8（重力）
- 轻微晃动: ~12
- 中等摇晃: ~18（触发）
- 剧烈摇晃: ~25+

## 跨模块联动规则

### 与 Collision 模块
- `input:device:tilt` 的 `{ x, y }` 用于控制玩家角色移动
- 需要中间模块（PlayerMovement）将 tilt 值转为画布坐标位置更新
- tilt 值是归一化的（通常 -1 ~ 1），需要乘以移动速度系数

### 与 PlayerMovement 模块
- `remapEventsForInput` 将 PlayerMovement 的 `continuousEvent` 映射为 `input:device:tilt`
- PlayerMovement 读取 `{ x }` 值控制水平方向移动
- **注意**: tilt 输出的是方向强度（-1~1），不是绝对位置，PlayerMovement 需以速度模式解释

### 与 Jump / Dash 模块
- `remapEventsForInput` 将 Jump 和 Dash 的 `triggerEvent` 都映射为 `input:device:shake`
- 摇晃手机 → 跳跃/冲刺
- **注意**: shake 事件在剧烈加速时触发，可能在跑步/运动中误触发

### 与 Spawner 模块
- 摇晃事件可触发特殊生成逻辑（如摇晃奖励物品掉落）

### 与 Scorer 模块
- 摇晃次数可作为计分依据（需自定义 wiring）

### 多输入组合时的冲突处理
- DeviceInput + TouchInput: 设备倾斜控制移动，触摸用于 UI 交互（**推荐组合**）
- DeviceInput + FaceInput/HandInput: **不推荐**，两者都是连续位置/方向输入，冲突
- DeviceInput + AudioInput: 设备倾斜控制移动，声音触发动作（兼容但体验一般）
- DeviceInput 是**仅限移动端**的输入，桌面端需要 fallback 方案（通常 fallback 到 TouchInput）

## 输入适配

### 适合的游戏类型
- **catch**（接住类）— 倾斜手机控制接住容器，物理感强
- **dodge**（躲避类）— 倾斜手机控制角色移动，体验新颖
- **runner**（跑酷类）— 左右倾斜控制方向，像赛车一样
- **platformer**（平台类）— 倾斜控制水平移动（替代触摸半屏）
- **shake 类玩法**（自定义）— 摇一摇作为核心交互

### 不适合的游戏类型
- **quiz**（答题类）— 不需要设备传感器
- **random-wheel**（随机转盘类）— tap 更直观（虽然 shake 可以触发）
- **puzzle**（拼图/配对类）— 精确选择需要触摸，不适合倾斜
- **rhythm**（节奏类）— 倾斜响应不够精确，不适合节拍操作
- **narrative**（分支叙事类）— 不需要设备传感器
- **dress-up**（换装类）— 需要精确的拖放操作
- **桌面端所有游戏** — DeviceOrientation/DeviceMotion 仅移动设备支持

## 常见 Anti-Pattern

- ❌ **在桌面端使用 DeviceInput 作为唯一输入** → 桌面浏览器不支持设备传感器，用户完全无法操作
  ✅ 总是提供 TouchInput 作为兜底方案，或在初始化时检测设备能力

- ❌ **deadzone 设为 0** → 手持手机时的自然微颤也会触发移动事件，角色持续抖动
  ✅ deadzone >= 0.05

- ❌ **iOS 上不请求权限** → iOS 13+ 需要 `DeviceOrientationEvent.requestPermission()`，不调用时传感器数据为 null
  ✅ 在用户交互（如点击按钮）时调用权限请求

- ❌ **用 shake 触发频繁操作** → shake 判定在每个高加速度帧都触发，一次摇晃可能产生多次事件
  ✅ 在接收端加节流（如 500ms 内只响应一次 shake）

- ❌ **sensitivity 设为 3 且 deadzone 为 0** → 手机轻微倾斜即满速移动 + 无死区 = 完全不可控
  ✅ 高 sensitivity 配合适当的 deadzone (>= 0.1)

## 常见问题 & 边界情况

- 仅在移动设备上有效，桌面浏览器不支持 DeviceOrientation/DeviceMotion
- iOS 13+ 需要用户明确授权 `DeviceOrientationEvent.requestPermission()`
- tilt 值范围：gamma(-90~90) / 90 * sensitivity，通常在 -1 ~ 1 之间
- deadzone 为 0 时无死区，轻微抖动也会触发事件
- shakeThreshold 固定为 15，暂不支持配置
- `destroy()` 会移除所有 window 事件监听器
- 在 SSR 环境（typeof window === 'undefined'）下自动跳过事件绑定
- tilt 事件只在非零时发出（tiltX !== 0 || tiltY !== 0）
- gameflowPaused 为 true 时 update 不发出 tilt 事件，但 onOrientation/onMotion 仍在持续更新内部状态
- `getTilt()` 始终返回当前倾斜值（不受 gameflowPaused 影响）
