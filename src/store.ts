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
  p1Hat: string;
  p2Hat: string;
  p1Color: number; // hex color code
  p2Color: number; // hex color code
  powerUpWeights: Record<string, number>;
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
  opponentColor: number | string | null;
  opponentHat: string | null;
  opponentName: string | null;
  myName: string;
  myReady: boolean;
  opponentReady: boolean;
  allReady: boolean;
  opponentDisconnected: boolean;
  rematchRequested: boolean;
  opponentRematchRequested: boolean;
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

export interface PlayerRaceState {
  currentLap: number;
  lastCheckpointId: number;
  checkpointsBitmask: number;
  lapTimes: number[];
  finished: boolean;
  finishTime: number | null;
}

export interface RaceState {
  active: boolean;
  totalLaps: number;
  checkpointCount: number;
  raceStartTime: number | null;
  elapsedTime: number;
  player1: PlayerRaceState;
  player2: PlayerRaceState;
  winner: 'player1' | 'player2' | null;
}

export interface RaceModePlayerState {
  currentCheckpoint: number;
  lap: number;
  checkpointsPassed: number[];
  finished: boolean;
  finishTime: number | null;
}

export interface RaceModeState {
  p1: RaceModePlayerState;
  p2: RaceModePlayerState;
}

/**
 * Complete game store state
 */
export interface GameStoreState {
  // Core game state
  gameState: string; // 'MENU', 'GAME_MODE_SELECT', 'DIFFICULTY_SELECT', 'NAME_ENTRY', 'CUSTOMIZATION', 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'ONLINE', 'ONLINE_SETUP'
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
  p1Hat: string;
  p2Hat: string;
  p1Color: number | string;
  p2Color: number | string;
  selectedLevelId: string | null;
  selectedLevelData: Record<string, any> | null;
  race: RaceState | null;
  raceMode: boolean;
  raceLaps: number;
  raceState: RaceModeState;
  raceStartTime: number | null;
  raceWinner: 'p1' | 'p2' | null;

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
  setPlayerHats(p1Hat: string, p2Hat: string): void;
  setPlayerColors(p1Color: number | string, p2Color: number | string): void;
  setSelectedLevel(id: string | null, data: Record<string, any> | null): void;
  setGameState(state: string): void;
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
  initRace(totalLaps: number, checkpointCount: number): void;
  updatePlayerCheckpoint(playerId: 'player1' | 'player2', checkpointId: number): void;
  completePlayerLap(playerId: 'player1' | 'player2', lapTime: number): void;
  finishPlayerRace(playerId: 'player1' | 'player2', finishTime: number): void;
  updateRaceTime(elapsed: number): void;
  endRace(winner: string): void;
  resetRace(): void;
  setRaceMode(enabled: boolean, laps?: number): void;
  passCheckpoint(player: 'p1' | 'p2', checkpointId: number, totalCheckpoints: number): void;
  resetRaceState(): void;
  
  // Online actions
  setOnlineConnected(connected: boolean, serverUrl?: string): void;
  setOnlinePlayerId(playerId: string): void;
  setOnlineGames(games: any[]): void;
  setOnlineCurrentGame(game: any): void;
  setOnlineHost(isHost: boolean): void;
  setOnlinePlayerSlot(slot: number | null): void;
  setOnlineOpponentConnected(connected: boolean): void;
  setOnlineOpponentInput(input: InputPayload | null): void;
  setOnlineOpponentName(name: string | null): void;
  setOnlineOpponentCustomization(color: number | string | null, hat: string | null, name: string | null): void;
  setOnlineMyName(name: string): void;
  setOnlineReady(ready: boolean): void;
  setOnlineOpponentReady(ready: boolean): void;
  setOnlineAllReady(allReady: boolean): void;
  setOpponentDisconnected(disconnected: boolean): void;
  setRematchRequested(requested: boolean): void;
  setOpponentRematchRequested(requested: boolean): void;
  resetOnlineSetupState(): void;
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
  p1Hat: localStorage.getItem('dropfall_p1hat') || 'none',
  p2Hat: localStorage.getItem('dropfall_p2hat') || 'none',
  p1Color: parseInt(localStorage.getItem('dropfall_p1color')?.replace(/^0x/, '') || 'ff0000', 16),
  p2Color: parseInt(localStorage.getItem('dropfall_p2color')?.replace(/^0x/, '') || '0000ff', 16),
  powerUpWeights: {
    ACCELERATION_BOOST: 50,
    SIZE_REDUCTION: 50,
    WEIGHT_INCREASE: 50,
    SPEED_BURST: 50,
    LIGHT_TOUCH: 50,
    SIZE_INCREASE: 50,
    GRIP_BOOST: 50,
    INVULNERABILITY: 50
  },
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

const savedP1Color = localStorage.getItem('dropfall_p1color') || 'ff0000';
const p1Color: number | string = savedP1Color.startsWith('pattern:')
  ? savedP1Color
  : parseInt(savedP1Color.replace(/^0x/, ''), 16);

const savedP2Color = localStorage.getItem('dropfall_p2color') || '0000ff';
const p2Color: number | string = savedP2Color.startsWith('pattern:')
  ? savedP2Color
  : parseInt(savedP2Color.replace(/^0x/, ''), 16);

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
} as const;

const createDefaultPlayerRaceState = (): PlayerRaceState => ({
  currentLap: 0,
  lastCheckpointId: -1,
  checkpointsBitmask: 0,
  lapTimes: [],
  finished: false,
  finishTime: null,
});

const createRaceState = (totalLaps: number, checkpointCount: number): RaceState => ({
  active: true,
  totalLaps,
  checkpointCount,
  raceStartTime: Date.now(),
  elapsedTime: 0,
  player1: createDefaultPlayerRaceState(),
  player2: createDefaultPlayerRaceState(),
  winner: null,
});

const createDefaultRaceModePlayerState = (): RaceModePlayerState => ({
  currentCheckpoint: 0,
  lap: 0,
  checkpointsPassed: [],
  finished: false,
  finishTime: null,
});

const createDefaultRaceModeState = (): RaceModeState => ({
  p1: createDefaultRaceModePlayerState(),
  p2: createDefaultRaceModePlayerState(),
});

/**
 * Zustand store for all game and UI state
 * Uses persist middleware to save settings and selections to localStorage
 */
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
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
      p1Hat: localStorage.getItem('dropfall_p1hat') || 'none',
      p2Hat: localStorage.getItem('dropfall_p2hat') || 'none',
      p1Color,
      p2Color,
      selectedLevelId: null,
      selectedLevelData: null,
      race: null,
      raceMode: false,
      raceLaps: 3,
      raceState: createDefaultRaceModeState(),
      raceStartTime: null,
      raceWinner: null,

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
        opponentName: null,
        myName: '',
        ...defaultOnlineSetupState,
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

      setPlayerHats: (p1Hat, p2Hat) => {
        localStorage.setItem('dropfall_p1hat', p1Hat);
        localStorage.setItem('dropfall_p2hat', p2Hat);
        return set((state: GameStore) => ({ 
          p1Hat,
          p2Hat,
          settings: { ...state.settings, p1Hat, p2Hat }
        }));
      },

      setPlayerColors: (p1Color: number | string, p2Color: number | string) => {
        localStorage.setItem('dropfall_p1color', typeof p1Color === 'string' ? p1Color : p1Color.toString(16));
        localStorage.setItem('dropfall_p2color', typeof p2Color === 'string' ? p2Color : p2Color.toString(16));
        return set({ p1Color, p2Color });
      },

      setSelectedLevel: (id: string | null, data: Record<string, any> | null) => {
        return set({ selectedLevelId: id, selectedLevelData: data });
      },

      setGameState: (gameState: string) => {
        return set({ gameState });
      },

      // Game mode actions
      setGameMode: (mode) =>
        set((state) => {
          localStorage.setItem('dropfall_gamemode', mode);
          // For all modes, go directly to NAME_ENTRY (game settings) where difficulty is selected for 1P
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

      setDifficulty: (diff) => {
        localStorage.setItem('dropfall_difficulty', diff);
        return set({ difficulty: diff, gameState: 'NAME_ENTRY' });
      },

      // Game flow actions
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

      startRound: () =>
        set({
          gameState: 'COUNTDOWN',
          winner: null,
          activeTileEffects: [],
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

      setPlaying: () => set({ gameState: 'PLAYING' }),

      returnToMenu: () => {
        get().resetRace();
        get().resetRaceState();
        set({
          gameState: 'MENU',
          winner: null,
          p1Score: 0,
          p2Score: 0,
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
          },
        });
      },

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

      initRace: (totalLaps: number, checkpointCount: number) =>
        set({
          race: createRaceState(totalLaps, checkpointCount),
        }),

      updatePlayerCheckpoint: (playerId: 'player1' | 'player2', checkpointId: number) =>
        set((state) => {
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

      completePlayerLap: (playerId: 'player1' | 'player2', lapTime: number) =>
        set((state) => {
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

      finishPlayerRace: (playerId: 'player1' | 'player2', finishTime: number) =>
        set((state) => {
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

      updateRaceTime: (elapsed: number) =>
        set((state) => ({
          race: state.race
            ? {
                ...state.race,
                elapsedTime: elapsed,
              }
            : null,
        })),

      endRace: (winner: string) =>
        set((state) => ({
          race: state.race
            ? {
                ...state.race,
                winner: winner as 'player1' | 'player2',
                active: false,
              }
            : null,
        })),

      resetRace: () => set({ race: null }),

      setRaceMode: (enabled: boolean, laps = 3) => {
        const safeLaps = Number.isFinite(laps) ? Math.max(1, Math.floor(laps)) : 3;
        set({
          raceMode: enabled,
          raceLaps: safeLaps,
          raceState: createDefaultRaceModeState(),
          raceStartTime: null,
          raceWinner: null,
        });
      },

      passCheckpoint: (player: 'p1' | 'p2', checkpointId: number, totalCheckpoints: number) =>
        set((state) => {
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

      resetRaceState: () =>
        set({
          raceState: createDefaultRaceModeState(),
          raceStartTime: null,
          raceWinner: null,
        }),

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

      setOnlineOpponentName: (name: string | null) =>
        set((state) => ({
          online: { ...state.online, opponentName: name },
        })),

      setOnlineOpponentCustomization: (color: number | string | null, hat: string | null, name: string | null) =>
        set((state) => ({
          online: {
            ...state.online,
            opponentColor: color,
            opponentHat: hat,
            opponentName: name,
          },
        })),

      setOnlineMyName: (name: string) =>
        set((state) => ({
          online: { ...state.online, myName: name },
        })),

      setOnlineReady: (ready: boolean) =>
        set((state) => ({
          online: { ...state.online, myReady: ready },
        })),

      setOnlineOpponentReady: (ready: boolean) =>
        set((state) => ({
          online: { ...state.online, opponentReady: ready },
        })),

      setOnlineAllReady: (allReady: boolean) =>
        set((state) => ({
          online: { ...state.online, allReady },
        })),

      setOpponentDisconnected: (disconnected: boolean) =>
        set((state) => ({
          online: { ...state.online, opponentDisconnected: disconnected },
        })),

      setRematchRequested: (requested: boolean) =>
        set((state) => ({
          online: { ...state.online, rematchRequested: requested },
        })),

      setOpponentRematchRequested: (requested: boolean) =>
        set((state) => ({
          online: { ...state.online, opponentRematchRequested: requested },
        })),

      resetOnlineSetupState: () =>
        set((state) => ({
          online: { ...state.online, ...defaultOnlineSetupState },
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
            opponentName: null,
            myName: '',
            ...defaultOnlineSetupState,
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
