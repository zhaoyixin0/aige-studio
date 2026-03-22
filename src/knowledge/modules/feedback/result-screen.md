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
