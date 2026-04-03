/**
 * Replay player system - plays back recorded frame history
 */

import type { FrameState } from './ReplayRecorder.js';

export type PlaybackMode = 'normal' | 'paused' | 'stopped';

/**
 * Replay playback controller
 * Manages frame playback with speed control and seeking
 */
export class ReplayPlayer {
  private buffer: FrameState[] = [];
  private currentIndex: number = 0;
  private playbackSpeed: number = 1.0;
  private mode: PlaybackMode = 'stopped';
  private elapsedTime: number = 0;

  constructor(buffer?: FrameState[]) {
    if (buffer) {
      this.loadBuffer(buffer);
    }
  }

  /**
   * Load a frame buffer for playback
   */
  loadBuffer(buffer: FrameState[]): void {
    this.buffer = [...buffer];
    this.currentIndex = 0;
    this.elapsedTime = 0;
    this.mode = 'stopped';
  }

  /**
   * Start playback from current position
   */
  play(): void {
    if (this.buffer.length === 0) return;
    this.mode = 'normal';
  }

  /**
   * Pause playback (maintains position)
   */
  pause(): void {
    this.mode = 'paused';
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.mode = 'stopped';
    this.currentIndex = 0;
    this.elapsedTime = 0;
  }

  /**
   * Set playback speed (0.1x to 2.0x)
   */
  setSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.1, Math.min(2.0, speed));
  }

  /**
   * Seek to specific frame index
   */
  seekToFrame(index: number): void {
    this.currentIndex = Math.max(0, Math.min(index, this.buffer.length - 1));
  }

  /**
   * Seek to specific time in seconds
   */
  seekToTime(seconds: number): void {
    const frameIndex = Math.floor((seconds * 60) / 1000); // 60fps, seconds to ms
    this.seekToFrame(frameIndex);
  }

  /**
   * Update playback (call once per frame from game loop)
   */
  update(deltaTimeMs: number): void {
    if (this.mode !== 'normal' || this.buffer.length === 0) return;

    // Advance elapsed time and calculate frame index
    this.elapsedTime += deltaTimeMs * this.playbackSpeed;
    
    // Simplified frame advancement: ~16.67ms per frame at 60fps
    const frameAdvance = (deltaTimeMs * this.playbackSpeed) / (1000 / 60);
    this.currentIndex += frameAdvance;

    // Auto-stop at end
    if (this.currentIndex >= this.buffer.length - 1) {
      this.currentIndex = this.buffer.length - 1;
      this.mode = 'paused';
    }
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): FrameState | null {
    if (this.buffer.length === 0) return null;
    const index = Math.floor(this.currentIndex);
    return this.buffer[Math.min(index, this.buffer.length - 1)] || null;
  }

  /**
   * Get frame by index
   */
  getFrameAt(index: number): FrameState | null {
    if (index < 0 || index >= this.buffer.length) return null;
    return this.buffer[index];
  }

  /**
   * Get playback progress (0.0 to 1.0)
   */
  getProgress(): number {
    if (this.buffer.length === 0) return 0;
    return this.currentIndex / (this.buffer.length - 1);
  }

  /**
   * Get current playback mode
   */
  getMode(): PlaybackMode {
    return this.mode;
  }

  /**
   * Get current playback time in milliseconds
   */
  getCurrentTime(): number {
    if (this.buffer.length === 0) return 0;
    const frame = this.getCurrentFrame();
    return frame?.timestamp || 0;
  }

  /**
   * Get total duration in milliseconds
   */
  getTotalDuration(): number {
    if (this.buffer.length === 0) return 0;
    const lastFrame = this.buffer[this.buffer.length - 1];
    return lastFrame?.timestamp || 0;
  }

  /**
   * Get playback statistics
   */
  getStats() {
    return {
      mode: this.mode,
      currentIndex: Math.floor(this.currentIndex),
      totalFrames: this.buffer.length,
      currentTime: this.getCurrentTime(),
      totalDuration: this.getTotalDuration(),
      progress: this.getProgress(),
      speed: this.playbackSpeed,
    };
  }

  /**
   * Check if playback is complete
   */
  isComplete(): boolean {
    return this.currentIndex >= this.buffer.length - 1 && this.mode !== 'normal';
  }
}
