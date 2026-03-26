# ExpressionDetector — 表情检测模块

## 基本信息
- 类型: mechanic
- 类名: `ExpressionDetector`
- 注册名: `ExpressionDetector`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/expression-detector.ts`

## 功能原理

ExpressionDetector 将面部追踪数据转化为离散的"表情命中"事件。模块通配监听 `input:face:*`（包括 smile、blink、mouthOpen 等所有面部事件），根据配置的 `expressionType` 从事件 payload 中提取对应置信度值，与 `threshold` 比较，超过阈值则发出 `expression:detected` 事件。

### 核心流程
```
FaceInput → input:face:smile / input:face:blink / input:face:mouthOpen
    ↓
ExpressionDetector.handleFaceEvent(data)
    ↓ 提取 confidence（根据 expressionType 选择字段）
    ↓ confidence >= threshold ?
    ├── 是 → cooldown 检查 → 通过 → emit expression:detected
    └── 否 → 忽略
```

### 防抖机制（Cooldown）
每次成功检测后进入冷却期（`cooldown` 毫秒），期间所有面部事件被忽略。这防止了同一表情被连续多帧重复触发的"抖动"问题。冷却使用 `performance.now()` 时间戳精确控制。

### 视觉反馈定时器（matchFadeTimer）
成功匹配后内部设置 1500ms 的 `matchFadeTimer`，用于渲染层显示对勾/高亮等视觉反馈。`isMatched()` 在定时器倒计时期间返回 true，到期后自动清除。

### 置信度提取逻辑
- **smile / surprise / open-mouth**: 从 `data.value` 或 `data.confidence` 取值
- **wink**: 从 `Math.max(data.left, data.right)` 取值（眨眼事件为左右眼独立数据）

### 业界参考
- **TikTok 特效**：表情触发阈值通常 0.6~0.7，cooldown 500~800ms
- **Snapchat Lenses**：使用自适应阈值（运行时校准），cooldown 约 300~500ms
- **学术研究**：面部表情识别建议先采集 min/max 向量做归一化校准，再基于标准化值判定

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| expressionType | select | `'smile'` | `smile / surprise / wink / open-mouth` | — | 目标表情类型 |
| threshold | range | `0.7` | 0~1，步长 0.05 | 0.5~0.8 | 置信度阈值，越低越容易触发 |
| cooldown | range | `500` | 0~2000ms，步长 50 | 300~1000ms | 冷却时间（毫秒） |

### 参数推荐值（按游戏场景）

| 场景 | expressionType | threshold | cooldown | 说明 |
|------|---------------|-----------|----------|------|
| 表情挑战（竞速） | 按关卡切换 | 0.6 | 500ms | 低阈值+短冷却，追求速度 |
| 表情挑战（精准） | 按关卡切换 | 0.8 | 800ms | 高阈值+长冷却，追求精确 |
| 表情触发（单次） | smile | 0.7 | 1500ms | 一次触发即可，长冷却防误触 |
| 儿童向 | open-mouth | 0.5 | 300ms | 低阈值+短冷却，降低挫败感 |
| 社交互动 | wink | 0.7 | 1000ms | wink 精度较低需适当阈值 |

## 参数调优指南

### threshold 与 expressionType 的关系
- **smile（微笑）**：MediaPipe 检测精度最高，threshold 可设 0.6~0.8
- **open-mouth（张嘴）**：检测精度高，阈值 0.5~0.7 即可稳定触发
- **surprise（惊讶）**：包含眉毛+嘴巴综合特征，精度中等，建议 0.6~0.75
- **wink（眨眼/闭眼）**：取左右眼最大值，易受眨眼干扰，建议 0.7~0.85
- 环境光线差时所有表情精度下降，可动态降低 threshold 0.05~0.1

### cooldown 调优
- **< 300ms**：几乎无防抖，适合需要极快连续触发的场景（如表情连击）
- **300~500ms**：标准游戏节奏，TikTok 特效常用区间
- **500~1000ms**：一般表情挑战，避免"做一次表情触发两次"
- **1000~2000ms**：强制节奏控制，每次必须完全回到中性表情再触发
- 经验法则：cooldown >= 做出并恢复一个表情的物理时间（约 300~500ms）

### matchFadeTimer 的影响
- 固定 1500ms，当前不可配置
- 渲染层读取 `isMatched()` 和 `getMatchFadeTimer()` 实现视觉反馈
- 如果 cooldown < 1500ms，可能出现"上一个对勾还没消失就触发下一个"的重叠

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `expression:detected` | `{ expression: string, confidence: number }` | 置信度 >= threshold 且 cooldown 已过 |

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `input:face:*` | FaceInput | 通配监听所有面部事件，调用 handleFaceEvent |

## 跨模块联动规则

### 与 FaceInput 的联动（上游）
```
FaceInput → input:face:smile { value }
         → input:face:blink { left, right }
         → input:face:mouthOpen { value }
    ↓
ExpressionDetector 通配监听 input:face:*
    ↓ 根据 expressionType 提取对应 confidence
```
- FaceInput 必须存在并正确配置，否则无事件触发
- FaceInput.tracking 应设为与 expressionType 对应的模式（smile→smile, open-mouth→mouthOpen 等），但 ExpressionDetector 通配监听所有事件，不强依赖 tracking 模式
- FaceInput.smoothing 影响检测稳定性，smoothing 过低 → 抖动 → expression:detected 更容易被误触

### 与 Scorer 的联动
- Scorer 需设置 `hitEvent = 'expression:detected'` 来监听表情检测事件加分
- 或使用 AutoWirer 自动连线（expression 类游戏模板已预配）
- 每次 `expression:detected` 触发一次加分

### 与 Timer / GameFlow 的联动
- ExpressionDetector 受 `gameflowPaused` 控制，暂停时 update 不推进 matchFadeTimer
- 但 handleFaceEvent 通过 cooldown 时间戳控制，不受 gameflowPaused 影响（当前实现）
- GameFlow 暂停后面部事件仍会触发 handleFaceEvent — 这是一个已知边界情况

### 与 ComboSystem 的联动
- ComboSystem 监听 `scorer:update`，间接与 ExpressionDetector 关联
- 连续正确表情 → 连续 `expression:detected` → Scorer 连续加分 → ComboSystem 连击递增
- cooldown 直接影响连击最大频率：combo.window 应 >= cooldown

### 与反馈模块的联动
- **ParticleVFX**：监听 `expression:detected` 在面部位置播放特效
- **SoundFX**：监听 `expression:detected` 播放成功音效
- **UIOverlay**：显示当前目标表情图标和进度

## 输入适配

ExpressionDetector 专为面部输入设计，但事件架构允许其他输入模拟：

| 输入方式 | 适配策略 |
|---------|---------|
| FaceInput | 原生支持，直接监听 `input:face:*` |
| TouchInput | 不适用 — 触屏无法产生面部事件 |
| HandInput | 不适用 — 手势事件格式不同 |
| BodyInput | 不适用 |
| DeviceInput | 不适用 |
| AudioInput | 理论上可通过自定义 wiring 将音量事件转为 `input:face:*` 格式，但不推荐 |

## 常见 Anti-Pattern

**1. expressionType 与 FaceInput.tracking 不匹配**
- ❌ `FaceInput.tracking = 'headXY'`, `ExpressionDetector.expressionType = 'smile'` — headXY 模式不发出 smile 事件
- ✅ 确保 FaceInput.tracking 设为对应的表情模式，或使用 AutoWirer 自动适配

**2. threshold 过低导致误触**
- ❌ `threshold = 0.3` — 自然面部微动即可触发，玩家无需做出明显表情
- ✅ threshold >= 0.5，确保需要有意识的面部动作

**3. cooldown 远小于 combo.window**
- ❌ `cooldown = 100ms`, `combo.window = 500ms` — 一个表情可能在 combo 窗口内触发多次
- ✅ cooldown >= combo.window * 0.5，保证每个表情只计一次

**4. 忘记配置 Scorer.hitEvent**
- ❌ Scorer 使用默认 `hitEvent = 'collision:hit'`，但 ExpressionDetector 发出的是 `expression:detected`
- ✅ 设置 `Scorer.hitEvent = 'expression:detected'`，或依赖 AutoWirer 适配

**5. wink 类型误触频繁**
- ❌ `expressionType = 'wink'`, `threshold = 0.5` — 正常眨眼即触发
- ✅ wink 建议 threshold >= 0.7，并增加 cooldown 至 1000ms+

**6. GameFlow 暂停后仍触发检测**
- ❌ 结算画面期间表情事件仍被处理（handleFaceEvent 不检查 gameflowPaused）
- ✅ 当前实现的已知限制，渲染层应忽略暂停后的 `expression:detected` 事件

## 常见问题 & 边界情况

- `input:face:*` 是通配监听，会收到所有面部事件（move、smile、blink、mouthOpen）；handleFaceEvent 对非目标表情的事件可能返回 confidence = 0（因为字段不匹配），不会误触
- wink 的 confidence 取 `Math.max(left, right)`，单眼闭合即可触发（不区分左右眼）
- matchFadeTimer 固定 1500ms，不可通过参数配置
- `reset()` 清空 lastDetectTime、matched、matchFadeTimer，可用于关卡切换时重置
- `getExpressionType()` 返回当前配置的 expressionType，渲染层用于显示目标表情图标
- gameflowPaused 影响 update()（matchFadeTimer 倒计时），但不影响 handleFaceEvent（cooldown 检查）
- 如果 FaceInput 未注入 tracker 或摄像头权限被拒绝，不会有任何面部事件，ExpressionDetector 静默无输出
- 极端情况：如果面部追踪帧率极低（如 5fps），cooldown < 200ms 时实际效果等同于无 cooldown
