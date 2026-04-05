# Tween — 补间动画模块

## 基本信息
- 类型: mechanic
- 类名: `Tween`
- 注册名: `Tween`
- 文件: `src/engine/modules/mechanic/tween.ts`
- 系统: `src/engine/systems/tween/`

## 功能原理

Tween 是 AIGE Studio 的补间动画系统，通过时间插值驱动实体属性变化（位置偏移、缩放、旋转、透明度）。

**工作流程：**
1. 通过 `clips` 参数配置动画片段（TweenClip），每个片段包含多个轨道（TweenTrack）
2. 通过 `tween:trigger` 事件或 `startClip(clipId, entityId)` 启动动画
3. 每帧 `update(dt)` 推进所有活跃的补间动画
4. 每帧发出 `tween:update` 事件，携带实体 ID 和当前属性值
5. 渲染器监听 `tween:update`，将属性应用到精灵上（x/y 为加法偏移，scale/rotation/alpha 为绝对值）
6. 动画完成时发出 `tween:complete` 事件

**支持的属性：**
- `x`, `y` — 位置偏移（加法，叠加在 sync() 基础位置之上）
- `scaleX`, `scaleY` — 缩放（绝对值）
- `rotation` — 旋转（绝对值，弧度）
- `alpha` — 透明度（绝对值，0-1）

## 完整参数表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| clips | object | `[]` | TweenClip 数组 |

### TweenClip 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 片段唯一标识（如 'hit', 'spawn-in', 'death-fade'） |
| duration | number | 是 | 动画时长（秒） |
| loop | number \| 'infinite' | 否 | 循环次数 |
| pingPong | boolean | 否 | 往返播放 |
| delay | number | 否 | 延迟开始（秒） |
| timeScale | number | 否 | 播放速度倍率 |
| tracks | TweenTrack[] | 是 | 属性轨道数组 |

### TweenTrack 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| property | string | 是 | 目标属性: x/y/scaleX/scaleY/rotation/alpha |
| easing | string | 是 | 缓动函数名称（见下方列表） |
| from | number | 是 | 起始值 |
| to | number | 是 | 结束值 |
| bezierPath | BezierPath | 否 | 贝塞尔曲线路径 |

## 16 种缓动函数

Linear, QuadIn, QuadOut, QuadInOut, CubicIn, CubicOut, CubicInOut, QuartIn, QuartOut, SineIn, SineOut, SineInOut, ExpoIn, ExpoOut, BounceIn, BounceOut

## 事件

| 事件 | 触发时机 | Payload |
|------|----------|---------|
| `tween:start` | 动画片段开始 | `{ entityId, clipId }` |
| `tween:update` | 每帧属性更新 | `{ entityId, properties: Record<string, number> }` |
| `tween:complete` | 动画片段完成 | `{ entityId, clipId }` |
| `tween:trigger` | 外部触发动画 | `{ clipId, entityId }` |

## AutoWirer 桥接

Tween 通过 AutoWirer BRIDGE_RULES 自动与其他模块连接：

| 桥接 | 触发事件 | 动画片段 |
|------|----------|----------|
| Collision + Tween | `collision:hit` → `tween:trigger` | clipId: `hit` |
| Spawner + Tween | `spawner:created` → `tween:trigger` | clipId: `spawn-in` |
| Spawner + Tween | `spawner:destroyed` → `tween:trigger` | clipId: `despawn-out` |
| EnemyAI + Tween | `enemy:death` → `tween:trigger` | clipId: `death-fade` |

## 常见动画模式

### 命中闪烁（Hit Flash）
```json
{
  "id": "hit",
  "duration": 0.15,
  "tracks": [
    { "property": "alpha", "from": 0.3, "to": 1.0, "easing": "Linear" }
  ]
}
```

### 生成弹入（Spawn Pop-in）
```json
{
  "id": "spawn-in",
  "duration": 0.3,
  "tracks": [
    { "property": "scaleX", "from": 0, "to": 1, "easing": "BounceOut" },
    { "property": "scaleY", "from": 0, "to": 1, "easing": "BounceOut" }
  ]
}
```

### 死亡淡出（Death Fade）
```json
{
  "id": "death-fade",
  "duration": 0.5,
  "tracks": [
    { "property": "alpha", "from": 1, "to": 0, "easing": "QuadOut" },
    { "property": "scaleX", "from": 1, "to": 0.3, "easing": "QuadOut" },
    { "property": "scaleY", "from": 1, "to": 0.3, "easing": "QuadOut" }
  ]
}
```

### 弹跳（Bounce）
```json
{
  "id": "bounce",
  "duration": 0.5,
  "loop": "infinite",
  "pingPong": true,
  "tracks": [
    { "property": "y", "from": 0, "to": -20, "easing": "SineInOut" }
  ]
}
```

## 最佳实践

- **反馈动画**用短时长（0.1-0.3s）：命中闪烁、得分弹出
- **运动动画**用中时长（0.3-1s）：弹入、淡出、弹跳
- **氛围动画**用长时长（1-3s）+ 循环：悬浮、脉搏
- x/y 属性是加法偏移，动画结束后自动清除（`tween:complete` 触发清理）
- scale/alpha 是绝对值，确保动画完成时回到期望状态
