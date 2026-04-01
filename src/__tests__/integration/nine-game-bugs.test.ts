import { describe, it, expect } from 'vitest';
import { getGamePreset } from '@/agent/game-presets';

// ── Step 1: catch/dodge/tap must have PlayerMovement (follow mode) ──

describe('Catch/Dodge/Tap collision fix — PlayerMovement follow mode', () => {
  for (const gameType of ['catch', 'dodge', 'tap'] as const) {
    describe(`${gameType} preset`, () => {
      const preset = getGamePreset(gameType)!;

      it('should include PlayerMovement module', () => {
        expect(preset['PlayerMovement']).toBeDefined();
      });

      it('should use follow mode', () => {
        expect((preset['PlayerMovement'] as any).mode).toBe('follow');
      });

      it('should provide playerPosition contract via follow mode', () => {
        expect((preset['PlayerMovement'] as any).followSpeed).toBeGreaterThan(0);
      });
    });
  }
});

// ── Step 2+8: Quiz must show question text, handle clicks, auto-start ──

describe('Quiz preset and QuizEngine', () => {
  const preset = getGamePreset('quiz')!;

  it('should have questions with text field', () => {
    const questions = (preset['QuizEngine'] as any).questions;
    for (const q of questions) {
      expect(q.text).toBeDefined();
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(0);
    }
  });
});

// ── Step 3: Rhythm preset should NOT have Spawner/Collision/PlayerMovement ──

describe('Rhythm preset — pure timing-based', () => {
  const preset = getGamePreset('rhythm')!;

  it('should have BeatMap module', () => {
    expect(preset['BeatMap']).toBeDefined();
  });

  it('should NOT have Spawner module', () => {
    expect(preset['Spawner']).toBeUndefined();
  });

  it('should NOT have Collision module', () => {
    expect(preset['Collision']).toBeUndefined();
  });

  it('should NOT have PlayerMovement module', () => {
    expect(preset['PlayerMovement']).toBeUndefined();
  });

  it('should wire Scorer to beat:hit event', () => {
    const scorer = preset['Scorer'] as any;
    expect(scorer.hitEvent).toBe('beat:hit');
  });
});

// ── Step 5: Random Wheel should have labels ──

describe('Random Wheel preset', () => {
  const preset = getGamePreset('random-wheel')!;

  it('should have items with labels', () => {
    const items = (preset['Randomizer'] as any).items;
    for (const item of items) {
      expect(item.label).toBeDefined();
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});

// ── Step 6: Expression preset should not have background asset ──

describe('Expression preset — no background', () => {
  const preset = getGamePreset('expression')!;

  it('should NOT have Spawner module', () => {
    expect(preset['Spawner']).toBeUndefined();
  });

  it('should NOT have Collision module', () => {
    expect(preset['Collision']).toBeUndefined();
  });
});

// ── Step 7: Asset agent sprite size should be configurable ──

describe('Asset agent sprite size', () => {
  it('extractAssetKeys should still return keys', async () => {
    const { extractAssetKeys } = await import('@/services/asset-agent');
    const config = {
      modules: [{ type: 'Spawner', id: 'spawner_1', params: { items: [{ asset: 'star' }] } }],
      assets: {},
      meta: { name: 'test' },
    } as any;
    const keys = extractAssetKeys(config);
    expect(keys).toContain('star');
  });
});
