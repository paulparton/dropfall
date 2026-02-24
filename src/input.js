import { useGameStore } from './store.js';

export const keys = {};

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
}

export function getPlayer1Input() {
    const controls = useGameStore.getState().settings.controls.p1;
    return {
        forward: keys[controls.up],
        backward: keys[controls.down],
        left: keys[controls.left],
        right: keys[controls.right],
        boost: keys[controls.boost]
    };
}

export function getPlayer2Input() {
    const controls = useGameStore.getState().settings.controls.p2;
    return {
        forward: keys[controls.up],
        backward: keys[controls.down],
        left: keys[controls.left],
        right: keys[controls.right],
        boost: keys[controls.boost]
    };
}
