import { parseLevelPayload } from '../../shared/levelSchema.js';
import { publishLevel } from '../levelLoader.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DRAFT_KEY = 'dropfall_level_draft_v1';
const CANVAS_RADIUS_KEY = 'dropfall_level_canvas_radius_v1';
const TILE_COLORS = {
    NORMAL: '#37f7ff',
    ICE: '#78b8ff',
    BONUS: '#ffe66d',
};

function generateHexGrid(radius) {
    const tiles = [];
    for (let q = -radius; q <= radius; q += 1) {
        const rMin = Math.max(-radius, -q - radius);
        const rMax = Math.min(radius, -q + radius);
        for (let r = rMin; r <= rMax; r += 1) tiles.push({ q, r });
    }
    return tiles;
}

function tileKey(q, r) {
    return `${q},${r}`;
}

function hexDistance(a, b) {
    return Math.max(
        Math.abs(a.q - b.q),
        Math.abs(a.r - b.r),
        Math.abs((-a.q - a.r) - (-b.q - b.r)),
    );
}

function roundHex(q, r) {
    const s = -q - r;
    let roundedQ = Math.round(q);
    let roundedR = Math.round(r);
    const roundedS = Math.round(s);
    const qDelta = Math.abs(roundedQ - q);
    const rDelta = Math.abs(roundedR - r);
    const sDelta = Math.abs(roundedS - s);
    if (qDelta > rDelta && qDelta > sDelta) roundedQ = -roundedR - roundedS;
    else if (rDelta > sDelta) roundedR = -roundedQ - roundedS;
    return { q: roundedQ, r: roundedR };
}

function hexLine(start, end) {
    const distance = hexDistance(start, end);
    if (distance === 0) return [start];
    return Array.from({ length: distance + 1 }, (_, index) => {
        const progress = index / distance;
        return roundHex(
            start.q + (end.q - start.q) * progress,
            start.r + (end.r - start.r) * progress,
        );
    });
}

function polygonPoints(x, y, radius) {
    return Array.from({ length: 6 }, (_, index) => {
        const angle = Math.PI / 180 * (60 * index - 30);
        return `${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`;
    }).join(' ');
}

function readDraft() {
    try {
        const raw = globalThis.localStorage?.getItem(DRAFT_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const result = parseLevelPayload(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}

function readCanvasRadius() {
    try {
        const stored = Number.parseInt(globalThis.localStorage?.getItem(CANVAS_RADIUS_KEY) || '', 10);
        return Number.isInteger(stored) ? Math.max(3, Math.min(20, stored)) : null;
    } catch {
        return null;
    }
}

function saveCanvasRadius(radius) {
    try {
        globalThis.localStorage?.setItem(CANVAS_RADIUS_KEY, String(radius));
    } catch {
        // Canvas preferences are optional when storage is unavailable.
    }
}

function downloadJson(level) {
    const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${level.id || 'dropfall-level'}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function makeButton(label, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
}

/**
 * @param {{
 *   authorName?: string,
 *   onClose?: () => void,
 *   onTest?: (level: Record<string, unknown>) => void,
 * }} options
 */
export function createLevelEditor({ authorName = 'Pilot', onClose, onTest } = {}) {
    const shell = document.createElement('div');
    shell.className = 'creator-shell';
    shell.tabIndex = -1;

    let gridRadius = 4;
    let activeTool = 'NORMAL';
    let selectedHeight = 4;
    let selectedTileKey = null;
    let level = readDraft() || {
        id: `draft_${Date.now()}`,
        name: 'Untitled Arena',
        description: '',
        difficulty: 'normal',
        theme: 'default',
        mode: 'battle',
        author: authorName,
        active: false,
        tiles: generateHexGrid(4).map(({ q, r }) => ({
            coord: { q, r },
            ability: 'NORMAL',
            height: 4,
        })),
    };
    const tileMap = new Map(level.tiles.map(tile => [
        tileKey(tile.coord.q, tile.coord.r),
        { ...tile, coord: { ...tile.coord } },
    ]));
    const contentRadius = Math.max(4, ...level.tiles.map(tile => Math.max(
        Math.abs(tile.coord.q),
        Math.abs(tile.coord.r),
        Math.abs(-tile.coord.q - tile.coord.r),
    )));
    gridRadius = Math.min(20, Math.max(contentRadius, readCanvasRadius() ?? 4));
    let publishedLevelId = level.active === true ? level.id : null;

    const header = document.createElement('header');
    header.className = 'creator-header';
    const headerCopy = document.createElement('div');
    const kicker = document.createElement('p');
    kicker.className = 'menu-kicker';
    kicker.append(document.createElement('span'), ' Arena foundry');
    const heading = document.createElement('h1');
    heading.textContent = 'Create';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Build, validate, publish, and test an arena without leaving Dropfall.';
    headerCopy.append(kicker, heading, subtitle);
    const closeButton = makeButton('Back to Play Plaza', 'result-secondary');
    closeButton.addEventListener('click', () => onClose?.());
    header.append(headerCopy, closeButton);

    const workspace = document.createElement('div');
    workspace.className = 'creator-workspace';
    const viewport = document.createElement('section');
    viewport.className = 'creator-viewport';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 900 700');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Editable hexagonal arena grid');
    viewport.appendChild(svg);
    const polygonMap = new Map();
    const dragVisitedKeys = new Set();
    let activePointerId = null;
    let dragAction = null;
    let lastDragCoord = null;

    const sidebar = document.createElement('aside');
    sidebar.className = 'creator-sidebar';
    const metadataPanel = document.createElement('section');
    metadataPanel.className = 'creator-panel';
    const metadataHeading = document.createElement('h2');
    metadataHeading.textContent = 'Arena identity';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.maxLength = 60;
    nameInput.value = level.name;
    const descriptionLabel = document.createElement('label');
    descriptionLabel.textContent = 'Description';
    const descriptionInput = document.createElement('textarea');
    descriptionInput.maxLength = 280;
    descriptionInput.rows = 3;
    descriptionInput.value = level.description || '';
    const settingRow = document.createElement('div');
    settingRow.className = 'creator-setting-row';
    const difficultySelect = document.createElement('select');
    ['easy', 'normal', 'hard', 'expert'].forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        option.selected = value === level.difficulty;
        difficultySelect.appendChild(option);
    });
    const themeSelect = document.createElement('select');
    ['default', 'beach', 'temple', 'arctic', 'inferno'].forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        option.selected = value === level.theme;
        themeSelect.appendChild(option);
    });
    settingRow.append(difficultySelect, themeSelect);
    metadataPanel.append(
        metadataHeading,
        nameLabel,
        nameInput,
        descriptionLabel,
        descriptionInput,
        settingRow,
    );

    const tilePanel = document.createElement('section');
    tilePanel.className = 'creator-panel';
    const tileHeading = document.createElement('h2');
    tileHeading.textContent = 'Tile brush';
    const radiusLabel = document.createElement('label');
    radiusLabel.textContent = 'Canvas radius';
    const radiusInput = document.createElement('input');
    radiusInput.type = 'range';
    radiusInput.min = '3';
    radiusInput.max = '20';
    radiusInput.step = '1';
    radiusInput.value = String(gridRadius);
    const radiusValue = document.createElement('span');
    radiusValue.className = 'creator-height-value';
    radiusValue.textContent = `${gridRadius} rings`;
    radiusInput.addEventListener('input', () => {
        gridRadius = Number(radiusInput.value);
        radiusValue.textContent = `${gridRadius} rings`;
        saveCanvasRadius(gridRadius);
        renderGrid();
    });
    const toolGrid = document.createElement('div');
    toolGrid.className = 'creator-tool-grid';
    const toolButtons = new Map();
    const selectTool = tool => {
        activeTool = tool;
        toolButtons.forEach((candidate, candidateTool) => {
            candidate.classList.toggle('active', candidateTool === activeTool);
        });
    };
    [
        ['NORMAL', '1 · Circuit', '1'],
        ['ICE', '2 · Ice', '2'],
        ['BONUS', '3 · Power-up', '3'],
        ['ERASE', '4 · Erase', '4'],
    ].forEach(([tool, label, shortcut]) => {
        const button = makeButton(label, `creator-tool creator-tool--${tool.toLowerCase()}`);
        button.dataset.tool = tool;
        button.setAttribute('aria-keyshortcuts', shortcut);
        button.classList.toggle('active', tool === activeTool);
        button.addEventListener('click', () => selectTool(tool));
        toolButtons.set(tool, button);
        toolGrid.appendChild(button);
    });
    const toolHint = document.createElement('p');
    toolHint.className = 'creator-tool-hint';
    toolHint.textContent = 'Keys 1–4 switch brushes. Click a matching tile again to erase it.';
    const heightLabel = document.createElement('label');
    heightLabel.textContent = 'Brush height';
    const heightInput = document.createElement('input');
    heightInput.type = 'range';
    heightInput.min = '-2';
    heightInput.max = '12';
    heightInput.step = '1';
    heightInput.value = String(selectedHeight);
    const heightValue = document.createElement('span');
    heightValue.className = 'creator-height-value';
    heightValue.textContent = `${selectedHeight}m`;
    heightInput.addEventListener('input', () => {
        selectedHeight = Number(heightInput.value);
        heightValue.textContent = `${selectedHeight}m`;
        if (selectedTileKey && tileMap.has(selectedTileKey)) {
            tileMap.get(selectedTileKey).height = selectedHeight;
            renderGrid();
            syncActions();
        }
    });
    tilePanel.append(
        tileHeading,
        radiusLabel,
        radiusInput,
        radiusValue,
        toolGrid,
        toolHint,
        heightLabel,
        heightInput,
        heightValue,
    );

    const actionPanel = document.createElement('section');
    actionPanel.className = 'creator-panel creator-action-panel';
    const saveButton = makeButton('Save Local Draft', 'result-primary');
    const publishButton = makeButton('Publish to Game', 'result-primary creator-publish-button');
    const testButton = makeButton('Test in Solo', 'result-secondary');
    const newButton = makeButton('New Layout', 'result-secondary');
    const exportButton = makeButton('Export JSON', 'result-secondary');
    const importLabel = document.createElement('label');
    importLabel.className = 'creator-import-button result-secondary';
    importLabel.textContent = 'Import JSON';
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importLabel.appendChild(importInput);
    const actionStatus = document.createElement('p');
    actionStatus.className = 'creator-action-status';
    actionStatus.setAttribute('role', 'status');
    actionStatus.setAttribute('aria-live', 'polite');
    actionPanel.append(saveButton, publishButton, testButton, newButton, exportButton, importLabel, actionStatus);

    sidebar.append(metadataPanel, tilePanel, actionPanel);
    workspace.append(viewport, sidebar);
    shell.append(header, workspace);

    function collectLevel() {
        return {
            ...level,
            name: nameInput.value.trim() || 'Untitled Arena',
            description: descriptionInput.value.trim(),
            difficulty: difficultySelect.value,
            theme: themeSelect.value,
            mode: 'battle',
            author: authorName,
            active: false,
            tiles: Array.from(tileMap.values())
                .sort((a, b) => a.coord.q - b.coord.q || a.coord.r - b.coord.r),
        };
    }

    function updatePolygon(key) {
        const polygon = polygonMap.get(key);
        if (!polygon) return;
        const q = Number(polygon.dataset.q);
        const r = Number(polygon.dataset.r);
        const tile = tileMap.get(key);
        polygon.classList.toggle('creator-hex--filled', Boolean(tile));
        polygon.classList.toggle('creator-hex--selected', key === selectedTileKey);
        if (tile) {
            polygon.style.setProperty('--tile-color', TILE_COLORS[tile.ability] || TILE_COLORS.NORMAL);
            polygon.style.setProperty('--tile-height', String(Math.max(-2, Math.min(12, tile.height))));
        } else {
            polygon.style.removeProperty('--tile-color');
            polygon.style.removeProperty('--tile-height');
        }
        polygon.setAttribute(
            'aria-label',
            tile ? `${tile.ability} tile at ${q}, ${r}, height ${tile.height}` : `Empty tile at ${q}, ${r}`,
        );
    }

    function applyBrushAt(q, r, action = null, visitedKeys = null) {
        const key = tileKey(q, r);
        if (visitedKeys?.has(key)) return;
        visitedKeys?.add(key);

        const currentTile = tileMap.get(key);
        const resolvedAction = action || (
            activeTool === 'ERASE' || currentTile?.ability === activeTool ? 'erase' : 'paint'
        );
        const previousSelectedKey = selectedTileKey;
        if (resolvedAction === 'erase') {
            tileMap.delete(key);
            selectedTileKey = null;
        } else {
            selectedTileKey = key;
            tileMap.set(key, {
                coord: { q, r },
                ability: activeTool,
                height: currentTile?.height ?? selectedHeight,
            });
        }

        const selected = tileMap.get(key);
        if (selected) {
            selectedHeight = selected.height;
            heightInput.value = String(selectedHeight);
            heightValue.textContent = `${selectedHeight}m`;
        }
        if (previousSelectedKey && previousSelectedKey !== key) updatePolygon(previousSelectedKey);
        updatePolygon(key);
        syncActions();
    }

    function getPointerPolygon(event) {
        const hit = typeof document.elementFromPoint === 'function'
            ? document.elementFromPoint(event.clientX, event.clientY)
            : event.target;
        const polygon = hit?.closest?.('.creator-hex');
        return polygon && svg.contains(polygon) ? polygon : null;
    }

    function finishDrag() {
        activePointerId = null;
        dragAction = null;
        lastDragCoord = null;
        dragVisitedKeys.clear();
        svg.classList.remove('is-painting');
    }

    function renderGrid() {
        svg.replaceChildren();
        polygonMap.clear();
        const candidates = generateHexGrid(gridRadius);
        const hexRadius = Math.max(8, Math.min(37, 230 / (gridRadius + 0.5)));
        const xSpacing = Math.sqrt(3) * hexRadius;
        const ySpacing = 1.5 * hexRadius;

        candidates.forEach(({ q, r }) => {
            const key = tileKey(q, r);
            const x = 450 + xSpacing * (q + r / 2);
            const y = 350 + ySpacing * r;
            const polygon = document.createElementNS(SVG_NS, 'polygon');
            polygon.setAttribute('points', polygonPoints(x, y, hexRadius - 2));
            polygon.classList.add('creator-hex');
            polygon.dataset.q = String(q);
            polygon.dataset.r = String(r);
            polygon.setAttribute('tabindex', '0');
            polygon.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    applyBrushAt(q, r);
                }
            });
            polygonMap.set(key, polygon);
            svg.appendChild(polygon);
            updatePolygon(key);
        });
    }

    svg.addEventListener('pointerdown', event => {
        if (event.button !== 0 || activePointerId !== null) return;
        const polygon = getPointerPolygon(event);
        if (!polygon) return;
        event.preventDefault();
        const q = Number(polygon.dataset.q);
        const r = Number(polygon.dataset.r);
        const initialTile = tileMap.get(tileKey(q, r));
        dragAction = activeTool === 'ERASE' || initialTile?.ability === activeTool ? 'erase' : 'paint';
        activePointerId = event.pointerId;
        lastDragCoord = { q, r };
        dragVisitedKeys.clear();
        svg.classList.add('is-painting');
        svg.setPointerCapture?.(event.pointerId);
        applyBrushAt(q, r, dragAction, dragVisitedKeys);
    });
    svg.addEventListener('pointermove', event => {
        if (activePointerId === null || event.pointerId !== activePointerId) return;
        const polygon = getPointerPolygon(event);
        if (!polygon) return;
        const nextCoord = { q: Number(polygon.dataset.q), r: Number(polygon.dataset.r) };
        const path = lastDragCoord ? hexLine(lastDragCoord, nextCoord) : [nextCoord];
        path.forEach(coord => applyBrushAt(coord.q, coord.r, dragAction, dragVisitedKeys));
        lastDragCoord = nextCoord;
    });
    svg.addEventListener('pointerup', finishDrag);
    svg.addEventListener('pointercancel', finishDrag);
    svg.addEventListener('lostpointercapture', finishDrag);

    function syncActions() {
        testButton.disabled = false;
        publishButton.disabled = false;
    }

    saveButton.addEventListener('click', () => {
        const draft = collectLevel();
        const parsed = parseLevelPayload(draft);
        if (!parsed.success) {
            actionStatus.textContent = 'Draft could not be saved because its data is malformed.';
            return;
        }
        level = parsed.data;
        try {
            globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify(level));
            saveCanvasRadius(gridRadius);
            actionStatus.textContent = 'Draft saved on this device.';
            saveButton.textContent = 'Draft Saved';
            setTimeout(() => { saveButton.textContent = 'Save Local Draft'; }, 1500);
        } catch {
            saveButton.textContent = 'Storage Unavailable';
        }
    });
    publishButton.addEventListener('click', async () => {
        const parsed = parseLevelPayload({ ...collectLevel(), active: true });
        if (!parsed.success) {
            actionStatus.textContent = 'Map could not be published because its data is malformed.';
            return;
        }

        publishButton.disabled = true;
        publishButton.textContent = 'Publishing…';
        actionStatus.textContent = 'Publishing arena to the game catalogue…';
        try {
            const result = await publishLevel(parsed.data, {
                existingId: publishedLevelId,
            });
            publishedLevelId = result.id;
            level = { ...parsed.data, id: result.id, active: true };
            globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify(level));
            actionStatus.textContent = 'Published. The arena now appears in the game picker.';
        } catch (error) {
            actionStatus.textContent = `Publish failed: ${error.message}`;
        } finally {
            publishButton.textContent = 'Publish to Game';
            syncActions();
        }
    });
    testButton.addEventListener('click', () => {
        const parsed = parseLevelPayload(collectLevel());
        if (!parsed.success) {
            actionStatus.textContent = 'Map could not be tested because its data is malformed.';
            return;
        }
        onTest?.(parsed.data);
    });
    newButton.addEventListener('click', () => {
        level = {
            id: `draft_${Date.now()}`,
            name: 'Untitled Arena',
            description: '',
            difficulty: 'normal',
            theme: 'default',
            mode: 'battle',
            author: authorName,
            active: false,
            tiles: [],
        };
        nameInput.value = level.name;
        descriptionInput.value = '';
        tileMap.clear();
        generateHexGrid(Math.min(gridRadius, 4)).forEach(({ q, r }) => {
            tileMap.set(tileKey(q, r), {
                coord: { q, r },
                ability: 'NORMAL',
                height: 4,
            });
        });
        selectedTileKey = null;
        publishedLevelId = null;
        renderGrid();
        syncActions();
    });
    exportButton.addEventListener('click', () => {
        const parsed = parseLevelPayload(collectLevel());
        if (parsed.success) downloadJson(parsed.data);
    });
    importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        if (!file || file.size > 256 * 1024) return;
        try {
            const parsedJson = JSON.parse(await file.text());
            const parsed = parseLevelPayload({ ...parsedJson, active: false });
            if (!parsed.success) throw new Error('Level does not match the Dropfall schema');
            level = parsed.data;
            tileMap.clear();
            level.tiles.forEach(tile => tileMap.set(tileKey(tile.coord.q, tile.coord.r), {
                ...tile,
                coord: { ...tile.coord },
            }));
            const maxDistance = Math.max(...level.tiles.map(tile => Math.max(
                Math.abs(tile.coord.q),
                Math.abs(tile.coord.r),
                Math.abs(-tile.coord.q - tile.coord.r),
            )));
            gridRadius = Math.max(4, Math.min(20, maxDistance));
            radiusInput.value = String(gridRadius);
            radiusValue.textContent = `${gridRadius} rings`;
            saveCanvasRadius(gridRadius);
            publishedLevelId = null;
            nameInput.value = level.name;
            descriptionInput.value = level.description || '';
            difficultySelect.value = level.difficulty;
            themeSelect.value = level.theme;
            renderGrid();
            syncActions();
        } catch (error) {
            actionStatus.textContent = `Import failed: ${error.message}`;
        } finally {
            importInput.value = '';
        }
    });

    shell.addEventListener('keydown', event => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target;
        if (target instanceof HTMLInputElement
            || target instanceof HTMLTextAreaElement
            || target instanceof HTMLSelectElement
            || target?.isContentEditable) return;
        const shortcutTools = {
            Digit1: 'NORMAL',
            Numpad1: 'NORMAL',
            Digit2: 'ICE',
            Numpad2: 'ICE',
            Digit3: 'BONUS',
            Numpad3: 'BONUS',
            Digit4: 'ERASE',
            Numpad4: 'ERASE',
        };
        const tool = shortcutTools[event.code];
        if (!tool) return;
        event.preventDefault();
        selectTool(tool);
    });

    renderGrid();
    syncActions();
    return shell;
}
