import { describe, it, expect } from 'vitest';
import type { Chip } from '../conversation-defs';

/**
 * Tests for V2 creation chips behavior:
 * A2/A5: generateV2CreationChips returns board_mode + param chips
 * A10:  After create_game, chips have type 'board_mode' and type 'param'
 * A8:   processWithoutApi chips have type 'game_type'
 */
describe('generateV2CreationChips', () => {
  it('should return 4 chips: 1 board_mode + 3 param chips', async () => {
    const { generateV2CreationChips } = await import('../conversation-agent');
    const chips = generateV2CreationChips('catch');
    expect(chips).toHaveLength(4);
  });

  it('should have board_mode chip first', async () => {
    const { generateV2CreationChips } = await import('../conversation-agent');
    const chips = generateV2CreationChips('catch');
    const boardChip = chips[0];
    expect(boardChip.id).toBe('board_mode');
    expect(boardChip.type).toBe('board_mode');
    expect(boardChip.label).toBe('GUI 面板');
  });

  it('should have 3 param chips with paramId and category', async () => {
    const { generateV2CreationChips } = await import('../conversation-agent');
    const chips = generateV2CreationChips('catch');
    const paramChips = chips.filter((c: Chip) => c.type === 'param');
    expect(paramChips).toHaveLength(3);

    for (const chip of paramChips) {
      expect(chip.paramId).toBeTruthy();
      expect(chip.category).toBe('abstract');
    }
  });

  it('should include difficulty, pacing, and emotion param chips', async () => {
    const { generateV2CreationChips } = await import('../conversation-agent');
    const chips = generateV2CreationChips('shooting');
    const paramChips = chips.filter((c: Chip) => c.type === 'param');

    const ids = paramChips.map((c: Chip) => c.id);
    expect(ids).toContain('l1-difficulty');
    expect(ids).toContain('l1-pacing');
    expect(ids).toContain('l1-emotion');
  });

  it('should have emoji on all chips', async () => {
    const { generateV2CreationChips } = await import('../conversation-agent');
    const chips = generateV2CreationChips('platformer');
    for (const chip of chips) {
      expect(chip.emoji).toBeTruthy();
    }
  });
});

describe('A10: After create_game, use V2 chips', () => {
  it('should return V2 chips (board_mode + param) after create_game, not old suggestions', async () => {
    // Mock the Anthropic client to return a create_game tool_use response
    const { ConversationAgent } = await import('../conversation-agent');

    // Use processWithoutApi path with a detected game type to trigger buildGameConfig
    // We test the no-API path which also calls generateSuggestions after create_game
    const agent = new ConversationAgent(); // no API key → processWithoutApi
    const result = await agent.process('做一个接住游戏');

    // After create_game, chips should be V2 format
    expect(result.chips).toBeDefined();
    const chips = result.chips!;

    // Should have board_mode chip
    const boardChips = chips.filter((c: Chip) => c.type === 'board_mode');
    expect(boardChips).toHaveLength(1);

    // Should have param chips
    const paramChips = chips.filter((c: Chip) => c.type === 'param');
    expect(paramChips).toHaveLength(3);

    // Should NOT have old-style add:/theme:/style: chips
    const oldChips = chips.filter((c: Chip) =>
      c.id.startsWith('add:') || c.id.startsWith('theme:') || c.id.startsWith('style:'),
    );
    expect(oldChips).toHaveLength(0);
  });
});

describe('A8: processWithoutApi game type chips', () => {
  it('should return chips with type "game_type" when no game type detected', async () => {
    const { ConversationAgent } = await import('../conversation-agent');
    const agent = new ConversationAgent(); // no API key
    const result = await agent.process('做个游戏吧');

    expect(result.chips).toBeDefined();
    const chips = result.chips!;

    // All chips should have type: 'game_type'
    for (const chip of chips) {
      expect(chip.type).toBe('game_type');
    }

    // Verify id format uses game type directly, not 'type:xxx' prefix
    const ids = chips.map((c: Chip) => c.id);
    // None should have 'type:' prefix
    for (const id of ids) {
      expect(id).not.toMatch(/^type:/);
    }

    // Should include known game types
    expect(ids).toContain('catch');
    expect(ids).toContain('dodge');
    expect(ids).toContain('platformer');
  });
});
