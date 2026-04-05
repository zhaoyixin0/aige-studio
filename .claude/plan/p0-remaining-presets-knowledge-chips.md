# P0 Remaining: Presets + Knowledge Injection + Chips

> Synthesized from Codex (backend) + Gemini (frontend) dual-model analysis.

---

## Overview

3 tasks to complete the P0 expert data integration:
1. Add PRESETS for 18 missing game types
2. Inject knowledge cards into ConversationAgent system prompt
3. Update DEFAULT_CHIPS with 4 new representative types

**4 steps, estimated 2-3 hours sequential.**

---

## Step 1: Add PRESETS for 18 Missing Game Types

### Goal
Every game type in ALL_GAME_TYPES returns a valid preset from `getGamePreset()`.

### Strategy: Category-Based Templates (Codex authority)

Group 18 types into 5 base templates, then customize per-type:

| Category | Base Modules | Types |
|----------|-------------|-------|
| Physics | GameFlow, Gravity, Collision, Scorer, Timer, Lives, ParticleVFX, SoundFX | slingshot, ball-physics, trajectory, bouncing, rope-cutting, ball-rolling, jelly |
| Puzzle | GameFlow, Collision, Scorer, Timer, UIOverlay, ResultScreen | jigsaw, scale-matching |
| Reflex | GameFlow, Timer, Scorer, UIOverlay, ResultScreen | quick-reaction |
| Creative | GameFlow, UIOverlay, ResultScreen | drawing, avatar-frame, head-tilt |
| Sports/Arcade | GameFlow, Spawner, Collision, Scorer, Timer, Lives | racing, cross-road, maze, sugar-insert, swimmer |

### Per-Type Specializations

```
slingshot:    + Aim(mode:'drag'), Projectile(speed:800), DifficultyRamp
trajectory:   + Aim(mode:'line'), Projectile(gravityScale:1), DifficultyRamp
bouncing:     + PlayerMovement(mode:'follow'), DifficultyRamp
ball-physics: + Gravity(g:9.8), PlayerMovement(mode:'follow')
ball-rolling: + Gravity(g:5.0), PlayerMovement(mode:'tilt')
rope-cutting: + Spawner(items:[good,bad]), TouchInput(gesture:'swipe')
jelly:        + Gravity(g:3.0), DifficultyRamp, Tween(clips)

jigsaw:       + Spawner(grid-style), Scorer(perMatch:20) [supportedToday:false → minimal]
scale-matching: + Spawner(balanced items), Scorer(perMatch:15)

quick-reaction: + Spawner(burstMode), Scorer(perHit:10, combo) [supportedToday:false → minimal]

drawing:       [supportedToday:false → minimal GameFlow+UIOverlay+ResultScreen]
avatar-frame:  [supportedToday:false → minimal GameFlow+UIOverlay+ResultScreen]
head-tilt:     [supportedToday:false → minimal GameFlow+FaceInput+UIOverlay+ResultScreen]

racing:       + Runner-like scrolling, Collision(obstacles), DifficultyRamp
cross-road:   + Spawner(horizontal lanes), Collision, Lives(3)
maze:         + PlayerMovement(mode:'follow'), Collision(walls)
sugar-insert: + Spawner(drop), Collision(container), Scorer(precision)
swimmer:      + Gravity(reduced:2.0), PlayerMovement(mode:'follow'), DifficultyRamp
```

### supportedToday: false Strategy
- Provide minimal preset (GameFlow + Timer + UIOverlay + ResultScreen)
- Agent can still create these; the game just won't have rich mechanics
- Future: when needed modules are added, expand the preset

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/game-presets.ts` | Modify | Add 18 preset entries |
| `src/agent/__tests__/presets-complete.test.ts` | Create | Verify all 38 types have presets |

### Test Strategy
- Every type in ALL_GAME_TYPES returns non-undefined from getGamePreset()
- Each preset includes minimum core: GameFlow, Timer
- Supported types include category-specific modules (e.g., Physics types have Gravity)
- Overlay merge still works (immutability)

### Size: L (18 presets, but templated)

---

## Step 2: ConversationAgent Knowledge Card Injection

### Goal
buildSystemPrompt() includes expert card data for the current game type.

### Implementation (Codex + Gemini authority)

#### 2a. Add `loadExpertCardRich()` to SkillLoader

```ts
// skill-loader.ts — new method
async loadExpertCardRich(gameType: string): Promise<string> {
  const key = `/src/knowledge/cards/game-type/gametype-${gameType}.card.json`;
  const loader = expertCardFiles[key];
  if (!loader) return '';
  const card = JSON.parse(await loader() as string);
  const top = (card.topModules ?? []).slice(0, 6).join(', ');
  const sig = Object.entries(card.signatureParams ?? {})
    .filter(([, v]: any) => (v?.confidence ?? 0) >= 0.3)  // lower threshold for display
    .slice(0, 6)
    .map(([k, v]: any) => `${k}: ${Math.round(v.suggested * 10) / 10}`)
    .join(', ');
  const missing = (card.missingModules ?? []).slice(0, 5).join(', ');
  return [
    `[Expert: ${card.displayName} (${card.expertDataCount} games)]`,
    top ? `推荐模块: ${top}` : '',
    sig ? `参考参数: ${sig}` : '',
    missing ? `缺失模块: ${missing}` : '',
  ].filter(Boolean).join('\n');
}
```

#### 2b. Modify buildSystemPrompt()

After existing markdown loading, append expert card block:

```ts
// conversation-agent.ts — in buildSystemPrompt()
if (gameType) {
  const expertBlock = await loader.loadExpertCardRich(gameType).catch(() => '');
  if (expertBlock) {
    prompt += `\n\n## 专家数据参考\n${expertBlock}`;
    prompt += '\n\n**策略**: 创建游戏后，如果有高置信度的参数建议，使用 push_expert_insight 工具推送到聊天（不要长段落解释）。仅在重大优化建议时引用专家数据。';
  }
}
```

#### 2c. Push policy (Gemini authority)
- Silent application: agent uses expert defaults as baseline without citing
- Explicit citation: only when user asks "优化" or agent suggests major enhancement
- push_expert_insight: after create_game, push 2-4 actionable suggestions max

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/agent/skill-loader.ts` | Modify | Add loadExpertCardRich() |
| `src/agent/conversation-agent.ts` | Modify | Inject expert block in buildSystemPrompt() |
| `src/agent/__tests__/conversation-agent-knowledge.test.ts` | Modify | Test expert card injection |

### Test Strategy
- buildSystemPrompt('shooting', []) includes "专家数据参考"
- buildSystemPrompt(null, []) does NOT include expert block
- buildSystemPrompt('nonexistent', []) gracefully degrades

### Size: S

---

## Step 3: A9-partial — DEFAULT_CHIPS Update

### Goal
Landing page shows balanced category representation with 2 new types.

### Implementation (Gemini authority)

Replace 2 less distinctive chips, add 2 new ones (keep total at 12):

```ts
// editor-store.ts
export const DEFAULT_CHIPS: Chip[] = [
  // Original (keep 10, no replacements — 12 total is acceptable)
  { id: 'catch', label: '接住游戏', emoji: '🎯', type: 'game_type' },
  { id: 'shooting', label: '射击游戏', emoji: '🔫', type: 'game_type' },
  { id: 'dodge', label: '躲避游戏', emoji: '💨', type: 'game_type' },
  { id: 'quiz', label: '答题游戏', emoji: '❓', type: 'game_type' },
  { id: 'runner', label: '跑酷游戏', emoji: '🏃', type: 'game_type' },
  { id: 'tap', label: '点击游戏', emoji: '👆', type: 'game_type' },
  { id: 'rhythm', label: '节奏游戏', emoji: '🎵', type: 'game_type' },
  { id: 'platformer', label: '平台跳跃', emoji: '🎮', type: 'game_type' },
  { id: 'random-wheel', label: '幸运转盘', emoji: '🎰', type: 'game_type' },
  { id: 'expression', label: '表情挑战', emoji: '😊', type: 'game_type' },
  // NEW — 4 representative types from new categories
  { id: 'whack-a-mole', label: '打地鼠', emoji: '🔨', type: 'game_type' },
  { id: 'slingshot', label: '弹弓发射', emoji: '🏹', type: 'game_type' },
  { id: 'water-pipe', label: '水管连接', emoji: '🚰', type: 'game_type' },
  { id: 'cross-road', label: '过马路', emoji: '🚗', type: 'game_type' },
];
```

### Also sync in conversation-agent.ts fallback
Update the typeChips fallback array (if present) with the same 4 entries.

### Files
| File | Operation | Purpose |
|------|-----------|---------|
| `src/store/editor-store.ts` | Modify | Add 4 chips to DEFAULT_CHIPS |
| `src/agent/conversation-agent.ts` | Modify | Sync fallback chips (if applicable) |

### Test Strategy
- DEFAULT_CHIPS has 14 entries
- All chip IDs are valid game types in ALL_GAME_TYPES

### Size: S

---

## Execution Order

```
Phase 1 (sequential, Task 1 is largest):
  Step 1: Add 18 presets (L)
  Step 2: Knowledge injection (S)
  Step 3: Chips update (S)

Phase 2:
  Build verification (npm run build)
  Full test suite
```

### SESSION_ID
- CODEX_SESSION: 019d5c79-70a5-72e1-b0d9-044ffa57283a
- GEMINI_SESSION: (policy mode, no persistent session)
