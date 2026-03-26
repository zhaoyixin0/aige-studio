# StaticPlatform — 静态平台模块

## 基本信息
- 类型: mechanic
- 类名: `StaticPlatform`
- 注册名: `StaticPlatform`
- 文件: `src/engine/modules/mechanic/static-platform.ts`
- 依赖: 无（独立模块）
- 可选联动: Gravity, Jump, PlayerMovement, CameraFollow, MovingPlatform, OneWayPlatform, CrumblingPlatform, WallDetect

## 功能原理

StaticPlatform 是平台系统的基础模块，管理固定位置的矩形平台碰撞体。每个平台定义为 `PlatformRect`（x, y, width, height, material），模块提供 AABB（轴对齐包围盒）碰撞检测和材质摩擦力查询。

**平台碰撞检测流程：**
1. 外部代码（渲染器/物理管理器）每帧调用 `checkCollision(px, py)` 传入玩家位置
2. 遍历所有平台，进行 AABB 点-矩形碰撞检测
3. 判定条件: `px >= p.x && px <= p.x + p.width && py >= p.y && py <= p.y + p.height`
4. 碰撞成立时:
   - 发出 `platform:contact` 事件（含 id, index, material, x, y）
   - 返回碰撞到的平台数据（含 index）
5. 未碰撞则返回 null

**材质摩擦力系统：**
```
材质        摩擦系数    物理效果
normal      0.8        标准地面，正常减速
ice         0.1        冰面，几乎不减速，大量滑行
sticky      1.0        粘地面，瞬间停止
```

摩擦力公式（与 PlayerMovement 配合时）:
```
有效减速度 = deceleration * friction
有效加速度 = acceleration * friction  （可选）

冰面滑行距离 = speed² / (2 * deceleration * 0.1) = 5 * 标准减速距离
粘面减速距离 = speed² / (2 * deceleration * 1.0) = 标准减速距离
```

**碰撞检测特点：**
- 点-矩形测试（非矩形-矩形），假设玩家碰撞体为一个点
- 遍历式检测（O(n)），无空间分区优化
- 不处理碰撞响应（穿透推出、速度修正），仅报告碰撞
- update() 为空——静态平台不需要每帧更新

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| platforms | object | `[]` | PlatformRect 数组 | — | 平台定义列表，每个元素含 x, y, width, height, material |
| layer | string | `'platforms'` | 任意字符串 | `'platforms'` | 碰撞图层名（与 Collision 模块图层系统对应） |
| friction | range | `0.8` | 0 ~ 1，步长 0.01 | 0.7 ~ 0.9 | 全局默认摩擦系数（当平台无 material 时使用） |
| asset | asset | `''` | 资源 ID | — | 平台贴图资源 |
| tileMode | select | `'stretch'` | stretch / repeat | — | 贴图模式: 拉伸 / 平铺重复 |

### PlatformRect 结构

| 字段 | 类型 | 说明 | 有效范围 |
|------|------|------|----------|
| x | number | 平台左上角 X (px) | 0 ~ canvasWidth |
| y | number | 平台左上角 Y (px) | 0 ~ canvasHeight |
| width | number | 平台宽度 (px) | 20 ~ canvasWidth |
| height | number | 平台高度 (px) | 10 ~ 200 |
| material | string | 材质类型 | `'normal'` / `'ice'` / `'sticky'` |

### 平台尺寸推荐

| 平台用途 | width | height | 说明 |
|----------|-------|--------|------|
| 地面/长平台 | 600 ~ 1080 | 30 ~ 50 | 关卡底部的主平台 |
| 标准跳跃平台 | 100 ~ 200 | 20 ~ 30 | 正常跳跃间距的平台 |
| 窄平台/精密 | 40 ~ 80 | 15 ~ 25 | 需要精准落地的挑战平台 |
| 宽着陆区 | 200 ~ 400 | 20 ~ 30 | 安全落地区域 |
| 墙壁 | 20 ~ 40 | 200 ~ canvasHeight | 垂直障碍，配合 WallDetect |

### 平台垂直间距参考（配合 Jump 模块）

```
最大可达高度 = jumpForce² / (2 * gravity) * 0.85（安全余量）
推荐间距 = 最大可达高度 * 0.6 ~ 0.8
```

| Jump.jumpForce | Jump.gravity | 跳跃高度 | 推荐平台间距 | 最大安全间距 |
|----------------|-------------|----------|-------------|-------------|
| 400 | 980 | 82px | 49 ~ 65px | 70px |
| 500 | 980 | 128px | 77 ~ 102px | 109px |
| 600 | 980 | 184px | 110 ~ 147px | 156px |
| 700 | 1200 | 204px | 122 ~ 163px | 173px |

## 参数调优指南

### 材质系统与关卡设计

不同材质的平台应按游戏节奏分布：

| 材质 | 适用场景 | 关卡分布建议 | 对应手感 |
|------|---------|-------------|---------|
| normal | 基础关卡 | 占总平台 70% ~ 90% | Celeste 标准地面 |
| ice | 中后期挑战 | 占 5% ~ 20%，连续不超过 3 个 | Super Meat Boy 冰面关 |
| sticky | 缓冲区/安全区 | 在高难度段前后放置 | 作为节奏调节 |

**材质混合设计原则（参考 Celeste）：**
- 首次引入冰面平台时，在安全区域让玩家体验滑行效果
- 不要在需要精准落地的区域使用冰面
- 粘面适合作为 boss 战的地面（减少移动失误）

### tileMode 选择

| 模式 | 视觉效果 | 适用场景 |
|------|---------|---------|
| stretch | 贴图拉伸填满整个平台 | 有独立平台美术的情况 |
| repeat | 贴图水平/垂直重复 | 使用地砖/砖块类贴图 |

**推荐**: 长平台用 repeat（避免拉伸变形），短平台用 stretch

### 画布尺寸与平台布局

| 画布 (WxH) | 推荐平台数 | 地面 Y | 最高平台 Y | 说明 |
|------------|-----------|--------|-----------|------|
| 1080x1920 | 10 ~ 25 | 1860 | 200 ~ 400 | 标准竖屏，纵向空间充足 |
| 1280x720 | 8 ~ 15 | 680 | 100 ~ 200 | 横屏，适合横版关卡 |
| 800x600 | 6 ~ 12 | 560 | 80 ~ 150 | 小画布，平台需更紧凑 |

### 平台厚度与防穿透

```
最小安全厚度 = terminalVelocity * (1 / minFPS)
```

| Gravity.terminalVelocity | 30fps (dt=33ms) | 60fps (dt=16ms) | 推荐 height |
|--------------------------|-----------------|-----------------|-------------|
| 600 | 20px | 10px | >= 25px |
| 800 | 26px | 13px | >= 30px |
| 1000 | 33px | 16px | >= 40px |

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `platform:contact` | `PLATFORM_CONTACT` | `{ id: string, index: number, material: string, x: number, y: number }` | checkCollision() 检测到碰撞时 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:resume` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | 暂停模块（BaseModule 统一处理） |

### 事件流转示意

```
渲染器/物理管理器 每帧调用:
  staticPlatform.checkCollision(playerX, playerY)
    → 碰撞成立 → emit('platform:contact', { id, index, material, x, y })
      → 渲染器: 更新 Gravity.floorY = platform.y（防止穿透）
      → 渲染器: 应用 friction 到 PlayerMovement（可选）
      → SoundFX: 播放着陆音效（可选）
    → 返回 PlatformRect → 渲染器据此调整玩家 Y 位置

  staticPlatform.getFriction(material)
    → 返回摩擦系数 → PlayerMovement 用于计算有效减速度
```

## 跨模块联动规则

### 与 Gravity 模块

**核心集成问题**: Gravity 使用固定 floorY，StaticPlatform 是独立碰撞检测。两者没有自动集成。

- **每帧同步方案**: 渲染器在检测到平台碰撞后，手动更新 Gravity 对象的 `floorY = platform.y`
- 当玩家离开平台边缘时，需要将 floorY 恢复为默认地面高度
- **注意**: 如果不同步 floorY，玩家会穿透平台继续下落到 floorY 位置

### 与 Jump 模块

- Jump.groundY 需要与当前站立的平台 Y 坐标同步
- 当玩家在不同高度的平台之间跳跃时，groundY 应动态更新
- **建议**: 每帧检测平台碰撞后更新 Jump 的内部 y 和 grounded 状态

### 与 PlayerMovement 模块

- PlayerMovement 不做水平碰撞检测，角色可以穿过平台的垂直面
- 需要配合 WallDetect 实现墙壁阻挡
- StaticPlatform.friction 当前不自动影响 PlayerMovement 的减速度
- **集成方案**: `effectiveDeceleration = PlayerMovement.deceleration * StaticPlatform.getFriction(material)`

### 与 MovingPlatform / OneWayPlatform / CrumblingPlatform

- 所有平台类型共享 `layer` 参数（默认 `'platforms'`）
- 渲染器需要在每帧按顺序检测所有平台类型的碰撞
- **优先级建议**: CrumblingPlatform > OneWayPlatform > MovingPlatform > StaticPlatform
- 如果碰撞到 CrumblingPlatform 就不再检测其他类型（玩家脚下只有一个平台）

### 与 WallDetect 模块

- StaticPlatform 的竖直平台（窄宽高高的矩形）可以作为墙壁
- WallDetect 需要在水平方向检测玩家是否与平台侧面碰撞
- **当前**: WallDetect 的墙壁检测需要外部代码调用 `setWallContact(side)`，不与 StaticPlatform 自动集成

### 与 CameraFollow 模块

- CameraFollow 的 bounds 应根据平台的最大/最小坐标设置
- bounds.minX/maxX 应包含所有平台的水平范围
- bounds.minY/maxY 应包含最高和最低平台

## 输入适配

StaticPlatform 本身不直接响应输入事件，但其行为通过玩家移动间接受输入影响：

| 输入方式 | 影响 | 建议 |
|----------|------|------|
| TouchInput | 精确的水平移动，可精准落在窄平台上 | 平台宽度可以较小（60px+） |
| FaceInput | 位置追踪有延迟，落地不够精确 | 平台宽度增大到 120px+，减少窄平台 |
| HandInput | 中等精度 | 平台宽度 100px+ |
| DeviceInput | 陀螺仪有飘移 | 增大平台宽度，减少精密跳跃段 |
| AudioInput | 不适用于位置控制 | 仅用于触发跳跃，不影响平台设计 |

## 常见 Anti-Pattern

**平台 height 过薄导致穿透**
- 错误: `height: 5` + `terminalVelocity: 800` → 低帧率下角色穿过平台
- 正确: `height >= 25px`（保证在 30fps 下不穿透）

**平台间距超过跳跃高度**
- 错误: 平台垂直间距 200px，但 `jumpForce: 500, gravity: 980` 只能跳 128px
- 正确: 间距 <= 跳跃高度 * 0.85

**所有平台使用 ice 材质**
- 错误: 全部冰面 → 玩家完全无法精准操控，体验极差
- 正确: 冰面作为挑战元素穿插使用，在安全区域引入

**平台数组为空**
- 错误: `platforms: []` → 模块存在但无平台，玩家永远在下落
- 正确: 至少有一个地面平台

**平台重叠**
- 错误: 两个平台在相同位置重叠 → checkCollision 返回第一个匹配，可能导致不一致
- 正确: 平台之间不应有重叠区域

**忘记同步 Gravity.floorY**
- 错误: 只用 StaticPlatform 做碰撞检测但不更新 Gravity.floorY → 角色视觉在平台上，但 Gravity 认为角色在空中
- 正确: 碰撞后立即同步 floorY

## 常见问题 & 边界情况

- `checkCollision()` 是被动方法，需要外部每帧主动调用
- 碰撞检测是点-矩形测试，不是矩形-矩形；如果玩家有碰撞体积，边缘可能不准确
- `platform:contact` 事件在每次碰撞检测成功时都会发出，不是只在首次着陆时
- `getPlatforms()` 返回 params.platforms 的引用，修改返回值会影响原始数据
- `getFriction()` 优先使用指定 material 的摩擦力，没有 material 时回退到全局 friction 参数
- `update()` 为空操作——静态平台没有状态变化
- `reset()` 为空操作——静态平台没有需要重置的运行时状态
- platforms 数组在运行时不可修改（没有 addPlatform / removePlatform 方法）
- 不支持倾斜/斜坡平台——所有平台都是轴对齐矩形
- 不支持圆形或多边形平台碰撞体
