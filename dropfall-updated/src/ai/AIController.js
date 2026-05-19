/**
 * AI Controller for Single Player Mode NPC Opponent
 *
 * Tactical approach — "flanking herder":
 *
 *  HUNT:        Move to a position CENTER-SIDE of the player (so when we charge, collision
 *               pushes the player OUTWARD toward the edge, not just sideways).
 *
 *  FLANK_CHARGE: We're in position. Boost directly at the player to shove them toward edge.
 *
 *  PUSH:        Player is already near the edge. Drop the flank setup, just charge.
 *
 *  EDGE_ESCAPE: AI itself is too close to the edge — retreat toward center with boost.
 *
 * Boost is SUSTAINED (boostHoldTimer) so the AI actually accelerates into the hit rather
 * than flickering boost on/off per decision frame.
 */

export class AIController {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty;
        this.currentInput = { forward: false, backward: false, left: false, right: false, boost: false };
        this.boostCooldown = 0;
        this.boostHoldTimer = 0;   // Sustains boost for a duration once committed
        this.state = 'HUNT';
        this.updateTimer = 0;

        this.difficultyParams = {
            easy: {
                predictionTime:       0.0,
                // Fraction of arenaRadius: flee when within this of edge
                edgeFleeRadius:       0.30,
                // Treat player as "near edge" (PUSH) within this fraction
                playerDangerRadius:   0.22,
                // Units center-side of player to move to before charging
                flankDist:            4,
                // Distance at which we trigger FLANK_CHARGE
                chargeRange:          16,
                // Prob of boosting when in FLANK_CHARGE / PUSH state
                boostUsage:           0.20,
                // Fraction of decisions that aim correctly (rest random)
                accuracy:             0.48,
                boostMinBoost:        60,
                updateInterval:       0.30,
                boostCooldownTime:    2.5,
                boostHoldDuration:    0.20,
            },
            normal: {
                predictionTime:       0.50,
                edgeFleeRadius:       0.22,
                playerDangerRadius:   0.32,
                flankDist:            7,
                chargeRange:          22,
                boostUsage:           0.88,
                accuracy:             0.90,
                boostMinBoost:        25,
                updateInterval:       0.055,
                boostCooldownTime:    0.70,
                boostHoldDuration:    0.35,
            },
            hard: {
                predictionTime:       0.80,
                // Hard AI fights near its own edge — almost never retreats
                edgeFleeRadius:       0.13,
                playerDangerRadius:   0.42,
                flankDist:            12,
                chargeRange:          30,
                boostUsage:           1.0,
                accuracy:             1.0,
                boostMinBoost:        8,
                // Reacts every frame
                updateInterval:       0.0,
                boostCooldownTime:    0.12,
                boostHoldDuration:    0.65,
            }
        };

        this.params = this.difficultyParams[difficulty] || this.difficultyParams.normal;
    }

    /**
     * Update AI state each frame.
     *
     * @param {THREE.Vector3} playerPos    - Human player world position
     * @param {THREE.Vector3} npcPos       - NPC world position
     * @param {Object|null}   playerVel    - { x, y, z } from player1.rigidBody.linvel()
     * @param {Object|null}   npcVel       - NPC velocity (reserved)
     * @param {THREE.Vector3} arenaCenter  - Arena center (usually 0,0,0)
     * @param {number}        arenaRadius  - Arena radius in world units
     * @param {number}        deltaTime    - Seconds since last frame
     * @param {Object}        gameState    - Zustand store snapshot
     */
    update(playerPos, npcPos, playerVel, npcVel, arenaCenter, arenaRadius, deltaTime = 0.016, gameState = {}) {
        this.boostCooldown   = Math.max(0, this.boostCooldown - deltaTime);
        this.boostHoldTimer  = Math.max(0, this.boostHoldTimer - deltaTime);
        this.updateTimer    += deltaTime;

        if (this.updateTimer < this.params.updateInterval) return;
        this.updateTimer = 0;

        // ── Distances ──────────────────────────────────────────────────────────
        const npcDist2Center = Math.sqrt(npcPos.x ** 2 + npcPos.z ** 2);
        const npcDistToEdge  = arenaRadius - npcDist2Center;

        const pDist2Center   = Math.sqrt(playerPos.x ** 2 + playerPos.z ** 2);
        const playerDistToEdge = arenaRadius - pDist2Center;

        const rawDistToPlayer = Math.sqrt(
            (playerPos.x - npcPos.x) ** 2 + (playerPos.z - npcPos.z) ** 2
        );

        // ── Velocity prediction ───────────────────────────────────────────────
        const pVx = playerVel ? playerVel.x : 0;
        const pVz = playerVel ? playerVel.z : 0;
        const predT = this.params.predictionTime;
        const predX = playerPos.x + pVx * predT;
        const predZ = playerPos.z + pVz * predT;

        // ── Edge direction for flanking ───────────────────────────────────────
        // edgeDir points FROM arena center OUTWARD through the player — the direction
        // the player would be pushed off the arena. If we approach from the CENTER side
        // (opposite of edgeDir), our collision will push them toward the edge.
        let edgeDirX = 0, edgeDirZ = 0;
        if (pDist2Center > 0.5) {
            edgeDirX = playerPos.x / pDist2Center;
            edgeDirZ = playerPos.z / pDist2Center;
        }

        // ── State thresholds ──────────────────────────────────────────────────
        const edgeFleeThreshold    = arenaRadius * this.params.edgeFleeRadius;
        const playerDangerThreshold = arenaRadius * this.params.playerDangerRadius;
        const npcNearEdge    = npcDistToEdge < edgeFleeThreshold;
        const playerNearEdge = playerDistToEdge < playerDangerThreshold;

        // ── Flanking position: center-side of predicted player ─────────────────
        // Moving here first, THEN charging means the hit sends the player outward.
        const flankX = predX - edgeDirX * this.params.flankDist;
        const flankZ = predZ - edgeDirZ * this.params.flankDist;
        const dFlankX = flankX - npcPos.x;
        const dFlankZ = flankZ - npcPos.z;
        const distToFlank = Math.sqrt(dFlankX ** 2 + dFlankZ ** 2);

        // Is the NPC already center-side of the player and close enough to charge?
        // dot > 0 means NPC→player direction aligns with edgeDir (NPC is inside, player is outside)
        const npcToPlayerX = predX - npcPos.x;
        const npcToPlayerZ = predZ - npcPos.z;
        const dotWithEdge  = npcToPlayerX * edgeDirX + npcToPlayerZ * edgeDirZ;
        const inPosition   = dotWithEdge > 0 && rawDistToPlayer < this.params.chargeRange;

        // ── Decide target direction and boost ─────────────────────────────────
        let targetX, targetZ;
        const boostLevel  = gameState.player2Boost || 0;
        const boostReady  = this.boostCooldown <= 0 && boostLevel > this.params.boostMinBoost;
        let   shouldBoost = this.boostHoldTimer > 0; // sustain previous boost decision

        if (npcNearEdge) {
            // EDGE_ESCAPE — sprint to safety, with emergency boost if critically close
            this.state = 'EDGE_ESCAPE';
            targetX = arenaCenter.x - npcPos.x;
            targetZ = arenaCenter.z - npcPos.z;
            if (npcDistToEdge < arenaRadius * 0.09 && boostReady) {
                shouldBoost = true;
                this.boostHoldTimer = this.params.boostHoldDuration;
                this.boostCooldown  = this.params.boostCooldownTime;
            }

        } else if (playerNearEdge) {
            // PUSH — player is already vulnerable, just charge straight at them
            this.state = 'PUSH';
            targetX = npcToPlayerX;
            targetZ = npcToPlayerZ;
            if (boostReady && Math.random() < this.params.boostUsage) {
                shouldBoost = true;
                this.boostHoldTimer = this.params.boostHoldDuration;
                this.boostCooldown  = this.params.boostCooldownTime;
            }

        } else if (inPosition) {
            // FLANK_CHARGE — we're center-side of the player; charge through them
            this.state = 'FLANK_CHARGE';
            targetX = npcToPlayerX;
            targetZ = npcToPlayerZ;
            if (boostReady && Math.random() < this.params.boostUsage) {
                shouldBoost = true;
                this.boostHoldTimer = this.params.boostHoldDuration;
                this.boostCooldown  = this.params.boostCooldownTime;
            }

        } else {
            // HUNT — move to the flanking position
            this.state = 'HUNT';
            targetX = dFlankX;
            targetZ = dFlankZ;
            // Light boost while repositioning if we have plenty of energy
            if (boostReady && boostLevel > 50 && Math.random() < this.params.boostUsage * 0.3) {
                shouldBoost = true;
                this.boostHoldTimer = this.params.boostHoldDuration * 0.5;
                this.boostCooldown  = this.params.boostCooldownTime;
            }
        }

        // ── Accuracy degradation ──────────────────────────────────────────────
        if (Math.random() > this.params.accuracy) {
            targetX  = (Math.random() - 0.5) * 2;
            targetZ  = (Math.random() - 0.5) * 2;
            shouldBoost = false;
            this.boostHoldTimer = 0;
        }

        // ── Direction vector → digital inputs ─────────────────────────────────
        // Both axes set simultaneously for true diagonal movement.
        // 0.25 threshold: near-cardinal vectors still activate the perpendicular key.
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
        this.currentInput  = { forward: false, backward: false, left: false, right: false, boost: false };
        this.boostCooldown = 0;
        this.boostHoldTimer = 0;
        this.state         = 'HUNT';
        this.updateTimer   = 0;
    }
}

export default AIController;
