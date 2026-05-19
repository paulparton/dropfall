import RAPIER from '@dimforge/rapier3d-compat';

export let world;

let initialized = false;

function isMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipot|blackberry|iemobile|opera mini/.test(userAgent) 
        || window.innerWidth < 768;
}

export async function initPhysics() {
    if (window.__RAPIER_INITIALIZED__) {
        world = window.__RAPIER_WORLD__;
        return world;
    }
    await RAPIER.init();
    window.__RAPIER_INITIALIZED__ = true;

    // Custom gravity for Dropfall
    const gravity = { x: 0.0, y: -20.0, z: 0.0 };
    world = new RAPIER.World(gravity);
    
    // Optimize physics on mobile
    if (isMobileDevice()) {
        // Reduce constraints iterations for mobile
        world.maxIslandSize = 32;
        world.constraintSolverIterations = 2;
    }
    
    window.__RAPIER_WORLD__ = world;

    return world;
}

let accumulator = 0;
const isMobile = isMobileDevice();
const timeStep = isMobile ? 1 / 30 : 1 / 60; // Lower timestep on mobile

export function updatePhysics(delta) {
    if (world) {
        accumulator += delta;
        // Cap accumulator to prevent spiral of death if tab is inactive
        if (accumulator > 0.1) accumulator = 0.1;
        
        while (accumulator >= timeStep) {
            world.step();
            accumulator -= timeStep;
        }
    }
}

export function createPlayerBody(position, radius = 1.5, mass = 100.0, restitution = 1.5) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.0) // Unlimited speed
        .setAngularDamping(0.0);
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(radius) // Radius
        .setMass(mass)
        .setFriction(0.5) // Restore friction for rolling
        .setRestitution(restitution); // Explosive bounciness
    const collider = world.createCollider(colliderDesc, rigidBody);

    return { rigidBody, collider };
}

export function createTileBody(position, radius, height) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: 0, y: Math.sin(Math.PI / 12), z: 0, w: Math.cos(Math.PI / 12) }); // 30 degrees Y
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    // Generate exact hexagonal prism vertices to match the visual mesh
    // Make the physics collider 1% smaller than the visual mesh so it doesn't snag when falling
    const pts = [];
    const r = radius * 0.99;
    const h = height / 2;
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = r * Math.sin(angle);
        const z = r * Math.cos(angle);
        pts.push(x, h, z);
        pts.push(x, -h, z);
    }
    
    const colliderDesc = RAPIER.ColliderDesc.convexHull(new Float32Array(pts))
        .setFriction(0.5) // Restore friction for rolling
        .setRestitution(0.1);
    const collider = world.createCollider(colliderDesc, rigidBody);

    return { rigidBody, collider };
}
