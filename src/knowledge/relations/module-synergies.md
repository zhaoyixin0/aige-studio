# 模块协同增强 — Module Synergies

## 概述

某些模块组合在一起时能产生 1+1>2 的效果。本文档列出常见的模块协同组合及其增强效果。

## 核心协同组合

### 1. Spawner + Collision + Scorer（接住/射击核心循环）

**效果**: 构成最基础的游戏循环——生成、碰撞、计分。

```
Spawner → 生成物体 → Collision 检测 → collision:hit → Scorer 加分
```

**适用**: catch、shooting、tap、runner、rhythm、world-ar

---

### 2. Scorer + DifficultyRamp（分数驱动难度）

**效果**: 分数越高难度越大，形成正向压力循环。

```
Scorer → scorer:update → DifficultyRamp (score模式) → 修改 Spawner 参数
```

**配置要点**: DifficultyRamp 的 mode 设为 `'score'`，rules 的 every 设为分数里程碑。

**适用**: catch、shooting、runner

---

### 3. Timer + DifficultyRamp（时间驱动难度）

**效果**: 游戏时间越长难度越大，保持后期紧张感。

```
Timer 运行 → DifficultyRamp (time模式) → 每 N 秒修改目标模块参数
```

**配置要点**: DifficultyRamp 的 mode 设为 `'time'`。

**适用**: dodge、catch、runner

---

### 4. Timer + Lives（双结束条件）

**效果**: 倒计时结束或生命归零均可触发游戏结束，增加策略深度。

```
Timer → timer:end → GameFlow → finished
Lives → lives:zero → GameFlow → finished
```

**配置要点**: 两个模块的结束事件都被 GameFlow 监听。

**适用**: dodge、runner

---

### 5. Scorer + ParticleVFX + SoundFX（即时反馈三件套）

**效果**: 得分时同时触发视觉+听觉反馈，大幅提升游戏体感。

```
collision:hit → Scorer(加分) + ParticleVFX(特效) + SoundFX(音效)
```

**配置要点**: ParticleVFX 和 SoundFX 的 events 都映射 `collision:hit`。

**适用**: 所有有碰撞计分的游戏类型

---

### 6. Scorer(combo) + UIOverlay（连击可视化）

**效果**: 连击数实时显示在 HUD 上，激励玩家保持连击。

```
Scorer → scorer:combo:{N} → UIOverlay.hudState.combo
```

**配置要点**: Scorer 的 combo.enabled 为 true，UIOverlay 自动监听连击事件。

**适用**: catch、shooting、tap、rhythm

---

### 7. GameFlow + Spawner + Collision + Timer（完整游戏骨架）

**效果**: 构成可玩的最小游戏闭环——流程控制、物体生成、碰撞检测、计时。

```
GameFlow(countdown → playing → finished)
    ↕ pause/resume
Spawner + Collision + Timer
```

**适用**: 几乎所有游戏类型的基础骨架

---

### 8. QuizEngine + TouchInput + UIOverlay（答题交互链）

**效果**: 完整的答题体验——展示题目、接收点击、显示反馈。

```
QuizEngine → quiz:question → UIOverlay 显示
TouchInput → input:touch:tap → answer(index)
QuizEngine → quiz:correct/wrong → 反馈
```

**适用**: quiz、puzzle、narrative

---

### 9. FaceInput + Randomizer（张嘴触发转盘）

**效果**: 张嘴这个有趣的动作触发转盘旋转，增加互动趣味性。

```
FaceInput → input:face:mouthOpen → Randomizer.spin()
```

**配置要点**: Randomizer 的 trigger 设为 `'mouthOpen'`。

**适用**: random-wheel

---

### 10. BodyInput + Collision（全身碰撞）

**效果**: 身体多个关键点都可以与虚拟物体碰撞，扩大互动范围。

```
BodyInput → landmarks → 注册多个碰撞体(左手、右手、头部等)
```

**适用**: world-ar

---

### 11. Lives + ParticleVFX + SoundFX（受伤反馈）

**效果**: 受伤时红色特效+受伤音效，强化负面反馈。

```
collision:damage → Lives(扣血) + ParticleVFX(红色burst) + SoundFX(受伤音)
```

**适用**: dodge、runner

---

### 12. DifficultyRamp + Spawner(frequency + speed)（双参数递增）

**效果**: 同时加快生成频率和物体速度，难度曲线更平滑。

```
DifficultyRamp → rules: [
  { field: "frequency", decrease: 0.1 },
  { field: "speed", increase: 20 }
]
```

**适用**: catch、dodge、runner、rhythm

---

## 平台跳跃协同组合

### 13. Gravity + Jump + CoyoteTime（平台三件套）

**效果**: 构成完整的平台跳跃物理体验。CoyoteTime 让跳跃操作更宽容，玩家离开平台边缘后仍有短暂跳跃窗口，大幅降低操作挫败感。

```
Gravity(持续下拉) + Jump(跳跃脉冲) + CoyoteTime(离地容错)
    ↓
流畅、宽容的跳跃手感
```

**配置要点**: CoyoteTime.window 通常设为 80-150ms。Jump.jumpForce 需与 Gravity.gravity 配合调参。

**适用**: platformer

---

### 14. Lives + IFrames + Knockback（伤害三件套）

**效果**: 完整的受伤反馈链——扣血+无敌闪烁+击退位移，让伤害可感知且不会连续致死。

```
collision:damage → Lives(扣血) → IFrames(无敌保护) + Knockback(位移反馈)
    ↓
安全窗口让玩家有机会恢复，击退把玩家推离危险区域
```

**配置要点**: IFrames.duration 建议 1-2 秒。Knockback.force 不宜过大以免推入另一个 Hazard。

**适用**: platformer、runner、dodge

---

### 15. Collectible + Inventory + Checkpoint（收集三件套）

**效果**: 收集物品存入背包+存档点保护进度，形成探索激励循环。死亡后从存档点重生，已收集物品保留。

```
Collectible(物品散布) → Inventory(背包管理) + Checkpoint(进度存档)
    ↓
玩家愿意冒险探索，因为 Checkpoint 保护进度
```

**配置要点**: Checkpoint 间距要合理，太远容易劝退，太近失去紧张感。

**适用**: platformer

---

### 16. PlayerMovement + Dash + WallDetect（移动三件套）

**效果**: 丰富的移动选项——地面走/跑+冲刺+蹬墙跳/滑墙，使关卡设计空间大幅扩展。

```
PlayerMovement(基础移动) + Dash(高速闪避) + WallDetect(墙壁交互)
    ↓
可设计需要 Dash 飞跃大坑 + 蹬墙跳到达高台的复杂关卡
```

**配置要点**: Dash.cooldown 和 Dash.duration 需要精心调参。WallDetect 开启 wallJump 需配合 Jump 模块。

**适用**: platformer

---

### 17. StaticPlatform + MovingPlatform + CrumblingPlatform（混合平台挑战）

**效果**: 三种平台类型混合使用，创造节奏变化——安全站立+移动跟随+限时踏脚，关卡层次更丰富。

```
StaticPlatform(安全休息点) → MovingPlatform(考验时机) → CrumblingPlatform(紧迫感)
    ↓
玩家在不同平台间切换，节奏张弛有度
```

**配置要点**: CrumblingPlatform.crumbleDelay 和 respawnTime 控制紧张度。MovingPlatform 的路径 waypoints 设计要与关卡布局配合。

**适用**: platformer

---

### 18. Jump + Gravity + 非平台游戏（给非平台游戏加跳跃元素）

**效果**: 在 dodge、catch 等游戏中加入跳跃元素，让玩家可以跳起躲避或够到高处物体，增加维度。

```
dodge + Jump + Gravity → 玩家可以跳起躲避低空障碍物
catch + Jump + Gravity → 跳起抓住更高处的物品得额外分
```

**配置要点**: 非平台游戏使用 Jump 时需设置 groundY 为固定地面线。Gravity 的强度比平台游戏可以弱一些。

**适用**: dodge、catch（实验性）

---

### 19. Runner + DifficultyRamp + Spawner（跑酷核心）

**效果**: 自动奔跑+难度递增+障碍/收集物生成，构成完整的跑酷循环。跑得越远越难，形成天然高分挑战。

```
Runner(自动推进) → Spawner(生成障碍/物品) → DifficultyRamp(加速+加密)
    ↓
距离即分数，速度持续加快，紧张感递增
```

**配置要点**: Runner.initialSpeed 和 DifficultyRamp.rules 的 increase 要配合，避免后期速度过快无法反应。

**适用**: runner

---

### 20. BeatMap + Spawner + Collision（节奏核心）

**效果**: 节拍数据驱动物体生成+碰撞判定=节奏游戏核心循环。音乐节拍与操作同步，命中时机影响得分。

```
BeatMap(节拍数据) → Spawner(按拍生成) → Collision(命中判定)
    ↓ beatmap:hit { timing }
    ↓ 'perfect' 100分, 'great' 80分, 'good' 50分
```

**配置要点**: BeatMap 的 notes 数据需与音乐节拍匹配。判定窗口（perfect/great/good）宽度影响难度。

**适用**: rhythm

---

### 21. MatchEngine + Timer + Scorer（记忆配对核心）

**效果**: 限时翻牌配对+计分，经典记忆游戏循环。时间压力激励快速记忆。

```
MatchEngine(配对逻辑) + Timer(限时) + Scorer(翻对加分)
    ↓
match:pair → Scorer 加分
timer:end / match:complete → GameFlow 结束
```

**配置要点**: Timer 时间 vs 卡片数量需平衡。配对成功可加时作为奖励。

**适用**: puzzle

---

### 22. ExpressionDetector + Scorer + ComboSystem（表情连击）

**效果**: 识别表情+连续匹配得分+连击倍率，独特的面部表情游戏体验。

```
ExpressionDetector(识别表情) → Scorer(匹配得分) → ComboSystem(连击倍率)
    ↓
连续做对表情 → 连击倍率飙升 → 高分
```

**配置要点**: ComboSystem.decayTime 控制表情间隔容错。注意不要开启 Scorer 的内置 combo 以避免冗余。

**适用**: expression

---

### 23. PowerUp + Lives + Timer（增益系统）

**效果**: 增益道具为有限的生命和时间提供缓冲——回血、加时、护盾，让游戏体验更有弹性。

```
PowerUp('heal') → Lives 回复
PowerUp('timeExtend') → Timer 加时
PowerUp('shield') → IFrames 延长无敌
```

**配置要点**: PowerUp 的 duration 和出现频率需与游戏难度曲线配合。不宜过多，否则失去紧张感。

**适用**: platformer、runner、dodge

---

## 射击/RPG 协同组合

### 24. Projectile + Aim + Collision（射击核心）

**效果**: 构成射击类游戏的核心循环——弹丸发射、瞄准目标、碰撞检测。Aim 模块自动锁定最近敌人，Projectile 按方向发射弹丸，Collision 检测命中。

```
Aim(auto) → 锁定最近 enemies 层目标 → aim:update { dx, dy }
    ↓
Projectile → 按方向发射弹丸 → projectile:fire → Collision(projectiles层)
    ↓
Collision 检测 projectiles vs enemies
    ↓ collision:hit → Scorer 加分 + 弹丸销毁
```

**配置要点**: Aim.autoRange 控制自动瞄准距离。Projectile.speed 和 fireRate 决定输出节奏。Collision 规则中 destroy:['a'] 销毁弹丸（非穿透），piercing=true 则弹丸穿透。

**适用**: shooting、action-rpg

---

### 25. EnemyAI + WaveSpawner + Collision（敌人系统）

**效果**: 构成波次制敌人生成系统——WaveSpawner 按波次生成敌人，EnemyAI 控制行为，Collision 处理碰撞。

```
WaveSpawner → wave:spawn → EnemyAI(patrol/chase/flee)
    ↓
EnemyAI 追击玩家 → Collision(player vs enemies) → collision:damage
EnemyAI 被弹丸击中 → Collision(projectiles vs enemies) → collision:hit
    ↓ enemy:death → wave enemiesRemaining--
    ↓ 全部击杀 → wave:complete → 冷却 → 下一波
```

**配置要点**: WaveSpawner.scalingFactor 控制每波敌人数量递增。EnemyAI.behavior 决定敌人策略。

**适用**: shooting、action-rpg

---

### 26. LevelUp + EnemyDrop + Health（RPG 成长核心）

**效果**: 击杀敌人获得经验和战利品，升级提升属性，形成 RPG 核心成长循环。

```
enemy:death → LevelUp(+XP) → 升级 → 属性成长(hp, attack, defense)
           → EnemyDrop → 掉落物(药水/金币/装备)
           → 拾取药水 → Health 回复
```

**配置要点**: LevelUp.xpPerLevel 和 scalingCurve 控制升级节奏。EnemyDrop.dropChance 和 lootTable 控制掉落丰富度。两者配合决定成长体感。

**适用**: action-rpg

---

### 27. Health + Shield + IFrames + Knockback（防御四件套）

**效果**: 完整的防御系统——护盾先吸收伤害，穿透后扣血，触发无敌帧+击退，提供安全恢复窗口。

```
collision:damage → Shield(消耗充能) → Health(扣血) → IFrames(无敌) + Knockback(击退)
    ↓
玩家获得安全窗口，不会被连续击杀
```

**配置要点**: Shield.maxCharges 和 rechargeCooldown 控制护盾循环。IFrames.duration 控制安全窗口。Knockback.force 推离危险但不宜过大。

**适用**: shooting、action-rpg、platformer

---

### 28. WaveSpawner + DifficultyRamp（波次难度递增）

**效果**: 波次推进的同时自动增加难度——更多敌人、更快速度、更强攻击。

```
WaveSpawner → wave:complete → DifficultyRamp
    ↓ 调整 WaveSpawner 参数: enemiesPerWave +2, scalingFactor +0.1
    ↓ 调整 EnemyAI 参数: speed +10, attackDamage +5
```

**配置要点**: DifficultyRamp.mode 设为 'wave' 或 'time'。rules 中可同时调多个模块的多个参数。

**适用**: shooting、action-rpg

---

### 29. SkillTree + LevelUp + StatusEffect（深度成长）

**效果**: 升级获得技能点→解锁主动/被动技能→技能可施加状态效果，形成深度构建多样性。

```
LevelUp → levelup:levelup → SkillTree(+技能点)
    ↓ 解锁技能: 弹幕扩散、生命偷取、元素弹药
    ↓ 元素弹药 → Projectile 附加 StatusEffect(burn/poison)
    ↓ StatusEffect → 持续伤害/减速/冻结
```

**配置要点**: SkillTree.pointsPerLevel 控制技能解锁速度。StatusEffect.maxEffects 限制同时生效的效果数。

**适用**: action-rpg

---

### 30. EquipmentSlot + EnemyDrop（装备循环）

**效果**: 敌人掉落装备→玩家拾取装备→属性提升→更强战斗力→挑战更难敌人。经典 RPG 装备循环。

```
EnemyDrop → drop:spawn { type: 'equipment' }
    ↓ 玩家拾取 → EquipmentSlot.equip()
    ↓ equipment:equip { slot, item, stats }
    ↓ 属性加成: +damage, +defense, +speed
```

**配置要点**: EquipmentSlot.slots 定义可装备槽位。lootTable 中 equipment 类型的 weight 不宜过高，保持装备稀缺感。

**适用**: action-rpg

---

## 协同强度评级

| 组合 | 强度 | 说明 |
|------|------|------|
| Spawner + Collision + Scorer | ★★★★★ | 核心游戏循环，大多数游戏的基础 |
| GameFlow + Timer | ★★★★★ | 游戏生命周期必备 |
| Gravity + Jump + CoyoteTime | ★★★★★ | 平台跳跃核心，手感决定性组合 |
| Lives + IFrames + Knockback | ★★★★★ | 伤害系统基石，平台类/动作类必备 |
| Runner + DifficultyRamp + Spawner | ★★★★★ | 跑酷类核心循环 |
| BeatMap + Spawner + Collision | ★★★★★ | 节奏类核心循环 |
| Scorer + ParticleVFX + SoundFX | ★★★★☆ | 反馈三件套，体验倍增 |
| DifficultyRamp + Spawner | ★★★★☆ | 难度曲线核心 |
| PlayerMovement + Dash + WallDetect | ★★★★☆ | 高级移动系统，关卡设计空间大 |
| StaticPlatform + MovingPlatform + CrumblingPlatform | ★★★★☆ | 混合平台挑战，节奏丰富 |
| Collectible + Inventory + Checkpoint | ★★★★☆ | 收集+存档，探索激励循环 |
| MatchEngine + Timer + Scorer | ★★★★☆ | 配对类核心循环 |
| ExpressionDetector + Scorer + ComboSystem | ★★★★☆ | 表情游戏特色组合 |
| QuizEngine + UIOverlay | ★★★★☆ | 答题类必备 |
| Projectile + Aim + Collision | ★★★★★ | 射击核心循环 |
| Projectile + BulletPattern | ★★★★☆ | 弹幕模式扩展（扇形/螺旋/连射） |
| EnemyAI + WaveSpawner + Collision | ★★★★★ | 敌人系统核心 |
| LevelUp + EnemyDrop + Health | ★★★★★ | RPG 成长核心循环 |
| Health + Shield + IFrames + Knockback | ★★★★☆ | 防御四件套 |
| WaveSpawner + DifficultyRamp | ★★★★☆ | 波次难度递增 |
| SkillTree + LevelUp + StatusEffect | ★★★★☆ | 深度成长系统 |
| EquipmentSlot + EnemyDrop | ★★★☆☆ | 装备循环 |
| PowerUp + Lives + Timer | ★★★☆☆ | 增益系统，增加弹性 |
| Timer + Lives | ★★★☆☆ | 双条件适合硬核玩法 |
| Jump + Gravity + 非平台游戏 | ★★★☆☆ | 实验性，增加游戏维度 |
| FaceInput + Randomizer | ★★★☆☆ | 趣味互动增强 |
