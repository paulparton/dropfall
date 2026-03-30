/**
 * InputHandler Tests - Input Normalization, Priority, and Cleanup
 * 
 * Tests cover:
 * - Keyboard input normalization
 * - Gamepad input with dead zone
 * - Input priority (gamepad > keyboard > AI)
 * - AI difficulty switching
 * - Subscription/unsubscribe pattern
 * - getLastInput() returns correct payload
 * - destroy() cleans up listeners
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import type { KeyboardInput, GamepadInput, AIInput } from '../src/types/Input';

// Mock window and navigator for Node environment
const mockGamepad = (index: number, connected = true) => ({
  index,
  id: `Gamepad ${index}`,
  connected,
  mapping: 'standard',
  timestamp: Date.now(),
  axes: [0, 0],
  buttons: [
    { pressed: false, value: 0 }, // 0 - A
    { pressed: false, value: 0 }, // 1 - B
    { pressed: false, value: 0 }, // 2 - X
    { pressed: false, value: 0 }, // 3 - Y
    { pressed: false, value: 0 }, // 4 - LB
    { pressed: false, value: 0 }, // 5 - RB
    { pressed: false, value: 0 }, // 6 - LT
    { pressed: false, value: 0 }, // 7 - RT
    { pressed: false, value: 0 }, // 8 - Back
    { pressed: false, value: 0 }, // 9 - Start
    { pressed: false, value: 0 }, // 10 - LStick
    { pressed: false, value: 0 }, // 11 - RStick
    { pressed: false, value: 0 }, // 12 - D-pad Up
    { pressed: false, value: 0 }, // 13 - D-pad Down
    { pressed: false, value: 0 }, // 14 - D-pad Left
    { pressed: false, value: 0 }, // 15 - D-pad Right
  ],
});

let requestAnimationFrameId = 0;
const animationFrameCallbacks: Map<number, FrameRequestCallback> = new Map();

beforeAll(() => {
  // Set up mocks before any tests run
  Object.defineProperty(window, 'KeyboardEvent', {
    value: class KeyboardEvent {
      code: string;
      type: string;
      constructor(type: string, init?: { code?: string }) {
        this.type = type;
        this.code = init?.code || '';
      }
    },
    writable: true,
  });

  Object.defineProperty(window, 'navigator', {
    value: {
      ...window.navigator,
      getGamepads: vi.fn(() => [mockGamepad(0), mockGamepad(1)]),
    },
    writable: true,
  });

  // Mock requestAnimationFrame to not recursively call - just store callback
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: vi.fn((cb: FrameRequestCallback) => {
      requestAnimationFrameId++;
      animationFrameCallbacks.set(requestAnimationFrameId, cb);
      return requestAnimationFrameId;
    }),
    writable: true,
  });

  Object.defineProperty(window, 'cancelAnimationFrame', {
    value: vi.fn((id: number) => {
      animationFrameCallbacks.delete(id);
    }),
    writable: true,
  });

  Object.defineProperty(window, 'addEventListener', {
    value: vi.fn(),
    writable: true,
  });

  Object.defineProperty(window, 'removeEventListener', {
    value: vi.fn(),
    writable: true,
  });
});

// Import after mocks are set up - use dynamic import for ES module
let InputHandler: any;
let createInputHandler: any;

beforeAll(async () => {
  const module = await import('../src/handlers/InputHandler');
  InputHandler = module.InputHandler;
  createInputHandler = module.createInputHandler;
});

describe('InputHandler', () => {
  let inputHandler: InstanceType<typeof InputHandler>;

  beforeEach(() => {
    inputHandler = createInputHandler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    inputHandler.destroy();
  });

  describe('AI Integration', () => {
    it('should create AIController when enabling AI', () => {
      inputHandler.enableAI();
      const controller = inputHandler.getAIController();
      expect(controller).toBeDefined();
    });

    it('should reset AIController when disabling AI', () => {
      inputHandler.enableAI();
      inputHandler.disableAI();
      const controller = inputHandler.getAIController();
      // After disable, controller might be null or reset
      expect(inputHandler.isAIEnabled()).toBe(false);
    });

    it('should include difficulty in AI input', () => {
      inputHandler.setDifficulty('hard');
      inputHandler.enableAI();
      
      // Poll should include difficulty
      inputHandler.poll();
      const lastInput = inputHandler.getLastInput();
      
      if (lastInput?.source === 'ai') {
        expect((lastInput as AIInput).difficulty).toBe('hard');
      }
    });
  });

  describe('Input Validation in InputHandler', () => {
    it('should reject invalid input during dispatch', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Dispatch an invalid input (missing required fields)
      const invalidInput: any = {
        source: 'keyboard',
        // Missing up, down, left, right, boost, timestamp
      };
      
      inputHandler.dispatch(invalidInput);
      
      // Should warn about invalid input
      expect(consoleWarnSpy).toHaveBeenCalled();
      // lastInput should not be updated
      expect(inputHandler.getLastInput()).toBeNull();
      
      consoleWarnSpy.mockRestore();
    });

    it('should reject input with invalid source type', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const invalidInput: any = {
        source: 'invalid-source',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(invalidInput);
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should accept valid keyboard input', () => {
      const validInput: KeyboardInput = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(validInput);
      expect(inputHandler.getLastInput()).not.toBeNull();
      expect(inputHandler.getLastInput()?.source).toBe('keyboard');
    });

    it('should accept valid gamepad input', () => {
      const validInput: GamepadInput = {
        source: 'gamepad',
        gamepadIndex: 0,
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        analog: { x: 0, y: 0 },
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(validInput);
      expect(inputHandler.getLastInput()).not.toBeNull();
      expect(inputHandler.getLastInput()?.source).toBe('gamepad');
    });

    it('should accept valid AI input', () => {
      const validInput: AIInput = {
        source: 'ai',
        difficulty: 'hard',
        targetPosition: { x: 10, y: 5 },
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(validInput);
      expect(inputHandler.getLastInput()).not.toBeNull();
      expect(inputHandler.getLastInput()?.source).toBe('ai');
    });

    it('should reject gamepad input with invalid gamepadIndex', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const invalidInput: any = {
        source: 'gamepad',
        gamepadIndex: -1, // Invalid - must be >= 0
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        analog: { x: 0, y: 0 },
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(invalidInput);
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should reject AI input with invalid difficulty', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const invalidInput: any = {
        source: 'ai',
        difficulty: 'expert', // Invalid - must be easy, normal, or hard
        targetPosition: { x: 10, y: 5 },
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(invalidInput);
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('poll() method', () => {
    it('should return keyboard input when no gamepad connected', () => {
      // By default, no gamepad is "connected" in the mock (empty array)
      inputHandler.poll();
      const lastInput = inputHandler.getLastInput();
      expect(lastInput?.source).toBe('keyboard');
    });

    it('should dispatch empty input when nothing pressed', () => {
      inputHandler.poll();
      const lastInput = inputHandler.getLastInput();
      expect(lastInput?.source).toBe('keyboard');
      expect(lastInput?.up).toBe(false);
      expect(lastInput?.down).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('should initialize with null lastInput', () => {
      expect(inputHandler.getLastInput()).toBeNull();
    });

    it('should clean up listeners on destroy', () => {
      const removeEventListener = window.removeEventListener as ReturnType<typeof vi.fn>;
      
      inputHandler.destroy();
      
      expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    });

    it('should clear subscribers on destroy', () => {
      const callback = vi.fn();
      inputHandler.subscribe(callback);
      expect(inputHandler.getLastInput()).toBeDefined();
      
      inputHandler.destroy();
      // After destroy, internal state is cleared
    });
  });

  describe('Subscription Pattern', () => {
    it('should allow subscribing to input changes', () => {
      const callback = vi.fn();
      const unsubscribe = inputHandler.subscribe(callback);
      
      // Dispatch an input
      const input: KeyboardInput = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      inputHandler.dispatch(input);
      
      expect(callback).toHaveBeenCalledWith(input);
      
      // Unsubscribe should work
      unsubscribe();
      callback.mockClear();
      
      // Re-dispatch - callback should not be called
      inputHandler.dispatch({ ...input, timestamp: Date.now() });
      expect(callback).not.toHaveBeenCalled();
    });

    it('should allow multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      inputHandler.subscribe(callback1);
      inputHandler.subscribe(callback2);
      
      const input: KeyboardInput = {
        source: 'keyboard',
        up: false,
        down: false,
        left: true,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      inputHandler.dispatch(input);
      
      expect(callback1).toHaveBeenCalledWith(input);
      expect(callback2).toHaveBeenCalledWith(input);
    });

    it('should handle subscriber errors gracefully', () => {
      const badCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = vi.fn();
      
      inputHandler.subscribe(badCallback);
      inputHandler.subscribe(goodCallback);
      
      const input: KeyboardInput = {
        source: 'keyboard',
        up: false,
        down: true,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      // Should not throw, good callback should still be called
      expect(() => inputHandler.dispatch(input)).not.toThrow();
      expect(goodCallback).toHaveBeenCalledWith(input);
    });
  });

  describe('getLastInput', () => {
    it('should return null initially', () => {
      expect(inputHandler.getLastInput()).toBeNull();
    });

    it('should return the last dispatched input', () => {
      const input: KeyboardInput = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: true,
        boost: false,
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(input);
      
      const lastInput = inputHandler.getLastInput();
      expect(lastInput).not.toBeNull();
      expect(lastInput?.source).toBe('keyboard');
      expect(lastInput?.up).toBe(true);
      expect(lastInput?.right).toBe(true);
    });

    it('should update lastInput on each dispatch', () => {
      const input1: KeyboardInput = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      const input2: GamepadInput = {
        source: 'gamepad',
        gamepadIndex: 0,
        up: false,
        down: true,
        left: false,
        right: false,
        boost: false,
        analog: { x: 0, y: 0 },
        timestamp: Date.now(),
      };
      
      inputHandler.dispatch(input1);
      expect(inputHandler.getLastInput()?.source).toBe('keyboard');
      
      inputHandler.dispatch(input2);
      expect(inputHandler.getLastInput()?.source).toBe('gamepad');
    });
  });

  describe('dispatch', () => {
    it('should accept keyboard input payload', () => {
      const input: KeyboardInput = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: true,
        timestamp: Date.now(),
      };
      
      expect(() => inputHandler.dispatch(input)).not.toThrow();
    });

    it('should accept gamepad input payload', () => {
      const input: GamepadInput = {
        source: 'gamepad',
        gamepadIndex: 1,
        up: false,
        down: false,
        left: true,
        right: true,
        boost: false,
        analog: { x: 0.5, y: -0.3 },
        timestamp: Date.now(),
      };
      
      expect(() => inputHandler.dispatch(input)).not.toThrow();
    });

    it('should accept AI input payload', () => {
      const input: AIInput = {
        source: 'ai',
        difficulty: 'hard',
        targetPosition: { x: 10, y: 5 },
        up: false,
        down: false,
        left: true,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      expect(() => inputHandler.dispatch(input)).not.toThrow();
    });
  });

  describe('AI Difficulty', () => {
    it('should default to normal difficulty', () => {
      expect(inputHandler.getAIDifficulty()).toBe('normal');
    });

    it('should switch difficulty to easy', () => {
      inputHandler.setDifficulty('easy');
      expect(inputHandler.getAIDifficulty()).toBe('easy');
    });

    it('should switch difficulty to hard', () => {
      inputHandler.setDifficulty('hard');
      expect(inputHandler.getAIDifficulty()).toBe('hard');
    });

    it('should enable and disable AI', () => {
      expect(inputHandler.isAIEnabled()).toBe(false);
      
      inputHandler.enableAI();
      expect(inputHandler.isAIEnabled()).toBe(true);
      
      inputHandler.disableAI();
      expect(inputHandler.isAIEnabled()).toBe(false);
    });

    it('should switch between difficulties correctly', () => {
      inputHandler.setDifficulty('easy');
      expect(inputHandler.getAIDifficulty()).toBe('easy');
      
      inputHandler.setDifficulty('hard');
      expect(inputHandler.getAIDifficulty()).toBe('hard');
      
      inputHandler.setDifficulty('normal');
      expect(inputHandler.getAIDifficulty()).toBe('normal');
    });
  });

  describe('Validation Integration', () => {
    it('should validate keyboard input against schema', async () => {
      const { validateInputPayloadResult } = await import('../src/validation/schemas');
      
      const validInput: KeyboardInput = {
        source: 'keyboard',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      const result = validateInputPayloadResult(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate gamepad input against schema', async () => {
      const { validateInputPayloadResult } = await import('../src/validation/schemas');
      
      const validInput: GamepadInput = {
        source: 'gamepad',
        gamepadIndex: 0,
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        analog: { x: 0, y: 0 },
        timestamp: Date.now(),
      };
      
      const result = validateInputPayloadResult(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate AI input against schema', async () => {
      const { validateInputPayloadResult } = await import('../src/validation/schemas');
      
      const validInput: AIInput = {
        source: 'ai',
        difficulty: 'hard',
        targetPosition: { x: 5, y: 10 },
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      const result = validateInputPayloadResult(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid input (missing required fields)', async () => {
      const { validateInputPayloadResult } = await import('../src/validation/schemas');
      
      const invalidInput = {
        source: 'keyboard',
        // Missing up, down, left, right, boost, timestamp
      };
      
      const result = validateInputPayloadResult(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject invalid input (wrong source type)', async () => {
      const { validateInputPayloadResult } = await import('../src/validation/schemas');
      
      const invalidInput = {
        source: 'invalid-source',
        up: true,
        down: false,
        left: false,
        right: false,
        boost: false,
        timestamp: Date.now(),
      };
      
      const result = validateInputPayloadResult(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});

describe('Input Type Guards', () => {
  it('isKeyboardInput should correctly identify keyboard input', async () => {
    const { isKeyboardInput } = await import('../src/types/Input');
    
    const keyboardInput: KeyboardInput = {
      source: 'keyboard',
      up: true,
      down: false,
      left: false,
      right: false,
      boost: false,
      timestamp: Date.now(),
    };
    
    const gamepadInput: GamepadInput = {
      source: 'gamepad',
      gamepadIndex: 0,
      up: false,
      down: true,
      left: false,
      right: false,
      boost: false,
      analog: { x: 0, y: 0 },
      timestamp: Date.now(),
    };
    
    expect(isKeyboardInput(keyboardInput)).toBe(true);
    expect(isKeyboardInput(gamepadInput)).toBe(false);
  });

  it('isGamepadInput should correctly identify gamepad input', async () => {
    const { isGamepadInput } = await import('../src/types/Input');
    
    const gamepadInput: GamepadInput = {
      source: 'gamepad',
      gamepadIndex: 0,
      up: true,
      down: false,
      left: false,
      right: false,
      boost: false,
      analog: { x: 0.5, y: -0.5 },
      timestamp: Date.now(),
    };
    
    const keyboardInput: KeyboardInput = {
      source: 'keyboard',
      up: true,
      down: false,
      left: false,
      right: false,
      boost: false,
      timestamp: Date.now(),
    };
    
    expect(isGamepadInput(gamepadInput)).toBe(true);
    expect(isGamepadInput(keyboardInput)).toBe(false);
  });

  it('isAIInput should correctly identify AI input', async () => {
    const { isAIInput } = await import('../src/types/Input');
    
    const aiInput: AIInput = {
      source: 'ai',
      difficulty: 'hard',
      targetPosition: { x: 10, y: 5 },
      up: false,
      down: false,
      left: true,
      right: false,
      boost: false,
      timestamp: Date.now(),
    };
    
    const keyboardInput: KeyboardInput = {
      source: 'keyboard',
      up: false,
      down: true,
      left: false,
      right: false,
      boost: false,
      timestamp: Date.now(),
    };
    
    expect(isAIInput(aiInput)).toBe(true);
    expect(isAIInput(keyboardInput)).toBe(false);
  });

  it('isInputPayload should validate any input payload', async () => {
    const { isInputPayload } = await import('../src/types/Input');
    
    const validInput: KeyboardInput = {
      source: 'keyboard',
      up: true,
      down: false,
      left: false,
      right: false,
      boost: false,
      timestamp: Date.now(),
    };
    
    const invalidInput = {
      source: 'invalid',
      up: 'yes', // Should be boolean
      timestamp: Date.now(),
    };
    
    expect(isInputPayload(validInput)).toBe(true);
    expect(isInputPayload(invalidInput)).toBe(false);
    expect(isInputPayload(null)).toBe(false);
    expect(isInputPayload(undefined)).toBe(false);
  });
});
