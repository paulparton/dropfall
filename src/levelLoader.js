/**
 * Level Loader - Fetches and manages custom levels from the editor server
 */

const LEVEL_API_BASE = 'http://localhost:3001/api';

export async function loadLevels() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await fetch(`${LEVEL_API_BASE}/levels`, {
            signal: controller.signal
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
        const response = await fetch(`${LEVEL_API_BASE}/levels/${levelId}`);
        if (!response.ok) throw new Error('Failed to load level');
        return await response.json();
    } catch (err) {
        console.error('[LevelLoader] Error loading level:', err);
        return null;
    }
}

export function createLevelButtons(levels, onLevelSelect) {
    const container = document.getElementById('levels-container');
    if (!container) return;

    container.innerHTML = '';

    if (levels.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #ff6600; padding: 40px; font-size: 1.2rem;">
                <p>📭 No levels found</p>
                <p style="font-size: 0.9rem; color: #0ff; margin-top: 20px;">Build some levels in the editor at http://localhost:3001</p>
            </div>
        `;
        return;
    }

    levels.forEach(level => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            padding: 20px;
            background: rgba(0, 255, 100, 0.1);
            border: 2px solid #00ff64;
            color: #00ff64;
            cursor: pointer;
            font-size: 1rem;
            font-weight: bold;
            border-radius: 8px;
            transition: all 0.2s;
            text-align: center;
            font-family: 'Courier New', monospace;
        `;
        btn.innerHTML = `
            <div style="font-size: 1.1rem; margin-bottom: 8px;">${level.name}</div>
            <div style="font-size: 0.8rem; color: #0088ff;">${level.tileCount} tiles</div>
            <div style="font-size: 0.8rem; color: #ffaa00; margin-top: 4px;">⭐${level.difficulty}</div>
        `;
        btn.onmouseover = () => {
            btn.style.background = 'rgba(0, 255, 100, 0.25)';
            btn.style.boxShadow = '0 0 20px rgba(0, 255, 100, 0.5)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(0, 255, 100, 0.1)';
            btn.style.boxShadow = 'none';
        };
        btn.onclick = () => {
            console.log('[LevelSelector] Level selected:', level.id);
            onLevelSelect(level.id);
        };
        container.appendChild(btn);
    });
}

export function showLevelSelect() {
    const screen = document.getElementById('level-select');
    if (screen) {
        screen.style.display = '';
    }
}

export function hideLevelSelect() {
    const screen = document.getElementById('level-select');
    if (screen) {
        screen.style.display = 'none';
        screen.classList.add('hidden');
    }
}
