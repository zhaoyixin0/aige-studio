// src/services/prompt-builder.ts
//
// Generates optimized prompts for Gemini Imagen / Nano Banana image generation.
//
// Sprite prompts use chroma-key green (#00FF00) backgrounds for clean removal.
// Key technique: green background + clean sharp edges (no outline) for reliable chroma-key removal.
// Reference: https://roboticape.com/2026/03/07/generating-game-sprites-with-gemini-image-generation-nano-banana-pro-lessons-learned/

export interface PromptContext {
  gameType: string;
  theme: string;
  role: 'good' | 'bad' | 'player' | 'bullet' | 'background';
  style: string;
}

const THEME_AESTHETICS: Record<string, string> = {
  fruit: 'colorful, juicy, fresh produce market style',
  space: 'sci-fi, cosmic, neon glow, dark starfield',
  ocean: 'underwater, blue-green, coral reef, marine life',
  halloween: 'spooky, orange-purple, gothic, playful horror',
  candy: 'pastel, sweet, bubblegum pink, sugar-coated',
};

const ITEM_DESCRIPTIONS: Record<string, string> = {
  star: 'a shining star',
  apple: 'a ripe apple',
  coin: 'a golden coin',
  bomb: 'a round bomb with fuse',
  meteor: 'a flaming meteor',
  heart: 'a red heart',
  ghost: 'a cute ghost',
  diamond: 'a sparkling diamond',
  gift: 'a wrapped gift box',
  rocket: 'a small rocket',
  obstacle: 'a rocky obstacle',
  target_normal: 'a bullseye target',
  target_gold: 'a golden bullseye target',
  target_small: 'a small target',
  bubble_red: 'a red bubble',
  bubble_blue: 'a blue bubble',
  bubble_gold: 'a golden shiny bubble',
};

const THEMED_ITEM_DESCRIPTIONS: Record<string, Record<string, string>> = {
  fruit: {
    star: 'a ripe strawberry',
    apple: 'a juicy orange',
    coin: 'a fresh banana',
    bomb: 'a rotten tomato',
    meteor: 'a moldy avocado',
    player: 'a woven fruit basket',
    background: 'a colorful fruit market stall with crates of fresh produce',
  },
  space: {
    star: 'a glowing energy crystal',
    apple: 'a small alien artifact',
    coin: 'a spinning space token',
    bomb: 'a spiky asteroid',
    meteor: 'a fiery comet with glowing tail',
    player: 'a sleek spaceship',
    background: 'deep space with nebulae, distant galaxies and stars',
  },
  ocean: {
    star: 'a beautiful seashell',
    apple: 'a colorful tropical fish',
    coin: 'a shiny pearl',
    bomb: 'a spiky sea urchin',
    meteor: 'a sinking anchor',
    player: 'a cute cartoon fish',
    background: 'an underwater coral reef with sunlight streaming through water',
  },
  halloween: {
    star: 'a glowing candy corn',
    apple: 'a wrapped halloween candy',
    coin: 'a golden pumpkin coin',
    bomb: 'a spooky ghost',
    meteor: 'a flying witch on broomstick',
    player: 'a cute jack-o-lantern',
    background: 'a spooky graveyard under a full moon with bats',
  },
  candy: {
    star: 'a swirl lollipop',
    apple: 'a frosted cupcake',
    coin: 'a chocolate gold coin',
    bomb: 'a sour gummy bear',
    meteor: 'a jawbreaker candy ball',
    player: 'a candy robot character',
    background: 'a candy land with lollipop trees and chocolate rivers',
  },
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  cartoon: 'cartoon style, bold black outlines, vibrant saturated colors, 2D cel-shaded, clean vector look',
  pixel: 'pixel art style, 32x32 resolution look, retro 8-bit aesthetic, limited color palette, crisp pixel edges',
  flat: 'flat design, zero shadows, clean geometric shapes, solid color fills, material design inspired',
  realistic: 'semi-realistic 3D rendered look, soft studio lighting, detailed textures, subtle reflections',
  watercolor: 'watercolor painting style, soft blended edges, translucent color washes, visible brush strokes, paper texture feel',
  chibi: 'chibi / super-deformed style, oversized round head, tiny body, huge cute eyes, kawaii aesthetic, pastel tones',
};

// ── Sprite prompt (chroma-key green background) ────────────
const SPRITE_PROMPT_TEMPLATE = `\
Generate a single game sprite icon of {ITEM_DESCRIPTION}.
{ROLE_HINT}
Art style: {STYLE}.
Theme aesthetic: {AESTHETIC}.

CRITICAL BACKGROUND REQUIREMENT: The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00. \
NO gradients, NO noise, NO texture, NO shadows, NO reflections on the background. \
The background must be PURE UNIFORM #00FF00 green with absolutely NOTHING else.

CRITICAL SPRITE REQUIREMENT: The sprite must have clean, sharp edges directly against the green background. \
Do NOT add any outline or border around the sprite. \
Do NOT use any green (#00FF00) color anywhere inside the sprite itself.

Composition: single object, centered on canvas, facing the camera, occupying roughly 70-80% of the canvas area. \
No text, no labels, no watermarks, no additional objects.`;

// ── Player sprite prompt ───────────────────────────────────
const PLAYER_PROMPT_TEMPLATE = `\
Generate a game player character sprite: {ITEM_DESCRIPTION}.
This is the main playable character — it should look friendly, expressive, and heroic.
Art style: {STYLE}.
Theme aesthetic: {AESTHETIC}.

CRITICAL BACKGROUND REQUIREMENT: The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00. \
NO gradients, NO noise, NO texture, NO shadows on the background. \
Pure uniform #00FF00 green everywhere except the character.

CRITICAL SPRITE REQUIREMENT: The character must have clean, sharp edges directly against the green background. \
Do NOT add any outline or border around the character. \
Do NOT use any green (#00FF00) color on the character itself.

Composition: single character, centered, front-facing, occupying roughly 60-70% of canvas. \
No text, no UI, no accessories floating separately.`;

// ── Background prompt ──────────────────────────────────────
const BACKGROUND_PROMPT_TEMPLATE = `\
Generate a game background illustration in portrait orientation (9:16 aspect ratio, like a mobile phone screen).
Scene: {ITEM_DESCRIPTION}.
Theme aesthetic: {AESTHETIC}.
Art style: {STYLE}.

Requirements: immersive game world, rich details, vibrant colors appropriate to the theme. \
No text, no characters, no UI elements, no HUD overlays. \
The scene should feel like a seamless game environment that a player character would move through. \
Fill the entire canvas — no borders, no letterboxing.`;

export class PromptBuilder {
  static build(assetKey: string, ctx: PromptContext): string {
    const themedDescs = THEMED_ITEM_DESCRIPTIONS[ctx.theme];
    const itemDesc = themedDescs?.[assetKey] ?? ITEM_DESCRIPTIONS[assetKey] ?? assetKey;
    const aesthetic = THEME_AESTHETICS[ctx.theme] ?? 'game-themed';
    const styleInst = STYLE_INSTRUCTIONS[ctx.style] ?? STYLE_INSTRUCTIONS.cartoon;

    if (ctx.role === 'background') {
      return BACKGROUND_PROMPT_TEMPLATE
        .replace('{ITEM_DESCRIPTION}', itemDesc)
        .replace('{AESTHETIC}', aesthetic)
        .replace('{STYLE}', styleInst);
    }

    if (ctx.role === 'player') {
      return PLAYER_PROMPT_TEMPLATE
        .replace('{ITEM_DESCRIPTION}', itemDesc)
        .replace('{AESTHETIC}', aesthetic)
        .replace('{STYLE}', styleInst);
    }

    const roleHint = {
      good: 'This is a POSITIVE collectible item the player wants to catch. It should look appealing and rewarding.',
      bad: 'This is a DANGEROUS obstacle the player must avoid. It should look menacing or harmful.',
      bullet: 'This is a small fast-moving projectile. It should look energetic and dynamic.',
    }[ctx.role] ?? '';

    return SPRITE_PROMPT_TEMPLATE
      .replace('{ITEM_DESCRIPTION}', itemDesc)
      .replace('{ROLE_HINT}', roleHint)
      .replace('{AESTHETIC}', aesthetic)
      .replace('{STYLE}', styleInst);
  }

  /** Determine role of an asset key based on naming conventions */
  static inferRole(assetKey: string): PromptContext['role'] {
    const badKeys = ['bomb', 'meteor', 'ghost', 'obstacle', 'enemy'];
    const playerKeys = ['player', 'character', 'hero', 'avatar'];
    const bgKeys = ['sky', 'space_bg', 'ocean_bg', 'background'];
    const bulletKeys = ['bullet', 'projectile', 'shot'];

    if (badKeys.some(k => assetKey.includes(k))) return 'bad';
    if (playerKeys.some(k => assetKey.includes(k))) return 'player';
    if (bgKeys.some(k => assetKey.includes(k))) return 'background';
    if (bulletKeys.some(k => assetKey.includes(k))) return 'bullet';
    return 'good';
  }
}
