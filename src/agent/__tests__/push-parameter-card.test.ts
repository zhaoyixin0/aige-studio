import { describe, it, expect } from 'vitest';
import {
  TOOLS,
  type ConversationResult,
} from '../conversation-defs';
import { buildSystemPrompt } from '../conversation-agent';
import {
  PARAMETER_REGISTRY,
  type ParamCategory,
} from '@/data/parameter-registry';

/* ------------------------------------------------------------------ */
/*  1. TOOLS array includes push_parameter_card with correct schema    */
/* ------------------------------------------------------------------ */

describe('TOOLS includes push_parameter_card', () => {
  const tool = TOOLS.find((t) => t.name === 'push_parameter_card');

  it('exists in TOOLS array', () => {
    expect(tool).toBeDefined();
  });

  it('has correct input_schema with category (string) and param_ids (string[])', () => {
    expect(tool).toBeDefined();
    const schema = tool!.input_schema as Record<string, unknown>;
    expect(schema.type).toBe('object');

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.category).toEqual({ type: 'string', description: expect.any(String) });
    expect(props.param_ids).toEqual({
      type: 'array',
      items: { type: 'string' },
      description: expect.any(String),
    });
    expect(props.title).toBeDefined();
    expect(props.title.type).toBe('string');
  });

  it('requires category and param_ids', () => {
    expect(tool).toBeDefined();
    const schema = tool!.input_schema as Record<string, unknown>;
    expect(schema.required).toEqual(expect.arrayContaining(['category', 'param_ids']));
  });

  it('does not modify existing tool definitions', () => {
    const existingNames = ['create_game', 'modify_game', 'suggest_enhancements'];
    for (const name of existingNames) {
      expect(TOOLS.find((t) => t.name === name)).toBeDefined();
    }
    // Total tools: create_game, modify_game, suggest_enhancements, push_parameter_card, use_preset, push_expert_insight,
    // request_assets_generate, request_asset_replace, show_asset_previews
    expect(TOOLS.length).toBeGreaterThanOrEqual(9);
  });
});

/* ------------------------------------------------------------------ */
/*  2. ConversationResult type has optional parameterCard field         */
/* ------------------------------------------------------------------ */

describe('ConversationResult parameterCard field', () => {
  it('accepts parameterCard as optional typed payload', () => {
    const result: ConversationResult = {
      reply: 'test',
      parameterCard: {
        category: 'game_mechanics',
        paramIds: ['game_mechanics_001', 'game_mechanics_002'],
        title: 'Test Card',
      },
    };
    expect(result.parameterCard).toBeDefined();
    expect(result.parameterCard!.category).toBe('game_mechanics');
    expect(result.parameterCard!.paramIds).toEqual(['game_mechanics_001', 'game_mechanics_002']);
    expect(result.parameterCard!.title).toBe('Test Card');
  });

  it('allows ConversationResult without parameterCard', () => {
    const result: ConversationResult = { reply: 'hello' };
    expect(result.parameterCard).toBeUndefined();
  });

  it('allows parameterCard without optional title', () => {
    const result: ConversationResult = {
      reply: 'test',
      parameterCard: {
        category: 'visual_audio',
        paramIds: ['visual_audio_001'],
      },
    };
    expect(result.parameterCard!.title).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  3. parameterCard payload is typed — category/paramIds are strings   */
/* ------------------------------------------------------------------ */

describe('parameterCard payload typing', () => {
  it('category is a string, paramIds is string[]', () => {
    const card: ConversationResult['parameterCard'] = {
      category: 'game_mechanics',
      paramIds: ['game_mechanics_001'],
    };
    // TypeScript type safety — these are narrowly typed
    expect(typeof card!.category).toBe('string');
    expect(Array.isArray(card!.paramIds)).toBe(true);
    for (const id of card!.paramIds) {
      expect(typeof id).toBe('string');
    }
  });

  it('does not contain arbitrary HTML or rich content', () => {
    // parameterCard only has category, paramIds, title — no html/content/body fields
    const card: ConversationResult['parameterCard'] = {
      category: 'input',
      paramIds: ['game_mechanics_004'],
      title: 'Input Settings',
    };
    const keys = Object.keys(card!);
    expect(keys).toEqual(expect.arrayContaining(['category', 'paramIds', 'title']));
    // No extra fields like html, body, content
    expect(keys).not.toContain('html');
    expect(keys).not.toContain('body');
    expect(keys).not.toContain('content');
  });
});

/* ------------------------------------------------------------------ */
/*  4. System prompt includes Registry parameter IDs for grounding     */
/* ------------------------------------------------------------------ */

describe('system prompt includes parameter registry IDs', () => {
  it('contains parameter registry summary section', async () => {
    const prompt = await buildSystemPrompt(null, []);
    expect(prompt).toContain('参数注册表');
  });

  it('includes category names from the registry', async () => {
    const prompt = await buildSystemPrompt(null, []);
    // The registry has these categories
    const categories: ParamCategory[] = [
      'game_mechanics', 'visual_audio', 'game_objects', 'abstract', 'input',
    ];
    // At least some categories should appear in the prompt
    const foundCategories = categories.filter((c) => prompt.includes(c));
    expect(foundCategories.length).toBeGreaterThanOrEqual(3);
  });

  it('includes sample parameter IDs from the registry', async () => {
    const prompt = await buildSystemPrompt(null, []);
    // Should include at least some real param IDs so the LLM can reference them
    const sampleIds = PARAMETER_REGISTRY.slice(0, 5).map((p) => p.id);
    const foundIds = sampleIds.filter((id) => prompt.includes(id));
    expect(foundIds.length).toBeGreaterThanOrEqual(2);
  });
});
