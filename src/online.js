import { useGameStore } from './store.js';

function normalizeServerSlot(slot) {
    if (slot === 0 || slot === 1) {
        return slot + 1;
    }
    return slot;
}

class OnlineManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 5000;
        this.messageQueue = [];
        this.handlers = new Map();
        this.lastPing = 0;
        this.pingInterval = null;
        this.cleanDisconnect = false;
        this.isReconnecting = false;
        this.pendingRejoinGameId = null;
        this.lastServerUrl = '';
        this.lastStateSentAt = 0;
        this.connectResolver = null;
    }

    static getDefaultServerUrl() {
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseUrl = isLocalHost ? 'ws://localhost:3000' : window.location.origin;
        return baseUrl
            .replace(/^https:\/\//i, 'wss://')
            .replace(/^http:\/\//i, 'ws://');
    }

    static normalizeServerUrl(serverUrl) {
        const rawUrl = String(serverUrl || '').trim();
        const url = rawUrl || OnlineManager.getDefaultServerUrl();

        if (/^wss?:\/\//i.test(url)) {
            return url.replace(/\/$/, '');
        }

        if (/^https?:\/\//i.test(url)) {
            return url
                .replace(/^https:\/\//i, 'wss://')
                .replace(/^http:\/\//i, 'ws://')
                .replace(/\/$/, '');
        }

        return `ws://${url.replace(/\/$/, '')}`;
    }

    connect(serverUrl = OnlineManager.getDefaultServerUrl(), options = {}) {
        const { suppressConnectedEvent = false } = options;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.disconnect();
        }

        const fullUrl = OnlineManager.normalizeServerUrl(serverUrl);
        this.lastServerUrl = fullUrl;
        this.cleanDisconnect = false;

        console.log(`[Online] Connecting to ${fullUrl}`);

        try {
            this.ws = new WebSocket(fullUrl);
        } catch (e) {
            console.error('[Online] Failed to create WebSocket:', e);
            return false;
        }

        this.ws.onopen = () => {
            console.log('[Online] Connected to server');
            this.reconnectAttempts = 0;
            useGameStore.getState().setOnlineConnected(true, fullUrl);

            if (suppressConnectedEvent) {
                this.isReconnecting = false;
            }

            if (!suppressConnectedEvent) {
                this.emit('connected');
            }

            if (this.pendingRejoinGameId) {
                this.sendRejoinGame(this.pendingRejoinGameId);
                this.pendingRejoinGameId = null;
                this.isReconnecting = false;
                this.emit('reconnected');
            }

            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                this.send(msg);
            }

            this.startPing();
            this.resolveConnectAttempt(true);
        };

        this.ws.onclose = (event) => {
            console.log('[Online] Disconnected from server', { code: event.code, reason: event.reason, wasClean: event.wasClean });
            this.stopPing();
            useGameStore.getState().setOnlineConnected(false);

            const state = useGameStore.getState();
            const inActiveMatch = state.gameMode === 'ONLINE' && (state.gameState === 'PLAYING' || state.gameState === 'COUNTDOWN');
            const canReconnect = !this.cleanDisconnect && inActiveMatch && !this.isReconnecting;

            if (canReconnect) {
                const currentGameId = state.online?.currentGame?.id || null;
                if (currentGameId) {
                    try {
                        sessionStorage.setItem('dropfall_rejoin_game_id', currentGameId);
                    } catch (storageError) {
                        console.warn('[Online] Failed to persist rejoin game ID:', storageError);
                    }
                }

                this.resolveConnectAttempt(false);
                this.attemptReconnection(currentGameId);
                return;
            }

            this.resolveConnectAttempt(false);
            if (!this.isReconnecting) {
                useGameStore.getState().resetOnlineState();
            }
        };

        this.ws.onerror = (err) => {
            console.error('[Online] WebSocket error:', err);
            this.resolveConnectAttempt(false);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('[Online] Failed to parse message:', e);
            }
        };

        return true;
    }

    resolveConnectAttempt(success) {
        if (this.connectResolver) {
            const resolver = this.connectResolver;
            this.connectResolver = null;
            resolver(success);
        }
    }

    waitForConnection(timeoutMs = 4000) {
        return new Promise((resolve) => {
            let settled = false;

            const finish = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            this.connectResolver = finish;
            setTimeout(() => finish(false), timeoutMs);
        });
    }

    async attemptReconnection(gameId) {
        this.isReconnecting = true;
        const rejoinGameId = gameId || sessionStorage.getItem('dropfall_rejoin_game_id');

        for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt += 1) {
            if (this.cleanDisconnect) {
                this.isReconnecting = false;
                return;
            }

            this.reconnectAttempts = attempt;
            const backoff = Math.min(this.reconnectDelay * (2 ** (attempt - 1)), this.maxReconnectDelay);
            await new Promise((resolve) => setTimeout(resolve, backoff));

            if (this.cleanDisconnect) {
                this.isReconnecting = false;
                return;
            }

            this.pendingRejoinGameId = rejoinGameId || null;

            const started = this.connect(this.lastServerUrl, { suppressConnectedEvent: true });
            if (!started) {
                continue;
            }

            const connected = await this.waitForConnection();
            if (connected) {
                return;
            }
        }

        this.isReconnecting = false;
        this.pendingRejoinGameId = null;
        const state = useGameStore.getState();
        state.resetOnlineState();
        state.enterOnlineLobby?.();
        this.emit('error', 'Connection lost and reconnection failed. Returned to lobby.');
    }

    disconnect() {
        this.cleanDisconnect = true;
        this.isReconnecting = false;
        this.pendingRejoinGameId = null;
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        try {
            sessionStorage.removeItem('dropfall_rejoin_game_id');
        } catch (storageError) {
            console.warn('[Online] Failed to clear rejoin game ID:', storageError);
        }
        useGameStore.getState().resetOnlineState();
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else {
            this.messageQueue.push(msg);
        }
    }

    handleMessage(msg) {
        const state = useGameStore.getState();
        const mySlot = state.online?.playerSlot;

        switch (msg.type) {
            case 'connected':
                state.setOnlinePlayerId(msg.playerId);
                console.log(`[Online] Assigned ID: ${msg.playerId}`);
                break;

            case 'name_set':
                console.log(`[Online] Name set to: ${msg.name}`);
                break;

            case 'error':
                console.error(`[Online] Server error: ${msg.message}`);
                this.emit('error', msg.message);
                break;

            case 'game_list':
                state.setOnlineGames(msg.games);
                this.emit('gamesUpdated', msg.games);
                break;

            case 'game_created':
                state.setOnlineCurrentGame(msg.game);
                state.setOnlineHost(true);
                state.setOnlinePlayerSlot(1);
                state.enterOnlineLobby();
                this.emit('gameCreated', msg.game);
                break;

            case 'game_joined':
                state.setOnlineCurrentGame(msg.game);
                state.setOnlineHost(false);
                state.setOnlinePlayerSlot(2);
                state.enterOnlineLobby();
                this.emit('gameJoined', msg.game);
                break;

            case 'left_game':
                state.setOnlineCurrentGame(null);
                state.resetOnlineState();
                state.enterOnlineLobby();
                this.emit('leftGame');
                break;

            case 'player_joined':
                state.setOnlineOpponentConnected(true);
                const opponentName = msg.player.name || 'Player';
                state.setOnlineOpponentName(opponentName);
                this.emit('playerJoined', msg.player);
                break;

            case 'player_left':
                state.setOnlineOpponentConnected(false);
                this.emit('playerLeft', msg.playerId);
                break;

            case 'new_host':
                state.setOnlineHost(msg.hostId === state.online.playerId);
                this.emit('newHost', msg.hostId);
                break;

            case 'game_starting':
                if (Array.isArray(msg.players) && msg.players.length > 0) {
                    const hasZeroBasedSlots = msg.players.some((player) => player?.slot === 0);
                    const players = msg.players.map((player) => ({
                        ...player,
                        slot: hasZeroBasedSlots ? normalizeServerSlot(player?.slot) : player?.slot,
                    }));
                    const p1 = players.find((player) => player?.slot === 1);
                    const p2 = players.find((player) => player?.slot === 2);

                    const p1Name = p1?.name || state.p1Name;
                    const p2Name = p2?.name || state.p2Name;
                    state.setPlayerNames?.(p1Name, p2Name);

                    if (p1?.hat !== undefined || p2?.hat !== undefined) {
                        state.setPlayerHats?.(p1?.hat || state.p1Hat, p2?.hat || state.p2Hat);
                    }

                    if (p1?.color !== undefined || p2?.color !== undefined) {
                        state.setPlayerColors?.(
                            p1?.color !== undefined ? p1.color : state.p1Color,
                            p2?.color !== undefined ? p2.color : state.p2Color,
                        );
                    }

                    const opponent = players.find((player) => player?.slot && player.slot !== mySlot);
                    state.setOnlineOpponentCustomization?.(
                        opponent?.color ?? null,
                        opponent?.hat ?? null,
                        opponent?.name ?? null,
                    );
                }

                this.emit('gameStarting', { countdown: msg.countdown, settings: msg.settings, players: msg.players || [] });
                break;

            case 'game_started':
                this.emit('gameStarted');
                break;

            case 'game_state_update':
            case 'opponent_input':
                this.emit('gameUpdate', msg);
                break;

            case 'round_over':
                this.emit('roundOver', { winner: msg.winner, scores: msg.scores });
                break;

            case 'full_state':
                this.emit('fullState', msg);
                break;

            case 'stats':
                break;

            case 'player_customization': {
                const gameSlot = normalizeServerSlot(msg.slot);
                const isOpponent = mySlot != null && gameSlot !== mySlot;
                if (isOpponent) {
                    state.setOnlineOpponentCustomization?.(
                        msg.color ?? null,
                        msg.hat ?? null,
                        msg.name ?? null,
                    );
                }

                if (gameSlot === 1 || gameSlot === 2) {
                    const p1Color = gameSlot === 1 && msg.color !== undefined ? msg.color : state.p1Color;
                    const p2Color = gameSlot === 2 && msg.color !== undefined ? msg.color : state.p2Color;
                    const p1Hat = gameSlot === 1 && msg.hat !== undefined ? msg.hat : state.p1Hat;
                    const p2Hat = gameSlot === 2 && msg.hat !== undefined ? msg.hat : state.p2Hat;
                    const p1Name = gameSlot === 1 && msg.name ? msg.name : state.p1Name;
                    const p2Name = gameSlot === 2 && msg.name ? msg.name : state.p2Name;

                    state.setPlayerColors?.(p1Color, p2Color);
                    state.setPlayerHats?.(p1Hat, p2Hat);
                    state.setPlayerNames?.(p1Name, p2Name);
                }
                break;
            }

            case 'ready_state': {
                const gameSlot = normalizeServerSlot(msg.slot);
                const isMe = mySlot != null && gameSlot === mySlot;
                if (isMe) {
                    state.setOnlineReady?.(Boolean(msg.ready));
                } else {
                    state.setOnlineOpponentReady?.(Boolean(msg.ready));
                }
                break;
            }

            case 'all_ready':
                state.setOnlineAllReady?.(true);
                break;

            case 'opponent_disconnected':
                state.setOpponentDisconnected?.(true);
                break;

            case 'player_reconnected':
                state.setOpponentDisconnected?.(false);
                break;

            case 'rematch_requested': {
                const gameSlot = normalizeServerSlot(msg.slot);
                const isOpponent = mySlot != null && gameSlot !== mySlot;
                if (isOpponent) {
                    state.setOpponentRematchRequested?.(true);
                }
                break;
            }

            case 'rematch_start':
                state.setOnlineReady?.(false);
                state.setOnlineOpponentReady?.(false);
                state.setOnlineAllReady?.(false);
                state.setRematchRequested?.(false);
                state.setOpponentRematchRequested?.(false);
                state.setOpponentDisconnected?.(false);
                state.setGameState?.('ONLINE_SETUP');
                this.emit('rematchStart', msg);
                break;
        }
    }

    on(event, handler) {
        this.handlers.set(event, handler);
    }

    off(event) {
        this.handlers.delete(event);
    }

    emit(event, data) {
        const handler = this.handlers.get(event);
        if (handler) {
            handler(data);
        }
    }

    setName(name) {
        this.send({ type: 'set_name', name });
        useGameStore.getState().setOnlineName(name);
    }

    listGames() {
        this.send({ type: 'list_games' });
    }

    createGame(settings = {}) {
        this.send({ type: 'create_game', settings });
    }

    joinGame(gameId) {
        this.send({ type: 'join_game', gameId });
    }

    leaveGame() {
        this.send({ type: 'leave_game' });
    }

    startGame() {
        this.send({ type: 'start_game' });
    }

    sendInput(input) {
        this.send({ type: 'player_input', ...input });
    }

    sendGameState(state) {
        this.send({ type: 'game_state', state });
    }

    sendCustomization(color, hat, name) {
        this.send({ type: 'set_customization', color, hat, name });
    }

    sendReady(ready) {
        useGameStore.getState().setOnlineReady?.(Boolean(ready));
        this.send({ type: 'player_ready', ready });
    }

    sendRematchRequest() {
        useGameStore.getState().setRematchRequested?.(true);
        this.send({ type: 'rematch_request' });
    }

    sendRejoinGame(gameId) {
        if (!gameId) return;
        this.send({ type: 'rejoin_game', gameId });
    }

    sendRoundOver(winner, scores) {
        this.send({ type: 'round_over', winner, scores });
    }

    requestSync() {
        this.send({ type: 'sync_state', requestFullState: true });
    }

    shouldSendStateUpdate() {
        return Date.now() - this.lastStateSentAt >= 50;
    }

    markStateSent() {
        this.lastStateSentAt = Date.now();
    }

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 5000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    get isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    getConnectionInfo() {
        return {
            connected: this.isConnected,
            playerId: useGameStore.getState().online.playerId,
            currentGame: useGameStore.getState().online.currentGame,
            isHost: useGameStore.getState().online.isHost,
        };
    }
}

export const online = new OnlineManager();
