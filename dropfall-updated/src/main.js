import './style.css';
import * as THREE from 'three';
import { useGameStore } from './store.js';
import { initPhysics, updatePhysics } from './physics.js';
import { initRenderer, updateRenderer, camera, scene, ambientLight, directionalLight } from './renderer.js';
import { initInput, getPlayer1Input, getPlayer2Input, getConnectedGamepads, getGamepadState } from './input.js';
import { Player } from './entities/Player.js';
import { Arena } from './entities/Arena.js';
import { ParticleSystem } from './entities/ParticleSystem.js';
import { LightningSystem } from './entities/LightningSystem.js';
import { ShockwaveSystem } from './entities/ShockwaveSystem.js';
import { initAudio, playMusic, playCollisionSound, setMusicSpeed } from './audio.js';
import { POWER_UP_EFFECTS } from './entities/Player.js';
import { AIController } from './ai/AIController.js';
import { online } from './online.js';

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
// GAME STATE
// ============================================
let player1, player2, arena, particles, lightning, shockwaves, aiController;
const clock = new THREE.Clock();
let collisionCooldown = 0;
let sceneFlashLight;
let winTimer = 0;
let pendingWinner = null;
let countdownTimer = 3.0;
let nameEntryMode = 'newgame';

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
function startGame(skipNameEntry = false) {
    initAudio();
    playMusic();
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
    initAudio();
    playMusic();
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
    
    const p1Hat = document.getElementById('p1-hat-select')?.value || 'none';
    const p2Hat = document.getElementById('p2-hat-select')?.value || 'none';
    useGameStore.getState().setPlayerHats(p1Hat, p2Hat);
    
    setMusicSpeed(0.6 + (state.p1Score + state.p2Score) * 0.1);

    if (nameEntryMode === 'newgame') {
        console.log('[Proceed] Calling startGame()');
        useGameStore.getState().startGame();
    } else {
        console.log('[Proceed] Calling startRound()');
        useGameStore.getState().startRound();
    }
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

    // Players
    player1 = new Player('player1', 0xff4444, { x: -15, y: 4, z: 0 }, getPlayer1Input);
    player2 = new Player('player2', 0x4444ff, { x: 15, y: 4, z: 0 }, 
        isOnePlayer ? () => aiController.getInput() : getPlayer2Input);
    
    // Effects
    arena = new Arena();
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
        player1 = new Player('player1', 0xff4444, hostPos, getPlayer1Input);
        player2 = new Player('player2', 0x4444ff, clientPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    } else if (mySlot === 2) {
        // I'm the client (player 2) on the right, but I use player 2 controls (arrows)
        // The visual player1/player2 display doesn't change - it's about my slot
        player1 = new Player('player1', 0xff4444, hostPos, () => useGameStore.getState().online.opponentInput || defaultInput);
        player2 = new Player('player2', 0x4444ff, clientPos, getPlayer2Input);
    } else {
        // Fallback: assume we're host if slot is unknown
        player1 = new Player('player1', 0xff4444, hostPos, getPlayer1Input);
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

function checkWinConditions(delta) {
    if (!player1 || !player2) return;

    if (player1.isDead && player2.isDead) {
        useGameStore.getState().endRound('Draw');
        pendingWinner = null;
        winTimer = 0;
    } else if (player1.isDead || player2.isDead) {
        if (!pendingWinner) {
            pendingWinner = player1.isDead ? 'Player 2' : 'Player 1';
            winTimer = 0.5;
        } else {
            winTimer -= delta;
            if (winTimer <= 0) {
                useGameStore.getState().endRound(pendingWinner);
                pendingWinner = null;
            }
        }
    }
}

// ============================================
// BUTTON HANDLERS
// ============================================
function setupButtonHandlers() {
    // Menu
    document.getElementById('start-btn')?.addEventListener('click', () => {
        showScreen('gameModeSelect');
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
        showScreen('settings');
    });
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
        showScreen('menu');
    });

    // Game Mode Selection
    document.getElementById('mode-single-btn')?.addEventListener('click', () => {
        useGameStore.getState().setGameMode('1P');
    });
    document.getElementById('mode-local-btn')?.addEventListener('click', () => {
        useGameStore.getState().setGameMode('2P');
    });
    document.getElementById('mode-online-btn')?.addEventListener('click', () => {
        useGameStore.getState().setGameMode('ONLINE');
        showScreen('onlineConnect');
    });

    // Difficulty Selection
    ['easy', 'normal', 'hard'].forEach(diff => {
        document.getElementById(`difficulty-${diff}-btn`)?.addEventListener('click', () => {
            useGameStore.getState().setDifficulty(diff);
        });
    });

    // Coming Soon
    document.getElementById('coming-soon-back-btn')?.addEventListener('click', () => {
        showScreen('gameModeSelect');
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
        useGameStore.getState().resetScores();
        startGame();
    });
    document.getElementById('menu-btn')?.addEventListener('click', returnToMenu);

    // Online Connect
    document.getElementById('online-connect-back-btn')?.addEventListener('click', () => {
        online.disconnect();
        showScreen('gameModeSelect');
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
        showScreen('gameModeSelect');
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
        'ice-rate': 'iceRate',
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
            });
        }
    }

    // Initialize slider values from store
    const currentSettings = useGameStore.getState().settings;
    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        if (el && valEl && currentSettings[key] !== undefined) {
            el.value = currentSettings[key];
            valEl.textContent = currentSettings[key];
        }
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect && currentSettings.theme) {
        themeSelect.value = currentSettings.theme;
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
        document.querySelectorAll('.powerup-slider').forEach(s => {
            s.value = 50;
            const c = s.closest('.powerup-card');
            if (c) {
                c.querySelector('.powerup-value').textContent = '50';
                c.style.opacity = '1';
            }
        });
    });

    // Presets
    const presetList = document.getElementById('presets-list');
    const savePresetBtn = document.getElementById('save-preset-btn');
    const presetNameInput = document.getElementById('preset-name');

    if (presetList) {
        const loadPreset = (name, data) => {
            Object.entries(data).forEach(([key, val]) => {
                useGameStore.getState().updateSetting(key, val);
            });
        };

        const renderPresets = () => {
            const stored = localStorage.getItem('dropfall_presets');
            const presets = stored ? JSON.parse(stored) : {};
            presetList.innerHTML = Object.entries(presets).map(([name, data]) => `
                <div class="preset-item">
                    <button class="preset-load-btn">${name}</button>
                    <button class="preset-delete-btn">DEL</button>
                </div>
            `).join('');
            
            presetList.querySelectorAll('.preset-load-btn').forEach((btn, i) => {
                const name = Object.keys(presets)[i];
                btn.addEventListener('click', () => loadPreset(name, presets[name]));
            });
            presetList.querySelectorAll('.preset-delete-btn').forEach((btn, i) => {
                const name = Object.keys(presets)[i];
                btn.addEventListener('click', () => {
                    delete presets[name];
                    localStorage.setItem('dropfall_presets', JSON.stringify(presets));
                    renderPresets();
                });
            });
        };

        renderPresets();

        savePresetBtn?.addEventListener('click', () => {
            const name = presetNameInput?.value.trim();
            if (!name) return;
            const settings = useGameStore.getState().settings;
            presets[name] = { ...settings };
            localStorage.setItem('dropfall_presets', JSON.stringify(presets));
            renderPresets();
            presetNameInput.value = '';
        });
    }

    // Autorestart checkboxes
    const autoRestartMenu = document.getElementById('autorestart-menu');
    const autoRestartGameover = document.getElementById('autorestart-gameover');

    // Initialize from store
    const arSetting = useGameStore.getState().settings.autoRestart;
    if (autoRestartMenu) autoRestartMenu.checked = arSetting;
    if (autoRestartGameover) autoRestartGameover.checked = arSetting;
    
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

    // Settings tabs
    document.getElementById('settings-tab')?.addEventListener('click', () => {
        document.getElementById('settings-tab')?.classList.add('active');
        document.getElementById('powerups-tab')?.classList.remove('active');
        document.getElementById('settings-content')?.classList.add('active');
        document.getElementById('powerups-content')?.classList.remove('active');
    });
    document.getElementById('powerups-tab')?.addEventListener('click', () => {
        document.getElementById('powerups-tab')?.classList.add('active');
        document.getElementById('settings-tab')?.classList.remove('active');
        document.getElementById('powerups-content')?.classList.add('active');
        document.getElementById('settings-content')?.classList.remove('active');
    });

    // Power-up slider initialization and events
    document.querySelectorAll('.powerup-slider').forEach(slider => {
        const key = slider.dataset.powerup;
        const weights = useGameStore.getState().settings.powerUpWeights || {};
        const val = weights[key] ?? 50;
        slider.value = val;
        const card = slider.closest('.powerup-card');
        if (card) {
            card.querySelector('.powerup-value').textContent = val;
            card.style.opacity = val === 0 ? '0.4' : '1';
        }

        slider.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            const c = e.target.closest('.powerup-card');
            if (c) {
                c.querySelector('.powerup-value').textContent = v;
                c.style.opacity = v === 0 ? '0.4' : '1';
            }
            const currentWeights = { ...(useGameStore.getState().settings.powerUpWeights || {}) };
            currentWeights[key] = v;
            useGameStore.getState().updateSetting('powerUpWeights', currentWeights);
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
        updatePhysics(delta);
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
            updatePhysics(delta);
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

            camera.position.lerp(new THREE.Vector3(p1Pos.x, Math.max(24, distance * 0.96), p1Pos.z + Math.max(24, distance * 0.96)), 2 * delta);
            camera.lookAt(new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5));
        }

        // Countdown
        if (state.gameState === 'COUNTDOWN') {
            countdownTimer -= delta;
            if (countdownTimer > 0) {
                screens.countdown.textContent = String(Math.ceil(countdownTimer));
            } else {
                useGameStore.getState().setPlaying();
            }
        }

        // Win check
        if (state.gameState === 'PLAYING') {
            checkWinConditions(delta);

            // Online sync
            if (state.gameMode === 'ONLINE' && state.online.connected) {
                const input = (state.online.playerSlot === 1 ? getPlayer1Input : getPlayer2Input)();
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
        player1?.update(delta, arena, particles);
        player2?.update(delta, arena, particles);
        arena?.update(delta);
        particles?.update(delta);
        lightning?.update(delta);
        shockwaves?.update(delta);
        updatePhysics(delta);

        if (state.winner && state.winner !== 'Draw') {
            const winnerPlayer = state.winner === 'Player 1' ? player1 : player2;
            if (winnerPlayer && !winnerPlayer.isDead) {
                const t = clock.getElapsedTime();
                camera.position.set(
                    winnerPlayer.mesh.position.x + 10 * Math.cos(t * 0.5),
                    winnerPlayer.mesh.position.y + 5,
                    winnerPlayer.mesh.position.z + 10 * Math.sin(t * 0.5)
                );
                camera.lookAt(winnerPlayer.mesh.position);
                if (Math.random() > 0.9) particles?.emit(winnerPlayer.mesh.position, { x: 0, y: 10, z: 0 }, winnerPlayer.color, 5);
            }
        }
    }

    updateRenderer();
}

// ============================================
// STORE SUBSCRIPTION
// ============================================
function setupStoreSubscription() {
    useGameStore.subscribe((state, prevState) => {
        // Screen transitions
        if (state.gameState !== prevState.gameState) {
            console.log('[Store Sub] gameState changed:', prevState.gameState, '->', state.gameState);
            hideAllScreens();
            
            switch (state.gameState) {
                case 'MENU':
                    screens.menu.classList.remove('hidden');
                    break;
                case 'ONLINE':
                    screens.onlineLobby.classList.remove('hidden');
                    break;
                case 'DIFFICULTY_SELECT':
                    screens.difficultySelect.classList.remove('hidden');
                    break;
                case 'NAME_ENTRY':
                    screens.nameEntry.classList.remove('hidden');
                    document.getElementById('p1-name-input').value = state.p1Name;
                    document.getElementById('p1-hat-select').value = state.p1Hat || 'none';
                    const isOnePlayer = state.gameMode === '1P';
                    document.getElementById('name-entry-p2-field')?.classList.toggle('hidden', isOnePlayer);
                    document.getElementById('name-entry-vs')?.classList.toggle('hidden', isOnePlayer);
                    if (!isOnePlayer) {
                        document.getElementById('p2-name-input').value = state.p2Name;
                        document.getElementById('p2-hat-select').value = state.p2Hat || 'none';
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
                    setTimeout(() => {
                        if (useGameStore.getState().gameState === 'ROUND_OVER') {
                            const st = useGameStore.getState();
                            setMusicSpeed(0.6 + (st.p1Score + st.p2Score) * 0.1);
                            useGameStore.getState().startRound();
                            resetEntities();
                            updateHUDNames();
                        }
                    }, 2500);
                    break;
                case 'GAME_OVER':
                    screens.gameOver.classList.remove('hidden');
                    document.getElementById('winner-text').textContent = 
                        state.winner === 'Draw' ? 'Draw!' : `${state.winner === 'Player 1' ? state.p1Name : state.p2Name} Wins!`;
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
        document.getElementById('p1-boost').style.width = `${state.player1Boost}%`;
        document.getElementById('p2-boost').style.width = `${state.player2Boost}%`;
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
        await initPhysics();
        
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
        
        showScreen('menu');
        animate();
    } catch (error) {
        console.error('[Game] Initialization failed:', error);
    }
}

init();
