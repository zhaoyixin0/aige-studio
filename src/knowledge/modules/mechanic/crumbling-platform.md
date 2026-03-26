# CrumblingPlatform — 碎裂平台模块

## 基本信息
- 类型: mechanic
- 类名: `CrumblingPlatform`
- 注册名: `CrumblingPlatform`
- 文件: `src/engine/modules/mechanic/crumbling-platform.ts`
- 依赖: 无（独立模块）
- 可选联动: Gravity, Jump, PlayerMovement, StaticPlatform, CameraFollow, ParticleVFX, SoundFX

## 功能原理

CrumblingPlatform 管理一组在玩家站上后经过延迟崩塌、随后可选重生的平台。每个平台独立维护三阶段状态机：活跃（active）→ 碎裂中（crumbling）→ 消失（inactive）→ 重生（respawn 后回到 active）。

**状态机：**

```
         ┌─ triggerCrumble() ─┐
         │                     ▼
    [ACTIVE] ──────────► [CRUMBLING]
       ▲                     │
       │                     │ crumbleTimer >= delay
       │                     ▼
       │               [INACTIVE]
       │                     │
       │                     │ respawnTimer >= respawnTime * 1000
       └─────────────────────┘
                (respawnTime > 0 时)
```

**三阶段详解：**

### 1. Active（活跃）
- `active = true, crumbling = false`
- 平台正常存在，可以被踩踏
- `isPlatformActive(index)` 返回 true
- 外部碰撞检测应只对 active 平台执行

### 2. Crumbling（碎裂中）
- `active = true, crumbling = true`
- 由 `triggerCrumble(index)` 触发
- `crumbleTimer` 从 0 开始每帧累加 dt
- 当 `crumbleTimer >= delay` → 转入 inactive
- **碎裂期间平台仍然存在**（active = true），玩家可以继续站立
- 这个阶段是给玩家的**视觉/听觉警告**: 平台开始抖动、变色、发出声音

```
碎裂警告时间 = delay (ms)
默认 500ms ≈ 30帧@60fps

参考游戏:
  Celeste: 约 400~500ms（快速反应）
  Hollow Knight: 约 600~800ms（从容反应）
  Super Mario: 约 1000ms（宽容的警告）
```

### 3. Inactive（消失/崩塌后）
- `active = false, crumbling = false`
- 发出 `platform:crumble` 事件
- `isPlatformActive(index)` 返回 false → 外部碰撞检测应跳过此平台
- 玩家脚下平台消失 → 需要开始下落

**重生机制**:
- 如果 `respawnTime > 0`: 启动 respawnTimer，到期后 active 恢复为 true，发出 `platform:respawn`
- 如果 `respawnTime = 0`: 平台永久消失，不重生

```
重生总周期 = delay + respawnTime * 1000 (ms)
默认周期 = 500 + 3000 = 3500ms
```

**数学关系：**
```
碎裂后下落距离（到玩家着陆前）:
  d_fall = ½ * gravity * t_fall²

如果下方有平台（间距 gap）:
  t_fall = sqrt(2 * gap / gravity)

重生安全检查:
  如果玩家在重生位置附近，重生可能导致玩家"卡"在平台内部
  当前实现不做安全检查——平台无条件重生
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| platforms | object | `[]` | 平台定义数组 | — | 碎裂平台定义列表（结构同 PlatformRect） |
| delay | range | `500` | 200 ~ 2000，步长 50 | 400 ~ 800 | 碎裂延迟 (ms)，从触发到真正消失的时间 |
| respawnTime | range | `3` | 0 ~ 10，步长 0.5 | 2 ~ 5 | 重生时间 (秒)。0 = 永不重生 |
| layer | string | `'platforms'` | 任意字符串 | `'platforms'` | 碰撞图层名 |
| asset | asset | `''` | 资源 ID | — | 正常状态贴图 |
| crumbleAsset | asset | `''` | 资源 ID | — | 碎裂中状态贴图（可选） |

### 参数组合推荐

| 关卡风格 | delay | respawnTime | 体验 | 参考 |
|----------|-------|-------------|------|------|
| 新手教学 | 800 ~ 1200 | 2 ~ 3 | 充足的反应时间，快速重生 | Mario 新手关 |
| 标准挑战 | 400 ~ 600 | 3 ~ 5 | 需要快速反应 | Celeste |
| 硬核精密 | 200 ~ 400 | 5 ~ 8 | 极快碎裂，长等待重生 | Super Meat Boy |
| 一次性通道 | 300 ~ 500 | 0 | 永不重生，创造紧迫感 | — |
| 安全缓冲 | 1000 ~ 2000 | 1 ~ 2 | 几乎不会碎裂，心理压力用 | 作为气氛元素 |

### 碎裂延迟的体感参考

| delay (ms) | 帧数 @60fps | 感受 | 适用人群 |
|------------|------------|------|---------|
| 200 | 12 | 瞬间——几乎来不及反应 | 硬核玩家 |
| 400 | 24 | 快速——需要即时反应 | 经验玩家 |
| 600 | 36 | 标准——有时间思考下一步 | 一般玩家 |
| 1000 | 60 | 从容——可以观察周围环境 | 休闲/新手 |
| 2000 | 120 | 缓慢——更多是心理压力 | 教学/气氛 |

## 参数调优指南

### delay 与跳跃时间的关系

玩家站上碎裂平台后需要在 delay 时间内做出跳跃动作：

```
可用时间 = delay - 人类反应时间 (约 200ms)
实际可用 = delay - 200ms

如果 delay = 500ms → 玩家有 300ms 准备和起跳
如果 delay = 300ms → 玩家只有 100ms → 几乎必须预判
```

**设计建议**:
- 首次遇到碎裂平台: delay >= 800ms（让玩家理解机制）
- 后续相同类型: 可逐步降到 400~600ms
- 连续碎裂平台链: 保持一致的 delay（让玩家建立节奏）

### respawnTime 与关卡循环

```
关卡循环时间 = 玩家到达碎裂平台序列的时间 + 通过时间

如果 respawnTime < 关卡循环时间:
  玩家失败后重试时平台已重生 → 良好体验
如果 respawnTime > 关卡循环时间:
  玩家需要等待平台重生 → 节奏中断

建议: respawnTime <= 预期重试间隔的 80%
```

### 碎裂视觉反馈设计（参考业界最佳实践）

碎裂过程应有明确的视觉/听觉反馈：

```
阶段 1（0 ~ delay * 0.3）: 轻微抖动（offset ±1~2px）
阶段 2（delay * 0.3 ~ delay * 0.7）: 明显抖动 + 颜色变化（变红/变亮）
阶段 3（delay * 0.7 ~ delay）: 剧烈抖动 + 粒子脱落

crumbleAsset: 可用于替换阶段 2~3 的贴图
ParticleVFX: 碎片粒子效果（监听 platform:crumble）
SoundFX: 碎裂预警音 + 崩塌音

重生视觉:
  渐显效果（alpha 0 → 1 在 500ms 内）
  重生粒子效果（监听 platform:respawn）
```

### 碎裂平台链设计模式

**前进式链条**（参考 Celeste Chapter 2）:
```
平台 0 ←── 间距 ──→ 平台 1 ←── 间距 ──→ 平台 2
delay=600       delay=600       delay=600

节奏: 踩→跳→踩→跳→踩→跳，统一节奏
所有 delay 相同，让玩家建立肌肉记忆
```

**递减式链条**（渐进难度）:
```
平台 0 (delay=800) → 平台 1 (delay=600) → 平台 2 (delay=400)
后面的平台碎得更快，压迫感递增
```

**安全岛模式**:
```
碎裂 → 碎裂 → [实心安全平台] → 碎裂 → 碎裂
每 2~3 个碎裂平台后放一个不会碎裂的安全区
让玩家有喘息机会
```

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `platform:crumble` | `PLATFORM_CRUMBLE` | `{ id: string, index: number }` | crumbleTimer >= delay 时（平台消失瞬间） |
| `platform:respawn` | `PLATFORM_RESPAWN` | `{ id: string, index: number }` | respawnTimer >= respawnTime * 1000 时（平台重生） |

**注意**: id 格式为 `crumble-{index}`（如 `crumble-0`, `crumble-1`）

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:resume` | 恢复计时器更新 |
| `gameflow:pause` | 暂停计时器更新 |

### 事件流转示意

```
渲染器: 检测玩家站在碎裂平台 index 上
  → crumblingPlatform.triggerCrumble(index)
    → state.crumbling = true

CrumblingPlatform.update() 每帧:
  crumbling 阶段:
    crumbleTimer += dt
    → 渲染器每帧检查 crumbling 状态 → 显示抖动/颜色变化

  crumbleTimer >= delay:
    active = false
    → emit('platform:crumble', { id: 'crumble-0', index: 0 })
      → 渲染器: 隐藏平台 sprite
      → ParticleVFX: 播放碎裂粒子
      → SoundFX: 播放碎裂音效
      → 渲染器: 将玩家标记为 airborne（如果仍在此平台上）
      → Gravity: 玩家开始下落

  inactive 阶段 (respawnTime > 0):
    respawnTimer += dt
    → respawnTimer >= respawnTime * 1000
      → active = true
      → emit('platform:respawn', { id: 'crumble-0', index: 0 })
        → 渲染器: 显示平台 sprite（带重生动画）
        → SoundFX: 播放重生音效
```

## 跨模块联动规则

### 与 Gravity 模块

- 玩家站在碎裂平台上时，Gravity.floorY = platform.y
- 平台崩塌（active 变为 false）后:
  - 需要将 Gravity 对象的 floorY 更新为下方下一个平台的 Y 或默认地面 Y
  - 需要标记 Gravity 对象为 airborne
- **当前无自动集成**: 需要渲染器在 `platform:crumble` 事件后手动处理

### 与 Jump 模块

- 碎裂期间（crumbling = true, active = true）玩家可以正常跳跃
- 如果玩家在碎裂完成前跳离 → 成功逃脱
- 如果玩家在碎裂完成时仍在平台上 → 开始下落
- **关键设计**: delay 应该 >= 玩家起跳反应时间 + Jump 的起跳准备时间

### 与 PlayerMovement 模块

- 碎裂开始后，玩家仍可以左右移动（碎裂期间平台 active = true）
- 如果玩家移动离开碎裂平台的水平范围 → 离开平台，碎裂状态继续（不取消）
- 碎裂平台的 triggerCrumble 不可逆——一旦触发，即使玩家离开也会继续碎裂

### 与 StaticPlatform 模块

- 碎裂平台下方通常有 StaticPlatform 作为安全网
- 安全网距离 = 碎裂平台 Y 到下方 StaticPlatform Y 的间距
- **建议**: 安全网距离不超过跳跃高度的 2 倍（否则下落时间太长）

### 与 ParticleVFX / SoundFX 模块

- `platform:crumble` → 触发碎裂粒子效果和碎裂音效
- `platform:respawn` → 触发重生粒子效果和重生音效
- **碎裂预警**: 在 crumbling 阶段需要渲染器自行实现视觉抖动（事件系统不提供逐帧进度）

### 与 CameraFollow 模块

- 当碎裂平台崩塌导致玩家突然下落时，CameraFollow 的 smoothing 防止相机突然跳动
- **建议**: 在碎裂密集的区域，CameraFollow.smoothing 不要太低（>= 0.15），否则玩家快速上下移动时相机抖动

### 与 Checkpoint 模块

- 如果碎裂平台区域较长，应在中间放置 Checkpoint
- respawnTime = 0（永不重生）的碎裂平台需要配合 Checkpoint，否则玩家死亡后无法重新通过

## 输入适配

CrumblingPlatform 本身不直接响应输入事件，但 delay 参数应根据输入延迟调整：

| 输入方式 | delay 调整建议 | 原因 |
|----------|--------------|------|
| TouchInput | 标准 (400~600ms) | 触摸响应快 (~20ms) |
| FaceInput | +150ms (550~750ms) | 面部追踪有 ~100ms 延迟 |
| HandInput | +100ms (500~700ms) | 手势追踪有 ~80ms 延迟 |
| DeviceInput | +100ms (500~700ms) | 陀螺仪有一定延迟 |
| AudioInput | +200ms (600~800ms) | 声音检测延迟最大 (~200ms) |

**原则**: `有效反应窗口 = delay - 人类反应时间 - 输入延迟 >= 100ms`

## 常见 Anti-Pattern

**delay 过短导致不可能逃脱**
- 错误: `delay: 200` + 使用 FaceInput (100ms 延迟) + 人类反应 200ms → 玩家永远无法在碎裂前跳离
- 正确: `delay >= 200 + inputLatency + 100`（至少 100ms 有效反应窗口）

**respawnTime = 0 且没有替代路径**
- 错误: 所有碎裂平台永不重生，玩家失败一次后无法重新通过
- 正确: 永不重生的碎裂平台必须配合 Checkpoint 或提供替代路径

**大量碎裂平台同时 crumbling**
- 错误: 10+ 个碎裂平台同时进入 crumbling 状态 → 大量计时器同时运行 + 大量事件发出
- 正确: 只有玩家当前站立的平台才 triggerCrumble，不要预触发

**忘记在 crumble 后标记玩家为 airborne**
- 错误: 平台消失但玩家仍标记为 grounded → 角色悬停在空中
- 正确: 渲染器在 `platform:crumble` 事件后立即检查玩家是否仍在该平台上方，是则标记为 airborne

**crumbleAsset 不存在**
- 错误: 配置了 crumbleAsset 但资源未加载 → 碎裂状态贴图消失
- 正确: crumbleAsset 为可选字段，空字符串表示使用默认 asset

**连续碎裂平台 delay 不一致**
- 不一定是错误，但如果玩家需要建立跳跃节奏，不一致的 delay 会打断节奏
- 建议: 连续碎裂平台链使用一致的 delay，或有意递减创造紧迫感

## 常见问题 & 边界情况

- `triggerCrumble(index)` 只在 `active = true && crumbling = false` 时生效，已碎裂或正在碎裂的平台不会重复触发
- `isPlatformActive(index)` 在 crumbling 阶段仍返回 true——平台直到真正消失才变为 inactive
- `getPlatforms()` 返回所有平台定义（不区分活跃/消失状态），需要配合 `isPlatformActive()` 过滤
- `platform:crumble` 事件在平台从 crumbling 变为 inactive 的瞬间发出（不是在 triggerCrumble 调用时）
- `platform:respawn` 事件在 respawnTimer 到期的瞬间发出
- `delay` 单位是毫秒 (ms)，`respawnTime` 单位是秒 (s)——注意单位不同
- `reset()` 调用 `buildStates()` 重建所有状态 → 所有平台恢复为 active
- crumbleTimer 和 respawnTimer 使用 dt（毫秒）累加
- respawnTime 比较时乘以 1000 转为毫秒: `respawnTimer >= respawnTime * 1000`
- 如果 index 超出 states 数组范围，`triggerCrumble()` 和 `isPlatformActive()` 静默失败
- 不支持部分碎裂（一个平台只能整体碎裂，不能从边缘开始逐步碎裂）
- 碎裂过程不可逆——一旦 triggerCrumble 就会必然碎裂
