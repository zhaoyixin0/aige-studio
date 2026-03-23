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
    // Input-specific presets per game type. These are intentionally included even
    // when a given input may not be selected — they allow per-game-type tuning of
    // input sensitivity so the wizard can apply them when the user picks that input.
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
    // Input-specific presets (intentional — for per-game-type tuning of input sensitivity)
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
      direction: 'random',   // CRITICAL: was 'down', real games use random
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
    // Input-specific presets (intentional — for per-game-type tuning of input sensitivity)
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
    // Input-specific presets (intentional — for per-game-type tuning of input sensitivity)
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
    // Input-specific presets (intentional — for per-game-type tuning of input sensitivity)
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

// Fallback defaults for input modules not listed in a specific game preset.
// These ensure that any input module gets reasonable defaults even when
// the preset does not include game-type-specific tuning for that input.
const INPUT_FALLBACKS: Record<string, Record<string, unknown>> = {
  AudioInput: { threshold: 0.5 },
  DeviceInput: { sensitivity: 1.0 },
  HandInput: { smoothing: 0.3 },
  FaceInput: { smoothing: 0.3, sensitivity: 1.0 },
  TouchInput: {},
};

/**
 * Get the complete parameter preset for a game type.
 */
export function getGamePreset(gameType: string): GamePreset | undefined {
  return PRESETS[gameType as GameType];
}

/**
 * Get module-specific params from a game preset.
 * Falls back to INPUT_FALLBACKS for known input modules, or empty object otherwise.
 */
export function getModuleParams(gameType: string, moduleType: string): Record<string, unknown> {
  const preset = PRESETS[gameType as GameType];
  if (preset && preset[moduleType]) {
    return preset[moduleType] as Record<string, unknown>;
  }
  // Fallback for input modules
  if (INPUT_FALLBACKS[moduleType]) {
    return INPUT_FALLBACKS[moduleType];
  }
  return {};
}
