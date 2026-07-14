import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { networkInterfaces } from 'os';
import { GameRoom } from './game/GameRoom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(__dirname, 'public');
const LEVELS_DIR = join(__dirname, 'levels');

mkdirSync(LEVELS_DIR, { recursive: true });

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

        this.createServerLobby();
    }

    createServerLobby() {
        const gameId = 'server-lobby';
        const existing = this.games.get(gameId);
        if (existing) return existing;

        const room = new GameRoom(gameId, 'server', 'Dropfall Public', {}, { isServerLobby: true });
        room.onBroadcast = (playerId, msg) => {
            const p = this.players.get(playerId);
            if (p) this.sendToPlayer(p, msg);
        };
        room.onGameEnded = (endedRoom) => {
            if (!endedRoom.isServerLobby) {
                this.games.delete(endedRoom.id);
            }
            this.broadcastStats();
        };

        this.games.set(gameId, room);
        this.stats.gamesCreated++;
        this.broadcastStats();
        return room;
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

    broadcastReadyState(room, playerInfo) {
        if (!room || !playerInfo) return;
        this.broadcastToGame(room.id, {
            type: 'ready_state',
            slot: this.normalizeSlot(playerInfo.slot),
            ready: !!playerInfo.ready,
        });
    }

    handleHttp(req, res) {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const requestPath = parsedUrl.pathname || '/';
        const normalizedPath = requestPath.length > 1 ? requestPath.replace(/\/+$/, '') || '/' : requestPath;
        const isLevelApiPath = normalizedPath === '/api/levels' || normalizedPath.startsWith('/api/levels/');

        // 1) CORS preflight for level API
        if (req.method === 'OPTIONS' && isLevelApiPath) {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end();
            return;
        }

        // 2) API routes
        if (req.method === 'GET' && normalizedPath === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                uptime: process.uptime(),
                connections: this.players.size,
                games: this.games.size,
            }));
            return;
        }

        if (req.method === 'GET' && normalizedPath === '/api/stats') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getStats()));
            return;
        }

        if (req.method === 'GET' && normalizedPath === '/api/games') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getPublicGameList()));
            return;
        }

        if (req.method === 'GET' && normalizedPath === '/api/network-info') {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store',
            });
            res.end(JSON.stringify({
                lanAddresses: this.getLanAddresses(),
                port: PORT,
            }));
            return;
        }

        if (isLevelApiPath) {
            this.handleLevelAPI(req, res, parsedUrl);
            return;
        }

        // 3) Clean URL routes (can be wrapped with auth middleware later)
        if (req.method === 'GET' && normalizedPath === '/admin') {
            const adminPath = join(PUBLIC_DIR, 'admin.html');
            if (existsSync(adminPath)) {
                res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
                res.end(readFileSync(adminPath));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
            return;
        }

        if (req.method === 'GET' && normalizedPath === '/editor') {
            const editorPath = join(PUBLIC_DIR, 'editor-3d.html');
            if (existsSync(editorPath)) {
                res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
                res.end(readFileSync(editorPath));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
            return;
        }

        // 4) Redirect old URLs
        if (req.method === 'GET' && normalizedPath === '/admin.html') {
            res.writeHead(301, { Location: '/admin' });
            res.end();
            return;
        }

        if (req.method === 'GET' && normalizedPath === '/editor-3d.html') {
            res.writeHead(301, { Location: '/editor' });
            res.end();
            return;
        }

        // 5) Static files
        let filePath = requestPath === '/' ? '/index.html' : requestPath;
        filePath = join(PUBLIC_DIR, filePath);

        if (existsSync(filePath)) {
            const ext = extname(requestPath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(readFileSync(filePath));
        } else {
            // 6) SPA fallback
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

    sanitizeLevelId(id) {
        if (typeof id !== 'string' || id.length === 0) {
            return null;
        }
        if (id.includes('/') || id.includes('\\') || id.includes('..')) {
            return null;
        }
        return id;
    }

    handleLevelAPI(req, res, parsedUrl) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cache-Control', 'no-store');

        const pathname = parsedUrl.pathname;
        const MAX_BODY_BYTES = 1024 * 1024;

        const sendJson = (statusCode, payload) => {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(payload));
        };

        const getPathLevelId = () => {
            const match = pathname.match(/^\/api\/levels\/([^/]+)$/);
            if (!match) {
                return null;
            }
            try {
                return decodeURIComponent(match[1]);
            } catch {
                return null;
            }
        };

        const readBodyWithLimit = (onSuccess) => {
            let body = '';
            let bodySize = 0;
            let rejected = false;

            req.on('data', (chunk) => {
                if (rejected) return;
                bodySize += chunk.length;
                if (bodySize > MAX_BODY_BYTES) {
                    rejected = true;
                    sendJson(413, { error: 'Request body too large (max 1MB)' });
                    req.destroy();
                    return;
                }
                body += chunk;
            });

            req.on('end', () => {
                if (rejected) return;
                onSuccess(body);
            });
        };

        if (req.method === 'GET' && pathname === '/api/levels') {
            try {
                const files = readdirSync(LEVELS_DIR);
                const levels = files
                    .filter((f) => f.endsWith('.json'))
                    .map((f) => {
                        const fullPath = join(LEVELS_DIR, f);
                        const data = JSON.parse(readFileSync(fullPath, 'utf-8'));
                        return {
                            id: f.replace('.json', ''),
                            name: data.name,
                            description: data.description,
                            difficulty: data.difficulty,
                            tileCount: data.tiles?.length || 0,
                            lastModified: statSync(fullPath).mtimeMs,
                        };
                    });

                sendJson(200, levels);
            } catch (err) {
                sendJson(500, { error: err.message });
            }
            return;
        }

        if (req.method === 'GET' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            const levelId = this.sanitizeLevelId(getPathLevelId());
            if (!levelId) {
                sendJson(400, { error: 'Invalid level id' });
                return;
            }

            try {
                const data = readFileSync(join(LEVELS_DIR, `${levelId}.json`), 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } catch {
                sendJson(404, { error: 'Level not found' });
            }
            return;
        }

        if (req.method === 'POST' && pathname === '/api/levels') {
            readBodyWithLimit((body) => {
                try {
                    const level = JSON.parse(body);
                    const providedId = typeof level.id === 'string' ? level.id : null;
                    const safeProvidedId = providedId ? this.sanitizeLevelId(providedId) : null;

                    if (providedId && !safeProvidedId) {
                        sendJson(400, { error: 'Invalid level id' });
                        return;
                    }

                    const id = safeProvidedId || `level_${Date.now()}_${randomBytes(4).toString('hex')}`;
                    writeFileSync(join(LEVELS_DIR, `${id}.json`), JSON.stringify(level, null, 2));
                    sendJson(200, { id, success: true });
                } catch (err) {
                    sendJson(400, { error: err.message });
                }
            });
            return;
        }

        if (req.method === 'PUT' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            const levelId = this.sanitizeLevelId(getPathLevelId());
            if (!levelId) {
                sendJson(400, { error: 'Invalid level id' });
                return;
            }

            readBodyWithLimit((body) => {
                try {
                    const level = JSON.parse(body);
                    level.id = levelId;
                    writeFileSync(join(LEVELS_DIR, `${levelId}.json`), JSON.stringify(level, null, 2));
                    sendJson(200, { id: levelId, success: true });
                } catch (err) {
                    sendJson(400, { error: err.message });
                }
            });
            return;
        }

        if (req.method === 'DELETE' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            const levelId = this.sanitizeLevelId(getPathLevelId());
            if (!levelId) {
                sendJson(400, { error: 'Invalid level id' });
                return;
            }

            try {
                unlinkSync(join(LEVELS_DIR, `${levelId}.json`));
                sendJson(200, { success: true });
            } catch {
                sendJson(404, { error: 'Level not found' });
            }
            return;
        }

        sendJson(404, { error: 'Not Found' });
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
        const room = new GameRoom(gameId, player.id, player.name || 'Host', settings);
        room.onBroadcast = (playerId, msg) => {
            const p = this.players.get(playerId);
            if (p) this.sendToPlayer(p, msg);
        };
        room.onGameEnded = (endedRoom) => {
            this.games.delete(endedRoom.id);
            this.broadcastStats();
        };

        this.games.set(gameId, room);
        this.stats.gamesCreated++;

        player.currentGame = gameId;
        player.playerSlot = 1;
        player.isHost = true;
        room.addPlayer(player.id, player.name, player.ws);

        this.sendToPlayer(player, { type: 'game_created', game: room.getPublicGame() });
        this.broadcastStats();
    }

    joinGame(player, gameId) {
        const room = this.games.get(gameId);
        if (!room) {
            this.sendToPlayer(player, { type: 'error', message: 'Game not found' });
            return;
        }

        if (room.state !== 'LOBBY') {
            this.sendToPlayer(player, { type: 'error', message: 'Game already started' });
            return;
        }

        if (room.isFull()) {
            this.sendToPlayer(player, { type: 'error', message: 'Game is full' });
            return;
        }

        if (player.currentGame) {
            this.leaveGame(player);
        }

        const playerInfo = room.addPlayer(player.id, player.name, player.ws);
        if (!playerInfo) {
            this.sendToPlayer(player, { type: 'error', message: 'Failed to join game' });
            return;
        }

        player.currentGame = gameId;
        player.playerSlot = playerInfo.slot;
        player.isHost = false;

        this.sendToPlayer(player, { type: 'game_joined', game: room.getPublicGame() });

        for (const existing of room.players) {
            if (existing.id === player.id) continue;
            this.sendToPlayer(player, {
                type: 'player_joined',
                player: {
                    id: existing.id,
                    name: existing.name,
                    slot: existing.slot,
                    customization: {
                        color: existing.color ?? this.normalizeSlot(existing.slot),
                        hat: existing.hat ?? 'none',
                        name: existing.name,
                    },
                },
            });
        }

        this.broadcastToGame(gameId, {
            type: 'player_joined',
            player: {
                id: player.id,
                name: player.name,
                slot: playerInfo.slot,
                customization: this.getDefaultCustomization(playerInfo.slot, player.name),
            },
        }, player.id);

        this.broadcastStats();
    }

    leaveGame(player) {
        if (!player.currentGame) return;

        const room = this.games.get(player.currentGame);
        if (!room) {
            player.currentGame = null;
            return;
        }

        const result = room.removePlayer(player.id);

        this.broadcastToGame(room.id, {
            type: 'player_left',
            playerId: player.id,
            playerSlot: player.playerSlot,
        });

        if (!result || !result.disconnected) {
            if (room.players.length === 0) {
                room.destroy();
                this.games.delete(room.id);
            } else if (room.hostId === player.id) {
                room.hostId = room.players[0].id;
                const hostPlayer = this.players.get(room.players[0].id);
                if (hostPlayer) hostPlayer.isHost = true;
                this.broadcastToGame(room.id, { type: 'new_host', hostId: room.hostId });
            }
        }

        player.currentGame = null;
        player.playerSlot = null;
        player.isHost = false;

        this.sendToPlayer(player, { type: 'left_game' });
        this.broadcastStats();
    }

    startGame(player) {
        const room = this.games.get(player.currentGame);
        if (!room || room.state !== 'LOBBY') return;

        if (room.isServerLobby) {
            if (room.players.length < 2) {
                this.sendToPlayer(player, { type: 'error', message: 'Need 2 players to start' });
                return;
            }
            if (!room.areBothReady()) {
                this.sendToPlayer(player, { type: 'error', message: 'Both players must be ready' });
                return;
            }
            room.startCountdown();
            return;
        }

        if (!player.isHost) return;

        if (room.players.length < 2) {
            this.sendToPlayer(player, { type: 'error', message: 'Need 2 players to start' });
            return;
        }

        if (!room.areBothReady()) {
            this.sendToPlayer(player, { type: 'error', message: 'Both players must be ready' });
            return;
        }

        room.startCountdown();
    }

    requestSync(player) {
        const room = this.games.get(player.currentGame);
        if (!room) return;

        room.requestFullState(player.id);
    }

    handleGameState(player, msg) {
        // Server is authoritative; game state is computed in GameRoom, not received from clients.
    }

    handlePlayerInput(player, msg) {
        const room = this.games.get(player.currentGame);
        if (!room) return;

        room.setInput(player.id, msg);
    }

    handleRoundOver(player, msg) {
        // Server is authoritative; round end is handled by GameRoom.
    }

    handleSyncState(player, msg) {
        const room = this.games.get(player.currentGame);
        if (!room) return;

        if (msg.requestFullState) {
            room.requestFullState(player.id);
        }
    }

    setCustomization(player, msg) {
        const room = this.games.get(player.currentGame);
        if (!room || room.state !== 'LOBBY') return;

        const playerInfo = room.players.find(p => p.id === player.id);
        if (!playerInfo) return;

        room.setCustomization(player.id, msg);

        this.broadcastToGame(room.id, {
            type: 'player_customization',
            slot: this.normalizeSlot(playerInfo.slot),
            color: msg.color,
            hat: msg.hat,
            name: playerInfo.name,
        }, player.id);

        if (playerInfo.ready) {
            playerInfo.ready = false;
            this.broadcastReadyState(room, playerInfo);
        }
    }

    setPlayerReady(player, msg) {
        const room = this.games.get(player.currentGame);
        if (!room || room.state !== 'LOBBY') return;

        room.setReady(player.id, msg.ready);

        const playerInfo = room.players.find(p => p.id === player.id);
        if (playerInfo) {
            this.broadcastReadyState(room, playerInfo);
        }

        if (room.areBothReady()) {
            this.broadcastToGame(room.id, { type: 'all_ready' });
            if (room.isServerLobby) {
                room.maybeAutoStart();
            }
        }
    }

    requestRematch(player) {
        const room = this.games.get(player.currentGame);
        if (!room) return;

        room.requestRematch(player.id);
    }

    rejoinGame(player, gameId) {
        const room = this.games.get(gameId);
        if (!room) {
            this.sendToPlayer(player, { type: 'error', message: 'Game not found' });
            return;
        }

        const disconnectedPlayer = room.players.find(p => p.disconnected);
        if (!disconnectedPlayer) {
            this.sendToPlayer(player, { type: 'error', message: 'No disconnected slot available' });
            return;
        }

        if (player.currentGame && player.currentGame !== gameId) {
            this.leaveGame(player);
        }

        const previousPlayerId = disconnectedPlayer.id;
        const reconnected = room.reconnect(previousPlayerId, player.id, player.ws);
        if (!reconnected) {
            this.sendToPlayer(player, { type: 'error', message: 'Rejoin failed' });
            return;
        }

        this.players.delete(previousPlayerId);

        player.currentGame = gameId;
        player.playerSlot = reconnected.slot;
        player.isHost = room.hostId === player.id;
        player.name = reconnected.name;

        this.sendToPlayer(player, {
            type: 'rejoin_success',
            game: room.getPublicGame(),
            slot: this.normalizeSlot(reconnected.slot),
        });

        this.broadcastToGame(room.id, {
            type: 'player_reconnected',
            slot: this.normalizeSlot(reconnected.slot),
        }, player.id);

        this.broadcastStats();
    }

    handleDisconnect(player) {
        const room = this.games.get(player.currentGame);

        if (room) {
            const result = room.removePlayer(player.id);
            if (result && result.disconnected) {
                this.broadcastToGame(room.id, {
                    type: 'opponent_disconnected',
                    slot: this.normalizeSlot(result.slot),
                }, player.id);

                player.currentGame = null;
                player.playerSlot = null;
                player.isHost = false;
                player.ws = null;
                this.players.delete(player.id);
                this.broadcastStats();
                return;
            }
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
        const room = this.games.get(gameId);
        if (!room) return;

        room.onBroadcast = room.onBroadcast || ((playerId, message) => {
            const p = this.players.get(playerId);
            if (p) this.sendToPlayer(p, message);
        });

        for (const playerInfo of room.players) {
            if (playerInfo.id === excludePlayerId) continue;
            if (playerInfo.ws && playerInfo.ws.readyState === 1) {
                room.onBroadcast(playerInfo.id, msg);
            }
        }
    }

    getPublicGame(room) {
        return room.getPublicGame();
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

    getLanAddresses() {
        try {
            const interfaces = networkInterfaces();
            const addresses = [];
            for (const [name, nets] of Object.entries(interfaces)) {
                if (!nets) continue;
                for (const net of nets) {
                    if (net.family === 'IPv4' && !net.internal) {
                        addresses.push({ interface: name, address: net.address });
                    }
                }
            }
            return addresses;
        } catch {
            return [];
        }
    }

    start(port = PORT) {
        this.server.listen(port, () => {
            const lanAddrs = this.getLanAddresses();
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     DROPFALL GAME SERVER                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running at:                                            ║
║    Game:          http://localhost:${port}                        ║
║    Admin:         http://localhost:${port}/admin                  ║
║    Level Editor:  http://localhost:${port}/editor                 ║
║                                                               ║
║  Supported Games: Dropfall                                     ║
╚═══════════════════════════════════════════════════════════════╝
            `);
            if (lanAddrs.length > 0) {
                console.log('  LAN addresses:');
                lanAddrs.forEach(a => console.log(`    ${a.interface}: ${a.address}:${port}`));
            }
        });
    }
}

const server = new GameServer();
server.start();
