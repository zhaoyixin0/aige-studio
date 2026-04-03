/**
 * M4 Phase 1: Type safety tests — verify `any` removal from core types.
 * These tests confirm that the type system correctly narrows unknown values.
 */
import { describe, it, expect } from 'vitest';
import type { EventHandler, SchemaField, ModuleConfig, GameModule } from '../types';

describe('M4 Phase 1 — core type safety', () => {
  describe('EventHandler', () => {
    it('accepts a callback with no parameter', () => {
      const handler: EventHandler = () => {};
      expect(typeof handler).toBe('function');
    });

    it('accepts a callback with unknown parameter', () => {
      const handler: EventHandler = (_data?: unknown) => {};
      expect(typeof handler).toBe('function');
    });

    it('handler data requires narrowing before use', () => {
      const handler: EventHandler = (data) => {
        // data is unknown — must narrow
        if (typeof data === 'object' && data !== null && 'x' in data) {
          expect((data as { x: number }).x).toBeDefined();
        }
      };
      handler({ x: 42 });
    });
  });

  describe('SchemaField.default', () => {
    it('default is unknown, requires narrowing', () => {
      const field: SchemaField = {
        type: 'range',
        label: 'Speed',
        default: 100,
      };
      // Must narrow before arithmetic
      const val = typeof field.default === 'number' ? field.default : 0;
      expect(val).toBe(100);
    });

    it('default can be boolean', () => {
      const field: SchemaField = {
        type: 'boolean',
        label: 'Enabled',
        default: true,
      };
      expect(field.default).toBe(true);
    });
  });

  describe('ModuleConfig.params', () => {
    it('params values are unknown, require narrowing', () => {
      const config: ModuleConfig = {
        id: 'test',
        type: 'Test',
        enabled: true,
        params: { speed: 200, active: true },
      };
      // Must narrow
      const speed = typeof config.params.speed === 'number' ? config.params.speed : 0;
      expect(speed).toBe(200);
    });
  });

  describe('GameModule interface', () => {
    it('configure accepts Record<string, unknown>', () => {
      // This test verifies the interface signature compiles
      const mockModule: Pick<GameModule, 'configure' | 'getParams'> = {
        configure: (_params: Record<string, unknown>) => {},
        getParams: () => ({ speed: 200 }),
      };
      mockModule.configure({ speed: 300 });
      expect(mockModule.getParams().speed).toBe(200);
    });
  });
});
