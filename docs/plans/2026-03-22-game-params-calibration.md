# Game Parameters Calibration — Market-Aligned Defaults

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calibrate all wizard game defaults to match real social-platform AR game parameters (TikTok, Snapchat, Instagram), ensuring first-time generated games are immediately playable and fun.

**Architecture:** Update the wizard's `defaultParamsForModule()` function with game-type-aware parameter presets. Create a centralized `game-presets.ts` registry that maps each game type to its complete, tested module configuration. Update knowledge base files to stay in sync.

**Tech Stack:** TypeScript, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/agent/game-presets.ts` (create) | Centralized per-game-type parameter presets — single source of truth |
| `src/agent/wizard.ts` (modify) | Import presets from game-presets.ts instead of inline defaults |
| `src/agent/__tests__/game-presets.test.ts` (create) | Validate all presets produce valid GameConfig with no missing fields |
| `src/knowledge/game-types/*.md` (modify) | Update recommended configs to match calibrated presets |

---

## Task 1: Create Game Presets Registry

**Files:**
- Create: `src/agent/game-presets.ts`
- Test: `src/agent/__tests__/game-presets.test.ts`

- [ ] **Step 1: Write failing test — presets exist for all 8 game types**

```typescript
// src/agent/__tests__/game-presets.test.ts
import { describe, it, expect } from 'vitest';
import { getGamePreset, ALL_GAME_TYPES } from '../game-presets';

describe('GamePresets', () => {
  it('should have presets for all 8 game types', () => {
    const types = ['catch', 'dodge', 'quiz', 'random-wheel', 'tap', 'shooting', 'expression', 'runner'];
    for (const type of types) {
      expect(getGamePreset(type)).toBeDefined();
    }
  });

  it('each preset should have valid module params', () => {
    for (const type of ALL_GAME_TYPES) {
      const preset = getGamePreset(type);
      // Every preset must include at least GameFlow
      expect(preset.GameFlow).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/agent/__tests__/game-presets.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement game-presets.ts with market-calibrated values**

```typescript
// src/agent/game-presets.ts
//
// Centralized game-type parameter presets.
// Values are calibrated against real AR games on TikTok, Snapchat, and Instagram.
//
// Sources:
// - ar_game_effects_research_report.html (6 platforms, 14 types)
// - src/knowledge/game-types/*.md (per-type recommended configs)

export const ALL_GAME_TYPES = [
  'catch', 'dodge', 'quiz', 'random-wheel',
  'tap', 'shooting', 'expression', 'runner',
] as const;

export type GameType = (typeof ALL_GAME_TYPES)[number];

/** Per-module params keyed by module type */
export type GamePreset = Record<string, Record<string, unknown>>;

const PRESETS: Record<GameType, GamePreset> = {

  // ──────────────────────────────────────────
  // CATCH (接住类)
  // Benchmark: TikTok "水果抓抓乐", Snapchat "Catch the Stars"
  // ──────────────────────────────────────────
  catch: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    Spawner:      {
      frequency: 1.5, maxCount: 8,
      speed: { min: 120, max: 220 },
      direction: 'down',
      items: [
        { asset: 'star', weight: 3 },
        { asset: 'apple', weight: 2 },
        { asset: 'coin', weight: 1 },
      ],
      spawnArea: { x: 80, y: 0, width: 920, height: 0 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 1500, multiplier: [1, 1.5, 2, 3] }, deductOnMiss: false },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'combo_max'], rating: { '3star': 300, '2star': 150, '1star': 50 } },
    // Input-specific (overrides based on wizard input choice)
    FaceInput:    { smoothing: 0.3, sensitivity: 1.0 },
    HandInput:    { smoothing: 0.3 },
    TouchInput:   {},
    // Optional modules
    DifficultyRamp: {
      target: 'spawner_1', mode: 'time',
      rules: [
        { field: 'frequency', decrease: 0.2, min: 0.5, every: 10 },
        { field: 'maxCount', increase: 2, max: 15, every: 15 },
      ],
    },
    ComboSystem:  { comboWindow: 1500, multiplierStep: 0.5, maxMultiplier: 4 },
    ParticleVFX:  {
      events: {
        'collision:hit': { effect: 'sparkle', at: 'target', duration: 500, color: '#ffdd00' },
        'scorer:update': { effect: 'burst', at: 'player', duration: 300, color: '#00ff88' },
      },
    },
    SoundFX:      { events: { 'collision:hit': 'pop', 'scorer:update': 'ding', 'gameflow:state': 'cheer' } },
  },

  // ──────────────────────────────────────────
  // DODGE (躲避类)
  // Benchmark: TikTok "躲避球", Snapchat "Dodge the Asteroids"
  // ──────────────────────────────────────────
  dodge: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    Spawner:      {
      frequency: 1.2, maxCount: 10,
      speed: { min: 150, max: 280 },
      direction: 'down',
      items: [
        { asset: 'meteor', weight: 2 },
        { asset: 'bomb', weight: 1 },
      ],
      spawnArea: { x: 50, y: 0, width: 980, height: 0 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'damage', destroy: ['b'] }] },
    Scorer:       { perHit: 5 },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'time'], rating: { '3star': 200, '2star': 100, '1star': 30 } },
    FaceInput:    { smoothing: 0.25, sensitivity: 1.2 },
    HandInput:    { smoothing: 0.25 },
    TouchInput:   {},
    DifficultyRamp: {
      target: 'spawner_1', mode: 'time',
      rules: [
        { field: 'frequency', decrease: 0.15, min: 0.4, every: 8 },
        { field: 'maxCount', increase: 2, max: 18, every: 12 },
      ],
    },
    ComboSystem:  { comboWindow: 2000, multiplierStep: 0.5, maxMultiplier: 3 },
    ParticleVFX:  {
      events: {
        'collision:damage': { effect: 'explosion', at: 'target', duration: 400, color: '#ff4444' },
      },
    },
    SoundFX:      { events: { 'collision:damage': 'buzz', 'gameflow:state': 'cheer' } },
  },

  // ──────────────────────────────────────────
  // TAP (点击类)
  // Benchmark: TikTok "泡泡点点乐", Instagram "Pop It!"
  // ──────────────────────────────────────────
  tap: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    Spawner:      {
      frequency: 1.0, maxCount: 8,
      speed: { min: 0, max: 0 },
      direction: 'down',
      items: [
        { asset: 'bubble_red', weight: 2 },
        { asset: 'bubble_blue', weight: 2 },
        { asset: 'bubble_gold', weight: 1 },
      ],
      spawnArea: { x: 80, y: 150, width: 920, height: 1500 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 800, multiplier: [1, 1.5, 2, 3] } },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'combo_max'], rating: { '3star': 250, '2star': 120, '1star': 40 } },
    TouchInput:   {},
    DifficultyRamp: {
      target: 'spawner_1', mode: 'time',
      rules: [
        { field: 'frequency', decrease: 0.1, min: 0.5, every: 10 },
      ],
    },
    ComboSystem:  { comboWindow: 800, multiplierStep: 0.5, maxMultiplier: 4 },
    ParticleVFX:  {
      events: {
        'collision:hit': { effect: 'pop', at: 'target', duration: 300, color: '#ff88ff' },
      },
    },
    SoundFX:      { events: { 'collision:hit': 'pop', 'scorer:update': 'ding' } },
  },

  // ──────────────────────────────────────────
  // SHOOTING (射击类)
  // Benchmark: Snapchat "Space Shooter", TikTok "射击大挑战"
  // ──────────────────────────────────────────
  shooting: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    Spawner:      {
      frequency: 1.0, maxCount: 6,
      speed: { min: 80, max: 180 },
      direction: 'random',   // ← CRITICAL: was 'down', real games use random
      items: [
        { asset: 'target_normal', weight: 3 },
        { asset: 'target_gold', weight: 1 },
        { asset: 'target_small', weight: 1 },
      ],
      spawnArea: { x: 50, y: 50, width: 980, height: 1600 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 1200, multiplier: [1, 1.5, 2] } },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 5 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'accuracy', 'combo_max'], rating: { '3star': 250, '2star': 120, '1star': 50 } },
    FaceInput:    { smoothing: 0.2, sensitivity: 1.0 },
    TouchInput:   {},
    DifficultyRamp: {
      target: 'spawner_1', mode: 'time',
      rules: [
        { field: 'frequency', decrease: 0.1, min: 0.5, every: 10 },
      ],
    },
    ComboSystem:  { comboWindow: 1200, multiplierStep: 0.5, maxMultiplier: 3 },
    ParticleVFX:  {
      events: {
        'collision:hit': { effect: 'sparkle', at: 'target', duration: 400, color: '#ffdd00' },
      },
    },
    SoundFX:      { events: { 'collision:hit': 'pop', 'scorer:update': 'ding' } },
  },

  // ──────────────────────────────────────────
  // QUIZ (答题类)
  // Benchmark: TikTok "知识答题", Instagram "Quiz Stickers"
  // ──────────────────────────────────────────
  quiz: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    QuizEngine:   {
      questions: [
        { question: '1 + 1 = ?', options: ['2', '3', '4', '1'], correct: 0 },
        { question: '太阳从哪边升起？', options: ['东', '西', '南', '北'], correct: 0 },
        { question: '地球上最大的海洋是？', options: ['太平洋', '大西洋', '印度洋', '北冰洋'], correct: 0 },
      ],
      timePerQuestion: 15,
      scoring: { correct: 10, wrong: 0, timeBonus: true },
    },
    Scorer:       { perHit: 10 },
    Timer:        { duration: 60, mode: 'countdown' },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'accuracy'], rating: { '3star': 80, '2star': 50, '1star': 20 } },
    TouchInput:   {},
    SoundFX:      { events: { 'collision:hit': 'ding', 'collision:damage': 'buzz' } },
    ParticleVFX:  { events: {} },
  },

  // ──────────────────────────────────────────
  // RANDOM-WHEEL (随机转盘)
  // Benchmark: TikTok "幸运转盘", Snapchat "Spin the Wheel"
  // ──────────────────────────────────────────
  'random-wheel': {
    GameFlow:     { countdown: 0, onFinish: 'show_result' },
    Randomizer:   {
      items: [
        { asset: 'option1', label: '奖品A', weight: 1 },
        { asset: 'option2', label: '奖品B', weight: 1 },
        { asset: 'option3', label: '奖品C', weight: 1 },
        { asset: 'option4', label: '奖品D', weight: 1 },
        { asset: 'option5', label: '奖品E', weight: 1 },
        { asset: 'option6', label: '奖品F', weight: 1 },
      ],
      animation: 'wheel',
      spinDuration: 3,
      trigger: 'tap',
    },
    UIOverlay:    {},
    ResultScreen: { show: ['score'], rating: {} },
    TouchInput:   {},
    SoundFX:      { events: { 'gameflow:state': 'cheer' } },
    ParticleVFX:  {
      events: {
        'randomizer:result': { effect: 'burst', at: 'center', duration: 600, color: '#ffdd00' },
      },
    },
  },

  // ──────────────────────────────────────────
  // EXPRESSION (表情触发)
  // Benchmark: TikTok "表情大挑战", Snapchat "Face Dance"
  // ──────────────────────────────────────────
  expression: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    ExpressionDetector: { expressionType: 'smile', threshold: 0.6, cooldown: 800 },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 2000, multiplier: [1, 1.5, 2] } },
    Timer:        { duration: 30, mode: 'countdown' },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'combo_max'], rating: { '3star': 200, '2star': 100, '1star': 30 } },
    FaceInput:    { smoothing: 0.2, sensitivity: 1.0 },
    ComboSystem:  { comboWindow: 2000, multiplierStep: 0.5, maxMultiplier: 3 },
    ParticleVFX:  {
      events: {
        'expression:detected': { effect: 'sparkle', at: 'player', duration: 500, color: '#ff88ff' },
      },
    },
    SoundFX:      { events: { 'expression:detected': 'ding' } },
  },

  // ──────────────────────────────────────────
  // RUNNER (跑酷类)
  // Benchmark: TikTok "极速跑酷", Snapchat "Temple Run AR"
  // ──────────────────────────────────────────
  runner: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    Runner:       { speed: 300, laneCount: 3, acceleration: 10 },
    Spawner:      {
      frequency: 1.0, maxCount: 10,
      speed: { min: 200, max: 300 },
      direction: 'left',
      items: [
        { asset: 'obstacle', weight: 2 },
        { asset: 'coin', weight: 3 },
      ],
      spawnArea: { x: 1080, y: 200, width: 0, height: 1400 },
    },
    Collision:    {
      rules: [
        { a: 'player', b: 'items', event: 'hit', destroy: ['b'] },
        // Runner uses a second collision check: obstacles deal damage
        // Items with asset='obstacle' trigger damage via hit event handler
      ],
    },
    Scorer:       { perHit: 5, deductOnMiss: false },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'time'], rating: { '3star': 500, '2star': 250, '1star': 80 } },
    FaceInput:    { smoothing: 0.3, sensitivity: 1.0 },
    TouchInput:   {},
    DifficultyRamp: {
      target: 'spawner_1', mode: 'time',
      rules: [
        { field: 'frequency', decrease: 0.1, min: 0.4, every: 8 },
        { field: 'maxCount', increase: 2, max: 15, every: 10 },
      ],
    },
    Jump:         { jumpForce: 500, gravity: 980, groundY: 0.8, triggerEvent: 'input:touch:tap' },
    PowerUp:      {
      powerUpTypes: [
        { type: 'shield', duration: 5000 },
        { type: 'magnet', multiplier: 1.5, duration: 5000 },
      ],
    },
    ParticleVFX:  {
      events: {
        'collision:hit': { effect: 'sparkle', at: 'target', duration: 300, color: '#ffdd00' },
        'collision:damage': { effect: 'explosion', at: 'player', duration: 400, color: '#ff4444' },
      },
    },
    SoundFX:      { events: { 'collision:hit': 'pop', 'collision:damage': 'buzz', 'scorer:update': 'ding' } },
  },
};

/**
 * Get the complete parameter preset for a game type.
 */
export function getGamePreset(gameType: string): GamePreset | undefined {
  return PRESETS[gameType as GameType];
}

/**
 * Get module-specific params from a game preset.
 * Falls back to empty object if module not in preset.
 */
export function getModuleParams(gameType: string, moduleType: string): Record<string, unknown> {
  const preset = PRESETS[gameType as GameType];
  if (!preset) return {};
  return (preset[moduleType] as Record<string, unknown>) ?? {};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/agent/__tests__/game-presets.test.ts`
Expected: PASS

- [ ] **Step 5: Add validation tests — every preset module has required fields**

Add to test file:

```typescript
it('Spawner presets should always have items array', () => {
  for (const type of ALL_GAME_TYPES) {
    const preset = getGamePreset(type)!;
    if (preset.Spawner) {
      const spawner = preset.Spawner as Record<string, any>;
      expect(Array.isArray(spawner.items)).toBe(true);
      expect(spawner.items.length).toBeGreaterThan(0);
      expect(spawner.speed).toBeDefined();
      expect(spawner.frequency).toBeGreaterThan(0);
    }
  }
});

it('Collision presets should always have rules array', () => {
  for (const type of ALL_GAME_TYPES) {
    const preset = getGamePreset(type)!;
    if (preset.Collision) {
      const collision = preset.Collision as Record<string, any>;
      expect(Array.isArray(collision.rules)).toBe(true);
    }
  }
});

it('DifficultyRamp presets should have target and rules', () => {
  for (const type of ALL_GAME_TYPES) {
    const preset = getGamePreset(type)!;
    if (preset.DifficultyRamp) {
      const ramp = preset.DifficultyRamp as Record<string, any>;
      expect(ramp.target).toBeDefined();
      expect(Array.isArray(ramp.rules)).toBe(true);
    }
  }
});

it('Timer duration should match common social game durations', () => {
  for (const type of ALL_GAME_TYPES) {
    const preset = getGamePreset(type)!;
    if (preset.Timer) {
      const timer = preset.Timer as Record<string, any>;
      expect([15, 30, 60, 90, 120]).toContain(timer.duration);
    }
  }
});
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/agent/game-presets.ts src/agent/__tests__/game-presets.test.ts
git commit -m "feat: add market-calibrated game presets registry"
```

---

## Task 2: Wire Wizard to Presets

**Files:**
- Modify: `src/agent/wizard.ts`

- [ ] **Step 1: Replace inline `defaultParamsForModule()` with preset lookup**

Replace the entire `defaultParamsForModule()` function body with:

```typescript
import { getModuleParams } from './game-presets';

function defaultParamsForModule(moduleType: string, gameType: string): Record<string, unknown> {
  return getModuleParams(gameType, moduleType);
}
```

The existing function signature stays the same — only the body changes to delegate to the presets registry.

- [ ] **Step 2: Update Timer params in `buildConfig()` to use user-selected duration**

The `buildConfig()` method manually inserts Timer with user-chosen duration. Update it to merge the preset's Timer params with the user's duration:

```typescript
// In buildConfig(), where Timer is added:
if (this.state.duration && this.state.duration > 0) {
  const timerPreset = getModuleParams(this.state.gameType ?? 'catch', 'Timer');
  const typeCounts_count = (typeCounts.get('Timer') ?? 0) + 1;
  typeCounts.set('Timer', typeCounts_count);
  modules.push({
    id: `timer_${typeCounts_count}`,
    type: 'Timer',
    enabled: true,
    params: { ...timerPreset, duration: this.state.duration },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/agent/wizard.ts
git commit -m "refactor: wire wizard to centralized game presets"
```

---

## Task 3: Update Knowledge Base Files

**Files:**
- Modify: `src/knowledge/game-types/catch.md`
- Modify: `src/knowledge/game-types/dodge.md`
- Modify: `src/knowledge/game-types/tap.md`
- Modify: `src/knowledge/game-types/shooting.md`
- Modify: `src/knowledge/game-types/runner.md`
- Modify: `src/knowledge/game-types/expression.md`
- Modify: `src/knowledge/game-types/quiz.md`
- Modify: `src/knowledge/game-types/random-wheel.md`

- [ ] **Step 1: Update each knowledge base file's 示例配置 section**

For each game type file, update the `## 示例配置` JSON block to match the exact params from `game-presets.ts`. This ensures the AI Agent's knowledge base stays in sync with the actual defaults.

Key changes per file:
- **catch.md**: speed `{min:120, max:220}`, combo `{enabled:true, window:1500}`, spawnArea width=920
- **dodge.md**: frequency=1.2, speed `{min:150, max:280}`, FaceInput smoothing=0.25, sensitivity=1.2
- **tap.md**: maxCount=8, spawnArea `{x:80, y:150, width:920, height:1500}`, combo window=800ms
- **shooting.md**: direction=`'random'` (was 'down'), speed `{min:80, max:180}`, FaceInput smoothing=0.2
- **runner.md**: Scorer perHit=5 (was 10), frequency=1.0, maxCount=10, speed `{min:200, max:300}`
- **expression.md**: ExpressionDetector threshold=0.6, cooldown=800, FaceInput smoothing=0.2
- **quiz.md**: Include sample questions array, timePerQuestion=15
- **random-wheel.md**: Include 6 default items with labels

- [ ] **Step 2: Commit**

```bash
git add src/knowledge/game-types/
git commit -m "docs: sync knowledge base with calibrated game presets"
```

---

## Task 4: Add Integration Test — Full Preset Lifecycle

**Files:**
- Create: `src/__tests__/integration/preset-lifecycle.test.ts`

- [ ] **Step 1: Write integration test that loads each preset into the engine**

```typescript
import { describe, it, expect } from 'vitest';
import { Engine } from '@/engine/core/engine';
import { ConfigLoader } from '@/engine/core/config-loader';
import { createModuleRegistry } from '@/engine/module-setup';
import { GameWizard } from '@/agent/wizard';

describe('Preset Lifecycle', () => {
  const GAME_TYPES = ['catch', 'dodge', 'tap', 'shooting', 'quiz', 'runner', 'expression', 'random-wheel'];

  for (const gameType of GAME_TYPES) {
    it(`should load ${gameType} preset into engine without errors`, () => {
      const wizard = new GameWizard();
      wizard.start();
      let result = wizard.answer(gameType);

      // Auto-answer remaining wizard steps
      while (result.question) {
        const firstChoice = result.question.choices[0].id;
        result = wizard.answer(firstChoice);
      }

      expect(result.config).not.toBeNull();
      const config = result.config!;

      // Load into engine
      const engine = new Engine();
      const registry = createModuleRegistry();
      const loader = new ConfigLoader(registry);

      expect(() => loader.load(engine, config)).not.toThrow();
      expect(engine.getAllModules().length).toBeGreaterThan(0);

      // Tick a few frames to verify no runtime errors
      for (let i = 0; i < 10; i++) {
        expect(() => engine.tick(16)).not.toThrow();
      }

      engine.restart();
    });
  }
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/__tests__/integration/preset-lifecycle.test.ts`
Expected: All 8 game types pass

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/preset-lifecycle.test.ts
git commit -m "test: add preset lifecycle integration tests for all game types"
```

---

## Dependency Graph

```
Task 1: Game Presets Registry (game-presets.ts + tests)
  └→ Task 2: Wire Wizard to Presets (wizard.ts refactor)
       └→ Task 4: Integration Tests (verify full pipeline)
  └→ Task 3: Knowledge Base Updates (docs sync)
```

Tasks 3 and 4 are independent of each other but both depend on Tasks 1+2.
