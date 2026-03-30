import { z } from 'zod';
import type { GameState, GameMode, Difficulty } from '../types/Game';
import type { InputPayload } from '../types/Input';
import type { PhysicsEvent } from '../types/Physics';
import type { NetworkMessage } from '../types/Network';

/**
 * Game Mode schema - validates game mode selection
 */
export const GameModeSchema = z.union([
  z.literal('1P'),
  z.literal('2P'),
  z.literal('AI'),
]).describe('Game mode: single player, local multiplayer, or AI opponent');

/**
 * Difficulty schema - validates difficulty setting
 */
export const DifficultySchema = z.union([
  z.literal('easy'),
  z.literal('normal'),
  z.literal('hard'),
]).describe('Game difficulty setting');

/**
 * Game Phase schema - validates game state progression
 */
export const GamePhaseSchema = z.union([
  z.literal('menu'),
  z.literal('loading'),
  z.literal('playing'),
  z.literal('paused'),
  z.literal('roundEnd'),
  z.literal('gameEnd'),
]).describe('Current progress through game flow');

/**
 * Arena Bounds schema - validates play area dimensions
 */
export const ArenaBoundsSchema = z.object({
  width: z.number().positive().describe('Arena width in units'),
  height: z.number().positive().describe('Arena height in units'),
  centerX: z.number().describe('Arena center X coordinate'),
  centerY: z.number().describe('Arena center Y coordinate'),
});

/**
 * Entity Position schema - validates entity coordinates
 */
export const EntityPositionSchema = z.object({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
  z: z.number().optional().describe('Z coordinate (optional for 3D)'),
});

/**
 * Entity State schema - validates entity lifecycle
 */
export const EntityStateSchema = z.union([
  z.literal('created'),
  z.literal('ready'),
  z.literal('active'),
  z.literal('destroyed'),
]).describe('Entity lifecycle state');

/**
 * Message Version schema - validates protocol version
 */
export const MessageVersionSchema = z.literal('1.0').describe('Current protocol version');

/**
 * Entity schema - validates individual entities
 */
export const EntitySchema = z.object({
  id: z.string().uuid().describe('Unique entity identifier'),
  type: z.union([
    z.literal('player'),
    z.literal('arena'),
    z.literal('effect'),
    z.literal('particle'),
    z.literal('lightning'),
    z.literal('shockwave'),
  ]).describe('Entity type'),
  state: EntityStateSchema,
  position: EntityPositionSchema,
  metadata: z.object({}).passthrough().optional().describe('Additional entity data'),
});

/**
 * Entity Map schema - validates collection of entities
 */
export const EntityMapSchema = z.object({}).passthrough().describe('Map of entity IDs to entity objects');

/**
 * Game State schema - validates complete game state
 */
export const GameStateSchema = z.object({
  id: z.string().describe('Game instance ID'),
  mode: GameModeSchema.describe('Game mode'),
  phase: GamePhaseSchema.describe('Current phase'),
  difficulty: DifficultySchema.optional().describe('Optional difficulty for single player'),
  players: z.array(z.any()).describe('Player entities'),
  arena: z.any().nullable().describe('Arena entity or null'),
  entities: EntityMapSchema.describe('All active entities (enemies, effects, etc.)'),
  round: z.number().int().min(0).describe('Current round number'),
  score: z.object({
    p1: z.number().int().min(0).describe('Player 1 score'),
    p2: z.number().int().min(0).describe('Player 2 score'),
  }).describe('Current scores'),
  isOnline: z.boolean().describe('Whether this is an online game'),
  createdAt: z.date().describe('Game creation timestamp'),
  updatedAt: z.date().describe('Last update timestamp'),
});

/**
 * Input Source schema - validates input source type
 */
export const InputSourceSchema = z.union([
  z.literal('keyboard'),
  z.literal('gamepad'),
  z.literal('ai'),
]).describe('Where the input originated from');

/**
 * Keyboard Input schema - validates keyboard input data
 */
export const KeyboardInputSchema = z.object({
  source: z.literal('keyboard'),
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  boost: z.boolean(),
  timestamp: z.number(),
});

/**
 * Gamepad Input schema - validates gamepad input data
 */
export const GamepadInputSchema = z.object({
  source: z.literal('gamepad'),
  gamepadIndex: z.number().int().min(0).max(3),
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  boost: z.boolean(),
  analog: z.object({
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
  }),
  timestamp: z.number(),
});

/**
 * AI Input schema - validates AI controller input
 */
export const AIInputSchema = z.object({
  source: z.literal('ai').describe('Input source'),
  difficulty: DifficultySchema.describe('AI difficulty level'),
  targetPosition: z.object({
    x: z.number(),
    y: z.number(),
  }).describe('AI target position'),
  up: z.boolean().describe('Up movement'),
  down: z.boolean().describe('Down movement'),
  left: z.boolean().describe('Left movement'),
  right: z.boolean().describe('Right movement'),
  boost: z.boolean().describe('Boost activation'),
  timestamp: z.number().describe('Input timestamp'),
});

/**
 * Input Payload schema - discriminated union of all input types
 */
export const InputPayloadSchema = z.discriminatedUnion('source', [
  KeyboardInputSchema,
  GamepadInputSchema,
  AIInputSchema,
]);

/**
 * Physics Body schema - validates physics body reference
 */
export const PhysicsBodySchema = z.object({
  rHandle: z.any().describe('Rapier3D handle (any type to avoid import)'),
});

/**
 * Collision Event schema - validates collision detection
 */
export const CollisionEventSchema = z.object({
  type: z.literal('collision'),
  entityA: z.string(),
  entityB: z.string(),
  started: z.boolean().describe('Whether collision started or ended'),
  impulse: z.number().describe('Force of impact'),
});

/**
 * Knockback Event schema - validates knockback application
 */
export const KnockbackEventSchema = z.object({
  type: z.literal('knockback'),
  targetEntity: z.string().describe('Entity being knocked back'),
  force: z.object({
    x: z.number(),
    y: z.number(),
  }).describe('Force vector applied (2D)'),
  duration: z.number().int().describe('How long the knockback effect lasts (ms)'),
});

/**
 * Out of Bounds Event schema - validates arena boundary crossing
 */
export const OutOfBoundsEventSchema = z.object({
  type: z.literal('out-of-bounds'),
  entity: z.string().describe('Entity that went out of bounds'),
  lastPosition: z.object({
    x: z.number(),
    y: z.number(),
  }).describe('Last valid position before going out of bounds'),
  direction: z.union([
    z.literal('up'),
    z.literal('down'),
    z.literal('left'),
    z.literal('right'),
    z.literal('corner'),
  ]).describe('Which side of arena was crossed'),
});

/**
 * Physics Event schema - discriminated union of physics events
 */
export const PhysicsEventSchema = z.discriminatedUnion('type', [
  CollisionEventSchema,
  KnockbackEventSchema,
  OutOfBoundsEventSchema,
]);

/**
 * Audio Lifecycle schema - validates audio state progression
 */
export const AudioLifecycleSchema = z.union([
  z.literal('uninitialized'),
  z.literal('initializing'),
  z.literal('ready'),
  z.literal('playing'),
  z.literal('disposed'),
]).describe('Audio system lifecycle state');

/**
 * Sound Effect schema - validates short audio clips
 */
export const SoundEffectSchema = z.object({
  id: z.string().describe('Unique identifier for this effect'),
  type: z.literal('effect').describe('Discriminator for sound effect'),
  url: z.string().optional().describe('Optional URL for external audio file'),
  duration: z.number().positive().describe('Duration in milliseconds'),
  volume: z.number().min(0).max(1).describe('Volume level 0-1'),
}).describe('Sound effect - a short audio clip');

/**
 * Music Track schema - validates background music
 */
export const MusicTrackSchema = z.object({
  id: z.string().describe('Unique identifier for this track'),
  type: z.literal('music').describe('Discriminator for music track'),
  url: z.string().optional().describe('Optional URL for external audio file'),
  duration: z.number().positive().describe('Duration in milliseconds'),
  volume: z.number().min(0).max(1).describe('Volume level 0-1'),
  loop: z.boolean().describe('Whether to loop when reaching the end'),
}).describe('Music track - background music or ambient audio');

/**
 * Audio Asset schema - discriminated union of sound effect and music track
 */
export const AudioAssetSchema = z.discriminatedUnion('type', [
  SoundEffectSchema,
  MusicTrackSchema,
]).describe('Audio asset - either sound effect or music track');

/**
 * Playback Request schema - instructions for audio playback
 */
export const PlaybackRequestSchema = z.object({
  soundId: z.string().describe('Which sound effect or music track to play'),
  volume: z.number().min(0).max(1).optional().describe('Override volume for this playback (0-1)'),
  delay: z.number().int().min(0).optional().describe('Delay before starting playback (ms)'),
  loop: z.boolean().optional().describe('Whether to loop the audio'),
}).describe('Instructions for how to play an audio asset');

/**
 * Audio Context schema - validates audio system interface
 */
export const AudioContextSchema = z.object({
  lifecycle: AudioLifecycleSchema,
  play: z.function(),
  stop: z.function(),
  setVolume: z.function(),
  dispose: z.function(),
});

// ===================================
// Audio Playback Schemas (Phase 3 Wave 1)
// ===================================

/**
 * PlaybackRequestDirect schema - validates direct URL-based play() arguments
 */
export const PlaybackRequestDirectSchema = z.object({
  url: z.string().url('Invalid audio URL'),
  loop: z.boolean().optional().default(false),
  volume: z.number().min(0).max(1).optional().default(0.8),
});

export type ValidatedPlaybackRequestDirect = z.infer<typeof PlaybackRequestDirectSchema>;

/**
 * PlaybackEventLifecycle schema - discriminated union of audio lifecycle events
 */
export const PlaybackEventLifecycleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('lifecycle-changed'),
    state: AudioLifecycleSchema,
  }),
  z.object({
    type: z.literal('playback-started'),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal('playback-stopped'),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);

export type ValidatedPlaybackEventLifecycle = z.infer<typeof PlaybackEventLifecycleSchema>;

/**
 * Validator functions - safe validation with typed results
 */
export function validatePlaybackRequestDirect(request: unknown) {
  return PlaybackRequestDirectSchema.safeParse(request);
}

export function validatePlaybackEvent(event: unknown) {
  return PlaybackEventLifecycleSchema.safeParse(event);
}

export function validatePlaybackEventLifecycle(event: unknown) {
  return PlaybackEventLifecycleSchema.safeParse(event);
}

/**
 * Runtime type checks - for use before dispatching
 */
export function isValidPlaybackRequest(request: unknown): request is z.infer<typeof PlaybackRequestSchema> {
  return PlaybackRequestSchema.safeParse(request).success;
}

export function isValidPlaybackRequestDirect(request: unknown): request is ValidatedPlaybackRequestDirect {
  return PlaybackRequestDirectSchema.safeParse(request).success;
}

export function isValidPlaybackEvent(event: unknown): event is ValidatedPlaybackEventLifecycle {
  return PlaybackEventLifecycleSchema.safeParse(event).success;
}

export function isValidPlaybackEventLifecycle(event: unknown): event is ValidatedPlaybackEventLifecycle {
  return PlaybackEventLifecycleSchema.safeParse(event).success;
}

/**
 * Network Message Join schema - validates join message
 */
export const NetworkJoinMessageSchema = z.object({
  type: z.literal('join'),
  version: MessageVersionSchema,
  timestamp: z.number().int().describe('Timestamp when message was sent'),
  playerId: z.string(),
  gameMode: GameModeSchema.optional().or(z.literal('ONLINE')).describe('Game mode (1P, 2P, AI, or ONLINE)'),
  playerName: z.string(),
});

/**
 * Network Message Start Round schema - validates round start
 */
export const NetworkStartRoundMessageSchema = z.object({
  type: z.literal('start-round'),
  version: MessageVersionSchema,
  timestamp: z.number().int(),
  roundNumber: z.number().int().min(0),
});

/**
 * Network Message Player Move schema - validates player input transmission
 */
export const NetworkPlayerMoveMessageSchema = z.object({
  type: z.literal('player-move'),
  version: MessageVersionSchema,
  timestamp: z.number().int(),
  playerId: z.string(),
  input: InputPayloadSchema,
});

/**
 * Network Message Boost schema - validates boost activation
 */
export const NetworkBoostMessageSchema = z.object({
  type: z.literal('boost'),
  version: MessageVersionSchema,
  timestamp: z.number().int(),
  playerId: z.string(),
});

/**
 * Network Message Round End schema - validates round completion
 */
export const NetworkRoundEndMessageSchema = z.object({
  type: z.literal('round-end'),
  version: MessageVersionSchema,
  timestamp: z.number().int(),
  winner: z.string(),
  scores: z.object({
    p1: z.number().int().min(0),
    p2: z.number().int().min(0),
  }),
});

/**
 * Network Message Disconnect schema - validates disconnect
 */
export const NetworkDisconnectMessageSchema = z.object({
  type: z.literal('disconnect'),
  version: MessageVersionSchema,
  timestamp: z.number().int(),
  playerId: z.string(),
});

/**
 * Client to Server Message schema - discriminated union
 */
export const ClientToServerMessageSchema = z.discriminatedUnion('type', [
  NetworkJoinMessageSchema,
  NetworkStartRoundMessageSchema,
  NetworkPlayerMoveMessageSchema,
  NetworkBoostMessageSchema,
  NetworkRoundEndMessageSchema,
  NetworkDisconnectMessageSchema,
]);

/**
 * Server to Client Message schema - discriminated union (mirrored for now)
 */
export const ServerToClientMessageSchema = z.discriminatedUnion('type', [
  NetworkJoinMessageSchema,
  NetworkStartRoundMessageSchema,
  NetworkPlayerMoveMessageSchema,
  NetworkBoostMessageSchema,
  NetworkRoundEndMessageSchema,
  NetworkDisconnectMessageSchema,
]);

/**
 * Network Message schema - discriminated union (for quick validation)
 */
export const NetworkMessageSchema = z.discriminatedUnion('type', [
  NetworkJoinMessageSchema,
  NetworkStartRoundMessageSchema,
  NetworkPlayerMoveMessageSchema,
  NetworkBoostMessageSchema,
  NetworkRoundEndMessageSchema,
  NetworkDisconnectMessageSchema,
]);

// ===================================
// Validator Functions (Main API)
// ===================================

/**
 * Validates a complete game state
 * Throws ZodError if invalid
 */
export function validateGameState(state: unknown): any {
  return GameStateSchema.parse(state);
}

/**
 * Safely validates game state, returns error without throwing
 */
export function validateGameStateResult(state: unknown) {
  return GameStateSchema.safeParse(state);
}

/**
 * Validates player input payload
 * Throws ZodError if invalid
 */
export function validateInputPayload(input: unknown): any {
  return InputPayloadSchema.parse(input);
}

/**
 * Safely validates input payload, returns error without throwing
 */
export function validateInputPayloadResult(input: unknown) {
  return InputPayloadSchema.safeParse(input);
}

/**
 * Validates physics event
 * Throws ZodError if invalid
 */
export function validatePhysicsEvent(event: unknown): any {
  return PhysicsEventSchema.parse(event);
}

/**
 * Safely validates physics event, returns error without throwing
 */
export function validatePhysicsEventResult(event: unknown) {
  return PhysicsEventSchema.safeParse(event);
}

/**
 * Validates network message
 * Throws ZodError if invalid
 */
export function validateNetworkMessage(message: unknown): any {
  return NetworkMessageSchema.parse(message);
}

/**
 * Safely validates network message, returns error without throwing
 */
export function validateNetworkMessageResult(message: unknown) {
  return NetworkMessageSchema.safeParse(message);
}

/**
 * Checks if a message version is compatible with current protocol
 */
export function isVersionCompatible(version: string): boolean {
  return version === '1.0';
}

/**
 * Validates a playback request
 * Throws ZodError if invalid
 */
export function validatePlaybackRequest(request: unknown): z.infer<typeof PlaybackRequestSchema> {
  return PlaybackRequestSchema.parse(request);
}

/**
 * Safely validates playback request, returns error without throwing
 */
export function validatePlaybackRequestResult(request: unknown) {
  return PlaybackRequestSchema.safeParse(request);
}

/**
 * Validates an audio asset (sound effect or music track)
 * Throws ZodError if invalid
 */
export function validateAudioAsset(asset: unknown): z.infer<typeof AudioAssetSchema> {
  return AudioAssetSchema.parse(asset);
}

/**
 * Safely validates audio asset, returns error without throwing
 */
export function validateAudioAssetResult(asset: unknown) {
  return AudioAssetSchema.safeParse(asset);
}
