import { createSphere, RAPIER } from './PhysicsWorld.js';
import { getPowerUpDefinition } from '../../shared/powerUps.js';
import { getOnlineSpawnPosition } from '../../shared/spawnPositions.js';

export class ServerPlayer {
    constructor(world, slot, settings) {
        this.world = world;
        this.slot = slot;
        this.settings = settings;
        this.sphereSize = settings.sphereSize || 2.0;
        this.sphereWeight = settings.sphereWeight || 200;
        this.sphereAccel = settings.sphereAccel || 2000;
        this.collisionBounce = settings.collisionBounce || 0.9;

        this.input = { forward: 0, right: 0, boost: false };
        this.boostLevel = 100;
        this.isBoosting = false;
        this.isDead = false;
        this.frozenTimer = 0;
        this.iceCooldown = 0;
        this.accelMultiplier = 1;
        this.gravityMultiplier = 1;
        this.activePowerUps = [];

        this.startPosition = this._getStartPosition(slot);
        this._createBody();
    }

    _getStartPosition(slot) {
        return getOnlineSpawnPosition(slot, this.settings);
    }

    _createBody() {
        const { body, collider } = createSphere(this.world, this.startPosition, this.sphereSize, {
            mass: this.sphereWeight,
            restitution: this.collisionBounce,
            friction: 0.5,
            linearDamping: 0.0,
            angularDamping: 0.0,
        });

        this.body = body;
        this.collider = collider;
    }

    reset() {
        this.isDead = false;
        this.boostLevel = 100;
        this.isBoosting = false;
        this.frozenTimer = 0;
        this.iceCooldown = 0;
        this.accelMultiplier = 1;
        this.gravityMultiplier = 1;
        this.activePowerUps = [];
        this.input = { forward: 0, right: 0, boost: false };

        this.body.setTranslation(this.startPosition, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setRotation({ w: 1, x: 0, y: 0, z: 0 }, true);
        this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        this.body.setGravityScale(1, true);
        this.collider.setMass(this.sphereWeight);
        this.collider.setFriction(0.5);
    }

    setInput(input) {
        this.input = {
            forward: Math.max(-1, Math.min(1, input.forward || 0)),
            right: Math.max(-1, Math.min(1, input.right || 0)),
            boost: !!input.boost,
        };
    }

    update(delta, arena) {
        if (this.isDead) return;

        const pos = this.body.translation();

        // Death by falling.
        if (pos.y < -10) {
            this.isDead = true;
            return;
        }

        // Timers
        if (this.frozenTimer > 0) this.frozenTimer -= delta;
        if (this.iceCooldown > 0) this.iceCooldown -= delta;

        // Tile effects
        if (arena) {
            const tile = arena.tileAtPosition(pos.x, pos.z);
            if (tile) {
                if (tile.state === 'ICE' && this.frozenTimer <= 0 && this.iceCooldown <= 0) {
                    this.frozenTimer = 1.0;
                    this.iceCooldown = 2.0;
                }
                if (tile.state === 'BONUS') {
                    this._applyPowerUp(tile.powerUpType);
                    tile.state = 'NORMAL';
                    tile.powerUpType = null;
                    tile.collider.setFriction(0.5);
                }
            }
        }

        this._updatePowerUps(delta);

        // Keep the authoritative control predicate exactly aligned with client
        // prediction: an iced player or a player already falling cannot steer
        // or initiate/continue a boost, although boost regeneration continues.
        const hasControl = this.frozenTimer <= 0 && pos.y >= -1;

        // Boost logic: can start above 20%, continues until 0%.
        if (this.input.boost && this.boostLevel > 20 && !this.isBoosting && hasControl) {
            this.isBoosting = true;
        } else if (!this.input.boost || this.boostLevel <= 0 || !hasControl) {
            this.isBoosting = false;
        }

        const boostMultiplier = this.isBoosting ? 2.5 : 1.0;

        if (this.isBoosting) {
            this.boostLevel = Math.max(0, this.boostLevel - this.settings.boostDrainRate * delta);
        } else {
            this.boostLevel = Math.min(100, this.boostLevel + this.settings.boostRegenSpeed * delta);
        }

        // Movement impulse. Match client: sphereAccel * delta per tick.
        const speed = this.sphereAccel * this.accelMultiplier * delta;
        const forceX = this.input.right * speed * boostMultiplier;
        const forceZ = -this.input.forward * speed * boostMultiplier;

        // Keep prediction and authority on the same movement model. The
        // browser intentionally allows momentum to continue without damping.
        this.body.setLinearDamping(0.0);
        this.body.setAngularDamping(0.0);

        if (hasControl && (forceX !== 0 || forceZ !== 0)) {
            this.body.applyImpulse({ x: forceX, y: 0, z: forceZ }, true);
        }
    }

    _applyPowerUp(type) {
        const definition = getPowerUpDefinition(type);
        if (!definition) return;
        const duration = Number(this.settings.bonusDuration || 4);
        if (definition.durationKind === 'instant') {
            const velocity = this.body.linvel();
            const length = Math.hypot(velocity.x, velocity.z) || 1;
            this.body.applyImpulse({
                x: velocity.x / length * definition.modifiers.impulse,
                y: 0,
                z: velocity.z / length * definition.modifiers.impulse,
            }, true);
            return;
        }
        const existing = this.activePowerUps.find(effect => effect.type === type);
        if (existing) existing.remaining = duration;
        else this.activePowerUps.push({ type, remaining: duration });

        if (type === 'ACCELERATION_BOOST') this.accelMultiplier = definition.modifiers.acceleration;
        if (type === 'SIZE_REDUCTION') {
            this.collider.setMass(this.sphereWeight * definition.modifiers.mass);
        }
        if (type === 'WEIGHT_INCREASE') this.collider.setMass(this.sphereWeight * definition.modifiers.mass);
        if (type === 'LIGHT_TOUCH') {
            this.gravityMultiplier = definition.modifiers.gravity;
            this.body.setGravityScale(definition.modifiers.gravity, true);
        }
        if (type === 'SIZE_INCREASE') this.collider.setMass(this.sphereWeight * definition.modifiers.mass);
        if (type === 'GRIP_BOOST') this.collider.setFriction(0.5 * definition.modifiers.friction);
        if (type === 'INVULNERABILITY') this.collider.setMass(this.sphereWeight * definition.modifiers.mass);
    }

    _updatePowerUps(delta) {
        const expired = [];
        for (const effect of this.activePowerUps) {
            effect.remaining -= delta;
            if (effect.remaining <= 0) expired.push(effect.type);
        }
        if (!expired.length) return;
        this.activePowerUps = this.activePowerUps.filter(effect => effect.remaining > 0);
        const has = type => this.activePowerUps.some(effect => effect.type === type);
        this.accelMultiplier = has('ACCELERATION_BOOST')
            ? getPowerUpDefinition('ACCELERATION_BOOST').modifiers.acceleration
            : 1;
        this.gravityMultiplier = has('LIGHT_TOUCH')
            ? getPowerUpDefinition('LIGHT_TOUCH').modifiers.gravity
            : 1;
        this.body.setGravityScale(this.gravityMultiplier, true);
        this.collider.setFriction(has('GRIP_BOOST')
            ? 0.5 * getPowerUpDefinition('GRIP_BOOST').modifiers.friction
            : 0.5);
        const massType = has('INVULNERABILITY')
            ? 'INVULNERABILITY'
            : has('WEIGHT_INCREASE')
                ? 'WEIGHT_INCREASE'
                : has('SIZE_INCREASE')
                    ? 'SIZE_INCREASE'
                    : has('SIZE_REDUCTION')
                        ? 'SIZE_REDUCTION'
                        : null;
        const massMultiplier = massType ? getPowerUpDefinition(massType).modifiers.mass : 1;
        this.collider.setMass(this.sphereWeight * massMultiplier);
    }

    serialize() {
        const pos = this.body.translation();
        const vel = this.body.linvel();
        const rot = this.body.rotation();
        return {
            slot: this.slot,
            position: { x: pos.x, y: pos.y, z: pos.z },
            velocity: { x: vel.x, y: vel.y, z: vel.z },
            rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
            boost: this.boostLevel,
            isBoosting: this.isBoosting,
            isDead: this.isDead,
            frozenTimer: this.frozenTimer,
            iceCooldown: this.iceCooldown,
            activePowerUps: this.activePowerUps.map(effect => ({ ...effect })),
        };
    }
}
