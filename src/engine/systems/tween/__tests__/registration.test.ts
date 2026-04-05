import { describe, it, expect } from 'vitest';
import { createModuleRegistry } from '@/engine/module-setup';
import {
  TWEEN_START, TWEEN_COMPLETE, TWEEN_UPDATE, TWEEN_TRIGGER,
} from '@/engine/core/events';

describe('Tween Registration & Events', () => {
  it('Tween module is registered in module registry', () => {
    const registry = createModuleRegistry();
    expect(registry.has('Tween')).toBe(true);
  });

  it('Tween module can be instantiated from registry', () => {
    const registry = createModuleRegistry();
    const mod = registry.create('Tween', 'tween_test', {});
    expect(mod).toBeDefined();
    expect(mod!.type).toBe('Tween');
  });

  it('event constants are defined', () => {
    expect(TWEEN_START).toBe('tween:start');
    expect(TWEEN_COMPLETE).toBe('tween:complete');
    expect(TWEEN_UPDATE).toBe('tween:update');
    expect(TWEEN_TRIGGER).toBe('tween:trigger');
  });
});
