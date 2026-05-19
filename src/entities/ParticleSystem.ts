/**
 * ParticleSystem - TypeScript Migration
 *
 * GPU-accelerated particle system using BufferGeometry and custom shaders.
 */

import * as THREE from 'three';
import { scene } from '../renderer';
import { useGameStore } from '../store';
import { EntityBase } from './Entity.base';
import type { GameContext } from '../types/Entity';

function isMobileDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent) 
        || window.innerWidth < 768;
}

const particleVertexShader = `
    attribute float size;
    attribute vec3 customColor;
    attribute float lifetime;
    varying vec3 vColor;
    varying float vLifetime;
    void main() {
        vColor = customColor;
        vLifetime = lifetime;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Size attenuation
        gl_PointSize = size * (300.0 / -mvPosition.z) * max(0.0, lifetime);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const particleFragmentShader = `
    varying vec3 vColor;
    varying float vLifetime;
    void main() {
        if (vLifetime <= 0.0) discard;
        
        // Create a soft circle
        vec2 xy = gl_PointCoord.xy - vec2(0.5);
        float ll = length(xy);
        if (ll > 0.5) discard;
        
        // Glow effect
        float alpha = (0.5 - ll) * 1.0 * vLifetime; // Reduced alpha for subtlety
        
        // Core is white, edges are colored
        vec3 finalColor = mix(vColor, vec3(1.0), pow(1.0 - ll * 2.0, 3.0));
        
        gl_FragColor = vec4(finalColor, alpha * 0.5); // Removed * 2.0 for bloom, reduced alpha
    }
`;

/**
 * Particle data structure (for reference, actual data stored in buffers)
 */
export interface Particle {
    index: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    color: THREE.Color;
    life: number;
    maxLife: number;
    size: number;
}

/**
 * ParticleSystem - GPU-accelerated particle emitter
 */
export class ParticleSystem extends EntityBase {
    type: 'particle' = 'particle';
    
    private particleCount: number = 0;
    private maxParticles: number;
    
    // Three.js objects
    private geometry!: THREE.BufferGeometry;
    private material!: THREE.ShaderMaterial;
    mesh!: THREE.Points;
    
    // Buffer arrays
    private positions: Float32Array;
    private colors: Float32Array;
    private velocities: Float32Array;
    private lifetimes: Float32Array;
    private sizes: Float32Array;

    constructor(maxParticles: number = 5000) {
        super('particles', 'particle', { x: 0, y: 0 });
        
        const isMobile = isMobileDevice();
        
        // Reduce particle count on mobile
        if (isMobile) {
            this.maxParticles = Math.min(maxParticles, 1000);
        } else {
            this.maxParticles = maxParticles;
        }
        
        this.particleCount = 0;

        // 1. Geometry
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.velocities = new Float32Array(this.maxParticles * 3);
        this.lifetimes = new Float32Array(this.maxParticles);
        this.sizes = new Float32Array(this.maxParticles);

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('customColor', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('lifetime', new THREE.BufferAttribute(this.lifetimes, 1));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        // 2. Material
        this.material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true
        });

        // 3. Mesh
        this.mesh = new THREE.Points(this.geometry, this.material);
        scene.add(this.mesh);
    }

    async initialize(context: GameContext): Promise<void> {
        await super.initialize(context);
    }

    emit(
        position: { x: number; y: number; z: number }, 
        velocity: { x: number; y: number; z: number }, 
        colorHex: number, 
        count: number = 10
    ): void {
        const particleAmount = useGameStore.getState().settings.particleAmount ?? 1.0;
        if (particleAmount === 0) return;

        let actualCount = count * particleAmount;
        if (actualCount < 1) {
            if (Math.random() > actualCount) return;
            actualCount = 1;
        } else {
            actualCount = Math.floor(actualCount);
        }

        const color = new THREE.Color(colorHex);

        for (let i = 0; i < actualCount; i++) {
            if (this.particleCount >= this.maxParticles) {
                // Overwrite oldest particles if full
                this.particleCount = 0; 
            }

            const index = this.particleCount * 3;

            // Position
            this.positions[index] = position.x + (Math.random() - 0.5) * 1.0;
            this.positions[index + 1] = position.y + (Math.random() - 0.5) * 1.0;
            this.positions[index + 2] = position.z + (Math.random() - 0.5) * 1.0;

            // Velocity (more explosive)
            const speedMultiplier = 1.0 + Math.random() * 2.0;
            this.velocities[index] = velocity.x * speedMultiplier + (Math.random() - 0.5) * 15;
            this.velocities[index + 1] = velocity.y * speedMultiplier + Math.random() * 15 + 5;
            this.velocities[index + 2] = velocity.z * speedMultiplier + (Math.random() - 0.5) * 15;

            // Color
            this.colors[index] = color.r;
            this.colors[index + 1] = color.g;
            this.colors[index + 2] = color.b;

            // Lifetime
            this.lifetimes[this.particleCount] = 0.5 + Math.random() * 1.0; // 0.5-1.5 seconds

            // Size
            this.sizes[this.particleCount] = 2.0 + Math.random() * 4.0;

            this.particleCount++;
        }

        const posAttr = this.geometry.attributes.position;
        const colorAttr = this.geometry.attributes.customColor;
        const lifeAttr = this.geometry.attributes.lifetime;
        const sizeAttr = this.geometry.attributes.size;
        
        if (posAttr) posAttr.needsUpdate = true;
        if (colorAttr) colorAttr.needsUpdate = true;
        if (lifeAttr) lifeAttr.needsUpdate = true;
        if (sizeAttr) sizeAttr.needsUpdate = true;
    }

    update(deltaTime: number, context: GameContext): void {
        super.update(deltaTime, context);
        this.updateParticles(deltaTime);
    }

    // Backward compatible update method
    updateParticles(delta: number): void {
        for (let i = 0; i < this.particleCount; i++) {
            if (this.lifetimes[i]! > 0) {
                const index = i * 3;

                // Apply gravity and drag
                this.velocities[index + 1]! -= 40 * delta; // Gravity
                this.velocities[index]! *= (1.0 - 2.0 * delta); // Drag X
                this.velocities[index + 2]! *= (1.0 - 2.0 * delta); // Drag Z

                // Update position
                this.positions[index]! += this.velocities[index]! * delta;
                this.positions[index + 1]! += this.velocities[index + 1]! * delta;
                this.positions[index + 2]! += this.velocities[index + 2]! * delta;

                // Update lifetime
                this.lifetimes[i]! -= delta;
                
                // Floor collision (bounce)
                if (this.positions[index + 1]! < 0) {
                    this.positions[index + 1]! = 0;
                    this.velocities[index + 1]! *= -0.5; // Bounce
                    this.velocities[index]! *= 0.8; // Friction
                    this.velocities[index + 2]! *= 0.8;
                }
            }
        }

        const posAttr = this.geometry.attributes.position;
        const lifeAttr = this.geometry.attributes.lifetime;
        if (posAttr) posAttr.needsUpdate = true;
        if (lifeAttr) lifeAttr.needsUpdate = true;
    }

    async destroy(): Promise<void> {
        await super.destroy();
        this.cleanup();
    }

    cleanup(): void {
        scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}
