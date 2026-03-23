# 答题类 (Quiz) — Game Type Skill

## 游戏定义
玩家通过触屏点击回答一系列选择题，答对加分、答错不扣分或少量扣分。每道题有独立倒计时，超时自动判错。所有题目完成后显示总分和正确率。

## 核心体验
- 知识挑战：测试玩家的知识储备
- 时间压力：每题限时增加紧迫感
- 即时反馈：每题答完立即知道对错

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'tap'` |
| QuizEngine | mechanic | timePerQuestion: `15`, scoring: `{ correct: 10, wrong: 0, timeBonus: true }` |
| Scorer | mechanic | perHit: `10`（用于统一计分显示） |
| Timer | mechanic | mode: `'countdown'`, duration: `60`（总时限，可选） |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| ParticleVFX | 答对播放绿色 sparkle，答错播放红色 burst |
| SoundFX | 正确/错误/超时音效 |
| UIOverlay | 显示分数、题号进度、倒计时 |
| ResultScreen | 展示总分、正确率、星级评价 |

## 模块连线图

```
TouchInput
    ↓ input:touch:tap
    ↓ (UI 层将点击映射为选项 index)
QuizEngine.answer(index)
    ↓ quiz:correct / quiz:wrong
    ↓ quiz:score (答对时)
    ↓ quiz:question (下一题)
    ↓ quiz:finished (全部完成)
    ↓
SoundFX ← quiz:correct / quiz:wrong
ParticleVFX ← quiz:correct
UIOverlay ← quiz:score → 更新分数
    ↓
quiz:finished ──→ GameFlow → finished
                      ↓
                  ResultScreen
```

## 素材需求
- 题目背景/卡片样式
- 选项按钮样式
- 正确/错误标记图标
- 音效：正确音、错误音、超时音、结算音
- 背景音乐（轻松节奏）

## 示例配置

```json
{
  "gameType": "quiz",
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
            "question": "1 + 1 = ?",
            "options": ["2", "3", "4", "1"],
            "correct": 0
          },
          {
            "question": "太阳从哪边升起？",
            "options": ["东", "西", "南", "北"],
            "correct": 0
          },
          {
            "question": "地球上最大的海洋是？",
            "options": ["太平洋", "大西洋", "印度洋", "北冰洋"],
            "correct": 0
          }
        ],
        "timePerQuestion": 15,
        "scoring": { "correct": 10, "wrong": 0, "timeBonus": true }
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
      "params": { "mode": "countdown", "duration": 60 }
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
        "show": ["score", "accuracy"],
        "rating": { "3star": 80, "2star": 50, "1star": 20 }
      }
    }
  ]
}
```
