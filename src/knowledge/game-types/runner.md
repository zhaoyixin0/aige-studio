# 跑酷类 (Runner) — Game Type Skill

## 游戏定义
玩家控制角色在不断前进的赛道上奔跑，通过点击/滑动操作躲避障碍物并收集金币。核心体验为持续加速的跑酷，同时结合障碍躲避和物品收集的双重循环。DifficultyRamp 是核心模块，确保速度和频率随时间递增。

## 核心体验
- 速度感：不断加快的移动速度带来刺激体验
- 反应训练：快速识别障碍并做出跳跃/闪避决策
- 收集乐趣：路途中收集金币/道具增加积极反馈

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| TouchInput | input | gesture: `'swipe'`（或 tap 用于跳跃） |
| Spawner | mechanic | direction: `'left'`（从右向左滚动），frequency: `1.0`, speed: `{ min: 200, max: 300 }`, maxCount: `10`, spawnArea: `{ x: 1080, y: 200, width: 0, height: 1400 }` |
| Collision | mechanic | rules: 见下方双规则 |
| Scorer | mechanic | perHit: `5`（收集金币得分） |
| DifficultyRamp | mechanic | 随时间增加 speed 和降低 frequency |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

### Collision 双规则配置

```json
[
  { "a": "player", "b": "obstacles", "event": "damage" },
  { "a": "player", "b": "coins", "event": "hit", "destroy": ["b"] }
]
```

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| Lives | 碰到障碍扣血，3 条命 |
| Timer | 可选：限时生存模式 |
| ParticleVFX | 收集金币特效、碰撞受伤特效 |
| SoundFX | 收集音、碰撞音、加速音 |
| UIOverlay | 显示分数、生命、速度指示 |
| ResultScreen | 展示跑步距离/分数/星级 |

## 模块连线图

```
TouchInput
    ↓ input:touch:swipe (上滑跳跃) / input:touch:tap (跳跃)
    ↓ (更新 player 状态：跳跃/下蹲)
Spawner ──→ 生成障碍物 (obstacles 层) + 金币 (coins 层)
    ↓
Collision 检测
    ↓ collision:damage (碰障碍)     ↓ collision:hit (收集金币)
    ↓                                ↓
Lives ← collision:damage          Scorer ← collision:hit
    ↓ lives:zero                      ↓ scorer:update
GameFlow → finished               UIOverlay / SoundFX / ParticleVFX
    ↓
DifficultyRamp ──→ 每 N 秒修改 Spawner 参数 → difficulty:update
    ↓
ResultScreen
```

## 素材需求
- 玩家角色精灵（跑/跳/滑动动画）
- 障碍物精灵（3~5种）
- 金币/收集物精灵
- 跑道/地面背景（可滚动）
- 音效：跳跃音、收集音、碰撞音、加速音
- 背景音乐（节奏逐渐加快）

## 示例配置

```json
{
  "gameType": "runner",
  "modules": [
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": { "gesture": "swipe" }
    },
    {
      "id": "spawner1",
      "type": "Spawner",
      "params": {
        "items": [
          { "asset": "obstacle", "weight": 2 },
          { "asset": "coin", "weight": 3 }
        ],
        "speed": { "min": 200, "max": 300 },
        "frequency": 1.0,
        "direction": "left",
        "maxCount": 10,
        "spawnArea": { "x": 1080, "y": 200, "width": 0, "height": 1400 }
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [
          { "a": "player", "b": "items", "event": "hit", "destroy": ["b"] }
        ]
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": { "perHit": 5 }
    },
    {
      "id": "lives1",
      "type": "Lives",
      "params": { "count": 3, "onZero": "finish" }
    },
    {
      "id": "diffRamp1",
      "type": "DifficultyRamp",
      "params": {
        "target": "spawner1",
        "mode": "time",
        "rules": [
          { "every": 8, "field": "frequency", "decrease": 0.1, "min": 0.4 },
          { "every": 10, "field": "maxCount", "increase": 2, "max": 15 }
        ]
      }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 3, "onFinish": "show_result" }
    }
  ]
}
```
