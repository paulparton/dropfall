export const MATCH_THEMES = [
  { value: 'tron', label: 'Star Circuit' },
  { value: 'beach', label: 'Beach' },
  { value: 'temple', label: 'Temple (Aztec)' },
  { value: 'arctic', label: 'Arctic' },
  { value: 'inferno', label: 'Inferno' },
];

export const MATCH_DEFAULTS = {
  theme: 'tron',
  arenaSize: 4,
  sphereSize: 2,
  sphereWeight: 200,
  sphereAccel: 2000,
  collisionBounce: 0.9,
  destructionRate: 3,
  iceRate: 2,
  bonusRate: 6,
  bonusDuration: 4,
  boostRegenSpeed: 1.5,
  boostDrainRate: 20,
};

export const MATCH_SETTING_GROUPS = [
  {
    title: 'Arena',
    fields: [
      { id: 'arena-size', key: 'arenaSize', label: 'Arena Size', description: 'Number of hex rings', min: 2, max: 16, step: 1, format: 'rings' },
      { id: 'destruction-rate', key: 'destructionRate', label: 'Destruction Rate', description: 'Frequency of falling tiles', min: 0.5, max: 10, step: 0.5, format: 'decimal1' },
      { id: 'ice-rate', key: 'iceRate', label: 'Ice Rate', description: 'Frequency of slippery tiles', min: 0.5, max: 10, step: 0.5, format: 'decimal1' },
      { id: 'bonus-rate', key: 'bonusRate', label: 'Bonus Rate', description: 'Frequency of arena bonuses', min: 2, max: 15, step: 0.5, format: 'decimal1' },
    ],
  },
  {
    title: 'Physics',
    fields: [
      { id: 'sphere-size', key: 'sphereSize', label: 'Sphere Size', description: 'Player collision radius', min: 0.5, max: 5, step: 0.1, format: 'decimal1' },
      { id: 'sphere-weight', key: 'sphereWeight', label: 'Sphere Weight', description: 'Momentum and knockback resistance', min: 10, max: 500, step: 10, format: 'kilograms' },
      { id: 'sphere-accel', key: 'sphereAccel', label: 'Sphere Acceleration', description: 'Movement force', min: 500, max: 3000, step: 100, format: 'integer' },
      { id: 'collision-bounce', key: 'collisionBounce', label: 'Collision Bounce', description: 'Impact restitution', min: 0.1, max: 1.5, step: 0.1, format: 'decimal1' },
    ],
  },
  {
    title: 'Boost & Bonuses',
    fields: [
      { id: 'boost-regen-speed', key: 'boostRegenSpeed', label: 'Boost Regen Speed', description: 'Energy regenerated per second', min: 0.1, max: 5, step: 0.1, format: 'decimal1' },
      { id: 'boost-drain-rate', key: 'boostDrainRate', label: 'Boost Drain Rate', description: 'Energy cost while boosting', min: 5, max: 50, step: 1, format: 'integer' },
      { id: 'bonus-duration', key: 'bonusDuration', label: 'Bonus Duration', description: 'Active effect lifetime', min: 1, max: 10, step: 0.5, format: 'seconds' },
    ],
  },
];

export const MATCH_SETTING_FIELDS = MATCH_SETTING_GROUPS.flatMap(group => group.fields);

export const MATCH_PRESETS = [
  { label: 'Slow & Bouncy', settings: { sphereAccel: 800, collisionBounce: 1.5, sphereWeight: 50, destructionRate: 4.5, iceRate: 6.5, bonusRate: 7 } },
  { label: 'Fast & Heavy', settings: { sphereAccel: 3000, collisionBounce: 0.5, sphereWeight: 400, destructionRate: 9, iceRate: 9.5, bonusRate: 14 } },
  { label: 'Tiny Spheres', settings: { sphereSize: 0.8, sphereAccel: 2500, sphereWeight: 80, destructionRate: 7.5, iceRate: 8.5, bonusRate: 12 } },
  { label: 'Massive Spheres', settings: { sphereSize: 4.5, sphereWeight: 500, sphereAccel: 1200, collisionBounce: 0.3, destructionRate: 6.5, iceRate: 7.5, bonusRate: 9 } },
  { label: 'Chaos Mode', settings: { sphereAccel: 2800, collisionBounce: 1.3, sphereWeight: 150, destructionRate: 9.7, iceRate: 9.7, bonusRate: 15, bonusDuration: 2 } },
  { label: 'Zen Mode', settings: { sphereAccel: 1200, collisionBounce: 0.8, sphereWeight: 150, destructionRate: 2.5, iceRate: 4.5, bonusRate: 5, bonusDuration: 6 } },
  { label: 'Big Arena', settings: { arenaSize: 8, destructionRate: 6.5, iceRate: 7.5, bonusRate: 9 } },
  { label: 'Tiny Arena', settings: { arenaSize: 2, destructionRate: 8.5, iceRate: 9, bonusRate: 13 } },
  { label: 'Party Mode', settings: { destructionRate: 9.5, iceRate: 9.5, bonusRate: 14.5, bonusDuration: 3, sphereAccel: 2500, collisionBounce: 1.2 } },
  { label: 'Gladiator', settings: { sphereSize: 3.5, sphereWeight: 350, sphereAccel: 2000, collisionBounce: 1.4, destructionRate: 8, iceRate: 8.5, bonusRate: 12 } },
];

export function formatMatchSettingValue(field, value) {
  const numberValue = Number(value);
  switch (field.format) {
    case 'rings': return `${Math.round(numberValue)} rings`;
    case 'kilograms': return `${Math.round(numberValue)} kg`;
    case 'seconds': return `${numberValue.toFixed(1)} sec`;
    case 'decimal1': return numberValue.toFixed(1);
    default: return Math.round(numberValue).toString();
  }
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {Record<string, string | number>}
 */
export function validateMatchSettings(settings = {}) {
  const source = { ...MATCH_DEFAULTS, ...settings };
  const allowedThemes = new Set(MATCH_THEMES.map(theme => theme.value));
  const themeInput = source.theme === 'default' ? 'tron' : source.theme;
  const validated = {
    theme: allowedThemes.has(themeInput) ? themeInput : MATCH_DEFAULTS.theme,
  };
  for (const field of MATCH_SETTING_FIELDS) {
    const parsed = Number(source[field.key]);
    const fallback = MATCH_DEFAULTS[field.key];
    const finiteValue = Number.isFinite(parsed) ? parsed : fallback;
    const clamped = Math.max(field.min, Math.min(field.max, finiteValue));
    validated[field.key] = field.step >= 1 ? Math.round(clamped / field.step) * field.step : clamped;
  }
  return validated;
}
