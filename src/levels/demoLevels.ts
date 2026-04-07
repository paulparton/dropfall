export type TileAbility = 'NORMAL' | 'ICE' | 'PORTAL' | 'BONUS' | 'HAZARD' | 'CHECKPOINT';

export interface HexCoord {
  q: number;
  r: number;
}

export interface LevelTile {
  coord: HexCoord;
  ability: TileAbility;
  height: number;
}

export type LevelMode = 'battle' | 'race';
export type LevelTheme = 'tron' | 'beach' | 'temple' | 'arctic' | 'inferno' | 'default';

export interface RaceCheckpoint {
  id: number;
  coord: HexCoord;
  isStartFinish: boolean;
}

export interface RaceSpawnPoint {
  coord: HexCoord;
  facing: number;
}

export interface RaceConfig {
  laps: number;
  checkpoints: RaceCheckpoint[];
  spawnPoints?: RaceSpawnPoint[];
}

export interface LevelOverrides {
  sphereSize?: number;
  sphereWeight?: number;
  sphereAccel?: number;
  collisionBounce?: number;
  arenaSize?: number;
  destructionRate?: number;
  iceRate?: number;
  portalRate?: number;
  portalCooldown?: number;
  bonusRate?: number;
  bonusDuration?: number;
  boostRegenSpeed?: number;
  boostDrainRate?: number;
  bloomLevel?: number;
  playerAuraSize?: number;
  playerAuraOpacity?: number;
  playerGlowIntensity?: number;
  playerGlowRange?: number;
  theme?: LevelTheme;
  defaultP1Color?: number;
  defaultP2Color?: number;
  defaultP1Hat?: string;
  defaultP2Hat?: string;
}

export interface DemoLevel extends LevelOverrides {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  mode: LevelMode;
  raceConfig?: RaceConfig;
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

const SQRT_3 = Math.sqrt(3);

function axialToCartesian(coord: HexCoord): { x: number; z: number } {
  return {
    x: 1.5 * coord.q,
    z: (SQRT_3 / 2) * coord.q + SQRT_3 * coord.r,
  };
}

interface CartesianPoint {
  x: number;
  z: number;
}

interface PathSegment {
  start: CartesianPoint;
  end: CartesianPoint;
  dx: number;
  dz: number;
  length: number;
  cumulativeStart: number;
}

interface PathProjection {
  distance: number;
  progress: number;
  tangent: CartesianPoint;
  closestPoint: CartesianPoint;
  lateral: number;
}

interface PathDefinition {
  segments: PathSegment[];
  totalLength: number;
}

function buildClosedPath(waypoints: CartesianPoint[]): PathDefinition {
  const points = [...waypoints, waypoints[0]];
  const segments: PathSegment[] = [];
  let cumulativeStart = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];

    if (!start || !end) {
      continue;
    }

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);

    if (length <= 0.0001) {
      continue;
    }

    segments.push({
      start,
      end,
      dx,
      dz,
      length,
      cumulativeStart,
    });

    cumulativeStart += length;
  }

  return {
    segments,
    totalLength: cumulativeStart,
  };
}

function normalizeProgress(progress: number): number {
  const wrapped = progress % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function circularProgressDelta(a: number, b: number): number {
  let delta = a - b;

  if (delta > 0.5) {
    delta -= 1;
  } else if (delta < -0.5) {
    delta += 1;
  }

  return delta;
}

function isProgressInWindow(progress: number, start: number, end: number): boolean {
  const p = normalizeProgress(progress);
  const s = normalizeProgress(start);
  const e = normalizeProgress(end);

  if (s <= e) {
    return p >= s && p <= e;
  }

  return p >= s || p <= e;
}

function isProgressInAnyWindow(progress: number, windows: Array<{ start: number; end: number }>): boolean {
  return windows.some((window) => isProgressInWindow(progress, window.start, window.end));
}

function projectPointToPath(path: PathDefinition, point: CartesianPoint): PathProjection {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  let bestClosestPoint: CartesianPoint = path.segments[0]?.start ?? { x: 0, z: 0 };
  let bestTangent: CartesianPoint = { x: 1, z: 0 };
  let bestLateral = 0;

  for (const segment of path.segments) {
    const toPointX = point.x - segment.start.x;
    const toPointZ = point.z - segment.start.z;
    const segmentLengthSq = segment.length * segment.length;
    const tRaw = (toPointX * segment.dx + toPointZ * segment.dz) / segmentLengthSq;
    const t = Math.min(1, Math.max(0, tRaw));
    const closestPoint = {
      x: segment.start.x + segment.dx * t,
      z: segment.start.z + segment.dz * t,
    };
    const deltaX = point.x - closestPoint.x;
    const deltaZ = point.z - closestPoint.z;
    const distance = Math.hypot(deltaX, deltaZ);

    if (distance < bestDistance) {
      const tangent = {
        x: segment.dx / segment.length,
        z: segment.dz / segment.length,
      };
      const normal = {
        x: -tangent.z,
        z: tangent.x,
      };

      bestDistance = distance;
      bestProgress = normalizeProgress((segment.cumulativeStart + segment.length * t) / path.totalLength);
      bestClosestPoint = closestPoint;
      bestTangent = tangent;
      bestLateral = deltaX * normal.x + deltaZ * normal.z;
    }
  }

  return {
    distance: bestDistance,
    progress: bestProgress,
    tangent: bestTangent,
    closestPoint: bestClosestPoint,
    lateral: bestLateral,
  };
}

function samplePathAtProgress(path: PathDefinition, progress: number): { point: CartesianPoint; tangent: CartesianPoint } {
  const targetDistance = normalizeProgress(progress) * path.totalLength;

  for (const segment of path.segments) {
    const segmentEndDistance = segment.cumulativeStart + segment.length;

    if (targetDistance <= segmentEndDistance) {
      const withinSegment = targetDistance - segment.cumulativeStart;
      const t = segment.length > 0 ? withinSegment / segment.length : 0;
      const tangent = {
        x: segment.dx / segment.length,
        z: segment.dz / segment.length,
      };

      return {
        point: {
          x: segment.start.x + segment.dx * t,
          z: segment.start.z + segment.dz * t,
        },
        tangent,
      };
    }
  }

  const firstSegment = path.segments[0];

  if (!firstSegment) {
    return {
      point: { x: 0, z: 0 },
      tangent: { x: 1, z: 0 },
    };
  }

  return {
    point: firstSegment.start,
    tangent: {
      x: firstSegment.dx / firstSegment.length,
      z: firstSegment.dz / firstSegment.length,
    },
  };
}

function selectEvenlySpacedTilesAcrossWidth(candidates: HexCoord[], desiredCount: number): HexCoord[] {
  if (candidates.length <= desiredCount) {
    return candidates;
  }

  const selected: HexCoord[] = [];
  for (let i = 0; i < desiredCount; i += 1) {
    const index = Math.round((i * (candidates.length - 1)) / (desiredCount - 1));
    const coord = candidates[index];

    if (!coord) {
      continue;
    }

    if (!selected.some((existing) => existing.q === coord.q && existing.r === coord.r)) {
      selected.push(coord);
    }
  }

  return selected;
}

function generateSerpentineCircuit(): DemoLevel {
  const waypoints: CartesianPoint[] = [
    { x: 0, z: -18 },
    { x: 0, z: -12 },
    { x: 10, z: -6 },
    { x: 16, z: 2 },
    { x: 18, z: 6 },
    { x: 14, z: 8 },
    { x: 6, z: 4 },
    { x: 0, z: 0 },
    { x: -6, z: -4 },
    { x: -14, z: -2 },
    { x: -10, z: -12 },
    { x: -4, z: -16 },
  ];

  const path = buildClosedPath(waypoints);
  const trackHalfWidth = 2.55;
  const tiles: LevelTile[] = [];
  const tileMap = new Map<string, LevelTile>();
  const tileProjections = new Map<string, PathProjection>();
  const tilePoints = new Map<string, CartesianPoint>();

  for (let q = -20; q <= 22; q += 1) {
    for (let r = -24; r <= 16; r += 1) {
      const coord = { q, r };
      const point = axialToCartesian(coord);
      const projection = projectPointToPath(path, point);

      if (projection.distance > trackHalfWidth) {
        continue;
      }

      const lateralRatio = Math.abs(projection.lateral) / trackHalfWidth;
      const progress = projection.progress;

      const isIcyCorner = isProgressInAnyWindow(progress, [
        { start: 0.23, end: 0.38 },
        { start: 0.80, end: 0.90 },
      ]);
      const isBoostLane = isProgressInAnyWindow(progress, [
        { start: 0.03, end: 0.11 },
        { start: 0.13, end: 0.22 },
        { start: 0.50, end: 0.60 },
      ]);
      const isStraightExitBonus = isProgressInAnyWindow(progress, [
        { start: 0.22, end: 0.24 },
        { start: 0.37, end: 0.40 },
        { start: 0.59, end: 0.62 },
        { start: 0.73, end: 0.76 },
      ]);
      const isChicaneShoulderHazard =
        isProgressInAnyWindow(progress, [{ start: 0.90, end: 0.99 }]) && lateralRatio >= 0.84;

      let ability: TileAbility = 'NORMAL';

      if (isChicaneShoulderHazard) {
        ability = 'HAZARD';
      } else if (isIcyCorner && lateralRatio >= 0.18) {
        ability = 'ICE';
      } else if (isStraightExitBonus || (isBoostLane && lateralRatio <= 0.55)) {
        ability = 'BONUS';
      }

      const tile: LevelTile = {
        coord,
        ability,
        height: DEFAULT_TILE_HEIGHT,
      };
      const coordKey = keyOf(coord);

      tileMap.set(coordKey, tile);
      tileProjections.set(coordKey, projection);
      tilePoints.set(coordKey, point);
    }
  }

  const sortedTrackCoords = Array.from(tileMap.values())
    .sort((a, b) => (a.coord.q === b.coord.q ? a.coord.r - b.coord.r : a.coord.q - b.coord.q));

  for (const tile of sortedTrackCoords) {
    tiles.push(tile);
  }

  const allCoords = tiles.map((tile) => tile.coord);

  const buildCheckpointLine = (targetProgress: number): HexCoord[] => {
    const sample = samplePathAtProgress(path, targetProgress);
    const normal = { x: -sample.tangent.z, z: sample.tangent.x };

    const candidates = allCoords
      .map((coord) => {
        const coordKey = keyOf(coord);
        const point = tilePoints.get(coordKey);

        if (!point) {
          return null;
        }

        const deltaX = point.x - sample.point.x;
        const deltaZ = point.z - sample.point.z;
        const longitudinal = deltaX * sample.tangent.x + deltaZ * sample.tangent.z;
        const lateral = deltaX * normal.x + deltaZ * normal.z;
        const progressDelta = Math.abs(circularProgressDelta(tileProjections.get(coordKey)?.progress ?? 0, targetProgress));

        if (Math.abs(longitudinal) > 1.45 || Math.abs(lateral) > trackHalfWidth + 0.45 || progressDelta > 0.055) {
          return null;
        }

        return {
          coord,
          lateral,
          longitudinal: Math.abs(longitudinal),
        };
      })
      .filter((candidate): candidate is { coord: HexCoord; lateral: number; longitudinal: number } => Boolean(candidate))
      .sort((a, b) => (a.lateral === b.lateral ? a.longitudinal - b.longitudinal : a.lateral - b.lateral));

    let line = selectEvenlySpacedTilesAcrossWidth(candidates.map((candidate) => candidate.coord), 5);

    if (line.length < 4) {
      const fallback = allCoords
        .map((coord) => {
          const point = tilePoints.get(keyOf(coord));

          if (!point) {
            return null;
          }

          return {
            coord,
            distance: Math.hypot(point.x - sample.point.x, point.z - sample.point.z),
          };
        })
        .filter((candidate): candidate is { coord: HexCoord; distance: number } => Boolean(candidate))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .map((candidate) => candidate.coord);

      line = fallback;
    }

    return line;
  };

  const checkpointProgresses = [0, 0.16, 0.33, 0.5, 0.68, 0.84];
  const checkpoints = checkpointProgresses.map((progress, id) => {
    const checkpointLine = buildCheckpointLine(progress);
    const checkpointCoord =
      checkpointLine[Math.floor(checkpointLine.length / 2)] ?? checkpointLine[0] ?? { q: 0, r: 0 };

    return {
      id,
      coord: checkpointCoord,
      isStartFinish: id === 0,
    };
  });

  const finishSample = samplePathAtProgress(path, 0);
  const finishNormal = {
    x: -finishSample.tangent.z,
    z: finishSample.tangent.x,
  };
  const spawnAnchor = {
    x: finishSample.point.x - finishSample.tangent.x * 2.4,
    z: finishSample.point.z - finishSample.tangent.z * 2.4,
  };

  const spawnCandidates = allCoords
    .map((coord) => {
      const point = tilePoints.get(keyOf(coord));

      if (!point) {
        return null;
      }

      const deltaX = point.x - spawnAnchor.x;
      const deltaZ = point.z - spawnAnchor.z;
      const lateral = deltaX * finishNormal.x + deltaZ * finishNormal.z;
      const longitudinal = deltaX * finishSample.tangent.x + deltaZ * finishSample.tangent.z;

      if (Math.abs(longitudinal) > 1.7 || Math.abs(lateral) > 2.1) {
        return null;
      }

      return {
        coord,
        lateral,
        score: Math.abs(Math.abs(lateral) - 0.9) + Math.abs(longitudinal),
      };
    })
    .filter((candidate): candidate is { coord: HexCoord; lateral: number; score: number } => Boolean(candidate))
    .sort((a, b) => a.score - b.score);

  const leftSpawn = spawnCandidates.find((candidate) => candidate.lateral < 0)?.coord;
  const rightSpawn = spawnCandidates.find((candidate) => candidate.lateral > 0)?.coord;
  const fallbackSpawns = spawnCandidates.slice(0, 2).map((candidate) => candidate.coord);
  const spawnFacing = Math.atan2(finishSample.tangent.z, finishSample.tangent.x);

  const spawnTiles = leftSpawn && rightSpawn ? [leftSpawn, rightSpawn] : fallbackSpawns;
  const spawnPoints = spawnTiles.map((coord) => ({
    coord,
    facing: spawnFacing,
  }));

  return {
    id: 'demo_serpentine_circuit',
    name: 'Serpentine Circuit',
    description: 'A sprawling Mario Kart-style loop with sweeping bends, a hairpin, and a technical chicane.',
    difficulty: 'hard',
    theme: 'default',
    mode: 'race',
    raceConfig: {
      laps: 3,
      checkpoints,
      spawnPoints,
    },
    isDemo: true,
    tiles,
  };
}

const classicArenaCoords = generateHexCoords(4);

const classicArena: DemoLevel = {
  id: 'demo_classic',
  name: 'Classic Arena',
  description: 'Standard radius-4 battlefield with all normal tiles.',
  difficulty: 'normal',
  theme: 'default',
  mode: 'battle',
  isDemo: true,
  tiles: buildTilesFromCoords(classicArenaCoords, () => 'NORMAL'),
};

const iceRing: DemoLevel = {
  id: 'demo_ice_ring',
  name: 'Ice Ring',
  description: 'Outer ring is slippery ice while the center stays stable.',
  difficulty: 'normal',
  theme: 'arctic',
  mode: 'battle',
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
  mode: 'battle',
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
  mode: 'battle',
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
  mode: 'battle',
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

const raceTrackInnerA = 7;
const raceTrackInnerB = 5.5;
const raceTrackOuterA = 11;
const raceTrackOuterB = 9.5;

const raceTrackCoords: HexCoord[] = [];

for (let q = -8; q <= 8; q += 1) {
  for (let r = -10; r <= 10; r += 1) {
    const coord = { q, r };
    const { x, z } = axialToCartesian(coord);
    const outerValue = (x * x) / (raceTrackOuterA * raceTrackOuterA) + (z * z) / (raceTrackOuterB * raceTrackOuterB);
    const innerValue = (x * x) / (raceTrackInnerA * raceTrackInnerA) + (z * z) / (raceTrackInnerB * raceTrackInnerB);

    if (outerValue <= 1 && innerValue >= 1) {
      raceTrackCoords.push(coord);
    }
  }
}

const raceTrackCheckpoints = [
  { id: 0, coord: { q: -1, r: 5 }, isStartFinish: true },
  { id: 1, coord: { q: 6, r: -1 }, isStartFinish: false },
  { id: 2, coord: { q: 3, r: -6 }, isStartFinish: false },
  { id: 3, coord: { q: -6, r: 3 }, isStartFinish: false },
] as const;

const raceTrackSpawnPoints = [
  { coord: { q: -1, r: 5 }, facing: -0.2 },
  { coord: { q: 0, r: 5 }, facing: -0.2 },
];

const raceTrackCheckpointCoordKeys = new Set(raceTrackCheckpoints.map((checkpoint) => keyOf(checkpoint.coord)));

const raceTrack: DemoLevel = {
  id: 'demo_race_track',
  name: 'Race Track',
  description: 'A wide oval circuit with icy corners and bonus straights.',
  difficulty: 'medium',
  theme: 'default',
  mode: 'race',
  raceConfig: {
    laps: 3,
    checkpoints: raceTrackCheckpoints.map((checkpoint) => ({
      id: checkpoint.id,
      coord: checkpoint.coord,
      isStartFinish: checkpoint.isStartFinish,
    })),
    spawnPoints: raceTrackSpawnPoints,
  },
  isDemo: true,
  tiles: buildTilesFromCoords(raceTrackCoords, (coord) => {
    if (raceTrackCheckpointCoordKeys.has(keyOf(coord))) {
      return 'CHECKPOINT';
    }

    const { x, z } = axialToCartesian(coord);

    if (Math.abs(x) >= raceTrackOuterA * 0.74) {
      return 'ICE';
    }

    if (Math.abs(z) >= raceTrackOuterB * 0.78 && Math.abs(x) <= raceTrackOuterA * 0.52) {
      return 'BONUS';
    }

    return 'NORMAL';
  }),
};

const serpentineCircuit: DemoLevel = generateSerpentineCircuit();

export const demoLevels: DemoLevel[] = [
  classicArena,
  iceRing,
  portalMaze,
  tinyDuel,
  gauntlet,
  raceTrack,
  serpentineCircuit,
];
