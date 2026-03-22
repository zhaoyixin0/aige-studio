# 接住类 (Catch) — Game Type Skill

## 游戏定义
玩家通过面部或手部控制一个接住容器（如篮子、盘子），接住从上方落下的物体来获得分数。核心循环为：物体生成 → 下落 → 玩家移动接住 → 碰撞检测 → 加分。

## 核心体验
- 直觉性移动：头部/手部控制映射自然，无需学习成本
- 逐渐加快的节奏：难度递增让玩家保持紧张感
- 即时正反馈：接住物体的瞬间获得视觉和音效奖励

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| FaceInput 或 HandInput | input | tracking: `'headXY'`, smoothing: `0.3`, sensitivity: `1` |
| Spawner | mechanic | direction: `'down'`, frequency: `1.5`, speed: `{ min: 100, max: 200 }`, maxCount: `10` |
| Collision | mechanic | rules: `[{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }]` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 1000, multiplier: [1, 1.5, 2] }` |
| Timer | mechanic | mode: `'countdown'`, duration: `30` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| DifficultyRamp | 随时间降低 Spawner 的 frequency 和提高 speed，保持挑战性 |
| Lives | 可选：漏接 N 个后游戏结束（替代纯计时模式） |
| ParticleVFX | 接住时播放金色 confetti 特效，连击时播放 sparkle 特效 |
| SoundFX | 接住/漏接/倒计时音效 |
| UIOverlay | 显示分数、倒计时、连击数 |
| ResultScreen | 展示最终分数和星级评价 |

## 模块连线图

```
FaceInput/HandInput
    ↓ input:face:move / input:hand:move
    ↓ (更新 Collision 中 player 层对象位置)
Spawner ──→ 生成物体 ──→ 注册到 Collision (items 层)
    ↓                         ↓
    ↓ spawner:destroyed       Collision 检测
    ↓ (漏接)                  ↓ collision:hit (接住)
    ↓                         ↓
Scorer ← scorer:update ←── Scorer.onHit()
    ↓                         ↓
UIOverlay ← scorer:update    ParticleVFX ← collision:hit
    ↓                         SoundFX ← collision:hit
Timer ──→ timer:tick ──→ UIOverlay
    ↓ timer:end
GameFlow ──→ gameflow:state(finished) ──→ ResultScreen
```

## 素材需求
- 玩家角色/容器精灵（1张，如篮子、盘子）
- 下落物体精灵（3~6种，如水果、星星）
- 背景图（1张）
- 音效：接住音、漏接音、倒计时音、结算音
- 背景音乐（可选）

## 示例配置

```json
{
  "gameType": "catch",
  "modules": [
    {
      "id": "faceInput1",
      "type": "FaceInput",
      "params": { "tracking": "headXY", "smoothing": 0.3, "sensitivity": 1 }
    },
    {
      "id": "spawner1",
      "type": "Spawner",
      "params": {
        "items": [
          { "asset": "fruit_apple", "weight": 1 },
          { "asset": "fruit_banana", "weight": 1 },
          { "asset": "fruit_orange", "weight": 1 }
        ],
        "speed": { "min": 120, "max": 220 },
        "frequency": 1.5,
        "direction": "down",
        "maxCount": 8,
        "spawnArea": { "x": 50, "y": 0, "width": 700, "height": 0 }
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [{ "a": "player", "b": "items", "event": "hit", "destroy": ["b"] }]
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": {
        "perHit": 10,
        "combo": { "enabled": true, "window": 1000, "multiplier": [1, 1.5, 2, 3] },
        "deductOnMiss": true,
        "deductAmount": 5
      }
    },
    {
      "id": "timer1",
      "type": "Timer",
      "params": { "mode": "countdown", "duration": 30 }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 3, "onFinish": "show_result" }
    },
    {
      "id": "diffRamp1",
      "type": "DifficultyRamp",
      "params": {
        "target": "spawner1",
        "mode": "time",
        "rules": [
          { "every": 10, "field": "frequency", "decrease": 0.2, "min": 0.5 }
        ]
      }
    }
  ]
}
```
