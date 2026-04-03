/**
 * Arena Entity - TypeScript Migration
 *
 * Arena class with tile management, hex grid operations, and physics integration.
 */

import * as THREE from 'three';
import RAPIER, { RigidBody, Collider } from '@dimforge/rapier3d-compat';
import { getPhysicsSystem } from '../systems/PhysicsSystem';
import { scene } from '../renderer';
import { getThemeMaterials } from '../utils/themeTextures';
import { createSkyboxMaterial, resolveThemeName } from '../shaders/index';
import { generateHexGrid, hexToPixel } from '../utils/math';
import { useGameStore } from '../store';
import { EntityBase } from './Entity.base';
import type { ArenaEntity, GameContext } from '../types/Entity';
import type { ArenaBounds } from '../types/Game';

// Tile state types
export type TileState = 'NORMAL' | 'ICE' | 'PORTAL' | 'BONUS' | 'WARNING' | 'FALLING' | 'DESTRUCTED';

// Arena tile data structure
export interface ArenaTileData {
  q: number;
  r: number;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  rigidBody: RigidBody;
  collider: Collider;
  state: TileState;
  timer: number;
  distanceToCenter: number;
  edgeOpacity: number;
}

// Tile materials
interface TileMaterials {
  normal: THREE.MeshStandardMaterial;
  ice: THREE.MeshStandardMaterial;
  warning: THREE.MeshStandardMaterial;
  falling: THREE.MeshStandardMaterial;
  portal: THREE.MeshStandardMaterial;
  bonus: THREE.MeshStandardMaterial;
}

// === PERFORMANCE: Shared geometries to reduce memory and draw calls ===
let SHARED_TILE_GEOMETRY: THREE.CylinderGeometry | null = null;
let TILE_MATERIALS_CACHE: Record<string, TileMaterials> = {};

function getSharedTileGeometry(radius: number, height: number): THREE.CylinderGeometry {
    if (!SHARED_TILE_GEOMETRY) {
        SHARED_TILE_GEOMETRY = new THREE.CylinderGeometry(radius, radius, height, 6);
    }
    return SHARED_TILE_GEOMETRY;
}

function getSharedEdgesGeometry(radius: number, height: number): THREE.EdgesGeometry {
    // Create temp geometry just for edges, will be reused
    const geo = new THREE.CylinderGeometry(radius, radius, height, 6);
    return new THREE.EdgesGeometry(geo);
}

function getTileMaterials(theme: string, edgeColor: number, baseColor: number, iceColor: number): TileMaterials {
    const cacheKey = `${theme}-${edgeColor}-${baseColor}-${iceColor}`;
    if (TILE_MATERIALS_CACHE[cacheKey]) {
        return TILE_MATERIALS_CACHE[cacheKey];
    }

    const { tileMaterialParams } = getThemeMaterials(theme);
    
    // Material variants - shared and reused
    const materials: TileMaterials = {
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

/**
 * Arena class extending EntityBase
 * Manages hex grid tiles with different states (NORMAL, ICE, PORTAL, BONUS, etc.)
 */
export class Arena extends EntityBase implements ArenaEntity {
  readonly type: 'arena' = 'arena';
  
  bounds!: ArenaBounds;
  tiles: ArenaTileData[] = [];
  hexSize: number = 8.0;
  
  // Arena properties
  arenaSize!: number;
  edgeColor!: number;
  baseColor!: number;
  iceColor!: number;
  materials!: TileMaterials;
  
  // Timers
  dropTimer: number = 0;
  iceTimer: number = 0;
  portalTimer: number = 0;
  bonusTimer: number = 0;
  pulseTime: number = 0;
  
  // Three.js group
  mesh: THREE.Group;

  // Custom tiles from level editor
  customTiles?: any[];

  // Skybox
  skybox: THREE.Mesh | null = null;
  skyboxGeometry: THREE.SphereGeometry | null = null;
  skyboxMaterial: any = null;

  constructor(bounds?: Partial<ArenaBounds>, customTiles?: any[]) {
    super('arena', 'arena', { x: 0, y: 0 });
    this.bounds = bounds as ArenaBounds || { 
      width: 40, 
      height: 40,
      minX: -20,
      maxX: 20,
      minY: -20,
      maxY: 20
    };
    this.mesh = new THREE.Group();
    this.customTiles = customTiles; // Store custom tiles if provided
    
    // Clear materials cache to ensure fresh materials with all variants
    TILE_MATERIALS_CACHE = {};
    
    this._initialize();
  }

  private _initialize(): void {
    const settings = useGameStore.getState().settings;
    this.arenaSize = settings.arenaSize;
    const theme = resolveThemeName(settings.theme || 'tron');

    // 1. Generate Grid or use custom tiles
    let hexes: any[];
    if (this.customTiles && this.customTiles.length > 0) {
      // Use custom tiles from level editor
      hexes = this.customTiles.map(t => ({
        q: t.coord.q,
        r: t.coord.r,
        ability: t.ability,
        height: t.height
      }));
      console.log('[Arena] Loaded custom level with', hexes.length, 'tiles');
    } else {
      // Generate random grid
      hexes = generateHexGrid(this.arenaSize);
    }

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

    // === PERFORMANCE: Get shared materials and store as instance member ===
    this.materials = getTileMaterials(theme, this.edgeColor, this.baseColor, this.iceColor);

    hexes.forEach(hex => {
        const pos = hexToPixel(hex.q, hex.r, gridSpacing);
        const position = { x: pos.x, y: 0, z: pos.z };

        // Determine tile material based on ability
        let material = this.materials.normal;
        let tileState: TileState = 'NORMAL';
        
        if (hex.ability) {
          switch(hex.ability) {
            case 'ICE':
              material = this.materials.ice;
              tileState = 'NORMAL'; // ICE tiles are still normal state initially
              break;
            case 'PORTAL':
              material = this.materials.portal;
              tileState = 'NORMAL';
              break;
            case 'BONUS':
              material = this.materials.bonus;
              tileState = 'NORMAL';
              break;
            case 'WARNING':
              material = this.materials.warning;
              tileState = 'WARNING';
              break;
            default:
              material = this.materials.normal;
              tileState = 'NORMAL';
          }
        }

        // === PERFORMANCE: Reuse geometry, don't clone ===
        const mesh = new THREE.Mesh(geometry, material);
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
            state: tileState,
            timer: 0,
            distanceToCenter: Math.sqrt(position.x ** 2 + position.z ** 2),
            edgeOpacity: 0.5  // More subtle default opacity
        });
    });

    // Create spherical skybox
    this.skyboxGeometry = new THREE.SphereGeometry(400, 64, 64);
    this.skyboxMaterial = createSkyboxMaterial(theme);
    this.skybox = new THREE.Mesh(this.skyboxGeometry, this.skyboxMaterial);
    this.skybox.renderOrder = -1000;
    scene.add(this.skybox);
  }

  async initialize(context: GameContext): Promise<void> {
    await super.initialize(context);
  }

  // Implement EntityBase.update for lifecycle
  update(deltaTime: number, _context?: GameContext): void {
    super.update(deltaTime, _context || {} as any);
    // Delegate to game update logic
    this.updateGame(deltaTime);
  }
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

    this.tiles.forEach(tile => {
        // === PERFORMANCE: Pulse via emissive intensity, not light intensity ===
        const pulse = (Math.sin(this.pulseTime * Math.PI * 2 * beatFreq - tile.distanceToCenter * 0.2) + 1) / 2;

        if (tile.state === 'NORMAL') {
            tile.mesh.material = this.materials.normal;
            tile.edgeOpacity = 0.7 + pulse * 0.3;
            (tile.edges.material as THREE.LineBasicMaterial).opacity = tile.edgeOpacity;
        }

        if (tile.state === 'PORTAL') {
            tile.mesh.material = this.materials.portal;
            // Portal pulse: glow stronger
            (tile.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + pulse * 0.4;
            tile.edgeOpacity = 0.8 + pulse * 0.2;
            (tile.edges.material as THREE.LineBasicMaterial).opacity = tile.edgeOpacity;
            (tile.edges.material as THREE.LineBasicMaterial).color.setHex(0x0088ff);
        }

        if (tile.state === 'BONUS') {
            // Bonus tiles flash more aggressively
            tile.mesh.material = this.materials.bonus;
            const bonusFlash = (Math.sin(this.pulseTime * Math.PI * 4) + 1) / 2; // Faster flash
            (tile.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + bonusFlash * 0.5;
            tile.edgeOpacity = 0.6 + bonusFlash * 0.4;
            (tile.edges.material as THREE.LineBasicMaterial).opacity = tile.edgeOpacity;
            (tile.edges.material as THREE.LineBasicMaterial).color.setHex(0xff8800);
        }

        if (tile.state === 'WARNING') {
            tile.timer -= delta;
            const isFlash = Math.sin(tile.timer * 10) > 0;
            
            if (isFlash) {
                tile.mesh.material = this.materials.warning;
                (tile.edges.material as THREE.LineBasicMaterial).opacity = 0.7;  // Less blinding warning
                (tile.edges.material as THREE.LineBasicMaterial).color.setHex(0xff0000);
            } else {
                tile.mesh.material = this.materials.normal;
                (tile.edges.material as THREE.LineBasicMaterial).opacity = 0.7;
                (tile.edges.material as THREE.LineBasicMaterial).color.setHex(this.edgeColor);
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
            (tile.edges.material as THREE.LineBasicMaterial).opacity = tile.edgeOpacity;

            if (tile.timer <= 0) {
                tile.state = 'NORMAL';
                tile.mesh.material = this.materials.normal;
                tile.collider.setFriction(0.0);
                (tile.edges.material as THREE.LineBasicMaterial).color.setHex(this.edgeColor);
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

  triggerDrop(): void {
    const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
    if (stableTiles.length === 0) return;

    for (let i = 0; i < 5 && stableTiles.length > 0; i++) {
        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles.splice(index, 1)[0];
        if (tile) {
            tile.state = 'WARNING';
            tile.timer = 3.0;
        }
    }
  }

  triggerIce(): void {
    const stableTiles = this.tiles.filter(t => t.state === 'NORMAL');
    if (stableTiles.length === 0) return;

    const index = Math.floor(Math.random() * stableTiles.length);
    const tile = stableTiles[index];
    if (!tile) return;

    tile.state = 'ICE';
    tile.timer = 5.0;
    tile.collider.setFriction(0.0);
  }

  triggerPortal(): void {
    const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
    if (stableTiles.length === 0) return;

    const index = Math.floor(Math.random() * stableTiles.length);
    const tile = stableTiles[index];
    if (!tile) return;

    tile.state = 'PORTAL';
    tile.timer = 0; // Portal tiles are persistent
  }

  triggerBonus(): void {
    const stableTiles = this.tiles.filter(t => t.state === 'NORMAL' || t.state === 'ICE');
    if (stableTiles.length === 0) return;

    const index = Math.floor(Math.random() * stableTiles.length);
    const tile = stableTiles[index];
    if (!tile) return;

    tile.state = 'BONUS';
    tile.timer = 0; // Bonus tiles are persistent until picked up
  }

  getTileAt(q: number, r: number): ArenaTileData | undefined {
    return this.tiles.find(t => t.q === q && t.r === r);
  }

  getPortalTiles(): ArenaTileData[] {
    return this.tiles.filter(t => t.state === 'PORTAL');
  }

  convertTileToNormal(tile: ArenaTileData): void {
    tile.state = 'NORMAL';
    tile.mesh.material = this.materials.normal;
    (tile.edges.material as THREE.LineBasicMaterial).color.setHex(this.edgeColor);
  }

  async destroy(): Promise<void> {
    await super.destroy();
    this.cleanup();
  }

  cleanup(): void {
    const physicsSystem = getPhysicsSystem();
    this.tiles.forEach(tile => {
        scene.remove(tile.mesh);
        // === PERFORMANCE: Don't dispose shared geometry ===
        (tile.mesh.material as THREE.Material).dispose();
        (tile.edges.material as THREE.Material).dispose();
        if (tile.rigidBody) {
            physicsSystem.destroyBody(`tile_${tile.q}_${tile.r}`);
        }
    });

    if (this.skybox) {
        scene.remove(this.skybox);
        if (this.skyboxGeometry) this.skyboxGeometry.dispose();
        if (this.skyboxMaterial) this.skyboxMaterial.dispose();
        this.skybox = null;
    }
    
    this.tiles = [];
  }
}
