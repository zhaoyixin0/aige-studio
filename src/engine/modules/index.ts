// Input
export { FaceInput } from './input/face-input';
export { HandInput } from './input/hand-input';
export { BodyInput } from './input/body-input';
export { TouchInput } from './input/touch-input';
export { DeviceInput } from './input/device-input';
export { AudioInput } from './input/audio-input';

// Mechanic
export { Scorer } from './mechanic/scorer';
export { Timer } from './mechanic/timer';
export { Lives } from './mechanic/lives';
export { Spawner } from './mechanic/spawner';
export { Collision } from './mechanic/collision';
export { DifficultyRamp } from './mechanic/difficulty-ramp';
export { Randomizer } from './mechanic/randomizer';
export { QuizEngine } from './mechanic/quiz-engine';
export { ExpressionDetector } from './mechanic/expression-detector';
export { ComboSystem } from './mechanic/combo-system';
export { Jump } from './mechanic/jump';
export { PowerUp } from './mechanic/power-up';
export { BeatMap } from './mechanic/beat-map';
export { GestureMatch } from './mechanic/gesture-match';
export { MatchEngine } from './mechanic/match-engine';
export { Runner } from './mechanic/runner';
export { PlaneDetection } from './mechanic/plane-detection';
export { BranchStateMachine } from './mechanic/branch-state-machine';
export { DressUpEngine } from './mechanic/dress-up-engine';

// Mechanic — Platformer (Batch 1)
export { Gravity } from './mechanic/gravity';
export { Knockback } from './mechanic/knockback';
export { IFrames } from './mechanic/i-frames';
export { PlayerMovement } from './mechanic/player-movement';
export { Dash } from './mechanic/dash';
export { CoyoteTime } from './mechanic/coyote-time';
export { StaticPlatform } from './mechanic/static-platform';
export { MovingPlatform } from './mechanic/moving-platform';
export { OneWayPlatform } from './mechanic/one-way-platform';
export { CrumblingPlatform } from './mechanic/crumbling-platform';
export { Hazard } from './mechanic/hazard';
export { Collectible } from './mechanic/collectible';
export { Inventory } from './mechanic/inventory';
export { Checkpoint } from './mechanic/checkpoint';
export { WallDetect } from './mechanic/wall-detect';
export { Health } from './mechanic/health';
export type { HealthEntity } from './mechanic/health';
export { Shield } from './mechanic/shield';

// Mechanic — RPG (Batch 3)
export { EquipmentSlot } from './mechanic/equipment-slot';
export type { Equipment, SlotType } from './mechanic/equipment-slot';
export { EnemyDrop } from './mechanic/enemy-drop';
export type { LootEntry } from './mechanic/enemy-drop';
export { LevelUp } from './mechanic/level-up';
export { StatusEffect } from './mechanic/status-effect';
export type { ActiveEffect } from './mechanic/status-effect';
export { SkillTree } from './mechanic/skill-tree';
export type { SkillDef } from './mechanic/skill-tree';
export { DialogueSystem } from './mechanic/dialogue-system';
export type { DialogueNode, DialogueTree, DialogueChoice } from './mechanic/dialogue-system';

// Mechanic — Shooter (Batch 2)
export { Projectile } from './mechanic/projectile';
export type { ProjectileInstance } from './mechanic/projectile';
export { BulletPattern } from './mechanic/bullet-pattern';
export { Aim } from './mechanic/aim';
export { EnemyAI } from './mechanic/enemy-ai';
export type { EnemyInstance, AIState } from './mechanic/enemy-ai';
export { WaveSpawner } from './mechanic/wave-spawner';

// Mechanic — Tween
export { Tween } from './mechanic/tween';

// Mechanic — Physics2D
export { Physics2D } from './mechanic/physics2d';

// Feedback
export { GameFlow } from './feedback/game-flow';
export { ParticleVFX } from './feedback/particle-vfx';
export { SoundFX } from './feedback/sound-fx';
export { UIOverlay } from './feedback/ui-overlay';
export { ResultScreen } from './feedback/result-screen';
export { CameraFollow } from './feedback/camera-follow';

// Base
export { BaseModule } from './base-module';
