import * as THREE from 'three';
import { useGameStore } from '../store.js';

const ARENA_WORLD_SIZE = 64; // Approximate arena diameter in world units.

let vrContainer = null;
let currentScale = 1;
let lastAppliedVRScale = null;

function getSanitizedVRScale() {
    const settings = useGameStore.getState().settings || {};
    const configuredScale = Number.isFinite(settings.vrScale) ? settings.vrScale : 4;
    return THREE.MathUtils.clamp(configuredScale, 1, 10);
}

/**
 * Creates a world container for VR scaling. The user remains at real-world
 * scale, while gameplay objects are reparented into this group.
 */
export function createVRCameraRig(camera, scene) {
    if (!camera) {
        throw new Error('[VRCamera] createVRCameraRig requires a camera');
    }

    if (!scene) {
        throw new Error('[VRCamera] createVRCameraRig requires a scene');
    }

    vrContainer = new THREE.Group();
    vrContainer.name = 'vr-world-container';

    applyVRScale();

    return vrContainer;
}

/**
 * Applies the configured VR world scale so the arena appears as a board on
 * the floor in local-floor reference space.
 */
export function applyVRScale() {
    if (!vrContainer) return;

    const vrScale = getSanitizedVRScale();
    if (lastAppliedVRScale === vrScale) return;

    currentScale = vrScale / ARENA_WORLD_SIZE;
    vrContainer.scale.setScalar(currentScale);
    vrContainer.position.set(0, 0, 0);

    lastAppliedVRScale = vrScale;
}

export function getVRContainer() {
    return vrContainer;
}

function shouldReparentChild(child) {
    if (!child) return false;
    if (child === vrContainer) return false;
    if (child.isCamera) return false;
    if (child.isLight) return false;
    if (child.userData?.excludeFromVRContainer) return false;
    return true;
}

export function reparentToVRContainer(scene) {
    if (!scene || !vrContainer) return;

    const toMove = [];
    scene.children.forEach((child) => {
        if (shouldReparentChild(child)) {
            toMove.push(child);
        }
    });

    toMove.forEach((child) => {
        vrContainer.add(child);
    });

    applyVRScale();
}

export function reparentToScene(scene) {
    if (!scene || !vrContainer) return;

    const toMove = [...vrContainer.children];
    toMove.forEach((child) => {
        scene.add(child);
    });
}

export function updateVRCameraRig(_dolly, _targetPosition) {
    applyVRScale();
}
