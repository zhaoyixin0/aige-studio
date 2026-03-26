# CoyoteTime — 土狼时间模块

## 基本信息
- 类型: mechanic
- 类名: `CoyoteTime`
- 注册名: `CoyoteTime`
- 文件: `src/engine/modules/mechanic/coyote-time.ts`
- 依赖: `Jump`, `Gravity`（声明在 getDependencies 中）
- 可选联动: StaticPlatform, MovingPlatform, CrumblingPlatform

## 功能原理

CoyoteTime 模块实现了两个核心平台跳跃手感优化机制：

### 1. Coyote Time（土狼时间）
玩家从平台边缘走下后的短暂窗口内仍然可以执行跳跃。名称来源于 Wile E. Coyote（兔八哥中的角色）在悬崖边缘短暂悬停的经典画面。

**工作原理：**
1. 监听 `gravity:falling` → 如果当前是 grounded 状态，则开始 coyote 计时
2. coyoteTimer 设为 `coyoteFrames * 16`ms（假设 60fps，1帧 ≈ 16ms）
3. 在 coyoteTimer > 0 期间，如果收到跳跃输入，发出 `coyote:jump` 允许跳跃
4. coyoteTimer 归零后，窗口关闭

### 2. Jump Buffering（跳跃缓冲）
玩家在即将着陆前按下跳跃按钮，着陆瞬间自动执行跳跃。

**工作原理：**
1. 在空中时收到跳跃输入 → 如果不在 coyote window 内，设置 jumpBuffered = true
2. bufferTimer 设为 `bufferFrames * 16`ms
3. 监听 `gravity:landed` → 如果 jumpBuffered = true 且 bufferTimer > 0，发出 `coyote:jump`
4. bufferTimer 归零后，缓冲失效

**组合流程：**

```
情况 1: 从平台走下后跳跃（Coyote Time）
  gravity:falling → 启动 coyoteTimer
  jumpEvent → coyoteTimer > 0 → emit('coyote:jump') ✓

情况 2: 提前按跳跃后着陆（Jump Buffering）
  jumpEvent（空中）→ coyoteTimer = 0 → 设置 jumpBuffered
  gravity:landed → jumpBuffered + bufferTimer > 0 → emit('coyote:jump') ✓

情况 3: 正常地面跳跃
  jumpEvent → grounded = true → emit('coyote:jump') ✓

情况 4: 空中无效跳跃
  jumpEvent（空中）→ coyoteTimer = 0 → 设置 jumpBuffered
  → bufferTimer 归零 → jumpBuffered 清除
  → 永远没有落地（掉入深渊）→ 无跳跃 ✗
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| coyoteFrames | range | `6` | 3 ~ 15，步长 1 | 4 ~ 8 | 离地后允许跳跃的帧数窗口 |
| bufferFrames | range | `6` | 3 ~ 15，步长 1 | 4 ~ 8 | 着陆前预按跳跃的帧数窗口 |
| jumpEvent | string | `'input:touch:tap'` | 任意事件名 | — | 监听的跳跃输入事件 |

### 帧数与毫秒换算

当前实现使用固定 16ms/帧的换算（假设 60fps）：

| 帧数 | 毫秒 | 适用场景 |
|------|------|---------|
| 3 | 48ms | 极短窗口，硬核游戏 |
| 4 | 64ms | 短窗口，有挑战感 |
| 5 | 80ms | 标准偏短 |
| 6 | 96ms | 标准（默认值） |
| 8 | 128ms | 宽松，休闲游戏 |
| 10 | 160ms | 很宽松 |
| 12 | 192ms | 非常宽松，明显能感觉到延迟 |
| 15 | 240ms | 过于宽松，可能破坏平台挑战性 |

### 经典游戏参数参考

| 游戏 | Coyote Time | Jump Buffer | 说明 |
|------|-------------|-------------|------|
| Celeste | ~5 帧 (83ms) | ~5 帧 (83ms) | 平衡：对玩家友好但不破坏挑战 |
| Super Meat Boy | ~3 帧 (50ms) | 较长 | 短 coyote，依赖 buffer |
| Hollow Knight | ~3 帧 (50ms) | 可能无 | 精密，不容忍误操作 |
| AIGE Studio 默认 | 6 帧 (96ms) | 6 帧 (96ms) | 偏宽松，适合休闲玩家 |

## 参数调优指南

### coyoteFrames 和 bufferFrames 的关系

两个参数应该大致匹配，偏差不超过 2~3 帧：

| 组合 | 效果 |
|------|------|
| coyote=6, buffer=6 | 标准平衡（默认） |
| coyote=8, buffer=4 | 倾向宽容走下跳跃，但预跳要精准 |
| coyote=4, buffer=8 | 走下跳跃要精准，但预跳宽容 |
| coyote=10, buffer=10 | 非常宽松，适合低龄/休闲玩家 |
| coyote=3, buffer=3 | 硬核，需要精确时机 |

### 与不同输入方式的配合

不同输入方式的固有延迟不同，需要相应增加窗口：

| 输入方式 | 额外延迟 | 建议 coyoteFrames 调整 | 建议 bufferFrames 调整 |
|----------|---------|----------------------|---------------------|
| TouchInput | ~0ms | +0 | +0 |
| HandInput | ~80ms (+5帧) | +2 ~ +3 | +2 ~ +3 |
| FaceInput | ~100ms (+6帧) | +3 ~ +4 | +3 ~ +4 |
| AudioInput | ~200ms (+12帧) | +5 ~ +6 | +5 ~ +6 |
| DeviceInput | ~50ms (+3帧) | +1 ~ +2 | +1 ~ +2 |

**示例**: 使用面部输入时，建议 `coyoteFrames: 10, bufferFrames: 10`

### 与 Jump 模块参数的配合

CoyoteTime 的有效性受跳跃参数影响：

```
coyote window 内的下落距离 = ½ * gravity * (coyoteFrames * 0.016)²
```

| gravity | coyoteFrames=6 (96ms) 下落距离 | 说明 |
|---------|-------------------------------|------|
| 600 | 2.8px | 几乎不可见，很安全 |
| 980 | 4.5px | 微小偏移，可接受 |
| 1400 | 6.5px | 稍有下落，视觉上略可察觉 |
| 2000 | 9.2px | 明显下落，可能需要调小 coyoteFrames |

**原则**: 高重力游戏应减少 coyoteFrames（否则视觉上角色已经明显下落却还能跳跃，看起来不自然）

### jumpEvent 必须与 Jump.triggerEvent 一致

**这是最常见的配置错误**: CoyoteTime 监听 jumpEvent，但它发出的是 `coyote:jump`，而不是直接触发 Jump。

当前的事件流：
1. 用户按跳跃 → 同时发送到 CoyoteTime 和 Jump
2. Jump 检查 grounded → 如果在地面，直接跳跃
3. CoyoteTime 检查 coyote window → 如果在窗口内，发出 `coyote:jump`
4. **问题**: `coyote:jump` 事件不被 Jump 监听（Jump 只监听 triggerEvent）

**当前集成方式**: 需要外部代码将 `coyote:jump` 转换为 Jump 的 triggerJump() 调用，或者将 Jump.triggerEvent 设为 `coyote:jump`。

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `coyote:jump` | `COYOTE_JUMP` | （无数据） | 三种情况之一：grounded 时按跳跃、coyote window 内按跳跃、着陆时有 buffered 跳跃 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gravity:falling` | 如果当前 grounded → 标记 !grounded，启动 coyoteTimer |
| `gravity:landed` | 标记 grounded，重置 coyoteTimer，检查并消费 jumpBuffered |
| `{jumpEvent}` | grounded 或 coyoteTimer > 0 → emit('coyote:jump')；否则 → 设置 jumpBuffered |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
Coyote Time 场景:
  Gravity → emit('gravity:falling')
    → CoyoteTime: grounded=false, coyoteTimer=96ms
  用户 → emit('input:touch:tap')
    → CoyoteTime: coyoteTimer > 0 → emit('coyote:jump')
      → (需要外部代码转发到 Jump)

Jump Buffering 场景:
  用户 → emit('input:touch:tap')  (空中)
    → CoyoteTime: !grounded && coyoteTimer=0 → jumpBuffered=true, bufferTimer=96ms
  Gravity → emit('gravity:landed')
    → CoyoteTime: jumpBuffered && bufferTimer > 0 → emit('coyote:jump')
```

## 跨模块联动规则

### 与 Jump 模块（核心联动）

**必须配合使用**。CoyoteTime 存在的唯一目的就是增强 Jump 的手感。

关键配置要求：
1. `CoyoteTime.jumpEvent` 必须等于 `Jump.triggerEvent`（同一个输入事件）
2. CoyoteTime 发出的 `coyote:jump` 需要被正确消费:
   - 方案 A: 将 Jump 的 triggerEvent 设为 `coyote:jump`，但这样 Jump 就不再直接响应输入
   - 方案 B: AutoWirer 将 `coyote:jump` 转发为 Jump.triggerJump() 调用
   - 方案 C: CoyoteTime 直接调用 Jump 实例的 triggerJump()（需要模块间引用）
3. **当前状态**: 这个集成是**不完整的**——`coyote:jump` 事件发出后没有标准消费路径

### 与 Gravity 模块（核心联动）

CoyoteTime 完全依赖 Gravity 的事件来感知角色状态：
- `gravity:falling` → 角色离开地面（走下平台或跳跃）
- `gravity:landed` → 角色着陆

**注意**: `gravity:falling` 每帧都会对 airborne 对象发出，但 CoyoteTime 内部用 `this.grounded` 标记确保只在首次从 grounded 变为 airborne 时启动 coyote 计时。

**如果 Gravity 模块不存在**（虽然声明为 required），CoyoteTime 永远不会收到 falling/landed 事件，所有功能失效。

### 与 StaticPlatform / MovingPlatform / CrumblingPlatform

CoyoteTime 不直接与平台模块交互，但平台状态间接影响 coyote 行为：
- 从 StaticPlatform 边缘走下 → Gravity 发出 `gravity:falling` → CoyoteTime 启动
- MovingPlatform 移走导致角色悬空 → 同上
- CrumblingPlatform 崩塌后 → Gravity 检测到 airborne → `gravity:falling` → CoyoteTime 启动

**重要**: CrumblingPlatform 崩塌时应该给玩家 coyote time，让玩家有机会跳走。当前实现如果 Gravity 正确标记 airborne，这个行为是自动生效的。

### 与 WallDetect

- Wall jump（墙壁跳跃）通常不受 coyote time 影响
- CoyoteTime 的 `coyote:jump` 不区分普通跳跃和墙壁跳跃
- **建议**: 墙壁离开后的短暂窗口（wall coyote time）需要单独实现

### 与 Dash

- Dash 结束后如果在空中，不应该触发 coyote time（因为是主动冲刺，不是从平台走下）
- **当前问题**: Gravity 可能在 dash 结束后发出 `gravity:falling`，错误触发 coyote time
- **解决方案**: 需要在 Dash 结束时设置一个标记，让 CoyoteTime 忽略紧随的 `gravity:falling`

## 输入适配

CoyoteTime 的 jumpEvent 应与 Jump.triggerEvent 保持一致：

| 输入方式 | jumpEvent | 额外建议 |
|----------|----------|---------|
| TouchInput | `input:touch:tap` | 标准配置 |
| FaceInput | `input:face:mouthOpen` | 增加 coyoteFrames 到 8~10 |
| HandInput | `input:hand:gesture:open` | 增加 coyoteFrames 到 7~9 |
| AudioInput | `input:audio:blow` | 增加 coyoteFrames 到 10~12 |
| DeviceInput | `input:device:shake` | 不推荐用于跳跃 |

## 常见 Anti-Pattern

**jumpEvent 与 Jump.triggerEvent 不一致**
- 错误: `CoyoteTime.jumpEvent: 'input:touch:tap'`, `Jump.triggerEvent: 'coyote:jump'`
  这看起来对，但导致循环: 用户按 tap → CoyoteTime 发 coyote:jump → Jump 跳跃。
  但普通地面跳跃也变成了 tap → CoyoteTime → coyote:jump → Jump，多了一层转发。
- **最佳实践**: 两者都设为原始输入事件（如 `input:touch:tap`），让 CoyoteTime 和 Jump 并行响应

**coyoteFrames 过大（> 10）**
- 错误: 玩家可以在明显离开平台后很久仍然跳跃，看起来像漂浮/作弊
- 正确: 限制在 4~8 帧，超过 10 帧只在使用高延迟输入时才考虑

**没有配合 Gravity 使用**
- 错误: 只添加了 CoyoteTime 和 Jump，没有 Gravity → CoyoteTime 永远不收到 falling/landed 事件
- 正确: 三个模块必须同时存在

**bufferFrames 过小导致预跳无效**
- 错误: `bufferFrames: 3`（48ms）→ 大多数玩家的预判时机在 50~100ms，太短的 buffer 等于没有
- 正确: bufferFrames >= 4（64ms）

**16ms/帧的固定假设**
- 当前实现 `coyoteTimer = coyoteFrames * 16`，但实际帧率可能不是 60fps
- 在 30fps 设备上: 6 帧 = 200ms（而不是 96ms），窗口比预期宽两倍
- 在 120fps 设备上: 6 帧 = 50ms（而不是 96ms），窗口比预期窄
- **实际影响**: coyoteTimer 使用真实 dt 递减，所以实际窗口时间是固定的 96ms（不随帧率变化）。帧数只是初始化值的换算方式。

## 常见问题 & 边界情况

- `coyote:jump` 事件不携带任何数据（payload 为空）
- coyoteTimer 和 bufferTimer 使用真实 dt 递减，不是按帧递减
- 帧数 → 毫秒的换算是固定的 `帧数 * 16`（假设 60fps），实际时间窗口是固定的毫秒数
- `gravity:falling` 每帧都触发，但 CoyoteTime 只在首次 grounded→airborne 时启动计时
- 如果角色从跳跃中下落（而非从平台走下），`gravity:falling` 仍会触发，但此时 `grounded` 已经是 false（由之前的 `gravity:falling` 或 jump:start 设置），所以 coyote timer 不会启动。**但**: 当前实现中 `grounded` 只通过 `gravity:landed` 设为 true，通过 `gravity:falling` 首次设为 false。Jump 的 `jump:start` 事件不直接设置 CoyoteTime 的 grounded 状态，这可能导致跳跃后的首帧 `gravity:falling` 误触发 coyote timer（如果上一次着陆后 grounded 仍然为 true）
- `reset()` 恢复到 grounded = true，coyoteTimer = 0，bufferTimer = 0
- 多个跳跃输入在同一个 coyote window 内不会导致多次跳跃（第一次消费后 coyoteTimer 被清零）
- jumpBuffered 在 bufferTimer 归零后自动清除，不会无限期保留
