# 射击类 (Shooting) — Game Type Skill

## 游戏定义
玩家操控角色发射子弹，击败一波波来袭的敌人。核心循环为：玩家瞄准射击 → 子弹飞行 → 命中敌人（+分数）→ 敌人逼近玩家（-生命值）→ 波次递进。支持触屏点击射击和面部追踪瞄准两种操控方式。

## 核心体验
- 射击快感：发射子弹消灭敌人的即时反馈
- 躲避压力：敌人不断逼近，需要走位闪避攻击
- 波次递进：每波敌人更强更多，紧张感持续升级

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |
| PlayerMovement | mechanic | speed: `300`, bounds: `'screen'` |
| Projectile | mechanic | speed: `600`, cooldown: `0.3`, direction: `'up'`, layer: `'projectiles'` |
| Aim | mechanic | mode: `'touch'`, autoFire: `false` |
| EnemyAI | mechanic | behavior: `'chase'`, speed: `{ min: 60, max: 120 }`, layer: `'enemies'` |
| WaveSpawner | mechanic | waveCooldown: `3`, enemiesPerWave: `5`, waveScaling: `1.3` |
| Collision | mechanic | rules: `[{ a: 'projectiles', b: 'enemies', event: 'hit', destroy: ['a'] }, { a: 'player', b: 'enemies', event: 'damage' }]` |
| Scorer | mechanic | perHit: `10`, combo: `{ enabled: true, window: 1500, multiplier: [1, 1.5, 2, 3] }` |
| Health | mechanic | max: `100`, initial: `100`, onZero: `'finish'` |
| Lives | mechanic | count: `3`, onZero: `'finish'` |
| IFrames | mechanic | duration: `1.0`, flashRate: `0.1` |
| Timer | mechanic | mode: `'stopwatch'` |
| UIOverlay | feedback | display: `['score', 'health', 'lives', 'wave', 'timer']` |
| ResultScreen | feedback | show: `['score', 'wave', 'time', 'stars']` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| Shield | 提供临时护盾吸收伤害，增加策略深度 |
| DifficultyRamp | 随波次增加敌人速度、数量和 AI 攻击性 |
| ComboSystem | 连续击杀触发连击倍率，鼓励精准射击 |
| BulletPattern | 敌人发射弹幕，增加躲避难度 |
| ParticleVFX | 敌人爆炸、子弹轨迹、受伤闪烁特效 |
| SoundFX | 射击音、爆炸音、受伤音、波次警告音 |

## 模块连线图

```
TouchInput (tap)
    ↓ input:touch:tap
    ↓ (触发射击)
Aim → Projectile → 发射子弹 → 注册到 Collision (projectiles 层)
                                        ↓
WaveSpawner → EnemyAI → 生成敌人 → 注册到 Collision (enemies 层)
                                        ↓
                                  Collision 检测
                    ┌───────────────────┴───────────────────┐
                    ↓                                       ↓
          collision:hit                           collision:damage
    (子弹命中敌人)                          (敌人碰触玩家)
          ↓                                       ↓
    Scorer ← +分数                          Health ← -生命值
          ↓                                       ↓
    UIOverlay / ComboSystem              IFrames → 无敌闪烁
    ParticleVFX (敌人爆炸)                Lives ← health:zero
                                                  ↓ lives:zero
                                            GameFlow → finished
                                                  ↓
                                            ResultScreen
```

**关键碰撞规则**：
- `collision:hit` = 子弹(projectiles)命中敌人(enemies) = **加分**，子弹销毁
- `collision:damage` = 敌人(enemies)碰触玩家(player) = **扣血**，触发无敌帧

## 素材需求
- 玩家角色精灵（1张）
- 子弹精灵（1~2种）
- 敌人精灵（3~5种，不同外观和强度）
- 爆炸特效精灵
- 背景图（太空/战场等）
- 音效：射击音、爆炸音、受伤音、波次开始警告音
- 背景音乐

## 示例配置

```json
{
  "gameType": "shooting",
  "modules": [
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": { "gesture": "tap" }
    },
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 3, "onFinish": "show_result" }
    },
    {
      "id": "playerMovement1",
      "type": "PlayerMovement",
      "params": { "speed": 300, "bounds": "screen" }
    },
    {
      "id": "projectile1",
      "type": "Projectile",
      "params": {
        "speed": 600,
        "cooldown": 0.3,
        "direction": "up",
        "layer": "projectiles"
      }
    },
    {
      "id": "aim1",
      "type": "Aim",
      "params": { "mode": "touch", "autoFire": false }
    },
    {
      "id": "enemyAI1",
      "type": "EnemyAI",
      "params": {
        "behavior": "chase",
        "speed": { "min": 60, "max": 120 },
        "layer": "enemies"
      }
    },
    {
      "id": "waveSpawner1",
      "type": "WaveSpawner",
      "params": {
        "waveCooldown": 3,
        "enemiesPerWave": 5,
        "waveScaling": 1.3,
        "spawnArea": { "x": 50, "y": 0, "width": 980, "height": 0 }
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [
          { "a": "projectiles", "b": "enemies", "event": "hit", "destroy": ["a"] },
          { "a": "player", "b": "enemies", "event": "damage" }
        ]
      }
    },
    {
      "id": "scorer1",
      "type": "Scorer",
      "params": {
        "perHit": 10,
        "combo": { "enabled": true, "window": 1500, "multiplier": [1, 1.5, 2, 3] }
      }
    },
    {
      "id": "health1",
      "type": "Health",
      "params": { "max": 100, "initial": 100, "onZero": "finish" }
    },
    {
      "id": "lives1",
      "type": "Lives",
      "params": { "count": 3, "onZero": "finish" }
    },
    {
      "id": "iframes1",
      "type": "IFrames",
      "params": { "duration": 1.0, "flashRate": 0.1 }
    },
    {
      "id": "timer1",
      "type": "Timer",
      "params": { "mode": "stopwatch" }
    },
    {
      "id": "diffRamp1",
      "type": "DifficultyRamp",
      "params": {
        "target": "waveSpawner1",
        "mode": "wave",
        "rules": [
          { "every": 2, "field": "enemiesPerWave", "increase": 2, "max": 20 },
          { "every": 3, "field": "waveScaling", "increase": 0.1, "max": 2.0 }
        ]
      }
    }
  ]
}
```
