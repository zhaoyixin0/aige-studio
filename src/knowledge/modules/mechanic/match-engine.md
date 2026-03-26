# MatchEngine — 翻牌配对模块

## 基本信息
- 类型: mechanic
- 类名: `MatchEngine`
- 注册名: `MatchEngine`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/match-engine.ts`

## 功能原理

MatchEngine 实现经典的记忆配对（Concentration）游戏逻辑。生成一个 N×M 的卡牌网格，每张卡有一个隐藏值，玩家依次翻开 `matchCount` 张卡片，如果值相同则配对成功，否则翻回。所有配对完成后游戏结束。

### 核心流程
```
MatchEngine.start()
    ↓ generateGrid(): 创建 cols * rows 张卡，填入配对值，Fisher-Yates 洗牌
    ↓
input:touch:tap { cellIndex } 或 { x, y }
    ↓
selectCell(index)
    ↓ cell.revealed = true, selected.push(index)
    ↓ selected.length >= matchCount ?
    │   ├── 是 → checkMatch()
    │   │   ├── 所有选中卡值相同 → match:found → matchesFound++
    │   │   │   └── matchesFound >= totalPairs ? → match:complete → started = false
    │   │   └── 值不同 → match:fail → 翻回 → (shuffleOnFail ? shuffleUnmatched())
    │   └── 否 → 等待下一次选择
```

### 网格生成逻辑
1. 总单元格 = cols * rows
2. 值的种类数 = `Math.floor(totalCells / matchCount)`（即 totalPairs）
3. 每个值重复 matchCount 次
4. 剩余空位用额外值填充（`values.length % numValues`）
5. Fisher-Yates 洗牌打乱

### 坐标到单元格映射（hitTestCell）
支持两种输入方式：
- **直接索引**：`data.cellIndex` 直接映射（适合 UI 按钮点击）
- **屏幕坐标**：`data.x, data.y` 通过 hitTestCell 计算（考虑 padding=40, gap=10, 最大卡片尺寸 120px）

### 业界参考
- **经典 Concentration**：标准 4×4（8 对）或 6×6（18 对）
- **Match Cards (Google Play)**：Easy 12 张/Medium 20 张/Hard 30 张
- **在线记忆游戏**：翻回延迟 1~1.5 秒，配对成功保持翻开
- **难度递进研究**：每关增加 2 列或 2 行，从 2×2 递增到 6×6

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| gridCols | range | `4` | 2~6，步长 1 | 3~5 | 网格列数 |
| gridRows | range | `4` | 2~6，步长 1 | 3~5 | 网格行数 |
| matchCount | range | `2` | 2~3，步长 1 | 2 | 每组配对所需的卡片数量 |
| shuffleOnFail | boolean | `false` | — | — | 配对失败后是否重新洗牌未匹配的卡 |

### 参数推荐值（按难度）

| 难度 | gridCols | gridRows | matchCount | shuffleOnFail | 总卡数 | 配对数 | 说明 |
|------|----------|----------|-----------|---------------|-------|-------|------|
| 入门 | 2 | 3 | 2 | false | 6 | 3 | 极简，适合幼儿/教学 |
| 简单 | 3 | 4 | 2 | false | 12 | 6 | 标准 Easy 级别 |
| 普通 | 4 | 4 | 2 | false | 16 | 8 | 经典标准配置 |
| 困难 | 4 | 5 | 2 | false | 20 | 10 | 需要更强记忆力 |
| 专家 | 5 | 6 | 2 | false | 30 | 15 | 高难度挑战 |
| 地狱 | 4 | 4 | 2 | true | 16 | 8 | 失败洗牌，破坏记忆 |
| 三连 | 3 | 4 | 3 | false | 12 | 4 | 三张配对，更难 |

### gridCols × gridRows 注意事项
- 总单元格数必须被 matchCount 整除才能完美配对（当前实现对余数会额外填充）
- 推荐组合（matchCount=2）：2×2=4, 2×3=6, 3×4=12, 4×4=16, 4×5=20, 5×6=30, 6×6=36
- 不推荐奇数总数（如 3×3=9），会有一张无配对的"孤卡"

## 参数调优指南

### gridCols × gridRows 与屏幕尺寸
- 手机竖屏（1080×1920）：推荐 3~4 列，3~5 行（卡片足够大可以点击）
- 最大卡片尺寸 120px，最小建议 60px（手指触摸目标最小 44px）
- 6×6 网格在小屏设备上卡片可能小于 60px，需要缩放适配
- hitTestCell 内部计算：可用宽度 = canvas.width - 80（padding*2），卡片宽 = min(120, (availW - gap*(cols-1)) / cols)

### matchCount 的影响
- **matchCount=2**：经典双卡配对，最常见和直观
- **matchCount=3**：三卡配对，需要翻开 3 张才能判定，难度显著提升
- matchCount=3 时总单元格需被 3 整除：3×4=12, 4×6=24, 6×6=36

### shuffleOnFail 的影响
- **false（默认）**：失败后卡片翻回原位，玩家可以记住位置
- **true**：失败后未匹配卡片重新洗牌，破坏记忆，极大增加难度
- 注意：洗牌只改变值（`c.value`），不改变位置/ID，渲染层需据此更新
- shuffleOnFail 适合短期挑战或作为困难模式选项

### 翻回时间（当前实现无延迟）
- 当前实现中配对失败立即翻回（`revealed = false`），无延迟
- 业界建议翻回延迟 0.8~1.5 秒，让玩家有时间记忆
- 渲染层可自行添加动画延迟（收到 match:fail 后延迟 1s 再隐藏卡面）

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `match:found` | `{ value: number, cells: number[], matchesFound: number, totalPairs: number }` | 配对成功 |
| `match:fail` | `{ cells: number[] }` | 配对失败（翻开的卡值不同） |
| `match:complete` | `{ totalPairs: number }` | 所有配对完成 |

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `gameflow:state` | GameFlow | state='playing' 时触发 start()（如果未 started） |
| `input:touch:tap` | TouchInput | data.cellIndex → 直接选卡；data.x/y → hitTestCell 转换后选卡 |

## 跨模块联动规则

### 与 TouchInput 的联动（上游）
```
TouchInput → input:touch:tap { x, y }
    ↓
MatchEngine.hitTestCell(x, y) → cellIndex
    ↓
selectCell(cellIndex) → 翻开卡片
```
- TouchInput 是 MatchEngine 的唯一输入源
- 需要触屏点击坐标准确映射到卡片网格

### 与 Scorer 的联动
- Scorer 需设置 `hitEvent = 'match:found'` 监听配对成功
- 每次 match:found 加分一次
- 可选扣分：监听 match:fail 触发 deductOnMiss（需自定义 wiring）
- 分数策略建议：每对 10 分，首次翻开配对 bonus +5 分

### 与 Timer 的联动
- Timer（countdown）可限制总游戏时间（如 60s 内尽可能多配对）
- Timer（stopwatch）可记录完成所有配对的用时（越快越好）
- match:complete 可触发 GameFlow 结束（早于 Timer 倒计时结束）

### 与 GameFlow 的联动
- MatchEngine 在 init 时自动调用 start()（注意：早于 GameFlow 的 playing 状态）
- 同时监听 `gameflow:state` = playing 时再次 start()（防止 init 时未就绪）
- match:complete → 可触发 GameFlow.transition('finished')
- match:complete 后 started = false，阻止进一步输入

### 与反馈模块的联动
- **ParticleVFX**：match:found → 在配对卡片位置播放成功特效
- **SoundFX**：match:found → 配对成功音，match:fail → 翻回音
- **UIOverlay**：显示已配对数/总配对数进度

## 输入适配

| 输入方式 | 适配策略 |
|---------|---------|
| TouchInput | 原生支持，通过 `input:touch:tap` 的 cellIndex 或 x/y 坐标 |
| FaceInput | 不适用 — 面部无法精确选择单张卡片 |
| HandInput | 可扩展：手部位置 → hitTestCell 映射（需自定义 wiring） |
| BodyInput | 不适用 |
| DeviceInput | 可扩展：设备倾斜移动光标 → 确认选择（需自定义逻辑） |
| AudioInput | 不适用 |

## 常见 Anti-Pattern

**1. gridCols × gridRows 不是 matchCount 的倍数**
- ❌ gridCols=3, gridRows=3, matchCount=2 → 9 张卡无法完美配成 4.5 对
- ✅ 确保 cols * rows 能被 matchCount 整除（当前实现有填充兜底但不理想）

**2. 网格过大导致卡片太小**
- ❌ gridCols=6, gridRows=6 在手机上 → 36 张卡，每张约 60px，难以点击
- ✅ 手机端建议 cols <= 5, rows <= 5（最多 25 张卡）

**3. shuffleOnFail 配合大网格**
- ❌ 6×6 + shuffleOnFail = true → 36 张卡每次失败都洗牌，几乎不可能完成
- ✅ shuffleOnFail 仅配合小网格（4×4 以下）使用

**4. Scorer.hitEvent 未设置为 match:found**
- ❌ Scorer 默认监听 `collision:hit`，match:found 被忽略
- ✅ 设置 `Scorer.hitEvent = 'match:found'`

**5. Timer 过短导致无法完成配对**
- ❌ 4×5 网格（10 对），Timer = 15s — 平均 1.5s/对，加上记忆时间几乎不可能
- ✅ 估算：每对平均需要 3~5 秒（含翻看+记忆+匹配），Timer >= totalPairs * 4

**6. init 时重复 start()**
- ❌ 自定义逻辑在 init 后又调用 start() → 网格被重新生成，玩家看到的布局变了
- ✅ MatchEngine 在 init 时已 auto-start，通常无需再手动调用

## 常见问题 & 边界情况

- init 时自动调用 start() 生成网格，同时监听 `gameflow:state` playing 可能触发第二次 start()
- selectCell 忽略已 revealed 或已 matched 的卡片（防止重复点击）
- checkMatch 是同步执行，配对判定和翻回在同一帧完成（无延迟动画）
- shuffleUnmatched 只修改未配对卡的 value，已配对卡的位置和值不变
- hitTestCell 基于画布尺寸计算（默认 1080×1920），padding=40, gap=10, maxCardSize=120
- 点击卡片间的间隙（gap 区域）返回 -1（不选中任何卡）
- `getGrid()` 返回卡片数组的深拷贝（`{ ...c }`），修改不影响内部状态
- MatchCell 结构：`{ id: number, value: number, revealed: boolean, matched: boolean }`
- update() 是 no-op（事件驱动模块），不消耗帧时间
- `reset()` 清空 grid/selected/matchesFound/totalPairs/started
- 当 grid 为空时 selectCell 无效（cell undefined 检查）
- matchCount=3 时需要连续翻开 3 张相同值的卡才算配对成功
