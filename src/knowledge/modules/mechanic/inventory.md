# Inventory — 背包/资源追踪模块

## 基本信息
- 类型: mechanic
- 类名: `Inventory`
- 注册名: `Inventory`
- 文件: `src/engine/modules/mechanic/inventory.ts`
- 依赖: 无（requires: []）
- 可选联动: Collectible, Scorer, PowerUp, UIOverlay, GameFlow

## 功能原理

Inventory 管理玩家的资源（金币、宝石、钥匙等）。模块是纯事件驱动的（`update()` 为空操作），通过监听可配置的追踪事件（默认 `collectible:pickup`）自动累加资源，也提供手动 `add()` / `spend()` API。

**工作流程：**
1. `init()` 时从 `params.resources` 初始化每种资源的数量（`ResourceDef.initial`）
2. 监听 `params.trackEvent`（默认 `collectible:pickup`）事件
3. 收到事件时，提取 `data.type`（资源名）和 `data.value`（数量），调用 `add()`
4. `add()` 将数量 clamp 到 `[0, def.max]` → 发出 `inventory:change`
5. 当数量达到 `def.max` 时额外发出 `inventory:full`
6. `spend()` 检查余额是否足够 → 扣除 → 发出 `inventory:change`；不足时返回 false

**背包系统设计分类（游戏设计最佳实践）：**

| 模式 | 特点 | 经典案例 | 当前支持 |
|------|------|---------|---------|
| 简单计数器 | 每种资源一个数字 | Mario 金币、Sonic 金环 | 是（当前实现） |
| 槽位背包 | 固定格数，每格放一种物品 | Minecraft、Terraria | 否（需扩展） |
| 重量背包 | 总重量限制 | Diablo、Skyrim | 否（需扩展） |
| 无限存储 | 无上限 | 休闲/idle 游戏 | 是（max 设很大即可） |
| 自动消耗 | 收集即消耗（如直接加分） | Temple Run | 是（通过 Scorer 旁路） |

**当前实现**: 简单计数器模式——每种资源有独立的 name、max、initial，通过 Map<string, number> 追踪数量。适合 platformer/runner 的通货和钥匙系统。

**事件驱动架构的优势（参考 EDA 设计模式）：**

| 特点 | 说明 |
|------|------|
| 松耦合 | Inventory 不直接引用 Collectible，通过事件通信 |
| 可扩展 | 修改 trackEvent 即可追踪任何事件来源 |
| 可测试 | 直接 emit 事件即可测试，不需要 Collectible 实例 |
| 零帧开销 | update() 为空，仅在事件发生时执行逻辑 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| resources | object (ResourceDef[]) | `[]` | — | 至少 1 个 | 资源类型定义数组 |
| trackEvent | string | `'collectible:pickup'` | 任意事件名 | `collectible:pickup` | 自动追踪的事件名 |

### ResourceDef 结构

| 字段 | 类型 | 必填 | 有效范围 | 说明 |
|------|------|------|----------|------|
| name | string | 是 | 与 Collectible.type 匹配 | 资源标识符（如 `'coin'`, `'gem'`, `'key'`） |
| max | number | 是 | 1 ~ 99999 | 该资源的最大持有量 |
| initial | number | 是 | 0 ~ max | 游戏开始时的初始数量 |

### 不同游戏类型的参数推荐

| 游戏类型 | resources 配置 | trackEvent | 设计理由 |
|----------|---------------|------------|---------|
| platformer（标准） | `[{name:'coin', max:999, initial:0}, {name:'key', max:5, initial:0}]` | `collectible:pickup` | 通货+钥匙双资源 |
| platformer（简单） | `[{name:'coin', max:100, initial:0}]` | `collectible:pickup` | 仅通货 |
| runner | `[{name:'coin', max:9999, initial:0}]` | `collectible:pickup` | 跑酷大量金币 |
| runner（商店） | `[{name:'coin', max:9999, initial:0}, {name:'gem', max:100, initial:0}]` | `collectible:pickup` | 双通货系统 |
| catch | `[{name:'score', max:99999, initial:0}]` | `collision:hit` | 用 Inventory 追踪得分（替代 Scorer） |
| 自定义 | — | 任意事件名 | trackEvent 可配置为任何事件 |

### 经典游戏资源系统参考

| 游戏 | 资源类型 | max 设定 | 消耗用途 |
|------|---------|---------|---------|
| Mario | 金币(100→1UP) | 100 | 每 100 个自动兑换 1 条命 |
| Sonic | 金环(50/100=1UP) | 999 | 被伤害时全部散落 |
| Hollow Knight | Geo(通货) | 9999 | 购买道具/升级 |
| Celeste | 草莓(成就) | 175 | 纯收集成就，无消耗 |
| Mega Man | E罐/W罐 | 4/4 | 手动使用回复 HP/WP |
| Metroid | 导弹/超级导弹 | 255/50 | 消耗型武器弹药 |

## 参数调优指南

### max 的设定策略

```
max = 关卡内可获取总量 * 1.2 ~ 1.5（留安全余量）
```

| 场景 | max 推荐 | 理由 |
|------|---------|------|
| 单关卡内消耗 | 实际需要量 * 2 | 允许屯积但不无限 |
| 跨关卡累积 | 99 / 999 / 9999 | 经典游戏常见上限 |
| 纯计数（不消耗） | 99999 | 足够大即可 |
| 钥匙/特殊道具 | 实际关卡需要量 | 如关卡有 3 把锁，max=5 |

### initial 的设定策略

| 场景 | initial | 理由 |
|------|---------|------|
| 新游戏开始 | 0 | 从零开始收集 |
| 教程/引导关 | 部分填充 | 让玩家体验消耗机制 |
| 跨关卡继承 | 上一关结束时的数量 | 需上层逻辑实现 |

### trackEvent 的灵活配置

Inventory 的 trackEvent 可以追踪任何事件，只要事件数据包含 `type` 和 `value` 字段：

| trackEvent | 事件来源 | 数据格式 | 适用场景 |
|------------|---------|---------|---------|
| `collectible:pickup` (默认) | Collectible | `{ type, value, x, y }` | platformer/runner |
| `collision:hit` | Collision | `{ objectA, objectB, targetId }` | 需要上层补充 type/value |
| `scorer:update` | Scorer | `{ score, delta }` | 追踪得分变化 |
| `custom:reward` | 自定义 | `{ type, value }` | 自定义奖励系统 |

### spend() 的应用场景

| 消耗场景 | 实现方式 |
|----------|---------|
| 开门（钥匙） | `inventory.spend('key', 1)` — 返回 true 则开门 |
| 购买道具 | `inventory.spend('coin', 100)` — 余额不足返回 false |
| 使用技能 | `inventory.spend('mana', 30)` — 蓝量不足无法使用 |
| 升级 | `inventory.spend('gem', 50)` — 宝石不足无法升级 |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `inventory:change` | `INVENTORY_CHANGE` | `{ resource: string, amount: number, total: number }` | 资源数量变化时（增/减） |
| `inventory:full` | `INVENTORY_FULL` | `{ resource: string }` | 某种资源达到 max 上限时 |

**注意**: `amount` 在 add 时为正数，在 spend 时为负数。`total` 为变化后的当前持有量。

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `{trackEvent}` | — | 提取 data.type 和 data.value → 调用 add() |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[收集链路 — Collectible → Inventory]
collectible:pickup { type: 'coin', value: 10, ... }
  → Inventory 监听 (trackEvent = 'collectible:pickup'):
    → data.type = 'coin', data.value = 10
    → add('coin', 10)
      → current: 40 + 10 = 50, max: 999
      → amounts.set('coin', 50)
      → emit('inventory:change', { resource: 'coin', amount: 10, total: 50 })
        → UIOverlay: 更新 HUD 金币显示 "50"
        → ParticleVFX: 可选 — 金币数字飞入 HUD 动画

[满额链路]
add('key', 1)
  → current: 4 + 1 = 5, max: 5
  → amounts.set('key', 5)
  → emit('inventory:change', { resource: 'key', amount: 1, total: 5 })
  → total >= max:
    → emit('inventory:full', { resource: 'key' })
      → UIOverlay: 显示 "钥匙已满" 提示
      → GameFlow: 可选 — 全部钥匙收集完毕触发特殊事件

[消耗链路]
spend('key', 1)
  → current: 5, amount: 1, current >= amount → true
  → amounts.set('key', 4)
  → emit('inventory:change', { resource: 'key', amount: -1, total: 4 })
    → UIOverlay: 更新 HUD 钥匙显示 "4"
  → return true

[消耗失败链路]
spend('key', 3)
  → current: 2, amount: 3, current < amount → false
  → 不修改任何状态，不发出任何事件
  → return false
    → 上层逻辑: 显示 "钥匙不足" 提示
```

## 跨模块联动规则

### Inventory + Collectible（核心联动 — 事件追踪）

Inventory 通过 trackEvent 自动追踪 Collectible 的拾取事件。这是最主要的联动方式。

**关键协调点：**

| 配置 | Collectible 侧 | Inventory 侧 | 匹配要求 |
|------|----------------|--------------|---------|
| 事件名 | emit `collectible:pickup` | trackEvent = `collectible:pickup` | 必须一致 |
| 类型标识 | CollectibleDef.type = `'coin'` | ResourceDef.name = `'coin'` | 必须完全匹配（大小写敏感） |
| 数值 | CollectibleDef.value = 10 | ResourceDef.max = 999 | value 不应 > max |

**多类型收集品的配置示例：**

```
Collectible.items = [
  { x:100, y:200, value:10, type:'coin' },
  { x:300, y:200, value:50, type:'gem' },
  { x:500, y:200, value:1, type:'key' },
]

Inventory.resources = [
  { name:'coin', max:999, initial:0 },
  { name:'gem', max:100, initial:0 },
  { name:'key', max:5, initial:0 },
]
```

### Inventory + Scorer（双系统协调）

Collectible → Inventory 追踪资源数量，Scorer 追踪分数。两者可独立运行：

| 场景 | Inventory 用途 | Scorer 用途 | 关系 |
|------|---------------|------------|------|
| 金币收集 | 追踪金币数量（可消耗） | 追踪总分 | 并行 |
| 钥匙收集 | 追踪钥匙数量（用于开门） | 不计分 | 独立 |
| 宝石收集 | 追踪宝石数量 | 宝石值×倍率=分数 | 各自计算 |

### Inventory + PowerUp（消耗型增益）

PowerUp 的增益道具可以通过 Inventory 管理使用次数：
- 拾取 power-up → Inventory.add('shield', 1)
- 使用 power-up → Inventory.spend('shield', 1) → PowerUp.activate()
- **当前实现**: PowerUp 不通过 Inventory 管理，直接激活

### Inventory + GameFlow（资源达成条件）

- `inventory:full` 事件可触发关卡完成或特殊事件
- 例如: "收集全部 3 把钥匙" → `inventory:full { resource: 'key' }` → GameFlow.transition('finished')

### Inventory + UIOverlay（HUD 显示）

- `inventory:change` → UIOverlay 更新对应资源的 HUD 显示
- 建议 HUD 显示格式: 图标 + 数字（如金币图标 + "42"）
- `inventory:full` → 可选高亮/闪烁效果

## 输入适配

Inventory 本身不依赖输入方式——它是纯事件驱动的。但间接受输入精度影响（收集效率取决于玩家控制精度）：

| 输入方式 | 间接影响 | 建议 |
|----------|---------|------|
| TouchInput | 精确控制 → 收集效率高 | 标准 resource 配置 |
| FaceInput | 追踪延迟 → 可能漏收 | 增加收集品密度或放大碰撞范围 |
| HandInput | 边缘抖动 → 收集不稳定 | 放大收集品碰撞范围 |
| DeviceInput | 陀螺仪漂移 → 收集精度低 | 降低收集品密度要求或增大碰撞半径 |
| AudioInput | 不适用 | — |

## 常见 Anti-Pattern

**resources 为空数组但添加了 Inventory 模块**
- 错误: `resources: []` → 收到 trackEvent 时 find(def) 返回 undefined → 所有 add 操作被忽略
- 正确: 至少定义 1 种资源；不需要资源追踪就不要添加 Inventory 模块

**trackEvent 拼写错误导致 Inventory 无响应**
- 错误: `trackEvent: 'collectible:pickedup'`（拼写错误）→ 永远收不到事件
- 正确: 默认值 `collectible:pickup` 与 Collectible 发出的事件名一致

**ResourceDef.name 与 CollectibleDef.type 大小写不一致**
- 错误: Collectible 用 `type: 'Coin'`，Inventory 用 `name: 'coin'` → 匹配失败
- 正确: 统一使用小写标识符

**initial > max 导致初始状态不一致**
- 错误: `{ name: 'key', max: 3, initial: 5 }` → 初始值 5 但 max 为 3
- 正确: 确保 `initial <= max`；当前实现不检查此约束，initial 可以超过 max（但后续 add 不会超过 max）

**多次 reset 后 amounts 与 initial 不同步**
- 错误: 修改了 params.resources 但未重新 init → reset() 使用旧的 resources
- 正确: reset() 从 `getResources()` 重新读取当前 params，可以正常工作

**spend 返回 false 时未向用户反馈**
- 错误: spend 失败后静默 → 玩家不知道为什么无法开门/购买
- 正确: spend 返回 false 时上层应显示 "资源不足" 提示

**期望 spend 自动触发效果**
- 错误: 调用 spend 后期望自动触发开门动画 → spend 只改数字不触发额外效果
- 正确: spend 返回 true 后，由上层逻辑触发相应效果（开门动画、使用道具等）

## 常见问题 & 边界情况

- `add()` 自动 clamp 到 `def.max`，不会超过上限
- `add()` 对未定义的资源名直接返回，不发出任何事件
- `spend()` 余额不足时返回 false，不修改状态，不发出事件
- `spend()` 余额足够时扣除后可以为 0，不会为负数
- `getAmount()` 对未定义的资源名返回 0
- `inventory:change` 在 add 和 spend 时都会发出，amount 分别为正数和负数
- `inventory:full` 仅在 `total >= max` 时发出（包括刚好到达和已经到达后再 add）
- `reset()` 调用 `initializeAmounts()` 重新读取 resources 并设为 initial，不发出任何事件
- `update()` 为空操作，模块完全事件驱动，不消耗帧时间
- getDependencies() 返回 `{ requires: [], optional: ['Collectible'] }`
- trackEvent 在 `init()` 中通过 `this.on()` 绑定，仅在引擎初始化后生效
- 如果 trackEvent 对应的事件数据缺少 `type` 或 `value` 字段，add 不执行（data?.type 和 data?.value != null 检查）
- 同一个 trackEvent 事件触发时，Inventory 只执行一次 add（不会重复处理）
- `amounts` 使用 Map<string, number>，资源名是大小写敏感的
