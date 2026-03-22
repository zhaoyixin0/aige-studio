import type { GameModule } from './types';

export type ModuleConstructor = new (id: string, params: Record<string, any>) => GameModule;

export class ModuleRegistry {
  private registry = new Map<string, ModuleConstructor>();

  register(type: string, constructor: ModuleConstructor): void {
    this.registry.set(type, constructor);
  }

  create(type: string, id: string, params: Record<string, any> = {}): GameModule {
    const Ctor = this.registry.get(type);
    if (!Ctor) {
      throw new Error(`Unknown module type: "${type}"`);
    }
    return new Ctor(id, params);
  }

  has(type: string): boolean {
    return this.registry.has(type);
  }

  getTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}
