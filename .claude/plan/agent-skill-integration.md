# Implementation Plan: Agent System Prompt + Skill Integration

> **Date:** 2026-03-26
> **Scope:** ConversationAgent system prompt update + SkillLoader integration + new module recommendations
> **Baseline:** 60 modules, 16 game types, 1172 tests

---

## Task Type
- [x] Backend (Agent system)
- [x] Frontend (Suggestion chips enhancement)
- [x] Fullstack

---

## Market Research Summary

### Competitor Analysis

| Product | Conversation Pattern | Recommendation System | Key Insight |
|---------|---------------------|----------------------|-------------|
| **Google AI Studio** | Vibe coding: describe → generate → iterate conversationally. Voice Canvas asks clarifying questions + offers real-time critiques | Homepage as command center showing capabilities + quick access | One continuous flow from prompt to output; agent asks probing questions |
| **v0 (Vercel)** | Three-input formula: Build [product surface: components, data, actions]. Chat guides through building | Generative UI blocks previewed in chat, copy/paste or install | Context-aware: considers user's role, comfort level, constraints |
| **Cursor** | @-reference for precise context. MCP integration for external tools | Indexes entire project, suggests based on cross-file relationships | **Context injection is key**: the more the agent knows about the project, the better suggestions |
| **SEELE** | Text-to-game: natural language → complete game. "Make enemies move faster" refines in seconds | AI-powered suggestions for level creation, character generation, narrative ideas | Iterative prompt refinement for gameplay tuning |
| **Emergent** | Multi-agent: scene creation, physics, animations, character logic handled by specialized agents | Real-time generation + iterative prompting for refinement | Specialized agents per domain (physics, art, logic) |

### Key Patterns Identified

1. **Context-Aware Suggestions** — Best systems inject project state into recommendations (Cursor indexes codebase, Google AI Studio shows capabilities)
2. **Skill/Knowledge Loading** — Leading agents load domain-specific knowledge dynamically, not just static system prompts
3. **Progressive Disclosure** — Start simple, reveal complexity only when needed (v0's three-input formula)
4. **Specialized Tool Calling** — Each tool should be narrow and well-described (Anthropic best practice)
5. **Iterative Refinement** — After initial creation, provide contextual suggestions for next steps based on what's missing

---

## Current Gaps in AIGE Studio Agent

### Gap 1: System Prompt Missing New Modules
- `ALL_MODULES` array has 38 items but we now have 60 modules
- Missing: Health, Shield, Projectile, BulletPattern, Aim, EnemyAI, WaveSpawner, LevelUp, StatusEffect, EquipmentSlot, EnemyDrop, SkillTree, DialogueSystem
- `GAME_TYPE_DESCRIPTIONS` missing 'action-rpg'
- System prompt says "15 种游戏类型" but we have 16

### Gap 2: No Skill Loading in Agent
- `SkillLoader` has `loadForGameCreation()`, `loadForModuleAdd()`, `loadForRecommendation()` — all unused by ConversationAgent
- Agent generates configs using only `getGamePreset()` defaults, no knowledge from skill files
- Recommendations are hardcoded chip lists, not informed by module-synergies.md or module-conflicts.md

### Gap 3: Recommendations Not Context-Aware
- `suggest_enhancements` tool generates chips based on what's NOT in config, but doesn't consider:
  - Module synergies (e.g., "EnemyAI works great with WaveSpawner + Health")
  - Module conflicts (e.g., "Jump conflicts with Runner's auto-movement")
  - Game-type-specific recommendations (e.g., shooter should suggest Projectile + Aim)

### Gap 4: No Module Category Awareness
- Agent doesn't know modules are grouped: Input (6), Mechanic-Base (8), Mechanic-Extended (11), Mechanic-Platformer (16), Mechanic-Shooter (7), Mechanic-RPG (6), Feedback (6)
- Can't suggest coherent module bundles for game archetypes

---

## Technical Solution

### Approach: Dynamic Skill Injection + Enhanced Tool Definitions

Instead of bloating the system prompt with all 60 module descriptions, use **two-phase context injection**:

**Phase 1 (System Prompt):** High-level module catalog + game type descriptions + behavior rules
**Phase 2 (Tool Execution):** Load specific skills via SkillLoader when creating/modifying games

This mirrors Cursor's approach: index everything, but inject relevant context at query time.

---

## Implementation Steps

### Step 1: Update ALL_MODULES and System Prompt

**File:** `src/agent/conversation-agent.ts`

Add 13 new modules to `ALL_MODULES`:
```typescript
const ALL_MODULES = [
  // ... existing 38 ...
  // Shooter (Batch 2)
  'Health', 'Shield', 'Projectile', 'BulletPattern', 'Aim', 'EnemyAI', 'WaveSpawner',
  // Action-RPG (Batch 3)
  'LevelUp', 'StatusEffect', 'EquipmentSlot', 'EnemyDrop', 'SkillTree', 'DialogueSystem',
];
```

Add 'action-rpg' to `GAME_TYPE_DESCRIPTIONS`:
```typescript
'action-rpg': '动作RPG — 打怪升级、拾取装备、技能树成长',
```

Add default theme:
```typescript
'action-rpg': 'space',
```

Update system prompt header: "16 种游戏类型" → dynamic count.

### Step 2: Add Module Category Guide to System Prompt

Add a **module bundle guide** section to the system prompt so the agent can recommend coherent sets:

```
## 模块组合推荐

### 射击类增强包
Projectile + Aim + Health + Shield + EnemyAI + WaveSpawner + BulletPattern
适用: shooting, action-rpg

### RPG 成长包
LevelUp + StatusEffect + EquipmentSlot + EnemyDrop + SkillTree
适用: action-rpg, platformer (进阶)

### 平台跳跃包
Gravity + PlayerMovement + Jump + StaticPlatform + MovingPlatform + CoyoteTime + Dash
适用: platformer, runner

### 对话剧情包
DialogueSystem + BranchStateMachine
适用: narrative, action-rpg

### 战斗基础包
Health + Lives + IFrames + Knockback + Shield
适用: platformer, shooting, action-rpg
```

This gives the agent vocabulary to suggest bundles, not just individual modules.

### Step 3: Integrate SkillLoader into create_game Flow

**File:** `src/agent/conversation-agent.ts`

In the `handleCreateGame()` method, before building the config:
1. Call `skillLoader.loadForGameCreation(gameType)` to get game-type-specific knowledge
2. Use the knowledge to validate/enhance the generated config
3. Inject module-specific defaults from skill files

```typescript
// In handleCreateGame():
private async handleCreateGame(input: any): Promise<ConversationResult> {
  const gameType = input.game_type;

  // NEW: Load game-specific skills for better config generation
  const skillContext = await this.skillLoader.loadForGameCreation(gameType);

  // Use skillContext to inform which modules are "required" vs "optional"
  // and apply game-type-specific parameter tuning
  const preset = getGamePreset(gameType);
  // ... build config with skill-informed defaults
}
```

### Step 4: Enhance suggest_enhancements with Skill Knowledge

**File:** `src/agent/conversation-agent.ts`

In `generateSuggestions()`:
1. Call `skillLoader.loadForRecommendation()` to get synergy/conflict info
2. Filter suggestions based on synergies (promote) and conflicts (demote)
3. Group suggestions into bundles when 2+ related modules are missing

```typescript
private async generateSuggestions(currentModules: string[], gameType: string): Promise<Chip[]> {
  // Load synergy/conflict knowledge
  const skillContext = await this.skillLoader.loadForRecommendation();

  // Current: just list missing modules
  // NEW: prioritize by synergy score, bundle related modules
  const bundles = this.identifyRelevantBundles(currentModules, gameType);
  const individual = this.identifySynergyModules(currentModules, skillContext);

  // Return mix of bundle chips + individual module chips
  return [...bundles, ...individual].slice(0, 8);
}
```

### Step 5: Add load_skill Tool (Optional Enhancement)

Add a 4th tool to ConversationAgent that lets Claude dynamically load a module's skill file when a user asks detailed questions:

```typescript
{
  name: 'load_skill',
  description: '加载指定模块的详细知识文档，用于回答用户关于模块功能的具体问题。',
  input_schema: {
    type: 'object',
    properties: {
      module_type: { type: 'string', description: '模块类型名' },
    },
    required: ['module_type'],
  },
}
```

When user asks "EnemyAI 怎么配置？" → agent calls `load_skill('EnemyAI')` → skill content injected into context → agent gives informed answer.

### Step 6: Update Suggestion Chips for New Modules

**File:** `src/agent/conversation-agent.ts`

Update the chip generation logic to include new module categories:

```typescript
// Module suggestion chips now include Batch 2/3 modules
const MODULE_CHIPS: Record<string, Chip[]> = {
  shooter: [
    { id: 'add-projectile', label: '添加弹幕系统', emoji: '🔫' },
    { id: 'add-enemy-ai', label: '添加敌人AI', emoji: '🤖' },
    { id: 'add-wave-spawner', label: '添加波次系统', emoji: '🌊' },
    { id: 'add-shield', label: '添加护盾', emoji: '🛡️' },
  ],
  rpg: [
    { id: 'add-levelup', label: '添加升级系统', emoji: '⬆️' },
    { id: 'add-skill-tree', label: '添加技能树', emoji: '🌳' },
    { id: 'add-equipment', label: '添加装备系统', emoji: '⚔️' },
    { id: 'add-dialogue', label: '添加对话系统', emoji: '💬' },
  ],
};
```

### Step 7: Make SkillLoader Async-Safe in ConversationAgent

Since `SkillLoader.load()` is async and ConversationAgent may call it during tool execution, ensure:
1. SkillLoader instance is created once in ConversationAgent constructor
2. Skill loading doesn't block the UI thread
3. Cache ensures repeated loads are instant

```typescript
class ConversationAgent {
  private skillLoader = new SkillLoader();

  // Skills are loaded lazily and cached
  // First call: ~10ms (Vite glob import)
  // Subsequent calls: <1ms (Map cache)
}
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/agent/conversation-agent.ts:43-53` | Modify | Add 13 new modules to ALL_MODULES |
| `src/agent/conversation-agent.ts:58-74` | Modify | Add action-rpg to GAME_TYPE_DESCRIPTIONS |
| `src/agent/conversation-agent.ts:76-82` | Modify | Add action-rpg to DEFAULT_THEME |
| `src/agent/conversation-agent.ts:84-111` | Modify | Update system prompt: module bundles, 16 game types |
| `src/agent/conversation-agent.ts:117-163` | Modify | Update create_game tool: add game_type enum update |
| `src/agent/conversation-agent.ts` (handleCreateGame) | Modify | Integrate SkillLoader for game creation |
| `src/agent/conversation-agent.ts` (generateSuggestions) | Modify | Skill-aware recommendations |
| `src/agent/conversation-agent.ts` (TOOLS) | Modify | Add load_skill tool definition |
| `src/agent/skill-loader.ts` | Modify | Add loadForModuleRecommendation() with bundle logic |

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| System prompt token bloat from module bundles | MEDIUM | Keep bundle descriptions terse (1 line each); module list is just names |
| SkillLoader async failure blocks game creation | LOW | Try-catch with fallback to current behavior (no skills) |
| Suggestion chips overwhelm user with too many options | MEDIUM | Cap at 8 chips; prioritize bundles over individual modules |
| load_skill tool adds latency to conversations | LOW | Skills are cached after first load; typical <1ms |
| Claude may hallucinate module names not in ALL_MODULES | LOW | Validate tool output against ALL_MODULES array |

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Modules in system prompt | 38 | 60 (+22) |
| Game types | 15 | 16 (+1 action-rpg) |
| Suggestion quality | Static chip list | Synergy-informed bundles |
| Skill utilization | 0% (SkillLoader unused) | loadForGameCreation + loadForRecommendation |
| Agent context per query | ~800 tokens | ~1200 tokens (+50%, from bundles section) |

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A
- GEMINI_SESSION: N/A
