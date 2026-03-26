# Checkpoint — 检查点/存档模块

## 基本信息
- 类型: mechanic
- 类名: `Checkpoint`
- 注册名: `Checkpoint`
- 文件: `src/engine/modules/mechanic/checkpoint.ts`
- 依赖: 无（requires: []）
- 可选联动: Lives, Collision, PlayerMovement, Inventory, IFrames, Knockback, UIOverlay, ParticleVFX, SoundFX

## 功能原理

Checkpoint 管理关卡中的存档点。玩家经过检查点时激活它，死亡后从最近激活的检查点重生。模块是事件驱动的（`update()` 为空操作），通过监听 `lives:zero` 事件触发重生逻辑。

**工作流程：**
1. `init()` 时从 `params.checkpoints` 加载 `CheckpointDef[]`（每个包含 x, y, width, height）
2. 监听 `lives:zero` 事件 → 调用 `respawn()`
3. 外部代码调用 `activate(index)` 激活检查点 → 记录到 `activatedSet` + 更新 `lastActivated`
4. `respawn()` 读取 `lastActivated` 对应的坐标 → 发出 `checkpoint:respawn` 事件
5. `getRespawnPoint()` 提供重生坐标查询接口

**检查点系统设计分类（游戏设计最佳实践）：**

| 类型 | 特点 | 经典案例 | 当前支持 |
|------|------|---------|---------|
| 手动检查点 | 接触/交互后激活 | Hollow Knight 长椅、Shovel Knight 灯塔 | 是（activate） |
| 自动检查点 | 进入区域自动保存 | Celeste 每屏一个、Mario 旗杆 | 通过 Collision 触发 |
| 世界存档 | 保存完整世界状态 | Skyrim、Minecraft | 否（仅保存位置） |
| 关卡入口 | 每个关卡起点即检查点 | 经典街机 | 是（index=0 放在入口） |
| 无检查点 | 死亡从头开始 | Roguelike | 不添加此模块即可 |

**检查点间距设计原则（参考 Celeste/Hollow Knight/Mega Man）：**

| 原则 | 说明 |
|------|------|
| 频率与难度反比 | 越难的区域检查点越密集（减少惩罚） |
| 在挑战前设置 | 检查点放在 boss/难关之前，而非之后 |
| 不要太远也不要太近 | 太远→挫败感；太近→无紧张感 |
| 单向递进 | 检查点只向前激活，不回退 |
| 安全区域 | 检查点附近应无 Hazard（避免重生即死） |

**经典游戏检查点设计参考：**

| 游戏 | 检查点密度 | 激活方式 | 重生行为 | 状态保存范围 |
|------|-----------|---------|---------|------------|
| Celeste | 极密（每屏 1 个） | 自动（进入新房间） | 原地重生 | 仅位置（收集品永久保留） |
| Hollow Knight | 稀疏（区域间 1~3 个） | 手动（坐长椅） | 长椅处重生 + 回满生命 | 位置 + 生命 + Geo 散落 |
| Shovel Knight | 中等（关卡内 2~3 个） | 自动（经过灯塔） | 灯塔处重生 | 位置（金币按死亡惩罚散落） |
| Mega Man | 中等（关卡中段） | 自动（经过标记点） | 标记点重生 | 位置 + 生命回满 |
| Mario (World) | 中等（旗杆/关卡中点） | 自动（经过旗杆） | 旗杆处重生 | 位置（大小恢复为小Mario） |
| 一碰即死类 | 极密 | 自动 | 原地重生 | 仅位置 |

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值 | 说明 |
|------|------|--------|----------|--------|------|
| checkpoints | object (CheckpointDef[]) | `[]` | — | 至少 1 个 | 检查点定义数组 |
| layer | string | `'checkpoints'` | 任意图层名 | `checkpoints` | 碰撞/渲染图层名 |
| asset | asset | `''` | — | — | 未激活状态素材 |
| activeAsset | asset | `''` | — | — | 激活状态素材 |

### CheckpointDef 结构

| 字段 | 类型 | 必填 | 有效范围 | 说明 |
|------|------|------|----------|------|
| x | number | 是 | 0 ~ 关卡宽度 | 检查点 X 坐标（px），同时是重生 X 坐标 |
| y | number | 是 | 0 ~ 关卡高度 | 检查点 Y 坐标（px），同时是重生 Y 坐标 |
| width | number | 是 | 16 ~ 128 | 检查点碰撞区域宽度（px） |
| height | number | 是 | 16 ~ 128 | 检查点碰撞区域高度（px） |

### 不同游戏类型的参数推荐

| 游戏类型 | checkpoints 数量/关 | width/height | 间距 | 设计理由 |
|----------|-------------------|-------------|------|---------|
| platformer（标准） | 3 ~ 5 | 32x64 | 每 1000~2000px | 经典密度 |
| platformer（一碰即死） | 5 ~ 10 | 64x64 | 每 500~800px | 高密度减少惩罚 |
| platformer（探索型） | 2 ~ 3 | 48x64 | 按区域划分 | 探索区域之间设置 |
| runner（无限跑酷） | 0（不适用） | — | — | runner 通常无检查点，死亡即结束 |
| dodge | 0（不适用） | — | — | 同上 |

### 检查点尺寸设计指南

```
推荐: width >= 玩家碰撞体宽度 * 2，height >= 关卡路径高度
```

| width x height | 效果 | 适用 |
|---------------|------|------|
| 32x32 | 需要精确通过 | 不推荐（容易错过） |
| 32x64 | 适中，需要经过特定位置 | 线性关卡 |
| 64x64 | 宽松，较难错过 | 标准推荐 |
| 128x128 | 非常宽松 | 探索型（确保不会漏过） |
| 整屏宽度xN | 自动检查点 | Celeste 风格（进入区域即激活） |

## 参数调优指南

### 检查点间距与难度的关系

```
挫败感 = 重玩距离 / 玩家技能
推荐重玩距离 = 玩家平均死亡间隔距离 * 0.5 ~ 0.8
```

| 难度 | 平均死亡间隔 | 推荐检查点间距 | 重玩时间 |
|------|------------|-------------|---------|
| 休闲 | ~500px | 300 ~ 400px | 5 ~ 10s |
| 标准 | ~1000px | 500 ~ 800px | 15 ~ 30s |
| 困难 | ~1500px | 800 ~ 1200px | 30 ~ 60s |
| 硬核 | ~2000px | 1500 ~ 2000px | 60 ~ 120s |
| 极限 | 整关 | 无检查点 | 整关时间 |

### 检查点放置策略

**在挑战之前放置（不是之后）：**
```
正确: Checkpoint → Hazard 区域 → Checkpoint → Boss
错误: Hazard 区域 → Checkpoint（玩家需要重复已完成的简单区域）
```

**避免检查点附近的危险：**
```
正确: ...安全平台... [Checkpoint] ...安全平台... → Hazard 区域
错误: ...Hazard... [Checkpoint] ...Hazard...（重生即受伤的死亡循环）
```

### 与 Lives 系统的配合

**Lives > 1 + Checkpoint（标准平台）：**
- 每次死亡（lives:zero）从检查点重生
- Lives 在重生后应恢复为满血（需上层实现）
- 适合: 多数 platformer

**Lives = 1 + Checkpoint（一碰即死）：**
- 碰到 Hazard 立即死亡，立即从检查点重生
- 重生速度要快（< 0.5s），减少等待
- 参考: Celeste、Super Meat Boy
- 检查点密度要高（每 500~800px）

**Lives > 0 + 无 Checkpoint：**
- 死亡后游戏结束（GameFlow → finished）
- 适合: runner、dodge 等街机类

### asset / activeAsset 的视觉设计

| 状态 | 推荐视觉 | 经典参考 |
|------|---------|---------|
| 未激活 (asset) | 灰色/暗淡旗帜、关闭的灯塔 | Shovel Knight 灰色灯塔 |
| 已激活 (activeAsset) | 明亮/发光旗帜、点亮的灯塔 | Shovel Knight 蓝色火焰灯塔 |

激活时的视觉切换给玩家明确的 "已存档" 反馈。建议配合 ParticleVFX 和 SoundFX 增强激活反馈。

## 事件协议

### 发出事件

| 事件名 | 常量 | 数据结构 | 触发条件 |
|--------|------|----------|---------|
| `checkpoint:activate` | `CHECKPOINT_ACTIVATE` | `{ id: string, index: number, x: number, y: number }` | 检查点首次激活时 |
| `checkpoint:respawn` | `CHECKPOINT_RESPAWN` | `{ id: string, x: number, y: number }` | 玩家死亡后重生时 |

**注意**: `id` 格式为 `checkpoint-{index}`（如 `checkpoint-0`, `checkpoint-2`）。

### 监听事件

| 事件名 | 常量 | 响应行为 |
|--------|------|---------|
| `lives:zero` | `LIVES_ZERO` | 调用 respawn() → 发出 checkpoint:respawn |
| `gameflow:resume` | `GAMEFLOW_RESUME` | 恢复模块（BaseModule 统一处理） |
| `gameflow:pause` | `GAMEFLOW_PAUSE` | 暂停模块（BaseModule 统一处理） |

### 完整事件链路

```
[激活链路 — 通过 Collision 自动激活]
Collision 检测 player 层 vs checkpoint 层
  → collision:hit { objectA: 'player_1', objectB: 'checkpoint-0', ... }
  → 上层逻辑调用 checkpoint.activate(0)
    → activatedSet.add(0), lastActivated = 0
    → emit('checkpoint:activate', { id: 'checkpoint-0', index: 0, x: 100, y: 200 })
      → 渲染层: asset 切换为 activeAsset（灰→亮）
      → ParticleVFX: 播放激活特效（光柱/火焰）
      → SoundFX: 播放激活音效（叮/铃）
      → UIOverlay: 可选 — 显示 "存档点已激活" 提示

[重生链路 — 死亡后自动触发]
collision:damage → Lives.decrease() → lives:change → lives:zero
  → Checkpoint 监听 lives:zero:
    → respawn()
      → lastActivated = 2（最近激活的检查点）
      → cp = checkpoints[2]
      → emit('checkpoint:respawn', { id: 'checkpoint-2', x: 500, y: 300 })
        → PlayerMovement: 将玩家传送到 (500, 300)
        → Lives: 恢复生命值（需上层实现）
        → IFrames: 可选 — 重生后短暂无敌
        → CameraFollow: 立即跳转到重生位置
        → ParticleVFX: 重生特效
        → SoundFX: 重生音效

[无检查点重生 — lastActivated 为 null]
lives:zero
  → Checkpoint.respawn()
    → lastActivated === null → 直接返回，不发出事件
    → 结果: GameFlow 通过 lives:zero → transition('finished') 结束游戏
```

## 跨模块联动规则

### Checkpoint + Lives（核心联动 — 重生逻辑）

Checkpoint 监听 `lives:zero` 事件触发重生。与 Lives 的交互是最核心的联动。

**完整重生流程（理想实现）：**

```
lives:zero 发生
  ├─ 有检查点已激活 (lastActivated !== null):
  │   ├─ Checkpoint: emit('checkpoint:respawn', { x, y })
  │   ├─ PlayerMovement: 传送玩家到 (x, y)
  │   ├─ Lives: 恢复为满血 (需上层: lives.reset() 或 lives.increase())
  │   ├─ IFrames: 激活短暂无敌 (防止重生即死)
  │   └─ Inventory: 可选 — 保留当前资源 / 回退到检查点时的资源
  │
  └─ 无检查点激活 (lastActivated === null):
      └─ GameFlow: transition('finished')（游戏结束）
```

**关键协调点：**

| 问题 | 当前状态 | 推荐方案 |
|------|---------|---------|
| Lives 重生后是否恢复满血？ | Checkpoint 不管理 Lives 状态 | 上层监听 checkpoint:respawn → lives.reset() |
| lives:zero 同时触发 GameFlow 结束和 Checkpoint 重生，谁优先？ | 两者都监听 lives:zero | 有 Checkpoint 时 GameFlow 应不响应 lives:zero（需条件判断） |
| 重生后是否有无敌帧？ | Checkpoint 不管理 IFrames | 上层监听 checkpoint:respawn → iframes.activate(1000) |
| 重生时 Inventory 资源是否回退？ | Checkpoint 不管理 Inventory | 当前实现: 资源保留（不回退） |

**lives:zero 的竞争监听问题：**

当 Lives 和 Checkpoint 同时存在时，`lives:zero` 事件被两方监听：
- GameFlow: `lives:zero` + `onZero: 'finish'` → `transition('finished')`
- Checkpoint: `lives:zero` → `respawn()`

如果 GameFlow 先处理，游戏结束；如果 Checkpoint 先处理，玩家重生。**当前实现没有优先级控制**——EventBus 按注册顺序触发。

**推荐方案**: 当 Checkpoint 存在且已有激活点时，Lives 的 `onZero` 应设为 `'none'`，让 Checkpoint 处理重生逻辑。游戏真正结束应由其他条件触发（如 Timer 到期或完成度达标）。

### Checkpoint + Collision（碰撞激活）

Checkpoint 本身没有内置碰撞检测——需要外部触发 `activate()`。通过 Collision 模块实现自动激活：

**AutoWirer 连线方案：**
1. Checkpoint.init() 时将每个 CheckpointDef 注册到 Collision 的 `checkpoints` 图层
2. Collision 规则: `{ a: 'player', b: 'checkpoints', event: 'hit', destroy: [] }`（不销毁）
3. collision:hit → 上层逻辑调用 checkpoint.activate(对应 index)

**重要**: `destroy: []`（不销毁），因为检查点在激活后仍然需要存在于世界中（视觉上从未激活变为已激活）。

### Checkpoint + PlayerMovement（传送重生）

- `checkpoint:respawn { x, y }` → PlayerMovement 需要将玩家位置设为 (x, y)
- 传送应是瞬间的（不是平滑移动）
- 重生后 PlayerMovement 的 velocityX/velocityY 应重置为 0
- **当前实现**: PlayerMovement 不监听 checkpoint:respawn，需要上层协调

### Checkpoint + Inventory（状态保存范围）

检查点系统的一个关键设计决策是：重生时保留/回退哪些状态？

| 策略 | 说明 | 经典参考 | 当前实现 |
|------|------|---------|---------|
| 保留全部 | 收集的资源在重生后保留 | Celeste（草莓永久保留） | 是（默认行为） |
| 回退到检查点 | 恢复到激活检查点时的资源快照 | Shovel Knight（金币按比例掉落） | 否（需扩展） |
| 全部丢失 | 死亡后失去所有未存储资源 | Hollow Knight（Geo 散落在死亡地点） | 否（需扩展） |
| 部分保留 | 关键道具保留，通货丢失 | 暗黑破坏神 | 否（需扩展） |

**当前实现**: Checkpoint 只保存位置——重生时不影响 Inventory、Scorer 等模块的状态。所有收集品/资源在重生后保留。

### Checkpoint + IFrames（重生保护）

重生后玩家应有短暂无敌时间，避免重生在 Hazard 附近时立即再次死亡：

```
checkpoint:respawn → 上层逻辑:
  → PlayerMovement.setPosition(x, y)
  → IFrames.activate(1500)  // 1.5 秒重生保护
  → 视觉: 玩家闪烁表示无敌中
```

**推荐 IFrames 持续时间**: 1000 ~ 2000ms（给玩家反应时间）

### Checkpoint + Knockback（重生取消击退）

重生时应取消任何进行中的 Knockback 效果：
- checkpoint:respawn → Knockback.reset()
- 否则玩家在重生瞬间可能被之前的击退推到危险区域

### Checkpoint + CameraFollow（重生跳转）

重生时 Camera 应立即跳转到重生位置（而非平滑过渡）：
- checkpoint:respawn → CameraFollow 需要特殊处理（instant jump 而非 smooth follow）
- 否则玩家重生时会看到相机从死亡位置平滑移动到重生位置的过程

### Checkpoint + Hazard（安全区设计）

**核心规则**: 检查点附近必须是安全区域。

```
危险: [Hazard] [Checkpoint] [Hazard]  → 重生后两面受敌
安全: ...平台... [Checkpoint] ...安全区... → [Hazard 区域]
```

Hazard 与 Checkpoint 的最小安全距离:
- 静态 Hazard: > Hazard.width + 玩家宽度 + 32px 缓冲
- 振荡 Hazard: > Hazard.oscillateRange + Hazard.width + 玩家宽度 + 64px 缓冲
- 旋转 Hazard: > Hazard.oscillateRange + 玩家宽度 + 64px 缓冲

## 输入适配

Checkpoint 本身不依赖输入方式。但检查点尺寸应根据输入精度调整：

| 输入方式 | width/height 调整 | 理由 |
|----------|-----------------|------|
| TouchInput | 标准 (32x64) | 触摸精度高，容易经过检查点 |
| FaceInput | 增大 50% (48x96) | 追踪延迟可能导致玩家"错过"检查点 |
| HandInput | 增大 30% (42x84) | 手势追踪边缘不稳定 |
| DeviceInput | 增大 50% (48x96) | 陀螺仪控制路径不可预测 |
| AudioInput | 不适用 | — |

## 常见 Anti-Pattern

**检查点放在 Hazard 附近导致重生死亡循环**
- 错误: 检查点紧邻尖刺 → 重生后立即碰到尖刺 → 再次死亡 → 无限循环
- 正确: 检查点位置必须是安全区域，与最近 Hazard 保持足够距离

**lives:zero 同时触发 GameFlow 结束和 Checkpoint 重生**
- 错误: Lives.onZero = 'finish' + Checkpoint 同时存在 → 竞争条件，行为取决于事件注册顺序
- 正确: 有 Checkpoint 时，Lives.onZero 设为 'none'，游戏结束由其他条件触发

**checkpoints 数组为空但添加了 Checkpoint 模块**
- 错误: `checkpoints: []` → 模块存在但无检查点 → lives:zero 时 lastActivated 为 null → respawn 不触发 → 游戏可能卡死
- 正确: 至少定义 1 个检查点（通常放在关卡起点）

**检查点尺寸太小导致玩家错过**
- 错误: `width: 8, height: 8` → 玩家高速移动时可能跳过检查点
- 正确: width 至少 = 玩家碰撞体宽度 * 2；height 至少 = 关卡路径高度

**所有检查点放在同一行（水平排列）但关卡有垂直结构**
- 错误: 检查点只在地面层 → 垂直探索区域没有存档保护
- 正确: 检查点位置应覆盖关卡的关键路径节点

**重生后 Lives 未恢复导致连续死亡**
- 错误: 重生后 Lives 仍为 0 → 下一帧又触发 lives:zero → 无限重生循环
- 正确: checkpoint:respawn 处理后必须恢复 Lives（上层逻辑: lives.reset()）

**重生后没有无敌帧**
- 错误: 重生位置附近有移动 Hazard → 重生瞬间就被碰到 → 立即死亡
- 正确: 重生后激活 IFrames（1~2s 无敌保护）

**checkpoints 数组索引与关卡进度不对应**
- 错误: checkpoints[0] 在关卡末尾，checkpoints[2] 在关卡开头 → 激活顺序混乱
- 正确: 数组索引按关卡进度从前到后排列

## 常见问题 & 边界情况

- `activate(index)` 对已激活的检查点直接返回（幂等），不重复发出事件
- `activate(index)` 对越界 index 直接返回（`checkpoints[index]` 为 undefined 时检查 `!cp`）
- `getRespawnPoint()` 在无激活检查点时返回 null
- `respawn()` 在 `lastActivated === null` 时直接返回，不发出事件
- `lastActivated` 始终指向最近一次激活的检查点（不一定是 index 最大的）
- `activatedSet` 记录所有已激活的检查点（不仅是当前的）
- `isActivated(index)` 可查询任意检查点的激活状态
- `getCheckpoints()` 返回原始数组引用（非拷贝），外部修改会影响内部状态
- `reset()` 清空 `activatedSet` 和 `lastActivated`，不发出任何事件
- `update()` 为空操作，模块完全事件驱动，不消耗帧时间
- getDependencies() 返回 `{ requires: [], optional: ['Lives'] }`
- Checkpoint 不管理任何其他模块的状态（不恢复 Lives、不回退 Inventory、不重置 IFrames）
- 重生坐标直接使用 CheckpointDef 的 (x, y)，不做任何偏移（玩家重生在检查点中心）
- id 格式为 `checkpoint-{index}`（字符串拼接），不可自定义
- 同一帧内可以激活多个检查点，`lastActivated` 保留最后一个
- `checkpoint:respawn` 事件的 id 对应 `lastActivated` 的检查点 id
