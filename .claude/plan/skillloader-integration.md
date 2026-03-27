# Implementation Plan: SkillLoader Integration into ConversationAgent

## Task Type
- [x] Backend (Agent/Knowledge system)

## Problem Statement

ConversationAgent (1001 lines) hardcodes all game knowledge in a ~168-line SYSTEM_PROMPT constant, while 78 rich knowledge markdown documents (~697KB) sit unused in `src/knowledge/`. The older `Agent` class uses `SkillLoader` to dynamically load these docs, but `ConversationAgent` (the active system) does not.

**Current issues:**
1. SYSTEM_PROMPT has shallow, manually-maintained knowledge (e.g., "碰撞检测（圆形碰撞体，按层分组）")
2. Knowledge documents have deep, authoritative content (parameter tables, event protocols, anti-patterns, cross-module interaction rules) — but unused
3. When game-type or module knowledge evolves, SYSTEM_PROMPT must be manually updated — drift risk
4. Token budget is wasted on generic knowledge when only game-type-specific content is needed

**Goal:** ConversationAgent dynamically loads relevant knowledge per conversation context, producing higher-quality game configs with correct parameters, collision rules, and module interactions.

## Technical Solution

### Architecture: Selective Prompt Augmentation

**Strategy:** Keep compact module/game-type overview in SYSTEM_PROMPT, replace detailed sections with dynamically loaded knowledge.

```
process(message, currentConfig)
  │
  ├─ Determine context (game type from config or message)
  │
  ├─ SkillLoader.loadForConversation(gameType, currentModuleTypes)
  │   ├─ Game type doc (4-9KB, ~1-2.5K tokens)
  │   ├─ Relevant module wiring subset (~2-4KB)
  │   └─ Module synergies for current modules (~1-2KB)
  │
  ├─ Build system prompt = COMPACT_BASE + loaded knowledge + current config
  │
  └─ Claude API call (with enriched context)
```

**Token budget:**
- Current SYSTEM_PROMPT: ~2K tokens (all generic)
- After: ~1K base + 2-4K targeted knowledge = 3-5K total (much richer, same budget)

### Key Design Decisions

1. **When to load:** In `process()`, before API call — synchronous with conversation flow
2. **What to load:** Game type doc + filtered wiring + synergies (NOT all 78 docs)
3. **Caching:** SkillLoader already has `Map<string, string>` cache — reuse it
4. **Fallback:** If SkillLoader fails, degrade to current hardcoded SYSTEM_PROMPT
5. **Compact vs. detailed:** Keep compact overview for LLM context window efficiency; append detailed knowledge only for the relevant game type

## Implementation Steps

### Step 1: Add `loadForConversation` to SkillLoader (New Method)
**File:** `src/agent/skill-loader.ts`
**Operation:** Add method
**Deliverable:** New async method that loads contextually relevant knowledge

```typescript
// Pseudo-code
async loadForConversation(
  gameType: string | null,
  currentModules: string[]
): Promise<string> {
  const sections: string[] = [];

  // 1. Game type document (if known)
  if (gameType) {
    const gameDoc = await this.load(`game-types/${gameType}.md`).catch(() => '');
    if (gameDoc) sections.push(gameDoc);
  }

  // 2. Module wiring relevant to current modules
  const wiring = await this.load('relations/module-wiring.md').catch(() => '');
  if (wiring && currentModules.length > 0) {
    sections.push(this.filterWiringForModules(wiring, currentModules));
  }

  // 3. Module synergies for current modules
  const synergies = await this.load('relations/module-synergies.md').catch(() => '');
  if (synergies && currentModules.length > 0) {
    sections.push(this.filterSynergiesForModules(synergies, currentModules));
  }

  return sections.filter(Boolean).join('\n\n---\n\n');
}
```

**Filtering logic:**
- `filterWiringForModules()` — Parse module-wiring.md, extract only event entries where source or target module is in `currentModules`
- `filterSynergiesForModules()` — Parse module-synergies.md, extract only synergy entries that mention at least one module in `currentModules`

### Step 2: Add `loadModuleDoc` to SkillLoader (New Method)
**File:** `src/agent/skill-loader.ts`
**Operation:** Add method
**Deliverable:** Method to load a single module's knowledge doc

```typescript
async loadModuleDoc(moduleType: string): Promise<string> {
  const category = this.findCategory(moduleType);
  // PascalCase → kebab-case: EnemyAI → enemy-ai
  const filename = moduleType
    .replace(/([A-Z])/g, '-$1').toLowerCase()
    .replace(/^-/, '');
  return this.load(`modules/${category}/${filename}.md`).catch(() => '');
}
```

This method normalizes PascalCase module names to kebab-case filenames (e.g., `EnemyAI` → `enemy-ai.md`).

### Step 3: Restructure SYSTEM_PROMPT into base + dynamic sections
**File:** `src/agent/conversation-agent.ts`
**Operation:** Modify
**Deliverable:** Split SYSTEM_PROMPT into SYSTEM_PROMPT_BASE (compact, always included) and dynamic knowledge section

**Remove from SYSTEM_PROMPT (lines 169-244):**
- `## 游戏类型模块配方` section (~35 lines of hardcoded collision rules)
- `## 射击/RPG 模块交互` section (~17 lines of interaction patterns)
- `## 修改参数示例` section (~6 lines)

These are replaced by richer, more accurate knowledge loaded from game-type docs and module-wiring.md.

**Keep in SYSTEM_PROMPT_BASE:**
- Game type list with descriptions (compact, ~16 lines)
- Module list by category (compact, ~65 lines)
- Themes, art styles, input methods (compact, ~10 lines)
- Behavior rules (compact, ~10 lines)

**New dynamic section (appended at runtime):**
```typescript
let systemPrompt = SYSTEM_PROMPT_BASE;

// Inject loaded knowledge
if (knowledgeContext) {
  systemPrompt += `\n\n## 详细游戏知识（请严格遵循）\n${knowledgeContext}`;
}

// Inject current config context (existing logic)
if (currentConfig) {
  systemPrompt += `\n\n## 当前游戏配置\n...`;
}
```

### Step 4: Integrate SkillLoader into ConversationAgent.process()
**File:** `src/agent/conversation-agent.ts`
**Operation:** Modify
**Deliverable:** ConversationAgent loads knowledge before each API call

```typescript
export class ConversationAgent {
  private client: Anthropic | null;
  private history: ConversationMessage[] = [];
  private skillLoader = new SkillLoader();  // NEW

  async process(message: string, currentConfig?: GameConfig): Promise<ConversationResult> {
    if (!this.client) return this.processWithoutApi(message);

    // ... existing history management ...

    // NEW: Determine game type context
    const gameType = currentConfig
      ? this.inferGameType(currentConfig)
      : this.detectGameTypeFromMessage(message);

    const currentModules = currentConfig
      ? currentConfig.modules.map(m => m.type)
      : [];

    // NEW: Load relevant knowledge
    let knowledgeContext = '';
    try {
      knowledgeContext = await this.skillLoader.loadForConversation(
        gameType, currentModules
      );
    } catch {
      // Fallback: proceed without knowledge enrichment
    }

    // Build enriched system prompt
    let systemPrompt = SYSTEM_PROMPT_BASE;
    if (knowledgeContext) {
      systemPrompt += `\n\n## 详细游戏知识\n${knowledgeContext}`;
    }
    if (currentConfig) {
      // ... existing config injection ...
    }

    // ... existing API call ...
  }
}
```

### Step 5: Add `detectGameTypeFromMessage` helper
**File:** `src/agent/conversation-agent.ts`
**Operation:** Add private method
**Deliverable:** Extract game type from user message using existing KEYWORD_MAP (reuse, not duplicate)

```typescript
private detectGameTypeFromMessage(message: string): string | null {
  for (const { pattern, gameType } of KEYWORD_MAP) {
    if (pattern.test(message)) return gameType;
  }
  return null;
}
```

### Step 6: Add module-specific knowledge for modify_game
**File:** `src/agent/conversation-agent.ts`
**Operation:** Modify tool handling
**Deliverable:** When `add_module` is called, load module doc for parameter accuracy

Currently `buildGameConfig` and `applyConfigChanges` use `getModuleParams()` for defaults. The knowledge docs contain richer parameter guidance per game type.

**Approach:** After tool_use response with `add_module`, if user continues conversation about that module, load module doc as additional context in next turn.

*This is lower priority — the game type doc already includes recommended module params. Defer to a follow-up if needed.*

### Step 7: Unit tests for new SkillLoader methods
**File:** `src/agent/__tests__/skill-loader.test.ts` (new)
**Operation:** Create
**Deliverable:** Tests for loadForConversation, loadModuleDoc, filterWiring, filterSynergies

```typescript
describe('SkillLoader', () => {
  describe('loadForConversation', () => {
    it('loads game type doc + wiring + synergies for shooting', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('shooting', ['Projectile', 'EnemyAI']);
      expect(result).toContain('射击');
      expect(result).toContain('projectile:fire');
    });

    it('returns empty string when game type not found', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadForConversation('nonexistent', []);
      expect(result).toBe('');
    });

    it('filters wiring to only include relevant modules', async () => {
      // Verify wiring output only contains entries mentioning currentModules
    });
  });

  describe('loadModuleDoc', () => {
    it('converts PascalCase to kebab-case filename', async () => {
      const loader = new SkillLoader();
      const result = await loader.loadModuleDoc('EnemyAI');
      expect(result).toContain('EnemyAI');
    });
  });
});
```

### Step 8: Integration test — ConversationAgent with knowledge
**File:** `src/agent/__tests__/conversation-agent-knowledge.test.ts` (new)
**Operation:** Create
**Deliverable:** Verify knowledge loading integrates correctly with process()

Test scenarios:
- process() with shooting game → knowledge contains shooting-specific collision rules
- process() with no API key → falls back without crash
- SkillLoader failure → graceful degradation to base prompt

### Step 9: Update CameraFollow in SkillLoader.findCategory()
**File:** `src/agent/skill-loader.ts`
**Operation:** Modify
**Deliverable:** Add CameraFollow to feedback category

```typescript
private findCategory(moduleType: string): string {
  const input = ['FaceInput', 'HandInput', 'BodyInput', 'TouchInput', 'DeviceInput', 'AudioInput'];
  const feedback = ['GameFlow', 'UIOverlay', 'ResultScreen', 'ParticleVFX', 'SoundFX', 'CameraFollow']; // + CameraFollow
  if (input.includes(moduleType)) return 'input';
  if (feedback.includes(moduleType)) return 'feedback';
  return 'mechanic';
}
```

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/agent/skill-loader.ts` | Modify | Add loadForConversation, loadModuleDoc, filtering methods, fix CameraFollow category |
| `src/agent/conversation-agent.ts` | Modify | Add SkillLoader instance, build dynamic system prompt, add detectGameTypeFromMessage |
| `src/agent/__tests__/skill-loader.test.ts` | Create | Unit tests for new SkillLoader methods |
| `src/agent/__tests__/conversation-agent-knowledge.test.ts` | Create | Integration tests for knowledge loading |

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Token budget overflow (large game type doc + wiring + synergies) | Filter wiring/synergies to only relevant modules; cap loaded content at ~15KB |
| SkillLoader load fails (missing file, Vite glob issue) | try/catch with fallback to SYSTEM_PROMPT_BASE (graceful degradation) |
| PascalCase → kebab-case conversion edge cases | Test with all 60+ module names; handle special cases (IFrames → i-frames) |
| Latency increase from async knowledge loading | SkillLoader has Map cache; first load ~10ms, subsequent loads ~0ms |
| Breaking existing tests | SYSTEM_PROMPT_BASE retains same structure; new tests cover new behavior |
| Duplicate knowledge (base prompt + loaded doc) | Remove detailed sections from base, keep only compact overview |

## Out of Scope (Future)

- Streaming API responses (separate feature)
- Per-module knowledge injection on modify_game (Step 6 — lower priority)
- Automatic knowledge doc generation from module source code
- H-1 conversation-agent.ts >800 lines (this plan slightly reduces SYSTEM_PROMPT but file split is separate work)

## Build & Test Plan

```bash
# Step 1: Run existing tests to verify baseline
npx vitest run src/agent/__tests__/

# Step 2: After each step, verify no regression
npx tsc --noEmit && npx vitest run

# Step 3: Final verification
npx vitest run  # All 1218+ tests pass
```

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
