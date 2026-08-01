import { getAllColors, getAllPatterns, getDisplayColor, getPatternById, hexToString, isPatternId } from './ColorPalette.js';
import { useGameStore } from '../store.js';
import {
  MATCH_DEFAULTS,
  MATCH_PRESETS,
  MATCH_SETTING_GROUPS,
  MATCH_THEMES,
  formatMatchSettingValue,
} from '../../shared/matchSettings.js';
import { getHatDefinition, HAT_CATALOG } from '../utils/hatCatalog.js';
import { playHurryUpChirp } from '../audio.js';

export interface OnlineManager {
  sendCustomization: (color: number | string, hat: string, name: string) => void;
  sendReady: (ready: boolean) => void;
  startGame: () => void;
  leaveGame: () => void;
  updateGameSettings: (settings: Record<string, string | number>) => void;
  requestHurryUp: () => void;
}

type RoomSettings = Record<string, string | number>;

interface RoomPlayer {
  id?: string;
  slot?: number;
  name?: string;
  ready?: boolean;
  color?: number | string;
  hat?: string;
}

interface SettingDefinition {
  id: string;
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  format: string;
}

const HATS: ReadonlyArray<readonly [string, string]> = [
  ['none', 'No hat'],
  ...HAT_CATALOG.map((hat) => [hat.id, hat.label] as const),
];


function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeName(value: string): string {
  return value.trim().slice(0, 20);
}

function playerForSlot(game: Record<string, unknown>, slot: number): RoomPlayer | null {
  const players = Array.isArray(game.players) ? game.players as RoomPlayer[] : [];
  return players.find((player) => player?.slot === slot) || null;
}

function makeBall(color: number | string, hat: string, waiting = false): HTMLDivElement {
  const wrap = element('div', `online-room-ball${waiting ? ' online-room-ball--waiting' : ''}`);
  if (waiting) {
    wrap.append(element('span', undefined, '?'));
    return wrap;
  }

  const cssColor = hexToString(getDisplayColor(color));
  wrap.style.setProperty('--ball-color', cssColor);
  const sphere = element('div', 'online-room-ball__sphere');
  if (isPatternId(color)) {
    const pattern = getPatternById(color);
    if (pattern) {
      const colors = pattern.previewColors.map(hexToString);
      sphere.style.background = `radial-gradient(circle at 30% 24%, #fff 0 4%, transparent 18%), linear-gradient(135deg, ${colors.join(', ')})`;
    }
  }
  if (hat !== 'none') {
    const definition = getHatDefinition(hat);
    if (definition) {
      const icon = element('img', 'online-room-ball__hat') as HTMLImageElement;
      icon.src = definition.iconPath;
      icon.alt = definition.label;
      sphere.append(icon);
    }
  }
  wrap.append(sphere);
  return wrap;
}

export function createOnlineSetupPanel(
  container: HTMLElement,
  online: OnlineManager,
  _initialIsHost: boolean,
): { cleanup: () => void } {
  const initialState = useGameStore.getState();
  const initialOnline = initialState.online || {};
  const mySlot = typeof initialOnline.playerSlot === 'number' ? initialOnline.playerSlot : 1;
  const opponentSlot = mySlot === 1 ? 2 : 1;

  let localName = String(initialOnline.myName || (mySlot === 2 ? initialState.p2Name : initialState.p1Name) || 'Player').slice(0, 20);
  let localColor: number | string = mySlot === 2 ? initialState.p2Color : initialState.p1Color;
  let localHat = String(mySlot === 2 ? initialState.p2Hat : initialState.p1Hat) || 'none';
  let roomSettings: RoomSettings = {
    ...MATCH_DEFAULTS,
    ...((initialOnline.currentGame?.settings || {}) as RoomSettings),
  };
  let settingsBaseline: RoomSettings = {
    ...MATCH_DEFAULTS,
    ...((initialOnline.currentGame?.settingsBaseline || initialOnline.currentGame?.settings || {}) as RoomSettings),
  };
  let settingsTimer: number | null = null;
  let customizationTimer: number | null = null;
  let pendingSettingsJson: string | null = null;
  let hurryTimer: number | null = null;
  let hurryDeadline = 0;
  let hurrySignature = '';
  let lastHurrySecond = -1;

  const root = element('div', 'online-room');
  const header = element('header', 'online-room-header');
  const headerCopy = element('div');
  const kicker = element('p', 'multiplayer-kicker');
  kicker.append(element('span'), document.createTextNode(' Private match'));
  const title = element('h1', undefined, 'Room Setup');
  const roomMeta = element('p', 'online-room-meta', 'Synchronizing room…');
  headerCopy.append(kicker, title, roomMeta);
  const headerActions = element('div', 'online-room-header__actions');
  const roleBadge = element('span', 'online-room-role', 'PLAYER');
  const leaveButton = element('button', 'multiplayer-text-button', 'Leave Room');
  leaveButton.type = 'button';
  headerActions.append(roleBadge, leaveButton);
  header.append(headerCopy, headerActions);

  const layout = element('div', 'online-room-layout');
  const playersPanel = element('section', 'online-room-players');
  const playersHeading = element('div', 'online-room-section-heading');
  playersHeading.append(element('div', undefined, 'Competitors'), element('span', undefined, 'CUSTOMIZE & READY'));

  const makePlayerCard = (local: boolean) => {
    const card = element('article', `online-room-player online-room-player--${local ? 'local' : 'opponent'}`);
    const cardTop = element('div', 'online-room-player__top');
    const slotLabel = element('span', 'online-room-player__slot', local ? `YOU · P${mySlot}` : `RIVAL · P${opponentSlot}`);
    const readyBadge = element('span', 'online-room-ready-badge', 'NOT READY');
    cardTop.append(slotLabel, readyBadge);
    const preview = element('div', 'online-room-player__preview');
    const identity = element('div', 'online-room-player__identity');
    card.append(cardTop, preview, identity);
    return { card, slotLabel, readyBadge, preview, identity };
  };

  const localCard = makePlayerCard(true);
  const opponentCard = makePlayerCard(false);

  const nameLabel = element('label', 'online-room-field-label', 'Display name');
  const nameInput = element('input', 'online-room-input');
  nameInput.type = 'text';
  nameInput.maxLength = 20;
  nameInput.value = localName;
  nameLabel.append(nameInput);

  const colorLabel = element('div', 'online-room-field-label', 'Ball color');
  const colorGrid = element('div', 'online-room-colors');
  const colorButtons: HTMLButtonElement[] = [];
  for (const option of getAllColors()) {
    const button = element('button', 'online-room-color') as HTMLButtonElement;
    button.type = 'button';
    button.title = option.name;
    button.dataset.color = String(option.hex);
    button.style.setProperty('--swatch', hexToString(option.hex));
    colorButtons.push(button);
    colorGrid.append(button);
  }
  for (const pattern of getAllPatterns()) {
    const button = element('button', 'online-room-color online-room-color--pattern') as HTMLButtonElement;
    button.type = 'button';
    button.title = pattern.name;
    button.dataset.color = pattern.id;
    button.style.background = `linear-gradient(135deg, ${pattern.previewColors.map(hexToString).join(', ')})`;
    colorButtons.push(button);
    colorGrid.append(button);
  }
  colorLabel.append(colorGrid);

  const hatLabel = element('label', 'online-room-field-label', 'Headgear');
  const hatSelect = element('select', 'online-room-input');
  for (const [id, label] of HATS) {
    const option = element('option', undefined, label);
    option.value = id;
    hatSelect.append(option);
  }
  hatSelect.value = localHat;
  hatLabel.append(hatSelect);
  localCard.identity.append(nameLabel, colorLabel, hatLabel);

  const opponentName = element('strong', 'online-room-opponent-name', 'Waiting for opponent');
  const opponentDetail = element('span', 'online-room-opponent-detail', 'Open player slot');
  opponentCard.identity.append(opponentName, opponentDetail);

  const versus = element('div', 'online-room-versus', 'VS');
  const playerCards = element('div', 'online-room-player-grid');
  playerCards.append(localCard.card, versus, opponentCard.card);

  const status = element('div', 'online-room-status');
  const statusLight = element('i');
  const statusText = element('span', undefined, 'Waiting for room state…');
  status.append(statusLight, statusText);

  const playerActions = element('div', 'online-room-player-actions');
  const hurryButton = element('button', 'online-room-hurry', 'Hurry Up · 10');
  hurryButton.type = 'button';
  const readyButton = element('button', 'multiplayer-primary', 'Ready Up');
  readyButton.type = 'button';
  const startButton = element('button', 'online-room-start', 'Start Match');
  startButton.type = 'button';
  playerActions.append(hurryButton, readyButton, startButton);
  playersPanel.append(playersHeading, playerCards, status, playerActions);

  const settingsPanel = element('aside', 'online-room-settings');
  const settingsHeader = element('div', 'online-room-settings__header');
  const settingsHeaderCopy = element('div');
  const settingsHeading = element('h2', undefined, 'Match Settings');
  const settingsDescription = element('p', undefined, 'The selected player is choosing the rules for the upcoming match.');
  settingsHeaderCopy.append(settingsHeading, settingsDescription);
  const settingsLock = element('span', 'online-room-settings__lock', 'HOST CONTROL');
  settingsHeader.append(settingsHeaderCopy, settingsLock);

  const hurryBanner = element('div', 'online-room-hurry-banner');
  hurryBanner.hidden = true;
  const hurryBannerLabel = element('strong', undefined, 'HURRY UP');
  const hurryBannerTimer = element('span', undefined, '10');
  hurryBanner.append(hurryBannerLabel, hurryBannerTimer);

  const presetRow = element('div', 'online-room-presets');
  const presetButtons: HTMLButtonElement[] = [];
  for (const preset of MATCH_PRESETS) {
    const button = element('button', undefined, preset.label);
    button.type = 'button';
    button.dataset.preset = preset.label;
    presetButtons.push(button);
    presetRow.append(button);
  }

  const settingsScroll = element('div', 'online-room-settings__scroll');
  const themeField = element('label', 'online-room-setting online-room-setting--theme');
  const themeText = element('span');
  themeText.append(element('strong', undefined, 'Arena theme'), element('small', undefined, 'Shared environment treatment'));
  const themeSelect = element('select', 'online-room-setting__select');
  for (const theme of MATCH_THEMES) {
    const option = element('option', undefined, theme.label);
    option.value = theme.value;
    themeSelect.append(option);
  }
  const themeControl = element('span', 'online-room-setting__theme-control');
  const themeChange = element('span', 'online-room-setting__theme-change');
  themeChange.hidden = true;
  themeControl.append(themeSelect, themeChange);
  themeField.append(themeText, themeControl);
  settingsScroll.append(themeField);

  const settingControls = new Map<string, {
    input: HTMLInputElement;
    output: HTMLOutputElement;
    definition: SettingDefinition;
    field: HTMLLabelElement;
    change: HTMLSpanElement;
    changeText: HTMLSpanElement;
  }>();
  for (const group of MATCH_SETTING_GROUPS as Array<{ title: string; fields: SettingDefinition[] }>) {
    const groupNode = element('section', 'online-room-setting-group');
    groupNode.append(element('h3', undefined, group.title));
    for (const definition of group.fields) {
      const field = element('label', 'online-room-setting');
      const copy = element('span');
      copy.append(element('strong', undefined, definition.label), element('small', undefined, definition.description));
      const control = element('span', 'online-room-setting__control');
      const input = element('input') as HTMLInputElement;
      input.type = 'range';
      input.min = String(definition.min);
      input.max = String(definition.max);
      input.step = String(definition.step);
      input.dataset.setting = definition.key;
      const output = element('output') as HTMLOutputElement;
      const change = element('span', 'online-room-setting__change');
      change.hidden = true;
      const changeTrack = element('i', 'online-room-setting__change-track');
      const changeText = element('span', 'online-room-setting__change-copy');
      change.append(changeTrack, changeText);
      control.append(input, output, change);
      field.append(copy, control);
      groupNode.append(field);
      settingControls.set(definition.key, { input, output, definition, field, change, changeText });
    }
    settingsScroll.append(groupNode);
  }
  settingsPanel.append(settingsHeader, hurryBanner, presetRow, settingsScroll);
  layout.append(playersPanel, settingsPanel);
  root.append(header, layout);

  function updateSettingControls(): void {
    themeSelect.value = String(roomSettings.theme || 'tron');
    for (const [key, control] of settingControls) {
      const value = Number(roomSettings[key] ?? MATCH_DEFAULTS[key as keyof typeof MATCH_DEFAULTS]);
      control.input.value = String(value);
      control.output.value = formatMatchSettingValue(control.definition, value);
      control.output.textContent = formatMatchSettingValue(control.definition, value);
    }
    updateSettingChangeIndicators();
  }

  function updateSettingChangeIndicators(): void {
    const baselineTheme = String(settingsBaseline.theme || MATCH_DEFAULTS.theme);
    const currentTheme = String(roomSettings.theme || MATCH_DEFAULTS.theme);
    const themeChanged = baselineTheme !== currentTheme;
    themeField.classList.toggle('has-changed', themeChanged);
    themeChange.hidden = !themeChanged;
    if (themeChanged) {
      const before = MATCH_THEMES.find(theme => theme.value === baselineTheme)?.label || baselineTheme;
      const after = MATCH_THEMES.find(theme => theme.value === currentTheme)?.label || currentTheme;
      themeChange.textContent = `${before} → ${after}`;
    }

    for (const [key, control] of settingControls) {
      const fallback = Number(MATCH_DEFAULTS[key as keyof typeof MATCH_DEFAULTS]);
      const before = Number(settingsBaseline[key] ?? fallback);
      const after = Number(roomSettings[key] ?? fallback);
      const changed = Number.isFinite(before) && Number.isFinite(after) && Math.abs(after - before) > 0.0001;
      control.field.classList.toggle('has-changed', changed);
      control.change.hidden = !changed;
      if (!changed) continue;

      const range = Math.max(0.0001, control.definition.max - control.definition.min);
      const beforePercent = Math.max(0, Math.min(100, ((before - control.definition.min) / range) * 100));
      const afterPercent = Math.max(0, Math.min(100, ((after - control.definition.min) / range) * 100));
      const direction = after > before ? 'right' : 'left';
      control.field.dataset.changeDirection = direction;
      control.change.style.setProperty('--change-start', `${Math.min(beforePercent, afterPercent)}%`);
      control.change.style.setProperty('--change-width', `${Math.max(2, Math.abs(afterPercent - beforePercent))}%`);
      control.change.style.setProperty('--change-end', `${afterPercent}%`);
      const arrow = direction === 'right' ? '→' : '←';
      control.changeText.textContent = `${arrow} ${formatMatchSettingValue(control.definition, after)} · was ${formatMatchSettingValue(control.definition, before)}`;
    }
  }

  function stopHurryTimer(): void {
    if (hurryTimer !== null) window.clearInterval(hurryTimer);
    hurryTimer = null;
    hurryDeadline = 0;
    hurrySignature = '';
    lastHurrySecond = -1;
    hurryBanner.hidden = true;
  }

  function updateHurryDisplay(isSettingsPicker: boolean): void {
    if (!hurryDeadline) return;
    const seconds = Math.max(0, Math.ceil((hurryDeadline - Date.now()) / 1000));
    hurryButton.textContent = `Hurry Up · ${seconds}`;
    hurryBannerTimer.textContent = String(seconds);
    hurryBannerLabel.textContent = isSettingsPicker ? 'LOCKING SETTINGS' : 'HURRY COUNTDOWN';

    if (seconds > 0 && seconds !== lastHurrySecond) {
      lastHurrySecond = seconds;
      playHurryUpChirp(seconds);
    }
    if (seconds === 0 && hurryTimer !== null) {
      window.clearInterval(hurryTimer);
      hurryTimer = null;
    }
  }

  function syncHurryTimer(hurryState: Record<string, unknown> | null, isSettingsPicker: boolean): void {
    if (!hurryState) {
      stopHurryTimer();
      hurryButton.textContent = 'Hurry Up · 10';
      return;
    }

    const signature = `${String(hurryState.requestedBySlot)}:${String(hurryState.targetSlot)}`;
    if (signature !== hurrySignature || !hurryDeadline) {
      hurrySignature = signature;
      const remainingMs = Math.max(0, Number(hurryState.remainingMs || hurryState.durationMs || 10000));
      hurryDeadline = Number(hurryState.clientEndsAt || 0) || Date.now() + remainingMs;
      lastHurrySecond = -1;
    }
    hurryBanner.hidden = false;
    updateHurryDisplay(isSettingsPicker);
    if (hurryTimer === null) {
      hurryTimer = window.setInterval(() => updateHurryDisplay(isSettingsPicker), 100);
    }
  }

  function queueSettingsUpdate(immediate = false): void {
    const state = useGameStore.getState();
    const isLocalPicker = state.online?.currentGame?.settingsPickerId === state.online?.playerId;
    if (!isLocalPicker || state.online?.currentGame?.isServerLobby) return;
    if (settingsTimer !== null) window.clearTimeout(settingsTimer);

    const send = () => {
      const outgoing = { ...roomSettings };
      pendingSettingsJson = JSON.stringify(outgoing);
      online.updateGameSettings(outgoing);
      settingsTimer = null;
    };

    if (immediate) send();
    else settingsTimer = window.setTimeout(send, 120);
  }

  function queueCustomization(): void {
    if (customizationTimer !== null) window.clearTimeout(customizationTimer);
    customizationTimer = window.setTimeout(() => {
      online.sendCustomization(localColor, localHat, localName || 'Player');
      customizationTimer = null;
    }, 100);
  }

  function markCustomizationChanged(): void {
    const state = useGameStore.getState();
    if (state.online?.myReady) online.sendReady(false);
    queueCustomization();
  }

  nameInput.addEventListener('input', () => {
    localName = normalizeName(nameInput.value);
    markCustomizationChanged();
  });
  hatSelect.addEventListener('change', () => {
    localHat = hatSelect.value;
    markCustomizationChanged();
    refresh();
  });
  for (const button of colorButtons) {
    button.addEventListener('click', () => {
      const colorValue = String(button.dataset.color || '');
      localColor = colorValue.startsWith('pattern:') ? colorValue : Number(colorValue);
      markCustomizationChanged();
      refresh();
    });
  }

  themeSelect.addEventListener('change', () => {
    roomSettings.theme = themeSelect.value;
    updateSettingChangeIndicators();
    queueSettingsUpdate(true);
  });
  for (const [key, control] of settingControls) {
    control.input.addEventListener('input', () => {
      const value = Number(control.input.value);
      roomSettings[key] = value;
      control.output.value = formatMatchSettingValue(control.definition, value);
      control.output.textContent = formatMatchSettingValue(control.definition, value);
      updateSettingChangeIndicators();
      queueSettingsUpdate();
    });
  }
  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      const preset = MATCH_PRESETS.find((item) => item.label === button.dataset.preset);
      if (!preset) return;
      for (const [key, value] of Object.entries(preset.settings)) {
        if (value !== undefined) roomSettings[key] = value;
      }
      updateSettingControls();
      queueSettingsUpdate(true);
    });
  }

  hurryButton.addEventListener('click', () => {
    hurryButton.disabled = true;
    hurryButton.textContent = 'Hurry Up · 10';
    online.requestHurryUp();
  });

  readyButton.addEventListener('click', () => {
    const state = useGameStore.getState();

    // Readiness is a lock on the exact customization and rule set being shown.
    // Flush queued edits first so a trailing debounce cannot immediately revoke
    // the ready state after the player clicks the button.
    if (customizationTimer !== null) {
      window.clearTimeout(customizationTimer);
      customizationTimer = null;
    }
    const isLocalPicker = state.online?.currentGame?.settingsPickerId === state.online?.playerId;
    if (settingsTimer !== null && isLocalPicker && !state.online?.currentGame?.isServerLobby) {
      window.clearTimeout(settingsTimer);
      settingsTimer = null;
      const outgoing = { ...roomSettings };
      pendingSettingsJson = JSON.stringify(outgoing);
      online.updateGameSettings(outgoing);
    }

    online.sendCustomization(localColor, localHat, localName || 'Player');
    online.sendReady(!Boolean(state.online?.myReady));
  });
  startButton.addEventListener('click', () => online.startGame());
  leaveButton.addEventListener('click', () => online.leaveGame());

  function refresh(): void {
    const state = useGameStore.getState();
    const onlineState = state.online || {};
    const game = (onlineState.currentGame || {}) as Record<string, unknown>;
    const serverSettings = { ...MATCH_DEFAULTS, ...((game.settings || {}) as RoomSettings) };
    settingsBaseline = {
      ...MATCH_DEFAULTS,
      ...((game.settingsBaseline || settingsBaseline) as RoomSettings),
    };
    const serverSettingsJson = JSON.stringify(serverSettings);
    if (pendingSettingsJson) {
      if (serverSettingsJson === pendingSettingsJson) pendingSettingsJson = null;
    } else {
      roomSettings = serverSettings;
      updateSettingControls();
    }

    const isHost = Boolean(onlineState.isHost);
    const serverLobby = Boolean(game.isServerLobby);
    const playerId = String(onlineState.playerId || '');
    const settingsPickerId = String(game.settingsPickerId || '');
    const isSettingsPicker = !serverLobby && Boolean(settingsPickerId) && settingsPickerId === playerId;
    const pickerPlayer = Array.isArray(game.players)
      ? (game.players as RoomPlayer[]).find((player) => player.id === settingsPickerId)
      : null;
    const pickerName = String(pickerPlayer?.name || (isSettingsPicker ? localName || 'You' : 'Opponent')).slice(0, 20);
    const opponentConnected = Boolean(onlineState.opponentConnected || playerForSlot(game, opponentSlot));
    const localReady = Boolean(onlineState.myReady ?? playerForSlot(game, mySlot)?.ready);
    const opponentReady = Boolean(onlineState.opponentReady ?? playerForSlot(game, opponentSlot)?.ready);
    const opponent = playerForSlot(game, opponentSlot);
    const opponentIsSettingsPicker = !serverLobby && Boolean(settingsPickerId) && opponent?.id === settingsPickerId;
    const opponentNameValue = String(onlineState.opponentName || opponent?.name || 'Opponent').slice(0, 20);
    const opponentColor = onlineState.opponentColor ?? opponent?.color ?? (opponentSlot === 1 ? state.p1Color : state.p2Color);
    const opponentHat = String(onlineState.opponentHat || opponent?.hat || 'none');
    const hurryState = game.hurryUp && typeof game.hurryUp === 'object'
      ? game.hurryUp as Record<string, unknown>
      : null;

    title.textContent = `Match ${Math.max(1, Number(game.matchNumber || 1))} Setup`;
    const themeName = MATCH_THEMES.find((theme) => theme.value === String(roomSettings.theme || 'tron'))?.label || 'Star Circuit';
    roomMeta.textContent = `${serverLobby ? 'QUICK MATCH' : `ROOM ${String(game.id || 'PENDING').replace(/^game_/, '#')}`} · ${themeName.toUpperCase()} · ${Math.round(Number(roomSettings.arenaSize || 4))} RINGS`;
    roleBadge.textContent = serverLobby ? 'QUICK MATCH' : isSettingsPicker ? 'YOUR SETTINGS PICK' : isHost ? 'ROOM HOST' : 'ROOM GUEST';
    roleBadge.classList.toggle('online-room-role--host', isHost || isSettingsPicker);

    localCard.preview.replaceChildren(makeBall(localColor, localHat));
    opponentCard.preview.replaceChildren(makeBall(opponentColor, opponentHat, !opponentConnected));
    opponentName.textContent = opponentConnected ? opponentNameValue : 'Waiting for opponent';
    opponentDetail.textContent = opponentConnected ? `Player ${opponentSlot} · ${HATS.find(([id]) => id === opponentHat)?.[1] || opponentHat}` : 'Open player slot';

    localCard.readyBadge.textContent = localReady ? 'READY' : 'NOT READY';
    localCard.readyBadge.classList.toggle('is-ready', localReady);
    opponentCard.readyBadge.textContent = opponentReady ? 'READY' : opponentConnected ? 'NOT READY' : 'OPEN';
    opponentCard.readyBadge.classList.toggle('is-ready', opponentReady);
    localCard.card.classList.toggle('is-settings-picker', isSettingsPicker);
    opponentCard.card.classList.toggle('is-settings-picker', opponentIsSettingsPicker);
    localCard.slotLabel.textContent = `YOU · P${mySlot}${isSettingsPicker ? ' · SETTINGS PICKER' : ''}`;
    opponentCard.slotLabel.textContent = `RIVAL · P${opponentSlot}${opponentIsSettingsPicker ? ' · SETTINGS PICKER' : ''}`;

    for (const button of colorButtons) {
      button.classList.toggle('is-selected', String(button.dataset.color) === String(localColor));
    }

    const settingsEditable = isSettingsPicker && !localReady;
    settingsHeading.textContent = serverLobby ? 'Match Settings' : isSettingsPicker ? 'Choose Match Settings' : 'Live Match Settings';
    settingsDescription.textContent = serverLobby
      ? 'Quick Match uses server-managed gameplay rules.'
      : isSettingsPicker
        ? 'You were selected to configure the upcoming match. Every change is shown live to your opponent.'
        : settingsPickerId
          ? `${pickerName} is configuring the upcoming match. Changes appear here live.`
          : 'The settings picker will be selected randomly when a second player joins.';
    settingsLock.textContent = serverLobby
      ? 'SERVER RULES'
      : isSettingsPicker
        ? (localReady ? 'UNREADY TO EDIT' : 'YOUR PICK')
        : settingsPickerId ? `${pickerName.toUpperCase()} PICKING` : 'AWAITING PICKER';
    themeSelect.disabled = !settingsEditable;
    for (const { input } of settingControls.values()) input.disabled = !settingsEditable;
    for (const button of presetButtons) button.disabled = !settingsEditable;
    settingsPanel.classList.toggle('is-locked', !settingsEditable);

    syncHurryTimer(hurryState, isSettingsPicker);
    const pickerReady = isSettingsPicker ? localReady : opponentReady;
    const canRequestHurry = !serverLobby && opponentConnected && !isSettingsPicker && Boolean(settingsPickerId) && !pickerReady;
    hurryButton.hidden = isSettingsPicker || (!canRequestHurry && !hurryState);
    hurryButton.disabled = !canRequestHurry || Boolean(hurryState);

    readyButton.textContent = localReady ? 'Cancel Ready' : 'Ready Up';
    readyButton.disabled = !opponentConnected;
    const canStart = isHost && opponentConnected && localReady && opponentReady && !serverLobby;
    startButton.hidden = !isHost || serverLobby;
    startButton.disabled = !canStart;

    if (!opponentConnected) statusText.textContent = 'Waiting for a second player to join the room.';
    else if (localReady && opponentReady) statusText.textContent = serverLobby ? 'Both players ready. Match launching…' : isHost ? 'Both players ready. Launch when ready.' : 'Both players ready. Waiting for the host.';
    else if (localReady) statusText.textContent = 'You are locked in. Waiting for your opponent.';
    else if (opponentReady) statusText.textContent = 'Opponent is ready. Review the rules and ready up.';
    else if (isSettingsPicker) statusText.textContent = 'Choose the match rules, then ready up when the settings are final.';
    else if (settingsPickerId) statusText.textContent = `${pickerName} is choosing. Review the live settings and ready up when satisfied.`;
    else statusText.textContent = 'Waiting for an opponent before randomly selecting the settings picker.';
    status.classList.toggle('is-ready', localReady && opponentReady);
  }

  const unsubscribe = useGameStore.subscribe(refresh);
  container.replaceChildren(root);
  updateSettingControls();
  queueCustomization();
  refresh();

  return {
    cleanup: () => {
      if (settingsTimer !== null) window.clearTimeout(settingsTimer);
      if (customizationTimer !== null) window.clearTimeout(customizationTimer);
      stopHurryTimer();
      unsubscribe();
      root.remove();
    },
  };
}
