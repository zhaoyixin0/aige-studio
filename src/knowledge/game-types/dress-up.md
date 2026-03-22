# 换装/贴纸类 (Dress Up) — Game Type Skill

## 游戏定义
玩家通过面部追踪定位面部位置，结合触屏操作选择和拖拽贴纸/装饰物贴到面部或身体上。适用于虚拟试妆、AR 贴纸、角色装扮等互动场景。无固定输赢条件，以创意和分享为核心。

## 核心体验
- 创意表达：自由选择和搭配装饰物
- AR 互动：贴纸跟随面部移动的趣味效果
- 社交分享：生成的效果图适合截图分享

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| FaceInput | input | tracking: `'headXY'`, smoothing: `0.3`, sensitivity: `1` |
| TouchInput | input | gesture: `'tap'`（选择贴纸） |
| GameFlow | feedback | countdown: `0`, onFinish: `'none'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| SoundFX | 选择/放置贴纸音效 |
| ParticleVFX | 放置贴纸时播放 sparkle 特效 |
| UIOverlay | 显示贴纸选择面板 |
| ResultScreen | 截图/分享功能 |

## 模块连线图

```
摄像头画面 → FaceInput
    ↓ input:face:move { x, y }
    ↓ (面部位置用于锚定贴纸)
    ↓
TouchInput
    ↓ input:touch:tap { x, y } (选择贴纸)
    ↓ input:touch:swipe (拖拽贴纸位置/大小)
    ↓
UI 层 ← 管理贴纸列表和放置状态
    ↓
    ↓ 贴纸跟随面部关键点移动
    ↓
SoundFX ← 放置贴纸事件
ParticleVFX ← 放置贴纸事件
    ↓
ResultScreen → 截图/分享
```

## 素材需求
- 贴纸素材集（帽子、眼镜、胡子、耳朵、花冠等 10~20 种）
- 贴纸选择面板 UI
- 面部追踪锚点定义
- 背景：使用摄像头实时画面
- 音效：选择音、放置音、撕掉音
- 截图/分享按钮

## 示例配置

```json
{
  "gameType": "dress-up",
  "modules": [
    {
      "id": "faceInput1",
      "type": "FaceInput",
      "params": { "tracking": "headXY", "smoothing": 0.3, "sensitivity": 1 }
    },
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": { "gesture": "tap" }
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
          "input:touch:tap": "sfx_select"
        }
      }
    },
    {
      "id": "particleVfx1",
      "type": "ParticleVFX",
      "params": {
        "events": {
          "input:touch:tap": { "effect": "sparkle", "at": "target", "duration": 400, "color": "#FF69B4" }
        }
      }
    }
  ]
}
```
