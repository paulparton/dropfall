/**
 * Replay modal - UI for viewing recorded game replays
 */

import type { FrameState } from '../systems/ReplayRecorder.js';
import { ReplayPlayer } from '../systems/ReplayPlayer.js';
import { ReplayRenderer, CAMERA_MODES } from '../systems/ReplayRenderer.js';

export interface ReplayModalOptions {
  title?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  onClose?: () => void;
  player1?: any;
  player2?: any;
  camera?: any;
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
    player1,
    player2,
    camera: sceneCamera,
  } = options;

  const modal = document.createElement('div');
  modal.id = 'replay-modal';
  modal.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(10, 10, 40, 0.88);
    padding: 10px 24px;
    color: white;
    border-top: 2px solid #00ffff;
    text-align: center;
    font-family: Arial, sans-serif;
    box-shadow: 0 -4px 20px rgba(0, 255, 255, 0.2);
  `;

  const player = new ReplayPlayer(buffer);

  // Create renderer to apply frame data to 3D scene
  let replayRenderer: ReplayRenderer | null = null;
  if (player1 && player2 && sceneCamera) {
    replayRenderer = new ReplayRenderer(player1, player2, sceneCamera, player);
    replayRenderer.start();
  }

  // Calculate duration
  const lastFrame = buffer.length > 0 ? buffer[buffer.length - 1] : undefined;
  const totalDuration = lastFrame ? lastFrame.timestamp : 0;
  modal.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; max-width: 1100px; margin: 0 auto;">
      <span style="color: #00ffff; font-weight: bold; font-size: 14px; white-space: nowrap;">${title}</span>
      <div id="replay-progress" style="flex: 1; cursor: pointer; min-width: 120px;">
        <div style="background: rgba(0, 255, 255, 0.2); height: 6px; border-radius: 3px; overflow: hidden;">
          <div id="progress-bar" style="height: 100%; width: 0%; background: #00ffff; transition: width 0.1s;"></div>
        </div>
        <div id="time-display" style="font-size: 11px; margin-top: 2px; opacity: 0.7;">
          <span id="current-time">0.0</span>s / <span id="total-time">${(totalDuration / 1000).toFixed(1)}</span>s
        </div>
      </div>
      ${showControls ? `
      <div id="replay-controls" style="display: flex; gap: 6px;">
        <button id="play-btn" style="padding: 5px 14px; background: #00ff00; color: black; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">Play</button>
        <button id="pause-btn" style="padding: 5px 14px; background: #ffaa00; color: black; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">Pause</button>
        <button id="speed-btn" style="padding: 5px 14px; background: #0088ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">1x</button>
        <div id="camera-combo" style="position: relative; display: inline-flex;">
          <button id="camera-btn" style="padding: 5px 12px; background: #8800ff; color: white; border: none; border-radius: 4px 0 0 4px; cursor: pointer; font-weight: bold; font-size: 12px;">🎥 Default</button>
          <button id="camera-dropdown-btn" style="padding: 5px 6px; background: #6600cc; color: white; border: none; border-radius: 0 4px 4px 0; cursor: pointer; font-size: 10px; border-left: 1px solid rgba(255,255,255,0.2);">▼</button>
          <div id="camera-dropdown" style="display: none; position: absolute; bottom: 100%; left: 0; margin-bottom: 4px; background: rgba(10, 10, 40, 0.95); border: 1px solid #8800ff; border-radius: 4px; overflow: hidden; min-width: 120px;"></div>
        </div>
      </div>
      ` : ''}
      <button id="close-btn" style="padding: 5px 14px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; white-space: nowrap;">Close</button>
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
  const cameraBtn = modal.querySelector('#camera-btn') as HTMLButtonElement;

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
      if (player.isComplete()) {
        player.seekToFrame(0);
      }
      player.play();
      renderFrame();
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
      if (speed !== undefined) {
        player.setSpeed(speed);
        speedBtn.textContent = `${speed}x`;
      }
    });
  }

  let cameraModeIndex = 0;
  const cameraDropdownBtn = modal.querySelector('#camera-dropdown-btn') as HTMLButtonElement;
  const cameraDropdown = modal.querySelector('#camera-dropdown') as HTMLElement;

  function selectCameraMode(index: number) {
    cameraModeIndex = index;
    const cam = CAMERA_MODES[cameraModeIndex];
    if (cam && replayRenderer) {
      replayRenderer.setCameraMode(cam.mode);
      if (cameraBtn) cameraBtn.textContent = `🎥 ${cam.label}`;
    }
    if (cameraDropdown) cameraDropdown.style.display = 'none';
  }

  // Main button: cycle through modes
  if (cameraBtn && replayRenderer) {
    cameraBtn.addEventListener('click', () => {
      selectCameraMode((cameraModeIndex + 1) % CAMERA_MODES.length);
    });
  }

  // Dropdown button: toggle mode list
  if (cameraDropdownBtn && cameraDropdown && replayRenderer) {
    // Build dropdown items
    cameraDropdown.innerHTML = CAMERA_MODES.map((cam, i) =>
      `<div class="cam-option" data-index="${i}" style="padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: bold; color: white; white-space: nowrap; transition: background 0.15s;">${cam.label}</div>`
    ).join('');

    // Hover styles
    cameraDropdown.querySelectorAll('.cam-option').forEach((el) => {
      (el as HTMLElement).addEventListener('mouseenter', () => {
        (el as HTMLElement).style.background = 'rgba(136, 0, 255, 0.4)';
      });
      (el as HTMLElement).addEventListener('mouseleave', () => {
        (el as HTMLElement).style.background = 'transparent';
      });
      (el as HTMLElement).addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '0', 10);
        selectCameraMode(index);
      });
    });

    cameraDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cameraDropdown.style.display = cameraDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!modal.contains(e.target as Node)) {
        cameraDropdown.style.display = 'none';
      }
    });
  }

  if (progressContainer && buffer.length > 0) {
    progressContainer.addEventListener('click', (e: MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const percentage = (e.clientX - rect.left) / rect.width;
      const frameIndex = Math.floor(percentage * (buffer.length - 1));
      player.seekToFrame(frameIndex);
      renderFrame();
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

  // Render current frame to scene (without advancing playback)
  function renderFrame() {
    if (replayRenderer) replayRenderer.updateScene();
    updateUI();
  }

  // Update loop (call from game loop)
  let loopActive = false;
  function updateLoop() {
    if (!loopActive) return;
    if (player.getMode() === 'normal') {
      player.update(16.67); // 60fps assumption
    }
    renderFrame();
    requestAnimationFrame(updateLoop);
  }

  function startLoop() {
    if (!loopActive) {
      loopActive = true;
      updateLoop();
    }
  }

  renderFrame();
  startLoop();

  // Close function
  function close() {
    loopActive = false;
    player.stop();
    if (replayRenderer) replayRenderer.stop();
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
