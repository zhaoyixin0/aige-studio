import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT_BASE } from '../conversation-defs.ts';
import { EXPERT_PRESETS } from '@/engine/systems/recipe-runner/index.ts';

describe('Expert preset system prompt', () => {
  it('system prompt mentions expert presets when available', () => {
    if (EXPERT_PRESETS.length === 0) return;
    expect(SYSTEM_PROMPT_BASE).toContain('专家模板');
    expect(SYSTEM_PROMPT_BASE).toContain('expert-import');
  });

  it('EXPERT_PRESETS are all tagged with expert-import', () => {
    for (const preset of EXPERT_PRESETS) {
      expect(preset.tags).toContain('expert-import');
    }
  });

  it('system prompt includes expert preset count', () => {
    if (EXPERT_PRESETS.length === 0) return;
    // Should mention the number of expert presets
    expect(SYSTEM_PROMPT_BASE).toMatch(/\d+.*专家/);
  });
});
