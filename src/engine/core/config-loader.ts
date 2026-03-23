import type { GameConfig } from './types';
import type { Engine } from './engine';
import type { ModuleRegistry } from './module-registry';
import { AutoWirer } from './auto-wirer';

export interface ConfigChange {
  op: 'add_module' | 'remove_module' | 'update_param' | 'enable_module' | 'disable_module';
  id?: string;
  moduleId?: string;
  type?: string;
  params?: Record<string, any>;
}

export class ConfigLoader {
  private registry: ModuleRegistry;

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  /**
   * Load a full GameConfig into the engine.
   * 1. Sets the config on the engine
   * 2. Creates and adds enabled modules
   * 3. Skips disabled modules
   * 4. Warns on unknown types
   * 5. Runs AutoWirer
   */
  load(engine: Engine, config: GameConfig): void {
    engine.loadConfig(config);

    for (const moduleCfg of config.modules) {
      // Skip disabled modules
      if (moduleCfg.enabled === false) {
        continue;
      }

      // Warn on unknown types
      if (!this.registry.has(moduleCfg.type)) {
        console.warn(`ConfigLoader: unknown module type "${moduleCfg.type}", skipping.`);
        continue;
      }

      const mod = this.registry.create(moduleCfg.type, moduleCfg.id, moduleCfg.params);
      engine.addModule(mod);
    }

    AutoWirer.wire(engine);

    // Auto-start GameFlow if present
    const gameFlows = engine.getModulesByType('GameFlow');
    if (gameFlows.length > 0) {
      (gameFlows[0] as any).transition('countdown');
    }
  }

  /**
   * Apply incremental config changes to a running engine.
   */
  applyChanges(engine: Engine, changes: ConfigChange[]): void {
    for (const change of changes) {
      switch (change.op) {
        case 'add_module': {
          if (!change.type || !change.id) break;
          if (!this.registry.has(change.type)) {
            console.warn(`ConfigLoader: unknown module type "${change.type}", skipping.`);
            break;
          }
          const mod = this.registry.create(change.type, change.id, change.params ?? {});
          engine.addModule(mod);
          break;
        }

        case 'remove_module': {
          const id = change.moduleId ?? change.id;
          if (id) {
            engine.removeModule(id);
          }
          break;
        }

        case 'update_param': {
          const id = change.moduleId ?? change.id;
          if (id && change.params) {
            const mod = engine.getModule(id);
            if (mod) {
              mod.configure(change.params);
            }
          }
          break;
        }

        case 'enable_module': {
          // Re-add module if it was previously removed
          if (change.type && change.id) {
            if (!engine.getModule(change.id) && this.registry.has(change.type)) {
              const mod = this.registry.create(change.type, change.id, change.params ?? {});
              engine.addModule(mod);
            }
          }
          break;
        }

        case 'disable_module': {
          const id = change.moduleId ?? change.id;
          if (id) {
            engine.removeModule(id);
          }
          break;
        }
      }
    }

    // Re-wire after changes
    AutoWirer.wire(engine);
  }
}
