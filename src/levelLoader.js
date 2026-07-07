/**
 * Level Loader - Fetches and manages custom levels from the editor server
 */

function getLevelApiBase() {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LEVEL_API_URL) {
        return import.meta.env.VITE_LEVEL_API_URL.replace(/\/$/, '');
    }
    // Fallback for local development with the editor server
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    return isLocal ? 'http://localhost:3001/api' : `${window.location.origin}/api`;
}

const LEVEL_API_BASE = getLevelApiBase();

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
