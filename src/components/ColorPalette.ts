/**
 * Color palette definitions for player customization
 */

export interface ColorOption {
  name: string;
  hex: number;
  category: string;
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

export const COLOR_PALETTE = {
  neon: NEON_COLORS,
  dark: DARK_COLORS,
  metallic: METALLIC_COLORS,
  jewel: JEWEL_COLORS,
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
  ];
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
