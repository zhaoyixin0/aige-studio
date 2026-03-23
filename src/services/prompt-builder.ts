// src/services/prompt-builder.ts

export interface PromptContext {
  gameType: string;
  theme: string;
  role: 'good' | 'bad' | 'player' | 'bullet' | 'background';
  style: 'cartoon' | 'pixel' | 'flat' | 'realistic';
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

const STYLE_INSTRUCTIONS: Record<string, string> = {
  cartoon: 'cartoon style, bold outlines, vibrant colors, 2D flat shading',
  pixel: 'pixel art style, 32x32 grid, retro 8-bit aesthetic',
  flat: 'flat design, minimal shadows, clean geometric shapes, material design',
  realistic: 'semi-realistic, soft lighting, detailed textures, 3D rendered look',
};

export class PromptBuilder {
  static build(assetKey: string, ctx: PromptContext): string {
    const itemDesc = ITEM_DESCRIPTIONS[assetKey] ?? assetKey;
    const aesthetic = THEME_AESTHETICS[ctx.theme] ?? '';
    const styleInst = STYLE_INSTRUCTIONS[ctx.style] ?? STYLE_INSTRUCTIONS.cartoon;

    if (ctx.role === 'background') {
      return [
        `Generate a game background image, portrait orientation (1080x1920).`,
        `Scene: ${itemDesc}, ${aesthetic}.`,
        `Style: ${styleInst}.`,
        `No text, no characters, no UI elements. Seamless, immersive game world.`,
      ].join(' ');
    }

    const roleHint = {
      good: 'This is a positive collectible item the player wants to catch.',
      bad: 'This is a dangerous obstacle the player must avoid.',
      player: 'This is the main player character, should look friendly and heroic.',
      bullet: 'This is a small projectile, should look energetic and fast.',
    }[ctx.role] ?? '';

    return [
      `Generate a single game sprite icon: ${itemDesc}.`,
      `${roleHint}`,
      `Theme: ${aesthetic}.`,
      `Style: ${styleInst}.`,
      `Requirements: centered on canvas, facing camera, solid white background,`,
      `no shadows on background, suitable for a mobile game,`,
      `icon size roughly 80% of canvas. Single object only, no text.`,
    ].join(' ');
  }

  /** Determine role of an asset key based on game presets */
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
