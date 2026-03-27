# Projectile — 弹丸系统

## 模块定义

Projectile 模块管理弹丸的生成、飞行和生命周期。玩家通过配置的触发事件（默认触摸点击）发射弹丸，弹丸沿 Aim 模块提供的方向以恒定速度飞行，超过生命周期后自动销毁。模块维护一个不可变的弹丸实例数组，每帧更新位置并移除过期弹丸。支持射速冷却、最大弹丸数限制、穿透模式和碰撞半径配置。

## 基本信息
- 类型: mechanic
- 类名: `Projectile`
- 注册名: `Projectile`
- 文件: `src/engine/modules/mechanic/projectile.ts`
- 依赖: 无（独立模块）
- 可选联动: Aim, Collision, EnemyAI, WaveSpawner

## 核心参数

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| speed | range | `600` | 100 ~ 2000 | 弹丸飞行速度 (px/s) |
| damage | range | `10` | 1 ~ 100 | 弹丸伤害值 |
| lifetime | range | `3000` | 500 ~ 10000 | 弹丸存活时间 (ms)，超时自动销毁 |
| fireRate | range | `200` | 50 ~ 2000 | 射击冷却间隔 (ms)，两次射击之间的最小间隔 |
| fireEvent | string | `'input:touch:tap'` | 任意事件名 | 触发射击的事件名，可映射到任意输入方式 |
| layer | string | `'projectiles'` | 任意字符串 | 弹丸所在图层，用于 Collision 模块分组检测 |
| piercing | boolean | `false` | true / false | 穿透模式：开启后弹丸命中目标不会被销毁 |
| maxProjectiles | range | `50` | 5 ~ 200 | 同时存在的最大弹丸数量，防止性能问题 |
| collisionRadius | range | `8` | 2 ~ 50 | 弹丸碰撞半径 (px)，用于 Collision 检测 |

### 参数推荐值对照表

| 武器风格 | speed | damage | fireRate | lifetime | 参考 |
|----------|-------|--------|----------|----------|------|
| 机关枪 | 800 | 5 | 80 | 2000 | 高射速低伤害 |
| 步枪 | 1200 | 25 | 400 | 3000 | 中射速中伤害 |
| 霰弹枪 | 600 | 40 | 800 | 1000 | 低射速高伤害短射程 |
| 狙击枪 | 2000 | 80 | 1500 | 5000 | 极低射速极高伤害 |
| 魔法弹 | 400 | 15 | 300 | 4000 | 低速但持续时间长 |

## 事件

| 事件名 | 方向 | 数据结构 | 说明 |
|--------|------|----------|------|
| `{fireEvent}` | 监听 | — | 触发射击（默认 `input:touch:tap`） |
| `aim:update` | 监听 | `{ dx, dy }` | 更新弹丸发射方向 |
| `player:move` | 监听 | `{ x, y }` | 更新弹丸发射源位置（跟随玩家） |
| `projectile:fire` | 发出 | `{ id, x, y, dx, dy, speed, damage }` | 弹丸成功发射时触发 |
| `projectile:destroyed` | 发出 | `{ id }` | 弹丸因超过 lifetime 被销毁时触发 |
| `gameflow:pause` | 监听 | — | 暂停弹丸更新 |
| `gameflow:resume` | 监听 | — | 恢复弹丸更新 |

### 事件流转示意

```
用户触摸屏幕
  → emit('input:touch:tap')
    → Projectile.fire()
      → 冷却检查 (fireTimer > 0 → 拒绝)
      → 数量检查 (>= maxProjectiles → 拒绝)
      → 创建弹丸 { id, x, y, dx, dy, speed, damage }
      → emit('projectile:fire', { ... })

Aim.update() 每帧
  → emit('aim:update', { dx, dy })
    → Projectile 更新 aimDirection

Projectile.update() 每帧
  → 递减 fireTimer
  → 遍历弹丸: 更新位置 (x += dx * dist, y += dy * dist)
  → 检查 lifetime: elapsed >= lifetime → 标记 inactive
  → emit('projectile:destroyed', { id }) 对每个过期弹丸
  → 过滤移除所有 inactive 弹丸
```

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| Aim | 方向提供者 | Aim 每帧发出 `aim:update` 提供射击方向，Projectile 据此更新 aimDirection。无 Aim 时默认向上 (0, -1) 射击 |
| Collision | 命中检测 | Collision 使用 layer + collisionRadius 检测弹丸与敌人碰撞。AutoWirer 将碰撞结果转发为 `projectile:hit`（由 AutoWirer 规则发出，非 Projectile 自身） |
| EnemyAI | 目标承受 | EnemyAI 监听 `projectile:hit { targetId, damage }` 对目标敌人扣血。该事件由 AutoWirer 碰撞规则发出 |
| WaveSpawner | 敌人来源 | WaveSpawner 生成敌人，弹丸负责击杀。击杀后 `enemy:death` 事件通知 WaveSpawner 递减计数 |
| Health | 玩家生命 | 若敌人反击命中玩家（`enemy:attack`），Health 处理玩家受伤 |

## 输入适配

| 输入方式 | fireEvent 推荐 | 说明 |
|----------|---------------|------|
| TouchInput | `input:touch:tap` | 默认，点击屏幕射击 |
| FaceInput | `input:face:mouthOpen` | 张嘴射击 |
| HandInput | `input:hand:gesture:fist` | 握拳射击 |
| AudioInput | `input:audio:blow` | 吹气射击 |
| DeviceInput | `input:device:shake` | 摇晃手机射击 |

## 常见 Anti-Pattern

**fireRate 过低导致屏幕充满弹丸**
- 错误: `fireRate: 50, maxProjectiles: 200` → 每秒 20 发弹丸，渲染压力大
- 正确: fireRate 与 maxProjectiles 配合，确保同屏弹丸不超过 30~50 个

**lifetime 过长导致弹丸飞出画布后仍存在**
- 错误: `lifetime: 10000, speed: 800` → 弹丸飞 8000px 后才销毁
- 正确: `lifetime ≈ 画布对角线长度 / speed * 1000`

**无 Aim 模块时弹丸永远向上飞**
- 错误: 只添加 Projectile 不添加 Aim → 所有弹丸固定方向 (0, -1)
- 正确: 搭配 Aim 模块，或通过 `setAimDirection()` 外部设置方向

**piercing 开启但无 maxProjectiles 限制**
- 错误: 穿透弹丸不会因命中销毁，只靠 lifetime 回收 → 弹丸堆积
- 正确: 穿透模式下适当降低 maxProjectiles 或提高 fireRate

## 示例配置

```json
{
  "type": "Projectile",
  "params": {
    "speed": 600,
    "damage": 10,
    "lifetime": 3000,
    "fireRate": 200,
    "fireEvent": "input:touch:tap",
    "layer": "projectiles",
    "piercing": false,
    "maxProjectiles": 50,
    "collisionRadius": 8
  }
}
```
