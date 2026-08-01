import { useGameStore } from './store.js';
import { DROPFALL_PROTOCOL_VERSION } from '../shared/protocolVersion.js';
import { NetworkStateBuffer } from './network/NetworkStateBuffer.js';

function normalizeServerSlot(slot) {
    if (slot === 0 || slot === 1) {
        return slot + 1;
    }
    return slot;
}

function withClientHurryDeadline(game) {
    if (!game || !game.hurryUp) return game;
    const remainingMs = Math.max(0, Number(game.hurryUp.remainingMs || game.hurryUp.durationMs || 0));
    return {
        ...game,
        hurryUp: {
            ...game.hurryUp,
            clientEndsAt: Date.now() + remainingMs,
        },
    };
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
        this.reconnectToken = null;
        this.lastServerUrl = '';
        this.lastInputSentAt = 0;
        this.lastInputSignature = '';
        this.connectResolver = null;
        this.rejoinResolver = null;
        this.rejoinTimeout = null;
        this.reconnectState = 'idle';
        this.simulationSuspended = false;
        this.awaitingAuthoritativeState = false;
        this.serverResumeReceived = false;

        // Prediction / reconciliation state
        this.localTick = 0;
        this.serverTick = 0;
        this.inputHistory = [];
        this.stateBuffer = new NetworkStateBuffer();
        this.maxInputHistory = 120;

        // Round-trip time estimate. The reconciler needs to know how far ahead
        // of the newest snapshot the local simulation is allowed to be.
        this.rttMs = null;
        this.rttSamples = [];
    }

    static getDefaultServerUrl() {
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) {
            return import.meta.env.VITE_WS_URL.replace(/\/$/, '');
        }

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
            // A timed-out rejoin leaves an unaffiliated transport open. Close
            // that transport without treating it as a user disconnect (which
            // would discard the reconnect token needed by the next attempt).
            if (suppressConnectedEvent && this.isReconnecting) {
                this.ws.close();
                this.ws = null;
            } else {
                this.disconnect();
            }
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

        const socket = this.ws;

        socket.onopen = () => {
            if (this.ws !== socket) {
                socket.close();
                return;
            }
            console.log('[Online] Connected to server');
            useGameStore.getState().setOnlineConnected(true, fullUrl);

            if (!suppressConnectedEvent) {
                this.reconnectAttempts = 0;
                this.emit('connected');
            }

            if (this.pendingRejoinGameId) {
                this.sendRejoinGame(this.pendingRejoinGameId);
                this.setReconnectState('awaiting_rejoin', {
                    gameId: this.pendingRejoinGameId,
                    attempt: this.reconnectAttempts,
                });
                this.emit('rejoinPending', { gameId: this.pendingRejoinGameId });
            }

            // Never replay input before a rejoin is accepted. Those commands
            // belong to the previous socket/player identity and can make the
            // recovered simulation jump before its full state arrives.
            if (!this.pendingRejoinGameId) {
                this.flushMessageQueue();
            }

            this.startPing();
            this.resolveConnectAttempt(true);
        };

        socket.onclose = (event) => {
            if (this.ws !== socket) return;
            this.ws = null;
            console.log('[Online] Disconnected from server', { code: event.code, reason: event.reason, wasClean: event.wasClean });
            this.stopPing();
            useGameStore.getState().setOnlineConnected(false);

            if (this.isReconnecting) {
                this.resolveRejoinAttempt({ success: false, reason: 'transport_closed' });
                return;
            }

            const state = useGameStore.getState();
            const hasRejoinableRoom = state.gameMode === 'ONLINE' && Boolean(state.online?.currentGame?.id);
            const canReconnect = !this.cleanDisconnect &&
                hasRejoinableRoom &&
                Boolean(this.reconnectToken) &&
                !this.isReconnecting;

            if (canReconnect) {
                const currentGameId = state.online?.currentGame?.id || null;
                this.resolveConnectAttempt(false);
                this.attemptReconnection(currentGameId);
                return;
            }

            this.resolveConnectAttempt(false);
            if (!this.isReconnecting) {
                useGameStore.getState().resetOnlineState();
            }
        };

        socket.onerror = (err) => {
            if (this.ws !== socket) return;
            console.error('[Online] WebSocket error:', err);
            this.resolveConnectAttempt(false);
        };

        socket.onmessage = (event) => {
            if (this.ws !== socket) return;
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

    setReconnectState(reconnectState, details = {}) {
        this.reconnectState = reconnectState;
        this.emit('connectionState', {
            state: reconnectState,
            suspended: this.simulationSuspended,
            ...details,
        });
    }

    suspendSimulation(reason, details = {}) {
        const wasSuspended = this.simulationSuspended;
        this.simulationSuspended = true;
        this.awaitingAuthoritativeState = true;
        this.serverResumeReceived = false;
        this.messageQueue = this.messageQueue.filter((msg) => msg?.type !== 'player_input');
        if (!wasSuspended) {
            this.emit('simulationSuspended', { reason, ...details });
        }
        this.emit('connectionState', {
            state: this.reconnectState,
            suspended: true,
            reason,
            ...details,
        });
    }

    markAuthoritativeStateReceived() {
        this.awaitingAuthoritativeState = false;
        this.resumeSimulationIfReady();
    }

    markServerResumed() {
        this.serverResumeReceived = true;
        this.resumeSimulationIfReady();
    }

    resumeSimulationIfReady() {
        if (!this.simulationSuspended || this.awaitingAuthoritativeState || !this.serverResumeReceived) return;
        this.simulationSuspended = false;
        this.emit('simulationResumed');
        this.emit('connectionState', { state: this.reconnectState, suspended: false });
        this.flushMessageQueue();
    }

    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.send(msg);
        }
    }

    waitForRejoinAcknowledgement(timeoutMs = 4000) {
        this.resolveRejoinAttempt({ success: false, reason: 'superseded' });
        return new Promise((resolve) => {
            this.rejoinResolver = resolve;
            this.rejoinTimeout = setTimeout(() => {
                this.resolveRejoinAttempt({ success: false, reason: 'timeout' });
            }, timeoutMs);
        });
    }

    resolveRejoinAttempt(result) {
        if (this.rejoinTimeout) {
            clearTimeout(this.rejoinTimeout);
            this.rejoinTimeout = null;
        }
        if (this.rejoinResolver) {
            const resolver = this.rejoinResolver;
            this.rejoinResolver = null;
            resolver(result);
        }
    }

    returnToOnlineLobby(message) {
        this.isReconnecting = false;
        this.pendingRejoinGameId = null;
        this.reconnectToken = null;
        this.simulationSuspended = false;
        this.awaitingAuthoritativeState = false;
        this.serverResumeReceived = false;
        const state = useGameStore.getState();
        const playerName = state.online?.myName || '';
        // The replacement socket is still a valid lobby connection and has
        // already received its new player id. Clear only room membership;
        // resetting all online state here would leave an open socket whose
        // client believes it has no identity.
        state.clearOnlineRoom?.();
        state.setOnlineConnected?.(this.isConnected, this.lastServerUrl);
        state.enterOnlineLobby?.();
        if (this.isConnected) {
            if (playerName) this.setName(playerName);
            this.listGames();
        }
        this.setReconnectState('failed', { reason: message });
        this.emit('reconnectFailed', { reason: message });
        this.emit('error', message);
    }

    async attemptReconnection(gameId) {
        this.isReconnecting = true;
        this.suspendSimulation('connection_lost', { gameId });
        this.setReconnectState('reconnecting', { gameId });
        this.emit('reconnecting', { gameId });
        const rejoinGameId = gameId;
        if (!rejoinGameId || !this.reconnectToken) {
            this.isReconnecting = false;
            this.returnToOnlineLobby('This match can no longer be rejoined.');
            return;
        }

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
            const acknowledgement = this.waitForRejoinAcknowledgement();
            const started = this.connect(this.lastServerUrl, { suppressConnectedEvent: true });
            if (!started) {
                this.resolveRejoinAttempt({ success: false, reason: 'connect_failed' });
                continue;
            }

            const outcome = await acknowledgement;
            if (outcome?.success) {
                return;
            }
            if (outcome?.terminal) {
                this.returnToOnlineLobby(outcome.message || 'This match can no longer be rejoined.');
                return;
            }
        }

        this.returnToOnlineLobby('Connection lost and reconnection failed. Returned to lobby.');
    }

    disconnect() {
        this.cleanDisconnect = true;
        this.isReconnecting = false;
        this.pendingRejoinGameId = null;
        this.reconnectToken = null;
        this.resolveRejoinAttempt({ success: false, reason: 'clean_disconnect' });
        this.simulationSuspended = false;
        this.awaitingAuthoritativeState = false;
        this.serverResumeReceived = false;
        this.setReconnectState('idle');
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        useGameStore.getState().resetOnlineState();
    }

    send(msg) {
        if (this.simulationSuspended && msg?.type === 'player_input') return false;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else {
            this.messageQueue.push(msg);
        }
        return true;
    }

    handleMessage(msg) {
        const state = useGameStore.getState();
        const mySlot = state.online?.playerSlot;

        switch (msg.type) {
            case 'connected':
                if (msg.protocolVersion !== DROPFALL_PROTOCOL_VERSION) {
                    this.cleanDisconnect = true;
                    this.ws?.close(1002, 'Protocol mismatch');
                    this.emit(
                        'error',
                        `Server protocol ${String(msg.protocolVersion)} is not compatible with this build.`,
                    );
                    break;
                }
                state.setOnlinePlayerId(msg.playerId);
                console.log(`[Online] Assigned ID: ${msg.playerId}`);
                break;

            case 'name_set':
                console.log(`[Online] Name set to: ${msg.name}`);
                break;

            case 'pong':
                this.recordPong(msg.timestamp);
                break;

            case 'error':
                console.error(`[Online] Server error: ${msg.message}`);
                if (this.isReconnecting && this.pendingRejoinGameId) {
                    const terminal = msg.code === 'REJOIN_DENIED' || msg.code === 'GAME_NOT_FOUND';
                    this.resolveRejoinAttempt({
                        success: false,
                        terminal,
                        reason: 'server_error',
                        message: msg.message,
                    });
                }
                this.emit('error', msg.message);
                break;

            case 'game_list':
                state.setOnlineGames(msg.games);
                this.emit('gamesUpdated', msg.games);
                break;

            case 'game_created':
                this.reconnectToken = msg.reconnectToken || null;
                state.setOnlineCurrentGame(withClientHurryDeadline(msg.game));
                state.setOnlineHost(true);
                state.setOnlinePlayerSlot(1);
                state.enterOnlineLobby();
                this.emit('gameCreated', msg.game);
                break;

            case 'game_joined': {
                this.reconnectToken = msg.reconnectToken || null;
                state.setOnlineCurrentGame(withClientHurryDeadline(msg.game));
                state.setOnlineHost(false);
                const joinedGame = msg.game || {};
                const joinedSlot = joinedGame.players && joinedGame.players.length > 0
                    ? (joinedGame.players[joinedGame.players.length - 1]?.slot || 2)
                    : 2;
                state.setOnlinePlayerSlot(joinedSlot);
                state.enterOnlineLobby();

                if (Array.isArray(joinedGame.players)) {
                    const myPlayerId = state.online.playerId;
                    const existingPlayers = joinedGame.players.filter(p => p.id !== myPlayerId);
                    for (const ep of existingPlayers) {
                        state.setOnlineOpponentConnected(true);
                        state.setOnlineOpponentName(ep.name || 'Player');
                        state.setOnlineOpponentCustomization?.(
                            ep.color ?? null,
                            ep.hat ?? null,
                            ep.name ?? null,
                        );

                        if (ep.slot === 1 || ep.slot === 2) {
                            // A player can join before their customization
                            // packet arrives. Preserve local defaults instead of
                            // passing null into the persisted color serializer.
                            const p1Color = ep.slot === 1 ? (ep.color ?? state.p1Color) : state.p1Color;
                            const p2Color = ep.slot === 2 ? (ep.color ?? state.p2Color) : state.p2Color;
                            const p1Hat = ep.slot === 1 ? (ep.hat ?? state.p1Hat) : state.p1Hat;
                            const p2Hat = ep.slot === 2 ? (ep.hat ?? state.p2Hat) : state.p2Hat;
                            const p1Name = ep.slot === 1 ? (ep.name ?? state.p1Name) : state.p1Name;
                            const p2Name = ep.slot === 2 ? (ep.name ?? state.p2Name) : state.p2Name;
                            state.setPlayerColors?.(p1Color, p2Color);
                            state.setPlayerHats?.(p1Hat, p2Hat);
                            state.setPlayerNames?.(p1Name, p2Name);
                        }
                    }
                }

                this.emit('gameJoined', msg.game);
                break;
            }

            case 'left_game':
                this.reconnectToken = null;
                state.clearOnlineRoom?.();
                state.enterOnlineLobby();
                this.emit('leftGame');
                break;

            case 'player_joined': {
                state.setOnlineOpponentConnected(true);
                if (msg.game) state.setOnlineCurrentGame(msg.game);
                const opponentName = msg.player.name || 'Player';
                state.setOnlineOpponentName(opponentName);

                const joinedPlayerSlot = msg.player.slot;
                const cust = msg.player.customization || {};
                const opponentColor = cust.color ?? null;
                const opponentHat = cust.hat ?? null;
                const opponentCustName = cust.name ?? opponentName;

                state.setOnlineOpponentCustomization?.(opponentColor, opponentHat, opponentCustName);

                if (joinedPlayerSlot === 1 || joinedPlayerSlot === 2) {
                    const mySlot = state.online?.playerSlot;
                    const isOpponent = mySlot != null && joinedPlayerSlot !== mySlot;
                    if (isOpponent) {
                        const p1Color = joinedPlayerSlot === 1 ? opponentColor : state.p1Color;
                        const p2Color = joinedPlayerSlot === 2 ? opponentColor : state.p2Color;
                        const p1Hat = joinedPlayerSlot === 1 ? opponentHat : state.p1Hat;
                        const p2Hat = joinedPlayerSlot === 2 ? opponentHat : state.p2Hat;
                        const p1Name = joinedPlayerSlot === 1 ? opponentCustName : state.p1Name;
                        const p2Name = joinedPlayerSlot === 2 ? opponentCustName : state.p2Name;
                        state.setPlayerColors?.(p1Color, p2Color);
                        state.setPlayerHats?.(p1Hat, p2Hat);
                        state.setPlayerNames?.(p1Name, p2Name);
                    }
                }

                this.emit('playerJoined', msg.player);
                break;
            }

            case 'player_left':
                state.setOnlineOpponentConnected(false);
                this.emit('playerLeft', msg.playerId);
                break;

            case 'new_host':
                state.setOnlineHost(msg.hostId === state.online.playerId);
                if (state.online.currentGame) {
                    state.setOnlineCurrentGame({ ...state.online.currentGame, hostId: msg.hostId });
                }
                this.emit('newHost', msg.hostId);
                break;

            case 'settings_picker_changed':
                state.setOnlineCurrentGame(withClientHurryDeadline(msg.game || {
                    ...(state.online.currentGame || {}),
                    settingsPickerId: msg.pickerId || null,
                    settingsPickerReason: msg.reason || 'initial_random',
                }));
                this.emit('settingsPickerChanged', {
                    pickerId: msg.pickerId || null,
                    reason: msg.reason || 'initial_random',
                });
                break;

            case 'game_settings_updated':
                state.setOnlineCurrentGame(withClientHurryDeadline(msg.game || {
                    ...(state.online.currentGame || {}),
                    settings: msg.settings || {},
                }));
                state.setOnlineReady?.(false);
                state.setOnlineOpponentReady?.(false);
                state.setOnlineAllReady?.(false);
                this.emit('gameSettingsUpdated', msg.settings || {});
                break;

            case 'rejoin_success': {
                this.reconnectToken = msg.reconnectToken || null;
                const rejoinedGame = msg.game || {};
                const slot = normalizeServerSlot(msg.slot);
                state.setOnlineCurrentGame(withClientHurryDeadline(rejoinedGame));
                state.setOnlinePlayerSlot(slot);
                state.setOnlineHost(rejoinedGame.hostId === state.online.playerId);
                state.setOpponentDisconnected?.(false);
                const rejoinedGameId = this.pendingRejoinGameId;
                this.pendingRejoinGameId = null;
                this.isReconnecting = false;
                this.reconnectAttempts = 0;
                this.setReconnectState('rejoined', { gameId: rejoinedGameId });
                this.resolveRejoinAttempt({ success: true, game: rejoinedGame });
                // This announces authenticated transport recovery only. The
                // simulation remains suspended until game_resumed plus a full
                // authoritative snapshot arrive.
                this.emit('reconnected', { game: rejoinedGame });
                this.emit('rejoinSuccess', rejoinedGame);
                break;
            }

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

                this.emit('gameStarting', {
                    countdown: msg.countdown,
                    matchStart: msg.matchStart !== false,
                    settings: msg.settings,
                    players: msg.players || [],
                });
                this.markServerResumed();
                break;

            case 'game_started':
                this.markServerResumed();
                this.emit('gameStarted');
                break;

            case 'game_state_update':
                if (typeof msg.tick === 'number') {
                    this.serverTick = msg.tick;
                    this.stateBuffer.push({
                        tick: msg.tick,
                        serverTime: msg.serverTime,
                        receivedAt: Date.now(),
                        state: msg.state,
                    });
                }
                this.emit('gameUpdate', msg);
                break;

            case 'opponent_input':
                this.emit('gameUpdate', msg);
                break;

            case 'round_over': {
                const winnerSlot = msg.winner;
                let winnerName = 'Draw';
                if (winnerSlot === 1) winnerName = 'Player 1';
                else if (winnerSlot === 2) winnerName = 'Player 2';
                this.emit('roundOver', {
                    winner: winnerName,
                    winnerSlot,
                    scores: msg.scores,
                    matchOver: Boolean(msg.matchOver),
                    matchWinner: msg.matchWinner ?? null,
                });
                break;
            }

            case 'match_over': {
                const matchWinnerSlot = msg.winner;
                let matchWinnerName = 'Draw';
                if (matchWinnerSlot === 1) matchWinnerName = 'Player 1';
                else if (matchWinnerSlot === 2) matchWinnerName = 'Player 2';
                if (msg.game) state.setOnlineCurrentGame(msg.game);
                this.emit('matchOver', {
                    winner: matchWinnerName,
                    winnerSlot: matchWinnerSlot,
                    scores: msg.scores,
                    nextSettingsPickerId: msg.nextSettingsPickerId || msg.game?.settingsPickerId || null,
                });
                break;
            }

            case 'full_state':
                if (msg.state) {
                    const tick = Number.isFinite(msg.tick) ? msg.tick : this.serverTick;
                    if (Number.isFinite(tick)) this.serverTick = tick;
                    this.stateBuffer.seedAuthoritativeState({
                        tick: Number.isFinite(tick) ? tick : 0,
                        serverTime: msg.serverTime,
                        receivedAt: Date.now(),
                        state: msg.state,
                    });
                }
                this.markAuthoritativeStateReceived();
                this.emit('authoritativeState', msg);
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
                this.suspendSimulation('opponent_disconnected', { slot: normalizeServerSlot(msg.slot) });
                break;

            case 'player_reconnected':
                state.setOpponentDisconnected?.(false);
                break;

            case 'game_resumed':
                state.setOpponentDisconnected?.(false);
                this.markServerResumed();
                this.emit('gameResumed');
                break;

            case 'match_abandoned':
                if (msg.game) state.setOnlineCurrentGame(withClientHurryDeadline(msg.game));
                state.setOnlineOpponentConnected?.(false);
                state.setOnlineReady?.(false);
                state.setOnlineOpponentReady?.(false);
                state.setOnlineAllReady?.(false);
                state.setOpponentDisconnected?.(false);
                state.setGameState?.('ONLINE_SETUP');
                this.emit('matchAbandoned', msg.game || null);
                break;

            case 'hurry_up_started':
                state.setOnlineCurrentGame({
                    ...(state.online.currentGame || {}),
                    hurryUp: {
                        requestedBySlot: normalizeServerSlot(msg.requestedBySlot),
                        targetSlot: normalizeServerSlot(msg.targetSlot),
                        durationMs: Number(msg.durationMs || 10000),
                        clientEndsAt: Date.now() + Number(msg.durationMs || 10000),
                    },
                });
                this.emit('hurryUpStarted', msg);
                break;

            case 'hurry_up_finished':
            case 'hurry_up_cancelled':
                if (state.online.currentGame) {
                    state.setOnlineCurrentGame({ ...state.online.currentGame, hurryUp: null });
                }
                this.emit(msg.type === 'hurry_up_finished' ? 'hurryUpFinished' : 'hurryUpCancelled', msg);
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
                if (msg.game) state.setOnlineCurrentGame(withClientHurryDeadline(msg.game));
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
        this.send({
            type: 'set_name',
            name,
            protocolVersion: DROPFALL_PROTOCOL_VERSION,
        });
        useGameStore.getState().setOnlineName(name);
    }

    listGames() {
        this.send({ type: 'list_games' });
    }

    static async fetchNetworkInfo(serverUrl = OnlineManager.getDefaultServerUrl()) {
        try {
            const httpUrl = serverUrl
                .replace(/^wss:\/\//i, 'https://')
                .replace(/^ws:\/\//i, 'http://')
                .replace(/\/$/, '');
            const res = await fetch(`${httpUrl}/api/network-info`);
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    static isPrivateIp(hostname) {
        if (!hostname) return false;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
        const parts = hostname.split('.');
        if (parts.length !== 4) return false;
        const [a, b] = parts.map(Number);
        if (Number.isNaN(a) || Number.isNaN(b)) return false;
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        return false;
    }

    static detectNetworkMode(serverUrl = '') {
        if (!serverUrl) return 'unknown';
        try {
            const url = new URL(serverUrl);
            const hostname = url.hostname;
            if (OnlineManager.isPrivateIp(hostname)) return 'lan';
            return 'internet';
        } catch {
            return 'unknown';
        }
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

    updateGameSettings(settings) {
        this.send({ type: 'update_game_settings', settings });
    }

    sendInput(input) {
        if (this.simulationSuspended) return false;
        // Normalize boolean or numeric inputs into the server's expected format.
        const forward = input.forward ? 1 : (input.backward ? -1 : 0);
        const right = input.right ? 1 : (input.left ? -1 : 0);
        const tick = this.localTick;
        const normalizedInput = {
            type: 'player_input',
            forward,
            right,
            boost: !!input.boost,
            tick,
        };
        this.inputHistory.push({ tick, forward, right, boost: !!input.boost });
        if (this.inputHistory.length > this.maxInputHistory) {
            this.inputHistory.shift();
        }
        this.send(normalizedInput);
        this.localTick += 1;
        this.lastInputSentAt = performance.now();
        this.lastInputSignature = `${forward}:${right}:${normalizedInput.boost ? 1 : 0}`;
        return true;
    }

    shouldSendInput(input, now = performance.now()) {
        const forward = input.forward ? 1 : (input.backward ? -1 : 0);
        const right = input.right ? 1 : (input.left ? -1 : 0);
        const signature = `${forward}:${right}:${input.boost ? 1 : 0}`;
        const inputChanged = signature !== this.lastInputSignature;
        const elapsed = now - this.lastInputSentAt;
        return (inputChanged && elapsed >= 12) || elapsed >= 50;
    }

    sampleServerState(now = Date.now()) {
        return this.stateBuffer.sample(now);
    }

    recordPong(timestamp, now = Date.now()) {
        if (!Number.isFinite(timestamp)) return;
        const rtt = now - timestamp;
        if (rtt < 0 || rtt > 5000) return;

        this.rttSamples.push({ at: now, rtt });
        while (this.rttSamples.length > 1 && now - this.rttSamples[0].at > 10000) {
            this.rttSamples.shift();
        }

        // The fastest recent round trip is the cleanest read on the link; the
        // slow ones are queueing, which the snapshot buffer already absorbs.
        let windowMin = Infinity;
        for (const sample of this.rttSamples) {
            if (sample.rtt < windowMin) windowMin = sample.rtt;
        }
        this.rttMs = this.rttMs == null ? windowMin : this.rttMs + (windowMin - this.rttMs) * 0.25;
    }

    /** Estimated one-way latency in ms, used to time-align reconciliation. */
    getLatencyMs() {
        if (this.rttMs == null) return 40;
        return Math.max(0, Math.min(250, this.rttMs / 2));
    }

    getNetworkStats() {
        return {
            rttMs: this.rttMs,
            latencyMs: this.getLatencyMs(),
            ...this.stateBuffer.getStats(),
        };
    }

    /**
     * Clears buffered world state between rounds. The connection has not
     * changed, so latency and clock estimates are kept.
     */
    resetRoundState() {
        this.localTick = 0;
        this.serverTick = 0;
        this.inputHistory = [];
        this.stateBuffer.clearSnapshots();
        this.lastInputSentAt = 0;
        this.lastInputSignature = '';
    }

    resetSimulationState() {
        this.resetRoundState();
        this.stateBuffer.clear();
        this.rttMs = null;
        this.rttSamples = [];
    }

    sendCustomization(color, hat, name) {
        this.send({ type: 'set_customization', color, hat, name });
    }

    sendReady(ready) {
        useGameStore.getState().setOnlineReady?.(Boolean(ready));
        this.send({ type: 'player_ready', ready });
    }

    requestHurryUp() {
        this.send({ type: 'hurry_up_request' });
    }

    sendRematchRequest() {
        useGameStore.getState().setRematchRequested?.(true);
        this.send({ type: 'rematch_request' });
    }

    sendRejoinGame(gameId) {
        if (!gameId || !this.reconnectToken) return;
        this.send({
            type: 'rejoin_game',
            gameId,
            reconnectToken: this.reconnectToken,
        });
    }

    sendRoundOver(winner, scores) {
        this.send({ type: 'round_over', winner, scores });
    }

    requestSync() {
        this.send({ type: 'sync_state', requestFullState: true });
    }

    startPing() {
        this.stopPing();
        // Sampled often enough that the latency estimate tracks the link during
        // a match, not just often enough to keep the socket alive.
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 1000);
        this.send({ type: 'ping', timestamp: Date.now() });
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
            reconnectState: this.reconnectState,
            simulationSuspended: this.simulationSuspended,
            playerId: useGameStore.getState().online.playerId,
            currentGame: useGameStore.getState().online.currentGame,
            isHost: useGameStore.getState().online.isHost,
        };
    }
}

export const online = new OnlineManager();

export { OnlineManager };
