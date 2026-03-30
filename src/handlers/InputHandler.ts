/**
 * InputHandler - Unified input manager for keyboard, gamepad, and AI input
 * 
 * Normalizes all input sources into InputPayload types.
 * Implements subscriber pattern for input events.
 * Source priority: gamepad > keyboard > AI
 * 
 * @example
 * ```typescript
 * const handler = createInputHandler();
 * 
 * handler.subscribe((input) => {
 *   console.log('Input received:', input.source);
 * });
 * 
 * // In game loop:
 * handler.poll();
 * 
 * const lastInput = handler.getLastInput();
 * // Use lastInput for player movement
 * 
 * handler.destroy();
 * ```
 */

import type { 
  InputPayload, 
  KeyboardInput, 
  GamepadInput, 
  AIInput,
  InputHandler as IInputHandler 
} from '../types/Input';
import { validateInputPayload } from '../validation/schemas';
import { AIController } from '../ai/AIController.js';

/**
 * Keyboard key state tracking
 */
interface KeyboardState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}

/**
 * Gamepad state for a single controller
 */
interface GamepadState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  analog: { x: number; y: number };
}

/**
 * Default key bindings for player input
 */
const DEFAULT_KEY_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  boost: ['Space'],
};

/**
 * Default control configuration from store
 */
const DEFAULT_CONTROLS = {
  up: 'KeyW',
  down: 'KeyS', 
  left: 'KeyA',
  right: 'KeyD',
  boost: 'Space',
};

/**
 * InputHandler - Manages all input sources with priority handling
 * 
 * Priority order: gamepad > keyboard > AI
 * 
 * @remarks
 * - Keyboard and gamepad are automatically polled
 * - AI is toggled via enableAI()/disableAI()
 * - poll() must be called each frame to update input state
 */
export class InputHandler implements IInputHandler {
  /** Subscribers to input changes */
  private subscribers: Set<(input: InputPayload) => void> = new Set();
  
  /** Most recent input payload */
  private _lastInput: InputPayload | null = null;
  
  /** Keyboard state */
  private keyboardState: KeyboardState = {
    up: false,
    down: false,
    left: false,
    right: false,
    boost: false,
  };
  
  /** Keyboard key mapping */
  private keyBindings: Record<string, string[]> = { ...DEFAULT_KEY_BINDINGS };
  
  /** Gamepad states for up to 2 controllers */
  private gamepadState: GamepadState[] = [
    { up: false, down: false, left: false, right: false, boost: false, analog: { x: 0, y: 0 } },
    { up: false, down: false, left: false, right: false, boost: false, analog: { x: 0, y: 0 } },
  ];
  
  /** Gamepad dead zone and threshold from input.js */
  private readonly DEAD_ZONE = 0.15;
  private readonly ANALOG_THRESHOLD = 0.30;
  
  /** AI controller instance */
  private aiController: AIController | null = null;
  
  /** AI enabled flag */
  private aiEnabled = false;
  
  /** AI difficulty level */
  private aiDifficulty: 'easy' | 'normal' | 'hard' = 'normal';
  
  /** Track if event listeners are attached */
  private listenersAttached = false;
  
  /** Gamepad polling animation frame ID */
  private gamepadPollId: number | null = null;
  
  /**
   * Creates a new InputHandler instance
   */
  constructor() {
    this.attachListeners();
    this.startGamepadPolling();
  }

  /**
   * Attach keyboard and gamepad event listeners
   */
  private attachListeners(): void {
    if (this.listenersAttached) return;
    
    // Keyboard listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // Gamepad connection listeners
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    
    this.listenersAttached = true;
  }

  /**
   * Remove event listeners
   */
  private detachListeners(): void {
    if (!this.listenersAttached) return;
    
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    
    if (this.gamepadPollId !== null) {
      cancelAnimationFrame(this.gamepadPollId);
      this.gamepadPollId = null;
    }
    
    this.listenersAttached = false;
  }

  /**
   * Handle key down events
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, true);
  };

  /**
   * Handle key up events
   */
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.updateKeyState(e.code, false);
  };

  /**
   * Update keyboard state based on key code
   */
  private updateKeyState(code: string, pressed: boolean): void {
    const bindings = this.keyBindings;
    const upKeys = bindings.up ?? [];
    const downKeys = bindings.down ?? [];
    const leftKeys = bindings.left ?? [];
    const rightKeys = bindings.right ?? [];
    const boostKeys = bindings.boost ?? [];
    
    if (upKeys.some(key => key === code)) {
      this.keyboardState.up = pressed;
    }
    if (downKeys.some(key => key === code)) {
      this.keyboardState.down = pressed;
    }
    if (leftKeys.some(key => key === code)) {
      this.keyboardState.left = pressed;
    }
    if (rightKeys.some(key => key === code)) {
      this.keyboardState.right = pressed;
    }
    if (boostKeys.some(key => key === code)) {
      this.keyboardState.boost = pressed;
    }
  }

  /**
   * Handle gamepad connection
   */
  private handleGamepadConnected = (e: GamepadEvent): void => {
    const gp = e.gamepad;
    console.log(`[InputHandler] Gamepad connected: ${gp.id} (index ${gp.index})`);
    // Reset state for the connected gamepad
    if (gp.index < 2) {
      this.gamepadState[gp.index] = {
        up: false, down: false, left: false, right: false, 
        boost: false, analog: { x: 0, y: 0 }
      };
    }
  };

  /**
   * Handle gamepad disconnection
   */
  private handleGamepadDisconnected = (e: GamepadEvent): void => {
    const gp = e.gamepad;
    console.log(`[InputHandler] Gamepad disconnected: index ${gp.index})`);
    // Reset state for the disconnected gamepad
    if (gp.index < 2) {
      this.gamepadState[gp.index] = {
        up: false, down: false, left: false, right: false, 
        boost: false, analog: { x: 0, y: 0 }
      };
    }
  };

  /**
   * Apply dead zone to analog value
   */
  private applyDeadZone(value: number): number {
    if (Math.abs(value) < this.DEAD_ZONE) return 0;
    return (Math.abs(value) - this.DEAD_ZONE) / (1 - this.DEAD_ZONE) * Math.sign(value);
  }

  /**
   * Start gamepad polling loop
   */
  private startGamepadPolling(): void {
    const poll = (): void => {
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        
        for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
          const gp = pads[playerIdx];
          
          if (gp && gp.connected) {
            // Get raw axis values
            const rawLx = gp.axes && gp.axes.length > 0 ? (gp.axes[0] || 0) : 0;
            const rawLy = gp.axes && gp.axes.length > 1 ? (gp.axes[1] || 0) : 0;
            
            // Apply dead zone
            const lx = this.applyDeadZone(rawLx);
            const ly = this.applyDeadZone(rawLy);
            
            // Get current gamepad state with fallback
            const state = this.gamepadState[playerIdx] ?? {
              up: false, down: false, left: false, right: false, 
              boost: false, analog: { x: 0, y: 0 }
            };
            
            // Update digital button states from analog
            state.left = lx < -this.ANALOG_THRESHOLD || (gp.buttons[14]?.pressed ?? false);
            state.right = lx > this.ANALOG_THRESHOLD || (gp.buttons[15]?.pressed ?? false);
            state.up = ly < -this.ANALOG_THRESHOLD || (gp.buttons[12]?.pressed ?? false);
            state.down = ly > this.ANALOG_THRESHOLD || (gp.buttons[13]?.pressed ?? false);
            
            // Boost: any face button, shoulder button, or trigger
            const hasBoost = (
              gp.buttons[0]?.pressed ||
              gp.buttons[1]?.pressed ||
              gp.buttons[2]?.pressed ||
              gp.buttons[3]?.pressed ||
              gp.buttons[4]?.pressed ||
              gp.buttons[5]?.pressed ||
              gp.buttons[6]?.pressed ||
              gp.buttons[7]?.pressed
            );
            state.boost = !!hasBoost;
            
            // Store analog values
            state.analog = { x: lx, y: ly };
            
            // Update the state in the array
            this.gamepadState[playerIdx] = state;
          } else {
            // Reset state for disconnected or missing gamepad
            this.gamepadState[playerIdx] = {
              up: false, down: false, left: false, right: false, 
              boost: false, analog: { x: 0, y: 0 }
            };
          }
        }
      } catch (e) {
        console.error('[InputHandler] Error polling gamepads:', e);
      }
      
      this.gamepadPollId = requestAnimationFrame(poll);
    };
    
    poll();
  }

  /**
   * Subscribe to input changes
   */
  subscribe(callback: (input: InputPayload) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Dispatch a new input state manually
   */
  dispatch(input: InputPayload): void {
    // Validate input payload before dispatching
    try {
      const validationResult = validateInputPayload(input);
      if (!validationResult.success) {
        console.warn('[InputHandler] Invalid input payload:', validationResult.error);
        return; // Skip invalid input
      }
    } catch (error) {
      console.warn('[InputHandler] Input validation error:', error);
      return; // Skip invalid input
    }
    
    this._lastInput = input;
    this.notifySubscribers(input);
  }

  /**
   * Get the most recent input
   */
  getLastInput(): InputPayload | null {
    return this._lastInput;
  }

  /**
   * Poll all input sources and dispatch the highest priority input
   * 
   * Call this once per frame in the game loop
   * Priority: gamepad > keyboard > AI
   */
  poll(): void {
    // Priority 1: Gamepad (player 1)
    if (this.hasGamepadInput(0)) {
      const input = this.createGamepadInput(0);
      this.dispatch(input);
      return;
    }

    // Priority 2: Keyboard
    if (this.hasKeyboardInput()) {
      const input = this.createKeyboardInput();
      this.dispatch(input);
      return;
    }

    // Priority 3: AI (if enabled)
    if (this.aiEnabled && this.aiController) {
      // AI needs update parameters - these would come from game state
      // For now, create a basic AI input based on controller state
      const aiInput = this.aiController.getInput();
      const input: AIInput = {
        source: 'ai',
        difficulty: this.aiDifficulty,
        targetPosition: { x: 0, y: 0 }, // Would be set by AI controller update
        up: aiInput.forward,
        down: aiInput.backward,
        left: aiInput.left,
        right: aiInput.right,
        boost: aiInput.boost,
        timestamp: Date.now(),
      };
      this.dispatch(input);
      return;
    }

    // No input available - dispatch null/empty state
    const input: KeyboardInput = {
      source: 'keyboard',
      up: false,
      down: false,
      left: false,
      right: false,
      boost: false,
      timestamp: Date.now(),
    };
    this.dispatch(input);
  }

  /**
   * Check if gamepad has active input
   */
  private hasGamepadInput(playerIndex: number): boolean {
    if (playerIndex >= this.gamepadState.length) return false;
    const state = this.gamepadState[playerIndex] ?? {
      up: false, down: false, left: false, right: false, 
      boost: false, analog: { x: 0, y: 0 }
    };
    return state.up || state.down || state.left || state.right || state.boost;
  }

  /**
   * Check if keyboard has active input
   */
  private hasKeyboardInput(): boolean {
    const state = this.keyboardState;
    return state.up || state.down || state.left || state.right || state.boost;
  }

  /**
   * Create keyboard input payload
   */
  private createKeyboardInput(): KeyboardInput {
    return {
      source: 'keyboard',
      up: this.keyboardState.up,
      down: this.keyboardState.down,
      left: this.keyboardState.left,
      right: this.keyboardState.right,
      boost: this.keyboardState.boost,
      timestamp: Date.now(),
    };
  }

  /**
   * Create gamepad input payload
   */
  private createGamepadInput(playerIndex: number): GamepadInput {
    const state = this.gamepadState[playerIndex] ?? {
      up: false, down: false, left: false, right: false, 
      boost: false, analog: { x: 0, y: 0 }
    };
    return {
      source: 'gamepad',
      gamepadIndex: playerIndex,
      up: state.up,
      down: state.down,
      left: state.left,
      right: state.right,
      boost: state.boost,
      analog: { ...state.analog },
      timestamp: Date.now(),
    };
  }

  /**
   * Update AI controller with game state
   * 
   * @param playerPos - Human player world position
   * @param npcPos - AI NPC world position
   * @param playerVel - Human player velocity
   * @param arenaCenter - Arena center coordinates
   * @param arenaRadius - Arena radius in world units
   * @param deltaTime - Time since last frame
   * @param gameState - Current game state from store
   */
  updateAI(
    playerPos: { x: number; y: number; z?: number },
    npcPos: { x: number; y: number; z?: number },
    playerVel: { x?: number; y?: number; z?: number },
    arenaCenter: { x: number; z: number },
    arenaRadius: number,
    deltaTime: number,
    gameState?: Record<string, unknown>
  ): void {
    if (!this.aiController) return;
    
    // Convert 3D positions to format expected by AIController
    const playerPos3D = { x: playerPos.x, y: playerPos.y, z: playerPos.z || 0 };
    const npcPos3D = { x: npcPos.x, y: npcPos.y, z: npcPos.z || 0 };
    const playerVel3D = playerVel as { x: number; y: number; z: number };
    
    this.aiController.update(
      playerPos3D,
      npcPos3D,
      playerVel3D,
      null, // npcVel not needed
      arenaCenter,
      arenaRadius,
      deltaTime,
      gameState || {}
    );
  }

  /**
   * Set AI difficulty level
   * 
   * @param difficulty - 'easy', 'normal', or 'hard'
   */
  setDifficulty(difficulty: 'easy' | 'normal' | 'hard'): void {
    this.aiDifficulty = difficulty;
    if (this.aiController) {
      this.aiController.setDifficulty(difficulty);
    }
  }

  /**
   * Enable AI input
   */
  enableAI(): void {
    if (!this.aiController) {
      this.aiController = new AIController(this.aiDifficulty);
    }
    this.aiEnabled = true;
  }

  /**
   * Disable AI input
   */
  disableAI(): void {
    this.aiEnabled = false;
    if (this.aiController) {
      this.aiController.reset();
    }
  }

  /**
   * Check if AI is currently enabled
   */
  isAIEnabled(): boolean {
    return this.aiEnabled;
  }

  /**
   * Get current AI difficulty
   */
  getAIDifficulty(): 'easy' | 'normal' | 'hard' {
    return this.aiDifficulty;
  }

  /**
   * Get the AI controller instance (for testing)
   */
  getAIController(): AIController | null {
    return this.aiController;
  }

  /**
   * Notify all subscribers of new input
   */
  private notifySubscribers(input: InputPayload): void {
    for (const callback of this.subscribers) {
      try {
        callback(input);
      } catch (e) {
        console.error('[InputHandler] Subscriber error:', e);
      }
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.detachListeners();
    this.subscribers.clear();
    this._lastInput = null;
    this.aiController = null;
    this.aiEnabled = false;
  }
}

/**
 * Factory function to create InputHandler instance
 */
export function createInputHandler(): InputHandler {
  return new InputHandler();
}
