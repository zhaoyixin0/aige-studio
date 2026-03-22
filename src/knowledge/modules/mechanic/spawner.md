# Spawner — 物体生成器模块

## 基本信息
- 类型: mechanic
- 类名: Spawner
- 注册名: `Spawner`

## 功能原理

Spawner 按设定频率在指定区域内生成游戏物体。物体从 items 列表中按权重随机选取素材，以配置的速度和方向移动。支持上/下/左/右/随机五种运动方向，可选旋转效果。当物体超出画布边界 100px 时自动销毁并发出 `spawner:destroyed` 事件。收到 `collision:hit` 事件时自动移除被击中的物体。支持暂停/恢复控制。

## 完整参数表

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| items | asset[] | `[]` | — | 生成物体列表，每项包含 `{ asset: string, weight: number }` |
| speed | object | `{ min: 100, max: 200 }` | min >= 0, max >= 0 | 物体速度范围（像素/秒） |
| frequency | range | `1.5` | `0.3 ~ 5`，步长 0.1 | 生成间隔（秒） |
| spawnArea | rect | `{ x: 0, y: 0, width: 800, height: 0 }` | — | 生成区域矩形 |
| direction | select | `'down'` | `down / up / left / right / random` | 物体运动方向 |
| maxCount | number | `10` | `1 ~ 50` | 同时存在的最大物体数 |
| rotation | boolean | `false` | — | 是否启用旋转 |
| rotationSpeed | range | `0` | `0 ~ 10`，步长 0.1 | 旋转速度（弧度/秒） |

## 事件通信

### 发出事件

| 事件名 | 数据 | 触发条件 |
|--------|------|---------|
| `spawner:destroyed` | `{ id: string }` | 物体超出画布边界被自动销毁时 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `gameflow:pause` | 暂停生成和物体移动 |
| `gameflow:resume` | 恢复生成和物体移动 |
| `collision:hit` | 移除被击中的物体（通过 `data.targetId`） |

## 与其他模块连接方式

- **Collision**: 生成的物体需要注册到 Collision 模块作为碰撞对象
- **Scorer**: 物体被碰撞击中 → Collision 发出 `collision:hit` → Scorer 加分
- **Scorer**: 物体出界 → `spawner:destroyed` → Scorer 扣分（如果 deductOnMiss 开启）
- **DifficultyRamp**: 可修改 Spawner 的 `frequency` 或 `speed` 参数实现难度递增
- **GameFlow**: 通过 `gameflow:pause/resume` 控制暂停

## 适用游戏类型

- **catch**（接住类）— 从顶部生成下落物体
- **dodge**（躲避类）— 生成需要躲避的障碍物
- **tap**（点击类）— 生成需要点击的目标
- **shooting**（射击类）— 生成射击目标
- **runner**（跑酷类）— 生成障碍和收集物
- **rhythm**（节奏类）— 生成节拍标记
- **world-ar**（世界AR类）— 在 AR 场景中生成虚拟物体

## 常见问题 & 边界情况

- items 数组为空时 `spawn()` 返回 null，不会生成任何物体
- frequency 在内部转为毫秒 `frequency * 1000`
- 物体出界判定为超出画布边界 100px（四个方向都有 100px 缓冲区）
- maxCount 限制只影响生成，不影响已存在物体的移动和销毁
- 加权随机：每个 item 的 weight 默认为 1，weight 越大被选中概率越高
- direction 为 `'random'` 时每个物体独立随机选择方向
- 调用 `reset()` 会清空所有物体、重置计时器和暂停状态
