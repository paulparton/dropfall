/**
 * ReplayRenderer - applies replay frame data to the 3D scene
 */

import * as THREE from 'three';
import type { FrameState } from './ReplayRecorder.js';
import type { ReplayPlayer } from './ReplayPlayer.js';

export type CameraMode = 'gameplay' | 'close' | 'orbit' | 'topdown' | 'player1' | 'player2';

export const CAMERA_MODES: { mode: CameraMode; label: string }[] = [
  { mode: 'gameplay', label: 'Default' },
  { mode: 'close', label: 'Close' },
  { mode: 'orbit', label: 'Orbit' },
  { mode: 'topdown', label: 'Top Down' },
  { mode: 'player1', label: 'P1 Cam' },
  { mode: 'player2', label: 'P2 Cam' },
];

export class ReplayRenderer {
  private player1: any;
  private player2: any;
  private camera: THREE.PerspectiveCamera;
  private replayPlayer: ReplayPlayer;
  private active: boolean = false;
  private lookAtTarget: THREE.Vector3 = new THREE.Vector3();
  private orbitAngle: number = 0;
  private cameraMode: CameraMode = 'gameplay';

  constructor(
    player1: any,
    player2: any,
    camera: THREE.PerspectiveCamera,
    replayPlayer: ReplayPlayer
  ) {
    this.player1 = player1;
    this.player2 = player2;
    this.camera = camera;
    this.replayPlayer = replayPlayer;
  }

  start(): void {
    this.active = true;
    this.orbitAngle = 0;
    this.updateScene();
  }

  stop(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  updateScene(): void {
    if (!this.active) return;

    const frame = this.replayPlayer.getCurrentFrame();
    if (!frame) return;

    this.applyEntityState(this.player1, frame.player1);
    this.applyEntityState(this.player2, frame.player2);
    this.updateCamera(frame);
  }

  private applyEntityState(player: any, entityState: FrameState['player1']): void {
    if (!player || !player.mesh) return;

    const pos = entityState.position;
    const rot = entityState.rotation;

    player.mesh.position.set(pos.x, pos.y, pos.z);
    player.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    if (player.glow) {
      player.glow.position.set(pos.x, pos.y, pos.z);
    }

    if (player.auraMesh) {
      player.auraMesh.position.set(pos.x, pos.y, pos.z);
    }

    if (player.nameLabel) {
      const sphereSize = player.sphereSize || 2;
      player.nameLabel.position.set(pos.x, pos.y + sphereSize + 3.2, pos.z);
    }

    if (player.hatGroup) {
      const sphereSize = player.sphereSize || 2;
      const sizeScale = player.sizeMultiplier || 1.0;
      player.hatGroup.position.set(pos.x, pos.y + sphereSize * sizeScale, pos.z);
      player.hatGroup.rotation.set(0, player.hatGroup.rotation.y, 0);
    }

    player.isBoosting = entityState.boost > 0;
  }

  private updateCamera(frame: FrameState): void {
    const p1 = frame.player1.position;
    const p2 = frame.player2.position;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const midZ = (p1.z + p2.z) / 2;
    const mid = new THREE.Vector3(midX, midY, midZ);

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    switch (this.cameraMode) {
      case 'gameplay': {
        const target = new THREE.Vector3(
          midX,
          Math.max(24, distance * 0.96),
          midZ + Math.max(24, distance * 0.96)
        );
        this.camera.position.lerp(target, 0.08);
        this.lookAtTarget.lerp(mid, 0.08);
        this.camera.lookAt(this.lookAtTarget);
        break;
      }

      case 'close': {
        const target = new THREE.Vector3(
          midX,
          Math.max(12, distance * 0.5),
          midZ + Math.max(12, distance * 0.5)
        );
        this.camera.position.lerp(target, 0.08);
        this.lookAtTarget.lerp(mid, 0.08);
        this.camera.lookAt(this.lookAtTarget);
        break;
      }

      case 'orbit': {
        this.orbitAngle += 0.012;
        const radius = Math.max(20, distance * 0.8);
        const target = new THREE.Vector3(
          midX + radius * Math.cos(this.orbitAngle),
          midY + 12,
          midZ + radius * Math.sin(this.orbitAngle)
        );
        this.camera.position.lerp(target, 0.06);
        this.lookAtTarget.lerp(mid, 0.08);
        this.camera.lookAt(this.lookAtTarget);
        break;
      }

      case 'topdown': {
        const height = Math.max(35, distance * 1.2);
        const target = new THREE.Vector3(midX, height, midZ + 0.01);
        this.camera.position.lerp(target, 0.08);
        this.lookAtTarget.lerp(mid, 0.08);
        this.camera.lookAt(this.lookAtTarget);
        break;
      }

      case 'player1': {
        const p = frame.player1.position;
        const v = frame.player1.velocity;
        const speed = Math.sqrt(v.x * v.x + v.z * v.z);
        const behindX = speed > 0.5 ? -v.x / speed * 10 : -10;
        const behindZ = speed > 0.5 ? -v.z / speed * 10 : 0;
        const target = new THREE.Vector3(
          p.x + behindX,
          p.y + 6,
          p.z + behindZ
        );
        this.camera.position.lerp(target, 0.06);
        const look = new THREE.Vector3(p.x, p.y, p.z);
        this.lookAtTarget.lerp(look, 0.1);
        this.camera.lookAt(this.lookAtTarget);
        break;
      }

      case 'player2': {
        const p = frame.player2.position;
        const v = frame.player2.velocity;
        const speed = Math.sqrt(v.x * v.x + v.z * v.z);
        const behindX = speed > 0.5 ? -v.x / speed * 10 : -10;
        const behindZ = speed > 0.5 ? -v.z / speed * 10 : 0;
        const target = new THREE.Vector3(
          p.x + behindX,
          p.y + 6,
          p.z + behindZ
        );
        this.camera.position.lerp(target, 0.06);
        const look = new THREE.Vector3(p.x, p.y, p.z);
        this.lookAtTarget.lerp(look, 0.1);
        this.camera.lookAt(this.lookAtTarget);
        break;
      }
    }
  }
}
