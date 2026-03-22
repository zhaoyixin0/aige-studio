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
// Feedback modules
import { GameFlow } from './modules/feedback/game-flow.ts';
import { ParticleVFX } from './modules/feedback/particle-vfx.ts';
import { SoundFX } from './modules/feedback/sound-fx.ts';
import { UIOverlay } from './modules/feedback/ui-overlay.ts';
import { ResultScreen } from './modules/feedback/result-screen.ts';

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

  // Feedback modules
  registry.register('GameFlow', GameFlow as unknown as ModuleConstructor);
  registry.register('ParticleVFX', ParticleVFX as unknown as ModuleConstructor);
  registry.register('SoundFX', SoundFX as unknown as ModuleConstructor);
  registry.register('UIOverlay', UIOverlay as unknown as ModuleConstructor);
  registry.register('ResultScreen', ResultScreen as unknown as ModuleConstructor);

  return registry;
}
