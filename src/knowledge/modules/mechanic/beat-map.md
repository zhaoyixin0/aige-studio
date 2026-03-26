# BeatMap — 节奏系统模块

## 基本信息
- 类型: mechanic
- 类名: `BeatMap`
- 注册名: `BeatMap`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/beat-map.ts`

## 功能原理

BeatMap 是节奏游戏的核心计时模块，管理节拍时间轴和玩家输入的时机判定。它维护一个有序的 beat 时间戳数组，在游戏运行时追踪已过时间（elapsed），将玩家输入时间与最近的 beat 时间戳比较，根据时间差（tolerance）判定命中或失误。

### 核心流程
```
BeatMap.start()
    ↓ 生成 beat 数组（从 BPM 自动计算 或 使用显式 beats）
    ↓
BeatMap.update(dt)
    ↓ elapsed += dt
    ↓ 检查 pendingInput：玩家是否有未处理的输入？
    │   ├── 有 → 遍历 beats 找最近的 beat
    │   │       ├── |inputTime - beatTime| <= tolerance → beat:hit
    │   │       └── 无匹配 → beat:miss（玩家乱按）
    │   └── 无 → 跳过
    ↓ 检查过期 beats：elapsed > beats[beatIndex] + tolerance ?
        └── 是 → beat:miss（漏拍）, beatIndex++
```

### Beat 生成
- **显式模式**：使用 `beats` 参数提供的时间戳数组（毫秒），适合预制关卡
- **BPM 模式**：当 `beats` 为空时，自动按 BPM 生成 32 个等间距 beat（interval = 60000 / bpm ms）

### 判定精度（Accuracy）
命中时计算 accuracy = `1 - diff / tolerance`，值域为 [0, 1]：
- accuracy = 1.0 → 完美命中（inputTime 恰好等于 beatTime）
- accuracy ≈ 0.5 → 中等偏移
- accuracy → 0 → 接近 tolerance 边缘

### 业界参考 — 判定窗口

| 游戏 | Perfect | Great | Good | Miss |
|------|---------|-------|------|------|
| DDR (Marvelous) | ±15ms | ±30ms | ±50ms | >100ms |
| osu! (最高难度) | ±18ms | ±50ms | ±85ms | >85ms |
| IIDX (Just Great) | ±16.67ms | ±33ms | ±100ms | >100ms |
| Rhythm Horizon | ±15ms | ±30ms | ±50ms | >100ms |
| **AIGE BeatMap** | tolerance 内 accuracy ≈ 1 | accuracy ≈ 0.7 | accuracy ≈ 0.3 | 超出 tolerance |

AIGE BeatMap 使用连续精度值而非离散判定等级。下游模块（Scorer/UI）可根据 accuracy 映射为等级：
```
accuracy >= 0.9 → Perfect
accuracy >= 0.7 → Great
accuracy >= 0.4 → Good
accuracy < 0.4  → 虽然 hit 但质量很差
```

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| bpm | range | `120` | 60~200，步长 1 | 80~160 | 每分钟节拍数（仅在 beats 为空时生效） |
| tolerance | range | `200` | 50~500ms，步长 10 | 100~300ms | 判定窗口宽度（毫秒），±tolerance 内算命中 |
| beats | object | `[]` | 毫秒时间戳数组 | — | 显式 beat 时间序列，优先级高于 BPM 自动生成 |

### 参数推荐值（按难度）

| 难度 | bpm | tolerance | 对应体验 |
|------|-----|-----------|---------|
| 入门 | 80~100 | 300~400ms | 节拍慢+窗口宽，儿童/新手友好 |
| 简单 | 100~120 | 200~300ms | 标准休闲节奏游戏 |
| 普通 | 120~140 | 150~200ms | 需要一定节奏感 |
| 困难 | 140~170 | 100~150ms | 接近主流音游水平 |
| 专家 | 170~200 | 50~100ms | 硬核音游玩家 |

### BPM 与 tolerance 的关系
- beat 间距 = 60000 / bpm ms（120 BPM = 500ms 间距）
- tolerance 应 < beat 间距 / 2，否则相邻 beat 的判定窗口会重叠
- 推荐：tolerance <= 60000 / bpm / 3（120 BPM → tolerance <= 166ms）
- 极端：tolerance >= beat 间距 时，任意时刻按下都能命中某个 beat

## 参数调优指南

### bpm 调优
- **60~80 BPM**：极慢节奏，适合教学或冥想类
- **80~120 BPM**：标准流行音乐节奏（大多数流行歌在 90~130 BPM）
- **120~150 BPM**：中快节奏，舞曲/电子乐常见区间
- **150~200 BPM**：快速节奏，需要高反应速度
- 经验法则：用户自然拍手/点头的节奏约 100~120 BPM

### tolerance 调优
- tolerance 决定了"精确度要求"，是难度的核心旋钮
- **< 100ms**：硬核音游体验，需要精确到帧的输入
- **100~200ms**：标准休闲游戏，Fruit Ninja 节奏约 150ms
- **200~300ms**：宽松模式，适合触屏设备（触屏延迟约 50~100ms）
- **> 300ms**：极度宽松，几乎只要"大概在节拍附近"就行
- 触屏设备建议 tolerance += 50ms 补偿触控延迟

### beats 数组设计
- 时间戳必须单调递增（否则遍历逻辑会跳过）
- 支持不等间距 beat（可模拟变速曲/自由节奏）
- 当前固定生成 32 个 beat，总时长 = 32 * (60000 / bpm)
- 120 BPM → 32 * 500ms = 16 秒；如需更长游戏时间，需提供显式 beats 或增加 beat 数量

### accuracy 到分数的映射建议
```
// 在 Scorer 或自定义逻辑中
if (accuracy >= 0.9) score = 100;      // Perfect
else if (accuracy >= 0.7) score = 75;  // Great
else if (accuracy >= 0.4) score = 50;  // Good
else score = 25;                        // OK
```

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `beat:hit` | `{ beatIndex: number, beatTime: number, inputTime: number, accuracy: number }` | 玩家输入在 tolerance 窗口内 |
| `beat:miss` | `{ inputTime?, beatIndex?, beatTime?, nearestBeat? }` | 玩家乱按（无匹配 beat）或 beat 过期未被击中 |

**beat:miss 的两种触发场景**：
1. **玩家乱按**：pendingInput 存在但遍历所有 beat 无匹配 → payload 含 `inputTime` + `nearestBeat`
2. **漏拍**：beat 过期（elapsed > beatTime + tolerance）→ payload 含 `beatIndex` + `beatTime`

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `input:touch:tap` | TouchInput | 记录 pendingInput + pendingInputTime |
| `input:face:*` | FaceInput | 记录 pendingInput + pendingInputTime |

## 跨模块联动规则

### 与 Scorer 的联动
```
BeatMap → beat:hit { accuracy }
    ↓
Scorer 监听 beat:hit（需设置 hitEvent = 'beat:hit'）
    ↓ 根据 accuracy 计算分数
    ↓ scorer:update
```
- Scorer.hitEvent 必须设为 `'beat:hit'`（默认 `collision:hit` 不匹配）
- Scorer.perHit 作为基础分，可乘以 accuracy 做精度加权
- beat:miss 的扣分需要 Scorer 额外监听 `beat:miss` 或使用 deductOnMiss

### 与 Timer 的联动
- Timer 可设为 countdown 模式限制游戏时长
- 或 Timer 设为 stopwatch 记录演奏时间
- BeatMap 内部有独立 elapsed 时钟，不依赖 Timer
- 注意：如果音乐有固定时长，Timer.duration 应匹配音乐时长

### 与 GameFlow 的联动
- BeatMap 受 `gameflowPaused` 控制，暂停时 update 不推进 elapsed
- 需要外部调用 `start()` 启动节拍序列
- 所有 beat 消耗完后不自动结束游戏（需 Timer 或自定义逻辑触发 GameFlow 结束）

### 与 ComboSystem 的联动
- 连续 beat:hit → Scorer 连续加分 → ComboSystem 连击递增
- beat:miss 会中断连击（通过 Scorer 的 combo 超时机制）
- ComboSystem.comboWindow 应 >= beat 间距（60000 / bpm），否则连续完美命中也会丢 combo

### 与 Spawner 的联动（视觉 Note 生成）
- 可选：Spawner 根据 beat 时间提前生成"音符"精灵
- 音符到达判定区的时间应与 beat 时间对齐
- 音符移动速度 = 判定区距生成区距离 / (beatTime - 提前量)

### 与反馈模块的联动
- **ParticleVFX**：beat:hit → 根据 accuracy 选择特效级别（Perfect 最华丽）
- **SoundFX**：beat:hit → 命中音效，beat:miss → 失误音效
- **UIOverlay**：显示当前节拍进度、判定结果文字（Perfect/Great/Good/Miss）

## 输入适配

| 输入方式 | 适配策略 |
|---------|---------|
| TouchInput | 原生支持，监听 `input:touch:tap` |
| FaceInput | 原生支持，监听 `input:face:*`（表情触发节拍） |
| HandInput | 需扩展：当前未监听 `input:hand:*`，需通过 wiring 或修改模块 |
| BodyInput | 需扩展：身体动作触发节拍需自定义事件映射 |
| DeviceInput | 需扩展：设备摇动触发节拍需自定义事件映射 |
| AudioInput | 高潜力：声音/拍手触发节拍，需将 `input:audio:*` 映射到 onPlayerInput |

## 常见 Anti-Pattern

**1. tolerance 大于 beat 间距的一半**
- ❌ bpm = 120（间距 500ms），tolerance = 300ms → 相邻 beat 判定窗口重叠
- ✅ tolerance < 60000 / bpm / 2（120 BPM → tolerance < 250ms）

**2. 忘记调用 start()**
- ❌ init 后直接开始输入，但 started = false → 所有输入被忽略
- ✅ 在 GameFlow 进入 playing 状态后调用 `beatMap.start()`

**3. beats 数组为空且 BPM 生成不足**
- ❌ 游戏时长 60s 但 BPM=120 只生成 32 beat → 32 * 500ms = 16s，后 44s 无 beat
- ✅ 提供覆盖完整游戏时长的显式 beats 数组

**4. Scorer.hitEvent 未设置为 beat:hit**
- ❌ Scorer 默认监听 `collision:hit`，beat:hit 事件被忽略
- ✅ 设置 `Scorer.hitEvent = 'beat:hit'`

**5. ComboSystem.comboWindow 小于 beat 间距**
- ❌ bpm = 80（间距 750ms），comboWindow = 500ms → 即使每拍都 hit 也会丢 combo
- ✅ comboWindow >= 60000 / bpm * 1.2

**6. 未处理 beat:miss 的两种情况**
- ❌ UI 层只处理 "漏拍" 类型的 miss，忽略 "乱按" 类型
- ✅ 根据 payload 区分：有 beatIndex → 漏拍；有 inputTime + nearestBeat → 乱按

## 常见问题 & 边界情况

- `start()` 清零 elapsed/beatIndex 并生成 beats，可用于重新开始
- beats 数组在 start() 时生成快照（`[...explicitBeats]`），运行时不可动态修改
- pendingInput 每帧只处理一次（最新输入），多次快速输入只保留最后一次
- beatIndex 单调递增，已过的 beat 不可回溯命中
- beat:hit 后 beatIndex 跳到 i+1，该 beat 不可被重复命中
- elapsed 以毫秒累加，不做帧率补偿；极端大 dt（如浏览器切后台）会导致大量 beat:miss 事件
- BPM 自动生成固定 32 个 beat，不可配置数量（需显式 beats 覆盖）
- `getElapsed()` 返回毫秒值（注意：不像 Timer 返回秒）
- `getBeats()` 返回 beats 的副本（不可修改原数组）
- `getCurrentBeatIndex()` 返回下一个待判定的 beat 索引
- `reset()` 清零所有状态，重新 start() 可复用
- gameflowPaused 时 update 不推进 elapsed，但 onPlayerInput 仍可被触发（输入被缓存，恢复后在下一帧处理）
