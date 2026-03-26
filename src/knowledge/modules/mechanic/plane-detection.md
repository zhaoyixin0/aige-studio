# PlaneDetection — AR 平面检测模块

## 基本信息
- 类型: mechanic
- 类名: `PlaneDetection`
- 注册名: `PlaneDetection`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/plane-detection.ts`

## 功能原理

PlaneDetection 提供平面检测功能，将摄像头画面中的平面区域识别出来并转化为游戏可用的锚点。当前为 **Web 端简化实现**，基于亮度阈值模拟平面检测（非原生 WebXR/ARCore），同时保留了与 WebXR 标准对齐的事件协议，便于未来迁移。

### 核心流程
```
camera:frame { brightness, x, y, width, height }
    ↓
processFrame()
    ↓ enabled ?
    │   ├── 否 → 忽略
    │   └── 是 → brightness >= (1 - sensitivity) ?
    │       ├── 是 → 创建 DetectedPlane → planes.push() → emit plane:detected
    │       └── 否 → 忽略
    ↓
PlaneDetection.update(dt)
    ↓ scanTimer += dt
    ↓ scanTimer >= 2000 ? → (保留位，当前无自动扫描逻辑)
```

### 检测逻辑（当前简化版）
- 基于 `brightness * sensitivity` 计算 confidence
- brightness >= `1 - sensitivity` 时判定为平面（sensitivity 越高越容易检测）
- 这是一个**占位实现**，真实 AR 应使用 WebXR Plane Detection API 或 ARCore

### 模拟扫描（simulateScan）
- `simulateScan()` 方法用于无摄像头时的测试/演示
- 生成随机位置和尺寸的模拟平面
- confidence = 0.5 + random * 0.5，结合 sensitivity 判定
- 当前 update() 中的 2 秒定时器为保留位，未调用 simulateScan（需外部调用）

### 业界参考 — WebXR Plane Detection
- **W3C WebXR Hit Test Module**：通过 `requestHitTestSource` 投射射线到真实环境，返回碰撞点+表面法线
- **WebXR Plane Detection API**：`session.detectedPlanes` 返回 `XRPlane` 数组（含位置和多边形）
- **AR 锚点（Anchors）**：定义真实世界位置，虚拟物体固定在该位置
- **平面类型**：horizontal（地面/桌面）、vertical（墙壁）
- **浏览器支持**：Chrome（Android）支持 WebXR AR，Safari（iOS）有限支持

### 当前实现 vs WebXR 标准

| 特性 | 当前实现 | WebXR 标准 |
|------|---------|-----------|
| 平面检测 | 亮度阈值模拟 | 真实环境几何分析 |
| 平面类型 | 无区分 | horizontal / vertical |
| 坐标系 | 2D 画布坐标 (0~1) | 3D 世界坐标 |
| 锚点 | 无 | XRAnchor（持久空间位置） |
| Hit Test | 无 | 射线投射到真实表面 |
| 多边形 | 无（矩形近似） | XRPlane.polygon（精确边界） |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| enabled | boolean | `true` | — | — | 是否启用平面检测 |
| sensitivity | range | `0.5` | 0~1，步长 0.05 | 0.3~0.7 | 检测灵敏度（越高越容易检测到平面） |

### sensitivity 调优

| sensitivity 值 | 检测难度 | 适用场景 |
|---------------|---------|---------|
| 0.2~0.3 | 高（仅明亮表面） | 精确检测，减少误报 |
| 0.4~0.5 | 中 | 标准使用 |
| 0.6~0.7 | 低（大多数表面） | 宽松检测，适合演示 |
| 0.8~1.0 | 极低（几乎任何画面） | 调试/测试用 |

## 参数调优指南

### enabled 的用途
- 动态开关检测功能（如进入特定游戏阶段后启用 AR）
- 节省计算资源：不需要 AR 时关闭
- 可通过 `configure({ enabled: false })` 运行时切换

### sensitivity 与环境的关系
- 当前简化实现中 sensitivity 直接影响 `brightness >= 1 - sensitivity` 的判定
- 高 sensitivity → 更多"平面"被检测（含更多误报）
- 低 sensitivity → 只有最明显的区域被检测
- 真实 WebXR 中 sensitivity 可映射为平面检测的最小面积阈值或置信度要求

### 与未来 WebXR 的迁移路径
```
当前：camera:frame → processFrame → plane:detected
未来：XRSession.detectedPlanes → 转换 → plane:detected（事件格式不变）
```
- plane:detected 的 payload 格式保持向后兼容
- 迁移时只需替换 processFrame 内部逻辑，下游模块无需修改

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `plane:detected` | `{ x: number, y: number, width: number, height: number, confidence: number }` | 检测到符合条件的平面 |

**plane:detected Payload 说明**：
- `x, y`：平面中心位置（归一化坐标 0~1，或像素坐标取决于 camera:frame 的数据）
- `width, height`：平面尺寸
- `confidence`：置信度（brightness * sensitivity）

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `camera:frame` | 摄像头/外部系统 | 调用 processFrame 处理帧数据 |

## 跨模块联动规则

### 与 Spawner 的联动
```
PlaneDetection → plane:detected { x, y, width, height }
    ↓
Spawner 在检测到的平面位置生成虚拟物体
    ↓ 物体锚定在平面上
```
- Spawner 可监听 `plane:detected` 在平面位置生成物体
- 需要自定义 wiring 将平面坐标映射为 Spawner 的生成区域

### 与 Collision 的联动
- 检测到的平面可注册为 Collision 的碰撞区域
- 玩家与平面上的物体碰撞触发游戏事件
- 需要坐标系转换（平面的 2D 坐标 → 游戏画布坐标）

### 与 BodyInput 的联动
- world-ar 游戏类型：BodyInput 提供身体位置，PlaneDetection 提供环境平面
- 两者结合实现"在真实平面上放置虚拟物体，用身体与之互动"
- 通过 Collision 间接关联

### 与 GameFlow 的联动
- PlaneDetection 受 `gameflowPaused` 控制，暂停时 update 不推进 scanTimer
- 但 `camera:frame` 事件在暂停时仍会触发 processFrame（类似其他输入模块的边界情况）
- enabled 参数可在运行时切换，支持分阶段启用 AR

### 与反馈模块的联动
- **ParticleVFX**：plane:detected → 在平面位置显示检测指示器
- **SoundFX**：plane:detected → 检测成功提示音
- **UIOverlay**：显示已检测到的平面数量和状态

## 输入适配

PlaneDetection 不直接处理用户输入，它处理摄像头帧数据：

| 输入方式 | 适配策略 |
|---------|---------|
| camera:frame | 原生支持，摄像头每帧数据 |
| TouchInput | 配合使用：触屏点击选择检测到的平面（需自定义逻辑） |
| FaceInput | 不相关 |
| HandInput | 配合使用：手势指向平面位置放置物体 |
| BodyInput | 配合使用：身体与平面上物体互动 |
| DeviceInput | 配合使用：设备朝向影响检测区域（未来） |
| AudioInput | 不相关 |

## 常见 Anti-Pattern

**1. 在无摄像头环境中使用但未启用模拟**
- ❌ enabled=true 但无 camera:frame 事件源 → 模块永远检测不到平面
- ✅ 无摄像头时调用 `simulateScan()` 进行模拟测试

**2. sensitivity 设为 1.0**
- ❌ sensitivity=1.0 → `1 - sensitivity = 0`，任何 brightness >= 0 都触发 → 每帧生成平面
- ✅ sensitivity <= 0.8，保留合理的检测门槛

**3. 未处理平面累积**
- ❌ planes 数组无限增长，从不清理 → 内存泄漏
- ✅ 定期调用 `clearPlanes()` 或限制 planes 数组最大长度

**4. 假设 WebXR 可用**
- ❌ 直接使用 WebXR API 但用户浏览器不支持 → 整个功能不可用
- ✅ 当前实现已做 Web 端降级，使用亮度模拟

**5. plane:detected 坐标未转换**
- ❌ 直接使用 plane:detected 的归一化坐标作为画布像素坐标 → 物体位置错误
- ✅ 渲染层需将归一化坐标 (0~1) 映射到画布像素坐标

**6. 忘记检查 enabled 状态**
- ❌ 外部逻辑直接调用 processFrame 但 enabled=false → 内部已检查，不会检测，但调用是无效的
- ✅ 使用 `configure({ enabled: true/false })` 控制开关

## 常见问题 & 边界情况

- DetectedPlane 结构：`{ id: string, x: number, y: number, width: number, height: number, confidence: number }`
- plane.id 格式为 `plane-{counter}`，单调递增，全局唯一
- planes 数组只增不减（除非调用 `clearPlanes()`），需外部管理生命周期
- `getPlanes()` 返回深拷贝数组（`{ ...p }`），修改不影响内部状态
- processFrame 中 brightness 可来自 `data.brightness` 或 `data.averageBrightness`（兼容不同数据源）
- simulateScan() 生成随机数据：x/y ∈ [0,1)，width ∈ [0.3, 0.8)，height ∈ [0.2, 0.5)
- update() 中 2 秒定时器仅递减 scanTimer，当前不触发自动扫描（注释说明"只在无 camera feed 时扫描"）
- `reset()` 清空 planes 数组和 scanTimer 和 planeCounter
- gameflowPaused 时 update 不推进 scanTimer，但 camera:frame 事件仍可能触发 processFrame
- 当前实现不支持平面消失/更新（只增不删），真实 WebXR 中平面可能随相机移动而变化
- 坐标系：当前使用 camera:frame 传入的原始坐标，不做坐标系变换
- 性能注意：每帧 camera:frame 都可能生成新平面，高帧率下 planes 数组快速膨胀
