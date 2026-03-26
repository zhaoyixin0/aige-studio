# ParticleVFX — 粒子特效模块

## 基本信息
- 类型: feedback
- 类名: ParticleVFX
- 注册名: `ParticleVFX`

## 功能原理

ParticleVFX 将游戏事件映射为粒子特效。通过 events 参数配置事件名到特效的映射关系：当指定事件被触发时，创建一个粒子效果实例。每个粒子有生命周期（duration），超过生命周期后自动移除。渲染层读取 `getActiveParticles()` 获取当前活跃的粒子列表进行绘制。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| events | object | `{}` | — | 事件→特效映射表 |

### 特效配置结构 (ParticleConfig)

| 字段 | 类型 | 说明 |
|------|------|------|
| effect | string | 特效类型名称（如 `'confetti'`、`'burst'`、`'sparkle'`） |
| at | string | 特效位置：`'target'`（碰撞点）/ `'player'`（玩家位置）/ `'center'`（屏幕中心） |
| duration | number | 特效持续时间（毫秒） |
| color | string | 特效颜色 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| （无） | ParticleVFX 不发出事件 | |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| 由 events 参数配置 | 监听配置中的每个事件名，触发时创建对应粒子效果 |

常见监听事件示例：
- `collision:hit` → 接住物体时播放特效
- `collision:damage` → 受伤时播放特效
- `scorer:combo:3` → 3 连击时播放特效
- `quiz:correct` → 答对时播放特效

## 与其他模块连接方式

- **Collision**: 监听 `collision:hit` / `collision:damage` 触发碰撞特效
- **Scorer**: 监听 `scorer:combo:{N}` 触发连击特效
- **QuizEngine**: 监听 `quiz:correct` 触发正确特效
- **Randomizer**: 监听 `randomizer:result` 触发抽取结果特效

## 适用游戏类型

所有游戏类型都可使用 ParticleVFX 增强视觉反馈，特别推荐：
- **catch**、**shooting** — 击中特效
- **quiz** — 答对特效
- **random-wheel** — 结果庆祝特效
- **rhythm** — 完美命中特效

## 常见问题 & 边界情况

- events 为空对象时模块不监听任何事件，不会产生任何粒子
- 粒子的 lifetime 在 `update(dt)` 中以毫秒递增
- 超过 maxLifetime（即 duration）的粒子在每帧的 filter 中被移除
- `getActiveParticles()` 返回当前所有活跃粒子的副本
- effect 字段为字符串标识，实际渲染由 Renderer 层解释
- `reset()` 清空所有活跃粒子

### 配置示例

```json
{
  "events": {
    "collision:hit": { "effect": "confetti", "at": "target", "duration": 500, "color": "#FFD700" },
    "collision:damage": { "effect": "burst", "at": "player", "duration": 300, "color": "#FF0000" }
  }
}
```

## 参数调优指南

### 不同游戏类型的推荐特效配置

| 游戏类型 | 推荐事件映射 | effect | duration | color 建议 |
|----------|-------------|--------|----------|-----------|
| catch | `collision:hit` → confetti | confetti | 400~600 | 金色 #FFD700 |
| catch | `collision:damage` → burst | burst | 200~400 | 红色 #FF0000 |
| dodge | `collision:damage` → burst | burst | 300~500 | 红色 #FF0000 |
| shooting | `collision:hit` → sparkle | sparkle | 300~500 | 白/黄 #FFFFFF |
| quiz | `quiz:correct` → confetti | confetti | 600~800 | 绿色 #00FF00 |
| quiz | `quiz:wrong` → burst | burst | 300~400 | 红色 #FF3333 |
| random-wheel | `randomizer:result` → confetti | confetti | 800~1200 | 多彩/金色 |
| rhythm | `scorer:combo:5` → sparkle | sparkle | 400~600 | 渐变色 |
| rhythm | `scorer:combo:10` → confetti | confetti | 600~800 | 金色 #FFD700 |
| tap | `collision:hit` → burst | burst | 200~400 | 主题色 |
| runner | `collision:hit` → sparkle | sparkle | 300~500 | 金色 |
| platformer | `collision:hit` → sparkle | sparkle | 300~400 | 金色 |
| platformer | `collision:damage` → burst | burst | 200~400 | 红色 |

### effect 类型说明

| effect | 视觉表现 | 适合场景 |
|--------|---------|---------|
| confetti | 彩色纸屑向四周扩散 | 庆祝、成功、完成 |
| burst | 快速向外爆裂 | 受伤、爆炸、消灭 |
| sparkle | 闪光/星星效果 | 收集、加分、命中 |

### duration 选择指南

```
duration = 200~300: 快速闪烁（受伤反馈、快速消除）
duration = 400~600: 标准持续（得分、命中）
duration = 800~1200: 长时间展示（庆祝、大连击、结果揭晓）

注意: 过长的 duration 会导致活跃粒子数量累积
  高频事件(如每帧) + 长 duration = 内存压力
```

### 颜色与主题配合

建议根据 emoji 主题选择特效颜色：
- **fruit**: 暖色系（金色 #FFD700、橙色 #FFA500）
- **space**: 冷色系（蓝白 #88CCFF、紫色 #9966FF）
- **ocean**: 蓝绿色系（海蓝 #00CED1、珊瑚 #FF7F50）
- **halloween**: 橙黑色系（南瓜橙 #FF6600、幽灵绿 #00FF66）
- **candy**: 粉色系（粉红 #FF69B4、甜蓝 #87CEEB）

## 跨模块联动规则

### 与 Collision 模块
- 最常见的联动：`collision:hit` → 正面特效，`collision:damage` → 负面特效
- 粒子位置 `at: 'target'` 会在碰撞点播放（Collision 事件携带位置数据）
- `at: 'player'` 在玩家当前位置播放

### 与 Scorer / ComboSystem 模块
- `scorer:combo:{N}` → 连击特效，N 越大效果越华丽
- 建议为不同连击数设置不同 effect：
  - combo:3 → sparkle（普通闪光）
  - combo:5 → confetti（开始庆祝）
  - combo:10 → confetti + 更长 duration（大庆祝）

### 与 QuizEngine 模块
- `quiz:correct` → 正确特效（confetti/sparkle，绿色/金色）
- `quiz:wrong` → 错误特效（burst，红色）

### 与 Randomizer 模块
- `randomizer:result` → 结果揭晓庆祝特效
- `randomizer:spinning` → 旋转中的辅助特效（可选，通常不需要）

### 与 GameFlow 模块
- ParticleVFX 响应 `gameflow:pause/resume`（gameflowPaused 控制）
- 暂停时粒子**冻结**（lifetime 停止增长），不会被移除
- 恢复时粒子从冻结点继续衰减

### 性能优化

```
活跃粒子数 = 事件触发频率 × duration / 1000

示例:
  collision:hit 每秒触发 3 次, duration = 500ms
  → 同时存在 ~1.5 个活跃粒子 (OK)

  collision:hit 每帧触发 (60fps), duration = 1000ms
  → 同时存在 ~60 个活跃粒子 (性能风险!)

建议:
  - 低频事件（每秒 < 5 次）: duration 可以较长（500~1200ms）
  - 高频事件（每秒 > 10 次）: duration 应该很短（100~300ms）
  - 活跃粒子同时存在数量建议 < 20 个
```

## 输入适配

ParticleVFX 不直接响应输入事件，但特效表现可能受输入方式影响：

| 输入方式 | 对特效的影响 | 建议 |
|----------|-------------|------|
| TouchInput | 点击位置即目标位置，`at: 'target'` 精确 | 标准配置即可 |
| FaceInput | 面部追踪有抖动，`at: 'player'` 位置可能跳动 | 适当增大特效范围或用 `at: 'center'` |
| HandInput | 手部追踪有抖动，同上 | 同上 |
| BodyInput | 全身追踪精度低 | 建议用 `at: 'center'` 避免位置漂移 |
| DeviceInput | 设备倾斜控制无精确碰撞点 | 建议用 `at: 'player'` 或 `at: 'center'` |
| AudioInput | 声音输入无位置概念 | 只能用 `at: 'center'` |

## 常见 Anti-Pattern

- ❌ **高频事件 + 长 duration** → 活跃粒子数爆炸，每帧遍历大量粒子影响性能
  ✅ 高频事件用短 duration (< 300ms)，或在事件源头加节流

- ❌ **events 为空但仍添加 ParticleVFX 模块** → 模块不监听任何事件，白白占用内存
  ✅ 不需要粒子特效时不添加 ParticleVFX 模块

- ❌ **所有事件都用同一种 effect + color** → 正面和负面反馈视觉上无法区分
  ✅ 正面事件用 confetti/sparkle + 金色/绿色，负面事件用 burst + 红色

- ❌ **在 dress-up/narrative 中大量使用粒子特效** → 这些安静的游戏类型不适合频繁的粒子效果
  ✅ 仅在关键时刻使用（如完成搭配、分支选择结果）

- ❌ **不配置 at 参数或全部用 'center'** → 所有特效都在屏幕中心播放，缺乏空间关联
  ✅ 碰撞相关用 'target'（碰撞点），角色相关用 'player'（玩家位置）
