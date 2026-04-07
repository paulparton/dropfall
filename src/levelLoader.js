/**
 * Level Loader - Fetches and manages custom levels from the editor server
 */

const LEVEL_API_BASE = 'http://localhost:3001/api';

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
