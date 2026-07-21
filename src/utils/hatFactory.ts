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

type HatMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;

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

  const physical = (color: number, opts: Record<string, unknown> = {}) => new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    metalness: 0.35,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    emissive: color,
    emissiveIntensity: 0.08,
    ...opts,
  });

  const add = (
    geometry: THREE.BufferGeometry,
    material: HatMaterial,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    name = '',
  ): THREE.Mesh => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(...position);
    item.rotation.set(...rotation);
    item.scale.set(...scale);
    item.name = name;
    group.add(item);
    return item;
  };

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
          santaSegments[i - 1]!.pivot.add(pivot);
        }
      }

      const lastPivot = santaSegments[segCount - 1]!.pivot;
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
          mat(gemColors[i] ?? 0xffffff, { metalness: 0.1, roughness: 0.05, emissive: gemColors[i] ?? 0xffffff, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }),
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
    case 'neon_halo': {
      const halo = add(
        new THREE.TorusGeometry(s * 0.9, s * 0.075, 12, 64),
        physical(0x49f6ff, { emissive: 0x21dfff, emissiveIntensity: 2.4, transparent: true, opacity: 0.92 }),
        [0, s * 0.82, 0],
        [Math.PI / 2, 0, 0],
        [1, 1, 1],
        'halo',
      );
      halo.renderOrder = 2;
      add(new THREE.TorusGeometry(s * 0.67, s * 0.025, 8, 48), mat(0xff70f5, { emissive: 0xff26ef, emissiveIntensity: 2 }), [0, s * 0.82, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 'haloInner');
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2;
        add(new THREE.OctahedronGeometry(s * 0.09, 0), physical(i % 2 ? 0xff6bff : 0x7dffff, { emissiveIntensity: 1.8 }), [Math.cos(angle) * s * 0.88, s * 0.82, Math.sin(angle) * s * 0.88], [0, angle, 0], [1, 1, 1], `haloSpark${i}`);
      }
      break;
    }
    case 'astro_helmet': {
      add(new THREE.SphereGeometry(s * 0.9, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.66), physical(0xf1f5ff, { metalness: 0.65, roughness: 0.2 }), [0, s * 0.18, 0]);
      add(new THREE.SphereGeometry(s * 0.69, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), physical(0x72dcff, { transmission: 0.18, transparent: true, opacity: 0.62, emissive: 0x0b7fb4, emissiveIntensity: 0.55, side: THREE.DoubleSide }), [0, s * 0.27, s * 0.28], [-0.12, 0, 0], [1, 0.92, 0.72], 'visor');
      add(new THREE.TorusGeometry(s * 0.82, s * 0.085, 12, 32), mat(0x26384f, { metalness: 0.8, roughness: 0.2 }), [0, s * 0.1, 0], [Math.PI / 2, 0, 0]);
      add(new THREE.BoxGeometry(s * 0.3, s * 0.18, s * 0.12), physical(0xff5d4a, { emissiveIntensity: 0.5 }), [0, s * 0.82, -s * 0.42], [0, 0, 0], [1, 1, 1], 'astroBeacon');
      break;
    }
    case 'storm_cloud': {
      const cloudMat = physical(0x68788e, { roughness: 0.78, metalness: 0.05, emissive: 0x18263b, emissiveIntensity: 0.18 });
      const cloudPuffs: Array<[number, number, number, number]> = [[0, .55, 0, .7], [-.55, .48, .05, .48], [.55, .5, -.05, .5], [-.2, .8, 0, .5], [.28, .76, .08, .46]];
      cloudPuffs.forEach(([x, y, z, r]) => add(new THREE.SphereGeometry(s * r, 16, 12), cloudMat, [s * x, s * y, s * z]));
      const bolt = add(new THREE.ConeGeometry(s * 0.18, s * 0.85, 4), physical(0xfff36a, { emissive: 0xffd928, emissiveIntensity: 2.6 }), [0, -s * 0.12, s * 0.12], [0, 0, Math.PI], [0.72, 1, 0.45], 'lightningBolt');
      bolt.rotation.z = 0.22;
      break;
    }
    case 'dragon_crest': {
      const scaleMat = physical(0x18c78b, { metalness: 0.25, roughness: 0.32, iridescence: 0.7, iridescenceIOR: 1.6 });
      add(new THREE.SphereGeometry(s * 0.72, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), scaleMat, [0, s * 0.05, 0], [0, 0, 0], [1, .8, 1]);
      for (let i = 0; i < 6; i += 1) {
        const z = s * (-0.55 + i * 0.22);
        const spike = add(new THREE.ConeGeometry(s * (0.22 - i * 0.012), s * (0.65 + i * 0.04), 5), physical(i % 2 ? 0xff5c58 : 0xffb13b, { emissiveIntensity: 0.45 }), [0, s * (0.48 + i * 0.05), z], [Math.PI / 2, 0, 0], [1, 1, .7], `dragonSpike${i}`);
        spike.rotation.x = -0.35;
      }
      add(new THREE.CylinderGeometry(s * .05, s * .1, s * .72, 6), physical(0xf6dfb7, { roughness: .42 }), [-s * .58, s * .55, -s * .05], [0, 0, -.55]);
      add(new THREE.CylinderGeometry(s * .05, s * .1, s * .72, 6), physical(0xf6dfb7, { roughness: .42 }), [s * .58, s * .55, -s * .05], [0, 0, .55]);
      break;
    }
    case 'pixel_crown': {
      const gold = physical(0xffcc21, { metalness: .85, roughness: .16, emissive: 0x7a3d00, emissiveIntensity: .35 });
      add(new THREE.BoxGeometry(s * 1.45, s * .3, s * 1.35), gold, [0, s * .2, 0]);
      for (let i = -2; i <= 2; i += 1) {
        add(new THREE.BoxGeometry(s * .24, s * (.55 + (i % 2 === 0 ? .28 : 0)), s * .23), gold, [i * s * .29, s * .63, s * .47], [0, 0, 0], [1, 1, 1], `pixel${i + 2}`);
      }
      [0xff3b6b, 0x45e9ff, 0x8cff62].forEach((color, i) => add(new THREE.BoxGeometry(s * .17, s * .17, s * .08), physical(color, { emissiveIntensity: 1.5 }), [(i - 1) * s * .38, s * .2, s * .7], [0, 0, Math.PI / 4], [1, 1, 1], `pixelGem${i}`));
      break;
    }
    case 'moon_mushroom': {
      add(new THREE.CylinderGeometry(s * .36, s * .5, s * .62, 18), mat(0xf6e6ca, { roughness: .9 }), [0, s * .2, 0]);
      add(new THREE.SphereGeometry(s * 1.05, 28, 16, 0, Math.PI * 2, 0, Math.PI * .5), physical(0x7657ff, { roughness: .35, metalness: .12, emissive: 0x311a99, emissiveIntensity: .65 }), [0, s * .55, 0], [0, 0, 0], [1.12, .62, 1.12], 'mushroomCap');
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        add(new THREE.SphereGeometry(s * .11, 10, 8), mat(0xd6f9ff, { emissive: 0xa4efff, emissiveIntensity: 1.4 }), [Math.cos(angle) * s * .66, s * (.84 + (i % 2) * .08), Math.sin(angle) * s * .66], [0, 0, 0], [1, .38, 1], `mushroomSpot${i}`);
      }
      break;
    }
    case 'pirate_captain': {
      const felt = mat(0x17141f, { roughness: .88, side: THREE.DoubleSide });
      add(new THREE.SphereGeometry(s * .86, 24, 14, 0, Math.PI * 2, 0, Math.PI * .52), felt, [0, s * .08, 0], [0, 0, 0], [1.3, .9, .86]);
      add(new THREE.TorusGeometry(s * .74, s * .13, 10, 32, Math.PI), felt, [0, s * .55, s * .2], [0, 0, 0], [1.45, 1, 1]);
      add(new THREE.BoxGeometry(s * 1.28, s * .12, s * .08), physical(0xe9b84a, { metalness: .8 }), [0, s * .32, s * .74]);
      add(new THREE.CircleGeometry(s * .25, 20), mat(0xffffff, { emissive: 0x666666, emissiveIntensity: .25, side: THREE.DoubleSide }), [0, s * .67, s * .79], [0, 0, 0], [1, 1, 1], 'pirateBadge');
      break;
    }
    case 'propeller_cap': {
      add(new THREE.SphereGeometry(s * .82, 24, 14, 0, Math.PI * 2, 0, Math.PI * .56), physical(0x2a8cff, { roughness: .45 }), [0, s * .05, 0]);
      add(new THREE.TorusGeometry(s * .79, s * .09, 8, 32, Math.PI), mat(0xff4d62, { roughness: .65 }), [0, s * .08, s * .18], [0, 0, 0], [1.25, 1, 1]);
      add(new THREE.CylinderGeometry(s * .07, s * .07, s * .48, 10), physical(0xffd537, { metalness: .35 }), [0, s * .88, 0]);
      const rotor = new THREE.Group(); rotor.name = 'propeller'; rotor.position.y = s * 1.12; group.add(rotor);
      for (let side = -1; side <= 1; side += 2) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(s * 1.0, s * .07, s * .22), physical(side < 0 ? 0xff5d67 : 0x4ff5c8, { emissiveIntensity: .45 }));
        blade.position.x = side * s * .45; rotor.add(blade);
      }
      break;
    }
    case 'viking_helm': {
      add(new THREE.SphereGeometry(s * .82, 24, 14, 0, Math.PI * 2, 0, Math.PI * .58), physical(0x788392, { metalness: .86, roughness: .28 }), [0, s * .05, 0]);
      add(new THREE.BoxGeometry(s * .15, s * 1.15, s * .12), physical(0xd7b255, { metalness: .85 }), [0, s * .48, s * .7]);
      for (let side = -1; side <= 1; side += 2) {
        const horn = add(new THREE.ConeGeometry(s * .22, s * 1.0, 10), physical(0xf0dfbd, { roughness: .48 }), [side * s * .78, s * .55, 0], [0, 0, side * -.9], [1, 1, 1], `vikingHorn${side}`);
        horn.rotation.z = side * -1.02;
      }
      break;
    }
    case 'samurai_kabuto': {
      add(new THREE.SphereGeometry(s * .82, 28, 15, 0, Math.PI * 2, 0, Math.PI * .6), physical(0x33123f, { metalness: .78, roughness: .23 }), [0, s * .08, 0]);
      for (let i = -2; i <= 2; i += 1) add(new THREE.BoxGeometry(s * 1.34, s * .12, s * .32), physical(0x8f214c, { metalness: .65 }), [0, s * (-.02 - Math.abs(i) * .05), i * s * .2], [0, 0, 0], [1 - Math.abs(i) * .08, 1, 1]);
      const gold = physical(0xffc53d, { metalness: .9, roughness: .14, emissiveIntensity: .25 });
      add(new THREE.TorusGeometry(s * .48, s * .07, 8, 28, Math.PI * 1.35), gold, [0, s * .82, s * .14], [0, 0, .82]);
      add(new THREE.ConeGeometry(s * .18, s * .62, 5), gold, [0, s * .88, s * .15], [0, 0, Math.PI]);
      break;
    }
    case 'arcane_witch': {
      add(new THREE.TorusGeometry(s * 1.0, s * .12, 10, 40), physical(0x241342, { roughness: .72, clearcoat: .3 }), [0, s * .05, 0], [Math.PI / 2, 0, 0]);
      const cone = add(new THREE.ConeGeometry(s * .68, s * 2.15, 28, 8), physical(0x44207a, { roughness: .68, emissive: 0x22094c, emissiveIntensity: .35 }), [0, s * 1.05, 0], [0, 0, -.16], [1, 1, 1], 'witchCone');
      cone.geometry.translate(0, s * .08, 0);
      add(new THREE.TorusGeometry(s * .7, s * .075, 8, 32), physical(0xffa928, { metalness: .72, emissiveIntensity: .7 }), [0, s * .28, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2;
        add(new THREE.OctahedronGeometry(s * .07, 0), mat(0xaaf8ff, { emissive: 0x5eeaff, emissiveIntensity: 2 }), [Math.cos(angle) * s * .62, s * (1.0 + i * .16), Math.sin(angle) * s * .62], [0, angle, 0], [1, 1, 1], `witchStar${i}`);
      }
      break;
    }
    case 'sonic_headphones': {
      add(new THREE.TorusGeometry(s * .92, s * .13, 12, 36, Math.PI), physical(0x141b2b, { metalness: .6, roughness: .25 }), [0, s * .22, 0], [0, 0, 0]);
      for (let side = -1; side <= 1; side += 2) {
        add(new THREE.CylinderGeometry(s * .38, s * .38, s * .28, 24), physical(side < 0 ? 0xff3aa7 : 0x22e5ff, { emissiveIntensity: 1.0 }), [side * s * .91, s * .22, 0], [0, 0, Math.PI / 2], [1, 1, 1], `earcup${side}`);
        add(new THREE.TorusGeometry(s * .24, s * .045, 8, 24), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.6 }), [side * s * .93, s * .22, 0], [0, Math.PI / 2, 0], [1, 1, 1], `earGlow${side}`);
      }
      break;
    }
    case 'solar_bloom': {
      const centre = add(new THREE.SphereGeometry(s * .42, 20, 16), physical(0xffa81f, { emissive: 0xff7b00, emissiveIntensity: 1.3 }), [0, s * .58, 0], [0, 0, 0], [1, .55, 1], 'flowerCentre');
      centre.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        add(new THREE.SphereGeometry(s * .36, 16, 10), physical(i % 2 ? 0xff527b : 0xffd84d, { roughness: .38, emissiveIntensity: .32 }), [Math.cos(angle) * s * .65, s * .54, Math.sin(angle) * s * .65], [0, angle, 0], [1.25, .24, .65], `petal${i}`);
      }
      add(new THREE.TorusGeometry(s * .74, s * .05, 8, 32), mat(0x35cf72, { emissive: 0x0c6b36, emissiveIntensity: .35 }), [0, s * .16, 0], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'disco_orbit': {
      add(new THREE.SphereGeometry(s * .68, 24, 18), physical(0xe4f5ff, { metalness: 1, roughness: .08 }), [0, s * .68, 0], [0, 0, 0], [1, 1, 1], 'discoBall');
      const colors = [0x54f7ff, 0xff4ac8, 0xffdf4a, 0x79ff6d];
      for (let y = -2; y <= 2; y += 1) for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + y * .22;
        const radius = Math.cos(y * .22) * s * .67;
        add(new THREE.BoxGeometry(s * .15, s * .15, s * .035), physical(colors[(i + y + 8) % colors.length]!, { emissiveIntensity: .75 }), [Math.cos(angle) * radius, s * (.68 + y * .22), Math.sin(angle) * radius], [0, -angle + Math.PI / 2, 0], [1, 1, 1]);
      }
      add(new THREE.TorusGeometry(s * 1.05, s * .035, 8, 48), mat(0x72f7ff, { emissive: 0x72f7ff, emissiveIntensity: 1.8 }), [0, s * .68, 0], [Math.PI / 2.6, 0, 0], [1, 1, 1], 'discoRing');
      break;
    }
    case 'galaxy_chef': {
      const cloth = mat(0xf4f3ff, { roughness: .92, emissive: 0x5a5b78, emissiveIntensity: .12 });
      add(new THREE.CylinderGeometry(s * .58, s * .72, s * .62, 24), cloth, [0, s * .24, 0]);
      const chefPuffs: Array<[number, number, number, number]> = [[-.46, .78, 0, .48], [0, .9, 0, .56], [.46, .78, 0, .48]];
      chefPuffs.forEach(([x, y, z, r]) => add(new THREE.SphereGeometry(s * r, 18, 14), cloth, [s * x, s * y, s * z]));
      add(new THREE.TorusGeometry(s * .68, s * .055, 8, 32), physical(0x755cff, { emissiveIntensity: .75 }), [0, s * .09, 0], [Math.PI / 2, 0, 0]);
      const star = add(new THREE.OctahedronGeometry(s * .13, 0), physical(0xffc83f, { emissiveIntensity: 1.6 }), [0, s * .36, s * .64], [0, 0, 0], [1, 1, .35], 'chefStar');
      star.rotation.z = Math.PI / 4;
      break;
    }
    case 'shark_fin': {
      add(new THREE.SphereGeometry(s * .75, 24, 14, 0, Math.PI * 2, 0, Math.PI * .5), physical(0x476f8e, { roughness: .48, metalness: .12 }), [0, s * .03, 0], [0, 0, 0], [1.05, .58, 1.05]);
      const fin = add(new THREE.ConeGeometry(s * .48, s * 1.65, 3), physical(0x5d8eaa, { roughness: .42 }), [0, s * .82, 0], [0, 0, 0], [.7, 1, 1.2], 'sharkFin');
      fin.rotation.y = Math.PI / 2;
      add(new THREE.ConeGeometry(s * .22, s * .75, 3), physical(0x5d8eaa, { roughness: .42 }), [-s * .72, s * .33, 0], [0, 0, -1.15], [.7, 1, 1]);
      add(new THREE.ConeGeometry(s * .22, s * .75, 3), physical(0x5d8eaa, { roughness: .42 }), [s * .72, s * .33, 0], [0, 0, 1.15], [.7, 1, 1]);
      break;
    }
    case 'mini_ufo': {
      add(new THREE.SphereGeometry(s * .62, 24, 12, 0, Math.PI * 2, 0, Math.PI * .48), physical(0x87eaff, { transmission: .25, transparent: true, opacity: .72, emissiveIntensity: .62 }), [0, s * .47, 0], [0, 0, 0], [1, .72, 1], 'ufoDome');
      add(new THREE.CylinderGeometry(s * .62, s * 1.12, s * .3, 32), physical(0x8c94a8, { metalness: .92, roughness: .16 }), [0, s * .28, 0], [0, 0, 0], [1, 1, 1], 'ufoBody');
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        add(new THREE.SphereGeometry(s * .075, 10, 8), mat(i % 2 ? 0xff4ccf : 0x5affee, { emissive: i % 2 ? 0xff4ccf : 0x5affee, emissiveIntensity: 2 }), [Math.cos(angle) * s * .86, s * .22, Math.sin(angle) * s * .86], [0, 0, 0], [1, 1, 1], `ufoLight${i}`);
      }
      break;
    }
    case 'cyber_cat': {
      add(new THREE.TorusGeometry(s * .72, s * .09, 8, 32, Math.PI), physical(0x151827, { metalness: .65 }), [0, s * .15, 0]);
      for (let side = -1; side <= 1; side += 2) {
        add(new THREE.ConeGeometry(s * .42, s * .9, 3), physical(side < 0 ? 0xff49bd : 0x39e9ff, { emissiveIntensity: .82 }), [side * s * .53, s * .72, 0], [0, 0, side * -.13], [1, 1, .5], `catEar${side}`);
        add(new THREE.ConeGeometry(s * .22, s * .55, 3), mat(0x111323, { emissive: 0x3b1958, emissiveIntensity: .35 }), [side * s * .53, s * .71, s * .035], [0, 0, side * -.13], [1, 1, .45]);
      }
      add(new THREE.BoxGeometry(s * 1.0, s * .16, s * .12), physical(0x31f2ff, { emissiveIntensity: 1.7 }), [0, s * .18, s * .65], [0, 0, 0], [1, 1, 1], 'catVisor');
      break;
    }
    case 'clockwork_topper': {
      add(new THREE.CylinderGeometry(s * .68, s * .78, s * 1.1, 28), physical(0x202633, { metalness: .72, roughness: .26 }), [0, s * .58, 0]);
      add(new THREE.CylinderGeometry(s * 1.15, s * 1.15, s * .12, 32), physical(0x171b24, { metalness: .72 }), [0, s * .05, 0]);
      add(new THREE.TorusGeometry(s * .72, s * .08, 8, 32), physical(0xb8792d, { metalness: .9, roughness: .18 }), [0, s * .25, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 3; i += 1) {
        const gear = add(new THREE.TorusGeometry(s * (.2 + i * .05), s * .06, 6, 12), physical(i === 1 ? 0xd8a34b : 0x8e5924, { metalness: .95 }), [(i - 1) * s * .42, s * (.7 + (i % 2) * .2), s * .66], [0, 0, 0], [1, 1, .55], `gear${i}`);
        gear.rotation.z = i * .4;
      }
      add(new THREE.CylinderGeometry(s * .05, s * .05, s * .7, 8), physical(0xd7a146, { metalness: .92 }), [s * .45, s * 1.38, 0]);
      add(new THREE.SphereGeometry(s * .13, 12, 10), physical(0xff5050, { emissiveIntensity: .7 }), [s * .45, s * 1.75, 0], [0, 0, 0], [1, 1, 1], 'clockBall');
      break;
    }
    case 'prism_jester': {
      add(new THREE.TorusGeometry(s * .68, s * .15, 10, 32), physical(0x28213f, { roughness: .5 }), [0, s * .08, 0], [Math.PI / 2, 0, 0]);
      const colors = [0xff3d88, 0x31e5ff, 0xffd23f, 0x8b5cff];
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2;
        const horn = add(new THREE.ConeGeometry(s * .25, s * 1.45, 14, 5), physical(colors[i]!, { roughness: .42, emissiveIntensity: .4 }), [Math.cos(angle) * s * .34, s * .76, Math.sin(angle) * s * .34], [0, 0, Math.cos(angle) * .55], [1, 1, 1], `jesterHorn${i}`);
        horn.rotation.x = Math.sin(angle) * .55;
        add(new THREE.SphereGeometry(s * .14, 12, 10), physical(0xfff3a1, { metalness: .75, emissiveIntensity: .65 }), [Math.cos(angle) * s * .72, s * 1.42, Math.sin(angle) * s * .72], [0, 0, 0], [1, 1, 1], `jesterBell${i}`);
      }
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
  group.userData.hatType = type;

  return {
    group,
    santaSegments,
    santaPomGroup,
    santaDroopX,
    santaDroopZ,
  };
}

/** Adds lightweight cosmetic motion on top of the shared spring physics. */
export function animateHatMesh(group: THREE.Group, time: number, speed = 0): void {
  const type = String(group.userData.hatType || '');
  const pulse = 1 + Math.sin(time * 3.2) * 0.06;
  const spin = (name: string, multiplier: number, axis: 'x' | 'y' | 'z' = 'y') => {
    const item = group.getObjectByName(name);
    if (item) item.rotation[axis] = time * multiplier;
  };

  if (type === 'neon_halo') {
    spin('halo', .7); spin('haloInner', -.9);
    for (let i = 0; i < 5; i += 1) spin(`haloSpark${i}`, 1.6 + i * .08);
  } else if (type === 'propeller_cap') {
    spin('propeller', 6 + Math.min(speed, 30) * .3);
  } else if (type === 'storm_cloud') {
    const bolt = group.getObjectByName('lightningBolt');
    if (bolt) bolt.visible = Math.sin(time * 17) > .72;
  } else if (type === 'disco_orbit') {
    spin('discoBall', .8); spin('discoRing', -1.2, 'z');
  } else if (type === 'mini_ufo') {
    spin('ufoBody', .55);
    for (let i = 0; i < 8; i += 1) {
      const light = group.getObjectByName(`ufoLight${i}`);
      if (light) light.scale.setScalar((Math.floor(time * 8) + i) % 4 === 0 ? 1.55 : .78);
    }
  } else if (type === 'clockwork_topper') {
    spin('gear0', 1.8, 'z'); spin('gear1', -1.35, 'z'); spin('gear2', 1.65, 'z');
  } else if (type === 'sonic_headphones') {
    for (const name of ['earGlow-1', 'earGlow1']) {
      const glow = group.getObjectByName(name); if (glow) glow.scale.setScalar(pulse);
    }
  } else if (type === 'solar_bloom') {
    for (let i = 0; i < 12; i += 1) {
      const petal = group.getObjectByName(`petal${i}`); if (petal) petal.scale.y = .24 * (1 + Math.sin(time * 2.4 + i * .55) * .18);
    }
  } else if (type === 'cyber_cat') {
    const visor = group.getObjectByName('catVisor'); if (visor) visor.scale.x = .92 + Math.sin(time * 4.5) * .08;
  } else if (type === 'prism_jester') {
    for (let i = 0; i < 4; i += 1) {
      const bell = group.getObjectByName(`jesterBell${i}`); if (bell) bell.rotation.z = Math.sin(time * 5 + i) * .25;
    }
  }
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
