import * as THREE from 'three';
import { getPatternById, isPatternId, type PatternOption } from '../components/ColorPalette.js';

const MATERIAL_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function getSafeColor(colors: number[], index: number, fallback = 0xffffff): number {
  return colors[index] ?? colors[colors.length - 1] ?? fallback;
}

function getOrCreateMaterialTexture(
  key: string,
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const cached = MATERIAL_TEXTURE_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for material texture generation');
  }

  draw(ctx, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  MATERIAL_TEXTURE_CACHE.set(key, texture);
  return texture;
}

function drawGradientRadial(ctx: CanvasRenderingContext2D, size: number, colors: number[]): void {
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.06,
    size * 0.5,
    size * 0.5,
    size * 0.55,
  );

  const safeColors = colors.length > 0 ? colors : [0xffffff];
  const denom = Math.max(1, safeColors.length - 1);
  safeColors.forEach((color, i) => {
    gradient.addColorStop(i / denom, numToHex(color));
  });

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

function drawTexturedPattern(
  ctx: CanvasRenderingContext2D,
  size: number,
  patternId: string,
  colors: number[],
): void {
  const c0 = numToHex(getSafeColor(colors, 0, 0xffffff));
  const c1 = numToHex(getSafeColor(colors, 1, 0x000000));
  const c2 = numToHex(getSafeColor(colors, 2, 0x666666));

  ctx.clearRect(0, 0, size, size);

  if (patternId.includes('checkerboard')) {
    const step = Math.max(8, Math.floor(size / 8));
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const alt = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = alt ? c0 : c1;
        ctx.fillRect(x, y, step, step);
      }
    }
    return;
  }

  if (patternId.includes('stripes')) {
    const stripes = 8;
    const h = Math.max(2, Math.floor(size / stripes));
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? c0 : c1;
      ctx.fillRect(0, i * h, size, h + 1);
    }
    return;
  }

  if (patternId.includes('camo')) {
    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, size, size);

    const blobs = 14;
    for (let i = 0; i < blobs; i += 1) {
      const color = i % 2 === 0 ? c1 : c2;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const rx = size * (0.08 + Math.random() * 0.15);
      const ry = size * (0.06 + Math.random() * 0.12);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (patternId.includes('polkadot')) {
    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, size, size);

    const spacing = Math.max(10, Math.floor(size / 5));
    const dotR = Math.max(2, Math.floor(size * 0.08));
    ctx.fillStyle = c1;

    for (let y = spacing / 2; y < size; y += spacing) {
      for (let x = spacing / 2; x < size; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, size, size);
}

function getPatternTexture(pattern: PatternOption): THREE.CanvasTexture | null {
  if (pattern.type === 'gradient') {
    return getOrCreateMaterialTexture(`gradient:${pattern.id}`, 256, (ctx, size) => {
      drawGradientRadial(ctx, size, pattern.previewColors);
    });
  }

  if (pattern.type === 'textured') {
    return getOrCreateMaterialTexture(`textured:${pattern.id}`, 128, (ctx, size) => {
      drawTexturedPattern(ctx, size, pattern.id, pattern.previewColors);
    });
  }

  if (pattern.id === 'pattern:holographic') {
    return getOrCreateMaterialTexture(`special:${pattern.id}`, 128, (ctx, size) => {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      const palette = pattern.previewColors.length > 0 ? pattern.previewColors : [0xffffff];
      const denom = Math.max(1, palette.length - 1);
      palette.forEach((hex, i) => {
        grad.addColorStop(i / denom, numToHex(hex));
      });

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    });
  }

  return null;
}

function makeStandardFromPattern(pattern: PatternOption, sphereSize: number): THREE.Material {
  const texture = getPatternTexture(pattern);
  const repeat = Math.max(1, Math.min(4, Math.round(1 / Math.max(0.25, sphereSize))));

  if (texture) {
    texture.repeat.set(repeat, repeat);
  }

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    metalness: 0.3,
    roughness: 0.4,
  });
}

function makeSpecialMaterial(pattern: PatternOption): THREE.Material {
  const params = pattern.materialParams ?? {};
  const baseColor = getSafeColor(pattern.previewColors, 0, 0xffffff);

  const material = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: params.metalness ?? 0.5,
    roughness: params.roughness ?? 0.3,
    clearcoat: params.clearcoat ?? 0,
    emissiveIntensity: params.emissiveIntensity ?? 0,
    opacity: params.opacity ?? 1,
    transparent: params.transparent ?? false,
  });

  if (pattern.id === 'pattern:lava') {
    material.emissive = new THREE.Color(baseColor);
    material.emissiveIntensity = params.emissiveIntensity ?? 0.8;
  }

  if (pattern.id === 'pattern:holographic') {
    material.map = getPatternTexture(pattern);
    material.metalness = params.metalness ?? 0.8;
    material.roughness = params.roughness ?? 0.2;
  }

  if (pattern.id === 'pattern:chrome') {
    material.metalness = params.metalness ?? 1.0;
    material.roughness = params.roughness ?? 0.05;
    material.clearcoat = Math.max(material.clearcoat, 0.6);
  }

  if (pattern.id === 'pattern:glass') {
    material.transmission = 0.6;
    material.transparent = true;
    material.opacity = 0.6;
    material.roughness = 0.05;
    material.metalness = params.metalness ?? 0.1;
  }

  return material;
}

export function createBallMaterial(color: number | string, sphereSize = 1): THREE.Material {
  if (!isPatternId(color)) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.4,
    });
  }

  const pattern = getPatternById(color);
  if (!pattern) {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.4,
    });
  }

  if (pattern.type === 'special') {
    return makeSpecialMaterial(pattern);
  }

  return makeStandardFromPattern(pattern, sphereSize);
}

function drawSwatchBaseCircle(
  ctx: CanvasRenderingContext2D,
  size: number,
  drawInside: () => void,
): void {
  const radius = size * 0.46;
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  drawInside();
  ctx.restore();
}

function drawSpecialSwatchEffect(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.46, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(size * 0.25, size * 0.2, size * 0.85, size * 0.75);
  grad.addColorStop(0, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.arc(size * 0.45, size * 0.45, size * 0.3, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}

export function createSwatchCanvas(color: number | string, size: number): HTMLCanvasElement {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  if (!isPatternId(color)) {
    drawSwatchBaseCircle(ctx, size, () => {
      ctx.fillStyle = numToHex(color);
      ctx.fillRect(0, 0, size, size);
    });
    return canvas;
  }

  const pattern = getPatternById(color);
  if (!pattern) {
    drawSwatchBaseCircle(ctx, size, () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
    });
    return canvas;
  }

  if (pattern.type === 'gradient') {
    drawSwatchBaseCircle(ctx, size, () => {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      const palette = pattern.previewColors.length > 0 ? pattern.previewColors : [0xffffff];
      const denom = Math.max(1, palette.length - 1);
      palette.forEach((hex, i) => {
        grad.addColorStop(i / denom, numToHex(hex));
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    });
    return canvas;
  }

  if (pattern.type === 'textured') {
    drawSwatchBaseCircle(ctx, size, () => {
      drawTexturedPattern(ctx, size, pattern.id, pattern.previewColors);
    });
    return canvas;
  }

  drawSwatchBaseCircle(ctx, size, () => {
    if (pattern.id === 'pattern:holographic') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      const palette = pattern.previewColors.length > 0 ? pattern.previewColors : [0xffffff];
      const denom = Math.max(1, palette.length - 1);
      palette.forEach((hex, i) => {
        grad.addColorStop(i / denom, numToHex(hex));
      });
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = numToHex(getSafeColor(pattern.previewColors, 0, 0xffffff));
    }

    ctx.fillRect(0, 0, size, size);
  });

  drawSpecialSwatchEffect(ctx, size);
  return canvas;
}

export function getPatternEmissiveColor(color: number | string): number {
  if (!isPatternId(color)) {
    return color;
  }

  const pattern = getPatternById(color);
  return getSafeColor(pattern?.previewColors ?? [], 0, 0xffffff);
}

export function numToHex(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}
