import { describe, it, expect } from 'vitest';
import { createModuleRegistry } from '@/engine/module-setup';
import {
  PHYSICS2D_CONTACT_BEGIN,
  PHYSICS2D_CONTACT_END,
  PHYSICS2D_ADD_BODY,
  PHYSICS2D_REMOVE_BODY,
} from '@/engine/core/events';

describe('Physics2D Registration & Events', () => {
  it('Physics2D module is registered', () => {
    const registry = createModuleRegistry();
    expect(registry.has('Physics2D')).toBe(true);
  });

  it('Physics2D can be instantiated from registry', () => {
    const registry = createModuleRegistry();
    const mod = registry.create('Physics2D', 'physics2d_test', {});
    expect(mod).toBeDefined();
    expect(mod!.type).toBe('Physics2D');
  });

  it('event constants are defined', () => {
    expect(PHYSICS2D_CONTACT_BEGIN).toBe('physics2d:contact-begin');
    expect(PHYSICS2D_CONTACT_END).toBe('physics2d:contact-end');
    expect(PHYSICS2D_ADD_BODY).toBe('physics2d:add-body');
    expect(PHYSICS2D_REMOVE_BODY).toBe('physics2d:remove-body');
  });
});
