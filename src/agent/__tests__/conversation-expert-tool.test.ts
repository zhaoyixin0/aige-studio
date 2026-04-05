import { describe, it, expect } from 'vitest';
import { TOOLS } from '../conversation-defs';

describe('push_expert_insight tool', () => {
  it('is present in TOOLS array', () => {
    const tool = TOOLS.find((t) => t.name === 'push_expert_insight');
    expect(tool).toBeDefined();
  });

  it('has correct required fields in schema', () => {
    const tool = TOOLS.find((t) => t.name === 'push_expert_insight')!;
    const schema = tool.input_schema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toContain('title');
    expect(schema.properties).toHaveProperty('title');
    expect(schema.properties).toHaveProperty('body');
    expect(schema.properties).toHaveProperty('modules');
  });

  it('modules schema has correct nested structure', () => {
    const tool = TOOLS.find((t) => t.name === 'push_expert_insight')!;
    const schema = tool.input_schema as {
      properties: Record<string, { type: string; items?: { required?: string[] } }>;
    };
    const modules = schema.properties.modules;
    expect(modules.type).toBe('array');
    expect(modules.items?.required).toContain('name');
    expect(modules.items?.required).toContain('params');
  });
});
