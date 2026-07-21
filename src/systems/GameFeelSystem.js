import * as THREE from 'three';

const IMPACT_WORDS = ['BUMP!', 'BOUNCE!', 'BONK!', 'BOP!'];

/**
 * Presentation-only feedback. It never changes physics, so local, AI, and
 * authoritative online matches remain deterministic while still feeling alive.
 */
export class GameFeelSystem {
    constructor(layer = typeof document !== 'undefined' ? document.getElementById('game-feel-layer') : null) {
        this.layer = layer;
        this.shake = 0;
        this.shakeTime = 0;
        this.previousOffset = new THREE.Vector3();
        this.reducedMotion = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        this.lastImpactWord = -1;
    }

    beginFrame(camera) {
        if (!camera || this.previousOffset.lengthSq() === 0) return;
        camera.position.sub(this.previousOffset);
        this.previousOffset.set(0, 0, 0);
    }

    triggerImpact(position, camera, intensity = 1, boosted = false) {
        const strength = Math.min(1, Math.max(0.18, intensity / 5));
        if (!this.reducedMotion) {
            this.shake = Math.max(this.shake, (boosted ? 0.72 : 0.36) * strength);
            this.shakeTime = Math.max(this.shakeTime, boosted ? 0.24 : 0.15);
        }

        if (!this.layer || !camera) return;
        const projected = position.clone().project(camera);
        const x = Math.max(12, Math.min(88, (projected.x * 0.5 + 0.5) * 100));
        const y = Math.max(18, Math.min(80, (-projected.y * 0.5 + 0.5) * 100));
        this.lastImpactWord = (this.lastImpactWord + 1) % IMPACT_WORDS.length;

        const pop = document.createElement('div');
        pop.className = `game-feel-pop${boosted ? ' game-feel-pop--super' : ''}`;
        pop.style.left = `${x}%`;
        pop.style.top = `${y}%`;
        pop.style.setProperty('--pop-rotate', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
        pop.innerHTML = boosted
            ? '<small>BOOST HIT</small><strong>SUPER BUMP!</strong>'
            : `<strong>${IMPACT_WORDS[this.lastImpactWord]}</strong>`;
        this.layer.appendChild(pop);
        window.setTimeout(() => pop.remove(), this.reducedMotion ? 280 : 720);
    }

    finishFrame(camera, delta) {
        if (!camera || this.shakeTime <= 0 || this.reducedMotion) return;
        this.shakeTime = Math.max(0, this.shakeTime - delta);
        this.shake *= Math.exp(-delta * 12);
        const phase = performance.now() * 0.055;
        this.previousOffset.set(
            Math.sin(phase * 1.7) * this.shake,
            Math.cos(phase * 2.3) * this.shake * 0.46,
            Math.sin(phase * 1.1 + 1.8) * this.shake * 0.42,
        );
        camera.position.add(this.previousOffset);
    }

    reset(camera) {
        this.beginFrame(camera);
        this.shake = 0;
        this.shakeTime = 0;
        this.layer?.replaceChildren();
    }
}
