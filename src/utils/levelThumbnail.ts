import { hexToPixel } from './math';

export interface LevelTile {
  coord: {
    q: number;
    r: number;
  };
  ability?: string;
}

export interface ThumbnailRenderOptions {
  padding?: number;
  background?: string;
}

const DEFAULT_PADDING = 12;
const DEFAULT_BACKGROUND = '#1a1a2e';
const SQRT3 = Math.sqrt(3);
const HALF_SQRT3 = SQRT3 / 2;

const ABILITY_COLORS: Record<string, string> = {
  NORMAL: '#666666',
  ICE: '#00ddff',
  PORTAL: '#aa44ff',
  BONUS: '#ffdd00',
  HAZARD: '#ff4444',
};

function resolveCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const width = canvas.width > 0 ? canvas.width : canvas.clientWidth;
  const height = canvas.height > 0 ? canvas.height : canvas.clientHeight;
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}

function getTileColor(ability?: string): string {
  const normalized = ability?.trim().toUpperCase() ?? 'NORMAL';
  return ABILITY_COLORS[normalized] ?? '#666666';
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  fillColor: string,
): void {
  ctx.beginPath();

  // Flat-topped hex orientation to match src/utils/math.js axial conversion.
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

export function renderLevelThumbnail(
  canvas: HTMLCanvasElement,
  tiles: LevelTile[],
  options: ThumbnailRenderOptions = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const { width, height } = resolveCanvasSize(canvas);
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }

  const padding = Math.max(0, options.padding ?? DEFAULT_PADDING);
  const background = options.background ?? DEFAULT_BACKGROUND;

  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  if (!tiles.length) {
    return;
  }

  // Compute hex centers at unit size, then scale and translate to fit the canvas.
  const unitCenters = tiles.map((tile) => {
    const pos = hexToPixel(tile.coord.q, tile.coord.r, 1);
    return {
      x: pos.x,
      y: pos.z,
      ability: tile.ability,
    };
  });

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const center of unitCenters) {
    minX = Math.min(minX, center.x - 1);
    maxX = Math.max(maxX, center.x + 1);
    minY = Math.min(minY, center.y - HALF_SQRT3);
    maxY = Math.max(maxY, center.y + HALF_SQRT3);
  }

  const boundsWidth = Math.max(1e-6, maxX - minX);
  const boundsHeight = Math.max(1e-6, maxY - minY);
  const drawWidth = Math.max(1, width - padding * 2);
  const drawHeight = Math.max(1, height - padding * 2);

  const scale = Math.min(drawWidth / boundsWidth, drawHeight / boundsHeight);
  const offsetX = padding + (drawWidth - boundsWidth * scale) * 0.5 - minX * scale;
  const offsetY = padding + (drawHeight - boundsHeight * scale) * 0.5 - minY * scale;

  for (const center of unitCenters) {
    drawHexagon(
      ctx,
      center.x * scale + offsetX,
      center.y * scale + offsetY,
      scale,
      getTileColor(center.ability),
    );
  }
}

export function createLevelThumbnailCanvas(
  tiles: LevelTile[],
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));

  renderLevelThumbnail(canvas, tiles);
  return canvas;
}
