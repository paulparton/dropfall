import * as THREE from 'three';
import { getPhysicsSystem } from '../systems/PhysicsSystem.js';
import { scene } from '../renderer.js';
import { getThemeMaterials } from '../utils/themeTextures.js';
import { useGameStore } from '../store.js';
import { pixelToHex } from '../utils/math.js';
import { setBoostSound } from '../audio.js';

// Power-up effect definitions
const POWER_UP_EFFECTS = [
    {
        type: 'ACCELERATION_BOOST',
        name: 'Speed Demon',
        icon: '⚡',
        description: 'Double your acceleration for lightning-fast movement',
        color: 0xff6600,
        apply: (player, duration) => {
            player.sphereAccelMultiplier = 2.0;
            player.powerUpColor = 0xff6600;
        },
        remove: (player) => {
            player.sphereAccelMultiplier = 1.0;
        }
    },
    {
        type: 'SIZE_REDUCTION',
        name: 'Shrink',
        icon: '🔽',
        description: 'Reduce your size to 60% for agility and dodging',
        color: 0x0099ff,
        apply: (player, duration) => {
            player.sizeMultiplier = 0.6;
            player.mesh.scale.set(0.6, 0.6, 0.6);
            player.auraMesh.scale.set(0.6, 0.6, 0.6);
            player.powerUpColor = 0x0099ff;
        },
        remove: (player) => {
            player.sizeMultiplier = 1.0;
            player.mesh.scale.set(1.0, 1.0, 1.0);
            player.auraMesh.scale.set(1.0, 1.0, 1.0);
        }
    },
    {
        type: 'WEIGHT_INCREASE',
        name: 'Heavy Metal',
        icon: '⚖️',
        description: 'Double your weight for more momentum and collision power',
        color: 0x8800ff,
        apply: (player, duration) => {
            player.weightMultiplier = 2.0;
            player.powerUpColor = 0x8800ff;
        },
        remove: (player) => {
            player.weightMultiplier = 1.0;
        }
    },
    {
        type: 'SPEED_BURST',
        name: 'Rocket Boost',
        icon: '🚀',
        description: 'Instant velocity boost in your current direction',
        color: 0xff0000,
        apply: (player, duration) => {
            const vel = player.rigidBody.linvel();
            const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
            const boost = speed > 0 ? new THREE.Vector3(vel.x, 0, vel.z).normalize().multiplyScalar(50) : new THREE.Vector3(50, 0, 0);
            player.rigidBody.applyImpulse({ x: boost.x, y: 0, z: boost.z }, true);
            player.powerUpColor = 0xff0000;
        },
        remove: (player) => {}
    },
    {
        type: 'LIGHT_TOUCH',
        name: 'Floaty',
        icon: '🪶',
        description: 'Reduce gravity by 50% for lighter, longer jumps',
        color: 0x00ff88,
        apply: (player, duration) => {
            player.gravityMultiplier = 0.5;
            player.powerUpColor = 0x00ff88;
        },
        remove: (player) => {
            player.gravityMultiplier = 1.0;
        }
    },
    {
        type: 'SIZE_INCREASE',
        name: 'Mega',
        icon: '🆙',
        description: 'Grow to 160% size for dominance and reach',
        color: 0xffff00,
        apply: (player, duration) => {
            player.sizeMultiplier = 1.6;
            player.mesh.scale.set(1.6, 1.6, 1.6);
            player.auraMesh.scale.set(1.6, 1.6, 1.6);
            player.powerUpColor = 0xffff00;
        },
        remove: (player) => {
            player.sizeMultiplier = 1.0;
            player.mesh.scale.set(1.0, 1.0, 1.0);
            player.auraMesh.scale.set(1.0, 1.0, 1.0);
        }
    },
    {
        type: 'GRIP_BOOST',
        name: 'Traction',
        icon: '🔗',
        description: '3x grip for precise control and no slip',
        color: 0x00ccff,
        apply: (player, duration) => {
            player.frictionMultiplier = 3.0;
            player.powerUpColor = 0x00ccff;
        },
        remove: (player) => {
            player.frictionMultiplier = 1.0;
        }
    },
    {
        type: 'INVULNERABILITY',
        name: 'Fortress',
        icon: '🛡️',
        description: 'Complete protection from knockback effects',
        color: 0xff00ff,
        apply: (player, duration) => {
            player.isInvulnerable = true;
            player.powerUpColor = 0xff00ff;
        },
        remove: (player) => {
            player.isInvulnerable = false;
        }
    }
];

export { POWER_UP_EFFECTS };

export class Player {
    constructor(id, color, startPosition, inputFn) {
        this.id = id;
        this.color = color;
        this.inputFn = inputFn;
        this.isLocal = true; // Default to local - override in main.js for online remote players
        this.isDead = false;
        this.freezeTimer = 0;
        this.iceCooldown = 0;
        this.portalCooldown = 0;
        this.isBoosting = false;
        this.wasBoosting = false;
        
        // Power-up system
        this.activePowerUps = [];
        this.sphereAccelMultiplier = 1.0;
        this.sizeMultiplier = 1.0;
        this.weightMultiplier = 1.0;
        this.gravityMultiplier = 1.0;
        this.frictionMultiplier = 1.0;
        this.isInvulnerable = false;
        this.powerUpColor = null;

        const settings = useGameStore.getState().settings;
        this.sphereSize = settings.sphereSize;
        this.sphereWeight = settings.sphereWeight;
        this.sphereAccel = settings.sphereAccel;
        this.collisionBounce = settings.collisionBounce;
        const theme = settings.theme || 'default';

        // 1. Three.js Mesh
        const geometry = new THREE.SphereGeometry(this.sphereSize, 16, 16); // PERFORMANCE: Reduced from 32, 32
        const { sphereMaterialParams } = getThemeMaterials(theme);
        
        // If default theme, use the player's color. Otherwise, use the theme's color (usually white)
        this.baseMaterialColor = theme === 'default' ? this.color : (sphereMaterialParams.color || 0xffffff);
        this.iceColor = theme === 'beach' ? 0x0000ff : 0x00ffff;
        
        const material = new THREE.MeshStandardMaterial({
            ...sphereMaterialParams,
            color: this.baseMaterialColor,
            emissive: this.color,
            emissiveIntensity: 0.2  // PERFORMANCE: Glow via emissive instead of light
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        // 2. Dynamic Light (Glow) - Keep but reduce intensity
        // PERFORMANCE: Reduced from full intensity to minimal levels
        const glowColor = theme === 'default' ? this.color : this.color;
        const glowIntensity = 0.5; // PERFORMANCE: Reduced significantly
        const glowRange = 15; // PERFORMANCE: Reduced from 30
        this.glow = new THREE.PointLight(glowColor, glowIntensity, glowRange);
        scene.add(this.glow);

        // 3. Create glowing aura mesh around the player
        const auraGeometry = new THREE.SphereGeometry(this.sphereSize * settings.playerAuraSize, 12, 12); // PERFORMANCE: Reduced from 32, 32
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: settings.playerAuraOpacity,
            depthWrite: false,
            side: THREE.BackSide
        });
        this.auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
        this.auraMesh.position.copy(this.mesh.position);
        scene.add(this.auraMesh);
        this.auraMeshVisible = true;

        // 4. Rapier Rigid Body - use PhysicsSystem for event tracking
        const physicsSystem = getPhysicsSystem();
        const { rigidBody, collider } = physicsSystem.createBody(id, startPosition, {
            radius: this.sphereSize,
            mass: this.sphereWeight,
            restitution: this.collisionBounce,
            isDynamic: true
        });
        this.rigidBody = rigidBody;
        this.collider = collider;

        // 5. Floating name label
        const storeState = useGameStore.getState();
        this.playerName = id === 'player1' ? (storeState.p1Name || 'Player 1') : (storeState.p2Name || 'Player 2');
        this.nameLabel = this._createNameLabel(this.playerName);
        scene.add(this.nameLabel);

        // 6. Initialize position tracking for smooth interpolation
        this.lastPosition = new THREE.Vector3().copy(startPosition);
        this.lastRotation = new THREE.Quaternion();
    }

    update(delta, arena, particles) {
        // 1. Sync Mesh with Physics
        const position = this.rigidBody.translation();
        const rotation = this.rigidBody.rotation();

        // Convert Rapier Vector3 to THREE.Vector3 for easier math
        const currentPos = new THREE.Vector3(position.x, position.y, position.z);
        const currentRot = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

        this.mesh.position.copy(currentPos);
        this.mesh.quaternion.copy(currentRot);
        this.glow.position.copy(currentPos);
        this.auraMesh.position.copy(currentPos);
        if (this.nameLabel) {
            this.nameLabel.position.set(currentPos.x, currentPos.y + this.sphereSize + 3.2, currentPos.z);
        }

        // 2. Check Death Condition
        if (currentPos.y < -10) {
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
        if (this.portalCooldown > 0) this.portalCooldown -= delta;

        // 3. Check Tile State for Ice and Portal
        if (arena) {
            const hex = pixelToHex(position.x, position.z, 8.0); // radius is 8.0
            const tile = arena.getTileAt(hex.q, hex.r);
            
            // Ice tile logic
            if (tile && tile.state === 'ICE') {
                if (this.freezeTimer <= 0 && this.iceCooldown <= 0) {
                    this.freezeTimer = 1.0; // Freeze for 1.0 seconds
                    this.iceCooldown = 2.0; // Cooldown to prevent perma-freeze
                }
            }
            
            // Portal tile logic
            if (tile && tile.state === 'PORTAL') {
                if (!this.portalCooldown || this.portalCooldown <= 0) {
                    const portalTiles = arena.getPortalTiles();
                    if (portalTiles.length > 1) {
                        // Find a different portal tile to teleport to
                        const otherPortals = portalTiles.filter(p => p !== tile);
                        const targetPortal = otherPortals[Math.floor(Math.random() * otherPortals.length)];
                        
                        // Teleport to target portal
                        const targetPos = targetPortal.mesh.position;
                        this.rigidBody.setTranslation({ x: targetPos.x, y: targetPos.y + 2, z: targetPos.z }, true);
                        
                        // Reset velocity to avoid momentum carryover
                        this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                        
                        // Set cooldown
                        const settings = useGameStore.getState().settings;
                        this.portalCooldown = settings.portalCooldown;
                    }
                }
            }
            
            // Bonus tile logic
            if (tile && tile.state === 'BONUS') {
                // Pick up the bonus and apply random effect
                const randomEffect = POWER_UP_EFFECTS[Math.floor(Math.random() * POWER_UP_EFFECTS.length)];
                const settings = useGameStore.getState().settings;
                const duration = settings.bonusDuration;
                
                // Apply the effect
                randomEffect.apply(this, duration);
                
                // Track the active power-up
                this.activePowerUps.push({
                    type: randomEffect.type,
                    effect: randomEffect,
                    startTime: performance.now() / 1000,
                    duration: duration,
                    name: randomEffect.name
                });
                
                // Show notification with icon
                if (typeof window.showPowerUpNotification !== 'undefined') {
                    const playerName = this.id === 'player1' ? 'P1' : 'P2';
                    window.showPowerUpNotification(playerName, randomEffect.name, randomEffect.icon, randomEffect.color);
                }
                
                // Convert bonus tile back to normal
                arena.convertTileToNormal(tile);
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
                
                // Revert color if no power-ups active
                if (this.activePowerUps.length === 0) {
                    this.mesh.material.color.setHex(this.baseMaterialColor);
                    this.glow.color.setHex(this.color);
                } else if (this.powerUpColor) {
                    // Show power-up color
                    this.mesh.material.color.setHex(this.powerUpColor);
                    this.glow.color.setHex(this.powerUpColor);
                }
            }
        }
        
        // Update and clean up power-ups
        const now = performance.now() / 1000;
        this.activePowerUps = this.activePowerUps.filter(powerUp => {
            const elapsed = now - powerUp.startTime;
            if (elapsed >= powerUp.duration) {
                powerUp.effect.remove(this);
                // Reset modified properties when power-up expires
                if (this.activePowerUps.length === 1 && this.activePowerUps[0] === powerUp) {
                    this.powerUpColor = null;
                }
                return false;
            }
            return true;
        });
        
        // Apply friction multiplier from active power-ups
        if (this.frictionMultiplier > 1.0 && this.collider) {
            this.collider.setFriction(0.5 * this.frictionMultiplier);
        }

        // 4. Handle Input - skip for remote players (online client receives positions from host)
        if (!this.isLocal) {
            return; // Remote player - position is set by host, don't apply local input
        }

        const storeState = useGameStore.getState();
        const input = storeState.gameState === 'PLAYING' ? this.inputFn() : { forward: false, backward: false, left: false, right: false, boost: false };
        const speed = this.sphereAccel * this.sphereAccelMultiplier * delta;

        // Check boost
        const boostLevel = storeState[`${this.id}Boost`];
        
        const isFalling = position.y < -1.0;
        const hasControl = this.freezeTimer <= 0 && !isFalling && storeState.gameState === 'PLAYING' && !this.isInvulnerable;
        
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
        const settings = useGameStore.getState().settings;
        if (isBoosting) {
            useGameStore.getState().updateBoost(this.id, -settings.boostDrainRate * delta);
            
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
            useGameStore.getState().updateBoost(this.id, settings.boostRegenSpeed * delta);
        }

        // Store current state for next frame (used for interpolation if needed)
        this.lastPosition.copy(currentPos);
        this.lastRotation.copy(currentRot);
    }

    cleanup() {
        scene.remove(this.mesh);
        scene.remove(this.glow);
        scene.remove(this.auraMesh);
        if (this.nameLabel) {
            scene.remove(this.nameLabel);
            if (this.nameLabel.material.map) this.nameLabel.material.map.dispose();
            this.nameLabel.material.dispose();
            this.nameLabel = null;
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.auraMesh.geometry.dispose();
        this.auraMesh.material.dispose();
        setBoostSound(this.id, false);

        if (this.rigidBody) {
            const physicsSystem = getPhysicsSystem();
            physicsSystem.destroyBody(this.id);
        }
    }

    _createNameLabel(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const hexColor = '#' + this.color.toString(16).padStart(6, '0');
        ctx.font = 'bold 38px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 7;
        ctx.strokeText(name, 128, 32);
        ctx.fillStyle = hexColor;
        ctx.fillText(name, 128, 32);
        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(10, 2.5, 1);
        return sprite;
    }
    
    updateNameLabel(newName) {
        if (!this.nameLabel) return;
        this.playerName = newName;
        
        // Recreate the texture with the new name
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const hexColor = '#' + this.color.toString(16).padStart(6, '0');
        ctx.font = 'bold 38px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 7;
        ctx.strokeText(newName, 128, 32);
        ctx.fillStyle = hexColor;
        ctx.fillText(newName, 128, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        this.nameLabel.material.map = texture;
        this.nameLabel.material.needsUpdate = true;
    }
}
