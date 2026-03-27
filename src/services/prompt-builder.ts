// src/services/prompt-builder.ts
//
// Generates high-quality prompts for Nano Banana Pro (gemini-3-pro-image-preview).
//
// Based on research: roboticape.com lessons learned, Google AI docs, sprite-forge patterns.
// Key techniques:
//   - Chroma-key #00FF00 green background with 2-3px white outline buffer
//   - Detailed style descriptors for cross-asset consistency
//   - Mobile readability hints (readable at NxN pixels)
//   - Role-specific emotional cues (appealing vs menacing)
//   - Native 9:16 aspect ratio for backgrounds (API parameter)

export interface PromptContext {
  gameType: string;
  theme: string;
  role: 'good' | 'bad' | 'player' | 'bullet' | 'background';
  style: string;
  assetDescriptions?: Record<string, string>;
}

export interface ImageConfig {
  aspectRatio: string;
  imageSize: string;
}

// ── Detailed style descriptors ───────────────────────────────
const STYLE_INSTRUCTIONS: Record<string, string> = {
  cartoon:
    '2D cartoon style with bold black outlines (2-3px), vibrant saturated flat colors, ' +
    'cel-shaded shading with one shadow tone per color, clean vector-art look, ' +
    'smooth curves, exaggerated proportions for appeal',
  pixel:
    'pixel art style with crisp square pixels, retro 8-bit aesthetic, ' +
    'limited 16-color palette per sprite, no anti-aliasing on edges, ' +
    'visible pixel grid, dithering for gradients, NES/SNES era charm',
  flat:
    'flat design minimalist style with solid color fills, zero shadows, ' +
    'clean geometric shapes, material design inspired, thin hairline borders, ' +
    'modern UI aesthetic, limited to 4-5 colors per asset',
  realistic:
    'semi-realistic 3D rendered look with soft diffused studio lighting, ' +
    'detailed PBR textures, subtle specular reflections, ambient occlusion, ' +
    'physically accurate proportions, matte finish',
  watercolor:
    'watercolor painting style with soft blended wet edges, ' +
    'translucent color washes layered for depth, visible brush stroke texture, ' +
    'warm paper-tone background bleed, muted pastel palette with occasional vivid accent',
  chibi:
    'chibi / super-deformed style with oversized round head (2:1 head-to-body ratio), ' +
    'tiny stubby limbs, huge sparkly eyes, kawaii aesthetic, ' +
    'pastel soft tones with pink accents, rounded everything, maximum cuteness',
};

// ── Enhanced theme aesthetics ────────────────────────────────
const THEME_AESTHETICS: Record<string, string> = {
  fruit:
    'colorful farmer\'s market vibe, warm sunlight, juicy textures, ' +
    'fresh dewdrops, woven basket and wooden crate props, green leaf accents',
  space:
    'deep cosmic void with vibrant nebula colors, cool blue-purple starfield, ' +
    'neon cyan and magenta energy glows, metallic chrome surfaces, holographic accents',
  ocean:
    'underwater coral reef paradise, dappled sunlight rays through clear water, ' +
    'blue-green color grading, bioluminescent accents, gentle current motion feel',
  halloween:
    'spooky but playful halloween night, orange jack-o-lantern glow against purple-black sky, ' +
    'gothic silhouettes, cobwebs and bats, candy-bright accent colors',
  candy:
    'sugary candy land fantasy, pastel rainbow palette, glossy sugar-coated surfaces, ' +
    'sprinkle textures, bubblegum pink dominant, cotton candy clouds',
};

// ── Item descriptions (generic + themed) ─────────────────────
const ITEM_DESCRIPTIONS: Record<string, string> = {
  good_1: 'a collectible game item',
  good_2: 'a bonus collectible item',
  good_3: 'a special reward item',
  bad_1: 'a dangerous obstacle',
  bad_2: 'a harmful hazard',
  star: 'a shining golden star',
  apple: 'a ripe red apple',
  coin: 'a golden coin with embossed design',
  bomb: 'a round ticking bomb with lit fuse',
  meteor: 'a flaming meteor with glowing trail',
  heart: 'a red heart health icon',
  ghost: 'a floating spooky ghost',
  diamond: 'a sparkling faceted diamond',
  gift: 'a wrapped gift box with ribbon',
  rocket: 'a small rocket with flame exhaust',
  obstacle: 'a rocky jagged obstacle',
  target_normal: 'a bullseye target',
  target_gold: 'a golden bullseye target',
  target_small: 'a small compact target',
  bubble_red: 'a red bubble',
  bubble_blue: 'a blue bubble',
  bubble_gold: 'a golden shiny bubble',
  bullet: 'a glowing energy projectile bolt',
  projectile: 'a fast-moving energy projectile',
  shot: 'a small bright projectile',
};

const THEMED_ITEM_DESCRIPTIONS: Record<string, Record<string, string>> = {
  fruit: {
    good_1: 'a ripe juicy strawberry with dewdrops',
    good_2: 'a fresh peeled orange segment',
    good_3: 'a golden banana with sparkle',
    bad_1: 'a rotten splotchy tomato',
    bad_2: 'a moldy bruised avocado',
    player: 'a woven fruit basket with handle',
    background: 'a colorful outdoor fruit market stall with crates of fresh produce under warm sunlight',
  },
  space: {
    good_1: 'a glowing faceted energy crystal with inner light',
    good_2: 'a small alien artifact with holographic markings',
    good_3: 'a spinning space credit token',
    bad_1: 'a spiky tumbling asteroid with craters',
    bad_2: 'a fiery comet with blazing tail',
    player: 'a sleek streamlined spaceship with glowing engines',
    bullet: 'a bright plasma bolt with cyan energy trail',
    background: 'deep space with colorful nebulae, distant spiral galaxies, and scattered stars',
  },
  ocean: {
    good_1: 'a beautiful iridescent seashell',
    good_2: 'a colorful tropical clownfish',
    good_3: 'a luminous pearl in an open oyster',
    bad_1: 'a spiky venomous sea urchin',
    bad_2: 'a heavy sinking iron anchor',
    player: 'a cute cartoon tropical fish with big expressive eyes',
    background: 'an underwater coral reef with sunlight streaming through crystal-clear water',
  },
  halloween: {
    good_1: 'a glowing candy corn with sparkle',
    good_2: 'a wrapped halloween candy in orange wrapper',
    good_3: 'a golden pumpkin coin',
    bad_1: 'a translucent spooky ghost with glowing eyes',
    bad_2: 'a flying witch silhouette on broomstick',
    player: 'a cute carved jack-o-lantern with friendly grin',
    background: 'a spooky graveyard under an enormous full moon with flying bats and twisted trees',
  },
  candy: {
    good_1: 'a rainbow swirl lollipop on a white stick',
    good_2: 'a frosted cupcake with cherry on top',
    good_3: 'a gold-wrapped chocolate coin',
    bad_1: 'a sour gummy bear with angry face',
    bad_2: 'a hard jawbreaker candy ball',
    player: 'a cute candy robot character with gumdrop buttons',
    background: 'a candy land with lollipop trees, chocolate river, and cotton candy clouds',
  },
};

// ── Shared prompt blocks ─────────────────────────────────────

const CHROMA_KEY_BLOCK = `
CRITICAL BACKGROUND REQUIREMENT:
The ENTIRE background MUST be solid flat chroma-key green, EXACT hex color #00FF00 (RGB 0,255,0).
NO gradients, NO noise, NO texture, NO shadows, NO reflections on the background.
Every single background pixel must be PURE UNIFORM #00FF00 green.

CRITICAL EDGE REQUIREMENT:
Add a clean white outline border (2-3 pixels wide) around the entire sprite silhouette.
This white border acts as an anti-aliasing buffer zone between the sprite and the green background.
The sprite must have clean, sharp edges against this white border.

CRITICAL COLOR REQUIREMENT:
Do NOT use any pure #00FF00 green anywhere inside the sprite itself.
If the subject has green elements, use dark green (#006400) or lime (#32CD32) instead of #00FF00.`.trim();

const CONSISTENCY_BLOCK =
  'This asset is part of a cohesive set of mobile game sprites. ' +
  'All assets in this set share the same art style, line weight, color saturation level, and rendering technique. ' +
  'Maintain visual harmony with other assets in the set.';

const EXCLUSION_BLOCK = 'No text, no labels, no watermarks, no logos, no additional objects.';

// ── Template builders ────────────────────────────────────────

function buildSpritePrompt(
  itemDesc: string,
  roleHint: string,
  style: string,
  aesthetic: string,
  gameType: string,
): string {
  return `Generate a single game sprite icon of ${itemDesc}.
This is a sprite asset for a ${gameType} mobile game.
${roleHint}
Art style: ${style}.
Theme aesthetic: ${aesthetic}.

${CONSISTENCY_BLOCK}

${CHROMA_KEY_BLOCK}

Composition: single object, centered on canvas, facing the camera with slight 3/4 angle for depth,
occupying roughly 70-80% of the canvas area, fully visible within frame with no cropping.
The design must remain clearly readable and recognizable when scaled down to 48x48 pixels on a mobile screen.
${EXCLUSION_BLOCK}`;
}

function buildPlayerPrompt(
  itemDesc: string,
  style: string,
  aesthetic: string,
  gameType: string,
): string {
  return `Generate a game player character sprite: ${itemDesc}.
This is the main playable character for a ${gameType} mobile game.
The character should look friendly, expressive, and heroic with an inviting personality.
Art style: ${style}.
Theme aesthetic: ${aesthetic}.

${CONSISTENCY_BLOCK}

${CHROMA_KEY_BLOCK}

Composition: single character, centered on canvas, front-facing or slight 3/4 angle,
occupying roughly 60-70% of the canvas height, fully visible within frame with no cropping.
Character should be in a neutral idle pose, standing, arms slightly away from body.
The design must remain readable and recognizable when scaled down to 64x64 pixels on a mobile screen.
No text, no UI elements, no floating accessories, no duplicate characters.`;
}

function buildBulletPrompt(
  itemDesc: string,
  style: string,
  aesthetic: string,
  gameType: string,
): string {
  return `Generate a single game projectile sprite: ${itemDesc}.
This is a fast-moving projectile for a ${gameType} mobile game.
It should look energetic, dynamic, and powerful with implied forward momentum.
Art style: ${style}.
Theme aesthetic: ${aesthetic}.

${CONSISTENCY_BLOCK}

${CHROMA_KEY_BLOCK}

Composition: single projectile, centered, horizontally oriented (flying right),
occupying roughly 60-70% of canvas width, slightly elongated to suggest speed.
Add a subtle motion trail or energy glow behind the projectile.
Must read clearly at 32x32 pixels on a mobile screen.
${EXCLUSION_BLOCK}`;
}

function buildBackgroundPrompt(
  itemDesc: string,
  style: string,
  aesthetic: string,
  gameType: string,
): string {
  return `Generate a game background illustration for a ${gameType} mobile game.
The image MUST be in portrait orientation (9:16 aspect ratio, like a mobile phone screen held vertically).
Scene: ${itemDesc}.
Theme aesthetic: ${aesthetic}.
Art style: ${style}.

${CONSISTENCY_BLOCK.replace('sprites', 'visual set')}

COMPOSITION REQUIREMENTS:
Fill the ENTIRE canvas edge to edge — no borders, no letterboxing, no margins.
Create depth with distinct foreground, midground, and background layers for potential parallax scrolling.
The scene should feel like an immersive game world that a player character moves through.
Leave the central area relatively uncluttered for gameplay visibility.

COLOR AND MOOD:
Vibrant colors appropriate to the theme, but not so bright that game sprites become invisible.
The overall brightness should be moderate to ensure sprite visibility when overlaid.

EXCLUSIONS:
No text, no characters, no NPCs, no UI elements, no HUD overlays, no buttons, no logos, no watermarks.`;
}

// ── Public API ───────────────────────────────────────────────

export class PromptBuilder {
  static build(assetKey: string, ctx: PromptContext): string {
    // Priority: custom LLM descriptions > preset theme descriptions > generic descriptions
    const customDesc = ctx.assetDescriptions?.[assetKey];
    const themedDescs = THEMED_ITEM_DESCRIPTIONS[ctx.theme];
    const itemDesc = customDesc ?? themedDescs?.[assetKey] ?? ITEM_DESCRIPTIONS[assetKey] ?? assetKey;

    // For custom themes (not in preset), use the theme name as the aesthetic description
    const aesthetic = THEME_AESTHETICS[ctx.theme]
      ?? `${ctx.theme} themed environment, ${ctx.theme}-inspired visual elements, vibrant and engaging`;
    const styleInst = STYLE_INSTRUCTIONS[ctx.style] ?? STYLE_INSTRUCTIONS.cartoon;

    if (ctx.role === 'background') {
      return buildBackgroundPrompt(itemDesc, styleInst, aesthetic, ctx.gameType);
    }

    if (ctx.role === 'player') {
      return buildPlayerPrompt(itemDesc, styleInst, aesthetic, ctx.gameType);
    }

    if (ctx.role === 'bullet') {
      return buildBulletPrompt(itemDesc, styleInst, aesthetic, ctx.gameType);
    }

    const roleHint = ctx.role === 'good'
      ? 'This is a POSITIVE collectible reward item that players eagerly want to catch. It should look appealing, desirable, and valuable.'
      : 'This is a DANGEROUS obstacle that players must avoid. It should look menacing, harmful, and clearly threatening.';

    return buildSpritePrompt(itemDesc, roleHint, styleInst, aesthetic, ctx.gameType);
  }

  /** Determine role of an asset key based on naming conventions */
  static inferRole(assetKey: string): PromptContext['role'] {
    if (assetKey.startsWith('good_')) return 'good';
    if (assetKey.startsWith('bad_')) return 'bad';

    const badKeys = ['bomb', 'meteor', 'ghost', 'obstacle', 'enemy', 'hazard'];
    const playerKeys = ['player', 'character', 'hero', 'avatar'];
    const bgKeys = ['sky', 'space_bg', 'ocean_bg', 'background'];
    const bulletKeys = ['bullet', 'projectile', 'shot'];

    if (badKeys.some(k => assetKey.includes(k))) return 'bad';
    if (playerKeys.some(k => assetKey.includes(k))) return 'player';
    if (bgKeys.some(k => assetKey.includes(k))) return 'background';
    if (bulletKeys.some(k => assetKey.includes(k))) return 'bullet';
    return 'good';
  }

  /** Return API image generation config based on asset role */
  static getImageConfig(role: PromptContext['role']): ImageConfig {
    if (role === 'background') {
      return { aspectRatio: '9:16', imageSize: '1K' };
    }
    return { aspectRatio: '1:1', imageSize: '1K' };
  }
}
