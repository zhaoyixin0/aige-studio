# UIOverlay — HUD 叠加层模块

## 基本信息
- 类型: feedback
- 类名: UIOverlay
- 注册名: `UIOverlay`

## 功能原理

UIOverlay 收集各游戏模块的状态信息并维护 HUD（Head-Up Display）数据。监听分数更新、计时器 tick、生命值变化和连击事件，将这些信息汇总到 hudState 对象中供渲染层读取。连击提示有 1500ms 的渐隐计时器。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| elements | object | `[]` | — | HUD 元素配置列表 |

### HUD 状态结构 (HudState)

| 字段 | 类型 | 说明 |
|------|------|------|
| score | number | 当前分数 |
| timer | object | `{ remaining: number, elapsed: number }` 计时信息 |
| lives | number | 当前生命数 |
| combo | object | `{ count: number, fadeTimer: number }` 连击信息 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| （无） | UIOverlay 不发出事件 | |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `scorer:update` | 更新 hudState.score |
| `timer:tick` | 更新 hudState.timer（remaining 和 elapsed） |
| `lives:change` | 更新 hudState.lives |
| `scorer:combo:*` | 更新 hudState.combo，设置 fadeTimer 为 1500ms |

## 与其他模块连接方式

- **Scorer**: 监听 `scorer:update` 显示分数
- **Timer**: 监听 `timer:tick` 显示倒计时/计时
- **Lives**: 监听 `lives:change` 显示生命值
- **Scorer**: 监听连击事件显示连击提示

## 适用游戏类型

所有需要 HUD 显示的游戏类型都应包含 UIOverlay：
- **catch**、**dodge**、**shooting**、**runner** — 分数 + 计时 + 生命
- **quiz** — 题号 + 分数 + 倒计时
- **tap** — 分数 + 计时
- **rhythm** — 分数 + 连击

## 常见问题 & 边界情况

- `getHudState()` 返回 hudState 的浅拷贝
- combo.fadeTimer 在 `update(dt)` 中递减，到 0 后连击提示消失
- COMBO_FADE_DURATION 固定为 1500ms（静态常量）
- `scorer:combo:*` 使用通配符监听所有连击级别
- lives 字段从 `data.lives` 读取（注意：Lives 模块发出的是 `{ current, max }`，这里用的是 `data.lives`）
- `reset()` 将所有 HUD 数据归零
- elements 参数可用于自定义 HUD 布局，供渲染层解释
