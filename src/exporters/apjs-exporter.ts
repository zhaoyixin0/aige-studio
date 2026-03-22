import type { GameConfig, ModuleConfig } from '@/engine/core';
import { getTranslator } from './apjs-translators';

export interface ApjsExportResult {
  /** The main.apjs file content */
  mainScript: string;
  /** Scene graph definition describing required scene objects */
  sceneManifest: object;
  /** Required Effect House capabilities, e.g. ['FACE_TRACKING', 'TOUCH'] */
  requiredCapabilities: string[];
}

/**
 * Capability mapping from module types to Effect House capability strings.
 * Modules not listed here have no special capability requirements.
 */
const MODULE_CAPABILITY_MAP: Record<string, string[]> = {
  FaceInput: ['FACE_TRACKING'],
  HandInput: ['HAND_TRACKING'],
  BodyInput: ['FACE_TRACKING'], // Body tracking uses face tracking in Effect House
  TouchInput: ['TOUCH'],
  AudioInput: ['AUDIO'],
  SoundFX: ['AUDIO'],
};

/**
 * Translates a GameConfig into Effect House .apjs script format.
 *
 * The exported .apjs follows Effect House conventions:
 * - require() imports for Scene, Time, Patches, etc.
 * - Promise.all for scene object discovery
 * - Event-driven game logic
 */
export class ApjsExporter {
  export(config: GameConfig): ApjsExportResult {
    const enabledModules = config.modules.filter((m) => m.enabled);
    const capabilities = new Set<string>();

    // Collect required capabilities from translator + capability map
    for (const mod of enabledModules) {
      const translator = getTranslator(mod.type);
      if (translator) {
        translator.getRequiredCapabilities().forEach((c) => capabilities.add(c));
      }
      // Also check the static capability map for input modules
      const mapped = MODULE_CAPABILITY_MAP[mod.type];
      if (mapped) {
        mapped.forEach((c) => capabilities.add(c));
      }
    }

    // Generate imports section
    const imports = this.generateImports(capabilities);

    // Generate module translations
    const moduleScripts = enabledModules
      .map((mod) => {
        const translator = getTranslator(mod.type);
        return translator ? translator.translate(mod) : `// Unsupported module: ${mod.type} (${mod.id})`;
      })
      .join('\n\n');

    // Generate scene manifest
    const sceneManifest = this.generateSceneManifest(enabledModules);

    return {
      mainScript: `${imports}\n\n// Game Config: ${config.meta.name}\n${moduleScripts}\n\n// Start game\nstartGame();`,
      sceneManifest,
      requiredCapabilities: [...capabilities],
    };
  }

  private generateImports(capabilities: Set<string>): string {
    const imports: string[] = [
      "const Scene = require('Scene');",
      "const Time = require('Time');",
    ];
    if (capabilities.has('FACE_TRACKING')) {
      imports.push("const FaceTracking = require('FaceTracking');");
    }
    if (capabilities.has('HAND_TRACKING')) {
      imports.push("const HandTracking = require('HandTracking');");
    }
    if (capabilities.has('TOUCH')) {
      imports.push("const TouchGestures = require('TouchGestures');");
    }
    if (capabilities.has('AUDIO')) {
      imports.push("const Audio = require('Audio');");
    }
    imports.push("const Patches = require('Patches');");
    return imports.join('\n');
  }

  private generateSceneManifest(modules: ModuleConfig[]): object {
    return {
      root: {
        children: modules.map((m) => ({
          name: m.id,
          type: 'null_object',
          components: [],
        })),
      },
    };
  }
}
