import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from 'fs';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { DROPFALL_PROTOCOL_VERSION } from '../../shared/protocolVersion.js';
import { GAME_RULES_VERSION } from '../../shared/gameRules.js';

const MAX_MATCH_EVENTS = 5000;

function cleanName(value) {
    return String(value || 'Pilot')
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20) || 'Pilot';
}

function defaultData() {
    return { version: 1, matches: [], entries: {} };
}

function loadJson(filePath, fallback) {
    try {
        return existsSync(filePath)
            ? JSON.parse(readFileSync(filePath, 'utf8'))
            : fallback;
    } catch {
        return fallback;
    }
}

export class ScoreboardService {
    constructor(dataPath, { signingKey = process.env.DROPFALL_SCORE_SIGNING_KEY || '' } = {}) {
        this.dataPath = dataPath;
        mkdirSync(dirname(dataPath), { recursive: true });
        this.signingKey = signingKey || this.loadOrCreateDevelopmentKey();
        const loaded = loadJson(dataPath, defaultData());
        this.data = {
            version: 1,
            matches: Array.isArray(loaded.matches) ? loaded.matches.slice(-MAX_MATCH_EVENTS) : [],
            entries: loaded.entries && typeof loaded.entries === 'object' ? loaded.entries : {},
        };
    }

    loadOrCreateDevelopmentKey() {
        const keyPath = join(dirname(this.dataPath), '.score-signing-key');
        if (existsSync(keyPath)) return readFileSync(keyPath, 'utf8').trim();
        const key = randomBytes(32).toString('hex');
        try {
            writeFileSync(keyPath, key, { mode: 0o600, flag: 'wx' });
            return key;
        } catch (error) {
            if (error?.code === 'EEXIST') return readFileSync(keyPath, 'utf8').trim();
            throw error;
        }
    }

    sign(payload) {
        return createHmac('sha256', this.signingKey)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    persist() {
        const tempPath = `${this.dataPath}.${process.pid}.tmp`;
        writeFileSync(tempPath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
        renameSync(tempPath, this.dataPath);
    }

    recordMatch(snapshot) {
        const matchId = String(snapshot?.matchId || randomUUID()).slice(0, 120);
        if (this.data.matches.some(match => match.matchId === matchId)) return false;
        const players = Array.isArray(snapshot?.players)
            ? snapshot.players.slice(0, 2).map(player => ({
                slot: player.slot === 2 ? 2 : 1,
                displayName: cleanName(player.name),
            }))
            : [];
        if (players.length !== 2 || ![1, 2].includes(snapshot?.winnerSlot)) return false;

        const scores = {
            p1: Math.max(0, Number(snapshot.scores?.p1) || 0),
            p2: Math.max(0, Number(snapshot.scores?.p2) || 0),
        };
        const event = {
            matchId,
            roomId: String(snapshot.roomId || '').slice(0, 100),
            matchNumber: Math.max(1, Number(snapshot.matchNumber) || 1),
            occurredAt: typeof snapshot.occurredAt === 'string'
                ? snapshot.occurredAt
                : new Date().toISOString(),
            durationMs: Math.max(0, Number(snapshot.durationMs) || 0),
            winnerSlot: snapshot.winnerSlot,
            scores,
            players,
            protocolVersion: DROPFALL_PROTOCOL_VERSION,
            rulesVersion: GAME_RULES_VERSION,
        };
        const signedEvent = { ...event, signature: this.sign(event) };
        this.data.matches = [...this.data.matches, signedEvent].slice(-MAX_MATCH_EVENTS);

        for (const player of players) {
            const key = player.displayName.toLocaleLowerCase('en-US');
            const previous = this.data.entries[key] || {
                displayName: player.displayName,
                matches: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                bestStreak: 0,
                lastPlayedAt: null,
            };
            const won = player.slot === event.winnerSlot;
            const currentStreak = won ? previous.currentStreak + 1 : 0;
            this.data.entries[key] = {
                ...previous,
                displayName: player.displayName,
                matches: previous.matches + 1,
                wins: previous.wins + (won ? 1 : 0),
                losses: previous.losses + (won ? 0 : 1),
                currentStreak,
                bestStreak: Math.max(previous.bestStreak, currentStreak),
                lastPlayedAt: event.occurredAt,
            };
        }

        this.persist();
        return true;
    }

    getLeaderboard(limit = 50) {
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
        return Object.values(this.data.entries)
            .map(entry => ({
                displayName: cleanName(entry.displayName),
                matches: Math.max(0, Number(entry.matches) || 0),
                wins: Math.max(0, Number(entry.wins) || 0),
                losses: Math.max(0, Number(entry.losses) || 0),
                bestStreak: Math.max(0, Number(entry.bestStreak) || 0),
                winRate: entry.matches > 0 ? entry.wins / entry.matches : 0,
                lastPlayedAt: entry.lastPlayedAt || null,
            }))
            .sort((a, b) => b.wins - a.wins
                || b.winRate - a.winRate
                || b.bestStreak - a.bestStreak
                || a.displayName.localeCompare(b.displayName))
            .slice(0, safeLimit);
    }

    getRecentMatches(limit = 20) {
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
        return this.data.matches.slice(-safeLimit).reverse();
    }
}
