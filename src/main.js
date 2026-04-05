import './style.css';
import * as THREE from 'three';
import { useGameStore } from './store.js';
import { initPhysics, world as physicsWorld } from './physics.js';
import { getPhysicsSystem } from './systems/PhysicsSystem.js';
import { initRenderer, updateRenderer, camera, scene, ambientLight, directionalLight } from './renderer.js';
import { initInput, getPlayer1Input, getPlayer2Input, getConnectedGamepads, getGamepadState } from './input.js';
import { createInputHandler } from './handlers/InputHandler.js';
import { replayRecorder, resetReplayRecorder } from './systems/ReplayRecorder.js';
import { createReplayModal } from './components/ReplayModal.js';
import { createCharacterPreviewPanel, destroyPreviewPanel } from './components/CharacterPreviewPanel';
import { loadLevels, getLevel, createLevelButtons, showLevelSelect, hideLevelSelect } from './levelLoader.js';

// Wrapper functions that use InputHandler when available, fallback to legacy input
function getPlayer1InputUnified() {
    if (inputHandler) {
        const input = inputHandler.getLastInput();
        if (input && input.source === 'keyboard') return input;
    }
    return getPlayer1Input();
}

function getPlayer2InputUnified() {
    if (inputHandler) {
        const input = inputHandler.getLastInput();
        if (input && input.source === 'keyboard') return input;
    }
    return getPlayer2Input();
}
import { Player } from './entities/Player.js';
import { Arena } from './entities/Arena.js';
import { ParticleSystem } from './entities/ParticleSystem.js';
import { LightningSystem } from './entities/LightningSystem.js';
import { ShockwaveSystem } from './entities/ShockwaveSystem.js';
import { initAudio, playMusic, playCollisionSound, setMusicSpeed, updateRollingSound } from './audio.js';
import { POWER_UP_EFFECTS } from './entities/Player.js';
import { AIController } from './ai/AIController.js';
import { online } from './online.js';

// ============================================
// RANDOM BALL WITH HAT GENERATOR
// ============================================
function generateRandomBallWithHat() {
    // Available ball colors
    const ballColors = [
        0xff0000, // Red
        0x00ff00, // Green
        0x0000ff, // Blue
        0xffff00, // Yellow
        0xff00ff, // Magenta
        0x00ffff, // Cyan
        0xff8800, // Orange
        0xff0088, // Pink
        0x88ff00, // Lime
        0x0088ff, // Light blue
    ];
    
    // Available hats
    const hats = ['none', 'santa', 'cowboy', 'afro', 'crown', 'dunce'];
    
    // Pick random color and hat
    const randomColor = ballColors[Math.floor(Math.random() * ballColors.length)];
    const randomHat = hats[Math.floor(Math.random() * hats.length)];
    
    return { color: randomColor, hat: randomHat };
}

function createBallWithHatCanvas(color, hat) {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 120;  // Slightly taller to fit hat
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ball
    const ballX = 50;
    const ballY = 50;
    const ballRadius = 30;
    
    // Convert hex color to RGB
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add shine to ball
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(ballX - 10, ballY - 10, ballRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw hat icons above the ball
    const hatEmojis = {
        'none': '',
        'santa': '🎅',
        'cowboy': '🤠',
        'afro': '🟤',
        'crown': '👑',
        'dunce': '📐'
    };
    
    if (hat !== 'none') {
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(hatEmojis[hat], ballX, ballY - ballRadius - 5);
    }
    
    return canvas.toDataURL();
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
const screens = {
    menu: document.getElementById('menu'),
    gameModeSelect: document.getElementById('game-mode-select'),
    difficultySelect: document.getElementById('difficulty-select'),
    nameEntry: document.getElementById('name-entry'),
    settings: document.getElementById('settings-panel'),
    hud: document.getElementById('hud'),
    gameOver: document.getElementById('game-over'),
    onlineConnect: document.getElementById('online-connect'),
    onlineLobby: document.getElementById('online-lobby'),
    comingSoon: document.getElementById('coming-soon'),
    countdown: document.getElementById('countdown-display'),
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s?.classList.add('hidden'));
    const screen = screens[screenName];
    if (screen) screen.classList.remove('hidden');
}

function hideAllScreens() {
    Object.values(screens).forEach(s => s?.classList.add('hidden'));
}

// ============================================
// POWER-UPS GUIDE
// ============================================
function populatePowerupsGuide() {
    const grid = document.getElementById('powerups-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    POWER_UP_EFFECTS.forEach(powerup => {
        const card = document.createElement('div');
        card.className = 'powerup-card';
        card.style.borderColor = `#${powerup.color.toString(16).padStart(6, '0')}`;
        card.style.color = `#${powerup.color.toString(16).padStart(6, '0')}`;
        
        card.innerHTML = `
            <div class="powerup-card-icon">${powerup.icon}</div>
            <h3 style="margin: 0.5rem 0; font-size: 1.2rem;">${powerup.name}</h3>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">${powerup.description}</p>
        `;
        
        grid.appendChild(card);
    });
}

// ============================================
// GAME STATE
// ============================================
let player1, player2, arena, particles, lightning, shockwaves, aiController;
let inputHandler; // InputHandler instance for unified input processing
let physicsSystem; // PhysicsSystem instance for event-based physics
let selectedLevelData = null; // Custom level loaded from editor
const clock = new THREE.Clock();
let collisionCooldown = 0;
let sceneFlashLight;
let winTimer = 0;
let pendingWinner = null;
let countdownTimer = 3.0;
let nameEntryMode = 'newgame';
let replayModalShown = false;
let replayCountdownInterval = null;
let replayCountdownValue = 10;
let replayCountdownPaused = false;
let roundOverFrozen = false;
let roundOverTimeoutSet = false;
let roundOverLogFrames = 0;

// ============================================
// CHARACTER PREVIEW STATE
// ============================================
let previewScene = null;
let previewCamera = null;
let previewRenderer = null;
let previewBall = null;
let previewAura = null;
let previewHat = null;
let previewRotationX = 0;
let previewRotationY = 0;
let previewBoostEffect = 0;
let previewCurrentColor = 0xff0000;
let previewCurrentHat = 'none';
// Movement & Level
let previewBallPosition = new THREE.Vector3(0, 1, 0);
let previewBallVelocity = new THREE.Vector3(2, 0, 2);
let previewDirectionChangeTimer = 0;
let previewMoveSpeed = 3;
let previewLevel = null;
let previewLastFrameTime = Date.now();

// ============================================
// POWER-UP NOTIFICATIONS
// ============================================
function showPowerUpNotification(playerName, powerUpName, icon, color) {
    const container = document.getElementById('powerup-notifications');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `powerup-notification ${powerUpName.toLowerCase().replace(/\s+/g, '-')}`;
    notification.textContent = `${icon} ${playerName} GOT ${powerUpName} ${icon}`;
    
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    notification.style.cssText = `
        color: ${hexColor};
        text-shadow: 0 0 20px ${hexColor}, 0 0 40px ${hexColor};
        border-color: ${hexColor};
        box-shadow: 0 0 30px ${hexColor} inset, 0 0 50px ${hexColor};
    `;
    
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

window.showPowerUpNotification = showPowerUpNotification;
window.POWER_UP_EFFECTS = POWER_UP_EFFECTS;

// ============================================
// GAME FUNCTIONS
// ============================================

/**
 * Select a custom level from the editor
 */
async function selectLevel(levelId) {
    console.log('[Game] Loading level:', levelId);
    const levelData = await getLevel(levelId);
    if (levelData) {
        selectedLevelData = levelData;
        console.log('[Game] Level loaded:', levelData.name, 'with', levelData.tiles?.length, 'tiles');
        hideLevelSelect();
        showScreen('name-entry');
    } else {
        console.error('[Game] Failed to load level');
    }
}

function startGame(skipNameEntry = false) {
    console.log('[Game] startGame called, initializing audio...');
    initAudio();
    console.log('[Game] initAudio returned, playing music...');
    playMusic();
    console.log('[Game] playMusic called, setting speed...');
    setMusicSpeed(0.5);
    useGameStore.getState().resetScores();

    if (skipNameEntry) {
        doStartGame();
    } else {
        nameEntryMode = 'newgame';
        useGameStore.getState().enterNameEntry();
    }
}

function doStartGame() {
    const state = useGameStore.getState();
    setMusicSpeed(0.6 + (state.p1Score + state.p2Score) * 0.1);
    useGameStore.getState().startGame();
    resetEntities();
    updateHUDNames();
}

function proceedFromNameEntry() {
    console.log('[Proceed] Starting name entry flow');
    const state = useGameStore.getState();
    const isOnePlayer = state.gameMode === '1P';
    
    const p1Name = (document.getElementById('p1-name-input')?.value.trim() || 'Player 1').substring(0, 12);
    let p2Name;
    
    if (isOnePlayer) {
        const diffLabel = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
        p2Name = `NPC ${diffLabel}`;
    } else {
        p2Name = (document.getElementById('p2-name-input')?.value.trim() || 'Player 2').substring(0, 12);
    }
    
    useGameStore.getState().setPlayerNames(p1Name, p2Name);
    setMusicSpeed(0.6 + (state.p1Score + state.p2Score) * 0.1);
    
    // Start the game
    useGameStore.getState().startGame();
    resetEntities();
    updateHUDNames();
}

function updateHUDNames() {
    const state = useGameStore.getState();
    document.querySelector('#hud .player-stats.p1 .name')?.setAttribute('data-name', state.p1Name);
    document.querySelector('#hud .player-stats.p2 .name')?.setAttribute('data-name', state.p2Name);
    
    const p1El = document.querySelector('#hud .player-stats.p1 .name');
    const p2El = document.querySelector('#hud .player-stats.p2 .name');
    if (p1El) p1El.textContent = state.p1Name;
    if (p2El) p2El.textContent = state.p2Name;
}

function resetEntities() {
    console.log('[resetEntities] Creating entities, gameMode:', useGameStore.getState().gameMode);
    // Cleanup
    player1?.cleanup();
    player2?.cleanup();
    arena?.cleanup();
    particles?.cleanup();
    lightning?.cleanup();
    shockwaves?.cleanup();

    const state = useGameStore.getState();
    const isOnePlayer = state.gameMode === '1P';
    
    // AI Controller for 1P mode
    aiController = isOnePlayer ? new AIController(state.difficulty || 'normal') : null;

    // Players - use unified input handler and store colors
    player1 = new Player('player1', state.p1Color || 0xff4444, { x: -15, y: 4, z: 0 }, getPlayer1InputUnified);
    player2 = new Player('player2', state.p2Color || 0x4444ff, { x: 15, y: 4, z: 0 }, 
        isOnePlayer ? () => aiController.getInput() : getPlayer2InputUnified);
    
    // Effects
    arena = new Arena(undefined, selectedLevelData?.tiles);
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    // Camera
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    pendingWinner = null;
    winTimer = 0;
    countdownTimer = 3.0;
}

function resetOnlineEntities() {
    player1?.cleanup();
    player2?.cleanup();
    arena?.cleanup();
    particles?.cleanup();
    lightning?.cleanup();
    shockwaves?.cleanup();

    const state = useGameStore.getState();
    const mySlot = state.online?.playerSlot;
    
    const hostPos = { x: -15, y: 4, z: 0 };
    const clientPos = { x: 15, y: 4, z: 0 };
    
    const defaultInput = { forward: false, backward: false, left: false, right: false, boost: false };
    
    // Player input mapping: local player uses their controls, opponent uses synced input
    if (mySlot === 1) {
        // I'm the host (player 1) on the left
        player1 = new Player('player1', 0xff4444, hostPos, getPlayer1InputUnified);
        player2 = new Player('player2', 0x4444ff, clientPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    } else if (mySlot === 2) {
        // I'm the client (player 2) on the right, but I use player 2 controls (arrows)
        // The visual player1/player2 display doesn't change - it's about my slot
        player1 = new Player('player1', 0xff4444, hostPos, () => useGameStore.getState().online.opponentInput || defaultInput);
        player2 = new Player('player2', 0x4444ff, clientPos, getPlayer2InputUnified);
    } else {
        // Fallback: assume we're host if slot is unknown
        player1 = new Player('player1', 0xff4444, hostPos, getPlayer1InputUnified);
        player2 = new Player('player2', 0x4444ff, clientPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    }
    
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);
}

function returnToMenu() {
    clearReplayCountdown();
    const replayModal = document.getElementById('replay-modal');
    if (replayModal) replayModal.remove();
    useGameStore.getState().returnToMenu();
    setMusicSpeed(0.5);
    
    player1?.cleanup();
    player2?.cleanup();
    arena?.cleanup();
    particles?.cleanup();
    lightning?.cleanup();
    shockwaves?.cleanup();
    
    player1 = null;
    player2 = null;
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();
    
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);
}

function startOnlineGame() {
    console.log('[startOnlineGame] Starting online game');
    initAudio();
    playMusic();
    setMusicSpeed(0.6);
    useGameStore.getState().resetScores();
    resetOnlineEntities();
    updateHUDNames();
}

function startReplayCountdown() {
    const replayCard = document.getElementById('replay-card');
    const countdownText = document.getElementById('replay-countdown-text');
    if (!replayCard || !countdownText) return;

    clearReplayCountdown();
    replayCountdownValue = 10;
    replayCountdownPaused = false;
    countdownText.textContent = '10';
    replayCard.classList.remove('hidden');

    replayCountdownInterval = setInterval(() => {
        if (replayCountdownPaused) return;
        replayCountdownValue--;
        if (countdownText) countdownText.textContent = String(replayCountdownValue);
        if (replayCountdownValue <= 0) {
            clearReplayCountdown();
            if (useGameStore.getState().gameState === 'ROUND_OVER') {
                startNextRound();
            }
        }
    }, 1000);
}

function clearReplayCountdown() {
    if (replayCountdownInterval !== null) {
        clearInterval(replayCountdownInterval);
        replayCountdownInterval = null;
    }
    const replayCard = document.getElementById('replay-card');
    if (replayCard) replayCard.classList.add('hidden');
    replayCountdownPaused = false;
}

function checkWinConditions(delta) {
    if (!player1 || !player2) return;

    if (player1.isDead && player2.isDead) {
        const resolvedWinner = pendingWinner || 'Draw';
        useGameStore.getState().endRound(resolvedWinner);
        // Freeze physics to prevent further movement after round resolution.
        player1.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
        player2.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
        pendingWinner = null;
        winTimer = 0;
    } else if (player1.isDead || player2.isDead) {
        if (!pendingWinner) {
            pendingWinner = player1.isDead ? 'Player 2' : 'Player 1';
            winTimer = 0.5;
            // Immediately stop dead players from falling out during winner delay.
            if (player1.isDead) {
                player1.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
            }
            if (player2.isDead) {
                player2.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
            }
        } else {
            winTimer -= delta;
            if (winTimer <= 0) {
                useGameStore.getState().endRound(pendingWinner);
                // Freeze both players to avoid residual drift in end-of-round states.
                player1.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
                player2.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
                pendingWinner = null;
            }
        }
    }
}

// ============================================
// BUTTON HANDLERS
// ============================================
function setupButtonHandlers() {
    // Game Mode Selection - Now on main menu
    document.getElementById('mode-single-btn')?.addEventListener('click', () => {
        console.log('[Button] Single Player clicked!');
        useGameStore.getState().setGameMode('1P');
    });
    document.getElementById('mode-local-btn')?.addEventListener('click', () => {
        console.log('[Button] Local Multiplayer clicked!');
        useGameStore.getState().setGameMode('2P');
    });
    document.getElementById('mode-online-btn')?.addEventListener('click', () => {
        console.log('[Button] Online clicked!');
        useGameStore.getState().setGameMode('ONLINE');
        showScreen('onlineConnect');
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
        showScreen('settings');
    });
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
        showScreen('menu');
    });

    // Game Mode Selection
    const singleBtn = document.getElementById('mode-single-btn');
    const localBtn = document.getElementById('mode-local-btn');
    const onlineBtn = document.getElementById('mode-online-btn');
    
    console.log('[Setup] Mode buttons found:', { singleBtn: !!singleBtn, localBtn: !!localBtn, onlineBtn: !!onlineBtn });
    
    singleBtn?.addEventListener('click', () => {
        console.log('[Click] SINGLE PLAYER clicked');
        useGameStore.getState().setGameMode('1P');
        console.log('[Click] Store updated, new state:', useGameStore.getState());
    });
    localBtn?.addEventListener('click', () => {
        console.log('[Click] LOCAL clicked');
        useGameStore.getState().setGameMode('2P');
        console.log('[Click] Store updated, new state:', useGameStore.getState());
    });
    onlineBtn?.addEventListener('click', () => {
        console.log('[Click] ONLINE clicked');
        useGameStore.getState().setGameMode('ONLINE');
        showScreen('onlineConnect');
        console.log('[Click] Screen shown, new state:', useGameStore.getState());
    });

    // Difficulty Selection
    ['easy', 'normal', 'hard'].forEach(diff => {
        const btn = document.getElementById(`difficulty-${diff}-btn`);
        const radio = document.getElementById(`difficulty-${diff}-radio`);
        if (btn && radio) {
            btn.addEventListener('click', async () => {
                console.log('[Button] Difficulty', diff, 'clicked!');
                radio.checked = true;
                useGameStore.getState().setDifficulty(diff);
                
                // Load levels and show level selector
                const levels = await loadLevels();
                if (levels.length > 0) {
                    // Levels available - show level select screen
                    createLevelButtons(levels, (levelId) => {
                        selectLevel(levelId);
                    });
                    showLevelSelect();
                } else {
                    // No levels available - skip level select and go straight to name entry
                    console.log('[Difficulty] No levels found, proceeding to name entry');
                    showScreen('name-entry');
                }
            });
        }
    });

    // Level Select Screen
    document.getElementById('level-select-back-btn')?.addEventListener('click', () => {
        hideLevelSelect();
        showScreen('menu');
    });

    // Coming Soon
    document.getElementById('coming-soon-back-btn')?.addEventListener('click', () => {
        showScreen('menu');
    });

    // Name Entry
    document.getElementById('name-entry-play-btn')?.addEventListener('click', proceedFromNameEntry);
    document.getElementById('name-entry-menu-btn')?.addEventListener('click', () => {
        returnToMenu();
    });
    ['p1-name-input', 'p2-name-input'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') proceedFromNameEntry();
        });
    });

    // HUD
    document.getElementById('hud-restart-btn')?.addEventListener('click', () => {
        useGameStore.getState().resetScores();
        startGame();
    });
    document.getElementById('hud-menu-btn')?.addEventListener('click', returnToMenu);

    // Game Over
    document.getElementById('restart-btn')?.addEventListener('click', () => {
        if (useGameStore.getState().gameState === 'ROUND_OVER') {
            // Between rounds - just start the next round.
            roundOverTimeoutSet = false;
            const openReplay = document.getElementById('replay-modal');
            if (openReplay) openReplay.remove();
            startNextRound();
        } else {
            // Game over - full restart.
            useGameStore.getState().resetScores();
            startGame();
        }
    });
    document.getElementById('replay-view-btn')?.addEventListener('click', () => {
        if (useGameStore.getState().gameState !== 'ROUND_OVER') return;
        const buffer = replayRecorder.getBuffer();
        if (buffer.length === 0) return;

        replayCountdownPaused = true;
        screens.gameOver.classList.add('hidden');
        const { close } = createReplayModal(buffer, {
            title: 'Round Replay',
            autoPlay: true,
            showControls: true,
            player1,
            player2,
            camera,
            onClose: () => {
                replayCountdownPaused = false;
                if (useGameStore.getState().gameState === 'ROUND_OVER') {
                    screens.gameOver.classList.remove('hidden');
                }
            },
        });
    });
    document.getElementById('menu-btn')?.addEventListener('click', returnToMenu);

    // Online Connect
    document.getElementById('online-connect-back-btn')?.addEventListener('click', () => {
        online.disconnect();
        showScreen('menu');
    });
    document.getElementById('online-connect-btn')?.addEventListener('click', () => {
        const serverUrl = document.getElementById('online-server-input')?.value.trim();
        const playerName = document.getElementById('online-name-input')?.value.trim();
        
        if (!serverUrl) {
            document.getElementById('online-connect-error').textContent = 'Please enter a server address';
            return;
        }
        if (!playerName) {
            document.getElementById('online-connect-error').textContent = 'Please enter your name';
            return;
        }
        
        document.getElementById('online-connect-error').textContent = '';
        document.getElementById('online-connect-status').textContent = 'Connecting...';
        online.connect(serverUrl);
    });

    // Online Lobby
    document.getElementById('online-disconnect-btn')?.addEventListener('click', () => {
        online.disconnect();
        showScreen('onlineConnect');
    });
    document.getElementById('online-lobby-back-btn')?.addEventListener('click', () => {
        online.disconnect();
        showScreen('menu');
    });
    document.getElementById('online-refresh-btn')?.addEventListener('click', () => {
        online.listGames();
    });
    document.getElementById('online-create-game-btn')?.addEventListener('click', () => {
        const settings = useGameStore.getState().settings;
        online.createGame({
            theme: settings.theme,
            sphereSize: settings.sphereSize,
            sphereWeight: settings.sphereWeight,
            sphereAccel: settings.sphereAccel,
            collisionBounce: settings.collisionBounce,
            arenaSize: settings.arenaSize,
            destructionRate: settings.destructionRate,
            iceRate: settings.iceRate,
            portalRate: settings.portalRate,
            portalCooldown: settings.portalCooldown,
            bonusRate: settings.bonusRate,
            bonusDuration: settings.bonusDuration,
            boostRegenSpeed: settings.boostRegenSpeed,
            boostDrainRate: settings.boostDrainRate,
        });
    });
    const startBtn = document.getElementById('online-start-btn');
    console.log('[Setup] Start button found:', !!startBtn, startBtn);
    startBtn?.addEventListener('click', () => {
        console.log('[Start Btn] Clicked!');
        online.startGame();
    });
    document.getElementById('online-leave-btn')?.addEventListener('click', () => {
        online.leaveGame();
        document.getElementById('online-my-game')?.classList.add('hidden');
    });
    document.getElementById('online-cancel-join-btn')?.addEventListener('click', () => {
        online.leaveGame();
        document.getElementById('online-joining')?.classList.add('hidden');
    });

    // Settings Panel Controls
    const controlBtns = document.querySelectorAll('.control-btn');
    let listeningFor = null;

    controlBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (listeningFor) {
                listeningFor.classList.remove('listening');
                listeningFor.textContent = listeningFor.dataset.originalText;
            }
            listeningFor = e.target;
            listeningFor.dataset.originalText = listeningFor.textContent;
            listeningFor.textContent = 'Press Key or Button...';
            listeningFor.classList.add('listening');
        });
    });

    window.addEventListener('keydown', (e) => {
        if (listeningFor) {
            e.preventDefault();
            const key = e.code;
            const [player, action] = listeningFor.id.split('-').slice(1);
            const currentControls = useGameStore.getState().settings.controls;
            const newControls = JSON.parse(JSON.stringify(currentControls));
            newControls[player][action] = key;
            useGameStore.getState().updateSetting('controls', newControls);
            listeningFor.textContent = key;
            listeningFor.classList.remove('listening');
            listeningFor = null;
        }
    });

    // Settings sliders
    const settingsMap = {
        'sphere-size': 'sphereSize', 'sphere-weight': 'sphereWeight', 'sphere-accel': 'sphereAccel',
        'collision-bounce': 'collisionBounce', 'arena-size': 'arenaSize', 'destruction-rate': 'destructionRate',
        'ice-rate': 'iceRate', 'portal-rate': 'portalRate', 'portal-cooldown': 'portalCooldown',
        'bonus-rate': 'bonusRate', 'bonus-duration': 'bonusDuration', 'music-volume': 'musicVolume',
        'sfx-volume': 'sfxVolume', 'particle-amount': 'particleAmount', 'bloom-level': 'bloomLevel',
        'boost-regen-speed': 'boostRegenSpeed', 'boost-drain-rate': 'boostDrainRate',
        'player-aura-size': 'playerAuraSize', 'player-aura-opacity': 'playerAuraOpacity',
        'player-glow-intensity': 'playerGlowIntensity', 'player-glow-range': 'playerGlowRange'
    };

    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        if (el && valEl) {
            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                valEl.textContent = val;
                useGameStore.getState().updateSetting(key, val);
                
                // Update audio volume in real-time
                if (key === 'musicVolume') setMusicVolume(val);
                if (key === 'sfxVolume') setSfxVolume(val);
            });
        }
    }

    document.getElementById('theme-select')?.addEventListener('change', (e) => {
        useGameStore.getState().updateSetting('theme', e.target.value);
        if (useGameStore.getState().gameState === 'MENU') {
            arena?.cleanup();
            arena = new Arena();
        }
    });

    document.getElementById('reset-settings-btn')?.addEventListener('click', () => {
        useGameStore.getState().resetSettings();
    });

    // Presets
    const presetList = document.getElementById('presets-list');
    const savePresetBtn = document.getElementById('save-preset-btn');
    const presetNameInput = document.getElementById('preset-name');

    const getPresets = () => {
        const stored = localStorage.getItem('dropfall_presets');
        if (stored) return JSON.parse(stored);
        
        // Initialize with default presets
        const defaults = {
            'Slow & Bouncy': {
                sphereAccel: 800,
                collisionBounce: 1.5,
                sphereWeight: 50,
                destructionRate: 6.0,
                iceRate: 4.0,
                portalRate: 12.0,
                bonusRate: 10.0
            },
            'Fast & Heavy': {
                sphereAccel: 3000,
                collisionBounce: 0.5,
                sphereWeight: 400,
                destructionRate: 1.5,
                iceRate: 1.0,
                portalRate: 4.0,
                bonusRate: 3.0
            },
            'Tiny Spheres': {
                sphereSize: 0.8,
                sphereAccel: 2500,
                sphereWeight: 80,
                destructionRate: 3.0,
                iceRate: 2.0,
                portalRate: 8.0,
                bonusRate: 5.0
            },
            'Massive Spheres': {
                sphereSize: 4.5,
                sphereWeight: 500,
                sphereAccel: 1200,
                collisionBounce: 0.3,
                destructionRate: 4.0,
                iceRate: 3.0,
                portalRate: 10.0,
                bonusRate: 8.0
            },
            'Chaos Mode': {
                sphereAccel: 2800,
                collisionBounce: 1.3,
                sphereWeight: 150,
                destructionRate: 0.8,
                iceRate: 0.8,
                portalRate: 2.0,
                bonusRate: 2.0,
                bonusDuration: 2.0
            },
            'Zen Mode': {
                sphereAccel: 1200,
                collisionBounce: 0.8,
                sphereWeight: 150,
                destructionRate: 8.0,
                iceRate: 6.0,
                portalRate: 15.0,
                bonusRate: 12.0,
                bonusDuration: 6.0
            },
            'Big Arena': {
                arenaSize: 8,
                destructionRate: 4.0,
                iceRate: 3.0,
                portalRate: 10.0,
                bonusRate: 8.0
            },
            'Tiny Arena': {
                arenaSize: 2,
                destructionRate: 2.0,
                iceRate: 1.5,
                portalRate: 5.0,
                bonusRate: 4.0
            },
            'Party Mode': {
                destructionRate: 1.0,
                iceRate: 1.0,
                portalRate: 3.0,
                bonusRate: 2.5,
                bonusDuration: 3.0,
                sphereAccel: 2500,
                collisionBounce: 1.2
            },
            'Gladiator': {
                sphereSize: 3.5,
                sphereWeight: 350,
                sphereAccel: 2000,
                collisionBounce: 1.4,
                destructionRate: 2.5,
                iceRate: 2.0,
                portalRate: 6.0,
                bonusRate: 5.0
            }
        };
        
        savePresets(defaults);
        return defaults;
    };

    const savePresets = (presets) => {
        localStorage.setItem('dropfall_presets', JSON.stringify(presets));
    };

    if (presetList) {
        const loadPreset = (name, data) => {
            Object.entries(data).forEach(([key, val]) => {
                useGameStore.getState().updateSetting(key, val);
            });
        };

        const renderPresets = () => {
            const presets = getPresets();
            const names = Object.keys(presets);
            if (names.length === 0) {
                presetList.innerHTML = '<div style="color: #666; font-size: 0.85rem; padding: 0.5rem;">No presets saved yet</div>';
                return;
            }
            presetList.innerHTML = names.map(name => `
                <div class="preset-item">
                    <button class="preset-load-btn">${name}</button>
                    <button class="preset-delete-btn" data-name="${name}">×</button>
                </div>
            `).join('');
            
            presetList.querySelectorAll('.preset-load-btn').forEach((btn, i) => {
                const name = names[i];
                btn.addEventListener('click', () => loadPreset(name, presets[name]));
            });
            
            presetList.querySelectorAll('.preset-delete-btn').forEach(btn => {
                const name = btn.dataset.name;
                btn.addEventListener('click', () => {
                    const current = getPresets();
                    delete current[name];
                    savePresets(current);
                    renderPresets();
                });
            });
        };

        renderPresets();

        savePresetBtn?.addEventListener('click', () => {
            const name = presetNameInput?.value.trim();
            if (!name) return;
            const settings = useGameStore.getState().settings;
            const presets = getPresets();
            presets[name] = { ...settings };
            savePresets(presets);
            renderPresets();
            presetNameInput.value = '';
        });
    }

    // Autorestart checkboxes
    const autoRestartMenu = document.getElementById('autorestart-menu');
    const autoRestartGameover = document.getElementById('autorestart-gameover');
    
    autoRestartMenu?.addEventListener('change', (e) => {
        localStorage.setItem('dropfall_autorestart', e.target.checked);
        useGameStore.getState().updateSetting('autoRestart', e.target.checked);
        if (autoRestartGameover) autoRestartGameover.checked = e.target.checked;
    });
    
    autoRestartGameover?.addEventListener('change', (e) => {
        localStorage.setItem('dropfall_autorestart', e.target.checked);
        useGameStore.getState().updateSetting('autoRestart', e.target.checked);
        if (autoRestartMenu) autoRestartMenu.checked = e.target.checked;
    });

    // Sync checkboxes with store value on load
    const autoRestartValue = useGameStore.getState().settings.autoRestart;
    if (autoRestartMenu) autoRestartMenu.checked = autoRestartValue;
    if (autoRestartGameover) autoRestartGameover.checked = autoRestartValue;

    // Settings navigation buttons (left sidebar)
    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pane = btn.dataset.pane;
            
            // Update nav buttons
            document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show/hide panes
            document.querySelectorAll('.settings-pane').forEach(p => {
                p.classList.remove('active');
                p.classList.add('hidden');
            });
            const targetPane = document.querySelector(`.settings-pane[data-pane="${pane}"]`);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.classList.remove('hidden');
            }
        });
    });
}

// ============================================
// ONLINE EVENT HANDLERS
// ============================================
function setupOnlineHandlers() {
    online.on('connected', () => {
        online.setName(document.getElementById('online-name-input')?.value.trim() || 'Player');
        showScreen('onlineLobby');
        document.getElementById('online-server-url').textContent = online.ws?.url || '';
        online.listGames();
    });

    online.on('gamesUpdated', (games) => {
        const list = document.getElementById('online-games-list');
        if (!list) return;
        
        if (games.length === 0) {
            list.innerHTML = '<div class="online-empty">No games available. Create one!</div>';
        } else {
            list.innerHTML = games.map(g => `
                <div class="online-game-item" data-game-id="${g.id}">
                    <div class="online-game-info">
                        <h4>${g.hostName}'s Game</h4>
                        <p>${g.playerCount}/${g.maxPlayers} players | ${g.settings.theme}</p>
                    </div>
                    <span class="online-join-btn">JOIN</span>
                </div>
            `).join('');
            
            list.querySelectorAll('.online-game-item').forEach(item => {
                item.addEventListener('click', () => {
                    online.joinGame(item.dataset.gameId);
                    document.getElementById('online-joining')?.classList.remove('hidden');
                });
            });
        }
    });

    online.on('gameCreated', (game) => {
        console.log('[gameCreated] Event received');
        document.getElementById('online-my-game')?.classList.remove('hidden');
        document.getElementById('online-game-info').innerHTML = '<p>Waiting for players...</p>';
        document.getElementById('online-start-btn')?.classList.add('hidden');
    });

    online.on('gameJoined', () => {
        document.getElementById('online-my-game')?.classList.add('hidden');
    });

    online.on('leftGame', () => {
        document.getElementById('online-my-game')?.classList.add('hidden');
        document.getElementById('online-joining')?.classList.add('hidden');
        online.listGames();
    });

    online.on('playerJoined', (player) => {
        console.log('[playerJoined] Player joined:', player.name);
        const state = useGameStore.getState();
        const isHost = state.online.isHost;
        const myName = state.online.myName;
        const opponentName = player.name || 'Player';
        
        // Set player names based on slots
        if (isHost) {
            // I'm player 1, opponent is player 2
            state.setPlayerNames(myName, opponentName);
        } else {
            // I'm player 2, opponent is player 1
            state.setPlayerNames(opponentName, myName);
        }
        
        document.getElementById('online-game-info').innerHTML = `<p>Player joined: ${opponentName}</p>`;
        if (isHost) {
            console.log('[playerJoined] Host detected, showing start button');
            document.getElementById('online-start-btn')?.classList.remove('hidden');
        } else {
            document.getElementById('online-joining')?.classList.add('hidden');
            document.getElementById('online-my-game')?.classList.remove('hidden');
            document.getElementById('online-my-game').style.borderColor = '#ffff00';
            document.getElementById('online-game-info').innerHTML = '<p>Waiting for host to start...</p>';
            document.getElementById('online-start-btn')?.classList.add('hidden');
        }
    });

    online.on('playerLeft', () => {
        const isHost = useGameStore.getState().online.isHost;
        document.getElementById('online-game-info').innerHTML = '<p>Player left</p>';
        if (isHost) document.getElementById('online-start-btn')?.classList.add('hidden');
    });

    online.on('gameStarting', (data) => {
        console.log('[gameStarting] Received game_starting event, countdown:', data.countdown);
        console.log('[gameStarting] isHost:', useGameStore.getState().online.isHost, 'playerSlot:', useGameStore.getState().online.playerSlot);
        Object.entries(data.settings).forEach(([key, val]) => {
            useGameStore.getState().updateSetting(key, val);
        });
        hideAllScreens();
        screens.hud.classList.remove('hidden');
        screens.countdown.classList.remove('hidden');
        screens.countdown.textContent = String(data.countdown);
        countdownTimer = data.countdown;
        useGameStore.getState().startGame();
    });

    online.on('gameStarted', () => {
        console.log('[gameStarted] Received game_started event');
        console.log('[gameStarted] isHost:', useGameStore.getState().online.isHost, 'playerSlot:', useGameStore.getState().online.playerSlot);
        useGameStore.getState().setPlaying();
        startOnlineGame();
        if (!useGameStore.getState().online.isHost) {
            setTimeout(() => online.requestSync(), 100);
        }
    });

    online.on('fullState', (data) => {
        console.log('[fullState] Received full state sync:', data);
        if (data.state && player1 && player2) {
            if (data.state.p1Pos) {
                player1.rigidBody.setTranslation(data.state.p1Pos, true);
                player1.rigidBody.setLinvel(data.state.p1Vel, true);
            }
            if (data.state.p2Pos) {
                player2.rigidBody.setTranslation(data.state.p2Pos, true);
                player2.rigidBody.setLinvel(data.state.p2Vel, true);
            }
        }
    });

    online.on('roundOver', (data) => {
        useGameStore.getState().endRound(data.winner);
    });

    online.on('gameUpdate', (data) => {
        console.log('[gameUpdate] Received:', data.type);
        if (data.type === 'opponent_input' && data.input) {
            useGameStore.getState().setOnlineOpponentInput(data.input);
        }
        if (data.type === 'game_state_update' && data.state && player1 && player2) {
            if (data.state.p1Pos) {
                player1.rigidBody.setTranslation(data.state.p1Pos, true);
                player1.rigidBody.setLinvel(data.state.p1Vel, true);
            }
            if (data.state.p2Pos) {
                player2.rigidBody.setTranslation(data.state.p2Pos, true);
                player2.rigidBody.setLinvel(data.state.p2Vel, true);
            }
            
            // Sync tile states from host
            if (data.state.tileStates && arena) {
                data.state.tileStates.forEach(tileUpdate => {
                    const tile = arena.getTileAt(tileUpdate.q, tileUpdate.r);
                    if (tile) {
                        tile.state = tileUpdate.state;
                        tile.timer = tileUpdate.timer;
                    }
                });
            }
        }
    });

    online.on('error', (msg) => {
        document.getElementById('online-connect-error').textContent = msg;
    });
}

// ============================================
// GAME LOOP
// ============================================
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const state = useGameStore.getState();

    // Menu background animation
    if (state.gameState === 'MENU') {
        arena?.update(delta);
        if (arena && arena.tiles?.filter(t => t.state === 'NORMAL').length < 30) {
            arena.cleanup();
            arena = new Arena();
        }
        particles?.update(delta);
        lightning?.update(delta);
        shockwaves?.update(delta);
        physicsSystem.step(delta);
        camera.position.set(Math.sin(clock.getElapsedTime() * 0.1) * 30, 25, Math.cos(clock.getElapsedTime() * 0.1) * 30);
        camera.lookAt(0, 0, 0);
    }

    // Game states
    if (state.gameState === 'COUNTDOWN' || state.gameState === 'PLAYING') {
        // Always update player visuals (mesh sync, tile interactions, power-ups)
        player1?.update(delta, arena, particles);
        player2?.update(delta, arena, particles);
        
        if (aiController && player1 && player2) {
            const arenaRadius = (state.settings.arenaSize + 1) * 8.0;
            aiController.update(
                player1.mesh.position, player2.mesh.position,
                player1.rigidBody?.linvel(), player2.rigidBody?.linvel(),
                new THREE.Vector3(0, 0, 0), arenaRadius, delta, state
            );
        }
        
        arena?.update(delta);
        particles?.update(delta);
        lightning?.update(delta);
        shockwaves?.update(delta);
        
        // Only run physics for host and local games, not for online clients
        // Online clients receive positions from host via gameUpdate handler
        const isOnlineClient = state.gameMode === 'ONLINE' && !state.online.isHost;
        if (!isOnlineClient) {
            physicsSystem.step(delta);
        }

        // Power-up displays
        document.getElementById('p1-powerups').innerHTML = player1?.activePowerUps.map(pu => 
            `<div class="powerup-icon" style="color: #${pu.effect.color.toString(16).padStart(6,'0')}; border-color: #${pu.effect.color.toString(16).padStart(6,'0')};">${pu.effect.icon}</div>`
        ).join('') || '';
        document.getElementById('p2-powerups').innerHTML = player2?.activePowerUps.map(pu => 
            `<div class="powerup-icon" style="color: #${pu.effect.color.toString(16).padStart(6,'0')}; border-color: #${pu.effect.color.toString(16).padStart(6,'0')};">${pu.effect.icon}</div>`
        ).join('') || '';

        // Collision detection (only on host and local games, not for online clients)
        if (player1 && player2 && !player1.isDead && !player2.isDead && !isOnlineClient) {
            const p1Pos = player1.mesh.position;
            const p2Pos = player2.mesh.position;
            const distance = p1Pos.distanceTo(p2Pos);
            const collisionDist = state.settings.sphereSize * 2 + 0.1;

            if (distance <= collisionDist && collisionCooldown <= 0) {
                collisionCooldown = 0.5;
                const v1 = player1.rigidBody.linvel();
                const v2 = player2.rigidBody.linvel();
                const relVel = new THREE.Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z).length();
                const intensity = Math.min(Math.max(relVel / 20, 1), 5);

                const dir1 = new THREE.Vector3().subVectors(p1Pos, p2Pos).normalize();
                const bounce = (1500 + relVel * 10) * (player1.isBoosting || player2.isBoosting ? 1.5 : 1.0);
                player1.rigidBody.applyImpulse({ x: dir1.x * bounce, y: 0, z: dir1.z * bounce }, true);
                player2.rigidBody.applyImpulse({ x: -dir1.x * bounce, y: 0, z: -dir1.z * bounce }, true);

                particles?.emit(new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5), { x: 0, y: 10, z: 0 }, 0xff4400, Math.floor(15 * intensity));
                player1.glow.intensity = 10 * intensity;
                player2.glow.intensity = 10 * intensity;
                
                if (player1.isBoosting || player2.isBoosting) {
                    lightning?.emit(new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5), intensity);
                }
                playCollisionSound(intensity);
            }

            if (player1.glow.intensity > 1) player1.glow.intensity -= delta * 10;
            if (player2.glow.intensity > 1) player2.glow.intensity -= delta * 10;
            if (sceneFlashLight?.intensity > 0) sceneFlashLight.intensity -= delta * 40;

            // Frame-rate independent camera movement (constant speed, not delta-dependent)
            const targetCamPos = new THREE.Vector3(p1Pos.x, Math.max(24, distance * 0.96), p1Pos.z + Math.max(24, distance * 0.96));
            const camSpeed = 0.08; // Interpolation factor per frame (0-1)
            camera.position.lerp(targetCamPos, camSpeed);
            
            // Smooth camera lookAt target
            const targetLookAt = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
            if (!camera.userData.lookAtTarget) camera.userData.lookAtTarget = targetLookAt.clone();
            camera.userData.lookAtTarget.lerp(targetLookAt, camSpeed);
            camera.lookAt(camera.userData.lookAtTarget);
        } else if (player1 && player2 && (player1.isDead || player2.isDead)) {
            // One player is dead; keep camera following the surviving player.
            const survivor = player1.isDead ? player2 : player1;
            if (survivor && !survivor.isDead && survivor.mesh) {
                const pos = survivor.mesh.position;
                const targetCamPos = new THREE.Vector3(pos.x, pos.y + 8, pos.z + 12);
                camera.position.lerp(targetCamPos, 0.05);
                camera.lookAt(pos);
            }
        }

        // Countdown
        if (state.gameState === 'COUNTDOWN') {
            countdownTimer -= delta;
            if (countdownTimer > 0) {
                screens.countdown.textContent = String(Math.ceil(countdownTimer));
            } else {
                replayRecorder.startRecording(); // Start replay recording when countdown ends
                useGameStore.getState().setPlaying();
            }
        }

        // Win check
        if (state.gameState === 'PLAYING') {
            checkWinConditions(delta);
            
            // Record frame for replay
            if (player1 && player2) {
                const p1Pos = player1.mesh.position;
                const p1Vel = player1.rigidBody?.linvel() || { x: 0, y: 0, z: 0 };
                const p1Rot = player1.mesh.quaternion;
                const p2Pos = player2.mesh.position;
                const p2Vel = player2.rigidBody?.linvel() || { x: 0, y: 0, z: 0 };
                const p2Rot = player2.mesh.quaternion;
                
                replayRecorder.recordFrame({
                    timestamp: Date.now(),
                    frameNumber: 0,
                    player1: {
                        position: { x: p1Pos.x, y: p1Pos.y, z: p1Pos.z },
                        velocity: { x: p1Vel.x, y: p1Vel.y, z: p1Vel.z },
                        rotation: { x: p1Rot.x, y: p1Rot.y, z: p1Rot.z, w: p1Rot.w },
                        boost: state.player1Boost
                    },
                    player2: {
                        position: { x: p2Pos.x, y: p2Pos.y, z: p2Pos.z },
                        velocity: { x: p2Vel.x, y: p2Vel.y, z: p2Vel.z },
                        rotation: { x: p2Rot.x, y: p2Rot.y, z: p2Rot.z, w: p2Rot.w },
                        boost: state.player2Boost
                    }
                });
            }
            
            // Update rolling sound based on player velocities
            if (player1?.rigidBody) {
                updateRollingSound(player1.rigidBody.linvel());
            }

            // Online sync
            if (state.gameMode === 'ONLINE' && state.online.connected) {
                const input = (state.online.playerSlot === 1 ? getPlayer1InputUnified : getPlayer2InputUnified)();
                online.sendInput({ ...input });
                if (state.online.isHost && player1 && player2) {
                    const p1Vel = player1.rigidBody.linvel();
                    const p2Vel = player2.rigidBody.linvel();
                    
                    // Serialize tile states for sync
                    const tileStates = arena?.tiles?.map(t => ({
                        q: t.q,
                        r: t.r,
                        state: t.state,
                        timer: t.timer
                    })) || [];
                    
                    online.sendGameState({
                        p1Score: state.p1Score, p2Score: state.p2Score,
                        p1Pos: player1.mesh.position, p1Vel: { x: p1Vel.x, y: p1Vel.y, z: p1Vel.z },
                        p2Pos: player2.mesh.position, p2Vel: { x: p2Vel.x, y: p2Vel.y, z: p2Vel.z },
                        tileStates: tileStates
                    });
                }
            }
        }
    }

    // Round over / Game over
    if (state.gameState === 'ROUND_OVER' || state.gameState === 'GAME_OVER') {
        if (!roundOverFrozen) {
            roundOverFrozen = true;
            roundOverLogFrames = 0;
            // Force-freeze both players in end states to avoid any residual motion.
            player1?.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
            player2?.rigidBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
            player1?.rigidBody?.setAngvel({ x: 0, y: 0, z: 0 }, true);
            player2?.rigidBody?.setAngvel({ x: 0, y: 0, z: 0 }, true);
            console.log('[ROUND_OVER] Froze rigid bodies');
        }

        if (state.gameState === 'ROUND_OVER' && roundOverLogFrames < 3) {
            console.log('[ROUND_OVER] Frame - winner:', state.winner, 'replayModalShown:', replayModalShown);
            roundOverLogFrames += 1;
        }

        // Stop replay recording
        if (state.gameState === 'ROUND_OVER' && !replayModalShown && replayRecorder.buffer.length > 0) {
            replayModalShown = true;
            replayRecorder.stopRecording();
        }
        
        // Don't update players, arena, or physics while round/game is over.
        // Keep only VFX alive for end-state presentation.
        particles?.update(delta);
        lightning?.update(delta);
        shockwaves?.update(delta);

        // Skip camera updates when replay is playing (ReplayRenderer controls camera)
        if (!replayCountdownPaused) {
            if (state.winner && state.winner !== 'Draw') {
                const winnerPlayer = state.winner === 'Player 1' ? player1 : player2;
                if (winnerPlayer && !winnerPlayer.isDead && winnerPlayer.mesh) {
                    const t = clock.getElapsedTime();
                    const pos = winnerPlayer.mesh.position;
                    camera.position.set(
                        pos.x + 6 * Math.cos(t * 0.5),
                        pos.y + 3,
                        pos.z + 6 * Math.sin(t * 0.5)
                    );
                    camera.lookAt(pos);
                    if (Math.random() > 0.9) particles?.emit(pos, { x: 0, y: 10, z: 0 }, winnerPlayer.color, 5);
                } else {
                    // Winner missing/dead: keep camera centered on arena.
                    const t = clock.getElapsedTime();
                    camera.position.set(
                        8 * Math.cos(t * 0.3),
                        6,
                        8 * Math.sin(t * 0.3)
                    );
                    camera.lookAt(0, 0, 0);
                }
            } else {
                // Draw: keep camera centered on arena.
                const t = clock.getElapsedTime();
                camera.position.set(
                    8 * Math.cos(t * 0.3),
                    6,
                    8 * Math.sin(t * 0.3)
                );
                camera.lookAt(0, 0, 0);
            }
        }
    }

    updateRenderer();
}

// ============================================
// CHARACTER PREVIEW SYSTEM

// ============================================
// OLD PREVIEW FUNCTIONS - DEPRECATED
// These functions have been replaced by the CharacterPreviewPanel component
// Kept for reference but no longer used in the application
// ============================================

/*
[OLD PREVIEW CODE REMOVED - See CharacterPreviewPanel.ts for new implementation]
*/

function startNextRound() {
    clearReplayCountdown();
    resetReplayRecorder();
    replayModalShown = false;
    roundOverFrozen = false;
    roundOverLogFrames = 0;
    const st = useGameStore.getState();
    setMusicSpeed(0.6 + (st.p1Score + st.p2Score) * 0.1);
    countdownTimer = 3.0;
    useGameStore.getState().startRound();
    resetEntities();
    updateHUDNames();
}

// ============================================
// STORE SUBSCRIPTION
// ============================================
function setupStoreSubscription() {
    useGameStore.subscribe((state, prevState) => {
        // Screen transitions
        if (state.gameState !== prevState.gameState) {
            console.log('[Store Sub] gameState changed:', prevState.gameState, '->', state.gameState);
            if (state.gameState !== 'ROUND_OVER') {
                roundOverTimeoutSet = false;
            }
            if (state.gameState !== 'ROUND_OVER' && state.gameState !== 'GAME_OVER') {
                roundOverFrozen = false;
                roundOverLogFrames = 0;
            }
            hideAllScreens();

            if (prevState.gameState === 'NAME_ENTRY' && state.gameState !== 'NAME_ENTRY') {
                destroyPreviewPanel();
                const previewMount = document.getElementById('character-preview-mount');
                if (previewMount) previewMount.innerHTML = '';
            }
            
            switch (state.gameState) {
                case 'MENU':
                    screens.menu.classList.remove('hidden');
                    break;
                case 'ONLINE':
                    screens.onlineLobby.classList.remove('hidden');
                    break;
                case 'NAME_ENTRY':
                    console.log('[Preview] NAME_ENTRY case matched - initializing new character preview');
                    screens.nameEntry.classList.remove('hidden');

                    // Always tear down and rebuild to match current store state.
                    const previewMount = document.getElementById('character-preview-mount');
                    if (previewMount) {
                        destroyPreviewPanel();
                        previewMount.innerHTML = '';

                        console.log('[Preview] Mounting character preview panel');
                        console.log('[Preview] State colors:', { p1Color: state.p1Color, p2Color: state.p2Color });
                        const isMultiplayer = state.gameMode === '2P';
                        const players = [
                            {
                                playerId: 'player1',
                                playerName: state.p1Name,
                                color: state.p1Color,
                                hat: state.p1Hat,
                                difficulty: state.difficulty
                            },
                            {
                                playerId: 'player2',
                                playerName: state.p2Name,
                                color: state.p2Color,
                                hat: state.p2Hat
                            }
                        ];
                        
                        try {
                            const panel = createCharacterPreviewPanel(players, (playerId, changes) => {
                                if (changes.difficulty) {
                                    useGameStore.getState().updateSetting('difficulty', changes.difficulty);
                                }
                            }, isMultiplayer);
                            previewMount.appendChild(panel);
                            console.log('[Preview] Character preview panel mounted successfully');
                        } catch (e) {
                            console.error('[Preview] Error mounting character preview panel:', e);
                        }
                    }
                    break;
                case 'COUNTDOWN':
                case 'PLAYING':
                    console.log('[Store Sub] Showing HUD and countdown, state:', state.gameState);
                    screens.hud.classList.remove('hidden');
                    screens.countdown.classList.remove('hidden');
                    screens.countdown.textContent = state.gameState === 'COUNTDOWN' ? '3' : 'GO!';
                    if (state.gameState === 'PLAYING') {
                        setTimeout(() => screens.countdown.classList.add('hidden'), 1000);
                    }
                    break;
                case 'ROUND_OVER':
                    if (!roundOverTimeoutSet) {
                        roundOverTimeoutSet = true;
                        if (state.settings.autoRestart) {
                            // Auto-advance after brief pause.
                            console.log('[STATE] ROUND_OVER: auto-starting next round in 500ms');
                            setTimeout(() => {
                                roundOverTimeoutSet = false;
                                if (useGameStore.getState().gameState === 'ROUND_OVER') {
                                    startNextRound();
                                }
                            }, 500);
                        } else {
                            // Show between-rounds screen and wait for user
                            console.log('[STATE] ROUND_OVER: showing between-rounds screen');
                            setTimeout(() => {
                                if (useGameStore.getState().gameState === 'ROUND_OVER') {
                                    const winnerText = state.winner === 'Draw' ? 'Draw!' : `${state.winner === 'Player 1' ? state.p1Name : state.p2Name} wins the round!`;
                                    document.getElementById('winner-text').textContent = winnerText;
                                    document.getElementById('restart-btn').textContent = 'Next Round';
                                    screens.gameOver.classList.remove('hidden');
                                    // Start countdown with replay option if we have replay data
                                    if (replayRecorder.buffer.length > 0) {
                                        startReplayCountdown();
                                    }
                                }
                            }, 1500);
                        }
                    }
                    break;
                case 'GAME_OVER':
                    screens.gameOver.classList.remove('hidden');
                    document.getElementById('winner-text').textContent = 
                        state.winner === 'Draw' ? 'Draw!' : `${state.winner === 'Player 1' ? state.p1Name : state.p2Name} Wins!`;
                    document.getElementById('restart-btn').textContent = 'Play Again';
                    if (state.settings.autoRestart) {
                        setTimeout(() => {
                            if (useGameStore.getState().gameState === 'GAME_OVER') {
                                useGameStore.getState().resetScores();
                                startGame(true);
                            }
                        }, 2000);
                    }
                    break;
            }
        }

        // Update HUD
        document.getElementById('p1-score').textContent = state.p1Score;
        document.getElementById('p2-score').textContent = state.p2Score;
        const p1Record = document.getElementById('p1-record');
        const p2Record = document.getElementById('p2-record');
        if (p1Record) p1Record.textContent = `W: ${state.p1SessionWins}  L: ${state.p2SessionWins}`;
        if (p2Record) p2Record.textContent = `W: ${state.p2SessionWins}  L: ${state.p1SessionWins}`;
        document.getElementById('p1-boost').style.width = `${state.player1Boost}%`;
        document.getElementById('p2-boost').style.width = `${state.player2Boost}%`;

        // Update difficulty button styling when difficulty changes
        if (state.difficulty !== prevState.difficulty) {
            ['easy', 'normal', 'hard'].forEach(diff => {
                const btn = document.getElementById(`difficulty-${diff}-btn`);
                if (btn) {
                    btn.classList.toggle('active', state.difficulty === diff);
                }
            });
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    if (window.__GAME_INITIALIZED__) return;
    window.__GAME_INITIALIZED__ = true;

    try {
        initRenderer();
        initInput();
        
        // Initialize audio on page load
        console.log('[Init] Initializing audio on page load');
        initAudio();
        
        // Try to start music on first user interaction (browsers block autoplay)
        const startMusicOnInteraction = () => {
            console.log('[Init] First interaction, starting music');
            playMusic();
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('keydown', startMusicOnInteraction);
        };
        document.addEventListener('click', startMusicOnInteraction);
        document.addEventListener('keydown', startMusicOnInteraction);
        
        // Initialize InputHandler for unified input processing
        inputHandler = createInputHandler();
        
        await initPhysics();
        
        // Initialize PhysicsSystem with existing world from physics.js
        physicsSystem = getPhysicsSystem();
        await physicsSystem.initialize(physicsWorld);
        
        // Subscribe to collision events from PhysicsSystem
        physicsSystem.on('collision', (event) => {
            console.log('[PhysicsSystem] Collision:', event.entityA, '<->', event.entityB);
            // Handled by direct physics queries in main.js for now
            // This subscription is for future event-driven architecture
        });
        
        // Subscribe to knockback events
        physicsSystem.on('knockback', (event) => {
            console.log('[PhysicsSystem] Knockback applied to:', event.targetEntity);
        });
        
        // Subscribe to out-of-bounds events
        physicsSystem.on('out-of-bounds', (event) => {
            console.log('[PhysicsSystem] Out of bounds:', event.entity, event.direction);
            // Could trigger death handling here in event-driven architecture
        });
        
        arena = new Arena();
        particles = new ParticleSystem();
        lightning = new LightningSystem();
        shockwaves = new ShockwaveSystem();
        
        sceneFlashLight = new THREE.PointLight(0xffffff, 0, 200);
        sceneFlashLight.position.set(0, 10, 0);
        scene.add(sceneFlashLight);

        setupButtonHandlers();
        setupOnlineHandlers();
        setupStoreSubscription();
        populatePowerupsGuide();
        
        showScreen('menu');
        animate();
    } catch (error) {
        console.error('[Game] Initialization failed:', error);
    }
}

init();
