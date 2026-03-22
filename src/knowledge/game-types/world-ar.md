# 世界AR类 (World AR) — Game Type Skill

## 游戏定义
利用身体追踪将虚拟物体叠加到玩家身体周围，玩家通过身体移动与虚拟物体互动。适合体感运动、虚拟物品收集等场景。注意：当前为 Web 端实现，使用 MediaPipe Pose 进行身体追踪而非原生 AR SDK，功能受限。

## 核心体验
- 体感互动：全身运动与虚拟世界的融合
- 运动乐趣：跳跃、挥手、伸展等动作融入游戏
- 沉浸感：摄像头画面 + 虚拟元素的 AR 效果

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| BodyInput | input | skeleton: `true`, matchPose: `''`（或特定姿势） |
| Spawner | mechanic | direction: `'down'`（或 `'random'`），frequency: `2.0`, speed: `{ min: 60, max: 120 }` |
| Collision | mechanic | rules: `[{ a: 'body', b: 'objects', event: 'hit', destroy: ['b'] }]` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| Scorer | 接触虚拟物体得分 |
| Timer | 倒计时限制互动时间 |
| Lives | 可选：碰到危险物体扣血 |
| ParticleVFX | 物体互动时播放特效 |
| SoundFX | 互动音效 |
| UIOverlay | 显示分数和倒计时 |
| ResultScreen | 展示互动分数 |

## 模块连线图

```
摄像头画面 → BodyInput (MediaPipe Pose)
    ↓ input:body:move { landmarks }
    ↓ (将关键点注册到 Collision 的 body 层)
    ↓ 如：左手腕、右手腕各注册一个碰撞体
    ↓
Spawner ──→ 生成虚拟物体 (objects 层)
    ↓
Collision 检测 (body 层 vs objects 层)
    ↓ collision:hit
    ↓
Scorer ← collision:hit
UIOverlay / ParticleVFX / SoundFX
    ↓
Timer → timer:end → GameFlow → finished → ResultScreen
```

## 素材需求
- 虚拟物体精灵（星星、气球、雪花等）
- 骨骼线条样式
- AR 叠加层 UI
- 背景：使用摄像头实时画面
- 音效：收集音、碰撞音
- 背景音乐（活力节奏）

## 示例配置

```json
{
  "gameType": "world-ar",
  "modules": [
    {
      "id": "bodyInput1",
      "type": "BodyInput",
      "params": { "skeleton": true, "matchPose": "", "tolerance": 0.3 }
    },
    {
      "id": "spawner1",
      "type": "Spawner",
      "params": {
        "items": [
          { "asset": "star_yellow", "weight": 2 },
          { "asset": "balloon_red", "weight": 1 }
        ],
        "speed": { "min": 60, "max": 120 },
        "frequency": 2.0,
        "direction": "down",
        "maxCount": 8
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [{ "a": "body", "b": "objects", "event": "hit", "destroy": ["b"] }]
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": { "perHit": 10 }
    },
    {
      "id": "timer1",
      "type": "Timer",
      "params": { "mode": "countdown", "duration": 45 }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 3, "onFinish": "show_result" }
    }
  ]
}
```
