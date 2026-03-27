# 模块连线图 — EventBus 事件连线

## 概述

所有模块通过 EventBus 进行事件通信，不直接引用其他模块。本文档描述所有模块间的事件连线关系。

## 核心事件流

### 1. 输入 → 碰撞位置更新

```
FaceInput  ──→ input:face:move { x, y }  ──→ Collision.updateObject(playerId, { x, y })
HandInput  ──→ input:hand:move { x, y }  ──→ Collision.updateObject(playerId, { x, y })
BodyInput  ──→ input:body:move { landmarks } ──→ Collision.updateObject(多个关键点)
TouchInput ──→ input:touch:tap { x, y }  ──→ Collision.registerObject(临时碰撞体)
```

注意：输入到碰撞的连接由引擎/渲染层的 wiring 逻辑完成，不是模块间直接通信。

### 2. 生成 → 碰撞注册

```
Spawner.spawn() ──→ 生成 SpawnedObject ──→ Collision.registerObject(id, layer, { x, y, radius })
Spawner.update() ──→ 移动物体 ──→ Collision.updateObject(id, { x, y })
```

注意：Spawner 和 Collision 的连接同样由 wiring 逻辑完成。

### 3. 碰撞 → 计分/扣血

```
Collision ──→ collision:hit  ──→ Scorer.onHit() → scorer:update { score, delta, combo }
Collision ──→ collision:damage ──→ Lives.decrease() → lives:change { current, max }
```

### 4. 生成物体出界 → 扣分

```
Spawner ──→ spawner:destroyed { id } ──→ Scorer.onMiss() → scorer:update { score, delta, combo }
```

仅在 Scorer 的 `deductOnMiss` 为 true 时生效。

### 5. 碰撞 → 移除物体

```
Collision ──→ collision:hit { targetId } ──→ Spawner.removeObject(targetId)
```

Spawner 在 init 中监听 `collision:hit`，自动移除被击中的物体。

### 6. 计时结束 → 游戏结束

```
Timer ──→ timer:end ──→ GameFlow.transition('finished')
                            ↓
                       gameflow:state { state: 'finished', previous: 'playing' }
                            ↓
                       gameflow:pause (全局暂停信号)
```

### 7. 生命归零 → 游戏结束

```
Lives ──→ lives:zero ──→ GameFlow.transition('finished')
                            ↓
                       gameflow:state { state: 'finished' }
                            ↓
                       gameflow:pause
```

### 8. 游戏暂停/恢复 → 全局广播

```
GameFlow ──→ gameflow:pause  ──→ Spawner(暂停) + Collision(暂停) + Timer(暂停)
GameFlow ──→ gameflow:resume ──→ Spawner(恢复) + Collision(恢复) + Timer(恢复)
```

### 9. 计分 → HUD 更新

```
Scorer ──→ scorer:update { score, delta, combo } ──→ UIOverlay.hudState.score
Timer  ──→ timer:tick { remaining, elapsed }      ──→ UIOverlay.hudState.timer
Lives  ──→ lives:change { current, max }          ──→ UIOverlay.hudState.lives
Scorer ──→ scorer:combo:{N}                       ──→ UIOverlay.hudState.combo
```

### 10. 游戏结束 → 结算

```
GameFlow ──→ gameflow:state { state: 'finished' } ──→ ResultScreen.collectStats()
```

ResultScreen 通过 `engine.getModulesByType()` 获取 Scorer 和 Timer 的数据。

### 11. 难度递增 → 修改目标参数

```
DifficultyRamp.update()
    ↓ (time 模式：按时间间隔触发)
    ↓ (score 模式：监听 scorer:update 获取分数)
    ↓
engine.getModule(target).configure({ field: newValue })
    ↓
difficulty:update { field, value, target }
```

### 12. 随机抽取 → 触发与结果

```
TouchInput ──→ input:touch:tap    ──→ Randomizer.spin() (trigger='tap')
FaceInput  ──→ input:face:mouthOpen ──→ Randomizer.spin() (trigger='mouthOpen')
    ↓
Randomizer ──→ randomizer:spinning (开始旋转)
Randomizer ──→ randomizer:result { item, index } (结果确定)
```

### 13. 答题流程

```
QuizEngine.start()
    ↓ quiz:question { text, options, index, total }
    ↓
QuizEngine.answer(optionIndex)
    ↓ quiz:correct { questionIndex, score }  / quiz:wrong { questionIndex, correctIndex, selectedIndex }
    ↓ quiz:score { delta, total } (答对时)
    ↓ quiz:question (下一题) / quiz:finished { totalScore, totalQuestions }
```

### 14. 反馈模块 → 事件驱动

```
任意事件 ──→ ParticleVFX (按 events 映射创建粒子)
任意事件 ──→ SoundFX (按 events 映射加入播放队列)
```

---

## 平台跳跃事件流

### 15. 平台物理事件流：Gravity → Jump → CoyoteTime → PlayerMovement

```
Gravity.update()
    ↓ 每帧对 velocityY 施加 gravity 加速度
    ↓ gravity:update { velocityY, grounded }
    ↓
Jump 监听 input:touch:tap / input:key:space
    ↓ 检查 grounded 状态（直接或通过 coyote 窗口）
    ↓ jump:start { velocityY: -jumpForce }
    ↓
CoyoteTime 监听 gravity:update
    ↓ 离开平台时开启 coyote 窗口（通常 80-150ms）
    ↓ coyote:available { remaining } — 通知 Jump 仍可起跳
    ↓ coyote:expired — 窗口关闭，Jump 不再接受地面跳
    ↓
PlayerMovement 监听输入事件
    ↓ 每帧根据 input 更新 X 轴位移
    ↓ playermovement:update { x, y, velocityX, velocityY, grounded }
```

**交互关系**: Gravity 管理 Y 轴加速度，Jump 叠加跳跃脉冲，CoyoteTime 延长跳跃窗口，PlayerMovement 综合所有物理量更新最终位置。

### 16. 平台碰撞事件流：平台 + Collision + Gravity 落地检测

```
StaticPlatform.init()
    ↓ 注册平台碰撞体到 Collision(platform 层)
    ↓
MovingPlatform.update()
    ↓ 每帧更新平台位置 → Collision.updateObject(platformId, { x, y })
    ↓ movingplatform:move { id, x, y, dx, dy }
    ↓
Collision 检测 player 层 vs platform 层
    ↓ collision:platform { playerId, platformId, side, overlap }
    ↓
Gravity 监听 collision:platform (side=top)
    ↓ 设置 grounded = true, velocityY = 0
    ↓ gravity:land { platformId }
    ↓
OneWayPlatform — 仅当 player.velocityY > 0（下落）且 player.bottom <= platform.top 时触发碰撞
CrumblingPlatform — 落地后启动 crumbleDelay 计时
    ↓ crumbling:shake { platformId } (抖动预警)
    ↓ crumbling:collapse { platformId } (平台消失)
    ↓ crumbling:respawn { platformId } (respawnTime 后重现)
```

### 17. 伤害事件流：Hazard → Collision → Lives → IFrames → Knockback

```
Hazard 注册碰撞体到 Collision(hazard 层)
    ↓
Collision 检测 player 层 vs hazard 层
    ↓ collision:damage { playerId, hazardId, damageAmount }
    ↓
IFrames 检查无敌状态
    ├── 无敌中 → 过滤，不传递给 Lives
    └── 非无敌 →
        ↓
        Lives.decrease(damageAmount)
        ↓ lives:change { current, max }
        ↓ lives:zero (如果 current <= 0)
        ↓
        IFrames 激活无敌状态
        ↓ iframes:start { duration }
        ↓ 闪烁视觉效果（渲染层处理）
        ↓ iframes:end — 无敌结束
        ↓
        Knockback 同时触发
        ↓ knockback:start { direction, force }
        ↓ 施加反方向位移脉冲
        ↓ knockback:end — 击退结束，恢复控制
```

### 18. 收集事件流：Collectible → Collision → Inventory + Scorer

```
Collectible 注册碰撞体到 Collision(collectible 层)
    ↓
Collision 检测 player 层 vs collectible 层
    ↓ collision:hit { playerId, targetId, collectibleType }
    ↓
Collectible 移除已收集物体
    ↓ collectible:collected { id, type, value }
    ↓
Inventory 监听 collectible:collected
    ↓ inventory:update { items, total }
    ↓
Scorer 监听 collision:hit (collectible 层)
    ↓ scorer:update { score, delta, combo }
```

### 19. 存档事件流：Checkpoint → Lives（重生点）

```
Checkpoint 注册碰撞体到 Collision(checkpoint 层)
    ↓
Collision 检测 player 层 vs checkpoint 层
    ↓ collision:hit { playerId, checkpointId }
    ↓
Checkpoint 激活
    ↓ checkpoint:activate { id, x, y }
    ↓ 记录当前重生坐标
    ↓
Lives 监听 lives:zero (或 collision:damage 后 current > 0)
    ↓ 读取 Checkpoint 最近激活点
    ↓ checkpoint:respawn { x, y }
    ↓ PlayerMovement 将角色传送到重生点
```

### 20. Camera 事件流：CameraFollow → 跟随 PlayerMovement

```
PlayerMovement ──→ playermovement:update { x, y }
    ↓
CameraFollow 监听 playermovement:update
    ↓ 计算相机偏移量（平滑跟随 / deadzone / 边界限制）
    ↓ camera:update { offsetX, offsetY, zoom }
    ↓
渲染层接收 camera:update → 移动 PixiJS 容器 / stage 位置
```

**配置要点**: CameraFollow 有 smoothing（平滑系数）、deadzone（死区范围）、bounds（边界限制）参数。

### 21. Dash 事件流：input → Dash → 位移 + IFrames 联动

```
input:touch:doubleTap / input:key:shift / input:hand:gesture:swipe
    ↓
Dash 检查冷却时间
    ├── 冷却中 → 忽略
    └── 可用 →
        ↓ dash:start { direction, speed, duration }
        ↓ 在 duration 期间：
        │   ├── PlayerMovement 速度被 Dash 覆盖（高速位移）
        │   ├── Gravity 冻结（不施加 Y 轴加速度）
        │   └── IFrames 激活（dash 期间无敌，可选配置）
        ↓ dash:end
        ↓ 恢复正常物理 + 开始冷却计时
```

---

## 扩展模块事件流

### 22. PowerUp 事件流：Collectible → PowerUp → activate/expire

```
Collectible ──→ collectible:collected { type: 'powerup', powerUpType }
    ↓
PowerUp 监听 collectible:collected (过滤 type=powerup)
    ↓ powerup:activate { type, duration, effect }
    ↓ 根据 type 修改目标模块参数：
    │   ├── 'speed' → PlayerMovement.configure({ speed: boosted })
    │   ├── 'jump' → Jump.configure({ jumpForce: boosted })
    │   ├── 'shield' → IFrames.configure({ duration: extended })
    │   └── 'magnet' → Collectible.configure({ attractRadius: large })
    ↓ duration 倒计时
    ↓ powerup:expire { type }
    ↓ 恢复目标模块原始参数
```

### 23. ComboSystem 事件流

```
collision:hit / collectible:collected / 任意计分事件
    ↓
ComboSystem 更新连击计数
    ↓ combo:update { count, multiplier, timeLeft }
    ↓ combo:milestone { count } (达到特定连击数)
    ↓
Scorer 监听 combo:update → 应用倍率到下一次加分
    ↓
combo:break (超时未命中)
    ↓ 连击重置为 0
```

**注意**: 如果 Scorer 自身的 `combo.enabled` 为 true，会与 ComboSystem 产生冗余（见冲突文档）。

### 24. Runner 事件流：Runner → Spawner → Collision → Scorer

```
Runner.update()
    ↓ 每帧推进世界滚动（自动向右/向前）
    ↓ runner:scroll { speed, distance }
    ↓
Spawner 根据 Runner 的滚动速度生成障碍物/收集物
    ↓ 物体随世界滚动向玩家移动
    ↓
Collision 检测碰撞
    ├── collision:hit (收集物) → Scorer 加分
    └── collision:damage (障碍物) → Lives 扣血
    ↓
DifficultyRamp 监听 runner:scroll 的 distance
    ↓ 随距离增加 Runner.speed
```

### 25. ExpressionDetector 事件流

```
FaceInput ──→ input:face:landmarks { landmarks }
    ↓
ExpressionDetector 分析面部特征
    ↓ expression:detected { type, confidence }
    │   type: 'smile' | 'surprise' | 'angry' | 'sad' | 'wink' | ...
    ↓
Scorer / ComboSystem / 自定义逻辑 监听 expression:detected
    ↓ 根据当前目标表情匹配给分
```

**适用**: expression 类游戏。与 ComboSystem 配合可做表情连击。

### 26. BeatMap 事件流

```
BeatMap.init()
    ↓ 加载节拍数据 { bpm, notes: [{ time, lane, type }] }
    ↓
BeatMap.update()
    ↓ 根据当前时间生成节拍物体
    ↓ beatmap:note { time, lane, type }
    ↓
Spawner 监听 beatmap:note → 在对应 lane 生成物体
    ↓
Collision 检测玩家命中
    ├── collision:hit + 时机判定
    │   ↓ beatmap:hit { timing: 'perfect'|'great'|'good'|'miss' }
    │   ↓ Scorer 根据 timing 加不同分数
    └── 未命中
        ↓ beatmap:miss { noteId }
```

### 27. GestureMatch 事件流

```
HandInput ──→ input:hand:gesture { type, confidence }
    ↓
GestureMatch 比较当前目标手势
    ↓ gesture:match { gesture, accuracy }  (匹配成功)
    ↓ gesture:fail { expected, actual }    (匹配失败)
    ↓
gesture:next { gesture, timeLimit } (下一个目标手势)
    ↓
Scorer 监听 gesture:match 加分
Timer 可选配合限时模式
```

### 28. MatchEngine 事件流

```
MatchEngine.init()
    ↓ 生成配对网格 { rows, cols, pairs }
    ↓ match:board { cards }
    ↓
input:touch:tap { x, y } → 翻开卡片
    ↓ match:flip { cardId, value }
    ↓
MatchEngine 检查配对
    ├── 配对成功
    │   ↓ match:pair { card1, card2, value }
    │   ↓ Scorer 加分
    └── 配对失败
        ↓ match:mismatch { card1, card2 }
        ↓ 翻回卡片
    ↓
match:complete { totalPairs, moves, time } (全部配对完成)
    ↓ GameFlow → finished
```

### 29. BranchStateMachine 事件流

```
BranchStateMachine.init()
    ↓ 加载叙事树 { nodes: [{ id, text, choices }] }
    ↓ narrative:node { id, text, choices }
    ↓
input:touch:tap → 选择分支
    ↓ narrative:choice { nodeId, choiceIndex }
    ↓
BranchStateMachine 转移到下一个节点
    ↓ narrative:node { id, text, choices }  (下一个节点)
    ↓ narrative:end { endingId }            (到达结局)
    ↓ GameFlow → finished
```

### 30. DressUpEngine 事件流

```
DressUpEngine.init()
    ↓ 加载角色和服饰列表 { character, categories, items }
    ↓ dressup:ready { character, categories }
    ↓
input:touch:tap → 选择服饰
    ↓ dressup:equip { category, itemId }
    ↓
DressUpEngine 更新角色外观
    ↓ dressup:update { character, equipped }
    ↓
dressup:screenshot → 导出截图
dressup:complete → 完成换装
```

### 31. PlaneDetection 事件流（AR）

```
摄像头 ──→ PlaneDetection 分析画面
    ↓ plane:detected { id, position, normal, size }
    ↓
Spawner 在检测到的平面上放置虚拟物体
    ↓ plane:anchor { objectId, planeId, position }
    ↓
Collision 检测手/触摸与锚定物体的碰撞
```

### 32. WallDetect 事件流

```
PlayerMovement ──→ playermovement:update { x, y }
    ↓
WallDetect 检查玩家与墙壁碰撞
    ↓ wall:contact { side: 'left'|'right', wallId }
    ↓
Jump 监听 wall:contact → 允许蹬墙跳（wall jump）
    ↓ jump:walljump { direction }
    ↓
PlayerMovement 添加墙跳反弹速度
```

---

## 完整事件清单

| 事件名 | 发出者 | 监听者 |
|--------|--------|--------|
| `input:face:move` | FaceInput | Collision(wiring) |
| `input:face:mouthOpen` | FaceInput | Randomizer |
| `input:face:blink` | FaceInput | 自定义逻辑 |
| `input:face:smile` | FaceInput | 自定义逻辑 |
| `input:face:landmarks` | FaceInput | ExpressionDetector |
| `input:hand:move` | HandInput | Collision(wiring) |
| `input:hand:gesture` | HandInput | GestureMatch, 自定义逻辑 |
| `input:body:move` | BodyInput | Collision(wiring) |
| `input:body:pose` | BodyInput | 自定义逻辑 |
| `input:touch:tap` | TouchInput | Randomizer, Jump, MatchEngine, BranchStateMachine, DressUpEngine, 自定义逻辑 |
| `input:touch:swipe` | TouchInput | 自定义逻辑 |
| `input:touch:longPress` | TouchInput | 自定义逻辑 |
| `input:touch:doubleTap` | TouchInput | Dash, 自定义逻辑 |
| `input:device:tilt` | DeviceInput | 自定义逻辑 |
| `input:device:shake` | DeviceInput | 自定义逻辑 |
| `input:audio:volume` | AudioInput | 自定义逻辑 |
| `input:audio:blow` | AudioInput | 自定义逻辑 |
| `input:audio:frequency` | AudioInput | 自定义逻辑 |
| `spawner:destroyed` | Spawner | Scorer |
| `collision:{event}` | Collision | Scorer, Lives, Spawner |
| `collision:platform` | Collision | Gravity, OneWayPlatform, CrumblingPlatform |
| `collision:damage` | Collision | IFrames, Lives, Knockback |
| `collision:hit` (collectible) | Collision | Collectible, Inventory, Scorer |
| `collision:hit` (checkpoint) | Collision | Checkpoint |
| `scorer:update` | Scorer | UIOverlay, DifficultyRamp |
| `scorer:combo:{N}` | Scorer | UIOverlay, ParticleVFX |
| `timer:tick` | Timer | UIOverlay |
| `timer:end` | Timer | GameFlow |
| `lives:change` | Lives | UIOverlay |
| `lives:zero` | Lives | GameFlow, Checkpoint(重生) |
| `gameflow:state` | GameFlow | ResultScreen |
| `gameflow:pause` | GameFlow | Spawner, Collision, Timer, Runner |
| `gameflow:resume` | GameFlow | Spawner, Collision, Timer, Runner |
| `difficulty:update` | DifficultyRamp | 自定义逻辑 |
| `randomizer:spinning` | Randomizer | SoundFX |
| `randomizer:result` | Randomizer | SoundFX, ParticleVFX |
| `quiz:question` | QuizEngine | UIOverlay |
| `quiz:correct` | QuizEngine | SoundFX, ParticleVFX |
| `quiz:wrong` | QuizEngine | SoundFX |
| `quiz:score` | QuizEngine | Scorer |
| `quiz:finished` | QuizEngine | GameFlow |
| `gravity:update` | Gravity | CoyoteTime, Jump |
| `gravity:land` | Gravity | PlayerMovement |
| `jump:start` | Jump | Gravity, PlayerMovement |
| `jump:walljump` | Jump | PlayerMovement |
| `coyote:available` | CoyoteTime | Jump |
| `coyote:expired` | CoyoteTime | Jump |
| `playermovement:update` | PlayerMovement | CameraFollow, WallDetect, Collision(wiring) |
| `dash:start` | Dash | PlayerMovement, Gravity, IFrames |
| `dash:end` | Dash | PlayerMovement, Gravity |
| `movingplatform:move` | MovingPlatform | Collision(wiring) |
| `crumbling:shake` | CrumblingPlatform | 渲染层(抖动效果) |
| `crumbling:collapse` | CrumblingPlatform | Collision(移除碰撞体) |
| `crumbling:respawn` | CrumblingPlatform | Collision(重新注册) |
| `collectible:collected` | Collectible | Inventory, PowerUp |
| `inventory:update` | Inventory | UIOverlay |
| `checkpoint:activate` | Checkpoint | 渲染层(激活动画) |
| `checkpoint:respawn` | Checkpoint | PlayerMovement |
| `camera:update` | CameraFollow | 渲染层(移动容器) |
| `iframes:start` | IFrames | 渲染层(闪烁效果) |
| `iframes:end` | IFrames | Collision(恢复检测) |
| `knockback:start` | Knockback | PlayerMovement |
| `knockback:end` | Knockback | PlayerMovement |
| `wall:contact` | WallDetect | Jump |
| `powerup:activate` | PowerUp | 目标模块(参数修改) |
| `powerup:expire` | PowerUp | 目标模块(参数恢复) |
| `combo:update` | ComboSystem | Scorer, UIOverlay |
| `combo:milestone` | ComboSystem | ParticleVFX, SoundFX |
| `combo:break` | ComboSystem | UIOverlay |
| `runner:scroll` | Runner | Spawner, DifficultyRamp |
| `expression:detected` | ExpressionDetector | Scorer, ComboSystem |
| `beatmap:note` | BeatMap | Spawner |
| `beatmap:hit` | BeatMap | Scorer |
| `beatmap:miss` | BeatMap | Scorer |
| `gesture:match` | GestureMatch | Scorer |
| `gesture:fail` | GestureMatch | SoundFX |
| `gesture:next` | GestureMatch | UIOverlay |
| `match:board` | MatchEngine | 渲染层 |
| `match:flip` | MatchEngine | 渲染层 |
| `match:pair` | MatchEngine | Scorer, ParticleVFX |
| `match:mismatch` | MatchEngine | SoundFX |
| `match:complete` | MatchEngine | GameFlow |
| `narrative:node` | BranchStateMachine | UIOverlay |
| `narrative:choice` | BranchStateMachine | 自身(状态转移) |
| `narrative:end` | BranchStateMachine | GameFlow |
| `dressup:ready` | DressUpEngine | 渲染层 |
| `dressup:equip` | DressUpEngine | 渲染层 |
| `dressup:update` | DressUpEngine | 渲染层 |
| `dressup:complete` | DressUpEngine | GameFlow |
| `plane:detected` | PlaneDetection | Spawner |
| `plane:anchor` | PlaneDetection | Collision |
| `projectile:fire` | Projectile | Collision(注册弹丸碰撞体), ParticleVFX, SoundFX |
| `projectile:destroyed` | Projectile | Collision(移除碰撞体) |
| `aim:update` | Aim | Projectile(更新射击方向) |
| `wave:start` | WaveSpawner | UIOverlay, SoundFX |
| `wave:spawn` | WaveSpawner | Collision(注册敌人碰撞体), EnemyAI(初始化) |
| `wave:complete` | WaveSpawner | UIOverlay, SoundFX, DifficultyRamp |
| `wave:allComplete` | WaveSpawner | GameFlow(全波次结束) |
| `enemy:death` | EnemyAI/Health | EnemyDrop, LevelUp, Scorer, Collision(移除), ParticleVFX, SoundFX |
| `enemy:attack` | EnemyAI | Health(玩家受伤), SoundFX |
| `health:change` | Health | UIOverlay |
| `health:zero` | Health | Lives(敌人→enemy:death, 玩家→lives:decrease) |
| `levelup:xp` | LevelUp | UIOverlay(经验条) |
| `levelup:levelup` | LevelUp | UIOverlay(升级提示), ParticleVFX(升级特效), SoundFX |
| `drop:spawn` | EnemyDrop | Collision(注册掉落物碰撞体), 渲染层 |
| `shield:absorbed` | Shield | Health(取消伤害事件) |
| `shield:damage:passthrough` | Shield | Health(护盾未吸收的伤害穿透) |
| `shield:block` | Shield | ParticleVFX(护盾格挡特效), SoundFX |
| `shield:break` | Shield | UIOverlay(护盾耗尽提示) |
| `shield:recharge` | Shield | UIOverlay(护盾恢复提示) |
| `status:apply` | StatusEffect | UIOverlay(状态图标), 渲染层(视觉效果) |
| `status:expire` | StatusEffect | UIOverlay(移除图标) |
| `status:tick` | StatusEffect | Health(持续伤害) |
| `skill:unlock` | SkillTree | UIOverlay(技能解锁提示), SoundFX |
| `skill:activate` | SkillTree | 目标模块(应用技能效果) |
| `equipment:equip` | EquipmentSlot | UIOverlay(装备更新), 属性计算 |
| `equipment:unequip` | EquipmentSlot | UIOverlay, 属性计算 |
| `dialogue:start` | DialogueSystem | GameFlow(暂停游戏), UIOverlay(显示对话框) |
| `dialogue:choice` | DialogueSystem | 自身(推进对话) |
| `dialogue:end` | DialogueSystem | GameFlow(恢复游戏) |

---

## 射击/战斗事件流

### 33. Projectile 事件流：射击 → 碰撞 → 销毁

```
input:touch:tap / fireEvent (可配置)
    ↓
Projectile.fire()
    ↓ 检查射速冷却 + 最大弹丸数
    ↓ projectile:fire { id, x, y, dx, dy, speed, damage }
    ↓
AutoWirer → Collision.registerObject(id, 'projectiles', { x, y, radius: collisionRadius })
    ↓
Projectile.update(dt)
    ↓ 每帧更新位置 → AutoWirer pre-update hook → Collision.updateObject(id, { x, y })
    ↓
Collision 检测 projectiles 层 vs enemies 层
    ↓ collision:hit { objectA, objectB, targetId }
    ↓
Collision.destroy('a') → 移除弹丸碰撞体
    ↓
projectile:destroyed { id } (超时销毁)
    ↓ AutoWirer → Collision.unregisterObject(id)
```

### 34. EnemyAI 事件流：生成 → 行为 → 死亡

```
WaveSpawner → wave:spawn { id, x, y, wave }
    ↓
AutoWirer → Collision.registerObject(id, 'enemies', { x, y, radius: enemyCollisionRadius })
    ↓
EnemyAI.update(dt)
    ↓ 根据 behavior 执行行为:
    │   patrol: 在路径点间巡逻
    │   chase: 检测到玩家后追击
    │   flee: 血量低于阈值时逃跑
    ↓
    ├── 接近玩家 → enemy:attack { damage }
    │   ↓ Collision (player vs enemies) → collision:damage
    │
    └── 被弹丸命中 → collision:hit
        ↓ Health 扣血
        ↓ hp <= 0 → enemy:death { id, x, y }
        ↓
        ├── EnemyDrop → 掉落战利品
        ├── LevelUp → +XP
        ├── Scorer → +分数
        └── Collision.unregisterObject(id)
```

### 35. WaveSpawner 事件流：波次循环

```
gameflow:resume (游戏开始)
    ↓
WaveSpawner.startNextWave()
    ↓ wave:start { wave, enemyCount }
    ↓
    ↓ 按 spawnDelay 间隔逐个生成敌人
    ↓ wave:spawn { id, x, y, wave } (每个敌人)
    ↓
    ↓ 监听 enemy:death → enemiesRemaining--
    ↓ 全部击杀 → WaveSpawner.completeWave()
    ↓ wave:complete { wave }
    ↓
    ├── maxWaves > 0 && currentWave >= maxWaves
    │   ↓ wave:allComplete { totalWaves }
    │   ↓ GameFlow → finished
    │
    └── 否则 → 进入冷却期 (waveCooldown ms)
        ↓ 冷却结束 → startNextWave()
        ↓ (enemyCount *= scalingFactor)
```

### 36. Health 事件流：伤害 → 死亡

```
collision:damage { objectA, objectB }
    ↓
Shield 检查 (如果存在)
    ├── 有充能 → shield:block, 消耗1充能, 不传递伤害
    └── 无充能 →
        ↓
        Health.takeDamage(amount)
        ↓ health:change { current, max }
        ↓
        ├── current > 0 → IFrames 激活无敌
        └── current <= 0 → health:zero
            ↓
            ├── 敌人 Health → enemy:death
            └── 玩家 Health → Lives.decrease()
```

### 37. LevelUp 事件流：经验 → 升级 → 属性成长

```
enemy:death (或配置的 xpSource 事件)
    ↓
LevelUp.addXP(xpAmount)
    ↓ levelup:xp { current, required, level }
    ↓
    ├── current < required → 继续累积
    └── current >= required →
        ↓ level++, current -= required
        ↓ levelup:levelup { level, stats }
        ↓
        statGrowth 应用:
            Health.maxHp += statGrowth.hp
            Projectile.damage += statGrowth.attack
            Shield.defense += statGrowth.defense
```

### 38. EnemyDrop 事件流：击杀 → 掉落 → 拾取

```
enemy:death { id, x, y }
    ↓
EnemyDrop.rollLoot()
    ↓ 按 dropChance 概率决定是否掉落
    ↓ 遍历 lootTable，按 weight 加权随机选择物品
    ↓
    ├── 未掉落 → 不触发事件
    └── 掉落 → drop:spawn { id, item, type, x, y, count }
        ↓
        Collision.registerObject(dropId, 'items', { x, y, radius })
        ↓
        玩家碰触掉落物 → collision:hit
        ↓
        ├── type: 'health' → Health 回复
        ├── type: 'collectible' → Scorer 加分
        └── type: 'equipment' → EquipmentSlot 装备
```
