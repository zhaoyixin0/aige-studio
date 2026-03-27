# DialogueSystem — 对话系统模块

## 基本信息
- 类型: mechanic
- 类名: `DialogueSystem`
- 注册名: `DialogueSystem`
- 文件: `src/engine/modules/mechanic/dialogue-system.ts`
- 依赖: 无（独立运行）
- 可选联动: GameFlow, UIOverlay, BranchStateMachine, Collision, SoundFX

## 模块定义

DialogueSystem 管理游戏内的对话交互，支持多分支对话树、选项选择和节点效果触发。对话开始时自动暂停游戏（发出 `gameflow:pause`），结束时恢复（发出 `gameflow:resume`）。每个对话树由多个节点组成，节点可包含角色对白、玩家选项和附带效果（如触发剧情事件、给予物品等）。模块完全事件驱动，`update()` 为空操作。

**工作流程：**
1. `init()` 时监听 `triggerEvent`（默认 `collision:hit`）→ 从事件数据中提取 `dialogueId` 启动对话
2. `init()` 时监听 `advanceEvent`（默认 `input:touch:tap`）→ 推进当前对话节点
3. `startDialogue(dialogueId)` → 暂停游戏 → 发出 `dialogue:start` → 显示第一个节点
4. 每个节点显示时发出 `dialogue:node`（含 speaker、text、choices）→ 并执行节点 effects
5. 无选项节点: `advanceNode()` → 跳转 `node.next`；有选项节点: 等待 `selectChoice(index)`
6. 到达终端节点（无 next、无 choices）→ `endDialogue()` → 恢复游戏 → 发出 `dialogue:end`

**对话系统设计参考：**

| 设计模式 | 经典案例 | 特点 | 适用场景 |
|----------|---------|------|---------|
| 线性对话 | JRPG 过场 | 固定剧情，按顺序推进 | 叙事驱动 |
| 分支对话 | Witcher, Mass Effect | 选项影响后续剧情 | 角色扮演 |
| 轮盘选项 | Fallout 4 | 简化选项 UI | 动作 RPG |
| 气泡对话 | Animal Crossing | NPC 头顶气泡 | 休闲/社交 |
| 对话触发任务 | Zelda NPC | 对话后开启任务 | 冒险/探索 |
| 条件对话 | Baldur's Gate | 根据属性/状态显示不同选项 | 深度 RPG |

## 核心参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| dialogues | Record<string, DialogueTree> (object) | `{}` | 对话树集合，键为对话 ID |
| triggerEvent | string | `'collision:hit'` | 触发对话开始的事件名 |
| advanceEvent | string | `'input:touch:tap'` | 推进对话节点的输入事件名 |

### DialogueTree 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 对话树唯一标识 |
| startNode | string | 起始节点 ID |
| nodes | Record<string, DialogueNode> | 节点字典 |

### DialogueNode 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点唯一标识 |
| speaker | string | 说话者名称 |
| text | string | 对话文本内容 |
| choices | DialogueChoice[] (可选) | 玩家可选选项列表 |
| next | string (可选) | 下一个节点 ID（无选项时的线性推进） |
| effects | `{ event, data }[]` (可选) | 节点显示时触发的效果事件列表 |

### DialogueChoice 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 选项显示文本 |
| next | string | 选择后跳转的节点 ID |

## 事件

### 发出事件

| 事件名 | 数据结构 | 触发条件 |
|--------|----------|---------|
| `dialogue:start` | `{ dialogueId, speaker }` | 对话开始时 |
| `dialogue:node` | `{ nodeId, speaker, text, choices }` | 每个对话节点显示时 |
| `dialogue:choice` | `{ nodeId, choiceIndex }` | 玩家选择选项时 |
| `dialogue:end` | `{ dialogueId }` | 对话结束时 |
| `gameflow:pause` | （无数据） | 对话开始时暂停游戏 |
| `gameflow:resume` | （无数据） | 对话结束时恢复游戏 |
| `[node.effects[].event]` | `node.effects[].data` | 节点显示时触发自定义效果事件 |

### 监听事件

| 事件名 | 响应行为 |
|--------|---------|
| `[triggerEvent]` | 从事件数据中提取 `dialogueId` 并启动对应对话 |
| `[advanceEvent]` | 若当前有活跃对话则推进到下一节点 |
| `gameflow:pause` | 暂停模块（BaseModule 统一处理） |
| `gameflow:resume` | 恢复模块（BaseModule 统一处理） |

## 配合模块

| 模块 | 关系 | 说明 |
|------|------|------|
| GameFlow | 核心联动 | 对话期间发出 `gameflow:pause` 暂停游戏，结束时 `gameflow:resume` 恢复 |
| UIOverlay | 显示 | 监听 `dialogue:node` 渲染对话框、角色名、文本和选项按钮 |
| BranchStateMachine | 剧情分支 | `dialogue:choice` 可驱动状态机切换剧情分支 |
| Collision | 触发 | NPC 碰撞触发对话（`collision:hit` + `dialogueId` 数据） |
| SoundFX | 音效 | 监听 `dialogue:node` 播放文字逐字音效或角色语音 |
| EnemyAI | 间接 | 对话期间游戏暂停，敌人 AI 同步停止 |
| SkillTree | 效果 | 对话节点 effects 可奖励技能点或解锁技能 |

### 关键联动链路

```
[对话触发链路]
玩家接触 NPC → collision:hit { dialogueId: 'npc_01' }
  → DialogueSystem.startDialogue('npc_01')
    → emit('gameflow:pause')
      → 所有模块暂停 update
    → emit('dialogue:start', { dialogueId: 'npc_01', speaker: '村长' })
    → emit('dialogue:node', { nodeId: 'greeting', speaker: '村长', text: '...', choices: [...] })
      → UIOverlay 渲染对话框

[选项选择链路]
玩家点击选项 → DialogueSystem.selectChoice(1)
  → emit('dialogue:choice', { nodeId: 'greeting', choiceIndex: 1 })
    → BranchStateMachine 记录分支选择
  → 跳转到 choice.next 对应节点
    → emit('dialogue:node', { ... })
      → 若 node.effects 非空: 逐个发出效果事件

[对话结束链路]
到达终端节点 → DialogueSystem.endDialogue()
  → emit('gameflow:resume')
    → 所有模块恢复 update
  → emit('dialogue:end', { dialogueId: 'npc_01' })
```

## 公共 API

| 方法 | 签名 | 说明 |
|------|------|------|
| startDialogue | `(dialogueId: string) → boolean` | 启动指定对话树，返回是否成功 |
| advanceNode | `() → void` | 推进到下一节点（仅对无选项节点有效） |
| selectChoice | `(index: number) → void` | 选择当前节点的第 index 个选项 |
| endDialogue | `() → void` | 强制结束当前对话 |
| getCurrentNode | `() → DialogueNode \| null` | 获取当前对话节点 |
| isActive | `() → boolean` | 检查是否有活跃对话 |

## 示例配置

```json
{
  "type": "DialogueSystem",
  "params": {
    "triggerEvent": "collision:hit",
    "advanceEvent": "input:touch:tap",
    "dialogues": {
      "npc_01": {
        "id": "npc_01",
        "startNode": "greeting",
        "nodes": {
          "greeting": {
            "id": "greeting",
            "speaker": "村长",
            "text": "勇者，你来了！村子正被怪物威胁...",
            "choices": [
              { "text": "我来帮忙！", "next": "accept" },
              { "text": "再见。", "next": "decline" }
            ]
          },
          "accept": {
            "id": "accept",
            "speaker": "村长",
            "text": "太好了！去北边的森林消灭它们吧！",
            "effects": [
              { "event": "quest:start", "data": { "questId": "forest_monsters" } }
            ]
          },
          "decline": {
            "id": "decline",
            "speaker": "村长",
            "text": "......请三思。"
          }
        }
      }
    }
  }
}
```

## 常见 Anti-Pattern

**对话期间未暂停游戏导致玩家受伤**
- 注意: 当前实现已自动在 `startDialogue` 时发出 `gameflow:pause`，无需手动处理
- 风险: 若其他模块未正确响应 `gameflow:pause`，可能导致对话期间仍受伤

**triggerEvent 触发过于频繁**
- 错误: `triggerEvent: 'collision:hit'` 但 NPC 碰撞体积太大 → 每帧触发 → 对话反复重启
- 正确: 确保触发源在对话激活期间不会再次发出事件（`isActive()` 检查由上层实现）

**advanceEvent 与游戏操作冲突**
- 错误: `advanceEvent: 'input:touch:tap'` 与攻击/跳跃使用同一事件 → 对话推进误触
- 正确: 对话期间游戏已暂停，通常不会冲突；若有问题可使用独立输入事件

**对话节点 next 引用不存在的节点**
- 错误: `next: 'node_99'` 但 nodes 字典中无此 ID → `showCurrentNode` 因找不到节点而不显示
- 正确: 确保所有 next 和 choice.next 引用的节点 ID 在 nodes 字典中存在

**effects 事件发出但无模块监听**
- 错误: `effects: [{ event: 'quest:start', data: {...} }]` 但没有任务系统 → 事件被忽略
- 正确: 确保 effects 中使用的事件名有对应模块监听

## 常见问题 & 边界情况

- `startDialogue()` 在对话树不存在时返回 false，不发出任何事件
- 有选项的节点中 `advanceNode()` 直接返回，必须通过 `selectChoice()` 推进
- `selectChoice()` 的 index 超出 choices 范围时静默返回
- `endDialogue()` 在非活跃状态下安全调用（无副作用）
- `reset()` 若对话处于暂停状态会先发出 `gameflow:resume`，确保游戏不会卡在暂停
- 对话结束时（到达无 next 的终端节点）自动调用 `endDialogue()`
- `update()` 为空操作，模块完全事件驱动，不消耗帧时间
- 同一时间只能有一个活跃对话，启动新对话前需先结束当前对话
