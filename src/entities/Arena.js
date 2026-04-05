import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getPhysicsSystem } from '../systems/PhysicsSystem.js';
import { scene } from '../renderer.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { createPlatformMaterial, createSkyboxMaterial, resolveThemeName } from '../shaders/index.js';
import { generateHexGrid, hexToPixel } from '../utils/math.js';
import { useGameStore } from '../store.js';

// Tile state to shader uniform mapping
const STATE_MAP = { NORMAL: 0, ICE: 1, PORTAL: 2, BONUS: 3, FALLING: 4, WARNING: 5 };

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
            color: 0xff0000
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
    constructor(customTiles) {        console.log('[Arena] Constructor called');        // Clear materials cache to ensure fresh materials with all variants
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

        const hasCustomTiles = Array.isArray(customTiles);
        const normalizeAbility = (ability) => {
            const normalizedAbility = (typeof ability === 'string' ? ability.toUpperCase() : 'NORMAL');
            if (normalizedAbility === 'ICE' || normalizedAbility === 'PORTAL' || normalizedAbility === 'BONUS' || normalizedAbility === 'NORMAL') {
                return normalizedAbility;
            }
            return 'NORMAL';
        };

        // 1. Generate Grid
        const hexes = hasCustomTiles
            ? customTiles.map(tile => ({
                q: tile?.coord?.q,
                r: tile?.coord?.r,
                ability: normalizeAbility(tile?.ability),
                height: Number.isFinite(tile?.height) ? tile.height : 0
            })).filter(tile => Number.isFinite(tile.q) && Number.isFinite(tile.r))
            : generateHexGrid(this.arenaSize).map(hex => ({
                q: hex.q,
                r: hex.r,
                ability: 'NORMAL',
                height: 0
            }));

        // 2. Create Tiles
        const gridSpacing = 8.0;
        const tileRadius = gridSpacing * 1.0;
        const height = 4.0;

        // === PERFORMANCE: Use shared geometry ===
        const geometry = getSharedTileGeometry(tileRadius, height);
        const edgesGeometry = getSharedEdgesGeometry(tileRadius, height);
        
        // Subtle edge colors (less bright/distracting)
        this.edgeColor = 0x664466;  // Very muted magenta (Cyber default)
        this.baseColor = 0x666666;
        this.iceColor = 0x335555;   // Very muted cyan
        if (theme === 'beach') {
            this.edgeColor = 0x335555;  // Very muted cyan
            this.baseColor = 0xffffff;
            this.iceColor = 0x335566;   // Very muted blue
        }
        if (theme === 'cracked_stone') {
            this.edgeColor = 0x664422;  // Very muted orange
            this.baseColor = 0xffffff;
            this.iceColor = 0x335555;   // Very muted cyan
        }
        if (theme === 'temple') {
            this.edgeColor = 0x8B7355;  // Stone brown
            this.baseColor = 0xDAA520;  // Gold accent
            this.iceColor = 0x335555;
        }
        if (theme === 'arctic') {
            this.edgeColor = 0xADD8E6;  // Light blue
            this.baseColor = 0xE8F4F8;  // Ice white
            this.iceColor = 0x87CEEB;   // Sky blue
        }
        if (theme === 'inferno') {
            this.edgeColor = 0xFF4500;  // Orange red
            this.baseColor = 0x1a0a0a;  // Dark volcanic
            this.iceColor = 0x8B0000;    // Dark red
        }

        // === Create shader-based platform material ===
        const resolvedTheme = resolveThemeName(theme);
        this.basePlatformMaterial = createPlatformMaterial(resolvedTheme);
        
        // === Create spherical skybox ===
        this.skyboxGeometry = new THREE.SphereGeometry(400, 64, 64);
        this.skyboxMaterial = createSkyboxMaterial(resolvedTheme);
        this.skybox = new THREE.Mesh(this.skyboxGeometry, this.skyboxMaterial);
        this.skybox.renderOrder = -1000;
        scene.add(this.skybox);
        console.log('[Arena] Added skybox to scene');

        let tileCount = 0;
        hexes.forEach(hex => {
            const pos = hexToPixel(hex.q, hex.r, gridSpacing);
            const initialState = hex.ability || 'NORMAL';
            const position = { x: pos.x, y: hex.height, z: pos.z };

            // === Use shader-based material for each tile (cloned for independent uniforms) ===
            const tileMaterial = this.basePlatformMaterial.clone();
            const mesh = new THREE.Mesh(geometry, tileMaterial);
            mesh.position.set(position.x, position.y, position.z);
            mesh.rotation.y = Math.PI / 6;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Track uniforms for state updates
            const uniforms = tileMaterial.uniforms;
            if (uniforms?.uState) {
                uniforms.uState.value = STATE_MAP[initialState] || 0;
            }
            
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
                uniforms,
                rigidBody,
                collider,
                state: initialState,
                timer: initialState === 'ICE' ? Number.POSITIVE_INFINITY : 0,
                distanceToCenter: Math.sqrt(position.x ** 2 + position.z ** 2),
                edgeOpacity: 0.5  // More subtle default opacity
            });

            if (initialState === 'ICE') {
                collider.setFriction(0.0);
            }
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

        // === PERFORMANCE: Accumulate time for shader uniforms ===
        this.pulseTime += delta;
        
        // Update shader uniforms for pulse effect
        if (this.basePlatformMaterial && this.basePlatformMaterial.uniforms) {
            this.basePlatformMaterial.uniforms.uTime.value = this.pulseTime;
            this.basePlatformMaterial.uniforms.uPulse.value = this.pulseTime * 2.25;
        }

        this.tiles.forEach(tile => {
            // Update shader time uniform for this tile's material
            if (tile.uniforms) {
                tile.uniforms.uTime.value = this.pulseTime;
                tile.uniforms.uPulse.value = this.pulseTime * 2.25;
                tile.uniforms.uState.value = STATE_MAP[tile.state] || 0;
                tile.uniforms.uStateTimer.value = tile.timer;
                // Set ice color from theme
                if (tile.uniforms.uIceColor) {
                    tile.uniforms.uIceColor.value.setHex(this.iceColor);
                }
            }

            // Handle edge glow pulsing
            const pulse = (Math.sin(this.pulseTime * Math.PI * 2 * 2.25 - tile.distanceToCenter * 0.2) + 1) / 2;
            tile.edgeOpacity = 0.7 + pulse * 0.3;
            tile.edges.material.opacity = tile.edgeOpacity;

            if (tile.state === 'WARNING') {
                tile.timer -= delta;
                const isFlash = Math.sin(tile.timer * 10) > 0;
                
                if (isFlash) {
                    tile.edges.material.color.setHex(0xff0000);
                } else {
                    tile.edges.material.color.setHex(this.edgeColor);
                }

                if (tile.timer <= 0) {
                    tile.state = 'FALLING';
                    tile.uniforms.uState.value = STATE_MAP.FALLING;
                    tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                    tile.mesh.scale.set(0.95, 1, 0.95);
                }
            } else if (tile.state === 'ICE') {
                tile.timer -= delta;

                if (tile.timer <= 0) {
                    tile.state = 'NORMAL';
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

        // Update skybox material uniforms
        if (this.skyboxMaterial && this.skyboxMaterial.uniforms) {
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
            // Dispose shader material
            if (tile.mesh.material.dispose) {
                tile.mesh.material.dispose();
            }
            tile.edges.material.dispose();
            if (tile.rigidBody) {
                physicsSystem.destroyBody(`tile_${tile.q}_${tile.r}`);
            }
        });
        
        // Dispose shader materials
        if (this.basePlatformMaterial) {
            this.basePlatformMaterial.dispose();
        }
        if (this.skybox) {
            scene.remove(this.skybox);
            if (this.skyboxGeometry) this.skyboxGeometry.dispose();
            if (this.skyboxMaterial) this.skyboxMaterial.dispose();
            this.skybox = null;
        }
        
        this.tiles = [];
    }
}
