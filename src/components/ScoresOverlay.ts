/**
 * Scores overlay - displays player scores during gameplay
 */

import { useGameStore } from '../store.js';

export function createScoresOverlay() {
  const container = document.createElement('div');
  container.id = 'scores-overlay';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: white;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,255,255,0.5);
    font-size: 24px;
    pointer-events: none;
    letter-spacing: 1px;
  `;
  document.body.appendChild(container);

  let unsubscribe: (() => void) | null = null;

  // Subscribe to store updates
  unsubscribe = useGameStore.subscribe(
    (state) => {
      const { p1Name, p2Name, p1Score, p2Score, gameState } = state;
      
      // Only show scores during gameplay and round over
      if (gameState === 'PLAYING' || gameState === 'ROUND_OVER' || gameState === 'COUNTDOWN') {
        container.style.display = 'block';
        container.innerHTML = `
          <div style="text-align: right;">
            <div style="font-size: 16px; margin-bottom: 8px; opacity: 0.8;">Match Score</div>
            <div style="font-size: 32px; margin-bottom: 4px; color: #ffff00;">${p1Name}</div>
            <div style="font-size: 32px; margin-bottom: 12px; color: #00ffff;">→ ${p1Score}</div>
            <div style="font-size: 32px; margin-bottom: 4px; color: #ffff00;">${p2Name}</div>
            <div style="font-size: 32px; color: #00ffff;">→ ${p2Score}</div>
          </div>
        `;
      } else {
        container.style.display = 'none';
      }
    }
  );

  return { container, unsubscribe };
}

/**
 * Cleanup function for scores overlay
 */
export function removeScoresOverlay() {
  const overlay = document.getElementById('scores-overlay');
  if (overlay) {
    overlay.remove();
  }
}
