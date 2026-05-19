import { getAllColors, getDisplayColor, hexToString, isPatternId } from './ColorPalette.js';
import { useGameStore } from '../store.js';

export interface OnlineManager {
  sendCustomization: (color: number | string, hat: string, name: string) => void;
  sendReady: (ready: boolean) => void;
  startGame: () => void;
}

interface OnlinePlayerData {
  name: string;
  color: number | string;
  hat: string;
  ready: boolean;
}

const HAT_OPTIONS = ['none', 'santa', 'cowboy', 'afro', 'crown', 'dunce'];
const HAT_LABELS: Record<string, string> = {
  none: 'None',
  santa: 'Santa',
  cowboy: 'Cowboy',
  afro: 'Afro',
  crown: 'Crown',
  dunce: 'Dunce',
};

function getReadyBySlot(currentGame: unknown, slot: number): boolean | null {
  if (!currentGame || typeof currentGame !== 'object') {
    return null;
  }

  const game = currentGame as { players?: unknown[] };
  const players = Array.isArray(game.players) ? game.players : [];
  const player = players.find((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const typedEntry = entry as { slot?: number };
    return typedEntry.slot === slot;
  }) as { ready?: boolean } | undefined;

  if (!player || typeof player.ready !== 'boolean') {
    return null;
  }

  return Boolean(player.ready);
}

function getStatusText(options: {
  opponentConnected: boolean;
  myReady: boolean;
  opponentReady: boolean;
  isHost: boolean;
}): string {
  if (!options.opponentConnected) {
    return 'Waiting for opponent to join...';
  }

  if (options.myReady && options.opponentReady) {
    return options.isHost
      ? 'Both ready. Host can start the match.'
      : 'Both ready. Waiting for host to start...';
  }

  if (!options.myReady && !options.opponentReady) {
    return 'Waiting for players to ready up...';
  }

  if (!options.myReady) {
    return 'Opponent is ready. Toggle READY when you are set.';
  }

  return 'You are ready. Waiting for opponent...';
}

function normalizeName(value: string): string {
  return value.trim().slice(0, 20);
}

function hasOpponentCustomization(options: {
  opponent: OnlinePlayerData;
  opponentConnected: boolean;
  opponentCustomization: unknown;
}): boolean {
  const { opponent, opponentConnected, opponentCustomization } = options;
  if (!opponentConnected) {
    return false;
  }

  if (opponentCustomization && typeof opponentCustomization === 'object') {
    return true;
  }

  const hasName = opponent.name.trim().length > 0;
  return hasName;
}

export function createOnlineSetupPanel(
  container: HTMLElement,
  online: OnlineManager,
  isHost: boolean,
): { cleanup: () => void } {
  const getStateRecord = (): Record<string, unknown> => {
    return useGameStore.getState() as unknown as Record<string, unknown>;
  };

  const initialState = getStateRecord();
  const initialOnline = (initialState.online || {}) as Record<string, unknown>;

  const mySlot = typeof initialOnline.playerSlot === 'number' ? initialOnline.playerSlot : 1;
  const opponentSlot = mySlot === 1 ? 2 : 1;

  const getLocalNameFromState = (state: Record<string, unknown>): string => {
    const stateOnline = (state.online || {}) as Record<string, unknown>;
    const onlineName = typeof stateOnline.myName === 'string' ? stateOnline.myName.trim() : '';
    if (onlineName) {
      return onlineName.slice(0, 20);
    }

    if (mySlot === 2 && typeof state.p2Name === 'string') {
      return String(state.p2Name).slice(0, 20);
    }

    const fallback = typeof state.p1Name === 'string' ? String(state.p1Name) : 'Player';
    return fallback.slice(0, 20);
  };

  const getLocalColorFromState = (state: Record<string, unknown>): number | string => {
    if (mySlot === 2 && (typeof state.p2Color === 'number' || typeof state.p2Color === 'string')) {
      return state.p2Color as number | string;
    }

    if (typeof state.p1Color === 'number' || typeof state.p1Color === 'string') {
      return state.p1Color as number | string;
    }

    return 0x00ffff;
  };

  const getLocalHatFromState = (state: Record<string, unknown>): string => {
    if (mySlot === 2 && typeof state.p2Hat === 'string') {
      return state.p2Hat;
    }

    if (typeof state.p1Hat === 'string') {
      return state.p1Hat;
    }

    return 'none';
  };

  let localName = getLocalNameFromState(initialState);
  let localColor = getLocalColorFromState(initialState);
  let localHat = getLocalHatFromState(initialState);
  let localReady = false;
  let syncTimer: number | null = null;

  const root = document.createElement('div');
  root.style.cssText = `
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: radial-gradient(circle at top, rgba(0, 255, 255, 0.12), rgba(0, 0, 0, 0.75) 55%);
    overflow: auto;
  `;

  const title = document.createElement('h2');
  title.textContent = 'ONLINE MATCH';
  title.style.cssText = `
    margin: 0;
    text-align: center;
    color: #0ff;
    font-family: 'Courier New', monospace;
    letter-spacing: 2px;
    text-shadow: 0 0 14px rgba(0, 255, 255, 0.8);
  `;
  root.appendChild(title);

  const cardsWrap = document.createElement('div');
  cardsWrap.style.cssText = `
    display: flex;
    gap: 1rem;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    flex-wrap: wrap;
  `;

  const makeCard = (labelText: string): {
    card: HTMLDivElement;
    header: HTMLHeadingElement;
    preview: HTMLDivElement;
    readyBadge: HTMLSpanElement;
    nameInputOrText: HTMLInputElement | HTMLDivElement;
    hatSelectOrText: HTMLSelectElement | HTMLDivElement;
    colorStrip: HTMLDivElement;
  } => {
    const card = document.createElement('div');
    card.style.cssText = `
      flex: 1 1 320px;
      max-width: 420px;
      min-width: 280px;
      border: 2px solid #0ff;
      border-radius: 10px;
      background: rgba(0, 20, 40, 0.55);
      box-shadow: 0 0 24px rgba(0, 255, 255, 0.2);
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
    `;

    const top = document.createElement('div');
    top.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap: 0.6rem;';

    const header = document.createElement('h3');
    header.textContent = labelText;
    header.style.cssText = `
      margin: 0;
      color: #0ff;
      font-size: 0.95rem;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-shadow: 0 0 8px rgba(0, 255, 255, 0.7);
    `;

    const readyBadge = document.createElement('span');
    readyBadge.textContent = 'READY';
    readyBadge.style.cssText = `
      display: none;
      padding: 0.22rem 0.45rem;
      font-size: 0.74rem;
      border-radius: 999px;
      font-weight: bold;
      color: #001b00;
      background: #00ff88;
      box-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
      font-family: 'Courier New', monospace;
      letter-spacing: 0.8px;
    `;

    top.append(header, readyBadge);
    card.appendChild(top);

    const preview = document.createElement('div');
    preview.style.cssText = `
      width: 100%;
      min-height: 132px;
      border: 2px dashed rgba(0, 255, 255, 0.45);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
    `;
    card.appendChild(preview);

    const nameInputOrText = document.createElement('input');
    nameInputOrText.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      border: 2px solid #0ff;
      border-radius: 6px;
      background: #09121f;
      color: #ffffff;
      padding: 0.45rem 0.6rem;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      outline: none;
    `;
    card.appendChild(nameInputOrText);

    const colorStrip = document.createElement('div');
    colorStrip.style.cssText = `
      display: flex;
      gap: 0.45rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
      scrollbar-width: thin;
    `;
    card.appendChild(colorStrip);

    const hatSelectOrText = document.createElement('select');
    hatSelectOrText.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      border: 2px solid #0ff;
      border-radius: 6px;
      background: #09121f;
      color: #0ff;
      padding: 0.42rem 0.5rem;
      font-family: 'Courier New', monospace;
      font-size: 0.92rem;
      outline: none;
    `;
    card.appendChild(hatSelectOrText);

    return { card, header, preview, readyBadge, nameInputOrText, hatSelectOrText, colorStrip };
  };

  const localCardParts = makeCard('YOU');
  const opponentCardParts = makeCard('OPPONENT');

  const localNameInput = localCardParts.nameInputOrText as HTMLInputElement;
  localNameInput.type = 'text';
  localNameInput.maxLength = 20;
  localNameInput.placeholder = 'Your name';

  const localHatSelect = localCardParts.hatSelectOrText as HTMLSelectElement;
  HAT_OPTIONS.forEach((hat) => {
    const option = document.createElement('option');
    option.value = hat;
    option.textContent = HAT_LABELS[hat] || hat;
    localHatSelect.appendChild(option);
  });

  const opponentNameDisplay = document.createElement('div');
  opponentNameDisplay.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    border: 2px solid rgba(0, 255, 255, 0.35);
    border-radius: 6px;
    background: rgba(9, 18, 31, 0.9);
    color: #d6f9ff;
    padding: 0.5rem 0.6rem;
    font-family: 'Courier New', monospace;
    font-size: 0.92rem;
    min-height: 38px;
    display: flex;
    align-items: center;
  `;

  const opponentHatDisplay = document.createElement('div');
  opponentHatDisplay.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    border: 2px solid rgba(0, 255, 255, 0.35);
    border-radius: 6px;
    background: rgba(9, 18, 31, 0.9);
    color: #c4edf3;
    padding: 0.45rem 0.6rem;
    font-family: 'Courier New', monospace;
    font-size: 0.88rem;
    min-height: 36px;
    display: flex;
    align-items: center;
    text-transform: capitalize;
  `;

  opponentCardParts.card.replaceChild(opponentNameDisplay, opponentCardParts.nameInputOrText);
  opponentCardParts.nameInputOrText = opponentNameDisplay;
  opponentCardParts.card.replaceChild(opponentHatDisplay, opponentCardParts.hatSelectOrText);
  opponentCardParts.hatSelectOrText = opponentHatDisplay;

  cardsWrap.append(localCardParts.card, opponentCardParts.card);
  root.appendChild(cardsWrap);

  const controls = document.createElement('div');
  controls.style.cssText = `
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
    border: 2px solid rgba(0, 255, 255, 0.5);
    border-radius: 10px;
    padding: 0.85rem;
    box-sizing: border-box;
    background: rgba(0, 10, 25, 0.8);
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  `;

  const buttonsRow = document.createElement('div');
  buttonsRow.style.cssText = 'display:flex; justify-content:center; gap: 0.8rem; flex-wrap: wrap;';

  const readyButton = document.createElement('button');
  readyButton.type = 'button';
  readyButton.style.cssText = `
    min-width: 170px;
    padding: 0.7rem 1.2rem;
    border-radius: 8px;
    border: 2px solid #0ff;
    background: rgba(0, 255, 255, 0.14);
    color: #0ff;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 1px;
    cursor: pointer;
    text-transform: uppercase;
  `;

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.textContent = 'START GAME';
  startButton.style.cssText = `
    min-width: 170px;
    padding: 0.7rem 1.2rem;
    border-radius: 8px;
    border: 2px solid #00ff88;
    background: rgba(0, 255, 136, 0.18);
    color: #c6ffe5;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 1px;
    cursor: pointer;
    text-transform: uppercase;
  `;

  if (!isHost) {
    startButton.style.display = 'none';
  }

  const status = document.createElement('div');
  status.style.cssText = `
    min-height: 1.2rem;
    color: #9deaff;
    text-align: center;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    letter-spacing: 0.4px;
  `;

  buttonsRow.append(readyButton, startButton);
  controls.append(buttonsRow, status);
  root.appendChild(controls);

  const localColors = getAllColors();
  localColors.forEach((entry) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.title = entry.name;
    swatch.dataset.colorHex = hexToString(entry.hex);
    swatch.style.cssText = `
      width: 28px;
      min-width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: ${hexToString(entry.hex)};
      box-shadow: 0 0 8px rgba(0, 255, 255, 0.2);
    `;

    swatch.addEventListener('click', () => {
      localColor = entry.hex;
      const state = getStateRecord();
      const setPlayerColors = state.setPlayerColors as ((p1Color: number | string, p2Color: number | string) => void) | undefined;
      if (setPlayerColors) {
        if (mySlot === 2) {
          setPlayerColors(state.p1Color as number | string, localColor);
        } else {
          setPlayerColors(localColor, state.p2Color as number | string);
        }
      }
      queueCustomizationSync();
      refresh();
    });

    localCardParts.colorStrip.appendChild(swatch);
  });

  localNameInput.addEventListener('input', () => {
    localName = normalizeName(localNameInput.value);
    const state = getStateRecord();
    const setPlayerNames = state.setPlayerNames as ((p1Name: string, p2Name: string) => void) | undefined;

    if (setPlayerNames) {
      const p1 = mySlot === 2 ? String(state.p1Name || 'Player 1') : localName || 'Player';
      const p2 = mySlot === 2 ? (localName || 'Player') : String(state.p2Name || 'Player 2');
      setPlayerNames(p1, p2);
    }

    const setOnlineName = state.setOnlineName as ((name: string) => void) | undefined;
    if (setOnlineName) {
      setOnlineName(localName);
    }

    queueCustomizationSync();
    refresh();
  });

  localHatSelect.addEventListener('change', () => {
    localHat = localHatSelect.value;
    const state = getStateRecord();
    const setPlayerHats = state.setPlayerHats as ((p1Hat: string, p2Hat: string) => void) | undefined;

    if (setPlayerHats) {
      if (mySlot === 2) {
        setPlayerHats(String(state.p1Hat || 'none'), localHat);
      } else {
        setPlayerHats(localHat, String(state.p2Hat || 'none'));
      }
    }

    queueCustomizationSync();
    refresh();
  });

  readyButton.addEventListener('click', () => {
    const nextReady = !localReady;
    localReady = nextReady;
    online.sendReady(nextReady);

    const state = getStateRecord();
    const setOnlineMyReady = state.setOnlineMyReady as ((ready: boolean) => void) | undefined;
    const setOnlineReady = state.setOnlineReady as ((ready: boolean) => void) | undefined;
    if (setOnlineMyReady) {
      setOnlineMyReady(nextReady);
    } else if (setOnlineReady) {
      setOnlineReady(nextReady);
    }

    refresh();
  });

  startButton.addEventListener('click', () => {
    if (!startButton.disabled) {
      online.startGame();
    }
  });

  function queueCustomizationSync(): void {
    if (syncTimer !== null) {
      window.clearTimeout(syncTimer);
    }

    syncTimer = window.setTimeout(() => {
      const fallbackName = (localStorage.getItem('dropfall_p1name') || 'Player').slice(0, 20);
      const outgoingName = (localName || fallbackName).slice(0, 20);
      online.sendCustomization(localColor, localHat, outgoingName);
      syncTimer = null;
    }, 100);
  }

  function renderBallPreview(target: HTMLElement, color: number | string, hat: string, dim = false): void {
    const displayColor = getDisplayColor(color);
    const colorCss = hexToString(displayColor);

    let circleBackground = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.75), ${colorCss} 55%, rgba(0, 0, 0, 0.6))`;
    if (isPatternId(color)) {
      circleBackground = `conic-gradient(from 40deg, ${colorCss}, rgba(255,255,255,0.2), ${colorCss})`;
    }

    target.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap: 0.4rem;';

    const circle = document.createElement('div');
    circle.style.cssText = `
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: ${circleBackground};
      border: 2px solid ${colorCss};
      box-shadow: 0 0 20px ${colorCss}66;
      opacity: ${dim ? '0.55' : '1'};
    `;

    const hatLabel = document.createElement('div');
    hatLabel.textContent = `Hat: ${HAT_LABELS[hat] || hat}`;
    hatLabel.style.cssText = `
      color: ${dim ? 'rgba(190,210,220,0.8)' : '#d7faff'};
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    `;

    wrap.append(circle, hatLabel);
    target.appendChild(wrap);
  }

  function refresh(): void {
    const state = getStateRecord();
    const onlineState = (state.online || {}) as Record<string, unknown>;

    const stateMyName = getLocalNameFromState(state);
    const stateMyColor = getLocalColorFromState(state);
    const stateMyHat = getLocalHatFromState(state);

    localName = localName || stateMyName;
    localColor = localColor ?? stateMyColor;
    localHat = localHat || stateMyHat;

    localNameInput.value = localName;
    localHatSelect.value = localHat;

    const myReadyFromOnline = typeof onlineState.myReady === 'boolean' ? Boolean(onlineState.myReady) : null;
    const myReadyFromGame = getReadyBySlot(onlineState.currentGame, mySlot);
    if (myReadyFromOnline !== null) {
      localReady = myReadyFromOnline;
    } else if (myReadyFromGame !== null) {
      localReady = myReadyFromGame;
    }

    const opponentConnected = Boolean(onlineState.opponentConnected);

    const opponentColorFromOnline = (typeof onlineState.opponentColor === 'number' || typeof onlineState.opponentColor === 'string')
      ? (onlineState.opponentColor as number | string)
      : null;

    const opponentColor = opponentColorFromOnline ?? (opponentSlot === 1
      ? (state.p1Color as number | string)
      : (state.p2Color as number | string));

    const opponentHatFromOnline = typeof onlineState.opponentHat === 'string' ? onlineState.opponentHat : null;
    const opponentHat = opponentHatFromOnline ?? (opponentSlot === 1
      ? String(state.p1Hat || 'none')
      : String(state.p2Hat || 'none'));

    const opponentNameBySlot = opponentSlot === 1
      ? String(state.p1Name || '')
      : String(state.p2Name || '');

    const opponentName = String(onlineState.opponentName || opponentNameBySlot || 'Opponent').slice(0, 20);

    const opponentReady = typeof onlineState.opponentReady === 'boolean'
      ? Boolean(onlineState.opponentReady)
      : Boolean(getReadyBySlot(onlineState.currentGame, opponentSlot));

    const localPlayer: OnlinePlayerData = {
      name: localName || 'Player',
      color: localColor,
      hat: localHat,
      ready: localReady,
    };

    const opponentPlayer: OnlinePlayerData = {
      name: opponentName,
      color: opponentColor ?? 0x666666,
      hat: opponentHat || 'none',
      ready: opponentReady,
    };

    const hasOpponentData = hasOpponentCustomization({
      opponent: opponentPlayer,
      opponentConnected,
      opponentCustomization: onlineState.opponentCustomization,
    });

    renderBallPreview(localCardParts.preview, localPlayer.color, localPlayer.hat, false);

    if (hasOpponentData) {
      renderBallPreview(opponentCardParts.preview, opponentPlayer.color, opponentPlayer.hat, false);
      opponentNameDisplay.textContent = opponentPlayer.name;
      opponentHatDisplay.textContent = `Hat: ${HAT_LABELS[opponentPlayer.hat] || opponentPlayer.hat}`;
    } else {
      opponentCardParts.preview.innerHTML = `
        <div style="color: rgba(180, 220, 235, 0.8); font-family: 'Courier New', monospace; font-size: 0.85rem; text-align: center; padding: 0 0.5rem;">
          Waiting for opponent...
        </div>
      `;
      opponentNameDisplay.textContent = 'Waiting for opponent...';
      opponentHatDisplay.textContent = 'Hat: -';
    }

    const localDisplayColor = getDisplayColor(localPlayer.color);
    const localColorCss = hexToString(localDisplayColor);
    localCardParts.card.style.borderColor = localColorCss;
    localCardParts.card.style.boxShadow = `0 0 24px ${localColorCss}44`;
    localCardParts.header.style.color = localColorCss;
    localNameInput.style.borderColor = localColorCss;
    localHatSelect.style.borderColor = localColorCss;
    localHatSelect.style.color = localColorCss;

    const swatches = localCardParts.colorStrip.querySelectorAll('button');
    swatches.forEach((node) => {
      const button = node as HTMLButtonElement;
      const selectedColorCss = hexToString(getDisplayColor(localPlayer.color));
      const colorHex = button.dataset.colorHex || '#00ffff';
      button.style.boxShadow = colorHex === selectedColorCss
        ? `0 0 8px ${colorHex}, 0 0 0 2px #ffff00`
        : `0 0 8px ${colorHex}`;
    });

    localCardParts.readyBadge.style.display = localPlayer.ready ? 'inline-flex' : 'none';
    opponentCardParts.readyBadge.style.display = opponentPlayer.ready ? 'inline-flex' : 'none';

    readyButton.textContent = localPlayer.ready ? 'UNREADY' : 'READY';
    readyButton.style.borderColor = localPlayer.ready ? '#00ff88' : '#0ff';
    readyButton.style.color = localPlayer.ready ? '#d4ffe8' : '#0ff';
    readyButton.style.background = localPlayer.ready ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 255, 255, 0.14)';

    const canStart = isHost && localPlayer.ready && opponentPlayer.ready && opponentConnected;
    startButton.disabled = !canStart;
    startButton.style.opacity = canStart ? '1' : '0.5';
    startButton.style.cursor = canStart ? 'pointer' : 'not-allowed';

    status.textContent = getStatusText({
      opponentConnected,
      myReady: localPlayer.ready,
      opponentReady: opponentPlayer.ready,
      isHost,
    });
  }

  const unsubscribe = useGameStore.subscribe(() => {
    refresh();
  });

  container.innerHTML = '';
  container.appendChild(root);

  queueCustomizationSync();
  refresh();

  return {
    cleanup: () => {
      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
        syncTimer = null;
      }
      unsubscribe();
      root.remove();
    },
  };
}
