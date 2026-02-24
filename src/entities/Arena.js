import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createTileBody, world } from '../physics.js';
import { scene } from '../renderer.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { generateHexGrid, hexToPixel } from '../utils/math.js';
import { useGameStore } from '../store.js';

export class Arena {
    constructor() {
        this.tiles = [];
        this.dropTimer = 0;
        this.iceTimer = 0;

        const settings = useGameStore.getState().settings;
        this.arenaSize = settings.arenaSize;
        const theme = settings.theme || 'default';

        // 1. Generate Grid
        const hexes = generateHexGrid(this.arenaSize);

        // 2. Create Tiles
        const gridSpacing = 8.0;
        const tileRadius = gridSpacing * 1.0; // 100% size to make tiles perfectly flush
        const height = 4.0;

        const geometry = new THREE.CylinderGeometry(tileRadius, tileRadius, height, 6);
        
        const { tileMaterialParams } = getThemeMaterials(theme);
        const material = new THREE.MeshStandardMaterial(tileMaterialParams);

        // Edges Geometry for the glowing border
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        
        this.edgeColor = 0xff00ff; // Default Neon Pink
        this.baseColor = 0x666666; // Default Base Grey
        this.iceColor = 0x00ffff; // Default Cyan
        if (theme === 'beach') {
            this.edgeColor = 0x00ffff; // Cyan for beach
            this.baseColor = 0xffffff; // White base so texture shows
            this.iceColor = 0x0000ff; // Blue for ice in beach theme
        }
        if (theme === 'cracked_stone') {
            this.edgeColor = 0xff4400; // Orange for cracked stone
            this.baseColor = 0xffffff; // White base so texture shows
            this.iceColor = 0x00ffff; // Cyan for ice
        }

        hexes.forEach(hex => {
            const pos = hexToPixel(hex.q, hex.r, gridSpacing);
            const position = { x: pos.x, y: 0, z: pos.z };

            // Three.js Mesh (Outer Shell)
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.set(position.x, position.y, position.z);
            mesh.rotation.y = Math.PI / 6; // Rotate 30 degrees for flat-topped hex
            mesh.receiveShadow = true;
            
            // Glowing Edges
            const edgesMat = new THREE.LineBasicMaterial({ 
                color: this.edgeColor,
                linewidth: 8, // Thicker borders
                transparent: true,
                opacity: 1.0 // Brighter borders
            });
            const edges = new THREE.LineSegments(edgesGeometry, edgesMat);
            mesh.add(edges);
            
            // Core Light (Subtle glow from within)
            const light = new THREE.PointLight(this.edgeColor, 3.0, 15); // Brighter light
            light.position.y = 2;
            mesh.add(light);

            scene.add(mesh);

            // Rapier Rigid Body
            const { rigidBody, collider } = createTileBody(position, tileRadius, height);
            this.tiles.push({
                q: hex.q,
                r: hex.r,
                mesh,
                edges,
                light,
                rigidBody,
                collider,
                state: 'NORMAL', // 'NORMAL', 'WARNING', 'FALLING', 'ICE'
                timer: 0
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
        }

        const settings = storeState.settings;

        // 1. Handle The Drop
        if (this.dropTimer >= settings.destructionRate) {
            this.dropTimer = 0;
            this.triggerDrop();
        }

        // 2. Handle Ice Tiles
        if (this.iceTimer >= settings.iceRate) {
            this.iceTimer = 0;
            this.triggerIce();
        }

        // 3. Update Tile States and Pulse
        const time = Date.now() * 0.001;
        const bpm = 135;
        const beatFreq = bpm / 60; // 2.25 Hz

        this.tiles.forEach(tile => {
            // Pulse effect based on distance from center
            const dist = Math.sqrt(tile.mesh.position.x ** 2 + tile.mesh.position.z ** 2);
            const pulse = (Math.sin(time * Math.PI * 2 * beatFreq - dist * 0.2) + 1) / 2; // 0 to 1

            if (tile.state === 'NORMAL') {
                tile.edges.material.opacity = 0.7 + pulse * 0.3; // Higher base opacity
                tile.light.intensity = 2.0 + pulse * 2.0; // Brighter pulse
                tile.mesh.material.color.setHex(this.baseColor); // Base color
            }

            if (tile.state === 'WARNING') {
                tile.timer -= delta;
                // Flash red
                const isFlash = Math.sin(tile.timer * 10) > 0;
                const colorHex = isFlash ? 0xff0000 : this.edgeColor;
                tile.edges.material.color.setHex(colorHex);
                tile.edges.material.opacity = 1.0;
                tile.light.color.setHex(colorHex);
                tile.light.intensity = 4.0;
                tile.mesh.material.color.setHex(colorHex); // Flash the whole tile

                if (tile.timer <= 0) {
                    // Convert to falling
                    tile.state = 'FALLING';
                    tile.rigidBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                    
                    // Reset to magma
                    tile.edges.material.color.setHex(0xff2200);
                    tile.edges.material.opacity = 1.0;
                    tile.light.color.setHex(0xff2200);
                    tile.light.intensity = 3.0;
                    tile.mesh.material.color.setHex(0xff2200); // Magma color

                    // Reduce size by 5% to prevent snagging while falling
                    tile.mesh.scale.set(0.95, 1, 0.95);
                }
            } else if (tile.state === 'ICE') {
                tile.timer -= delta;
                tile.edges.material.opacity = 0.8 + pulse * 0.2;
                tile.light.intensity = 2.0 + pulse * 2.0;
                tile.mesh.material.color.setHex(this.iceColor); // Ice color

                if (tile.timer <= 0) {
                    // Revert to normal
                    tile.state = 'NORMAL';
                    tile.collider.setFriction(0.0); // Keep friction 0 to prevent sticking
                    
                    tile.edges.material.color.setHex(this.edgeColor);
                    tile.light.color.setHex(this.edgeColor);
                    tile.mesh.material.color.setHex(this.baseColor); // Revert to base color
                }
            } else if (tile.state === 'FALLING') {
                // Sync mesh with physics
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

        // Select 5 random tiles
        for (let i = 0; i < 5 && stableTiles.length > 0; i++) {
            const index = Math.floor(Math.random() * stableTiles.length);
            const tile = stableTiles.splice(index, 1)[0];
            tile.state = 'WARNING';
            tile.timer = 3.0; // 3 seconds warning
        }
    }

    triggerIce() {
        const stableTiles = this.tiles.filter(t => t.state === 'NORMAL');
        if (stableTiles.length === 0) return;

        const index = Math.floor(Math.random() * stableTiles.length);
        const tile = stableTiles[index];

        tile.state = 'ICE';
        tile.timer = 5.0; // 5 seconds duration
        tile.collider.setFriction(0.0); // Keep friction 0
        
        // Visuals
        tile.edges.material.color.setHex(this.iceColor);
        tile.light.color.setHex(this.iceColor);
        tile.mesh.material.color.setHex(this.iceColor);
    }

    cleanup() {
        this.tiles.forEach(tile => {
            scene.remove(tile.mesh);
            tile.mesh.material.dispose();
            tile.edges.material.dispose();
            if (world && tile.rigidBody) {
                world.removeRigidBody(tile.rigidBody);
            }
        });
        
        // Dispose shared geometries
        if (this.tiles.length > 0) {
            this.tiles[0].mesh.geometry.dispose();
            this.tiles[0].edges.geometry.dispose();
        }
    }
}
