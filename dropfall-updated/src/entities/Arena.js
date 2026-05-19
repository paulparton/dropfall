import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createTileBody, world } from '../physics.js';
import { scene } from '../renderer.js';
import { getThemeMaterials, getThemeColors } from '../utils/themeTextures.js';
import { createPlatformMaterial, createSkyboxMaterial, resolveThemeName } from '../shaders/index.js';
import { generateHexGrid, hexToPixel } from '../utils/math.js';
import { useGameStore } from '../store.js';
import { POWER_UP_EFFECTS } from './Player.js';

// === PERFORMANCE: Shared geometries to reduce memory and draw calls ===
let SHARED_TILE_GEOMETRY = null;

function getSharedTileGeometry(radius, height) {
    if (!SHARED_TILE_GEOMETRY) {
        SHARED_TILE_GEOMETRY = new THREE.CylinderGeometry(radius, radius, height, 6);
    }
    return SHARED_TILE_GEOMETRY;
}

function getSharedEdgesGeometry(radius, height) {
    // Create temp geometry just for edges, will be reused
    const geo = new THREE.CylinderGeometry(radius, radius, height, 6);
    return new THREE.EdgesGeometry(geo);
}

function createPowerUpSprite(icon, hexColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    // Draw glow circle
    const r = (hexColor >> 16) & 0xFF;
    const g = (hexColor >> 8) & 0xFF;
    const b = hexColor & 0xFF;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    // Draw emoji
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(5, 5, 1);
    return sprite;
}

export class Arena {
    constructor() {
        this.tiles = [];
        this.dropTimer = 0;
        this.iceTimer = 0;
        this.bonusTimer = 0;
        this.pulseTime = 0;

        const settings = useGameStore.getState().settings;
        this.arenaSize = settings.arenaSize;
        const theme = resolveThemeName(settings.theme || 'tron');
        this.hasEdges = (theme === 'tron');

        // 1. Generate Grid
        const hexes = generateHexGrid(this.arenaSize);

        // 2. Create Tiles
        const gridSpacing = 8.0;
        const tileRadius = gridSpacing * 1.0;
        const height = 4.0;

        // === PERFORMANCE: Use shared geometry ===
        const geometry = getSharedTileGeometry(tileRadius, height);
        const edgesGeometry = getSharedEdgesGeometry(tileRadius, height);

        const themeColors = getThemeColors(theme);
        this.edgeColor = themeColors.edgeColor;
        this.baseColor = themeColors.baseColor;
        this.iceColor = themeColors.iceColor;

        // Create the base ShaderMaterial for this theme
        this.basePlatformMaterial = createPlatformMaterial(theme);

        hexes.forEach(hex => {
            const pos = hexToPixel(hex.q, hex.r, gridSpacing);
            const position = { x: pos.x, y: 0, z: pos.z };

            // === PERFORMANCE: Reuse geometry; clone per-tile material for independent uniforms ===
            const tileMaterial = this.basePlatformMaterial.clone();
            const mesh = new THREE.Mesh(geometry, tileMaterial);
            mesh.position.set(position.x, position.y, position.z);
            mesh.rotation.y = Math.PI / 6;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            let edges = null;
            if (this.hasEdges) {
                const edgesMat = new THREE.LineBasicMaterial({ 
                    color: this.edgeColor,
                    transparent: true,
                    opacity: 0.7
                });
                edges = new THREE.LineSegments(edgesGeometry, edgesMat);
                edges.position.set(0, 0, 0);
                edges.rotation.y = Math.PI / 3;
                mesh.add(edges);
            }

            scene.add(mesh);

            // === PERFORMANCE: NO PointLight - use emissive instead ===
            const { rigidBody, collider } = createTileBody(position, tileRadius, height);
            this.tiles.push({
                q: hex.q,
                r: hex.r,
                mesh,
                edges,
                rigidBody,
                collider,
                state: 'NORMAL',
                timer: 0,
                distanceToCenter: Math.sqrt(position.x ** 2 + position.z ** 2),
                uniforms: tileMaterial.uniforms
            });
        });

        // Create spherical skybox
        this.skyboxGeometry = new THREE.SphereGeometry(400, 64, 64);
        this.skyboxMaterial = createSkyboxMaterial(theme);
        this.skybox = new THREE.Mesh(this.skyboxGeometry, this.skyboxMaterial);
        this.skybox.renderOrder = -1000;
        scene.add(this.skybox);
    }

    getTileAt(q, r) {
        return this.tiles.find(t => t.q === q && t.r === r);
    }

    update(delta) {
        const storeState = useGameStore.getState();
        if (storeState.gameState === 'PLAYING') {
            this.dropTimer += delta;
            this.iceTimer += delta;
            this.bonusTimer += delta;
        }

        const settings = storeState.settings;
        
        // Ensure settings have valid values with fallbacks
        const destructionRate = settings.destructionRate || 3.0;
        const iceRate = settings.iceRate || 2.0;
        const bonusRate = settings.bonusRate || 6.0;

        // 1. Handle The Drop
        if (this.dropTimer >= destructionRate) {
            this.dropTimer = 0;
            this.triggerDrop();
        }

        // 2. Handle Ice Tiles
        if (this.iceTimer >= iceRate) {
            this.iceTimer = 0;
            this.triggerIce();
        }

        // 3. Handle Bonus Tiles
        if (this.bonusTimer >= bonusRate) {
            this.bonusTimer = 0;
            this.triggerBonus();
        }

        // === PERFORMANCE: Accumulate time instead of Date.now() every frame ===
        this.pulseTime += delta;
        const beatFreq = 135 / 60; // 2.25 Hz
        const STATE_MAP = { NORMAL: 0, ICE: 1, WARNING: 2, FALLING: 3, BONUS: 5 };

        this.tiles.forEach(tile => {
            const pulse = (Math.sin(this.pulseTime * Math.PI * 2 * beatFreq - tile.distanceToCenter * 0.2) + 1) / 2;

            // Update shader uniforms
            tile.uniforms.uTime.value = this.pulseTime;
            tile.uniforms.uPulse.value = pulse;
            tile.uniforms.uState.value = STATE_MAP[tile.state] || 0;
            tile.uniforms.uStateTimer.value = tile.timer;

            if (tile.state === 'NORMAL') {
                if (tile.edges) {
                    tile.edges.material.opacity = 0.7;
                    tile.edges.material.color.setHex(this.edgeColor);
                }
            }

            if (tile.state === 'BONUS') {
                if (tile.edges) {
                    tile.edges.material.opacity = 0.7;
                    tile.edges.material.color.setHex(0xff8800);
                }
                // Animate powerup icon
                if (tile.powerUpSprite) {
                    tile.powerUpSprite.position.y = 5 + Math.sin(this.pulseTime * 2.5) * 1.0;
                    tile.powerUpSprite.material.rotation = this.pulseTime * 0.5;
                }
            }

            if (tile.state === 'WARNING') {
                tile.timer -= delta;
                const isFlash = Math.sin(tile.timer * 10) > 0;
                if (tile.edges) {
                    tile.edges.material.opacity = isFlash ? 1.0 : 0.5;
                    tile.edges.material.color.setHex(isFlash ? 0xff0000 : this.edgeColor);
                }

                if (tile.timer <= 0) {
                    tile.state = 'FALLING';
                    tile.uniforms.uState.value = STATE_MAP.FALLING;
                    tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                    tile.mesh.scale.set(0.95, 1, 0.95);
                }
            } else if (tile.state === 'ICE') {
                tile.timer -= delta;
                if (tile.edges) {
                    tile.edges.material.opacity = 0.7;
                }

                if (tile.timer <= 0) {
                    tile.state = 'NORMAL';
                    tile.uniforms.uState.value = STATE_MAP.NORMAL;
                    tile.collider.setFriction(0.0);
                    if (tile.edges) {
                        tile.edges.material.color.setHex(this.edgeColor);
                    }
                }
            } else if (tile.state === 'FALLING') {
                const position = tile.rigidBody.translation();
                const rotation = tile.rigidBody.rotation();
                tile.mesh.position.copy(position);
                tile.mesh.quaternion.copy(rotation);
            }
        });

        if (this.skyboxMaterial) {
            this.skyboxMaterial.uniforms.uTime.value = this.pulseTime;
        }
    }

    triggerDrop() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
        if (stableTiles.length === 0) return;

        for (let i = 0; i < 5 && stableTiles.length > 0; i++) {
            const index = Math.floor(Math.random() * stableTiles.length);
            const tile = stableTiles.splice(index, 1)[0];
            tile.state = 'WARNING';
            tile.timer = 3.0;
        }
    }

    triggerIce() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL');
        if (stableTiles.length === 0) return;

        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles[index];

        tile.state = 'ICE';
        tile.timer = 5.0;
        tile.collider.setFriction(0.0);
    }

    triggerBonus() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
        if (stableTiles.length === 0) return;

        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles[index];

        // Pre-assign a powerup using weighted selection
        const weights = useGameStore.getState().settings.powerUpWeights || {};
        const available = POWER_UP_EFFECTS.filter(e => (weights[e.type] ?? 50) > 0);
        if (available.length === 0) return; // No powerups enabled

        const totalWeight = available.reduce((sum, e) => sum + (weights[e.type] ?? 50), 0);
        let roll = Math.random() * totalWeight;
        let selected = available[available.length - 1];
        for (const e of available) {
            roll -= (weights[e.type] ?? 50);
            if (roll <= 0) {
                selected = e;
                break;
            }
        }

        tile.state = 'BONUS';
        tile.timer = 0;
        tile.assignedPowerUp = selected;

        // Create floating icon sprite
        const sprite = createPowerUpSprite(selected.icon, selected.color);
        sprite.position.set(0, 5, 0); // Float above the tile
        tile.mesh.add(sprite);
        tile.powerUpSprite = sprite;
    }

    convertTileToNormal(tile) {
        tile.state = 'NORMAL';
        tile.uniforms.uState.value = 0;
        if (tile.edges) tile.edges.material.color.setHex(this.edgeColor);

        // Clean up powerup sprite
        if (tile.powerUpSprite) {
            tile.mesh.remove(tile.powerUpSprite);
            tile.powerUpSprite.material.map.dispose();
            tile.powerUpSprite.material.dispose();
            tile.powerUpSprite = null;
        }
        tile.assignedPowerUp = null;
    }

    cleanup() {
        this.tiles.forEach(tile => {
            if (tile.powerUpSprite) {
                tile.mesh.remove(tile.powerUpSprite);
                tile.powerUpSprite.material.map.dispose();
                tile.powerUpSprite.material.dispose();
            }
            scene.remove(tile.mesh);
            // === PERFORMANCE: Don't dispose shared geometry ===
            tile.mesh.material.dispose();
            if (tile.edges) tile.edges.material.dispose();
            if (world && tile.rigidBody) {
                world.removeRigidBody(tile.rigidBody);
            }
        });

        if (this.skybox) {
            scene.remove(this.skybox);
            this.skyboxGeometry.dispose();
            this.skyboxMaterial.dispose();
            this.skybox = null;
        }
        if (this.basePlatformMaterial) {
            this.basePlatformMaterial.dispose();
        }
        
        this.tiles = [];
    }
}
