import type { ModuleContracts } from './contracts';
import type { ModuleRegistry } from './module-registry';

/**
 * Collects ModuleContracts from all registered module types.
 * Used by ConfigValidator to derive validation data at runtime
 * instead of relying on hardcoded maps.
 */
export class ContractRegistry {
  private entries = new Map<string, ModuleContracts>();

  private constructor() {}

  /** Populate from a ModuleRegistry by instantiating each module with default params */
  static fromRegistry(registry: ModuleRegistry): ContractRegistry {
    const cr = new ContractRegistry();
    for (const type of registry.getTypes()) {
      try {
        const mod = registry.create(type, `__contract_probe_${type}`, {});
        cr.entries.set(type, mod.getContracts());
        mod.destroy();
      } catch {
        // Module failed to instantiate with empty params — record empty contracts
        cr.entries.set(type, {});
      }
    }
    return cr;
  }

  /** Get contracts for a specific module type */
  getContracts(moduleType: string): ModuleContracts {
    return this.entries.get(moduleType) ?? {};
  }

  /** Get all known module types */
  getKnownTypes(): ReadonlySet<string> {
    return new Set(this.entries.keys());
  }

  /** Get emits for a specific module type */
  getEmits(moduleType: string): readonly string[] {
    return this.entries.get(moduleType)?.emits ?? [];
  }

  /** Get consumes for a specific module type */
  getConsumes(moduleType: string): readonly string[] {
    return this.entries.get(moduleType)?.consumes ?? [];
  }

  /** Aggregate all emitted events from all modules */
  getAllEmittedEvents(): ReadonlySet<string> {
    const all = new Set<string>();
    for (const contracts of this.entries.values()) {
      if (contracts.emits) {
        for (const event of contracts.emits) {
          all.add(event);
        }
      }
    }
    return all;
  }
}
