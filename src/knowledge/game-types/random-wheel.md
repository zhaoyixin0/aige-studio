# 随机转盘类 (Random Wheel) — Game Type Skill

## 游戏定义
玩家通过点击或张嘴触发一个随机转盘/老虎机/卡牌翻转动画，经过旋转后随机停在一个结果上。适用于抽奖、点名、随机挑战等互动场景。

## 核心体验
- 期待感：旋转过程中的悬念和期待
- 随机惊喜：每次结果不同，保持新鲜感
- 简单互动：一键触发，零学习成本

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'tap'` |
| Randomizer | mechanic | animation: `'wheel'`, spinDuration: `3`, trigger: `'tap'` |
| GameFlow | feedback | countdown: `0`, onFinish: `'none'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| FaceInput | 支持张嘴触发转盘（trigger 设为 `'mouthOpen'`） |
| ParticleVFX | 结果揭晓时播放 confetti 特效 |
| SoundFX | 旋转过程音效 + 结果揭晓音效 |
| UIOverlay | 显示候选项列表、当前结果 |
| ResultScreen | 展示抽取结果（可选） |

## 模块连线图

```
TouchInput / FaceInput
    ↓ input:touch:tap / input:face:mouthOpen
Randomizer.spin()
    ↓ randomizer:spinning
    ↓ (旋转动画持续 spinDuration 秒)
    ↓ randomizer:result
    ↓
SoundFX ← randomizer:spinning (旋转音)
SoundFX ← randomizer:result (揭晓音)
ParticleVFX ← randomizer:result (庆祝特效)
UIOverlay ← 显示结果
```

## 素材需求
- 转盘/老虎机/卡牌背景
- 候选项图标（与 items 数量对应）
- 指针/选中框
- 音效：旋转音、减速音、停止揭晓音
- 庆祝特效素材

## 示例配置

```json
{
  "gameType": "random-wheel",
  "modules": [
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": { "gesture": "tap" }
    },
    {
      "id": "randomizer1",
      "type": "Randomizer",
      "params": {
        "items": [
          { "asset": "prize_a", "label": "奖品A", "weight": 1 },
          { "asset": "prize_b", "label": "奖品B", "weight": 2 },
          { "asset": "prize_c", "label": "奖品C", "weight": 1 },
          { "asset": "prize_d", "label": "再来一次", "weight": 3 }
        ],
        "animation": "wheel",
        "spinDuration": 3,
        "trigger": "tap"
      }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 0, "onFinish": "none" }
    },
    {
      "id": "soundFx1",
      "type": "SoundFX",
      "params": {
        "events": {
          "randomizer:spinning": "sfx_spin",
          "randomizer:result": "sfx_reveal"
        }
      }
    },
    {
      "id": "particleVfx1",
      "type": "ParticleVFX",
      "params": {
        "events": {
          "randomizer:result": { "effect": "confetti", "at": "center", "duration": 1000, "color": "#FFD700" }
        }
      }
    }
  ]
}
```
