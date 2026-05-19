/**
 * Color palette definitions for player customization
 */

export interface ColorOption {
  name: string;
  hex: number;
  category: string;
}

export interface PatternOption {
  id: string;
  name: string;
  type: 'gradient' | 'textured' | 'special';
  previewColors: number[];
  materialParams?: {
    metalness?: number;
    roughness?: number;
    emissiveIntensity?: number;
    clearcoat?: number;
    opacity?: number;
    transparent?: boolean;
  };
}

// Organized by visual category
const NEON_COLORS: ColorOption[] = [
  { name: 'Cyan', hex: 0x00ffff, category: 'neon' },
  { name: 'Lime', hex: 0x00ff00, category: 'neon' },
  { name: 'Magenta', hex: 0xff00ff, category: 'neon' },
];

const DARK_COLORS: ColorOption[] = [
  { name: 'Navy', hex: 0x000080, category: 'dark' },
  { name: 'Charcoal', hex: 0x333333, category: 'dark' },
  { name: 'Burgundy', hex: 0x800020, category: 'dark' },
];

const METALLIC_COLORS: ColorOption[] = [
  { name: 'Gold', hex: 0xffd700, category: 'metallic' },
  { name: 'Silver', hex: 0xc0c0c0, category: 'metallic' },
  { name: 'Copper', hex: 0xb87333, category: 'metallic' },
];

const JEWEL_COLORS: ColorOption[] = [
  { name: 'Ruby', hex: 0xe0115f, category: 'jewel' },
  { name: 'Emerald', hex: 0x50c878, category: 'jewel' },
  { name: 'Sapphire', hex: 0x0f52ba, category: 'jewel' },
];

const PASTEL_COLORS: ColorOption[] = [
  { name: 'Lavender', hex: 0xb4a7d6, category: 'pastel' },
  { name: 'Mint', hex: 0x98ff98, category: 'pastel' },
  { name: 'Peach', hex: 0xffcba4, category: 'pastel' },
  { name: 'Sky Blue', hex: 0x87ceeb, category: 'pastel' },
  { name: 'Rose', hex: 0xff6b81, category: 'pastel' },
  { name: 'Lilac', hex: 0xc8a2c8, category: 'pastel' },
];

const EARTH_COLORS: ColorOption[] = [
  { name: 'Forest', hex: 0x228b22, category: 'earth' },
  { name: 'Terracotta', hex: 0xcc5500, category: 'earth' },
  { name: 'Sand', hex: 0xc2b280, category: 'earth' },
  { name: 'Olive', hex: 0x808000, category: 'earth' },
  { name: 'Sienna', hex: 0xa0522d, category: 'earth' },
];

const VIVID_COLORS: ColorOption[] = [
  { name: 'Tangerine', hex: 0xff9f00, category: 'vivid' },
  { name: 'Electric Blue', hex: 0x7df9ff, category: 'vivid' },
  { name: 'Hot Pink', hex: 0xff69b4, category: 'vivid' },
  { name: 'Chartreuse', hex: 0x7fff00, category: 'vivid' },
  { name: 'Vermillion', hex: 0xe34234, category: 'vivid' },
  { name: 'Violet', hex: 0x8f00ff, category: 'vivid' },
];

const MONOCHROME_COLORS: ColorOption[] = [
  { name: 'Snow', hex: 0xf0f0f0, category: 'monochrome' },
  { name: 'Slate', hex: 0x708090, category: 'monochrome' },
  { name: 'Obsidian', hex: 0x1a1a2e, category: 'monochrome' },
];

const PATTERN_OPTIONS: PatternOption[] = [
  { id: 'pattern:sunset', name: 'Sunset', type: 'gradient', previewColors: [0xff4500, 0xff8c00, 0xffd700] },
  { id: 'pattern:ocean', name: 'Ocean', type: 'gradient', previewColors: [0x00ffff, 0x0066cc, 0x000066] },
  { id: 'pattern:toxic', name: 'Toxic', type: 'gradient', previewColors: [0x00ff00, 0xccff00, 0x333300] },
  { id: 'pattern:void', name: 'Void', type: 'gradient', previewColors: [0x8b00ff, 0x4400aa, 0x110033] },
  { id: 'pattern:bubblegum', name: 'Bubblegum', type: 'gradient', previewColors: [0xff69b4, 0xff1493, 0xffb6c1] },
  { id: 'pattern:checkerboard', name: 'Checkerboard', type: 'textured', previewColors: [0xffffff, 0x000000] },
  { id: 'pattern:stripes', name: 'Racing Stripes', type: 'textured', previewColors: [0xff0000, 0xffffff] },
  { id: 'pattern:camo', name: 'Camo', type: 'textured', previewColors: [0x556b2f, 0x8b7355, 0x2e4a1e] },
  { id: 'pattern:polkadot', name: 'Polka Dot', type: 'textured', previewColors: [0x000080, 0xffd700] },
  {
    id: 'pattern:chrome',
    name: 'Chrome',
    type: 'special',
    previewColors: [0xcccccc, 0xffffff],
    materialParams: { metalness: 1.0, roughness: 0.05 },
  },
  {
    id: 'pattern:glass',
    name: 'Glass',
    type: 'special',
    previewColors: [0xaaddff, 0xffffff],
    materialParams: { metalness: 0.1, roughness: 0.05, opacity: 0.6, transparent: true },
  },
  {
    id: 'pattern:lava',
    name: 'Lava',
    type: 'special',
    previewColors: [0xff4500, 0xff0000, 0x330000],
    materialParams: { emissiveIntensity: 0.8 },
  },
  {
    id: 'pattern:holographic',
    name: 'Holographic',
    type: 'special',
    previewColors: [0xff00ff, 0x00ffff, 0xffff00],
    materialParams: { metalness: 0.8, roughness: 0.2 },
  },
];

export const COLOR_PALETTE = {
  neon: NEON_COLORS,
  dark: DARK_COLORS,
  metallic: METALLIC_COLORS,
  jewel: JEWEL_COLORS,
  pastel: PASTEL_COLORS,
  earth: EARTH_COLORS,
  vivid: VIVID_COLORS,
  monochrome: MONOCHROME_COLORS,
};

/**
 * Get all colors as a flat array
 */
export function getAllColors(): ColorOption[] {
  return [
    ...NEON_COLORS,
    ...DARK_COLORS,
    ...METALLIC_COLORS,
    ...JEWEL_COLORS,
    ...PASTEL_COLORS,
    ...EARTH_COLORS,
    ...VIVID_COLORS,
    ...MONOCHROME_COLORS,
  ];
}

export function getAllPatterns(): PatternOption[] {
  return PATTERN_OPTIONS;
}

export function getPatternById(id: string): PatternOption | undefined {
  return PATTERN_OPTIONS.find((p) => p.id === id);
}

export function isPatternId(color: number | string): color is string {
  return typeof color === 'string' && color.startsWith('pattern:');
}

export function getDisplayColor(color: number | string): number {
  if (typeof color === 'number') {
    return color;
  }

  const pattern = getPatternById(color);
  return pattern?.previewColors[0] ?? 0xffffff;
}

/**
 * Convert hex color to RGB string for CSS
 */
export function hexToRgb(hex: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert hex to hex string format for HTML
 */
export function hexToString(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
