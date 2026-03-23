# 表情触发类 (Expression) — Game Type Skill

## 游戏定义
玩家通过面部表情（张嘴、微笑、眨眼等）触发游戏事件。游戏会提示玩家做出特定表情，正确做出后得分或推进游戏进度。适合拍照互动、表情挑战等趣味场景。

## 核心体验
- 表情互动：用脸部表情玩游戏，新奇有趣
- 模仿挑战：快速做出指定表情的反应训练
- 社交分享：表情游戏天然适合录制和分享

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| FaceInput | input | tracking: `'mouthOpen'`（或按需切换），smoothing: `0.2`, sensitivity: `1` |
| ExpressionDetector | mechanic | expressionType: `'smile'`, threshold: `0.6`, cooldown: `800` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 2000, multiplier: [1, 1.5, 2] }` |
| Timer | mechanic | mode: `'countdown'`, duration: `30` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| ParticleVFX | 表情触发成功时播放特效 |
| SoundFX | 成功/失败音效 |
| UIOverlay | 显示当前目标表情、分数、倒计时 |
| ResultScreen | 展示总分和表情完成次数 |
| AudioInput | 声音作为辅助输入（如喊叫） |

## 模块连线图

```
FaceInput
    ↓ input:face:mouthOpen (张嘴)
    ↓ input:face:smile (微笑)
    ↓ input:face:blink (眨眼)
    ↓
游戏逻辑层 (判断当前目标表情是否匹配)
    ↓ 匹配成功
    ↓ collision:hit (复用 hit 事件触发 Scorer)
    ↓
Scorer ← collision:hit → scorer:update
    ↓
UIOverlay ← scorer:update
ParticleVFX ← collision:hit
SoundFX ← collision:hit
    ↓
Timer → timer:end → GameFlow → finished → ResultScreen
```

## 素材需求
- 目标表情图标/动画（张嘴、微笑、眨眼、惊讶等）
- 玩家摄像头画面框
- 成功/失败反馈图标
- 背景图（趣味/卡通风格）
- 音效：表情匹配成功音、失败音、切换音

## 示例配置

```json
{
  "gameType": "expression",
  "modules": [
    {
      "id": "faceInput1",
      "type": "FaceInput",
      "params": { "tracking": "mouthOpen", "smoothing": 0.2, "sensitivity": 1 }
    },
    {
      "id": "expressionDetector1",
      "type": "ExpressionDetector",
      "params": { "expressionType": "smile", "threshold": 0.6, "cooldown": 800 }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": { "perHit": 10, "combo": { "enabled": true, "window": 2000, "multiplier": [1, 1.5, 2] } }
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
      "id": "soundFx1",
      "type": "SoundFX",
      "params": {
        "events": {
          "collision:hit": "sfx_correct",
          "input:face:mouthOpen": "sfx_pop"
        }
      }
    },
    {
      "id": "resultScreen1",
      "type": "ResultScreen",
      "params": {
        "show": ["score", "combo_max"],
        "rating": { "3star": 200, "2star": 100, "1star": 30 }
      }
    }
  ]
}
```
