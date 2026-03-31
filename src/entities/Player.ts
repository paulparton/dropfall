/**
 * Player Entity - TypeScript Migration
 *
 * Player class implementing the Entity interface with full type safety,
 * physics integration, and power-up system.
 */

import * as THREE from 'three';
import { getPhysicsSystem } from '../systems/PhysicsSystem';
import { scene } from '../renderer';
import { getThemeMaterials } from '../utils/themeTextures';
import { useGameStore } from '../store';
import { pixelToHex } from '../utils/math';
import { setBoostSound } from '../audio';
import { EntityBase } from './Entity.base';
import type { PlayerEntity, GameContext } from '../types/Entity';
import type { RigidBody, Collider } from '@dimforge/rapier3d-compat';

/**
 * Simplified input interface for Player movement
 * Maps to keyboard/gamepad input
 */
export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}

/**
 * Power-up effect definition with typed interface
 */
export interface PowerUpEffect {
  type: string;
  name: string;
  icon: string;
  description: string;
  color: number;
  apply: (player: Player, duration: number) => void;
  remove: (player: Player) => void;
}

/**
 * Active power-up tracking
 */
export interface ActivePowerUp {
  type: string;
  effect: PowerUpEffect;
  startTime: number;
  duration: number;
  name: string;
}

// Power-up effect definitions
const POWER_UP_EFFECTS: PowerUpEffect[] = [
    {
        type: 'ACCELERATION_BOOST',
        name: 'Speed Demon',
        icon: '⚡',
        description: 'Double your acceleration for lightning-fast movement',
        color: 0xff6600,
        apply: (player: Player, _duration: number) => {
            player.sphereAccelMultiplier = 2.0;
            player.powerUpColor = 0xff6600;
        },
        remove: (player: Player) => {
            player.sphereAccelMultiplier = 1.0;
        }
    },
    {
        type: 'SIZE_REDUCTION',
        name: 'Shrink',
        icon: '🔽',
        description: 'Reduce your size to 60% for agility and dodging',
        color: 0x0099ff,
        apply: (player: Player, _duration: number) => {
            player.sizeMultiplier = 0.6;
            player.mesh.scale.set(0.6, 0.6, 0.6);
            player.auraMesh.scale.set(0.6, 0.6, 0.6);
            player.powerUpColor = 0x0099ff;
        },
        remove: (player: Player) => {
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
        apply: (player: Player, _duration: number) => {
            player.weightMultiplier = 2.0;
            player.powerUpColor = 0x8800ff;
        },
        remove: (player: Player) => {
            player.weightMultiplier = 1.0;
        }
    },
    {
        type: 'SPEED_BURST',
        name: 'Rocket Boost',
        icon: '🚀',
        description: 'Instant velocity boost in your current direction',
        color: 0xff0000,
        apply: (player: Player, _duration: number) => {
            const vel = player.rigidBody.linvel();
            const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
            const boost = speed > 0 ? new THREE.Vector3(vel.x, 0, vel.z).normalize().multiplyScalar(50) : new THREE.Vector3(50, 0, 0);
            player.rigidBody.applyImpulse({ x: boost.x, y: 0, z: boost.z }, true);
            player.powerUpColor = 0xff0000;
        },
        remove: (player: Player) => {}
    },
    {
        type: 'LIGHT_TOUCH',
        name: 'Floaty',
        icon: '🪶',
        description: 'Reduce gravity by 50% for lighter, longer jumps',
        color: 0x00ff88,
        apply: (player: Player, _duration: number) => {
            player.gravityMultiplier = 0.5;
            player.powerUpColor = 0x00ff88;
        },
        remove: (player: Player) => {
            player.gravityMultiplier = 1.0;
        }
    },
    {
        type: 'SIZE_INCREASE',
        name: 'Mega',
        icon: '🆙',
        description: 'Grow to 160% size for dominance and reach',
        color: 0xffff00,
        apply: (player: Player, _duration: number) => {
            player.sizeMultiplier = 1.6;
            player.mesh.scale.set(1.6, 1.6, 1.6);
            player.auraMesh.scale.set(1.6, 1.6, 1.6);
            player.powerUpColor = 0xffff00;
        },
        remove: (player: Player) => {
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
        apply: (player: Player, _duration: number) => {
            player.frictionMultiplier = 3.0;
            player.powerUpColor = 0x00ccff;
        },
        remove: (player: Player) => {
            player.frictionMultiplier = 1.0;
        }
    },
    {
        type: 'INVULNERABILITY',
        name: 'Fortress',
        icon: '🛡️',
        description: 'Complete protection from knockback effects',
        color: 0xff00ff,
        apply: (player: Player, _duration: number) => {
            player.isInvulnerable = true;
            player.powerUpColor = 0xff00ff;
        },
        remove: (player: Player) => {
            player.isInvulnerable = false;
        }
    }
];

export { POWER_UP_EFFECTS };

/**
 * Forward declarations for circular dependencies
 * These will be imported from their respective modules
 */
type Arena = import('./Arena.js').Arena;
type ParticleSystem = import('./ParticleSystem.js').ParticleSystem;

/**
 * Player class extending EntityBase
 * Implements PlayerEntity interface with full type safety
 */
export class Player extends EntityBase implements PlayerEntity {
  readonly type: 'player' = 'player';

  // PlayerEntity required properties
  health: number = 100;
  velocity: { x: number; y: number } = { x: 0, y: 0 };

  // Player-specific properties
  color: number;
  inputFn: () => PlayerInput;
  isDead: boolean = false;

  // Three.js objects
  mesh!: THREE.Mesh;
  glow!: THREE.PointLight;
  auraMesh!: THREE.Mesh;
  nameLabel: THREE.Sprite | null = null;
  playerName: string = '';

  // Physics
  rigidBody!: RigidBody;
  collider!: Collider;

  // Settings
  sphereSize!: number;
  sphereWeight!: number;
  sphereAccel!: number;
  collisionBounce!: number;
  baseMaterialColor!: number;
  iceColor!: number;

  // Power-up system
  activePowerUps: ActivePowerUp[] = [];
  sphereAccelMultiplier: number = 1.0;
  sizeMultiplier: number = 1.0;
  weightMultiplier: number = 1.0;
  gravityMultiplier: number = 1.0;
  frictionMultiplier: number = 1.0;
  isInvulnerable: boolean = false;
  powerUpColor: number | null = null;

  // Timers
  freezeTimer: number = 0;
  iceCooldown: number = 0;
  portalCooldown: number = 0;
  isBoosting: boolean = false;
  wasBoosting: boolean = false;

  // Aura visibility
  auraMeshVisible: boolean = true;

  // Position tracking
  lastPosition: THREE.Vector3;
  lastRotation: THREE.Quaternion;

  constructor(id: string, color: number, startPosition: { x: number; y: number; z: number }, inputFn: () => PlayerInput) {
    super(id, 'player', { x: startPosition.x, y: startPosition.z });

    this.color = color;
    this.inputFn = inputFn;

    const settings = useGameStore.getState().settings;
    this.sphereSize = settings.sphereSize;
    this.sphereWeight = settings.sphereWeight;
    this.sphereAccel = settings.sphereAccel;
    this.collisionBounce = settings.collisionBounce;
    const theme = settings.theme || 'default';

    // Initialize position tracking
    this.lastPosition = new THREE.Vector3().copy(startPosition);
    this.lastRotation = new THREE.Quaternion();

    // Create Three.js objects
    this._createMesh(theme);
    this._createPhysics();

    // Get player name from store
    const storeState = useGameStore.getState();
    this.playerName = id === 'player1' ? (storeState.p1Name || 'Player 1') : (storeState.p2Name || 'Player 2');
    this.nameLabel = this._createNameLabel(this.playerName);
    scene.add(this.nameLabel);
  }

  private _createMesh(theme: string): void {
    // 1. Three.js Mesh
    const geometry = new THREE.SphereGeometry(this.sphereSize, 16, 16); // PERFORMANCE: Reduced from 32, 32
    const { sphereMaterialParams } = getThemeMaterials(theme);

    // If default theme, use the player's color. Otherwise, use the theme's color (usually white)
    const matParams = sphereMaterialParams as { color?: number };
    this.baseMaterialColor = theme === 'default' ? this.color : (matParams.color || 0xffffff);
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
    const glowColor = theme === 'default' ? this.color : this.color;
    const glowIntensity = 0.5; // PERFORMANCE: Reduced significantly
    const glowRange = 15; // PERFORMANCE: Reduced from 30
    this.glow = new THREE.PointLight(glowColor, glowIntensity, glowRange);
    scene.add(this.glow);

    // 3. Create glowing aura mesh around the player
    const settings = useGameStore.getState().settings;
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
  }

  private _createPhysics(): void {
    // Rapier Rigid Body - use PhysicsSystem for event tracking
    const physicsSystem = getPhysicsSystem();
    const position = this.mesh.position;
    const startPos = { x: position.x, y: position.y, z: position.z };
    const { rigidBody, collider } = physicsSystem.createBody(this.id, startPos, {
        radius: this.sphereSize,
        mass: this.sphereWeight,
        restitution: this.collisionBounce,
        isDynamic: true
    });
    this.rigidBody = rigidBody;
    this.collider = collider;
  }

  async initialize(context: GameContext): Promise<void> {
    await super.initialize(context);
  }

  // Implement EntityBase's update for lifecycle hooks
  update(deltaTime: number, _context: GameContext): void {
    // Update position from physics - called by EntityBase
    super.update(deltaTime, _context);
  }

  // Player-specific update with game-specific parameters (not overriding EntityBase)
  updateGame(delta: number, arena: Arena | null, particles: ParticleSystem | null): void {
    const context: GameContext = { deltaTime: delta, gameState: useGameStore.getState().gameState, physics: null, audio: null };

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
                    if (!targetPortal) return;

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
            const randomEffect = POWER_UP_EFFECTS[Math.floor(Math.random() * POWER_UP_EFFECTS.length)]!;
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

            // Show notification with icon (global function from main.js)
            const win = window as Window & { showPowerUpNotification?: (player: string, name: string, icon: string, color: number) => void };
            if (typeof win.showPowerUpNotification === 'function') {
                const playerName = this.id === 'player1' ? 'P1' : 'P2';
                win.showPowerUpNotification(playerName, randomEffect.name, randomEffect.icon, randomEffect.color);
            }

            // Convert bonus tile back to normal
            arena.convertTileToNormal(tile);
        }

        if (this.freezeTimer > 0) {
            this.rigidBody.setLinearDamping(0.0); // Maintain velocity
            this.rigidBody.setAngularDamping(0.0);

            // Turn player blue
            (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(this.iceColor);
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
                (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(this.baseMaterialColor);
                this.glow.color.setHex(this.color);
            } else if (this.powerUpColor) {
                // Show power-up color
                (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(this.powerUpColor);
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

    // 4. Handle Input
    const storeState = useGameStore.getState();
    const input: PlayerInput = storeState.gameState === 'PLAYING' ? this.inputFn() : { forward: false, backward: false, left: false, right: false, boost: false };
    const speed = this.sphereAccel * this.sphereAccelMultiplier * delta;

    // Check boost
    const boostLevel = storeState[`${this.id}Boost` as keyof typeof storeState] as number;

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
        // Map forward/backward to up/down (z-axis)
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
    const playerId = this.id as 'player1' | 'player2';
    if (isBoosting) {
        useGameStore.getState().updateBoost(playerId, -settings.boostDrainRate * delta);

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
        useGameStore.getState().updateBoost(playerId, settings.boostRegenSpeed * delta);
    }

    // Store current state for next frame (used for interpolation if needed)
    this.lastPosition.copy(currentPos);
    this.lastRotation.copy(currentRot);
  }

  async destroy(): Promise<void> {
    await super.destroy();
    this.cleanup();
  }

  cleanup(): void {
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
    (this.mesh.material as THREE.Material).dispose();
    this.auraMesh.geometry.dispose();
    (this.auraMesh.material as THREE.Material).dispose();
    setBoostSound(this.id, false);

    if (this.rigidBody) {
        const physicsSystem = getPhysicsSystem();
        physicsSystem.destroyBody(this.id);
    }
  }

  private _createNameLabel(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        // Fallback - return a simple sprite
        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(10, 2.5, 1);
        return sprite;
    }
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
  
  updateNameLabel(newName: string) {
    if (!this.nameLabel) return;
    this.playerName = newName;
    
    // Recreate the texture with the new name
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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

// Required for Entity interface
export interface Velocity {
  x: number;
  y: number;
}
