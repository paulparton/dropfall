const POSITION_KEYS = ['p1Pos', 'p2Pos'];
const VELOCITY_KEYS = ['p1Vel', 'p2Vel'];

// Offset samples older than this stop constraining the render timeline, so a
// single very fast packet cannot pin the estimate for the whole match.
const OFFSET_WINDOW_MS = 5000;
// Per-snapshot slew limit for the clock offset. At 30 snapshots/sec this
// retimes ~24ms per second: fast enough to track real drift, slow enough that
// the remote player never visibly jumps.
const MAX_OFFSET_SLEW_MS = 0.8;
// Beyond this the connection genuinely moved (route change, sleep/wake). One
// deliberate resync beats several seconds of starved interpolation.
const OFFSET_RESYNC_MS = 250;

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
 *
 * The render timeline is `now - clockOffset - interpolationDelay`. Both terms
 * move gradually: an offset that snaps shifts the whole timeline at once, which
 * reads as the opponent teleporting.
 */
export class NetworkStateBuffer {
    /**
     * @param {object} [options]
     * @param {number} [options.interpolationDelayMs] Fixed render delay. Omit to
     *   let the delay adapt to the measured snapshot interval and jitter.
     * @param {number} [options.maxExtrapolationMs]
     * @param {number} [options.maxSnapshots]
     * @param {boolean} [options.adaptive]
     * @param {number} [options.minDelayMs]
     * @param {number} [options.maxDelayMs]
     */
    constructor({
        interpolationDelayMs,
        maxExtrapolationMs = 75,
        maxSnapshots = 60,
        adaptive,
        minDelayMs = 45,
        maxDelayMs = 240,
    } = {}) {
        // An explicit delay is honoured verbatim; otherwise the delay tracks
        // the measured snapshot interval and jitter of the live connection.
        this.adaptive = adaptive ?? interpolationDelayMs === undefined;
        this.baseDelayMs = interpolationDelayMs ?? 110;
        this.interpolationDelayMs = this.baseDelayMs;
        this.minDelayMs = minDelayMs;
        this.maxDelayMs = maxDelayMs;
        this.maxExtrapolationMs = maxExtrapolationMs;
        this.maxSnapshots = maxSnapshots;
        this.snapshots = [];
        this.clockOffsetMs = null;
        this.offsetSamples = [];
        this.intervalMs = 50;
        this.jitterMs = 0;
        this.lastServerTime = null;
        this.lastMode = null;
    }

    clear() {
        this.snapshots = [];
        this.clockOffsetMs = null;
        this.offsetSamples = [];
        this.intervalMs = 50;
        this.jitterMs = 0;
        this.lastServerTime = null;
        this.lastMode = null;
        this.interpolationDelayMs = this.baseDelayMs;
    }

    /**
     * Drops buffered snapshots without discarding the clock/jitter estimate.
     * Used between rounds, where the world resets but the connection does not.
     */
    clearSnapshots() {
        this.snapshots = [];
        this.lastServerTime = null;
        this.lastMode = null;
    }

    _trackTiming(snapshot) {
        const { serverTime, receivedAt } = snapshot;

        if (this.lastServerTime != null) {
            const serverDelta = serverTime - this.lastServerTime;
            if (serverDelta > 0 && serverDelta < 1000) {
                this.intervalMs += (serverDelta - this.intervalMs) * 0.1;
            }
        }
        this.lastServerTime = serverTime;

        const offsetSample = receivedAt - serverTime;
        this.offsetSamples.push({ receivedAt, offset: offsetSample });
        while (
            this.offsetSamples.length > 1 &&
            receivedAt - this.offsetSamples[0].receivedAt > OFFSET_WINDOW_MS
        ) {
            this.offsetSamples.shift();
        }

        let windowMin = Infinity;
        for (const sample of this.offsetSamples) {
            if (sample.offset < windowMin) windowMin = sample.offset;
        }

        // Transit-time spread above the fastest packet is the jitter we have to
        // hide behind the interpolation delay.
        this.jitterMs += ((offsetSample - windowMin) - this.jitterMs) * 0.1;

        if (this.clockOffsetMs == null || Math.abs(windowMin - this.clockOffsetMs) > OFFSET_RESYNC_MS) {
            this.clockOffsetMs = windowMin;
        } else {
            const delta = windowMin - this.clockOffsetMs;
            this.clockOffsetMs += Math.max(-MAX_OFFSET_SLEW_MS, Math.min(MAX_OFFSET_SLEW_MS, delta));
        }

        if (!this.adaptive) return;

        // Hold enough history to cover one dropped packet plus observed jitter.
        const target = Math.max(
            this.minDelayMs,
            Math.min(this.maxDelayMs, this.intervalMs * 1.5 + this.jitterMs * 2.5),
        );
        this.interpolationDelayMs += (target - this.interpolationDelayMs) * 0.05;
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

        this._trackTiming(snapshot);

        const duplicateIndex = this.snapshots.findIndex(item => item.serverTime === normalizedServerTime);
        if (duplicateIndex >= 0) this.snapshots.splice(duplicateIndex, 1);
        this.snapshots.push(snapshot);
        this.snapshots.sort((a, b) => a.serverTime - b.serverTime);
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
            this.lastMode = 'buffering';
            return { state: first.state, tick: first.tick, mode: 'buffering' };
        }
        if (this.snapshots.length === 1) {
            const extrapolationMs = Math.min(
                this.maxExtrapolationMs,
                renderServerTime - first.serverTime,
            );
            this.lastMode = 'extrapolated';
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
            this.lastMode = 'interpolated';
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
        this.lastMode = extrapolationMs > 0 ? 'extrapolated' : 'latest';
        return {
            state: extrapolateNetworkState(latest, extrapolationMs),
            tick: latest.tick,
            mode: this.lastMode,
        };
    }

    getStats() {
        return {
            snapshots: this.snapshots.length,
            interpolationDelayMs: this.interpolationDelayMs,
            intervalMs: this.intervalMs,
            jitterMs: this.jitterMs,
            clockOffsetMs: this.clockOffsetMs,
            mode: this.lastMode,
        };
    }
}
