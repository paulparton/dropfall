/**
 * Level Loader - Fetches and manages custom levels from the editor server
 */

export function getLevelApiBase() {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LEVEL_API_URL) {
        return import.meta.env.VITE_LEVEL_API_URL.replace(/\/$/, '');
    }

    // The game server owns the level catalogue in production and when running
    // on localhost:3000. Vite proxies /api to the editor server during frontend
    // development, so every browser build can use the same-origin contract.
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        return `${window.location.origin}/api`;
    }

    // Desktop/file builds cannot use a relative HTTP API.
    return 'http://localhost:3001/api';
}

const LEVEL_API_BASE = getLevelApiBase();
const PUBLISHED_LEVELS_KEY = 'dropfall_published_levels_v1';
const MAX_CACHED_PUBLISHED_LEVELS = 40;

export function getLocallyPublishedLevels() {
    try {
        const stored = JSON.parse(globalThis.localStorage?.getItem(PUBLISHED_LEVELS_KEY) || '[]');
        return Array.isArray(stored)
            ? stored.filter(level => level && typeof level === 'object' && typeof level.id === 'string')
            : [];
    } catch {
        return [];
    }
}

function cachePublishedLevel(level) {
    try {
        const levels = getLocallyPublishedLevels().filter(candidate => candidate.id !== level.id);
        levels.unshift(level);
        globalThis.localStorage?.setItem(
            PUBLISHED_LEVELS_KEY,
            JSON.stringify(levels.slice(0, MAX_CACHED_PUBLISHED_LEVELS)),
        );
        globalThis.dispatchEvent?.(new CustomEvent('dropfall:levels-changed', {
            detail: { levelId: level.id },
        }));
    } catch {
        // Server publishing succeeded; local catalogue acceleration is optional.
    }
}

export async function loadLevels() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await fetch(`${LEVEL_API_BASE}/levels?t=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Failed to load levels');
        return await response.json();
    } catch (err) {
        console.error('[LevelLoader] Error loading levels:', err);
        return [];
    }
}

export async function getLevel(levelId) {
    try {
        const response = await fetch(`${LEVEL_API_BASE}/levels/${levelId}?t=${Date.now()}`, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to load level');
        return await response.json();
    } catch (err) {
        console.error('[LevelLoader] Error loading level:', err);
        return null;
    }
}

export async function publishLevel(level, { existingId = null } = {}) {
    const response = await fetch(existingId
        ? `${LEVEL_API_BASE}/levels/${encodeURIComponent(existingId)}`
        : `${LEVEL_API_BASE}/levels`, {
        method: existingId ? 'PUT' : 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(level),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result.error || `Publish failed (${response.status})`);
        error.status = response.status;
        error.details = result;
        throw error;
    }
    if (typeof result.id === 'string') {
        cachePublishedLevel({ ...level, id: result.id, active: true });
    }
    return result;
}
