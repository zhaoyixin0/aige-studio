import type { ModuleConfig } from '@/engine/core';
import { BaseTranslator } from './base-translator';

/**
 * Translates Spawner module config into Effect House .apjs code.
 * Uses Time.setInterval for periodic spawning and scene object movement.
 */
export class SpawnerTranslator extends BaseTranslator {
  readonly moduleType = 'Spawner';

  translate(config: ModuleConfig): string {
    const frequency = config.params.frequency ?? 1.5;
    const intervalMs = Math.round(frequency * 1000);
    const speedMin = config.params.speed?.min ?? 100;
    const speedMax = config.params.speed?.max ?? 200;
    const direction = config.params.direction ?? 'down';
    const maxCount = config.params.maxCount ?? 10;

    return `${this.header('Spawner: ' + config.id)}
const spawned_${config.id} = [];
let spawnCount_${config.id} = 0;

function spawn_${config.id}() {
  if (spawned_${config.id}.length >= ${maxCount}) return;

  const speed = ${speedMin} + Math.random() * ${speedMax - speedMin};
  const obj = Scene.create('SceneObject', {
    name: 'spawn_' + (spawnCount_${config.id}++),
    hidden: false,
  });

  spawned_${config.id}.push({ obj, speed, direction: '${direction}' });
}

Time.setInterval(() => {
  spawn_${config.id}();
}, ${intervalMs});

// Move spawned objects each frame
Time.setInterval(() => {
  const dt = 0.016; // ~60fps frame time
  for (let i = spawned_${config.id}.length - 1; i >= 0; i--) {
    const entry = spawned_${config.id}[i];
    const transform = entry.obj.transform;
    switch (entry.direction) {
      case 'down':  transform.y.pinLastValue() + entry.speed * dt; break;
      case 'up':    transform.y.pinLastValue() - entry.speed * dt; break;
      case 'left':  transform.x.pinLastValue() - entry.speed * dt; break;
      case 'right': transform.x.pinLastValue() + entry.speed * dt; break;
    }
  }
}, 16);`;
  }

  getRequiredCapabilities(): string[] {
    return [];
  }
}
