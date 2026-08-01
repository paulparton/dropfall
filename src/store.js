import { createStore } from 'zustand/vanilla';
import { MATCH_DEFAULTS } from '../shared/matchSettings.js';
import { BATTLE_RULES } from '../shared/gameRules.js';
import { normalizeHatId } from '../shared/cosmetics.js';

function readStorage(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        globalThis.localStorage?.setItem(key, value);
    } catch {
        // Storage can be unavailable in private browsing, tests, or locked-down embeds.
    }
}

function readJsonStorage(key, fallback) {
    try {
        const value = readStorage(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

const defaultSettings = {
    ...MATCH_DEFAULTS,
    vrScale: 4,
    arMode: false,
    arModeType: 'roomscale',
    arHeight: 0.75,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    particleAmount: 1.0,
    bloomLevel: 0,
    playerAuraSize: 1.4,
    playerAuraOpacity: 0.4,
    playerGlowIntensity: 3.0,
    playerGlowRange: 30,
    autoRestart: false,
    controls: {
        p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'ShiftLeft' },
        p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', boost: 'ShiftRight' }
    },
    activePowerUps: {}, // Track active power-ups: { playerId: [{ type, startTime, duration }] }
    powerUpWeights: {
        ACCELERATION_BOOST: 50,
        SIZE_REDUCTION: 50,
        WEIGHT_INCREASE: 50,
        SPEED_BURST: 50,
        LIGHT_TOUCH: 50,
        SIZE_INCREASE: 50,
        GRIP_BOOST: 50,
        INVULNERABILITY: 50
    }
};

const savedSettings = readJsonStorage('dropfall_settings', {});

// Backward compatibility: map old theme names
if (savedSettings.theme === 'default') savedSettings.theme = 'tron';
if (savedSettings.theme === 'cracked_stone') savedSettings.theme = 'temple';

// Ensure all new settings have values (fill in defaults for any missing)
const mergedSettings = { ...defaultSettings, ...savedSettings };

const defaultOnlineSetupState = {
    opponentColor: null,
    opponentHat: null,
    opponentName: null,
    myReady: false,
    opponentReady: false,
    allReady: false,
    opponentDisconnected: false,
    rematchRequested: false,
    opponentRematchRequested: false,
};

const createDefaultPlayerRaceState = () => ({
    currentLap: 0,
    lastCheckpointId: -1,
    checkpointsBitmask: 0,
    lapTimes: [],
    finished: false,
    finishTime: null,
});

const createRaceState = (totalLaps, checkpointCount) => ({
    active: true,
    totalLaps,
    checkpointCount,
    raceStartTime: Date.now(),
    elapsedTime: 0,
    player1: createDefaultPlayerRaceState(),
    player2: createDefaultPlayerRaceState(),
    winner: null,
});

const createDefaultRaceModePlayerState = () => ({
    currentCheckpoint: 0,
    lap: 0,
    checkpointsPassed: [],
    finished: false,
    finishTime: null,
});

const createDefaultRaceModeState = () => ({
    p1: createDefaultRaceModePlayerState(),
    p2: createDefaultRaceModePlayerState(),
});

export const useGameStore = createStore((set, get) => ({
    // State
    gameState: 'MENU', // 'MENU', 'GAME_MODE_SELECT', 'DIFFICULTY_SELECT', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'ONLINE', 'ONLINE_SETUP'
    gameMode: readStorage('dropfall_gamemode') || '2P', // '1P', '2P', or 'ONLINE'
    difficulty: readStorage('dropfall_difficulty') || 'normal', // 'easy', 'normal', 'hard'
    winner: null,
    p1Score: 0,
    p2Score: 0,
    p1SessionWins: 0,
    p2SessionWins: 0,
    player1Boost: 0,
    player2Boost: 0,
    activeTileEffects: [],
    p1Name: readStorage('dropfall_p1name') || 'Player 1',
    p2Name: readStorage('dropfall_p2name') || 'Player 2',
    p1Hat: normalizeHatId(readStorage('dropfall_p1hat')),
    p2Hat: normalizeHatId(readStorage('dropfall_p2hat')),
    p1Color: parseInt(readStorage('dropfall_p1color')?.replace(/^0x/, '') || 'ff0000', 16),
    p2Color: parseInt(readStorage('dropfall_p2color')?.replace(/^0x/, '') || '0000ff', 16),
    p1UseStageSkin: readStorage('dropfall_p1stagekin') === null ? true : readStorage('dropfall_p1stagekin') === 'true',
    p2UseStageSkin: readStorage('dropfall_p2stagekin') === null ? true : readStorage('dropfall_p2stagekin') === 'true',
    selectedLevelId: null,
    selectedLevelData: null,
    race: null,
    raceMode: false,
    raceLaps: 3,
    raceState: createDefaultRaceModeState(),
    raceStartTime: null,
    raceWinner: null,

    // Online Multiplayer State
    online: {
        connected: false,
        serverUrl: '',
        playerId: null,
        currentGame: null,
        games: [],
        isHost: false,
        playerSlot: null,
        opponentConnected: false,
        opponentInput: null,
        opponentName: null,
        myName: '',
        ...defaultOnlineSetupState,
    },

    // Settings
    settings: mergedSettings,

    // Actions
    updateSetting: (key, value) => set((state) => {
        const newSettings = { ...state.settings, [key]: value };
        writeStorage('dropfall_settings', JSON.stringify(newSettings));
        return { settings: newSettings };
    }),

    resetSettings: () => set(() => {
        writeStorage('dropfall_settings', JSON.stringify(defaultSettings));
        return { settings: defaultSettings };
    }),

    setPlayerNames: (p1Name, p2Name) => set(() => {
        writeStorage('dropfall_p1name', p1Name);
        writeStorage('dropfall_p2name', p2Name);
        return { p1Name, p2Name };
    }),

    setPlayerHats: (p1Hat, p2Hat) => set(() => {
        const normalizedP1Hat = normalizeHatId(p1Hat);
        const normalizedP2Hat = normalizeHatId(p2Hat);
        writeStorage('dropfall_p1hat', normalizedP1Hat);
        writeStorage('dropfall_p2hat', normalizedP2Hat);
        return { p1Hat: normalizedP1Hat, p2Hat: normalizedP2Hat };
    }),

    setPlayerColors: (p1Color, p2Color) => set(() => {
        writeStorage('dropfall_p1color', p1Color.toString(16));
        writeStorage('dropfall_p2color', p2Color.toString(16));
        return { p1Color, p2Color };
    }),

    setPlayerStageSkins: (p1UseStageSkin, p2UseStageSkin) => set(() => {
        writeStorage('dropfall_p1stagekin', String(p1UseStageSkin));
        writeStorage('dropfall_p2stagekin', String(p2UseStageSkin));
        return { p1UseStageSkin, p2UseStageSkin };
    }),

    setSelectedLevel: (id, data) => set(() => ({
        selectedLevelId: id,
        selectedLevelData: data
    })),

    setGameMode: (mode) => set((state) => {
        writeStorage('dropfall_gamemode', mode);
        // All modes go directly to NAME_ENTRY (game settings)
        // For 1P, difficulty selection appears within game settings
        const nextState = 'NAME_ENTRY';
        if (mode !== 'ONLINE') {
            return {
                gameMode: mode,
                gameState: nextState,
                online: { ...state.online, ...defaultOnlineSetupState },
            };
        }
        return { gameMode: mode, gameState: nextState };
    }),

    setDifficulty: (diff) => set(() => {
        writeStorage('dropfall_difficulty', diff);
        return { difficulty: diff, gameState: 'NAME_ENTRY' };
    }),

    enterNameEntry: () => set({ gameState: 'NAME_ENTRY' }),

    startGame: () => {
        get().resetRace();
        get().resetRaceState();
        set({
            gameState: 'COUNTDOWN',
            winner: null,
            p1Score: 0,
            p2Score: 0,
            player1Boost: 0,
            player2Boost: 0,
            activeTileEffects: [],
        });
    },

    startRound: () => set({
        gameState: 'COUNTDOWN',
        winner: null,
        activeTileEffects: []
    }),

    resetScores: () => {
        get().resetRace();
        get().resetRaceState();
        set({
            p1Score: 0,
            p2Score: 0,
            player1Boost: 0,
            player2Boost: 0,
        });
    },

    setPlaying: () => set({
        gameState: 'PLAYING'
    }),

    returnToMenu: () => {
        get().resetRace();
        get().resetRaceState();
        set({
            gameState: 'MENU',
            winner: null,
            p1Score: 0,
            p2Score: 0,
            p1SessionWins: 0,
            p2SessionWins: 0,
            player1Boost: 0,
            player2Boost: 0,
            activeTileEffects: [],
            online: {
                connected: false,
                serverUrl: '',
                playerId: null,
                currentGame: null,
                games: [],
                isHost: false,
                playerSlot: null,
                opponentConnected: false,
                opponentInput: null,
                opponentName: null,
                myName: '',
                ...defaultOnlineSetupState,
            }
        });
    },

    endRound: (winner) => set((state) => {
        let newP1Score = state.p1Score;
        let newP2Score = state.p2Score;
        
        if (winner === 'Player 1') newP1Score++;
        if (winner === 'Player 2') newP2Score++;

        if (newP1Score >= BATTLE_RULES.winsToWinMatch || newP2Score >= BATTLE_RULES.winsToWinMatch) {
            return {
                gameState: 'GAME_OVER',
                winner: newP1Score >= BATTLE_RULES.winsToWinMatch ? 'Player 1' : 'Player 2',
                p1Score: newP1Score,
                p2Score: newP2Score,
                p1SessionWins: newP1Score >= BATTLE_RULES.winsToWinMatch ? state.p1SessionWins + 1 : state.p1SessionWins,
                p2SessionWins: newP2Score >= BATTLE_RULES.winsToWinMatch ? state.p2SessionWins + 1 : state.p2SessionWins
            };
        }

        return {
            gameState: 'ROUND_OVER',
            winner,
            p1Score: newP1Score,
            p2Score: newP2Score
        };
    }),

    updateBoost: (player, amount) => set((state) => ({
        [`${player}Boost`]: Math.min(100, Math.max(0, state[`${player}Boost`] + amount))
    })),
    
    addTileEffect: (effect) => set((state) => ({
        activeTileEffects: [...state.activeTileEffects, effect]
    })),
    
    removeTileEffect: (effectId) => set((state) => ({
        activeTileEffects: state.activeTileEffects.filter(e => e.id !== effectId)
    })),

    initRace: (totalLaps, checkpointCount) => set({
        race: createRaceState(totalLaps, checkpointCount)
    }),

    updatePlayerCheckpoint: (playerId, checkpointId) => set((state) => {
        if (!state.race) return {};
        const playerState = state.race[playerId];
        const checkpointBit = 1 << checkpointId;
        return {
            race: {
                ...state.race,
                [playerId]: {
                    ...playerState,
                    lastCheckpointId: checkpointId,
                    checkpointsBitmask: playerState.checkpointsBitmask | checkpointBit,
                },
            },
        };
    }),

    completePlayerLap: (playerId, lapTime) => set((state) => {
        if (!state.race) return {};
        const playerState = state.race[playerId];
        return {
            race: {
                ...state.race,
                [playerId]: {
                    ...playerState,
                    currentLap: playerState.currentLap + 1,
                    lapTimes: [...playerState.lapTimes, lapTime],
                    checkpointsBitmask: 0,
                    lastCheckpointId: -1,
                },
            },
        };
    }),

    finishPlayerRace: (playerId, finishTime) => set((state) => {
        if (!state.race) return {};
        const playerState = state.race[playerId];
        return {
            race: {
                ...state.race,
                [playerId]: {
                    ...playerState,
                    finished: true,
                    finishTime,
                },
            },
        };
    }),

    updateRaceTime: (elapsed) => set((state) => ({
        race: state.race
            ? {
                ...state.race,
                elapsedTime: elapsed,
            }
            : null,
    })),

    endRace: (winner) => set((state) => ({
        race: state.race
            ? {
                ...state.race,
                winner,
                active: false,
            }
            : null,
    })),

    resetRace: () => set({ race: null }),

    setRaceMode: (enabled, laps = 3) => {
        const safeLaps = Number.isFinite(laps) ? Math.max(1, Math.floor(laps)) : 3;
        set({
            raceMode: enabled,
            raceLaps: safeLaps,
            raceState: createDefaultRaceModeState(),
            raceStartTime: null,
            raceWinner: null,
        });
    },

    passCheckpoint: (player, checkpointId, totalCheckpoints) => set((state) => {
        if (!state.raceMode || state.raceWinner) return {};

        const playerState = state.raceState[player];
        if (!playerState || playerState.finished) return {};

        const checkpointCount = Number.isFinite(totalCheckpoints)
            ? Math.max(1, Math.floor(totalCheckpoints))
            : 1;
        const maxCheckpointId = checkpointCount - 1;

        if (!Number.isFinite(checkpointId) || checkpointId < 0 || checkpointId > maxCheckpointId) {
            return {};
        }

        if (checkpointId === 0) {
            const requiredCount = Math.max(0, checkpointCount - 1);
            const lapReady = requiredCount === 0
                ? playerState.currentCheckpoint === 0
                : playerState.currentCheckpoint === maxCheckpointId
                    && playerState.checkpointsPassed.length === requiredCount;

            if (!lapReady) return {};

            const now = Date.now();
            const newLap = playerState.lap + 1;
            const finished = newLap >= state.raceLaps;

            return {
                raceStartTime: state.raceStartTime ?? now,
                raceWinner: !state.raceWinner && finished ? player : state.raceWinner,
                raceState: {
                    ...state.raceState,
                    [player]: {
                        ...playerState,
                        currentCheckpoint: 0,
                        lap: newLap,
                        checkpointsPassed: [],
                        finished,
                        finishTime: finished ? now : null,
                    },
                },
            };
        }

        const expectedCheckpoint = playerState.currentCheckpoint === 0
            ? 1
            : playerState.currentCheckpoint + 1;

        if (checkpointId !== expectedCheckpoint || playerState.checkpointsPassed.includes(checkpointId)) {
            return {};
        }

        const now = Date.now();
        return {
            raceStartTime: state.raceStartTime ?? now,
            raceState: {
                ...state.raceState,
                [player]: {
                    ...playerState,
                    currentCheckpoint: checkpointId,
                    checkpointsPassed: [...playerState.checkpointsPassed, checkpointId],
                },
            },
        };
    }),

    resetRaceState: () => set({
        raceState: createDefaultRaceModeState(),
        raceStartTime: null,
        raceWinner: null,
    }),

    // Online Multiplayer Actions
    setOnlineConnected: (connected, serverUrl = '') => set((state) => ({
        online: { ...state.online, connected, serverUrl }
    })),

    setOnlinePlayerId: (playerId) => set((state) => ({
        online: { ...state.online, playerId }
    })),

    setOnlineGames: (games) => set((state) => ({
        online: { ...state.online, games }
    })),

    setOnlineCurrentGame: (game) => set((state) => ({
        online: { ...state.online, currentGame: game }
    })),

    setOnlineHost: (isHost) => set((state) => ({
        online: { ...state.online, isHost }
    })),

    setOnlinePlayerSlot: (slot) => set((state) => ({
        online: { ...state.online, playerSlot: slot }
    })),

    setOnlineOpponentConnected: (connected) => set((state) => ({
        online: { ...state.online, opponentConnected: connected }
    })),

    setOnlineOpponentInput: (input) => set((state) => ({
        online: { ...state.online, opponentInput: input }
    })),

    setOnlineOpponentName: (name) => set((state) => ({
        online: { ...state.online, opponentName: name }
    })),

    setOnlineOpponentCustomization: (color, hat, name) => set((state) => ({
        online: {
            ...state.online,
            opponentColor: color,
            opponentHat: hat,
            opponentName: name,
        }
    })),

    setOnlineReady: (ready) => set((state) => ({
        online: { ...state.online, myReady: ready }
    })),

    setOnlineOpponentReady: (ready) => set((state) => ({
        online: { ...state.online, opponentReady: ready }
    })),

    setOnlineAllReady: (allReady) => set((state) => ({
        online: { ...state.online, allReady }
    })),

    setOpponentDisconnected: (disconnected) => set((state) => ({
        online: { ...state.online, opponentDisconnected: disconnected }
    })),

    setRematchRequested: (requested) => set((state) => ({
        online: { ...state.online, rematchRequested: requested }
    })),

    setOpponentRematchRequested: (requested) => set((state) => ({
        online: { ...state.online, opponentRematchRequested: requested }
    })),

    resetOnlineSetupState: () => set((state) => ({
        online: { ...state.online, ...defaultOnlineSetupState }
    })),

    setOnlineMyName: (name) => set((state) => ({
        online: { ...state.online, myName: name }
    })),

    enterOnlineLobby: () => set({ gameState: 'ONLINE' }),

    setOnlineName: (name) => set((state) => ({
        online: { ...state.online, myName: name }
    })),

    clearOnlineRoom: () => set((state) => ({
        online: {
            ...state.online,
            currentGame: null,
            isHost: false,
            playerSlot: null,
            opponentConnected: false,
            opponentInput: null,
            opponentName: null,
            ...defaultOnlineSetupState,
        }
    })),

    resetOnlineState: () => set((state) => ({
        online: {
            connected: state.online.connected,
            serverUrl: state.online.serverUrl,
            playerId: null,
            currentGame: null,
            games: [],
            isHost: false,
            playerSlot: null,
            opponentConnected: false,
            opponentInput: null,
            opponentName: null,
            myName: '',
            ...defaultOnlineSetupState,
        }
    }))
}));
