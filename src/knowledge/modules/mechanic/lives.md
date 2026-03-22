# Lives — 生命值系统模块

## 基本信息
- 类型: mechanic
- 类名: Lives
- 注册名: `Lives`

## 功能原理

Lives 管理玩家生命值。初始生命数由 count 参数设定，收到 `collision:damage` 事件时按 damage 配置减少生命。生命归零时发出 `lives:zero` 事件。支持增加和减少操作，生命值始终在 0 到 count 之间。模块为事件驱动，`update()` 为空操作。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| count | number | `3` | `1 ~ 10` | 初始/最大生命数 |
| events | object | `{ damage: -1 }` | — | 事件配置 |
| events.damage | number | `-1` | — | 每次受伤减少的生命数（取绝对值使用） |
| onZero | select | `'finish'` | `finish / none` | 生命归零后的行为 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `lives:change` | `{ current: number, max: number }` | 生命值变化时（增加或减少） |
| `lives:zero` | （无数据） | 生命值降至 0 时触发 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `collision:damage` | 减少生命值，减少量为 `abs(events.damage)` |

## 与其他模块连接方式

- **Collision**: 碰撞规则中 event 为 `'damage'` 时，完整事件名 `collision:damage` 被 Lives 监听
- **GameFlow**: `lives:zero` → GameFlow 监听后调用 `transition('finished')`
- **UIOverlay**: `lives:change` → UIOverlay 更新生命值显示
- **ParticleVFX**: `lives:change` 可触发受伤特效

## 适用游戏类型

- **dodge**（躲避类）— 被障碍物碰到减少生命
- **runner**（跑酷类）— 碰到障碍减少生命
- **catch**（接住类）— 可选，漏接减少生命

## 常见问题 & 边界情况

- 初始生命值在 `init()` 中设置为 `this.params.count`
- `decrease()` 中 `current <= 0` 时直接返回，不会减到负数
- `increase()` 不会超过 `count` 上限
- damage 值取绝对值 `Math.abs(events.damage ?? 1)`，所以配置为负数也能正常工作
- `lives:zero` 只在 current 刚好降到 0 时触发一次
- `reset()` 将 current 恢复为 count
- onZero = `'finish'` 时由 GameFlow 监听 `lives:zero` 实现结束，Lives 本身不处理
