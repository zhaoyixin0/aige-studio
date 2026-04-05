// tools/m0/taxonomy/game-types-v2.ts
// 38 game types derived from 120+ expert Effect House games + 16 existing AIGE types.

export interface GameTypeEntry {
  readonly id: string;
  readonly group: string;
  readonly displayName: string;
  readonly description: string;
  readonly requiredModules: readonly string[];
  readonly missingModules: readonly string[];
  readonly supportedToday: boolean;
  readonly evidence: string;
}

export interface TaxonomyV2 {
  readonly types: readonly GameTypeEntry[];
  readonly groups: readonly string[];
}

// 8 groups: Reflex, Physics, Puzzle, Social, Creative, Narrative, Sports, Experimental
const TYPES: GameTypeEntry[] = [
  // === REFLEX (反应类) ===
  { id: 'catch', group: 'Reflex', displayName: 'Catch', description: 'Catch falling items', requiredModules: ['Spawner', 'Collision', 'Scorer'], missingModules: [], supportedToday: true, evidence: '2D_Random_Drop_Slot_Game, Random_Pause_Sorting_Game' },
  { id: 'dodge', group: 'Reflex', displayName: 'Dodge', description: 'Avoid obstacles', requiredModules: ['Spawner', 'Collision', 'Lives'], missingModules: [], supportedToday: true, evidence: 'Obstacle_Dodge_Game, Obstacle_Clearing_Game, MazeChase' },
  { id: 'tap', group: 'Reflex', displayName: 'Tap', description: 'Tap targets quickly', requiredModules: ['Spawner', 'Collision', 'Timer'], missingModules: [], supportedToday: true, evidence: 'Quick_Reaction_Game, whack-a-mole' },
  { id: 'rhythm', group: 'Reflex', displayName: 'Rhythm', description: 'Hit beats in time', requiredModules: ['BeatMap', 'Scorer'], missingModules: [], supportedToday: true, evidence: '2D_Timeline_Event_Arrangement' },
  { id: 'quick-reaction', group: 'Reflex', displayName: 'Quick Reaction', description: 'React to sudden prompts', requiredModules: ['Timer', 'Spawner', 'Scorer'], missingModules: ['Preset'], supportedToday: false, evidence: 'Quick_Reaction_Game' },
  { id: 'whack-a-mole', group: 'Reflex', displayName: 'Whack-a-Mole', description: 'Tap popping targets', requiredModules: ['Spawner', 'Collision', 'Timer', 'Tween'], missingModules: [], supportedToday: true, evidence: 'whack-a-mole type games' },

  // === PHYSICS (物理类) ===
  { id: 'shooting', group: 'Physics', displayName: 'Shooting', description: 'Aim and shoot targets', requiredModules: ['Projectile', 'Aim', 'WaveSpawner'], missingModules: [], supportedToday: true, evidence: 'Shooting_Game, WaterBlaster, 3D_Rope_Cutting_Shooting_Game' },
  { id: 'slingshot', group: 'Physics', displayName: 'Slingshot', description: 'Fling projectiles at structures', requiredModules: ['Physics2D', 'Collision', 'Projectile'], missingModules: ['Physics2D'], supportedToday: false, evidence: '2D_Slingshot_Ball_Launch_Game (AngryBirds-style)' },
  { id: 'ball-physics', group: 'Physics', displayName: 'Ball Physics', description: 'Physics-based ball mechanics', requiredModules: ['Physics2D', 'Collision'], missingModules: ['Physics2D'], supportedToday: false, evidence: '2d_ball_type_physics_setup, 2D_Pendulum_Ball_Game' },
  { id: 'trajectory', group: 'Physics', displayName: 'Trajectory', description: 'Plot projectile paths', requiredModules: ['Physics2D', 'Collision'], missingModules: ['Physics2D'], supportedToday: false, evidence: 'Trajectory_Slove, 2D_Emoji_Graph_Trajectory_Game' },
  { id: 'bouncing', group: 'Physics', displayName: 'Bounded Bounce', description: 'Ball bouncing in enclosed area', requiredModules: ['Physics2D', 'Collision'], missingModules: ['Physics2D'], supportedToday: false, evidence: '2D_Bounded_Area_Bounce_Game' },
  { id: 'rope-cutting', group: 'Physics', displayName: 'Rope Cutting', description: 'Cut ropes to solve puzzles', requiredModules: ['Physics2D', 'Collision'], missingModules: ['Physics2D'], supportedToday: false, evidence: '2D_Rope_Cutting_Friend_Rescue_Game' },

  // === PUZZLE (解谜类) ===
  { id: 'puzzle', group: 'Puzzle', displayName: 'Puzzle', description: 'Generic puzzle mechanics', requiredModules: ['MatchEngine', 'Scorer'], missingModules: [], supportedToday: true, evidence: 'Puzzle_Memory, Puzzle_Assemble' },
  { id: 'match-link', group: 'Puzzle', displayName: 'Match & Link', description: 'Connect matching items', requiredModules: ['MatchEngine', 'Collision', 'Tween'], missingModules: [], supportedToday: true, evidence: '2d_match_linl_game, 2d_match_lock_game' },
  { id: 'jigsaw', group: 'Puzzle', displayName: 'Jigsaw / Assembly', description: 'Assemble pieces to form image', requiredModules: ['MatchEngine', 'Collision'], missingModules: ['Preset'], supportedToday: false, evidence: 'Puzzle_Assemble, 2d_puzzle_painting_game' },
  { id: 'water-pipe', group: 'Puzzle', displayName: 'Water Pipe', description: 'Connect pipes to guide flow', requiredModules: ['MatchEngine', 'Collision', 'Tween'], missingModules: [], supportedToday: true, evidence: '2d_let_crow_drink_water_game' },
  { id: 'scale-matching', group: 'Puzzle', displayName: 'Scale Matching', description: 'Balance items on a scale', requiredModules: ['Physics2D', 'Scorer'], missingModules: ['Physics2D'], supportedToday: false, evidence: '2d_scale-matching game' },

  // === SOCIAL (社交类) ===
  { id: 'quiz', group: 'Social', displayName: 'Quiz', description: 'Answer questions', requiredModules: ['Scorer', 'Timer'], missingModules: [], supportedToday: true, evidence: '2D_Random_Question_Display' },
  { id: 'random-wheel', group: 'Social', displayName: 'Random Wheel', description: 'Spin to decide', requiredModules: ['Tween'], missingModules: [], supportedToday: true, evidence: '2D_Spinning_Wheel_Pointer_Game, 2D_Spinning_Wheel_Match_Game' },
  { id: 'expression', group: 'Social', displayName: 'Expression', description: 'Face expression games', requiredModules: ['ExpressionDetector', 'FaceInput'], missingModules: [], supportedToday: true, evidence: '2D_HeadTilt_Choice_Game' },
  { id: 'gesture', group: 'Social', displayName: 'Gesture', description: 'Hand gesture challenges', requiredModules: ['GestureMatch', 'HandInput'], missingModules: [], supportedToday: true, evidence: 'Expert gesture games' },
  { id: 'flip-guess', group: 'Social', displayName: 'Flip & Guess', description: 'Flip cards for friend guessing', requiredModules: ['MatchEngine', 'Timer', 'Tween'], missingModules: [], supportedToday: true, evidence: 'Social_Friend_Flip_Guessing_Game' },
  { id: 'head-tilt', group: 'Social', displayName: 'Head Tilt Choice', description: 'Tilt head to choose options', requiredModules: ['FaceInput', 'Scorer'], missingModules: ['Preset'], supportedToday: false, evidence: '2D_HeadTilt_Choice_Game' },

  // === CREATIVE (创意类) ===
  { id: 'dress-up', group: 'Creative', displayName: 'Dress Up', description: 'Customize character appearance', requiredModules: ['DressUpEngine'], missingModules: [], supportedToday: true, evidence: '2D_Makeup_Random_Match_System, 2D_Avatar_Frame_And_Name_Customization' },
  { id: 'drawing', group: 'Creative', displayName: 'Drawing', description: 'Free-hand drawing', requiredModules: ['TouchInput', 'Canvas2D'], missingModules: ['Canvas2D'], supportedToday: false, evidence: '2d_screen_drawing, 2D_Brush_Maze' },
  { id: 'avatar-frame', group: 'Creative', displayName: 'Avatar Frame', description: 'Create custom avatar frames', requiredModules: ['DressUpEngine'], missingModules: ['Preset'], supportedToday: false, evidence: '2D_Avatar_Frame_And_Name_Customization' },

  // === PLATFORMER / RUNNER (跑酷类) ===
  { id: 'runner', group: 'Sports', displayName: 'Runner', description: 'Endless side-scroller', requiredModules: ['Spawner', 'Collision', 'ScrollingLayers'], missingModules: ['ScrollingLayers'], supportedToday: false, evidence: '2D_side_scrolling_game, 2D_Swipe_Car_Racing_Game, side-scrolling shaping game' },
  { id: 'platformer', group: 'Sports', displayName: 'Platformer', description: 'Jump across platforms', requiredModules: ['Gravity', 'Jump', 'StaticPlatform'], missingModules: [], supportedToday: true, evidence: '3D_Jump_Jump_Parkour_Game, 3D_platform_jump' },
  { id: 'action-rpg', group: 'Sports', displayName: 'Action RPG', description: 'Combat with stats', requiredModules: ['Health', 'EnemyAI', 'LevelUp'], missingModules: [], supportedToday: true, evidence: 'Action_Game_Micro_Control, Action_Micro_Control, Health_Management_Game' },
  { id: 'racing', group: 'Sports', displayName: 'Racing', description: 'Swipe to steer vehicle', requiredModules: ['ScrollingLayers', 'Collision', 'Timer'], missingModules: ['ScrollingLayers'], supportedToday: false, evidence: '2D_Swipe_Car_Racing_Game' },
  { id: 'cross-road', group: 'Sports', displayName: 'Cross Road', description: 'Navigate through traffic', requiredModules: ['Spawner', 'Collision', 'ScrollingLayers'], missingModules: ['ScrollingLayers'], supportedToday: false, evidence: '2d_cross_stree_game' },
  { id: 'ball-rolling', group: 'Sports', displayName: 'Ball Rolling', description: '3D ball on terrain', requiredModules: ['Physics2D', 'Gravity'], missingModules: ['Physics2D'], supportedToday: false, evidence: '3D_Sliding_Ball_Terrain_Rolling_Game' },

  // === NARRATIVE (叙事类) ===
  { id: 'narrative', group: 'Narrative', displayName: 'Narrative', description: 'Branching story', requiredModules: ['BranchStateMachine', 'DialogueSystem'], missingModules: [], supportedToday: true, evidence: '2D_Timeline_Event_Arrangement' },
  { id: 'world-ar', group: 'Narrative', displayName: 'World AR', description: 'AR world placement', requiredModules: ['BodyInput'], missingModules: [], supportedToday: true, evidence: 'Expert AR experiences' },

  // === EXPERIMENTAL (实验类) ===
  { id: 'maze', group: 'Experimental', displayName: 'Maze', description: 'Navigate through maze', requiredModules: ['Collision', 'Physics2D'], missingModules: ['Physics2D'], supportedToday: false, evidence: '2D_Brush_Maze, MazeChase_knowledge' },
  { id: 'sugar-insert', group: 'Experimental', displayName: 'Sugar Insert', description: 'Precision dropping challenge', requiredModules: ['Physics2D', 'Collision', 'Tween'], missingModules: ['Physics2D'], supportedToday: false, evidence: 'SugarInsertingChallenge_knowledge' },
  { id: 'swimmer', group: 'Experimental', displayName: 'Swimmer', description: 'Aquatic navigation game', requiredModules: ['Physics2D', 'Collision', 'ScrollingLayers'], missingModules: ['Physics2D', 'ScrollingLayers'], supportedToday: false, evidence: 'ChimpionSwimmer template' },
  { id: 'jelly', group: 'Experimental', displayName: 'Jelly', description: 'Soft-body physics game', requiredModules: ['Physics2D', 'Tween'], missingModules: ['Physics2D'], supportedToday: false, evidence: 'JellyGame template' },
];

const GROUPS = ['Reflex', 'Physics', 'Puzzle', 'Social', 'Creative', 'Sports', 'Narrative', 'Experimental'];

export function loadTaxonomy(): TaxonomyV2 {
  return { types: TYPES, groups: GROUPS };
}
