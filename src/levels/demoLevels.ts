export type TileAbility = 'NORMAL' | 'ICE' | 'PORTAL' | 'BONUS' | 'HAZARD';

export interface HexCoord {
  q: number;
  r: number;
}

export interface LevelTile {
  coord: HexCoord;
  ability: TileAbility;
  height: number;
}

export interface DemoLevel {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  theme: string;
  isDemo: true;
  tiles: LevelTile[];
}

const DEFAULT_TILE_HEIGHT = 4;

function keyOf(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function hexDistanceFromOrigin(coord: HexCoord): number {
  return (Math.abs(coord.q) + Math.abs(coord.r) + Math.abs(-coord.q - coord.r)) / 2;
}

function generateHexCoords(radius: number): HexCoord[] {
  const coords: HexCoord[] = [];

  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);

    for (let r = rMin; r <= rMax; r += 1) {
      coords.push({ q, r });
    }
  }

  return coords;
}

function buildTilesFromCoords(
  coords: HexCoord[],
  getAbility: (coord: HexCoord) => TileAbility,
): LevelTile[] {
  return coords.map((coord) => ({
    coord,
    ability: getAbility(coord),
    height: DEFAULT_TILE_HEIGHT,
  }));
}

const classicArenaCoords = generateHexCoords(4);

const classicArena: DemoLevel = {
  id: 'demo_classic',
  name: 'Classic Arena',
  description: 'Standard radius-4 battlefield with all normal tiles.',
  difficulty: 'normal',
  theme: 'default',
  isDemo: true,
  tiles: buildTilesFromCoords(classicArenaCoords, () => 'NORMAL'),
};

const iceRing: DemoLevel = {
  id: 'demo_ice_ring',
  name: 'Ice Ring',
  description: 'Outer ring is slippery ice while the center stays stable.',
  difficulty: 'normal',
  theme: 'arctic',
  isDemo: true,
  tiles: buildTilesFromCoords(classicArenaCoords, (coord) =>
    hexDistanceFromOrigin(coord) === 4 ? 'ICE' : 'NORMAL',
  ),
};

const portalGaps = new Set<string>([
  '0,-3',
  '1,-3',
  '-1,-2',
  '-2,-1',
  '2,1',
  '1,2',
  '-1,3',
  '-3,1',
  '3,-1',
  '0,2',
]);

const portalChain = new Set<string>([
  '-3,2',
  '-2,2',
  '-1,1',
  '0,0',
  '1,-1',
  '2,-2',
  '3,-2',
]);

const portalMazeCoords = classicArenaCoords.filter((coord) => !portalGaps.has(keyOf(coord)));

const portalMaze: DemoLevel = {
  id: 'demo_portal_maze',
  name: 'Portal Maze',
  description: 'Broken pathways and linked portal lanes create sudden flanks.',
  difficulty: 'hard',
  theme: 'tron',
  isDemo: true,
  tiles: buildTilesFromCoords(portalMazeCoords, (coord) =>
    portalChain.has(keyOf(coord)) ? 'PORTAL' : 'NORMAL',
  ),
};

const tinyDuel: DemoLevel = {
  id: 'demo_tiny_duel',
  name: 'Tiny Duel',
  description: 'Compact radius-2 arena for quick close-quarters rounds.',
  difficulty: 'easy',
  theme: 'default',
  isDemo: true,
  tiles: buildTilesFromCoords(generateHexCoords(2), () => 'NORMAL'),
};

const gauntletCoords: HexCoord[] = [];

for (let q = -5; q <= 5; q += 1) {
  gauntletCoords.push({ q, r: 0 });
}

for (let q = -4; q <= 4; q += 1) {
  if (q % 2 === 0) {
    gauntletCoords.push({ q, r: -1 });
    gauntletCoords.push({ q, r: 1 });
  }
}

for (let q = -2; q <= 2; q += 1) {
  gauntletCoords.push({ q, r: -2 });
}

for (let q = -1; q <= 1; q += 1) {
  gauntletCoords.push({ q, r: 2 });
}

const uniqueGauntletCoords = Array.from(
  new Map(gauntletCoords.map((coord) => [keyOf(coord), coord])).values(),
);

const gauntletHazards = new Set<string>([
  '-5,0',
  '-3,0',
  '-1,0',
  '1,0',
  '3,0',
  '5,0',
  '-2,-2',
  '0,-2',
  '2,-2',
]);

const gauntletBonuses = new Set<string>([
  '-4,0',
  '-2,0',
  '0,0',
  '2,0',
  '4,0',
  '0,2',
]);

const gauntlet: DemoLevel = {
  id: 'demo_gauntlet',
  name: 'Gauntlet',
  description: 'An elongated arena with alternating hazards and reward pockets.',
  difficulty: 'hard',
  theme: 'inferno',
  isDemo: true,
  tiles: buildTilesFromCoords(uniqueGauntletCoords, (coord) => {
    const coordKey = keyOf(coord);

    if (gauntletHazards.has(coordKey)) {
      return 'HAZARD';
    }

    if (gauntletBonuses.has(coordKey)) {
      return 'BONUS';
    }

    return 'NORMAL';
  }),
};

export const demoLevels: DemoLevel[] = [classicArena, iceRing, portalMaze, tinyDuel, gauntlet];
