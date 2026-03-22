# 躲避类 (Dodge) — Game Type Skill

## 游戏定义
玩家通过面部追踪控制角色，躲避从各方向飞来的障碍物。碰到障碍物会失去生命，在倒计时内存活即为胜利。核心循环为：障碍物生成 → 移动 → 玩家躲避 → 碰撞判定 → 扣血或存活。

## 核心体验
- 紧张感：障碍物逐渐加速，玩家需要快速反应
- 生存挑战：生命值有限，每次碰撞都心跳加速
- 空间感知：多方向障碍物训练玩家的空间判断力

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| FaceInput | input | tracking: `'headXY'`, smoothing: `0.25`, sensitivity: `1.2` |
| Spawner | mechanic | direction: `'down'`（或 `'random'`）, frequency: `1.2`, speed: `{ min: 150, max: 280 }` |
| Collision | mechanic | rules: `[{ a: 'player', b: 'obstacles', event: 'damage' }]` |
| Lives | mechanic | count: `3`, onZero: `'finish'` |
| Timer | mechanic | mode: `'countdown'`, duration: `30` |
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| DifficultyRamp | 随时间提高 Spawner 的 speed 和降低 frequency |
| Scorer | 可选：存活时间越长分数越高（用 stopwatch + 每秒加分） |
| ParticleVFX | 被击中时播放红色 burst 特效 |
| SoundFX | 碰撞/倒计时/心跳音效 |
| UIOverlay | 显示生命值、倒计时 |
| ResultScreen | 展示存活时间和星级 |

## 模块连线图

```
FaceInput
    ↓ input:face:move
    ↓ (更新 Collision 中 player 层位置)
Spawner ──→ 生成障碍物 ──→ 注册到 Collision (obstacles 层)
                              ↓
                        Collision 检测
                              ↓ collision:damage
                              ↓
Lives ← collision:damage ─── Lives.decrease()
    ↓ lives:change              ↓ lives:zero
UIOverlay                   GameFlow → finished
                                ↓
Timer ──→ timer:end ──→ GameFlow → finished
                              ↓
                        ResultScreen
```

## 素材需求
- 玩家角色精灵（1张）
- 障碍物精灵（3~5种，如石头、炸弹、刺球）
- 背景图（1张）
- 音效：被击中音、倒计时音、存活成功音
- 心跳/紧张背景音乐（可选）

## 示例配置

```json
{
  "gameType": "dodge",
  "modules": [
    {
      "id": "faceInput1",
      "type": "FaceInput",
      "params": { "tracking": "headXY", "smoothing": 0.25, "sensitivity": 1.2 }
    },
    {
      "id": "spawner1",
      "type": "Spawner",
      "params": {
        "items": [
          { "asset": "obstacle_rock", "weight": 2 },
          { "asset": "obstacle_bomb", "weight": 1 }
        ],
        "speed": { "min": 150, "max": 280 },
        "frequency": 1.2,
        "direction": "down",
        "maxCount": 12,
        "spawnArea": { "x": 0, "y": 0, "width": 800, "height": 0 }
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [{ "a": "player", "b": "obstacles", "event": "damage" }]
      }
    },
    {
      "id": "lives1",
      "type": "Lives",
      "params": { "count": 3, "events": { "damage": -1 }, "onZero": "finish" }
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
      "id": "diffRamp1",
      "type": "DifficultyRamp",
      "params": {
        "target": "spawner1",
        "mode": "time",
        "rules": [
          { "every": 8, "field": "frequency", "decrease": 0.15, "min": 0.4 },
          { "every": 12, "field": "speed", "increase": 30, "max": 450 }
        ]
      }
    }
  ]
}
```
