# GestureMatch — 手势匹配模块

## 基本信息
- 类型: mechanic
- 类名: `GestureMatch`
- 注册名: `GestureMatch`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/gesture-match.ts`

## 功能原理

GestureMatch 管理手势识别游戏的核心逻辑：随机显示目标手势 → 等待玩家做出匹配手势 → 判定成功/失败 → 显示下一个目标。模块维护目标手势队列和计时器，在限定时间内未匹配则自动判定失败。

### 核心流程
```
GestureMatch.start()
    ↓ 从 targetGestures 随机选一个 → currentTarget
    ↓ emit gesture:show { target, displayTime }
    ↓
GestureMatch.update(dt)
    ↓ displayTimer += dt
    ↓ displayTimer >= displayTime * 1000 ?
    │   ├── 是 → emit gesture:fail { reason: 'timeout' } → nextTarget()
    │   └── 否 → 等待输入
    ↓
HandInput → input:hand:gesture { gesture, confidence }
    ↓
handleGesture()
    ↓ gesture === currentTarget && confidence >= matchThreshold ?
    ├── 是 → emit gesture:match → matchCount++ → nextTarget()
    └── 否 → emit gesture:fail { target, gesture }
```

### 目标选择逻辑
- `nextTarget()` 从 `targetGestures` 数组随机选取（`Math.random()`）
- 允许连续出现相同手势（无去重）
- 手势序列无限循环，不存在"全部完成"的终态

### 业界参考
- **TikTok 手势特效**：通常 3~5 种手势，单个显示 2~4 秒
- **Nintendo Switch Sports**：手势识别置信度阈值约 0.75，反馈延迟 < 100ms
- **Just Dance**：身体动作匹配窗口约 0.3~0.5 秒，置信度 0.6+
- **手势游戏 UX 研究**：推荐每个手势显示时间随难度递减（3s → 2s → 1.5s）

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| targetGestures | object | `['thumbs_up', 'peace', 'fist', 'open_palm']` | 字符串数组 | 3~6 种手势 | 目标手势列表 |
| displayTime | range | `3` | 1~10s，步长 0.5 | 2~5s | 每个手势的显示/等待时间（秒） |
| matchThreshold | range | `0.8` | 0.5~1，步长 0.05 | 0.7~0.9 | 手势匹配置信度阈值 |

### 参数推荐值（按难度）

| 难度 | targetGestures 数量 | displayTime | matchThreshold | 说明 |
|------|-------------------|-------------|---------------|------|
| 入门 | 2~3 种 | 5s | 0.7 | 简单手势+充足时间+低阈值 |
| 简单 | 3~4 种 | 3~4s | 0.75 | 标准休闲体验 |
| 普通 | 4~5 种 | 2~3s | 0.8 | 需要熟练手势切换 |
| 困难 | 5~6 种 | 1.5~2s | 0.85 | 快速反应+高精度 |
| 专家 | 6+ 种 | 1~1.5s | 0.9 | 极限反应速度 |

### 手势类型说明

| 手势标识 | 描述 | MediaPipe 识别难度 | 推荐使用场景 |
|---------|------|-------------------|------------|
| `thumbs_up` | 竖大拇指 | 低（识别稳定） | 入门/简单 |
| `open_palm` | 张开手掌 | 低 | 入门/简单 |
| `fist` | 握拳 | 低 | 入门/简单 |
| `peace` | 比耶（✌️） | 中 | 普通 |
| `pointing` | 食指指向 | 中 | 普通 |
| `ok` | OK 手势 | 高 | 困难 |
| `rock` | 摇滚手势 | 高 | 困难/专家 |

## 参数调优指南

### targetGestures 选择
- 手势之间应有足够的视觉区分度（如 open_palm 和 fist 区分明显，但 peace 和 pointing 容易混淆）
- MediaPipe 对 thumbs_up、open_palm、fist 的识别最稳定，建议入门级必含
- 避免包含过多相似手势（如同时包含 peace + pointing + ok 会导致误识别）
- 推荐组合：入门 = [thumbs_up, open_palm, fist]，标准 = + peace，进阶 = + pointing + ok

### displayTime 调优
- **1~1.5s**：极快，需要玩家预判并快速切换手势
- **2~3s**：标准节奏，大多数玩家可以舒适反应
- **3~5s**：宽松模式，适合儿童或首次接触手势游戏的用户
- **> 5s**：过于宽松，会感觉无聊
- 做出一个手势的物理时间约 0.5~1s，displayTime 应至少为此的 2 倍

### matchThreshold 调优
- **0.5~0.65**：极宽松，只要大致像就行（高误触率）
- **0.7~0.8**：标准游戏阈值，平衡准确性和可玩性
- **0.8~0.9**：精确模式，需要标准的手势姿态
- **> 0.9**：过于严格，可能导致正确手势也无法被识别
- 环境光线差或手部距离远时建议降低 0.05~0.1

### displayTime 与 DifficultyRamp 配合
- DifficultyRamp 可动态修改 GestureMatch.displayTime 实现难度递增
- 推荐渐进：3s → 2.5s → 2s → 1.5s（每 10s 或每 5 次成功后缩短）
- 最小值建议不低于 1s，否则物理上无法完成手势切换

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `gesture:show` | `{ target: string, displayTime: number }` | 新目标手势展示时 |
| `gesture:match` | `{ target: string, gesture: string, confidence: number }` | 手势匹配成功 |
| `gesture:fail` | `{ target: string, gesture: string\|null, confidence?: number, reason?: string }` | 手势错误或超时 |

**gesture:fail 的两种触发场景**：
1. **手势错误**：gesture !== currentTarget → payload 含 `gesture`（实际做的手势）
2. **超时**：displayTimer 到期 → `gesture: null, reason: 'timeout'`

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `input:hand:gesture` | HandInput | 调用 handleGesture 比较手势 |

## 跨模块联动规则

### 与 HandInput 的联动（上游）
```
HandInput → input:hand:gesture { gesture: 'thumbs_up', confidence: 0.85 }
    ↓
GestureMatch.handleGesture()
    ↓ 比较 gesture === currentTarget && confidence >= matchThreshold
```
- HandInput 必须存在且正确配置
- HandInput.gesture 应设为 `'any'`（允许所有手势通过），GestureMatch 自行过滤
- HandInput.confidence 是第一层过滤（HandInput 层），matchThreshold 是第二层（GestureMatch 层）
- 建议 HandInput.confidence <= matchThreshold，让更多事件到达 GestureMatch

### 与 Scorer 的联动
- Scorer 需设置 `hitEvent = 'gesture:match'` 监听匹配成功事件
- 每次 gesture:match 触发一次加分
- gesture:fail 不直接触发扣分（需额外配置 Scorer 监听 gesture:fail 或 deductOnMiss）

### 与 Timer / GameFlow 的联动
- GestureMatch 受 `gameflowPaused` 控制，暂停时 displayTimer 不推进
- `start()` 需外部调用（通常在 GameFlow 进入 playing 后）
- GestureMatch 无自动结束机制，依赖 Timer 或外部逻辑触发 GameFlow 结束

### 与 ComboSystem 的联动
- 连续 gesture:match → Scorer 连续加分 → ComboSystem 连击递增
- gesture:fail 中断连击（Scorer 超时后 combo 归零）
- ComboSystem.comboWindow 应 >= displayTime（否则正常节奏也会丢 combo）

### 与 DifficultyRamp 的联动
- DifficultyRamp 可修改 GestureMatch 的 displayTime（时间递减）
- DifficultyRamp 也可修改 matchThreshold（精度递增）
- 推荐只调 displayTime，保持 matchThreshold 不变（避免玩家感觉"明明做对了但不算"）

### 与反馈模块的联动
- **UIOverlay**：监听 gesture:show 显示目标手势图标和倒计时
- **ParticleVFX**：监听 gesture:match 在手部位置播放特效
- **SoundFX**：gesture:match → 正确音效，gesture:fail → 错误/超时音效

## 输入适配

| 输入方式 | 适配策略 |
|---------|---------|
| HandInput | 原生支持，监听 `input:hand:gesture` |
| FaceInput | 不适用 — 面部事件不含手势信息 |
| TouchInput | 不适用 — 触屏无法做手势 |
| BodyInput | 理论上可扩展：全身姿势匹配（如举手、蹲下），需自定义事件映射 |
| DeviceInput | 不适用 |
| AudioInput | 不适用 |

## 常见 Anti-Pattern

**1. HandInput.gesture 不是 'any'**
- ❌ `HandInput.gesture = 'thumbs_up'` → HandInput 只传递 thumbs_up 事件，其他手势被过滤
- ✅ `HandInput.gesture = 'any'`，让 GestureMatch 负责手势匹配逻辑

**2. displayTime 过短导致物理上无法完成**
- ❌ `displayTime = 0.5s` — 做出手势需要约 0.5~1s，加上识别延迟根本来不及
- ✅ displayTime >= 1.5s（最低限度）

**3. targetGestures 只有一种**
- ❌ `targetGestures = ['thumbs_up']` — 玩家只需保持一个手势不动
- ✅ 至少 3 种手势，强制玩家切换

**4. matchThreshold 高于 HandInput.confidence**
- ❌ `HandInput.confidence = 0.9`, `matchThreshold = 0.8` — HandInput 已过滤掉 0.8~0.9 的事件
- ✅ HandInput.confidence <= matchThreshold（通常 HandInput.confidence = 0.7, matchThreshold = 0.8）

**5. Scorer.hitEvent 未设置为 gesture:match**
- ❌ Scorer 默认监听 `collision:hit`，gesture:match 被忽略
- ✅ 设置 `Scorer.hitEvent = 'gesture:match'`

**6. 连续相同手势导致体验单调**
- ❌ random 选取可能连续 3 次 thumbs_up — 玩家无需切换手势
- ✅ 当前实现允许重复，如需去重可在外部封装 nextTarget 逻辑

## 常见问题 & 边界情况

- `start()` 初始化 matchCount、totalTargets 并调用 nextTarget()，必须外部显式调用
- nextTarget() 使用 `Math.random()` 随机选取，不保证均匀分布或不重复
- targetGestures 为空数组时，nextTarget() 直接返回，模块静默无输出
- displayTimer 以毫秒累加（dt 为毫秒），但 displayTime 参数以秒为单位（内部 * 1000 转换）
- handleGesture 在 active=false 或 currentTarget=null 时不处理
- gesture:fail 在手势错误时立即触发（不等待），但不会自动切换目标 — 只有超时和匹配成功才触发 nextTarget()
- `getProgress()` 返回 `{ matched, total }` — total 是 targetGestures.length（手势种类数），不是游戏总轮数
- `reset()` 清零所有状态，重新 `start()` 可复用
- gameflowPaused 时 displayTimer 不推进，但 handleGesture 仍响应输入（类似 ExpressionDetector 的边界情况）
- 如果 HandInput 未注入 tracker 或摄像头权限被拒绝，无手势事件，模块在 displayTime 后自动 timeout
