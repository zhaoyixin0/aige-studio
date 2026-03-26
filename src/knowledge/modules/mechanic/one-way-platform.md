# OneWayPlatform — 单向平台模块

## 基本信息
- 类型: mechanic
- 类名: `OneWayPlatform`
- 注册名: `OneWayPlatform`
- 文件: `src/engine/modules/mechanic/one-way-platform.ts`
- 依赖: 无（独立模块）
- 可选联动: Gravity, Jump, PlayerMovement, StaticPlatform, CoyoteTime

## 功能原理

OneWayPlatform 实现了可从下方穿过、仅在上方着陆的单向平台（也叫 jump-through platform）。核心机制是**速度方向检测**：只有当玩家向下运动（velocityY > 0，即下落中）且从上方穿过平台表面时，才判定为着陆。

**着陆检测算法：**
```
checkLanding(px, py, velocityY):
  1. 如果正在 dropping 状态 → 返回 null（允许穿过）
  2. 如果 velocityY <= 0 → 返回 null（向上运动时不阻挡）
  3. 遍历所有平台:
     a. 检测 px 是否在平台 X 范围内: px >= p.x && px <= p.x + p.width
     b. 检测 py 是否正在穿过平台 Y: py <= p.y && py + velocityY >= p.y
     c. 两条件均满足 → 着陆成功，发出 platform:land 事件
  4. 无碰撞 → 返回 null
```

**关键判定条件解析：**
```
py <= p.y && py + velocityY >= p.y

含义: 当前帧玩家在平台上方 (py <= p.y)
      下一帧玩家将到达或穿过平台表面 (py + velocityY >= p.y)

这是离散碰撞检测的经典方法: 检查位移向量是否跨越碰撞面
```

**注意**: 这里的 velocityY 不是速度而是**位移量**（单位应为 px/frame 或渲染器传入的当前帧 Y 位移），但源码中命名为 velocityY。调用方需确保传入的是正确的每帧位移值。

**Drop-Through（下穿）机制：**
1. 收到 dropThroughEvent → 设置 `dropping = true`，启动 dropTimer
2. dropping 期间，`checkLanding()` 始终返回 null（无视所有平台）
3. 250ms 后 dropTimer 到期 → `dropping = false`，恢复正常着陆检测
4. dropping 期间发出 `platform:drop` 事件

**250ms Drop-Through 持续时间的设计依据：**
```
以标准参数计算:
  Gravity.strength = 980 px/s²
  下落 250ms 的距离 = ½ * 980 * 0.25² ≈ 30.6 px
  下落 250ms 的速度 = 980 * 0.25 = 245 px/s

30px 约等于一个标准平台厚度，足以让玩家穿过薄平台
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| platforms | object | `[]` | OneWayPlatformDef 数组 | — | 单向平台定义列表 |
| layer | string | `'platforms'` | 任意字符串 | `'platforms'` | 碰撞图层名 |
| dropThroughEvent | string | `''` | 任意事件名 | 见输入适配 | 触发下穿的输入事件 |
| asset | asset | `''` | 资源 ID | — | 平台贴图资源 |
| tileMode | select | `'stretch'` | stretch / repeat | — | 贴图模式 |

### OneWayPlatformDef 结构

| 字段 | 类型 | 说明 | 有效范围 |
|------|------|------|----------|
| x | number | 平台左端 X (px) | 0 ~ canvasWidth |
| y | number | 平台表面 Y (px) | 0 ~ canvasHeight |
| width | number | 平台宽度 (px) | 40 ~ canvasWidth |

**注意**: OneWayPlatformDef 没有 height 和 material 字段——单向平台被视为无厚度的水平线段（只有表面，没有体积）。这也意味着它不需要 height 来做碰撞检测。

### LandingResult 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| index | number | 着陆平台的数组索引 |
| x | number | 着陆点 X (= 传入的 px) |
| y | number | 着陆点 Y (= platform.y) |

## 参数调优指南

### 单向平台的关卡设计角色

单向平台在关卡中通常扮演以下角色（参考 Celeste、Hollow Knight）：

| 角色 | 场景 | 设计要点 |
|------|------|---------|
| 垂直通道连接器 | 连接上下层区域 | 间距 = 跳跃高度 * 0.6 ~ 0.8 |
| 安全着陆点 | 跳跃挑战中间的休息区 | 宽度 >= 100px |
| 快速下撤通道 | 玩家需要快速到达下方 | 配合 dropThroughEvent |
| 可选捷径 | 从下方跳上去是捷径 | 放在稍隐蔽的位置 |

### 单向平台 vs 实心平台的选择

| 场景 | 推荐类型 | 原因 |
|------|---------|------|
| 地面/关卡底部 | StaticPlatform | 不应该能穿过地面 |
| 垂直向上的路径 | OneWayPlatform | 允许从下方跳上 |
| 狭窄水平通道 | StaticPlatform | 需要顶部碰撞阻挡 |
| 树冠/悬崖 | OneWayPlatform | 视觉上像是可以从下方穿过的表面 |
| 电梯井墙壁 | StaticPlatform | 作为墙壁使用 |

### Drop-Through 的输入设计

| 操作 | 事件 | 体验 | 参考游戏 |
|------|------|------|----------|
| 下+跳 | 需要同时按下和跳跃键 | 最传统 | Super Mario Bros |
| 仅按下 | 单独下方向输入 | 简单直接 | Hollow Knight |
| 下滑触摸 | `input:touch:swipe:down` | 移动端友好 | — |

### 平台间距设计（单向平台特有）

由于单向平台可以从下方跳上，垂直间距设计比实心平台更灵活：

```
向上跳跃间距: 跳跃高度 * 0.5 ~ 0.9（比实心平台可以更大）
向下穿越间距: 至少 30px（让 drop-through 穿过后有明显位移）
```

### 画布分辨率适配

| 画布 (WxH) | 推荐单向平台宽度 | 推荐垂直间距 | 说明 |
|------------|----------------|-------------|------|
| 1080x1920 | 120 ~ 300 | 80 ~ 140 | 竖屏，纵向空间大 |
| 1280x720 | 100 ~ 250 | 60 ~ 100 | 横屏标准 |
| 800x600 | 80 ~ 200 | 50 ~ 80 | 小画布 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `platform:land` | `PLATFORM_LAND` | `{ id: string, index: number, x: number, y: number }` | checkLanding() 检测到着陆时 |
| `platform:drop` | `PLATFORM_DROP` | `{ id: string }` | 收到 dropThroughEvent 时 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `{dropThroughEvent}` | 启动 drop-through 状态（dropping = true，250ms 后恢复） |
| `gameflow:resume` | 恢复更新 |
| `gameflow:pause` | 暂停更新 |

### 事件流转示意

```
着陆流程:
  渲染器 每帧调用:
    oneWayPlatform.checkLanding(playerX, playerY, velocityY)
      → velocityY > 0 && 位置穿过平台表面
        → emit('platform:land', { id, index, x, y })
          → 渲染器: 设置玩家 y = platform.y，标记 grounded
          → Gravity: 更新 floorY
          → Jump: 更新 groundY，标记 grounded
      → 返回 LandingResult

下穿流程:
  用户输入 → emit(dropThroughEvent)
    → OneWayPlatform 设置 dropping = true
    → emit('platform:drop', { id })
      → 渲染器: 标记玩家为 airborne
      → Gravity: 开始对玩家施加重力
    → 250ms 后: dropping = false（恢复着陆检测）
```

## 跨模块联动规则

### 与 Gravity 模块

- 单向平台着陆时需要更新 Gravity 的 floorY
- Drop-through 后需要将 Gravity 对象标记为 airborne
- **注意**: checkLanding 的 velocityY 参数应来自 Gravity 对象的 velocityY（或渲染器计算的每帧 Y 位移）

### 与 Jump 模块

- 在单向平台上起跳时，Jump 行为正常（velocityY 变为负值，向上运动不被平台阻挡）
- 落回平台时，需要调用 checkLanding 检测着陆
- **CoyoteTime 配合**: 从单向平台边缘走下时，CoyoteTime 应给予 coyote window
- **Drop-Through + Jump 冲突**: 如果 dropThroughEvent 和 Jump.triggerEvent 是同一事件（如按下+跳），需要确保先处理 drop 再处理 jump

### 与 StaticPlatform 模块

- 单向平台和实心平台可以在同一关卡中混用
- 碰撞检测时先检查 StaticPlatform（实心阻挡优先），再检查 OneWayPlatform
- 不要将单向平台和实心平台放在相同位置

### 与 PlayerMovement 模块

- PlayerMovement 的水平移动不受单向平台影响（单向平台没有侧面碰撞）
- 玩家可以自由左右移动穿过单向平台的任何位置
- 只有 Y 轴方向的穿过/着陆受到检测

### 与 CoyoteTime 模块

- 从单向平台边缘走下时应触发 coyote time
- CoyoteTime 监听 `gravity:falling`，与平台类型无关
- **建议**: coyote time 的 window 适用于所有平台类型

### 与 CrumblingPlatform 模块

- 碎裂平台可以同时是单向的（从下方跳上后开始碎裂）
- 当前实现中两者是独立模块，如需组合，需要在同一位置放置两种平台并协调碰撞检测

## 输入适配

### dropThroughEvent 适配

| 输入方式 | 推荐 dropThroughEvent | 说明 |
|----------|---------------------|------|
| TouchInput | `input:touch:swipe:down` | 向下滑动穿过平台，最直觉 |
| TouchInput | `input:touch:hold` + 下半屏检测 | 需要自定义事件组合 |
| FaceInput | `input:face:nod` | 低头点头穿过 |
| HandInput | `input:hand:gesture:down` | 手势向下 |
| DeviceInput | `input:device:tilt` (tiltY > 0.5) | 倾斜手机向下 |

**特别注意**: dropThroughEvent 如果设为空字符串，则不注册监听器——玩家只能着陆不能下穿。这对某些关卡设计可能是有意的（单向平台作为不可返回的进度标记）。

### 平台宽度与输入精度

| 输入方式 | 最小推荐平台宽度 | 原因 |
|----------|----------------|------|
| TouchInput | 80px | 触摸精确 |
| FaceInput | 140px | 追踪有延迟 |
| HandInput | 120px | 中等精度 |
| DeviceInput | 160px | 倾斜控制不够精确 |

## 常见 Anti-Pattern

**velocityY 传入错误的值**
- 错误: 传入速度 (px/s) 而非帧位移量 (px/frame) → 检测范围过大，提前触发着陆
- 正确: `velocityY = Gravity.velocityY * dtSec`（每帧实际位移量）
- 或者如果 Gravity 对象的 velocityY 已经是 px/frame 单位，直接使用

**dropThroughEvent 为空但关卡需要向下移动**
- 错误: 关卡有向下的路径但没有配置 dropThroughEvent → 玩家被困在单向平台上方
- 正确: 设置 dropThroughEvent 或提供绕行路径

**250ms drop-through 时间太短**
- 已知情况: 如果玩家在平台顶部触发 drop-through，250ms 后恢复着陆检测时玩家可能还在平台 Y 附近 → 立即重新着陆
- 缓解: 确保平台垂直间距 > 30px，让玩家在 250ms 内有足够位移

**单向平台作为地面使用**
- 错误: 关卡最底部使用 OneWayPlatform → 玩家可以 drop-through 穿过"地面"掉出画布
- 正确: 地面始终用 StaticPlatform

**checkLanding 在 velocityY = 0 时不触发**
- 当 `velocityY <= 0` 时返回 null，包括 velocityY 精确等于 0 的情况
- 如果角色以 0 速度水平移动到平台上方，不会着陆
- 只有下落运动才会触发着陆

## 常见问题 & 边界情况

- `checkLanding()` 是被动方法，需要外部每帧主动调用
- OneWayPlatformDef 没有 height——平台被视为无厚度的线段
- `platform:land` 事件在每次检测到着陆时都发出（不缓存上次状态）
- `dropping` 状态是全局的——一次 drop-through 影响所有单向平台，玩家穿过当前平台后 250ms 内不会着陆在任何单向平台上
- `dropTimer` 使用毫秒 (dt 直接累加)，但比较阈值是硬编码 250ms（不可配置）
- `reset()` 清除 dropping 状态和 dropTimer
- 不支持有角度的单向平台（仅水平）
- 不支持从侧面着陆（严格只检测从上到下的穿越）
- `py + velocityY >= p.y` 中的 velocityY 如果极大（高速下落），可能跳过多个平台，只会着陆在第一个检测到的平台上
- platforms 数组在运行时不可动态修改
