import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GameState,
  GameMode,
  Difficulty,
  GamePhase,
  Entity,
  EntityMap,
  ArenaBounds,
} from './types/Game';
import type { InputPayload } from './types/Input';
import type { AudioContext } from './types/Audio';

/**
 * Game settings structure controlling gameplay mechanics and UI
 */
export interface GameSettings {
  theme: string;
  sphereSize: number;
  sphereWeight: number;
  sphereAccel: number;
  collisionBounce: number;
  arenaSize: number;
  musicVolume: number;
  sfxVolume: number;
  particleAmount: number;
  destructionRate: number;
  iceRate: number;
  portalRate: number;
  portalCooldown: number;
  bonusRate: number;
  bonusDuration: number;
  bloomLevel: number;
  boostRegenSpeed: number;
  boostDrainRate: number;
  playerAuraSize: number;
  playerAuraOpacity: number;
  playerGlowIntensity: number;
  playerGlowRange: number;
  autoRestart: boolean;
  controls: {
    p1: { up: string; down: string; left: string; right: string; boost: string };
    p2: { up: string; down: string; left: string; right: string; boost: string };
  };
  activePowerUps: Record<string, Array<{ type: string; startTime: number; duration: number }>>;
}

/**
 * Online multiplayer state
 */
export interface OnlineState {
  connected: boolean;
  serverUrl: string;
  playerId: string | null;
  currentGame: any; // TODO: type this with game session interface
  games: any[];
  isHost: boolean;
  playerSlot: number | null;
  opponentConnected: boolean;
  opponentInput: InputPayload | null;
  opponentName: string;
  myName: string;
}

/**
 * Tile effect tracking for visual effects
 */
export interface TileEffect {
  id: string;
  type: string;
  position: { x: number; y: number };
  startTime: number;
  duration: number;
}

/**
 * Complete game store state
 */
export interface GameStoreState {
  // Core game state
  gameState: string; // 'MENU', 'GAME_MODE_SELECT', 'DIFFICULTY_SELECT', 'NAME_ENTRY', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'ONLINE'
  gameMode: GameMode | string; // '1P', '2P', 'ONLINE', 'AI'
  difficulty: Difficulty | string;
  winner: string | null;
  p1Score: number;
  p2Score: number;
  player1Boost: number;
  player2Boost: number;
  activeTileEffects: TileEffect[];
  p1Name: string;
  p2Name: string;

  // Online state
  online: OnlineState;

  // Settings
  settings: GameSettings;

  // Typed game context (from types/Game.ts)
  entities?: EntityMap;
  arena?: ArenaBounds | null;
  audioContext?: AudioContext;
}

/**
 * Store actions for all state mutations
 */
export interface StoreActions {
  updateSetting(key: keyof GameSettings, value: any): void;
  resetSettings(): void;
  setPlayerNames(p1Name: string, p2Name: string): void;
  setGameMode(mode: GameMode | string): void;
  setDifficulty(diff: Difficulty | string): void;
  enterNameEntry(): void;
  startGame(): void;
  startRound(): void;
  resetScores(): void;
  setPlaying(): void;
  returnToMenu(): void;
  endRound(winner: string): void;
  updateBoost(player: 'player1' | 'player2', amount: number): void;
  addTileEffect(effect: TileEffect): void;
  removeTileEffect(effectId: string): void;
  
  // Online actions
  setOnlineConnected(connected: boolean, serverUrl?: string): void;
  setOnlinePlayerId(playerId: string): void;
  setOnlineGames(games: any[]): void;
  setOnlineCurrentGame(game: any): void;
  setOnlineHost(isHost: boolean): void;
  setOnlinePlayerSlot(slot: number | null): void;
  setOnlineOpponentConnected(connected: boolean): void;
  setOnlineOpponentInput(input: InputPayload | null): void;
  setOnlineOpponentName(name: string): void;
  setOnlineMyName(name: string): void;
  enterOnlineLobby(): void;
  setOnlineName(name: string): void;
  resetOnlineState(): void;
}

/**
 * Complete typed Zustand store
 */
export type GameStore = GameStoreState & StoreActions;

const defaultSettings: GameSettings = {
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
    p2: {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      boost: 'ShiftRight',
    },
  },
  activePowerUps: {},
};

const savedSettings = (() => {
  try {
    const stored = localStorage.getItem('dropfall_settings');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
})();

const mergedSettings: GameSettings = { ...defaultSettings, ...savedSettings };

/**
 * Zustand store for all game and UI state
 * Uses persist middleware to save settings and selections to localStorage
 */
export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      // Core game state
      gameState: 'MENU',
      gameMode: (localStorage.getItem('dropfall_gamemode') || '2P') as GameMode | string,
      difficulty: (localStorage.getItem('dropfall_difficulty') || 'normal') as Difficulty | string,
      winner: null,
      p1Score: 0,
      p2Score: 0,
      player1Boost: 0,
      player2Boost: 0,
      activeTileEffects: [],
      p1Name: localStorage.getItem('dropfall_p1name') || 'Player 1',
      p2Name: localStorage.getItem('dropfall_p2name') || 'Player 2',

      // Online state
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

      // Settings actions
      updateSetting: (key, value) =>
        set((state) => {
          const newSettings = { ...state.settings, [key]: value };
          localStorage.setItem('dropfall_settings', JSON.stringify(newSettings));
          return { settings: newSettings };
        }),

      resetSettings: () => {
        localStorage.setItem('dropfall_settings', JSON.stringify(defaultSettings));
        return set({ settings: defaultSettings });
      },

      setPlayerNames: (p1Name, p2Name) => {
        localStorage.setItem('dropfall_p1name', p1Name);
        localStorage.setItem('dropfall_p2name', p2Name);
        return set({ p1Name, p2Name });
      },

      // Game mode actions
      setGameMode: (mode) =>
        set((state) => {
          localStorage.setItem('dropfall_gamemode', mode);
          const nextState = mode === '1P' ? 'DIFFICULTY_SELECT' : mode === 'ONLINE' ? 'MENU' : 'NAME_ENTRY';
          return { gameMode: mode, gameState: nextState };
        }),

      setDifficulty: (diff) => {
        localStorage.setItem('dropfall_difficulty', diff);
        return set({ difficulty: diff, gameState: 'NAME_ENTRY' });
      },

      // Game flow actions
      enterNameEntry: () => set({ gameState: 'NAME_ENTRY' }),

      startGame: () =>
        set({
          gameState: 'COUNTDOWN',
          winner: null,
          p1Score: 0,
          p2Score: 0,
          player1Boost: 0,
          player2Boost: 0,
          activeTileEffects: [],
        }),

      startRound: () =>
        set({
          gameState: 'COUNTDOWN',
          winner: null,
          activeTileEffects: [],
        }),

      resetScores: () =>
        set({
          p1Score: 0,
          p2Score: 0,
          player1Boost: 0,
          player2Boost: 0,
        }),

      setPlaying: () => set({ gameState: 'PLAYING' }),

      returnToMenu: () =>
        set({
          gameState: 'MENU',
          winner: null,
          p1Score: 0,
          p2Score: 0,
          player1Boost: 0,
          player2Boost: 0,
          activeTileEffects: [],
        }),

      endRound: (winner: string) =>
        set((state) => {
          let newP1Score = state.p1Score;
          let newP2Score = state.p2Score;

          if (winner === 'Player 1') newP1Score++;
          if (winner === 'Player 2') newP2Score++;

          if (newP1Score >= 3 || newP2Score >= 3) {
            return {
              gameState: 'GAME_OVER',
              winner: newP1Score >= 3 ? 'Player 1' : 'Player 2',
              p1Score: newP1Score,
              p2Score: newP2Score,
            };
          }

          return {
            gameState: 'ROUND_OVER',
            winner,
            p1Score: newP1Score,
            p2Score: newP2Score,
          };
        }),

      // Boost management
      updateBoost: (player, amount) =>
        set((state) => ({
          [`${player}Boost`]: Math.min(100, Math.max(0, state[`${player}Boost`] + amount)),
        })),

      // Tile effects
      addTileEffect: (effect: TileEffect) =>
        set((state) => ({
          activeTileEffects: [...state.activeTileEffects, effect],
        })),

      removeTileEffect: (effectId: string) =>
        set((state) => ({
          activeTileEffects: state.activeTileEffects.filter((e) => e.id !== effectId),
        })),

      // Online actions
      setOnlineConnected: (connected, serverUrl = '') =>
        set((state) => ({
          online: { ...state.online, connected, serverUrl },
        })),

      setOnlinePlayerId: (playerId: string) =>
        set((state) => ({
          online: { ...state.online, playerId },
        })),

      setOnlineGames: (games: any[]) =>
        set((state) => ({
          online: { ...state.online, games },
        })),

      setOnlineCurrentGame: (game: any) =>
        set((state) => ({
          online: { ...state.online, currentGame: game },
        })),

      setOnlineHost: (isHost: boolean) =>
        set((state) => ({
          online: { ...state.online, isHost },
        })),

      setOnlinePlayerSlot: (slot: number | null) =>
        set((state) => ({
          online: { ...state.online, playerSlot: slot },
        })),

      setOnlineOpponentConnected: (connected: boolean) =>
        set((state) => ({
          online: { ...state.online, opponentConnected: connected },
        })),

      setOnlineOpponentInput: (input: InputPayload | null) =>
        set((state) => ({
          online: { ...state.online, opponentInput: input },
        })),

      setOnlineOpponentName: (name: string) =>
        set((state) => ({
          online: { ...state.online, opponentName: name },
        })),

      setOnlineMyName: (name: string) =>
        set((state) => ({
          online: { ...state.online, myName: name },
        })),

      enterOnlineLobby: () => set({ gameState: 'ONLINE' }),

      setOnlineName: (name: string) =>
        set((state) => ({
          online: { ...state.online, myName: name },
        })),

      resetOnlineState: () =>
        set((state) => ({
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
          },
        })),
    }),
    {
      name: 'game-store',
      partialize: (state) => ({
        settings: state.settings,
        p1Name: state.p1Name,
        p2Name: state.p2Name,
        difficulty: state.difficulty,
        gameMode: state.gameMode,
      }),
    },
  ),
);

/**
 * Validation helper - validates store mutations align with schemas
 * Called by schema validation layer (Task 2) to ensure runtime safety
 */
export function validateStoreMutation(mutation: Partial<GameStoreState>): boolean {
  // Basic validation rules:
  // - gameMode must be one of: '1P', '2P', 'AI', 'ONLINE'
  // - gameState must be a valid string
  // - scores must be non-negative numbers
  // - boost values must be 0-100
  if (mutation.gameMode) {
    const validModes = ['1P', '2P', 'AI', 'ONLINE'];
    if (!validModes.includes(String(mutation.gameMode))) {
      throw new Error(`Invalid gameMode: ${mutation.gameMode}`);
    }
  }

  if (mutation.p1Score !== undefined && mutation.p1Score < 0) {
    throw new Error('p1Score cannot be negative');
  }

  if (mutation.p2Score !== undefined && mutation.p2Score < 0) {
    throw new Error('p2Score cannot be negative');
  }

  if (mutation.player1Boost !== undefined) {
    if (mutation.player1Boost < 0 || mutation.player1Boost > 100) {
      throw new Error('player1Boost must be 0-100');
    }
  }

  if (mutation.player2Boost !== undefined) {
    if (mutation.player2Boost < 0 || mutation.player2Boost > 100) {
      throw new Error('player2Boost must be 0-100');
    }
  }

  return true;
}
