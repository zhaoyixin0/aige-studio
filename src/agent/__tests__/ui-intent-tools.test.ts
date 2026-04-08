import { describe, it, expect } from 'vitest';
import { TOOLS } from '../conversation-defs';

describe('UI-intent tool definitions', () => {
  const toolNames = TOOLS.map((t) => t.name);

  it('should include request_assets_generate tool', () => {
    expect(toolNames).toContain('request_assets_generate');
    const tool = TOOLS.find((t) => t.name === 'request_assets_generate');
    expect(tool).toBeDefined();
    expect(tool!.input_schema).toBeDefined();
  });

  it('should include request_asset_replace tool', () => {
    expect(toolNames).toContain('request_asset_replace');
    const tool = TOOLS.find((t) => t.name === 'request_asset_replace');
    expect(tool).toBeDefined();
    const schema = tool!.input_schema as any;
    expect(schema.required).toContain('target');
  });

  it('should include show_asset_previews tool', () => {
    expect(toolNames).toContain('show_asset_previews');
    const tool = TOOLS.find((t) => t.name === 'show_asset_previews');
    expect(tool).toBeDefined();
    const schema = tool!.input_schema as any;
    expect(schema.required).toContain('items');
  });
});
