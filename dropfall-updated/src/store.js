import { createStore } from 'zustand/vanilla';

const defaultSettings = {
    theme: 'tron',
    sphereSize: 2.0,
    sphereWeight: 200,
    sphereAccel: 2000,
    collisionBounce: 0.9,
    arenaSize: 4,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    particleAmount: 1.0,
    destructionRate: 3.0,
    iceRate: 2.0,
    bonusRate: 6.0,
    bonusDuration: 4.0,
    bloomLevel: 0,
    boostRegenSpeed: 1.5,
    boostDrainRate: 20,
    playerAuraSize: 1.4,
    playerAuraOpacity: 0.4,
    playerGlowIntensity: 3.0,
    playerGlowRange: 30,
    autoRestart: true,
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

const savedSettings = JSON.parse(localStorage.getItem('dropfall_settings')) || {};

// Backward compatibility: map old theme names
if (savedSettings.theme === 'default') savedSettings.theme = 'tron';
if (savedSettings.theme === 'cracked_stone') savedSettings.theme = 'temple';

// Ensure all new settings have values (fill in defaults for any missing)
const mergedSettings = { ...defaultSettings, ...savedSettings };

export const useGameStore = createStore((set) => ({
    // State
    gameState: 'MENU', // 'MENU', 'GAME_MODE_SELECT', 'DIFFICULTY_SELECT', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'ONLINE'
    gameMode: localStorage.getItem('dropfall_gamemode') || '2P', // '1P', '2P', or 'ONLINE'
    difficulty: localStorage.getItem('dropfall_difficulty') || 'normal', // 'easy', 'normal', 'hard'
    winner: null,
    p1Score: 0,
    p2Score: 0,
    player1Boost: 0,
    player2Boost: 0,
    activeTileEffects: [],
    p1Name: localStorage.getItem('dropfall_p1name') || 'Player 1',
    p2Name: localStorage.getItem('dropfall_p2name') || 'Player 2',
    p1Hat: localStorage.getItem('dropfall_p1hat') || 'none',
    p2Hat: localStorage.getItem('dropfall_p2hat') || 'none',

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
        opponentName: '',
        myName: '',
    },

    // Settings
    settings: mergedSettings,

    // Actions
    updateSetting: (key, value) => set((state) => {
        const newSettings = { ...state.settings, [key]: value };
        localStorage.setItem('dropfall_settings', JSON.stringify(newSettings));
        return { settings: newSettings };
    }),

    resetSettings: () => set(() => {
        localStorage.setItem('dropfall_settings', JSON.stringify(defaultSettings));
        return { settings: defaultSettings };
    }),

    setPlayerNames: (p1Name, p2Name) => set(() => {
        localStorage.setItem('dropfall_p1name', p1Name);
        localStorage.setItem('dropfall_p2name', p2Name);
        return { p1Name, p2Name };
    }),

    setPlayerHats: (p1Hat, p2Hat) => set(() => {
        localStorage.setItem('dropfall_p1hat', p1Hat);
        localStorage.setItem('dropfall_p2hat', p2Hat);
        return { p1Hat, p2Hat };
    }),

    setGameMode: (mode) => set((state) => {
        localStorage.setItem('dropfall_gamemode', mode);
        // For 1P mode, go to difficulty selection
        // For 2P mode, skip difficulty and go straight to name entry
        // For ONLINE mode, show online connect screen (handled by main.js)
        const nextState = mode === '1P' ? 'DIFFICULTY_SELECT' : mode === 'ONLINE' ? 'MENU' : 'NAME_ENTRY';
        return { gameMode: mode, gameState: nextState };
    }),

    setDifficulty: (diff) => set(() => {
        localStorage.setItem('dropfall_difficulty', diff);
        return { difficulty: diff, gameState: 'NAME_ENTRY' };
    }),

    enterNameEntry: () => set({ gameState: 'NAME_ENTRY' }),

    startGame: () => set({
        gameState: 'COUNTDOWN',
        winner: null,
        p1Score: 0,
        p2Score: 0,
        player1Boost: 0,
        player2Boost: 0,
        activeTileEffects: []
    }),

    startRound: () => set({
        gameState: 'COUNTDOWN',
        winner: null,
        activeTileEffects: []
    }),

    resetScores: () => set({
        p1Score: 0,
        p2Score: 0,
        player1Boost: 0,
        player2Boost: 0
    }),

    setPlaying: () => set({
        gameState: 'PLAYING'
    }),

    returnToMenu: () => set({
        gameState: 'MENU',
        winner: null,
        p1Score: 0,
        p2Score: 0,
        player1Boost: 0,
        player2Boost: 0,
        activeTileEffects: []
    }),

    endRound: (winner) => set((state) => {
        let newP1Score = state.p1Score;
        let newP2Score = state.p2Score;
        
        if (winner === 'Player 1') newP1Score++;
        if (winner === 'Player 2') newP2Score++;

        if (newP1Score >= 3 || newP2Score >= 3) {
            return {
                gameState: 'GAME_OVER',
                winner: newP1Score >= 3 ? 'Player 1' : 'Player 2',
                p1Score: newP1Score,
                p2Score: newP2Score
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

    setOnlineMyName: (name) => set((state) => ({
        online: { ...state.online, myName: name }
    })),

    enterOnlineLobby: () => set({ gameState: 'ONLINE' }),

    setOnlineName: (name) => set((state) => ({
        online: { ...state.online, myName: name }
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
            opponentName: '',
            myName: '',
        }
    }))
}));
