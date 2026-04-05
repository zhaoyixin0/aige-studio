import { ModuleRegistry } from './core/index.ts';
import type { ModuleConstructor } from './core/index.ts';
// Input modules
import { FaceInput } from './modules/input/face-input.ts';
import { HandInput } from './modules/input/hand-input.ts';
import { BodyInput } from './modules/input/body-input.ts';
import { TouchInput } from './modules/input/touch-input.ts';
import { DeviceInput } from './modules/input/device-input.ts';
import { AudioInput } from './modules/input/audio-input.ts';
// Mechanic modules
import { Spawner } from './modules/mechanic/spawner.ts';
import { Collision } from './modules/mechanic/collision.ts';
import { Scorer } from './modules/mechanic/scorer.ts';
import { Timer } from './modules/mechanic/timer.ts';
import { Lives } from './modules/mechanic/lives.ts';
import { DifficultyRamp } from './modules/mechanic/difficulty-ramp.ts';
import { Randomizer } from './modules/mechanic/randomizer.ts';
import { QuizEngine } from './modules/mechanic/quiz-engine.ts';
// P1 extended mechanic modules
import { ExpressionDetector } from './modules/mechanic/expression-detector.ts';
import { ComboSystem } from './modules/mechanic/combo-system.ts';
import { Jump } from './modules/mechanic/jump.ts';
import { PowerUp } from './modules/mechanic/power-up.ts';
// P2 extended mechanic modules
import { BeatMap } from './modules/mechanic/beat-map.ts';
import { GestureMatch } from './modules/mechanic/gesture-match.ts';
import { MatchEngine } from './modules/mechanic/match-engine.ts';
import { Runner } from './modules/mechanic/runner.ts';
// P3 extended mechanic modules
import { PlaneDetection } from './modules/mechanic/plane-detection.ts';
import { BranchStateMachine } from './modules/mechanic/branch-state-machine.ts';
import { DressUpEngine } from './modules/mechanic/dress-up-engine.ts';
// Platformer mechanic modules
import { Gravity } from './modules/mechanic/gravity.ts';
import { PlayerMovement } from './modules/mechanic/player-movement.ts';
import { StaticPlatform } from './modules/mechanic/static-platform.ts';
import { MovingPlatform } from './modules/mechanic/moving-platform.ts';
import { CrumblingPlatform } from './modules/mechanic/crumbling-platform.ts';
import { OneWayPlatform } from './modules/mechanic/one-way-platform.ts';
import { CoyoteTime } from './modules/mechanic/coyote-time.ts';
import { Dash } from './modules/mechanic/dash.ts';
import { WallDetect } from './modules/mechanic/wall-detect.ts';
import { Knockback } from './modules/mechanic/knockback.ts';
import { IFrames } from './modules/mechanic/i-frames.ts';
import { Collectible } from './modules/mechanic/collectible.ts';
import { Hazard } from './modules/mechanic/hazard.ts';
import { Checkpoint } from './modules/mechanic/checkpoint.ts';
import { Inventory } from './modules/mechanic/inventory.ts';
import { Health } from './modules/mechanic/health.ts';
import { Shield } from './modules/mechanic/shield.ts';
// RPG mechanic modules (Batch 3)
import { EquipmentSlot } from './modules/mechanic/equipment-slot.ts';
import { EnemyDrop } from './modules/mechanic/enemy-drop.ts';
import { LevelUp } from './modules/mechanic/level-up.ts';
import { StatusEffect } from './modules/mechanic/status-effect.ts';
import { SkillTree } from './modules/mechanic/skill-tree.ts';
import { DialogueSystem } from './modules/mechanic/dialogue-system.ts';
// Shooter mechanic modules (Batch 2)
import { Projectile } from './modules/mechanic/projectile.ts';
import { BulletPattern } from './modules/mechanic/bullet-pattern.ts';
import { Aim } from './modules/mechanic/aim.ts';
import { EnemyAI } from './modules/mechanic/enemy-ai.ts';
import { WaveSpawner } from './modules/mechanic/wave-spawner.ts';
// Tween module
import { Tween } from './modules/mechanic/tween.ts';
// Physics2D module
import { Physics2D } from './modules/mechanic/physics2d.ts';
// ScrollingLayers module
import { ScrollingLayers } from './modules/mechanic/scrolling-layers.ts';
// Feedback modules
import { GameFlow } from './modules/feedback/game-flow.ts';
import { ParticleVFX } from './modules/feedback/particle-vfx.ts';
import { SoundFX } from './modules/feedback/sound-fx.ts';
import { UIOverlay } from './modules/feedback/ui-overlay.ts';
import { ResultScreen } from './modules/feedback/result-screen.ts';
import { CameraFollow } from './modules/feedback/camera-follow.ts';

export function createModuleRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();

  // Input modules
  registry.register('FaceInput', FaceInput as unknown as ModuleConstructor);
  registry.register('HandInput', HandInput as unknown as ModuleConstructor);
  registry.register('BodyInput', BodyInput as unknown as ModuleConstructor);
  registry.register('TouchInput', TouchInput as unknown as ModuleConstructor);
  registry.register('DeviceInput', DeviceInput as unknown as ModuleConstructor);
  registry.register('AudioInput', AudioInput as unknown as ModuleConstructor);

  // Mechanic modules
  registry.register('Spawner', Spawner as unknown as ModuleConstructor);
  registry.register('Collision', Collision as unknown as ModuleConstructor);
  registry.register('Scorer', Scorer as unknown as ModuleConstructor);
  registry.register('Timer', Timer as unknown as ModuleConstructor);
  registry.register('Lives', Lives as unknown as ModuleConstructor);
  registry.register('DifficultyRamp', DifficultyRamp as unknown as ModuleConstructor);
  registry.register('Randomizer', Randomizer as unknown as ModuleConstructor);
  registry.register('QuizEngine', QuizEngine as unknown as ModuleConstructor);
  // P1 extended
  registry.register('ExpressionDetector', ExpressionDetector as unknown as ModuleConstructor);
  registry.register('ComboSystem', ComboSystem as unknown as ModuleConstructor);
  registry.register('Jump', Jump as unknown as ModuleConstructor);
  registry.register('PowerUp', PowerUp as unknown as ModuleConstructor);
  // P2 extended
  registry.register('BeatMap', BeatMap as unknown as ModuleConstructor);
  registry.register('GestureMatch', GestureMatch as unknown as ModuleConstructor);
  registry.register('MatchEngine', MatchEngine as unknown as ModuleConstructor);
  registry.register('Runner', Runner as unknown as ModuleConstructor);
  // P3 extended
  registry.register('PlaneDetection', PlaneDetection as unknown as ModuleConstructor);
  registry.register('BranchStateMachine', BranchStateMachine as unknown as ModuleConstructor);
  registry.register('DressUpEngine', DressUpEngine as unknown as ModuleConstructor);
  // Platformer
  registry.register('Gravity', Gravity as unknown as ModuleConstructor);
  registry.register('PlayerMovement', PlayerMovement as unknown as ModuleConstructor);
  registry.register('StaticPlatform', StaticPlatform as unknown as ModuleConstructor);
  registry.register('MovingPlatform', MovingPlatform as unknown as ModuleConstructor);
  registry.register('CrumblingPlatform', CrumblingPlatform as unknown as ModuleConstructor);
  registry.register('OneWayPlatform', OneWayPlatform as unknown as ModuleConstructor);
  registry.register('CoyoteTime', CoyoteTime as unknown as ModuleConstructor);
  registry.register('Dash', Dash as unknown as ModuleConstructor);
  registry.register('WallDetect', WallDetect as unknown as ModuleConstructor);
  registry.register('Knockback', Knockback as unknown as ModuleConstructor);
  registry.register('IFrames', IFrames as unknown as ModuleConstructor);
  registry.register('Collectible', Collectible as unknown as ModuleConstructor);
  registry.register('Hazard', Hazard as unknown as ModuleConstructor);
  registry.register('Checkpoint', Checkpoint as unknown as ModuleConstructor);
  registry.register('Inventory', Inventory as unknown as ModuleConstructor);
  registry.register('Health', Health as unknown as ModuleConstructor);
  registry.register('Shield', Shield as unknown as ModuleConstructor);
  // RPG (Batch 3)
  registry.register('EquipmentSlot', EquipmentSlot as unknown as ModuleConstructor);
  registry.register('EnemyDrop', EnemyDrop as unknown as ModuleConstructor);
  registry.register('LevelUp', LevelUp as unknown as ModuleConstructor);
  registry.register('StatusEffect', StatusEffect as unknown as ModuleConstructor);
  registry.register('SkillTree', SkillTree as unknown as ModuleConstructor);
  registry.register('DialogueSystem', DialogueSystem as unknown as ModuleConstructor);

  // Shooter (Batch 2)
  registry.register('Projectile', Projectile as unknown as ModuleConstructor);
  registry.register('BulletPattern', BulletPattern as unknown as ModuleConstructor);
  registry.register('Aim', Aim as unknown as ModuleConstructor);
  registry.register('EnemyAI', EnemyAI as unknown as ModuleConstructor);
  registry.register('WaveSpawner', WaveSpawner as unknown as ModuleConstructor);

  // Tween
  registry.register('Tween', Tween as unknown as ModuleConstructor);
  // Physics2D
  registry.register('Physics2D', Physics2D as unknown as ModuleConstructor);
  // ScrollingLayers
  registry.register('ScrollingLayers', ScrollingLayers as unknown as ModuleConstructor);

  // Feedback modules
  registry.register('GameFlow', GameFlow as unknown as ModuleConstructor);
  registry.register('ParticleVFX', ParticleVFX as unknown as ModuleConstructor);
  registry.register('SoundFX', SoundFX as unknown as ModuleConstructor);
  registry.register('UIOverlay', UIOverlay as unknown as ModuleConstructor);
  registry.register('ResultScreen', ResultScreen as unknown as ModuleConstructor);
  registry.register('CameraFollow', CameraFollow as unknown as ModuleConstructor);

  return registry;
}
