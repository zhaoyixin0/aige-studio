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

## 完整事件清单

| 事件名 | 发出者 | 监听者 |
|--------|--------|--------|
| `input:face:move` | FaceInput | Collision(wiring) |
| `input:face:mouthOpen` | FaceInput | Randomizer |
| `input:face:blink` | FaceInput | 自定义逻辑 |
| `input:face:smile` | FaceInput | 自定义逻辑 |
| `input:hand:move` | HandInput | Collision(wiring) |
| `input:hand:gesture` | HandInput | 自定义逻辑 |
| `input:body:move` | BodyInput | Collision(wiring) |
| `input:body:pose` | BodyInput | 自定义逻辑 |
| `input:touch:tap` | TouchInput | Randomizer, 自定义逻辑 |
| `input:touch:swipe` | TouchInput | 自定义逻辑 |
| `input:touch:longPress` | TouchInput | 自定义逻辑 |
| `input:touch:doubleTap` | TouchInput | 自定义逻辑 |
| `input:device:tilt` | DeviceInput | 自定义逻辑 |
| `input:device:shake` | DeviceInput | 自定义逻辑 |
| `input:audio:volume` | AudioInput | 自定义逻辑 |
| `input:audio:blow` | AudioInput | 自定义逻辑 |
| `input:audio:frequency` | AudioInput | 自定义逻辑 |
| `spawner:destroyed` | Spawner | Scorer |
| `collision:{event}` | Collision | Scorer, Lives, Spawner |
| `scorer:update` | Scorer | UIOverlay, DifficultyRamp |
| `scorer:combo:{N}` | Scorer | UIOverlay, ParticleVFX |
| `timer:tick` | Timer | UIOverlay |
| `timer:end` | Timer | GameFlow |
| `lives:change` | Lives | UIOverlay |
| `lives:zero` | Lives | GameFlow |
| `gameflow:state` | GameFlow | ResultScreen |
| `gameflow:pause` | GameFlow | Spawner, Collision, Timer |
| `gameflow:resume` | GameFlow | Spawner, Collision, Timer |
| `difficulty:update` | DifficultyRamp | 自定义逻辑 |
| `randomizer:spinning` | Randomizer | SoundFX |
| `randomizer:result` | Randomizer | SoundFX, ParticleVFX |
| `quiz:question` | QuizEngine | UIOverlay |
| `quiz:correct` | QuizEngine | SoundFX, ParticleVFX |
| `quiz:wrong` | QuizEngine | SoundFX |
| `quiz:score` | QuizEngine | Scorer |
| `quiz:finished` | QuizEngine | GameFlow |
