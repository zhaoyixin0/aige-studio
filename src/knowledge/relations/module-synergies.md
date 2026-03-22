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

## 协同强度评级

| 组合 | 强度 | 说明 |
|------|------|------|
| Spawner + Collision + Scorer | ★★★★★ | 核心游戏循环，大多数游戏的基础 |
| GameFlow + Timer | ★★★★★ | 游戏生命周期必备 |
| Scorer + ParticleVFX + SoundFX | ★★★★☆ | 反馈三件套，体验倍增 |
| DifficultyRamp + Spawner | ★★★★☆ | 难度曲线核心 |
| Timer + Lives | ★★★☆☆ | 双条件适合硬核玩法 |
| QuizEngine + UIOverlay | ★★★★☆ | 答题类必备 |
| FaceInput + Randomizer | ★★★☆☆ | 趣味互动增强 |
