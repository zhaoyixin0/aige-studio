// src/engine/core/events.ts
// Centralized event name constants and payload interfaces.
// Modules can use these constants instead of raw strings for type safety and IDE autocomplete.
// Migration is gradual — raw strings still work, these are optional.

// ── GameFlow ────────────────────────────────────────────────
export const GAMEFLOW_STATE = 'gameflow:state';
export const GAMEFLOW_RESUME = 'gameflow:resume';
export const GAMEFLOW_PAUSE = 'gameflow:pause';

export interface GameflowStatePayload {
  state: 'ready' | 'countdown' | 'playing' | 'finished';
  previous: string;
}

// ── Input: Touch ────────────────────────────────────────────
export const INPUT_TOUCH_TAP = 'input:touch:tap';
export const INPUT_TOUCH_DOUBLE_TAP = 'input:touch:doubleTap';
export const INPUT_TOUCH_SWIPE = 'input:touch:swipe';
export const INPUT_TOUCH_LONG_PRESS = 'input:touch:longPress';
export const INPUT_TOUCH_HOLD = 'input:touch:hold';
export const INPUT_TOUCH_RELEASE = 'input:touch:release';

export interface TouchTapPayload { x: number; y: number }
export interface TouchSwipePayload { direction: 'up' | 'down' | 'left' | 'right' }
export interface TouchHoldPayload { x: number; y: number; side: 'left' | 'right' }

// ── Input: Face ─────────────────────────────────────────────
export const INPUT_FACE_MOVE = 'input:face:move';
export const INPUT_FACE_MOUTH_OPEN = 'input:face:mouthOpen';
export const INPUT_FACE_BLINK = 'input:face:blink';
export const INPUT_FACE_SMILE = 'input:face:smile';

export interface FaceMovePayload { x: number; y: number }

// ── Input: Hand ─────────────────────────────────────────────
export const INPUT_HAND_MOVE = 'input:hand:move';
export const INPUT_HAND_GESTURE = 'input:hand:gesture';

export interface HandGesturePayload { gesture: string }

// ── Input: Body ─────────────────────────────────────────────
export const INPUT_BODY_MOVE = 'input:body:move';
export const INPUT_BODY_POSE = 'input:body:pose';

// ── Input: Device ───────────────────────────────────────────
export const INPUT_DEVICE_SHAKE = 'input:device:shake';
export const INPUT_DEVICE_TILT = 'input:device:tilt';

export interface DeviceTiltPayload { x: number; y: number }

// ── Input: Audio ────────────────────────────────────────────
export const INPUT_AUDIO_VOLUME = 'input:audio:volume';
export const INPUT_AUDIO_BLOW = 'input:audio:blow';
export const INPUT_AUDIO_FREQUENCY = 'input:audio:frequency';

export interface AudioVolumePayload { level: number }

// ── Collision ───────────────────────────────────────────────
export const COLLISION_HIT = 'collision:hit';
export const COLLISION_DAMAGE = 'collision:damage';

export interface CollisionPayload {
  objectA: string;
  objectB: string;
  layerA: string;
  layerB: string;
  targetId: string;
  x: number;
  y: number;
}

// ── Spawner ─────────────────────────────────────────────────
export const SPAWNER_CREATED = 'spawner:created';
export const SPAWNER_DESTROYED = 'spawner:destroyed';

export interface SpawnerCreatedPayload { id: string; asset: string; x: number; y: number }
export interface SpawnerDestroyedPayload { id: string }

// ── Scorer ──────────────────────────────────────────────────
export const SCORER_UPDATE = 'scorer:update';

export interface ScorerUpdatePayload { score: number; delta: number; combo: number }

// ── Timer ───────────────────────────────────────────────────
export const TIMER_TICK = 'timer:tick';
export const TIMER_END = 'timer:end';

export interface TimerTickPayload { remaining: number; elapsed: number }

// ── Lives ───────────────────────────────────────────────────
export const LIVES_CHANGE = 'lives:change';
export const LIVES_ZERO = 'lives:zero';

export interface LivesChangePayload { current: number; max: number }

// ── Jump ────────────────────────────────────────────────────
export const JUMP_START = 'jump:start';
export const JUMP_PEAK = 'jump:peak';
export const JUMP_LAND = 'jump:land';

export interface JumpPayload { y: number }

// ── Gravity ─────────────────────────────────────────────────
export const GRAVITY_FALLING = 'gravity:falling';
export const GRAVITY_LANDED = 'gravity:landed';

export interface GravityPayload { id: string; y?: number }

// ── Player Movement ─────────────────────────────────────────
export const PLAYER_MOVE = 'player:move';
export const PLAYER_STOP = 'player:stop';

export interface PlayerMovePayload { x: number; y?: number; direction: number; speed: number }

// ── Dash ────────────────────────────────────────────────────
export const DASH_START = 'dash:start';
export const DASH_END = 'dash:end';

// ── CoyoteTime ──────────────────────────────────────────────
export const COYOTE_JUMP = 'coyote:jump';

// ── Knockback ───────────────────────────────────────────────
export const KNOCKBACK_START = 'knockback:start';
export const KNOCKBACK_END = 'knockback:end';

// ── IFrames ─────────────────────────────────────────────────
export const IFRAMES_START = 'iframes:start';
export const IFRAMES_END = 'iframes:end';

// ── Platform ────────────────────────────────────────────────
export const PLATFORM_CONTACT = 'platform:contact';
export const PLATFORM_MOVE = 'platform:move';
export const PLATFORM_LAND = 'platform:land';
export const PLATFORM_DROP = 'platform:drop';
export const PLATFORM_CRUMBLE = 'platform:crumble';
export const PLATFORM_RESPAWN = 'platform:respawn';

// ── Collectible ─────────────────────────────────────────────
export const COLLECTIBLE_PICKUP = 'collectible:pickup';
export const COLLECTIBLE_ALL_COLLECTED = 'collectible:allCollected';

export interface CollectiblePickupPayload { index: number; type: string; value: number; x: number; y: number }

// ── Inventory ───────────────────────────────────────────────
export const INVENTORY_CHANGE = 'inventory:change';
export const INVENTORY_FULL = 'inventory:full';

export interface InventoryChangePayload { resource: string; amount: number; total: number }

// ── Checkpoint ──────────────────────────────────────────────
export const CHECKPOINT_ACTIVATE = 'checkpoint:activate';
export const CHECKPOINT_RESPAWN = 'checkpoint:respawn';

export interface CheckpointPayload { id: string; x: number; y: number }

// ── Wall ────────────────────────────────────────────────────
export const WALL_CONTACT = 'wall:contact';
export const WALL_SLIDE = 'wall:slide';
export const WALL_JUMP = 'wall:jump';

// ── Camera ──────────────────────────────────────────────────
export const CAMERA_MOVE = 'camera:move';
export const CAMERA_SHAKE = 'camera:shake';

// ── Combo System ────────────────────────────────────────────
export const COMBO_HIT = 'combo:hit';
export const COMBO_BREAK = 'combo:break';

export interface ComboHitPayload { count: number; multiplier: number }

// ── Power Up ────────────────────────────────────────────────
export const POWERUP_ACTIVATE = 'powerup:activate';
export const POWERUP_EXPIRE = 'powerup:expire';

// ── Difficulty ──────────────────────────────────────────────
export const DIFFICULTY_UPDATE = 'difficulty:update';

// ── Quiz ────────────────────────────────────────────────────
export const QUIZ_QUESTION = 'quiz:question';
export const QUIZ_CORRECT = 'quiz:correct';
export const QUIZ_WRONG = 'quiz:wrong';
export const QUIZ_FINISHED = 'quiz:finished';

// ── Randomizer ──────────────────────────────────────────────
export const RANDOMIZER_SPINNING = 'randomizer:spinning';
export const RANDOMIZER_RESULT = 'randomizer:result';

// ── Expression ──────────────────────────────────────────────
export const EXPRESSION_DETECTED = 'expression:detected';

// ── Gesture ─────────────────────────────────────────────────
export const GESTURE_SHOW = 'gesture:show';
export const GESTURE_MATCH = 'gesture:match';
export const GESTURE_FAIL = 'gesture:fail';

// ── BeatMap ─────────────────────────────────────────────────
export const BEAT_HIT = 'beat:hit';
export const BEAT_MISS = 'beat:miss';

// ── Match Engine ────────────────────────────────────────────
export const MATCH_FOUND = 'match:found';
export const MATCH_COMPLETE = 'match:complete';
export const MATCH_FAIL = 'match:fail';

// ── Runner ──────────────────────────────────────────────────
export const RUNNER_LANE_CHANGE = 'runner:laneChange';
export const RUNNER_DISTANCE = 'runner:distance';

// ── Dress Up ────────────────────────────────────────────────
export const DRESSUP_EQUIP = 'dressup:equip';
export const DRESSUP_UNEQUIP = 'dressup:unequip';
export const DRESSUP_SNAPSHOT = 'dressup:snapshot';

// ── Branch State Machine ────────────────────────────────────
export const BRANCH_STATE_CHANGE = 'branch:stateChange';
export const BRANCH_END = 'branch:end';
export const BRANCH_CHOICE = 'branch:choice';

// ── Plane Detection ─────────────────────────────────────────
export const PLANE_DETECTED = 'plane:detected';

// ── Health ─────────────────────────────────────────────────
export const HEALTH_CHANGE = 'health:change';
export const HEALTH_ZERO = 'health:zero';

export interface HealthChangePayload { id: string; hp: number; maxHp: number; delta: number }
export interface HealthZeroPayload { id: string }

// ── Shield ─────────────────────────────────────────────────
export const SHIELD_BLOCK = 'shield:block';
export const SHIELD_BREAK = 'shield:break';
export const SHIELD_RECHARGE = 'shield:recharge';

export interface ShieldBlockPayload { chargesRemaining: number }
export interface ShieldRechargePayload { chargesRemaining: number }

// ── Projectile ─────────────────────────────────────────────
export const PROJECTILE_FIRE = 'projectile:fire';
export const PROJECTILE_DESTROYED = 'projectile:destroyed';

export interface ProjectileFirePayload { id: string; x: number; y: number; dx: number; dy: number; speed: number; damage: number }
export interface ProjectileDestroyedPayload { id: string }

// ── BulletPattern ──────────────────────────────────────────
export const BULLETPATTERN_FIRE = 'bulletpattern:fire';

export interface BulletPatternFirePayload { directions: Array<{ dx: number; dy: number }> }

// ── Aim ────────────────────────────────────────────────────
export const AIM_UPDATE = 'aim:update';

export interface AimUpdatePayload { dx: number; dy: number; targetId?: string }

// ── EnemyAI ────────────────────────────────────────────────
export const ENEMY_MOVE = 'enemy:move';
export const ENEMY_ATTACK = 'enemy:attack';
export const ENEMY_DEATH = 'enemy:death';

export interface EnemyMovePayload { id: string; x: number; y: number; state: string }
export interface EnemyAttackPayload { id: string; damage: number }
export interface EnemyDeathPayload { id: string; x: number; y: number }

// ── WaveSpawner ────────────────────────────────────────────
export const WAVE_START = 'wave:start';
export const WAVE_SPAWN = 'wave:spawn';
export const WAVE_COMPLETE = 'wave:complete';
export const WAVE_ALL_COMPLETE = 'wave:allComplete';

export interface WaveStartPayload { wave: number; enemyCount: number }
export interface WaveCompletePayload { wave: number }
export interface WaveSpawnPayload { id: string; x: number; y: number; wave: number }
export interface WaveAllCompletePayload { totalWaves: number }

// ── LevelUp ────────────────────────────────────────────────
export const LEVELUP_XP = 'levelup:xp';
export const LEVELUP_LEVELUP = 'levelup:levelup';

export interface LevelUpXpPayload { current: number; required: number; delta: number }
export interface LevelUpPayload { level: number; previous: number }

// ── StatusEffect ───────────────────────────────────────────
export const STATUS_APPLY = 'status:apply';
export const STATUS_STACK = 'status:stack';
export const STATUS_TICK = 'status:tick';
export const STATUS_EXPIRE = 'status:expire';
export const STATUS_IMMUNITY = 'status:immunity';

export interface StatusApplyPayload { name: string; type: string; duration: number; stacks: number }
export interface StatusStackPayload { name: string; stacks: number }
export interface StatusTickPayload { name: string; value: number }
export interface StatusExpirePayload { name: string }
export interface StatusImmunityPayload { name: string }

// ── EquipmentSlot ──────────────────────────────────────────
export const EQUIPMENT_EQUIP = 'equipment:equip';
export const EQUIPMENT_UNEQUIP = 'equipment:unequip';
export const EQUIPMENT_STATS = 'equipment:stats';

export interface EquipmentPayload { slot: string; item: string }
export interface EquipmentStatsPayload { stats: Record<string, number> }

// ── EnemyDrop ──────────────────────────────────────────────
export const DROP_SPAWN = 'drop:spawn';

export interface DropSpawnPayload { id: string; x: number; y: number; loot: string }

// ── SkillTree ──────────────────────────────────────────────
export const SKILL_UNLOCK = 'skill:unlock';
export const SKILL_ACTIVATE = 'skill:activate';
export const SKILL_COOLDOWN = 'skill:cooldown';

export interface SkillPayload { skillId: string; name: string }
export interface SkillCooldownPayload { skillId: string; remaining: number; total: number }

// ── Physics2D ──────────────────────────────────────────────
export const PHYSICS2D_CONTACT_BEGIN = 'physics2d:contact-begin';
export const PHYSICS2D_CONTACT_END = 'physics2d:contact-end';
export const PHYSICS2D_ADD_BODY = 'physics2d:add-body';
export const PHYSICS2D_REMOVE_BODY = 'physics2d:remove-body';

export interface Physics2DContactPayload {
  entityIdA: string;
  entityIdB: string;
  tagA?: string;
  tagB?: string;
  pointX: number;
  pointY: number;
  normalX: number;
  normalY: number;
}

// ── Tween ──────────────────────────────────────────────────
export const TWEEN_START = 'tween:start';
export const TWEEN_COMPLETE = 'tween:complete';
export const TWEEN_UPDATE = 'tween:update';
export const TWEEN_TRIGGER = 'tween:trigger';

export interface TweenStartPayload { entityId: string; clipId: string }
export interface TweenCompletePayload { entityId: string; clipId: string }
export interface TweenUpdatePayload { entityId: string; properties: Record<string, number> }
export interface TweenTriggerPayload { clipId: string; entityId: string }

// ── DialogueSystem ─────────────────────────────────────────
export const DIALOGUE_START = 'dialogue:start';
export const DIALOGUE_NODE = 'dialogue:node';
export const DIALOGUE_CHOICE = 'dialogue:choice';
export const DIALOGUE_END = 'dialogue:end';

export interface DialogueNodePayload { nodeId: string; speaker: string; text: string }
export interface DialogueChoicePayload { nodeId: string; choiceIndex: number; text: string }
