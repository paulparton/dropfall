
import { useGameStore } from './store.js';

export const keys = {};

// Robust gamepad state
const gamepadState = [
    { up: false, down: false, left: false, right: false, boost: false },
    { up: false, down: false, left: false, right: false, boost: false }
];

// Mobile touch state
const touchState = [
    { up: false, down: false, left: false, right: false, boost: false },
    { up: false, down: false, left: false, right: false, boost: false }
];

let initialized = false;

export function initInput() {
    if (initialized) return;
    initialized = true;

    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Mobile touch controls
    initTouchControls();

    // Gamepad connection listeners
    window.addEventListener('gamepadconnected', (e) => {
        const gp = e.gamepad;
        console.log(`Gamepad connected at index ${gp.index}: ${gp.id}`);
        console.log(`  - Buttons: ${gp.buttons.length}`);
        console.log(`  - Axes: ${gp.axes.length}`);
        console.log(`  - Mapping: ${gp.mapping}`);
        // Reset the gamepad state for this index when connecting
        if (gp.index < 2) {
            gamepadState[gp.index] = { up: false, down: false, left: false, right: false, boost: false };
        }
    });
    window.addEventListener('gamepaddisconnected', (e) => {
        console.log(`Gamepad disconnected from index ${e.gamepad.index}`);
        // Reset the gamepad state for this index when disconnecting
        if (e.gamepad.index < 2) {
            gamepadState[e.gamepad.index] = { up: false, down: false, left: false, right: false, boost: false };
        }
    });

    // Start robust polling loop for all controllers
    pollGamepadInputs();
}

// Global polling state
let pollGamepadLoopId = null;

function pollGamepadInputs() {
    // Dead zone to prevent analog stick drift
    const ANALOG_THRESHOLD = 0.30;
    const DEAD_ZONE = 0.15;
    
    function applyDeadZone(value) {
        if (Math.abs(value) < DEAD_ZONE) return 0;
        // Scale the value back to 0-1 range after dead zone
        return (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE) * Math.sign(value);
    }
    
    function update() {
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            
            // Map gamepads directly by index: player 1 uses gamepad 0, player 2 uses gamepad 1
            for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
                const gp = pads[playerIdx];
                
                if (gp && gp.connected) {
                    // Left stick axes: 0=left/right, 1=up/down (standard mapping)
                    // Apply dead zone to prevent stick drift
                    const rawLx = gp.axes && gp.axes.length > 0 ? (gp.axes[0] || 0) : 0;
                    const rawLy = gp.axes && gp.axes.length > 1 ? (gp.axes[1] || 0) : 0;
                    
                    const lx = applyDeadZone(rawLx);
                    const ly = applyDeadZone(rawLy);
                    
                    gamepadState[playerIdx].left = lx < -ANALOG_THRESHOLD || (gp.buttons[14] && gp.buttons[14].pressed);
                    gamepadState[playerIdx].right = lx > ANALOG_THRESHOLD || (gp.buttons[15] && gp.buttons[15].pressed);
                    gamepadState[playerIdx].up = ly < -ANALOG_THRESHOLD || (gp.buttons[12] && gp.buttons[12].pressed);
                    gamepadState[playerIdx].down = ly > ANALOG_THRESHOLD || (gp.buttons[13] && gp.buttons[13].pressed);
                    
                    // Boost: A/Cross (0), B/Circle (1), X/Square (2), Y/Triangle (3), LB/L1 (4), RB/R1 (5), LT/L2 (6), RT/R2 (7)
                    const hasBoost = (gp.buttons[0] && gp.buttons[0].pressed) ||
                                     (gp.buttons[1] && gp.buttons[1].pressed) ||
                                     (gp.buttons[2] && gp.buttons[2].pressed) ||
                                     (gp.buttons[3] && gp.buttons[3].pressed) ||
                                     (gp.buttons[4] && gp.buttons[4].pressed) ||
                                     (gp.buttons[5] && gp.buttons[5].pressed) ||
                                     (gp.buttons[6] && gp.buttons[6].pressed) ||
                                     (gp.buttons[7] && gp.buttons[7].pressed);
                    
                    gamepadState[playerIdx].boost = !!hasBoost;
                } else {
                    gamepadState[playerIdx] = { up: false, down: false, left: false, right: false, boost: false };
                }
            }
        } catch (e) {
            console.error('Error polling gamepads:', e);
            // Reset state on error
            gamepadState[0] = { up: false, down: false, left: false, right: false, boost: false };
            gamepadState[1] = { up: false, down: false, left: false, right: false, boost: false };
        }
        
        // Keep polling regardless of errors
        pollGamepadLoopId = requestAnimationFrame(update);
    }
    
    // Start the loop
    update();
}

export function getPlayer1Input() {
    const controls = useGameStore.getState().settings.controls.p1;
    return {
        forward: keys[controls.up] || gamepadState[0].up || touchState[0].up,
        backward: keys[controls.down] || gamepadState[0].down || touchState[0].down,
        left: keys[controls.left] || gamepadState[0].left || touchState[0].left,
        right: keys[controls.right] || gamepadState[0].right || touchState[0].right,
        boost: keys[controls.boost] || gamepadState[0].boost || touchState[0].boost
    };
}

export function getPlayer2Input() {
    const controls = useGameStore.getState().settings.controls.p2;
    return {
        forward: keys[controls.up] || gamepadState[1].up || touchState[1].up,
        backward: keys[controls.down] || gamepadState[1].down || touchState[1].down,
        left: keys[controls.left] || gamepadState[1].left || touchState[1].left,
        right: keys[controls.right] || gamepadState[1].right || touchState[1].right,
        boost: keys[controls.boost] || gamepadState[1].boost || touchState[1].boost
    };
}

// Export gamepad state for debugging
export function getGamepadState() {
    return gamepadState;
}

// Mobile touch control initialization
function initTouchControls() {
    const THRESHOLD = 0.25; // 25% of screen width/height
    
    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        updateTouchInput(touch);
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        updateTouchInput(touch);
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        // Reset touch state when touch ends
        touchState[0] = { up: false, down: false, left: false, right: false, boost: false };
        touchState[1] = { up: false, down: false, left: false, right: false, boost: false };
    }, { passive: true });
    
    function updateTouchInput(touch) {
        const x = touch.clientX;
        const y = touch.clientY;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Normalize coordinates to 0-1 range
        const normX = x / screenWidth;
        const normY = y / screenHeight;
        
        // For mobile, we map touch to player 1 input
        // Left side controls left/right, top/bottom controls forward/backward
        touchState[0].left = normX < (0.5 - THRESHOLD);
        touchState[0].right = normX > (0.5 + THRESHOLD);
        touchState[0].forward = normY < (0.5 - THRESHOLD);
        touchState[0].backward = normY > (0.5 + THRESHOLD);
    }
    
    // Boost button - create it dynamically
    createMobileBoostButton();
}

function createMobileBoostButton() {
    // Check if we already created the button
    if (document.getElementById('mobile-boost-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'mobile-boost-btn';
    btn.textContent = 'BOOST';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 80px;
        height: 80px;
        font-size: 14px;
        font-weight: bold;
        border: 3px solid #00ff00;
        border-radius: 50%;
        background: rgba(0, 255, 0, 0.1);
        color: #00ff00;
        cursor: pointer;
        z-index: 1000;
        touch-action: manipulation;
        user-select: none;
        display: none;
    `;
    
    // Show boost button only on mobile
    if (window.innerWidth < 768) {
        btn.style.display = 'block';
    }
    
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchState[0].boost = true;
        btn.style.background = 'rgba(0, 255, 0, 0.3)';
    });
    
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchState[0].boost = false;
        btn.style.background = 'rgba(0, 255, 0, 0.1)';
    });
    
    document.body.appendChild(btn);
    
    // Show/hide button on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    });
}

export function getConnectedGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(pads).filter(gp => gp && gp.connected).map((gp, i) => ({
        index: i,
        id: gp.id,
        buttons: gp.buttons.length,
        axes: gp.axes.length
    }));
}

// Stop the gamepad polling loop (useful for cleanup)
export function stopGamepadPolling() {
    if (pollGamepadLoopId !== null) {
        cancelAnimationFrame(pollGamepadLoopId);
        pollGamepadLoopId = null;
        console.log('Gamepad polling stopped');
    }
}
