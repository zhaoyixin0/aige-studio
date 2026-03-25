// src/engine/renderer/theme-registry.ts

export interface GameTheme {
  id: string;
  name: string;
  bg: number;              // Background color (hex)
  playerEmoji: string;
  goodEmojis: string[];
  badEmojis: string[];
  bulletEmoji: string;
  scoreColor: string;
  gridColor: string;       // Background grid line color
}

export const THEMES: Record<string, GameTheme> = {
  fruit: {
    id: 'fruit', name: '水果派对', bg: 0x1a1a2e,
    playerEmoji: '🧺',
    goodEmojis: ['🍎', '🍊', '🍇', '🍌', '🍓', '🍑', '🥝'],
    badEmojis: ['💣', '🌶️'],
    bulletEmoji: '⚡', scoreColor: '#FFD700', gridColor: 'rgba(0,212,255,0.05)',
  },
  space: {
    id: 'space', name: '太空冒险', bg: 0x0a0a1a,
    playerEmoji: '🚀',
    goodEmojis: ['⭐', '💎', '🪐', '🌟'],
    badEmojis: ['☄️', '🌑', '👾'],
    bulletEmoji: '🔥', scoreColor: '#00d4ff', gridColor: 'rgba(0,100,255,0.05)',
  },
  ocean: {
    id: 'ocean', name: '海洋探索', bg: 0x0a1628,
    playerEmoji: '🐠',
    goodEmojis: ['🐚', '🦀', '🐙', '🐡', '🦐'],
    badEmojis: ['🦈', '💀', '🪸'],
    bulletEmoji: '🫧', scoreColor: '#00ff88', gridColor: 'rgba(0,255,136,0.04)',
  },
  halloween: {
    id: 'halloween', name: '万圣节', bg: 0x1a0a0a,
    playerEmoji: '🎃',
    goodEmojis: ['🍬', '🍭', '🧁', '🍩'],
    badEmojis: ['👻', '💀', '🦇', '🕷️'],
    bulletEmoji: '✨', scoreColor: '#ff6b9d', gridColor: 'rgba(255,107,157,0.04)',
  },
  candy: {
    id: 'candy', name: '糖果世界', bg: 0x1a1028,
    playerEmoji: '🤖',
    goodEmojis: ['🍩', '🍪', '🧁', '🍰', '🍫'],
    badEmojis: ['🌶️', '🧨'],
    bulletEmoji: '💫', scoreColor: '#ff9ff3', gridColor: 'rgba(255,159,243,0.04)',
  },
};

export const DEFAULT_THEME = 'fruit';

export function getTheme(id: string): GameTheme {
  return THEMES[id] ?? THEMES[DEFAULT_THEME];
}

export function getAllThemes(): GameTheme[] {
  return Object.values(THEMES);
}

/** Map a spawned object's asset name to an emoji from the theme */
export function assetToEmoji(asset: string, theme: GameTheme): string {
  // Role-based naming: good_N → goodEmojis, bad_N → badEmojis
  if (asset.startsWith('good_')) {
    const idx = parseInt(asset.split('_')[1] ?? '1', 10) - 1;
    return theme.goodEmojis[idx % theme.goodEmojis.length];
  }
  if (asset.startsWith('bad_')) {
    const idx = parseInt(asset.split('_')[1] ?? '1', 10) - 1;
    return theme.badEmojis[idx % theme.badEmojis.length];
  }
  // Legacy specific names
  const goodAssets = ['star', 'apple', 'coin', 'heart', 'diamond', 'gift',
    'bubble_red', 'bubble_blue', 'bubble_gold', 'target_normal', 'target_gold', 'target_small'];
  const badAssets = ['bomb', 'meteor', 'ghost', 'obstacle'];
  if (goodAssets.includes(asset)) {
    return theme.goodEmojis[hashString(asset) % theme.goodEmojis.length];
  }
  if (badAssets.includes(asset)) {
    return theme.badEmojis[hashString(asset) % theme.badEmojis.length];
  }
  // Fallback
  const all = [...theme.goodEmojis, ...theme.badEmojis];
  return all[hashString(asset) % all.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
