// tools/m0/taxonomy/module-capabilities.ts
// Module capability index derived from module file analysis.
// Maps module name → array of capabilities.

export type CapabilityIndex = Record<string, string[]>;

// Capabilities derived from getContracts() and getSchema() analysis of 59 modules.
// Capabilities: collisionProvider, damageReceiver, damageSource, playerPosition,
//   spawnProvider, inputProvider, feedbackProvider, physicsProvider,
//   platformProvider, scoringProvider, timerProvider, animationProvider,
//   aiProvider, inventoryProvider, statusProvider, dialogueProvider

const MODULE_CAPS: CapabilityIndex = {
  // --- Mechanic (47) ---
  Aim: ['targetingProvider'],
  BeatMap: ['rhythmProvider', 'timerProvider'],
  BranchStateMachine: ['dialogueProvider', 'stateProvider'],
  BulletPattern: ['spawnProvider', 'damageSource'],
  Checkpoint: ['platformProvider'],
  Collectible: ['collisionProvider', 'scoringProvider'],
  Collision: ['collisionProvider'],
  ComboSystem: ['scoringProvider'],
  CoyoteTime: ['platformProvider'],
  CrumblingPlatform: ['platformProvider'],
  Dash: ['playerPosition', 'animationProvider'],
  DialogueSystem: ['dialogueProvider'],
  DifficultyRamp: ['timerProvider'],
  DressUpEngine: ['inventoryProvider'],
  EnemyAI: ['aiProvider', 'damageSource'],
  EnemyDrop: ['spawnProvider', 'inventoryProvider'],
  EquipmentSlot: ['inventoryProvider', 'statusProvider'],
  ExpressionDetector: ['inputProvider'],
  GestureMatch: ['inputProvider'],
  Gravity: ['physicsProvider'],
  Hazard: ['damageSource', 'collisionProvider'],
  Health: ['damageReceiver', 'statusProvider'],
  IFrames: ['statusProvider'],
  Inventory: ['inventoryProvider'],
  Jump: ['playerPosition', 'physicsProvider'],
  Knockback: ['physicsProvider', 'animationProvider'],
  LevelUp: ['scoringProvider', 'statusProvider'],
  Lives: ['damageReceiver', 'feedbackProvider'],
  MatchEngine: ['scoringProvider'],
  MovingPlatform: ['platformProvider', 'animationProvider'],
  OneWayPlatform: ['platformProvider'],
  PlaneDetection: ['inputProvider'],
  PlayerMovement: ['playerPosition'],
  PowerUp: ['statusProvider', 'spawnProvider'],
  Projectile: ['damageSource', 'collisionProvider'],
  QuizEngine: ['scoringProvider', 'dialogueProvider'],
  Randomizer: ['spawnProvider'],
  Runner: ['playerPosition', 'animationProvider'],
  Scorer: ['scoringProvider'],
  Shield: ['damageReceiver', 'statusProvider'],
  SkillTree: ['statusProvider', 'inventoryProvider'],
  Spawner: ['spawnProvider'],
  StaticPlatform: ['platformProvider'],
  StatusEffect: ['statusProvider'],
  Timer: ['timerProvider'],
  WallDetect: ['collisionProvider', 'platformProvider'],
  WaveSpawner: ['spawnProvider', 'aiProvider'],

  // --- Input (6) ---
  AudioInput: ['inputProvider'],
  BodyInput: ['inputProvider'],
  DeviceInput: ['inputProvider'],
  FaceInput: ['inputProvider'],
  HandInput: ['inputProvider'],
  TouchInput: ['inputProvider'],

  // --- Feedback (6) ---
  CameraFollow: ['feedbackProvider', 'animationProvider'],
  GameFlow: ['feedbackProvider', 'timerProvider'],
  ParticleVFX: ['feedbackProvider', 'animationProvider'],
  ResultScreen: ['feedbackProvider'],
  SoundFX: ['feedbackProvider'],
  UIOverlay: ['feedbackProvider'],
};

export async function buildCapabilityIndex(): Promise<CapabilityIndex> {
  // Static analysis result. In a more dynamic system, this would scan module files.
  return { ...MODULE_CAPS };
}
