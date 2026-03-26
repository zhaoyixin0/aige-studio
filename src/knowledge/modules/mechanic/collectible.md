# Collectible — 收集物模块

## 基本信息
- 类型: mechanic
- 类名: `Collectible`
- 注册名: `Collectible`
- 文件: `src/engine/modules/mechanic/collectible.ts`
- 依赖: 无（独立运行）
- 可选联动: Collision, Inventory, Scorer, PowerUp, ComboSystem, UIOverlay, ParticleVFX, SoundFX

## 功能原理

Collectible 管理关卡中的静态收集品（金币、宝石、钥匙等）。与 Spawner 生成的临时物体不同，Collectible 的物品在关卡加载时就确定位置，收集后从活跃列表中移除。

**工作流程：**
1. `init()` 时从 `params.items` 加载 `CollectibleDef[]`（每个包含 x, y, value, type）
2. 每帧 `update(dt)` 累加 `elapsed` 用于浮动动画计算
3. `checkCollision(px, py, radius)` 检测玩家与所有未收集物品的圆形碰撞（阈值 = radius + 16px）
4. 碰撞触发 `pickup(index)` → 标记已收集 → 发出 `collectible:pickup` 事件
5. 全部收集时额外发出 `collectible:allCollected` 事件
6. `getItemPositions()` 返回未收集物品的渲染位置（含浮动偏移 displayY）

**收集品设计分类（游戏设计最佳实践）：**

| 类型 | 经典案例 | 功能 | 适用场景 |
|------|---------|------|---------|
| 通货（Currency） | Mario 金币、Sonic 金环 | 积分/累计计数 | 所有平台游戏 |
| 钥匙（Key） | Zelda 小钥匙、Metroid 能量罐 | 解锁门/区域 | 探索型平台 |
| 宝石（Gem） | Crash Bandicoot 水晶 | 关卡完成度 | 收集驱动 |
| 星星（Star） | Mario 64 力量之星 | 主线进度 | 开放世界平台 |
| 生命回复（Health） | Hollow Knight 灵魂、Mega Man E罐 | 恢复生命值 | 动作平台 |
| 增益道具（Power-Up） | Mario 蘑菇/星星 | 临时增益 | 动作/跑酷 |

**收集品放置设计原则（参考 Mario/Celeste/Hollow Knight 关卡设计）：**

| 原则 | 说明 |
|------|------|
| 路径引导（Breadcrumb Trail） | 用收集品线引导玩家前进方向 |
| 风险-收益权衡 | 高价值收集品放在危险区域（靠近 Hazard/深渊边缘） |
| 探索奖励 | 隐藏收集品奖励偏离主路线的玩家 |
| 视觉层级 | 不同稀有度用不同颜色/大小/动画强度区分 |
| 节奏调控 | 密集放置 → 爽快感；稀疏放置 → 探索感 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| items | object (CollectibleDef[]) | `[]` | — | 至少 1 个 | 收集品定义数组 |
| layer | string | `'collectibles'` | 任意图层名 | `collectibles` | 碰撞/渲染图层名 |
| asset | asset | `''` | — | — | 收集品素材 |
| floatAnimation | boolean | `true` | true / false | true | 是否启用浮动动画 |

### CollectibleDef 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| x | number | 是 | 收集品 X 坐标（px） |
| y | number | 是 | 收集品 Y 坐标（px） |
| value | number | 是 | 收集价值（传递给 Inventory/Scorer） |
| type | string | 是 | 收集品类型标识（如 `'coin'`, `'gem'`, `'key'`） |

### 浮动动画参数

当 `floatAnimation: true` 时，收集品上下浮动：

```
displayY = y + sin(elapsed / 500 + index) * 6
```

| 参数 | 值 | 效果 |
|------|-----|------|
| 振幅 | 6px（硬编码） | 上下浮动范围 = 12px |
| 频率基准 | elapsed / 500 | 每 3.14 秒一个完整周期 |
| 相位偏移 | + index | 相邻物品浮动错开，避免整齐划一 |

### 碰撞检测参数

```
碰撞阈值 = playerRadius + 16px（硬编码偏移）
```

16px 偏移起到**隐式磁铁效果**——玩家不需要精确对准收集品中心就能拾取。

| playerRadius | 有效拾取半径 | 手感 |
|-------------|-------------|------|
| 10px | 26px | 较宽容 |
| 16px | 32px | 标准 |
| 24px | 40px | 非常宽容 |

### 不同游戏类型的参数推荐

| 游戏类型 | items 数量/关 | type 分布 | floatAnimation | 设计理由 |
|----------|-------------|-----------|----------------|---------|
| platformer（标准） | 10 ~ 30 | coin:80% gem:15% key:5% | true | 经典收集品分布 |
| platformer（探索型） | 20 ~ 50 | coin:60% gem:20% star:10% key:10% | true | 更多类型激励探索 |
| platformer（一碰即死） | 5 ~ 15 | coin:100% | true | 少量收集品，每个都有意义 |
| runner | 15 ~ 40 | coin:90% gem:10% | true | 大量通货，少量稀有品 |
| catch（扩展用法） | — | — | — | catch 类通常用 Spawner 而非 Collectible |

### 经典游戏收集品参考

| 游戏 | 通货 | 稀有品 | 特殊品 | value 分布 |
|------|------|--------|--------|-----------|
| Mario | 金币(1) | 红金币(5) | 1UP(命) | 1:5:特殊 |
| Sonic | 金环(1) | — | 混沌宝石(关键) | 1:关键 |
| Crash Bandicoot | 苹果(1) | 水晶(关卡完成) | 宝石(100%完成) | 1:完成:完美 |
| Celeste | 草莓(1) | 翅膀草莓(特殊) | 月之莓(隐藏) | 1:特殊:隐藏 |
| Hollow Knight | Geo(1~25) | 苍白矿石(关键升级) | 护符(装备) | 1~25:关键:装备 |

## 参数调优指南

### items 数量与关卡长度的关系

```
收集品密度 = items数量 / 关卡长度(px)
推荐密度 = 1 / 200 ~ 1 / 400 (每 200~400px 一个收集品)
```

- 密集 (1/100): 连续拾取快感，适合简单路径
- 标准 (1/200~300): 引导性好，适合多数场景
- 稀疏 (1/400+): 每个收集品都是惊喜，适合探索型

### value 与 Scorer 的配合

收集品的 value 通过 `collectible:pickup` 事件传递给 Inventory。如果同时使用 Scorer，需要确保两个系统的计分逻辑不冲突：

- **方案 A（推荐）**: Collectible → Inventory 追踪资源，Scorer 通过 collision:hit 计分，两者独立
- **方案 B**: Collectible → Inventory 追踪资源 + 计分（Scorer 不监听 collectible 事件）
- **方案 C**: 不用 Inventory，Collectible → Scorer 直接计分

### floatAnimation 的开关时机

| 场景 | floatAnimation | 理由 |
|------|----------------|------|
| 平台跳跃 | true | 浮动吸引注意力，与平台形成层次感 |
| 快节奏 runner | true | 浮动在高速移动中帮助玩家发现收集品 |
| AR/世界交互 | false | AR 场景需要物体固定在现实世界表面 |
| 大量收集品 (50+) | false 或考虑性能 | 50+ 个 sin() 计算可能有轻微性能影响 |

### 碰撞半径的隐式磁铁效果

当前 `+16px` 偏移是硬编码的。如果需要更强/更弱的磁铁效果：

| 磁铁强度 | 实现方式 | 效果 |
|----------|---------|------|
| 无磁铁 | 需修改代码去掉 +16 | 必须精确接触 |
| 弱磁铁（当前） | +16px 偏移 | 接近即拾取 |
| 强磁铁（如 Temple Run） | 需扩展 attractRadius 参数 | 远距离自动吸引 |

**Temple Run/Subway Surfers 磁铁设计参考：**
- Subway Surfers 的 Coin Magnet power-up 可吸引全部三条跑道的金币
- 默认持续时间约 5~10 秒，可升级至 30 秒
- 实现方式: 激活时将所有收集品的有效碰撞半径扩大到整个屏幕宽度

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `collectible:pickup` | `COLLECTIBLE_PICKUP` | `{ index: number, type: string, value: number, x: number, y: number }` | 单个收集品被拾取时 |
| `collectible:allCollected` | `COLLECTIBLE_ALL_COLLECTED` | （无数据） | 所有收集品全部拾取完毕时 |

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

**注意**: 当前实现中 Collectible 不监听 collision 事件——碰撞检测由外部代码调用 `checkCollision()` 或 `pickup()` 完成。

### 完整事件链路

```
[拾取链路 — platformer/runner]
外部每帧调用 collectible.checkCollision(playerX, playerY, playerRadius)
  → 距离 < radius + 16:
    → pickup(index)
      → emit('collectible:pickup', { index, type, value, x, y })
        → Inventory 监听(trackEvent='collectible:pickup'): add(type, value) → inventory:change
        → Scorer 监听(通过 collision:hit 或上层转发): 加分 → scorer:update
        → ParticleVFX: 在 (x, y) 播放拾取特效（sparkle）
        → SoundFX: 播放拾取音效（ding）
        → UIOverlay: 更新 HUD 收集品计数
      → 若全部收集:
        → emit('collectible:allCollected')
          → GameFlow: 可选触发关卡完成
          → UIOverlay: 显示 "全部收集" 提示
          → ParticleVFX: 播放全收集庆祝特效

[Collision 模块辅助链路（通过 AutoWirer 连线）]
Collectible 注册碰撞体到 Collision(collectibles 层)
  → Collision 检测 player 层 vs collectibles 层
  → collision:hit { objectA, objectB, targetId }
  → 上层逻辑调用 collectible.pickup(对应 index)
```

## 跨模块联动规则

### Collectible + Collision 的碰撞注册（核心联动）

Collectible 有两种碰撞检测路径：

**路径 1 — 内置 `checkCollision()`（当前主要方式）：**
- 外部代码（渲染器）每帧调用 `checkCollision(px, py, radius)`
- 优点: 简单，不需要 Collision 模块
- 缺点: 不与其他碰撞规则统一

**路径 2 — 通过 Collision 模块（AutoWirer 连线）：**
- Collectible 的 items 注册到 Collision 的 `collectibles` 图层
- Collision 规则: `{ a: 'player', b: 'collectibles', event: 'hit', destroy: ['b'] }`
- 优点: 统一碰撞系统，支持 destroy 配置
- 缺点: 需要额外连线逻辑

**推荐**: platformer 类游戏优先使用路径 2（统一碰撞系统），简单场景可用路径 1。

### Collectible + Inventory（资源追踪联动）

```
Collectible                           Inventory
emit('collectible:pickup',            on('collectible:pickup', data => {
  { type: 'coin', value: 10 })          add(data.type, data.value)
                                      })
```

**关键协调点：**

| 问题 | 解决方案 |
|------|---------|
| Inventory.trackEvent 与 Collectible 事件不匹配 | Inventory 默认 trackEvent = `collectible:pickup`，与 Collectible 发出的事件一致 |
| Collectible.type 与 Inventory.resources.name 不匹配 | 确保 CollectibleDef.type 与 ResourceDef.name 使用相同的标识符（如都用 `'coin'`） |
| value 超出 Inventory.max | Inventory 自动 clamp 到 max，不会溢出 |
| Inventory 没有对应资源定义 | Inventory.add() 找不到 def 时直接返回，value 丢失 |

### Collectible + Scorer（计分联动）

当前 Collectible 不直接与 Scorer 通信。两种集成方式：

**方式 A — 通过 Collision 模块间接计分：**
- Collision 的 `collision:hit` 事件同时被 Scorer 和 Collectible 处理
- Scorer 配置: `{ scorePerHit: value }`

**方式 B — 上层转发：**
- 监听 `collectible:pickup` → 转发为 Scorer 理解的计分事件

### Collectible + PowerUp（增益道具联动）

收集品中可以包含 power-up 道具：
- CollectibleDef.type = `'powerup'`
- 拾取时 `collectible:pickup` 事件中的 type 传递给 PowerUp
- PowerUp 监听此事件并检查 data.type（需上层协调 powerUpType 字段）

### Collectible + ComboSystem（连击联动）

- 快速连续拾取收集品可触发 combo
- ComboSystem 监听 `collectible:pickup` 事件计算连击
- 连击倍率传递给 Scorer 增加得分

### 与 CameraFollow 的关系

- 收集品位置是世界坐标，渲染时需要减去 CameraFollow 的 offset
- `getItemPositions()` 返回世界坐标，渲染层负责坐标转换

### 与 GameFlow 的关系

- `collectible:allCollected` 可作为关卡完成条件
- GameFlow 监听此事件 → `transition('finished')`
- 适用于 "收集全部N个星星过关" 的关卡设计

## 输入适配

Collectible 本身不直接依赖输入方式，但间接受玩家位置精度影响（输入精度影响 `checkCollision` 的命中率）：

| 输入方式 | 碰撞半径调整建议 | 理由 |
|----------|----------------|------|
| TouchInput | 标准（+16px 偏移足够） | 触摸精度高 |
| FaceInput | 建议增大偏移至 +24px | 面部追踪延迟导致位置滞后 |
| HandInput | 建议增大偏移至 +20px | 手势追踪边缘抖动 |
| DeviceInput | 建议增大偏移至 +24px | 陀螺仪漂移导致精度下降 |
| AudioInput | 不适用 | 声音输入不直接控制位置 |

## 常见 Anti-Pattern

**items 为空数组但添加了 Collectible 模块**
- 错误: `items: []` → 模块存在但无收集品 → `collectible:allCollected` 在 init 后立即触发（collected.size === 0 === items.length）
- 正确: 不需要收集品就不要添加 Collectible 模块；或确保 items 至少有 1 个

**CollectibleDef.type 与 Inventory.resources.name 不匹配**
- 错误: Collectible 用 `type: 'gold_coin'` 但 Inventory 用 `name: 'gold'` → Inventory.add() 找不到资源定义，value 丢失
- 正确: 确保两侧使用完全相同的标识符

**重复调用 checkCollision 导致同一帧多次检测**
- 错误: 渲染循环和物理循环各调用一次 checkCollision → 性能浪费
- 正确: 每帧只调用一次 checkCollision

**floatAnimation 开启但帧率低导致动画抖动**
- 错误: dt 波动大 → elapsed 增长不均匀 → sin 曲线采样跳跃 → 浮动看起来抽搐
- 正确: floatAnimation 使用 elapsed（累积时间）而非 dt，已经天然平滑。真正的问题是帧率极低（< 15fps）时视觉上不流畅

**收集品放置在画布外或平台内部**
- 错误: x/y 坐标超出关卡范围 → 玩家永远无法到达 → `allCollected` 永远不触发
- 正确: 确保所有收集品位于玩家可达区域

**忘记 reset() 导致重启后收集品不重现**
- 错误: 游戏重启时未调用 collectible.reset() → collected Set 仍有之前的记录 → 收集品不重新出现
- 正确: GameFlow 重启时确保所有模块同步 reset（Engine 通常自动处理）

## 常见问题 & 边界情况

- `pickup(index)` 对已收集的 index 直接返回（幂等），不会重复发出事件
- `pickup(index)` 对越界 index（< 0 或 >= items.length）直接返回，无副作用
- `checkCollision()` 在一次调用中可能拾取多个物品（如果玩家同时在多个物品的碰撞范围内）
- `getActiveItems()` 返回过滤后的新数组，外部修改不影响内部状态
- `getItemPositions()` 返回新数组和新对象，包含 `displayY`（渲染用）和 `y`（逻辑用）
- `items` 参数为非数组时，`getItems()` 返回 `[]`（防御性编程）
- `reset()` 清空 `collected` Set 和 `elapsed`，不发出任何事件
- `gameflowPaused` 时 `update()` 不执行 → 浮动动画暂停
- 碰撞阈值的 +16px 是硬编码的，不可通过参数调整
- 浮动动画的振幅（6px）和频率（1/500）是硬编码的，不可通过参数调整
- `collectible:allCollected` 在 `collected.size === items.length` 时触发——如果 items 为空数组，首次 pickup 无效但不会误触发（因为 pickup 会先检查 index 有效性）
- getDependencies() 未覆写 → 默认 requires: [], optional: []
- Collectible 没有 destroy 逻辑——收集品只是从活跃列表移除，不从任何碰撞系统注销（如果使用 Collision 模块路径，需要上层处理）
