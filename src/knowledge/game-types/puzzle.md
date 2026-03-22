# 拼图/配对类 (Puzzle) — Game Type Skill

## 游戏定义
玩家通过触屏点击完成配对或拼图任务。利用 QuizEngine 将配对问题包装为选择题格式：展示一个目标（图片/文字），玩家从选项中点击正确的配对项。适合记忆配对、词汇匹配、图片拼接等玩法。

## 核心体验
- 思考与记忆：需要观察和记忆来找到正确配对
- 成就感：每次正确配对的满足感
- 渐进挑战：题目难度可以逐步增加

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'tap'` |
| QuizEngine | mechanic | timePerQuestion: `20`, scoring: `{ correct: 10, wrong: -5, timeBonus: true }` |
| Scorer | mechanic | perHit: `10` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| Timer | 总时限或计时记录用时 |
| ParticleVFX | 配对成功时播放特效 |
| SoundFX | 配对成功/失败音效 |
| UIOverlay | 显示分数、进度、倒计时 |
| ResultScreen | 展示总分、正确率、用时 |

## 模块连线图

```
TouchInput
    ↓ input:touch:tap
    ↓ (UI 层将点击映射为选项 index)
QuizEngine.answer(index)
    ↓ quiz:correct (配对成功)
    ↓ quiz:wrong (配对失败)
    ↓ quiz:question (下一对)
    ↓ quiz:finished (全部完成)
    ↓
Scorer ← quiz:score
SoundFX ← quiz:correct / quiz:wrong
ParticleVFX ← quiz:correct
UIOverlay ← quiz:score
    ↓
quiz:finished → GameFlow → finished → ResultScreen
```

## 素材需求
- 配对项目图片/图标（根据题目数量）
- 选项卡片样式
- 匹配成功/失败动画
- 背景图
- 音效：匹配成功音、失败音、翻转音

## 示例配置

```json
{
  "gameType": "puzzle",
  "modules": [
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": { "gesture": "tap" }
    },
    {
      "id": "quizEngine1",
      "type": "QuizEngine",
      "params": {
        "questions": [
          {
            "text": "找到「苹果」的英文",
            "options": ["Banana", "Apple", "Orange", "Grape"],
            "correctIndex": 1
          },
          {
            "text": "找到「猫」的配对图",
            "options": ["🐶", "🐱", "🐰", "🐻"],
            "correctIndex": 1
          }
        ],
        "timePerQuestion": 20,
        "scoring": { "correct": 10, "wrong": -5, "timeBonus": true }
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": { "perHit": 10 }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 3, "onFinish": "show_result" }
    },
    {
      "id": "resultScreen1",
      "type": "ResultScreen",
      "params": {
        "show": ["score", "accuracy", "time"],
        "rating": { "3star": 100, "2star": 60, "1star": 30 },
        "actions": ["retry", "share"]
      }
    }
  ]
}
```
