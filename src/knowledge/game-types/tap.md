# 点击类 (Tap) — Game Type Skill

## 游戏定义
玩家通过触屏点击来消除/击中屏幕上出现的目标物体，在限定时间内获取尽可能多的分数。目标物体由 Spawner 生成并可能移动，玩家需要准确快速地点击目标位置。

## 核心体验
- 反应速度：快速准确地点击目标
- 节奏感：物体出现的频率形成游戏节奏
- 连击快感：快速连续命中带来连击加分

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'tap'` |
| Spawner | mechanic | direction: `'down'`, frequency: `1.0`, speed: `{ min: 0, max: 0 }`, maxCount: `8`, spawnArea: `{ x: 80, y: 150, width: 920, height: 1500 }` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 800, multiplier: [1, 1.5, 2, 3] }` |
| Timer | mechanic | mode: `'countdown'`, duration: `30` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| Collision | 如果目标需要碰撞检测（点击位置 vs 目标位置） |
| DifficultyRamp | 随时间加快生成速度 |
| ParticleVFX | 点中目标时播放 burst 特效 |
| SoundFX | 点击音、得分音、连击音 |
| UIOverlay | 显示分数、倒计时、连击 |
| ResultScreen | 展示最终分数 |

## 模块连线图

```
TouchInput
    ↓ input:touch:tap { x, y }
    ↓ (检查点击位置是否命中 Spawner 物体)
Spawner 物体列表 ──→ 碰撞判定（点击半径 vs 物体位置）
    ↓ collision:hit (命中)
Scorer ← collision:hit → scorer:update
    ↓
UIOverlay ← scorer:update
ParticleVFX ← collision:hit
SoundFX ← collision:hit
    ↓
Timer ──→ timer:end ──→ GameFlow → finished → ResultScreen
```

## 素材需求
- 目标物体精灵（3~5种，如泡泡、气球、地鼠）
- 点击反馈效果（爆炸/消散）
- 背景图
- 音效：点击命中音、连击音、倒计时音
- 背景音乐（欢快节奏）

## 示例配置

```json
{
  "gameType": "tap",
  "modules": [
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": { "gesture": "tap" }
    },
    {
      "id": "spawner1",
      "type": "Spawner",
      "params": {
        "items": [
          { "asset": "bubble_red", "weight": 2 },
          { "asset": "bubble_blue", "weight": 2 },
          { "asset": "bubble_gold", "weight": 1 }
        ],
        "speed": { "min": 0, "max": 0 },
        "frequency": 1.0,
        "direction": "down",
        "maxCount": 8,
        "spawnArea": { "x": 80, "y": 150, "width": 920, "height": 1500 }
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
        "combo": { "enabled": true, "window": 800, "multiplier": [1, 1.5, 2, 3] }
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
    }
  ]
}
```
