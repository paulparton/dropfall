/**
 * SDF-Based Physics Engine
 * Collision detection and response using Signed Distance Fields
 * Lightweight physics for Dropfall arena game
 */

import RAPIER from '@dimforge/rapier3d-compat';

export let world;
let initialized = false;

/**
 * Initialize the physics world with gravity
 */
export async function initPhysics() {
    if (initialized) return world;
    
    await RAPIER.init();
    
    // Create physics world with gravity
    const gravity = { x: 0.0, y: -20.0, z: 0.0 };
    world = new RAPIER.World(gravity);
    
    initialized = true;
    return world;
}

/**
 * Create a player rigidbody (sphere)
 */
export function createPlayerBody(position, radius = 1.5, mass = 100.0, restitution = 1.5) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.0)
        .setAngularDamping(0.0);
    
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
        .setMass(mass)
        .setFriction(0.5)
        .setRestitution(restitution);
    
    const collider = world.createCollider(colliderDesc, rigidBody);
    
    return { rigidBody, collider };
}

/**
 * Create arena tile collision body using hexagonal prism
 */
export function createTileBody(position, radius, height) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z);
    
    const rigidBody = world.createRigidBody(rigidBodyDesc);
    
    // Hexagon vertices for collision
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
        .setFriction(0.5)
        .setRestitution(0.1);
    
    const collider = world.createCollider(colliderDesc, rigidBody);
    
    return { rigidBody, collider };
}

/**
 * SDF-based collision query
 * Returns distance to nearest surface from a point
 */
export function querySDFDistance(point, sceneGeometry) {
    // This is a simple implementation - in production would use actual SDF
    // For now, use Rapier's raycast/shapeCast capabilities
    let minDist = Infinity;
    
    // Check distance to all collision bodies
    world.forEachCollider((collider) => {
        const dist = collider.shape.project_point(
            { translation: collider.translation() },
            point,
            true
        );
        
        if (dist && dist.dist < minDist) {
            minDist = dist.dist;
        }
    });
    
    return minDist;
}

/**
 * SDF-based collision detection with response
 */
export function detectCollisionsWithSDF(player1, player2, playerRadius) {
    const collisions = [];
    
    // Get positions
    const p1Pos = player1.rigidBody.translation();
    const p2Pos = player2.rigidBody.translation();
    
    // Direct sphere-sphere collision
    const dist = Math.hypot(
        p2Pos.x - p1Pos.x,
        p2Pos.y - p1Pos.y,
        p2Pos.z - p1Pos.z
    );
    
    if (dist < playerRadius * 2.0) {
        const normal = {
            x: (p2Pos.x - p1Pos.x) / dist,
            y: (p2Pos.y - p1Pos.y) / dist,
            z: (p2Pos.z - p1Pos.z) / dist
        };
        
        collisions.push({
            type: 'player-player',
            normal,
            depth: playerRadius * 2.0 - dist,
            p1: player1,
            p2: player2
        });
    }
    
    return collisions;
}

/**
 * Resolve collision using impulse-based response
 */
export function resolveCollision(collision) {
    const { type, normal, depth, p1, p2 } = collision;
    
    if (type === 'player-player') {
        // Get velocities
        const v1 = p1.rigidBody.linvel();
        const v2 = p2.rigidBody.linvel();
        
        // Relative velocity
        const relVel = {
            x: v2.x - v1.x,
            y: v2.y - v1.y,
            z: v2.z - v1.z
        };
        
        // Velocity along collision normal
        const velAlongNormal = 
            relVel.x * normal.x + 
            relVel.y * normal.y + 
            relVel.z * normal.z;
        
        // Do not resolve if velocities are separating
        if (velAlongNormal > 0) return;
        
        // Calculate impulse scalar
        const restitution = 0.9;
        const e = (p1.rigidBody.mass() + p2.rigidBody.mass()) / 
                  (p1.rigidBody.mass() * p2.rigidBody.mass());
        const j = -(1 + restitution) * velAlongNormal * e / 2;
        
        // Apply impulse
        const impulse = {
            x: j * normal.x,
            y: j * normal.y,
            z: j * normal.z
        };
        
        p1.rigidBody.applyImpulse(
            { 
                x: -impulse.x, 
                y: -impulse.y, 
                z: -impulse.z 
            }, 
            true
        );
        p2.rigidBody.applyImpulse(impulse, true);
        
        // Separate overlapping objects
        const correction = depth * 0.5;
        p1.rigidBody.setTranslation({
            x: p1.rigidBody.translation().x - correction * normal.x,
            y: p1.rigidBody.translation().y - correction * normal.y,
            z: p1.rigidBody.translation().z - correction * normal.z
        });
        p2.rigidBody.setTranslation({
            x: p2.rigidBody.translation().x + correction * normal.x,
            y: p2.rigidBody.translation().y + correction * normal.y,
            z: p2.rigidBody.translation().z + correction * normal.z
        });
    }
}

/**
 * Update physics simulation
 */
export let accumulator = 0;
const timeStep = 1 / 60;

export function updatePhysics(delta) {
    if (world) {
        accumulator += delta;
        
        // Cap accumulator to prevent spiral of death
        if (accumulator > 0.1) accumulator = 0.1;
        
        while (accumulator >= timeStep) {
            world.step();
            accumulator -= timeStep;
        }
    }
}

/**
 * Raycast from a point in a direction
 * Returns hit information for SDF-aware raycasting
 */
export function sdfRaycast(origin, direction, maxDist = 1000) {
    const ray = new RAPIER.Ray(
        origin,
        direction
    );
    
    let hit = null;
    let minDist = maxDist;
    
    world.castRay(ray, maxDist, false, 
        (collider, rayIntersection) => {
            if (rayIntersection.toi < minDist) {
                minDist = rayIntersection.toi;
                hit = {
                    collider,
                    distance: rayIntersection.toi,
                    point: {
                        x: origin.x + direction.x * rayIntersection.toi,
                        y: origin.y + direction.y * rayIntersection.toi,
                        z: origin.z + direction.z * rayIntersection.toi
                    },
                    normal: rayIntersection.normal
                };
            }
            true;
        }
    );
    
    return hit;
}

/**
 * Get all physics bodies in the world
 */
export function getPhysicsBodies() {
    const bodies = [];
    world.forEachRigidBody(rb => bodies.push(rb));
    return bodies;
}

/**
 * Apply force to a body
 */
export function applyForce(rigidBody, force) {
    rigidBody.applyForce(force, true);
}

/**
 * Apply impulse to a body
 */
export function applyImpulse(rigidBody, impulse) {
    rigidBody.applyImpulse(impulse, true);
}

/**
 * Set linear velocity of a body
 */
export function setLinearVelocity(rigidBody, velocity) {
    rigidBody.setLinvel(velocity, true);
}

/**
 * Get linear velocity of a body
 */
export function getLinearVelocity(rigidBody) {
    return rigidBody.linvel();
}

/**
 * Check if point is inside arena (SDF-aware bounds checking)
 */
export function isPointInArenaBounds(point, arenaRadius, floorY, ceilingY) {
    const horizontalDist = Math.hypot(point.x, point.z);
    
    return horizontalDist < arenaRadius && 
           point.y > floorY && 
           point.y < ceilingY;
}

/**
 * Apply arena destruction effect (tiles break/disappear)
 */
export function applyArenaDestruction(impactPoint, radius) {
    // Query all colliders in a region around the impact
    const aabbSize = radius;
    const aabb = new RAPIER.Aabb({
        mins: {
            x: impactPoint.x - aabbSize,
            y: impactPoint.y - aabbSize,
            z: impactPoint.z - aabbSize
        },
        maxs: {
            x: impactPoint.x + aabbSize,
            y: impactPoint.y + aabbSize,
            z: impactPoint.z + aabbSize
        }
    });
    
    const affectedColliders = [];
    world.colliders.forEachColliderContainingPoint(aabb.mins, (c) => {
        if (c.parent()) affectedColliders.push(c);
    });
    
    return affectedColliders;
}

/**
 * Destroy a collider (tile break effect)
 */
export function destroyCollider(collider) {
    if (collider && collider.parent()) {
        const parent = collider.parent();
        world.removeCollider(collider);
        world.removeRigidBody(parent);
    }
}

/**
 * Get ground contact info using SDF
 * Checks if a sphere is touching the ground
 */
export function getGroundContact(position, radius) {
    const searchRadius = radius + 0.1;
    const groundTestRay = new RAPIER.Ray(
        { x: position.x, y: position.y, z: position.z },
        { x: 0, y: -1, z: 0 }
    );
    
    let hit = null;
    world.castRay(groundTestRay, searchRadius, false,
        (collider, rayIntersection) => {
            hit = rayIntersection;
            true;
        }
    );
    
    return hit && hit.toi <= searchRadius;
}
