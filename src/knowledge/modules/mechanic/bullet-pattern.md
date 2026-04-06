# BulletPattern — 弹幕模式模块

## 模块定义

BulletPattern 模块控制弹丸发射的空间分布模式。监听 `projectile:fire` 事件，根据配置的模式（单发、扇形、螺旋、连射、随机）计算弹丸方向向量数组，然后发出 `bulletpattern:fire` 事件，由 Projectile 模块消费以实际创建弹丸。本模块不创建或管理弹丸实体本身，仅负责方向计算。

## 基本信息
- 类型: mechanic
- 类名: `BulletPattern`
- 注册名: `BulletPattern`
- 文件: `src/engine/modules/mechanic/bullet-pattern.ts`
- 依赖: 无（独立模块）
- 可选联动: Projectile（弹丸创建）, EnemyAI（敌人弹幕）

## 核心参数

| 参数 | 类型 | 默认值 | 有效范围 | 说明 |
|------|------|--------|----------|------|
| pattern | select | `'single'` | single / spread / spiral / burst / random | 弹幕模式 |
| bulletCount | range | `1` | 1 ~ 36 | 每次发射的弹丸数量（spread/random 模式有效） |
| spreadAngle | range | `30` | 5 ~ 360 | 扇形展开角度（度），spread/random 模式使用 |
| spiralSpeed | range | `90` | 10 ~ 360 | 螺旋旋转速度（度/秒），spiral 模式使用 |
| burstDelay | range | `50` | 10 ~ 500 | 连射模式中每发间隔（毫秒） |

### 模式说明

| 模式 | 效果 | 适用场景 |
|------|------|----------|
| single | 单发一颗弹丸 | 步枪、手枪 |
| spread | 等间距扇形发射多颗 | 霰弹枪、散弹 |
| spiral | 方向随时间旋转 | Boss 弹幕、旋转炮台 |
| burst | 同方向快速连射多发 | 突击步枪、三连发 |
| random | 基础方向附近随机偏移 | 不精确武器、爆炸碎片 |

### 推荐配置对照表

| 武器风格 | pattern | bulletCount | spreadAngle | 效果 |
|----------|---------|-------------|-------------|------|
| 手枪 | single | 1 | — | 精确单发 |
| 霰弹枪 | spread | 5 | 45 | 近距离扇形覆盖 |
| 三连发 | burst | 3 | — | 快速三连射 |
| Boss 弹幕 | spiral | 1 | — | 旋转射击，需持续闪避 |
| 散射炮 | random | 8 | 60 | 大范围随机覆盖 |

## 事件

| 事件名 | 方向 | 数据结构 | 说明 |
|--------|------|----------|------|
| `projectile:fire` | 监听 | `{ dx, dy }` | 触发弹幕模式计算，dx/dy 为基础方向 |
| `bulletpattern:fire` | 发出 | `{ directions: Array<{dx, dy}> }` | 计算后的方向向量数组 |
| `gameflow:pause` | 监听 | — | 暂停螺旋旋转和连射队列 |
| `gameflow:resume` | 监听 | — | 恢复更新 |

## 契约 (Contracts)

```ts
{
  emits: ['bulletpattern:fire'],
  consumes: ['projectile:fire'],
}
```

## 与 Projectile 的协作

```
Projectile 发射 → projectile:fire 事件
    ↓
BulletPattern 监听 → 计算多方向向量
    ↓
bulletpattern:fire 事件 → Projectile 根据每个方向创建弹丸
```

**注意：** 当 BulletPattern 启用时，Projectile 模块应监听 `bulletpattern:fire` 而非直接从用户输入创建弹丸，否则会产生重复弹丸。AutoWirer 处理此路由。

## 适用游戏类型
- shooting — 玩家或敌人的弹幕模式
- action-rpg — Boss 战弹幕攻击

## 内部状态

| 状态 | 类型 | 说明 |
|------|------|------|
| spiralAngle | number | 当前螺旋旋转角度（度），每帧累加 spiralSpeed * dt |
| burstQueue | object \| null | 连射队列 { baseDx, baseDy, remaining } |
| burstTimer | number | 连射计时器（毫秒） |

所有内部状态在 `reset()` 时归零。
