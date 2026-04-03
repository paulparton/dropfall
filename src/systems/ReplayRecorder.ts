/**
 * Replay recorder system - records frame history for replay functionality
 */

export interface EntityState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  boost: number;
  health?: number;
}

export interface FrameState {
  timestamp: number;
  frameNumber: number;
  player1: EntityState;
  player2: EntityState;
  winner?: string | null;
}

/**
 * Circular buffer-based replay recorder
 * Stores frame history with automatic trimming for memory management
 */
export class ReplayRecorder {
  private _buffer: FrameState[] = [];
  private maxFrames: number = 1000; // ~16 seconds at 60fps
  private isRecording: boolean = false;
  private frameCount: number = 0;
  private startTime: number = 0;
  private maxMemoryBytes: number = 5 * 1024 * 1024; // 5MB limit

  constructor(maxFrames: number = 1000) {
    this.maxFrames = maxFrames;
  }

  /**
   * Get the buffer directly (for external access)
   */
  get buffer(): FrameState[] {
    return [...this._buffer];
  }

  /**
   * Start recording frames
   */
  startRecording(): void {
    this.isRecording = true;
    this.frameCount = 0;
    this.startTime = Date.now();
    this._buffer = [];
  }

  /**
   * Stop recording frames
   */
  stopRecording(): void {
    this.isRecording = false;
  }

  /**
   * Record a single frame
   */
  recordFrame(frameState: FrameState): void {
    if (!this.isRecording) return;

    frameState.frameNumber = this.frameCount;
    frameState.timestamp = Date.now() - this.startTime;

    this._buffer.push(frameState);
    this.frameCount++;

    // Auto-trim oldest frames if buffer exceeds size limit
    if (this._buffer.length > this.maxFrames) {
      this._buffer.shift();
    }

    // Estimate memory usage and trim if needed
    const estimatedMemory = this._buffer.length * 200; // ~200 bytes per frame
    if (estimatedMemory > this.maxMemoryBytes) {
      this._buffer = this._buffer.slice(-Math.floor(this.maxFrames * 0.8));
    }
  }

  /**
   * Get the complete recorded buffer
   */
  getBuffer(): FrameState[] {
    return [...this._buffer];
  }

  /**
   * Get a frame by index
   */
  getFrameAt(index: number): FrameState | null {
    if (index < 0 || index >= this._buffer.length) {
      return null;
    }
    return this._buffer[index];
  }

  /**
   * Get last N frames
   */
  getLastFrames(count: number): FrameState[] {
    const start = Math.max(0, this._buffer.length - count);
    return this._buffer.slice(start);
  }

  /**
   * Get frame range by indices
   */
  getFrameRange(startIndex: number, endIndex: number): FrameState[] {
    const start = Math.max(0, startIndex);
    const end = Math.min(this._buffer.length, endIndex + 1);
    return this._buffer.slice(start, end);
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this._buffer = [];
    this.frameCount = 0;
    this.startTime = 0;
  }

  /**
   * Check if recorder is actively recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording statistics
   */
  getStats() {
    return {
      isRecording: this.isRecording,
      frameCount: this._buffer.length,
      maxFrames: this.maxFrames,
      estimatedDurationSeconds: this._buffer.length / 60, // 60fps
      estimatedMemoryBytes: this._buffer.length * 200,
    };
  }

  /**
   * Export buffer to JSON for saving/loading
   */
  exportJSON(): string {
    return JSON.stringify({
      buffer: this._buffer,
      stats: this.getStats(),
      exportTime: new Date().toISOString(),
    });
  }

  /**
   * Import buffer from JSON
   */
  importJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.buffer)) {
        return false;
      }
      this._buffer = data.buffer;
      this.frameCount = this._buffer.length;
      return true;
    } catch {
      return false;
    }
  }
}

// Global singleton instance
export let replayRecorder = new ReplayRecorder();

/**
 * Reset the global replay recorder
 */
export function resetReplayRecorder(): void {
  replayRecorder = new ReplayRecorder();
}
