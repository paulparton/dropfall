import { useGameStore } from './store.js';

class OnlineManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.messageQueue = [];
        this.handlers = new Map();
        this.lastPing = 0;
        this.pingInterval = null;
    }

    connect(serverUrl) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.disconnect();
        }

        const protocol = serverUrl.startsWith('https') ? 'wss:' : 'ws:';
        const wsUrl = serverUrl.replace(/^https?:\/\//, '') + '/';
        const fullUrl = `${protocol}//${wsUrl}`;

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
            useGameStore.getState().setOnlineConnected(true, serverUrl);
            this.emit('connected');

            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                this.send(msg);
            }

            this.startPing();
        };

        this.ws.onclose = () => {
            console.log('[Online] Disconnected from server');
            this.stopPing();
            useGameStore.getState().setOnlineConnected(false);
            useGameStore.getState().resetOnlineState();
        };

        this.ws.onerror = (err) => {
            console.error('[Online] WebSocket error:', err);
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

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
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
                this.emit('gameStarting', { countdown: msg.countdown, settings: msg.settings });
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

    sendRoundOver(winner, scores) {
        this.send({ type: 'round_over', winner, scores });
    }

    requestSync() {
        this.send({ type: 'sync_state', requestFullState: true });
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
