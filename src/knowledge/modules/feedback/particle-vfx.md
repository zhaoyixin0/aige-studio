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
