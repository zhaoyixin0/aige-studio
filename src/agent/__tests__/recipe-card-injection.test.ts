import { describe, it, expect } from 'vitest';
import { SkillLoader } from '../skill-loader';
import { buildSystemPrompt } from '../conversation-agent';

describe('loadRecipeCardSummaries', () => {
  const loader = new SkillLoader();

  it('returns ≤ 3 lines for a matching game type', async () => {
    const lines = await loader.loadRecipeCardSummaries('slingshot');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it('each line is ≤ 140 chars', async () => {
    const lines = await loader.loadRecipeCardSummaries('slingshot');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(140);
    }
  });

  it('returns empty array for unmatched game type', async () => {
    const lines = await loader.loadRecipeCardSummaries('zzz-nonexistent-type');
    expect(lines).toEqual([]);
  });

  it('respects limit parameter', async () => {
    const lines = await loader.loadRecipeCardSummaries('game', 1);
    expect(lines.length).toBeLessThanOrEqual(1);
  });

  it('result is deterministic (same input → same output)', async () => {
    const a = await loader.loadRecipeCardSummaries('bounce');
    const b = await loader.loadRecipeCardSummaries('bounce');
    expect(a).toEqual(b);
  });
});

describe('buildSystemPrompt recipe injection', () => {
  it('includes recipe block when game type has matching recipes', async () => {
    const prompt = await buildSystemPrompt('slingshot', []);
    expect(prompt).toContain('相关配方参考');
  });

  it('does not include recipe block when game type is null', async () => {
    const prompt = await buildSystemPrompt(null, []);
    expect(prompt).not.toContain('相关配方参考');
  });

  it('does not include recipe block for unmatched type', async () => {
    const prompt = await buildSystemPrompt('zzz-nonexistent', []);
    expect(prompt).not.toContain('相关配方参考');
  });
});
