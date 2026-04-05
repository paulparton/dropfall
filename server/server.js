import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.ico': 'image/x-icon',
};

class GameServer {
    constructor() {
        this.games = new Map();
        this.players = new Map();
        this.gameIdCounter = 1;
        this.playerIdCounter = 1;

        this.stats = {
            totalConnections: 0,
            gamesCreated: 0,
            gamesCompleted: 0,
        };

        this.server = createServer((req, res) => this.handleHttp(req, res));
        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws) => this.handleConnection(ws));

        this.broadcastInterval = setInterval(() => this.broadcastStats(), 1000);
    }

    normalizeSlot(slot) {
        return Math.max(0, (slot || 1) - 1);
    }

    getDefaultCustomization(slot, fallbackName = null) {
        return {
            color: this.normalizeSlot(slot),
            hat: 'none',
            name: fallbackName || `Player ${slot}`,
        };
    }

    buildPlayerCustomizationPayload(playerInfo) {
        const customization = playerInfo.customization || this.getDefaultCustomization(playerInfo.slot, playerInfo.name);
        return {
            slot: this.normalizeSlot(playerInfo.slot),
            name: customization.name,
            color: customization.color,
            hat: customization.hat,
        };
    }

    getGamePlayerInfo(game, playerId) {
        if (!game) return null;
        return game.players.find(p => p.id === playerId) || null;
    }

    clearReconnectTimer(game, slot) {
        if (!game?.reconnectTimers) return;
        const timeoutId = game.reconnectTimers.get(slot);
        if (timeoutId) {
            clearTimeout(timeoutId);
            game.reconnectTimers.delete(slot);
        }
    }

    clearAllReconnectTimers(game) {
        if (!game?.reconnectTimers) return;
        for (const timeoutId of game.reconnectTimers.values()) {
            clearTimeout(timeoutId);
        }
        game.reconnectTimers.clear();
    }

    broadcastReadyState(game, playerInfo) {
        if (!game || !playerInfo) return;
        this.broadcastToGame(game.id, {
            type: 'ready_state',
            slot: this.normalizeSlot(playerInfo.slot),
            ready: !!playerInfo.ready,
        });
    }

    areBothPlayersReady(game) {
        return game.players.length === 2 && game.players.every(p => !!p.ready);
    }

    handleHttp(req, res) {
        if (req.method === 'GET' && req.url === '/api/stats') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getStats()));
            return;
        }

        if (req.method === 'GET' && req.url === '/api/games') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getPublicGameList()));
            return;
        }

        const requestPath = (req.url || '/').split('?')[0].split('#')[0];
        let filePath = requestPath === '/' ? '/index.html' : requestPath;
        filePath = join(PUBLIC_DIR, filePath);

        if (existsSync(filePath)) {
            const ext = extname(requestPath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(readFileSync(filePath));
        } else {
            const hasExtension = extname(requestPath) !== '';
            if (!hasExtension) {
                const spaFallback = join(PUBLIC_DIR, 'index.html');
                if (existsSync(spaFallback)) {
                    res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
                    res.end(readFileSync(spaFallback));
                    return;
                }
            }

            const missingExt = extname(requestPath).toLowerCase();
            const missingMimeType = MIME_TYPES[missingExt] || 'application/octet-stream';
            res.writeHead(404, { 'Content-Type': missingMimeType });
            res.end('Not Found');
        }
    }

    handleConnection(ws) {
        const playerId = `player_${this.playerIdCounter++}`;
        this.stats.totalConnections++;

        const player = {
            id: playerId,
            ws,
            name: null,
            currentGame: null,
            playerSlot: null,
            isHost: false,
            isAdmin: false,
        };

        this.players.set(playerId, player);
        this.sendToPlayer(player, { type: 'connected', playerId });

        this.bindSocketToPlayer(ws, player);

        this.broadcastStats();
    }

    bindSocketToPlayer(ws, player) {
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                this.handleMessage(player, msg);
            } catch (e) {
                console.error('Invalid message:', e);
            }
        });

        ws.on('close', () => this.handleDisconnect(player));
        ws.on('error', (err) => console.error('WebSocket error:', err));
    }

    handleMessage(player, msg) {
        switch (msg.type) {
            case 'set_name':
                player.name = msg.name.substring(0, 20);
                if (msg.isAdmin) {
                    player.isAdmin = true;
                }
                this.sendToPlayer(player, { type: 'name_set', name: player.name });
                this.broadcastStats();
                break;

            case 'ping':
                this.sendToPlayer(player, { type: 'pong', timestamp: msg.timestamp });
                break;

            case 'create_game':
                this.createGame(player, msg.settings);
                break;

            case 'list_games':
                this.sendToPlayer(player, { type: 'game_list', games: this.getPublicGameList() });
                break;

            case 'join_game':
                this.joinGame(player, msg.gameId);
                break;

            case 'leave_game':
                this.leaveGame(player);
                break;

            case 'start_game':
                this.startGame(player);
                break;

            case 'set_customization':
                this.setCustomization(player, msg);
                break;

            case 'player_ready':
                this.setPlayerReady(player, msg);
                break;

            case 'rematch_request':
                this.requestRematch(player);
                break;

            case 'rejoin_game':
                this.rejoinGame(player, msg.gameId);
                break;

            case 'game_state':
                this.handleGameState(player, msg);
                break;

            case 'player_input':
                this.handlePlayerInput(player, msg);
                break;

            case 'round_over':
                this.handleRoundOver(player, msg);
                break;

            case 'sync_state':
                this.requestSync(player);
                break;
        }
    }

    createGame(player, settings) {
        if (player.currentGame) {
            this.leaveGame(player);
        }

        const gameId = `game_${this.gameIdCounter++}`;
        const game = {
            id: gameId,
            hostId: player.id,
            hostName: player.name || 'Host',
            settings: {
                theme: 'default',
                sphereSize: 2.0,
                sphereWeight: 200,
                sphereAccel: 2000,
                collisionBounce: 0.9,
                arenaSize: 4,
                destructionRate: 3.0,
                iceRate: 2.0,
                portalRate: 8.0,
                portalCooldown: 2.0,
                bonusRate: 6.0,
                bonusDuration: 4.0,
                boostRegenSpeed: 1.5,
                boostDrainRate: 20,
                ...settings
            },
            players: [],
            state: 'LOBBY',
            stateUpdate: null,
            reconnectTimers: new Map(),
        };

        this.games.set(gameId, game);
        this.stats.gamesCreated++;

        player.currentGame = gameId;
        player.playerSlot = 1;
        player.isHost = true;
        game.players.push({
            id: player.id,
            name: player.name,
            slot: 1,
            ready: false,
            rematchRequested: false,
            disconnected: false,
            customization: this.getDefaultCustomization(1, player.name),
        });

        this.sendToPlayer(player, { type: 'game_created', game: this.getPublicGame(game) });
        this.broadcastStats();
    }

    joinGame(player, gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            this.sendToPlayer(player, { type: 'error', message: 'Game not found' });
            return;
        }

        if (game.state !== 'LOBBY') {
            this.sendToPlayer(player, { type: 'error', message: 'Game already started' });
            return;
        }

        if (game.players.length >= 2) {
            this.sendToPlayer(player, { type: 'error', message: 'Game is full' });
            return;
        }

        if (player.currentGame) {
            this.leaveGame(player);
        }

        const slot = game.players.length === 0 ? 1 : 2;
        player.currentGame = gameId;
        player.playerSlot = slot;
        player.isHost = false;
        const playerInfo = {
            id: player.id,
            name: player.name,
            slot,
            ready: false,
            rematchRequested: false,
            disconnected: false,
            customization: this.getDefaultCustomization(slot, player.name),
        };
        game.players.push(playerInfo);

        this.sendToPlayer(player, { type: 'game_joined', game: this.getPublicGame(game) });

        this.broadcastToGame(gameId, {
            type: 'player_joined',
            player: {
                id: player.id,
                name: player.name,
                slot,
                customization: { ...playerInfo.customization },
            },
        }, player.id);

        this.broadcastStats();
    }

    leaveGame(player) {
        if (!player.currentGame) return;

        const game = this.games.get(player.currentGame);
        if (!game) {
            player.currentGame = null;
            return;
        }

        const playerIndex = game.players.findIndex(p => p.id === player.id);
        const departingPlayerInfo = playerIndex !== -1 ? game.players[playerIndex] : null;
        if (departingPlayerInfo) {
            this.clearReconnectTimer(game, departingPlayerInfo.slot);
        }
        if (playerIndex !== -1) {
            game.players.splice(playerIndex, 1);
        }

        this.broadcastToGame(game.id, {
            type: 'player_left',
            playerId: player.id,
            playerSlot: player.playerSlot,
        });

        if (game.players.length === 0 || game.hostId === player.id) {
            if (game.players.length > 0) {
                const newHost = game.players[0];
                game.hostId = newHost.id;
                newHost.isHost = true;
                const hostPlayer = this.players.get(newHost.id);
                if (hostPlayer) hostPlayer.isHost = true;
                this.broadcastToGame(game.id, { type: 'new_host', hostId: newHost.id });
            } else {
                this.clearAllReconnectTimers(game);
                this.games.delete(game.id);
            }
        }

        player.currentGame = null;
        player.playerSlot = null;
        player.isHost = false;

        this.sendToPlayer(player, { type: 'left_game' });
        this.broadcastStats();
    }

    startGame(player) {
        if (!player.isHost) return;

        const game = this.games.get(player.currentGame);
        if (!game || game.state !== 'LOBBY') return;

        if (game.players.length < 2) {
            this.sendToPlayer(player, { type: 'error', message: 'Need 2 players to start' });
            return;
        }

        if (!this.areBothPlayersReady(game)) {
            this.sendToPlayer(player, { type: 'error', message: 'Both players must be ready' });
            return;
        }

        game.state = 'COUNTDOWN';
        game.countdownStart = Date.now();

        this.broadcastToGame(game.id, {
            type: 'game_starting',
            countdown: 3,
            settings: game.settings,
            players: game.players
                .slice()
                .sort((a, b) => a.slot - b.slot)
                .map(playerInfo => this.buildPlayerCustomizationPayload(playerInfo)),
        });

        setTimeout(() => {
            if (this.games.has(game.id)) {
                game.state = 'PLAYING';
                this.broadcastToGame(game.id, { type: 'game_started' });
            }
        }, 3000);
    }

    requestSync(player) {
        const game = this.games.get(player.currentGame);
        if (!game) return;

        this.sendToPlayer(player, {
            type: 'full_state',
            state: game.stateUpdate || {},
            settings: game.settings,
            gameState: game.state,
        });
    }

    handleGameState(player, msg) {
        const game = this.games.get(player.currentGame);
        if (!game || game.hostId !== player.id) return;

        game.stateUpdate = {
            ...msg.state,
            timestamp: Date.now(),
        };

        this.broadcastToGame(game.id, {
            type: 'game_state_update',
            state: game.stateUpdate,
        }, player.id);
    }

    handlePlayerInput(player, msg) {
        const game = this.games.get(player.currentGame);
        if (!game || game.state !== 'PLAYING') return;

        game.stateUpdate = {
            ...msg,
            timestamp: Date.now(),
        };

        this.broadcastToGame(game.id, {
            type: 'opponent_input',
            playerSlot: player.playerSlot,
            input: msg,
        }, player.id);
    }

    handleRoundOver(player, msg) {
        const game = this.games.get(player.currentGame);
        if (!game) return;

        this.broadcastToGame(game.id, {
            type: 'round_over',
            winner: msg.winner,
            scores: msg.scores,
        });
    }

    handleSyncState(player, msg) {
        const game = this.games.get(player.currentGame);
        if (!game) return;

        if (msg.requestFullState) {
            this.sendToPlayer(player, {
                type: 'full_state',
                state: game.stateUpdate,
                settings: game.settings,
                gameState: game.state,
            });
        }
    }

    setCustomization(player, msg) {
        const game = this.games.get(player.currentGame);
        if (!game || game.state !== 'LOBBY') return;

        const playerInfo = this.getGamePlayerInfo(game, player.id);
        if (!playerInfo) return;

        playerInfo.customization = {
            color: msg.color,
            hat: msg.hat,
            name: msg.name,
        };

        if (typeof msg.name === 'string' && msg.name.trim().length > 0) {
            const nextName = msg.name.trim().substring(0, 20);
            playerInfo.name = nextName;
            player.name = nextName;
        }

        this.broadcastToGame(game.id, {
            type: 'player_customization',
            slot: this.normalizeSlot(playerInfo.slot),
            color: playerInfo.customization.color,
            hat: playerInfo.customization.hat,
            name: playerInfo.customization.name,
        }, player.id);

        if (playerInfo.ready) {
            playerInfo.ready = false;
            this.broadcastReadyState(game, playerInfo);
        }
    }

    setPlayerReady(player, msg) {
        const game = this.games.get(player.currentGame);
        if (!game || game.state !== 'LOBBY') return;

        const playerInfo = this.getGamePlayerInfo(game, player.id);
        if (!playerInfo) return;

        playerInfo.ready = !!msg.ready;
        this.broadcastReadyState(game, playerInfo);

        if (this.areBothPlayersReady(game)) {
            this.broadcastToGame(game.id, { type: 'all_ready' });
        }
    }

    requestRematch(player) {
        const game = this.games.get(player.currentGame);
        if (!game) return;

        const playerInfo = this.getGamePlayerInfo(game, player.id);
        if (!playerInfo) return;

        playerInfo.rematchRequested = true;
        this.broadcastToGame(game.id, {
            type: 'rematch_requested',
            slot: this.normalizeSlot(playerInfo.slot),
        });

        if (game.players.length === 2 && game.players.every(p => p.rematchRequested)) {
            game.state = 'LOBBY';
            game.stateUpdate = null;
            game.countdownStart = null;
            game.players.forEach(p => {
                p.ready = false;
                p.rematchRequested = false;
                p.disconnected = false;
            });
            this.clearAllReconnectTimers(game);
            this.broadcastToGame(game.id, { type: 'rematch_start' });
        }
    }

    rejoinGame(player, gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            this.sendToPlayer(player, { type: 'error', message: 'Game not found' });
            return;
        }

        const disconnectedPlayer = game.players.find(p => p.disconnected);
        if (!disconnectedPlayer) {
            this.sendToPlayer(player, { type: 'error', message: 'No disconnected slot available' });
            return;
        }

        if (player.currentGame && player.currentGame !== gameId) {
            this.leaveGame(player);
        }

        const previousPlayerId = disconnectedPlayer.id;
        disconnectedPlayer.id = player.id;
        disconnectedPlayer.disconnected = false;
        disconnectedPlayer.reconnectDeadline = null;

        if (game.hostId === previousPlayerId) {
            game.hostId = player.id;
        }

        this.players.delete(previousPlayerId);

        player.currentGame = gameId;
        player.playerSlot = disconnectedPlayer.slot;
        player.isHost = game.hostId === player.id;
        player.name = disconnectedPlayer.name;

        this.clearReconnectTimer(game, disconnectedPlayer.slot);

        this.sendToPlayer(player, {
            type: 'rejoin_success',
            game: this.getPublicGame(game),
            slot: this.normalizeSlot(disconnectedPlayer.slot),
        });

        this.broadcastToGame(game.id, {
            type: 'player_reconnected',
            slot: this.normalizeSlot(disconnectedPlayer.slot),
        }, player.id);

        this.broadcastStats();
    }

    cleanupDisconnectedPlayer(gameId, slot, expectedPlayerId) {
        const game = this.games.get(gameId);
        if (!game) return;

        const playerIndex = game.players.findIndex(p => p.slot === slot);
        if (playerIndex === -1) return;

        const playerInfo = game.players[playerIndex];
        if (!playerInfo.disconnected || playerInfo.id !== expectedPlayerId) return;

        this.clearReconnectTimer(game, slot);
        game.players.splice(playerIndex, 1);

        this.broadcastToGame(game.id, {
            type: 'player_left',
            playerId: playerInfo.id,
            playerSlot: slot,
        });

        if (game.players.length === 0) {
            this.clearAllReconnectTimers(game);
            this.games.delete(game.id);
            this.broadcastStats();
            return;
        }

        if (game.hostId === playerInfo.id) {
            const newHost = game.players[0];
            game.hostId = newHost.id;
            const hostPlayer = this.players.get(newHost.id);
            if (hostPlayer) {
                hostPlayer.isHost = true;
            }
            this.broadcastToGame(game.id, { type: 'new_host', hostId: newHost.id });
        }

        this.broadcastStats();
    }

    handleDisconnect(player) {
        const game = this.games.get(player.currentGame);
        const playerInfo = this.getGamePlayerInfo(game, player.id);

        if (game && playerInfo && game.state === 'PLAYING') {
            playerInfo.disconnected = true;
            playerInfo.reconnectDeadline = Date.now() + 15000;

            this.broadcastToGame(game.id, {
                type: 'opponent_disconnected',
                slot: this.normalizeSlot(playerInfo.slot),
            }, player.id);

            this.clearReconnectTimer(game, playerInfo.slot);
            const timeoutId = setTimeout(() => {
                this.cleanupDisconnectedPlayer(game.id, playerInfo.slot, playerInfo.id);
            }, 15000);
            game.reconnectTimers.set(playerInfo.slot, timeoutId);

            player.currentGame = null;
            player.playerSlot = null;
            player.isHost = false;
            player.ws = null;
            this.players.delete(player.id);
            this.broadcastStats();
            return;
        }

        this.leaveGame(player);
        this.players.delete(player.id);
        this.broadcastStats();
    }

    sendToPlayer(player, msg) {
        if (player.ws && player.ws.readyState === 1) {
            player.ws.send(JSON.stringify(msg));
        }
    }

    broadcastToGame(gameId, msg, excludePlayerId = null) {
        const game = this.games.get(gameId);
        if (!game) return;

        for (const playerInfo of game.players) {
            if (playerInfo.id === excludePlayerId) continue;
            const player = this.players.get(playerInfo.id);
            if (player) {
                this.sendToPlayer(player, msg);
            }
        }
    }

    getPublicGame(game) {
        return {
            id: game.id,
            hostName: game.hostName,
            playerCount: game.players.length,
            maxPlayers: 2,
            state: game.state,
            settings: {
                theme: game.settings.theme,
                arenaSize: game.settings.arenaSize,
                sphereSize: game.settings.sphereSize,
            },
        };
    }

    getPublicGameList() {
        return Array.from(this.games.values())
            .filter(g => g.state === 'LOBBY')
            .map(g => this.getPublicGame(g));
    }

    getStats() {
        const connectedPlayers = Array.from(this.players.values())
            .filter(p => p.ws.readyState === 1 && !p.isAdmin)
            .length;

        const connectedAdmins = Array.from(this.players.values())
            .filter(p => p.ws.readyState === 1 && p.isAdmin)
            .length;

        return {
            connectedPlayers,
            connectedAdmins,
            activeGames: this.games.size,
            lobbiesWaiting: Array.from(this.games.values()).filter(g => g.state === 'LOBBY').length,
            gamesInProgress: Array.from(this.games.values()).filter(g => g.state === 'PLAYING').length,
            totalConnections: this.stats.totalConnections,
            gamesCreated: this.stats.gamesCreated,
            uptime: process.uptime(),
            supportedGames: ['Dropfall'],
        };
    }

    broadcastStats() {
        const stats = this.getStats();
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({ type: 'stats', ...stats }));
            }
        });
    }

    start(port = PORT) {
        this.server.listen(port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     DROPFALL GAME SERVER                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running at:                                            ║
║    Local:    http://localhost:${port}                             ║
║    Network:  http://<your-ip>:${port}                            ║
║                                                               ║
║  Admin Panel: http://localhost:${port}/admin.html                 ║
║                                                               ║
║  Supported Games: Dropfall                                     ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

const server = new GameServer();
server.start();
