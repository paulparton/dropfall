export const HAT_DEFINITIONS = Object.freeze([
  { id: 'neon_halo', label: 'Neon Halo', iconPath: '/assets/hats/neon-halo.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'astro_helmet', label: 'Astro Helmet', iconPath: '/assets/hats/astro-helmet.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'cowboy', label: 'Cowboy', iconPath: '/assets/hats/cowboy.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'crown', label: 'Royal Crown', iconPath: '/assets/hats/crown.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'pirate_captain', label: 'Pirate Captain', iconPath: '/assets/hats/pirate-captain.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'arcane_witch', label: 'Arcane Witch', iconPath: '/assets/hats/arcane-witch.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'sonic_headphones', label: 'Sonic Headphones', iconPath: '/assets/hats/sonic-headphones.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
  { id: 'galaxy_chef', label: 'Galaxy Chef', iconPath: '/assets/hats/galaxy-chef.png', artStatus: 'vertical-slice', modelSource: 'procedural-polished' },
].map(definition => Object.freeze(definition)));

export const HAT_IDS = Object.freeze(HAT_DEFINITIONS.map(definition => definition.id));

const HAT_BY_ID = new Map(HAT_DEFINITIONS.map(definition => [definition.id, definition]));
const LEGACY_HAT_ALIASES = Object.freeze({
  pixel_crown: 'crown',
  storm_cloud: 'neon_halo',
  dragon_crest: 'astro_helmet',
  moon_mushroom: 'arcane_witch',
  propeller_cap: 'cowboy',
  viking_helm: 'astro_helmet',
  samurai_kabuto: 'astro_helmet',
  solar_bloom: 'crown',
  disco_orbit: 'neon_halo',
  shark_fin: 'astro_helmet',
  mini_ufo: 'astro_helmet',
  cyber_cat: 'sonic_headphones',
  clockwork_topper: 'cowboy',
  prism_jester: 'arcane_witch',
  santa: 'galaxy_chef',
  afro: 'none',
  dunce: 'arcane_witch',
});

export function getHatDefinitionById(id) {
  return HAT_BY_ID.get(id) || null;
}

export function normalizeHatId(id) {
  const candidate = String(id || 'none');
  if (candidate === 'none' || HAT_BY_ID.has(candidate)) return candidate;
  return LEGACY_HAT_ALIASES[candidate] || 'none';
}
