# 动作RPG类 (Action RPG) — Game Type Skill

## 游戏定义
波次制射击游戏，融合 RPG 成长系统。玩家在 2D 平台场景中操控角色移动、跳跃、射击，击败一波波涌来的敌人。击杀敌人获得经验值和战利品掉落，经验值累积升级后提升属性（生命、攻击、防御），战利品包括药水和金币。核心循环为：波次生成敌人 → 射击/闪避 → 击杀得分+XP → 掉落拾取 → 升级成长 → 下一波。

## 核心体验
- 射击快感：自动瞄准+连续射击，弹幕密度带来压迫感和爽快感
- 成长驱动：每次升级带来可感知的属性提升，激励玩家继续推进波次
- 战利品收集：敌人死亡掉落药水和金币，拾取的即时正反馈增强沉浸感
- 生存压力：敌人逐波增强，生命值和护盾管理构成资源博弈

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| GameFlow | feedback | countdown: `0`, onFinish: `'show_result'` |
| PlayerMovement | mechanic | speed: `200`, acceleration: `800`, deceleration: `600` |
| Gravity | mechanic | strength: `980`, terminalVelocity: `800` |
| Jump | mechanic | jumpForce: `500`, gravity: `980`, groundY: `0.8`, triggerEvent: `'input:touch:tap'` |
| Projectile | mechanic | speed: `500`, damage: `15`, lifetime: `2000`, fireRate: `300`, fireEvent: `'input:touch:doubleTap'`, layer: `'projectiles'`, maxProjectiles: `30` |
| Aim | mechanic | mode: `'auto'`, autoTargetLayer: `'enemies'`, autoRange: `400` |
| EnemyAI | mechanic | behavior: `'patrol'`, speed: `80`, detectionRange: `200`, attackRange: `50`, attackCooldown: `1500`, attackDamage: `10`, hp: `50`, fleeHpThreshold: `0.2` |
| WaveSpawner | mechanic | enemiesPerWave: `3`, waveCooldown: `3000`, spawnDelay: `500`, scalingFactor: `1.2`, maxWaves: `10`, spawnAreaX: `100`, spawnAreaWidth: `880`, spawnY: `100` |
| Health | mechanic | maxHp: `100`, damageEvent: `'collision:damage'` |
| LevelUp | mechanic | xpPerLevel: `50`, scalingCurve: `'quadratic'`, maxLevel: `20`, xpSource: `'enemy:death'`, xpAmount: `15`, statGrowth: `{ hp: 10, attack: 2, defense: 1 }` |
| EnemyDrop | mechanic | lootTable: `[{ item: 'potion', weight: 3, type: 'health' }, { item: 'coin', weight: 5, type: 'collectible' }]`, dropChance: `0.6`, xpAmount: `15` |
| StatusEffect | mechanic | maxEffects: `5` |
| Collision | mechanic | rules: `[{ a: 'projectiles', b: 'enemies', event: 'hit', destroy: ['a'] }, { a: 'player', b: 'enemies', event: 'damage' }]` |
| Scorer | mechanic | perHit: `10` |
| Lives | mechanic | count: `3` |
| IFrames | mechanic | duration: `1000` |
| Knockback | mechanic | force: `200`, duration: `150` |
| Shield | mechanic | maxCharges: `2`, rechargeCooldown: `8000`, damageEvent: `'collision:damage'` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| SkillTree | 升级时获得技能点，解锁主动/被动技能（如弹幕扩散、生命偷取），增加构建多样性 |
| EquipmentSlot | 拾取装备替换武器/护甲，提供即时可感知的属性变化和装备选择策略 |
| DialogueSystem | 波次间插入剧情对话或任务提示，增强叙事沉浸感 |
| ComboSystem | 连续击杀计入连击倍率，奖励高效输出的玩家 |
| ParticleVFX | 击中敌人播放火花特效，敌人死亡播放爆炸特效，升级时播放金色光环 |
| SoundFX | 射击音、击中音、敌人死亡音、升级音、波次完成音 |

## 模块连线图

```
TouchInput
    ↓ input:touch:tap (跳跃)
    ↓ input:touch:doubleTap (射击)
    ↓ input:touch:hold (移动)
    ↓
PlayerMovement ← 左右移动
Jump ← 跳跃触发
Aim (auto) → 自动锁定最近敌人
    ↓
Projectile → 生成弹丸 → 注册到 Collision (projectiles 层)
    ↓
WaveSpawner → 按波次生成 EnemyAI → 注册到 Collision (enemies 层)
    ↓
Collision 检测 (projectiles vs enemies)
    ↓ collision:hit (弹丸命中敌人)
    ↓
Scorer ← +10 分
Health (enemy) ← -15 伤害
    ↓ enemy:death (敌人血量归零)
    ↓
EnemyDrop → 掉落战利品 (药水/金币)
LevelUp ← +15 XP
    ↓ levelup:levelup (经验值满)
    ↓
StatGrowth → hp +10, attack +2, defense +1
    ↓
Collision 检测 (player vs enemies)
    ↓ collision:damage (敌人接触玩家)
    ↓
Shield → 消耗护盾充能抵挡伤害
Health (player) ← 受到伤害
IFrames → 触发无敌帧 (1000ms)
Knockback → 击退玩家 (force: 200)
Lives ← 生命值归零时 -1 命
    ↓ lives:zero
GameFlow → finished → ResultScreen (分数 + 等级 + 波次)
```

## 素材需求
- 玩家角色精灵（站立、移动、跳跃、射击姿态）
- 敌人精灵（2~4 种，如近战怪、远程怪、精英怪）
- 弹丸精灵（玩家子弹、敌人子弹各 1 种）
- 掉落物精灵（药水、金币、装备）
- 平台/地形精灵（地面、平台）
- 背景图（1 张，如地下城、森林、废墟）
- UI 图标（生命值条、护盾图标、经验值条、等级数字）
- 音效：射击音、击中音、敌人死亡音、拾取音、升级音、波次开始音
- 背景音乐（战斗 BGM）

## 示例配置

```json
{
  "gameType": "action-rpg",
  "modules": [
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 0, "onFinish": "show_result" }
    },
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": {}
    },
    {
      "id": "playerMovement1",
      "type": "PlayerMovement",
      "params": { "speed": 200, "acceleration": 800, "deceleration": 600 }
    },
    {
      "id": "gravity1",
      "type": "Gravity",
      "params": { "strength": 980, "terminalVelocity": 800 }
    },
    {
      "id": "jump1",
      "type": "Jump",
      "params": { "jumpForce": 500, "gravity": 980, "groundY": 0.8, "triggerEvent": "input:touch:tap" }
    },
    {
      "id": "health1",
      "type": "Health",
      "params": { "maxHp": 100, "damageEvent": "collision:damage" }
    },
    {
      "id": "projectile1",
      "type": "Projectile",
      "params": { "speed": 500, "damage": 15, "lifetime": 2000, "fireRate": 300, "fireEvent": "input:touch:doubleTap", "layer": "projectiles", "maxProjectiles": 30 }
    },
    {
      "id": "aim1",
      "type": "Aim",
      "params": { "mode": "auto", "autoTargetLayer": "enemies", "autoRange": 400 }
    },
    {
      "id": "enemyAI1",
      "type": "EnemyAI",
      "params": { "behavior": "patrol", "speed": 80, "detectionRange": 200, "attackRange": 50, "attackCooldown": 1500, "attackDamage": 10, "hp": 50, "fleeHpThreshold": 0.2, "waypoints": [] }
    },
    {
      "id": "waveSpawner1",
      "type": "WaveSpawner",
      "params": { "enemiesPerWave": 3, "waveCooldown": 3000, "spawnDelay": 500, "scalingFactor": 1.2, "maxWaves": 10, "spawnAreaX": 100, "spawnAreaWidth": 880, "spawnY": 100 }
    },
    {
      "id": "enemyDrop1",
      "type": "EnemyDrop",
      "params": {
        "lootTable": [
          { "item": "potion", "weight": 3, "minCount": 1, "maxCount": 1, "type": "health" },
          { "item": "coin", "weight": 5, "minCount": 1, "maxCount": 3, "type": "collectible" }
        ],
        "dropChance": 0.6,
        "xpAmount": 15
      }
    },
    {
      "id": "levelUp1",
      "type": "LevelUp",
      "params": { "xpPerLevel": 50, "scalingCurve": "quadratic", "maxLevel": 20, "xpSource": "enemy:death", "xpAmount": 15, "statGrowth": { "hp": 10, "attack": 2, "defense": 1 } }
    },
    {
      "id": "statusEffect1",
      "type": "StatusEffect",
      "params": { "maxEffects": 5 }
    },
    {
      "id": "shield1",
      "type": "Shield",
      "params": { "maxCharges": 2, "rechargeCooldown": 8000, "damageEvent": "collision:damage" }
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
      "params": { "perHit": 10 }
    },
    {
      "id": "lives1",
      "type": "Lives",
      "params": { "count": 3 }
    },
    {
      "id": "iframes1",
      "type": "IFrames",
      "params": { "duration": 1000 }
    },
    {
      "id": "knockback1",
      "type": "Knockback",
      "params": { "force": 200, "duration": 150 }
    },
    {
      "id": "uiOverlay1",
      "type": "UIOverlay",
      "params": { "elements": ["score", "lives", "level"] }
    },
    {
      "id": "resultScreen1",
      "type": "ResultScreen",
      "params": { "show": ["score", "level", "waves_cleared"], "rating": { "3star": 500, "2star": 250, "1star": 100 } }
    },
    {
      "id": "particleVFX1",
      "type": "ParticleVFX",
      "params": {
        "events": {
          "collision:hit": { "effect": "sparkle", "at": "target", "duration": 400, "color": "#ffaa00" },
          "enemy:death": { "effect": "burst", "at": "target", "duration": 500, "color": "#ff0000" },
          "levelup:levelup": { "effect": "burst", "at": "player", "duration": 800, "color": "#00ff88" }
        }
      }
    },
    {
      "id": "soundFX1",
      "type": "SoundFX",
      "params": {
        "events": {
          "collision:hit": "pop",
          "enemy:death": "boom",
          "levelup:levelup": "cheer",
          "wave:complete": "ding"
        }
      }
    }
  ]
}
```
