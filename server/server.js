import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, extname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { hostname as getSystemHostname, networkInterfaces } from 'os';
import { GameRoom } from './game/GameRoom.js';
import { ScoreboardService } from './services/ScoreboardService.js';
import { isLevelActive, validateLevelForLaunch } from '../shared/levelValidation.js';
import { parseLevelPayload } from '../shared/levelSchema.js';
import { formatProtocolIssues, parseClientMessage } from '../shared/protocolSchemas.js';
import { DROPFALL_PROTOCOL_VERSION } from '../shared/protocolVersion.js';
import {
    applyBaseSecurityHeaders,
    consumeFixedWindow,
    createOriginAllowlist,
    createReconnectToken,
    isLoopbackAddress,
    isOriginAllowed,
    readBearerToken,
    secureTokenEqual,
} from './security.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REQUESTED_PORT = Number.parseInt(process.env.PORT || '3000', 10);
const PORT = Number.isInteger(REQUESTED_PORT) && REQUESTED_PORT > 0 && REQUESTED_PORT <= 65535
    ? REQUESTED_PORT
    : 3000;
const BIND_ADDRESS = process.env.DROPFALL_HOST || '0.0.0.0';
const SYSTEM_HOSTNAME = getSystemHostname().trim().replace(/\.$/, '');
const SYSTEM_MDNS_HOSTNAME = (
    SYSTEM_HOSTNAME.toLowerCase().endsWith('.local')
        ? SYSTEM_HOSTNAME
        : `${SYSTEM_HOSTNAME.split('.')[0]}.local`
);
const MDNS_HOSTNAME = (process.env.DROPFALL_LOCAL_HOSTNAME || 'skippy.local').toLowerCase();
const LAN_HOSTNAMES = [...new Set([MDNS_HOSTNAME, SYSTEM_MDNS_HOSTNAME.toLowerCase()])];
const PUBLIC_DIR = join(__dirname, 'public');
const LEVELS_DIR = join(__dirname, 'levels');
const MAX_HTTP_BODY_BYTES = 256 * 1024;
const MAX_WS_MESSAGE_BYTES = 16 * 1024;
const MAX_WS_MESSAGES_PER_SECOND = 120;
const MAX_INVALID_MESSAGES = 5;
const WS_HEARTBEAT_MS = 30_000;

function isLegacyEditorLevel(level, levelId) {
    return level?.active === undefined
        && level?.isPublic === undefined
        && typeof levelId === 'string'
        && levelId.startsWith('level_');
}

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

export class GameServer {
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

        this.originAllowlist = createOriginAllowlist(
            process.env.DROPFALL_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '',
        );
        this.editorToken = process.env.DROPFALL_EDITOR_TOKEN || '';
        this.devToolsEnabled = process.env.DROPFALL_ENABLE_DEV_TOOLS === '1';
        this.scoreboards = new ScoreboardService(
            process.env.DROPFALL_SCOREBOARD_PATH || join(__dirname, 'data', 'scoreboards.json'),
        );

        this.server = createServer((req, res) => this.handleHttp(req, res));
        this.server.requestTimeout = 15_000;
        this.server.headersTimeout = 10_000;
        this.server.keepAliveTimeout = 5_000;
        this.server.on('clientError', (_error, socket) => {
            if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
        });

        this.wss = new WebSocketServer({
            server: this.server,
            maxPayload: MAX_WS_MESSAGE_BYTES,
            perMessageDeflate: false,
            verifyClient: ({ req }, done) => {
                if (this.isRequestOriginAllowed(req)) {
                    done(true);
                    return;
                }
                done(false, 403, 'Origin not allowed');
            },
        });

        this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
        this.wss.on('error', error => console.error('[WebSocketServer]', error.message));

        this.broadcastInterval = setInterval(() => this.broadcastStats(), 1000);
        this.heartbeatInterval = setInterval(() => {
            for (const ws of this.wss.clients) {
                if (ws.isAlive === false) {
                    ws.terminate();
                    continue;
                }
                ws.isAlive = false;
                ws.ping();
            }
        }, WS_HEARTBEAT_MS);

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
        room.onMatchCompleted = snapshot => {
            if (this.scoreboards.recordMatch(snapshot)) this.stats.gamesCompleted++;
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

    isRequestOriginAllowed(req) {
        return isOriginAllowed(
            req.headers.origin,
            req.headers.host,
            this.originAllowlist,
        );
    }

    applyCors(req, res, methods) {
        const origin = req.headers.origin;
        if (origin && !this.isRequestOriginAllowed(req)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Origin not allowed' }));
            return false;
        }
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', methods);
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Dropfall-Editor-Token');
        return true;
    }

    canAccessDevTools(req) {
        return this.devToolsEnabled || isLoopbackAddress(req.socket.remoteAddress);
    }

    authorizeLevelDeletion(req, res, sendJson) {
        if (!this.editorToken) {
            sendJson(503, {
                error: 'Level deletion is disabled. Configure DROPFALL_EDITOR_TOKEN for deletion access.',
            });
            return false;
        }
        if (!secureTokenEqual(readBearerToken(req), this.editorToken)) {
            res.setHeader('WWW-Authenticate', 'Bearer realm="Dropfall editor"');
            sendJson(401, { error: 'Editor authentication required' });
            return false;
        }
        return true;
    }

    handleHttp(req, res) {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const requestPath = parsedUrl.pathname || '/';
        const normalizedPath = requestPath.length > 1 ? requestPath.replace(/\/+$/, '') || '/' : requestPath;
        const isLevelApiPath = normalizedPath === '/api/levels' || normalizedPath.startsWith('/api/levels/');
        const isScoreboardApiPath = normalizedPath === '/api/leaderboards/online';
        const isDevToolPage = normalizedPath === '/admin' || normalizedPath === '/editor';
        applyBaseSecurityHeaders(res, { editorPage: isDevToolPage });

        // 1) CORS preflight for level API
        if (req.method === 'OPTIONS' && (isLevelApiPath || isScoreboardApiPath)) {
            const methods = isLevelApiPath ? 'GET, POST, PUT, DELETE, OPTIONS' : 'GET, OPTIONS';
            if (!this.applyCors(req, res, methods)) return;
            res.writeHead(204);
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

        if (req.method === 'GET' && isScoreboardApiPath) {
            if (!this.applyCors(req, res, 'GET, OPTIONS')) return;
            const requestedLimit = Number.parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=15',
            });
            res.end(JSON.stringify({
                board: 'online-preseason',
                trust: 'server-authoritative-unranked',
                entries: this.scoreboards.getLeaderboard(requestedLimit),
                updatedAt: new Date().toISOString(),
            }));
            return;
        }

        if (req.method === 'GET' && normalizedPath === '/api/network-info') {
            if (!this.applyCors(req, res, 'GET, OPTIONS')) return;
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            });
            res.end(JSON.stringify({
                lanAddresses: this.getLanAddresses(),
                port: PORT,
                hostname: MDNS_HOSTNAME,
                hostnames: LAN_HOSTNAMES,
                gameUrls: this.getLanGameUrls(PORT),
            }));
            return;
        }

        if (isLevelApiPath) {
            this.handleLevelAPI(req, res, parsedUrl);
            return;
        }

        // 3) Clean URL routes (can be wrapped with auth middleware later)
        if (req.method === 'GET' && normalizedPath === '/admin') {
            if (!this.canAccessDevTools(req)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }
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
            if (!this.canAccessDevTools(req)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }
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

        // 5) Static files. Map the origin root to index.html before resolving the
        // MIME type so browsers render the game instead of treating it as an
        // application/octet-stream download.
        const staticRequestPath = requestPath === '/' ? '/index.html' : requestPath;
        let decodedStaticPath = staticRequestPath;
        try {
            decodedStaticPath = decodeURIComponent(staticRequestPath);
        } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Bad Request');
            return;
        }
        const publicRoot = `${resolve(PUBLIC_DIR)}${sep}`;
        const filePath = resolve(PUBLIC_DIR, decodedStaticPath.replace(/^[/\\]+/, ''));
        const isPublicFile = filePath.startsWith(publicRoot) && existsSync(filePath) && statSync(filePath).isFile();

        if (isPublicFile) {
            const ext = extname(staticRequestPath).toLowerCase();
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
        if (typeof id !== 'string' || id.length === 0 || id.length > 80) {
            return null;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return null;
        }
        return id;
    }

    handleLevelAPI(req, res, parsedUrl) {
        if (!this.applyCors(req, res, 'GET, POST, PUT, DELETE, OPTIONS')) return;
        res.setHeader('Cache-Control', 'no-store');

        const pathname = parsedUrl.pathname;

        const sendJson = (statusCode, payload) => {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(payload));
        };

        const parseLevelBody = (body) => {
            let rawLevel;
            try {
                rawLevel = JSON.parse(body);
            } catch {
                return { error: 'Request body must be valid JSON' };
            }
            const parsed = parseLevelPayload(rawLevel);
            if (!parsed.success) {
                return {
                    error: 'Level payload is invalid',
                    details: parsed.error.issues.slice(0, 8).map(issue => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                };
            }
            return { level: parsed.data };
        };

        const validatePublication = (level) => {
            const validation = validateLevelForLaunch(level);
            return { validation };
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
                if (bodySize > MAX_HTTP_BODY_BYTES) {
                    rejected = true;
                    sendJson(413, { error: 'Request body too large (max 256KB)' });
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
                        const id = f.replace('.json', '');
                        const validation = validateLevelForLaunch(data);
                        // Older editor builds saved custom arenas before a publication
                        // flag existed. Preserve their catalogue visibility, and label
                        // arenas with launch warnings as experimental in the client.
                        const active = isLevelActive(data) || isLegacyEditorLevel(data, id);
                        return {
                            id,
                            name: data.name,
                            description: data.description,
                            difficulty: data.difficulty,
                            mode: data.mode === 'race' ? 'race' : 'battle',
                            tileCount: data.tiles?.length || 0,
                            active,
                            isPublic: active,
                            launchReady: validation.launchReady,
                            validationIssues: validation.issues,
                            validationWarnings: validation.warnings,
                            recommendedSpawns: validation.recommendedSpawns,
                            tiles: active ? data.tiles : undefined,
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
                const rawData = JSON.parse(readFileSync(join(LEVELS_DIR, `${levelId}.json`), 'utf-8'));
                const data = isLegacyEditorLevel(rawData, levelId)
                    ? { ...rawData, active: true }
                    : rawData;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            } catch {
                sendJson(404, { error: 'Level not found' });
            }
            return;
        }

        if (req.method === 'POST' && pathname === '/api/levels') {
            readBodyWithLimit((body) => {
                const parsed = parseLevelBody(body);
                if (!parsed.level) {
                    sendJson(400, parsed);
                    return;
                }
                const level = parsed.level;
                const providedId = typeof level.id === 'string' ? level.id : null;
                const id = providedId || `level_${Date.now()}_${randomBytes(4).toString('hex')}`;
                const publication = validatePublication(level);
                writeFileSync(join(LEVELS_DIR, `${id}.json`), JSON.stringify({ ...level, id }, null, 2));
                sendJson(201, {
                    id,
                    success: true,
                    active: level.active,
                    launchReady: publication.validation.launchReady,
                    validationIssues: publication.validation.issues,
                    validationWarnings: publication.validation.warnings,
                });
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
                const parsed = parseLevelBody(body);
                if (!parsed.level) {
                    sendJson(400, parsed);
                    return;
                }
                const level = { ...parsed.level, id: levelId };
                const publication = validatePublication(level);
                writeFileSync(join(LEVELS_DIR, `${levelId}.json`), JSON.stringify(level, null, 2));
                sendJson(200, {
                    id: levelId,
                    success: true,
                    active: level.active,
                    launchReady: publication.validation.launchReady,
                    validationIssues: publication.validation.issues,
                    validationWarnings: publication.validation.warnings,
                });
            });
            return;
        }

        if (req.method === 'DELETE' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            if (!this.authorizeLevelDeletion(req, res, sendJson)) return;
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

    handleConnection(ws, req) {
        const playerId = `player_${this.playerIdCounter++}`;
        this.stats.totalConnections++;
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        const player = {
            id: playerId,
            ws,
            name: null,
            currentGame: null,
            playerSlot: null,
            isHost: false,
            remoteAddress: req?.socket?.remoteAddress || null,
            invalidMessages: 0,
            messageRate: {
                windowStartedAt: Date.now(),
                events: 0,
            },
        };

        this.players.set(playerId, player);
        this.sendToPlayer(player, {
            type: 'connected',
            playerId,
            protocolVersion: DROPFALL_PROTOCOL_VERSION,
        });

        this.bindSocketToPlayer(ws, player);

        this.broadcastStats();
    }

    bindSocketToPlayer(ws, player) {
        ws.on('message', (data, isBinary) => {
            if (!consumeFixedWindow(
                player.messageRate,
                Date.now(),
                MAX_WS_MESSAGES_PER_SECOND,
                1000,
            )) {
                ws.close(1008, 'Message rate exceeded');
                return;
            }
            if (isBinary) {
                player.invalidMessages += 1;
                this.sendToPlayer(player, {
                    type: 'error',
                    code: 'INVALID_MESSAGE',
                    message: 'Binary client messages are not supported',
                });
                if (player.invalidMessages >= MAX_INVALID_MESSAGES) {
                    ws.close(1008, 'Too many invalid messages');
                }
                return;
            }
            try {
                const value = JSON.parse(data.toString('utf8'));
                const parsed = parseClientMessage(value);
                if (!parsed.success) {
                    player.invalidMessages += 1;
                    this.sendToPlayer(player, {
                        type: 'error',
                        code: 'INVALID_MESSAGE',
                        message: formatProtocolIssues(parsed.error.issues),
                    });
                    if (player.invalidMessages >= MAX_INVALID_MESSAGES) {
                        ws.close(1008, 'Too many invalid messages');
                    }
                    return;
                }
                this.handleMessage(player, parsed.data);
            } catch {
                player.invalidMessages += 1;
                this.sendToPlayer(player, {
                    type: 'error',
                    code: 'INVALID_JSON',
                    message: 'Message must be valid JSON',
                });
                if (player.invalidMessages >= MAX_INVALID_MESSAGES) {
                    ws.close(1008, 'Too many invalid messages');
                }
            }
        });

        ws.on('close', () => this.handleDisconnect(player));
        ws.on('error', (err) => console.error('WebSocket error:', err));
    }

    handleMessage(player, msg) {
        switch (msg.type) {
            case 'set_name':
                if (
                    msg.protocolVersion !== undefined &&
                    msg.protocolVersion !== DROPFALL_PROTOCOL_VERSION
                ) {
                    this.sendToPlayer(player, {
                        type: 'error',
                        code: 'PROTOCOL_MISMATCH',
                        message: 'Client protocol is not compatible with this server',
                    });
                    player.ws?.close(1002, 'Protocol mismatch');
                    return;
                }
                player.name = msg.name;
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

            case 'update_game_settings':
                this.updateGameSettings(player, msg.settings);
                break;

            case 'set_customization':
                this.setCustomization(player, msg);
                break;

            case 'player_ready':
                this.setPlayerReady(player, msg);
                break;

            case 'hurry_up_request':
                this.requestHurryUp(player);
                break;

            case 'rematch_request':
                this.requestRematch(player);
                break;

            case 'rejoin_game':
                this.rejoinGame(player, msg.gameId, msg.reconnectToken);
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

            default:
                this.sendToPlayer(player, {
                    type: 'error',
                    code: 'UNSUPPORTED_MESSAGE',
                    message: 'Unsupported message type',
                });
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
        room.onMatchCompleted = snapshot => {
            if (this.scoreboards.recordMatch(snapshot)) this.stats.gamesCompleted++;
        };

        this.games.set(gameId, room);
        this.stats.gamesCreated++;

        player.currentGame = gameId;
        player.playerSlot = 1;
        player.isHost = true;
        const playerInfo = room.addPlayer(player.id, player.name, player.ws);
        const reconnectToken = createReconnectToken();
        playerInfo.reconnectToken = reconnectToken;

        this.sendToPlayer(player, {
            type: 'game_created',
            game: room.getPublicGame(),
            reconnectToken,
        });
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
        const reconnectToken = createReconnectToken();
        playerInfo.reconnectToken = reconnectToken;

        this.sendToPlayer(player, {
            type: 'game_joined',
            game: room.getPublicGame(),
            reconnectToken,
        });

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
            game: room.getPublicGame(),
        }, player.id);

        if (!room.isServerLobby) {
            this.broadcastToGame(gameId, {
                type: 'settings_picker_changed',
                pickerId: room.settingsPickerId,
                reason: room.settingsPickerReason,
                game: room.getPublicGame(),
            });
        }

        this.broadcastStats();
    }

    leaveGame(player) {
        if (!player.currentGame) return;

        const room = this.games.get(player.currentGame);
        if (!room) {
            player.currentGame = null;
            return;
        }

        const result = room.removePlayer(player.id, { allowReconnect: false });

        this.broadcastToGame(room.id, {
            type: 'player_left',
            playerId: player.id,
            playerSlot: player.playerSlot,
        });

        if (!result || !result.disconnected) {
            if (room.players.length === 0) {
                room.destroy();
                this.games.delete(room.id);
            } else if (result?.newHostId) {
                const hostPlayer = this.players.get(result.newHostId);
                if (hostPlayer) hostPlayer.isHost = true;
                this.broadcastToGame(room.id, { type: 'new_host', hostId: room.hostId });
            }
        }

        if (this.games.has(room.id) && !room.isServerLobby) {
            this.broadcastToGame(room.id, {
                type: 'settings_picker_changed',
                pickerId: room.settingsPickerId,
                reason: room.settingsPickerReason,
                game: room.getPublicGame(),
            });
        }

        player.currentGame = null;
        player.playerSlot = null;
        player.isHost = false;

        this.sendToPlayer(player, { type: 'left_game' });
        this.broadcastStats();
    }

    updateGameSettings(player, settings) {
        const room = this.games.get(player.currentGame);
        if (!room || room.state !== 'LOBBY') {
            this.sendToPlayer(player, { type: 'error', message: 'Room settings can only be changed in the lobby' });
            return;
        }
        if (room.settingsPickerId !== player.id || room.isServerLobby) {
            this.sendToPlayer(player, { type: 'error', message: 'Only the selected player can change match settings' });
            return;
        }

        const validatedSettings = room.updateSettings(player.id, settings);
        if (!validatedSettings) {
            this.sendToPlayer(player, { type: 'error', message: 'Unable to update room settings' });
            return;
        }

        this.broadcastToGame(room.id, {
            type: 'game_settings_updated',
            settings: validatedSettings,
            game: room.getPublicGame(),
        });

        for (const playerInfo of room.players) {
            this.broadcastReadyState(room, playerInfo);
        }
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

        if (room.hostId !== player.id) return;

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

    requestHurryUp(player) {
        const room = this.games.get(player.currentGame);
        if (!room || room.state !== 'LOBBY' || room.isServerLobby) {
            this.sendToPlayer(player, { type: 'error', message: 'Hurry up is only available during private match setup' });
            return;
        }

        if (!room.startHurryUp(player.id)) {
            this.sendToPlayer(player, { type: 'error', message: 'Hurry up is not available right now' });
        }
    }

    requestRematch(player) {
        const room = this.games.get(player.currentGame);
        if (!room) return;

        room.requestRematch(player.id);
    }

    rejoinGame(player, gameId, reconnectToken) {
        const room = this.games.get(gameId);
        if (!room) {
            this.sendToPlayer(player, { type: 'error', message: 'Game not found' });
            return;
        }

        const disconnectedPlayer = room.players.find(p =>
            p.disconnected && secureTokenEqual(reconnectToken, p.reconnectToken),
        );
        if (!disconnectedPlayer) {
            this.sendToPlayer(player, {
                type: 'error',
                code: 'REJOIN_DENIED',
                message: 'Rejoin credentials are invalid or expired',
            });
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
        const rotatedReconnectToken = createReconnectToken();
        reconnected.reconnectToken = rotatedReconnectToken;

        this.sendToPlayer(player, {
            type: 'rejoin_success',
            game: room.getPublicGame(),
            slot: this.normalizeSlot(reconnected.slot),
            reconnectToken: rotatedReconnectToken,
        });

        this.broadcastToGame(room.id, {
            type: 'player_reconnected',
            slot: this.normalizeSlot(reconnected.slot),
        }, player.id);

        room.resumeAfterReconnect();
        room.requestFullState(player.id);

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

            this.broadcastToGame(room.id, {
                type: 'player_left',
                playerId: player.id,
                playerSlot: player.playerSlot,
            });

            if (room.players.length === 0) {
                room.destroy();
                this.games.delete(room.id);
            } else if (result?.newHostId) {
                const hostPlayer = this.players.get(result.newHostId);
                if (hostPlayer) hostPlayer.isHost = true;
                this.broadcastToGame(room.id, { type: 'new_host', hostId: result.newHostId });
            }

            player.currentGame = null;
            player.playerSlot = null;
            player.isHost = false;
        }

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
            .filter(p => p.ws?.readyState === 1)
            .length;

        return {
            connectedPlayers,
            connectedAdmins: 0,
            activeGames: this.games.size,
            lobbiesWaiting: Array.from(this.games.values()).filter(g => g.state === 'LOBBY').length,
            gamesInProgress: Array.from(this.games.values()).filter(g => g.state === 'PLAYING').length,
            totalConnections: this.stats.totalConnections,
            gamesCreated: this.stats.gamesCreated,
            gamesCompleted: this.stats.gamesCompleted,
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

        const games = this.getPublicGameList();
        for (const player of this.players.values()) {
            if (!player.currentGame && player.ws?.readyState === 1) {
                this.sendToPlayer(player, { type: 'game_list', games });
            }
        }
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

    getLanGameUrls(port = PORT) {
        const urls = LAN_HOSTNAMES.map(hostname => `http://${hostname}:${port}`);
        for (const { address } of this.getLanAddresses()) {
            urls.push(`http://${address}:${port}`);
        }
        return [...new Set(urls)];
    }

    start(port = PORT, host = BIND_ADDRESS) {
        return new Promise((resolveStart, rejectStart) => {
            const onError = error => {
                this.server.off('listening', onListening);
                rejectStart(error);
            };
            const onListening = () => {
                this.server.off('error', onError);
                const lanAddrs = this.getLanAddresses();
                const address = this.server.address();
                const boundPort = typeof address === 'object' && address ? address.port : port;
                console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     DROPFALL GAME SERVER                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Server is ready for local and LAN play                        ║
║                                                               ║
║  This computer:                                                ║
║    Game:          http://localhost:${boundPort}                        ║
║    Admin:         http://localhost:${boundPort}/admin                  ║
║    Level Editor:  http://localhost:${boundPort}/editor                 ║
╚═══════════════════════════════════════════════════════════════╝
            `);
                console.log(`  Preferred hostname: http://${MDNS_HOSTNAME}:${boundPort}`);
                if (SYSTEM_MDNS_HOSTNAME.toLowerCase() !== MDNS_HOSTNAME) {
                    console.log(`  Detected hostname: http://${SYSTEM_MDNS_HOSTNAME.toLowerCase()}:${boundPort}`);
                }
                lanAddrs.forEach(({ interface: interfaceName, address: lanAddress }) => {
                    console.log(`  ${interfaceName}: http://${lanAddress}:${boundPort}`);
                });
                console.log(`\n  Listening on ${host}:${boundPort}`);
                console.log('  Open one of the LAN URLs on a phone or tablet connected to this network.\n');
                resolveStart({ host, port: boundPort });
            };

            this.server.once('error', onError);
            this.server.once('listening', onListening);
            this.server.listen(port, host);
        });
    }

    async stop() {
        clearInterval(this.broadcastInterval);
        clearInterval(this.heartbeatInterval);
        for (const room of this.games.values()) room.destroy();
        for (const client of this.wss.clients) client.terminate();

        await new Promise(resolveStop => {
            this.wss.close(() => resolveStop());
        });
        if (this.server.listening) {
            await new Promise(resolveStop => this.server.close(() => resolveStop()));
        }
    }
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
    const server = new GameServer();
    server.start().catch(error => {
        console.error('[Dropfall] Failed to start server:', error.message);
        process.exitCode = 1;
    });

    let stopping = false;
    const shutdown = async signal => {
        if (stopping) return;
        stopping = true;
        console.log(`[Dropfall] ${signal} received, shutting down`);
        await server.stop();
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}
