import type { GameConfig } from './types';
import type { Engine } from './engine';
import type { ModuleRegistry } from './module-registry';
import { AutoWirer } from './auto-wirer';
import { ContractRegistry } from './contract-registry';
import { validateConfig, type ValidationReport } from './config-validator';

export interface ConfigChange {
  op: 'add_module' | 'remove_module' | 'update_param' | 'enable_module' | 'disable_module';
  id?: string;
  moduleId?: string;
  type?: string;
  params?: Record<string, unknown>;
}

export interface ConfigLoaderOptions {
  /** When true, throw on validation errors instead of warning. Default: false */
  strict?: boolean;
}

export class ConfigLoader {
  private registry: ModuleRegistry;
  private strict: boolean;
  private _lastValidationReport: ValidationReport | null = null;

  constructor(registry: ModuleRegistry, options?: ConfigLoaderOptions) {
    this.registry = registry;
    this.strict = options?.strict ?? false;
  }

  /** Get the validation report from the last load() call. */
  getLastValidationReport(): ValidationReport | null {
    return this._lastValidationReport;
  }

  /**
   * Load a full GameConfig into the engine.
   * 1. Runs pre-load validation (strict mode throws on errors)
   * 2. Sets the config on the engine
   * 3. Creates and adds enabled modules
   * 4. Runs AutoWirer
   */
  load(engine: Engine, config: GameConfig): void {
    // Pre-load validation (contract-aware)
    const contracts = ContractRegistry.fromRegistry(this.registry);
    const report = validateConfig(config, contracts);
    this._lastValidationReport = report;

    if (this.strict && !report.isPlayable) {
      const firstError = report.errors[0];
      throw new Error(
        `[ConfigLoader] Validation failed: ${firstError.message} ` +
        `(${report.errors.length} error(s) total)`
      );
    }

    engine.loadConfig(config);

    for (const moduleCfg of config.modules) {
      // Skip disabled modules
      if (moduleCfg.enabled === false) {
        continue;
      }

      // Warn/skip on unknown types
      if (!this.registry.has(moduleCfg.type)) {
        if (!this.strict) {
          console.warn(`ConfigLoader: unknown module type "${moduleCfg.type}", skipping.`);
        }
        continue;
      }

      const mod = this.registry.create(moduleCfg.type, moduleCfg.id, moduleCfg.params);
      engine.addModule(mod);
    }

    AutoWirer.wire(engine);

    // Validate module dependencies post-load (catches runtime-only issues)
    this.validateDependencies(engine);
  }

  private validateDependencies(engine: Engine): void {
    const moduleTypes = new Set(engine.getAllModules().map((m) => m.type));

    for (const mod of engine.getAllModules()) {
      const deps = mod.getDependencies();
      for (const req of deps.requires) {
        if (!moduleTypes.has(req)) {
          console.warn(
            `[ConfigLoader] Module "${mod.type}" (${mod.id}) requires "${req}" but it is not loaded. ` +
            `This module may not function correctly.`
          );
        }
      }
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
