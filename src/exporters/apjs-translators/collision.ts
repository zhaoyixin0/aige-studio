import type { ModuleConfig } from '@/engine/core';
import { BaseTranslator } from './base-translator';

/**
 * Translates Collision module config into Effect House .apjs code.
 * Uses distance-based hit detection between scene objects.
 */
export class CollisionTranslator extends BaseTranslator {
  readonly moduleType = 'Collision';

  translate(config: ModuleConfig): string {
    const rules: Array<{ a: string; b: string; event: string; destroy?: string[] }> =
      config.params.rules ?? [];

    const ruleChecks = rules
      .map(
        (rule, i) => `
  // Rule ${i + 1}: ${rule.a} vs ${rule.b} -> ${rule.event}
  for (const objA of collisionLayer_${rule.a}) {
    for (const objB of collisionLayer_${rule.b}) {
      const dx = objA.transform.x.pinLastValue() - objB.transform.x.pinLastValue();
      const dy = objA.transform.y.pinLastValue() - objB.transform.y.pinLastValue();
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < collisionThreshold) {
        Patches.inputs.setScalar('${rule.event}', 1);${
          rule.destroy?.includes('b') ? `\n        objB.hidden = true;` : ''
        }${
          rule.destroy?.includes('a') ? `\n        objA.hidden = true;` : ''
        }
      }
    }
  }`,
      )
      .join('\n');

    return `${this.header('Collision: ' + config.id)}
const collisionThreshold = 50; // distance in scene units

function checkCollisions_${config.id}() {${ruleChecks}
}

Time.setInterval(() => {
  checkCollisions_${config.id}();
}, 16);`;
  }

  getRequiredCapabilities(): string[] {
    return [];
  }
}
