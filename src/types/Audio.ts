/**
 * Audio Type System - Audio Lifecycle and Playback Management
 *
 * Defines explicit lifecycle management to prevent race conditions on initialization.
 * Tracks audio state from uninitialized through playback to disposed.
 */

/**
 * Audio playback state - what's currently happening with the sound
 */
export type AudioPlaybackState = 'stopped' | 'playing' | 'paused';

/**
 * Audio lifecycle - full lifecycle from creation to disposal
 * Critical for preventing race conditions in Web Audio API setup
 * State machine: uninitialized → initializing → ready → playing → disposed
 */
export type AudioLifecycle = 'uninitialized' | 'initializing' | 'ready' | 'playing' | 'disposed';

/**
 * SoundEffect - A short audio clip (collision, boost, etc.)
 */
export interface SoundEffect {
  /** Unique identifier for this effect */
  id: string;

  /** Always 'effect' for discriminated unions */
  type: 'effect';

  /** Optional URL for external audio file (for future streaming) */
  url?: string;

  /** Duration in milliseconds */
  duration: number;

  /** Volume level 0-1 */
  volume: number;
}

/**
 * MusicTrack - Background music or ambient audio
 */
export interface MusicTrack {
  /** Unique identifier for this track */
  id: string;

  /** Always 'music' for discriminated unions */
  type: 'music';

  /** Optional URL for external audio file */
  url?: string;

  /** Duration in milliseconds */
  duration: number;

  /** Volume level 0-1 */
  volume: number;

  /** Whether to loop when reaching the end */
  loop: boolean;
}

/**
 * PlaybackRequest - Instructions for how to play an audio asset
 * Separates "what to play" from "how to play it"
 */
export interface PlaybackRequest {
  /** Which sound effect or music track to play */
  soundId: string;

  /** Override volume for this playback (0-1, optional) */
  volume?: number;

  /** Delay before starting playback (ms, optional) */
  delay?: number;
}

/**
 * PlaybackRequest - Request object for direct URL playback operations
 * Used for simple audio URL playback with loop and volume control
 */
export interface PlaybackRequestDirect {
  /** Audio file URL to play */
  url: string;

  /** Whether to loop the audio (optional, defaults to false) */
  loop?: boolean;

  /** Volume level 0-1 (optional, defaults to 0.8) */
  volume?: number;
}

/**
 * PlaybackEvent - Notification of playback state change
 */
export interface PlaybackEvent {
  /** What happened: started, stopped, or error */
  type: 'started' | 'stopped' | 'error';

  /** Which sound this event is about */
  soundId: string;

  /** Error message if type='error' */
  error?: string;
}

/**
 * PlaybackEvent - Events emitted by AudioSystem
 * Discriminated union for type-safe event handling
 */
export type PlaybackEventLifecycle = 
  | { type: 'lifecycle-changed'; state: AudioLifecycle }
  | { type: 'playback-started'; url: string }
  | { type: 'playback-stopped' }
  | { type: 'error'; message: string };

/**
 * Event type guards for narrowing PlaybackEventLifecycle
 */
export function isLifecycleEvent(event: PlaybackEventLifecycle): event is { type: 'lifecycle-changed'; state: AudioLifecycle } {
  return event.type === 'lifecycle-changed';
}

export function isPlaybackStartedEvent(event: PlaybackEventLifecycle): event is { type: 'playback-started'; url: string } {
  return event.type === 'playback-started';
}

export function isErrorEvent(event: PlaybackEventLifecycle): event is { type: 'error'; message: string } {
  return event.type === 'error';
}

/**
 * AudioContext - Main interface for audio system
 * Manages initialization, playback, and disposal
 * Lifecycle management prevents race conditions
 */
export interface AudioContext {
  /** Current position in lifecycle state machine */
  lifecycle: AudioLifecycle;

  /**
   * Start playing a sound effect or music track
   * Will reject if lifecycle is not 'ready' or 'playing'
   */
  play(sound: SoundEffect | MusicTrack): Promise<void>;

  /**
   * Stop playing a specific sound
   */
  stop(soundId: string): Promise<void>;

  /**
   * Set volume for a sound (0-1)
   */
  setVolume(soundId: string, volume: number): void;

  /**
   * Clean up all audio resources
   * Called after game ends, transitions to 'disposed'
   */
  dispose(): Promise<void>;
}

/**
 * Type guard - checks if audio context is ready for playback
 * Use before calling play() to ensure initialization is complete
 */
export function isAudioReady(context: AudioContext): boolean {
  return context.lifecycle === 'ready' || context.lifecycle === 'playing';
}

/**
 * Factory function - creates a new audio context
 * Initial lifecycle state is 'uninitialized'
 */
export function createAudioContext(): AudioContext {
  return {
    lifecycle: 'uninitialized',
    play: async () => {
      throw new Error('Audio context not initialized');
    },
    stop: async () => {
      throw new Error('Audio context not initialized');
    },
    setVolume: () => {
      throw new Error('Audio context not initialized');
    },
    dispose: async () => {
      throw new Error('Audio context not initialized');
    },
  };
}
