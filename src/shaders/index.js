import { createBeachPlatformMaterial } from './beach-platform.js';
import { createTronPlatformMaterial } from './tron-platform.js';
import { createTemplePlatformMaterial } from './temple-platform.js';
import { createArcticPlatformMaterial } from './arctic-platform.js';
import { createInfernoPlatformMaterial } from './inferno-platform.js';
import { createBeachSkyMaterial } from './beach-sky.js';
import { createTronSkyMaterial } from './tron-sky.js';
import { createTempleSkyMaterial } from './temple-sky.js';
import { createArcticSkyMaterial } from './arctic-sky.js';
import { createInfernoSkyMaterial } from './inferno-sky.js';

export const SHADER_THEMES = {
    tron: 'TRON (Cyber)',
    beach: 'Beach',
    temple: 'Temple (Aztec)',
    arctic: 'Arctic',
    inferno: 'Inferno'
};

// Map old theme names to new ones for backward compatibility
export function resolveThemeName(theme) {
    if (theme === 'default') return 'tron';
    if (theme === 'cracked_stone') return 'temple';
    return theme;
}

export function createPlatformMaterial(theme) {
    const resolved = resolveThemeName(theme);
    switch (resolved) {
        case 'beach':
            return createBeachPlatformMaterial();
        case 'temple':
            return createTemplePlatformMaterial();
        case 'arctic':
            return createArcticPlatformMaterial();
        case 'inferno':
            return createInfernoPlatformMaterial();
        case 'tron':
        default:
            return createTronPlatformMaterial();
    }
}

export function createSkyboxMaterial(theme) {
    const resolved = resolveThemeName(theme);
    switch (resolved) {
        case 'beach':
            return createBeachSkyMaterial();
        case 'temple':
            return createTempleSkyMaterial();
        case 'arctic':
            return createArcticSkyMaterial();
        case 'inferno':
            return createInfernoSkyMaterial();
        case 'tron':
        default:
            return createTronSkyMaterial();
    }
}
