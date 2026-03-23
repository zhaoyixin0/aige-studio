# Module Expansion Design — Batch 1: Platformer Modules

> **Date:** 2026-03-23
> **Approach:** Incremental expansion (Plan A), 3 batches by priority: Platformer > Shooter > Action-RPG

## Design Principles

1. **小而专一** — 每个模块只做一件事，用户自由组合
2. **输入解耦** — 所有动作模块通过 `triggerEvent` 参数绑定输入，不硬编码输入源
3. **素材支持** — 平台/收集物/环境模块均支持 `asset` 字段，复用现有 Asset Agent 管道（Gemini Imagen 4 → bg removal → IndexedDB）
4. **事件驱动** — 遵循现有 EventBus 架构，模块间零直接引用

## Batch 1: 平台跳跃模块组（16 个新模块）

### 物理基础（3 个）

#### 1. Gravity — 重力
- **文件:** `src/engine/modules/mechanic/gravity.ts`
- **职责:** 对指定层对象施加向下加速度
- **参数:**
  - `strength`: range(200-2000), default 980 — 重力加速度
  - `terminalVelocity`: range(100-2000), default 800 — 最大下落速度
  - `applyTo`: select(player/items/all), default 'player' — 作用层
  - `toggleEvent`: string, optional — 绑定输入切换重力开关
- **发出:** `gravity:landed`, `gravity:falling`
- **监听:** `jump:start`（标记 airborne）

#### 2. Knockback — 击退
- **文件:** `src/engine/modules/mechanic/knockback.ts`
- **职责:** 受击时施加方向性推力
- **参数:**
  - `force`: range(100-800), default 300
  - `duration`: range(50-500ms), default 200
  - `triggerEvent`: string, default 'collision:damage'
  - `applyTo`: select(player/items/all), default 'player'
- **发出:** `knockback:start {direction, force}`, `knockback:end`
- **监听:** 可配置 triggerEvent

#### 3. IFrames — 无敌帧
- **文件:** `src/engine/modules/mechanic/i-frames.ts`
- **职责:** 受击后短暂无敌
- **参数:**
  - `duration`: range(200-3000ms), default 1000
  - `triggerEvent`: string, default 'collision:damage'
  - `flashEffect`: boolean, default true — 闪烁效果
- **发出:** `iframes:start`, `iframes:end`
- **监听:** 可配置 triggerEvent

### 玩家动作（3 个）

#### 4. PlayerMovement — 水平移动
- **文件:** `src/engine/modules/mechanic/player-movement.ts`
- **职责:** 玩家水平方向移动，支持加速/减速
- **参数:**
  - `speed`: range(100-800), default 300
  - `acceleration`: range(0-2000), default 1000
  - `deceleration`: range(0-2000), default 800
  - `moveLeftEvent`: string, default 'input:touch:swipe' (left)
  - `moveRightEvent`: string, default 'input:touch:swipe' (right)
  - `continuousEvent`: string, optional — 持续控制（如 face:move, 设备倾斜）
- **发出:** `player:move {x, direction, speed}`, `player:stop`
- **监听:** 可配置移动事件

#### 5. Dash — 冲刺
- **文件:** `src/engine/modules/mechanic/dash.ts`
- **职责:** 按方向快速位移
- **参数:**
  - `distance`: range(50-400), default 150
  - `duration`: range(50-300ms), default 150
  - `cooldown`: range(0-2000ms), default 500
  - `triggerEvent`: string, default 'input:touch:doubleTap'
  - `directionSource`: select(facing/input/fixed), default 'facing'
- **发出:** `dash:start {direction}`, `dash:end`
- **监听:** 可配置 triggerEvent

#### 6. CoyoteTime — 跳跃宽容
- **文件:** `src/engine/modules/mechanic/coyote-time.ts`
- **职责:** 离开平台后仍可跳的宽容窗口 + 输入缓冲
- **参数:**
  - `coyoteFrames`: range(3-15), default 6
  - `bufferFrames`: range(3-15), default 6
  - `jumpEvent`: string, default 'input:touch:tap' — 监听的跳跃输入
- **发出:** `coyote:jump`（替代原始 jump 触发）
- **监听:** `gravity:falling`, 配置的 jumpEvent

### 平台/地形（4 个）

#### 7. StaticPlatform — 静态平台
- **文件:** `src/engine/modules/mechanic/static-platform.ts`
- **职责:** 固定位置实心平台
- **参数:**
  - `platforms[]`: object[] — 每个含 x, y, width, height, material(normal/ice/sticky)
  - `layer`: string, default 'platforms'
  - `friction`: range(0-1), default 0.8
  - `asset`: asset, optional — AI 生成或上传的 sprite
  - `tileMode`: select(stretch/repeat), default 'stretch'
- **发出:** `platform:contact {id, material}`
- **监听:** 无

#### 8. MovingPlatform — 移动平台
- **文件:** `src/engine/modules/mechanic/moving-platform.ts`
- **职责:** 按预设路径自动移动的平台
- **参数:**
  - `platforms[]`: object[] — 每个含位置、尺寸、pattern(horizontal/vertical/circular)、speed、range
  - `layer`: string, default 'platforms'
  - `asset`: asset, optional
  - `tileMode`: select(stretch/repeat), default 'stretch'
- **发出:** `platform:move {id, x, y}`
- **监听:** 无

#### 9. OneWayPlatform — 单向平台
- **文件:** `src/engine/modules/mechanic/one-way-platform.ts`
- **职责:** 从下方可穿过，上方可站立
- **参数:**
  - `platforms[]`: object[] — 位置、尺寸
  - `layer`: string, default 'platforms'
  - `dropThroughEvent`: string, optional — 绑定输入向下穿过
  - `asset`: asset, optional
  - `tileMode`: select(stretch/repeat), default 'stretch'
- **发出:** `platform:land {id}`, `platform:drop {id}`
- **监听:** 可配置 dropThroughEvent

#### 10. CrumblingPlatform — 碎裂平台
- **文件:** `src/engine/modules/mechanic/crumbling-platform.ts`
- **职责:** 踩上后延迟碎裂，可选重生
- **参数:**
  - `platforms[]`: object[] — 位置、尺寸
  - `delay`: range(200-2000ms), default 500
  - `respawnTime`: range(0-10s), default 3 — 0=不重生
  - `layer`: string, default 'platforms'
  - `asset`: asset, optional
  - `crumbleAsset`: asset, optional — 碎裂时替换的素材
- **发出:** `platform:crumble {id}`, `platform:respawn {id}`
- **监听:** collision 检测玩家踩上

### 环境危险（1 个）

#### 11. Hazard — 环境危险
- **文件:** `src/engine/modules/mechanic/hazard.ts`
- **职责:** 接触即伤的环境元素（尖刺、岩浆、电网）
- **参数:**
  - `hazards[]`: object[] — 位置、尺寸、pattern(static/oscillate/rotate)
  - `damage`: range(1-10), default 1
  - `damageEvent`: string, default 'collision:damage'
  - `layer`: string, default 'hazards'
  - `asset`: asset, optional
  - `oscillateSpeed`: range(0-500), default 100
  - `oscillateRange`: range(0-300), default 100
- **发出:** 可配置 damageEvent
- **监听:** Collision 检测碰撞

### 收集/进度（3 个）

#### 12. Collectible — 收集物
- **文件:** `src/engine/modules/mechanic/collectible.ts`
- **职责:** 场景中可拾取物品
- **参数:**
  - `items[]`: object[] — 位置、value、type
  - `pickupEvent`: string, default 'collision:hit'
  - `layer`: string, default 'collectibles'
  - `asset`: asset, optional
  - `floatAnimation`: boolean, default true — 上下浮动
- **发出:** `collectible:pickup {type, value}`, `collectible:allCollected`
- **监听:** 可配置 pickupEvent

#### 13. Inventory — 背包/资源
- **文件:** `src/engine/modules/mechanic/inventory.ts`
- **职责:** 追踪收集的资源数量
- **参数:**
  - `resources[]`: object[] — name, max, initial
  - `trackEvent`: string, default 'collectible:pickup'
- **发出:** `inventory:change {resource, amount, total}`, `inventory:full {resource}`
- **监听:** 可配置 trackEvent

#### 14. Checkpoint — 存档点
- **文件:** `src/engine/modules/mechanic/checkpoint.ts`
- **职责:** 记录玩家位置，死亡后重生
- **参数:**
  - `checkpoints[]`: object[] — 位置、尺寸
  - `activateEvent`: string, default 'collision:hit'
  - `layer`: string, default 'checkpoints'
  - `asset`: asset, optional
  - `activeAsset`: asset, optional — 激活后替换素材
- **发出:** `checkpoint:activate {id, x, y}`, `checkpoint:respawn {id}`
- **监听:** `lives:zero` 或致死伤害触发重生

### 墙壁交互（1 个）

#### 15. WallDetect — 墙壁检测
- **文件:** `src/engine/modules/mechanic/wall-detect.ts`
- **职责:** 检测贴墙状态，提供滑墙/蹬墙跳
- **参数:**
  - `wallSlide`: boolean, default true
  - `slideSpeed`: range(50-300), default 100 — 滑墙速度
  - `wallJump`: boolean, default true
  - `wallJumpForce`: object {x: 200-600, y: 300-800}
  - `wallJumpEvent`: string, default 复用 jump triggerEvent
- **发出:** `wall:contact {side}`, `wall:slide`, `wall:jump`
- **监听:** `player:move`, 可配置 wallJumpEvent

### 相机（1 个）

#### 16. CameraFollow — 相机跟随
- **文件:** `src/engine/modules/feedback/camera-follow.ts`
- **职责:** 相机跟随玩家
- **参数:**
  - `mode`: select(center/look-ahead/dead-zone), default 'center'
  - `smoothing`: range(0-0.99), default 0.1
  - `deadZone`: object {width, height}, default {100, 50}
  - `lookAheadDistance`: range(0-200), default 80
  - `bounds`: object {minX, maxX, minY, maxY}, optional
  - `shakeEvent`: string, optional — 绑定事件触发屏幕震动
  - `shakeDuration`: range(50-500ms), default 200
  - `shakeIntensity`: range(1-20), default 5
- **发出:** `camera:move {x, y}`, `camera:shake`
- **监听:** `player:move`, 可配置 shakeEvent

## 模块交互示意

```
典型平台跳跃游戏配置:

Input (任意) ──triggerEvent──→ PlayerMovement (左右走)
Input (任意) ──triggerEvent──→ Jump (跳)
Input (任意) ──triggerEvent──→ Dash (冲刺)
                                    ↓
                              Gravity (持续下拉)
                              CoyoteTime (跳跃宽容)
                              WallDetect (墙壁交互)
                                    ↓
           StaticPlatform / MovingPlatform / OneWayPlatform / CrumblingPlatform
                                    ↓ collision
                              Hazard → collision:damage
                                    ↓
                              Lives (扣血) → IFrames (无敌帧) → Knockback (击退)
                                    ↓
                              Collectible → Inventory (资源追踪)
                              Checkpoint (存档点)
                              Scorer (计分)
                                    ↓
                              CameraFollow (跟随 + 震动)
                              ParticleVFX / SoundFX (反馈)
```

## 后续批次预览

### Batch 2: 射击弹幕（~7 个模块）
Projectile, AimControl, EnemyAI, Health, WaveManager, BulletPattern, Shield

### Batch 3: 动作冒险（~6 个模块）
MeleeAttack, Patrol, ResourcePool, LootDrop, StatusEffect, DialogTrigger

## Auto-Wirer 扩展

需要新增的自动连线规则：
- Gravity + Jump: 跳跃时标记 airborne，落地时标记 grounded
- CoyoteTime + Jump + Gravity: 宽容帧协调
- Platform* + Collision: 平台自动注册碰撞层
- Hazard + Collision: 危险区自动注册碰撞层
- Collectible + Collision: 收集物自动注册碰撞层
- Checkpoint + Lives: 死亡时自动触发重生
- IFrames + Collision: 无敌期间禁用伤害碰撞
