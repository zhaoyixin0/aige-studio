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

## 参数调优指南

UIOverlay 的参数较少（只有 elements 对象），主要调优在于**选择显示哪些 HUD 元素**以及**布局配置**：

| 游戏类型 | 推荐显示的 HUD 元素 | 说明 |
|----------|---------------------|------|
| catch | 分数 + 计时 + 生命 | 完整三件套 |
| dodge | 分数 + 计时 + 生命 | 完整三件套（分数=存活时间） |
| shooting | 分数 + 计时 + 生命 + 连击 | 射击游戏连击很重要 |
| runner | 分数 + 计时 | 跑酷通常无生命值 |
| quiz | 题号 + 分数 + 倒计时 | 题号需要自定义显示 |
| tap | 分数 + 计时 | 简洁双指标 |
| rhythm | 分数 + 连击 | 连击是节奏游戏的核心反馈 |
| random-wheel | 无 HUD 或仅抽奖次数 | 转盘游戏 HUD 简洁 |
| platformer | 分数 + 生命 | 横版平台通常无倒计时 |
| expression | 分数 + 计时 | 表情识别游戏 |
| dress-up | 无 HUD | 换装游戏不需要 HUD |
| narrative | 无 HUD | 叙事类不需要 HUD |

### combo 连击提示配置

连击提示的消失时间固定为 1500ms（`COMBO_FADE_DURATION`），渲染器可根据 `fadeTimer / 1500` 计算透明度实现渐隐效果：

```
fadeTimer = 1500: 刚触发，完全不透明
fadeTimer = 750:  50% 透明（半隐）
fadeTimer = 0:    完全消失
```

## 跨模块联动规则

### 与 Scorer 模块
- 监听 `scorer:update` 更新分数显示
- 监听 `scorer:combo:*` 更新连击提示
- **注意**: `scorer:combo:*` 使用通配符，会匹配 `scorer:combo:3`、`scorer:combo:5` 等所有连击级别

### 与 Timer 模块
- 监听 `timer:tick` 更新倒计时/计时显示
- Timer 发出 `{ remaining, elapsed }`，UIOverlay 同时记录两个值
- 渲染器根据 Timer 配置决定显示 remaining（倒计时）还是 elapsed（正计时）

### 与 Lives 模块
- 监听 `lives:change` 更新生命值显示
- **数据格式注意**: Lives 模块发出 `{ current, max }`，但 UIOverlay 用 `data.current` 更新 `hudState.lives`
- 如果 Lives 发出的事件数据格式不一致，lives 可能显示为 0

### 与 GameFlow 模块
- UIOverlay 的 `gameflowPaused` 在 init 时设为 false（**始终运行**）
- 即使游戏暂停/结束，UIOverlay 仍然更新 HUD 数据
- 这确保了 finished 后分数仍然正确显示

### 与 ResultScreen 模块
- UIOverlay 和 ResultScreen 是互补关系：
  - UIOverlay: playing 阶段的实时数据展示
  - ResultScreen: finished 后的最终结算展示
- 两者不直接通信，各自独立收集/更新数据

### HUD 数据流转

```
Scorer.update()
  → emit('scorer:update', { score })
    → UIOverlay: hudState.score = score

Timer.update()
  → emit('timer:tick', { remaining, elapsed })
    → UIOverlay: hudState.timer = { remaining, elapsed }

Lives.takeDamage()
  → emit('lives:change', { current, max })
    → UIOverlay: hudState.lives = current

ComboSystem.onHit()
  → emit('scorer:combo:3', { combo: 3 })
    → UIOverlay: hudState.combo = { count: 3, fadeTimer: 1500 }
```

## 输入适配

UIOverlay 不直接响应输入事件，但不同输入方式对 HUD 显示有间接影响：

| 输入方式 | HUD 注意事项 |
|----------|-------------|
| TouchInput | HUD 不应遮挡交互区域（特别是屏幕底部的触摸热区） |
| FaceInput | HUD 应避免遮挡摄像头预览区域 |
| HandInput | HUD 应避免遮挡摄像头预览区域 |
| BodyInput | HUD 应尽量简洁，全身交互时 HUD 可能被忽视 |
| DeviceInput | HUD 可能因设备倾斜而难以阅读，建议使用大字体 |
| AudioInput | 无特殊影响 |

**通用建议**: 摄像头输入（Face/Hand/Body）时，HUD 元素放在屏幕边角，避免覆盖中央交互区域。

## 常见 Anti-Pattern

- ❌ **在 UIOverlay 中监听 gameflow:pause/resume** → UIOverlay 已设为 gameflowPaused=false，不需要额外处理
  ✅ UIOverlay 始终运行，确保暂停后 HUD 仍能正确显示最终数据

- ❌ **期望 UIOverlay 发出事件通知渲染器更新** → UIOverlay 不发出任何事件
  ✅ 渲染器主动调用 `getHudState()` 获取最新数据（每帧拉取模式）

- ❌ **直接修改 getHudState() 返回的对象** → 返回的是浅拷贝，修改不会影响内部状态
  ✅ 只读取 HUD 数据，不修改返回值

- ❌ **依赖 combo.count 持续显示（不检查 fadeTimer）** → combo 信息会一直显示
  ✅ 检查 `fadeTimer > 0` 决定是否显示连击提示

- ❌ **假设 lives 始终从 Lives 模块获取正确值** → Lives 模块的事件数据可能是 `{ current, max }` 而非 `{ lives }`
  ✅ 确认 Lives 模块的事件数据格式与 UIOverlay 的读取字段一致

## 常见问题 & 边界情况

- `getHudState()` 返回 hudState 的浅拷贝
- combo.fadeTimer 在 `update(dt)` 中递减，到 0 后连击提示消失
- COMBO_FADE_DURATION 固定为 1500ms（静态常量）
- `scorer:combo:*` 使用通配符监听所有连击级别
- lives 从 `data.current` 字段读取（Lives 模块发出 `{ current, max }`）
- `reset()` 将所有 HUD 数据归零
- elements 参数可用于自定义 HUD 布局，供渲染层解释
- UIOverlay 的 gameflowPaused 在 init 时设为 false（始终运行）
- combo 数据处理了两种格式：`typeof data === 'number'` 或 `data?.combo`
