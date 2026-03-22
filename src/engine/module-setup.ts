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

  // Feedback modules
  registry.register('GameFlow', GameFlow as unknown as ModuleConstructor);
  registry.register('ParticleVFX', ParticleVFX as unknown as ModuleConstructor);
  registry.register('SoundFX', SoundFX as unknown as ModuleConstructor);
  registry.register('UIOverlay', UIOverlay as unknown as ModuleConstructor);
  registry.register('ResultScreen', ResultScreen as unknown as ModuleConstructor);

  return registry;
}
