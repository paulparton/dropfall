/**
 * LightningSystem - TypeScript Migration
 *
 * Lightning strike effect system with branching bolts.
 */

import * as THREE from 'three';
import { scene } from '../renderer';
import { useGameStore } from '../store';
import { EntityBase } from './Entity.base';
import type { GameContext } from '../types/Entity';

/**
 * Lightning bolt data structure
 */
export interface LightningBolt {
    coreMesh: THREE.Line;
    glowMesh: THREE.Line;
    life: number;
    maxLife: number;
}

/**
 * LightningSystem - Creates lightning strike effects
 */
export class LightningSystem extends EntityBase {
    type: 'lightning' = 'lightning';
    
    private strikes: LightningBolt[] = [];
    
    // Three.js materials
    private coreMaterial: THREE.LineBasicMaterial;
    private glowMaterial: THREE.LineBasicMaterial;

    constructor() {
        super('lightning', 'lightning', { x: 0, y: 0 });
        
        // Core material (bright white)
        this.coreMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            linewidth: 2
        });

        // Glow material (colored, thicker, lower opacity)
        this.glowMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff, // Cyan glow
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            linewidth: 6
        });
    }

    async initialize(context: GameContext): Promise<void> {
        await super.initialize(context);
    }

    emit(position: THREE.Vector3, intensity: number = 1): void {
        const particleAmount = useGameStore.getState().settings.particleAmount ?? 1.0;
        if (particleAmount === 0) return;

        // PERFORMANCE: Reduce number of strikes significantly
        let numStrikes = Math.min(2, Math.ceil(intensity * particleAmount));
        if (numStrikes < 1) {
            if (Math.random() > numStrikes) return;
            numStrikes = 1;
        }
        
        for (let s = 0; s < numStrikes; s++) {
            this.createStrike(position, intensity, true);
            
            // PERFORMANCE: Fewer branches
            const numBranches = 1 + Math.floor(Math.random() * 2);
            for (let b = 0; b < numBranches; b++) {
                this.createStrike(position, intensity * 0.5, false);
            }
        }
    }

    private createStrike(targetPosition: THREE.Vector3, intensity: number, isMain: boolean): void {
        const points: THREE.Vector3[] = [];
        
        // Start high up, spread out more if not main
        const startSpread = isMain ? 20 : 40;
        let currentPoint = new THREE.Vector3(
            targetPosition.x + (Math.random() - 0.5) * startSpread * intensity,
            100 + (Math.random() * 50),
            targetPosition.z + (Math.random() - 0.5) * startSpread * intensity
        );
        
        const startY = currentPoint.y;
        points.push(currentPoint.clone());
        
        // PERFORMANCE: Fewer segments for faster geometry creation
        const segments = isMain ? 8 + Math.floor(intensity * 2) : 5 + Math.floor(intensity);
        
        for (let i = 0; i < segments; i++) {
            const progress = (i + 1) / segments;
            
            // Interpolate towards target
            const targetY = startY - (startY - targetPosition.y) * progress;
            const targetX = currentPoint.x + (targetPosition.x - currentPoint.x) * progress;
            const targetZ = currentPoint.z + (targetPosition.z - currentPoint.z) * progress;
            
            // Add jitter based on intensity
            const jitter = isMain ? 15 * intensity : 25 * intensity;
            currentPoint.set(
                targetX + (Math.random() - 0.5) * jitter,
                targetY,
                targetZ + (Math.random() - 0.5) * jitter
            );
            
            points.push(currentPoint.clone());
        }
        
        // Ensure it hits the target
        points.push(targetPosition.clone());

        // PERFORMANCE: Use LineSegments instead of TubeGeometry
        const coreGeo = new THREE.BufferGeometry().setFromPoints(points);
        const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
        
        // Create core line
        const coreLine = new THREE.Line(coreGeo, new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            linewidth: 2,
            blending: THREE.AdditiveBlending
        }));
        scene.add(coreLine);
        
        // Create glow line
        const colors = [0x00ffff, 0xff00ff, 0x88ccff];
        const glowLine = new THREE.Line(glowGeo, new THREE.LineBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)]!,
            transparent: true,
            opacity: 0.6,
            linewidth: 4,
            blending: THREE.AdditiveBlending
        }));
        scene.add(glowLine);
        
        this.strikes.push({
            coreMesh: coreLine,
            glowMesh: glowLine,
            life: 0.15 + (intensity * 0.1),
            maxLife: 0.15 + (intensity * 0.1)
        });
    }

    update(deltaTime: number, context: GameContext): void {
        super.update(deltaTime, context);
        this.updateStrikes(deltaTime);
    }

    // Backward compatible update method
    updateStrikes(delta: number): void {
        for (let i = this.strikes.length - 1; i >= 0; i--) {
            const strike = this.strikes[i];
            if (!strike) continue;
            
            strike.life -= delta;
            
            if (strike.life <= 0) {
                scene.remove(strike.coreMesh);
                scene.remove(strike.glowMesh);
                strike.coreMesh.geometry.dispose();
                strike.glowMesh.geometry.dispose();
                (strike.coreMesh.material as THREE.Material).dispose();
                (strike.glowMesh.material as THREE.Material).dispose();
                this.strikes.splice(i, 1);
            } else {
                // Flicker effect and fade out
                const progress = strike.life / strike.maxLife;
                const flicker = Math.random() > 0.2 ? 1 : 0;
                
                (strike.coreMesh.material as THREE.LineBasicMaterial).opacity = progress * flicker;
                (strike.glowMesh.material as THREE.LineBasicMaterial).opacity = progress * 0.6 * flicker;
            }
        }
    }

    async destroy(): Promise<void> {
        await super.destroy();
        this.cleanup();
    }

    cleanup(): void {
        this.strikes.forEach(strike => {
            if (!strike) return;
            scene.remove(strike.coreMesh);
            scene.remove(strike.glowMesh);
            strike.coreMesh.geometry.dispose();
            strike.glowMesh.geometry.dispose();
            (strike.coreMesh.material as THREE.Material).dispose();
            (strike.glowMesh.material as THREE.Material).dispose();
        });
        this.strikes = [];
    }
}
