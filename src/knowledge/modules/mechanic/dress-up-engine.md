# DressUpEngine — 换装系统模块

## 基本信息
- 类型: mechanic
- 类名: `DressUpEngine`
- 注册名: `DressUpEngine`
- 依赖: `requires: []`, `optional: []`
- 源码: `src/engine/modules/mechanic/dress-up-engine.ts`

## 功能原理

DressUpEngine 管理角色换装/装扮系统的逻辑层。维护一个图层（layer）→ 装备物品（itemId）的映射表，支持装备、卸下、快照、清空等操作。每个图层可配置最大物品数（maxPerLayer），超出时自动移除最旧的物品。

### 核心流程
```
DressUpEngine.init()
    ↓ 为每个 layer 初始化空 Map<string, string[]>
    ↓
input:touch:tap { layer, itemId }
    ↓
equip(layer, itemId)
    ↓ layer 合法? → items 已含 itemId? (已装备则跳过)
    ↓ items.length >= maxPerLayer ?
    │   ├── 是 → 移除最旧物品 → emit dressup:unequip
    │   └── 否 → 直接添加
    ↓ items.push(itemId) → emit dressup:equip { layer, itemId }
```

### 图层模型
```
layers: ['hat', 'glasses', 'shirt', 'pants', 'shoes']

渲染 z-order（从下到上）：
┌─────────────┐
│   hat        │  ← 最上层（z-index 最高）
│   glasses    │
│   shirt      │
│   pants      │
│   shoes      │  ← 最下层
│   [base body]│  ← 角色底图
└─────────────┘
```

### 互斥与多选
- **maxPerLayer=1**（默认）：每层只能装备 1 件，装备新物品自动替换旧物品（互斥）
- **maxPerLayer=2~3**：每层可叠加多件（如同时戴多条项链），超出上限移除最旧的

### 快照机制
`snapshot()` 返回当前所有装备状态的快照（`EquippedItem[]`），同时发出 `dressup:snapshot` 事件，用于截图/分享/保存功能。

### 业界参考
- **Roblox Avatar Editor**：支持 layered clothing（分层服装），z-order 排序面板
- **VRChat Modular Avatar**：基于 Unity 的模块化换装，支持一键合并和冲突隐藏
- **Gacha Life/Club**：2D 换装系统，10+ 图层（发型、眼睛、嘴巴、上衣等），每层互斥
- **Covet Fashion**：每个 slot 互斥，支持保存多套 outfit

## 完整参数表

| 参数 | 类型 | 默认值 | 有效范围 | 推荐值区间 | 说明 |
|------|------|--------|----------|-----------|------|
| layers | object | `['hat', 'glasses', 'shirt', 'pants', 'shoes']` | 字符串数组 | 3~8 层 | 装备图层列表（决定渲染顺序） |
| maxPerLayer | range | `1` | 1~3，步长 1 | 1 | 每层最大装备数 |

### layers 推荐配置

| 换装类型 | layers 配置 | 说明 |
|---------|-------------|------|
| 简易换装 | `['hat', 'shirt', 'pants']` | 最简 3 层，适合快速体验 |
| 标准换装 | `['hat', 'glasses', 'shirt', 'pants', 'shoes']` | 默认 5 层，覆盖主要部位 |
| 完整换装 | `['hair', 'hat', 'glasses', 'earring', 'necklace', 'shirt', 'pants', 'shoes', 'bag']` | 9 层，接近专业换装游戏 |
| 面部贴纸 | `['forehead', 'eyes', 'nose', 'mouth', 'cheek']` | 面部区域贴纸系统 |
| AR 装扮 | `['head', 'face', 'body']` | 配合 FaceInput 的 AR 贴纸 |

### layers 顺序与渲染
- 数组顺序决定渲染 z-order：索引越小 = z-order 越低 = 渲染越早 = 在下层
- 上面的 layers 列表中，shoes 在最下面，hat 在最上面
- 渲染层应按 layers 索引从小到大叠加绘制

## 参数调优指南

### layers 设计
- 图层数量决定了换装的丰富度和复杂度
- **3~5 层**：适合休闲/社交小游戏，UI 简洁
- **6~8 层**：标准换装游戏，需要分类标签页 UI
- **9+ 层**：专业级，需要滚动列表和搜索功能
- 图层命名应直观，渲染层据此加载对应素材

### maxPerLayer 的影响
- **maxPerLayer=1**：最常用，每层互斥替换，简化 UI 和逻辑
- **maxPerLayer=2**：允许叠加（如双层项链、多个耳环），增加搭配自由度
- **maxPerLayer=3**：极少使用，UI 需展示"已装备列表"

### 素材命名约定
- 建议按 `{layer}_{itemId}` 命名素材文件（如 `hat_cowboy`, `shirt_striped`）
- 渲染层根据 `{ layer, itemId }` 加载对应精灵/图片
- 同一 layer 的所有物品应有相同的锚点和尺寸

### 互斥规则设计
当前实现中互斥是**层内**的（同层最多 maxPerLayer 件）。如需**跨层互斥**（如戴头盔时不能戴帽子），需在外部逻辑实现：
```
// 外部逻辑示例
if (layer === 'helmet') {
  dressUpEngine.clearLayer('hat'); // 戴头盔时清空帽子层
}
```

## 事件协议

### 发出事件

| 事件名 | Payload | 触发条件 |
|--------|---------|---------|
| `dressup:equip` | `{ layer: string, itemId: string }` | 装备物品成功 |
| `dressup:unequip` | `{ layer: string, itemId: string }` | 卸下物品（手动或因 maxPerLayer 溢出） |
| `dressup:snapshot` | `{ equipped: EquippedItem[] }` | 调用 snapshot() 时 |

### 监听事件

| 事件名 | 来源模块 | 响应行为 |
|--------|---------|---------|
| `input:touch:tap` | TouchInput | data.layer + data.itemId → 调用 equip() |

## 跨模块联动规则

### 与 TouchInput 的联动（上游）
```
TouchInput → input:touch:tap { layer: 'hat', itemId: 'cowboy' }
    ↓
DressUpEngine.equip('hat', 'cowboy')
    ↓ dressup:equip { layer: 'hat', itemId: 'cowboy' }
```
- 渲染层/UI 层需要将物品选择面板的点击转换为 `{ layer, itemId }` 格式
- 没有 layer 或 itemId 的 tap 事件被忽略

### 与 FaceInput 的联动
- 面部贴纸模式：FaceInput 提供面部位置 → 渲染层在面部锚点上绘制装备物品
- DressUpEngine 管理装备状态，FaceInput 管理位置追踪
- 两者通过渲染层间接关联（不直接事件通信）

### 与 GameFlow 的联动
- 换装游戏通常无输赢条件（`GameFlow.onFinish = 'none'`）
- GameFlow.countdown = 0（无开场倒计时）
- 可选：设置 Timer 限时换装（如 60s 内搭配最佳造型）

### 与 Scorer 的联动
- 换装游戏通常不计分
- 可选：评分模式 — 根据搭配匹配度计分（需自定义评分逻辑）
- 可选：限时模式 — 装备指定物品得分

### 与反馈模块的联动
- **SoundFX**：dressup:equip → 穿戴音效，dressup:unequip → 脱下音效
- **ParticleVFX**：dressup:equip → 装备位置 sparkle 特效
- **UIOverlay**：显示物品选择面板、已装备物品列表
- **ResultScreen**：snapshot → 截图展示/分享

## 输入适配

| 输入方式 | 适配策略 |
|---------|---------|
| TouchInput | 原生支持，通过 `input:touch:tap` 的 layer + itemId |
| FaceInput | 配合使用：面部位置 → 贴纸定位（渲染层处理），不直接驱动 equip |
| HandInput | 可扩展：手势选择物品（如张手=下一件，握拳=确认），需自定义映射 |
| BodyInput | 不适用 |
| DeviceInput | 可扩展：设备倾斜浏览物品列表 |
| AudioInput | 不适用 |

## 常见 Anti-Pattern

**1. layers 包含重复项**
- ❌ `layers = ['hat', 'hat', 'shirt']` → 'hat' 层被初始化两次，第二次覆盖第一次
- ✅ layers 中每个字符串唯一

**2. equip 非法 layer**
- ❌ `equip('weapon', 'sword')` 但 layers 中不包含 'weapon' → 返回 false，静默失败
- ✅ 确保 equip 的 layer 参数存在于 layers 配置中

**3. maxPerLayer 过大导致 UI 混乱**
- ❌ `maxPerLayer = 3` 但 UI 只显示一个装备位 → 玩家看不到已装备的多件物品
- ✅ UI 需支持显示当前层所有已装备物品，或保持 maxPerLayer=1

**4. 忘记在渲染层处理 z-order**
- ❌ 所有装备物品在同一层级渲染 → 帽子被裤子遮挡
- ✅ 按 layers 数组索引设置渲染 z-order

**5. snapshot 未连接到分享功能**
- ❌ 调用 snapshot() 但无 UI 响应 `dressup:snapshot` → 截图功能无效
- ✅ ResultScreen 或自定义 UI 监听 dressup:snapshot 实现截图/分享

**6. 换装游戏添加 Timer 和 Lives**
- ❌ Timer countdown + Lives → 换装游戏变成压力游戏，违背创意表达核心
- ✅ 换装游戏不加强制结束机制，让玩家自由搭配

## 常见问题 & 边界情况

- init 时按 layers 配置初始化空 Map，后续 equip 在 Map 上操作
- equip 返回 boolean：成功=true，失败=false（layer 非法或已装备相同 itemId）
- unequip 返回 boolean：成功=true，失败=false（layer 不存在或 itemId 不在列表中）
- equip 重复 itemId 返回 false（不会触发 dressup:equip 事件）
- maxPerLayer 溢出时 `shift()` 移除最旧物品（FIFO），先发 dressup:unequip 再 dressup:equip
- `getEquipped()` 无参数返回所有层的装备，传 layer 参数返回指定层
- `clearLayer(layer)` 逐个发出 dressup:unequip 后清空该层
- EquippedItem 结构：`{ layer: string, itemId: string }`
- 内部使用 `Map<string, string[]>`，equip/unequip 直接修改数组（**注意：这是 mutation**）
- update() 是 no-op（纯事件驱动模块）
- `reset()` 清空 Map 并按 layers 重新初始化空数组
- 当 layers 配置变更后需 reset() 重新初始化（否则旧层残留）
- items 数组中的顺序即装备顺序（最早装备的在 index 0）
