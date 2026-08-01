const POSITION_KEYS = ['p1Pos', 'p2Pos'];
const VELOCITY_KEYS = ['p1Vel', 'p2Vel'];

function isVector(value) {
    return value
        && Number.isFinite(value.x)
        && Number.isFinite(value.y)
        && Number.isFinite(value.z);
}

function copyVector(value) {
    return isVector(value) ? { x: value.x, y: value.y, z: value.z } : value;
}

function lerpVector(from, to, alpha) {
    if (!isVector(from)) return copyVector(to);
    if (!isVector(to)) return copyVector(from);
    return {
        x: from.x + (to.x - from.x) * alpha,
        y: from.y + (to.y - from.y) * alpha,
        z: from.z + (to.z - from.z) * alpha,
    };
}

export function interpolateNetworkState(from, to, alpha) {
    const amount = Math.max(0, Math.min(1, Number(alpha) || 0));
    const state = { ...from, ...to };
    for (const key of [...POSITION_KEYS, ...VELOCITY_KEYS]) {
        state[key] = lerpVector(from?.[key], to?.[key], amount);
    }
    return state;
}

function extrapolateNetworkState(snapshot, milliseconds) {
    const seconds = Math.max(0, milliseconds) / 1000;
    const state = { ...snapshot.state };
    for (let index = 0; index < POSITION_KEYS.length; index += 1) {
        const positionKey = POSITION_KEYS[index];
        const velocityKey = VELOCITY_KEYS[index];
        const position = snapshot.state?.[positionKey];
        const velocity = snapshot.state?.[velocityKey];
        if (!isVector(position) || !isVector(velocity)) continue;
        state[positionKey] = {
            x: position.x + velocity.x * seconds,
            y: position.y + velocity.y * seconds,
            z: position.z + velocity.z * seconds,
        };
    }
    return state;
}

/**
 * Buffers authoritative snapshots on the server clock, then renders slightly
 * in the past. That turns irregular packet arrival into steady visual motion.
 */
export class NetworkStateBuffer {
    constructor({
        interpolationDelayMs = 110,
        maxExtrapolationMs = 75,
        maxSnapshots = 60,
    } = {}) {
        this.interpolationDelayMs = interpolationDelayMs;
        this.maxExtrapolationMs = maxExtrapolationMs;
        this.maxSnapshots = maxSnapshots;
        this.snapshots = [];
        this.clockOffsetMs = null;
    }

    clear() {
        this.snapshots = [];
        this.clockOffsetMs = null;
    }

    push({ tick, serverTime, receivedAt = Date.now(), state }) {
        if (!Number.isFinite(tick) || !state) return false;
        const normalizedServerTime = Number.isFinite(serverTime) ? serverTime : receivedAt;
        const snapshot = {
            tick,
            serverTime: normalizedServerTime,
            receivedAt,
            state,
        };

        const offsetSample = receivedAt - normalizedServerTime;
        if (this.clockOffsetMs == null || offsetSample < this.clockOffsetMs) {
            this.clockOffsetMs = offsetSample;
        } else {
            // Follow real clock drift slowly without letting a single delayed
            // packet move the render timeline forward.
            this.clockOffsetMs += (offsetSample - this.clockOffsetMs) * 0.002;
        }

        const duplicateIndex = this.snapshots.findIndex(item => item.tick === tick);
        if (duplicateIndex >= 0) this.snapshots.splice(duplicateIndex, 1);
        this.snapshots.push(snapshot);
        this.snapshots.sort((a, b) => a.serverTime - b.serverTime || a.tick - b.tick);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
        }
        return true;
    }

    sample(now = Date.now()) {
        if (this.snapshots.length === 0 || this.clockOffsetMs == null) return null;

        const renderServerTime = now - this.clockOffsetMs - this.interpolationDelayMs;
        const first = this.snapshots[0];
        const latest = this.snapshots[this.snapshots.length - 1];

        if (renderServerTime <= first.serverTime) {
            return { state: first.state, tick: first.tick, mode: 'buffering' };
        }
        if (this.snapshots.length === 1) {
            const extrapolationMs = Math.min(
                this.maxExtrapolationMs,
                renderServerTime - first.serverTime,
            );
            return {
                state: extrapolateNetworkState(first, extrapolationMs),
                tick: first.tick,
                mode: 'extrapolated',
            };
        }

        for (let index = 1; index < this.snapshots.length; index += 1) {
            const after = this.snapshots[index];
            if (after.serverTime < renderServerTime) continue;
            const before = this.snapshots[index - 1];
            const duration = Math.max(1, after.serverTime - before.serverTime);
            const alpha = (renderServerTime - before.serverTime) / duration;
            return {
                state: interpolateNetworkState(before.state, after.state, alpha),
                tick: before.tick + (after.tick - before.tick) * alpha,
                mode: 'interpolated',
            };
        }

        const extrapolationMs = Math.min(
            this.maxExtrapolationMs,
            Math.max(0, renderServerTime - latest.serverTime),
        );
        return {
            state: extrapolateNetworkState(latest, extrapolationMs),
            tick: latest.tick,
            mode: extrapolationMs > 0 ? 'extrapolated' : 'latest',
        };
    }
}
