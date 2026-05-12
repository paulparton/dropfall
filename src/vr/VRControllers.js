import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const AXIS_THRESHOLD = 0.3;

let activeRenderer = null;
let leftController = null;
let rightController = null;
let leftGrip = null;
let rightGrip = null;

const vrInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false
};

function resetVRInput() {
    vrInput.forward = false;
    vrInput.backward = false;
    vrInput.left = false;
    vrInput.right = false;
    vrInput.boost = false;
}

function applyMovementFromAxes(axes) {
    if (!axes || axes.length < 4) return;

    const x = axes[2] || 0;
    const y = axes[3] || 0;

    vrInput.left = x < -AXIS_THRESHOLD;
    vrInput.right = x > AXIS_THRESHOLD;
    vrInput.forward = y < -AXIS_THRESHOLD;
    vrInput.backward = y > AXIS_THRESHOLD;
}

function applyBoostFromButtons(buttons) {
    if (!buttons || buttons.length === 0) return;
    const trigger = buttons[0];
    if (trigger && trigger.pressed) {
        vrInput.boost = true;
    }
}

export function initControllers(renderer, scene) {
    if (!renderer || !scene) {
        throw new Error('[VRControllers] initControllers requires renderer and scene');
    }

    activeRenderer = renderer;

    leftController = activeRenderer.xr.getController(0);
    rightController = activeRenderer.xr.getController(1);

    leftGrip = activeRenderer.xr.getControllerGrip(0);
    rightGrip = activeRenderer.xr.getControllerGrip(1);

    const controllerModelFactory = new XRControllerModelFactory();
    leftGrip.add(controllerModelFactory.createControllerModel(leftGrip));
    rightGrip.add(controllerModelFactory.createControllerModel(rightGrip));

    scene.add(leftController);
    scene.add(rightController);
    scene.add(leftGrip);
    scene.add(rightGrip);

    return {
        leftController,
        rightController,
        leftGrip,
        rightGrip
    };
}

export function updateControllers() {
    resetVRInput();

    if (!activeRenderer || !activeRenderer.xr) return;

    const session = activeRenderer.xr.getSession();
    if (!session) return;

    const inputSources = session.inputSources || [];

    for (let i = 0; i < inputSources.length; i += 1) {
        const source = inputSources[i];
        const gamepad = source && source.gamepad;
        if (!gamepad) continue;

        if (source.handedness === 'left') {
            applyMovementFromAxes(gamepad.axes);
            applyBoostFromButtons(gamepad.buttons);
        } else if (source.handedness === 'right') {
            applyBoostFromButtons(gamepad.buttons);
        } else {
            // Fallback for browsers that do not expose handedness consistently.
            if (i === 0) applyMovementFromAxes(gamepad.axes);
            applyBoostFromButtons(gamepad.buttons);
        }
    }
}

export function getVRInput() {
    return {
        forward: vrInput.forward,
        backward: vrInput.backward,
        left: vrInput.left,
        right: vrInput.right,
        boost: vrInput.boost
    };
}
