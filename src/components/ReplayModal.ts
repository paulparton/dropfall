/**
 * Replay modal - UI for viewing recorded game replays
 */

import type { FrameState } from '../systems/ReplayRecorder.js';
import { ReplayPlayer } from '../systems/ReplayPlayer.js';

export interface ReplayModalOptions {
  title?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  onClose?: () => void;
}

/**
 * Create and display a replay modal
 */
export function createReplayModal(
  buffer: FrameState[],
  options: ReplayModalOptions = {}
): {
  modal: HTMLElement;
  player: ReplayPlayer;
  close: () => void;
} {
  const {
    title = 'Game Replay',
    autoPlay = true,
    showControls = true,
    onClose = () => {},
  } = options;

  const modal = document.createElement('div');
  modal.id = 'replay-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    background: rgba(10, 10, 40, 0.95);
    padding: 30px;
    border-radius: 15px;
    color: white;
    border: 3px solid #00ffff;
    min-width: 500px;
    text-align: center;
    font-family: Arial, sans-serif;
    box-shadow: 0 0 40px rgba(0, 255, 255, 0.3);
  `;

  const player = new ReplayPlayer(buffer);

  // Calculate duration
  const totalDuration = buffer.length > 0 ? buffer[buffer.length - 1].timestamp : 0;
  const durationSeconds = Math.round(totalDuration / 1000);

  modal.innerHTML = `
    <h2 style="margin-top: 0; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);">
      ${title}
    </h2>
    
    <div id="replay-info" style="font-size: 14px; margin-bottom: 20px; opacity: 0.8;">
      Duration: <span id="duration-text">${durationSeconds}s</span> | 
      Frames: <span id="frame-text">${buffer.length}</span>
    </div>

    <div id="replay-progress" style="margin: 20px 0; padding: 0 10px;">
      <div style="background: rgba(0, 255, 255, 0.2); height: 8px; border-radius: 4px; overflow: hidden;">
        <div id="progress-bar" style="height: 100%; width: 0%; background: #00ffff; transition: width 0.1s;"></div>
      </div>
      <div id="time-display" style="font-size: 12px; margin-top: 5px; opacity: 0.7;">
        <span id="current-time">0.0</span>s / <span id="total-time">${(totalDuration / 1000).toFixed(1)}</span>s
      </div>
    </div>

    ${
      showControls
        ? `
    <div id="replay-controls" style="margin: 20px 0; display: flex; gap: 10px; justify-content: center;">
      <button id="play-btn" style="
        padding: 10px 20px;
        background: #00ff00;
        color: black;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        min-width: 80px;
        transition: all 0.2s;
      ">Play</button>
      
      <button id="pause-btn" style="
        padding: 10px 20px;
        background: #ffaa00;
        color: black;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        min-width: 80px;
        transition: all 0.2s;
      ">Pause</button>
      
      <button id="speed-btn" style="
        padding: 10px 20px;
        background: #0088ff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        min-width: 80px;
        transition: all 0.2s;
      ">Speed: 1x</button>
    </div>
    `
        : ''
    }

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(0, 255, 255, 0.2);">
      <button id="close-btn" style="
        padding: 12px 30px;
        background: #ff0000;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        font-size: 16px;
        transition: all 0.2s;
      ">Close</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Speed cycle: 0.5x -> 1x -> 1.5x -> 2x -> 0.5x
  let speedIndex = 1; // Start at 1x
  const speeds = [0.5, 1.0, 1.5, 2.0];
  const speedBtn = modal.querySelector('#speed-btn') as HTMLButtonElement;
  const playBtn = modal.querySelector('#play-btn') as HTMLButtonElement;
  const pauseBtn = modal.querySelector('#pause-btn') as HTMLButtonElement;
  const closeBtn = modal.querySelector('#close-btn') as HTMLButtonElement;
  const progressBar = modal.querySelector('#progress-bar') as HTMLElement;
  const currentTimeSpan = modal.querySelector('#current-time') as HTMLElement;
  const progressContainer = modal.querySelector('#replay-progress') as HTMLElement;

  // Update UI
  function updateUI() {
    const stats = player.getStats();
    const progress = stats.progress * 100;
    const currentSeconds = (stats.currentTime / 1000).toFixed(1);

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (currentTimeSpan) currentTimeSpan.textContent = currentSeconds;

    // Update button states
    if (playBtn) {
      playBtn.style.opacity = player.getMode() === 'normal' ? '0.5' : '1.0';
      playBtn.disabled = player.getMode() === 'normal';
    }
    if (pauseBtn) {
      pauseBtn.style.opacity = player.getMode() !== 'normal' ? '0.5' : '1.0';
      pauseBtn.disabled = player.getMode() !== 'normal';
    }
  }

  // Event listeners
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      player.play();
      updateUI();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      player.pause();
      updateUI();
    });
  }

  if (speedBtn) {
    speedBtn.addEventListener('click', () => {
      speedIndex = (speedIndex + 1) % speeds.length;
      const speed = speeds[speedIndex];
      player.setSpeed(speed);
      speedBtn.textContent = `Speed: ${speed}x`;
    });
  }

  if (progressContainer && buffer.length > 0) {
    progressContainer.addEventListener('click', (e: MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const percentage = (e.clientX - rect.left) / rect.width;
      const frameIndex = Math.floor(percentage * (buffer.length - 1));
      player.seekToFrame(frameIndex);
      updateUI();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      close();
    });
  }

  // Auto-play if requested
  if (autoPlay && buffer.length > 0) {
    player.play();
  }

  // Update loop (call from game loop)
  function updateLoop() {
    player.update(16.67); // 60fps assumption
    updateUI();

    if (!player.isComplete() || player.getMode() === 'normal') {
      requestAnimationFrame(updateLoop);
    }
  }

  updateUI();
  if (autoPlay) {
    updateLoop();
  }

  // Close function
  function close() {
    player.stop();
    modal.remove();
    onClose();
  }

  return {
    modal,
    player,
    close,
  };
}

/**
 * Helper: Show a quick replay clip (e.g., last 3 seconds)
 */
export function showQuickReplayClip(buffer: FrameState[], durationMs: number = 3000) {
  const framesToShow = Math.round((durationMs / 1000) * 60); // 60fps
  const startIndex = Math.max(0, buffer.length - framesToShow);
  const clipBuffer = buffer.slice(startIndex);

  return createReplayModal(clipBuffer, {
    title: 'Falling Replay',
    autoPlay: true,
    showControls: false,
  });
}
