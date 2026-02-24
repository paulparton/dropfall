import * as THREE from 'three';
import { scene } from '../renderer.js';
import { useGameStore } from '../store.js';

export class ShockwaveSystem {
    constructor() {
        this.shockwaves = [];
        
        // Create a ring geometry
        const geometry = new THREE.RingGeometry(0.9, 1.0, 32);
        
        this.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.baseGeometry = geometry;
    }

    emit(position, colorHex, intensity = 1) {
        const particleAmount = useGameStore.getState().settings.particleAmount ?? 1.0;
        if (particleAmount === 0) return;

        const mesh = new THREE.Mesh(this.baseGeometry, this.material.clone());
        mesh.position.copy(position);
        mesh.position.y += 0.1; // Slightly above ground
        mesh.rotation.x = -Math.PI / 2; // Flat on ground
        
        mesh.material.color.setHex(colorHex);
        
        scene.add(mesh);
        
        this.shockwaves.push({
            mesh: mesh,
            life: 0,
            maxLife: 0.5 + (intensity * 0.1),
            maxScale: 5 + (intensity * 5)
        });
    }

    update(delta) {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.shockwaves[i];
            wave.life += delta;
            
            if (wave.life >= wave.maxLife) {
                scene.remove(wave.mesh);
                wave.mesh.material.dispose();
                this.shockwaves.splice(i, 1);
            } else {
                const progress = wave.life / wave.maxLife;
                
                // Expand
                const currentScale = 1 + (wave.maxScale - 1) * Math.pow(progress, 0.5); // Fast start, slow end
                wave.mesh.scale.set(currentScale, currentScale, 1);
                
                // Fade out
                wave.mesh.material.opacity = 1.0 - Math.pow(progress, 2.0); // Slow fade start, fast fade end
            }
        }
    }

    cleanup() {
        this.shockwaves.forEach(wave => {
            scene.remove(wave.mesh);
            wave.mesh.material.dispose();
        });
        this.shockwaves = [];
        this.baseGeometry.dispose();
        this.material.dispose();
    }
}
