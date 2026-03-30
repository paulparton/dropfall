/**
 * Network Type System - WebSocket Protocol and Message Versioning
 *
 * Defines versioned network protocol for multiplayer communication.
 * All messages include version for forward/backward compatibility.
 */

/**
 * Message protocol version - bump when making breaking changes
 * Format: MAJOR.MINOR (e.g., '1.0', '1.1', '2.0')
 */
export type MessageVersion = '1.0';

/**
 * Current protocol version constant
 */
export const CURRENT_PROTOCOL_VERSION: MessageVersion = '1.0';

/**
 * JoinMessage - Player joins a game
 */
export interface JoinMessage {
  type: 'join';
  version: MessageVersion;
  playerId: string;
  gameMode: '1P' | '2P';
  playerName: string;
}

/**
 * StartRoundMessage - Game initiates a new round
 */
export interface StartRoundMessage {
  type: 'start-round';
  version: MessageVersion;
  roundNumber: number;
}

/**
 * PlayerMoveMessage - Player movement input
 */
export interface PlayerMoveMessage {
  type: 'player-move';
  version: MessageVersion;
  playerId: string;
  input: {
    x: number;
    y: number;
    boost: boolean;
  };
}

/**
 * BoostMessage - Player activates boost
 */
export interface BoostMessage {
  type: 'boost';
  version: MessageVersion;
  playerId: string;
}

/**
 * RoundEndMessage - Round has ended with results
 */
export interface RoundEndMessage {
  type: 'round-end';
  version: MessageVersion;
  winnerId: string;
  score: {
    p1: number;
    p2: number;
  };
}

/**
 * DisconnectMessage - Player disconnects
 */
export interface DisconnectMessage {
  type: 'disconnect';
  version: MessageVersion;
  playerId: string;
  reason: string;
}

/**
 * ClientToServerMessage - Discriminated union of all client-to-server messages
 * Server receives these from connected clients
 */
export type ClientToServerMessage =
  | JoinMessage
  | StartRoundMessage
  | PlayerMoveMessage
  | BoostMessage
  | RoundEndMessage
  | DisconnectMessage;

/**
 * ServerToClientMessage - Messages server sends to clients
 * Mirror of ClientToServerMessage structure for now (can diverge later)
 */
export type ServerToClientMessage =
  | JoinMessage
  | StartRoundMessage
  | PlayerMoveMessage
  | BoostMessage
  | RoundEndMessage
  | DisconnectMessage;

/**
 * NetworkMessage - Complete message with direction
 * Wraps the discriminated union with metadata
 */
export interface NetworkMessage {
  type: string;
  version: MessageVersion;
  /** Timestamp when message was sent (ms since epoch) */
  timestamp: number;
  /** Direction of message flow */
  direction: 'client-to-server' | 'server-to-client';
}

/**
 * NetworkPayload - Raw message bytes with parsing metadata
 */
export interface NetworkPayload {
  type: string;
  version: MessageVersion;
  /** Parsed message body */
  data: unknown;
  /** Original JSON for debugging */
  raw: string;
}

/**
 * Type guard - checks if an object is a valid NetworkMessage
 */
export function isNetworkMessage(obj: unknown): obj is NetworkMessage {
  if (typeof obj !== 'object' || obj === null) return false;

  const msg = obj as Record<string, unknown>;

  if (typeof msg.type !== 'string') return false;
  if (typeof msg.version !== 'string') return false;
  if (typeof msg.timestamp !== 'number') return false;

  // Check direction discriminant
  const validDirections = ['client-to-server', 'server-to-client'];
  if (!validDirections.includes(msg.direction as string)) return false;

  return true;
}

/**
 * Version compatibility check
 * Returns true if the version is compatible with our protocol
 */
export function isVersionCompatible(version: string): boolean {
  const compatibleVersions: MessageVersion[] = ['1.0'];
  return compatibleVersions.includes(version as MessageVersion);
}

/**
 * Message-specific type guard - player move message
 */
export function isPlayerMoveMessage(m: ClientToServerMessage | ServerToClientMessage): m is PlayerMoveMessage {
  return m.type === 'player-move' && 'input' in m;
}

/**
 * Message-specific type guard - join message
 */
export function isJoinMessage(m: ClientToServerMessage | ServerToClientMessage): m is JoinMessage {
  return m.type === 'join' && 'playerId' in m && 'gameMode' in m;
}

/**
 * Message-specific type guard - start round message
 */
export function isStartRoundMessage(m: ClientToServerMessage | ServerToClientMessage): m is StartRoundMessage {
  return m.type === 'start-round' && 'roundNumber' in m;
}

/**
 * Message-specific type guard - round end message
 */
export function isRoundEndMessage(m: ClientToServerMessage | ServerToClientMessage): m is RoundEndMessage {
  return m.type === 'round-end' && 'winnerId' in m && 'score' in m;
}

/**
 * Message-specific type guard - disconnect message
 */
export function isDisconnectMessage(m: ClientToServerMessage | ServerToClientMessage): m is DisconnectMessage {
  return m.type === 'disconnect' && 'reason' in m;
}
