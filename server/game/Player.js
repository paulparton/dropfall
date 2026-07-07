import { createSphere, RAPIER } from './PhysicsWorld.js';

const START_OFFSET = 12;

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

        this.startPosition = this._getStartPosition(slot);
        this._createBody();
    }

    _getStartPosition(slot) {
        const x = slot === 1 ? -START_OFFSET : START_OFFSET;
        return { x, y: 6, z: 0 };
    }

    _createBody() {
        const { body, collider } = createSphere(this.world, this.startPosition, this.sphereSize, {
            mass: this.sphereWeight,
            restitution: this.collisionBounce,
            friction: 0.5,
            linearDamping: 0.5,
            angularDamping: 0.5,
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
        this.input = { forward: 0, right: 0, boost: false };

        this.body.setTranslation(this.startPosition.x, this.startPosition.y, this.startPosition.z, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setRotation({ w: 1, x: 0, y: 0, z: 0 }, true);
        this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
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
                    this._applyRandomPowerUp();
                    tile.state = 'NORMAL';
                    tile.collider.setFriction(0.5);
                }
            }
        }

        // Boost logic: can start above 20%, continues until 0%.
        if (this.input.boost && this.boostLevel > 20 && !this.isBoosting) {
            this.isBoosting = true;
        } else if (!this.input.boost || this.boostLevel <= 0) {
            this.isBoosting = false;
        }

        const boostMultiplier = this.isBoosting ? 2.5 : 1.0;

        if (this.isBoosting) {
            this.boostLevel = Math.max(0, this.boostLevel - this.settings.boostDrainRate * delta);
        } else {
            this.boostLevel = Math.min(100, this.boostLevel + this.settings.boostRegenSpeed * delta);
        }

        // Movement impulse. Match client: sphereAccel * delta per tick.
        const speed = this.sphereAccel * delta;
        const forceX = this.input.right * speed * boostMultiplier;
        const forceZ = -this.input.forward * speed * boostMultiplier;

        if (this.frozenTimer > 0) {
            this.body.setLinearDamping(0.0);
            this.body.setAngularDamping(0.0);
        } else {
            this.body.setLinearDamping(0.5);
            this.body.setAngularDamping(0.5);
        }

        this.body.applyImpulse({ x: forceX, y: 0, z: forceZ }, true);
    }

    _applyRandomPowerUp() {
        // Simplified power-ups for the server: just apply a temporary boost refill
        // and a size/weight modifier. Full power-up replication is a future enhancement.
        this.boostLevel = Math.min(100, this.boostLevel + 30);
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
            isDead: this.isDead,
        };
    }
}
