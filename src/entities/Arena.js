import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getPhysicsSystem } from '../systems/PhysicsSystem.js';
import { scene } from '../renderer.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { generateHexGrid, hexToPixel } from '../utils/math.js';
import { useGameStore } from '../store.js';

// === PERFORMANCE: Shared geometries to reduce memory and draw calls ===
let SHARED_TILE_GEOMETRY = null;
let TILE_MATERIALS_CACHE = {}; // Reset on each game

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

function getTileMaterials(theme, edgeColor, baseColor, iceColor) {
    const cacheKey = `${theme}-${edgeColor}-${baseColor}-${iceColor}`;
    if (TILE_MATERIALS_CACHE[cacheKey]) {
        return TILE_MATERIALS_CACHE[cacheKey];
    }

    const { tileMaterialParams } = getThemeMaterials(theme);
    
    // Material variants - shared and reused
    const materials = {
        normal: new THREE.MeshStandardMaterial({
            ...tileMaterialParams,
            color: baseColor
        }),
        ice: new THREE.MeshStandardMaterial({
            ...tileMaterialParams,
            color: iceColor
        }),
        warning: new THREE.MeshStandardMaterial({
            ...tileMaterialParams,
            color: 0xaa3333
        }),
        falling: new THREE.MeshStandardMaterial({
            ...tileMaterialParams,
            color: 0xff2200
        }),
        portal: new THREE.MeshStandardMaterial({
            ...tileMaterialParams,
            color: 0x00ffff,
            emissive: 0x0088ff,
            emissiveIntensity: 0.6
        }),
        bonus: new THREE.MeshStandardMaterial({
            ...tileMaterialParams,
            color: 0xffff00,
            emissive: 0xff8800,
            emissiveIntensity: 0.7
        })
    };
    
    TILE_MATERIALS_CACHE[cacheKey] = materials;
    return materials;
}

export class Arena {
    constructor() {
        // Clear materials cache to ensure fresh materials with all variants
        TILE_MATERIALS_CACHE = {};
        
        this.tiles = [];
        this.dropTimer = 0;
        this.iceTimer = 0;
        this.portalTimer = 0;
        this.bonusTimer = 0;
        this.pulseTime = 0;

        const settings = useGameStore.getState().settings;
        this.arenaSize = settings.arenaSize;
        const theme = settings.theme || 'default';

        // 1. Generate Grid
        const hexes = generateHexGrid(this.arenaSize);

        // 2. Create Tiles
        const gridSpacing = 8.0;
        const tileRadius = gridSpacing * 1.0;
        const height = 4.0;

        // === PERFORMANCE: Use shared geometry ===
        const geometry = getSharedTileGeometry(tileRadius, height);
        const edgesGeometry = getSharedEdgesGeometry(tileRadius, height);
        
        // Subtle edge colors (less bright/distracting)
        this.edgeColor = 0x884488;  // Muted magenta
        this.baseColor = 0x666666;
        this.iceColor = 0x447777;   // Muted cyan
        if (theme === 'beach') {
            this.edgeColor = 0x447777;  // Muted cyan
            this.baseColor = 0xffffff;
            this.iceColor = 0x446688;   // Muted blue
        }
        if (theme === 'cracked_stone') {
            this.edgeColor = 0x885533;  // Muted orange
            this.baseColor = 0xffffff;
            this.iceColor = 0x447777;   // Muted cyan
        }

        // === PERFORMANCE: Get shared materials and store as instance member ===
        this.materials = getTileMaterials(theme, this.edgeColor, this.baseColor, this.iceColor);

        hexes.forEach(hex => {
            const pos = hexToPixel(hex.q, hex.r, gridSpacing);
            const position = { x: pos.x, y: 0, z: pos.z };

            // === PERFORMANCE: Reuse geometry, don't clone ===
            const mesh = new THREE.Mesh(geometry, this.materials.normal);
            mesh.position.set(position.x, position.y, position.z);
            mesh.rotation.y = Math.PI / 6;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Glowing Edges with simpler material
            const edgesMat = new THREE.LineBasicMaterial({ 
                color: this.edgeColor,
                transparent: true,
                opacity: 0.7
            });
            const edges = new THREE.LineSegments(edgesGeometry, edgesMat);
            edges.position.set(0, 0, 0);
            edges.rotation.y = Math.PI / 3;
            mesh.add(edges);

            scene.add(mesh);

            // === PERFORMANCE: NO PointLight - use emissive instead ===
            // Use PhysicsSystem for event tracking
            const physicsSystem = getPhysicsSystem();
            const tileId = `tile_${hex.q}_${hex.r}`;
            const { rigidBody, collider } = physicsSystem.createBody(tileId, position, {
                radius: tileRadius,
                height: height,
                isDynamic: false
            });
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
                edgeOpacity: 0.5  // More subtle default opacity
            });
        });
    }

    getTileAt(q, r) {
        return this.tiles.find(t => t.q === q && t.r === r);
    }

    update(delta) {
        const storeState = useGameStore.getState();
        if (storeState.gameState === 'PLAYING') {
            this.dropTimer += delta;
            this.iceTimer += delta;
            this.portalTimer += delta;
            this.bonusTimer += delta;
        }

        const settings = storeState.settings;
        
        // Ensure settings have valid values with fallbacks
        const destructionRate = settings.destructionRate || 3.0;
        const iceRate = settings.iceRate || 2.0;
        const portalRate = settings.portalRate || 8.0;
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

        // 3. Handle Portal Tiles
        if (this.portalTimer >= portalRate) {
            this.portalTimer = 0;
            this.triggerPortal();
        }

        // 4. Handle Bonus Tiles
        if (this.bonusTimer >= bonusRate) {
            this.bonusTimer = 0;
            this.triggerBonus();
        }

        // === PERFORMANCE: Accumulate time instead of Date.now() every frame ===
        this.pulseTime += delta;
        const beatFreq = 135 / 60; // 2.25 Hz
        const bpm = 135;

        this.tiles.forEach(tile => {
            // === PERFORMANCE: Pulse via emissive intensity, not light intensity ===
            const pulse = (Math.sin(this.pulseTime * Math.PI * 2 * beatFreq - tile.distanceToCenter * 0.2) + 1) / 2;

            if (tile.state === 'NORMAL') {
                tile.mesh.material = this.materials.normal;
                tile.edgeOpacity = 0.7 + pulse * 0.3;
                tile.edges.material.opacity = tile.edgeOpacity;
            }

            if (tile.state === 'PORTAL') {
                tile.mesh.material = this.materials.portal;
                // Portal pulse: glow stronger
                tile.mesh.material.emissiveIntensity = 0.4 + pulse * 0.4;
                tile.edgeOpacity = 0.8 + pulse * 0.2;
                tile.edges.material.opacity = tile.edgeOpacity;
                tile.edges.material.color.setHex(0x0088ff);
            }

            if (tile.state === 'BONUS') {
                // Bonus tiles flash more aggressively
                tile.mesh.material = this.materials.bonus;
                const bonusFlash = (Math.sin(this.pulseTime * Math.PI * 4) + 1) / 2; // Faster flash
                tile.mesh.material.emissiveIntensity = 0.5 + bonusFlash * 0.5;
                tile.edgeOpacity = 0.6 + bonusFlash * 0.4;
                tile.edges.material.opacity = tile.edgeOpacity;
                tile.edges.material.color.setHex(0xff8800);
            }

            if (tile.state === 'WARNING') {
                tile.timer -= delta;
                const isFlash = Math.sin(tile.timer * 10) > 0;
                
                if (isFlash) {
                    tile.mesh.material = this.warningMaterial || this.materials.warning;
                    tile.edges.material.opacity = 0.7;  // Less blinding warning
                    tile.edges.material.color.setHex(0xaa3333);
                } else {
                    tile.mesh.material = this.materials.normal;
                    tile.edges.material.opacity = 0.7;
                    tile.edges.material.color.setHex(this.edgeColor);
                }

                if (tile.timer <= 0) {
                    tile.state = 'FALLING';
                    tile.mesh.material = this.materials.falling;
                    tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                    tile.mesh.scale.set(0.95, 1, 0.95);
                }
            } else if (tile.state === 'ICE') {
                tile.timer -= delta;
                tile.mesh.material = this.materials.ice;
                tile.edgeOpacity = 0.8 + pulse * 0.2;
                tile.edges.material.opacity = tile.edgeOpacity;

                if (tile.timer <= 0) {
                    tile.state = 'NORMAL';
                    tile.mesh.material = this.materials.normal;
                    tile.collider.setFriction(0.0);
                    tile.edges.material.color.setHex(this.edgeColor);
                }
            } else if (tile.state === 'FALLING') {
                const position = tile.rigidBody.translation();
                const rotation = tile.rigidBody.rotation();
                tile.mesh.position.copy(position);
                tile.mesh.quaternion.copy(rotation);
            }
        });
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

    triggerPortal() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
        if (stableTiles.length === 0) return;

        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles[index];

        tile.state = 'PORTAL';
        tile.timer = 0; // Portal tiles are persistent
    }

    triggerBonus() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
        if (stableTiles.length === 0) return;

        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles[index];

        tile.state = 'BONUS';
        tile.timer = 0; // Bonus tiles are persistent until picked up
    }

    getPortalTiles() {
        return this.tiles.filter(t => t.state === 'PORTAL');
    }

    convertTileToNormal(tile) {
        tile.state = 'NORMAL';
        tile.mesh.material = this.materials.normal;
        tile.edges.material.color.setHex(this.edgeColor);
    }

    cleanup() {
        const physicsSystem = getPhysicsSystem();
        this.tiles.forEach(tile => {
            scene.remove(tile.mesh);
            // === PERFORMANCE: Don't dispose shared geometry ===
            tile.mesh.material.dispose();
            tile.edges.material.dispose();
            if (tile.rigidBody) {
                physicsSystem.destroyBody(`tile_${tile.q}_${tile.r}`);
            }
        });
        
        this.tiles = [];
    }
}
