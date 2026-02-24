import * as THREE from 'three';
import { scene } from '../renderer.js';
import { useGameStore } from '../store.js';

export class LightningSystem {
    constructor() {
        this.strikes = [];
        
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

    emit(position, intensity = 1) {
        const particleAmount = useGameStore.getState().settings.particleAmount ?? 1.0;
        if (particleAmount === 0) return;

        let numStrikes = intensity * particleAmount * 2; // More strikes
        if (numStrikes < 1) {
            if (Math.random() > numStrikes) return;
            numStrikes = 1;
        } else {
            numStrikes = Math.floor(numStrikes);
        }
        
        for (let s = 0; s < numStrikes; s++) {
            this.createStrike(position, intensity, true);
            
            // Create smaller branches (more forks)
            const numBranches = 2 + Math.floor(Math.random() * 3);
            for (let b = 0; b < numBranches; b++) {
                this.createStrike(position, intensity * 0.5, false);
            }
        }
    }

    createStrike(targetPosition, intensity, isMain) {
        const points = [];
        
        // Start high up, spread out more if not main
        const startSpread = isMain ? 20 : 40;
        let currentPoint = new THREE.Vector3(
            targetPosition.x + (Math.random() - 0.5) * startSpread * intensity,
            100 + (Math.random() * 50), // Start high up
            targetPosition.z + (Math.random() - 0.5) * startSpread * intensity
        );
        
        const startY = currentPoint.y;
        points.push(currentPoint.clone());
        
        const segments = isMain ? 15 + Math.floor(intensity * 3) : 8 + Math.floor(intensity * 2);
        
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

        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
        const coreGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.1, 4, false); // Even thinner core
        const glowGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.4, 4, false); // Even thinner glow
        
        // Create core mesh
        const coreLine = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        }));
        // Multiply color by a large factor to force bloom
        coreLine.material.color.multiplyScalar(5.0);
        scene.add(coreLine);
        
        // Create glow mesh
        const colors = [0x00ffff, 0xff00ff, 0x88ccff];
        const glowLine = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            transparent: true,
            opacity: 0.8, // Increased opacity
            blending: THREE.AdditiveBlending
        }));
        // Multiply color by a large factor to force bloom
        glowLine.material.color.multiplyScalar(3.0);
        scene.add(glowLine);
        
        this.strikes.push({
            coreMesh: coreLine,
            glowMesh: glowLine,
            life: 0.2 + (intensity * 0.15), // Lasts longer if more intense
            maxLife: 0.2 + (intensity * 0.15)
        });
    }

    update(delta) {
        for (let i = this.strikes.length - 1; i >= 0; i--) {
            const strike = this.strikes[i];
            strike.life -= delta;
            
            if (strike.life <= 0) {
                scene.remove(strike.coreMesh);
                scene.remove(strike.glowMesh);
                strike.coreMesh.geometry.dispose();
                strike.glowMesh.geometry.dispose();
                strike.coreMesh.material.dispose();
                strike.glowMesh.material.dispose();
                this.strikes.splice(i, 1);
            } else {
                // Flicker effect and fade out
                const progress = strike.life / strike.maxLife;
                const flicker = Math.random() > 0.2 ? 1 : 0;
                
                strike.coreMesh.material.opacity = progress * flicker;
                strike.glowMesh.material.opacity = progress * 0.6 * flicker;
            }
        }
    }

    cleanup() {
        this.strikes.forEach(strike => {
            scene.remove(strike.coreMesh);
            scene.remove(strike.glowMesh);
            strike.coreMesh.geometry.dispose();
            strike.glowMesh.geometry.dispose();
            strike.coreMesh.material.dispose();
            strike.glowMesh.material.dispose();
        });
        this.strikes = [];
    }
}
