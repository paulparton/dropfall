/**
 * SDF Effects System
 * Advanced visual effects using SDF ray-marching
 * Includes particles, lightning, shockwaves, and procedural animations
 */

import * as THREE from 'three';

/**
 * Particle Effect Manager
 */
export class ParticleSystem {
    constructor(maxParticles = 10000) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.pool = [];
        
        // Initialize particle pool
        for (let i = 0; i < maxParticles; i++) {
            this.pool.push(this.createParticleTemplate());
        }
    }
    
    createParticleTemplate() {
        return {
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            acceleration: new THREE.Vector3(0, -9.8, 0),
            life: 0,
            maxLife: 1,
            size: 0.5,
            color: 0xffffff,
            trail: [],
            emission: null
        };
    }
    
    emit(position, direction, speed, count = 10, options = {}) {
        const {
            color = 0xffffff,
            lifespan = 1.0,
            spread = Math.PI * 2,
            sizeRange = { min: 0.3, max: 0.7 },
            speedVariation = 0.2
        } = options;
        
        for (let i = 0; i < count; i++) {
            if (this.pool.length === 0) break;
            
            const particle = this.pool.pop();
            particle.position.copy(position);
            
            // Random spread angle
            const angle = Math.random() * spread - spread / 2;
            const tilt = Math.random() * spread - spread / 2;
            
            // Direction with spread
            const vel = new THREE.Vector3()
                .copy(direction)
                .applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
                .normalize()
                .multiplyScalar(speed * (1 - speedVariation + Math.random() * speedVariation * 2));
            
            particle.velocity.copy(vel);
            particle.life = 0;
            particle.maxLife = lifespan;
            particle.color = color;
            particle.size = sizeRange.min + Math.random() * (sizeRange.max - sizeRange.min);
            particle.trail = [];
            
            this.particles.push(particle);
        }
    }
    
    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Update physics
            p.velocity.y += p.acceleration.y * deltaTime;
            p.position.add(new THREE.Vector3().copy(p.velocity).multiplyScalar(deltaTime));
            
            p.life += deltaTime;
            
            // Record trail
            p.trail.push(new THREE.Vector3().copy(p.position));
            if (p.trail.length > 10) {
                p.trail.shift();
            }
            
            // Remove dead particles
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                this.pool.push(p);
            }
        }
    }
    
    getParticles() {
        return this.particles;
    }
}

/**
 * Lightning Effect
 */
export class LightningEffect {
    constructor() {
        this.bolts = [];
    }
    
    createBolt(from, to, width = 0.2, forkCount = 3) {
        const bolt = {
            from,
            to,
            width,
            segments: this.generateLightningSegments(from, to, 5),
            forks: [],
            life: 0.15,
            maxLife: 0.15,
            intensity: 1.0,
            color: 0x00ffff
        };
        
        // Create forks
        for (let i = 0; i < forkCount; i++) {
            const segmentIndex = Math.floor(Math.random() * bolt.segments.length);
            const segment = bolt.segments[segmentIndex];
            const forkLength = bolt.from.distanceTo(bolt.to) * (Math.random() * 0.5 + 0.3);
            const randomDir = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();
            
            bolt.forks.push({
                start: segment,
                direction: randomDir,
                length: forkLength,
                segments: this.generateLightningSegments(
                    segment,
                    segment.clone().add(randomDir.clone().multiplyScalar(forkLength)),
                    3
                )
            });
        }
        
        this.bolts.push(bolt);
        return bolt;
    }
    
    generateLightningSegments(from, to, divisions = 5) {
        const segments = [from.clone()];
        const direction = new THREE.Vector3().subVectors(to, from);
        const length = direction.length();
        const segmentLength = length / divisions;
        
        for (let i = 1; i < divisions; i++) {
            const point = from.clone().add(direction.clone().normalize().multiplyScalar(segmentLength * i));
            
            // Add random displacement (fractal-like)
            const displacement = new THREE.Vector3(
                (Math.random() - 0.5) * segmentLength * 0.3,
                (Math.random() - 0.5) * segmentLength * 0.3,
                (Math.random() - 0.5) * segmentLength * 0.3
            );
            
            point.add(displacement);
            segments.push(point);
        }
        
        segments.push(to.clone());
        return segments;
    }
    
    update(deltaTime) {
        this.bolts = this.bolts.filter(bolt => {
            bolt.life -= deltaTime;
            bolt.intensity = Math.max(0, bolt.life / bolt.maxLife);
            return bolt.life > 0;
        });
    }
    
    getBolts() {
        return this.bolts;
    }
}

/**
 * Shockwave Effect
 */
export class ShockwaveEffect {
    constructor() {
        this.waves = [];
    }
    
    createShockwave(center, maxRadius = 10, duration = 0.5, intensity = 1.0) {
        this.waves.push({
            center: center.clone(),
            currentRadius: 0,
            maxRadius,
            duration,
            life: 0,
            intensity,
            speed: maxRadius / duration
        });
    }
    
    update(deltaTime) {
        this.waves = this.waves.filter(wave => {
            wave.life += deltaTime;
            wave.currentRadius = wave.speed * wave.life;
            return wave.life < wave.duration;
        });
    }
    
    getWaves() {
        return this.waves;
    }
}

/**
 * Impact Ring Effect
 */
export class ImpactRingEffect {
    constructor() {
        this.rings = [];
    }
    
    createRing(center, color = 0xff0000, duration = 0.3) {
        this.rings.push({
            center: center.clone(),
            color,
            startRadius: 0.5,
            maxRadius: 3,
            life: 0,
            duration,
            thickness: 0.3
        });
    }
    
    update(deltaTime) {
        this.rings = this.rings.filter(ring => {
            ring.life += deltaTime;
            return ring.life < ring.duration;
        });
    }
    
    getRings() {
        return this.rings;
    }
}

/**
 * Screen Shake Effect
 */
export class ScreenShakeEffect {
    constructor() {
        this.shakes = [];
        this.cumulativeShake = new THREE.Vector3();
    }
    
    addShake(intensity = 1.0, frequency = 20, duration = 0.5) {
        this.shakes.push({
            intensity,
            frequency,
            duration,
            life: 0,
            phase: Math.random() * Math.PI * 2
        });
    }
    
    update(deltaTime) {
        this.cumulativeShake.set(0, 0, 0);
        
        this.shakes = this.shakes.filter(shake => {
            shake.life += deltaTime;
            
            if (shake.life < shake.duration) {
                // Perlin-like noise simulation
                const time = shake.life * shake.frequency;
                const x = Math.sin(time + shake.phase) * shake.intensity;
                const y = Math.cos(time * 0.7 + shake.phase) * shake.intensity;
                const z = Math.sin(time * 0.5 + shake.phase) * shake.intensity;
                
                // Fade out over duration
                const fadeout = 1 - (shake.life / shake.duration);
                this.cumulativeShake.add(new THREE.Vector3(x, y, z).multiplyScalar(fadeout));
                
                return true;
            }
            
            return false;
        });
    }
    
    getShake() {
        return this.cumulativeShake;
    }
}

/**
 * Bloom Pulse Effect
 */
export class BloomPulseEffect {
    constructor() {
        this.pulses = [];
    }
    
    createPulse(intensity = 1.0, duration = 0.3) {
        this.pulses.push({
            intensity,
            duration,
            life: 0
        });
    }
    
    update(deltaTime) {
        this.pulses = this.pulses.filter(pulse => {
            pulse.life += deltaTime;
            return pulse.life < pulse.duration;
        });
    }
    
    getBloomIntensity() {
        let totalIntensity = 0;
        this.pulses.forEach(pulse => {
            const t = pulse.life / pulse.duration;
            const factor = Math.sin(t * Math.PI); // Bell curve
            totalIntensity += pulse.intensity * factor;
        });
        return Math.min(1.0, totalIntensity);
    }
}

/**
 * Holographic Glitch Effect
 */
export class GlitchEffect {
    constructor() {
        this.glitches = [];
    }
    
    createGlitch(intensity = 0.5, duration = 0.2) {
        this.glitches.push({
            intensity,
            duration,
            life: 0,
            seed: Math.random()
        });
    }
    
    update(deltaTime) {
        this.glitches = this.glitches.filter(glitch => {
            glitch.life += deltaTime;
            return glitch.life < glitch.duration;
        });
    }
    
    getGlitchIntensity() {
        let maxIntensity = 0;
        this.glitches.forEach(glitch => {
            const t = glitch.life / glitch.duration;
            maxIntensity = Math.max(maxIntensity, glitch.intensity * (1 - t));
        });
        return maxIntensity;
    }
}

/**
 * Color Flash Effect
 */
export class ColorFlashEffect {
    constructor() {
        this.flashes = [];
    }
    
    createFlash(color = 0xffffff, intensity = 1.0, duration = 0.2) {
        this.flashes.push({
            color,
            intensity,
            duration,
            life: 0
        });
    }
    
    update(deltaTime) {
        this.flashes = this.flashes.filter(flash => {
            flash.life += deltaTime;
            return flash.life < flash.duration;
        });
    }
    
    getFlash() {
        if (this.flashes.length === 0) {
            return { color: 0xffffff, intensity: 0 };
        }
        
        // Return the strongest flash
        return this.flashes.reduce((strongest, flash) => {
            const flashFadeout = 1 - (flash.life / flash.duration);
            const strongestFadeout = 1 - (strongest.life / strongest.duration);
            
            return flash.intensity * flashFadeout > strongest.intensity * strongestFadeout 
                ? flash 
                : strongest;
        });
    }
}

/**
 * Complete Effects Manager
 */
export class EffectsManager {
    constructor() {
        this.particles = new ParticleSystem(10000);
        this.lightning = new LightningEffect();
        this.shockwaves = new ShockwaveEffect();
        this.impactRings = new ImpactRingEffect();
        this.screenShake = new ScreenShakeEffect();
        this.bloomPulse = new BloomPulseEffect();
        this.glitch = new GlitchEffect();
        this.colorFlash = new ColorFlashEffect();
    }
    
    update(deltaTime) {
        this.particles.update(deltaTime);
        this.lightning.update(deltaTime);
        this.shockwaves.update(deltaTime);
        this.impactRings.update(deltaTime);
        this.screenShake.update(deltaTime);
        this.bloomPulse.update(deltaTime);
        this.glitch.update(deltaTime);
        this.colorFlash.update(deltaTime);
    }
    
    /**
     * Create collision effect
     */
    createCollisionEffect(position, intensity = 1.0) {
        // Particles
        this.particles.emit(
            position,
            new THREE.Vector3(0, 1, 0),
            10,
            20,
            { color: 0xff6600, lifespan: 0.8 }
        );
        
        // Impact ring
        this.impactRings.createRing(position, 0xff6600, 0.3);
        
        // Screen shake
        this.screenShake.addShake(intensity * 0.5, 15, 0.3);
        
        // Bloom pulse
        this.bloomPulse.createPulse(intensity * 0.3, 0.2);
        
        // Color flash
        this.colorFlash.createFlash(0xff6600, intensity * 0.2, 0.15);
    }
    
    /**
     * Create explosion effect
     */
    createExplosionEffect(position, intensity = 1.0) {
        // Explosive particle burst
        const directions = [
            new THREE.Vector3(1, 1, 0),
            new THREE.Vector3(-1, 1, 0),
            new THREE.Vector3(0, 1, 1),
            new THREE.Vector3(0, 1, -1),
            new THREE.Vector3(1, 0.5, 1),
            new THREE.Vector3(-1, 0.5, -1)
        ];
        
        directions.forEach(dir => {
            this.particles.emit(
                position,
                dir.normalize(),
                20,
                15,
                { color: 0xff4400, lifespan: 1.0, speedVariation: 0.3 }
            );
        });
        
        // Shockwave
        this.shockwaves.createShockwave(position, 10, 0.5, intensity);
        
        // Screen shake
        this.screenShake.addShake(intensity, 20, 0.4);
        
        // Bloom pulse
        this.bloomPulse.createPulse(intensity * 0.5, 0.3);
    }
    
    /**
     * Create teleport effect
     */
    createTeleportEffect(position) {
        // Portal spiral
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dir = new THREE.Vector3(
                Math.cos(angle),
                0.5,
                Math.sin(angle)
            );
            
            this.particles.emit(
                position,
                dir,
                5,
                10,
                { color: 0x00ffff, lifespan: 0.5 }
            );
        }
        
        // Lightning burst
        for (let i = 0; i < 3; i++) {
            const randomPos = position.clone().add(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                )
            );
            
            this.lightning.createBolt(position, randomPos, 0.1, 0);
        }
        
        // Bloom pulse
        this.bloomPulse.createPulse(0.4, 0.2);
    }
    
    /**
     * Create freeze effect
     */
    createFreezeEffect(position) {
        // Icy particles
        this.particles.emit(
            position,
            new THREE.Vector3(0, 1, 0),
            3,
            15,
            { color: 0x0099ff, lifespan: 1.2 }
        );
        
        // Glitch effect
        this.glitch.createGlitch(0.3, 0.4);
        
        // Color flash (blue)
        this.colorFlash.createFlash(0x0099ff, 0.3, 0.2);
    }
    
    /**
     * Create power-up effect
     */
    createPowerUpEffect(position, powerUpType = 'generic') {
        const colorMap = {
            'speed': 0xff6600,
            'heavy': 0x8800ff,
            'size': 0xffff00,
            'freeze': 0x00ffff,
            'generic': 0x00ff00
        };
        
        const color = colorMap[powerUpType] || colorMap['generic'];
        
        // Rising particles
        this.particles.emit(
            position,
            new THREE.Vector3(0, 1, 0),
            5,
            20,
            { color, lifespan: 1.0, spread: Math.PI * 0.5 }
        );
        
        // Impact ring
        this.impactRings.createRing(position, color, 0.4);
        
        // Bloom pulse
        this.bloomPulse.createPulse(0.5, 0.3);
    }
    
    /**
     * Get all effect data for rendering
     */
    getAllEffects() {
        return {
            particles: this.particles.getParticles(),
            lightning: this.lightning.getBolts(),
            shockwaves: this.shockwaves.getWaves(),
            impactRings: this.impactRings.getRings(),
            screenShake: this.screenShake.getShake(),
            bloomIntensity: this.bloomPulse.getBloomIntensity(),
            glitchIntensity: this.glitch.getGlitchIntensity(),
            colorFlash: this.colorFlash.getFlash()
        };
    }
}
