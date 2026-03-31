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
  'gesture', 'rhythm', 'puzzle', 'dress-up', 'world-ar', 'narrative',
  'platformer', 'action-rpg',
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
      frequency: 1.5, maxCount: 5,
      speed: { min: 200, max: 300 },
      direction: 'down',
      items: [
        { asset: 'good_1', weight: 3 },
        { asset: 'good_2', weight: 2 },
        { asset: 'good_3', weight: 1 },
        { asset: 'bad_1', weight: 1, layer: 'obstacles' },
      ],
      spawnArea: { x: 80, y: 0, width: 920, height: 0 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }, { a: 'player', b: 'obstacles', event: 'damage', destroy: ['b'] }] },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 1500, multiplier: [1, 1.5, 2, 3] }, deductOnMiss: false },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'combo_max'], rating: { '3star': 300, '2star': 150, '1star': 50 } },
    // Input-specific presets per game type. These are intentionally included even
    // when a given input may not be selected — they allow per-game-type tuning of
    // input sensitivity so the wizard can apply them when the user picks that input.
    PlayerMovement: { mode: 'follow', followSpeed: 0.15, defaultY: 0.85 },
    FaceInput:    { smoothing: 0.3, sensitivity: 1.0 },
    HandInput:    { smoothing: 0.3 },
    TouchInput:   { playerSize: 64 },
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
      frequency: 1.2, maxCount: 6,
      speed: { min: 150, max: 280 },
      direction: 'down',
      items: [
        { asset: 'bad_1', weight: 2 },
        { asset: 'bad_2', weight: 1 },
        { asset: 'good_1', weight: 1, layer: 'pickups' },
      ],
      spawnArea: { x: 50, y: 0, width: 980, height: 0 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'damage', destroy: ['b'] }, { a: 'player', b: 'pickups', event: 'hit', destroy: ['b'] }] },
    Scorer:       { perHit: 15, scorePerSecond: 10 },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'time'], rating: { '3star': 200, '2star': 100, '1star': 30 } },
    PlayerMovement: { mode: 'follow', followSpeed: 0.15, defaultY: 0.85 },
    // Input-specific presets (intentional — for per-game-type tuning of input sensitivity)
    FaceInput:    { smoothing: 0.25, sensitivity: 1.2 },
    HandInput:    { smoothing: 0.25 },
    TouchInput:   { playerSize: 64 },
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
    PlayerMovement: { mode: 'follow', followSpeed: 0.15, defaultY: 0.85 },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 800, multiplier: [1, 1.5, 2, 3] } },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'combo_max'], rating: { '3star': 250, '2star': 120, '1star': 40 } },
    TouchInput:   { playerSize: 64 },
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
    GameFlow:       { countdown: 3, onFinish: 'show_result' },
    // Player movement (follow touch/face for shooter)
    PlayerMovement: { mode: 'follow', followSpeed: 0.15, defaultY: 0.85, continuousEvent: 'input:face:move' },
    // Projectile system — auto-fires upward
    Projectile:     { speed: 600, damage: 10, lifetime: 3000, fireRate: 200, autoFire: true, layer: 'projectiles', maxProjectiles: 50 },
    Aim:            { mode: 'auto', autoTargetLayer: 'enemies', autoRange: 500 },
    // Enemy system — waves chase player from the top
    EnemyAI:        { behavior: 'chase', speed: 80, detectionRange: 2000, attackRange: 40, attackCooldown: 2000, attackDamage: 10, hp: 30, fleeHpThreshold: 0, waypoints: [] },
    WaveSpawner:    { enemiesPerWave: 3, waveCooldown: 3000, spawnDelay: 500, scalingFactor: 1.15, maxWaves: 10, maxEnemiesPerWave: 12, spawnAreaX: 100, spawnAreaWidth: 880, spawnY: 100 },
    // Collision — projectiles hit enemies (score), enemies damage player (health)
    Collision:      { rules: [{ a: 'projectiles', b: 'enemies', event: 'hit', destroy: ['a'] }, { a: 'player', b: 'enemies', event: 'damage' }] },
    Scorer:         { perHit: 10, hitEvent: 'collision:hit', combo: { enabled: true, window: 1200, multiplier: [1, 1.5, 2] } },
    Health:         { maxHp: 100, damageEvent: 'collision:damage' },
    Lives:          { count: 3 },
    IFrames:        { duration: 1000 },
    Timer:          { duration: 60, mode: 'countdown' },
    UIOverlay:      { elements: ['score', 'lives', 'timer'] },
    ResultScreen:   { show: ['score', 'accuracy', 'waves_cleared'], rating: { '3star': 300, '2star': 150, '1star': 50 } },
    // Input-specific presets
    FaceInput:      { smoothing: 0.2, sensitivity: 1.0 },
    TouchInput:     { playerSize: 64 },
    // Optional enhancements
    Shield:         { maxCharges: 3, rechargeCooldown: 5000, damageEvent: 'collision:damage' },
    DifficultyRamp: { target: 'wavespawner_1', mode: 'time', rules: [{ field: 'enemiesPerWave', increase: 1, max: 8, every: 15 }] },
    ComboSystem:    { comboWindow: 1200, multiplierStep: 0.5, maxMultiplier: 3 },
    ParticleVFX:    { events: { 'collision:hit': { effect: 'sparkle', at: 'target', duration: 400, color: '#ffaa00' }, 'enemy:death': { effect: 'burst', at: 'target', duration: 500, color: '#ff0000' } } },
    SoundFX:        { events: { 'collision:hit': 'pop', 'enemy:death': 'boom', 'wave:complete': 'ding' } },
  },

  // ──────────────────────────────────────────
  // QUIZ (答题类)
  // Benchmark: TikTok "知识答题", Instagram "Quiz Stickers"
  // ──────────────────────────────────────────
  quiz: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    QuizEngine:   {
      questions: [
        { text: '世界上最大的海洋是？', options: ['大西洋', '太平洋', '印度洋', '北冰洋'], correctIndex: 1 },
        { text: '一年有多少天？', options: ['360', '366', '365', '350'], correctIndex: 2 },
        { text: '熊猫最爱吃什么？', options: ['竹子', '苹果', '胡萝卜', '鱼'], correctIndex: 0 },
        { text: '彩虹有几种颜色？', options: ['5', '6', '8', '7'], correctIndex: 3 },
        { text: '地球是什么形状的？', options: ['方形', '球形', '三角形', '平面'], correctIndex: 1 },
      ],
      timePerQuestion: 10,
      scoring: { correct: 20, wrong: 0, timeBonus: true },
    },
    Scorer:       { perHit: 20 },
    Timer:        { duration: 60, mode: 'countdown' },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'accuracy'], rating: { '3star': 80, '2star': 50, '1star': 20 } },
    TouchInput:   { playerSize: 64 },
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
        { asset: 'option1', label: '🍔 火锅', weight: 1 },
        { asset: 'option2', label: '🍜 烧烤', weight: 1 },
        { asset: 'option3', label: '🍕 披萨', weight: 1 },
        { asset: 'option4', label: '🍣 寿司', weight: 1 },
        { asset: 'option5', label: '🍰 甜点', weight: 1 },
        { asset: 'option6', label: '🥗 沙拉', weight: 1 },
      ],
      animation: 'wheel',
      spinDuration: 3,
      trigger: 'tap',
    },
    UIOverlay:    {},
    ResultScreen: { show: ['score'], rating: {} },
    TouchInput:   { playerSize: 64 },
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
    Runner:       { speed: 400, laneCount: 3, acceleration: 15, maxSpeed: 900 },
    Spawner:      {
      frequency: 1.0, maxCount: 10,
      speed: { min: 200, max: 300 },
      direction: 'left',
      items: [
        { asset: 'bad_1', weight: 2, layer: 'obstacles' },
        { asset: 'good_1', weight: 3, layer: 'items' },
      ],
      spawnArea: { x: 1080, y: 200, width: 0, height: 1400 },
    },
    Collision:    {
      rules: [
        { a: 'player', b: 'items', event: 'hit', destroy: ['b'] },
        { a: 'player', b: 'obstacles', event: 'damage', destroy: ['b'] },
      ],
    },
    Scorer:       { perHit: 5, hitEvent: 'collision:hit', deductOnMiss: false },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'time'], rating: { '3star': 500, '2star': 250, '1star': 80 } },
    // Input-specific presets (intentional — for per-game-type tuning of input sensitivity)
    FaceInput:    { smoothing: 0.3, sensitivity: 1.0 },
    TouchInput:   { playerSize: 64 },
    DifficultyRamp: {
      target: 'spawner_1', mode: 'time',
      rules: [
        { field: 'frequency', decrease: 0.1, min: 0.4, every: 8 },
        { field: 'maxCount', increase: 2, max: 15, every: 10 },
      ],
    },
    Jump:         { jumpForce: 500, gravity: 800, groundY: 0.8, triggerEvent: 'input:touch:tap' },
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

  // ──────────────────────────────────────────
  // GESTURE (手势互动)
  // Benchmark: Snapchat "Hand Gesture Challenge"
  // ──────────────────────────────────────────
  gesture: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    GestureMatch: {
      targetGestures: ['thumbs_up', 'peace', 'fist', 'open_palm'],
      displayTime: 3,
      matchThreshold: 0.8,
    },
    Scorer:       { perHit: 10, combo: { enabled: true, window: 2000, multiplier: [1, 1.5, 2] } },
    Timer:        { duration: 30, mode: 'countdown' },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'accuracy'], rating: { '3star': 200, '2star': 100, '1star': 30 } },
    HandInput:    { smoothing: 0.25 },
    // Optional modules
    ComboSystem:  { comboWindow: 2000, multiplierStep: 0.5, maxMultiplier: 3 },
    ParticleVFX:  {
      events: {
        'gesture:match': { effect: 'sparkle', at: 'player', duration: 400, color: '#00ff88' },
      },
    },
    SoundFX:      { events: { 'gesture:match': 'ding', 'gesture:fail': 'buzz' } },
  },

  // ──────────────────────────────────────────
  // RHYTHM (节奏类)
  // Benchmark: TikTok "音乐节拍" / "Beat Drop"
  // ──────────────────────────────────────────
  rhythm: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    BeatMap:      {
      bpm: 120,
      tolerance: 200,
      // Pre-generated beats at 120 BPM for 60s (every beat + half-beat accents)
      beats: (() => {
        const result: number[] = [];
        const msPerBeat = 60000 / 120; // 500ms
        for (let i = 0; i < 120; i++) {
          result.push(Math.round(i * msPerBeat));
          // Add half-beat on every 4th beat for syncopation
          if (i % 4 === 2) {
            result.push(Math.round((i + 0.5) * msPerBeat));
          }
        }
        return result.sort((a, b) => a - b);
      })(),
    },
    Scorer:       { perHit: 10, hitEvent: 'beat:hit', combo: { enabled: true, window: 1000, multiplier: [1, 1.5, 2, 3] } },
    Timer:        { duration: 60, mode: 'countdown' },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'accuracy', 'combo_max'], rating: { '3star': 300, '2star': 150, '1star': 50 } },
    // Input-specific presets (touch or face)
    TouchInput:   { playerSize: 64 },
    FaceInput:    { smoothing: 0.2, sensitivity: 1.0 },
    // Optional modules
    ComboSystem:  { comboWindow: 1000, multiplierStep: 0.5, maxMultiplier: 4 },
    ParticleVFX:  {
      events: {
        'beat:hit': { effect: 'sparkle', at: 'target', duration: 300, color: '#00ddff' },
      },
    },
    SoundFX:      { events: { 'beat:hit': 'ding', 'beat:miss': 'buzz' } },
  },

  // ──────────────────────────────────────────
  // PUZZLE (拼图/配对)
  // Benchmark: TikTok "记忆翻牌" / Instagram "Memory Match"
  // ──────────────────────────────────────────
  puzzle: {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    MatchEngine:  {
      gridCols: 4,
      gridRows: 4,
      matchCount: 2,
      shuffleOnFail: false,
    },
    Scorer:       { perHit: 20 },
    Timer:        { duration: 60, mode: 'countdown' },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'time'], rating: { '3star': 200, '2star': 100, '1star': 40 } },
    TouchInput:   { playerSize: 64 },
    // Optional modules
    SoundFX:      { events: { 'match:found': 'ding', 'match:fail': 'buzz', 'match:complete': 'cheer' } },
    ParticleVFX:  {
      events: {
        'match:found': { effect: 'sparkle', at: 'target', duration: 400, color: '#ffdd00' },
        'match:complete': { effect: 'burst', at: 'center', duration: 600, color: '#00ff88' },
      },
    },
  },

  // ──────────────────────────────────────────
  // DRESS-UP (换装/贴纸)
  // Benchmark: TikTok "虚拟换装" / Snapchat "Bitmoji Fashion"
  // ──────────────────────────────────────────
  'dress-up': {
    GameFlow:     { countdown: 0, onFinish: 'show_result' },
    DressUpEngine: {
      layers: ['hat', 'glasses', 'shirt', 'pants', 'shoes'],
      maxPerLayer: 1,
    },
    UIOverlay:    {},
    ResultScreen: { show: ['score'], rating: {} },
    // Input-specific presets (face for AR overlay, touch for selection)
    FaceInput:    { smoothing: 0.2, sensitivity: 1.0 },
    TouchInput:   { playerSize: 64 },
    // Optional modules
    SoundFX:      { events: { 'dressup:equip': 'pop', 'dressup:snapshot': 'cheer' } },
    ParticleVFX:  {
      events: {
        'dressup:equip': { effect: 'sparkle', at: 'target', duration: 300, color: '#ff88ff' },
      },
    },
  },

  // ──────────────────────────────────────────
  // WORLD-AR (世界AR)
  // Benchmark: Snapchat "World Lens Games"
  // ──────────────────────────────────────────
  'world-ar': {
    GameFlow:     { countdown: 3, onFinish: 'show_result' },
    PlaneDetection: {
      enabled: true,
      sensitivity: 0.5,
    },
    Spawner:      {
      frequency: 2.0, maxCount: 5,
      speed: { min: 0, max: 0 },
      direction: 'down',
      items: [
        { asset: 'ar_object', weight: 1 },
      ],
      spawnArea: { x: 100, y: 200, width: 880, height: 1400 },
    },
    Collision:    { rules: [{ a: 'player', b: 'items', event: 'hit', destroy: ['b'] }] },
    Scorer:       { perHit: 15 },
    Timer:        { duration: 30, mode: 'countdown' },
    Lives:        { count: 3 },
    UIOverlay:    {},
    ResultScreen: { show: ['score', 'time'], rating: { '3star': 200, '2star': 100, '1star': 30 } },
    TouchInput:   { playerSize: 64 },
    // Optional modules
    ParticleVFX:  {
      events: {
        'collision:hit': { effect: 'sparkle', at: 'target', duration: 400, color: '#00ff88' },
        'plane:detected': { effect: 'burst', at: 'target', duration: 300, color: '#88ddff' },
      },
    },
    SoundFX:      { events: { 'collision:hit': 'pop', 'plane:detected': 'ding' } },
  },

  // ──────────────────────────────────────────
  // NARRATIVE (分支叙事)
  // Benchmark: TikTok "命运选择" / Instagram "Choose Your Story"
  // ──────────────────────────────────────────
  narrative: {
    GameFlow:     { countdown: 0, onFinish: 'show_result' },
    BranchStateMachine: {
      startState: 'start',
      states: {
        start: {
          text: '你走在一条分岔路口...',
          choices: [
            { label: '走左边的小路', target: 'forest' },
            { label: '走右边的大路', target: 'village' },
          ],
        },
        forest: {
          text: '你来到一片神秘的森林，发现一个宝箱...',
          choices: [
            { label: '打开宝箱', target: 'treasure' },
            { label: '继续前进', target: 'monster' },
          ],
        },
        village: {
          text: '你到达一个热闹的村庄...',
          choices: [
            { label: '去市场', target: 'market' },
            { label: '去酒馆', target: 'tavern' },
          ],
        },
        treasure: { text: '恭喜！你找到了传说中的宝藏！', choices: [] },
        monster: { text: '一只巨龙出现了...你勇敢地战斗并获胜！', choices: [] },
        market: { text: '你在市场找到了稀有物品！', choices: [] },
        tavern: { text: '你在酒馆听到了宝藏的线索...', choices: [] },
      },
    },
    UIOverlay:    {},
    ResultScreen: { show: ['score'], rating: {} },
    TouchInput:   { playerSize: 64 },
    // Optional modules
    SoundFX:      { events: { 'branch:stateChange': 'pop', 'branch:end': 'cheer' } },
    ParticleVFX:  {
      events: {
        'branch:end': { effect: 'burst', at: 'center', duration: 600, color: '#ffdd00' },
      },
    },
  },

  // ──────────────────────────────────────────
  // PLATFORMER (平台跳跃类)
  // Benchmark: Mario-style side-scrolling platformers
  // ──────────────────────────────────────────
  platformer: {
    GameFlow:        { countdown: 3, onFinish: 'show_result' },
    Collision:       { rules: [{ a: 'player', b: 'collectibles', event: 'hit', destroy: ['b'] }, { a: 'player', b: 'hazards', event: 'damage', destroy: [] }] },
    PlayerMovement:  { speed: 300, acceleration: 1000, deceleration: 800 },
    Jump:            { jumpForce: 600, gravity: 980, groundY: 0.78, triggerEvent: 'input:touch:tap' },
    Gravity:         { strength: 980, terminalVelocity: 800, applyTo: 'player' },
    CoyoteTime:      { coyoteFrames: 6, bufferFrames: 6, jumpEvent: 'input:touch:tap' },
    StaticPlatform:  {
      platforms: [
        // Ground level
        { x: 0, y: 1500, width: 1080, height: 60, material: 'normal' },
        // Lower platforms
        { x: 100, y: 1300, width: 250, height: 30, material: 'normal' },
        { x: 500, y: 1250, width: 200, height: 30, material: 'normal' },
        { x: 800, y: 1300, width: 250, height: 30, material: 'normal' },
        // Mid platforms
        { x: 300, y: 1050, width: 250, height: 30, material: 'normal' },
        { x: 700, y: 1000, width: 200, height: 30, material: 'ice' },
        // Upper platforms
        { x: 100, y: 800, width: 280, height: 30, material: 'normal' },
        { x: 600, y: 750, width: 250, height: 30, material: 'normal' },
      ],
      layer: 'platforms',
    },
    MovingPlatform:  {
      platforms: [
        { x: 450, y: 1150, width: 180, speed: 80, range: 200, pattern: 'horizontal' },
        { x: 900, y: 850, width: 150, speed: 60, range: 300, pattern: 'vertical' },
      ],
      layer: 'platforms',
    },
    OneWayPlatform:  {
      platforms: [
        { x: 200, y: 1150, width: 200 },
        { x: 500, y: 900, width: 180 },
      ],
      layer: 'platforms',
    },
    Collectible:     {
      items: [
        { x: 200, y: 1260, value: 10, type: 'coin' },
        { x: 550, y: 1210, value: 10, type: 'coin' },
        { x: 850, y: 1260, value: 10, type: 'coin' },
        { x: 400, y: 1010, value: 10, type: 'coin' },
        { x: 750, y: 960, value: 15, type: 'coin' },
        { x: 200, y: 760, value: 20, type: 'coin' },
        { x: 650, y: 710, value: 20, type: 'coin' },
        { x: 950, y: 810, value: 25, type: 'gem' },
      ],
      layer: 'collectibles',
    },
    Hazard:          {
      hazards: [
        { x: 400, y: 1485, width: 80, height: 15, pattern: 'static' },
        { x: 750, y: 1485, width: 100, height: 15, pattern: 'static' },
        { x: 500, y: 1035, width: 60, height: 15, pattern: 'oscillate', speed: 40, range: 100 },
      ],
      damage: 1, layer: 'hazards',
    },
    Scorer:          { perHit: 10 },
    Timer:           { duration: 90, mode: 'countdown' },
    Lives:           { count: 3 },
    Checkpoint:      {
      checkpoints: [
        { x: 500, y: 1200, width: 30, height: 50 },
        { x: 200, y: 750, width: 30, height: 50 },
      ],
    },
    IFrames:         { duration: 1000 },
    Knockback:       { force: 300, duration: 200 },
    CameraFollow:    { mode: 'center', smoothing: 0.1 },
    TouchInput:      { playerSize: 64 },
    ParticleVFX:     {
      events: {
        'collectible:pickup': { effect: 'sparkle', at: 'target', duration: 400, color: '#ffdd00' },
        'collision:damage': { effect: 'burst', at: 'player', duration: 300, color: '#ff0000' },
      },
    },
    SoundFX:         { events: { 'collectible:pickup': 'ding', 'jump:start': 'pop', 'collision:damage': 'hurt' } },
    UIOverlay:       { elements: ['score', 'timer', 'lives'] },
    ResultScreen:    { show: ['score', 'time'], rating: { excellent: 200, good: 100, ok: 50 } },
  },

  // ──────────────────────────────────────────
  // ACTION-RPG (动作角色扮演)
  // Combines shooter + RPG mechanics: waves, projectiles, leveling, skills
  // ──────────────────────────────────────────
  'action-rpg': {
    GameFlow:       { countdown: 0, onFinish: 'show_result' },
    PlayerMovement: { mode: 'follow', followSpeed: 0.15, defaultY: 0.85, continuousEvent: 'input:face:move' },
    Gravity:        { strength: 980, terminalVelocity: 800 },
    Jump:           { jumpForce: 500, gravity: 980, groundY: 0.8, triggerEvent: 'input:touch:tap' },
    Health:         { maxHp: 100, damageEvent: 'collision:damage' },
    Projectile:     { speed: 500, damage: 15, lifetime: 2000, fireRate: 300, autoFire: true, layer: 'projectiles', maxProjectiles: 30 },
    Aim:            { mode: 'auto', autoTargetLayer: 'enemies', autoRange: 400 },
    EnemyAI:        { behavior: 'chase', speed: 80, detectionRange: 2000, attackRange: 40, attackCooldown: 1500, attackDamage: 10, hp: 50, fleeHpThreshold: 0.2, waypoints: [] },
    WaveSpawner:    { enemiesPerWave: 3, waveCooldown: 3000, spawnDelay: 500, scalingFactor: 1.2, maxWaves: 10, maxEnemiesPerWave: 15, spawnAreaX: 100, spawnAreaWidth: 880, spawnY: 100 },
    EnemyDrop:      { lootTable: [{ item: 'potion', weight: 3, minCount: 1, maxCount: 1, type: 'health' }, { item: 'coin', weight: 5, minCount: 1, maxCount: 3, type: 'collectible' }], dropChance: 0.6, xpAmount: 15 },
    LevelUp:        { xpPerLevel: 50, scalingCurve: 'quadratic', maxLevel: 20, xpSource: 'enemy:death', xpAmount: 15, statGrowth: { hp: 10, attack: 2, defense: 1 } },
    StatusEffect:   { maxEffects: 5 },
    SkillTree:      {
      skills: [
        { id: 'power_strike', name: 'Power Strike', description: '+50% damage for 5s', cost: 1, effect: { type: 'buff', stat: 'attack', multiplier: 1.5, duration: 5000 } },
        { id: 'heal', name: 'Heal', description: 'Restore 30 HP', cost: 1, effect: { type: 'heal', amount: 30 } },
        { id: 'speed_burst', name: 'Speed Burst', description: '+50% move speed for 5s', cost: 1, effect: { type: 'buff', stat: 'speed', multiplier: 1.5, duration: 5000 } },
      ],
      pointsPerLevel: 1,
      activateEvent: 'input:touch:doubleTap',
    },
    EquipmentSlot:  { slots: [{ id: 'weapon', label: 'Weapon' }, { id: 'armor', label: 'Armor' }] },
    Shield:         { maxCharges: 2, rechargeCooldown: 8000, damageEvent: 'collision:damage' },
    Collision:      { rules: [{ a: 'projectiles', b: 'enemies', event: 'hit', destroy: ['a'] }, { a: 'player', b: 'enemies', event: 'damage' }] },
    DifficultyRamp: { target: 'wavespawner_1', mode: 'time', rules: [{ every: 30, field: 'enemiesPerWave', increase: 1, max: 10 }] },
    ComboSystem:    { window: 2000, multiplier: [1, 1.5, 2, 3], resetOnMiss: true },
    Scorer:         { perHit: 10 },
    Lives:          { count: 3 },
    IFrames:        { duration: 1000 },
    Knockback:      { force: 200, duration: 150 },
    UIOverlay:      { elements: ['score', 'lives', 'level'] },
    ResultScreen:   { show: ['score', 'level', 'waves_cleared'], rating: { '3star': 500, '2star': 250, '1star': 100 } },
    TouchInput:     { playerSize: 64 },
    ParticleVFX:    { events: { 'collision:hit': { effect: 'sparkle', at: 'target', duration: 400, color: '#ffaa00' }, 'enemy:death': { effect: 'burst', at: 'target', duration: 500, color: '#ff0000' }, 'levelup:levelup': { effect: 'burst', at: 'player', duration: 800, color: '#00ff88' } } },
    SoundFX:        { events: { 'collision:hit': 'pop', 'enemy:death': 'boom', 'levelup:levelup': 'cheer', 'wave:complete': 'ding' } },
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
  TouchInput: { playerSize: 64 },
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
