/**
 * AI Controller for Single Player Mode NPC Opponent
 *
 * Tile-aware "Flanking Herder":
 *
 *  HUNT          — Move to a position CENTER-SIDE of the player (flanking position)
 *  FLANK_CHARGE  — In position; boost directly at player to shove them toward edge
 *  PUSH          — Player near an edge or gap; charge straight in
 *  GAP_EXPLOIT   — Hard only: player adjacent to a falling/gone tile; boost push them in
 *  EDGE_ESCAPE   — AI near tile edge; retreat to safety
 *
 * Uses actual tile set data to detect edges on irregular custom levels.
 * Falls back to circular arenaRadius logic when no tile data is available.
 */

import { pixelToHex, hexToPixel } from '../utils/math.js';

const GRID_SPACING = 8.0;

// Flat-top hex axial direction vectors (6 neighbors)
const HEX_DIR = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

/**
 * Walk the hex ring at `dist` hexes from (cq, cr).
 * Returns an array of {q, r} for all 6*dist hexes on that ring.
 * dist=0 returns [{q:cq, r:cr}].
 */
function hexRing(cq, cr, dist) {
    if (dist === 0) return [{ q: cq, r: cr }];
    const results = [];
    // Start at the hex dist steps in direction 4 (bottom-left)
    let q = cq + HEX_DIR[4].q * dist;
    let r = cr + HEX_DIR[4].r * dist;
    for (let side = 0; side < 6; side++) {
        for (let step = 0; step < dist; step++) {
            results.push({ q, r });
            q += HEX_DIR[side].q;
            r += HEX_DIR[side].r;
        }
    }
    return results;
}

/**
 * Find the distance to the nearest gap (missing tile) from hex (q, r).
 * Returns 0 if the hex itself is a gap.
 * Returns dist (1..maxDist) for the ring where a gap first appears.
 * Returns maxDist+1 if fully interior within maxDist.
 *
 * @param {number} q
 * @param {number} r
 * @param {Set<string>} activeTiles  - Set of "q,r" strings for standing tiles
 * @param {Set<string>|null} warnedTiles - Set of "q,r" strings for warning tiles
 * @param {boolean} warnAsUnsafe     - Treat WARNING tiles as gaps
 * @param {number} maxDist
 */
function getNearestGapDist(q, r, activeTiles, warnedTiles, warnAsUnsafe, maxDist = 4) {
    const isUnsafe = (hq, hr) => {
        const key = `${hq},${hr}`;
        if (!activeTiles.has(key)) return true;
        if (warnAsUnsafe && warnedTiles && warnedTiles.has(key)) return true;
        return false;
    };

    if (isUnsafe(q, r)) return 0;

    for (let dist = 1; dist <= maxDist; dist++) {
        const ring = hexRing(q, r, dist);
        for (const hex of ring) {
            if (isUnsafe(hex.q, hex.r)) return dist;
        }
    }
    return maxDist + 1;
}

/**
 * Given the NPC's current world position and a desired direction (not normalized),
 * find the best adjacent tile that exists in activeTiles and is closest to that direction.
 *
 * Returns world {x, z} of the chosen safe neighbor tile center.
 * If no safe neighbor exists, returns the tile with min distance to origin as emergency.
 *
 * @param {number} npcX
 * @param {number} npcZ
 * @param {number} rawDirX  - desired direction (unnormalized)
 * @param {number} rawDirZ
 * @param {Set<string>} activeTiles
 */
function getBestSafeNeighbor(npcX, npcZ, rawDirX, rawDirZ, activeTiles) {
    const npcHex = pixelToHex(npcX, npcZ, GRID_SPACING);
    const len = Math.sqrt(rawDirX * rawDirX + rawDirZ * rawDirZ);
    const nx = len > 0.001 ? rawDirX / len : 0;
    const nz = len > 0.001 ? rawDirZ / len : 0;

    let bestDot = -Infinity;
    let bestWorld = null;

    for (const dir of HEX_DIR) {
        const nq = npcHex.q + dir.q;
        const nr = npcHex.r + dir.r;
        if (!activeTiles.has(`${nq},${nr}`)) continue;

        const world = hexToPixel(nq, nr, GRID_SPACING);
        const toDx = world.x - npcX;
        const toDz = world.z - npcZ;
        const tLen = Math.sqrt(toDx * toDx + toDz * toDz);
        if (tLen < 0.001) continue;

        const dot = (toDx / tLen) * nx + (toDz / tLen) * nz;
        if (dot > bestDot) {
            bestDot = dot;
            bestWorld = world;
        }
    }

    if (bestWorld) return bestWorld;

    // Emergency: find nearest neighbor to origin
    let minDist = Infinity;
    let emergency = { x: 0, z: 0 };
    for (const dir of HEX_DIR) {
        const nq = npcHex.q + dir.q;
        const nr = npcHex.r + dir.r;
        if (!activeTiles.has(`${nq},${nr}`)) continue;
        const world = hexToPixel(nq, nr, GRID_SPACING);
        const d = Math.sqrt(world.x * world.x + world.z * world.z);
        if (d < minDist) { minDist = d; emergency = world; }
    }
    return emergency;
}

/**
 * Hard-AI exploit: find if the player is adjacent to a dangerous tile (gap or warning).
 * If so, return the direction to charge at the player (to push them in).
 * Returns null if no exploitable gap nearby.
 */
function findGapExploitTarget(playerPos, npcPos, activeTiles, warnedTiles) {
    const playerHex = pixelToHex(playerPos.x, playerPos.z, GRID_SPACING);

    let hasAdjacentGap = false;
    for (const dir of HEX_DIR) {
        const nq = playerHex.q + dir.q;
        const nr = playerHex.r + dir.r;
        const key = `${nq},${nr}`;
        if (!activeTiles.has(key) || (warnedTiles && warnedTiles.has(key))) {
            hasAdjacentGap = true;
            break;
        }
    }

    if (!hasAdjacentGap) return null;

    return {
        x: playerPos.x - npcPos.x,
        z: playerPos.z - npcPos.z,
    };
}

export class AIController {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty;
        this.currentInput = { forward: false, backward: false, left: false, right: false, boost: false };
        this.boostCooldown = 0;
        this.boostHoldTimer = 0;
        this.state = 'HUNT';
        this.updateTimer = 0;

        this.difficultyParams = {
            easy: {
                predictionTime:          0.0,
                edgeFleeRadius:          0.30,   // Circular fallback fraction
                playerDangerRadius:      0.22,
                flankDist:               4,
                chargeRange:             16,
                boostUsage:              0.20,
                accuracy:                0.48,
                boostMinBoost:           60,
                updateInterval:          0.30,
                boostCooldownTime:       2.5,
                boostHoldDuration:       0.20,
                // Tile-aware params
                edgeSafetyDepth:         2,      // Flee when gap is ≤2 tiles away
                playerDangerTileDepth:   1,      // Push when player gap ≤1 tile away
                warnAsUnsafe:            true,   // Treat WARNING tiles as gaps
                gapExploit:              false,
            },
            normal: {
                predictionTime:          0.50,
                edgeFleeRadius:          0.22,
                playerDangerRadius:      0.32,
                flankDist:               7,
                chargeRange:             22,
                boostUsage:              0.88,
                accuracy:                0.90,
                boostMinBoost:           25,
                updateInterval:          0.055,
                boostCooldownTime:       0.70,
                boostHoldDuration:       0.35,
                // Tile-aware params
                edgeSafetyDepth:         1,
                playerDangerTileDepth:   2,
                warnAsUnsafe:            true,
                gapExploit:              false,
            },
            hard: {
                predictionTime:          0.80,
                edgeFleeRadius:          0.13,
                playerDangerRadius:      0.42,
                flankDist:               12,
                chargeRange:             30,
                boostUsage:              1.0,
                accuracy:                1.0,
                boostMinBoost:           8,
                updateInterval:          0.0,
                boostCooldownTime:       0.12,
                boostHoldDuration:       0.65,
                // Tile-aware params
                edgeSafetyDepth:         0,      // Only flee if literally off the tile
                playerDangerTileDepth:   3,      // Aggressive: attack when gap is 3 tiles from player
                warnAsUnsafe:            false,  // Hard AI fights on warning tiles
                gapExploit:              true,   // Actively push player into gaps
            },
        };

        this.params = this.difficultyParams[difficulty] || this.difficultyParams.normal;
    }

    /**
     * Update AI state each frame.
     *
     * @param {THREE.Vector3} playerPos
     * @param {THREE.Vector3} npcPos
     * @param {Object|null}   playerVel   - { x, y, z }
     * @param {Object|null}   npcVel
     * @param {THREE.Vector3} arenaCenter
     * @param {number}        arenaRadius
     * @param {number}        deltaTime
     * @param {Object}        gameState   - Zustand store snapshot
     * @param {Set<string>|null} activeTiles  - "q,r" keys of standing tiles (not FALLING/WARNING)
     * @param {Set<string>|null} warnedTiles  - "q,r" keys of WARNING tiles
     */
    update(playerPos, npcPos, playerVel, npcVel, arenaCenter, arenaRadius, deltaTime = 0.016, gameState = {}, activeTiles = null, warnedTiles = null) {
        this.boostCooldown  = Math.max(0, this.boostCooldown - deltaTime);
        this.boostHoldTimer = Math.max(0, this.boostHoldTimer - deltaTime);
        this.updateTimer   += deltaTime;

        if (this.updateTimer < this.params.updateInterval) return;
        this.updateTimer = 0;

        const p = this.params;
        const hasTileData = activeTiles && activeTiles.size > 0;

        // ── Distances ──────────────────────────────────────────────────────────
        const npcDist2Center    = Math.sqrt(npcPos.x ** 2 + npcPos.z ** 2);
        const npcDistToEdge     = arenaRadius - npcDist2Center;
        const pDist2Center      = Math.sqrt(playerPos.x ** 2 + playerPos.z ** 2);
        const playerDistToEdge  = arenaRadius - pDist2Center;
        const rawDistToPlayer   = Math.sqrt(
            (playerPos.x - npcPos.x) ** 2 + (playerPos.z - npcPos.z) ** 2
        );

        // ── Velocity prediction ───────────────────────────────────────────────
        const pVx  = playerVel ? playerVel.x : 0;
        const pVz  = playerVel ? playerVel.z : 0;
        const predX = playerPos.x + pVx * p.predictionTime;
        const predZ = playerPos.z + pVz * p.predictionTime;

        // ── Edge direction (outward from center through player) ───────────────
        let edgeDirX = 0, edgeDirZ = 0;
        if (pDist2Center > 0.5) {
            edgeDirX = playerPos.x / pDist2Center;
            edgeDirZ = playerPos.z / pDist2Center;
        }

        // ── Edge detection ─────────────────────────────────────────────────────
        let npcNearEdge, playerNearEdge;

        if (hasTileData) {
            const npcHex = pixelToHex(npcPos.x, npcPos.z, GRID_SPACING);
            const npcGapDist = getNearestGapDist(npcHex.q, npcHex.r, activeTiles, warnedTiles, p.warnAsUnsafe, 4);
            npcNearEdge = npcGapDist <= p.edgeSafetyDepth;

            const playerHex = pixelToHex(playerPos.x, playerPos.z, GRID_SPACING);
            const playerGapDist = getNearestGapDist(playerHex.q, playerHex.r, activeTiles, warnedTiles, true, 4);
            playerNearEdge = playerGapDist <= p.playerDangerTileDepth;
        } else {
            // Circular fallback
            npcNearEdge    = npcDistToEdge    < arenaRadius * p.edgeFleeRadius;
            playerNearEdge = playerDistToEdge < arenaRadius * p.playerDangerRadius;
        }

        // ── Flanking position ─────────────────────────────────────────────────
        let flankX = predX - edgeDirX * p.flankDist;
        let flankZ = predZ - edgeDirZ * p.flankDist;

        // Validate flank position is on a tile; if not, find nearest safe tile instead
        if (hasTileData) {
            const flankHex = pixelToHex(flankX, flankZ, GRID_SPACING);
            if (!activeTiles.has(`${flankHex.q},${flankHex.r}`)) {
                const safeFlank = getBestSafeNeighbor(npcPos.x, npcPos.z, flankX - npcPos.x, flankZ - npcPos.z, activeTiles);
                flankX = safeFlank.x;
                flankZ = safeFlank.z;
            }
        }

        const dFlankX = flankX - npcPos.x;
        const dFlankZ = flankZ - npcPos.z;

        const npcToPlayerX = predX - npcPos.x;
        const npcToPlayerZ = predZ - npcPos.z;
        const dotWithEdge  = npcToPlayerX * edgeDirX + npcToPlayerZ * edgeDirZ;
        const inPosition   = dotWithEdge > 0 && rawDistToPlayer < p.chargeRange;

        // ── Boost state ───────────────────────────────────────────────────────
        const boostLevel = gameState.player2Boost || 0;
        const boostReady = this.boostCooldown <= 0 && boostLevel > p.boostMinBoost;
        let shouldBoost  = this.boostHoldTimer > 0;

        // ── State machine ─────────────────────────────────────────────────────
        let targetX, targetZ;

        if (npcNearEdge) {
            // EDGE_ESCAPE — find the safest neighbor in the direction of the center
            this.state = 'EDGE_ESCAPE';
            if (hasTileData) {
                const safe = getBestSafeNeighbor(npcPos.x, npcPos.z, -npcPos.x, -npcPos.z, activeTiles);
                targetX = safe.x - npcPos.x;
                targetZ = safe.z - npcPos.z;
            } else {
                targetX = arenaCenter.x - npcPos.x;
                targetZ = arenaCenter.z - npcPos.z;
            }
            // Emergency boost when critically close (literally off the board or only 1 neighbor)
            const critical = hasTileData
                ? (() => { const h = pixelToHex(npcPos.x, npcPos.z, GRID_SPACING); let cnt = 0; for (const d of HEX_DIR) { if (activeTiles.has(`${h.q+d.q},${h.r+d.r}`)) cnt++; } return cnt <= 1; })()
                : npcDistToEdge < arenaRadius * 0.09;
            if (critical && boostReady) {
                shouldBoost = true;
                this.boostHoldTimer = p.boostHoldDuration;
                this.boostCooldown  = p.boostCooldownTime;
            }

        } else if (p.gapExploit && hasTileData) {
            // GAP_EXPLOIT (hard only) — push player into adjacent gap if one exists
            const gapTarget = findGapExploitTarget(playerPos, npcPos, activeTiles, warnedTiles);
            if (gapTarget) {
                this.state = 'GAP_EXPLOIT';
                targetX = gapTarget.x;
                targetZ = gapTarget.z;
                if (boostReady) {
                    shouldBoost = true;
                    this.boostHoldTimer = p.boostHoldDuration;
                    this.boostCooldown  = p.boostCooldownTime;
                }
            } else {
                // No exploit available, fall through to normal aggression
                targetX = null;
            }
        }

        if (targetX === undefined || targetX === null) {
            if (playerNearEdge) {
                // PUSH — player vulnerable; charge straight at them
                this.state = 'PUSH';
                targetX = npcToPlayerX;
                targetZ = npcToPlayerZ;
                if (boostReady && Math.random() < p.boostUsage) {
                    shouldBoost = true;
                    this.boostHoldTimer = p.boostHoldDuration;
                    this.boostCooldown  = p.boostCooldownTime;
                }

            } else if (inPosition) {
                // FLANK_CHARGE — center-side of player; charge through them
                this.state = 'FLANK_CHARGE';
                targetX = npcToPlayerX;
                targetZ = npcToPlayerZ;
                if (boostReady && Math.random() < p.boostUsage) {
                    shouldBoost = true;
                    this.boostHoldTimer = p.boostHoldDuration;
                    this.boostCooldown  = p.boostCooldownTime;
                }

            } else {
                // HUNT — reposition to flanking side
                this.state = 'HUNT';
                targetX = dFlankX;
                targetZ = dFlankZ;
                if (boostReady && boostLevel > 50 && Math.random() < p.boostUsage * 0.3) {
                    shouldBoost = true;
                    this.boostHoldTimer = p.boostHoldDuration * 0.5;
                    this.boostCooldown  = p.boostCooldownTime;
                }
            }
        }

        // ── Safe-direction filter (non-escape states) ─────────────────────────
        // Snap the target direction to the best reachable safe neighbor tile.
        // This prevents the AI from charging off irregular level edges.
        if (hasTileData && this.state !== 'EDGE_ESCAPE') {
            const safe = getBestSafeNeighbor(npcPos.x, npcPos.z, targetX, targetZ, activeTiles);
            targetX = safe.x - npcPos.x;
            targetZ = safe.z - npcPos.z;
        }

        // ── Accuracy degradation ──────────────────────────────────────────────
        if (Math.random() > p.accuracy) {
            targetX = (Math.random() - 0.5) * 2;
            targetZ = (Math.random() - 0.5) * 2;
            shouldBoost = false;
            this.boostHoldTimer = 0;
        }

        // ── Direction → digital inputs ────────────────────────────────────────
        const len = Math.sqrt(targetX ** 2 + targetZ ** 2);
        if (len > 0.001) {
            const nx = targetX / len;
            const nz = targetZ / len;
            this.currentInput = {
                forward:  nz < -0.25,
                backward: nz >  0.25,
                left:     nx < -0.25,
                right:    nx >  0.25,
                boost:    shouldBoost,
            };
        } else {
            this.currentInput = { forward: false, backward: false, left: false, right: false, boost: false };
        }
    }

    getInput() {
        return { ...this.currentInput };
    }

    setDifficulty(difficulty) {
        if (this.difficultyParams[difficulty]) {
            this.difficulty = difficulty;
            this.params = this.difficultyParams[difficulty];
        }
    }

    reset() {
        this.currentInput   = { forward: false, backward: false, left: false, right: false, boost: false };
        this.boostCooldown  = 0;
        this.boostHoldTimer = 0;
        this.state          = 'HUNT';
        this.updateTimer    = 0;
    }
}

export default AIController;
