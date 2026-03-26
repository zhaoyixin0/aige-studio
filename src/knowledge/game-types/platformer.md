# 平台跳跃类 (Platformer) — Game Type Skill

## 游戏定义
马里奥式横版卷轴平台跳跃游戏。玩家在多层平台间移动和跳跃，收集散落在各处的物品来获得分数，同时躲避地面和空中的危险障碍物。核心循环为：移动 → 跳跃 → 着陆平台 → 收集物品 → 躲避障碍 → 到达检查点。画布尺寸为竖屏 1080x1920，适配手机端操作。

## 核心体验
- 精准的跳跃手感：重力、跳跃力度、土狼时间(CoyoteTime)协同提供流畅的空中操控感
- 探索与收集：多层平台布局鼓励玩家探索不同路径来收集更多物品
- 风险与奖励的平衡：高价值收集品通常放置在靠近障碍物的危险位置
- 受伤容错：无敌帧(IFrames) + 击退(Knockback)给予玩家短暂的恢复窗口，避免连续受伤

## 必需模块

| 模块 | 类型 | 推荐参数 |
|------|------|---------|
| GameFlow | feedback | countdown: `3`, onFinish: `'show_result'` |
| PlayerMovement | mechanic | speed: `300`, acceleration: `1000`, deceleration: `800` |
| Jump | mechanic | jumpForce: `600`, gravity: `980`, groundY: `0.78`, triggerEvent: `'input:touch:tap'` |
| Gravity | mechanic | strength: `980`, terminalVelocity: `800`, applyTo: `'player'` |
| CoyoteTime | mechanic | coyoteFrames: `6`, bufferFrames: `6`, jumpEvent: `'input:touch:tap'` |
| StaticPlatform | mechanic | platforms: 5 个平台 (地面 + 4 层), layer: `'platforms'` |
| Collectible | mechanic | items: 4 个收集品 (分布在各层平台上方), layer: `'collectibles'` |
| Hazard | mechanic | hazards: 地面尖刺等, damage: `1`, layer: `'hazards'` |
| Collision | mechanic | rules: 玩家-收集品(hit, 销毁收集品), 玩家-障碍物(damage) |
| Scorer | mechanic | perHit: `10` |
| Timer | mechanic | duration: `60`, mode: `'countdown'` |
| Lives | mechanic | count: `3` |
| Checkpoint | mechanic | checkpoints: 中间位置存档点 |
| IFrames | mechanic | duration: `1000` (受伤后 1 秒无敌) |
| Knockback | mechanic | force: `300`, duration: `200` |
| CameraFollow | mechanic | mode: `'center'`, smoothing: `0.1` |

## 推荐增强模块

| 模块 | 原因 |
|------|------|
| MovingPlatform | 增加移动平台，提升关卡的动态感和难度 |
| CrumblingPlatform | 踩上后碎裂的平台，制造紧迫感和路径规划挑战 |
| OneWayPlatform | 可从下方穿越的单向平台，丰富垂直移动策略 |
| Dash | 空中/地面冲刺，拓展移动能力和操作上限 |
| Inventory | 收集品分类管理（钥匙、宝石等），增加探索目标 |
| PowerUp | 临时能力增强（二段跳、护盾、加速等），奖励探索行为 |
| ParticleVFX | 收集时播放 sparkle 特效，受伤时播放 burst 特效 |
| SoundFX | 收集音(ding)、跳跃音(pop)、受伤音(hurt) |

## 模块连线图

```
TouchInput
    ↓ input:touch:swipe:left / input:touch:swipe:right
    ↓ (左右移动)
PlayerMovement ──→ 更新玩家水平位置
    ↓
TouchInput ──→ input:touch:tap (跳跃)
    ↓
CoyoteTime ──→ 缓冲跳跃输入 ──→ Jump ──→ 施加跳跃力
    ↓                                        ↓
Gravity ──→ 持续施加重力 ──→ 更新玩家垂直位置
    ↓
StaticPlatform ──→ 表面碰撞检测 ──→ 玩家着陆
    ↓
Collision ──→ 玩家 vs collectibles ──→ collision:hit
    ↓                                     ↓
    ↓                              Scorer ← perHit +10
    ↓                              Collectible 销毁(destroy b)
    ↓                              ParticleVFX ← sparkle
    ↓                              SoundFX ← ding
    ↓
Collision ──→ 玩家 vs hazards ──→ collision:damage
    ↓                                  ↓
    ↓                           Lives -1
    ↓                           IFrames ← 1000ms 无敌
    ↓                           Knockback ← 击退 300 力度
    ↓                           ParticleVFX ← burst
    ↓                           SoundFX ← hurt
    ↓
CameraFollow ──→ 跟随玩家位置平滑移动视角
    ↓
Checkpoint ──→ 玩家到达检查点 → 更新复活位置
    ↓
Timer ──→ timer:tick ──→ UIOverlay
    ↓ timer:end / lives:zero
GameFlow ──→ gameflow:state(finished) ──→ ResultScreen
```

## 素材需求
- 玩家角色精灵（1 张，如小人、猫、骑士）
- 平台精灵（1~3 种，地面/普通平台/特殊平台）
- 收集品精灵（2~4 种，如金币、宝石、星星）
- 障碍物精灵（1~3 种，如尖刺、火焰、锯齿）
- 检查点旗帜精灵（1 张）
- 背景图（1 张，竖屏 1080x1920）
- 音效：跳跃音、收集音、受伤音、检查点音、倒计时音、结算音
- 背景音乐（可选）

## 示例配置

```json
{
  "gameType": "platformer",
  "modules": [
    {
      "id": "gameFlow1",
      "type": "GameFlow",
      "params": { "countdown": 3, "onFinish": "show_result" }
    },
    {
      "id": "touchInput1",
      "type": "TouchInput",
      "params": {}
    },
    {
      "id": "playerMovement1",
      "type": "PlayerMovement",
      "params": {
        "speed": 300,
        "acceleration": 1000,
        "deceleration": 800,
        "moveLeftEvent": "input:touch:swipe:left",
        "moveRightEvent": "input:touch:swipe:right"
      }
    },
    {
      "id": "jump1",
      "type": "Jump",
      "params": {
        "jumpForce": 600,
        "gravity": 980,
        "groundY": 0.78,
        "triggerEvent": "input:touch:tap"
      }
    },
    {
      "id": "gravity1",
      "type": "Gravity",
      "params": { "strength": 980, "terminalVelocity": 800, "applyTo": "player" }
    },
    {
      "id": "coyoteTime1",
      "type": "CoyoteTime",
      "params": { "coyoteFrames": 6, "bufferFrames": 6, "jumpEvent": "input:touch:tap" }
    },
    {
      "id": "staticPlatform1",
      "type": "StaticPlatform",
      "params": {
        "platforms": [
          { "x": 0, "y": 1500, "width": 1080, "height": 60, "material": "normal" },
          { "x": 100, "y": 1250, "width": 300, "height": 30, "material": "normal" },
          { "x": 400, "y": 1050, "width": 300, "height": 30, "material": "normal" },
          { "x": 700, "y": 850, "width": 280, "height": 30, "material": "normal" },
          { "x": 200, "y": 650, "width": 300, "height": 30, "material": "normal" }
        ],
        "layer": "platforms"
      }
    },
    {
      "id": "collectible1",
      "type": "Collectible",
      "params": {
        "items": [
          { "x": 250, "y": 1210, "value": 10, "type": "coin" },
          { "x": 550, "y": 1010, "value": 10, "type": "coin" },
          { "x": 840, "y": 810, "value": 20, "type": "coin" },
          { "x": 350, "y": 610, "value": 20, "type": "coin" }
        ],
        "layer": "collectibles"
      }
    },
    {
      "id": "hazard1",
      "type": "Hazard",
      "params": {
        "hazards": [{ "x": 500, "y": 1485, "width": 80, "height": 15, "pattern": "static" }],
        "damage": 1,
        "layer": "hazards"
      }
    },
    {
      "id": "collision1",
      "type": "Collision",
      "params": {
        "rules": [
          { "a": "player", "b": "collectibles", "event": "hit", "destroy": ["b"] },
          { "a": "player", "b": "hazards", "event": "damage" }
        ]
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
      "params": { "duration": 60, "mode": "countdown" }
    },
    {
      "id": "lives1",
      "type": "Lives",
      "params": { "count": 3 }
    },
    {
      "id": "checkpoint1",
      "type": "Checkpoint",
      "params": {
        "checkpoints": [{ "x": 750, "y": 800, "width": 30, "height": 50 }]
      }
    },
    {
      "id": "iframes1",
      "type": "IFrames",
      "params": { "duration": 1000 }
    },
    {
      "id": "knockback1",
      "type": "Knockback",
      "params": { "force": 300, "duration": 200 }
    },
    {
      "id": "cameraFollow1",
      "type": "CameraFollow",
      "params": { "mode": "center", "smoothing": 0.1 }
    },
    {
      "id": "particleVFX1",
      "type": "ParticleVFX",
      "params": {
        "events": {
          "collectible:pickup": { "effect": "sparkle", "at": "target", "duration": 400, "color": "#ffdd00" },
          "collision:damage": { "effect": "burst", "at": "player", "duration": 300, "color": "#ff0000" }
        }
      }
    },
    {
      "id": "soundFX1",
      "type": "SoundFX",
      "params": {
        "events": { "collectible:pickup": "ding", "jump:start": "pop", "collision:damage": "hurt" }
      }
    },
    {
      "id": "uiOverlay1",
      "type": "UIOverlay",
      "params": { "elements": ["score", "timer", "lives"] }
    },
    {
      "id": "resultScreen1",
      "type": "ResultScreen",
      "params": {
        "show": ["score", "time"],
        "rating": { "excellent": 200, "good": 100, "ok": 50 }
      }
    }
  ]
}
```
