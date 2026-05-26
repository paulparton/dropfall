import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let activeRenderer = null;
let sessionStartCallback = null;
let sessionEndCallback = null;

export function initVR(renderer) {
    if (!renderer) {
        throw new Error('[VRSession] initVR requires a valid renderer');
    }

    activeRenderer = renderer;
    activeRenderer.xr.enabled = true;
    activeRenderer.xr.setReferenceSpaceType('local-floor');
    activeRenderer.xr.setFramebufferScaleFactor(1.0);

    activeRenderer.xr.addEventListener('sessionstart', () => {
        console.log('[VRSession] XR session started');
        if (sessionStartCallback) {
            sessionStartCallback();
        }
    });

    activeRenderer.xr.addEventListener('sessionend', () => {
        console.log('[VRSession] XR session ended');
        if (sessionEndCallback) {
            sessionEndCallback();
        }
    });

    return VRButton.createButton(activeRenderer);
}

export function isInVR() {
    return !!(activeRenderer && activeRenderer.xr && activeRenderer.xr.isPresenting);
}

export function initAR(renderer) {
    if (!renderer) {
        throw new Error('[VRSession] initAR requires a valid renderer');
    }

    activeRenderer = renderer;
    activeRenderer.xr.enabled = true;
    activeRenderer.xr.setReferenceSpaceType('local-floor');
    activeRenderer.xr.setFramebufferScaleFactor(1.0);

    activeRenderer.xr.addEventListener('sessionstart', () => {
        console.log('[VRSession] AR session started');
        // In AR mode: clear scene background so passthrough shows
        if (activeRenderer.xr.getSession()?.mode === 'immersive-ar') {
            const scene = activeRenderer.domElement?.__threeScene;
            if (scene) scene.background = null;
        }
        if (sessionStartCallback) sessionStartCallback();
    });

    activeRenderer.xr.addEventListener('sessionend', () => {
        console.log('[VRSession] AR session ended');
        if (sessionEndCallback) sessionEndCallback();
    });

    return ARButton.createButton(activeRenderer, {
        requiredFeatures: [],
        optionalFeatures: ['dom-overlay']
    });
}

export function isInAR() {
    if (!activeRenderer || !activeRenderer.xr) return false;
    const session = activeRenderer.xr.getSession();
    return !!(session && session.mode === 'immersive-ar');
}

export function getXRSessionMode() {
    if (!activeRenderer || !activeRenderer.xr) return null;
    const session = activeRenderer.xr.getSession();
    return session ? session.mode : null;
}

export function getXRSession() {
    if (!activeRenderer || !activeRenderer.xr) return null;
    return activeRenderer.xr.getSession();
}

export function onVRSessionStart(cb) {
    sessionStartCallback = typeof cb === 'function' ? cb : null;
}

export function onVRSessionEnd(cb) {
    sessionEndCallback = typeof cb === 'function' ? cb : null;
}
