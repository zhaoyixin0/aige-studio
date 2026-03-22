import type { ModuleConfig } from '@/engine/core';
import { BaseTranslator } from './base-translator';

/**
 * Translates Timer module config into Effect House .apjs code.
 * Implements countdown/stopwatch logic using Time.setInterval.
 */
export class TimerTranslator extends BaseTranslator {
  readonly moduleType = 'Timer';

  translate(config: ModuleConfig): string {
    const duration = config.params.duration ?? 30;
    const mode = config.params.mode ?? 'countdown';
    const onEnd = config.params.onEnd ?? 'finish';

    if (mode === 'countdown') {
      return `${this.header('Timer (countdown): ' + config.id)}
let timeRemaining_${config.id} = ${duration};

const timerInterval_${config.id} = Time.setInterval(() => {
  timeRemaining_${config.id} -= 1;
  Patches.inputs.setScalar('timeRemaining', timeRemaining_${config.id});

  if (timeRemaining_${config.id} <= 0) {
    Time.clearInterval(timerInterval_${config.id});
    Patches.inputs.setBoolean('timerEnded', true);${onEnd === 'finish' ? `\n    finishGame();` : ''}
  }
}, 1000);

Patches.inputs.setScalar('timeRemaining', ${duration});`;
    }

    return `${this.header('Timer (stopwatch): ' + config.id)}
let timeElapsed_${config.id} = 0;

Time.setInterval(() => {
  timeElapsed_${config.id} += 1;
  Patches.inputs.setScalar('timeElapsed', timeElapsed_${config.id});
}, 1000);

Patches.inputs.setScalar('timeElapsed', 0);`;
  }

  getRequiredCapabilities(): string[] {
    return [];
  }
}
