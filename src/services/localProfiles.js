import { normalizeHatId } from '../../shared/cosmetics.js';

const STORAGE_KEY = 'dropfall_local_profiles_v1';
const MAX_PROFILES = 8;
const MAX_RECENT_MATCHES = 50;

function storage() {
    try {
        return globalThis.localStorage || null;
    } catch {
        return null;
    }
}

function makeId(prefix) {
    const id = globalThis.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${id}`;
}

export function normalizeDisplayName(value, fallback = 'Pilot') {
    const normalized = String(value || '')
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20);
    return normalized || fallback;
}

function createStats() {
    return {
        matches: 0,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        bestStreak: 0,
        fastestWinMs: null,
        lastPlayedAt: null,
    };
}

function createProfile(displayName = 'Player 1') {
    const now = new Date().toISOString();
    return {
        id: makeId('local'),
        displayName: normalizeDisplayName(displayName, 'Player 1'),
        createdAt: now,
        updatedAt: now,
        account: { status: 'guest', provider: null },
        cosmetics: { ballColor: 0xff0000, hat: 'none' },
        stats: createStats(),
        recentMatches: [],
    };
}

function sanitizeProfile(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
    const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    return {
        id: raw.id.slice(0, 100),
        displayName: normalizeDisplayName(raw.displayName),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
        account: raw.account?.status === 'linked'
            ? { status: 'linked', provider: String(raw.account.provider || 'dropfall') }
            : { status: 'guest', provider: null },
        cosmetics: {
            ballColor: Number.isInteger(raw.cosmetics?.ballColor) ? raw.cosmetics.ballColor : 0xff0000,
            hat: normalizeHatId(raw.cosmetics?.hat),
        },
        stats: {
            matches: Math.max(0, Number(stats.matches) || 0),
            wins: Math.max(0, Number(stats.wins) || 0),
            losses: Math.max(0, Number(stats.losses) || 0),
            currentStreak: Math.max(0, Number(stats.currentStreak) || 0),
            bestStreak: Math.max(0, Number(stats.bestStreak) || 0),
            fastestWinMs: Number.isFinite(stats.fastestWinMs) ? Math.max(0, stats.fastestWinMs) : null,
            lastPlayedAt: typeof stats.lastPlayedAt === 'string' ? stats.lastPlayedAt : null,
        },
        recentMatches: Array.isArray(raw.recentMatches)
            ? raw.recentMatches.slice(0, MAX_RECENT_MATCHES).filter(match => match && typeof match === 'object')
            : [],
    };
}

function createDefaultState(displayName) {
    const profile = createProfile(displayName);
    return { version: 1, selectedProfileId: profile.id, profiles: [profile] };
}

export function loadLocalProfiles(displayName = 'Player 1') {
    let parsed = null;
    try {
        const raw = storage()?.getItem(STORAGE_KEY);
        parsed = raw ? JSON.parse(raw) : null;
    } catch {
        parsed = null;
    }

    const profiles = Array.isArray(parsed?.profiles)
        ? parsed.profiles.map(sanitizeProfile).filter(Boolean).slice(0, MAX_PROFILES)
        : [];
    if (profiles.length === 0) return createDefaultState(displayName);

    const selectedProfileId = profiles.some(profile => profile.id === parsed.selectedProfileId)
        ? parsed.selectedProfileId
        : profiles[0].id;
    return { version: 1, selectedProfileId, profiles };
}

export function saveLocalProfiles(state) {
    const profiles = Array.isArray(state?.profiles)
        ? state.profiles.map(sanitizeProfile).filter(Boolean).slice(0, MAX_PROFILES)
        : [];
    if (profiles.length === 0) return false;
    const selectedProfileId = profiles.some(profile => profile.id === state.selectedProfileId)
        ? state.selectedProfileId
        : profiles[0].id;
    try {
        storage()?.setItem(STORAGE_KEY, JSON.stringify({
            version: 1,
            selectedProfileId,
            profiles,
        }));
        return true;
    } catch {
        return false;
    }
}

export function getSelectedLocalProfile(state) {
    return state.profiles.find(profile => profile.id === state.selectedProfileId)
        || state.profiles[0]
        || null;
}

export function addLocalProfile(state, displayName) {
    if (state.profiles.length >= MAX_PROFILES) return state;
    const profile = createProfile(displayName);
    return {
        ...state,
        selectedProfileId: profile.id,
        profiles: [...state.profiles, profile],
    };
}

export function updateLocalProfile(state, profileId, updates) {
    const updatedAt = new Date().toISOString();
    return {
        ...state,
        profiles: state.profiles.map(profile => profile.id === profileId
            ? {
                ...profile,
                displayName: updates.displayName === undefined
                    ? profile.displayName
                    : normalizeDisplayName(updates.displayName, profile.displayName),
                cosmetics: {
                    ballColor: Number.isInteger(updates.ballColor)
                        ? updates.ballColor
                        : profile.cosmetics.ballColor,
                    hat: typeof updates.hat === 'string'
                        ? normalizeHatId(updates.hat)
                        : profile.cosmetics.hat,
                },
                updatedAt,
            }
            : profile),
    };
}

export function selectLocalProfile(state, profileId) {
    if (!state.profiles.some(profile => profile.id === profileId)) return state;
    return { ...state, selectedProfileId: profileId };
}

export function recordLocalMatch(state, result) {
    if (!result || typeof result !== 'object' || !result.profileId || !result.matchId) return state;
    const occurredAt = typeof result.occurredAt === 'string'
        ? result.occurredAt
        : new Date().toISOString();

    return {
        ...state,
        profiles: state.profiles.map(profile => {
            if (profile.id !== result.profileId) return profile;
            if (profile.recentMatches.some(match => match.matchId === result.matchId)) return profile;

            const won = Boolean(result.won);
            const currentStreak = won ? profile.stats.currentStreak + 1 : 0;
            const durationMs = Number.isFinite(result.durationMs) ? Math.max(0, result.durationMs) : null;
            const fastestWinMs = won && durationMs !== null
                ? profile.stats.fastestWinMs === null
                    ? durationMs
                    : Math.min(profile.stats.fastestWinMs, durationMs)
                : profile.stats.fastestWinMs;
            const recentMatch = {
                matchId: String(result.matchId).slice(0, 120),
                occurredAt,
                mode: ['1P', '2P'].includes(result.mode) ? result.mode : '1P',
                opponentName: normalizeDisplayName(result.opponentName, 'Opponent'),
                won,
                scoreFor: Math.max(0, Number(result.scoreFor) || 0),
                scoreAgainst: Math.max(0, Number(result.scoreAgainst) || 0),
                durationMs,
            };

            return {
                ...profile,
                updatedAt: occurredAt,
                stats: {
                    matches: profile.stats.matches + 1,
                    wins: profile.stats.wins + (won ? 1 : 0),
                    losses: profile.stats.losses + (won ? 0 : 1),
                    currentStreak,
                    bestStreak: Math.max(profile.stats.bestStreak, currentStreak),
                    fastestWinMs,
                    lastPlayedAt: occurredAt,
                },
                recentMatches: [recentMatch, ...profile.recentMatches].slice(0, MAX_RECENT_MATCHES),
            };
        }),
    };
}

export function getLocalLeaderboard(state) {
    return state.profiles
        .map(profile => ({
            profileId: profile.id,
            displayName: profile.displayName,
            matches: profile.stats.matches,
            wins: profile.stats.wins,
            losses: profile.stats.losses,
            bestStreak: profile.stats.bestStreak,
            fastestWinMs: profile.stats.fastestWinMs,
            winRate: profile.stats.matches > 0
                ? profile.stats.wins / profile.stats.matches
                : 0,
        }))
        .sort((a, b) => b.wins - a.wins
            || b.winRate - a.winRate
            || b.bestStreak - a.bestStreak
            || a.displayName.localeCompare(b.displayName));
}

export { STORAGE_KEY as LOCAL_PROFILES_STORAGE_KEY };
