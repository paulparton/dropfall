/**
 * Input Type System - Keyboard, Gamepad, and AI Input Types
 *
 * Defines normalized input payloads from all sources with discriminated union.
 * Enables unified handling of keyboard, gamepad, and AI controller input.
 */

/**
 * Input source discriminant - where the input came from
 */
export type InputSource = 'keyboard' | 'gamepad' | 'ai';

/**
 * KeyboardInput - Input from keyboard keys
 * Boolean flags for each direction and boost action
 */
export interface KeyboardInput {
  source: 'keyboard';
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  /** Timestamp when input was captured (ms) */
  timestamp: number;
}

/**
 * GamepadInput - Input from physical gamepad/controller
 * Includes both button presses and analog stick position
 */
export interface GamepadInput {
  source: 'gamepad';
  /** Index of gamepad from navigator.getGamepads() */
  gamepadIndex: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  /** Analog stick position: x and y normalized to -1..1 */
  analog: {
    x: number;
    y: number;
  };
  /** Timestamp when input was captured (ms) */
  timestamp: number;
}

/**
 * AIInput - Input from AI controller
 * Includes difficulty level and target position for AI decision-making
 */
export interface AIInput {
  source: 'ai';
  /** Difficulty level affects AI decision complexity */
  difficulty: 'easy' | 'normal' | 'hard';
  /** Target position AI is trying to reach */
  targetPosition: {
    x: number;
    y: number;
  };
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  /** Timestamp when input was calculated (ms) */
  timestamp: number;
}

/**
 * InputPayload - Discriminated union of all input sources
 * Use source field to narrow the type
 */
export type InputPayload = KeyboardInput | GamepadInput | AIInput;

/**
 * InputHandler - Manages input subscriptions and dispatch
 * Decouples input sources from entity movement logic
 */
export interface InputHandler {
  /** Subscribe to input changes, returns unsubscribe function */
  subscribe(callback: (input: InputPayload) => void): () => void;

  /** Dispatch a new input state */
  dispatch(input: InputPayload): void;

  /** Get the most recently dispatched input */
  getLastInput(): InputPayload | null;

  /** Clean up event listeners and state */
  destroy(): void;
}

/**
 * Type guard - checks if an object is a valid InputPayload
 */
export function isInputPayload(obj: unknown): obj is InputPayload {
  if (typeof obj !== 'object' || obj === null) return false;

  const input = obj as Record<string, unknown>;

  // Check required fields
  if (typeof input.up !== 'boolean') return false;
  if (typeof input.down !== 'boolean') return false;
  if (typeof input.left !== 'boolean') return false;
  if (typeof input.right !== 'boolean') return false;
  if (typeof input.boost !== 'boolean') return false;
  if (typeof input.timestamp !== 'number') return false;

  // Check source discriminant
  const validSources: InputSource[] = ['keyboard', 'gamepad', 'ai'];
  return validSources.includes(input.source as InputSource);
}

/**
 * Source-specific type guard - keyboard input
 */
export function isKeyboardInput(p: InputPayload): p is KeyboardInput {
  return p.source === 'keyboard';
}

/**
 * Source-specific type guard - gamepad input
 */
export function isGamepadInput(p: InputPayload): p is GamepadInput {
  return p.source === 'gamepad' && 'gamepadIndex' in p && 'analog' in p;
}

/**
 * Source-specific type guard - AI input
 */
export function isAIInput(p: InputPayload): p is AIInput {
  return p.source === 'ai' && 'difficulty' in p && 'targetPosition' in p;
}
