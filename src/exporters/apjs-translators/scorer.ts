import type { ModuleConfig } from '@/engine/core';
import { BaseTranslator } from './base-translator';

/**
 * Translates Scorer module config into Effect House .apjs code.
 * Tracks score via a variable and outputs it through Patches.
 */
export class ScorerTranslator extends BaseTranslator {
  readonly moduleType = 'Scorer';

  translate(config: ModuleConfig): string {
    const perHit = config.params.perHit ?? 10;
    const deductOnMiss = config.params.deductOnMiss ?? false;
    const deductAmount = config.params.deductAmount ?? 5;

    let missBlock = '';
    if (deductOnMiss) {
      missBlock = `
function onMiss_${config.id}() {
  score_${config.id} = Math.max(0, score_${config.id} - ${deductAmount});
  Patches.inputs.setScalar('score', score_${config.id});
}`;
    }

    return `${this.header('Scorer: ' + config.id)}
let score_${config.id} = 0;

function onHit_${config.id}() {
  score_${config.id} += ${perHit};
  Patches.inputs.setScalar('score', score_${config.id});
}
${missBlock}
// Output initial score
Patches.inputs.setScalar('score', 0);`;
  }

  getRequiredCapabilities(): string[] {
    return [];
  }
}
