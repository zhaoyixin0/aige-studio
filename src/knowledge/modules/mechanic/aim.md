# Aim — 瞄准系统

## 模块定义

Aim 模块为射击系统提供瞄准方向。支持四种瞄准模式：auto（自动锁定最近敌人）、manual（跟随触摸/点击位置）、face（跟随面部移动方向）和 hand（跟随手部位置）。每帧发出归一化的方向向量 `aim:update { dx, dy }`，供 Projectile 模块确定弹丸飞行方向。auto 模式通过 `aim:queryTargets` 事件查询指定图层内的目标，选择距离玩家最近且在 autoRange 内的目标。

## 基本信息
- 类型: mechanic
- 类名: `Aim`
- 注册名: `Aim`
- 文件: `src/engine/modules/mechanic/aim.ts`
- 依赖: 无（独立模块）
- 可选联动: Projectile, EnemyAI, Collision, TouchInput, FaceInput, HandInput

## 核心参数

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| mode | select | `'auto'` | `auto` / `manual` / `face` / `hand` | 瞄准模式。auto 自动锁定最近敌人；manual 跟随触摸位置；face 跟随面部方向；hand 跟随手部位置 |
| autoTargetLayer | string | `'enemies'` | 任意图层名 | auto 模式下查询目标的碰撞图层名称 |
| autoRange | range | `500` | 100 ~ 2000 | auto 模式下的自动锁定范围 (px)，超出此距离的目标不会被锁定 |
| manualEvent | string | `'input:touch:hold'` | 任意事件名 | manual 模式下接收瞄准位置的事件名 |

### 瞄准模式对比

| 模式 | 输入方式 | 适用场景 | 操作难度 |
|------|----------|----------|---------|
| auto | 无需瞄准 | 休闲射击、弹幕游戏 | 低 |
| manual | 触摸/鼠标 | 精准射击、竞技游戏 | 高 |
| face | 面部追踪 | 创意交互、无障碍 | 中 |
| hand | 手势追踪 | 体感射击、AR 游戏 | 中 |

## 事件

| 事件名 | 方向 | 数据结构 | 说明 |
|--------|------|----------|------|
| `aim:update` | 发出 | `{ dx: number, dy: number, targetId?: string }` | 每帧发出归一化方向向量。auto 模式锁定目标时包含 targetId |
| `aim:queryTargets` | 发出 | `{ layer: string, callback: (targets) => void }` | auto 模式下查询碰撞图层中的目标列表（同步回调） |
| `player:move` | 监听 | `{ x: number, y: number }` | 更新玩家位置，用于计算瞄准方向 |
| `{manualEvent}` | 监听 | `{ x: number, y: number }` | manual 模式下接收瞄准坐标 |
| `input:face:move` | 监听 | `{ dx: number, dy?: number }` | face 模式下接收面部移动方向 |
| `input:hand:move` | 监听 | `{ x: number, y: number }` | hand 模式下接收手部位置坐标 |
| `gameflow:pause` | 监听 | — | 暂停瞄准更新 |
| `gameflow:resume` | 监听 | — | 恢复瞄准更新 |

### 事件流转示意

```
[auto 模式]
Aim.update() 每帧
  → emit('aim:queryTargets', { layer, callback })
    → Collision 模块响应，返回目标列表
  → 选择最近目标 (距离 < autoRange)
  → 计算归一化方向 normalize(target - player)
  → emit('aim:update', { dx, dy, targetId })
    → Projectile 更新发射方向

[manual 模式]
用户触摸/拖拽屏幕
  → emit('input:touch:hold', { x, y })
    → Aim 计算 normalize(touchPos - playerPos)
    → Aim.update() → emit('aim:update', { dx, dy })
      → Projectile 更新发射方向
```

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| Projectile | 方向消费者 | Projectile 监听 `aim:update` 获取射击方向。无 Aim 时 Projectile 默认向上 (0, -1) |
| EnemyAI | 目标提供者 | auto 模式通过 `aim:queryTargets` 查询敌人位置，EnemyAI 管理的敌人注册在 Collision 的 enemies 图层 |
| Collision | 目标查询中介 | 响应 `aim:queryTargets` 回调，提供指定图层内的对象列表 |
| TouchInput | manual 模式输入 | 提供触摸坐标用于手动瞄准 |
| FaceInput | face 模式输入 | 提供面部移动方向用于面部瞄准 |
| HandInput | hand 模式输入 | 提供手部位置用于手势瞄准 |

## 输入适配

| 输入方式 | 推荐 mode | 说明 |
|----------|----------|------|
| TouchInput | `manual` 或 `auto` | manual 模式瞄准精度高，auto 模式只需点击射击 |
| FaceInput | `face` | 歪头控制瞄准方向 |
| HandInput | `hand` | 手部位置控制瞄准方向 |
| AudioInput | `auto` | 声音输入无法提供方向，必须用 auto |
| DeviceInput | `auto` | 陀螺仪可考虑扩展为自定义模式 |

## 常见 Anti-Pattern

**auto 模式下 autoRange 过小**
- 错误: `autoRange: 100` → 敌人必须非常接近才会锁定，玩家反应时间不足
- 正确: autoRange 应大于敌人从生成点到玩家的典型距离的 50%

**manual 模式下 manualEvent 与输入不匹配**
- 错误: `mode: 'manual', manualEvent: 'input:touch:tap'` → tap 只提供一次性坐标，无法持续瞄准
- 正确: 使用 `input:touch:hold` 获取持续触摸位置

**无 Collision 响应 aim:queryTargets**
- 错误: auto 模式但未添加 Collision 模块 → queryTargets 无人响应 → 永远找不到目标
- 正确: auto 模式必须搭配 Collision 模块，且敌人注册在 autoTargetLayer 指定的图层中

## 示例配置

```json
{
  "type": "Aim",
  "params": {
    "mode": "auto",
    "autoTargetLayer": "enemies",
    "autoRange": 500,
    "manualEvent": "input:touch:hold"
  }
}
```
