import { BaseTranslator } from './base-translator';
import { SpawnerTranslator } from './spawner';
import { CollisionTranslator } from './collision';
import { ScorerTranslator } from './scorer';
import { TimerTranslator } from './timer';
import { GameFlowTranslator } from './game-flow';

const translators = new Map<string, BaseTranslator>();

function register(translator: BaseTranslator): void {
  translators.set(translator.moduleType, translator);
}

register(new SpawnerTranslator());
register(new CollisionTranslator());
register(new ScorerTranslator());
register(new TimerTranslator());
register(new GameFlowTranslator());

export function getTranslator(moduleType: string): BaseTranslator | undefined {
  return translators.get(moduleType);
}

export { BaseTranslator } from './base-translator';
export { SpawnerTranslator } from './spawner';
export { CollisionTranslator } from './collision';
export { ScorerTranslator } from './scorer';
export { TimerTranslator } from './timer';
export { GameFlowTranslator } from './game-flow';
