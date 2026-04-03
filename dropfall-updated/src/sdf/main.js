/**
 * SDF Dropfall - Main Entry Point
 * Rewritten game engine using Signed Distance Fields for rendering
 */

import '../style.css';
import { initGameEngine, getGameEngine } from './game-engine.js';
import { useGameStore } from '../store.js';
import { initInput, getPlayer1Input, getPlayer2Input } from '../input.js';
import { initAudio } from '../audio.js';

// Global state
let engine = null;
let isInitialized = false;
let animationFrameId = null;
let lastFrameTime = Date.now();
let countdownStartTime = null;
let lastGameState = null;

/**
 * Initialize the SDF game
 */
async function initGame() {
    if (isInitialized) return;
    
    try {
        console.log('Starting Dropfall SDF Edition...');
        console.log('SDK Version: 1.0 SDF Ray-Marching');
        
        // Get container
        const container = document.getElementById('app') || document.body;
        console.log('Container:', container);
        console.log('Container size:', container.clientWidth, 'x', container.clientHeight);
        
        // Initialize audio system
        console.log('Initializing audio...');
        initAudio();
        console.log('Audio initialized');
        
        // Initialize SDF game engine
        console.log('Initializing SDF game engine...');
        engine = await initGameEngine(container);
        console.log('Engine initialized:', engine);
        console.log('Renderer:', engine.renderer);
        
        // Set up UI event listeners
        console.log('Setting up UI...');
        setupUI();
        console.log('UI setup complete');
        
        isInitialized = true;
        
        // Start game loop
        console.log('Starting game loop...');
        requestAnimationFrame(gameLoop);
        
        console.log('Dropfall SDF initialized successfully!');
        console.log('=== SDF SYSTEM ACTIVE ===');
    } catch (error) {
        console.error('Failed to initialize Dropfall:', error);
        console.error('Stack:', error.stack);
    }
}

/**
 * Main game loop
 */
function gameLoop(currentTime) {
    if (!isInitialized || !engine) {
        return;
    }
    
    // Calculate delta time
    const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = currentTime;
    
    try {
        // Update game engine
        engine.update(deltaTime);
        
        // Check game state and handle transitions
        const storeState = useGameStore.getState();
        const menu = document.getElementById('menu');
        const hud = document.getElementById('hud');
        
        // Track state changes for countdown
        if (storeState.gameState !== lastGameState) {
            lastGameState = storeState.gameState;
            if (storeState.gameState === 'COUNTDOWN') {
                countdownStartTime = currentTime;
            }
        }
        
        switch (storeState.gameState) {
            case 'MENU':
                // Show menu
                if (menu) menu.classList.remove('hidden');
                if (hud) hud.classList.add('hidden');
                countdownStartTime = null;
                break;
                
            case 'COUNTDOWN':
                // Show countdown
                if (menu) menu.classList.add('hidden');
                if (hud) hud.classList.remove('hidden');
                
                // Show countdown overlay
                const countdownDisplay = document.getElementById('countdown-display');
                if (countdownDisplay) {
                    countdownDisplay.classList.remove('hidden');
                    const elapsed = (currentTime - countdownStartTime) / 1000;
                    const countdownNum = Math.max(0, 3 - Math.floor(elapsed));
                    countdownDisplay.textContent = countdownNum;
                    
                    if (elapsed > 3) {
                        engine.startPlaying();
                    }
                }
                break;
                
            case 'PLAYING':
                // Game is running
                if (menu) menu.classList.add('hidden');
                if (hud) hud.classList.remove('hidden');
                
                // Hide countdown
                const countdown = document.getElementById('countdown-display');
                if (countdown) countdown.classList.add('hidden');
                break;
                
            case 'ROUND_OVER':
                // Show HUD still
                if (menu) menu.classList.add('hidden');
                if (hud) hud.classList.remove('hidden');
                
                // Check for end conditions
                if (storeState.p1Score >= 3 || storeState.p2Score >= 3) {
                    handleGameOver();
                } else {
                    setTimeout(() => engine.startGame(), 2000);
                }
                break;
                
            case 'GAME_OVER':
                // Handle final game over
                if (menu) menu.classList.add('hidden');
                if (hud) hud.classList.add('hidden');
                break;
        }
        
    } catch (error) {
        console.error('Error in game loop:', error);
    }
    
    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Handle game over
 */
function handleGameOver() {
    const storeState = useGameStore.getState();
    const winner = storeState.winner;
    console.log(`Game Over! Winner: ${winner}`);
    
    // Display game over UI
    showGameOverUI(winner);
}

/**
 * Set up UI event listeners
 */
function setupUI() {
    console.log('Setting up UI listeners...');
    
    // Start button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log('Start button clicked');
            const menu = document.getElementById('menu');
            if (menu) menu.classList.add('hidden');
            if (engine) engine.startGame();
        });
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', () => {
            console.log('Settings button clicked');
            settingsPanel.classList.remove('hidden');
        });
    }
    
    // Close settings button
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (closeSettingsBtn && settingsPanel) {
        closeSettingsBtn.addEventListener('click', () => {
            console.log('Close settings clicked');
            settingsPanel.classList.add('hidden');
        });
    }
    
    // Menu navigation buttons
    const restartBtn = document.getElementById('restart-btn');
    const menuBtn = document.getElementById('menu-btn');
    
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            console.log('Restart button clicked');
            if (engine) engine.startGame();
        });
    }
    
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            console.log('Menu button clicked');
            useGameStore.getState().returnToMenu();
            if (engine) engine.reset();
        });
    }
    
    // HUD buttons (during gameplay)
    const hudRestartBtn = document.getElementById('hud-restart-btn');
    const hudMenuBtn = document.getElementById('hud-menu-btn');
    
    if (hudRestartBtn) {
        hudRestartBtn.addEventListener('click', () => {
            console.log('HUD Restart clicked');
            useGameStore.getState().resetScores();
            if (engine) engine.startGame();
        });
    }
    
    if (hudMenuBtn) {
        hudMenuBtn.addEventListener('click', () => {
            console.log('HUD Menu clicked');
            useGameStore.getState().returnToMenu();
            if (engine) engine.reset();
        });
    }
    
    // Tab buttons in settings
    const settingsTabBtn = document.getElementById('settings-tab');
    const powerupsTabBtn = document.getElementById('powerups-tab');
    const settingsContent = document.getElementById('settings-content');
    const powerupsContent = document.getElementById('powerups-content');
    
    if (settingsTabBtn && powerupsTabBtn && settingsContent && powerupsContent) {
        settingsTabBtn.addEventListener('click', () => {
            settingsTabBtn.classList.add('active');
            powerupsTabBtn.classList.remove('active');
            settingsContent.classList.add('active');
            powerupsContent.classList.remove('active');
        });
        
        powerupsTabBtn.addEventListener('click', () => {
            powerupsTabBtn.classList.add('active');
            settingsTabBtn.classList.remove('active');
            powerupsContent.classList.add('active');
            settingsContent.classList.remove('active');
        });
    }
    
    // Settings controls
    setupSettingsUI();
    
    console.log('UI setup complete');
}

/**
 * Setup settings UI
 */
function setupSettingsUI() {
    const settingsMap = {
        'sphere-size': 'sphereSize',
        'sphere-weight': 'sphereWeight',
        'sphere-accel': 'sphereAccel',
        'collision-bounce': 'collisionBounce',
        'arena-size': 'arenaSize',
        'destruction-rate': 'destructionRate',
        'ice-rate': 'iceRate',
        'portal-rate': 'portalRate',
        'bonus-rate': 'bonusRate',
        'boost-regen-speed': 'boostRegenSpeed',
        'boost-drain-rate': 'boostDrainRate',
        'music-volume': 'musicVolume',
        'sfx-volume': 'sfxVolume'
    };
    
    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        
        if (el) {
            el.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                useGameStore.getState().updateSetting(key, value);
                if (valEl) valEl.textContent = value;
            });
        }
    }
}

/**
 * Show game over UI
 */
function showGameOverUI(winner) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Courier New', monospace;
        color: #0ff;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        text-align: center;
        font-size: 2em;
        border: 2px solid #0ff;
        padding: 40px;
        box-shadow: 0 0 20px #0ff;
    `;
    content.innerHTML = `
        <h1>GAME OVER</h1>
        <p>${winner} WINS!</p>
        <button id="game-over-btn" style="
            margin-top: 20px;
            padding: 10px 20px;
            background: #000;
            color: #0ff;
            border: 1px solid #0ff;
            font-family: 'Courier New', monospace;
            font-size: 1em;
            cursor: pointer;
        ">PLAY AGAIN</button>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    const btn = document.getElementById('game-over-btn');
    btn.addEventListener('click', () => {
        overlay.remove();
        engine.reset();
        useGameStore.getState().returnToMenu();
    });
}

/**
 * Handle window resize
 */
window.addEventListener('resize', () => {
    if (engine) {
        // Renderer will handle resize internally
    }
});

/**
 * Handle page visibility
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
    } else {
        lastFrameTime = Date.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
});

// Initialize game when page loads
window.addEventListener('load', initGame);
window.addEventListener('DOMContentLoaded', () => {
    // Ensure game initializes
    if (!isInitialized) {
        initGame();
    }
});

// Handle errors
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

// Export for debugging
window.dropfallDebug = {
    getEngine: () => getGameEngine(),
    getGameState: () => useGameStore.getState(),
    toggleDebug: () => {
        if (engine && engine.renderer && engine.renderer.domElement) {
            engine.renderer.domElement.style.opacity = 
                engine.renderer.domElement.style.opacity === '0.5' ? '1' : '0.5';
        }
    }
};

console.log('Dropfall SDF Edition - Ready to play!');
console.log('Use window.dropfallDebug for development tools');
