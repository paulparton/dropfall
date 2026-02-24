import './style.css';
import * as THREE from 'three';
import { useGameStore } from './store.js';
import { initPhysics, updatePhysics } from './physics.js';
import { initRenderer, updateRenderer, camera, scene, ambientLight, directionalLight } from './renderer.js';
import { initInput, getPlayer1Input, getPlayer2Input } from './input.js';
import { Player } from './entities/Player.js';
import { Arena } from './entities/Arena.js';
import { ParticleSystem } from './entities/ParticleSystem.js';
import { LightningSystem } from './entities/LightningSystem.js';
import { ShockwaveSystem } from './entities/ShockwaveSystem.js';
import { initAudio, playMusic, playCollisionSound, setMusicSpeed } from './audio.js';

let player1, player2, arena, particles, lightning, shockwaves;
const clock = new THREE.Clock();
let collisionCooldown = 0;
let sceneFlashLight;
let winTimer = 0;
let pendingWinner = null;
let roundTimer = 0;
let countdownTimer = 3.0;

async function init() {
    if (window.__GAME_INITIALIZED__) return;
    window.__GAME_INITIALIZED__ = true;

    // 1. Initialize Systems
    initRenderer();
    initInput();
    await initPhysics();

    // Initialize Menu Background
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    // Add global flash light
    sceneFlashLight = new THREE.PointLight(0xffffff, 0, 200);
    sceneFlashLight.position.set(0, 10, 0);
    scene.add(sceneFlashLight);

    // 2. Setup UI Listeners
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('menu-btn').addEventListener('click', returnToMenu);
    
    // HUD Buttons
    document.getElementById('hud-restart-btn').addEventListener('click', () => {
        useGameStore.getState().resetScores();
        startGame();
    });
    document.getElementById('hud-menu-btn').addEventListener('click', returnToMenu);
    
    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('settings-panel').classList.remove('hidden');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-panel').classList.add('hidden');
    });

    // Settings Sliders
    const settingsMap = {
        'sphere-size': 'sphereSize',
        'sphere-weight': 'sphereWeight',
        'sphere-accel': 'sphereAccel',
        'collision-bounce': 'collisionBounce',
        'arena-size': 'arenaSize',
        'destruction-rate': 'destructionRate',
        'ice-rate': 'iceRate',
        'music-volume': 'musicVolume',
        'sfx-volume': 'sfxVolume',
        'particle-amount': 'particleAmount',
        'bloom-level': 'bloomLevel'
    };

    const updateUIFromSettings = () => {
        const settings = useGameStore.getState().settings;
        for (const [id, key] of Object.entries(settingsMap)) {
            const el = document.getElementById(id);
            const valEl = document.getElementById(`${id}-val`);
            if (el && valEl) {
                el.value = settings[key];
                valEl.textContent = settings[key];
            }
        }
        
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = settings.theme || 'default';
        }
        
        // Update control buttons
        document.getElementById('btn-p1-up').textContent = settings.controls.p1.up;
        document.getElementById('btn-p1-down').textContent = settings.controls.p1.down;
        document.getElementById('btn-p1-left').textContent = settings.controls.p1.left;
        document.getElementById('btn-p1-right').textContent = settings.controls.p1.right;
        document.getElementById('btn-p1-boost').textContent = settings.controls.p1.boost;
        document.getElementById('btn-p2-up').textContent = settings.controls.p2.up;
        document.getElementById('btn-p2-down').textContent = settings.controls.p2.down;
        document.getElementById('btn-p2-left').textContent = settings.controls.p2.left;
        document.getElementById('btn-p2-right').textContent = settings.controls.p2.right;
        document.getElementById('btn-p2-boost').textContent = settings.controls.p2.boost;
    };

    // Initialize UI with current settings
    updateUIFromSettings();

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            useGameStore.getState().updateSetting('theme', e.target.value);
            if (useGameStore.getState().gameState === 'MENU') {
                returnToMenu(); // Recreate arena with new theme
            }
        });
    }

    for (const [id, key] of Object.entries(settingsMap)) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            valEl.textContent = val;
            useGameStore.getState().updateSetting(key, val);
            
            // Apply volume immediately
            if (key === 'musicVolume') {
                import('./audio.js').then(module => {
                    module.setMusicVolume(val);
                });
            } else if (key === 'sfxVolume') {
                import('./audio.js').then(module => {
                    module.setSfxVolume(val);
                });
            } else if (key === 'bloomLevel') {
                import('./renderer.js').then(module => {
                    module.setBloomLevel(val);
                });
            }
        });
    }

    // Control Binding Logic
    let activeControlBtn = null;
    const controlBtns = document.querySelectorAll('.control-btn');
    controlBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (activeControlBtn) {
                activeControlBtn.classList.remove('listening');
                activeControlBtn.textContent = activeControlBtn.dataset.originalText;
            }
            activeControlBtn = e.target;
            activeControlBtn.dataset.originalText = activeControlBtn.textContent;
            activeControlBtn.textContent = 'Press Key...';
            activeControlBtn.classList.add('listening');
        });
    });

    window.addEventListener('keydown', (e) => {
        if (activeControlBtn) {
            e.preventDefault();
            const key = e.code;
            activeControlBtn.textContent = key;
            activeControlBtn.classList.remove('listening');
            
            const idParts = activeControlBtn.id.split('-'); // e.g., btn-p1-up
            const player = idParts[1]; // p1 or p2
            const action = idParts[2]; // up, down, left, right
            
            const currentControls = useGameStore.getState().settings.controls;
            const newControls = JSON.parse(JSON.stringify(currentControls));
            newControls[player][action] = key;
            
            useGameStore.getState().updateSetting('controls', newControls);
            activeControlBtn = null;
        }
    });

    document.getElementById('reset-settings-btn').addEventListener('click', () => {
        useGameStore.getState().resetSettings();
        updateUIFromSettings();
        const settings = useGameStore.getState().settings;
        import('./audio.js').then(module => {
            module.setMusicVolume(settings.musicVolume);
            module.setSfxVolume(settings.sfxVolume);
        });
    });

    // Start menu music on first interaction
    document.addEventListener('click', () => {
        if (useGameStore.getState().gameState === 'MENU') {
            initAudio();
            playMusic();
            setMusicSpeed(0.5);
        }
    }, { once: true });

    // 3. Start Game Loop
    animate();
}

function startGame() {
    initAudio();
    playMusic();
    
    useGameStore.getState().startGame();
    
    // Calculate music speed based on total score (level)
    const state = useGameStore.getState();
    const totalScore = state.p1Score + state.p2Score;
    // Level 1 (0 score) = 0.6, Level 5 (4 score) = 1.0
    const speed = 0.6 + (totalScore * 0.1);
    setMusicSpeed(Math.min(speed, 1.0));
    
    resetEntities();
}

function startRound() {
    // Calculate music speed based on total score (level)
    const state = useGameStore.getState();
    const totalScore = state.p1Score + state.p2Score;
    // Level 1 (0 score) = 0.6, Level 5 (4 score) = 1.0
    const speed = 0.6 + (totalScore * 0.1);
    setMusicSpeed(Math.min(speed, 1.0));

    useGameStore.getState().startRound();
    resetEntities();
}

function returnToMenu() {
    useGameStore.getState().returnToMenu();
    setMusicSpeed(0.5);
    if (player1) player1.cleanup();
    if (player2) player2.cleanup();
    if (arena) arena.cleanup();
    if (particles) particles.cleanup();
    if (lightning) lightning.cleanup();
    if (shockwaves) shockwaves.cleanup();
    
    player1 = null;
    player2 = null;
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();
    
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);
}

function resetEntities() {
    // Cleanup previous game state
    if (player1) player1.cleanup();
    if (player2) player2.cleanup();
    if (arena) arena.cleanup();
    if (particles) particles.cleanup();
    if (lightning) lightning.cleanup();
    if (shockwaves) shockwaves.cleanup();

    // Initialize Entities
    player1 = new Player('player1', 0xff4444, { x: -15, y: 4, z: 0 }, getPlayer1Input);
    player2 = new Player('player2', 0x4444ff, { x: 15, y: 4, z: 0 }, getPlayer2Input);
    arena = new Arena();
    particles = new ParticleSystem();
    lightning = new LightningSystem();
    shockwaves = new ShockwaveSystem();

    // Reset Camera
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    pendingWinner = null;
    winTimer = 0;
    roundTimer = 0;
    countdownTimer = 3.0;
}

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta time
    const state = useGameStore.getState();

    if (state.gameState === 'MENU') {
        if (arena) {
            arena.update(delta);
            // Reset arena if too many tiles fell to keep the background full
            if (arena.tiles.filter(t => t.state === 'NORMAL').length < 30) {
                arena.cleanup();
                arena = new Arena();
            }
        }
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);
        updatePhysics(delta);

        // Endless scrolling effect (orbiting camera)
        const time = clock.getElapsedTime();
        camera.position.set(Math.sin(time * 0.1) * 30, 25, Math.cos(time * 0.1) * 30);
        camera.lookAt(0, 0, 0);
    } else if (state.gameState === 'COUNTDOWN' || state.gameState === 'PLAYING') {
        // 1. Update Entities
        if (player1) player1.update(delta, arena, particles);
        if (player2) player2.update(delta, arena, particles);
        if (arena) arena.update(delta);
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);

        // 2. Step Physics
        updatePhysics(delta);

        // 3. Update Camera (Track Midpoint) and Check Player Collisions
        if (collisionCooldown > 0) collisionCooldown -= delta;

        if (player1 && player2 && !player1.isDead && !player2.isDead) {
            const p1Pos = player1.mesh.position;
            const p2Pos = player2.mesh.position;

            const midpoint = new THREE.Vector3().addVectors(p1Pos, p2Pos).multiplyScalar(0.5);
            const distance = p1Pos.distanceTo(p2Pos);
            
            const settings = useGameStore.getState().settings;
            const collisionDistance = settings.sphereSize * 2 + 0.1; // Dynamic collision distance based on sphere size

            // Collision Sparks and Light Flash
            if (distance <= collisionDistance && collisionCooldown <= 0) {
                collisionCooldown = 0.5; // Prevent spamming
                
                // Calculate impact speed
                const v1 = player1.rigidBody.linvel();
                const v2 = player2.rigidBody.linvel();
                const relVel = new THREE.Vector3(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z).length();
                const impactIntensity = Math.min(Math.max(relVel / 20, 1), 5); // Scale 1 to 5

                // Apply bounce impulse
                const dir1 = new THREE.Vector3().subVectors(p1Pos, p2Pos).normalize();
                const dir2 = new THREE.Vector3().subVectors(p2Pos, p1Pos).normalize();
                
                let bounceMultiplier = 1.0;
                if (player1.isBoosting || player2.isBoosting) {
                    bounceMultiplier = 1.5;
                }
                
                const bounceForce = (1500 + (relVel * 10)) * bounceMultiplier; // Scale bounce slightly with impact
                player1.rigidBody.applyImpulse({ x: dir1.x * bounceForce, y: 0, z: dir1.z * bounceForce }, true);
                player2.rigidBody.applyImpulse({ x: dir2.x * bounceForce, y: 0, z: dir2.z * bounceForce }, true);
                
                // Emit sparks at midpoint
                if (particles) {
                    // Less particles, subtle translucent orange/red color
                    const sparkCount = Math.floor(15 * impactIntensity);
                    particles.emit(midpoint, { x: 0, y: 10, z: 0 }, 0xff4400, sparkCount);
                }

                // Flash lights brightly
                player1.glow.intensity = 10.0 * impactIntensity;
                player2.glow.intensity = 10.0 * impactIntensity;

                // Lightning strike
                if (lightning && (player1.isBoosting || player2.isBoosting)) {
                    lightning.emit(midpoint, impactIntensity);
                    
                    // Big lightning effect: dim arena, bright flash
                    if (ambientLight && directionalLight) {
                        ambientLight.intensity = 0.01; // Dim arena to near pitch black
                        directionalLight.intensity = 0.01;
                    }
                    if (sceneFlashLight) {
                        sceneFlashLight.position.copy(midpoint);
                        sceneFlashLight.position.y += 15;
                        sceneFlashLight.intensity = 400.0 * impactIntensity; // Even brighter flash to compensate
                        sceneFlashLight.color.setHex(0x00ffff); // Cyan flash
                    }
                }

                // Play collision sound
                playCollisionSound(impactIntensity);
            }

            // Gradually dim lights back to normal
            if (player1.glow.intensity > 1.0) player1.glow.intensity -= delta * 10;
            if (player2.glow.intensity > 1.0) player2.glow.intensity -= delta * 10;
            if (sceneFlashLight && sceneFlashLight.intensity > 0) sceneFlashLight.intensity -= delta * 40;
            
            // Gradually restore arena lighting (slightly slower for dramatic effect)
            if (ambientLight && ambientLight.intensity < 1.5) {
                ambientLight.intensity += delta * 3;
                if (ambientLight.intensity > 1.5) ambientLight.intensity = 1.5;
            }
            if (directionalLight && directionalLight.intensity < 2.0) {
                directionalLight.intensity += delta * 4;
                if (directionalLight.intensity > 2.0) directionalLight.intensity = 2.0;
            }

            camera.position.lerp(new THREE.Vector3(midpoint.x, Math.max(24, distance * 0.96), midpoint.z + Math.max(24, distance * 0.96)), 2 * delta);
            camera.lookAt(midpoint);
        }

        if (state.gameState === 'COUNTDOWN') {
            countdownTimer -= delta;
            const countdownDisplay = document.getElementById('countdown-display');
            if (countdownTimer > 0) {
                countdownDisplay.textContent = Math.ceil(countdownTimer);
            } else {
                useGameStore.getState().setPlaying();
            }
        } else if (state.gameState === 'PLAYING') {
            // 4. Check Win Conditions
            checkWinConditions(delta);
        }
    } else if (state.gameState === 'GAME_OVER' || state.gameState === 'ROUND_OVER') {
        // Continue updating physics and entities so players keep falling
        if (player1) player1.update(delta, arena, particles);
        if (player2) player2.update(delta, arena, particles);
        if (arena) arena.update(delta);
        if (particles) particles.update(delta);
        if (lightning) lightning.update(delta);
        if (shockwaves) shockwaves.update(delta);
        updatePhysics(delta);

        // Cinematic Camera Orbit
        if (state.winner && state.winner !== 'Draw') {
            const winnerPlayer = state.winner === 'Player 1' ? player1 : player2;
            if (winnerPlayer && !winnerPlayer.isDead) {
                const targetPos = winnerPlayer.mesh.position;
                const time = clock.getElapsedTime();

                const orbitRadius = 10;
                const orbitSpeed = 0.5;

                const x = targetPos.x + orbitRadius * Math.cos(time * orbitSpeed);
                const z = targetPos.z + orbitRadius * Math.sin(time * orbitSpeed);

                camera.position.lerp(new THREE.Vector3(x, targetPos.y + 5, z), 2 * delta);
                camera.lookAt(targetPos);

                // Celebration Particles
                if (Math.random() > 0.9) {
                    particles.emit(targetPos, { x: 0, y: 10, z: 0 }, winnerPlayer.color, 5);
                }
            }
        }

        if (state.gameState === 'ROUND_OVER') {
            roundTimer -= delta;
            if (roundTimer <= 0) {
                startRound();
            }
        }
    }

    // 5. Render Scene
    updateRenderer();
}

function checkWinConditions(delta) {
    if (!player1 || !player2) return;

    if (player1.isDead && player2.isDead) {
        useGameStore.getState().endRound('Draw');
        pendingWinner = null;
        winTimer = 0;
        roundTimer = 3.0;
    } else if (player1.isDead || player2.isDead) {
        if (!pendingWinner) {
            pendingWinner = player1.isDead ? 'Player 2' : 'Player 1';
            winTimer = 0.5;
        } else {
            winTimer -= delta;
            if (winTimer <= 0) {
                useGameStore.getState().endRound(pendingWinner);
                pendingWinner = null;
                roundTimer = 3.0;
            }
        }
    }
}

// Start the application
init();

// HUD Logic
const menuScreen = document.getElementById('menu');
const hudScreen = document.getElementById('hud');
const gameOverScreen = document.getElementById('game-over');
const p1BoostBar = document.getElementById('p1-boost');
const p2BoostBar = document.getElementById('p2-boost');
const p1ScoreText = document.getElementById('p1-score');
const p2ScoreText = document.getElementById('p2-score');
const effectsContainer = document.getElementById('effects');
const winnerText = document.getElementById('winner-text');

useGameStore.subscribe((state, prevState) => {
    // Update Game State UI
    if (state.gameState !== prevState.gameState) {
        if (state.gameState === 'MENU') {
            menuScreen.classList.remove('hidden');
            hudScreen.classList.add('hidden');
            gameOverScreen.classList.add('hidden');
            document.getElementById('countdown-display').classList.add('hidden');
        } else if (state.gameState === 'COUNTDOWN') {
            menuScreen.classList.add('hidden');
            hudScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');
            const countdownDisplay = document.getElementById('countdown-display');
            countdownDisplay.classList.remove('hidden');
            countdownDisplay.textContent = '3';
        } else if (state.gameState === 'PLAYING') {
            menuScreen.classList.add('hidden');
            hudScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');
            const countdownDisplay = document.getElementById('countdown-display');
            countdownDisplay.textContent = 'GO!';
            countdownDisplay.classList.remove('hidden');
            // Ensure countdown is hidden when playing starts
            setTimeout(() => {
                countdownDisplay.classList.add('hidden');
            }, 1000);
        } else if (state.gameState === 'ROUND_OVER') {
            // Keep HUD visible, maybe show a round winner message
        } else if (state.gameState === 'GAME_OVER') {
            menuScreen.classList.add('hidden');
            hudScreen.classList.add('hidden');
            gameOverScreen.classList.remove('hidden');
            winnerText.textContent = state.winner === 'Draw' ? 'Draw!' : `${state.winner} Wins!`;
        }
    }

    // Update Scores
    p1ScoreText.textContent = state.p1Score;
    p2ScoreText.textContent = state.p2Score;

    // Update Boost Meters
    p1BoostBar.style.width = `${state.player1Boost}%`;
    p2BoostBar.style.width = `${state.player2Boost}%`;

    // Update Active Effects
    effectsContainer.innerHTML = state.activeTileEffects.map(e => `<div class="effect ${e.type}">${e.name}</div>`).join('');
});

// Handle Vite HMR
if (import.meta.hot) {
    import.meta.hot.accept(() => {
        window.location.reload();
    });
}
