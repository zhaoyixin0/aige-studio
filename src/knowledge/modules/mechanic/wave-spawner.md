# WaveSpawner — 波次生成器

## 模块定义

WaveSpawner 模块管理敌人的波次生成节奏。模块按波次递增地生成敌人：每波的敌人数量以 `scalingFactor` 指数增长，波次之间有冷却间隔，同一波内敌人按 `spawnDelay` 间隔逐个生成。模块监听 `enemy:death` 事件追踪剩余敌人数，当一波所有敌人被消灭后进入冷却并准备下一波。支持有限波次和无限模式。

## 基本信息
- 类型: mechanic
- 类名: `WaveSpawner`
- 注册名: `WaveSpawner`
- 文件: `src/engine/modules/mechanic/wave-spawner.ts`
- 依赖: 无（独立模块）
- 可选联动: EnemyAI, Collision, DifficultyRamp

## 核心参数

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| enemiesPerWave | range | `5` | 1 ~ 50 | 第一波的敌人数量（基础值），后续波次按 scalingFactor 递增 |
| waveCooldown | range | `3000` | 1000 ~ 10000 | 波次间冷却时间 (ms)，一波完成后等待此时间开始下一波 |
| spawnDelay | range | `500` | 100 ~ 2000 | 同波内两个敌人之间的生成间隔 (ms) |
| scalingFactor | range | `1.2` | 1.0 ~ 2.0, 步长 0.1 | 波次敌人数量缩放系数。第 N 波数量 = ceil(enemiesPerWave * scalingFactor^(N-1)) |
| maxWaves | range | `0` | 0 ~ 100 | 最大波次数，0 表示无限波次 |
| spawnAreaX | range | `0` | 0 ~ 2000 | 生成区域左边界 X 坐标 (px) |
| spawnAreaWidth | range | `800` | 100 ~ 2000 | 生成区域宽度 (px)，敌人在 [spawnAreaX, spawnAreaX + spawnAreaWidth] 范围内随机 X 生成 |
| spawnY | range | `0` | 0 ~ 2000 | 生成 Y 坐标 (px)，所有敌人在此 Y 位置生成 |
| enemyCollisionRadius | range | `24` | 8 ~ 100 | 生成敌人的碰撞半径 (px)，传递给 Collision 模块用于碰撞检测 |

### 波次数量公式

```
第 N 波敌人数 = ceil(enemiesPerWave * scalingFactor ^ (N - 1))

示例 (enemiesPerWave=5, scalingFactor=1.2):
  Wave 1:  5 (base)
  Wave 2:  ceil(5 * 1.2^1) = 6
  Wave 3:  ceil(5 * 1.2^2) = 8
  Wave 5:  ceil(5 * 1.2^4) = 11
  Wave 10: ceil(5 * 1.2^9) = 26
```

### 难度节奏推荐

| 游戏风格 | enemiesPerWave | scalingFactor | waveCooldown | spawnDelay | maxWaves | 节奏感 |
|----------|---------------|---------------|-------------|------------|---------|--------|
| 休闲生存 | 3 | 1.1 | 5000 | 800 | 0 | 缓慢递增，长休息 |
| 标准射击 | 5 | 1.2 | 3000 | 500 | 0 | 中等递增 |
| 紧张战斗 | 8 | 1.3 | 2000 | 300 | 0 | 快速递增 |
| 关卡制 | 5 | 1.2 | 3000 | 500 | 10 | 有明确终点 |
| Boss Rush | 1 | 1.0 | 5000 | 0 | 5 | 每波一个强敌 |

## 事件

| 事件名 | 方向 | 数据结构 | 说明 |
|--------|------|----------|------|
| `wave:start` | 发出 | `{ wave: number, enemyCount: number }` | 新一波开始时触发，包含波次编号和该波敌人总数 |
| `wave:spawn` | 发出 | `{ id: string, x: number, y: number, wave: number }` | 每个敌人生成时触发，包含唯一 ID 和位置 |
| `wave:complete` | 发出 | `{ wave: number }` | 一波所有敌人被消灭后触发 |
| `wave:allComplete` | 发出 | `{ totalWaves: number }` | 所有波次完成后触发（仅 maxWaves > 0 时） |
| `enemy:death` | 监听 | `{ id: string }` | 敌人死亡时递减 enemiesRemaining 计数 |
| `gameflow:resume` | 监听 | — | 恢复生成（首次 resume 时启动第一波） |
| `gameflow:pause` | 监听 | — | 暂停生成计时器 |

### 事件流转示意

```
GameFlow 进入 playing 状态
  → emit('gameflow:resume')
    → WaveSpawner.init 监听 → 启动第一波
      → startNextWave()
        → currentWave = 1
        → 计算 enemyCount = 5
        → emit('wave:start', { wave: 1, enemyCount: 5 })

WaveSpawner.update() 每帧
  → 累加 spawnTimer
  → spawnTimer >= spawnDelay:
    → spawnEnemy()
      → 随机 X ∈ [spawnAreaX, spawnAreaX + spawnAreaWidth]
      → emit('wave:spawn', { id, x, y, wave })
        → AutoWirer 调用 EnemyAI.addEnemy(id, x, y)
        → AutoWirer 注册到 Collision (enemies 图层)

敌人被击杀
  → emit('enemy:death', { id })
    → WaveSpawner: enemiesRemaining--
    → 当 enemiesRemaining === 0 且所有敌人已生成:
      → completeWave()
        → emit('wave:complete', { wave: 1 })
        → 若 maxWaves > 0 且 currentWave >= maxWaves:
          → emit('wave:allComplete', { totalWaves })
        → 否则进入冷却: inCooldown = true

冷却计时
  → cooldownTimer >= waveCooldown:
    → startNextWave() → 下一波开始
```

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| EnemyAI | 敌人管理 | WaveSpawner 生成敌人 ID 和位置，AutoWirer 将其注册到 EnemyAI 进行行为控制 |
| Collision | 碰撞注册 | 生成的敌人通过 AutoWirer 注册到 Collision 的 enemies 图层，供弹丸碰撞检测 |
| DifficultyRamp | 难度控制 | DifficultyRamp 可动态修改 WaveSpawner 的 scalingFactor 或 EnemyAI 的参数实现渐进难度 |
| Projectile | 间接关系 | 弹丸命中敌人 → `enemy:death` → WaveSpawner 递减计数 |
| Scorer | 计分 | 可监听 `wave:complete` 给予波次奖励分，或监听 `enemy:death` 逐个计分 |
| UIOverlay | HUD 显示 | 可监听 `wave:start` 显示波次提示（如 "Wave 3"），监听 `wave:complete` 显示通关信息 |

## 输入适配

WaveSpawner 本身不依赖输入方式，但敌人生成节奏应匹配玩家的操控精度：

| 输入方式 | 建议调整 | 理由 |
|----------|---------|------|
| TouchInput | 标准参数 | 触摸射击精度高 |
| FaceInput | enemiesPerWave -2, spawnDelay +200 | 瞄准精度低，降低压力 |
| HandInput | spawnDelay +100 | 手势追踪略有延迟 |
| AudioInput | enemiesPerWave -2, waveCooldown +2000 | 声音输入反应慢 |
| DeviceInput | scalingFactor 降至 1.1 | 体感控制不稳定 |

## 常见 Anti-Pattern

**scalingFactor 过高导致后期无法通关**
- 错误: `scalingFactor: 2.0, enemiesPerWave: 5` → 第 5 波 80 个敌人，第 10 波 2560 个
- 正确: scalingFactor 1.1~1.3，确保 10 波后的敌人数仍在玩家处理能力内

**spawnDelay 过短导致敌人堆叠**
- 错误: `spawnDelay: 100, spawnAreaWidth: 200` → 敌人集中生成在小区域，互相重叠
- 正确: spawnDelay >= 300 或增大 spawnAreaWidth

**maxWaves=0 但无其他结束条件**
- 错误: 无限波次 + 无计时器 + 无生命系统 → 游戏永远不会结束
- 正确: 无限模式必须搭配 Lives/Health + GameFlow 的死亡结束机制

**spawnAreaX + spawnAreaWidth 超出画布**
- 错误: `spawnAreaX: 600, spawnAreaWidth: 800` → 敌人生成在 600~1400 范围，部分在画布外
- 正确: 确保 spawnAreaX + spawnAreaWidth <= 画布宽度

**waveCooldown 过短玩家无喘息时间**
- 错误: `waveCooldown: 1000` + 高 scalingFactor → 上一波刚打完下一波更多的敌人立刻来了
- 正确: waveCooldown >= 2000，给玩家心理缓冲和收集掉落物的时间

## 常见问题 & 边界情况

- 首波启动依赖 `gameflow:resume` 事件，在游戏开始前不会生成敌人
- `enemy:death` 在 waveActive 为 false 时被忽略（防止跨波次计数错误）
- `wave:allComplete` 仅在 maxWaves > 0 时触发；maxWaves = 0（无限模式）永远不会触发
- `reset()` 清零所有状态但不发出事件，适合游戏重启
- 第一波的敌人数等于 enemiesPerWave（不乘 scalingFactor），从第二波开始缩放
- 敌人生成 X 坐标使用 `Math.random()`，分布均匀但不保证不重叠
- spawnY 为固定值，所有敌人从同一 Y 高度生成（适合顶部向下的射击游戏）

## 示例配置

```json
{
  "type": "WaveSpawner",
  "params": {
    "enemiesPerWave": 5,
    "waveCooldown": 3000,
    "spawnDelay": 500,
    "scalingFactor": 1.2,
    "maxWaves": 0,
    "spawnAreaX": 0,
    "spawnAreaWidth": 800,
    "spawnY": 0,
    "enemyCollisionRadius": 24
  }
}
```
