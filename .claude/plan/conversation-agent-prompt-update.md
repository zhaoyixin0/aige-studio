## Implementation Plan: Conversation Agent System Prompt Update

### Task Type
- [x] Frontend (ConversationAgent is client-side, runs in browser)
- [ ] Backend
- [ ] Fullstack

### Problem Statement

After adding Batch 2 (shooter) and Batch 3 (RPG) modules, plus the action-rpg game type, the ConversationAgent's system prompt and supporting code have several gaps that prevent Claude from properly guiding users:

1. **Module list is flat** — 61 modules listed with no descriptions; Claude can't explain what a module does or recommend appropriate ones
2. **Missing RPG interaction guidance** — System prompt doesn't explain LevelUp+EnemyDrop+StatusEffect interactions, stat growth, loot tables
3. **No input method semantics** — Shooting/action-rpg use different input event mappings (tap=jump vs shoot, hold=move) but prompt doesn't explain this
4. **Suggestion chips incomplete** — `generateSuggestions()` missing all Batch 2/3 modules (Health, Shield, LevelUp, EnemyDrop, StatusEffect, EquipmentSlot, SkillTree, Projectile, Aim, EnemyAI, WaveSpawner)
5. **Knowledge base unused** — 63 knowledge skill files exist but ConversationAgent doesn't use SkillLoader; old agent.ts does
6. **12 module skill files missing** — No knowledge files for Batch 2/3 modules
7. **Module wiring/synergy docs** — Don't cover shooter/RPG event flows and synergies

### Technical Solution

A multi-step update to the ConversationAgent system, prioritized by impact:

**Phase 1 (High Impact — System Prompt & Chips):**
- Restructure module list with categories and brief Chinese descriptions
- Add RPG module interaction patterns to system prompt
- Add input method semantics per complex game type
- Expand `generateSuggestions()` with Batch 2/3 modules and game-type-aware filtering
- Add `modify_game` guidance for `set_param` with common param examples

**Phase 2 (Medium Impact — Knowledge Base):**
- Create 12 missing module skill files for Batch 2 & 3
- Update module-wiring.md with shooter/RPG event flows
- Update module-synergies.md with shooter/RPG synergy combinations

**Phase 3 (Optional — SkillLoader Integration):**
- Integrate SkillLoader into ConversationAgent for dynamic context enrichment (optional, significant architectural change)

---

### Implementation Steps

#### Step 1: Restructure SYSTEM_PROMPT module list with categories and descriptions
**File:** `src/agent/conversation-agent.ts` (lines 94-96)
**Expected deliverable:** Module list grouped by category with 1-line Chinese descriptions

Replace flat module list:
```
## 可用模块
FaceInput, HandInput, BodyInput, ...
```

With categorized list:
```
## 可用模块（61 个，按类别）

### 输入模块
- TouchInput — 触屏点击/滑动/长按
- FaceInput — 面部追踪（表情、张嘴、眨眼）
- HandInput — 手势识别（石头剪刀布等）
- BodyInput — 全身姿态检测
- DeviceInput — 设备倾斜/摇晃
- AudioInput — 声音/吹气检测

### 核心机制
- GameFlow — 游戏状态流程（倒计时→游戏中→结束）
- Spawner — 物体生成器（掉落物、收集物）
- Collision — 碰撞检测（圆形碰撞体，按层分组）
- Scorer — 计分系统（命中加分、连击倍率）
- Timer — 倒计时/计时器
- Lives — 生命/血量系统
- DifficultyRamp — 难度递增（按时间/分数/波次）
- ComboSystem — 独立连击系统（倍率、衰减）
- PowerUp — 增益道具（加速、护盾、磁铁）

### 射击/战斗
- PlayerMovement — 角色移动（加速度、边界限制）
- Projectile — 弹丸系统（速度、伤害、射速、穿透）
- Aim — 瞄准系统（手动/自动锁定最近敌人）
- EnemyAI — 敌人行为AI（巡逻、追击、逃跑）
- WaveSpawner — 波次生成器（波间冷却、递增系数）
- Health — 血量系统（最大血量、伤害事件）
- Shield — 护盾系统（充能次数、冷却）
- BulletPattern — 弹幕模式（扇形、螺旋等）
- IFrames — 无敌帧（受伤后短暂无敌+闪烁）
- Knockback — 击退效果（受伤位移）

### RPG/成长
- LevelUp — 升级系统（经验值、等级、属性成长）
- EnemyDrop — 战利品掉落（掉落表、掉落概率）
- StatusEffect — 状态效果（中毒、燃烧、减速）
- SkillTree — 技能树（技能点、解锁、升级）
- EquipmentSlot — 装备系统（武器、护甲、饰品）
- DialogueSystem — 对话系统（NPC对话、任务提示）

### 平台跳跃
- Jump — 跳跃（跳跃力、重力配合）
- Gravity — 重力（下坠加速度、终端速度）
- StaticPlatform — 固定平台
- MovingPlatform — 移动平台（路径点、速度）
- OneWayPlatform — 单向平台（只从下方穿过）
- CrumblingPlatform — 碎裂平台（踩后倒计时消失）
- CoyoteTime — 土狼时间（离开平台后仍可跳跃）
- Dash — 冲刺（快速位移+可选无敌）
- Collectible — 收集物（金币、道具）
- Hazard — 危险物（尖刺、火焰）
- Checkpoint — 存档点（死亡重生位置）
- Inventory — 背包系统
- WallDetect — 墙壁检测+蹬墙跳

### 专用游戏引擎
- QuizEngine — 答题引擎（题目、选项、评分）
- Randomizer — 随机抽取（转盘）
- ExpressionDetector — 表情识别
- GestureMatch — 手势匹配
- BeatMap — 节拍映射（节奏游戏）
- MatchEngine — 配对引擎（翻牌记忆）
- Runner — 自动跑酷引擎
- DressUpEngine — 换装引擎
- BranchStateMachine — 分支叙事状态机
- PlaneDetection — AR平面检测

### 反馈/视觉
- CameraFollow — 镜头跟随（平滑、死区、边界）
- ParticleVFX — 粒子特效（爆炸、闪烁、光环）
- SoundFX — 音效（事件驱动音效+背景音乐）
- UIOverlay — HUD界面（分数、血量、生命、等级）
- ResultScreen — 结算画面（分数、星级、重玩）
```

**Rationale:** Claude needs descriptions to recommend modules correctly. Categories help Claude understand module relationships.

---

#### Step 2: Add RPG module interaction patterns to system prompt
**File:** `src/agent/conversation-agent.ts` (lines 97-132)
**Expected deliverable:** New section after module recipes

Add after the existing module recipes (after line 132):
```
### 射击/RPG 模块交互（重要）

#### 弹丸系统流程
TouchInput → tap/doubleTap → Projectile.fire() → 注册到 Collision(projectiles层)
Aim(auto模式) → 自动计算朝最近敌人的方向 → 更新 Projectile 射击方向

#### 波次敌人流程
WaveSpawner → wave:spawn → EnemyAI 初始化 → 注册到 Collision(enemies层)
EnemyAI → 巡逻/追击/攻击 → collision:damage(碰触玩家)
collision:hit(被弹丸击中) → Health 扣血 → enemy:death → EnemyDrop 掉落战利品

#### RPG 成长流程
enemy:death → LevelUp +XP → 累积到升级阈值 → levelup:levelup
levelup:levelup → 属性成长(hp +10, attack +2, defense +1)
enemy:death → EnemyDrop → 按掉落表概率掉落(药水/金币/装备)

#### 伤害链
collision:damage → Shield(消耗护盾充能) → Health(扣血) → IFrames(无敌闪烁) → Knockback(击退位移) → Lives(血量归零时 -1 命) → lives:zero → GameFlow 结束
```

---

#### Step 3: Add input method semantics per game type
**File:** `src/agent/conversation-agent.ts` (after input method section, ~line 141)
**Expected deliverable:** New section explaining input mappings for complex game types

```
### 复杂游戏类型的输入映射
- shooting: tap=射击, hold=移动方向, Aim(auto)自动锁定最近敌人
- action-rpg: tap=跳跃, doubleTap=射击, hold=左右移动, Aim(auto)自动锁定
- platformer: 左半屏hold=左移, 右半屏hold=右移, tap=跳跃, doubleTap=冲刺(需Dash模块)
- runner: tap=跳跃/换道, hold=无效果（自动跑）
```

---

#### Step 4: Expand generateSuggestions with Batch 2/3 modules
**File:** `src/agent/conversation-agent.ts` (lines 686-704)
**Expected deliverable:** Add shooter/RPG modules to MODULE_SUGGESTIONS, add game-type-aware filtering

Add missing modules to `MODULE_SUGGESTIONS`:
```typescript
// Shooter/Combat
Health:          { label: '血量系统', emoji: '💗' },
Shield:          { label: '护盾系统', emoji: '🛡️' },
Projectile:      { label: '弹丸系统', emoji: '🔫' },
EnemyAI:         { label: '敌人AI', emoji: '👾' },
WaveSpawner:     { label: '波次系统', emoji: '🌊' },
BulletPattern:   { label: '弹幕模式', emoji: '💫' },
// RPG/Progression
LevelUp:         { label: '升级系统', emoji: '⬆️' },
EnemyDrop:       { label: '战利品掉落', emoji: '💰' },
StatusEffect:    { label: '状态效果', emoji: '🧪' },
SkillTree:       { label: '技能树', emoji: '🌳' },
EquipmentSlot:   { label: '装备系统', emoji: '⚔️' },
```

Add game-type-aware filtering logic:
- Infer game type from currentModules
- For shooting/action-rpg: prioritize Shield, BulletPattern, ComboSystem, DifficultyRamp
- For platformer: prioritize MovingPlatform, CrumblingPlatform, Dash, CoyoteTime
- For catch/dodge/tap: prioritize DifficultyRamp, ComboSystem, Timer, Lives
- For RPG types: prioritize SkillTree, EquipmentSlot, StatusEffect, DialogueSystem

---

#### Step 5: Add set_param guidance with common examples to system prompt
**File:** `src/agent/conversation-agent.ts` (system prompt section)
**Expected deliverable:** Brief guidance on how to use modify_game set_param

```
## 修改参数示例
用户说"加快射速" → set_param: module_type='Projectile', param_key='fireRate', param_value=100
用户说"增加敌人数量" → set_param: module_type='WaveSpawner', param_key='enemiesPerWave', param_value=10
用户说"降低难度" → set_param: module_type='EnemyAI', param_key='speed', param_value=50
用户说"增加生命" → set_param: module_type='Lives', param_key='count', param_value=5
用户说"加大碰撞范围" → set_param: module_type='Collision', param_key='hitboxScale', param_value=1.5
```

---

#### Step 6: Create 12 missing module skill files (Batch 2 & 3)
**Directory:** `src/knowledge/modules/mechanic/`
**Expected deliverable:** 12 new .md files following existing format

Files to create:
1. `projectile.md` — Projectile module skill
2. `aim.md` — Aim module skill
3. `enemy-ai.md` — EnemyAI module skill
4. `wave-spawner.md` — WaveSpawner module skill
5. `health.md` — Health module skill
6. `shield.md` — Shield module skill
7. `level-up.md` — LevelUp module skill
8. `status-effect.md` — StatusEffect module skill
9. `equipment-slot.md` — EquipmentSlot module skill
10. `enemy-drop.md` — EnemyDrop module skill
11. `skill-tree.md` — SkillTree module skill
12. `dialogue-system.md` — DialogueSystem module skill

Each file follows existing format:
```markdown
# ModuleName — Module Skill

## 模块定义
<one-paragraph description>

## 核心参数
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|

## 事件
| 事件名 | 方向 | 说明 |
|--------|------|------|

## 配合模块
| 模块 | 关系 | 说明 |
|------|------|------|

## 示例配置
```json
...
```
```

---

#### Step 7: Update module-wiring.md with shooter/RPG event flows
**File:** `src/knowledge/relations/module-wiring.md`
**Expected deliverable:** New sections 33-38 covering shooter and RPG event flows

Add sections:
- **33. Projectile 事件流**: fire → collision registration → hit → destroyed
- **34. EnemyAI 事件流**: spawn → patrol/chase/attack → death → drop
- **35. WaveSpawner 事件流**: wave:start → spawn enemies → wave:complete → cooldown → next wave
- **36. Health 事件流**: collision:damage → Shield check → hp decrease → health:zero → enemy:death
- **37. LevelUp 事件流**: enemy:death → xp gain → level check → levelup:levelup → stat growth
- **38. EnemyDrop 事件流**: enemy:death → loot roll → drop spawn → collectible:collected

Update event table with new events:
- `projectile:fire`, `projectile:destroyed`
- `wave:start`, `wave:spawn`, `wave:complete`, `wave:allComplete`
- `enemy:death`, `enemy:attack`
- `health:change`, `health:zero`
- `levelup:xp`, `levelup:levelup`
- `shield:block`, `shield:break`, `shield:recharge`

---

#### Step 8: Update module-synergies.md with shooter/RPG combinations
**File:** `src/knowledge/relations/module-synergies.md`
**Expected deliverable:** New synergy entries 24-30

Add synergy combinations:
- **24. Projectile + Aim + Collision（射击核心）** ★★★★★
- **25. EnemyAI + WaveSpawner + Collision（敌人系统）** ★★★★★
- **26. LevelUp + EnemyDrop + Health（RPG成长核心）** ★★★★★
- **27. Health + Shield + IFrames + Knockback（防御四件套）** ★★★★☆
- **28. WaveSpawner + DifficultyRamp（波次难度递增）** ★★★★☆
- **29. SkillTree + LevelUp + StatusEffect（深度成长）** ★★★★☆
- **30. EquipmentSlot + EnemyDrop（装备循环）** ★★★☆☆

---

### Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/agent/conversation-agent.ts:89-153` | Modify | Restructure system prompt: categorized modules, RPG interactions, input semantics, param examples |
| `src/agent/conversation-agent.ts:686-704` | Modify | Expand MODULE_SUGGESTIONS with Batch 2/3, add game-type-aware filtering |
| `src/knowledge/modules/mechanic/projectile.md` | Create | Projectile module skill file |
| `src/knowledge/modules/mechanic/aim.md` | Create | Aim module skill file |
| `src/knowledge/modules/mechanic/enemy-ai.md` | Create | EnemyAI module skill file |
| `src/knowledge/modules/mechanic/wave-spawner.md` | Create | WaveSpawner module skill file |
| `src/knowledge/modules/mechanic/health.md` | Create | Health module skill file |
| `src/knowledge/modules/mechanic/shield.md` | Create | Shield module skill file |
| `src/knowledge/modules/mechanic/level-up.md` | Create | LevelUp module skill file |
| `src/knowledge/modules/mechanic/status-effect.md` | Create | StatusEffect module skill file |
| `src/knowledge/modules/mechanic/equipment-slot.md` | Create | EquipmentSlot module skill file |
| `src/knowledge/modules/mechanic/enemy-drop.md` | Create | EnemyDrop module skill file |
| `src/knowledge/modules/mechanic/skill-tree.md` | Create | SkillTree module skill file |
| `src/knowledge/modules/mechanic/dialogue-system.md` | Create | DialogueSystem module skill file |
| `src/knowledge/relations/module-wiring.md:283+` | Modify | Add shooter/RPG event flows (sections 33-38) |
| `src/knowledge/relations/module-synergies.md:372+` | Modify | Add shooter/RPG synergy combinations (entries 24-30) |

### Implementation Notes

1. **System prompt token budget**: The current prompt is ~1500 tokens. Adding categorized modules and interaction patterns will increase to ~3000 tokens. This is acceptable for Claude API (max_tokens=4096 for response, system prompt is separate).

2. **Immutability**: All code changes follow immutable patterns (spread operators, no mutation).

3. **Backward compatibility**: No API changes. The system prompt update is purely additive. Suggestion chips are backward compatible (only adds new entries).

4. **Testing strategy**:
   - Step 1-3: Manual testing with Claude API (system prompt is a string, not easily unit-testable)
   - Step 4: Unit test for `generateSuggestions()` — verify new modules appear for shooter/RPG game types
   - Step 6-8: No runtime tests needed (knowledge base is static markdown)

5. **Phase 3 (SkillLoader integration)**: Deferred. Would require significant architectural changes to ConversationAgent (async init, context window management). Better addressed as a separate feature when needed.

### Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| System prompt too long → increased API latency/cost | Keep descriptions concise (1-line per module). Monitor token count. Remove verbose examples if needed. |
| Categorized modules confuse Claude about valid module names | Keep ALL_MODULES constant unchanged. Categories are only in the prompt text. |
| Game-type-aware suggestions filter out useful modules | Use soft filtering (prioritize, don't exclude). Always show generic modules as fallback. |
| Knowledge files created but never loaded | This is expected — they serve as documentation and future SkillLoader integration. Mark as Phase 3. |

### SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codex backend unavailable)
- GEMINI_SESSION: N/A (gemini backend unavailable)
