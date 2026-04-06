# Physics2D — 2D 刚体物理模块

## 基本信息
- 类型: mechanic
- 类名: `Physics2D`
- 注册名: `Physics2D`
- 文件: `src/engine/modules/mechanic/physics2d.ts`
- 系统: `src/engine/systems/physics2d/`（PlanckAdapter + planck.js v1.4.2）

## 功能原理

Physics2D 是 AIGE Studio 的 2D 刚体物理引擎，基于 planck.js（Box2D 的 JavaScript 实现），提供真实的物理模拟（重力、碰撞响应、弹性、摩擦、射线检测）。

**工作流程：**
1. 通过 `bodies` 参数配置初始刚体，或通过 `physics2d:add-body` 事件动态创建
2. 每帧 `update(dt)` 使用固定时间步（1/60s）推进物理模拟
3. 碰撞发生时发出 `physics2d:contact-begin/end` 事件
4. 渲染器通过 `getBodyPosition()` 查询体位置并同步到精灵

**与 Collision 模块的关系：**
- **Collision**: 高级游戏逻辑（命中检测、伤害路由、得分计算）
- **Physics2D**: 真实物理模拟（弹跳、弧线、刚体动力学）
- **共存时**: Physics2D 驱动位置 → 通过 AutoWirer 镜像到 Collision → Collision 保持为命中/伤害事件的唯一来源

## 完整参数表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| gravityX | number | 0 | 水平重力（m/s^2） |
| gravityY | number | 9.81 | 垂直重力（m/s^2） |
| pixelsPerMeter | number | 33.33 | 像素与米的换算比率 |
| bodies | object[] | [] | 初始刚体配置数组 |

## 刚体类型 (BodyType2D)

| 类型 | 说明 |
|------|------|
| `dynamic` | 受力和碰撞影响的动态物体（球、弹射物） |
| `static` | 不移动的固定物体（地面、墙壁） |
| `kinematic` | 程序控制移动的物体（移动平台） |

## 碰撞器形状 (ColliderShape2D)

| 形状 | 参数 | 说明 |
|------|------|------|
| Circle | radius, offset? | 圆形碰撞器 |
| Box | width, height, offset? | 矩形碰撞器 |
| Edge | points[], offset? | 折线碰撞器（地形、边界） |

## 碰撞器属性 (Collider2DConfig)

| 属性 | 类型 | 说明 |
|------|------|------|
| shape | ColliderShape2D | 碰撞器形状 |
| density | number | 密度（影响质量） |
| restitution | number | 弹性系数（0=不弹，1=完全弹） |
| friction | number | 摩擦系数 |
| isSensor | boolean | 传感器模式（检测重叠但不产生物理响应） |
| tag | string | 自定义标签（用于识别碰撞对） |

## API

| 方法 | 说明 |
|------|------|
| `addBody(entityId, bodyConfig, colliders, x, y)` | 添加刚体 |
| `removeBody(entityId)` | 移除刚体 |
| `getBodyPosition(entityId)` | 获取位置 `{x, y}` |
| `getBodyVelocity(entityId)` | 获取速度 `{x, y}` |
| `setBodyVelocity(entityId, vx, vy)` | 设置速度 |
| `applyImpulse(entityId, ix, iy)` | 施加冲量 |
| `raycast(fromX, fromY, toX, toY)` | 射线检测 |

## 事件

| 事件 | 触发时机 | Payload |
|------|----------|---------|
| `physics2d:contact-begin` | 两个碰撞器开始接触 | `{ entityIdA, entityIdB, tagA?, tagB?, pointX, pointY, normalX, normalY }` |
| `physics2d:contact-end` | 两个碰撞器分离 | 同上 |
| `physics2d:add-body` | 动态添加刚体 | `{ entityId, body, colliders, x, y }` |
| `physics2d:remove-body` | 移除刚体 | `{ entityId }` |
| `physics2d:debug:toggle` | 切换调试线框显示 | 无 |

## AutoWirer 桥接

| 桥接 | 说明 |
|------|------|
| Spawner + Physics2D | 生成物体自动创建刚体，销毁时移除 |
| Physics2D + Collision | 物理位置镜像到 Collision 对象（preUpdateHook） |
| Physics2D + Tween | 碰撞触发 Tween 动画（仅当 Collision 不存在时） |

## 常见配置模式

### 弹弓 (Slingshot)
```json
{
  "gravityX": 0, "gravityY": 9.81, "pixelsPerMeter": 33.33,
  "bodies": [
    { "entityId": "ground", "body": { "type": "static" },
      "colliders": [{ "shape": { "kind": "Edge", "points": [[0, 1800], [1080, 1800]] }, "friction": 0.5 }],
      "x": 0, "y": 0 }
  ]
}
```

### 弹球 (Bouncing Ball)
```json
{
  "gravityX": 0, "gravityY": 5.0, "pixelsPerMeter": 33.33
}
```
Spawner 创建的物体通过 Spawner+Physics2D 桥接自动获得刚体（Circle, restitution: 0.6）。

## 最佳实践

- **pixelsPerMeter**: 保持 33.33（匹配 Gravity 模块，对应 1080x1920 画布）
- **Body 数量**: 建议 <50 个动态刚体，避免性能问题
- **固定时间步**: 系统使用 1/60s，maxSubSteps=5 防止死亡螺旋
- **传感器模式**: 用 `isSensor: true` 实现触发区域（不产生物理碰撞响应）
- **调试**: 发出 `physics2d:debug:toggle` 事件显示线框覆盖层
