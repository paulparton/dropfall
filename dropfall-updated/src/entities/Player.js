import * as THREE from 'three';
import { createPlayerBody, world } from '../physics.js';
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
        this.isDead = false;
        this.freezeTimer = 0;
        this.iceCooldown = 0;
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

        // 4. Rapier Rigid Body
        const { rigidBody, collider } = createPlayerBody(startPosition, this.sphereSize, this.sphereWeight, this.collisionBounce);
        this.rigidBody = rigidBody;
        this.collider = collider;

        // 5. Floating name label (hidden during rounds if player has a hat)
        const storeState = useGameStore.getState();
        this.playerName = id === 'player1' ? (storeState.p1Name || 'Player 1') : (storeState.p2Name || 'Player 2');
        const hatType = id === 'player1' ? (storeState.p1Hat || 'none') : (storeState.p2Hat || 'none');
        this.hatType = hatType;
        if (hatType === 'none') {
            this.nameLabel = this._createNameLabel(this.playerName);
            scene.add(this.nameLabel);
        } else {
            this.nameLabel = null;
        }

        // 6. Hat
        this.hatGroup = this._createHat(hatType);
        if (this.hatGroup) {
            scene.add(this.hatGroup);
        }

        // Hat physics state
        this.hatTiltX = 0;      // Current tilt around X axis
        this.hatTiltZ = 0;      // Current tilt around Z axis
        this.hatTiltVelX = 0;   // Angular velocity X
        this.hatTiltVelZ = 0;   // Angular velocity Z
        this.hatBobOffset = 0;  // Vertical bounce offset
        this.hatBobVel = 0;     // Vertical bounce velocity
        this.hatSquash = 1.0;   // Squash-stretch Y scale
        this.hatSquashVel = 0;
        this.prevVelX = 0;      // Previous frame velocity for accel detection
        this.prevVelY = 0;
        this.prevVelZ = 0;
        this.hatSettleTime = 0; // Extra wobble after events
    }

    update(delta, arena, particles) {
        // 1. Sync Mesh with Physics
        const position = this.rigidBody.translation();
        const rotation = this.rigidBody.rotation();

        this.mesh.position.copy(position);
        this.mesh.quaternion.copy(rotation);
        this.glow.position.copy(position);
        this.auraMesh.position.copy(position);
        if (this.nameLabel) {
            this.nameLabel.position.set(position.x, position.y + this.sphereSize + 3.2, position.z);
        }
        if (this.hatGroup) {
            this._updateHatPhysics(delta, position);
        }

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

        // 3. Check Tile State for Ice and Bonus
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
            
            // Bonus tile logic
            if (tile && tile.state === 'BONUS' && tile.assignedPowerUp) {
                const randomEffect = tile.assignedPowerUp;
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
                
                // Convert bonus tile back to normal (this also removes the sprite)
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

        // 4. Handle Input
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
        if (this.hatGroup) {
            scene.remove(this.hatGroup);
            this.hatGroup.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            this.hatGroup = null;
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.auraMesh.geometry.dispose();
        this.auraMesh.material.dispose();
        setBoostSound(this.id, false);

        if (world && this.rigidBody) {
            world.removeRigidBody(this.rigidBody);
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

    _createHat(type) {
        if (type === 'none') return null;
        const group = new THREE.Group();
        const s = this.sphereSize;

        // Shared material helper
        const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
            color,
            roughness: opts.roughness ?? 0.5,
            metalness: opts.metalness ?? 0.0,
            emissive: opts.emissive ?? color,
            emissiveIntensity: opts.emissiveIntensity ?? 0.08,
            side: opts.side ?? THREE.FrontSide,
            ...opts
        });

        switch (type) {
            case 'santa': {
                // --- Fur brim (fluffy white torus) ---
                const brimGeo = new THREE.TorusGeometry(s * 0.62, s * 0.2, 12, 24);
                const brim = new THREE.Mesh(brimGeo, mat(0xeeeeee, { roughness: 0.9, emissive: 0x444444, emissiveIntensity: 0.15 }));
                brim.rotation.x = Math.PI / 2;
                brim.position.y = s * 0.05;
                brim.castShadow = true;
                group.add(brim);

                // --- Santa hat is built as segmented chain for floppy physics ---
                // We store references to segments so _updateHatPhysics can animate them
                this.santaSegments = [];
                const segCount = 6;
                const segHeight = s * 0.35;
                const coneMat = mat(0xbb0000, { roughness: 0.85, emissive: 0x440000, emissiveIntensity: 0.12, side: THREE.DoubleSide });

                for (let i = 0; i < segCount; i++) {
                    const t0 = i / segCount;
                    const t1 = (i + 1) / segCount;
                    const r0 = s * 0.56 * (1 - t0) * (1 + 0.1 * Math.sin(t0 * Math.PI));
                    const r1 = s * 0.56 * (1 - t1) * (1 + 0.1 * Math.sin(t1 * Math.PI));

                    const segGeo = new THREE.CylinderGeometry(
                        Math.max(r1, 0.01), r0, segHeight, 12, 1, i === segCount - 1
                    );
                    const seg = new THREE.Mesh(segGeo, coneMat);
                    seg.castShadow = true;

                    // Pivot is at the bottom of each segment
                    // Shift geometry up so rotation is around the base
                    segGeo.translate(0, segHeight / 2, 0);

                    const pivot = new THREE.Group();
                    pivot.add(seg);
                    // Position each pivot at the top of the previous segment
                    pivot.position.y = i === 0 ? s * 0.05 : segHeight;

                    this.santaSegments.push({
                        pivot,
                        angle: 0,     // current droop angle (radians)
                        angleVel: 0,  // angular velocity
                        baseAngle: i === 0 ? 0.15 : 0  // slight initial tilt for first segment
                    });

                    if (i === 0) {
                        group.add(pivot);
                    } else {
                        // Parent to previous segment's pivot
                        this.santaSegments[i - 1].pivot.add(pivot);
                    }
                }

                // --- Pom-pom at tip (attached to last segment) ---
                const lastPivot = this.santaSegments[segCount - 1].pivot;
                const pomGroup = new THREE.Group();
                pomGroup.position.y = segHeight;
                for (let i = 0; i < 5; i++) {
                    const pomGeo = new THREE.SphereGeometry(s * (i === 0 ? 0.22 : 0.14), 10, 10);
                    const pom = new THREE.Mesh(pomGeo, mat(0xffffff, { roughness: 0.95, emissive: 0x555555, emissiveIntensity: 0.2 }));
                    const ox = i === 0 ? 0 : (Math.random() - 0.5) * s * 0.18;
                    const oy = i === 0 ? 0 : (Math.random() - 0.5) * s * 0.12;
                    const oz = i === 0 ? 0 : (Math.random() - 0.5) * s * 0.18;
                    pom.position.set(ox, oy, oz);
                    pom.castShadow = true;
                    pomGroup.add(pom);
                }
                lastPivot.add(pomGroup);
                this.santaPomGroup = pomGroup;

                // Initialize floppy physics state
                this.santaDroopX = 0;  // smoothed droop direction
                this.santaDroopZ = -1; // default droop backward
                break;
            }
            case 'cowboy': {
                const leather = mat(0x6B3A20, { roughness: 0.75, emissive: 0x1a0800, emissiveIntensity: 0.06, side: THREE.DoubleSide });
                const darkLeather = mat(0x4A2810, { roughness: 0.7, emissive: 0x100500, emissiveIntensity: 0.05, side: THREE.DoubleSide });

                // --- Wide brim (ring: big cylinder minus inner hole) ---
                // Use a flat ring via LatheGeometry for clean donut-brim
                const brimProfile = [
                    new THREE.Vector2(s * 0.55, s * -0.03),
                    new THREE.Vector2(s * 0.55, s * 0.03),
                    new THREE.Vector2(s * 1.45, s * 0.06),  // slight upward curl at edge
                    new THREE.Vector2(s * 1.5,  s * 0.12),  // front/back lift
                    new THREE.Vector2(s * 1.45, s * 0.06),
                    new THREE.Vector2(s * 0.55, s * -0.03),
                ];
                const brimGeo = new THREE.LatheGeometry(brimProfile, 32);
                const brim = new THREE.Mesh(brimGeo, leather);
                brim.position.y = s * 0.15;
                brim.castShadow = true;
                group.add(brim);

                // --- Crown (closed cylinder with shaped profile + flat top) ---
                const crownProfile = [];
                const crownH = s * 1.0;
                const crownSteps = 16;
                for (let i = 0; i <= crownSteps; i++) {
                    const t = i / crownSteps;
                    // Slightly barrel-shaped: wider at mid, narrower at top
                    const r = s * (0.58 + 0.06 * Math.sin(t * Math.PI) - 0.04 * t);
                    crownProfile.push(new THREE.Vector2(r, s * 0.15 + t * crownH));
                }
                // Close the top — bring radius to 0
                crownProfile.push(new THREE.Vector2(s * 0.52, s * 0.15 + crownH));
                crownProfile.push(new THREE.Vector2(0, s * 0.15 + crownH));
                const crownGeo = new THREE.LatheGeometry(crownProfile, 20);
                const crown = new THREE.Mesh(crownGeo, leather);
                crown.castShadow = true;
                group.add(crown);

                // --- Top dent (crease) — flatten top center downward ---
                const dentGeo = new THREE.CylinderGeometry(s * 0.38, s * 0.42, s * 0.12, 16);
                const dent = new THREE.Mesh(dentGeo, darkLeather);
                dent.position.y = s * 0.15 + crownH - s * 0.04;
                dent.castShadow = true;
                group.add(dent);

                // Front pinch (two small indentations on the crown sides)
                for (let side = -1; side <= 1; side += 2) {
                    const pinch = new THREE.Mesh(
                        new THREE.SphereGeometry(s * 0.15, 8, 8),
                        darkLeather
                    );
                    pinch.scale.set(0.6, 1.0, 0.8);
                    pinch.position.set(side * s * 0.35, s * 0.15 + crownH * 0.85, 0);
                    group.add(pinch);
                }

                // --- Hat band ---
                const bandGeo = new THREE.TorusGeometry(s * 0.6, s * 0.065, 8, 24);
                const band = new THREE.Mesh(bandGeo, mat(0x111111, { roughness: 0.4, metalness: 0.3 }));
                band.rotation.x = Math.PI / 2;
                band.position.y = s * 0.32;
                band.castShadow = true;
                group.add(band);

                // Band buckle
                const buckleGeo = new THREE.BoxGeometry(s * 0.15, s * 0.12, s * 0.04);
                const buckle = new THREE.Mesh(buckleGeo, mat(0xdaa520, { metalness: 0.9, roughness: 0.15, emissive: 0x553300, emissiveIntensity: 0.15 }));
                buckle.position.set(0, s * 0.32, s * 0.63);
                buckle.castShadow = true;
                group.add(buckle);
                break;
            }
            case 'afro': {
                // Build afro from overlapping noisy spheres for a puffy look
                const afroMat = mat(0x1a0800, { roughness: 1.0, metalness: 0.0, emissive: 0x0a0400, emissiveIntensity: 0.04 });

                // Core large sphere
                const coreGeo = new THREE.SphereGeometry(s * 1.35, 20, 20);
                const core = new THREE.Mesh(coreGeo, afroMat);
                core.position.y = s * 0.55;
                core.castShadow = true;
                group.add(core);

                // Lumpy outer layer — multiple offset spheres
                const lumpCount = 14;
                for (let i = 0; i < lumpCount; i++) {
                    const phi = Math.acos(1 - 2 * (i + 0.5) / lumpCount);
                    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
                    const r = s * 1.25;
                    const lumpSize = s * (0.4 + Math.random() * 0.25);
                    const lumpGeo = new THREE.SphereGeometry(lumpSize, 8, 8);
                    const lump = new THREE.Mesh(lumpGeo, afroMat);
                    lump.position.set(
                        r * Math.sin(phi) * Math.cos(theta),
                        s * 0.55 + r * Math.cos(phi) * 0.7 + s * 0.15,
                        r * Math.sin(phi) * Math.sin(theta)
                    );
                    // Only add lumps above the equator
                    if (lump.position.y > s * 0.2) {
                        lump.castShadow = true;
                        group.add(lump);
                    }
                }

                // Hair pick (small handle sticking out)
                const pickHandle = new THREE.Mesh(
                    new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.8, 6),
                    mat(0xff4444, { emissive: 0x440000, emissiveIntensity: 0.1 })
                );
                pickHandle.position.set(s * 1.1, s * 1.0, 0);
                pickHandle.rotation.z = -0.6;
                pickHandle.castShadow = true;
                group.add(pickHandle);
                break;
            }
            case 'crown': {
                const goldMat = mat(0xffd700, { metalness: 0.9, roughness: 0.15, emissive: 0x996600, emissiveIntensity: 0.2 });
                const gemColors = [0xff0044, 0x0066ff, 0x00cc44, 0xff0044, 0x8800ff];

                // --- Base band (thicker, regal cylinder) ---
                const baseGeo = new THREE.CylinderGeometry(s * 0.72, s * 0.78, s * 0.4, 24);
                const base = new THREE.Mesh(baseGeo, goldMat);
                base.position.y = s * 0.22;
                base.castShadow = true;
                group.add(base);

                // Lower trim ring
                const trimGeo = new THREE.TorusGeometry(s * 0.76, s * 0.04, 8, 24);
                const trim = new THREE.Mesh(trimGeo, mat(0xffaa00, { metalness: 0.95, roughness: 0.1, emissive: 0x664400, emissiveIntensity: 0.15 }));
                trim.rotation.x = Math.PI / 2;
                trim.position.y = s * 0.04;
                group.add(trim);

                // --- 5 Crown points (taller, elegant) ---
                const pointCount = 5;
                for (let i = 0; i < pointCount; i++) {
                    const angle = (i / pointCount) * Math.PI * 2;
                    const px = Math.cos(angle) * s * 0.58;
                    const pz = Math.sin(angle) * s * 0.58;

                    // Main point — elongated octahedron-like shape using two cones
                    const topCone = new THREE.Mesh(
                        new THREE.ConeGeometry(s * 0.14, s * 0.55, 5),
                        goldMat
                    );
                    topCone.position.set(px, s * 0.7, pz);
                    topCone.castShadow = true;
                    group.add(topCone);

                    // Small sphere tip
                    const tip = new THREE.Mesh(
                        new THREE.SphereGeometry(s * 0.06, 8, 8),
                        goldMat
                    );
                    tip.position.set(px, s * 0.98, pz);
                    group.add(tip);

                    // Connecting arch between points
                    if (i < pointCount) {
                        const nextAngle = ((i + 1) / pointCount) * Math.PI * 2;
                        const midAngle = (angle + nextAngle) / 2;
                        const archGeo = new THREE.TorusGeometry(s * 0.15, s * 0.025, 6, 8, Math.PI);
                        const arch = new THREE.Mesh(archGeo, goldMat);
                        arch.position.set(
                            Math.cos(midAngle) * s * 0.58,
                            s * 0.42,
                            Math.sin(midAngle) * s * 0.58
                        );
                        arch.rotation.y = -midAngle + Math.PI / 2;
                        arch.rotation.x = Math.PI;
                        group.add(arch);
                    }

                    // Gem inset on each point
                    const gem = new THREE.Mesh(
                        new THREE.OctahedronGeometry(s * 0.08, 1),
                        mat(gemColors[i], { metalness: 0.1, roughness: 0.05, emissive: gemColors[i], emissiveIntensity: 0.6, transparent: true, opacity: 0.9 })
                    );
                    gem.position.set(px * 1.08, s * 0.42, pz * 1.08);
                    gem.rotation.y = angle;
                    gem.castShadow = true;
                    group.add(gem);
                }

                // --- Velvet cushion (inner top, red) ---
                const cushion = new THREE.Mesh(
                    new THREE.SphereGeometry(s * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
                    mat(0x880022, { roughness: 0.95, emissive: 0x220008, emissiveIntensity: 0.08, side: THREE.DoubleSide })
                );
                cushion.position.y = s * 0.42;
                cushion.scale.y = 0.4;
                group.add(cushion);

                // --- Cross/orb on top ---
                const orb = new THREE.Mesh(
                    new THREE.SphereGeometry(s * 0.08, 10, 10),
                    goldMat
                );
                orb.position.y = s * 1.05;
                group.add(orb);
                const crossV = new THREE.Mesh(
                    new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.2, 6),
                    goldMat
                );
                crossV.position.y = s * 1.2;
                group.add(crossV);
                const crossH = new THREE.Mesh(
                    new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.14, 6),
                    goldMat
                );
                crossH.position.y = s * 1.22;
                crossH.rotation.z = Math.PI / 2;
                group.add(crossH);
                break;
            }
            case 'dunce': {
                // --- Tall paper cone with visible seam ---
                const coneH = s * 2.8;
                const coneR = s * 0.65;
                const coneProfile = [];
                for (let i = 0; i <= 20; i++) {
                    const t = i / 20;
                    const r = coneR * (1 - t * t * 0.8 - t * 0.2);
                    coneProfile.push(new THREE.Vector2(Math.max(r, 0.001), t * coneH));
                }
                const coneGeo = new THREE.LatheGeometry(coneProfile, 24);
                const coneMat = mat(0xf5f0d0, { roughness: 0.92, metalness: 0.0, emissive: 0x333322, emissiveIntensity: 0.06, side: THREE.DoubleSide });
                const cone = new THREE.Mesh(coneGeo, coneMat);
                cone.position.y = 0;
                cone.castShadow = true;
                group.add(cone);

                // --- "DUNCE" text as flat planes on the cone surface ---
                const makeTextPlane = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 256;
                    canvas.height = 96;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, 256, 96);
                    // Red hand-drawn text
                    ctx.font = 'bold 72px "Times New Roman", serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    // Outline for visibility
                    ctx.strokeStyle = '#600000';
                    ctx.lineWidth = 4;
                    ctx.strokeText('DUNCE', 128, 44);
                    ctx.fillStyle = '#cc0000';
                    ctx.fillText('DUNCE', 128, 44);
                    // Underline
                    ctx.strokeStyle = '#cc0000';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(24, 76);
                    ctx.lineTo(232, 76);
                    ctx.stroke();
                    const tex = new THREE.CanvasTexture(canvas);
                    const planeGeo = new THREE.PlaneGeometry(s * 1.6, s * 0.6);
                    const planeMat = new THREE.MeshBasicMaterial({
                        map: tex,
                        transparent: true,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    });
                    return new THREE.Mesh(planeGeo, planeMat);
                };

                // Front label
                const frontLabel = makeTextPlane();
                const labelHeight = coneH * 0.28;
                const labelRadius = coneR * 0.6 + 0.02;
                frontLabel.position.set(0, labelHeight, labelRadius);
                group.add(frontLabel);

                // Back label
                const backLabel = makeTextPlane();
                backLabel.position.set(0, labelHeight, -labelRadius);
                backLabel.rotation.y = Math.PI;
                group.add(backLabel);

                // --- Elastic band under chin (decorative) ---
                const elastic = new THREE.Mesh(
                    new THREE.TorusGeometry(s * 0.5, s * 0.02, 6, 16),
                    mat(0x333333, { roughness: 0.6 })
                );
                elastic.rotation.x = Math.PI / 2;
                elastic.position.y = -s * 0.1;
                group.add(elastic);
                break;
            }
        }

        // Enable shadow casting on all meshes
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return group;
    }

    _updateHatPhysics(delta, position) {
        if (!this.hatGroup) return;

        const vel = this.rigidBody.linvel();
        const dt = Math.min(delta, 0.05); // Clamp for stability

        // --- Detect acceleration (change in velocity) ---
        const accelX = (vel.x - this.prevVelX) / Math.max(dt, 0.001);
        const accelY = (vel.y - this.prevVelY) / Math.max(dt, 0.001);
        const accelZ = (vel.z - this.prevVelZ) / Math.max(dt, 0.001);
        this.prevVelX = vel.x;
        this.prevVelY = vel.y;
        this.prevVelZ = vel.z;

        // --- Spring-damper tilt based on lateral acceleration ---
        const tiltStiffness = 18.0;
        const tiltDamping = 4.5;
        const accelInfluence = 0.0025;

        const targetTiltZ = -accelX * accelInfluence;
        const targetTiltX = accelZ * accelInfluence;

        const maxTilt = 0.6;
        const clampedTiltX = Math.max(-maxTilt, Math.min(maxTilt, targetTiltX));
        const clampedTiltZ = Math.max(-maxTilt, Math.min(maxTilt, targetTiltZ));

        const forceX = tiltStiffness * (clampedTiltX - this.hatTiltX) - tiltDamping * this.hatTiltVelX;
        const forceZ = tiltStiffness * (clampedTiltZ - this.hatTiltZ) - tiltDamping * this.hatTiltVelZ;
        this.hatTiltVelX += forceX * dt;
        this.hatTiltVelZ += forceZ * dt;
        this.hatTiltX += this.hatTiltVelX * dt;
        this.hatTiltZ += this.hatTiltVelZ * dt;

        // --- Vertical bob from Y acceleration ---
        const bobStiffness = 30.0;
        const bobDamping = 5.0;
        const bobTarget = -accelY * 0.003;
        const bobForce = bobStiffness * (Math.max(-0.3, Math.min(0.3, bobTarget)) - this.hatBobOffset) - bobDamping * this.hatBobVel;
        this.hatBobVel += bobForce * dt;
        this.hatBobOffset += this.hatBobVel * dt;

        // --- Squash-stretch ---
        const squashStiffness = 40.0;
        const squashDamping = 6.0;
        const squashTarget = 1.0 + accelY * 0.0008;
        const squashForce = squashStiffness * (Math.max(0.7, Math.min(1.3, squashTarget)) - this.hatSquash) - squashDamping * this.hatSquashVel;
        this.hatSquashVel += squashForce * dt;
        this.hatSquash += this.hatSquashVel * dt;
        this.hatSquash = Math.max(0.75, Math.min(1.25, this.hatSquash));

        // --- Speed wobble ---
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        const wobbleIntensity = Math.min(speed * 0.002, 0.08);
        const time = performance.now() * 0.001;
        const wobbleX = Math.sin(time * 12) * wobbleIntensity;
        const wobbleZ = Math.cos(time * 15) * wobbleIntensity;

        // --- Apply to hat group ---
        const sizeScale = this.sizeMultiplier || 1.0;
        this.hatGroup.position.set(
            position.x,
            position.y + this.sphereSize * sizeScale + this.hatBobOffset,
            position.z
        );

        this.hatGroup.rotation.x = this.hatTiltX + wobbleX;
        this.hatGroup.rotation.z = this.hatTiltZ + wobbleZ;

        // Squash-stretch
        const invSquash = 1.0 / Math.sqrt(this.hatSquash);
        this.hatGroup.scale.set(
            sizeScale * invSquash,
            sizeScale * this.hatSquash,
            sizeScale * invSquash
        );

        // --- Santa floppy chain physics ---
        if (this.santaSegments && this.santaSegments.length > 0) {
            const gravity = 14.0;
            const stiffness = 22.0;
            const damping = 6.5;
            const velInfluence = 0.08;  // How much velocity pulls the hat

            // Smoothly track the droop direction (opposite to velocity)
            // This gives the hat a consistent trailing direction
            if (speed > 1.0) {
                // Droop AWAY from travel = opposite of velocity
                const targetDroopX = -vel.x / speed;
                const targetDroopZ = -vel.z / speed;
                const smoothing = 1.0 - Math.exp(-6.0 * dt);
                this.santaDroopX += (targetDroopX - this.santaDroopX) * smoothing;
                this.santaDroopZ += (targetDroopZ - this.santaDroopZ) * smoothing;
            }
            // Normalize droop direction
            const droopLen = Math.sqrt(this.santaDroopX * this.santaDroopX + this.santaDroopZ * this.santaDroopZ);
            const dX = droopLen > 0.01 ? this.santaDroopX / droopLen : 0;
            const dZ = droopLen > 0.01 ? this.santaDroopZ / droopLen : -1;

            // Speed-based droop: faster = more droop
            const speedDroop = Math.min(speed * velInfluence, 1.2);

            for (let i = 0; i < this.santaSegments.length; i++) {
                const seg = this.santaSegments[i];
                const flopFactor = 0.3 + (i / this.santaSegments.length) * 0.7;
                const segStiffness = stiffness * (1.0 - flopFactor * 0.65);
                const segDamping = damping * (1.0 - flopFactor * 0.35);

                // Target droop angle: gravity + velocity trailing
                const gravDroop = 0.15 * (i + 1) * flopFactor;
                const velDroop = speedDroop * flopFactor * 0.4;
                const targetAngle = seg.baseAngle + gravDroop + velDroop;

                // Spring-damper for smooth motion
                const springForce = segStiffness * (targetAngle - seg.angle) - segDamping * seg.angleVel;
                const gravTorque = gravity * flopFactor * Math.sin(seg.angle) * 0.04;

                seg.angleVel += (springForce + gravTorque) * dt;
                seg.angle += seg.angleVel * dt;

                const maxAngle = 1.4 + i * 0.2;
                seg.angle = Math.max(-maxAngle, Math.min(maxAngle, seg.angle));

                // Apply rotation: tilt toward the smoothed droop direction
                // Rotation around X tilts forward/backward (Z direction)
                // Rotation around Z tilts left/right (X direction)
                seg.pivot.rotation.x = seg.angle * dZ;
                seg.pivot.rotation.z = seg.angle * -dX;
            }
        }
    }
}
