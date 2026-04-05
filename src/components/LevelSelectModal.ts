import { createLevelThumbnailCanvas, type LevelTile } from '../utils/levelThumbnail.js';

export interface LevelSummary {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  tileCount: number;
  isDemo: boolean;
}

type LevelWithOptionalTiles = LevelSummary & {
  tiles?: LevelTile[];
};

function formatDifficulty(difficulty: string): string {
  if (!difficulty) {
    return 'Unknown';
  }

  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
}

function createActionButton(label: string, isConfirm: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = isConfirm
    ? `
      padding: 12px 28px;
      border-radius: 8px;
      border: 2px solid #00ffff;
      background: linear-gradient(135deg, rgba(0, 255, 255, 0.28), rgba(0, 120, 255, 0.4));
      color: #e8ffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.2s ease;
      box-shadow: 0 0 18px rgba(0, 255, 255, 0.3);
    `
    : `
      padding: 12px 28px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(20, 22, 40, 0.9);
      color: #d0d5ff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      cursor: pointer;
      text-transform: uppercase;
      transition: all 0.2s ease;
    `;

  button.addEventListener('mouseenter', () => {
    if (isConfirm) {
      button.style.boxShadow = '0 0 26px rgba(0, 255, 255, 0.55)';
      button.style.borderColor = '#7affff';
    } else {
      button.style.borderColor = '#00cfff';
      button.style.color = '#eef4ff';
    }
  });

  button.addEventListener('mouseleave', () => {
    if (isConfirm) {
      button.style.boxShadow = '0 0 18px rgba(0, 255, 255, 0.3)';
      button.style.borderColor = '#00ffff';
    } else {
      button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      button.style.color = '#d0d5ff';
    }
  });

  return button;
}

export function createLevelSelectModal(
  levels: LevelSummary[],
  currentLevelId: string,
  onSelect: (id: string) => void,
  onCancel: () => void,
): {
  modal: HTMLElement;
  close: () => void;
} {
  const overlay = document.createElement('div');
  overlay.id = 'level-select-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(3, 6, 18, 0.82);
    backdrop-filter: blur(2px);
    padding: 24px;
    box-sizing: border-box;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    width: min(980px, 100%);
    max-height: min(86vh, 860px);
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: relative;
    background: linear-gradient(160deg, rgba(8, 10, 28, 0.98), rgba(17, 12, 44, 0.98));
    border: 2px solid #00eaff;
    border-radius: 16px;
    padding: 20px;
    color: #ffffff;
    font-family: Arial, sans-serif;
    box-shadow: 0 0 55px rgba(0, 234, 255, 0.35), inset 0 0 24px rgba(0, 234, 255, 0.1);
  `;

  const title = document.createElement('h2');
  title.textContent = 'SELECT ARENA';
  title.style.cssText = `
    margin: 0;
    text-align: center;
    color: #00f7ff;
    letter-spacing: 2px;
    font-size: clamp(24px, 3vw, 34px);
    text-shadow: 0 0 16px rgba(0, 247, 255, 0.65);
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Choose your battleground before the match starts.';
  subtitle.style.cssText = `
    margin: 0;
    text-align: center;
    color: rgba(198, 240, 255, 0.75);
    font-size: 13px;
    letter-spacing: 0.5px;
  `;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close level selector');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(0, 255, 255, 0.55);
    background: rgba(9, 20, 50, 0.9);
    color: #d5fcff;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
  `;

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.borderColor = '#7affff';
    closeButton.style.boxShadow = '0 0 16px rgba(0, 255, 255, 0.5)';
  });

  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.borderColor = 'rgba(0, 255, 255, 0.55)';
    closeButton.style.boxShadow = 'none';
  });

  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
    overflow-y: auto;
    min-height: 220px;
    max-height: min(52vh, 540px);
    padding: 4px;
  `;

  let selectedLevelId = currentLevelId;
  const cardMap = new Map<string, HTMLElement>();

  function updateSelectedState(): void {
    cardMap.forEach((card, levelId) => {
      const isSelected = levelId === selectedLevelId;
      card.style.borderColor = isSelected ? '#00ffff' : 'rgba(110, 184, 255, 0.35)';
      card.style.boxShadow = isSelected
        ? '0 0 24px rgba(0, 255, 255, 0.45), inset 0 0 20px rgba(0, 255, 255, 0.12)'
        : '0 0 0 rgba(0, 0, 0, 0)';
      card.style.transform = isSelected ? 'translateY(-2px)' : 'translateY(0)';
      card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function createDefaultPlaceholder(): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      height: 100px;
      border-radius: 10px;
      border: 1px dashed rgba(0, 255, 255, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      background: repeating-linear-gradient(
        45deg,
        rgba(9, 30, 65, 0.5),
        rgba(9, 30, 65, 0.5) 8px,
        rgba(4, 14, 36, 0.5) 8px,
        rgba(4, 14, 36, 0.5) 16px
      );
      color: rgba(165, 241, 255, 0.8);
      text-align: center;
      font-size: 12px;
      letter-spacing: 0.8px;
      padding: 0 10px;
      box-sizing: border-box;
    `;
    placeholder.textContent = 'Standard Hex Grid';
    return placeholder;
  }

  function createLevelCard(level: LevelSummary): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.style.cssText = `
      text-align: left;
      border-radius: 12px;
      border: 2px solid rgba(110, 184, 255, 0.35);
      background: linear-gradient(155deg, rgba(12, 22, 58, 0.95), rgba(7, 10, 30, 0.95));
      color: white;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 220px;
      position: relative;
      box-sizing: border-box;
    `;

    const heading = document.createElement('div');
    heading.style.cssText = `
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: #dff9ff;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.25);
      line-height: 1.3;
    `;
    heading.textContent = level.name;

    const description = document.createElement('div');
    description.style.cssText = `
      font-size: 12px;
      color: rgba(195, 227, 255, 0.76);
      line-height: 1.35;
      min-height: 34px;
      overflow: hidden;
    `;
    description.textContent = level.description;

    const thumbFrame = document.createElement('div');
    thumbFrame.style.cssText = `
      height: 100px;
      border-radius: 10px;
      border: 1px solid rgba(0, 225, 255, 0.28);
      overflow: hidden;
      background: #1a1a2e;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const levelWithTiles = level as LevelWithOptionalTiles;
    const tiles = Array.isArray(levelWithTiles.tiles) ? levelWithTiles.tiles : [];

    if (level.id === 'default') {
      thumbFrame.appendChild(createDefaultPlaceholder());
    } else if (tiles.length > 0) {
      const thumbnailCanvas = createLevelThumbnailCanvas(tiles, 156, 100);
      thumbnailCanvas.style.cssText = 'width: 100%; height: 100%; display: block;';
      thumbFrame.appendChild(thumbnailCanvas);
    } else {
      const noPreview = document.createElement('div');
      noPreview.style.cssText = `
        color: rgba(166, 219, 255, 0.75);
        font-size: 12px;
        letter-spacing: 0.5px;
      `;
      noPreview.textContent = 'No preview data';
      thumbFrame.appendChild(noPreview);
    }

    const details = document.createElement('div');
    details.style.cssText = `
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: rgba(199, 232, 255, 0.9);
    `;

    const tileCount = document.createElement('span');
    tileCount.textContent = `${level.tileCount} tiles`;

    const difficulty = document.createElement('span');
    difficulty.textContent = `Difficulty: ${formatDifficulty(level.difficulty)}`;
    difficulty.style.color = '#ffd770';

    details.appendChild(tileCount);
    details.appendChild(difficulty);

    if (level.isDemo) {
      const demoBadge = document.createElement('span');
      demoBadge.textContent = 'DEMO';
      demoBadge.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(0, 255, 255, 0.55);
        background: rgba(0, 255, 255, 0.18);
        color: #9fffff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
      `;
      card.appendChild(demoBadge);
    }

    card.appendChild(heading);
    card.appendChild(description);
    card.appendChild(thumbFrame);
    card.appendChild(details);

    card.addEventListener('mouseenter', () => {
      const isSelected = selectedLevelId === level.id;
      if (!isSelected) {
        card.style.borderColor = 'rgba(100, 240, 255, 0.85)';
        card.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.28)';
      }
    });

    card.addEventListener('mouseleave', () => {
      updateSelectedState();
    });

    card.addEventListener('click', () => {
      selectedLevelId = level.id;
      updateSelectedState();
    });

    return card;
  }

  levels.forEach((level) => {
    const card = createLevelCard(level);
    cardMap.set(level.id, card);
    grid.appendChild(card);
  });

  if (!cardMap.has(selectedLevelId) && levels.length > 0) {
    selectedLevelId = levels[0]?.id ?? 'default';
  }

  updateSelectedState();

  const actions = document.createElement('div');
  actions.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid rgba(0, 255, 255, 0.18);
    padding-top: 14px;
  `;

  const confirmButton = createActionButton('Confirm', true);
  const cancelButton = createActionButton('Cancel', false);

  function close(): void {
    window.removeEventListener('keydown', handleKeydown);
    overlay.remove();
  }

  function handleCancel(): void {
    onCancel();
    close();
  }

  function handleConfirm(): void {
    onSelect(selectedLevelId);
    close();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }

  overlay.addEventListener('click', (event: MouseEvent) => {
    if (event.target === overlay) {
      handleCancel();
    }
  });

  panel.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
  });

  closeButton.addEventListener('click', handleCancel);
  cancelButton.addEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);

  window.addEventListener('keydown', handleKeydown);

  actions.appendChild(cancelButton);
  actions.appendChild(confirmButton);

  panel.appendChild(closeButton);
  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(grid);
  panel.appendChild(actions);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return {
    modal: overlay,
    close,
  };
}
