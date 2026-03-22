# 模块冲突与互斥 — Module Conflicts

## 概述

某些模块组合会产生冲突、冗余或不预期的行为。Agent 在组装配置时应避免这些问题组合，或在使用时做特殊处理。

## 冲突类型

### 类型 A：互斥冲突（不应同时使用）

### 类型 B：冗余冲突（功能重复，选其一）

### 类型 C：需要特殊处理（可同时使用但需注意配置）

---

## 1. Timer(countdown) + Timer(stopwatch) — 类型 B

**问题**: 两个 Timer 模块功能冲突。countdown 模式有明确结束（timer:end），stopwatch 模式无限计时。同时使用两个 Timer 会导致两个 `timer:tick` 事件，UIOverlay 无法区分。

**建议**: 选择一种模式。如果需要倒计时+累计时间，用 countdown 模式，elapsed 字段同时记录了已过时间。

---

## 2. FaceInput + HandInput 同时作为主输入 — 类型 C

**问题**: 两个输入模块都会发出 move 事件和更新碰撞体位置。如果都映射到同一个 player 碰撞体，位置会被交替覆盖。

**建议**:
- 选择一个作为主输入控制 player 位置
- 如果确实需要两个输入，将它们映射到不同的碰撞层（如 `player-face` 和 `player-hand`）
- 或者用一个作为位置控制，另一个作为手势/表情触发

---

## 3. 多个 Spawner 实例 — 类型 C

**问题**: 多个 Spawner 都会生成物体，但碰撞层可能混淆。所有 Spawner 都监听 `collision:hit` 移除物体，可能误删其他 Spawner 的物体。

**建议**:
- 确保每个 Spawner 的物体注册到不同的 Collision 层
- 在 Collision rules 中为每个层设置独立规则
- 使用不同的碰撞事件名（如 `hit` vs `collect`）区分

---

## 4. Lives + Timer(countdown) 双结束条件 — 类型 C

**问题**: 不是真正的冲突，但需要注意：两个都能触发 GameFlow 结束。Lives 归零和 Timer 结束都会调用 `GameFlow.transition('finished')`。

**建议**: 这是有意为之的设计。确保 GameFlow 只在 `playing` 状态下响应这两个事件（代码已实现此逻辑）。无需特殊处理。

---

## 5. DifficultyRamp 目标不存在 — 类型 C

**问题**: DifficultyRamp 的 `target` 参数引用的模块 ID 不存在时，规则静默失败。

**建议**:
- 确保 target 值与目标模块的 `id`（不是 type）完全匹配
- 常见错误：target 设为 `'Spawner'`（类型名），应该设为 `'spawner1'`（实例 ID）

---

## 6. Scorer 监听 collision:hit + QuizEngine 也计分 — 类型 C

**问题**: 在 quiz/puzzle 类游戏中，如果 Scorer 监听 `collision:hit` 同时 QuizEngine 也通过 `quiz:score` 发出分数事件，可能导致双重计分。

**建议**:
- quiz/puzzle 类游戏中不使用 Collision 模块，Scorer 不会收到 `collision:hit`
- 或者 Scorer 只作为分数显示器，不监听碰撞事件
- QuizEngine 自己维护 totalScore，无需 Scorer 额外监听

---

## 7. Randomizer + Timer — 类型 B

**问题**: Randomizer 是一次性触发模块（点击→旋转→结果），Timer 的倒计时模式对转盘类游戏没有意义。

**建议**: random-wheel 类游戏通常不需要 Timer。如果需要限制抽取次数，用自定义计数逻辑。

---

## 8. AudioInput + FaceInput 争抢摄像头/麦克风 — 类型 C

**问题**: AudioInput 使用麦克风，FaceInput 使用摄像头。两者同时使用需要分别请求权限。在某些浏览器上可能出现权限提示过多的问题。

**建议**: 可以同时使用，但需确保权限提示友好。建议在游戏开始前一次性请求所有权限。

---

## 9. DeviceInput + FaceInput 在移动端 — 类型 C

**问题**: DeviceInput 依赖设备倾斜，当用户倾斜手机时摄像头画面角度也会变化，影响 FaceInput 的追踪质量。

**建议**: 避免同时使用 DeviceInput 和 FaceInput。选择其中一个作为主输入。

---

## 10. ParticleVFX events 映射高频事件 — 类型 C

**问题**: 如果 ParticleVFX 映射了高频事件（如 `timer:tick` 每秒触发、`input:face:move` 每帧触发），会导致大量粒子实例，影响性能。

**建议**: 只映射低频事件：碰撞、得分、连击等。避免映射每帧/每秒事件。

---

## 11. SoundFX events 映射高频事件 — 类型 C

**问题**: 与 ParticleVFX 类似，高频事件触发音效会导致音频重叠和性能问题。

**建议**: 只映射低频事件。`timer:tick` 可以用但需确保音效足够短。

---

## 12. BodyInput + TouchInput 在同一游戏中 — 类型 C

**问题**: BodyInput 用于全身追踪，此时用户通常站在摄像头前且不方便触屏。TouchInput 要求用户触摸屏幕。

**建议**: 如果使用 BodyInput 作为主输入，避免依赖 TouchInput。可以用手势或姿势匹配替代触屏。

## 冲突速查表

| 组合 | 冲突类型 | 严重度 | 建议 |
|------|---------|--------|------|
| Timer(countdown) + Timer(stopwatch) | B 冗余 | 高 | 选其一 |
| FaceInput + HandInput 同一碰撞层 | C 需处理 | 中 | 分层或选其一 |
| 多个 Spawner 同一碰撞层 | C 需处理 | 中 | 分层+分事件 |
| DifficultyRamp target 错误 | C 需处理 | 高 | 检查 ID 匹配 |
| Scorer + QuizEngine 双重计分 | C 需处理 | 中 | quiz 类不用 Collision |
| Randomizer + Timer | B 冗余 | 低 | 转盘不需 Timer |
| DeviceInput + FaceInput | C 需处理 | 中 | 避免同时使用 |
| VFX/SoundFX + 高频事件 | C 需处理 | 中 | 只映射低频事件 |
| BodyInput + TouchInput | C 需处理 | 低 | 避免同时依赖 |
