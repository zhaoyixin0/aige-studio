# Dash — 冲刺模块

## 基本信息
- 类型: mechanic
- 类名: `Dash`
- 注册名: `Dash`
- 文件: `src/engine/modules/mechanic/dash.ts`
- 依赖: 无
- 可选联动: PlayerMovement, Jump, Gravity, IFrames

## 功能原理

Dash 模块实现了定距、定时的冲刺机制。冲刺是一次性的位移动作，在 `duration` 毫秒内移动 `distance` 像素，冲刺结束后进入 `cooldown` 冷却期。

**冲刺流程：**
1. 收到 triggerEvent → 检查 `active` 和 `cooldownRemaining`
2. 根据 `directionSource` 确定冲刺方向（单位向量）
3. 设置 `active = true`，发出 `dash:start`
4. 每帧累加 `elapsed`，计算 progress = elapsed / duration
5. 计算线性位移: `displacement = direction * distance * progress`
6. elapsed >= duration 时结束冲刺，设置冷却，发出 `dash:end`

**位移模型：**
- 使用**线性插值**（不是 ease-in/ease-out），冲刺速度恒定
- 冲刺速度 = distance / (duration / 1000) px/s
- 位移是**累积值**（从 0 到 distance），不是增量值
- 外部需要通过 `getDisplacement()` 获取当前位移并叠加到角色位置

**方向确定规则：**
- `facing`: 默认向右 (x:1, y:0)。当前实现不读取角色朝向
- `input`: 从 triggerEvent 的 data 中读取 (x, y) 并归一化为单位向量
- `fixed`: 固定向右 (x:1, y:0)

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| distance | range | `150` | 50 ~ 400，步长 10 | 100 ~ 250 | 冲刺距离 (px) |
| duration | range | `150` | 50 ~ 300，步长 10 | 100 ~ 200 | 冲刺持续时间 (ms) |
| cooldown | range | `500` | 0 ~ 2000，步长 50 | 300 ~ 1000 | 冷却时间 (ms) |
| triggerEvent | string | `'input:touch:doubleTap'` | 任意事件名 | — | 触发冲刺的输入事件 |
| directionSource | select | `'facing'` | facing / input / fixed | — | 方向来源 |

### 冲刺参数参考

| 游戏风格 | distance | duration | cooldown | 冲刺速度 | 参考 |
|----------|----------|----------|----------|---------|------|
| Celeste 风格 | 200 | 150 | 0 | 1333 px/s | 短快 dash，无冷却（靠落地充能） |
| Hollow Knight 风格 | 180 | 200 | 600 | 900 px/s | 中距离，有冷却 |
| Mega Man X 风格 | 250 | 250 | 300 | 1000 px/s | 长距离地面冲刺 |
| 休闲/安全 | 100 | 150 | 1000 | 667 px/s | 短距、长冷却 |
| 战斗回避 | 150 | 100 | 500 | 1500 px/s | 极快、中冷却 |

### 冲刺速度计算

```
冲刺速度 (px/s) = distance / (duration / 1000)

默认值: 150 / (150/1000) = 1000 px/s
```

与 PlayerMovement.speed (默认 300 px/s) 比较:
- 冲刺速度/移动速度比 ≈ 3.3x（符合业界 2x ~ 5x 的常见范围）

## 参数调优指南

### distance 与画布尺寸

```
推荐: distance = canvasWidth * 0.1 ~ 0.25
```

| 画布宽度 | distance 推荐 | 过短阈值 | 过长阈值 |
|----------|--------------|---------|---------|
| 1080 | 100 ~ 270 | < 80 | > 350 |
| 800 | 80 ~ 200 | < 60 | > 250 |
| 720 | 70 ~ 180 | < 50 | > 220 |

- 过短: 冲刺感不明显，玩家可能觉得没有效果
- 过长: 一次冲刺跨越半个屏幕，精度控制困难

### duration 与手感

| duration | 手感 | 适用 |
|---------|------|------|
| 50 ~ 80ms | 闪现（几乎瞬移） | 战斗游戏的回避 |
| 100 ~ 150ms | 快速冲刺（标准） | 平台游戏 |
| 200 ~ 300ms | 滑行冲刺 | 探索向游戏、跑步加速 |

**业界参考**: 大多数经典平台游戏的 dash 持续 100~200ms (6~12 帧@60fps)

### cooldown 设计策略

| 策略 | cooldown | 说明 |
|------|----------|------|
| 无限冲刺 | 0 | 只要不在 active 状态就能再次冲刺，需配合关卡设计限制 |
| 标准冷却 | 300 ~ 600 | 有节制地使用，不至于过度限制 |
| 充能制 | 0 + 外部逻辑 | Celeste 模式：dash 次数由落地/触碰水晶恢复，cooldown=0 |
| 惩罚制 | 1000 ~ 2000 | 冲刺是珍贵资源，错误使用代价大 |

### 与 IFrames 配合

冲刺期间是否无敌是重要的设计决策：

| 方案 | 实现 | 适用 |
|------|------|------|
| 全程无敌 | IFrames.duration = Dash.duration | 回避型 dash（Hades） |
| 前半程无敌 | IFrames.duration = Dash.duration * 0.5 | 平衡型 |
| 无无敌帧 | 不配合 IFrames | 纯移动 dash（Mega Man X） |

当前实现: Dash 不自动触发 IFrames，需要通过事件联动:
- `dash:start` → 触发 IFrames 的激活事件

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `dash:start` | `DASH_START` | `{ direction: { x: number, y: number } }` | 冲刺开始瞬间 |
| `dash:end` | `DASH_END` | `{ displacement: { x: number, y: number } }` | 冲刺结束（duration 到达） |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `{triggerEvent}` | 调用 tryDash()，仅在非 active 且非 cooldown 时生效 |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
用户双击 → emit('input:touch:doubleTap')
  → Dash.tryDash()
    → 确定方向 → 设置 active
    → emit('dash:start', { direction })
      → IFrames 可选监听 → 激活无敌帧
      → SoundFX 监听 → 播放冲刺音效
      → ParticleVFX 监听 → 冲刺特效（拖影/残影）
      → Gravity 可选响应 → 暂停重力（浮空 dash）

Dash.update() 每帧
  → 更新 displacement
  → 渲染器读取 getDisplacement() 叠加到角色位置

elapsed >= duration
  → emit('dash:end', { displacement })
    → IFrames 可选恢复
    → Gravity 可选恢复
```

## 跨模块联动规则

### 与 PlayerMovement

**当前实现**: 完全独立，两者同时运行。

- Dash 的 displacement 和 PlayerMovement 的 x 需要在渲染层叠加
- **问题**: Dash 期间 PlayerMovement 仍然在更新 velocityX，玩家可能同时冲刺和转向
- **建议方案**:
  - 方案 A（替换）: Dash 激活时暂停 PlayerMovement.update()
  - 方案 B（叠加）: 保持当前行为，冲刺位移叠加到移动位置上
  - 方案 C（重定向）: Dash 方向跟随 PlayerMovement.direction

### 与 Jump / Gravity

**当前实现**: Dash 不影响 Y 轴物理。

- 冲刺期间重力仍然生效，角色在空中 dash 时会同时下落
- **业界常见做法**: dash 期间冻结 Y 轴速度（Celeste），使冲刺为纯水平移动
- **当前没有实现 Y 轴冻结**，需要外部代码在 `dash:start` 时暂停 Gravity/Jump 的更新

### 与 IFrames

- Dash 不自动触发无敌帧
- **连接方式**: 需要在 IFrames 中设置 `triggerEvent: 'dash:start'`
- 或由 AutoWirer 配置 dash:start → IFrames 激活

### 与 StaticPlatform / MovingPlatform

- Dash 不做任何碰撞检测
- 角色冲刺时可能穿过平台（水平方向）
- **需要 WallDetect 配合**: 在墙壁处截断 dash 位移

### 与 Hazard

- 如果没有配合 IFrames，角色在 dash 穿过 Hazard 时会受伤
- 配合 IFrames 后，dash 可以用来穿越危险区域

## 输入适配

| 输入方式 | triggerEvent | directionSource | 说明 |
|----------|-------------|----------------|------|
| TouchInput | `input:touch:doubleTap` | `facing` | 双击冲刺，方向跟随朝向 |
| TouchInput | `input:touch:swipe` | `input` | 向冲刺方向 swipe |
| FaceInput | `input:face:mouthOpen` | `facing` | 张嘴冲刺 |
| HandInput | `input:hand:gesture:fist` | `input` | 握拳+方向冲刺 |
| DeviceInput | `input:device:shake` | `facing` | 摇晃冲刺 |

**注意**: `directionSource: 'facing'` 在当前实现中始终返回右方向 (x:1, y:0)，不读取角色实际朝向。这是一个已知限制。

## 常见 Anti-Pattern

**distance 过大导致穿越整个关卡**
- 错误: `distance: 400` 在 800px 宽的画布上 → 一次冲刺从左到右
- 正确: distance 不超过画布宽度的 25%

**cooldown = 0 无限冲刺**
- 不是 bug，但需要关卡设计配合（如 Celeste 的 dash 充能机制）
- 如果没有外部限制机制，玩家可以通过连续冲刺移动得比正常走路快得多

**duration 过短导致方向判断问题**
- 错误: `duration: 50` → dash 在 3 帧内完成，如果 directionSource='input'，可能因为输入延迟而读不到方向数据
- 正确: duration >= 100ms

**directionSource='facing' 但角色没有朝向数据**
- 当前实现: facing 模式固定返回右方向，不从 PlayerMovement 读取实际朝向
- 建议: 使用 'input' 模式或修复 facing 模式使其读取 PlayerMovement.direction

**Dash 位移不被渲染器正确应用**
- 错误: 渲染器只读取 PlayerMovement.getX() 而忽略 Dash.getDisplacement()
- 正确: 渲染器应该叠加两者: `x = playerMovement.getX() + dash.getDisplacement().x`

## 常见问题 & 边界情况

- `displacement` 是**从冲刺起点开始的累积位移**，不是每帧增量
- 冲刺期间 `isActive()` 返回 true，可用于外部判断是否应该暂停其他系统
- cooldown 使用实际时间递减（每帧减去 dt），不受帧率影响
- cooldown 递减发生在 active 检查之前，所以理论上 active 和 cooldown 不会同时 > 0
- `tryDash()` 在 active 或 cooldown > 0 时静默返回，不发出任何事件
- `reset()` 清空所有状态，角色可以立即再次冲刺
- direction 为 (0, 0) 时（无输入且 source=input），默认回退到 (1, 0)
- 对角冲刺（direction 非轴对齐）时，实际距离仍为 `distance`（因为方向已归一化）
- 冲刺可以是垂直方向的（y != 0），这允许向上/向下冲刺
- 冲刺过程中如果 gameflow 暂停，elapsed 停止累加，冲刺会在恢复后继续
