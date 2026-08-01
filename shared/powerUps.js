export const POWER_UP_DEFINITIONS = Object.freeze([
  Object.freeze({
    type: 'ACCELERATION_BOOST',
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Double acceleration for rapid direction changes.',
    color: 0xff7a2f,
    pattern: 'chevrons',
    iconPath: '/assets/powerups/speed-demon.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ acceleration: 2 }),
  }),
  Object.freeze({
    type: 'SIZE_REDUCTION',
    id: 'shrink',
    name: 'Shrink',
    description: 'Reduce your visible size and mass for agile escapes.',
    color: 0x39a9ff,
    pattern: 'inward',
    iconPath: '/assets/powerups/shrink.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ scale: 0.6, mass: 0.7 }),
  }),
  Object.freeze({
    type: 'WEIGHT_INCREASE',
    id: 'heavy-metal',
    name: 'Heavy Metal',
    description: 'Double mass for stronger momentum and resistance.',
    color: 0x9a5cff,
    pattern: 'gravity',
    iconPath: '/assets/powerups/heavy-metal.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ mass: 2 }),
  }),
  Object.freeze({
    type: 'SPEED_BURST',
    id: 'rocket-boost',
    name: 'Rocket Boost',
    description: 'Fire an immediate impulse along your current direction.',
    color: 0xff4d61,
    pattern: 'burst',
    iconPath: '/assets/powerups/rocket-boost.svg',
    durationKind: 'instant',
    modifiers: Object.freeze({ impulse: 50 }),
  }),
  Object.freeze({
    type: 'LIGHT_TOUCH',
    id: 'floaty',
    name: 'Floaty',
    description: 'Halve gravity for longer aerial recovery.',
    color: 0x47e6b1,
    pattern: 'motes',
    iconPath: '/assets/powerups/floaty.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ gravity: 0.5 }),
  }),
  Object.freeze({
    type: 'SIZE_INCREASE',
    id: 'mega',
    name: 'Mega',
    description: 'Grow your visible size and mass to command more space.',
    color: 0xffdc55,
    pattern: 'expanding-ring',
    iconPath: '/assets/powerups/mega.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ scale: 1.6, mass: 1.6 }),
  }),
  Object.freeze({
    type: 'GRIP_BOOST',
    id: 'traction',
    name: 'Traction',
    description: 'Triple grip for decisive turns and controlled braking.',
    color: 0x35dcff,
    pattern: 'tread',
    iconPath: '/assets/powerups/traction.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ friction: 3 }),
  }),
  Object.freeze({
    type: 'INVULNERABILITY',
    id: 'fortress',
    name: 'Fortress',
    description: 'Gain heavy knockback resistance behind a visible shield.',
    color: 0xff4fd8,
    pattern: 'hex-shield',
    iconPath: '/assets/powerups/fortress.svg',
    durationKind: 'timed',
    modifiers: Object.freeze({ mass: 4 }),
  }),
]);

export const POWER_UP_TYPES = Object.freeze(
  POWER_UP_DEFINITIONS.map(definition => definition.type),
);

const POWER_UP_BY_TYPE = new Map(
  POWER_UP_DEFINITIONS.map(definition => [definition.type, definition]),
);

export function getPowerUpDefinition(type) {
  return POWER_UP_BY_TYPE.get(type) || null;
}

export function getThemeAwarePowerUpColor(type, theme) {
  const definition = getPowerUpDefinition(type);
  if (!definition) return 0xffffff;
  if (theme !== 'arctic') return definition.color;
  const arcticColors = {
    ACCELERATION_BOOST: 0xccddff,
    SIZE_REDUCTION: 0x88ccff,
    WEIGHT_INCREASE: 0xb0d0ff,
    SPEED_BURST: 0x77ddff,
    LIGHT_TOUCH: 0xddecff,
    SIZE_INCREASE: 0xaaddff,
    GRIP_BOOST: 0x99ddff,
    INVULNERABILITY: 0xbbddff,
  };
  return arcticColors[type] || definition.color;
}
