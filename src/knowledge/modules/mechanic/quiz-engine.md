# QuizEngine — 答题引擎模块

## 基本信息
- 类型: mechanic
- 类名: QuizEngine
- 注册名: `QuizEngine`

## 功能原理

QuizEngine 管理问答式游戏逻辑。维护题目列表（questions），逐题展示并等待用户作答。每题有独立倒计时（timePerQuestion），超时自动判错。答对加分（scoring.correct），答错可扣分（scoring.wrong）。支持时间奖励（timeBonus）。所有题目完成后发出 `quiz:finished` 事件。需要外部调用 `start()` 启动和 `answer(index)` 提交答案。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| questions | object | `[]` | — | 题目列表 |
| timePerQuestion | range | `15` | `5 ~ 60`，单位秒 | 每题限时 |
| scoring | object | `{ correct: 10, wrong: 0, timeBonus: true }` | — | 评分规则 |

### 题目结构 (QuizQuestion)

| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 题目文本 |
| options | string[] | 选项数组 |
| correctIndex | number | 正确选项的索引（从 0 开始） |

### 评分规则 (QuizScoring)

| 字段 | 类型 | 说明 |
|------|------|------|
| correct | number | 答对得分（默认 10） |
| wrong | number | 答错扣分（默认 0，不扣分） |
| timeBonus | boolean | 是否启用时间奖励（默认 true） |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `quiz:question` | `{ text, options, index, total }` | 新题目展示时发出 |
| `quiz:correct` | `{ questionIndex, score }` | 答对时发出 |
| `quiz:wrong` | `{ questionIndex, correctIndex, selectedIndex }` | 答错或超时时发出（超时 selectedIndex = -1） |
| `quiz:score` | `{ delta, total }` | 答对且 score > 0 时发出 |
| `quiz:finished` | `{ totalScore, totalQuestions }` | 所有题目完成时发出 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| （无） | QuizEngine 不监听其他模块事件，由外部调用 `start()` 和 `answer()` 驱动 |

## 与其他模块连接方式

- **TouchInput**: 用户点击选项 → 外部逻辑调用 `quizEngine.answer(optionIndex)`
- **Scorer**: `quiz:score` 可被 Scorer 监听（如果需要统一计分）
- **UIOverlay**: `quiz:question` → 显示题目和选项
- **SoundFX**: `quiz:correct` / `quiz:wrong` → 播放正确/错误音效
- **ParticleVFX**: `quiz:correct` → 播放正确特效
- **GameFlow**: `quiz:finished` → 可触发游戏结束
- **Timer**: QuizEngine 自带每题计时，通常不需要额外 Timer 模块

## 适用游戏类型

- **quiz**（答题类）— 核心模块
- **puzzle**（拼图/配对类）— 将配对问题包装为 quiz 格式
- **narrative**（分支叙事类）— 将叙事选择包装为选择题

## 常见问题 & 边界情况

- 必须调用 `start()` 才能开始答题，init 只做初始化
- `answer()` 在 started=false 或 finished=true 时不执行
- 超时自动判错：selectedIndex 为 -1 表示超时
- timePerQuestion 内部以毫秒使用 `timePerQuestion * 1000`
- `quiz:score` 仅在 score > 0 时发出（答错的 wrong 分不触发）
- wrong 为负数时会从 totalScore 中减去
- `getProgress()` 返回 `{ current: number, total: number }` 表示当前进度
- `isFinished()` 可查询是否已完成所有题目
- `reset()` 重置所有状态，可以重新 start
