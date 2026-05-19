/**
 * ShockwaveSystem - TypeScript Migration
 *
 * Expanding ring shockwave effect system.
 */

import * as THREE from 'three';
import { scene } from '../renderer';
import { useGameStore } from '../store';
import { EntityBase } from './Entity.base';
import type { GameContext } from '../types/Entity';

/**
 * Shockwave data structure
 */
export interface Shockwave {
    mesh: THREE.Mesh;
    life: number;
    maxLife: number;
    maxScale: number;
}

/**
 * ShockwaveSystem - Creates expanding ring shockwave effects
 */
export class ShockwaveSystem extends EntityBase {
    type: 'shockwave' = 'shockwave';
    
    private shockwaves: Shockwave[] = [];
    
    // Three.js objects
    private baseGeometry: THREE.RingGeometry;
    private baseMaterial: THREE.MeshBasicMaterial;

    constructor() {
        super('shockwaves', 'shockwave', { x: 0, y: 0 });
        
        // PERFORMANCE: Create one shared geometry
        this.baseGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
        
        // PERFORMANCE: Create base material - will be cloned minimally
        this.baseMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    async initialize(context: GameContext): Promise<void> {
        await super.initialize(context);
    }

    emit(position: THREE.Vector3, colorHex: number, intensity: number = 1): void {
        const particleAmount = useGameStore.getState().settings.particleAmount ?? 1.0;
        if (particleAmount === 0) return;

        // PERFORMANCE: Clone material only when needed
        const material = this.baseMaterial.clone();
        material.color.setHex(colorHex);
        
        const mesh = new THREE.Mesh(this.baseGeometry, material);
        mesh.position.copy(position);
        mesh.position.y += 0.1;
        mesh.rotation.x = -Math.PI / 2;
        
        scene.add(mesh);
        
        this.shockwaves.push({
            mesh: mesh,
            life: 0,
            maxLife: 0.5 + (intensity * 0.1),
            maxScale: 5 + (intensity * 5)
        });
    }

    update(deltaTime: number, context: GameContext): void {
        super.update(deltaTime, context);
        this.updateShockwaves(deltaTime);
    }

    // Backward compatible update method
    updateShockwaves(delta: number): void {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.shockwaves[i];
            if (!wave) continue;
            
            wave.life += delta;
            
            if (wave.life >= wave.maxLife) {
                scene.remove(wave.mesh);
                (wave.mesh.material as THREE.Material).dispose();
                this.shockwaves.splice(i, 1);
            } else {
                const progress = wave.life / wave.maxLife;
                
                // Expand
                const currentScale = 1 + (wave.maxScale - 1) * Math.pow(progress, 0.5);
                wave.mesh.scale.set(currentScale, currentScale, 1);
                
                // Fade out
                (wave.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - Math.pow(progress, 2.0);
            }
        }
    }

    async destroy(): Promise<void> {
        await super.destroy();
        this.cleanup();
    }

    cleanup(): void {
        this.shockwaves.forEach(wave => {
            if (!wave) return;
            scene.remove(wave.mesh);
            (wave.mesh.material as THREE.Material).dispose();
        });
        this.shockwaves = [];
        this.baseGeometry.dispose();
        this.baseMaterial.dispose();
    }
}
