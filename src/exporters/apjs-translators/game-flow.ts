import type { ModuleConfig } from '@/engine/core';
import { BaseTranslator } from './base-translator';

/**
 * Translates GameFlow module config into Effect House .apjs code.
 * Implements a state machine with ready -> countdown -> playing -> finished states.
 */
export class GameFlowTranslator extends BaseTranslator {
  readonly moduleType = 'GameFlow';

  translate(config: ModuleConfig): string {
    const countdown = config.params.countdown ?? 3;
    const onFinish = config.params.onFinish ?? 'show_result';

    return `${this.header('GameFlow: ' + config.id)}
let gameState_${config.id} = 'ready'; // ready | countdown | playing | finished

function startGame() {
  gameState_${config.id} = 'countdown';
  Patches.inputs.setString('gameState', 'countdown');

  let countdownValue = ${countdown};
  ${countdown > 0 ? `const countdownInterval = Time.setInterval(() => {
    countdownValue -= 1;
    Patches.inputs.setScalar('countdown', countdownValue);
    if (countdownValue <= 0) {
      Time.clearInterval(countdownInterval);
      gameState_${config.id} = 'playing';
      Patches.inputs.setString('gameState', 'playing');
    }
  }, 1000);` : `gameState_${config.id} = 'playing';
  Patches.inputs.setString('gameState', 'playing');`}
}

function finishGame() {
  gameState_${config.id} = 'finished';
  Patches.inputs.setString('gameState', 'finished');${
    onFinish === 'show_result'
      ? `\n  Patches.inputs.setBoolean('showResult', true);`
      : onFinish === 'restart'
        ? `\n  // Auto-restart after delay\n  Time.setTimeout(() => { startGame(); }, 2000);`
        : ''
  }
}`;
  }

  getRequiredCapabilities(): string[] {
    return [];
  }
}
