export interface PrebuiltAsset {
  id: string;
  name: string;
  type: 'sprite' | 'sound' | 'background' | 'particle';
  src: string;
  thumbnail?: string;
  tags: string[];
}

export const PREBUILT_ASSETS: PrebuiltAsset[] = [
  // Sprites (use emoji as placeholders)
  { id: 'star', name: '\u661F\u661F', type: 'sprite', src: 'prebuilt://sprites/star', thumbnail: '\u2B50', tags: ['catch', 'score'] },
  { id: 'heart', name: '\u7231\u5FC3', type: 'sprite', src: 'prebuilt://sprites/heart', thumbnail: '\u2764\uFE0F', tags: ['catch', 'lives'] },
  { id: 'bomb', name: '\u70B8\u5F39', type: 'sprite', src: 'prebuilt://sprites/bomb', thumbnail: '\uD83D\uDCA3', tags: ['dodge', 'danger'] },
  { id: 'coin', name: '\u91D1\u5E01', type: 'sprite', src: 'prebuilt://sprites/coin', thumbnail: '\uD83E\uDE99', tags: ['score', 'catch'] },
  { id: 'apple', name: '\u82F9\u679C', type: 'sprite', src: 'prebuilt://sprites/apple', thumbnail: '\uD83C\uDF4E', tags: ['catch', 'food'] },
  { id: 'meteor', name: '\u6D41\u661F', type: 'sprite', src: 'prebuilt://sprites/meteor', thumbnail: '\u2604\uFE0F', tags: ['dodge', 'shooter'] },
  { id: 'gift', name: '\u793C\u7269', type: 'sprite', src: 'prebuilt://sprites/gift', thumbnail: '\uD83C\uDF81', tags: ['catch', 'reward'] },
  { id: 'ghost', name: '\u5E7D\u7075', type: 'sprite', src: 'prebuilt://sprites/ghost', thumbnail: '\uD83D\uDC7B', tags: ['dodge', 'enemy'] },
  { id: 'diamond', name: '\u94BB\u77F3', type: 'sprite', src: 'prebuilt://sprites/diamond', thumbnail: '\uD83D\uDC8E', tags: ['score', 'premium'] },
  { id: 'rocket', name: '\u706B\u7BAD', type: 'sprite', src: 'prebuilt://sprites/rocket', thumbnail: '\uD83D\uDE80', tags: ['shooter', 'powerup'] },
  // Sounds (placeholder)
  { id: 'pop', name: '\u5F39\u51FA\u97F3', type: 'sound', src: 'prebuilt://sounds/pop', tags: ['hit', 'catch'] },
  { id: 'ding', name: '\u53EE', type: 'sound', src: 'prebuilt://sounds/ding', tags: ['score', 'correct'] },
  { id: 'buzz', name: '\u8702\u9E23', type: 'sound', src: 'prebuilt://sounds/buzz', tags: ['wrong', 'fail'] },
  { id: 'whoosh', name: '\u55D6', type: 'sound', src: 'prebuilt://sounds/whoosh', tags: ['swipe', 'move'] },
  { id: 'cheer', name: '\u6B22\u547C', type: 'sound', src: 'prebuilt://sounds/cheer', tags: ['win', 'finish'] },
  // Backgrounds
  { id: 'sky', name: '\u5929\u7A7A', type: 'background', src: 'prebuilt://bg/sky', thumbnail: '\uD83C\uDF24\uFE0F', tags: ['outdoor'] },
  { id: 'space', name: '\u592A\u7A7A', type: 'background', src: 'prebuilt://bg/space', thumbnail: '\uD83C\uDF0C', tags: ['space', 'dark'] },
  { id: 'ocean', name: '\u6D77\u6D0B', type: 'background', src: 'prebuilt://bg/ocean', thumbnail: '\uD83C\uDF0A', tags: ['water', 'blue'] },
];
