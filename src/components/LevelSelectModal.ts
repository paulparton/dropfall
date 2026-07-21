import { createHexArenaPreviewTiles, createLevelThumbnailCanvas, type LevelTile } from '../utils/levelThumbnail.js';

export interface LevelSummary {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  tileCount: number;
  isDemo: boolean;
  tiles?: LevelTile[];
  launchReady?: boolean;
  validationIssues?: string[];
}

interface LevelSelectOptions {
  levels: LevelSummary[];
  currentLevelId: string | null;
  onSelect: (id: string | null) => void;
  onCancel?: () => void;
}

function normalizeLevelId(id: string | null | undefined): string {
  return id && id !== 'default' ? id : 'default';
}

function formatDifficulty(difficulty: string): string {
  if (!difficulty) return 'Normal';
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
}

function resolveOptions(
  optionsOrLevels: LevelSelectOptions | LevelSummary[],
  currentLevelId?: string | null,
  onSelect?: (id: string | null) => void,
  onCancel?: () => void,
): LevelSelectOptions {
  if (Array.isArray(optionsOrLevels)) {
    return {
      levels: optionsOrLevels,
      currentLevelId: currentLevelId ?? null,
      onSelect: onSelect ?? (() => undefined),
      onCancel,
    };
  }
  return optionsOrLevels;
}

function createThumbnail(level: LevelSummary): HTMLCanvasElement {
  const tiles = level.id === 'default'
    ? createHexArenaPreviewTiles()
    : Array.isArray(level.tiles) ? level.tiles : [];
  const canvas = createLevelThumbnailCanvas(tiles, 320, 176);
  canvas.className = 'level-picker-card__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

export function createLevelSelectModal(options: LevelSelectOptions): { modal: HTMLElement; close: () => void };
export function createLevelSelectModal(
  levels: LevelSummary[],
  currentLevelId: string | null,
  onSelect: (id: string | null) => void,
  onCancel?: () => void,
): { modal: HTMLElement; close: () => void };
export function createLevelSelectModal(
  optionsOrLevels: LevelSelectOptions | LevelSummary[],
  currentLevelId?: string | null,
  legacyOnSelect?: (id: string | null) => void,
  legacyOnCancel?: () => void,
): { modal: HTMLElement; close: () => void } {
  document.getElementById('level-select-modal')?.remove();

  const options = resolveOptions(optionsOrLevels, currentLevelId, legacyOnSelect, legacyOnCancel);
  const levels = options.levels.filter((level) => level && typeof level.id === 'string');
  const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let selectedLevelId = normalizeLevelId(options.currentLevelId);
  if (!levels.some((level) => level.id === selectedLevelId)) {
    selectedLevelId = normalizeLevelId(levels[0]?.id);
  }

  const dialog = document.createElement('dialog');
  dialog.id = 'level-select-modal';
  dialog.className = 'level-picker';
  dialog.setAttribute('aria-labelledby', 'level-picker-title');

  const shell = document.createElement('div');
  shell.className = 'level-picker__shell';

  const header = document.createElement('header');
  header.className = 'level-picker__header';
  header.innerHTML = `
    <div>
      <span class="level-picker__eyebrow">ARENA SELECT</span>
      <h2 id="level-picker-title">Pick the next playground</h2>
      <p>Every active editor arena appears here automatically.</p>
    </div>
  `;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'level-picker__close';
  closeButton.setAttribute('aria-label', 'Close arena picker');
  closeButton.textContent = '×';
  header.appendChild(closeButton);

  const toolbar = document.createElement('div');
  toolbar.className = 'level-picker__toolbar';

  const count = document.createElement('span');
  count.className = 'level-picker__count';
  count.textContent = `${levels.length} ${levels.length === 1 ? 'ARENA' : 'ARENAS'} READY`;

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'level-picker__search';
  search.placeholder = 'Search arenas';
  search.setAttribute('aria-label', 'Search arenas');
  search.autocomplete = 'off';

  toolbar.append(count, search);

  const grid = document.createElement('div');
  grid.className = 'level-picker__grid';
  grid.setAttribute('aria-label', 'Available arenas');

  const empty = document.createElement('div');
  empty.className = 'level-picker__empty hidden';
  empty.innerHTML = '<strong>No arenas found</strong><span>Try a different search.</span>';

  const cardMap = new Map<string, HTMLButtonElement>();

  function updateSelectedState(): void {
    cardMap.forEach((card, levelId) => {
      const isSelected = levelId === selectedLevelId;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function selectLevel(levelId: string): void {
    selectedLevelId = normalizeLevelId(levelId);
    updateSelectedState();
  }

  levels.forEach((level) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-picker-card';
    card.dataset.levelId = level.id;
    card.dataset.search = `${level.name} ${level.description} ${level.difficulty}`.toLowerCase();
    card.setAttribute('aria-label', `${level.name}, ${formatDifficulty(level.difficulty)} difficulty`);

    const visual = document.createElement('span');
    visual.className = 'level-picker-card__visual';
    visual.appendChild(createThumbnail(level));

    const badge = document.createElement('span');
    badge.className = 'level-picker-card__badge';
    if (level.id === 'default') {
      badge.textContent = 'CORE';
    } else if (level.isDemo) {
      badge.textContent = 'OFFICIAL';
    } else if (level.launchReady === false) {
      badge.textContent = 'EXPERIMENTAL';
      badge.classList.add('level-picker-card__badge--warning');
      badge.title = level.validationIssues?.[0] ?? 'This arena has playability warnings.';
    } else {
      badge.textContent = 'CUSTOM';
    }
    visual.appendChild(badge);

    const copy = document.createElement('span');
    copy.className = 'level-picker-card__copy';
    const name = document.createElement('strong');
    name.textContent = level.name || 'Untitled Arena';
    const description = document.createElement('span');
    description.className = 'level-picker-card__description';
    description.textContent = level.description || 'A custom Dropfall playground.';
    copy.append(name, description);

    const meta = document.createElement('span');
    meta.className = 'level-picker-card__meta';
    const size = document.createElement('span');
    size.textContent = level.id === 'default' ? 'PROCEDURAL' : `${level.tileCount} TILES`;
    const difficulty = document.createElement('span');
    difficulty.textContent = formatDifficulty(level.difficulty).toUpperCase();
    meta.append(size, difficulty);
    copy.appendChild(meta);

    const check = document.createElement('span');
    check.className = 'level-picker-card__check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    card.append(visual, copy, check);
    card.addEventListener('click', () => selectLevel(level.id));
    card.addEventListener('dblclick', () => {
      selectLevel(level.id);
      handleConfirm();
    });
    cardMap.set(level.id, card);
    grid.appendChild(card);
  });

  updateSelectedState();

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;
    cardMap.forEach((card) => {
      const isVisible = !query || card.dataset.search?.includes(query) === true;
      card.classList.toggle('hidden', !isVisible);
      if (isVisible) visibleCount += 1;
    });
    count.textContent = query
      ? `${visibleCount} ${visibleCount === 1 ? 'MATCH' : 'MATCHES'}`
      : `${levels.length} ${levels.length === 1 ? 'ARENA' : 'ARENAS'} READY`;
    empty.classList.toggle('hidden', visibleCount > 0);
  });

  const footer = document.createElement('footer');
  footer.className = 'level-picker__footer';
  const hint = document.createElement('span');
  hint.className = 'level-picker__hint';
  hint.textContent = 'DOUBLE-CLICK TO CHOOSE QUICKLY';
  const actions = document.createElement('div');
  actions.className = 'level-picker__actions';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'level-picker__cancel';
  cancelButton.textContent = 'CANCEL';
  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'level-picker__confirm';
  confirmButton.textContent = 'USE ARENA';
  confirmButton.disabled = levels.length === 0;
  actions.append(cancelButton, confirmButton);
  footer.append(hint, actions);

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    priorFocus?.focus();
  }

  function handleCancel(): void {
    options.onCancel?.();
    close();
  }

  function handleConfirm(): void {
    const result = selectedLevelId === 'default' ? null : selectedLevelId;
    options.onSelect(result);
    close();
  }

  closeButton.addEventListener('click', handleCancel);
  cancelButton.addEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    handleCancel();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) handleCancel();
  });

  shell.append(header, toolbar, grid, empty, footer);
  dialog.appendChild(shell);
  document.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  const selectedCard = cardMap.get(selectedLevelId);
  (selectedCard ?? search).focus();

  return { modal: dialog, close };
}
