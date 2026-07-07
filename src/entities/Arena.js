import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getPhysicsSystem } from '../systems/PhysicsSystem.js';
import { scene } from '../renderer.js';
import { getThemeMaterials, getThemeColors, getThemeShaderMaterials } from '../utils/themeTextures.js';
import { generateHexGrid, hexToPixel } from '../utils/math.js';
import { useGameStore } from '../store.js';
import { POWER_UP_EFFECTS } from './Player.js';

// Tile state to shader uniform mapping
const STATE_MAP = { NORMAL: 0, ICE: 1, WARNING: 2, FALLING: 3, BONUS: 5 };

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
        this.bonusTimer = 0;
        this.pulseTime = 0;

        const settings = useGameStore.getState().settings;
        this.arenaSize = settings.arenaSize;
        const theme = settings.theme || 'default';

        const hasCustomTiles = Array.isArray(customTiles);
        const normalizeAbility = (ability) => {
            const normalizedAbility = (typeof ability === 'string' ? ability.toUpperCase() : 'NORMAL');
            if (normalizedAbility === 'ICE' || normalizedAbility === 'BONUS' || normalizedAbility === 'NORMAL') {
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
        
        // === Create shader-based platform and skybox materials ===
        const shaderMaterials = getThemeShaderMaterials(theme);
        this.basePlatformMaterial = shaderMaterials.platformMaterial;
        this.skyboxMaterial = shaderMaterials.skyboxMaterial;

        // Get theme colors from themeTextures
        const themeColors = getThemeColors(theme);
        this.edgeColor = themeColors.edgeColor;
        this.baseColor = themeColors.baseColor;
        this.iceColor = themeColors.iceColor;

        // === Create spherical skybox ===
        this.skyboxGeometry = new THREE.SphereGeometry(400, 64, 64);
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
        
        // Arctic theme: Create seam filler plane to mask tile gaps
        if (theme === 'arctic' && this.tiles.length > 0) {
            const maxDistance = this.tiles.reduce((max, tile) => Math.max(max, tile.distanceToCenter), 0);
            const minTileY = this.tiles.reduce((min, tile) => Math.min(min, tile.mesh.position.y), Number.POSITIVE_INFINITY);

            const fillerSize = (maxDistance + tileRadius * 1.8) * 2.5;
            const fillerGeometry = new THREE.PlaneGeometry(fillerSize, fillerSize);
            
            // Use MeshBasicMaterial — unlit, no per-triangle shading differences.
            // MeshStandardMaterial causes macOS Metal WebGL to shade the 2 PlaneGeometry
            // triangles differently (per-triangle lighting precision), producing visible
            // triangular artifacts in tile gaps. BasicMaterial renders a flat uniform color.
            const fillerMaterial = new THREE.MeshBasicMaterial({
                color: 0xb7cfde,
                depthWrite: false,
                depthTest: true
            });

            this.arcticSeamFiller = new THREE.Mesh(fillerGeometry, fillerMaterial);
            this.arcticSeamFiller.rotation.x = -Math.PI / 2;
            this.arcticSeamFiller.position.set(0, minTileY - height * 0.5 + 0.06, 0);
            this.arcticSeamFiller.renderOrder = -5;
            scene.add(this.arcticSeamFiller);
        }
    }

    getTileAt(q, r) {
        return this.tiles.find(t => t.q === q && t.r === r);
    }

    update(delta, { isOnlineClient = false } = {}) {
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

        // Slider values are "intensity" (higher = more frequent). Convert to
        // actual intervals so the timers behave intuitively.
        const destructionInterval = 10.5 - destructionRate;
        const iceInterval = 10.5 - iceRate;
        const bonusInterval = 17.0 - bonusRate;

        if (!isOnlineClient) {
            // 1. Handle The Drop
            if (this.dropTimer >= destructionInterval) {
                this.dropTimer = 0;
                this.triggerDrop();
            }

            // 2. Handle Ice Tiles
            if (this.iceTimer >= iceInterval) {
                this.iceTimer = 0;
                this.triggerIce();
            }

            // 3. Handle Bonus Tiles
            if (this.bonusTimer >= bonusInterval) {
                this.bonusTimer = 0;
                this.triggerBonus();
            }
        }

        // === PERFORMANCE: Accumulate time for shader uniforms ===
        this.pulseTime += delta;
        
        // Update shader uniforms for pulse effect
        // uPulse must oscillate in [0,1]; raw pulseTime * 2.25 grows unboundedly and
        // makes mix() extrapolate past the intended color range, causing triangular
        // artefacts on macOS Metal WebGL where out-of-range fragments aren't clamped.
        const shaderPulse = (Math.sin(this.pulseTime * Math.PI * 2 * 2.25) + 1) / 2;
        if (this.basePlatformMaterial && this.basePlatformMaterial.uniforms) {
            this.basePlatformMaterial.uniforms.uTime.value = this.pulseTime;
            this.basePlatformMaterial.uniforms.uPulse.value = shaderPulse;
        }

        this.tiles.forEach(tile => {
            // Animate power-up statue
            if (tile.statue) {
                tile.statue.time += delta;
                const bob = Math.sin(tile.statue.time * 2) * 0.3;
                tile.statue.group.position.y = tile.mesh.position.y + 3.5 + bob;
                tile.statue.gem.rotation.y += delta * 1.5;
                tile.statue.gem.rotation.x = Math.sin(tile.statue.time * 0.5) * 0.2;
                tile.statue.ring.rotation.z += delta * 2;
                tile.statue.ring.rotation.x = Math.PI / 2 + Math.sin(tile.statue.time * 1.2) * 0.15;
                const pulse = 0.7 + Math.sin(tile.statue.time * 3) * 0.3;
                tile.statue.glow.material.opacity = 0.08 * pulse;
            }

            // Update shader time uniform for this tile's material
            if (tile.uniforms) {
                tile.uniforms.uTime.value = this.pulseTime;
                tile.uniforms.uPulse.value = shaderPulse;
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
                    if (isOnlineClient) {
                        tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                        tile.mesh.visible = false;
                        tile.mesh.scale.set(0.95, 1, 0.95);
                        if (tile.edges) {
                            tile.edges.visible = false;
                        }
                    } else {
                        tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                        tile.mesh.scale.set(0.95, 1, 0.95);
                    }
                }
            } else if (tile.state === 'ICE') {
                tile.timer -= delta;

                if (tile.timer <= 0) {
                    tile.state = 'NORMAL';
                    tile.collider.setFriction(0.0);
                    tile.edges.material.color.setHex(this.edgeColor);
                }
            } else if (tile.state === 'FALLING') {
                if (isOnlineClient) {
                    tile.mesh.visible = false;
                    if (tile.edges) {
                        tile.edges.visible = false;
                    }
                } else {
                    const position = tile.rigidBody.translation();
                    const rotation = tile.rigidBody.rotation();
                    tile.mesh.position.copy(position);
                    tile.mesh.quaternion.copy(rotation);
                }
            }
        });

        // Update skybox material uniforms
        if (this.skyboxMaterial && this.skyboxMaterial.uniforms) {
            this.skyboxMaterial.uniforms.uTime.value = this.pulseTime;
        }
    }

    hideTile(q, r) {
        const tile = this.getTileAt(q, r);
        if (!tile) return;

        tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        tile.mesh.visible = false;
        tile.mesh.scale.set(0.95, 1, 0.95);
        if (tile.edges) {
            tile.edges.visible = false;
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

    _pickWeightedPowerUp() {
        const weights = useGameStore.getState().settings.powerUpWeights;
        const candidates = POWER_UP_EFFECTS.filter(pu => (weights[pu.type] || 0) > 0);
        if (candidates.length === 0) return POWER_UP_EFFECTS[Math.floor(Math.random() * POWER_UP_EFFECTS.length)];

        const totalWeight = candidates.reduce((sum, pu) => sum + (weights[pu.type] || 0), 0);
        let roll = Math.random() * totalWeight;
        for (const pu of candidates) {
            roll -= weights[pu.type] || 0;
            if (roll <= 0) return pu;
        }
        return candidates[candidates.length - 1];
    }

    _createStatue(powerUp, worldPos) {
        const group = new THREE.Group();
        const color = powerUp.color;

        const gemGeo = new THREE.OctahedronGeometry(1.2, 0);
        const gemMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.8,
            metalness: 0.3,
            roughness: 0.2,
            transparent: true,
            opacity: 0.9
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.castShadow = true;
        group.add(gem);

        const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const pillarMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.2
        });
        const pillarGeo = new THREE.CylinderGeometry(0.06, 0.1, 1.5, 4);
        for (let i = 0; i < 3; i++) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            const angle = (i / 3) * Math.PI * 2;
            pillar.position.set(Math.cos(angle) * 1.2, -0.75, Math.sin(angle) * 1.2);
            group.add(pillar);
        }

        const glowGeo = new THREE.SphereGeometry(1.8, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.12,
            side: THREE.BackSide,
            depthWrite: false
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        group.add(glow);

        group.position.set(worldPos.x, worldPos.y + 3.5, worldPos.z);
        scene.add(group);

        return { group, gem, ring, glow, time: 0 };
    }

    triggerBonus() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
        if (stableTiles.length === 0) return;

        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles[index];

        const powerUp = this._pickWeightedPowerUp();
        tile.state = 'BONUS';
        tile.timer = 0;
        tile.powerUpType = powerUp.type;
        tile.statue = this._createStatue(powerUp, tile.mesh.position);
        tile.statuePowerUp = powerUp;
    }

    convertTileToNormal(tile) {
        tile.state = 'NORMAL';
        if (tile.uniforms) {
            tile.uniforms.uState.value = STATE_MAP.NORMAL;
        }
        if (tile.statue) {
            scene.remove(tile.statue.group);
            tile.statue.group.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            tile.statue = null;
            tile.statuePowerUp = null;
            tile.powerUpType = null;
        }
        tile.edges.material.color.setHex(this.edgeColor);
    }

    getActiveTileSet() {
        const activeTiles = new Set();
        for (const tile of this.tiles) {
            if (tile.state !== 'FALLING' && tile.state !== 'WARNING') {
                activeTiles.add(`${tile.q},${tile.r}`);
            }
        }
        return activeTiles;
    }

    getWarnedTileSet() {
        const warnedTiles = new Set();
        for (const tile of this.tiles) {
            if (tile.state === 'WARNING') {
                warnedTiles.add(`${tile.q},${tile.r}`);
            }
        }
        return warnedTiles;
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
        
        this.tiles.forEach(tile => {
            if (tile.statue) {
                scene.remove(tile.statue.group);
                tile.statue.group.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        child.material.dispose();
                    }
                });
            }
        });

        this.tiles = [];
    }
}
