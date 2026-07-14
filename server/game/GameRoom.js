import { initPhysics, createWorld } from './PhysicsWorld.js';
import { ServerArena } from './Arena.js';
import { ServerPlayer } from './Player.js';

const TICK_RATE = 60;
const BROADCAST_RATE = 20;
const RECONNECT_GRACE_MS = 15000;
const ROUND_OVER_DELAY_MS = 2000;
const COUNTDOWN_MS = 3000;
const WINS_TO_WIN_MATCH = 3;

const DEFAULT_SETTINGS = {
    theme: 'tron',
    sphereSize: 2.0,
    sphereWeight: 200,
    sphereAccel: 2000,
    collisionBounce: 0.9,
    arenaSize: 4,
    destructionRate: 3.0,
    iceRate: 2.0,
    bonusRate: 6.0,
    bonusDuration: 4.0,
    boostRegenSpeed: 1.5,
    boostDrainRate: 20,
};

export class GameRoom {
    constructor(id, hostId, hostName, settings = {}, options = {}) {
        this.id = id;
        this.hostId = hostId;
        this.hostName = hostName || 'Host';
        this.settings = this._validateSettings({ ...DEFAULT_SETTINGS, ...settings });
        this.isServerLobby = !!(options && options.isServerLobby);

        this.players = []; // { id, name, slot, ready, rematchRequested, disconnected, reconnectDeadline, ws, player, color, hat }
        this.state = 'LOBBY';
        this.tick = 0;
        this.scores = { p1: 0, p2: 0 };
        this.matchWinner = null;
        this.roundWinner = null;
        this.roundOverAt = null;

        this.physicsReady = false;
        this.world = null;
        this.arena = null;

        this.tickInterval = null;
        this.broadcastInterval = null;
        this.reconnectTimers = new Map(); // slot -> timeoutId

        this.onBroadcast = null; // (playerId, msg) => void
        this.onGameEnded = null; // (room) => void
    }

    _validateSettings(settings) {
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        return {
            ...settings,
            sphereSize: clamp(settings.sphereSize, 0.5, 5.0),
            sphereWeight: clamp(settings.sphereWeight, 10, 500),
            sphereAccel: clamp(settings.sphereAccel, 500, 3000),
            collisionBounce: clamp(settings.collisionBounce, 0.1, 1.5),
            arenaSize: clamp(Math.round(settings.arenaSize), 2, 16),
            destructionRate: clamp(settings.destructionRate, 0.5, 10.0),
            iceRate: clamp(settings.iceRate, 0.5, 10.0),
            bonusRate: clamp(settings.bonusRate, 2.0, 15.0),
            bonusDuration: clamp(settings.bonusDuration, 1.0, 10.0),
            boostRegenSpeed: clamp(settings.boostRegenSpeed, 0.1, 5.0),
            boostDrainRate: clamp(settings.boostDrainRate, 1, 100),
        };
    }

    async initPhysics() {
        if (this.physicsReady) return;
        await initPhysics();
        this.world = createWorld();
        this.physicsReady = true;
    }

    addPlayer(id, name, ws) {
        if (this.players.length >= 2) return null;

        const slot = this.players.length === 0 ? 1 : 2;
        const playerInfo = {
            id,
            name: name || `Player ${slot}`,
            slot,
            ready: false,
            rematchRequested: false,
            disconnected: false,
            reconnectDeadline: null,
            ws,
            player: null,
            color: slot - 1,
            hat: 'none',
        };

        this.players.push(playerInfo);
        return playerInfo;
    }

    removePlayer(id) {
        const index = this.players.findIndex(p => p.id === id);
        if (index === -1) return null;

        const playerInfo = this.players[index];

        if (this.state === 'PLAYING' || this.state === 'COUNTDOWN') {
            playerInfo.disconnected = true;
            playerInfo.reconnectDeadline = Date.now() + RECONNECT_GRACE_MS;
            playerInfo.ws = null;
            this._scheduleReconnectCleanup(playerInfo.slot);
            return { disconnected: true, slot: playerInfo.slot };
        }

        this._clearReconnectCleanup(playerInfo.slot);
        this.players.splice(index, 1);
        if (this.players.length > 0 && this.hostId === id) {
            this.hostId = this.players[0].id;
        }
        return { disconnected: false };
    }

    _scheduleReconnectCleanup(slot) {
        this._clearReconnectCleanup(slot);
        const timeoutId = setTimeout(() => {
            this._cleanupDisconnectedSlot(slot);
        }, RECONNECT_GRACE_MS + 500);
        this.reconnectTimers.set(slot, timeoutId);
    }

    _clearReconnectCleanup(slot) {
        const timeoutId = this.reconnectTimers.get(slot);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.reconnectTimers.delete(slot);
        }
    }

    _cleanupDisconnectedSlot(slot) {
        const index = this.players.findIndex(p => p.slot === slot && p.disconnected);
        if (index === -1) return;

        const playerInfo = this.players[index];
        if (playerInfo.reconnectDeadline && playerInfo.reconnectDeadline > Date.now()) {
            // Still within grace window; reschedule.
            this._scheduleReconnectCleanup(slot);
            return;
        }

        this.players.splice(index, 1);
        this._broadcast({
            type: 'player_left',
            playerId: playerInfo.id,
            playerSlot: slot,
        });

        if (this.players.length === 0) {
            if (this.isServerLobby) {
                this.state = 'LOBBY';
                this.scores = { p1: 0, p2: 0 };
                this.matchWinner = null;
                this._stopLoops();
            } else {
                this.destroy();
                if (this.onGameEnded) this.onGameEnded(this);
            }
        } else if (this.hostId === playerInfo.id) {
            this.hostId = this.players[0].id;
            this._broadcast({ type: 'new_host', hostId: this.hostId });
        }
    }

    reconnect(reconnectingId, newId, ws) {
        const playerInfo = this.players.find(p => p.disconnected && p.reconnectDeadline && p.reconnectDeadline > Date.now());
        if (!playerInfo) return null;

        playerInfo.disconnected = false;
        playerInfo.reconnectDeadline = null;
        playerInfo.id = newId;
        playerInfo.ws = ws;
        this._clearReconnectCleanup(playerInfo.slot);

        if (this.hostId === reconnectingId) {
            this.hostId = newId;
        }

        return playerInfo;
    }

    isFull() {
        return this.players.length >= 2;
    }

    areBothReady() {
        return this.players.length === 2 && this.players.every(p => p.ready);
    }

    setReady(id, ready) {
        const playerInfo = this.players.find(p => p.id === id);
        if (!playerInfo) return;
        playerInfo.ready = !!ready;
    }

    async maybeAutoStart() {
        if (!this.isServerLobby) return false;
        if (this.state !== 'LOBBY') return false;
        if (this.players.length < 2) return false;
        if (!this.areBothReady()) return false;
        await this.startCountdown();
        return true;
    }

    setInput(id, input) {
        const playerInfo = this.players.find(p => p.id === id);
        if (!playerInfo || !playerInfo.player || playerInfo.disconnected) return;
        playerInfo.player.setInput(input);
    }

    async startCountdown() {
        if (this.state !== 'LOBBY') return;
        if (this.players.length < 2) return;
        if (!this.areBothReady()) return;

        await this.initPhysics();
        this._resetRound();

        this.state = 'COUNTDOWN';
        this._broadcast({
            type: 'game_starting',
            countdown: 3,
            matchStart: true,
            settings: this.settings,
            players: this.players.map(p => ({
                slot: p.slot - 1,
                name: p.name,
                color: p.color,
                hat: p.hat,
            })),
        });

        setTimeout(() => this._startPlaying(), COUNTDOWN_MS);
    }

    _startPlaying() {
        if (this.state !== 'COUNTDOWN') return;
        this.state = 'PLAYING';
        this._startLoops();
        this._broadcast({ type: 'game_started' });
    }

    _resetRound() {
        if (!this.world) return;

        if (!this.arena) {
            this.arena = new ServerArena(this.world, this.settings);
        } else {
            this.arena.reset();
        }

        for (const playerInfo of this.players) {
            if (!playerInfo.player) {
                playerInfo.player = new ServerPlayer(this.world, playerInfo.slot, this.settings);
            } else {
                playerInfo.player.reset();
            }
        }

        this.tick = 0;
        this.roundWinner = null;
    }

    _startLoops() {
        this._stopLoops();

        const tickDelta = 1 / TICK_RATE;
        this.tickInterval = setInterval(() => this._tick(tickDelta), 1000 / TICK_RATE);
        this.broadcastInterval = setInterval(() => this._broadcastState(), 1000 / BROADCAST_RATE);
    }

    _stopLoops() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
    }

    _tick(delta) {
        if (this.state !== 'PLAYING') return;

        this.tick += 1;

        if (this.arena) {
            this.arena.update(delta);
        }

        let aliveCount = 0;
        let alivePlayer = null;

        for (const playerInfo of this.players) {
            if (!playerInfo.player || playerInfo.disconnected) continue;
            playerInfo.player.update(delta, this.arena);
            if (!playerInfo.player.isDead) {
                aliveCount += 1;
                alivePlayer = playerInfo;
            }
        }

        if (this.world) {
            this.world.step();
        }

        if (aliveCount <= 1 && this.state === 'PLAYING') {
            this._endRound(alivePlayer);
        }
    }

    _endRound(winnerPlayerInfo) {
        this.state = 'ROUND_OVER';
        this.roundOverAt = Date.now();
        this.roundWinner = winnerPlayerInfo ? winnerPlayerInfo.slot : null;

        if (winnerPlayerInfo) {
            if (winnerPlayerInfo.slot === 1) this.scores.p1 += 1;
            else this.scores.p2 += 1;
        }

        const matchOver = this.scores.p1 >= WINS_TO_WIN_MATCH || this.scores.p2 >= WINS_TO_WIN_MATCH;
        if (matchOver && !this.matchWinner) {
            this.matchWinner = this.scores.p1 >= WINS_TO_WIN_MATCH ? 1 : 2;
        }

        this._broadcast({
            type: 'round_over',
            winner: this.roundWinner,
            scores: this.scores,
            matchOver,
            matchWinner: matchOver ? this.matchWinner : null,
        });

        this._stopLoops();

        setTimeout(() => {
            if (matchOver) {
                this._endMatch();
            } else {
                this._startNextRound();
            }
        }, ROUND_OVER_DELAY_MS);
    }

    _startNextRound() {
        if (this.state !== 'ROUND_OVER') return;
        if (this.players.length < 2) return;

        this._resetRound();

        this.state = 'COUNTDOWN';
        this._broadcast({
            type: 'game_starting',
            countdown: 3,
            matchStart: false,
            settings: this.settings,
            players: this.players.map(p => ({
                slot: p.slot - 1,
                name: p.name,
                color: p.color,
                hat: p.hat,
            })),
        });

        setTimeout(() => this._startPlaying(), COUNTDOWN_MS);
    }

    _endMatch() {
        this.state = 'LOBBY';
        this.roundWinner = null;
        this.roundOverAt = null;

        for (const playerInfo of this.players) {
            playerInfo.ready = false;
            playerInfo.rematchRequested = false;
        }

        this._broadcast({
            type: 'match_over',
            winner: this.matchWinner,
            scores: this.scores,
        });
    }

    _returnToLobby() {
        this.state = 'LOBBY';
        this.roundWinner = null;
        this.roundOverAt = null;
        this.matchWinner = null;
        this.scores = { p1: 0, p2: 0 };

        for (const playerInfo of this.players) {
            playerInfo.ready = false;
            playerInfo.rematchRequested = false;
        }

        this._broadcast({ type: 'rematch_start' });
    }

    _broadcastState() {
        if (this.state !== 'PLAYING') return;

        const playerStates = this.players
            .filter(p => p.player)
            .map(p => p.player.serialize());

        this._broadcast({
            type: 'game_state_update',
            tick: this.tick,
            state: {
                p1Score: this.scores.p1,
                p2Score: this.scores.p2,
                p1Pos: playerStates.find(p => p.slot === 1)?.position,
                p1Vel: playerStates.find(p => p.slot === 1)?.velocity,
                p2Pos: playerStates.find(p => p.slot === 2)?.position,
                p2Vel: playerStates.find(p => p.slot === 2)?.velocity,
                tileStates: this.arena ? this.arena.serializeTiles() : [],
            },
        });
    }

    requestFullState(playerId) {
        const playerInfo = this.players.find(p => p.id === playerId);
        if (!playerInfo) return;

        const playerStates = this.players
            .filter(p => p.player)
            .map(p => p.player.serialize());

        this._sendTo(playerId, {
            type: 'full_state',
            gameState: this.state,
            settings: this.settings,
            state: {
                p1Score: this.scores.p1,
                p2Score: this.scores.p2,
                p1Pos: playerStates.find(p => p.slot === 1)?.position,
                p1Vel: playerStates.find(p => p.slot === 1)?.velocity,
                p2Pos: playerStates.find(p => p.slot === 2)?.position,
                p2Vel: playerStates.find(p => p.slot === 2)?.velocity,
                tileStates: this.arena ? this.arena.serializeTiles() : [],
            },
        });
    }

    setCustomization(id, { color, hat, name }) {
        const playerInfo = this.players.find(p => p.id === id);
        if (!playerInfo || this.state !== 'LOBBY') return;

        if (typeof name === 'string' && name.trim().length > 0) {
            playerInfo.name = name.trim().substring(0, 20);
        }
        if (color !== undefined) playerInfo.color = color;
        if (hat !== undefined) playerInfo.hat = hat;
    }

    requestRematch(id) {
        const playerInfo = this.players.find(p => p.id === id);
        if (!playerInfo) return;

        playerInfo.rematchRequested = true;
        this._broadcast({
            type: 'rematch_requested',
            slot: playerInfo.slot - 1,
        });

        if (this.players.length === 2 && this.players.every(p => p.rematchRequested)) {
            this.scores = { p1: 0, p2: 0 };
            this.matchWinner = null;

            for (const p of this.players) {
                p.ready = true;
            }

            this.startCountdown();
        }
    }

    _broadcast(msg, excludeId = null) {
        if (!this.onBroadcast) return;
        for (const playerInfo of this.players) {
            if (playerInfo.id === excludeId) continue;
            if (playerInfo.ws && playerInfo.ws.readyState === 1) {
                this.onBroadcast(playerInfo.id, msg);
            }
        }
    }

    _sendTo(playerId, msg) {
        if (!this.onBroadcast) return;
        const playerInfo = this.players.find(p => p.id === playerId);
        if (playerInfo && playerInfo.ws && playerInfo.ws.readyState === 1) {
            this.onBroadcast(playerId, msg);
        }
    }

    getPlayers() {
        return this.players
            .filter(p => !p.disconnected)
            .map(p => ({
                id: p.id,
                name: p.name,
                slot: p.slot,
                ready: p.ready,
                color: p.color,
                hat: p.hat,
            }));
    }

    getPublicGame() {
        return {
            id: this.id,
            hostName: this.hostName,
            playerCount: this.players.filter(p => !p.disconnected).length,
            maxPlayers: 2,
            state: this.state,
            isServerLobby: this.isServerLobby,
            settings: {
                theme: this.settings.theme,
                arenaSize: this.settings.arenaSize,
                sphereSize: this.settings.sphereSize,
            },
            players: this.getPlayers(),
        };
    }

    destroy() {
        this._stopLoops();
        for (const timeoutId of this.reconnectTimers.values()) {
            clearTimeout(timeoutId);
        }
        this.reconnectTimers.clear();
        if (this.world) {
            this.world = null;
        }
        this.arena = null;
        this.players = [];
    }
}
