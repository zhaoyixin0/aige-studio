# 射击类 (Shooting) — Game Type Skill

## 游戏定义
玩家通过面部追踪或触屏点击控制准星位置，射击屏幕上移动的目标。击中目标得分，可包含不同分值的目标。支持面部瞄准+张嘴射击或触屏直接点击射击两种操控方式。

## 核心体验
- 瞄准快感：追踪移动目标的紧张感
- 精准度挑战：目标越小越快越难击中
- 多样性：不同目标不同分值增加策略深度

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| FaceInput 或 TouchInput | input | FaceInput: tracking: `'headXY'`, smoothing: `0.2`; TouchInput: gesture: `'tap'` |
| Spawner | mechanic | direction: `'random'`, frequency: `1.0`, speed: `{ min: 80, max: 180 }` |
| Collision | mechanic | rules: `[{ a: 'crosshair', b: 'targets', event: 'hit', destroy: ['b'] }]` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 1200, multiplier: [1, 1.5, 2] }` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| Timer | 倒计时限制射击时间 |
| DifficultyRamp | 随分数增加目标速度和减少频率间隔 |
| Lives | 可选：限制弹药/生命数 |
| ParticleVFX | 击中目标时播放爆炸特效 |
| SoundFX | 射击音、击中音、连击音 |
| UIOverlay | 显示分数、准星、弹药/倒计时 |
| ResultScreen | 展示命中率、分数、星级 |

## 模块连线图

```
FaceInput                    TouchInput
    ↓ input:face:move            ↓ input:touch:tap
    ↓ (更新准星位置)              ↓ (创建点击碰撞体)
    ↓                            ↓
Collision (crosshair 层)    ← 准星/点击位置
Spawner → 生成目标 → Collision (targets 层)
                    ↓
              Collision 检测
                    ↓ collision:hit
                    ↓
Scorer ← collision:hit
    ↓ scorer:update
UIOverlay / ParticleVFX / SoundFX
    ↓
Timer → timer:end → GameFlow → finished → ResultScreen
```

## 素材需求
- 准星精灵
- 目标物体精灵（3~5种，不同分值）
- 击中爆炸特效
- 背景图（射击场/太空等）
- 音效：射击音、击中音、连击音、miss 音
- 背景音乐

## 示例配置

```json
{
  "gameType": "shooting",
  "modules": [
    {
      "id": "faceInput1",
      "type": "FaceInput",
      "params": { "tracking": "headXY", "smoothing": 0.2, "sensitivity": 1.2 }
    },
    {
      "id": "spawner1",
      "type": "Spawner",
      "params": {
        "items": [
          { "asset": "target_normal", "weight": 3 },
          { "asset": "target_gold", "weight": 1 },
          { "asset": "target_small", "weight": 1 }
        ],
        "speed": { "min": 80, "max": 180 },
        "frequency": 1.0,
        "direction": "random",
        "maxCount": 6
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [{ "a": "crosshair", "b": "targets", "event": "hit", "destroy": ["b"] }]
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": {
        "perHit": 10,
        "combo": { "enabled": true, "window": 1200, "multiplier": [1, 1.5, 2] }
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
