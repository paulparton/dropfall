import * as THREE from 'three';

export interface SantaSegment {
  pivot: THREE.Group;
  angle: number;
  angleVel: number;
  baseAngle: number;
}

export interface HatResult {
  group: THREE.Group;
  santaSegments: SantaSegment[];
  santaPomGroup: THREE.Group | null;
  santaDroopX: number;
  santaDroopZ: number;
}

export function createHatMesh(type: string, sphereSize: number): HatResult | null {
  if (type === 'none') return null;

  const group = new THREE.Group();
  const s = sphereSize;
  const santaSegments: SantaSegment[] = [];
  let santaPomGroup: THREE.Group | null = null;
  let santaDroopX = 0;
  let santaDroopZ = -1;

  const mat = (color: number, opts: Record<string, unknown> = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: (opts.roughness as number | undefined) ?? 0.5,
    metalness: (opts.metalness as number | undefined) ?? 0.0,
    emissive: (opts.emissive as number | undefined) ?? color,
    emissiveIntensity: (opts.emissiveIntensity as number | undefined) ?? 0.08,
    side: (opts.side as THREE.Side | undefined) ?? THREE.FrontSide,
    ...opts,
  });

  switch (type) {
    case 'santa': {
      const brimGeo = new THREE.TorusGeometry(s * 0.62, s * 0.2, 12, 24);
      const brim = new THREE.Mesh(brimGeo, mat(0xeeeeee, { roughness: 0.9, emissive: 0x444444, emissiveIntensity: 0.15 }));
      brim.rotation.x = Math.PI / 2;
      brim.position.y = s * 0.05;
      brim.castShadow = true;
      group.add(brim);

      const segCount = 6;
      const segHeight = s * 0.35;
      const coneMat = mat(0xbb0000, { roughness: 0.85, emissive: 0x440000, emissiveIntensity: 0.12, side: THREE.DoubleSide });

      for (let i = 0; i < segCount; i++) {
        const t0 = i / segCount;
        const t1 = (i + 1) / segCount;
        const r0 = s * 0.56 * (1 - t0) * (1 + 0.1 * Math.sin(t0 * Math.PI));
        const r1 = s * 0.56 * (1 - t1) * (1 + 0.1 * Math.sin(t1 * Math.PI));

        const segGeo = new THREE.CylinderGeometry(
          Math.max(r1, 0.01),
          r0,
          segHeight,
          12,
          1,
          i === segCount - 1,
        );
        const seg = new THREE.Mesh(segGeo, coneMat);
        seg.castShadow = true;
        segGeo.translate(0, segHeight / 2, 0);

        const pivot = new THREE.Group();
        pivot.add(seg);
        pivot.position.y = i === 0 ? s * 0.05 : segHeight;

        santaSegments.push({
          pivot,
          angle: 0,
          angleVel: 0,
          baseAngle: i === 0 ? 0.15 : 0,
        });

        if (i === 0) {
          group.add(pivot);
        } else {
          santaSegments[i - 1].pivot.add(pivot);
        }
      }

      const lastPivot = santaSegments[segCount - 1].pivot;
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
      santaPomGroup = pomGroup;
      santaDroopX = 0;
      santaDroopZ = -1;
      break;
    }
    case 'cowboy': {
      const leather = mat(0x6b3a20, { roughness: 0.75, emissive: 0x1a0800, emissiveIntensity: 0.06, side: THREE.DoubleSide });
      const darkLeather = mat(0x4a2810, { roughness: 0.7, emissive: 0x100500, emissiveIntensity: 0.05, side: THREE.DoubleSide });

      const brimProfile = [
        new THREE.Vector2(s * 0.55, s * -0.03),
        new THREE.Vector2(s * 0.55, s * 0.03),
        new THREE.Vector2(s * 1.45, s * 0.06),
        new THREE.Vector2(s * 1.5, s * 0.12),
        new THREE.Vector2(s * 1.45, s * 0.06),
        new THREE.Vector2(s * 0.55, s * -0.03),
      ];
      const brimGeo = new THREE.LatheGeometry(brimProfile, 32);
      const brim = new THREE.Mesh(brimGeo, leather);
      brim.position.y = s * 0.15;
      brim.castShadow = true;
      group.add(brim);

      const crownProfile: THREE.Vector2[] = [];
      const crownH = s * 1.0;
      const crownSteps = 16;
      for (let i = 0; i <= crownSteps; i++) {
        const t = i / crownSteps;
        const r = s * (0.58 + 0.06 * Math.sin(t * Math.PI) - 0.04 * t);
        crownProfile.push(new THREE.Vector2(r, s * 0.15 + t * crownH));
      }
      crownProfile.push(new THREE.Vector2(s * 0.52, s * 0.15 + crownH));
      crownProfile.push(new THREE.Vector2(0, s * 0.15 + crownH));
      const crownGeo = new THREE.LatheGeometry(crownProfile, 20);
      const crown = new THREE.Mesh(crownGeo, leather);
      crown.castShadow = true;
      group.add(crown);

      const dentGeo = new THREE.CylinderGeometry(s * 0.38, s * 0.42, s * 0.12, 16);
      const dent = new THREE.Mesh(dentGeo, darkLeather);
      dent.position.y = s * 0.15 + crownH - s * 0.04;
      dent.castShadow = true;
      group.add(dent);

      for (let side = -1; side <= 1; side += 2) {
        const pinch = new THREE.Mesh(
          new THREE.SphereGeometry(s * 0.15, 8, 8),
          darkLeather,
        );
        pinch.scale.set(0.6, 1.0, 0.8);
        pinch.position.set(side * s * 0.35, s * 0.15 + crownH * 0.85, 0);
        group.add(pinch);
      }

      const bandGeo = new THREE.TorusGeometry(s * 0.6, s * 0.065, 8, 24);
      const band = new THREE.Mesh(bandGeo, mat(0x111111, { roughness: 0.4, metalness: 0.3 }));
      band.rotation.x = Math.PI / 2;
      band.position.y = s * 0.32;
      band.castShadow = true;
      group.add(band);

      const buckleGeo = new THREE.BoxGeometry(s * 0.15, s * 0.12, s * 0.04);
      const buckle = new THREE.Mesh(buckleGeo, mat(0xdaa520, { metalness: 0.9, roughness: 0.15, emissive: 0x553300, emissiveIntensity: 0.15 }));
      buckle.position.set(0, s * 0.32, s * 0.63);
      buckle.castShadow = true;
      group.add(buckle);
      break;
    }
    case 'afro': {
      const afroMat = mat(0x1a0800, { roughness: 1.0, metalness: 0.0, emissive: 0x0a0400, emissiveIntensity: 0.04 });

      const coreGeo = new THREE.SphereGeometry(s * 1.35, 20, 20);
      const core = new THREE.Mesh(coreGeo, afroMat);
      core.position.y = s * 0.55;
      core.castShadow = true;
      group.add(core);

      const lumpCount = 14;
      for (let i = 0; i < lumpCount; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / lumpCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const r = s * 1.25;
        const lumpSize = s * (0.4 + Math.random() * 0.25);
        const lumpGeo = new THREE.SphereGeometry(lumpSize, 8, 8);
        const lump = new THREE.Mesh(lumpGeo, afroMat);
        lump.position.set(
          r * Math.sin(phi) * Math.cos(theta),
          s * 0.55 + r * Math.cos(phi) * 0.7 + s * 0.15,
          r * Math.sin(phi) * Math.sin(theta),
        );
        if (lump.position.y > s * 0.2) {
          lump.castShadow = true;
          group.add(lump);
        }
      }

      const pickHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.8, 6),
        mat(0xff4444, { emissive: 0x440000, emissiveIntensity: 0.1 }),
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

      const baseGeo = new THREE.CylinderGeometry(s * 0.72, s * 0.78, s * 0.4, 24);
      const base = new THREE.Mesh(baseGeo, goldMat);
      base.position.y = s * 0.22;
      base.castShadow = true;
      group.add(base);

      const trimGeo = new THREE.TorusGeometry(s * 0.76, s * 0.04, 8, 24);
      const trim = new THREE.Mesh(trimGeo, mat(0xffaa00, { metalness: 0.95, roughness: 0.1, emissive: 0x664400, emissiveIntensity: 0.15 }));
      trim.rotation.x = Math.PI / 2;
      trim.position.y = s * 0.04;
      group.add(trim);

      const pointCount = 5;
      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const px = Math.cos(angle) * s * 0.58;
        const pz = Math.sin(angle) * s * 0.58;

        const topCone = new THREE.Mesh(
          new THREE.ConeGeometry(s * 0.14, s * 0.55, 5),
          goldMat,
        );
        topCone.position.set(px, s * 0.7, pz);
        topCone.castShadow = true;
        group.add(topCone);

        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(s * 0.06, 8, 8),
          goldMat,
        );
        tip.position.set(px, s * 0.98, pz);
        group.add(tip);

        if (i < pointCount) {
          const nextAngle = ((i + 1) / pointCount) * Math.PI * 2;
          const midAngle = (angle + nextAngle) / 2;
          const archGeo = new THREE.TorusGeometry(s * 0.15, s * 0.025, 6, 8, Math.PI);
          const arch = new THREE.Mesh(archGeo, goldMat);
          arch.position.set(
            Math.cos(midAngle) * s * 0.58,
            s * 0.42,
            Math.sin(midAngle) * s * 0.58,
          );
          arch.rotation.y = -midAngle + Math.PI / 2;
          arch.rotation.x = Math.PI;
          group.add(arch);
        }

        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(s * 0.08, 1),
          mat(gemColors[i], { metalness: 0.1, roughness: 0.05, emissive: gemColors[i], emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }),
        );
        gem.position.set(px * 1.08, s * 0.42, pz * 1.08);
        gem.rotation.y = angle;
        gem.castShadow = true;
        group.add(gem);
      }

      const cushion = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mat(0x880022, { roughness: 0.95, emissive: 0x220008, emissiveIntensity: 0.08, side: THREE.DoubleSide }),
      );
      cushion.position.y = s * 0.42;
      cushion.scale.y = 0.4;
      group.add(cushion);

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.08, 10, 10),
        goldMat,
      );
      orb.position.y = s * 1.05;
      group.add(orb);
      const crossV = new THREE.Mesh(
        new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.2, 6),
        goldMat,
      );
      crossV.position.y = s * 1.2;
      group.add(crossV);
      const crossH = new THREE.Mesh(
        new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.14, 6),
        goldMat,
      );
      crossH.position.y = s * 1.22;
      crossH.rotation.z = Math.PI / 2;
      group.add(crossH);
      break;
    }
    case 'dunce': {
      const coneH = s * 2.8;
      const coneR = s * 0.65;
      const coneProfile: THREE.Vector2[] = [];
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

      const makeTextPlane = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get 2D canvas context for dunce hat text');
        }
        ctx.clearRect(0, 0, 256, 96);
        ctx.font = 'bold 72px "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#600000';
        ctx.lineWidth = 4;
        ctx.strokeText('DUNCE', 128, 44);
        ctx.fillStyle = '#cc0000';
        ctx.fillText('DUNCE', 128, 44);
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
          side: THREE.DoubleSide,
        });
        return new THREE.Mesh(planeGeo, planeMat);
      };

      const frontLabel = makeTextPlane();
      const labelHeight = coneH * 0.28;
      const labelRadius = coneR * 0.6 + 0.02;
      frontLabel.position.set(0, labelHeight, labelRadius);
      group.add(frontLabel);

      const backLabel = makeTextPlane();
      backLabel.position.set(0, labelHeight, -labelRadius);
      backLabel.rotation.y = Math.PI;
      group.add(backLabel);

      const elastic = new THREE.Mesh(
        new THREE.TorusGeometry(s * 0.5, s * 0.02, 6, 16),
        mat(0x333333, { roughness: 0.6 }),
      );
      elastic.rotation.x = Math.PI / 2;
      elastic.position.y = -s * 0.1;
      group.add(elastic);
      break;
    }
    default:
      return null;
  }

  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return {
    group,
    santaSegments,
    santaPomGroup,
    santaDroopX,
    santaDroopZ,
  };
}

export function disposeHatGroup(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry.dispose();

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        material.dispose();
      }
      return;
    }

    mesh.material.dispose();
  });
}