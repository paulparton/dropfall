import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { useGameStore } from './store.js';
import { initPhysics, world as physicsWorld } from './physics.js';
import { getPhysicsSystem } from './systems/PhysicsSystem.js';
import { initRenderer, updateRenderer, getPerformanceMetrics, camera, scene, renderer, ambientLight, directionalLight } from './renderer.js';
import { initInput, resetInputState, getPlayer1Input, getPlayer2Input, getConnectedGamepads, getGamepadState } from './input.js';
import { createInputHandler } from './handlers/InputHandler.js';
import { replayRecorder, resetReplayRecorder } from './systems/ReplayRecorder.js';
import { createReplayModal } from './components/ReplayModal.js';
import { createCharacterPreviewPanel, destroyPreviewPanel, getSelectedPreviewLevelId } from './components/CharacterPreviewPanel';
import { createOnlineSetupPanel } from './components/OnlineSetupPanel';
import { createLevelEditor } from './components/LevelEditor.js';
import { createHatGallery } from './components/HatGallery.js';
import { getLevelById } from './levels/levelProvider.js';
import { hexToPixel } from './utils/math.js';
import { getHatDefinition, HAT_VALUES } from './utils/hatCatalog.js';
import {
    MATCH_PRESETS,
    MATCH_SETTING_FIELDS,
    MATCH_THEMES,
    formatMatchSettingValue,
} from '../shared/matchSettings.js';

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
import { GameFeelSystem } from './systems/GameFeelSystem.js';
import { initAudio, playMusic, playCollisionSound, setMusicSpeed, setMusicVolume, setSfxVolume, updateRollingSound } from './audio.js';
import { POWER_UP_EFFECTS } from './entities/Player.js';
import { AIController } from './ai/AIController.js';
import { online, OnlineManager } from './online.js';
import { initVR, isInVR, onVRSessionStart, onVRSessionEnd, initAR, isInAR, getXRSessionMode } from './vr/VRSession.js';
import { initControllers, updateControllers } from './vr/VRControllers.js';
import { applyVRScale, createVRCameraRig, getVRContainer, reparentToScene, reparentToVRContainer, updateVRCameraRig } from './vr/VRCamera.js';
import { createVRUI, updateVRUI } from './vr/VRUI.js';
import {
    addLocalProfile,
    getLocalLeaderboard,
    getSelectedLocalProfile,
    loadLocalProfiles,
    recordLocalMatch,
    saveLocalProfiles,
    selectLocalProfile,
    updateLocalProfile,
} from './services/localProfiles.js';
import { getProductModel } from './services/monetization.js';

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
    // Pick random color and hat
    const randomColor = ballColors[Math.floor(Math.random() * ballColors.length)];
    const randomHat = HAT_VALUES[Math.floor(Math.random() * HAT_VALUES.length)];
    
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
    
    // Legacy canvas preview fallback. Live setup screens render the shared 3D
    // cosmetic and authored portrait instead of emoji.
    if (hat !== 'none') {
        const hatDefinition = getHatDefinition(hat);
        ctx.strokeStyle = hatDefinition?.artStatus === 'vertical-slice' ? '#37f7ff' : '#ff2ca8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ballX, ballY - ballRadius - 12, 24, Math.PI, Math.PI * 2);
        ctx.stroke();
    }
    
    return canvas.toDataURL();
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
const screens = {
    menu: document.getElementById('menu'),
    profileHub: document.getElementById('profile-hub'),
    hatGallery: document.getElementById('hat-gallery-screen'),
    levelEditor: document.getElementById('level-editor-screen'),
    gameModeSelect: document.getElementById('game-mode-select'),
    difficultySelect: document.getElementById('difficulty-select'),
    nameEntry: document.getElementById('name-entry'),
    settings: document.getElementById('settings-panel'),
    hud: document.getElementById('hud'),
    gameOver: document.getElementById('game-over'),
    onlineConnect: document.getElementById('online-connect'),
    onlineLobby: document.getElementById('online-lobby'),
    onlineSetup: document.getElementById('online-setup'),
    comingSoon: document.getElementById('coming-soon'),
    countdown: document.getElementById('countdown-display'),
};

let localProfilesState = loadLocalProfiles(useGameStore.getState().p1Name);
let trackedLocalMatch = null;
let activeHatGallery = null;
let editorTestInProgress = false;

function updateEditorTestNavigation(isTesting) {
    const hudMenuButton = document.getElementById('hud-menu-btn');
    const hudMenuLabel = hudMenuButton?.querySelector('span');
    if (hudMenuLabel) hudMenuLabel.textContent = isTesting ? 'EDITOR' : 'MENU';
    if (hudMenuButton) hudMenuButton.setAttribute('aria-label', isTesting ? 'Return to level editor' : 'Return to menu');

    const pauseMenuButton = document.getElementById('pause-menu-btn');
    if (pauseMenuButton) pauseMenuButton.textContent = isTesting ? 'Return to Level Editor' : 'Return to Play Plaza';

    const resultMenuButton = document.getElementById('menu-btn');
    if (resultMenuButton) resultMenuButton.textContent = isTesting ? 'Level Editor' : 'Play Plaza';
}

function syncSelectedProfileToGame() {
    const profile = getSelectedLocalProfile(localProfilesState);
    if (!profile) return;
    const state = useGameStore.getState();
    state.setPlayerNames(profile.displayName, state.p2Name);
    state.setPlayerHats(profile.cosmetics.hat, state.p2Hat);
    state.setPlayerColors(profile.cosmetics.ballColor, state.p2Color);
    const onlineNameInput = document.getElementById('online-name-input');
    if (onlineNameInput && !onlineNameInput.value.trim()) onlineNameInput.value = profile.displayName;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatDuration(milliseconds) {
    if (!Number.isFinite(milliseconds)) return '—';
    const totalSeconds = Math.round(milliseconds / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function appendScoreboardRow(body, entry, index) {
    const row = document.createElement('tr');
    const values = [
        String(index + 1),
        entry.displayName,
        String(entry.matches),
        String(entry.wins),
        String(entry.losses),
        formatPercent(entry.winRate),
        String(entry.bestStreak),
    ];
    values.forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
    });
    body.appendChild(row);
}

function renderProfileHub() {
    const profile = getSelectedLocalProfile(localProfilesState);
    if (!profile) return;

    const menuName = document.getElementById('menu-profile-name');
    if (menuName) menuName.textContent = profile.displayName;

    const select = document.getElementById('local-profile-select');
    if (select) {
        const options = localProfilesState.profiles.map(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.displayName;
            option.selected = item.id === profile.id;
            return option;
        });
        select.replaceChildren(...options);
    }

    const nameInput = document.getElementById('local-profile-name');
    if (nameInput) nameInput.value = profile.displayName;

    const accountLabel = document.getElementById('profile-account-label');
    if (accountLabel) {
        accountLabel.textContent = profile.account.status === 'linked'
            ? `Linked via ${profile.account.provider}`
            : 'Guest pilot';
    }

    const statGrid = document.getElementById('profile-stat-grid');
    if (statGrid) {
        const stats = [
            ['Matches', profile.stats.matches],
            ['Wins', profile.stats.wins],
            ['Best streak', profile.stats.bestStreak],
            ['Fastest win', formatDuration(profile.stats.fastestWinMs)],
        ];
        statGrid.replaceChildren(...stats.map(([label, value]) => {
            const card = document.createElement('div');
            card.className = 'profile-stat';
            const labelElement = document.createElement('span');
            labelElement.textContent = String(label);
            const valueElement = document.createElement('strong');
            valueElement.textContent = String(value);
            card.append(labelElement, valueElement);
            return card;
        }));
    }

    const localBody = document.getElementById('local-scoreboard-body');
    if (localBody) {
        localBody.replaceChildren();
        getLocalLeaderboard(localProfilesState)
            .forEach((entry, index) => appendScoreboardRow(localBody, entry, index));
    }

    const product = getProductModel(import.meta.env.VITE_DROPFALL_PLATFORM || 'web');
    const productLabel = document.getElementById('access-product-label');
    const productCopy = document.getElementById('access-product-copy');
    const removeAdsButton = document.getElementById('remove-ads-btn');
    const restoreButton = document.getElementById('restore-purchases-btn');
    if (productLabel) {
        productLabel.textContent = product.adFreeIncluded
            ? 'Premium ad-free edition'
            : 'Ad-supported edition';
    }
    if (productCopy && product.adFreeIncluded) {
        productCopy.textContent = 'This platform edition includes the permanent ad-free entitlement.';
    }
    if (removeAdsButton) removeAdsButton.hidden = product.adFreeIncluded;
    if (restoreButton) restoreButton.hidden = product.platform === 'web' || product.platform === 'steam';
}

function beginLocalMatchTracking() {
    const state = useGameStore.getState();
    if (state.gameMode === 'ONLINE') return;
    const profile = getSelectedLocalProfile(localProfilesState);
    if (!profile) return;
    localProfilesState = updateLocalProfile(localProfilesState, profile.id, {
        displayName: state.p1Name,
        ballColor: state.p1Color,
        hat: state.p1Hat,
    });
    saveLocalProfiles(localProfilesState);
    trackedLocalMatch = {
        matchId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        startedAt: Date.now(),
        profileId: profile.id,
    };
    renderProfileHub();
}

function recordTrackedLocalMatch(state) {
    if (!trackedLocalMatch || state.gameMode === 'ONLINE') return;
    const won = state.winner === 'Player 1';
    localProfilesState = recordLocalMatch(localProfilesState, {
        ...trackedLocalMatch,
        occurredAt: new Date().toISOString(),
        durationMs: Date.now() - trackedLocalMatch.startedAt,
        mode: state.gameMode,
        opponentName: state.p2Name,
        won,
        scoreFor: state.p1Score,
        scoreAgainst: state.p2Score,
    });
    saveLocalProfiles(localProfilesState);
    trackedLocalMatch = null;
    renderProfileHub();
}

function openLevelEditor() {
    const mount = document.getElementById('level-editor-mount');
    if (!mount) return;
    const profile = getSelectedLocalProfile(localProfilesState);
    const editor = createLevelEditor({
        authorName: profile?.displayName || useGameStore.getState().p1Name,
        onClose: () => {
            editorTestInProgress = false;
            updateEditorTestNavigation(false);
            showScreen('menu');
        },
        onTest: draft => {
            const state = useGameStore.getState();
            editorTestInProgress = true;
            updateEditorTestNavigation(true);
            state.setGameMode('1P');
            state.setSelectedLevel(draft.id || 'local-draft', draft);
            selectedLevelData = draft;
            startGame(true);
        },
    });
    mount.replaceChildren(editor);
    showScreen('levelEditor');
    editor.focus({ preventScroll: true });
}

async function loadOnlineScoreboard() {
    const status = document.getElementById('online-scoreboard-status');
    const body = document.getElementById('online-scoreboard-body');
    if (!status || !body) return;
    status.textContent = 'Loading server-verified results…';
    body.replaceChildren();

    const connectedServer = useGameStore.getState().online.serverUrl;
    let endpoint = '/api/leaderboards/online';
    if (connectedServer) {
        try {
            const url = new URL(OnlineManager.normalizeServerUrl(connectedServer));
            url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
            url.pathname = '/api/leaderboards/online';
            url.search = '';
            endpoint = url.toString();
        } catch {
            // The same-origin endpoint remains the safest fallback.
        }
    }

    try {
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const payload = await response.json();
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        entries.forEach((entry, index) => appendScoreboardRow(body, entry, index));
        if (entries.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.className = 'scoreboard-empty';
            cell.colSpan = 7;
            cell.textContent = 'No completed online matches yet.';
            row.appendChild(cell);
            body.appendChild(row);
        }
        status.textContent = 'Outcomes are recorded by the authoritative room server. This preseason board is unranked.';
    } catch (error) {
        status.textContent = `Online board unavailable: ${error.message}`;
    }
}

function showScreen(screenName) {
    if (screenName !== 'hatGallery' && activeHatGallery) {
        activeHatGallery.destroy();
        activeHatGallery = null;
        document.getElementById('hat-gallery-mount')?.replaceChildren();
    }
    Object.values(screens).forEach(s => s?.classList.add('hidden'));
    const screen = screens[screenName];
    if (screen) screen.classList.remove('hidden');
}

function openHatGallery() {
    const mount = document.getElementById('hat-gallery-mount');
    if (!mount) return;

    activeHatGallery?.destroy();
    mount.replaceChildren();
    const state = useGameStore.getState();
    activeHatGallery = createHatGallery({
        initialColor: state.p1Color,
        onColorChange: color => {
            const current = useGameStore.getState();
            current.setPlayerColors(color, current.p2Color);
        },
        onClose: () => showScreen('menu'),
    });
    mount.appendChild(activeHatGallery.element);
    showScreen('hatGallery');
}

function hideAllScreens() {
    Object.values(screens).forEach(s => s?.classList.add('hidden'));
}

function setGamePaused(paused, { focusResume = true } = {}) {
    const state = useGameStore.getState();
    const canPause = state.gameMode !== 'ONLINE' && (state.gameState === 'COUNTDOWN' || state.gameState === 'PLAYING');
    const nextPaused = Boolean(paused && canPause);
    const pauseMenu = document.getElementById('pause-menu');

    isGamePaused = nextPaused;
    pauseMenu?.classList.toggle('hidden', !nextPaused);
    document.body.classList.toggle('game-paused', nextPaused);
    resetInputState();

    if (nextPaused && focusResume) {
        requestAnimationFrame(() => document.getElementById('pause-resume-btn')?.focus());
    }
}

function toggleGamePause() {
    setGamePaused(!isGamePaused);
}

// ============================================
// POWER-UPS GUIDE
// ============================================
function populatePowerupsGuide() {
    const grid = document.getElementById('powerups-grid');
    if (!grid) return;
    
    grid.replaceChildren();
    
    const weights = useGameStore.getState().settings.powerUpWeights;
    
    POWER_UP_EFFECTS.forEach(powerup => {
        const card = document.createElement('div');
        card.className = 'powerup-card';
        card.style.borderColor = `#${powerup.color.toString(16).padStart(6, '0')}`;
        card.style.color = `#${powerup.color.toString(16).padStart(6, '0')}`;
        
        const currentWeight = weights[powerup.type] ?? 50;

        const icon = document.createElement('img');
        icon.className = 'powerup-card-icon';
        icon.src = powerup.iconPath;
        icon.alt = '';

        const title = document.createElement('h3');
        title.className = 'powerup-card-name';
        title.textContent = powerup.name;

        const description = document.createElement('p');
        description.className = 'powerup-card-description';
        description.textContent = powerup.description;

        const controls = document.createElement('div');
        controls.className = 'powerup-weight-control';

        const label = document.createElement('label');
        label.className = 'powerup-weight-label';
        label.textContent = 'Spawn Weight';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.step = '1';
        slider.value = String(currentWeight);
        slider.dataset.puType = powerup.type;
        slider.setAttribute('aria-label', `${powerup.name} spawn weight`);

        const valSpan = document.createElement('span');
        valSpan.className = 'pu-weight-val';
        valSpan.dataset.puType = powerup.type;
        valSpan.textContent = String(currentWeight);

        controls.append(label, slider, valSpan);
        card.append(icon, title, description, controls);
        
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            valSpan.textContent = String(val);
            const newWeights = { ...useGameStore.getState().settings.powerUpWeights };
            newWeights[powerup.type] = val;
            useGameStore.getState().updateSetting('powerUpWeights', newWeights);
        });
        
        grid.appendChild(card);
    });
}

// ============================================
// GAME STATE
// ============================================
let player1, player2, arena, particles, lightning, shockwaves, aiController;
let inputHandler; // InputHandler instance for unified input processing
let physicsSystem; // PhysicsSystem instance for event-based physics
let selectedLevelData = useGameStore.getState().selectedLevelData || null; // Custom level selected in preview panel
let preOverrideSettings = null;
const clock = new THREE.Clock();
let collisionCooldown = 0;
let sceneFlashLight;
const gameFeel = new GameFeelSystem();
let winTimer = 0;
let pendingWinner = null;
let countdownTimer = 3.0;
let nameEntryMode = 'newgame';
let vrCameraRig = null;
let vrUI = null;
let replayModalShown = false;
let replayCountdownInterval = null;
let replayCountdownValue = 10;
let replayCountdownPaused = false;
let roundOverFrozen = false;
let roundOverTimeoutSet = false;
let roundOverLogFrames = 0;
let onlineSetupPanelTeardown = null;
let opponentDisconnectOverlayEl = null;
let isGamePaused = false;
let lastOnlineReconciliationAt = 0;

const HEX_GRID_SPACING = 8.0;
const TILE_HEIGHT = 4.0;
const SPAWN_DROP_OFFSET = 2.0;

const LEVEL_OVERRIDE_SETTING_KEYS = [
    'sphereSize',
    'sphereWeight',
    'sphereAccel',
    'collisionBounce',
    'arenaSize',
    'destructionRate',
    'iceRate',
    'bonusRate',
    'bonusDuration',
    'boostRegenSpeed',
    'boostDrainRate',
    'bloomLevel',
    'playerAuraSize',
    'playerAuraOpacity',
    'playerGlowIntensity',
    'playerGlowRange',
    'theme',
];

function applyLevelSettingsOverrides(levelData) {
    if (!levelData || typeof levelData !== 'object') {
        return false;
    }

    const state = useGameStore.getState();
    const overrides = [];

    LEVEL_OVERRIDE_SETTING_KEYS.forEach((key) => {
        if (levelData[key] !== undefined) {
            overrides.push([key, levelData[key]]);
        }
    });

    if (overrides.length === 0) {
        return false;
    }

    if (!preOverrideSettings) {
        preOverrideSettings = {};
        LEVEL_OVERRIDE_SETTING_KEYS.forEach((key) => {
            preOverrideSettings[key] = state.settings[key];
        });
    }

    overrides.forEach(([key, value]) => {
        useGameStore.getState().updateSetting(key, value);
    });

    return true;
}

function restorePreOverrideSettings() {
    if (!preOverrideSettings) {
        return;
    }

    Object.entries(preOverrideSettings).forEach(([key, value]) => {
        useGameStore.getState().updateSetting(key, value);
    });

    preOverrideSettings = null;
}

function getSpawnableTiles(currentArena) {
    if (!currentArena?.tiles?.length) return [];
    return currentArena.tiles.filter(tile => tile && tile.mesh && tile.state !== 'FALLING' && tile.state !== 'WARNING');
}

function getHexDistanceBetweenTiles(a, b) {
    const aS = -a.q - a.r;
    const bS = -b.q - b.r;
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(aS - bS));
}

function pickSafeSpawnTiles(currentArena, preferSideSplit = true) {
    const spawnableTiles = getSpawnableTiles(currentArena);
    if (spawnableTiles.length < 2) return [];

    const tileMap = new Map(spawnableTiles.map(tile => [`${tile.q},${tile.r}`, tile]));
    const directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    const neighborCounts = new Map();
    for (const tile of spawnableTiles) {
        neighborCounts.set(tile, directions.filter(([dq, dr]) => tileMap.get(`${tile.q + dq},${tile.r + dr}`)?.state === 'NORMAL').length);
    }
    const wellSupportedCandidates = spawnableTiles.filter(tile => tile.state === 'NORMAL' && neighborCounts.get(tile) >= 4);
    const stableCandidates = spawnableTiles.filter(tile => {
        if (tile.state !== 'NORMAL') return false;
        return neighborCounts.get(tile) >= 2;
    });
    const candidates = wellSupportedCandidates.length >= 2
        ? wellSupportedCandidates
        : stableCandidates.length >= 2 ? stableCandidates : spawnableTiles;
    let bestPair = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
            const first = candidates[i];
            const second = candidates[j];
            const distance = getHexDistanceBetweenTiles(first, second);
            const firstX = getTileWorldX(first);
            const secondX = getTileWorldX(second);
            const sideSplitBonus = preferSideSplit && firstX * secondX < 0 ? 100 : 0;
            const supportBonus = (neighborCounts.get(first) + neighborCounts.get(second)) * 5;
            const edgePenalty = (first.distanceToCenter + second.distanceToCenter) * 2;
            const score = distance * 20 + supportBonus + sideSplitBonus - edgePenalty;
            if (score > bestScore) {
                bestScore = score;
                bestPair = [first, second];
            }
        }
    }

    return bestPair || [];
}

function spawnPositionFromTile(tile, sphereRadius) {
    const { x, z } = hexToPixel(tile.q, tile.r, HEX_GRID_SPACING);
    const tileTopY = tile.mesh.position.y + TILE_HEIGHT / 2;
    return { x, y: tileTopY + sphereRadius + SPAWN_DROP_OFFSET, z };
}

function getTileWorldX(tile) {
    return hexToPixel(tile.q, tile.r, HEX_GRID_SPACING).x;
}

function getPlayerSpawnPositions(currentArena, sphereRadius, options = {}) {
    const { preferSideSplit = true } = options;
    const fallbackSpawns = [
        { x: -15, y: 4, z: 0 },
        { x: 15, y: 4, z: 0 }
    ];

    const tiles = pickSafeSpawnTiles(currentArena, preferSideSplit);
    if (tiles.length < 2) {
        console.warn('[Spawn] No safe separated spawn pair, using fallback spawns.');
        return fallbackSpawns;
    }
    const orderedTiles = [...tiles].sort((a, b) => getTileWorldX(a) - getTileWorldX(b));
    return orderedTiles.map(tile => spawnPositionFromTile(tile, sphereRadius));
}

function cleanupOnlineSetupPanel() {
    if (typeof onlineSetupPanelTeardown === 'function') {
        onlineSetupPanelTeardown();
        onlineSetupPanelTeardown = null;
    }
}

function mountOnlineSetupPanel() {
    const container = screens.onlineSetup;
    if (!container) return;

    cleanupOnlineSetupPanel();
    const state = useGameStore.getState();
    const panel = createOnlineSetupPanel(container, online, Boolean(state.online?.isHost));
    onlineSetupPanelTeardown = panel?.cleanup || null;
}

function ensureOpponentDisconnectOverlay() {
    if (opponentDisconnectOverlayEl) return opponentDisconnectOverlayEl;

    const overlay = document.createElement('div');
    overlay.id = 'opponent-disconnected-overlay';
    overlay.className = 'hidden';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 250;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.45);
        color: #ffef99;
        font-family: 'Courier New', monospace;
        font-size: clamp(1rem, 2.2vw, 1.8rem);
        text-shadow: 0 0 12px rgba(255, 239, 153, 0.8);
        letter-spacing: 1px;
        text-transform: uppercase;
    `;
    overlay.textContent = 'Opponent disconnected. Waiting for reconnect...';
    document.body.appendChild(overlay);
    opponentDisconnectOverlayEl = overlay;
    return overlay;
}

function setOpponentDisconnectOverlayVisible(visible) {
    const overlay = ensureOpponentDisconnectOverlay();
    overlay.classList.toggle('hidden', !visible);
}

let onlineLoadingOverlayEl = null;

function ensureOnlineLoadingOverlay() {
    if (onlineLoadingOverlayEl) return onlineLoadingOverlayEl;
    const overlay = document.createElement('div');
    overlay.id = 'online-loading-overlay';
    overlay.className = 'hidden';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 400;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.9);
        color: #0ff;
        font-family: 'Courier New', monospace;
        gap: 1.2rem;
        pointer-events: none;
    `;
    const title = document.createElement('div');
    title.textContent = 'LOADING ARENA';
    title.style.cssText = 'font-size: clamp(1.5rem, 4vw, 3rem); letter-spacing: 4px; text-shadow: 0 0 20px rgba(0,255,255,0.8);';
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 48px; height: 48px;
        border: 4px solid rgba(0,255,255,0.2);
        border-top-color: #0ff;
        border-radius: 50%;
        animation: dropfall-spin 0.8s linear infinite;
    `;
    overlay.append(title, spinner);

    const style = document.createElement('style');
    style.textContent = '@keyframes dropfall-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    document.body.appendChild(overlay);
    onlineLoadingOverlayEl = overlay;
    return overlay;
}

function showOnlineLoadingOverlay() {
    const overlay = ensureOnlineLoadingOverlay();
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
}

function hideOnlineLoadingOverlay() {
    const overlay = ensureOnlineLoadingOverlay();
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
}

function updateLobbyConnectionStatus(status) {
    const statusEl = document.getElementById('online-connected-status');
    if (!statusEl) return;

    if (status === 'connected') {
        statusEl.textContent = '● CONNECTED';
        statusEl.className = 'online-status-connected';
    } else if (status === 'reconnecting') {
        statusEl.textContent = '● RECONNECTING...';
        statusEl.className = 'online-status-disconnected';
    } else if (status === 'disconnected') {
        statusEl.textContent = '● DISCONNECTED';
        statusEl.className = 'online-status-disconnected';
    }
}

function showOnlineToast(message) {
    let toast = document.getElementById('online-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'online-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 300;
            background: rgba(0, 0, 0, 0.85);
            color: #0ff;
            border: 1px solid #0ff;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

function getDefaultOnlineServerUrl() {
    const onlineCtor = online?.constructor;
    if (onlineCtor && typeof onlineCtor.getDefaultServerUrl === 'function') {
        return onlineCtor.getDefaultServerUrl();
    }

    return window.location.origin
        .replace(/^https:\/\//i, 'wss://')
        .replace(/^http:\/\//i, 'ws://');
}

function isAutoServerUrlConfigured() {
    // If a server URL is baked in at build time, or the page is served from a
    // non-localhost origin, we can connect automatically without showing the
    // manual server address UI.
    const hasBuildTimeUrl = typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_WS_URL;
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
    return hasBuildTimeUrl || !isLocalhost;
}

function configureOnlineConnectUI() {
    const serverGroup = document.getElementById('online-server-input')?.closest('.online-input-group');
    const serverHelp = document.querySelector('.online-help');
    const serverAddressDisplay = document.querySelector('.online-server-address');

    if (isAutoServerUrlConfigured()) {
        serverGroup?.classList.add('hidden');
        serverHelp?.classList.add('hidden');
        serverAddressDisplay?.classList.add('hidden');
    } else {
        serverGroup?.classList.remove('hidden');
        serverHelp?.classList.remove('hidden');
        serverAddressDisplay?.classList.remove('hidden');
    }
}

function getOnlineClientRemotePlayer(state) {
    if (state.gameMode !== 'ONLINE' || state.online.isHost) return null;
    const mySlot = state.online?.playerSlot;
    return mySlot === 2 ? player1 : player2;
}

function getLocalPlayer(state) {
    if (state.gameMode !== 'ONLINE') return null;
    const mySlot = state.online?.playerSlot;
    if (mySlot === 1) return player1;
    if (mySlot === 2) return player2;
    return null;
}

function getRemotePlayer(state) {
    if (state.gameMode !== 'ONLINE') return null;
    const mySlot = state.online?.playerSlot;
    if (mySlot === 1) return player2;
    if (mySlot === 2) return player1;
    return null;
}

function reconcileLocalPlayer(player, serverPos, serverVel, delta) {
    if (!player?.rigidBody) return;
    const current = player.rigidBody.translation();
    const currentVel = player.rigidBody.linvel();

    const errorX = serverPos.x - current.x;
    const errorY = serverPos.y - current.y;
    const errorZ = serverPos.z - current.z;
    const errorDist = Math.sqrt(errorX * errorX + errorY * errorY + errorZ * errorZ);
    const velocityError = Math.hypot(
        serverVel.x - currentVel.x,
        serverVel.y - currentVel.y,
        serverVel.z - currentVel.z,
    );

    // Large error: snap to server position (e.g., after respawn or reconnect).
    if (errorDist > 12.0) {
        player.rigidBody.setTranslation(serverPos, true);
        player.rigidBody.setLinvel(serverVel, true);
        return;
    }

    // Authoritative collisions can reverse velocity between snapshots. Apply
    // that change immediately without teleporting position.
    if (velocityError > 18) {
        player.rigidBody.setLinvel(serverVel, true);
        return;
    }

    // Small prediction errors are visually harmless. Correct them through
    // velocity over several snapshots instead of moving the rendered ball.
    const correctionSpeed = errorDist < 0.08 ? 0 : 2.25;
    const maxCorrectionSpeed = 5;
    const correctionScale = errorDist > 0
        ? Math.min(correctionSpeed, maxCorrectionSpeed / errorDist)
        : 0;
    const targetVel = {
        x: serverVel.x + errorX * correctionScale,
        y: serverVel.y + errorY * correctionScale,
        z: serverVel.z + errorZ * correctionScale,
    };

    const blend = 1 - Math.exp(-Math.max(0, delta) * 7);
    const nextVel = {
        x: currentVel.x + (targetVel.x - currentVel.x) * blend,
        y: currentVel.y + (targetVel.y - currentVel.y) * blend,
        z: currentVel.z + (targetVel.z - currentVel.z) * blend,
    };

    player.rigidBody.setLinvel(nextVel, true);
}

function applyOnlineClientRemoteInterpolation(state) {
    const remotePlayer = getRemotePlayer(state);
    if (!remotePlayer?.rigidBody) return;
    const sample = online.sampleServerState();
    const sampledState = sample?.state;
    if (!sampledState) return;
    const remotePosition = state.online?.playerSlot === 1
        ? sampledState.p2Pos
        : sampledState.p1Pos;
    if (!remotePosition) return;
    remotePlayer.rigidBody.setNextKinematicTranslation(remotePosition);
}

function enterOnlineSetupState({ resetSetup = true } = {}) {
    const state = useGameStore.getState();
    if (state.gameMode !== 'ONLINE') return;

    if (resetSetup) {
        state.resetOnlineSetupState?.();
    }

    useGameStore.setState({ gameState: 'ONLINE_SETUP' });
}

function maybeAutoConnectOnline() {
    const serverInput = document.getElementById('online-server-input');
    const statusEl = document.getElementById('online-connect-status');
    const errorEl = document.getElementById('online-connect-error');
    const nameInput = document.getElementById('online-name-input');
    const defaultServerUrl = getDefaultOnlineServerUrl();

    if (serverInput && !serverInput.value.trim()) {
        serverInput.value = defaultServerUrl;
    }

    if (nameInput && !nameInput.value.trim()) {
        nameInput.value = (localStorage.getItem('dropfall_p1name') || 'Player').slice(0, 20);
    }

    const sameOriginServer = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const params = new URLSearchParams(window.location.search);
    const autoConnectRequested = params.get('autoconnect') === '1' || params.get('online') === '1';
    const shouldAutoConnect = sameOriginServer || autoConnectRequested;

    if (!shouldAutoConnect) return;

    const state = useGameStore.getState();
    if (state.online?.connected) return;
    if (online.ws && (online.ws.readyState === WebSocket.OPEN || online.ws.readyState === WebSocket.CONNECTING)) return;

    if (statusEl) statusEl.textContent = 'Auto-connecting to server...';
    if (errorEl) errorEl.textContent = '';
    online.connect(defaultServerUrl);
}

async function setupLanDetection() {
    const lanSuggestion = document.getElementById('online-lan-suggestion');
    const lanInfo = document.getElementById('online-lan-info');
    const networkModeEl = document.getElementById('online-network-mode');
    const serverInput = document.getElementById('online-server-input');
    if (!lanSuggestion || !lanInfo || !serverInput) return;

    const updateNetworkBadge = (url) => {
        if (!networkModeEl) return;
        const mode = OnlineManager.detectNetworkMode(url);
        if (mode === 'lan') {
            networkModeEl.textContent = '● LAN MODE';
            networkModeEl.style.color = '#00ff88';
        } else if (mode === 'internet') {
            networkModeEl.textContent = '● INTERNET MODE';
            networkModeEl.style.color = '#9deaff';
        } else {
            networkModeEl.textContent = '';
        }
    };

    const currentUrl = serverInput.value.trim() || OnlineManager.getDefaultServerUrl();
    updateNetworkBadge(currentUrl);

    serverInput.addEventListener('input', () => {
        updateNetworkBadge(serverInput.value.trim());
    });

    const info = await OnlineManager.fetchNetworkInfo(currentUrl);
    if (!info || !Array.isArray(info.lanAddresses) || info.lanAddresses.length === 0) {
        lanSuggestion.style.display = 'none';
        return;
    }

    const currentHostname = (() => {
        try { return new URL(OnlineManager.normalizeServerUrl(currentUrl)).hostname; } catch { return ''; }
    })();

    const isAlreadyLan = OnlineManager.isPrivateIp(currentHostname);
    if (isAlreadyLan) {
        lanSuggestion.style.display = 'none';
        return;
    }

    const suggested = info.lanAddresses[0];
    const wsUrl = `ws://${suggested.address}:${info.port}`;
    lanInfo.innerHTML = `
        <p style="margin: 0.3rem 0;">A server is running on your local network:</p>
        <p style="margin: 0.3rem 0;"><code style="color: #00ff88; font-size: 1rem;">${suggested.address}:${info.port}</code></p>
        <button id="online-lan-connect-btn" class="retro-btn" style="margin-top: 0.5rem; padding: 0.4rem 1rem; font-size: 0.9rem;">CONNECT VIA LAN</button>
    `;
    lanSuggestion.style.display = 'block';

    const lanBtn = document.getElementById('online-lan-connect-btn');
    if (lanBtn) {
        lanBtn.addEventListener('click', () => {
            serverInput.value = wsUrl;
            updateNetworkBadge(wsUrl);
            document.getElementById('online-connect-btn')?.click();
        });
    }
}

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
function showPowerUpNotification(playerName, powerUp) {
    if (isInVR()) return;

    const container = document.getElementById('powerup-notifications');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `powerup-notification ${powerUp.id}`;
    notification.setAttribute('role', 'status');

    const icon = document.createElement('img');
    icon.className = 'powerup-notification-icon';
    icon.src = powerUp.iconPath;
    icon.alt = '';

    const message = document.createElement('span');
    message.textContent = `${playerName} got ${powerUp.name}`;
    notification.append(icon, message);
    
    const hexColor = '#' + powerUp.color.toString(16).padStart(6, '0');
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

const renderedPowerUpSignatures = new Map();

function renderPowerUpStatus(containerId, activePowerUps = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const signature = activePowerUps.map(powerUp => powerUp.type).join('|');
    if (renderedPowerUpSignatures.get(containerId) === signature) return;
    renderedPowerUpSignatures.set(containerId, signature);

    const icons = activePowerUps.map(active => {
        const powerUp = active.effect || POWER_UP_EFFECTS.find(effect => effect.type === active.type);
        if (!powerUp) return null;
        const hexColor = `#${powerUp.color.toString(16).padStart(6, '0')}`;
        const badge = document.createElement('span');
        badge.className = 'powerup-icon';
        badge.style.color = hexColor;
        badge.style.borderColor = hexColor;
        badge.title = powerUp.name;

        const icon = document.createElement('img');
        icon.src = powerUp.iconPath;
        icon.alt = powerUp.name;
        badge.appendChild(icon);
        return badge;
    }).filter(Boolean);

    container.replaceChildren(...icons);
}

// ============================================
// GAME FUNCTIONS
// ============================================

function startGame(skipNameEntry = false) {
    setGamePaused(false, { focusResume: false });
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
    if (state.gameMode !== 'ONLINE') {
        applyLevelSettingsOverrides(state.selectedLevelData || null);
    }
    setMusicSpeed(0.6 + (state.p1Score + state.p2Score) * 0.1);
    beginLocalMatchTracking();
    useGameStore.getState().startGame();
    resetEntities();
    updateHUDNames();
}

async function proceedFromNameEntry() {
    console.log('[Proceed] Starting name entry flow');
    const state = useGameStore.getState();
    const isOnePlayer = state.gameMode === '1P';
    
    const p1Name = (state.p1Name || 'Player 1').substring(0, 12);
    let p2Name;
    
    if (isOnePlayer) {
        const diffLabel = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
        p2Name = `NPC ${diffLabel}`;
    } else {
        p2Name = (state.p2Name || 'Player 2').substring(0, 12);
    }
    
    // Names are already in the store from CharacterPreviewPanel's oninput handler,
    // but ensure they're persisted to localStorage before the game starts.
    useGameStore.getState().setPlayerNames(p1Name, p2Name);

    // Persist level selection from the preview panel so restarts reuse the same arena.
    let levelId = getSelectedPreviewLevelId();
    let levelData = null;

    if (levelId) {
        try {
            levelData = await getLevelById(levelId);
            if (!levelData) {
                levelId = null;
            }
        } catch (error) {
            console.error('[Proceed] Failed to load selected level, falling back to default arena:', error);
            levelId = null;
            levelData = null;
        }
    }

    useGameStore.getState().setSelectedLevel(levelId, levelData);
    selectedLevelData = levelData;
    applyLevelSettingsOverrides(levelData);

    setMusicSpeed(0.6 + (state.p1Score + state.p2Score) * 0.1);
    
    // Start the game
    beginLocalMatchTracking();
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
    selectedLevelData = state.selectedLevelData || null;

    const userHasP1ColorPref = localStorage.getItem('dropfall_p1color') !== null;
    const userHasP2ColorPref = localStorage.getItem('dropfall_p2color') !== null;
    const userHasP1HatPref = localStorage.getItem('dropfall_p1hat') !== null;
    const userHasP2HatPref = localStorage.getItem('dropfall_p2hat') !== null;

    const effectiveP1Color = userHasP1ColorPref
        ? state.p1Color
        : (selectedLevelData?.defaultP1Color ?? state.p1Color);
    const effectiveP2Color = userHasP2ColorPref
        ? state.p2Color
        : (selectedLevelData?.defaultP2Color ?? state.p2Color);
    const effectiveP1Hat = userHasP1HatPref
        ? (state.p1Hat || 'none')
        : (selectedLevelData?.defaultP1Hat ?? state.p1Hat ?? 'none');
    const effectiveP2Hat = userHasP2HatPref
        ? (state.p2Hat || 'none')
        : (selectedLevelData?.defaultP2Hat ?? state.p2Hat ?? 'none');

    useGameStore.setState({
        p1Hat: effectiveP1Hat,
        p2Hat: effectiveP2Hat,
    });
    
    // AI Controller for 1P mode
    aiController = isOnePlayer ? new AIController(state.difficulty || 'normal') : null;

    // Effects / arena first so spawn positions can be derived from valid tiles.
    arena = new Arena(selectedLevelData?.tiles);
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    const sphereRadius = state.settings?.sphereSize ?? 2;
    const [p1Spawn, p2Spawn] = getPlayerSpawnPositions(arena, sphereRadius, { preferSideSplit: true });

    // Players - use unified input handler and store colors
    player1 = new Player('player1', effectiveP1Color || 0xff4444, p1Spawn, getPlayer1InputUnified);
    player2 = new Player('player2', effectiveP2Color || 0x4444ff, p2Spawn,
        isOnePlayer ? () => aiController.getInput() : getPlayer2InputUnified);

    // Camera
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    pendingWinner = null;
    winTimer = 0;
    countdownTimer = 3.0;

    if (isInVR()) {
        reparentToVRContainer(scene);
    }
}

function resetOnlineEntities() {
    player1?.cleanup();
    player2?.cleanup();
    arena?.cleanup();
    particles?.cleanup();
    lightning?.cleanup();
    shockwaves?.cleanup();

    const state = useGameStore.getState();
    // Online customization previews communicate exact player identity colors.
    // Stage-specific sphere skins are an offline opt-in and must not replace
    // those colors after the match starts.
    useGameStore.setState({ p1UseStageSkin: false, p2UseStageSkin: false });
    lastOnlineReconciliationAt = 0;
    const mySlot = state.online?.playerSlot;

    // Read customization from the latest store snapshot right before creating entities.
    const customizationState = useGameStore.getState();
    const rawP1Color = customizationState.p1Color;
    const rawP2Color = customizationState.p2Color;
    const p1Color = rawP1Color ?? 0xff4444;
    const p2Color = rawP2Color ?? 0x4444ff;
    const p1Hat = customizationState.p1Hat || 'none';
    const p2Hat = customizationState.p2Hat || 'none';
    const p1Name = customizationState.p1Name || 'Player 1';
    const p2Name = customizationState.p2Name || 'Player 2';

    if (rawP1Color == null || rawP2Color == null) {
        console.warn('[resetOnlineEntities] Missing player color(s), using fallback defaults.', {
            rawP1Color,
            rawP2Color,
            fallbackP1Color: 0xff4444,
            fallbackP2Color: 0x4444ff,
            mySlot,
        });
    }

    console.log('[resetOnlineEntities] Using customization:', {
        p1Color,
        p2Color,
        p1Hat,
        p2Hat,
        p1Name,
        p2Name,
        mySlot,
    });

    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    const latestState = useGameStore.getState();
    const sphereRadius = latestState.settings?.sphereSize ?? 2;
    const [hostPos, clientPos] = getPlayerSpawnPositions(arena, sphereRadius);
    
    const defaultInput = { forward: false, backward: false, left: false, right: false, boost: false };
    
    // Player input mapping: local player uses their controls, opponent uses synced input
    if (mySlot === 1) {
        // I'm the host (player 1) on the left
        player1 = new Player('player1', p1Color, hostPos, getPlayer1InputUnified);
        player2 = new Player('player2', p2Color, clientPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    } else if (mySlot === 2) {
        // I'm the client (player 2) on the right, but local controls should still use P1 bindings (WASD).
        player1 = new Player('player1', p1Color, hostPos, () => useGameStore.getState().online.opponentInput || defaultInput);
        player2 = new Player('player2', p2Color, clientPos, getPlayer1InputUnified);
    } else {
        // Fallback: assume we're host if slot is unknown
        player1 = new Player('player1', p1Color, hostPos, getPlayer1InputUnified);
        player2 = new Player('player2', p2Color, clientPos, () => useGameStore.getState().online.opponentInput || defaultInput);
    }

    // Set remote player to kinematic - only interpolation should move it
    const remotePlayer = mySlot === 2 ? player1 : player2;
    if (remotePlayer?.rigidBody) {
        remotePlayer.isLocal = false;
        remotePlayer.rigidBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        // The server resolves ball-to-ball collisions. A sensor prevents the
        // local predicted ball from bouncing off an infinite-mass kinematic
        // proxy and then being corrected back a packet later.
        remotePlayer.collider?.setSensor(true);
    }

    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    if (isInVR()) {
        reparentToVRContainer(scene);
    }
}

function returnToMenu() {
    const returnToEditor = editorTestInProgress;
    setGamePaused(false, { focusResume: false });
    clearReplayCountdown();
    const replayModal = document.getElementById('replay-modal');
    if (replayModal) replayModal.remove();
    restorePreOverrideSettings();
    trackedLocalMatch = null;
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
    online.resetSimulationState();
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();
    
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    if (isInVR()) {
        reparentToVRContainer(scene);
    }

    if (returnToEditor) {
        editorTestInProgress = false;
        updateEditorTestNavigation(false);
        showScreen('levelEditor');
        document.querySelector('#level-editor-mount .creator-shell')?.focus({ preventScroll: true });
    }
}

function startOnlineGame(matchStart = true) {
    console.log('[startOnlineGame] Starting online game, matchStart:', matchStart);
    initAudio();
    playMusic();
    setMusicSpeed(0.6);
    if (matchStart) {
        useGameStore.getState().resetScores();
    }
    resetOnlineEntities();
    updateHUDNames();

    if (matchStart) {
        online.resetSimulationState();
        lastOnlineReconciliationAt = 0;
    }
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
    document.getElementById('profile-hub-btn')?.addEventListener('click', () => {
        renderProfileHub();
        showScreen('profileHub');
    });
    document.getElementById('profile-hub-close-btn')?.addEventListener('click', () => {
        showScreen('menu');
    });
    document.querySelectorAll('.profile-hub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const paneName = tab.dataset.profilePane;
            document.querySelectorAll('.profile-hub-tab').forEach(candidate => {
                candidate.classList.toggle('active', candidate === tab);
            });
            document.querySelectorAll('.profile-hub-pane').forEach(pane => {
                pane.classList.toggle('active', pane.dataset.profilePane === paneName);
            });
            if (paneName === 'online') loadOnlineScoreboard();
        });
    });
    document.getElementById('local-profile-select')?.addEventListener('change', event => {
        localProfilesState = selectLocalProfile(localProfilesState, event.target.value);
        saveLocalProfiles(localProfilesState);
        syncSelectedProfileToGame();
        renderProfileHub();
    });
    document.getElementById('local-profile-save-btn')?.addEventListener('click', () => {
        const profile = getSelectedLocalProfile(localProfilesState);
        const nameInput = document.getElementById('local-profile-name');
        if (!profile || !nameInput) return;
        const gameState = useGameStore.getState();
        localProfilesState = updateLocalProfile(localProfilesState, profile.id, {
            displayName: nameInput.value,
            ballColor: gameState.p1Color,
            hat: gameState.p1Hat,
        });
        saveLocalProfiles(localProfilesState);
        syncSelectedProfileToGame();
        renderProfileHub();
    });
    document.getElementById('local-profile-add-btn')?.addEventListener('click', () => {
        localProfilesState = addLocalProfile(localProfilesState, `Pilot ${localProfilesState.profiles.length + 1}`);
        saveLocalProfiles(localProfilesState);
        syncSelectedProfileToGame();
        renderProfileHub();
        const nameInput = document.getElementById('local-profile-name');
        nameInput?.focus();
        nameInput?.select();
    });
    document.getElementById('profile-signup-btn')?.addEventListener('click', () => {
        const status = document.getElementById('profile-signup-status');
        if (status) {
            status.textContent = 'Signup is safely gated until an email, Apple, Google, or Steam identity provider and deletion workflow are configured.';
        }
    });
    ['remove-ads-btn', 'restore-purchases-btn'].forEach(buttonId => {
        document.getElementById(buttonId)?.addEventListener('click', () => {
            const status = document.getElementById('purchase-status');
            if (status) {
                status.textContent = 'Purchases stay disabled until the platform store adapter and server receipt verification are configured.';
            }
        });
    });
    document.getElementById('online-scoreboard-refresh-btn')?.addEventListener('click', loadOnlineScoreboard);
    document.getElementById('create-level-btn')?.addEventListener('click', openLevelEditor);
    document.getElementById('hat-gallery-btn')?.addEventListener('click', openHatGallery);

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
        setupLanDetection();
        maybeAutoConnectOnline();
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
        showScreen('settings');
    });
    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
        showScreen('menu');
    });

    // Difficulty Selection
    ['easy', 'normal', 'hard'].forEach(diff => {
        const btn = document.getElementById(`difficulty-${diff}-btn`);
        const radio = document.getElementById(`difficulty-${diff}-radio`);
        if (btn && radio) {
            btn.addEventListener('click', () => {
                console.log('[Button] Difficulty', diff, 'clicked!');
                radio.checked = true;
                useGameStore.getState().setDifficulty(diff);
            });
        }
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
    // HUD
    document.getElementById('hud-restart-btn')?.addEventListener('click', () => {
        setGamePaused(false, { focusResume: false });
        useGameStore.getState().resetScores();
        startGame(true);
    });
    document.getElementById('hud-menu-btn')?.addEventListener('click', returnToMenu);
    document.getElementById('hud-pause-btn')?.addEventListener('click', toggleGamePause);
    document.getElementById('pause-resume-btn')?.addEventListener('click', () => setGamePaused(false, { focusResume: false }));
    document.getElementById('pause-restart-btn')?.addEventListener('click', () => {
        setGamePaused(false, { focusResume: false });
        useGameStore.getState().resetScores();
        startGame(true);
    });
    document.getElementById('pause-menu-btn')?.addEventListener('click', returnToMenu);

    document.addEventListener('keydown', (event) => {
        if (event.repeat || (event.code !== 'Escape' && event.code !== 'KeyP')) return;
        const state = useGameStore.getState();
        if (state.gameMode === 'ONLINE' || (state.gameState !== 'COUNTDOWN' && state.gameState !== 'PLAYING')) return;
        event.preventDefault();
        toggleGamePause();
    });

    document.addEventListener('visibilitychange', () => {
        const state = useGameStore.getState();
        if (document.hidden && state.gameMode !== 'ONLINE' && (state.gameState === 'COUNTDOWN' || state.gameState === 'PLAYING')) {
            setGamePaused(true, { focusResume: false });
        }
    });

    // Game Over
    document.getElementById('restart-btn')?.addEventListener('click', () => {
        const currentState = useGameStore.getState();

        if (currentState.gameState === 'GAME_OVER' && currentState.gameMode === 'ONLINE') {
            if (!currentState.online.rematchRequested) {
                online.sendRematchRequest();
                const restartBtn = document.getElementById('restart-btn');
                if (restartBtn) {
                    const isNextSettingsPicker = currentState.online?.currentGame?.settingsPickerId === currentState.online?.playerId;
                    restartBtn.textContent = isNextSettingsPicker ? 'Waiting for Opponent' : 'Waiting for Settings Picker';
                    restartBtn.disabled = true;
                    restartBtn.style.opacity = '0.6';
                }
            }
            return;
        }

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
        restorePreOverrideSettings();
        showScreen('menu');
    });
    document.getElementById('online-connect-btn')?.addEventListener('click', () => {
        const serverInput = document.getElementById('online-server-input');
        const serverUrl = (!serverInput || serverInput.closest('.online-input-group')?.classList.contains('hidden'))
            ? getDefaultOnlineServerUrl()
            : serverInput.value.trim() || getDefaultOnlineServerUrl();
        const playerName = document.getElementById('online-name-input')?.value.trim();

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
        restorePreOverrideSettings();
        showScreen('menu');
    });
    document.getElementById('online-refresh-btn')?.addEventListener('click', () => {
        online.listGames();
    });
    document.getElementById('online-create-game-btn')?.addEventListener('click', async () => {
        const current = useGameStore.getState();

        let levelData = current.selectedLevelData || null;
        if (!levelData) {
            const levelId = getSelectedPreviewLevelId();
            if (levelId) {
                try {
                    levelData = await getLevelById(levelId);
                    if (levelData) {
                        useGameStore.getState().setSelectedLevel(levelId, levelData);
                        selectedLevelData = levelData;
                    }
                } catch (error) {
                    console.warn('[Online] Failed to load selected level overrides before createGame:', error);
                }
            }
        }

        applyLevelSettingsOverrides(levelData);

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
            bonusRate: settings.bonusRate,
            bonusDuration: settings.bonusDuration,
            boostRegenSpeed: settings.boostRegenSpeed,
            boostDrainRate: settings.boostDrainRate,
        });
    });
    const startBtn = document.getElementById('online-start-btn');
    console.log('[Setup] Start button found:', !!startBtn, startBtn);
    startBtn?.addEventListener('click', () => {
        console.log('[Start Btn] Entering online setup flow');
        enterOnlineSetupState();
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
    const matchSettingsMap = Object.fromEntries(MATCH_SETTING_FIELDS.map(field => [field.id, field.key]));
    const settingsMap = {
        ...matchSettingsMap,
        'music-volume': 'musicVolume',
        'sfx-volume': 'sfxVolume', 'particle-amount': 'particleAmount', 'bloom-level': 'bloomLevel',
        'player-aura-size': 'playerAuraSize', 'player-aura-opacity': 'playerAuraOpacity',
        'player-glow-intensity': 'playerGlowIntensity', 'player-glow-range': 'playerGlowRange',
        'vr-scale': 'vrScale',
        'ar-height': 'arHeight'
    };

    // The global settings panel and online room both render from the same schema.
    for (const field of MATCH_SETTING_FIELDS) {
        const input = document.getElementById(field.id);
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (input) {
            input.min = String(field.min);
            input.max = String(field.max);
            input.step = String(field.step);
        }
        if (label) label.textContent = field.label;
    }
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.replaceChildren(...MATCH_THEMES.map(theme => {
            const option = document.createElement('option');
            option.value = theme.value;
            option.textContent = theme.label;
            return option;
        }));
    }

    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        if (el && valEl) {
            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                const field = MATCH_SETTING_FIELDS.find(item => item.id === id);
                valEl.textContent = field ? formatMatchSettingValue(field, val) : val;
                useGameStore.getState().updateSetting(key, val);

                // Update audio volume in real-time
                if (key === 'musicVolume') setMusicVolume(val);
                if (key === 'sfxVolume') setSfxVolume(val);
            });
        }
    }

    // Sync UI controls to the current store settings (used on init and after preset load)
    const syncSettingsUI = () => {
        const settings = useGameStore.getState().settings;
        for (const [id, key] of Object.entries(settingsMap)) {
            const el = document.getElementById(id);
            const valEl = document.getElementById(`${id}-val`);
            if (el) {
                const val = settings[key];
                if (typeof val === 'number') {
                    el.value = val;
                    if (valEl) {
                        const field = MATCH_SETTING_FIELDS.find(item => item.id === id);
                        valEl.textContent = field ? formatMatchSettingValue(field, val) : val;
                    }
                }
            }
        }
        setMusicVolume(settings.musicVolume);
        setSfxVolume(settings.sfxVolume);
    };

    // AR mode controls
    document.getElementById('ar-mode')?.addEventListener('change', (e) => {
        useGameStore.getState().updateSetting('arMode', e.target.value === 'true');
    });
    document.getElementById('ar-mode-type')?.addEventListener('change', (e) => {
        useGameStore.getState().updateSetting('arModeType', e.target.value);
    });
    document.getElementById('ar-height')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('ar-height-val').textContent = val.toFixed(2);
        useGameStore.getState().updateSetting('arHeight', val);
    });

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
        
        const defaults = Object.fromEntries(MATCH_PRESETS.map(preset => [preset.label, { ...preset.settings }]));
        
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
            syncSettingsUI();
        };

        const renderPresets = () => {
            const presets = getPresets();
            const names = Object.keys(presets);
            if (names.length === 0) {
                presetList.innerHTML = '<div style="color: #666; font-size: 0.85rem; padding: 0.5rem;">No presets saved yet</div>';
                return;
            }
            presetList.replaceChildren(...names.map(name => {
                const item = document.createElement('div');
                item.className = 'preset-item';
                const load = document.createElement('button');
                load.className = 'preset-load-btn';
                load.textContent = name;
                const remove = document.createElement('button');
                remove.className = 'preset-delete-btn';
                remove.dataset.name = name;
                remove.textContent = '×';
                item.append(load, remove);
                return item;
            }));
            
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

    // One-time migration from legacy standalone key to settings object
    const legacyAutoRestart = localStorage.getItem('dropfall_autorestart');
    if (legacyAutoRestart !== null) {
        useGameStore.getState().updateSetting('autoRestart', legacyAutoRestart === 'true');
        localStorage.removeItem('dropfall_autorestart');
    }

    const syncAutoRestartCheckboxes = (value) => {
        if (autoRestartMenu) autoRestartMenu.checked = value;
        if (autoRestartGameover) autoRestartGameover.checked = value;
    };

    autoRestartMenu?.addEventListener('change', (e) => {
        useGameStore.getState().updateSetting('autoRestart', e.target.checked);
        syncAutoRestartCheckboxes(e.target.checked);
    });

    autoRestartGameover?.addEventListener('change', (e) => {
        useGameStore.getState().updateSetting('autoRestart', e.target.checked);
        syncAutoRestartCheckboxes(e.target.checked);
    });

    // Sync checkboxes with store value on load
    syncAutoRestartCheckboxes(useGameStore.getState().settings.autoRestart);

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

    // Sync all settings UI to stored values on init
    syncSettingsUI();

    // Sync AR controls with stored values
    const syncARSettings = () => {
        const settings = useGameStore.getState().settings;
        const arModeEl = document.getElementById('ar-mode');
        const arModeTypeEl = document.getElementById('ar-mode-type');
        const arHeightEl = document.getElementById('ar-height');
        const arHeightVal = document.getElementById('ar-height-val');

        if (arModeEl) arModeEl.value = settings.arMode ? 'true' : 'false';
        if (arModeTypeEl) arModeTypeEl.value = settings.arModeType || 'roomscale';
        if (arHeightEl) arHeightEl.value = settings.arHeight ?? 0.75;
        if (arHeightVal) arHeightVal.textContent = (settings.arHeight ?? 0.75).toFixed(2);
    };
    syncARSettings();
}

// ============================================
// ONLINE EVENT HANDLERS
// ============================================
function setupOnlineHandlers() {
    let lastLobbyGamesSignature = null;

    online.on('connected', () => {
        online.setName(document.getElementById('online-name-input')?.value.trim() || 'Player');
        document.getElementById('online-connect-status').textContent = 'Connected';
        document.getElementById('online-connect-error').textContent = '';
        showScreen('onlineLobby');
        document.getElementById('online-server-url').textContent = online.ws?.url || '';
        updateLobbyConnectionStatus('connected');
        online.listGames();
    });

    online.on('reconnecting', () => {
        updateLobbyConnectionStatus('reconnecting');
        showOnlineToast('Connection lost. Reconnecting...');
    });

    online.on('reconnected', () => {
        updateLobbyConnectionStatus('connected');
        showOnlineToast('Reconnected to server');
    });

    online.on('gamesUpdated', (games) => {
        const list = document.getElementById('online-games-list');
        const roomCount = document.getElementById('online-room-count');
        if (!list) return;

        const visibleGames = Array.isArray(games) ? games : [];
        if (roomCount) {
            const openCount = visibleGames.filter((game) => game.playerCount < game.maxPlayers).length;
            roomCount.textContent = `${openCount} open · ${visibleGames.length} total`;
        }

        // The server publishes room availability periodically. Keep the existing
        // controls mounted when nothing changed so pointer and focus interactions
        // are not interrupted by a background refresh.
        const lobbyGamesSignature = JSON.stringify(visibleGames);
        if (lobbyGamesSignature === lastLobbyGamesSignature) return;
        lastLobbyGamesSignature = lobbyGamesSignature;

        list.replaceChildren();
        if (visibleGames.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'online-no-games';
            const icon = document.createElement('span');
            icon.textContent = '⌁';
            const heading = document.createElement('strong');
            heading.textContent = 'No open rooms';
            const copy = document.createElement('p');
            copy.textContent = 'Create a room to become the host.';
            empty.append(icon, heading, copy);
            list.append(empty);
            return;
        }

        visibleGames.forEach((game) => {
            const item = document.createElement('article');
            item.className = 'online-room-list-item';
            if (game.isServerLobby) item.classList.add('online-room-list-item--quick');

            const marker = document.createElement('div');
            marker.className = 'online-room-list-item__marker';
            marker.textContent = game.isServerLobby ? 'Q' : String(game.hostName || 'H').charAt(0).toUpperCase();

            const info = document.createElement('div');
            info.className = 'online-room-list-item__info';
            const title = document.createElement('h3');
            title.textContent = game.isServerLobby ? 'Quick Match' : `${game.hostName || 'Host'}'s Room`;
            const description = document.createElement('p');
            description.textContent = game.isServerLobby ? 'Server-managed rules · starts when both players are ready' : 'Private room · host-controlled rules';
            const tags = document.createElement('div');
            tags.className = 'online-room-list-item__tags';
            const themeTag = document.createElement('span');
            themeTag.textContent = MATCH_THEMES.find((theme) => theme.value === String(game.settings?.theme || 'tron'))?.label.toUpperCase() || 'STAR CIRCUIT';
            const sizeTag = document.createElement('span');
            sizeTag.textContent = `${game.settings?.arenaSize || 4} RINGS`;
            const playerTag = document.createElement('span');
            playerTag.textContent = `${game.playerCount}/${game.maxPlayers} PLAYERS`;
            tags.append(themeTag, sizeTag, playerTag);
            info.append(title, description, tags);

            const joinButton = document.createElement('button');
            joinButton.type = 'button';
            joinButton.className = 'online-room-list-item__join';
            const isFull = game.playerCount >= game.maxPlayers;
            joinButton.disabled = isFull;
            joinButton.textContent = isFull ? 'Full' : 'Join Room';
            joinButton.addEventListener('click', () => {
                joinButton.disabled = true;
                joinButton.textContent = 'Joining…';
                online.joinGame(game.id);
            });

            item.append(marker, info, joinButton);
            list.append(item);
        });
    });

    online.on('gameCreated', (game) => {
        console.log('[gameCreated] Event received');
        document.getElementById('online-my-game')?.classList.remove('hidden');
        document.getElementById('online-game-info').innerHTML = '<p>Waiting for players...</p>';
        document.getElementById('online-start-btn')?.classList.add('hidden');
        enterOnlineSetupState();
    });

    online.on('gameJoined', () => {
        document.getElementById('online-my-game')?.classList.add('hidden');
        enterOnlineSetupState();
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
        
        const gameInfo = document.getElementById('online-game-info');
        if (gameInfo) gameInfo.textContent = `Player joined: ${opponentName}`;
        if (isHost) {
            console.log('[playerJoined] Host detected, showing start button');
            document.getElementById('online-start-btn')?.classList.remove('hidden');
        } else {
            document.getElementById('online-joining')?.classList.add('hidden');
            document.getElementById('online-my-game')?.classList.remove('hidden');
            document.getElementById('online-my-game').style.borderColor = '#ffff00';
            if (gameInfo) gameInfo.textContent = 'Waiting for host to start...';
            document.getElementById('online-start-btn')?.classList.add('hidden');
        }
    });

    online.on('playerLeft', () => {
        const isHost = useGameStore.getState().online.isHost;
        const gameInfo = document.getElementById('online-game-info');
        if (gameInfo) gameInfo.textContent = 'Player left';
        if (isHost) document.getElementById('online-start-btn')?.classList.add('hidden');
    });

    online.on('gameStarting', (data) => {
        console.log('[gameStarting] Received game_starting event, countdown:', data.countdown, 'matchStart:', data.matchStart);
        console.log('[gameStarting] isHost:', useGameStore.getState().online.isHost, 'playerSlot:', useGameStore.getState().online.playerSlot);

        const matchStart = data.matchStart !== false;

        showOnlineLoadingOverlay();

        if (Array.isArray(data.players) && data.players.length > 0) {
            const hasZeroBasedSlots = data.players.some((player) => player?.slot === 0);
            const players = data.players.map((player) => ({
                ...player,
                slot: hasZeroBasedSlots && (player?.slot === 0 || player?.slot === 1)
                    ? player.slot + 1
                    : player?.slot,
            }));
            const p1 = players.find((player) => player?.slot === 1);
            const p2 = players.find((player) => player?.slot === 2);
            if (p1 || p2) {
                const current = useGameStore.getState();
                const p1Name = p1?.name ?? current.p1Name;
                const p2Name = p2?.name ?? current.p2Name;
                const p1Color = p1?.color ?? current.p1Color;
                const p2Color = p2?.color ?? current.p2Color;
                const p1Hat = p1?.hat ?? current.p1Hat;
                const p2Hat = p2?.hat ?? current.p2Hat;

                current.setPlayerNames(p1Name, p2Name);
                current.setPlayerColors(p1Color, p2Color);
                current.setPlayerHats(p1Hat, p2Hat);

                console.log('[gameStarting] Applied server customization before resetOnlineEntities:', {
                    p1Name,
                    p2Name,
                    p1Color,
                    p2Color,
                    p1Hat,
                    p2Hat,
                });
            }
        }

        Object.entries(data.settings).forEach(([key, val]) => {
            useGameStore.getState().updateSetting(key, val);
        });

        startOnlineGame(matchStart);
        countdownTimer = data.countdown;

        const revealGame = () => {
            hideAllScreens();
            screens.hud.classList.remove('hidden');
            screens.countdown.classList.remove('hidden');
            screens.countdown.textContent = String(data.countdown);
            hideOnlineLoadingOverlay();

            if (!useGameStore.getState().online.isHost) {
                setTimeout(() => online.requestSync(), 100);
            }
        };

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                revealGame();
            });
        });

        if (matchStart) {
            useGameStore.getState().startGame();
        } else {
            useGameStore.setState({
                gameState: 'COUNTDOWN',
                winner: null,
                activeTileEffects: [],
            });
        }
    });

    online.on('gameStarted', () => {
        console.log('[gameStarted] Received game_started event');
        console.log('[gameStarted] isHost:', useGameStore.getState().online.isHost, 'playerSlot:', useGameStore.getState().online.playerSlot);
        useGameStore.getState().setPlaying();
        if (!useGameStore.getState().online.isHost) {
            setTimeout(() => online.requestSync(), 100);
        }
    });

    online.on('rematchStart', () => {
        useGameStore.getState().resetOnlineSetupState?.();
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
        const st = useGameStore.getState();
        let newP1Score = st.p1Score;
        let newP2Score = st.p2Score;
        if (data.winner === 'Player 1') newP1Score++;
        if (data.winner === 'Player 2') newP2Score++;
        if (data.scores) {
            newP1Score = data.scores.p1 ?? newP1Score;
            newP2Score = data.scores.p2 ?? newP2Score;
        }

        if (data.matchOver) {
            useGameStore.setState({
                gameState: 'GAME_OVER',
                winner: data.winner,
                p1Score: newP1Score,
                p2Score: newP2Score,
            });
        } else {
            useGameStore.setState({
                gameState: 'ROUND_OVER',
                winner: data.winner,
                p1Score: newP1Score,
                p2Score: newP2Score,
                activeTileEffects: [],
            });
        }
    });

    online.on('matchOver', (data) => {
        useGameStore.setState({
            gameState: 'GAME_OVER',
            winner: data.winner,
            p1Score: data.scores?.p1 ?? useGameStore.getState().p1Score,
            p2Score: data.scores?.p2 ?? useGameStore.getState().p2Score,
        });
    });

    online.on('gameUpdate', (data) => {
        if (data.type === 'opponent_input' && data.input) {
            useGameStore.getState().setOnlineOpponentInput(data.input);
        }
        if (data.type === 'game_state_update' && data.state && player1 && player2) {
            const state = useGameStore.getState();
            const mySlot = state.online?.playerSlot;

            // Determine local and remote server positions.
            const localServerPos = mySlot === 1 ? data.state.p1Pos : data.state.p2Pos;
            const localServerVel = mySlot === 1 ? data.state.p1Vel : data.state.p2Vel;
            const localPlayer = getLocalPlayer(state);

            // Reconcile local predicted player against authoritative state.
            if (localPlayer?.rigidBody && localServerPos) {
                const now = performance.now();
                const reconciliationDelta = lastOnlineReconciliationAt > 0
                    ? Math.min(0.1, (now - lastOnlineReconciliationAt) / 1000)
                    : 0.05;
                lastOnlineReconciliationAt = now;
                reconcileLocalPlayer(
                    localPlayer,
                    localServerPos,
                    localServerVel || { x: 0, y: 0, z: 0 },
                    reconciliationDelta,
                );
            }

            // Sync tile states from authoritative server.
            if (data.state.tileStates && arena) {
                data.state.tileStates.forEach(tileUpdate => {
                    const tile = arena.getTileAt(tileUpdate.q, tileUpdate.r);
                    if (tile) {
                        const wasFalling = tile.state === 'FALLING';
                        tile.state = tileUpdate.state;
                        tile.timer = tileUpdate.timer;
                        tile.powerUpType = tileUpdate.powerUpType || null;
                        if (tileUpdate.state === 'FALLING' && !wasFalling) {
                            arena.hideTile(tileUpdate.q, tileUpdate.r);
                        }
                    }
                });
            }
        }
    });

    online.on('error', (msg) => {
        const connectScreen = document.getElementById('online-connect');
        const isConnectVisible = connectScreen && !connectScreen.classList.contains('hidden');
        if (isConnectVisible) {
            document.getElementById('online-connect-error').textContent = msg;
        } else {
            showOnlineToast(msg);
        }
        updateLobbyConnectionStatus('disconnected');
    });
}

// ============================================
// GAME LOOP
// ============================================
function animate(_timestamp, _frame) {
    const delta = Math.min(clock.getDelta(), 0.1);
    const state = useGameStore.getState();
    gameFeel.beginFrame(camera);

    // Dev-only snapshot for e2e/interaction tests. Pruned from production builds by Vite.
    if (import.meta.env && import.meta.env.DEV) {
        window.__DROPFALL_DEBUG__ = {
            gameState: state.gameState,
            gameMode: state.gameMode,
            isPaused: isGamePaused,
            performance: getPerformanceMetrics(),
            players: [
                player1
                    ? { id: 'p1', x: player1.mesh.position.x, y: player1.mesh.position.y, z: player1.mesh.position.z, dead: !!player1.isDead }
                    : null,
                player2
                    ? { id: 'p2', x: player2.mesh.position.x, y: player2.mesh.position.y, z: player2.mesh.position.z, dead: !!player2.isDead }
                    : null,
            ],
        };
    }

    if (isGamePaused) {
        updateRenderer();
        return;
    }

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
        collisionCooldown = Math.max(0, collisionCooldown - delta);
        const isOnlineMatch = state.gameMode === 'ONLINE';
        if (isOnlineMatch) {
            applyOnlineClientRemoteInterpolation(state);
        }

        // Always update player visuals (mesh sync, tile interactions, power-ups)
        player1?.update(delta, arena, particles);
        player2?.update(delta, arena, particles);

        if (aiController && player1 && player2) {
            const arenaRadius = (state.settings.arenaSize + 1) * 8.0;
            const activeTiles = arena?.getActiveTileSet() ?? null;
            const warnedTiles = arena?.getWarnedTileSet() ?? null;
            aiController.update(
                player1.mesh.position, player2.mesh.position,
                player1.rigidBody?.linvel(), player2.rigidBody?.linvel(),
                new THREE.Vector3(0, 0, 0), arenaRadius, delta, state,
                activeTiles, warnedTiles
            );
        }

        if (isOnlineMatch) {
            arena?.update(delta, { isOnlineClient: true });
        } else {
            arena?.update(delta);
        }
        particles?.update(delta);
        lightning?.update(delta);
        shockwaves?.update(delta);

        physicsSystem.step(delta);

        if (!isInVR()) {
            // Power-up displays
            renderPowerUpStatus('p1-powerups', player1?.activePowerUps);
            renderPowerUpStatus('p2-powerups', player2?.activePowerUps);
        }

        // The server owns online collision impulses. Every client still plays
        // the collision presentation locally from the smoothed positions.
        if (player1 && player2 && !player1.isDead && !player2.isDead) {
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

                if (!isOnlineMatch) {
                    const dir1 = new THREE.Vector3().subVectors(p1Pos, p2Pos).normalize();
                    const bounce = (1500 + relVel * 10) * (player1.isBoosting || player2.isBoosting ? 1.5 : 1.0);
                    if (!player1.isInvulnerable) player1.rigidBody.applyImpulse({ x: dir1.x * bounce, y: 0, z: dir1.z * bounce }, true);
                    if (!player2.isInvulnerable) player2.rigidBody.applyImpulse({ x: -dir1.x * bounce, y: 0, z: -dir1.z * bounce }, true);
                }

                const impactPosition = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
                const boostedImpact = player1.isBoosting || player2.isBoosting;
                particles?.emit(impactPosition, { x: 0, y: 10, z: 0 }, boostedImpact ? 0xffd63d : 0xff6b76, Math.floor(18 * intensity));
                shockwaves?.emit(impactPosition, boostedImpact ? 0xffd63d : 0x72e4d2, Math.min(intensity, 3));
                player1.glow.intensity = 10 * intensity;
                player2.glow.intensity = 10 * intensity;
                if (sceneFlashLight) {
                    sceneFlashLight.position.copy(impactPosition).add(new THREE.Vector3(0, 5, 0));
                    sceneFlashLight.color.setHex(boostedImpact ? 0xffd63d : 0xffffff);
                    sceneFlashLight.intensity = 18 * intensity;
                }
                gameFeel.triggerImpact(impactPosition, camera, intensity, boostedImpact);
                
                if (boostedImpact) {
                    lightning?.emit(impactPosition, intensity);
                }
                const arenaPanRange = Math.max(18, Number(state.settings.arenaSize || 4) * 8);
                playCollisionSound(intensity, impactPosition.x / arenaPanRange, boostedImpact);
            }

            if (player1.glow.intensity > 1) player1.glow.intensity -= delta * 10;
            if (player2.glow.intensity > 1) player2.glow.intensity -= delta * 10;
            if (sceneFlashLight?.intensity > 0) sceneFlashLight.intensity -= delta * 40;

            // Frame-rate independent camera movement (constant speed, not delta-dependent)
            const centerPos = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
            const arenaFraming = Math.max(26, Number(state.settings.arenaSize || 4) * 5.4, distance * 0.96);
            const targetCamPos = new THREE.Vector3(centerPos.x, arenaFraming, centerPos.z + arenaFraming);
            const camSpeed = 0.08; // Interpolation factor per frame (0-1)
            camera.position.lerp(targetCamPos, camSpeed);
            
            // Smooth camera lookAt target
            const targetLookAt = centerPos;
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
            if (!isOnlineMatch) {
                checkWinConditions(delta);
            }
            
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
                const input = getPlayer1InputUnified();
                if (online.shouldSendInput(input)) online.sendInput(input);
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
                    const victoryRadius = Math.max(12, Number(state.settings.sphereSize || 2) * 6);
                    camera.position.set(
                        pos.x + victoryRadius * Math.cos(t * 0.32),
                        pos.y + victoryRadius * 0.62,
                        pos.z + victoryRadius * Math.sin(t * 0.32)
                    );
                    camera.lookAt(pos.x, pos.y + Number(state.settings.sphereSize || 2) * 0.35, pos.z);
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

    if (isInVR()) {
        updateControllers();

        const midpoint = (player1 && player2)
            ? new THREE.Vector3().addVectors(player1.mesh.position, player2.mesh.position).multiplyScalar(0.5)
            : new THREE.Vector3(0, 0, 0);

        updateVRCameraRig(vrCameraRig, midpoint);
        updateVRUI(vrUI, state);
    } else if (vrUI) {
        vrUI.p1Score.sprite.visible = false;
        vrUI.p2Score.sprite.visible = false;
        vrUI.status.sprite.visible = false;
    }

    if (!isInVR()) gameFeel.finishFrame(camera, delta);
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

    if (st.gameMode === 'ONLINE') {
        countdownTimer = 3.0;

        // Both peers enter round state and then sample the authoritative server.
        useGameStore.getState().startRound();
        resetOnlineEntities();
        updateHUDNames();
        setTimeout(() => online.requestSync(), 120);
        return;
    }

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
        document.body.dataset.gameState = state.gameState;

        if (state.settings?.vrScale !== prevState.settings?.vrScale) {
            applyVRScale();
        }

        if (isInVR()) {
            return;
        }

        if (prevState.gameState === 'ONLINE_SETUP' && state.gameState !== 'ONLINE_SETUP') {
            cleanupOnlineSetupPanel();
            if (screens.onlineSetup) {
                screens.onlineSetup.innerHTML = '';
            }
        }

        // Screen transitions
        if (state.gameState !== prevState.gameState) {
            console.log('[Store Sub] gameState changed:', prevState.gameState, '->', state.gameState);
            if (state.gameState === 'GAME_OVER' && prevState.gameState !== 'GAME_OVER') {
                recordTrackedLocalMatch(state);
            }
            if (state.gameState !== 'COUNTDOWN' && state.gameState !== 'PLAYING') {
                setGamePaused(false, { focusResume: false });
            }
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
                case 'ONLINE_SETUP':
                    screens.onlineSetup.classList.remove('hidden');
                    mountOnlineSetupPanel();
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
                                    document.getElementById('restart-btn').disabled = false;
                                    document.getElementById('restart-btn').style.opacity = '1';
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
                    if (state.gameMode === 'ONLINE') {
                        const rematchRequested = Boolean(state.online?.rematchRequested);
                        const opponentRematchRequested = Boolean(state.online?.opponentRematchRequested);
                        const isNextSettingsPicker = state.online?.currentGame?.settingsPickerId === state.online?.playerId;
                        document.getElementById('restart-btn').textContent = rematchRequested
                            ? (isNextSettingsPicker ? 'Waiting for Opponent' : 'Waiting for Settings Picker')
                            : (isNextSettingsPicker ? 'Choose Next Match' : 'View Next Match Settings');
                        document.getElementById('restart-btn').disabled = rematchRequested;
                        document.getElementById('restart-btn').style.opacity = rematchRequested ? '0.6' : '1';
                        if (opponentRematchRequested) {
                            const winnerEl = document.getElementById('winner-text');
                            winnerEl.textContent = `${winnerEl.textContent} Opponent is ready to configure the next match.`;
                        }
                    } else {
                        document.getElementById('restart-btn').textContent = 'Play Again';
                        document.getElementById('restart-btn').disabled = false;
                        document.getElementById('restart-btn').style.opacity = '1';
                    }
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


        const disconnectedChanged = state.online?.opponentDisconnected !== prevState.online?.opponentDisconnected;
        const onlineContextChanged = state.gameMode !== prevState.gameMode || state.gameState !== prevState.gameState;
        if (disconnectedChanged || onlineContextChanged) {
            const inOnlineSession = state.gameMode === 'ONLINE' && state.gameState !== 'MENU';
            const showOverlay = inOnlineSession && Boolean(state.online?.opponentDisconnected);
            setOpponentDisconnectOverlayVisible(showOverlay);
        }
        // Update HUD
        document.getElementById('p1-score').textContent = state.p1Score;
        document.getElementById('p2-score').textContent = state.p2Score;
        const gameOverScore = document.getElementById('game-over-score');
        if (gameOverScore) {
            const separator = document.createElement('span');
            separator.textContent = ':';
            gameOverScore.replaceChildren(String(state.p1Score), separator, String(state.p2Score));
        }
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

        const vrButton = initVR(renderer);
        document.body.appendChild(vrButton);

        // AR button (hidden by default, shown when AR mode selected)
        const arButton = initAR(renderer);
        arButton.id = 'ARButton';
        document.body.appendChild(arButton);
        const supportsXRMode = async (mode) => {
            try {
                return Boolean(await navigator.xr?.isSessionSupported?.(mode));
            } catch {
                return false;
            }
        };
        const [vrSupported, arSupported] = await Promise.all([
            supportsXRMode('immersive-vr'),
            supportsXRMode('immersive-ar'),
        ]);

        // Show/hide XR buttons based on store setting
        const updateXRButtons = () => {
            const settings = useGameStore.getState().settings;
            const showAR = settings.arMode === true;
            vrButton.style.display = !showAR && vrSupported ? '' : 'none';
            arButton.style.display = showAR && arSupported ? '' : 'none';
        };
        updateXRButtons();

        // Subscribe to XR mode changes
        useGameStore.subscribe((state, prevState) => {
            if (state.settings?.arMode !== prevState.settings?.arMode) {
                updateXRButtons();
            }
            if (state.settings?.arHeight !== prevState.settings?.arHeight ||
                state.settings?.arModeType !== prevState.settings?.arModeType) {
                // Re-apply camera positioning when AR settings change
                applyVRScale();
            }
        });

        const vrControllers = initControllers(renderer, scene);
        Object.values(vrControllers).forEach((controllerObj) => {
            if (controllerObj) {
                controllerObj.userData.excludeFromVRContainer = true;
            }
        });

        vrCameraRig = createVRCameraRig(camera, scene);
        scene.add(vrCameraRig);
        vrUI = createVRUI(scene);
        vrUI.p1Score.sprite.userData.excludeFromVRContainer = true;
        vrUI.p2Score.sprite.userData.excludeFromVRContainer = true;
        vrUI.status.sprite.userData.excludeFromVRContainer = true;
        vrUI.p1Score.sprite.visible = false;
        vrUI.p2Score.sprite.visible = false;
        vrUI.status.sprite.visible = false;

        onVRSessionStart(() => {
            applyVRScale();
            reparentToVRContainer(scene);
        });

        onVRSessionEnd(() => {
            reparentToScene(scene);
        });

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
        
        const debugPhysics = import.meta.env.DEV
            && globalThis.localStorage?.getItem('dropfall_debug_physics') === '1';

        // Physics event tracing is opt-in; several events can fire every frame.
        physicsSystem.on('collision', (event) => {
            if (debugPhysics) console.debug('[PhysicsSystem] Collision:', event.entityA, '<->', event.entityB);
        });
        physicsSystem.on('knockback', (event) => {
            if (debugPhysics) console.debug('[PhysicsSystem] Knockback applied to:', event.targetEntity);
        });
        physicsSystem.on('out-of-bounds', (event) => {
            if (debugPhysics) console.debug('[PhysicsSystem] Out of bounds:', event.entity, event.direction);
        });
        
        arena = new Arena();
        particles = new ParticleSystem();
        lightning = new LightningSystem();
        shockwaves = new ShockwaveSystem();
        
        sceneFlashLight = new THREE.PointLight(0xffffff, 0, 200);
        sceneFlashLight.position.set(0, 10, 0);
        scene.add(sceneFlashLight);

        if (getVRContainer()) {
            applyVRScale();
        }

        syncSelectedProfileToGame();
        renderProfileHub();
        setupButtonHandlers();
        setupOnlineHandlers();
        setupStoreSubscription();
        populatePowerupsGuide();

        const serverInput = document.getElementById('online-server-input');
        if (serverInput && !serverInput.value.trim()) {
            serverInput.value = getDefaultOnlineServerUrl();
        }
        configureOnlineConnectUI();

        const onlineNameInput = document.getElementById('online-name-input');
        if (onlineNameInput && !onlineNameInput.value.trim()) {
            onlineNameInput.value = (localStorage.getItem('dropfall_p1name') || 'Player').slice(0, 20);
        }
        ensureOpponentDisconnectOverlay();
        document.body.dataset.gameState = useGameStore.getState().gameState;

        showScreen('menu');
        renderer.setAnimationLoop(animate);
    } catch (error) {
        console.error('[Game] Initialization failed:', error);
    }
}

init();
