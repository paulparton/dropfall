import * as THREE from 'three';
import { createPlayerBody, world } from '../physics.js';
import { scene } from '../renderer.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { useGameStore } from '../store.js';
import { pixelToHex } from '../utils/math.js';
import { setBoostSound } from '../audio.js';

export class Player {
    constructor(id, color, startPosition, inputFn) {
        this.id = id;
        this.color = color;
        this.inputFn = inputFn;
        this.isDead = false;
        this.freezeTimer = 0;
        this.iceCooldown = 0;
        this.isBoosting = false;
        this.wasBoosting = false;

        const settings = useGameStore.getState().settings;
        this.sphereSize = settings.sphereSize;
        this.sphereWeight = settings.sphereWeight;
        this.sphereAccel = settings.sphereAccel;
        this.collisionBounce = settings.collisionBounce;
        const theme = settings.theme || 'default';

        // 1. Three.js Mesh
        const geometry = new THREE.SphereGeometry(this.sphereSize, 32, 32);
        const { sphereMaterialParams } = getThemeMaterials(theme);
        
        // If default theme, use the player's color. Otherwise, use the theme's color (usually white)
        this.baseMaterialColor = theme === 'default' ? this.color : (sphereMaterialParams.color || 0xffffff);
        this.iceColor = theme === 'beach' ? 0x0000ff : 0x00ffff;
        
        const material = new THREE.MeshStandardMaterial({
            ...sphereMaterialParams,
            color: this.baseMaterialColor
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        // 2. Dynamic Light (Glow)
        this.glow = new THREE.PointLight(this.color, 1.0, 10);
        scene.add(this.glow);

        // 3. Rapier Rigid Body
        const { rigidBody, collider } = createPlayerBody(startPosition, this.sphereSize, this.sphereWeight, this.collisionBounce);
        this.rigidBody = rigidBody;
        this.collider = collider;
    }

    update(delta, arena, particles) {
        // 1. Sync Mesh with Physics
        const position = this.rigidBody.translation();
        const rotation = this.rigidBody.rotation();

        this.mesh.position.copy(position);
        this.mesh.quaternion.copy(rotation);
        this.glow.position.copy(position);

        // 2. Check Death Condition
        if (position.y < -10) {
            this.isDead = true;
        }

        // Safety net to prevent falling forever in GAME_OVER state
        if (position.y < -1000) {
            this.rigidBody.setTranslation({ x: position.x, y: -1000, z: position.z }, true);
            this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }

        if (this.isDead) return;

        // Update timers
        if (this.freezeTimer > 0) this.freezeTimer -= delta;
        if (this.iceCooldown > 0) this.iceCooldown -= delta;

        // 3. Check Tile State for Ice
        if (arena) {
            const hex = pixelToHex(position.x, position.z, 8.0); // radius is 8.0
            const tile = arena.getTileAt(hex.q, hex.r);
            if (tile && tile.state === 'ICE') {
                if (this.freezeTimer <= 0 && this.iceCooldown <= 0) {
                    this.freezeTimer = 1.0; // Freeze for 1.0 seconds
                    this.iceCooldown = 2.0; // Cooldown to prevent perma-freeze
                }
            }
            
            if (this.freezeTimer > 0) {
                this.rigidBody.setLinearDamping(0.0); // Maintain velocity
                this.rigidBody.setAngularDamping(0.0);
                
                // Turn player blue
                this.mesh.material.color.setHex(this.iceColor);
                this.glow.color.setHex(this.iceColor);
                
                // Ice trail effect
                if (particles && Math.random() > 0.5) {
                    const contactPoint = { x: position.x, y: position.y - 1.5, z: position.z };
                    particles.emit(contactPoint, { x: 0, y: 0.5, z: 0 }, this.iceColor, 1);
                }
            } else {
                this.rigidBody.setLinearDamping(0.0); // Unlimited speed
                this.rigidBody.setAngularDamping(0.0);
                
                // Revert color
                this.mesh.material.color.setHex(this.baseMaterialColor);
                this.glow.color.setHex(this.color);
            }
        }

        // 4. Handle Input
        const storeState = useGameStore.getState();
        const input = storeState.gameState === 'PLAYING' ? this.inputFn() : { forward: false, backward: false, left: false, right: false, boost: false };
        const speed = this.sphereAccel * delta;

        // Check boost
        const boostLevel = storeState[`${this.id}Boost`];
        
        const isFalling = position.y < -1.0;
        const hasControl = this.freezeTimer <= 0 && !isFalling && storeState.gameState === 'PLAYING';
        
        // Boost logic: Can only start boosting if above 20%, but can continue until 0%
        if (input.boost && boostLevel > 20 && !this.isBoosting && hasControl) {
            this.isBoosting = true;
        } else if (!input.boost || boostLevel <= 0 || !hasControl) {
            this.isBoosting = false;
        }
        
        const isBoosting = this.isBoosting;
        const boostMultiplier = isBoosting ? 2.5 : 1.0;

        // Handle boost audio
        if (this.wasBoosting !== isBoosting) {
            setBoostSound(this.id, isBoosting);
            this.wasBoosting = isBoosting;
        }

        let forceX = 0;
        let forceZ = 0;

        if (hasControl) {
            if (input.forward) forceZ -= speed * boostMultiplier;
            if (input.backward) forceZ += speed * boostMultiplier;
            if (input.left) forceX -= speed * boostMultiplier;
            if (input.right) forceX += speed * boostMultiplier;

            // Apply force
            if (forceX !== 0 || forceZ !== 0) {
                this.rigidBody.applyImpulse({ x: forceX, y: 0, z: forceZ }, true);
            }
        }

        // Update Boost Meter
        if (isBoosting) {
            useGameStore.getState().updateBoost(this.id, -20 * delta);
            
            // Emit sparks at floor contact point, shooting backwards
            if (particles && (forceX !== 0 || forceZ !== 0)) {
                const contactPoint = { x: position.x, y: position.y - 1.5, z: position.z };
                // Normalize the force vector to get direction, then reverse it
                const length = Math.sqrt(forceX * forceX + forceZ * forceZ);
                const sparkVelocity = {
                    x: -(forceX / length) * 10,
                    y: 2, // Slight upward arc
                    z: -(forceZ / length) * 10
                };
                // Less particles, subtle translucent orange/red color
                particles.emit(contactPoint, sparkVelocity, 0xff4400, 0.5);
            }
        } else {
            useGameStore.getState().updateBoost(this.id, 1.5 * delta); // Fill at half speed (was 3)
        }
    }

    cleanup() {
        scene.remove(this.mesh);
        scene.remove(this.glow);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        setBoostSound(this.id, false);

        if (world && this.rigidBody) {
            world.removeRigidBody(this.rigidBody);
        }
    }
}
