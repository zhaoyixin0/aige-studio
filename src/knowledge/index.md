# AIGE Studio 知识库

## 概述

本知识库为 AI Agent 提供游戏配置组装所需的全部技能。知识库分为三大部分：

## 目录结构

### 1. 游戏类型 (`game-types/`)

定义 16 种游戏类型的核心玩法、必需模块、推荐模块和示例配置：

| 文件 | 游戏类型 | 核心输入 |
|------|---------|---------|
| `catch.md` | 接住类 | FaceInput / HandInput |
| `dodge.md` | 躲避类 | FaceInput |
| `quiz.md` | 答题类 | TouchInput |
| `random-wheel.md` | 随机转盘类 | TouchInput |
| `tap.md` | 点击类 | TouchInput |
| `shooting.md` | 射击类 | FaceInput / TouchInput |
| `expression.md` | 表情触发类 | FaceInput |
| `runner.md` | 跑酷类 | TouchInput |
| `puzzle.md` | 拼图/配对类 | TouchInput |
| `rhythm.md` | 节奏类 | TouchInput |
| `gesture.md` | 手势互动类 | HandInput |
| `world-ar.md` | 世界AR类 | BodyInput |
| `dress-up.md` | 换装/贴纸类 | FaceInput + TouchInput |
| `narrative.md` | 分支叙事类 | TouchInput |
| `platformer.md` | 平台跳跃类 | TouchInput |
| `action-rpg.md` | 动作RPG类 | TouchInput |

### 2. 模块技能 (`modules/`)

详细描述 56 个引擎模块的参数、事件和连接方式：

#### 输入模块 (`modules/input/`)
- `face-input.md` — 面部追踪输入
- `hand-input.md` — 手部追踪输入
- `body-input.md` — 身体追踪输入
- `touch-input.md` — 触屏/鼠标输入
- `device-input.md` — 设备传感器输入
- `audio-input.md` — 麦克风音频输入

#### 机制模块 (`modules/mechanic/`) — 基础
- `spawner.md` — 物体生成器
- `collision.md` — 碰撞检测
- `scorer.md` — 计分系统
- `timer.md` — 计时器
- `lives.md` — 生命值系统
- `difficulty-ramp.md` — 难度递增
- `randomizer.md` — 随机抽取器
- `quiz-engine.md` — 答题引擎
- `runner.md` — 跑酷滚动
- `jump.md` — 跳跃
- `combo-system.md` — 连击系统
- `power-up.md` — 增益道具
- `player-movement.md` — 玩家移动

#### 机制模块 — 平台跳跃
- `gravity.md` — 重力系统
- `static-platform.md` — 静态平台
- `moving-platform.md` — 移动平台
- `one-way-platform.md` — 单向平台
- `crumbling-platform.md` — 碎裂平台
- `collectible.md` — 收集物
- `hazard.md` — 危险物
- `checkpoint.md` — 检查点
- `inventory.md` — 背包
- `wall-detect.md` — 墙壁检测
- `dash.md` — 冲刺
- `coyote-time.md` — 土狼时间
- `i-frames.md` — 无敌帧
- `knockback.md` — 击退

#### 机制模块 — 射击/战斗
- `projectile.md` — 弹丸系统
- `aim.md` — 瞄准系统
- `bullet-pattern.md` — 弹幕模式
- `enemy-ai.md` — 敌人AI
- `wave-spawner.md` — 波次生成器
- `health.md` — 血量系统
- `shield.md` — 护盾系统

#### 机制模块 — RPG
- `level-up.md` — 升级系统
- `status-effect.md` — 状态效果
- `equipment-slot.md` — 装备栏
- `enemy-drop.md` — 敌人掉落
- `skill-tree.md` — 技能树
- `dialogue-system.md` — 对话系统

#### 机制模块 — 引擎扩展
- `tween.md` — 补间动画
- `physics2d.md` — 2D刚体物理
- `scrolling-layers.md` — 视差滚动背景

#### 机制模块 — 特殊玩法
- `beat-map.md` — 节拍映射
- `expression-detector.md` — 表情检测
- `gesture-match.md` — 手势匹配
- `match-engine.md` — 配对引擎
- `branch-state-machine.md` — 分支状态机
- `dress-up-engine.md` — 换装引擎
- `plane-detection.md` — 平面检测(AR)

#### 反馈模块 (`modules/feedback/`)
- `game-flow.md` — 游戏流程控制
- `particle-vfx.md` — 粒子特效
- `sound-fx.md` — 音效系统
- `ui-overlay.md` — HUD 叠加层
- `result-screen.md` — 结算画面
- `camera-follow.md` — 相机跟随

### 3. 模块关系 (`relations/`)

描述模块间的事件连线、协同增强和冲突关系：

- `module-wiring.md` — EventBus 事件连线图
- `module-synergies.md` — 模块协同增强组合
- `module-conflicts.md` — 模块冲突与互斥关系

## 使用方式

Agent 在接收到用户需求后，应按以下步骤使用知识库：

1. **识别游戏类型** — 从 `game-types/` 中匹配最接近的类型
2. **加载必需模块** — 根据游戏类型文件中的必需模块表配置模块
3. **查阅模块技能** — 从 `modules/` 中获取每个模块的完整参数和事件
4. **检查模块关系** — 通过 `relations/` 确认模块间的连线和兼容性
5. **组装 GameConfig** — 将所有信息合并为完整的游戏配置 JSON

## 约定

- 所有模块通过 `EventBus` 进行事件通信，不直接互相引用
- 模块参数在 `getSchema()` 中定义，包含类型、默认值和约束范围
- 游戏配置使用 `GameConfig` 类型，包含 `modules[]` 数组
