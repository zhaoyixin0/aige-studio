# 手势互动类 (Gesture) — Game Type Skill

## 游戏定义
玩家通过手部手势与游戏互动。游戏提示特定手势（张开手掌、握拳、竖大拇指、比耶等），玩家需要在限定时间内做出正确手势。识别成功后得分，支持连续手势挑战和速度挑战。

## 核心体验
- 体感互动：用手势控制游戏的新奇体验
- 反应训练：快速识别并做出手势
- 趣味挑战：手势越来越快或越来越复杂

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| HandInput | input | gesture: `'any'`, confidence: `0.7` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 2000, multiplier: [1, 1.5, 2] }` |
| Timer | mechanic | mode: `'countdown'`, duration: `30` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| DifficultyRamp | 缩短每个手势的响应时间 |
| ParticleVFX | 手势匹配成功时在手部位置播放特效 |
| SoundFX | 正确/错误/超时音效 |
| UIOverlay | 显示目标手势、分数、倒计时 |
| ResultScreen | 展示总分、完成次数 |

## 模块连线图

```
HandInput
    ↓ input:hand:gesture { gesture: string }
    ↓ input:hand:move { x, y }
    ↓
游戏逻辑层 (判断当前目标手势是否匹配)
    ↓ 匹配成功 → collision:hit (复用)
    ↓
Scorer ← collision:hit → scorer:update
    ↓
UIOverlay ← scorer:update (显示分数和连击)
ParticleVFX ← collision:hit (手部位置特效)
SoundFX ← collision:hit (正确音效)
    ↓
Timer → timer:end → GameFlow → finished → ResultScreen
```

## 素材需求
- 手势提示图标（张手、握拳、大拇指、比耶等）
- 手部追踪可视化叠加
- 匹配成功/失败动画
- 背景图
- 音效：正确音、错误音、倒计时音

## 示例配置

```json
{
  "gameType": "gesture",
  "modules": [
    {
      "id": "handInput1",
      "type": "HandInput",
      "params": { "gesture": "any", "confidence": 0.7 }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": {
        "perHit": 10,
        "combo": { "enabled": true, "window": 2000, "multiplier": [1, 1.5, 2] }
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
      "id": "uiOverlay1",
      "type": "UIOverlay",
      "params": { "elements": ["score", "timer", "gesture_prompt"] }
    },
    {
      "id": "resultScreen1",
      "type": "ResultScreen",
      "params": {
        "show": ["score"],
        "rating": { "3star": 200, "2star": 100, "1star": 50 },
        "actions": ["retry", "share"]
      }
    }
  ]
}
```
