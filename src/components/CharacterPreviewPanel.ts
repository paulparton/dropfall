/**
 * Character Preview Panel - Dual side-by-side player previews for game settings
 * Self-contained player cards with inline name, color, hat, and 3D preview controls
 */

import { COLOR_PALETTE, getAllPatterns, isPatternId, getDisplayColor, PatternOption } from './ColorPalette.js';
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
    const providerModulePath = '../levels/' + 'levelProvider.js';
    const module = await import(providerModulePath) as {
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
    const modalModulePath = './' + 'LevelSelectModal.js';
    const module = await import(modalModulePath) as { createLevelSelectModal?: LevelSelectFactory };
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
    .character-preview-color-strip::-webkit-scrollbar {
      display: none;
    }
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
      btn.onmouseover = () => {
        btn.style.background = 'rgba(0, 255, 255, 0.3)';
      };
      btn.onmouseout = () => {
        btn.style.background = 'rgba(0, 255, 255, 0.2)';
      };
      btn.onclick = () => {
        onPlayerStateChange?.('player1', { difficulty: diff });
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
    align-items: stretch;
    flex: 1;
    min-height: 0;
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
 * Create a single player card with all controls embedded
 */
function createPlayerCard(player: PreviewPlayerState, onPlayerStateChange?: Function, isMultiplayer?: boolean): HTMLElement {
  const isP1 = player.playerId === 'player1';
  const playerLabel = isP1 ? 'PLAYER 1' : (isMultiplayer ? 'PLAYER 2' : 'CPU');
  const playerColorCss = numToHexCss(getDisplayColor(player.color));

  const card = document.createElement('div');
  card.style.cssText = `
    flex: 1 1 0;
    max-width: 400px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding: 1rem;
    background: rgba(0, 255, 255, 0.04);
    border: 2px solid ${playerColorCss};
    border-radius: 8px;
    box-shadow: 0 0 18px ${playerColorCss}33;
  `;

  const label = document.createElement('h3');
  label.textContent = playerLabel;
  label.style.cssText = `
    color: ${playerColorCss};
    margin: 0;
    text-align: center;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 0 0 8px ${playerColorCss};
  `;
  card.appendChild(label);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 12;
  nameInput.placeholder = 'Enter name...';
  nameInput.value = player.playerName;
  nameInput.style.cssText = `
    background: #0a0a1a;
    border: 2px solid ${playerColorCss};
    color: #ffffff;
    font-family: 'Courier New', monospace;
    padding: 6px 10px;
    width: 100%;
    box-sizing: border-box;
  `;
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
  card.appendChild(nameInput);

  // Canvas container - intentionally kept identical to previous layout styles
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    width: 100%;
    flex: 1;
    min-height: 200px;
    background: rgba(0, 0, 0, 0.6);
    border: 2px dashed ${playerColorCss};
    border-radius: 8px;
    overflow: hidden;
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    width: 100%;
    height: 100%;
    display: block;
  `;
  canvasContainer.appendChild(canvas);
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

  const colorBar = document.createElement('div');
  colorBar.dataset.role = 'color-bar';
  colorBar.style.cssText = `
    width: 100%;
    height: 4px;
    background: ${playerColorCss};
    box-shadow: 0 0 12px ${playerColorCss};
  `;
  card.appendChild(colorBar);

  const colorStrip = document.createElement('div');
  colorStrip.className = 'character-preview-color-strip';
  colorStrip.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 6px;
    padding: 8px 4px;
    scrollbar-width: none;
    -ms-overflow-style: none;
    min-width: 0;
    flex: 1;
  `;

  const paletteColors = getAllPaletteColors();
  paletteColors.forEach((color) => {
    const swatch = document.createElement('button');
    const colorCss = numToHexCss(color.hex);
    swatch.type = 'button';
    swatch.title = color.name;
    swatch.dataset.colorCss = colorCss;
    swatch.style.cssText = `
      width: 32px;
      min-width: 32px;
      min-height: 32px;
      aspect-ratio: 1;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
      scroll-snap-align: start;
      border: none;
      background: ${colorCss};
      box-shadow: ${color.hex === player.color ? `0 0 6px 2px ${colorCss}55, 0 0 0 3px #ffff00` : `0 0 6px 2px ${colorCss}55`};
    `;

    swatch.onclick = () => {
      const swatches = colorStrip.querySelectorAll('button');
      swatches.forEach((element) => {
        const swatchElement = element as HTMLButtonElement;
        const swatchColorCss = swatchElement.dataset.colorCss;
        if (swatchColorCss) {
          swatchElement.style.boxShadow = `0 0 6px 2px ${swatchColorCss}55`;
        }
      });
      swatch.style.boxShadow = `0 0 6px 2px ${colorCss}55, 0 0 0 3px #ffff00`;

      colorBar.style.background = colorCss;
      colorBar.style.boxShadow = `0 0 12px ${colorCss}`;
      card.style.borderColor = colorCss;
      card.style.boxShadow = `0 0 18px ${colorCss}33`;
      label.style.color = colorCss;
      label.style.textShadow = `0 0 8px ${colorCss}`;
      nameInput.style.borderColor = colorCss;
      hatSelect.style.borderColor = colorCss;
      hatSelect.style.color = colorCss;
      canvasContainer.style.borderColor = colorCss;

      const instance = previewInstances.get(player.playerId);
      if (instance) {
        updatePreviewColor(instance, color.hex);
      }

      const s = useGameStore.getState();
      if (player.playerId === 'player1') {
        s.setPlayerColors(color.hex, s.p2Color);
      } else {
        s.setPlayerColors(s.p1Color, color.hex);
      }

      onPlayerStateChange?.(player.playerId, { color: color.hex });
    };

    colorStrip.appendChild(swatch);
  });

  // Add separator
  const separator = document.createElement('div');
  separator.style.cssText = `
    width: 2px;
    height: 28px;
    background: rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
    margin: 0 4px;
    border-radius: 1px;
  `;
  colorStrip.appendChild(separator);

  // Add pattern swatches
  const patterns: PatternOption[] = getAllPatterns();
  patterns.forEach((pattern) => {
    const swatch = document.createElement('button');
    const displayColor = getDisplayColor(pattern.id);
    const displayColorCss = numToHexCss(displayColor);
    swatch.type = 'button';
    swatch.title = pattern.name;
    swatch.dataset.colorCss = displayColorCss;
    swatch.dataset.patternId = pattern.id;

    // Use canvas for pattern preview background
    const previewCanvas = createSwatchCanvas(pattern.id, 64);
    swatch.style.cssText = `
      width: 32px;
      min-width: 32px;
      min-height: 32px;
      aspect-ratio: 1;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
      scroll-snap-align: start;
      border: none;
      background-image: url(${previewCanvas.toDataURL()});
      background-size: cover;
      box-shadow: ${pattern.id === (isPatternId(player.color) ? player.color : '') ? `0 0 6px 2px ${displayColorCss}55, 0 0 0 3px #ffff00` : `0 0 6px 2px ${displayColorCss}55`};
    `;

    swatch.onclick = () => {
      // Reset ALL swatches (both solid and pattern)
      const allSwatches = colorStrip.querySelectorAll('button');
      allSwatches.forEach((element) => {
        const el = element as HTMLButtonElement;
        const swatchColorCss = el.dataset.colorCss;
        if (swatchColorCss) {
          el.style.boxShadow = `0 0 6px 2px ${swatchColorCss}55`;
        }
      });
      swatch.style.boxShadow = `0 0 6px 2px ${displayColorCss}55, 0 0 0 3px #ffff00`;

      // Update card UI elements with the pattern's display color
      colorBar.style.background = displayColorCss;
      colorBar.style.boxShadow = `0 0 12px ${displayColorCss}`;
      card.style.borderColor = displayColorCss;
      card.style.boxShadow = `0 0 18px ${displayColorCss}33`;
      label.style.color = displayColorCss;
      label.style.textShadow = `0 0 8px ${displayColorCss}`;
      nameInput.style.borderColor = displayColorCss;
      hatSelect.style.borderColor = displayColorCss;
      hatSelect.style.color = displayColorCss;
      canvasContainer.style.borderColor = displayColorCss;

      // Update 3D preview with pattern material
      const instance = previewInstances.get(player.playerId);
      if (instance && instance.ball) {
        const oldMaterial = instance.ball.material as THREE.Material;
        instance.ball.material = createBallMaterial(pattern.id);
        oldMaterial.dispose();
      }

      // Update store
      const s = useGameStore.getState();
      if (player.playerId === 'player1') {
        s.setPlayerColors(pattern.id, s.p2Color);
      } else {
        s.setPlayerColors(s.p1Color, pattern.id);
      }

      onPlayerStateChange?.(player.playerId, { color: pattern.id });
    };

    colorStrip.appendChild(swatch);
  });

  const colorStripWrapper = document.createElement('div');
  colorStripWrapper.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
  `;

  const scrollLeft = document.createElement('button');
  scrollLeft.type = 'button';
  scrollLeft.innerHTML = '&#9664;';
  scrollLeft.style.cssText = `
    flex-shrink: 0;
    width: 24px;
    height: 32px;
    background: transparent;
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: 4px;
    color: #0ff;
    font-size: 12px;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    padding: 0;
  `;
  scrollLeft.onmouseover = () => { scrollLeft.style.opacity = '1'; };
  scrollLeft.onmouseout = () => { scrollLeft.style.opacity = '0.6'; };
  scrollLeft.onclick = () => { colorStrip.scrollBy({ left: -120, behavior: 'smooth' }); };

  const scrollRight = document.createElement('button');
  scrollRight.type = 'button';
  scrollRight.innerHTML = '&#9654;';
  scrollRight.style.cssText = `
    flex-shrink: 0;
    width: 24px;
    height: 32px;
    background: transparent;
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: 4px;
    color: #0ff;
    font-size: 12px;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    padding: 0;
  `;
  scrollRight.onmouseover = () => { scrollRight.style.opacity = '1'; };
  scrollRight.onmouseout = () => { scrollRight.style.opacity = '0.6'; };
  scrollRight.onclick = () => { colorStrip.scrollBy({ left: 120, behavior: 'smooth' }); };

  colorStripWrapper.append(scrollLeft, colorStrip, scrollRight);
  card.appendChild(colorStripWrapper);

  const hatSelect = document.createElement('select');
  hatSelect.style.cssText = `
    width: 100%;
    background: #0a0a1a;
    color: ${playerColorCss};
    border: 2px solid ${playerColorCss};
    font-family: 'Courier New', monospace;
    padding: 4px;
    box-sizing: border-box;
  `;

  for (const hatType of HAT_VALUES) {
    const option = document.createElement('option');
    option.value = hatType;
    option.textContent = HAT_LABELS[hatType] || hatType;
    hatSelect.appendChild(option);
  }
  hatSelect.value = player.hat;

  hatSelect.onchange = () => {
    const newHatValue = hatSelect.value;
    const s = useGameStore.getState();

    if (player.playerId === 'player1') {
      s.setPlayerHats(newHatValue, s.p2Hat);
    } else {
      s.setPlayerHats(s.p1Hat, newHatValue);
    }

    const instance = previewInstances.get(player.playerId);
    if (instance) {
      updatePreviewHat(instance, newHatValue);
    }

    onPlayerStateChange?.(player.playerId, { hat: newHatValue });
  };

  card.appendChild(hatSelect);

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
  scene.background = new THREE.Color(0x1a1a1a);

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

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.6);
  pointLight.position.set(2, 2, 2);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0xffffff, 0.4);
  pointLight2.position.set(-2, 3, 1);
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

  const groundGeometry = new THREE.PlaneGeometry(6, 6);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a4a2a,
    metalness: 0.0,
    roughness: 0.8,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  scene.add(ground);

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
