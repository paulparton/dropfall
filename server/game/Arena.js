import { generateHexGrid, hexToPixel, hexDistance } from '../../src/utils/math.js';
import { createHexTile, RAPIER } from './PhysicsWorld.js';

const TILE_STATES = ['NORMAL', 'WARNING', 'ICE', 'BONUS', 'FALLING', 'FALLEN'];

export class ServerArena {
    constructor(world, settings) {
        this.world = world;
        this.settings = settings;
        this.arenaSize = settings.arenaSize || 4;
        this.tiles = [];
        this.gridSpacing = 8.0;
        this.tileRadius = this.gridSpacing * 1.0;
        this.tileHeight = 4.0;

        this.dropTimer = 0;
        this.iceTimer = 0;
        this.bonusTimer = 0;

        this._buildTiles();
    }

    _buildTiles() {
        const hexes = generateHexGrid(this.arenaSize);
        for (const hex of hexes) {
            const pos = hexToPixel(hex.q, hex.r, this.gridSpacing);
            const position = { x: pos.x, y: 0, z: pos.z };
            const { body, collider } = createHexTile(this.world, position, this.tileRadius, this.tileHeight, {
                friction: 0.5,
                restitution: 0.3,
            });

            this.tiles.push({
                q: hex.q,
                r: hex.r,
                position,
                body,
                collider,
                state: 'NORMAL',
                timer: 0,
                distanceToCenter: Math.sqrt(position.x ** 2 + position.z ** 2),
            });
        }
    }

    getTileAt(q, r) {
        return this.tiles.find(t => t.q === q && t.r === r);
    }

    reset() {
        for (const tile of this.tiles) {
            this._restoreTile(tile);
        }
        this.dropTimer = 0;
        this.iceTimer = 0;
        this.bonusTimer = 0;
    }

    _restoreTile(tile) {
        if (tile.body.isRemoved()) return;

        tile.state = 'NORMAL';
        tile.timer = 0;
        tile.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        tile.body.setTranslation(tile.position.x, tile.position.y, tile.position.z, true);
        tile.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        tile.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        tile.body.setRotation({ w: 1, x: 0, y: 0, z: 0 }, true);
        tile.collider.setFriction(0.5);
    }

    update(delta) {
        this.dropTimer += delta;
        this.iceTimer += delta;
        this.bonusTimer += delta;

        const destructionRate = this.settings.destructionRate || 3.0;
        const iceRate = this.settings.iceRate || 2.0;
        const bonusRate = this.settings.bonusRate || 6.0;

        // Same intensity->interval inversion as the client.
        const destructionInterval = 10.5 - destructionRate;
        const iceInterval = 10.5 - iceRate;
        const bonusInterval = 17.0 - bonusRate;

        if (this.dropTimer >= destructionInterval) {
            this.dropTimer = 0;
            this._triggerDrop();
        }

        if (this.iceTimer >= iceInterval) {
            this.iceTimer = 0;
            this._triggerIce();
        }

        if (this.bonusTimer >= bonusInterval) {
            this.bonusTimer = 0;
            this._triggerBonus();
        }

        this._updateWarningTiles(delta);
    }

    _updateWarningTiles(delta) {
        for (const tile of this.tiles) {
            if (tile.state === 'WARNING') {
                tile.timer -= delta;
                if (tile.timer <= 0) {
                    this._dropTile(tile);
                }
            }
        }
    }

    _triggerDrop() {
        // Drop an outer ring tile, preferring tiles furthest from center.
        const candidates = this.tiles
            .filter(t => t.state === 'NORMAL')
            .sort((a, b) => b.distanceToCenter - a.distanceToCenter);

        if (candidates.length === 0) return;

        const maxDistance = candidates[0].distanceToCenter;
        const ring = candidates.filter(t => t.distanceToCenter >= maxDistance - 1);
        const tile = ring[Math.floor(Math.random() * ring.length)];
        if (tile) {
            tile.state = 'WARNING';
            tile.timer = 2.0;
        }
    }

    _dropTile(tile) {
        if (tile.state === 'FALLING' || tile.state === 'FALLEN') return;
        tile.state = 'FALLING';
        tile.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        // Give it a slight nudge downward so it separates from players quickly.
        tile.body.setLinvel({ x: 0, y: -1, z: 0 }, true);
        tile.body.setAngularDamping(0.1);
    }

    _triggerIce() {
        const candidates = this.tiles.filter(t => t.state === 'NORMAL');
        if (candidates.length === 0) return;
        const tile = candidates[Math.floor(Math.random() * candidates.length)];
        tile.state = 'ICE';
        tile.collider.setFriction(0.0);
    }

    _triggerBonus() {
        const candidates = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
        if (candidates.length === 0) return;
        const tile = candidates[Math.floor(Math.random() * candidates.length)];
        tile.state = 'BONUS';
        tile.collider.setFriction(0.5);
    }

    tileAtPosition(x, z) {
        // Convert world position to hex coordinates using the same math as the client.
        const q = (2 / 3 * x) / this.gridSpacing;
        const r = (-1 / 3 * x + Math.sqrt(3) / 3 * z) / this.gridSpacing;

        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(-q - r);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - (-q - r));

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return this.getTileAt(rq, rr);
    }

    serializeTiles() {
        const states = [];
        for (const tile of this.tiles) {
            if (tile.state !== 'NORMAL' && tile.state !== 'FALLEN') {
                states.push({
                    q: tile.q,
                    r: tile.r,
                    state: tile.state,
                    timer: tile.timer,
                });
            }
        }
        return states;
    }
}
