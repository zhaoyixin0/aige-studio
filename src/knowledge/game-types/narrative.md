# 分支叙事类 (Narrative) — Game Type Skill

## 游戏定义
玩家通过点击选项推进一个分支叙事故事。每个节点展示一段文字/图片，提供 2~4 个选项供玩家选择，不同选择导向不同的故事分支和结局。利用 QuizEngine 的问答机制实现选择分支。

## 核心体验
- 故事沉浸：引人入胜的叙事内容
- 选择权：每个决定影响故事走向
- 多结局：鼓励重玩探索不同路线

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'tap'` |
| QuizEngine | mechanic | timePerQuestion: `30`（给玩家足够阅读时间），scoring: `{ correct: 0, wrong: 0, timeBonus: false }` |
| GameFlow | feedback | countdown: `0`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| SoundFX | 翻页音效、BGM 切换 |
| UIOverlay | 显示对话框、选项按钮、角色立绘 |
| ResultScreen | 展示到达的结局和路径回顾 |
| ParticleVFX | 关键转折点的氛围特效 |

## 模块连线图

```
TouchInput
    ↓ input:touch:tap
    ↓ (UI 层将点击映射为选项 index)
QuizEngine.answer(index)
    ↓ quiz:correct / quiz:wrong
    ↓ (在叙事类中 correct/wrong 仅表示选择了哪个选项)
    ↓ quiz:question (下一个叙事节点)
    ↓ quiz:finished (故事结束)
    ↓
SoundFX ← 翻页/选择事件
UIOverlay ← 更新对话框和选项
    ↓
quiz:finished → GameFlow → finished → ResultScreen
                                         ↓
                                    展示结局
```

## 素材需求
- 故事文本内容
- 角色立绘（如有）
- 场景背景图（不同场景切换）
- 选项按钮样式
- 音效：翻页音、选择确认音、BGM
- 结局插图

## 示例配置

```json
{
  "gameType": "narrative",
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
            "text": "你走进一片黑暗的森林，前方有两条路。左边传来水声，右边有微弱的光芒。你选择...",
            "options": ["走向左边的水声", "走向右边的光芒"],
            "correctIndex": 0
          },
          {
            "text": "你发现了一条清澈的小溪，溪边有一只受伤的小鸟。你决定...",
            "options": ["帮助小鸟", "继续前行", "在此休息"],
            "correctIndex": 0
          }
        ],
        "timePerQuestion": 30,
        "scoring": { "correct": 0, "wrong": 0, "timeBonus": false }
      }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 0, "onFinish": "show_result" }
    },
    {
      "id": "soundFx1",
      "type": "SoundFX",
      "params": {
        "events": {
          "quiz:question": "sfx_page_turn"
        }
      }
    },
    {
      "id": "resultScreen1",
      "type": "ResultScreen",
      "params": {
        "show": ["score"],
        "actions": ["retry", "share", "home"]
      }
    }
  ]
}
```
