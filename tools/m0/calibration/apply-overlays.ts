// tools/m0/calibration/apply-overlays.ts
// Builds preset overlays from expert calibrations and merges with base presets (immutably).

import type { NormalizedExpert } from '../schema/expert-types';
import type { CanonicalParams } from './extract-params';
import { calibrate } from './calibrate';

export interface PresetOverlay {
  readonly gameType: string;
  readonly source: string; // "expert-knowledge" or specific filename
  readonly params: Record<string, Record<string, unknown>>;
}

// Map expert game_type → AIGE game type
const EXPERT_TO_AIGE_TYPE: Record<string, string> = {
  obstacle_dodge_game: 'dodge',
  shooting_game: 'shooting',
  puzzle_memory: 'puzzle',
  puzzle_assemble: 'puzzle',
  quick_reaction_game: 'tap',
  whack_a_mole_type_games: 'tap',
  '2d_spinning_wheel_pointer_game': 'random-wheel',
  '2d_spinning_wheel_match_game': 'random-wheel',
  '2d_random_question_display': 'quiz',
  '2d_headtilt_choice_game': 'expression',
  '2d_side_scrolling_game': 'runner',
  side_scrolling_shaping_game: 'runner',
  '3d_jump_jump_parkour_game': 'platformer',
  '3d_platform_jump': 'platformer',
  '2d_slingshot_ball_launch_game': 'shooting',
  '2d_swipe_car_racing_game': 'runner',
  trajectory_slove: 'shooting',
  '3d_rope_cutting_shooting_game': 'shooting',
  action_game_micro_control: 'action-rpg',
  action_micro_control: 'action-rpg',
  health_management_game: 'action-rpg',
  '2d_random_drop_slot_game': 'catch',
  random_pause_sorting_game: 'catch',
  social_friend_flip_guessing_game: 'puzzle',
  '2d_emoji_graph_trajectory_game': 'tap',
  '2d_timeline_event_arrangement': 'narrative',
  '2d_frame_sequence_random_pause_game': 'random-wheel',
  '2d_makeup_random_match_system': 'dress-up',
  '2d_avatar_frame_and_name_customization': 'dress-up',
  '3d_sliding_ball_terrain_rolling_game': 'platformer',
  '2d_edge_collider_scene': 'platformer',
  obstacle_clearing_game: 'dodge',
  '2d_cross_stree_game': 'runner',
  '2d_let_crow_drink_water_game': 'puzzle',
  '2d_match_linl_game': 'puzzle',
  '2d_match_lock_game': 'puzzle',
  '2d_puzzle_painting_game': 'puzzle',
  '2d_scale_matching_game': 'puzzle',
};

interface DocWithParams {
  doc: NormalizedExpert;
  params: CanonicalParams;
}

function mapToAigeType(expertType: string): string | null {
  const normalized = expertType.replace(/[-\s]/g, '_').toLowerCase();
  return EXPERT_TO_AIGE_TYPE[normalized] ?? null;
}

export function buildPresetOverlays(knowledgeDocs: readonly DocWithParams[]): PresetOverlay[] {
  // Group params by mapped AIGE type
  const grouped = new Map<string, CanonicalParams[]>();
  for (const { doc, params } of knowledgeDocs) {
    if (doc.kind !== 'knowledge') continue;
    const aigeType = mapToAigeType(doc.gameType);
    if (!aigeType) continue;
    if (!grouped.has(aigeType)) grouped.set(aigeType, []);
    grouped.get(aigeType)!.push(params);
  }

  const overlays: PresetOverlay[] = [];

  for (const [gameType, paramsList] of grouped) {
    const overlayParams: Record<string, Record<string, unknown>> = {};

    // Calibrate scene complexity into Spawner/DifficultyRamp
    const objCountResult = calibrate(paramsList, 'object_count', 5);
    if (objCountResult.confidence > 0.1) {
      overlayParams._expertMeta = {
        objectCount: objCountResult.suggested,
        objectCountConfidence: objCountResult.confidence,
      };
    }

    // Calibrate collider density
    const colliderResult = calibrate(paramsList, 'collider_count', 2);
    if (colliderResult.confidence > 0.1) {
      overlayParams._expertMeta = {
        ...overlayParams._expertMeta,
        colliderCount: colliderResult.suggested,
        colliderCountConfidence: colliderResult.confidence,
      };
    }

    // Calibrate complexity
    const complexityResult = calibrate(paramsList, 'complexity_score', 10);
    if (complexityResult.confidence > 0.1) {
      overlayParams._expertMeta = {
        ...overlayParams._expertMeta,
        complexityScore: complexityResult.suggested,
        complexityScoreConfidence: complexityResult.confidence,
      };
    }

    if (Object.keys(overlayParams).length > 0) {
      overlays.push({
        gameType,
        source: `expert-knowledge-${paramsList.length}-docs`,
        params: overlayParams,
      });
    }
  }

  return overlays;
}

type PresetMap = Record<string, Record<string, Record<string, unknown>>>;

export function applyOverlays(
  basePresets: Readonly<PresetMap>,
  overlays: readonly PresetOverlay[],
): PresetMap {
  // Deep clone base (immutable)
  const merged: PresetMap = JSON.parse(JSON.stringify(basePresets));

  for (const overlay of overlays) {
    if (!merged[overlay.gameType]) continue;

    for (const [moduleKey, moduleParams] of Object.entries(overlay.params)) {
      merged[overlay.gameType] = {
        ...merged[overlay.gameType],
        [moduleKey]: {
          ...merged[overlay.gameType][moduleKey],
          ...moduleParams,
        },
      };
    }
  }

  return merged;
}
