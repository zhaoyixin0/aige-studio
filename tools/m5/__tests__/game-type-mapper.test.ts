import { describe, it, expect } from 'vitest';
import { mapGameType } from '../game-type-mapper.ts';

describe('mapGameType', () => {
  it('maps Puzzle_Memory game_type to puzzle', () => {
    expect(mapGameType('CardMatching_knowledge.json', { game_type: 'Puzzle_Memory' })).toBe('puzzle');
  });

  it('maps slingshot filename pattern to slingshot', () => {
    expect(mapGameType('2D_AngryBirds_Slingshot_Game.json', {})).toBe('slingshot');
  });

  it('maps Ball_Launch to slingshot', () => {
    expect(mapGameType('birdf.json', { game_type: '2D_Slingshot_Ball_Launch_Game' })).toBe('slingshot');
  });

  it('maps whack/mole to whack-a-mole', () => {
    expect(mapGameType('whack_a_mole.json', { game_type: 'Whack_Mole' })).toBe('whack-a-mole');
  });

  it('maps AssembleMe to puzzle', () => {
    expect(mapGameType('AssembleMe_knowledge.json', { game_type: 'AssembleMe' })).toBe('puzzle');
  });

  it('maps MazeChase to dodge', () => {
    expect(mapGameType('MazeChase_knowledge.json', { game_type: 'MazeChase' })).toBe('dodge');
  });

  it('maps Spinning_Wheel to random-wheel', () => {
    expect(mapGameType('2D_Spinning_Wheel_Pointer_Game.json', {})).toBe('random-wheel');
  });

  it('maps Racing/Swipe_Car to racing', () => {
    expect(mapGameType('2D_Swipe_Car_Racing_Game.json', {})).toBe('racing');
  });

  it('maps CharacterDress to dress-up', () => {
    expect(mapGameType('CharacterDress_knowledge.json', { game_type: 'CharacterDress' })).toBe('dress-up');
  });

  it('maps parkour/Jump_Jump to platformer', () => {
    expect(mapGameType('3D_Jump_Jump_Camera_Game.json', {})).toBe('platformer');
  });

  it('maps Laser_Trajectory to trajectory', () => {
    expect(mapGameType('game_2d_laser_trajectory.json', {})).toBe('trajectory');
  });

  it('maps drawing/screen_drawing to drawing', () => {
    expect(mapGameType('2d_screen_drawing.json', {})).toBe('drawing');
  });

  it('maps Sliding_Puzzle to jigsaw', () => {
    expect(mapGameType('SlidingPuzzle_knowledge.json', { game_type: 'Sliding_Puzzle' })).toBe('jigsaw');
  });

  it('maps BiscuitChallenge to tap', () => {
    expect(mapGameType('BiscuitChallenge_knowledge.json', { game_type: 'BiscuitChallenge' })).toBe('tap');
  });

  it('maps SugarInserting to sugar-insert', () => {
    expect(mapGameType('SugarInserting_knowledge.json', { game_type: 'SugarInserting' })).toBe('sugar-insert');
  });

  it('maps Flip/Image_Flip to flip-guess', () => {
    expect(mapGameType('Image_Flip_knowledge.json', { game_type: 'Image_Flip' })).toBe('flip-guess');
  });

  it('maps Quiz_Dash to quiz', () => {
    expect(mapGameType('Quiz_Dash.json', {})).toBe('quiz');
  });

  it('maps cross_stree to cross-road', () => {
    expect(mapGameType('cross_stree_knowledge.json', { game_type: 'cross_stree' })).toBe('cross-road');
  });

  it('maps Swimmer/Chimpion to swimmer', () => {
    expect(mapGameType('ChimpionSwimmer.json', {})).toBe('swimmer');
  });

  it('maps Jelly to jelly', () => {
    expect(mapGameType('JellyGame.json', {})).toBe('jelly');
  });

  it('returns tap as fallback for unknown types', () => {
    expect(mapGameType('unknown_game.json', {})).toBe('tap');
  });

  it('prefers game_type field over filename', () => {
    // game_type field should be checked first
    expect(mapGameType('random_filename.json', { game_type: 'Puzzle_Memory' })).toBe('puzzle');
  });
});
