import { describe, it, expect } from 'vitest';
import { ConversationAgent } from '../conversation-agent';
import type { GameConfig } from '@/engine/core';

function makeConfig(): GameConfig {
  return {
    version: '1.0.0',
    meta: { name: 'Test', description: '', thumbnail: null, createdAt: '' },
    canvas: { width: 1080, height: 1920 },
    modules: [
      { id: 'timer_1', type: 'Timer', enabled: true, params: { duration: 30 } },
    ],
    assets: {},
  };
}

describe('ConversationAgent modify re-validation', () => {
  it('applies validation fixes after applyChanges (e.g., clamp invalid Timer)', () => {
    const agent = new ConversationAgent(undefined);
    const cfg = makeConfig();

    // Intentionally set invalid Timer duration via modify change
    const updated = (agent as any).applyChanges(cfg, [
      { action: 'set_duration', duration: -5 },
    ]);

    // Validator should have auto-fixed to default 30
    const timer = updated.modules.find((m: { type: string }) => m.type === 'Timer')!;
    expect(timer.params.duration).toBe(30);

    // Validation report should be stored
    const report = agent.getLastValidationReport();
    expect(report).not.toBeNull();
    expect(report!.fixes.some((f) => f.param === 'duration')).toBe(true);
  });
});

