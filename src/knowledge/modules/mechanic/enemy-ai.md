# EnemyAI — 敌人行为AI

## 模块定义

EnemyAI 模块管理敌人实体的行为状态机。每个敌人拥有独立的状态（idle、patrol、chase、attack、flee、dead）、血量和位置。模块每帧根据玩家距离和自身血量进行状态转换：idle 状态下检测到玩家进入侦测范围则转为 chase；chase 状态下接近到攻击范围则转为 attack；血量低于逃跑阈值则转为 flee 向远离玩家方向移动。模块监听 `projectile:hit` 事件处理受伤，血量归零时发出 `enemy:death` 事件。

## 基本信息
- 类型: mechanic
- 类名: `EnemyAI`
- 注册名: `EnemyAI`
- 文件: `src/engine/modules/mechanic/enemy-ai.ts`
- 依赖: 无（独立模块）
- 可选联动: WaveSpawner, Collision, Projectile, Health, EnemyDrop

## 核心参数

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| behavior | select | `'patrol'` | `patrol` / `chase` / `stationary` | 基础行为模式。patrol 沿路径点巡逻；chase 主动追踪玩家；stationary 原地不动 |
| speed | range | `100` | 20 ~ 500 | 移动速度 (px/s)，影响巡逻和追踪速度 |
| detectionRange | range | `200` | 50 ~ 800 | 侦测范围 (px)，玩家进入此范围时触发追踪 |
| attackRange | range | `50` | 20 ~ 200 | 攻击范围 (px)，进入此范围时开始攻击 |
| attackCooldown | range | `1000` | 200 ~ 5000 | 攻击冷却 (ms)，两次攻击之间的间隔 |
| attackDamage | range | `10` | 1 ~ 100 | 每次攻击造成的伤害值 |
| hp | range | `50` | 1 ~ 9999 | 敌人生命值，也作为 maxHp |
| fleeHpThreshold | range | `0.2` | 0 ~ 1, 步长 0.05 | 逃跑血量阈值（百分比），hp < maxHp * threshold 时进入 flee 状态 |
| waypoints | object | `[]` | `{ x, y }[]` | 巡逻路径点列表，patrol 模式下循环移动 |

### 敌人类型参数推荐

| 敌人类型 | behavior | speed | hp | attackDamage | attackCooldown | detectionRange | 参考 |
|----------|----------|-------|-----|-------------|----------------|---------------|------|
| 小怪 | patrol | 80 | 30 | 5 | 1500 | 150 | 弱但数量多 |
| 冲锋兵 | chase | 200 | 50 | 15 | 800 | 400 | 快速接近，中等伤害 |
| 重装兵 | patrol | 50 | 200 | 30 | 2000 | 100 | 慢速高血高伤 |
| 哨兵 | stationary | 0 | 80 | 20 | 1000 | 300 | 原地不动但侦测范围大 |
| Boss | chase | 60 | 500 | 40 | 1500 | 600 | 血厚伤害高 |

## 状态机

```
     ┌──────────────┐
     │     idle     │
     └──────┬───────┘
            │ playerDist < detectionRange
     ┌──────▼───────┐
┌────│    patrol     │◄────────────────┐
│    └──────┬───────┘                  │
│           │ playerDist < detectionRange │
│    ┌──────▼───────┐                  │
│    │    chase      │─────────────────┘
│    └──────┬───────┘  playerDist > detectionRange * 1.5
│           │ playerDist < attackRange
│    ┌──────▼───────┐
│    │    attack     │
│    └──────┬───────┘
│           │ hp < maxHp * fleeThreshold
│    ┌──────▼───────┐
│    │     flee      │
│    └──────┬───────┘
│           │ hp === 0
│    ┌──────▼───────┐
└───►│     dead      │
     └──────────────┘
```

## 事件

| 事件名 | 方向 | 数据结构 | 说明 |
|--------|------|----------|------|
| `player:move` | 监听 | `{ x: number, y: number }` | 更新玩家位置，用于距离计算和追踪 |
| `projectile:hit` | 监听 | `{ targetId: string, damage: number }` | 弹丸命中敌人，调用 damageEnemy 扣血 |
| `enemy:death` | 发出 | `{ id: string, x: number, y: number }` | 敌人 hp 归零时触发（每个敌人仅触发一次） |
| `enemy:attack` | 发出 | `{ id: string, damage: number }` | 敌人在 attack 状态下攻击冷却完成时触发 |
| `enemy:move` | 发出 | `{ id: string, x: number, y: number, state: string }` | 敌人移动时每帧触发（patrol/chase/flee 状态） |
| `gameflow:pause` | 监听 | — | 暂停所有 AI 更新 |
| `gameflow:resume` | 监听 | — | 恢复 AI 更新 |

### 事件流转示意

```
WaveSpawner.spawnEnemy()
  → emit('wave:spawn', { id, x, y })
    → AutoWirer 调用 EnemyAI.addEnemy(id, x, y)
      → 初始状态: idle, hp = maxHp

EnemyAI.update() 每帧
  → 状态转换: idle → patrol → chase → attack → flee → dead
  → chase 状态:
    → moveToward(player) → emit('enemy:move', { id, x, y, state })
  → attack 状态:
    → cooldown 完成 → emit('enemy:attack', { id, damage })
      → Health 监听 → 玩家扣血

Projectile 命中敌人
  → Collision 检测 → emit('projectile:hit', { targetId, damage })
    → EnemyAI.damageEnemy(targetId, damage)
      → hp 归零 → emit('enemy:death', { id, x, y })
        → WaveSpawner 监听 → enemiesRemaining--
        → EnemyDrop 监听 → 生成掉落物
```

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| WaveSpawner | 敌人来源 | WaveSpawner 通过 `wave:spawn` 事件触发敌人创建，EnemyAI.addEnemy() 注册并管理生命周期 |
| Collision | 碰撞检测 | Collision 检测弹丸与敌人碰撞，发出 `projectile:hit`；也响应 `aim:queryTargets` 提供目标列表 |
| Projectile | 伤害来源 | 弹丸命中后通过 Collision 转发为 `projectile:hit`，EnemyAI 据此扣血 |
| Health | 反击目标 | `enemy:attack` 事件可被 Health 模块监听，对玩家造成伤害 |
| EnemyDrop | 死亡掉落 | 监听 `enemy:death` 在敌人死亡位置生成掉落物品 |
| DifficultyRamp | 难度递增 | 可动态修改 EnemyAI 参数（speed、hp、attackDamage）实现难度曲线 |

## 输入适配

EnemyAI 本身不直接依赖输入方式，但间接受玩家位置精度影响：

| 输入方式 | 建议调整 | 理由 |
|----------|---------|------|
| TouchInput | 标准参数 | 触摸控制精度高，玩家能有效躲避 |
| FaceInput | detectionRange +50, speed -20 | 面部追踪延迟，给玩家更多反应时间 |
| HandInput | detectionRange +30 | 手势追踪边缘抖动 |
| DeviceInput | speed -30, attackDamage -5 | 陀螺仪控制不稳定 |

## 常见 Anti-Pattern

**detectionRange 小于 attackRange**
- 错误: `detectionRange: 30, attackRange: 50` → 敌人无法进入 chase，直接跳到 attack 或永远 idle
- 正确: `detectionRange > attackRange`，建议 detectionRange >= attackRange * 3

**fleeHpThreshold 为 0 导致敌人永不逃跑**
- 错误: `fleeHpThreshold: 0` → hp < 0 才触发逃跑，实际永远不会
- 注意: 设为 0 是有意设计（boss 类不逃跑），但普通敌人建议 0.15~0.3

**waypoints 为空但 behavior 为 patrol**
- 错误: `behavior: 'patrol', waypoints: []` → patrol 状态无路径点，敌人原地不动
- 正确: patrol 模式必须配置至少 2 个路径点

**大量敌人的性能问题**
- 错误: 200+ 敌人同时在 chase 状态，每帧计算距离和移动
- 正确: 通过 WaveSpawner 的 enemiesPerWave 控制同屏敌人数（推荐 <= 20）

**enemy:death 重复发出**
- 源码已通过 `deathEmitted` Set 防止重复，但若外部多次调用 `damageEnemy` 将不会重复触发

## 示例配置

```json
{
  "type": "EnemyAI",
  "params": {
    "behavior": "patrol",
    "speed": 100,
    "detectionRange": 200,
    "attackRange": 50,
    "attackCooldown": 1000,
    "attackDamage": 10,
    "hp": 50,
    "fleeHpThreshold": 0.2,
    "waypoints": [
      { "x": 100, "y": 200 },
      { "x": 700, "y": 200 },
      { "x": 700, "y": 600 },
      { "x": 100, "y": 600 }
    ]
  }
}
```
