/**
 * Character Preview Panel - Dual side-by-side player previews for game settings
 * Self-contained player cards with inline name, color, hat, and 3D preview controls
 */

import { COLOR_PALETTE, getAllPatterns, isPatternId, getDisplayColor } from './ColorPalette.js';
import * as THREE from 'three';
import { createHatMesh, disposeHatGroup, HatResult, SantaSegment } from '../utils/hatFactory.js';
import { updateHatPhysics, createHatPhysicsState, HatPhysicsState } from '../utils/hatPhysics.js';
import { createBallMaterial, createSwatchCanvas, getPatternEmissiveColor } from '../utils/materialFactory.js';
import { createLevelThumbnailCanvas, type LevelTile } from '../utils/levelThumbnail.js';
import { useGameStore } from '../store.js';

export interface PreviewPlayerState {
  playerId: 'player1' | 'player2';
  playerName: string;
  color: number | string;
  hat: string;
  difficulty?: string;
}

interface PreviewInstance {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  ball: THREE.Mesh | null;
  aura: THREE.Mesh | null;
  ground: THREE.Mesh | null;
  hatGroup: THREE.Group | null;
  hatSantaData: {
    santaSegments: SantaSegment[];
    santaPomGroup: THREE.Group | null;
    santaDroopX: number;
    santaDroopZ: number;
  } | null;
  hatPhysics: HatPhysicsState;
  sphereSize: number;
  animationId: number | null;
  ballPosition: THREE.Vector3;
  ballVelocity: THREE.Vector3;
  rotationX: number;
  rotationY: number;
}

interface LevelSummary {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  tileCount: number;
  isDemo: boolean;
}

interface LevelDetails extends LevelSummary {
  tiles?: LevelTile[];
}

type LevelSelectFactory =
  ((options: {
    levels: LevelSummary[];
    currentLevelId: string | null;
    onSelect: (levelId: string | null) => void;
  }) => unknown)
  | ((levels: LevelSummary[], currentLevelId: string | null, onSelect: (levelId: string | null) => void) => unknown);

const HAT_LABELS: Record<string, string> = {
  none: 'None',
  santa: 'Santa',
  cowboy: 'Cowboy',
  afro: 'Afro',
  crown: 'Crown',
  dunce: 'Dunce',
};

const HAT_VALUES = ['none', 'santa', 'cowboy', 'afro', 'crown', 'dunce'];

export const previewInstances: Map<'player1' | 'player2', PreviewInstance> = new Map();

let selectedPreviewLevelId: string | null = null;

export function getSelectedPreviewLevelId(): string | null {
  return selectedPreviewLevelId;
}

let cachedLevelSummaries: LevelSummary[] | null = null;

async function loadLevelProvider(): Promise<{
  getAllLevels: () => Promise<LevelSummary[]>;
  getLevelById: (id: string) => Promise<LevelDetails | null>;
} | null> {
  try {
    const module = await import('../levels/levelProvider.js') as {
      getAllLevels?: () => Promise<LevelSummary[]>;
      getLevelById?: (id: string) => Promise<LevelDetails | null>;
    };

    if (!module.getAllLevels || !module.getLevelById) {
      return null;
    }

    return {
      getAllLevels: module.getAllLevels,
      getLevelById: module.getLevelById,
    };
  } catch {
    return null;
  }
}

async function loadLevelSelectFactory(): Promise<LevelSelectFactory | null> {
  try {
    const module = await import('./LevelSelectModal.js') as { createLevelSelectModal?: LevelSelectFactory };
    return module.createLevelSelectModal ?? null;
  } catch {
    return null;
  }
}

function numToHexCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

function getAllPaletteColors(): Array<{ name: string; hex: number }> {
  return [
    ...COLOR_PALETTE.neon,
    ...COLOR_PALETTE.dark,
    ...COLOR_PALETTE.metallic,
    ...COLOR_PALETTE.jewel,
    ...COLOR_PALETTE.pastel,
    ...COLOR_PALETTE.earth,
    ...COLOR_PALETTE.vivid,
    ...COLOR_PALETTE.monochrome,
  ];
}

/**
 * Create the character preview panel with dual previews and embedded player customization controls
 */
export function createCharacterPreviewPanel(
  players: PreviewPlayerState[],
  onPlayerStateChange?: (playerId: 'player1' | 'player2', state: Partial<PreviewPlayerState>) => void,
  isMultiplayer?: boolean
): HTMLElement {
  const container = document.createElement('div');
  container.id = 'character-preview-panel';
  container.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: flex-start;
    padding: 1rem;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.3);
  `;

  const colorStripStyles = document.createElement('style');
  colorStripStyles.textContent = `
    .rl-swatch-grid::-webkit-scrollbar { width: 3px; }
    .rl-swatch-grid::-webkit-scrollbar-track { background: transparent; }
    .rl-swatch-grid::-webkit-scrollbar-thumb { background: rgba(100,160,220,0.3); border-radius: 2px; }
  `;
  container.appendChild(colorStripStyles);

  // ===== TOP: DIFFICULTY SELECTOR (Single player only) =====
  if (!isMultiplayer) {
    const difficultySection = document.createElement('div');
    difficultySection.style.cssText = `
      width: 100%;
      max-width: 600px;
      padding: 0.8rem;
      background: rgba(0, 255, 255, 0.05);
      border: 2px solid #0ff;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    `;

    const diffTitle = document.createElement('h3');
    diffTitle.textContent = 'DIFFICULTY';
    diffTitle.style.cssText = `
      color: #0ff;
      margin: 0;
      text-align: center;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
    `;
    difficultySection.appendChild(diffTitle);

    const diffButtons = document.createElement('div');
    diffButtons.style.cssText = `
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    `;

    let selectedDifficulty = String(useGameStore.getState().difficulty ?? 'normal');
    const setDifficultyButtonInactive = (btn: HTMLButtonElement): void => {
      btn.style.background = 'rgba(0, 255, 255, 0.2)';
      btn.style.color = '#0ff';
      btn.style.borderColor = '#0ff';
      btn.style.boxShadow = 'none';
      btn.style.textShadow = 'none';
    };
    const setDifficultyButtonActive = (btn: HTMLButtonElement): void => {
      btn.style.background = '#0ff';
      btn.style.color = '#000';
      btn.style.borderColor = '#00ffff';
      btn.style.boxShadow = '0 0 30px #0ff, inset 0 0 20px rgba(255, 255, 255, 0.5)';
      btn.style.textShadow = '0 0 10px rgba(0, 255, 255, 0.8)';
    };

    ['easy', 'normal', 'hard'].forEach((diff) => {
      const btn = document.createElement('button');
      btn.dataset.difficulty = diff;
      btn.textContent = diff.toUpperCase();
      btn.style.cssText = `
        flex: 1;
        padding: 0.5rem 1rem;
        background: rgba(0, 255, 255, 0.2);
        color: #0ff;
        border: 1px solid #0ff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: bold;
        text-transform: uppercase;
        transition: all 0.2s;
      `;

      if (diff === selectedDifficulty) {
        setDifficultyButtonActive(btn);
      }

      btn.onmouseover = () => {
        if (btn.dataset.difficulty === selectedDifficulty) {
          return;
        }
        btn.style.background = 'rgba(0, 255, 255, 0.3)';
      };
      btn.onmouseout = () => {
        if (btn.dataset.difficulty === selectedDifficulty) {
          setDifficultyButtonActive(btn);
          return;
        }
        setDifficultyButtonInactive(btn);
      };
      btn.onclick = () => {
        onPlayerStateChange?.('player1', { difficulty: diff });
        selectedDifficulty = diff;
        Array.from(diffButtons.children).forEach((child) => {
          if (child instanceof HTMLButtonElement) {
            setDifficultyButtonInactive(child);
          }
        });
        setDifficultyButtonActive(btn);
      };
      diffButtons.appendChild(btn);
    });

    difficultySection.appendChild(diffButtons);
    container.appendChild(difficultySection);
  }

  // ===== MIDDLE: LEVEL SELECTOR STRIP =====
  const levelSection = document.createElement('div');
  levelSection.style.cssText = `
    width: 100%;
    max-width: 600px;
    padding: 0.8rem;
    background: rgba(0, 255, 255, 0.05);
    border: 2px solid #0ff;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    box-sizing: border-box;
  `;

  const levelLabel = document.createElement('h3');
  levelLabel.textContent = 'ARENA';
  levelLabel.style.cssText = `
    color: #0ff;
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
    white-space: nowrap;
  `;
  levelSection.appendChild(levelLabel);

  const levelInfo = document.createElement('div');
  levelInfo.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    flex: 1;
  `;

  const levelThumbnailWrap = document.createElement('div');
  levelThumbnailWrap.style.cssText = `
    width: 72px;
    height: 44px;
    border: 1px solid rgba(0, 255, 255, 0.35);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  `;

  const levelName = document.createElement('div');
  levelName.textContent = 'Default Arena';
  levelName.title = 'Default Arena';
  levelName.style.cssText = `
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: bold;
    letter-spacing: 0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;

  const levelFallbackText = document.createElement('span');
  levelFallbackText.textContent = 'NO PREVIEW';
  levelFallbackText.style.cssText = `
    color: rgba(0, 255, 255, 0.6);
    font-size: 0.55rem;
    letter-spacing: 1px;
    text-transform: uppercase;
  `;
  levelThumbnailWrap.appendChild(levelFallbackText);

  levelInfo.append(levelThumbnailWrap, levelName);
  levelSection.appendChild(levelInfo);

  const levelButton = document.createElement('button');
  levelButton.type = 'button';
  levelButton.textContent = 'SELECT';
  levelButton.style.cssText = `
    padding: 0.45rem 0.8rem;
    background: rgba(0, 255, 255, 0.2);
    color: #0ff;
    border: 1px solid #0ff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: bold;
    text-transform: uppercase;
    transition: all 0.2s;
    flex-shrink: 0;
  `;
  levelButton.onmouseover = () => {
    if (!levelButton.disabled) {
      levelButton.style.background = 'rgba(0, 255, 255, 0.3)';
    }
  };
  levelButton.onmouseout = () => {
    if (!levelButton.disabled) {
      levelButton.style.background = 'rgba(0, 255, 255, 0.2)';
    }
  };
  levelSection.appendChild(levelButton);

  container.appendChild(levelSection);

  const setThumbnail = (tiles?: LevelTile[]) => {
    levelThumbnailWrap.innerHTML = '';

    if (!tiles || tiles.length === 0) {
      levelThumbnailWrap.appendChild(levelFallbackText);
      return;
    }

    const thumbnailCanvas = createLevelThumbnailCanvas(tiles, 72, 44);
    thumbnailCanvas.style.cssText = 'width: 100%; height: 100%; display: block;';
    levelThumbnailWrap.appendChild(thumbnailCanvas);
  };

  const updateLevelStrip = async (nextLevelId: string | null, availableLevels: LevelSummary[], providerAvailable: boolean) => {
    selectedPreviewLevelId = nextLevelId;

    if (!nextLevelId) {
      levelName.textContent = 'Default Arena';
      levelName.title = 'Default Arena';
      setThumbnail(undefined);
      return;
    }

    const level = availableLevels.find((candidate) => candidate.id === nextLevelId);
    if (!level) {
      levelName.textContent = 'Default Arena';
      levelName.title = 'Default Arena';
      setThumbnail(undefined);
      return;
    }

    levelName.textContent = level.name;
    levelName.title = level.name;

    if (!providerAvailable) {
      setThumbnail(undefined);
      return;
    }

    const provider = await loadLevelProvider();
    if (!provider) {
      setThumbnail(undefined);
      return;
    }

    const levelDetails = await provider.getLevelById(level.id);
    setThumbnail(levelDetails?.tiles);
  };

  let levelList: LevelSummary[] = [];
  let hasLevelProvider = false;

  const initializeLevels = async () => {
    const provider = await loadLevelProvider();
    hasLevelProvider = Boolean(provider);

    if (!provider) {
      levelButton.disabled = true;
      levelButton.textContent = 'UNAVAILABLE';
      levelButton.style.opacity = '0.55';
      levelButton.style.cursor = 'not-allowed';
      return;
    }

    if (!cachedLevelSummaries) {
      cachedLevelSummaries = await provider.getAllLevels();
    }
    levelList = cachedLevelSummaries;

    if (levelList.length === 0) {
      levelButton.disabled = true;
      levelButton.textContent = 'NO LEVELS';
      levelButton.style.opacity = '0.55';
      levelButton.style.cursor = 'not-allowed';
      return;
    }

    await updateLevelStrip(selectedPreviewLevelId, levelList, hasLevelProvider);
  };

  void initializeLevels();

  levelButton.onclick = async () => {
    if (levelButton.disabled) {
      return;
    }

    if (levelList.length === 0) {
      return;
    }

    const modalFactory = await loadLevelSelectFactory();
    if (!modalFactory) {
      return;
    }

    const handleSelection = (levelId: string | null) => {
      void updateLevelStrip(levelId, levelList, hasLevelProvider);
    };

    try {
      modalFactory({
        levels: levelList,
        currentLevelId: selectedPreviewLevelId,
        onSelect: handleSelection,
      });
    } catch {
      const fallbackFactory = modalFactory as (
        levels: LevelSummary[],
        currentLevelId: string | null,
        onSelect: (levelId: string | null) => void,
      ) => unknown;
      fallbackFactory(levelList, selectedPreviewLevelId, handleSelection);
    }
  };

  // ===== BOTTOM: DUAL PLAYER CARDS =====
  const playersContainer = document.createElement('div');
  playersContainer.style.cssText = `
    display: flex;
    gap: 2rem;
    width: 100%;
    max-width: 1000px;
    justify-content: center;
    align-items: flex-start;
    flex-shrink: 0;
  `;

  players.forEach((player) => {
    const playerCard = createPlayerCard(player, onPlayerStateChange as Function | undefined, isMultiplayer);

    playersContainer.appendChild(playerCard);

    const canvas = playerCard.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const instance = initializePreview(canvas, player.color, player.hat);
    previewInstances.set(player.playerId, instance);
    startPreviewAnimation(instance);
  });

  container.appendChild(playersContainer);

  return container;
}

/**
 * Create a single player card with Rocket League-inspired dark/neon esports aesthetic
 */
function createPlayerCard(player: PreviewPlayerState, onPlayerStateChange?: Function, isMultiplayer?: boolean): HTMLElement {
  const isP1 = player.playerId === 'player1';
  const accentCss = isP1 ? '#00B4D8' : '#FF6B35';
  const accentRgb = isP1 ? '0,180,216' : '255,107,53';
  const playerLabel = isP1 ? 'P1' : (isMultiplayer ? 'P2' : 'CPU');
  const fontStack = "'Rajdhani', 'Trebuchet MS', system-ui, sans-serif";

  const card = document.createElement('div');
  card.style.cssText = `
    flex: 1 1 0;
    max-width: 420px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: rgba(7,9,18,0.92);
    border: 1px solid rgba(${accentRgb},0.35);
    border-radius: 10px;
    box-shadow: 0 0 30px rgba(${accentRgb},0.1), inset 0 1px 0 rgba(255,255,255,0.04);
    overflow: hidden;
  `;

  // Header bar
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.85rem;
    background: rgba(${accentRgb},0.1);
    border-bottom: 1px solid rgba(${accentRgb},0.2);
  `;

  const labelBadge = document.createElement('span');
  labelBadge.textContent = playerLabel;
  labelBadge.style.cssText = `
    color: ${accentCss};
    font-family: ${fontStack};
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    flex-shrink: 0;
    padding: 2px 7px;
    border: 1px solid rgba(${accentRgb},0.5);
    border-radius: 3px;
  `;
  header.appendChild(labelBadge);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 12;
  nameInput.placeholder = isP1 ? 'PLAYER 1' : (isMultiplayer ? 'PLAYER 2' : 'CPU');
  nameInput.value = player.playerName;
  nameInput.style.cssText = `
    flex: 1;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(${accentRgb},0.22);
    color: #e8e8f0;
    font-family: ${fontStack};
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 4px;
    box-sizing: border-box;
    outline: none;
    min-width: 0;
  `;
  nameInput.onfocus = () => {
    nameInput.style.borderColor = accentCss;
    nameInput.style.boxShadow = `0 0 0 1px ${accentCss}33`;
  };
  nameInput.onblur = () => {
    nameInput.style.borderColor = `rgba(${accentRgb},0.22)`;
    nameInput.style.boxShadow = 'none';
  };
  nameInput.oninput = (event) => {
    const target = event.target as HTMLInputElement;
    const nextName = target.value;
    const s = useGameStore.getState();
    if (player.playerId === 'player1') {
      s.setPlayerNames(nextName, s.p2Name);
    } else {
      s.setPlayerNames(s.p1Name, nextName);
    }
    onPlayerStateChange?.(player.playerId, { playerName: nextName });
  };
  header.appendChild(nameInput);
  card.appendChild(header);

  // Canvas container with fixed height
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    width: 100%;
    height: 240px;
    background: #060a14;
    position: relative;
    flex-shrink: 0;
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `width: 100%; height: 100%; display: block;`;
  canvasContainer.appendChild(canvas);

  const initialDisplayColor = numToHexCss(getDisplayColor(player.color));
  const colorBar = document.createElement('div');
  colorBar.dataset.role = 'color-bar';
  colorBar.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${initialDisplayColor};
    box-shadow: 0 0 8px ${initialDisplayColor};
  `;
  canvasContainer.appendChild(colorBar);
  card.appendChild(canvasContainer);

  const resizeObserver = new ResizeObserver(() => {
    const instance = previewInstances.get(player.playerId);
    if (instance?.renderer && instance.camera) {
      const w = canvasContainer.clientWidth;
      const h = canvasContainer.clientHeight;
      if (w > 0 && h > 0) {
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        instance.renderer.setSize(w, h);
        instance.camera.aspect = w / h;
        instance.camera.updateProjectionMatrix();
      }
    }
  });
  resizeObserver.observe(canvasContainer);

  // Customization section
  const customSection = document.createElement('div');
  customSection.style.cssText = `
    padding: 0.65rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid rgba(${accentRgb},0.12);
  `;

  const makeSectionLabel = (text: string): HTMLElement => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      color: rgba(${accentRgb},0.6);
      font-family: ${fontStack};
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
    `;
    return el;
  };

  // --- COLOR SELECTION ---
  customSection.appendChild(makeSectionLabel('PAINT'));

  const COLOR_CATS = [
    { key: 'all', label: 'ALL' },
    { key: 'neon', label: 'Neon' },
    { key: 'metallic', label: 'Metallic' },
    { key: 'jewel', label: 'Jewel' },
    { key: 'dark', label: 'Dark' },
    { key: 'patterns', label: 'Special' },
  ];

  const tabsRow = document.createElement('div');
  tabsRow.style.cssText = `display: flex; gap: 3px; flex-wrap: wrap;`;

  const swatchGrid = document.createElement('div');
  swatchGrid.className = 'rl-swatch-grid';
  swatchGrid.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 4px 0;
    max-height: 96px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(${accentRgb},0.3) transparent;
    align-items: flex-start;
  `;

  let activeCat = 'all';

  const CAT_KEY_MAP: Record<string, keyof typeof COLOR_PALETTE> = {
    neon: 'neon', dark: 'dark', metallic: 'metallic', jewel: 'jewel',
    pastel: 'pastel', earth: 'earth', vivid: 'vivid', mono: 'monochrome',
  };

  const renderSwatches = (catKey: string): void => {
    swatchGrid.innerHTML = '';
    const allPatterns = getAllPatterns();

    type SwatchItem = { colorHex: number | string; displayHex: number; name: string; isPattern: boolean; patternId?: string };
    const items: SwatchItem[] = [];

    if (catKey === 'all') {
      getAllPaletteColors().forEach(c => items.push({ colorHex: c.hex, displayHex: c.hex, name: c.name, isPattern: false }));
      allPatterns.forEach(p => items.push({ colorHex: p.id, displayHex: getDisplayColor(p.id), name: p.name, isPattern: true, patternId: p.id }));
    } else if (catKey === 'patterns') {
      allPatterns.forEach(p => items.push({ colorHex: p.id, displayHex: getDisplayColor(p.id), name: p.name, isPattern: true, patternId: p.id }));
    } else {
      const pk = CAT_KEY_MAP[catKey];
      if (pk) COLOR_PALETTE[pk].forEach(c => items.push({ colorHex: c.hex, displayHex: c.hex, name: c.name, isPattern: false }));
    }

    items.forEach(({ colorHex, displayHex, name, isPattern, patternId }) => {
      const swatch = document.createElement('button');
      const displayCss = numToHexCss(displayHex);
      const isSelected = isPattern
        ? (isPatternId(player.color) && player.color === colorHex)
        : (typeof player.color === 'number' && player.color === colorHex);

      swatch.type = 'button';
      swatch.title = name;
      swatch.dataset.colorCss = displayCss;
      swatch.dataset.selected = isSelected ? '1' : '0';

      let bgStyle = `background: ${displayCss};`;
      if (isPattern && patternId) {
        const pc = createSwatchCanvas(patternId, 56);
        bgStyle = `background: url(${pc.toDataURL()}) center/cover;`;
      }

      swatch.style.cssText = `
        width: 26px;
        height: 26px;
        min-width: 26px;
        min-height: 26px;
        padding: 0;
        box-sizing: border-box;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid ${isSelected ? '#ffffff' : 'transparent'};
        ${bgStyle}
        box-shadow: ${isSelected ? `0 0 0 1px rgba(0,0,0,0.5), 0 0 8px ${displayCss}99` : `0 0 3px ${displayCss}55`};
        transition: transform 0.1s;
        flex-shrink: 0;
      `;
      swatch.onmouseover = () => { swatch.style.transform = 'scale(1.2)'; };
      swatch.onmouseout = () => { swatch.style.transform = 'scale(1)'; };

      swatch.onclick = () => {
        swatchGrid.querySelectorAll('button').forEach(el => {
          const s = el as HTMLButtonElement;
          s.dataset.selected = '0';
          s.style.border = '2px solid transparent';
          const sc = s.dataset.colorCss;
          if (sc) s.style.boxShadow = `0 0 3px ${sc}55`;
        });
        swatch.dataset.selected = '1';
        swatch.style.border = '2px solid #ffffff';
        swatch.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.5), 0 0 8px ${displayCss}99`;

        colorBar.style.background = displayCss;
        colorBar.style.boxShadow = `0 0 8px ${displayCss}`;

        player.color = colorHex;

        const inst = previewInstances.get(player.playerId);
        if (inst) {
          if (isPattern && patternId) {
            if (inst.ball) {
              const oldMat = inst.ball.material as THREE.Material;
              inst.ball.material = createBallMaterial(patternId);
              oldMat.dispose();
            }
            if (inst.aura?.material) {
              (inst.aura.material as THREE.MeshStandardMaterial).color.setHex(getPatternEmissiveColor(patternId));
            }
          } else {
            updatePreviewColor(inst, colorHex as number);
          }
        }

        const store = useGameStore.getState();
        if (player.playerId === 'player1') {
          store.setPlayerColors(colorHex, store.p2Color);
        } else {
          store.setPlayerColors(store.p1Color, colorHex);
        }
        onPlayerStateChange?.(player.playerId, { color: colorHex });
      };

      swatchGrid.appendChild(swatch);
    });
  };

  COLOR_CATS.forEach(({ key, label }) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = label;
    tab.dataset.catKey = key;
    const isActive = key === activeCat;
    tab.style.cssText = `
      padding: 2px 6px;
      border-radius: 3px;
      font-family: ${fontStack};
      font-size: 0.57rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      border: 1px solid rgba(${accentRgb},${isActive ? '0.75' : '0.22'});
      background: rgba(${accentRgb},${isActive ? '0.22' : '0.04'});
      color: ${isActive ? accentCss : `rgba(${accentRgb},0.5)`};
      transition: all 0.12s;
    `;
    tab.onclick = () => {
      activeCat = key;
      tabsRow.querySelectorAll('button').forEach(el => {
        const t = el as HTMLButtonElement;
        const active = t.dataset.catKey === key;
        t.style.border = `1px solid rgba(${accentRgb},${active ? '0.75' : '0.22'})`;
        t.style.background = `rgba(${accentRgb},${active ? '0.22' : '0.04'})`;
        t.style.color = active ? accentCss : `rgba(${accentRgb},0.5)`;
      });
      renderSwatches(key);
    };
    tabsRow.appendChild(tab);
  });

  customSection.appendChild(tabsRow);
  customSection.appendChild(swatchGrid);
  renderSwatches(activeCat);

  // --- HAT SELECTION ---
  customSection.appendChild(makeSectionLabel('HEADGEAR'));

  const hatRow = document.createElement('div');
  hatRow.style.cssText = `display: flex; flex-wrap: wrap; gap: 4px;`;

  let currentHat = player.hat;

  HAT_VALUES.forEach(hatType => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = HAT_LABELS[hatType] ?? hatType;
    chip.dataset.hatType = hatType;
    const isSel = hatType === currentHat;
    chip.style.cssText = `
      padding: 3px 10px;
      border-radius: 4px;
      font-family: ${fontStack};
      font-size: 0.67rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      border: 1px solid rgba(${accentRgb},${isSel ? '0.85' : '0.22'});
      background: rgba(${accentRgb},${isSel ? '0.28' : '0.04'});
      color: ${isSel ? '#ffffff' : `rgba(${accentRgb},0.55)`};
      transition: all 0.12s;
    `;
    chip.onclick = () => {
      currentHat = hatType;
      hatRow.querySelectorAll('button').forEach(el => {
        const c = el as HTMLButtonElement;
        const active = c.dataset.hatType === hatType;
        c.style.border = `1px solid rgba(${accentRgb},${active ? '0.85' : '0.22'})`;
        c.style.background = `rgba(${accentRgb},${active ? '0.28' : '0.04'})`;
        c.style.color = active ? '#ffffff' : `rgba(${accentRgb},0.55)`;
      });
      const store = useGameStore.getState();
      if (player.playerId === 'player1') {
        store.setPlayerHats(hatType, store.p2Hat);
      } else {
        store.setPlayerHats(store.p1Hat, hatType);
      }
      const inst = previewInstances.get(player.playerId);
      if (inst) updatePreviewHat(inst, hatType);
      onPlayerStateChange?.(player.playerId, { hat: hatType });
    };
    hatRow.appendChild(chip);
  });

  customSection.appendChild(hatRow);
  card.appendChild(customSection);

  return card;
}

/**
 * Initialize Three.js preview scene for a single player
 */
function initializePreview(canvas: HTMLCanvasElement, initialColor: number | string, initialHat: string): PreviewInstance {
  const width = canvas.clientWidth || 350;
  const height = canvas.clientHeight || 200;
  const sphereSize = 1.0;

  canvas.width = width;
  canvas.height = height;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);

  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
  camera.position.set(0, 2.5, 5);
  camera.lookAt(0, 1.2, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = false;

  const ambientLight = new THREE.AmbientLight(0x1a2a4a, 0.9);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  pointLight.position.set(3, 4, 3);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0x4488cc, 0.35);
  pointLight2.position.set(-3, 2, -1);
  scene.add(pointLight2);

  const ballGeometry = new THREE.SphereGeometry(sphereSize, 16, 16);
  const ballMaterial = createBallMaterial(initialColor) as THREE.MeshStandardMaterial;
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  scene.add(ball);

  const auraGeometry = new THREE.SphereGeometry(1.15 * sphereSize, 16, 16);
  const auraColor = typeof initialColor === 'number' ? initialColor : getPatternEmissiveColor(initialColor);
  const auraMaterial = new THREE.MeshStandardMaterial({
    color: auraColor,
    metalness: 0,
    roughness: 1,
    transparent: true,
    opacity: 0.25,
    side: THREE.BackSide,
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  scene.add(aura);

  const groundGeometry = new THREE.PlaneGeometry(8, 8);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x050d1a,
    metalness: 0.1,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(8, 14, 0x0d2540, 0x091828);
  gridHelper.position.y = -1.49;
  scene.add(gridHelper);

  const hatResult: HatResult | null = createHatMesh(initialHat, sphereSize);
  let hatGroup: THREE.Group | null = null;
  let hatSantaData: {
    santaSegments: SantaSegment[];
    santaPomGroup: THREE.Group | null;
    santaDroopX: number;
    santaDroopZ: number;
  } | null = null;

  if (hatResult) {
    hatGroup = hatResult.group;
    scene.add(hatGroup);
    hatSantaData = {
      santaSegments: hatResult.santaSegments,
      santaPomGroup: hatResult.santaPomGroup,
      santaDroopX: hatResult.santaDroopX,
      santaDroopZ: hatResult.santaDroopZ,
    };
  }

  renderer.render(scene, camera);

  return {
    scene,
    camera,
    renderer,
    ball,
    aura,
    ground,
    hatGroup,
    hatSantaData,
    hatPhysics: createHatPhysicsState(),
    sphereSize,
    animationId: null,
    ballPosition: new THREE.Vector3(0, 0, 0),
    ballVelocity: new THREE.Vector3(1.5, 0, 1.5),
    rotationX: 0,
    rotationY: 0,
  };
}

/**
 * Start animation loop for preview
 */
export function startPreviewAnimation(instance: PreviewInstance): void {
  if (!instance.renderer || !instance.ball) return;

  let lastTime = Date.now();
  let directionChangeTimer = 2;

  const animate = () => {
    instance.animationId = requestAnimationFrame(animate);

    const now = Date.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    directionChangeTimer -= dt;
    if (directionChangeTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      instance.ballVelocity.x = Math.cos(angle) * 1.5;
      instance.ballVelocity.z = Math.sin(angle) * 1.5;
      directionChangeTimer = 2 + Math.random() * 1;
    }

    instance.ballPosition.x += instance.ballVelocity.x * dt;
    instance.ballPosition.z += instance.ballVelocity.z * dt;

    const boundary = 2;
    if (Math.abs(instance.ballPosition.x) > boundary) {
      instance.ballPosition.x = Math.sign(instance.ballPosition.x) * boundary;
      instance.ballVelocity.x *= -0.9;
    }
    if (Math.abs(instance.ballPosition.z) > boundary) {
      instance.ballPosition.z = Math.sign(instance.ballPosition.z) * boundary;
      instance.ballVelocity.z *= -0.9;
    }

    instance.ball.position.copy(instance.ballPosition);

    const speed = instance.ballVelocity.length();
    if (speed > 0.1) {
      const rollAxis = new THREE.Vector3(-instance.ballVelocity.z, 0, instance.ballVelocity.x).normalize();
      const rollAmount = speed * dt;
      const rollQuat = new THREE.Quaternion();
      rollQuat.setFromAxisAngle(rollAxis, rollAmount);
      instance.ball.quaternion.multiplyQuaternions(rollQuat, instance.ball.quaternion);
    }

    instance.rotationX += 0.004;
    instance.rotationY += 0.006;

    if (instance.aura) {
      instance.aura.position.copy(instance.ballPosition);
      instance.aura.rotation.x = instance.rotationX * 0.5;
      instance.aura.rotation.y = instance.rotationY * 0.5;
    }

    if (instance.hatGroup && instance.hatPhysics && instance.hatSantaData) {
      instance.hatPhysics.santaSegments = instance.hatSantaData.santaSegments;
      instance.hatPhysics.santaDroopX = instance.hatSantaData.santaDroopX;
      instance.hatPhysics.santaDroopZ = instance.hatSantaData.santaDroopZ;

      updateHatPhysics(
        instance.hatGroup,
        { x: instance.ballVelocity.x, y: 0, z: instance.ballVelocity.z },
        instance.ball.position,
        instance.sphereSize,
        instance.hatPhysics,
        dt,
        instance.hatSantaData.santaPomGroup,
      );

      instance.hatSantaData.santaDroopX = instance.hatPhysics.santaDroopX;
      instance.hatSantaData.santaDroopZ = instance.hatPhysics.santaDroopZ;
    }

    instance.renderer.render(instance.scene!, instance.camera!);
  };

  animate();
}

/**
 * Update preview color
 */
export function updatePreviewColor(instance: PreviewInstance, color: number | string): void {
  if (instance.ball) {
    const oldMaterial = instance.ball.material as THREE.Material;
    instance.ball.material = createBallMaterial(color);
    oldMaterial.dispose();
  }
  if (instance.aura?.material) {
    const auraColor = typeof color === 'number' ? color : getPatternEmissiveColor(color);
    (instance.aura.material as THREE.MeshStandardMaterial).color.setHex(auraColor);
  }
}

export function updatePreviewHat(instance: PreviewInstance, hatType: string): void {
  if (instance.hatGroup) {
    disposeHatGroup(instance.hatGroup);
    instance.scene?.remove(instance.hatGroup);
  }

  instance.hatGroup = null;
  instance.hatSantaData = null;
  instance.hatPhysics = createHatPhysicsState();

  const hatResult = createHatMesh(hatType, instance.sphereSize);
  if (hatResult) {
    instance.hatGroup = hatResult.group;
    instance.scene?.add(hatResult.group);
    instance.hatSantaData = {
      santaSegments: hatResult.santaSegments,
      santaPomGroup: hatResult.santaPomGroup,
      santaDroopX: hatResult.santaDroopX,
      santaDroopZ: hatResult.santaDroopZ,
    };
  }
}

export function destroyPreviewPanel(): void {
  cachedLevelSummaries = null;

  for (const [, instance] of previewInstances) {
    if (instance.animationId) {
      cancelAnimationFrame(instance.animationId);
      instance.animationId = null;
    }

    if (instance.hatGroup) {
      disposeHatGroup(instance.hatGroup);
      instance.scene?.remove(instance.hatGroup);
      instance.hatGroup = null;
    }

    if (instance.ball) {
      instance.scene?.remove(instance.ball);
      instance.ball.geometry.dispose();
      const material = instance.ball.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
      instance.ball = null;
    }

    if (instance.aura) {
      instance.scene?.remove(instance.aura);
      instance.aura.geometry.dispose();
      const material = instance.aura.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
      instance.aura = null;
    }

    if (instance.ground) {
      instance.scene?.remove(instance.ground);
      instance.ground.geometry.dispose();
      const material = instance.ground.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
      instance.ground = null;
    }

    instance.renderer?.dispose();
    instance.renderer = null;
    instance.scene = null;
    instance.camera = null;
  }

  previewInstances.clear();
}
