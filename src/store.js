import { createStore } from 'zustand/vanilla';

const defaultSettings = {
    theme: 'default',
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
    portalRate: 8.0,
    portalCooldown: 2.0,
    bonusRate: 6.0,
    bonusDuration: 4.0,
    bloomLevel: 0,
    boostRegenSpeed: 1.5,
    boostDrainRate: 20,
    playerAuraSize: 1.4,
    playerAuraOpacity: 0.4,
    playerGlowIntensity: 3.0,
    playerGlowRange: 30,
    autoRestart: false,
    controls: {
        p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'ShiftLeft' },
        p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', boost: 'ShiftRight' }
    },
    activePowerUps: {} // Track active power-ups: { playerId: [{ type, startTime, duration }] }
};

const savedSettings = JSON.parse(localStorage.getItem('dropfall_settings')) || {};

// Ensure all new settings have values (fill in defaults for any missing)
const mergedSettings = { ...defaultSettings, ...savedSettings };

export const useGameStore = createStore((set) => ({
    // State
    gameState: 'MENU', // 'MENU', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER'
    winner: null,
    p1Score: 0,
    p2Score: 0,
    player1Boost: 0,
    player2Boost: 0,
    activeTileEffects: [],
    p1Name: localStorage.getItem('dropfall_p1name') || 'Player 1',
    p2Name: localStorage.getItem('dropfall_p2name') || 'Player 2',

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
    }))
}));
