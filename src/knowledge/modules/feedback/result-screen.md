# ResultScreen — 结算画面模块

## 基本信息
- 类型: feedback
- 类名: ResultScreen
- 注册名: `ResultScreen`

## 功能原理

ResultScreen 在游戏结束后显示结算信息。监听 `gameflow:state` 事件，当状态变为 `'finished'` 时自动收集各模块统计数据。支持显示分数、最大连击、正确率和用时等统计项。根据分数与星级阈值计算 1-3 星评级。提供可配置的操作按钮（重试、分享、返回主页）。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| show | enum[] | `['score']` | `score / combo_max / accuracy / time` | 显示的统计项 |
| rating | object | `{ '3star': 500, '2star': 300, '1star': 100 }` | — | 星级评分阈值 |
| actions | enum[] | `['retry', 'share']` | `retry / share / home` | 操作按钮 |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| （无） | ResultScreen 不发出事件 | |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:state` | 当 `data.state === 'finished'` 时设为可见并收集统计数据 |

## 与其他模块连接方式

- **GameFlow**: 监听 `gameflow:state` 中的 finished 状态触发显示
- **Scorer**: 通过 `engine.getModulesByType('Scorer')` 获取分数
- **Timer**: 通过 `engine.getModulesByType('Timer')` 获取用时

## 适用游戏类型

所有有明确结束条件的游戏类型都应包含 ResultScreen：
- **catch**、**dodge**、**shooting**、**runner** — 分数 + 星级
- **quiz** — 分数 + 正确率
- **tap** — 分数 + 用时
- **rhythm** — 分数 + 连击 + 正确率

## 常见问题 & 边界情况

- 统计收集通过 `getModulesByType()` 查找模块，模块不存在时对应统计项为 0
- combo_max 和 accuracy 统计暂未完整实现，分别 fallback 到 0
- 星级计算：score >= 3star 阈值 → 3星，>= 2star → 2星，>= 1star → 1星，否则 0星
- `isVisible()` 返回结算画面是否可见
- `getResults()` 返回 `{ stats, starRating, actions }` 完整结算数据
- `reset()` 隐藏结算画面并清空统计
- show 数组中的每个项都会尝试从对应模块收集数据
- actions 数组的实际按钮行为由上层 UI 组件实现

### 配置示例

```json
{
  "show": ["score", "time", "combo_max"],
  "rating": { "3star": 1000, "2star": 500, "1star": 200 },
  "actions": ["retry", "share", "home"]
}
```

## 参数调优指南

### show 统计项选择

| 游戏类型 | 推荐 show 配置 | 说明 |
|----------|---------------|------|
| catch | `['score', 'time']` | 分数 + 游戏时长 |
| dodge | `['score', 'time']` | 存活时间就是分数 |
| shooting | `['score', 'combo_max', 'time']` | 射击游戏最大连击很重要 |
| quiz | `['score', 'accuracy']` | 分数 + 正确率 |
| random-wheel | `['score']` | 转盘结果（简洁） |
| tap | `['score', 'time']` | 分数 + 用时 |
| rhythm | `['score', 'combo_max', 'accuracy']` | 节奏游戏三要素 |
| runner | `['score', 'time']` | 距离/分数 + 存活时间 |
| platformer | `['score', 'time']` | 收集分数 + 通关时间 |
| expression | `['score', 'time']` | 表情识别得分 |
| gesture | `['score', 'time']` | 手势识别得分 |
| dress-up | `['score']` | 搭配评分（如有） |
| narrative | `[]` 或不使用 ResultScreen | 叙事类通常无分数结算 |

### rating 星级阈值调优

```
星级阈值应根据游戏的实际最高可能分数设置:

理想分布:
  3星 = 最高分的 70%~80%（优秀玩家）
  2星 = 最高分的 40%~50%（普通玩家）
  1星 = 最高分的 15%~25%（入门玩家）

示例: 30秒 catch 游戏，最大分数约 600:
  { "3star": 450, "2star": 250, "1star": 100 }

示例: 10题 quiz 游戏，每题 100 分:
  { "3star": 800, "2star": 500, "1star": 300 }

注意: 如果阈值设置不合理（如 3star=100 分）
  大多数玩家都能拿3星 → 失去激励效果
```

### actions 按钮选择

| 按钮 | 适用场景 | 说明 |
|------|---------|------|
| retry | 所有游戏 | 重新开始，几乎必选 |
| share | 社交分享场景 | 分享结果到社交媒体 |
| home | 有主菜单的游戏 | 返回首页/选关 |

推荐组合：
- 单游戏: `['retry', 'share']`（默认值）
- 多关卡: `['retry', 'share', 'home']`
- 演示/测试: `['retry']`

## 跨模块联动规则

### 与 GameFlow 模块（核心依赖）
- 监听 `gameflow:state` 事件，当 `state === 'finished'` 时触发结算
- ResultScreen 声明 GameFlow 为**必须依赖**（`getDependencies().requires = ['GameFlow']`）
- ResultScreen 的 `gameflowPaused` 在 init 时设为 false（始终监听状态变化，不受暂停影响）

### 与 Scorer 模块
- 通过 `engine.getModulesByType('Scorer')` 获取分数
- 调用 Scorer 实例的 `getScore()` 方法
- 如果没有 Scorer 模块，score 统计项为 0

### 与 Timer 模块
- 通过 `engine.getModulesByType('Timer')` 获取用时
- 调用 Timer 实例的 `getElapsed()` 方法
- 如果没有 Timer 模块，time 统计项为 0

### 与 UIOverlay 模块
- 两者是互补关系：UIOverlay 负责 playing 中的实时 HUD，ResultScreen 负责 finished 后的结算
- 游戏 finished 后，UIOverlay 的 HUD 通常被 ResultScreen 遮挡

### 与 ComboSystem 模块
- `combo_max` 统计项暂未完整实现（fallback 到 0）
- 未来需要 ComboSystem 暴露 `getMaxCombo()` 方法

### 与 QuizEngine 模块
- `accuracy` 统计项暂未完整实现（fallback 到 0）
- 未来需要 QuizEngine 暴露 `getAccuracy()` 方法

### 统计收集流程

```
GameFlow.transition('finished')
  → emit('gameflow:state', { state: 'finished' })
    → ResultScreen: visible = true, collectStats()
      → 遍历 show 配置的每个字段:
        score → engine.getModulesByType('Scorer')[0].getScore()
        time → engine.getModulesByType('Timer')[0].getElapsed()
        combo_max → 0 (未实现)
        accuracy → 0 (未实现)
      → getResults() 可用，返回 { stats, starRating, actions }
```

## 输入适配

ResultScreen 不直接响应输入事件，但结算画面的操作按钮需要考虑输入方式：

| 输入方式 | 结算画面的交互方式 | 说明 |
|----------|-------------------|------|
| TouchInput | 点击按钮（retry/share/home） | 最自然的交互 |
| FaceInput | 需要 fallback 到触摸点击按钮 | 面部追踪无法精确点击按钮 |
| HandInput | 需要 fallback 到触摸点击按钮 | 手势无法精确点击按钮 |
| BodyInput | 需要 fallback 到触摸点击按钮 | 身体追踪无法精确交互 |
| DeviceInput | 需要 fallback 到触摸点击按钮 | 设备传感器无法点击按钮 |
| AudioInput | 需要 fallback 到触摸点击按钮 | 声音无法精确选择按钮 |

**关键点**: 无论主输入方式是什么，ResultScreen 的按钮交互都通过画布 click 事件处理（由上层 UI 组件实现），因此始终需要 TouchInput 或鼠标点击作为兜底。

## 常见 Anti-Pattern

- ❌ **show 配置了 combo_max 或 accuracy 但没有对应模块** → 统计值为 0，用户看到"最大连击: 0"
  ✅ 只配置有对应模块支持的统计项

- ❌ **rating 阈值过低导致所有人都 3 星** → 失去激励效果
  ✅ 根据实际游戏的分数范围合理设置阈值

- ❌ **rating 阈值过高导致永远 0 星** → 玩家挫败感强
  ✅ 1star 阈值应该是大多数玩家（80%+）能达到的分数

- ❌ **不包含 retry 按钮** → 玩家无法重新开始
  ✅ 除非有充分理由（如一次性抽奖），否则始终包含 retry

- ❌ **在 collectStats 之前就调用 getResults()** → 返回空数据
  ✅ 等待 `gameflow:state === 'finished'` 事件触发后再获取结果

- ❌ **期望 ResultScreen 自动执行 retry/share/home 操作** → ResultScreen 只提供按钮配置
  ✅ 实际按钮行为由上层 UI 组件实现
