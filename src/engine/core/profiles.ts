// src/engine/core/profiles.ts
//
// Profile resolvers for input→movement mapping and per-game-type collision radius.
// Used by ConfigValidator and ConversationAgent to inject correct defaults.

// ── Input Profile ──────────────────────────────────────────────

export interface InputProfileResult {
  readonly mode: 'follow' | 'velocity';
  readonly continuousEvent?: string;
  readonly followSpeed?: number;
  readonly defaultY?: number;
}

// Continuous event emitted by each input module type
const INPUT_CONTINUOUS_EVENTS: Record<string, string> = {
  TouchInput: 'input:touch:position',
  FaceInput: 'input:face:move',
  HandInput: 'input:hand:move',
  BodyInput: 'input:body:move',
  DeviceInput: 'input:device:tilt',
};

// Game types that use velocity mode (hold-based directional movement)
const VELOCITY_MODE_GAMES = new Set(['platformer', 'runner']);

// Game types where the player sits at the bottom of the screen
const BOTTOM_PLAYER_GAMES = new Set([
  'catch', 'dodge', 'tap', 'shooting', 'action-rpg',
]);

/**
 * Given an input module type and game type, resolve the correct
 * PlayerMovement defaults for seamless input→movement wiring.
 */
export function resolveInputProfile(
  inputType: string,
  gameType: string,
): InputProfileResult {
  const isVelocityMode = VELOCITY_MODE_GAMES.has(gameType);

  if (isVelocityMode) {
    return { mode: 'velocity' };
  }

  const continuousEvent = INPUT_CONTINUOUS_EVENTS[inputType];
  const defaultY = BOTTOM_PLAYER_GAMES.has(gameType) ? 0.85 : undefined;

  return {
    mode: 'follow',
    continuousEvent,
    followSpeed: 0.15,
    defaultY,
  };
}

// ── Collision Profile ──────────────────────────────────────────

// Per-game-type collision radius multipliers (relative to spriteSize)
// Calibrated from knowledge base: collision.md lines 56-72
const GAME_TYPE_RADIUS: Record<string, number> = {
  catch: 0.7,        // Generous — easy to catch items
  dodge: 0.4,        // Tight — rewarding to dodge narrowly
  tap: 0.5,          // Standard
  shooting: 0.5,     // Standard
  runner: 0.5,       // Standard
  platformer: 0.5,   // Standard
  'action-rpg': 0.5, // Standard
  'world-ar': 0.5,   // Standard
};

const DEFAULT_RADIUS = 0.5;

/**
 * Resolve the recommended collision radius multiplier for a given
 * game type and collision layer.
 *
 * Returns a multiplier relative to spriteSize (e.g., 0.7 = 70% of spriteSize).
 */
export function resolveCollisionRadius(
  gameType: string,
  _layer: string,
): number {
  return GAME_TYPE_RADIUS[gameType] ?? DEFAULT_RADIUS;
}
