/**
 * SDF Game Engine - Core game loop and logic
 * Manages game state, players, arena, and effects
 */

import { useGameStore } from '../store.js';
import * as SDFRenderer from './renderer.js';
import * as SDFPhysics from './physics.js';
import { initInput, getPlayer1Input, getPlayer2Input } from '../input.js';
import { playCollisionSound, playMusic, setMusicSpeed } from '../audio.js';

export class SDFGameEngine {
    constructor() {
        this.gameState = 'MENU';
        this.players = [];
        this.arena = null;
        this.particles = [];
        this.effects = [];
        this.clock = { deltaTime: 0, time: 0 };
        this.isRunning = false;
        
        // Player state
        this.player1 = null;
        this.player2 = null;
        
        // Arena state
        this.tileStates = new Map();
        this.destructionTimer = 0;
        this.iceTimer = 0;
        this.portalTimer = 0;
        this.bonusTimer = 0;
        
        // Render state
        this.camera = {
            position: { x: 0, y: 15, z: 30 },
            target: { x: 0, y: 2, z: 0 }
        };
    }
    
    /**
     * Initialize the entire game engine
     */
    async initialize(container) {
        console.log('Initializing SDF Game Engine...');
        
        // Initialize systems
        await SDFPhysics.initPhysics();
        initInput();
        
        // Initialize renderer
        await SDFRenderer.initSDFRenderer(container);
        
        // Load game settings
        const storeState = useGameStore.getState();
        this.settings = storeState.settings;
        
        // Create players
        this.createPlayers();
        
        // Create arena
        this.createArena();
        
        this.isRunning = true;
        console.log('SDF Game Engine initialized successfully');
        
        return this;
    }
    
    /**
     * Create player entities
     */
    createPlayers() {
        const settings = this.settings;
        
        const player1Pos = { x: -10, y: 5, z: 0 };
        const player2Pos = { x: 10, y: 5, z: 0 };
        
        // Create physics bodies
        const p1Body = SDFPhysics.createPlayerBody(
            player1Pos,
            settings.sphereSize,
            settings.sphereWeight,
            settings.collisionBounce
        );
        
        const p2Body = SDFPhysics.createPlayerBody(
            player2Pos,
            settings.sphereSize,
            settings.sphereWeight,
            settings.collisionBounce
        );
        
        this.player1 = {
            id: 1,
            rigidBody: p1Body.rigidBody,
            collider: p1Body.collider,
            position: player1Pos,
            color: 0xff0000,
            radius: settings.sphereSize,
            velocity: { x: 0, y: 0, z: 0 },
            boostEnergy: 100,
            powerUps: [],
            isDead: false
        };
        
        this.player2 = {
            id: 2,
            rigidBody: p2Body.rigidBody,
            collider: p2Body.collider,
            position: player2Pos,
            color: 0x0000ff,
            radius: settings.sphereSize,
            velocity: { x: 0, y: 0, z: 0 },
            boostEnergy: 100,
            powerUps: [],
            isDead: false
        };
        
        this.players = [this.player1, this.player2];
    }
    
    /**
     * Create arena tiles using SDF-based geometry
     */
    createArena() {
        const settings = this.settings;
        const arenaSize = settings.arenaSize;
        
        // Create hexagonal tile grid
        const gridSpacing = 8.0;
        const tileRadius = gridSpacing * 0.9;
        const tileHeight = 4.0;
        
        // Generate hex coordinates
        const tiles = [];
        for (let q = -arenaSize; q <= arenaSize; q++) {
            for (let r = -arenaSize; r <= arenaSize; r++) {
                if (Math.abs(q + r) <= arenaSize) {
                    const x = gridSpacing * (q + r * 0.5);
                    const z = gridSpacing * (r * 0.866);
                    
                    const tileBody = SDFPhysics.createTileBody(
                        { x, y: 0, z },
                        tileRadius,
                        tileHeight
                    );
                    
                    tiles.push({
                        q, r,
                        position: { x, y: 0, z },
                        rigidBody: tileBody.rigidBody,
                        collider: tileBody.collider,
                        state: 'NORMAL',
                        hp: 100,
                        isIce: false,
                        isPortal: false,
                        isBonus: false
                    });
                    
                    this.tileStates.set(`${q},${r}`, tiles[tiles.length - 1]);
                }
            }
        }
        
        this.arena = {
            tiles,
            size: arenaSize,
            radius: arenaSize * gridSpacing,
            primaryColor: 0x666666,
            secondaryColor: 0x333333
        };
    }
    
    /**
     * Main game loop - call this every frame
     */
    update(deltaTime) {
        if (!this.isRunning) return;
        
        this.clock.deltaTime = deltaTime;
        this.clock.time += deltaTime;
        
        // Get player input
        const input1 = getPlayer1Input();
        const input2 = getPlayer2Input();
        
        // Apply forces BEFORE physics update
        this.updatePlayer(this.player1, input1, deltaTime);
        this.updatePlayer(this.player2, input2, deltaTime);
        
        // NOW update physics after forces are applied
        SDFPhysics.updatePhysics(deltaTime);
        
        // Check collisions
        this.checkCollisions();
        
        // Update arena effects
        this.updateArenaEffects(deltaTime);
        
        // Update effects/particles
        this.updateEffects(deltaTime);
        
        // Update camera
        this.updateCamera();
        
        // Update renderer
        this.updateRenderer();
    }
    
    /**
     * Update individual player
     */
    updatePlayer(player, input, deltaTime) {
        // Get physics body state
        const translation = player.rigidBody.translation();
        const velocity = player.rigidBody.linvel();
        
        player.position = { x: translation.x, y: translation.y, z: translation.z };
        player.velocity = { x: velocity.x, y: velocity.y, z: velocity.z };
        
        // Apply movement
        const moveForce = this.settings.sphereAccel * player.rigidBody.mass();
        
        if (input.up) {
            SDFPhysics.applyForce(player.rigidBody, { x: 0, y: 0, z: -moveForce, isWake: true });
        }
        if (input.down) {
            SDFPhysics.applyForce(player.rigidBody, { x: 0, y: 0, z: moveForce, isWake: true });
        }
        if (input.left) {
            SDFPhysics.applyForce(player.rigidBody, { x: -moveForce, y: 0, z: 0, isWake: true });
        }
        if (input.right) {
            SDFPhysics.applyForce(player.rigidBody, { x: moveForce, y: 0, z: 0, isWake: true });
        }
        
        // Handle boost
        if (input.boost && player.boostEnergy > 0) {
            const boostForce = moveForce * 2;
            const vel = player.velocity;
            const speed = Math.hypot(vel.x, vel.z);
            
            if (speed > 0) {
                const dir = { x: vel.x / speed, z: vel.z / speed };
                SDFPhysics.applyImpulse(player.rigidBody, {
                    x: dir.x * boostForce,
                    y: 0,
                    z: dir.z * boostForce
                });
            }
            
            player.boostEnergy -= this.settings.boostDrainRate * deltaTime;
        } else if (player.boostEnergy < 100) {
            player.boostEnergy += this.settings.boostRegenSpeed * deltaTime;
        }
        
        player.boostEnergy = Math.max(0, Math.min(100, player.boostEnergy));
        
        // Check if fallen off arena
        if (translation.y < -10) {
            player.isDead = true;
        }
    }
    
    /**
     * Check for collisions between players
     */
    checkCollisions() {
        const collisions = SDFPhysics.detectCollisionsWithSDF(
            this.player1,
            this.player2,
            this.player1.radius
        );
        
        collisions.forEach(collision => {
            SDFPhysics.resolveCollision(collision);
            playCollisionSound();
            
            // Create shockwave effect
            const impact = {
                x: (collision.p1.position.x + collision.p2.position.x) / 2,
                y: (collision.p1.position.y + collision.p2.position.y) / 2,
                z: (collision.p1.position.z + collision.p2.position.z) / 2
            };
            this.createShockwave(impact, 2.0);
        });
    }
    
    /**
     * Update arena effects (destruction, ice, portals, bonuses)
     */
    updateArenaEffects(deltaTime) {
        const settings = this.settings;
        
        this.destructionTimer += deltaTime;
        this.iceTimer += deltaTime;
        this.portalTimer += deltaTime;
        this.bonusTimer += deltaTime;
        
        // Trigger random tile effects
        if (this.destructionTimer >= settings.destructionRate) {
            this.destructionTimer = 0;
            this.triggerRandomTileDestruction();
        }
        
        if (this.iceTimer >= settings.iceRate) {
            this.iceTimer = 0;
            this.triggerRandomIceTile();
        }
        
        if (this.portalTimer >= settings.portalRate) {
            this.portalTimer = 0;
            this.triggerRandomPortalTile();
        }
        
        if (this.bonusTimer >= settings.bonusRate) {
            this.bonusTimer = 0;
            this.triggerRandomBonusTile();
        }
    }
    
    /**
     * Trigger random tile destruction
     */
    triggerRandomTileDestruction() {
        if (this.arena && this.arena.tiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.arena.tiles.length);
            const tile = this.arena.tiles[randomIndex];
            
            if (tile && tile.state === 'NORMAL') {
                tile.state = 'DESTROYED';
                SDFPhysics.destroyCollider(tile.collider);
                this.createExplosion(tile.position);
            }
        }
    }
    
    /**
     * Trigger random ice tile
     */
    triggerRandomIceTile() {
        if (this.arena && this.arena.tiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.arena.tiles.length);
            const tile = this.arena.tiles[randomIndex];
            
            if (tile && tile.state === 'NORMAL') {
                tile.state = 'ICE';
                tile.isIce = true;
                // Ice effect: reduced friction, slippery
            }
        }
    }
    
    /**
     * Trigger random portal tile
     */
    triggerRandomPortalTile() {
        if (this.arena && this.arena.tiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.arena.tiles.length);
            const tile = this.arena.tiles[randomIndex];
            
            if (tile && tile.state === 'NORMAL') {
                tile.state = 'PORTAL';
                tile.isPortal = true;
                // Portal effect: teleportation
            }
        }
    }
    
    /**
     * Trigger random bonus tile (power-up)
     */
    triggerRandomBonusTile() {
        if (this.arena && this.arena.tiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.arena.tiles.length);
            const tile = this.arena.tiles[randomIndex];
            
            if (tile && tile.state === 'NORMAL') {
                tile.state = 'BONUS';
                tile.isBonus = true;
                // Bonus effect: power-up
            }
        }
    }
    
    /**
     * Create explosion effect
     */
    createExplosion(position) {
        const particles = 20;
        for (let i = 0; i < particles; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = Math.random() * 20 + 10;
            
            this.particles.push({
                position: { ...position },
                velocity: {
                    x: Math.cos(angle) * speed,
                    y: (Math.random() - 0.5) * 10 + 5,
                    z: Math.sin(angle) * speed
                },
                life: 1.0,
                size: Math.random() * 0.5 + 0.3,
                color: 0xff4400
            });
        }
    }
    
    /**
     * Create shockwave effect
     */
    createShockwave(position, radius) {
        this.effects.push({
            type: 'shockwave',
            position,
            radius,
            maxRadius: radius + 5,
            life: 0.5,
            intensity: 1.0
        });
        
        // Update renderer shockwave
        SDFRenderer.triggerShockwave(position, radius, 1.0);
    }
    
    /**
     * Update effects and particles
     */
    updateEffects(deltaTime) {
        // Update particles
        this.particles = this.particles.filter(p => {
            p.position.x += p.velocity.x * deltaTime;
            p.position.y += p.velocity.y * deltaTime;
            p.position.z += p.velocity.z * deltaTime;
            p.velocity.y -= 9.8 * deltaTime; // Gravity
            p.life -= deltaTime;
            return p.life > 0;
        });
        
        // Update effects
        this.effects = this.effects.filter(e => {
            e.life -= deltaTime;
            if (e.type === 'shockwave') {
                e.radius += deltaTime * (e.maxRadius - e.radius) / e.life;
                e.intensity = Math.max(0, e.life / 0.5);
            }
            return e.life > 0;
        });
    }
    
    /**
     * Update camera position to follow players
     */
    updateCamera() {
        // Camera looks at center between players
        const midX = (this.player1.position.x + this.player2.position.x) / 2;
        const midZ = (this.player1.position.z + this.player2.position.z) / 2;
        const distance = Math.hypot(
            this.player2.position.x - this.player1.position.x,
            this.player2.position.z - this.player1.position.z
        );
        
        this.camera.target = { x: midX, y: 2, z: midZ };
        
        // Dynamic camera distance
        const camDistance = Math.max(30, distance + 20);
        this.camera.position = {
            x: midX,
            y: camDistance * 0.5,
            z: midZ + camDistance
        };
        
        SDFRenderer.updateCameraPosition(
            this.camera.position,
            this.camera.target
        );
    }
    
    /**
     * Update renderer with game state
     */
    updateRenderer() {
        // Update time uniform
        if (SDFRenderer.sdfShaderMaterial) {
            SDFRenderer.sdfShaderMaterial.uniforms.uTime.value += this.clock.deltaTime;
        }
        
        SDFRenderer.updatePlayerUniforms(
            this.player1.position,
            this.player2.position,
            this.player1.color,
            this.player2.color
        );
        
        SDFRenderer.updateArenaUniforms(
            this.arena.size,
            this.arena.primaryColor,
            this.arena.secondaryColor
        );
        
        // Render the frame
        if (SDFRenderer.renderer && SDFRenderer.scene && SDFRenderer.camera) {
            SDFRenderer.renderer.render(SDFRenderer.scene, SDFRenderer.camera);
        }
    }
    
    /**
     * Start a new game
     */
    startGame() {
        useGameStore.getState().startGame();
        this.gameState = 'COUNTDOWN';
    }
    
    /**
     * Start playing
     */
    startPlaying() {
        useGameStore.getState().setPlaying();
        this.gameState = 'PLAYING';
        playMusic();
    }
    
    /**
     * End game
     */
    endGame(winner) {
        this.gameState = 'GAME_OVER';
        useGameStore.getState().endRound(winner);
    }
    
    /**
     * Reset game state
     */
    reset() {
        this.createPlayers();
        this.createArena();
        this.particles = [];
        this.effects = [];
        this.destructionTimer = 0;
        this.iceTimer = 0;
        this.portalTimer = 0;
        this.bonusTimer = 0;
        this.gameState = 'MENU';
    }
}

// Export singleton instance
let engineInstance;

export async function initGameEngine(container) {
    engineInstance = new SDFGameEngine();
    await engineInstance.initialize(container);
    return engineInstance;
}

export function getGameEngine() {
    return engineInstance;
}
