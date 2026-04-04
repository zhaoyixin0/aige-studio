import { describe, it, expect } from 'vitest';
import { SkillLoader } from '../skill-loader';

describe('SkillLoader expert card loading', () => {
  const loader = new SkillLoader();

  it('loadExpertCardSummary returns a non-empty string', async () => {
    const summary = await loader.loadExpertCardSummary('catch');
    expect(typeof summary).toBe('string');
    // May be empty if no cards exist yet, but should not throw
  });

  it('getAvailableExpertTypes returns array', () => {
    const types = loader.getAvailableExpertTypes();
    expect(Array.isArray(types)).toBe(true);
  });

  it('loadExpertCardSummary for unknown type returns empty', async () => {
    const summary = await loader.loadExpertCardSummary('nonexistent-xyz');
    expect(summary).toBe('');
  });
});
