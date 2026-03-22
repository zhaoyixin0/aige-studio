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

## 常见问题 & 边界情况

- 仅在移动设备上有效，桌面浏览器不支持 DeviceOrientation/DeviceMotion
- iOS 13+ 需要用户明确授权 `DeviceOrientationEvent.requestPermission()`
- tilt 值范围：gamma(-90~90) / 90 * sensitivity，通常在 -1 ~ 1 之间
- deadzone 为 0 时无死区，轻微抖动也会触发事件
- shakeThreshold 固定为 15，暂不支持配置
- `destroy()` 会移除所有 window 事件监听器
- 在 SSR 环境（typeof window === 'undefined'）下自动跳过事件绑定
