export interface HatDefinition {
  id: string;
  label: string;
  icon: string;
}

/**
 * The complete cosmetic catalogue. Keep this as the single source of truth so
 * local, online, preview, and random-player UIs always expose the same hats.
 */
export const HAT_CATALOG: ReadonlyArray<Readonly<HatDefinition>> = [
  { id: 'neon_halo', label: 'Neon Halo', icon: '✨' },
  { id: 'astro_helmet', label: 'Astro Helmet', icon: '🚀' },
  { id: 'storm_cloud', label: 'Storm Cloud', icon: '⛈️' },
  { id: 'dragon_crest', label: 'Dragon Crest', icon: '🐉' },
  { id: 'pixel_crown', label: 'Pixel Crown', icon: '🎮' },
  { id: 'moon_mushroom', label: 'Moon Mushroom', icon: '🍄' },
  { id: 'pirate_captain', label: 'Pirate Captain', icon: '☠️' },
  { id: 'propeller_cap', label: 'Propeller Cap', icon: '🌀' },
  { id: 'viking_helm', label: 'Viking Helm', icon: '🪓' },
  { id: 'samurai_kabuto', label: 'Samurai Kabuto', icon: '🛡️' },
  { id: 'arcane_witch', label: 'Arcane Witch', icon: '🧙' },
  { id: 'sonic_headphones', label: 'Sonic Headphones', icon: '🎧' },
  { id: 'solar_bloom', label: 'Solar Bloom', icon: '🌻' },
  { id: 'disco_orbit', label: 'Disco Orbit', icon: '🪩' },
  { id: 'galaxy_chef', label: 'Galaxy Chef', icon: '👨‍🍳' },
  { id: 'shark_fin', label: 'Shark Fin', icon: '🦈' },
  { id: 'mini_ufo', label: 'Mini UFO', icon: '🛸' },
  { id: 'cyber_cat', label: 'Cyber Cat', icon: '🐱' },
  { id: 'clockwork_topper', label: 'Clockwork Topper', icon: '⚙️' },
  { id: 'prism_jester', label: 'Prism Jester', icon: '🎭' },
];

export const HAT_VALUES: ReadonlyArray<string> = ['none', ...HAT_CATALOG.map((hat) => hat.id)];

export function getHatDefinition(id: string): Readonly<HatDefinition> | null {
  return HAT_CATALOG.find((hat) => hat.id === id) ?? null;
}

