// tools/m5/game-type-mapper.ts
// Maps Effect House game_type strings + filenames → AIGE gameType.

/** Ordered list of pattern → AIGE gameType rules. First match wins. */
const MAPPING_RULES: readonly { pattern: RegExp; gameType: string }[] = [
  { pattern: /Slingshot|Ball_Launch/i, gameType: 'slingshot' },
  { pattern: /whack|mole/i, gameType: 'whack-a-mole' },
  { pattern: /CardMatching|Puzzle_Memory|TheOddOne|AssembleMe/i, gameType: 'puzzle' },
  { pattern: /MazeChase|Obstacle.*Dodge/i, gameType: 'dodge' },
  { pattern: /SugarInserting/i, gameType: 'sugar-insert' },
  { pattern: /perfect_pitch|scale_matching|scale_balance/i, gameType: 'scale-matching' },
  { pattern: /Spinning_Wheel|randomPicker|wheel/i, gameType: 'random-wheel' },
  { pattern: /Racing|Swipe_Car/i, gameType: 'racing' },
  { pattern: /Laser_Trajectory|laser_trajectory/i, gameType: 'trajectory' },
  { pattern: /Flip.*Guess|Image_Flip/i, gameType: 'flip-guess' },
  { pattern: /CharacterDress|Makeup/i, gameType: 'dress-up' },
  { pattern: /Swimmer|Chimpion/i, gameType: 'swimmer' },
  { pattern: /Jelly/i, gameType: 'jelly' },
  { pattern: /parkour|Jump_Jump/i, gameType: 'platformer' },
  { pattern: /drawing|screen_drawing/i, gameType: 'drawing' },
  { pattern: /Light.*stars/i, gameType: 'tap' },
  { pattern: /cross.*stree/i, gameType: 'cross-road' },
  { pattern: /Sliding.*Puzzle/i, gameType: 'jigsaw' },
  { pattern: /BiscuitChallenge|ClearBlocks/i, gameType: 'tap' },
  { pattern: /WaterBlaster/i, gameType: 'shooting' },
  { pattern: /Quiz.*Dash/i, gameType: 'quiz' },
  { pattern: /Pendulum|Bounce|Bounded.*Bounce/i, gameType: 'bouncing' },
  { pattern: /Rope.*Cut|Rescue/i, gameType: 'rope-cutting' },
  { pattern: /HeadTilt|Head.*Choice/i, gameType: 'head-tilt' },
  { pattern: /Carousel|Random.*Selector|Overhead.*Random/i, gameType: 'random-wheel' },
  { pattern: /Avatar.*Name|Avatar.*Frame|profile.*photo/i, gameType: 'avatar-frame' },
  { pattern: /Timeline|Event.*Arrangement/i, gameType: 'tap' },
  { pattern: /Click.*Disappear|Click.*Button|Interactive.*Click/i, gameType: 'tap' },
  { pattern: /Ladybug/i, gameType: 'dodge' },
  { pattern: /Sending.*Friends.*Home/i, gameType: 'puzzle' },
  { pattern: /Brush.*Maze/i, gameType: 'maze' },
  { pattern: /ball.*physics/i, gameType: 'ball-physics' },
];

const FALLBACK_GAME_TYPE = 'tap';

/**
 * Map an expert file to an AIGE game type.
 * Checks game_type field first, then filename. Falls back to 'tap'.
 */
export function mapGameType(
  filename: string,
  data: Record<string, unknown>,
): string {
  const gameTypeField = typeof data.game_type === 'string' ? data.game_type : '';
  // Combine both for matching: game_type field takes priority but filename is also checked
  const candidates = [gameTypeField, filename];

  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const rule of MAPPING_RULES) {
      if (rule.pattern.test(candidate)) return rule.gameType;
    }
  }

  return FALLBACK_GAME_TYPE;
}
