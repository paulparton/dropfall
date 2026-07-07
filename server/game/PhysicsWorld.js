import RAPIER from '@dimforge/rapier3d-compat';

let initialized = false;

export async function initPhysics() {
    if (initialized) return;
    await RAPIER.init();
    initialized = true;
}

export function createWorld(gravity = { x: 0, y: -20, z: 0 }) {
    if (!initialized) {
        throw new Error('Physics not initialized. Call initPhysics() first.');
    }
    return new RAPIER.World(gravity);
}

export function createSphere(world, position, radius, options = {}) {
    const {
        mass = 1,
        restitution = 0.9,
        friction = 0.5,
        linearDamping = 0.0,
        angularDamping = 0.0,
    } = options;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(linearDamping)
        .setAngularDamping(angularDamping);

    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
        .setMass(mass)
        .setRestitution(restitution)
        .setFriction(friction);

    const collider = world.createCollider(colliderDesc, body);
    return { body, collider };
}

export function createHexTile(world, position, radius, height, options = {}) {
    const { friction = 0.5, restitution = 0.3 } = options;

    // Approximate a hexagon with a cylinder of 6 segments.
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z);

    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(height / 2, radius)
        .setFriction(friction)
        .setRestitution(restitution);

    const collider = world.createCollider(colliderDesc, body);
    return { body, collider };
}

export { RAPIER };
