import * as THREE from 'three';
import { SantaSegment } from './hatFactory.js';

export interface HatPhysicsState {
  hatTiltX: number;
  hatTiltZ: number;
  hatTiltVelX: number;
  hatTiltVelZ: number;
  hatBobOffset: number;
  hatBobVel: number;
  hatSquash: number;
  hatSquashVel: number;
  prevVelX: number;
  prevVelY: number;
  prevVelZ: number;
  santaSegments: SantaSegment[];
  santaDroopX: number;
  santaDroopZ: number;
}

export function createHatPhysicsState(): HatPhysicsState {
  return {
    hatTiltX: 0,
    hatTiltZ: 0,
    hatTiltVelX: 0,
    hatTiltVelZ: 0,
    hatBobOffset: 0,
    hatBobVel: 0,
    hatSquash: 1.0,
    hatSquashVel: 0,
    prevVelX: 0,
    prevVelY: 0,
    prevVelZ: 0,
    santaSegments: [],
    santaDroopX: 0,
    santaDroopZ: 0,
  };
}

export function updateHatPhysics(
  hatGroup: THREE.Group,
  velocity: { x: number; y: number; z: number },
  ballPosition: THREE.Vector3,
  sphereSize: number,
  state: HatPhysicsState,
  delta: number,
  santaPomGroup: THREE.Group | null = null,
): void {
  if (!hatGroup) return;

  const vel = velocity;
  const dt = Math.min(delta, 0.05);

  const accelX = (vel.x - state.prevVelX) / Math.max(dt, 0.001);
  const accelY = (vel.y - state.prevVelY) / Math.max(dt, 0.001);
  const accelZ = (vel.z - state.prevVelZ) / Math.max(dt, 0.001);
  state.prevVelX = vel.x;
  state.prevVelY = vel.y;
  state.prevVelZ = vel.z;

  const tiltStiffness = 18.0;
  const tiltDamping = 4.5;
  const accelInfluence = 0.0025;

  const targetTiltZ = -accelX * accelInfluence;
  const targetTiltX = accelZ * accelInfluence;

  const maxTilt = 0.6;
  const clampedTiltX = Math.max(-maxTilt, Math.min(maxTilt, targetTiltX));
  const clampedTiltZ = Math.max(-maxTilt, Math.min(maxTilt, targetTiltZ));

  const forceX = tiltStiffness * (clampedTiltX - state.hatTiltX) - tiltDamping * state.hatTiltVelX;
  const forceZ = tiltStiffness * (clampedTiltZ - state.hatTiltZ) - tiltDamping * state.hatTiltVelZ;
  state.hatTiltVelX += forceX * dt;
  state.hatTiltVelZ += forceZ * dt;
  state.hatTiltX += state.hatTiltVelX * dt;
  state.hatTiltZ += state.hatTiltVelZ * dt;

  const bobStiffness = 30.0;
  const bobDamping = 5.0;
  const bobTarget = -accelY * 0.003;
  const bobForce = bobStiffness * (Math.max(-0.3, Math.min(0.3, bobTarget)) - state.hatBobOffset) - bobDamping * state.hatBobVel;
  state.hatBobVel += bobForce * dt;
  state.hatBobOffset += state.hatBobVel * dt;

  const squashStiffness = 40.0;
  const squashDamping = 6.0;
  const squashTarget = 1.0 + accelY * 0.0008;
  const squashForce = squashStiffness * (Math.max(0.7, Math.min(1.3, squashTarget)) - state.hatSquash) - squashDamping * state.hatSquashVel;
  state.hatSquashVel += squashForce * dt;
  state.hatSquash += state.hatSquashVel * dt;
  state.hatSquash = Math.max(0.75, Math.min(1.25, state.hatSquash));

  const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  const wobbleIntensity = Math.min(speed * 0.002, 0.08);
  const time = performance.now() * 0.001;
  const wobbleX = Math.sin(time * 12) * wobbleIntensity;
  const wobbleZ = Math.cos(time * 15) * wobbleIntensity;

  const sizeScale = 1.0;
  hatGroup.position.set(
    ballPosition.x,
    ballPosition.y + sphereSize * sizeScale + state.hatBobOffset,
    ballPosition.z,
  );

  hatGroup.rotation.x = state.hatTiltX + wobbleX;
  hatGroup.rotation.z = state.hatTiltZ + wobbleZ;

  const invSquash = 1.0 / Math.sqrt(state.hatSquash);
  hatGroup.scale.set(
    sizeScale * invSquash,
    sizeScale * state.hatSquash,
    sizeScale * invSquash,
  );

  if (state.santaSegments && state.santaSegments.length > 0) {
    const gravity = 14.0;
    const stiffness = 22.0;
    const damping = 6.5;
    const velInfluence = 0.08;

    if (speed > 1.0) {
      const targetDroopX = -vel.x / speed;
      const targetDroopZ = -vel.z / speed;
      const smoothing = 1.0 - Math.exp(-6.0 * dt);
      state.santaDroopX += (targetDroopX - state.santaDroopX) * smoothing;
      state.santaDroopZ += (targetDroopZ - state.santaDroopZ) * smoothing;
    }
    const droopLen = Math.sqrt(state.santaDroopX * state.santaDroopX + state.santaDroopZ * state.santaDroopZ);
    const dX = droopLen > 0.01 ? state.santaDroopX / droopLen : 0;
    const dZ = droopLen > 0.01 ? state.santaDroopZ / droopLen : -1;

    const speedDroop = Math.min(speed * velInfluence, 1.2);

    for (let i = 0; i < state.santaSegments.length; i++) {
      const seg = state.santaSegments[i];
      const flopFactor = 0.3 + (i / state.santaSegments.length) * 0.7;
      const segStiffness = stiffness * (1.0 - flopFactor * 0.65);
      const segDamping = damping * (1.0 - flopFactor * 0.35);

      const gravDroop = 0.15 * (i + 1) * flopFactor;
      const velDroop = speedDroop * flopFactor * 0.4;
      const targetAngle = seg.baseAngle + gravDroop + velDroop;

      const springForce = segStiffness * (targetAngle - seg.angle) - segDamping * seg.angleVel;
      const gravTorque = gravity * flopFactor * Math.sin(seg.angle) * 0.04;

      seg.angleVel += (springForce + gravTorque) * dt;
      seg.angle += seg.angleVel * dt;

      const maxAngle = 1.4 + i * 0.2;
      seg.angle = Math.max(-maxAngle, Math.min(maxAngle, seg.angle));

      seg.pivot.rotation.x = seg.angle * dZ;
      seg.pivot.rotation.z = seg.angle * -dX;
    }
  }

  if (!santaPomGroup) return;
}
