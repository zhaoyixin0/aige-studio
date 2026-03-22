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

## 常见问题 & 边界情况

- 需要先调用 `setTracker(tracker)` 注入 FaceTracker 实例，否则 update 不会输出任何事件
- smoothing 设为 0 时无平滑，响应最快但会抖动；设为 0.9+ 会有明显延迟
- X 轴做了镜像映射 `(1 - smoothX) * canvasW`，所以用户向右移头，角色也向右移
- 表情检测阈值固定为 0.5，暂不支持自定义阈值
- 如果摄像头权限被拒绝，tracker 不会初始化，模块静默不输出
