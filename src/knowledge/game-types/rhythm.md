# 节奏类 (Rhythm) — Game Type Skill

## 游戏定义
玩家按照音乐节拍在正确时机点击屏幕，节拍标记从生成区域移动到判定区域（hitzone），玩家需在标记到达判定区时精确点击。核心循环为：节拍生成 → 移动 → 到达判定区 → 玩家点击 → 碰撞判定 → 计分。

## 核心体验
- 音乐节奏：跟着音乐节拍点击的沉浸感
- 精准判定：完美命中的满足感
- 连击系统：持续完美命中的成就感

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'tap'` |
| Spawner | mechanic | direction: `'down'`（或 `'left'`），frequency 匹配 BPM |
| Collision | mechanic | rules: `[{ a: 'hitzone', b: 'notes', event: 'hit', destroy: ['b'] }]` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 500, multiplier: [1, 1.5, 2, 3, 5] }` |
| Timer | mechanic | mode: `'stopwatch'`（记录演奏时间）或 countdown |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| DifficultyRamp | 可选：随曲目进度加快节拍速度 |
| ParticleVFX | Perfect/Great/Miss 不同级别特效 |
| SoundFX | 命中音效 + 背景音乐 |
| UIOverlay | 显示分数、连击数、判定结果 |
| ResultScreen | 展示分数、最高连击、正确率 |

## 模块连线图

```
音乐播放 → 按 BPM 控制 Spawner 频率
    ↓
Spawner ──→ 生成节拍标记 (notes 层)
    ↓ 向下/向左移动
    ↓
TouchInput ── input:touch:tap
    ↓ (在 hitzone 注册点击碰撞体)
Collision (hitzone vs notes)
    ↓ collision:hit
    ↓
Scorer ← collision:hit → scorer:update
    ↓ scorer:combo:{N}
UIOverlay / ParticleVFX / SoundFX
    ↓
Spawner → spawner:destroyed (漏掉的 note)
    ↓
Scorer.onMiss() (deductOnMiss)
    ↓
Timer → 曲目结束 → GameFlow → finished → ResultScreen
```

## 素材需求
- 节拍标记精灵（不同颜色代表不同轨道/拍型）
- 判定区域（hitzone）样式
- 判定结果文字（Perfect/Great/Good/Miss）
- 轨道/赛道背景
- 音效：命中音（不同级别）、miss 音
- 背景音乐（核心素材，决定节拍频率）

## 示例配置

```json
{
  "gameType": "rhythm",
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
          { "asset": "note_red", "weight": 1 },
          { "asset": "note_blue", "weight": 1 }
        ],
        "speed": { "min": 200, "max": 200 },
        "frequency": 0.5,
        "direction": "down",
        "maxCount": 20,
        "spawnArea": { "x": 100, "y": 0, "width": 600, "height": 0 }
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [{ "a": "hitzone", "b": "notes", "event": "hit", "destroy": ["b"] }]
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": {
        "perHit": 10,
        "combo": { "enabled": true, "window": 500, "multiplier": [1, 1.5, 2, 3, 5] },
        "deductOnMiss": true,
        "deductAmount": 5
      }
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
    }
  ]
}
```
