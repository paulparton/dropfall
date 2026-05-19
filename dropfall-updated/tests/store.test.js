import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';

const defaultSettings = {
    theme: 'default',
    sphereSize: 2.0,
    sphereWeight: 200,
    collisionBounce: 0.9,
    arenaSize: 4,
    autoRestart: false,
    controls: {
        p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'ShiftLeft' },
        p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', boost: 'ShiftRight' }
    }
};

function createTestStore() {
    return createStore((set) => ({
        gameState: 'MENU',
        gameMode: '2P',
        difficulty: 'normal',
        winner: null,
        p1Score: 0,
        p2Score: 0,
        player1Boost: 0,
        player2Boost: 0,
        activeTileEffects: [],
        p1Name: 'Player 1',
        p2Name: 'Player 2',
        settings: { ...defaultSettings },
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
        },
        
        setGameMode: (mode) => set((state) => ({
            gameMode: mode,
            gameState: mode === '1P' ? 'DIFFICULTY_SELECT' : mode === 'ONLINE' ? 'MENU' : 'NAME_ENTRY'
        })),
        
        setDifficulty: (diff) => set(() => ({
            difficulty: diff,
            gameState: 'NAME_ENTRY'
        })),
        
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
        
        setPlaying: () => set({ gameState: 'PLAYING' }),
        
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
        
        updateSetting: (key, value) => set((state) => ({
            settings: { ...state.settings, [key]: value }
        })),
        
        setPlayerNames: (p1Name, p2Name) => set({ p1Name, p2Name }),
    }));
}

describe('Game Store', () => {
    let store;

    beforeEach(() => {
        store = createTestStore();
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const state = store.getState();
            expect(state.gameState).toBe('MENU');
            expect(state.gameMode).toBe('2P');
            expect(state.p1Score).toBe(0);
            expect(state.p2Score).toBe(0);
        });

        it('should have default settings', () => {
            const state = store.getState();
            expect(state.settings.theme).toBe('default');
            expect(state.settings.sphereSize).toBe(2.0);
            expect(state.settings.arenaSize).toBe(4);
        });
    });

    describe('Game Mode Selection', () => {
        it('should transition to DIFFICULTY_SELECT for 1P mode', () => {
            store.getState().setGameMode('1P');
            const state = store.getState();
            expect(state.gameMode).toBe('1P');
            expect(state.gameState).toBe('DIFFICULTY_SELECT');
        });

        it('should transition to NAME_ENTRY for 2P mode', () => {
            store.getState().setGameMode('2P');
            const state = store.getState();
            expect(state.gameMode).toBe('2P');
            expect(state.gameState).toBe('NAME_ENTRY');
        });

        it('should transition to MENU for ONLINE mode', () => {
            store.getState().setGameMode('ONLINE');
            const state = store.getState();
            expect(state.gameMode).toBe('ONLINE');
            expect(state.gameState).toBe('MENU');
        });
    });

    describe('Game Flow', () => {
        it('should start game in COUNTDOWN state', () => {
            store.getState().startGame();
            const state = store.getState();
            expect(state.gameState).toBe('COUNTDOWN');
            expect(state.p1Score).toBe(0);
        });

        it('should transition to PLAYING state', () => {
            store.getState().startGame();
            store.getState().setPlaying();
            const state = store.getState();
            expect(state.gameState).toBe('PLAYING');
        });

        it('should end round and update scores', () => {
            store.getState().startGame();
            store.getState().endRound('Player 1');
            let state = store.getState();
            expect(state.gameState).toBe('ROUND_OVER');
            expect(state.p1Score).toBe(1);
        });

        it('should end game when score reaches 3', () => {
            store.setState({ p1Score: 2 });
            store.getState().endRound('Player 1');
            const state = store.getState();
            expect(state.gameState).toBe('GAME_OVER');
            expect(state.winner).toBe('Player 1');
        });

        it('should handle draw', () => {
            store.getState().startGame();
            store.getState().endRound('Draw');
            const state = store.getState();
            expect(state.gameState).toBe('ROUND_OVER');
        });

        it('should return to menu', () => {
            store.getState().startGame();
            store.getState().returnToMenu();
            const state = store.getState();
            expect(state.gameState).toBe('MENU');
        });
    });

    describe('Settings', () => {
        it('should update settings', () => {
            store.getState().updateSetting('theme', 'beach');
            const state = store.getState();
            expect(state.settings.theme).toBe('beach');
        });

        it('should update player names', () => {
            store.getState().setPlayerNames('Alice', 'Bob');
            const state = store.getState();
            expect(state.p1Name).toBe('Alice');
            expect(state.p2Name).toBe('Bob');
        });
    });
});

describe('Game State Machine', () => {
    let store;

    beforeEach(() => {
        store = createTestStore();
    });

    it('should follow valid state transitions', () => {
        store.getState().setGameMode('1P');
        expect(store.getState().gameState).toBe('DIFFICULTY_SELECT');
        
        store.getState().setDifficulty('normal');
        expect(store.getState().gameState).toBe('NAME_ENTRY');
        
        store.getState().enterNameEntry();
        store.getState().startGame();
        expect(store.getState().gameState).toBe('COUNTDOWN');
        
        store.getState().setPlaying();
        expect(store.getState().gameState).toBe('PLAYING');
    });

    it('should handle full game flow', () => {
        store.getState().startGame();
        store.getState().setPlaying();
        
        store.getState().endRound('Player 1');
        expect(store.getState().gameState).toBe('ROUND_OVER');
        expect(store.getState().p1Score).toBe(1);
        
        store.getState().startRound();
        store.getState().setPlaying();
        store.getState().endRound('Player 1');
        expect(store.getState().p1Score).toBe(2);
        
        store.getState().startRound();
        store.getState().setPlaying();
        store.getState().endRound('Player 1');
        
        expect(store.getState().gameState).toBe('GAME_OVER');
        
        store.getState().returnToMenu();
        expect(store.getState().gameState).toBe('MENU');
    });
});
