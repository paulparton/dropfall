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

function showPowerUpNotification(playerName, powerUpName, icon, color) {
    const container = document.getElementById('powerup-notifications');
    if (!container) return;
    
    // Create notification element
    const notification = document.createElement('div');
    const className = powerUpName.toLowerCase().replace(/\s+/g, '-');
    notification.className = `powerup-notification ${className}`;
    notification.textContent = `${icon} ${playerName} GOT ${powerUpName} ${icon}`;
    
    // Set the color using hex value
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    notification.style.color = hexColor;
    notification.style.textShadow = `0 0 20px ${hexColor}, 0 0 40px ${hexColor}`;
    notification.style.borderColor = hexColor;
    notification.style.boxShadow = `0 0 30px ${hexColor} inset, 0 0 50px ${hexColor}`;
    
    container.appendChild(notification);
    
    // Remove after animation completes
    setTimeout(() => notification.remove(), 3000);
}

// Make accessible globally so Player class can call it
window.showPowerUpNotification = showPowerUpNotification;

// Export power-up effects for showcase
window.POWER_UP_EFFECTS = null; // Will be set after Player import

let player1, player2, arena, particles, lightning, shockwaves;
const clock = new THREE.Clock();
let collisionCooldown = 0;
let sceneFlashLight;
let winTimer = 0;
let pendingWinner = null;
let roundTimer = 0;
let countdownTimer = 3.0;
let nameEntryMode = 'newgame'; // 'newgame' | 'nextround'

// Preset Management
const DEFAULT_PRESETS = {
    'Balanced': {
        sphereSize: 2.0,
        sphereWeight: 200,
        sphereAccel: 2000,
        collisionBounce: 0.9,
        arenaSize: 4,
        destructionRate: 3.0,
        iceRate: 2.0,
        portalRate: 8.0,
        portalCooldown: 2.0,
        bonusRate: 6.0,
        bonusDuration: 4.0,
        boostRegenSpeed: 1.5,
        boostDrainRate: 20
    },
    'Heavy & Slow': {
        sphereSize: 2.5,
        sphereWeight: 350,
        sphereAccel: 1500,
        collisionBounce: 0.7,
        arenaSize: 4,
        destructionRate: 3.0,
        iceRate: 2.0,
        portalRate: 10.0,
        portalCooldown: 2.5,
        bonusRate: 8.0,
        bonusDuration: 4.0,
        boostRegenSpeed: 1.2,
        boostDrainRate: 25
    },
    'Light & Fast': {
        sphereSize: 1.5,
        sphereWeight: 100,
        sphereAccel: 2800,
        collisionBounce: 1.2,
        arenaSize: 5,
        destructionRate: 2.0,
        iceRate: 1.5,
        portalRate: 6.0,
        portalCooldown: 1.5,
        bonusRate: 4.0,
        bonusDuration: 4.0,
        boostRegenSpeed: 2.0,
        boostDrainRate: 15
    },
    'Arena Chaos': {
        sphereSize: 2.0,
        sphereWeight: 200,
        sphereAccel: 2500,
        collisionBounce: 1.3,
        arenaSize: 3,
        destructionRate: 1.5,
        iceRate: 1.0,
        portalRate: 4.0,
        portalCooldown: 1.0,
        bonusRate: 3.0,
        bonusDuration: 4.0,
        boostRegenSpeed: 2.5,
        boostDrainRate: 12
    }
};

function getPresetsFromStorage() {
    const stored = localStorage.getItem('dropfall_presets');
    if (!stored) {
        // First time - initialize with defaults
        localStorage.setItem('dropfall_presets', JSON.stringify(DEFAULT_PRESETS));
        return DEFAULT_PRESETS;
    }
    try {
        return JSON.parse(stored);
    } catch {
        return DEFAULT_PRESETS;
    }
}

function savePresetToStorage(name, presetData) {
    const presets = getPresetsFromStorage();
    presets[name] = presetData;
    localStorage.setItem('dropfall_presets', JSON.stringify(presets));
}

function deletePresetFromStorage(name) {
    const presets = getPresetsFromStorage();
    delete presets[name];
    localStorage.setItem('dropfall_presets', JSON.stringify(presets));
}

function loadPresetSettings(presetData) {
    const currentSettings = useGameStore.getState().settings;
    const newSettings = { ...currentSettings };
    Object.keys(presetData).forEach(key => {
        if (key in newSettings && typeof presetData[key] === typeof newSettings[key]) {
            newSettings[key] = presetData[key];
        }
    });
    Object.keys(newSettings).forEach(key => {
        useGameStore.getState().updateSetting(key, newSettings[key]);
    });
    updateUIFromSettings();
}

function updatePresetsUI() {
    const presetsList = document.getElementById('presets-list');
    if (!presetsList) return;
    
    const presets = getPresetsFromStorage();
    presetsList.innerHTML = '';
    
    Object.entries(presets).forEach(([name, data]) => {
        const presetEl = document.createElement('div');
        presetEl.style.cssText = 'display: flex; gap: 8px; align-items: center; padding: 6px; background: rgba(0,255,255,0.1); border-radius: 4px;';
        presetEl.innerHTML = `
            <button style="flex: 1; background: #000; color: #0ff; border: 1px solid #0ff; padding: 6px; cursor: pointer; font-family: 'Courier New', monospace; text-align: left;">
                ${name}
            </button>
            <button style="background: #ff0000; color: #000; border: 1px solid #ff0000; padding: 4px 8px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 0.8rem;">
                DEL
            </button>
        `;
        
        const loadBtn = presetEl.querySelector('button:first-child');
        const delBtn = presetEl.querySelector('button:last-child');
        
        loadBtn.addEventListener('click', () => {
            loadPresetSettings(data);
        });
        
        delBtn.addEventListener('click', () => {
            deletePresetFromStorage(name);
            updatePresetsUI();
        });
        
        presetsList.appendChild(presetEl);
    });
}

// Settings Map and UI Update Function - Module Level for accessibility
const settingsMap = {
    'sphere-size': 'sphereSize',
    'sphere-weight': 'sphereWeight',
    'sphere-accel': 'sphereAccel',
    'collision-bounce': 'collisionBounce',
    'arena-size': 'arenaSize',
    'destruction-rate': 'destructionRate',
    'ice-rate': 'iceRate',
    'portal-rate': 'portalRate',
    'portal-cooldown': 'portalCooldown',
    'bonus-rate': 'bonusRate',
    'bonus-duration': 'bonusDuration',
    'music-volume': 'musicVolume',
    'sfx-volume': 'sfxVolume',
    'particle-amount': 'particleAmount',
    'bloom-level': 'bloomLevel',
    'boost-regen-speed': 'boostRegenSpeed',
    'boost-drain-rate': 'boostDrainRate',
    'player-aura-size': 'playerAuraSize',
    'player-aura-opacity': 'playerAuraOpacity',
    'player-glow-intensity': 'playerGlowIntensity',
    'player-glow-range': 'playerGlowRange'
};

function updateUIFromSettings() {
    const settings = useGameStore.getState().settings;
    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        if (el && valEl) {
            el.value = settings[key];
            valEl.textContent = settings[key];
        }
    }
    
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = settings.theme || 'default';
    }
    
    // Update control buttons
    document.getElementById('btn-p1-up').textContent = settings.controls.p1.up;
    document.getElementById('btn-p1-down').textContent = settings.controls.p1.down;
    document.getElementById('btn-p1-left').textContent = settings.controls.p1.left;
    document.getElementById('btn-p1-right').textContent = settings.controls.p1.right;
    document.getElementById('btn-p1-boost').textContent = settings.controls.p1.boost;
    document.getElementById('btn-p2-up').textContent = settings.controls.p2.up;
    document.getElementById('btn-p2-down').textContent = settings.controls.p2.down;
    document.getElementById('btn-p2-left').textContent = settings.controls.p2.left;
    document.getElementById('btn-p2-right').textContent = settings.controls.p2.right;
    document.getElementById('btn-p2-boost').textContent = settings.controls.p2.boost;
}

async function init() {
    if (window.__GAME_INITIALIZED__) return;
    window.__GAME_INITIALIZED__ = true;

    // 1. Initialize Systems
    initRenderer();
    initInput();
    await initPhysics();

    // Initialize Menu Background
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    // Add global flash light
    sceneFlashLight = new THREE.PointLight(0xffffff, 0, 200);
    sceneFlashLight.position.set(0, 10, 0);
    scene.add(sceneFlashLight);

    // 2. Setup UI Listeners
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('menu-btn').addEventListener('click', returnToMenu);

    // Name entry flow
    document.getElementById('name-entry-play-btn').addEventListener('click', proceedFromNameEntry);
    document.getElementById('name-entry-menu-btn').addEventListener('click', () => {
        document.getElementById('name-entry').classList.add('hidden');
        returnToMenu();
    });
    // Allow Enter key to proceed from name inputs
    ['p1-name-input', 'p2-name-input'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') proceedFromNameEntry();
        });
    });
    
    // HUD Buttons
    document.getElementById('hud-restart-btn').addEventListener('click', () => {
        useGameStore.getState().resetScores();
        startGame();
    });
    document.getElementById('hud-menu-btn').addEventListener('click', returnToMenu);
    
    const settingsPanel = document.getElementById('settings-panel');
    const controllerSettingsPanel = document.getElementById('controller-settings-panel');
    const showControllerBtn = document.getElementById('show-controller-settings-btn');
    const closeControllerBtn = document.getElementById('close-controller-settings-btn');

    document.getElementById('settings-btn').addEventListener('click', () => {
        settingsPanel.classList.remove('hidden');
        controllerSettingsPanel.classList.add('hidden');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        controllerSettingsPanel.classList.add('hidden');
    });

    // Overlay controller settings on top of settings panel
    if (showControllerBtn && controllerSettingsPanel && closeControllerBtn) {
        showControllerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            controllerSettingsPanel.classList.remove('hidden');
        });
        closeControllerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            controllerSettingsPanel.classList.add('hidden');
        });
    }

    // --- Gamepad Menu Navigation ---
    let menuIndex = 0;
    let lastMenuMove = 0;
    const menuButtons = [
        document.getElementById('start-btn'),
        document.getElementById('settings-btn'),
        document.getElementById('menu-btn'),
    ].filter(Boolean);

    function highlightMenuButton(idx) {
        menuButtons.forEach((btn, i) => {
            if (btn) btn.classList.toggle('selected', i === idx);
        });
    }

    function activateMenuButton(idx) {
        if (menuButtons[idx]) menuButtons[idx].click();
    }

    function pollMenuGamepad() {
        const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(gp => gp) : [];
        let moved = false;
        for (let i = 0; i < 2; i++) {
            const gp = gamepads[i];
            if (gp) {
                // Up/Down on left stick or dpad
                const up = gp.axes[1] < -0.5 || gp.buttons[12]?.pressed;
                const down = gp.axes[1] > 0.5 || gp.buttons[13]?.pressed;
                const select = gp.buttons[0]?.pressed || gp.buttons[7]?.pressed; // A or R2
                if ((up || down) && performance.now() - lastMenuMove > 200) {
                    if (up) menuIndex = (menuIndex - 1 + menuButtons.length) % menuButtons.length;
                    if (down) menuIndex = (menuIndex + 1) % menuButtons.length;
                    highlightMenuButton(menuIndex);
                    lastMenuMove = performance.now();
                    moved = true;
                }
                if (select && menuButtons[menuIndex]) {
                    activateMenuButton(menuIndex);
                    lastMenuMove = performance.now();
                }
            }
        }
        // Only highlight if in menu
        if (useGameStore.getState().gameState === 'MENU') {
            highlightMenuButton(menuIndex);
            requestAnimationFrame(pollMenuGamepad);
        } else {
            // Remove highlight when leaving menu
            menuButtons.forEach(btn => btn && btn.classList.remove('selected'));
            menuIndex = 0;
        }
    }

    // Add CSS for selected menu button
    const style = document.createElement('style');
    style.textContent = `.selected { outline: 3px solid #0ff !important; filter: brightness(1.5); }`;
    document.head.appendChild(style);

    // Start polling for menu navigation
    useGameStore.subscribe((state, prevState) => {
        if (state.gameState === 'MENU' && prevState.gameState !== 'MENU') {
            setTimeout(() => pollMenuGamepad(), 100); // Delay to ensure menu is visible
        }
    });

    // Settings Sliders - Initialize UI with current settings
    updateUIFromSettings();

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            useGameStore.getState().updateSetting('theme', e.target.value);
            if (useGameStore.getState().gameState === 'MENU') {
                returnToMenu(); // Recreate arena with new theme
            }
        });
    }

    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            valEl.textContent = val;
            useGameStore.getState().updateSetting(key, val);
            
            // Apply volume immediately
            if (key === 'musicVolume') {
                import('./audio.js').then(module => {
                    module.setMusicVolume(val);
                });
            } else if (key === 'sfxVolume') {
                import('./audio.js').then(module => {
                    module.setSfxVolume(val);
                });
            } else if (key === 'bloomLevel') {
                import('./renderer.js').then(module => {
                    module.setBloomLevel(val);
                });
            }
        });
    }

    // --- Enhanced Control Binding: Keyboard & Controller ---
    const controlBtns = document.querySelectorAll('.control-btn');
    let listeningFor = null;
    let lastGamepadButton = null;
    let listeningPollActive = false;

    // Listen for button click to start binding
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
            lastGamepadButton = null;
            listeningPollActive = true;
        });
    });

    // Keyboard binding
    window.addEventListener('keydown', (e) => {
        if (listeningFor) {
            e.preventDefault();
            const key = e.code;
            listeningFor.textContent = key;
            listeningFor.classList.remove('listening');
            
            const idParts = listeningFor.id.split('-');
            const player = idParts[1];
            const action = idParts[2];
            
            const currentControls = useGameStore.getState().settings.controls;
            const newControls = JSON.parse(JSON.stringify(currentControls));
            newControls[player][action] = key;
            useGameStore.getState().updateSetting('controls', newControls);
            listeningFor = null;
            listeningPollActive = false;
        }
    });

    // Continuous polling loop for controller binding and feedback
    function pollControllers() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < pads.length; i++) {
            const gp = pads[i];
            if (gp && gp.connected) {
                for (let b = 0; b < gp.buttons.length; b++) {
                    if (gp.buttons[b].pressed) {
                        // If listening for binding
                        if (listeningFor && listeningPollActive && lastGamepadButton !== b) {
                            const label = `GP${i+1}-B${b}`;
                            listeningFor.textContent = label;
                            listeningFor.classList.remove('listening');
                            
                            const idParts = listeningFor.id.split('-');
                            const player = idParts[1];
                            const action = idParts[2];
                            const currentControls = useGameStore.getState().settings.controls;
                            const newControls = JSON.parse(JSON.stringify(currentControls));
                            newControls[player][action] = label;
                            useGameStore.getState().updateSetting('controls', newControls);
                            listeningFor = null;
                            listeningPollActive = false;
                            lastGamepadButton = b;
                            setTimeout(() => { lastGamepadButton = null; }, 200);
                        } else if (!listeningPollActive) {
                            // Live feedback for mapped buttons
                            controlBtns.forEach(btn => {
                                if (btn.textContent === `GP${i+1}-B${b}`) {
                                    btn.classList.add('feedback');
                                    setTimeout(() => btn.classList.remove('feedback'), 100);
                                }
                            });
                        }
                    }
                }
            }
        }
        requestAnimationFrame(pollControllers);
    }
    pollControllers();

    document.getElementById('reset-settings-btn').addEventListener('click', () => {
        useGameStore.getState().resetSettings();
        updateUIFromSettings();
        const settings = useGameStore.getState().settings;
        import('./audio.js').then(module => {
            module.setMusicVolume(settings.musicVolume);
            module.setSfxVolume(settings.sfxVolume);
        });
    });

    // --- Autorestart Setup ---
    const autorestartMenuCheckbox = document.getElementById('autorestart-menu');
    const autorestartGameoverCheckbox = document.getElementById('autorestart-gameover');
    
    // Load stored autorestart preference
    const storedAutoRestart = localStorage.getItem('dropfall_autorestart') === 'true';
    useGameStore.getState().updateSetting('autoRestart', storedAutoRestart);
    if (autorestartMenuCheckbox) autorestartMenuCheckbox.checked = storedAutoRestart;
    if (autorestartGameoverCheckbox) autorestartGameoverCheckbox.checked = storedAutoRestart;

    // Save autorestart state on menu checkbox change
    if (autorestartMenuCheckbox) {
        autorestartMenuCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('dropfall_autorestart', e.target.checked);
            useGameStore.getState().updateSetting('autoRestart', e.target.checked);
            if (autorestartGameoverCheckbox) autorestartGameoverCheckbox.checked = e.target.checked;
        });
    }

    // Save autorestart state on game-over checkbox change
    if (autorestartGameoverCheckbox) {
        autorestartGameoverCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('dropfall_autorestart', e.target.checked);
            useGameStore.getState().updateSetting('autoRestart', e.target.checked);
            if (autorestartMenuCheckbox) autorestartMenuCheckbox.checked = e.target.checked;
        });
    }

    // --- Presets Setup ---
    const savePresetBtn = document.getElementById('save-preset-btn');
    const presetNameInput = document.getElementById('preset-name');
    
    // Initialize presets UI when settings panel opens
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            updatePresetsUI();
        });
    }
    
    // Save preset button
    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', () => {
            const name = presetNameInput.value.trim();
            if (!name) {
                alert('Please enter a preset name');
                return;
            }
            
            const currentSettings = useGameStore.getState().settings;
            const presetData = {
                sphereSize: currentSettings.sphereSize,
                sphereWeight: currentSettings.sphereWeight,
                sphereAccel: currentSettings.sphereAccel,
                collisionBounce: currentSettings.collisionBounce,
                arenaSize: currentSettings.arenaSize,
                destructionRate: currentSettings.destructionRate,
                iceRate: currentSettings.iceRate,
                boostRegenSpeed: currentSettings.boostRegenSpeed,
                boostDrainRate: currentSettings.boostDrainRate,
                theme: currentSettings.theme,
                musicVolume: currentSettings.musicVolume,
                sfxVolume: currentSettings.sfxVolume,
                particleAmount: currentSettings.particleAmount,
                bloomLevel: currentSettings.bloomLevel,
                playerAuraSize: currentSettings.playerAuraSize,
                playerAuraOpacity: currentSettings.playerAuraOpacity,
                playerGlowIntensity: currentSettings.playerGlowIntensity,
                playerGlowRange: currentSettings.playerGlowRange
            };
            
            savePresetToStorage(name, presetData);
            presetNameInput.value = '';
            updatePresetsUI();
        });
    }
    
    // Initialize presets UI on first load
    updatePresetsUI();

    // Initialize power-ups showcase and tabs
    const settingsTabBtn = document.getElementById('settings-tab');
    const powerupsTabBtn = document.getElementById('powerups-tab');
    const settingsContent = document.getElementById('settings-content');
    const powerupsContent = document.getElementById('powerups-content');
    const powerupsGrid = document.getElementById('powerups-grid');

    if (settingsTabBtn && powerupsTabBtn && settingsContent && powerupsContent && powerupsGrid) {
        // Tab switching
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

        // Populate power-ups showcase
        POWER_UP_EFFECTS.forEach(powerUp => {
            const hexColor = '#' + powerUp.color.toString(16).padStart(6, '0');
            const card = document.createElement('div');
            card.className = 'powerup-card';
            card.style.borderColor = hexColor;
            card.style.color = hexColor;
            card.innerHTML = `
                <div class="powerup-card-icon">${powerUp.icon}</div>
                <div class="powerup-card-name">${powerUp.name}</div>
                <div class="powerup-card-description">${powerUp.description}</div>
                <div class="powerup-card-meta">
                    <div class="powerup-card-meta-item">
                        <span class="powerup-card-meta-label">Rarity</span>
                        <span class="powerup-card-meta-value">⭐ Random</span>
                    </div>
                    <div class="powerup-card-meta-item">
                        <span class="powerup-card-meta-label">Effect</span>
                        <span class="powerup-card-meta-value">Temporary</span>
                    </div>
                </div>
            `;
            powerupsGrid.appendChild(card);
        });
    }

    // Start menu music on first interaction
    document.addEventListener('click', () => {
        if (useGameStore.getState().gameState === 'MENU') {
            initAudio();
            playMusic();
            setMusicSpeed(0.5);
        }
    }, { once: true });

    // 3. Start Game Loop
    animate();
}

function startGame(skipNameEntry = false) {
    initAudio();
    playMusic();
    setMusicSpeed(0.5);

    useGameStore.getState().resetScores();

    if (skipNameEntry) {
        _doStartGame();
    } else {
        nameEntryMode = 'newgame';
        useGameStore.getState().enterNameEntry();
    }
}

function _doStartGame() {
    const state = useGameStore.getState();
    const totalScore = state.p1Score + state.p2Score;
    const speed = 0.6 + (totalScore * 0.1);
    setMusicSpeed(Math.min(speed, 1.0));
    useGameStore.getState().startGame();
    resetEntities();
    updateHUDNames();
}

function proceedFromNameEntry() {
    const p1Raw = document.getElementById('p1-name-input').value.trim();
    const p2Raw = document.getElementById('p2-name-input').value.trim();
    const p1Name = (p1Raw || 'Player 1').substring(0, 12);
    const p2Name = (p2Raw || 'Player 2').substring(0, 12);
    useGameStore.getState().setPlayerNames(p1Name, p2Name);

    const state = useGameStore.getState();
    const totalScore = state.p1Score + state.p2Score;
    const speed = 0.6 + (totalScore * 0.1);
    setMusicSpeed(Math.min(speed, 1.0));

    if (nameEntryMode === 'newgame') {
        useGameStore.getState().startGame();
    } else {
        useGameStore.getState().startRound();
    }
    resetEntities();
    updateHUDNames();
}

function updateHUDNames() {
    const state = useGameStore.getState();
    const p1NameEl = document.querySelector('#hud .player-stats.p1 .name');
    const p2NameEl = document.querySelector('#hud .player-stats.p2 .name');
    if (p1NameEl) p1NameEl.textContent = state.p1Name;
    if (p2NameEl) p2NameEl.textContent = state.p2Name;
}

function startRound() {
    // Calculate music speed based on total score (level)
    const state = useGameStore.getState();
    const totalScore = state.p1Score + state.p2Score;
    // Level 1 (0 score) = 0.6, Level 5 (4 score) = 1.0
    const speed = 0.6 + (totalScore * 0.1);
    setMusicSpeed(Math.min(speed, 1.0));

    useGameStore.getState().startRound();
    resetEntities();
    updateHUDNames();
}

function returnToMenu() {
    useGameStore.getState().returnToMenu();
    setMusicSpeed(0.5);
    if (player1) player1.cleanup();
    if (player2) player2.cleanup();
    if (arena) arena.cleanup();
    if (particles) particles.cleanup();
    if (lightning) lightning.cleanup();
    if (shockwaves) shockwaves.cleanup();
    
    player1 = null;
    player2 = null;
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();
    
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);
}

function resetEntities() {
    // Cleanup previous game state
    if (player1) player1.cleanup();
    if (player2) player2.cleanup();
    if (arena) arena.cleanup();
    if (particles) particles.cleanup();
    if (lightning) lightning.cleanup();
    if (shockwaves) shockwaves.cleanup();

    // Initialize Entities
    player1 = new Player('player1', 0xff4444, { x: -15, y: 4, z: 0 }, getPlayer1Input);
    player2 = new Player('player2', 0x4444ff, { x: 15, y: 4, z: 0 }, getPlayer2Input);
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    // Reset Camera
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    pendingWinner = null;
    winTimer = 0;
    roundTimer = 0;
    countdownTimer = 3.0;
}

function updateGamepadDebug() {
    const connectedPads = getConnectedGamepads();
    const debugInfo = document.getElementById('gamepad-debug');
    
    if (!debugInfo) {
        const newDebug = document.createElement('div');
        newDebug.id = 'gamepad-debug';
        newDebug.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #0ff; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #0ff; z-index: 9999; pointer-events: none; max-width: 250px;';
        document.body.appendChild(newDebug);
    }
    
    const debugObj = document.getElementById('gamepad-debug');
    if (debugObj) {
        const gamepadState = getGamepadState();
        let html = `<strong>CONTROLLERS: ${connectedPads.length}</strong><br>`;
        
        connectedPads.forEach((pad) => {
            html += `<br><strong>P${pad.index+1}: ${pad.id}</strong><br>`;
            const state = gamepadState[pad.index];
            if (state) {
                html += `U:${state.up?'█':'_'} D:${state.down?'█':'_'} L:${state.left?'█':'_'} R:${state.right?'█':'_'} BOOST:${state.boost?'█':'_'}`;
            } else {
                html += 'State unavailable';
            }
        });
        
        debugObj.innerHTML = html;
    }
}

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta time
    const state = useGameStore.getState();
    
    // Update debug display
    if (state.gameState !== 'MENU') {
        updateGamepadDebug();
    }

    if (state.gameState === 'MENU') {
        if (arena) {
            arena.update(delta);
            // Reset arena if too many tiles fell to keep the background full
            if (arena.tiles.filter(t => t.state === 'NORMAL').length < 30) {
                arena.cleanup();
                arena = new Arena();
            }
        }
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);
        updatePhysics(delta);

        // Endless scrolling effect (orbiting camera)
        const time = clock.getElapsedTime();
        camera.position.set(Math.sin(time * 0.1) * 30, 25, Math.cos(time * 0.1) * 30);
        camera.lookAt(0, 0, 0);
    } else if (state.gameState === 'COUNTDOWN' || state.gameState === 'PLAYING') {
        // 1. Update Entities
        if (player1) player1.update(delta, arena, particles);
        if (player2) player2.update(delta, arena, particles);
        if (arena) arena.update(delta);
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);

        // Update power-up status displays
        if (player1) {
            const p1StatusEl = document.getElementById('p1-powerups');
            if (p1StatusEl) {
                p1StatusEl.innerHTML = player1.activePowerUps.map(pu => {
                    const hexColor = '#' + pu.effect.color.toString(16).padStart(6, '0');
                    return `<div class="powerup-icon" style="color: ${hexColor}; border-color: ${hexColor};">${pu.effect.icon}</div>`;
                }).join('');
            }
        }
        if (player2) {
            const p2StatusEl = document.getElementById('p2-powerups');
            if (p2StatusEl) {
                p2StatusEl.innerHTML = player2.activePowerUps.map(pu => {
                    const hexColor = '#' + pu.effect.color.toString(16).padStart(6, '0');
                    return `<div class="powerup-icon" style="color: ${hexColor}; border-color: ${hexColor};">${pu.effect.icon}</div>`;
                }).join('');
            }
        }

        // 2. Step Physics
        updatePhysics(delta);

        // 3. Update Camera (Track Midpoint) and Check Player Collisions
        if (collisionCooldown > 0) collisionCooldown -= delta;

        if (player1 && player2 && !player1.isDead && !player2.isDead) {
            const p1Pos = player1.mesh.position;
            const p2Pos = player2.mesh.position;

            const midpoint = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
            const distance = p1Pos.distanceTo(p2Pos);
            
            const settings = useGameStore.getState().settings;
            const collisionDistance = settings.sphereSize * 2 + 0.1; // Dynamic collision distance based on sphere size

            // Collision Sparks and Light Flash
            if (distance <= collisionDistance && collisionCooldown <= 0) {
                collisionCooldown = 0.5; // Prevent spamming
                
                // Calculate impact speed
                const v1 = player1.rigidBody.linvel();
                const v2 = player2.rigidBody.linvel();
                const relVel = new THREE.Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z).length();
                const impactIntensity = Math.min(Math.max(relVel / 20, 1), 5); // Scale 1 to 5

                // Apply bounce impulse
                const dir1 = new THREE.Vector3().subVectors(p1Pos, p2Pos).normalize();
                const dir2 = new THREE.Vector3().subVectors(p2Pos, p1Pos).normalize();
                
                let bounceMultiplier = 1.0;
                if (player1.isBoosting || player2.isBoosting) {
                    bounceMultiplier = 1.5;
                }
                
                const bounceForce = (1500 + (relVel * 10)) * bounceMultiplier; // Scale bounce slightly with impact
                player1.rigidBody.applyImpulse({ x: dir1.x * bounceForce, y: 0, z: dir1.z * bounceForce }, true);
                player2.rigidBody.applyImpulse({ x: dir2.x * bounceForce, y: 0, z: dir2.z * bounceForce }, true);
                
                // Emit sparks at midpoint
                if (particles) {
                    // Less particles, subtle translucent orange/red color
                    const sparkCount = Math.floor(15 * impactIntensity);
                    particles.emit(midpoint, { x: 0, y: 10, z: 0 }, 0xff4400, sparkCount);
                }

                // Flash lights brightly
                player1.glow.intensity = 10.0 * impactIntensity;
                player2.glow.intensity = 10.0 * impactIntensity;

                // Lightning strike
                if (lightning && (player1.isBoosting || player2.isBoosting)) {
                    lightning.emit(midpoint, impactIntensity);
                    
                    // Big lightning effect: dim arena, bright flash
                    if (ambientLight && directionalLight) {
                        ambientLight.intensity = 0.01; // Dim arena to near pitch black
                        directionalLight.intensity = 0.01;
                    }
                    if (sceneFlashLight) {
                        sceneFlashLight.position.copy(midpoint);
                        sceneFlashLight.position.y += 15;
                        sceneFlashLight.intensity = 400.0 * impactIntensity; // Even brighter flash to compensate
                        sceneFlashLight.color.setHex(0x00ffff); // Cyan flash
                    }
                }

                // Play collision sound
                playCollisionSound(impactIntensity);
            }

            // Gradually dim lights back to normal
            if (player1.glow.intensity > 1.0) player1.glow.intensity -= delta * 10;
            if (player2.glow.intensity > 1.0) player2.glow.intensity -= delta * 10;
            if (sceneFlashLight && sceneFlashLight.intensity > 0) sceneFlashLight.intensity -= delta * 40;
            
            // Gradually restore arena lighting (slightly slower for dramatic effect)
            if (ambientLight && ambientLight.intensity < 1.5) {
                ambientLight.intensity += delta * 3;
                if (ambientLight.intensity > 1.5) ambientLight.intensity = 1.5;
            }
            if (directionalLight && directionalLight.intensity < 2.0) {
                directionalLight.intensity += delta * 4;
                if (directionalLight.intensity > 2.0) directionalLight.intensity = 2.0;
            }

            camera.position.lerp(new THREE.Vector3(midpoint.x, Math.max(24, distance * 0.96), midpoint.z + Math.max(24, distance * 0.96)), 2 * delta);
            camera.lookAt(midpoint);
        }

        if (state.gameState === 'COUNTDOWN') {
            countdownTimer -= delta;
            const countdownDisplay = document.getElementById('countdown-display');
            if (countdownTimer > 0) {
                countdownDisplay.textContent = Math.ceil(countdownTimer);
            } else {
                useGameStore.getState().setPlaying();
            }
        } else if (state.gameState === 'PLAYING') {
            // 4. Check Win Conditions
            checkWinConditions(delta);
        }
    } else if (state.gameState === 'NAME_ENTRY') {
        // Keep scene alive behind name entry overlay
        if (arena) arena.update(delta);
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);
        updatePhysics(delta);
    } else if (state.gameState === 'GAME_OVER' || state.gameState === 'ROUND_OVER') {
        // Continue updating physics and entities so players keep falling
        if (player1) player1.update(delta, arena, particles);
        if (player2) player2.update(delta, arena, particles);
        if (arena) arena.update(delta);
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);
        updatePhysics(delta);

        // Cinematic Camera Orbit
        if (state.winner && state.winner !== 'Draw') {
            const winnerPlayer = state.winner === 'Player 1' ? player1 : player2;
            if (winnerPlayer && !winnerPlayer.isDead) {
                const targetPos = winnerPlayer.mesh.position;
                const time = clock.getElapsedTime();

                const orbitRadius = 10;
                const orbitSpeed = 0.5;

                const x = targetPos.x + orbitRadius * Math.cos(time * orbitSpeed);
                const z = targetPos.z + orbitRadius * Math.sin(time * orbitSpeed);

                camera.position.lerp(new THREE.Vector3(x, targetPos.y + 5, z), 2 * delta);
                camera.lookAt(targetPos);

                // Celebration Particles
                if (Math.random() > 0.9) {
                    particles.emit(targetPos, { x: 0, y: 10, z: 0 }, winnerPlayer.color, 5);
                }
            }
        }

        if (state.gameState === 'ROUND_OVER') {
            // Transition to name entry after brief cinematic pause
        }
    }

    // 5. Render Scene
    updateRenderer();
}

function checkWinConditions(delta) {
    if (!player1 || !player2) return;

    if (player1.isDead && player2.isDead) {
        useGameStore.getState().endRound('Draw');
        pendingWinner = null;
        winTimer = 0;
        roundTimer = 3.0;
    } else if (player1.isDead || player2.isDead) {
        if (!pendingWinner) {
            pendingWinner = player1.isDead ? 'Player 2' : 'Player 1';
            winTimer = 0.5;
        } else {
            winTimer -= delta;
            if (winTimer <= 0) {
                useGameStore.getState().endRound(pendingWinner);
                pendingWinner = null;
                roundTimer = 3.0;
            }
        }
    }
}

// Start the application
init();

// HUD Logic
const menuScreen = document.getElementById('menu');
const hudScreen = document.getElementById('hud');
const gameOverScreen = document.getElementById('game-over');
const p1BoostBar = document.getElementById('p1-boost');
const p2BoostBar = document.getElementById('p2-boost');
const p1ScoreText = document.getElementById('p1-score');
const p2ScoreText = document.getElementById('p2-score');
const effectsContainer = document.getElementById('effects');
const winnerText = document.getElementById('winner-text');

useGameStore.subscribe((state, prevState) => {
    // Update Game State UI
    if (state.gameState !== prevState.gameState) {
        if (state.gameState === 'MENU') {
            menuScreen.classList.remove('hidden');
            hudScreen.classList.add('hidden');
            gameOverScreen.classList.add('hidden');
            document.getElementById('name-entry').classList.add('hidden');
            document.getElementById('countdown-display').classList.add('hidden');
        } else if (state.gameState === 'NAME_ENTRY') {
            const nameEntryScreen = document.getElementById('name-entry');
            menuScreen.classList.add('hidden');
            hudScreen.classList.add('hidden');
            gameOverScreen.classList.add('hidden');
            document.getElementById('countdown-display').classList.add('hidden');
            nameEntryScreen.classList.remove('hidden');
            // Pre-fill inputs with stored names
            document.getElementById('p1-name-input').value = state.p1Name;
            document.getElementById('p2-name-input').value = state.p2Name;
            // Show round info if between rounds
            const infoEl = document.getElementById('name-entry-round-info');
            if (nameEntryMode === 'nextround') {
                infoEl.textContent = `SCORE: ${state.p1Name} ${state.p1Score} — ${state.p2Score} ${state.p2Name}`;
            } else {
                infoEl.textContent = 'FIRST TO 3 ROUNDS WINS';
            }
        } else if (state.gameState === 'COUNTDOWN') {
            document.getElementById('name-entry').classList.add('hidden');
            menuScreen.classList.add('hidden');
            hudScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');
            const countdownDisplay = document.getElementById('countdown-display');
            countdownDisplay.classList.remove('hidden');
            countdownDisplay.textContent = '3';
        } else if (state.gameState === 'PLAYING') {
            menuScreen.classList.add('hidden');
            hudScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');
            const countdownDisplay = document.getElementById('countdown-display');
            countdownDisplay.textContent = 'GO!';
            countdownDisplay.classList.remove('hidden');
            // Ensure countdown is hidden when playing starts
            setTimeout(() => {
                countdownDisplay.classList.add('hidden');
            }, 1000);
        } else if (state.gameState === 'ROUND_OVER') {
            // After a brief cinematic pause, show name entry for next round
            setTimeout(() => {
                if (useGameStore.getState().gameState === 'ROUND_OVER') {
                    nameEntryMode = 'nextround';
                    useGameStore.getState().enterNameEntry();
                }
            }, 2500);
        } else if (state.gameState === 'GAME_OVER') {
            menuScreen.classList.add('hidden');
            hudScreen.classList.add('hidden');
            gameOverScreen.classList.remove('hidden');
            winnerText.textContent = state.winner === 'Draw' ? 'Draw!' : `${state.winner === 'Player 1' ? state.p1Name : state.p2Name} Wins!`;
            
            // Auto-restart if enabled
            if (state.settings.autoRestart) {
                setTimeout(() => {
                    if (useGameStore.getState().gameState === 'GAME_OVER') {
                        useGameStore.getState().resetScores();
                        startGame(true); // skip name entry for auto-restart
                    }
                }, 2000);
            }
        }
    }

    // Update Scores
    p1ScoreText.textContent = state.p1Score;
    p2ScoreText.textContent = state.p2Score;

    // Update Boost Meters
    p1BoostBar.style.width = `${state.player1Boost}%`;
    p2BoostBar.style.width = `${state.player2Boost}%`;

    // Update Active Effects
    effectsContainer.innerHTML = state.activeTileEffects.map(e => `<div class="effect ${e.type}">${e.name}</div>`).join('');
});

// Handle Vite HMR
if (import.meta.hot) {
    import.meta.hot.accept(() => {
        window.location.reload();
    });
}
