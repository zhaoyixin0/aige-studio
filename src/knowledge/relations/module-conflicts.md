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

---

## 平台跳跃冲突规则

### 13. Scorer.combo.enabled + ComboSystem — 类型 B（CRITICAL）

**问题**: Scorer 内置了简易 combo 机制（combo.enabled + combo.decayTime），ComboSystem 是独立的连击模块，功能完全重复。两者同时启用会导致双重倍率计算，分数爆炸。

**建议**:
- 使用 ComboSystem 时，必须将 Scorer.combo.enabled 设为 false
- 如果只需简单连击，用 Scorer 内置即可，不需要 ComboSystem
- 如果需要高级连击（里程碑、视觉反馈），用 ComboSystem + Scorer.combo.enabled=false

**严重度**: CRITICAL — 不处理会导致分数计算错误

---

### 14. Jump.groundY + StaticPlatform — 类型 C

**问题**: Jump 模块有 `groundY` 参数定义固定地面线高度。当存在 StaticPlatform 时，玩家实际落脚点由平台高度决定，不是固定的 groundY。如果 groundY 与平台高度不一致，会出现玩家悬浮或穿透平台。

**建议**:
- 有平台模块时，Jump 的 grounded 判断应依赖 Gravity 的 collision:platform 落地检测，而非 groundY 固定值
- groundY 仅作为无平台时的兜底值（如最低地面线）
- 配置 Jump.useCollisionGrounding = true（如果支持）

---

### 15. Gravity + Jump 双重 Y 轴操作 — 类型 C

**问题**: Gravity 每帧对 velocityY 施加重力加速度，Jump 在跳跃时设置 velocityY = -jumpForce。两者都操作 Y 轴速度，执行顺序影响结果。如果 Jump 先执行、Gravity 后执行，跳跃高度会被重力立即削弱。

**建议**:
- 确保模块 update 顺序：Jump（检测输入+设置脉冲）→ Gravity（施加加速度）→ PlayerMovement（应用最终位移）
- 或者 Jump 只发出事件，由 PlayerMovement 统一处理物理量

---

### 16. Dash + Gravity — 类型 C

**问题**: Dash 期间玩家应沿指定方向高速移动，但 Gravity 仍在每帧施加下拉。导致水平 Dash 变成斜下 Dash，空中 Dash 几乎无效。

**建议**:
- Dash 激活时发出 `dash:start`，Gravity 监听后冻结 Y 轴加速度
- Dash 结束时发出 `dash:end`，Gravity 恢复正常
- 代码层面：Gravity.update() 中检查 isDashing 标志

---

### 17. Dash + PlayerMovement 速度叠加 — 类型 C

**问题**: Dash 有自己的速度，PlayerMovement 也有移动速度。两者同时生效会导致速度叠加，Dash 速度 = dashSpeed + moveSpeed，远超预期。

**建议**:
- Dash 激活期间，PlayerMovement 的输入速度应被禁用或忽略
- Dash 完全接管水平位移，结束后归还控制权给 PlayerMovement
- 实现方式：Dash 发出 `dash:start` → PlayerMovement 暂停响应输入

---

### 18. CoyoteTime + Jump 事件路径 — 类型 C

**问题**: CoyoteTime 发出 `coyote:available` 和 `coyote:expired` 事件。如果 Jump 模块没有正确监听这两个事件，而是只检查 Gravity.grounded 状态，CoyoteTime 完全不起作用。

**建议**:
- Jump 的 canJump() 逻辑必须同时检查：Gravity.grounded || CoyoteTime.isAvailable
- 确保 Jump 在 init 中监听了 `coyote:available` 和 `coyote:expired`
- 测试场景：从平台边缘走下后立即按跳跃，应能成功起跳

---

### 19. Knockback + PlayerMovement — 类型 C

**问题**: Knockback 施加反方向位移脉冲，但如果 PlayerMovement 同时响应玩家输入，玩家可以在击退过程中反向移动抵消 Knockback，使击退效果无感。

**建议**:
- Knockback 激活期间发出 `knockback:start`，PlayerMovement 禁用移动输入
- Knockback 结束发出 `knockback:end`，PlayerMovement 恢复
- Knockback.duration 通常 200-400ms，不宜过长以免操控感丢失

---

### 20. IFrames + Collision 碰撞仍触发 — 类型 C

**问题**: IFrames（无敌帧）只是逻辑上的保护，Collision 模块仍然检测到碰撞并发出 `collision:damage` 事件。需要在事件链上层进行过滤，否则即使无敌也会触发受伤音效、击退等副作用。

**建议**:
- IFrames 应在 `collision:damage` 事件到达 Lives 之前拦截
- 方案 1：IFrames 作为中间件，监听 `collision:damage`，无敌期间不转发给 Lives
- 方案 2：Lives.decrease() 内部检查 IFrames 状态
- 注意 ParticleVFX/SoundFX 如果也映射了 `collision:damage`，无敌期间同样需要抑制

---

### 21. 多个 MovingPlatform + CameraFollow — 类型 C

**问题**: CameraFollow 跟随 PlayerMovement 的位置。当玩家站在 MovingPlatform 上时，相机应随平台移动。但如果有多个 MovingPlatform，相机需要知道玩家当前站在哪一个上。

**建议**:
- CameraFollow 始终跟随 player 位置，不直接跟随平台
- PlayerMovement 在 MovingPlatform 上时需要将平台的 dx/dy 加到自身位置
- 如此 CameraFollow 只需跟随 player，无需关心平台数量

---

## 扩展模块冲突规则

### 22. Runner + PlayerMovement — 类型 A（互斥）

**问题**: Runner 模块自动管理世界水平滚动（相当于自动向右跑），PlayerMovement 也管理水平移动。两者同时控制 X 轴会产生冲突——玩家用 PlayerMovement 反向跑会与 Runner 的滚动叠加。

**建议**:
- Runner 类游戏中不使用 PlayerMovement，改用 Jump + Gravity（只控制 Y 轴）
- 如果需要左右微调，Runner 自身可提供 lane-switch 机制
- 绝对不应同时使用 Runner 和 PlayerMovement

**严重度**: 高 — 同时使用会导致玩家位置混乱

---

### 23. BranchStateMachine + Timer — 类型 C

**问题**: BranchStateMachine 用于叙事/剧情分支，节奏由玩家自主掌控。Timer 的倒计时会给叙事体验施加不必要的时间压力，破坏沉浸感。

**建议**:
- narrative 类游戏通常不需要 Timer
- 如果确实需要限时选择（如紧急场景），在特定节点使用局部倒计时，而不是全局 Timer
- 可用 BranchStateMachine 自身的 node.timeLimit 字段实现局部限时

---

### 24. DressUpEngine + Collision — 类型 A（互斥）

**问题**: DressUpEngine 是纯 UI 交互模块（选择服饰→装扮角色），不涉及物理碰撞。Collision 模块在换装场景中无用且可能造成意外碰撞事件。

**建议**:
- dress-up 类游戏不需要 Collision 模块
- DressUpEngine 的物品选择通过 touch:tap 坐标匹配 UI 区域实现，不走碰撞系统
- 同理不需要 Spawner、Gravity 等物理模块

---

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
| Scorer.combo.enabled + ComboSystem | B 冗余 | **极高** | ComboSystem 时关闭 Scorer combo |
| Jump.groundY + StaticPlatform | C 需处理 | 高 | 用碰撞落地检测替代 groundY |
| Gravity + Jump 执行顺序 | C 需处理 | 高 | 确保 Jump→Gravity→Movement 顺序 |
| Dash + Gravity | C 需处理 | 高 | Dash 期间冻结 Gravity Y 轴 |
| Dash + PlayerMovement | C 需处理 | 中 | Dash 期间禁用 Movement 输入 |
| CoyoteTime + Jump 事件路径 | C 需处理 | 高 | Jump 必须监听 coyote 事件 |
| Knockback + PlayerMovement | C 需处理 | 中 | 击退期间禁用移动输入 |
| IFrames + Collision | C 需处理 | 高 | 无敌期间需上层过滤碰撞 |
| 多个 MovingPlatform + CameraFollow | C 需处理 | 低 | Camera 跟随 player 而非平台 |
| Runner + PlayerMovement | A 互斥 | 高 | Runner 类不用 PlayerMovement |
| BranchStateMachine + Timer | C 需处理 | 低 | 叙事类通常不需要全局 Timer |
| DressUpEngine + Collision | A 互斥 | 中 | 换装不需要碰撞检测 |
