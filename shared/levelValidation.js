const HEX_DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

const SUPPORTED_BATTLE_ABILITIES = new Set(['NORMAL', 'ICE', 'BONUS']);
const SAFE_SPAWN_ABILITIES = new Set(['NORMAL']);

/**
 * `active` is the launch-facing publication switch used by the editor and game.
 * Older level files used `isPublic`; keep those visible until they are explicitly
 * saved with an `active` value.
 */
export function isLevelActive(level) {
  if (typeof level?.active === 'boolean') return level.active;
  return level?.isPublic === true;
}

function coordKey(q, r) {
  return `${q},${r}`;
}

function hexDistance(a, b) {
  const aq = a.q;
  const ar = a.r;
  const as = -aq - ar;
  const bq = b.q;
  const br = b.r;
  const bs = -bq - br;
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
}

function normalizeTile(tile) {
  const q = Number(tile?.coord?.q);
  const r = Number(tile?.coord?.r);
  const height = Number(tile?.height ?? 4);
  const ability = typeof tile?.ability === 'string' ? tile.ability.toUpperCase() : 'NORMAL';
  if (!Number.isInteger(q) || !Number.isInteger(r) || !Number.isFinite(height)) return null;
  return { q, r, height, ability };
}

function neighborKeys(tile) {
  return HEX_DIRECTIONS.map(([dq, dr]) => coordKey(tile.q + dq, tile.r + dr));
}

function connectedComponent(startKey, tileMap) {
  const visited = new Set([startKey]);
  const queue = [startKey];
  while (queue.length > 0) {
    const key = queue.shift();
    const tile = tileMap.get(key);
    if (!tile) continue;
    for (const neighborKey of neighborKeys(tile)) {
      const neighbor = tileMap.get(neighborKey);
      if (!neighbor || visited.has(neighborKey)) continue;
      if (Math.abs(neighbor.height - tile.height) > 2) continue;
      visited.add(neighborKey);
      queue.push(neighborKey);
    }
  }
  return visited;
}

function findSpawnPair(tiles, tileMap) {
  const candidates = tiles.filter(tile => {
    if (!SAFE_SPAWN_ABILITIES.has(tile.ability)) return false;
    const safeNeighbors = neighborKeys(tile).filter(key => {
      const neighbor = tileMap.get(key);
      return neighbor && SAFE_SPAWN_ABILITIES.has(neighbor.ability) && Math.abs(neighbor.height - tile.height) <= 1;
    }).length;
    return safeNeighbors >= 2;
  });

  let bestPair = null;
  let bestDistance = -1;
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      const distance = hexDistance(a, b);
      const oppositeSides = (a.q * b.q <= 0 || a.r * b.r <= 0) && distance >= 4;
      if (oppositeSides && distance > bestDistance) {
        bestDistance = distance;
        bestPair = [a, b];
      }
    }
  }

  return bestPair ? {
    distance: bestDistance,
    coords: bestPair.map(tile => ({ q: tile.q, r: tile.r })),
  } : null;
}

/**
 * Validate an arena for the launch-facing two-player battle mode.
 * Editor files remain loadable even when this reports launchReady=false.
 */
export function validateLevelForLaunch(level, options = {}) {
  const issues = [];
  const warnings = [];
  const mode = level?.mode === 'race' ? 'race' : 'battle';
  const minTiles = Number.isFinite(options.minTiles) ? options.minTiles : 19;
  const maxTiles = Number.isFinite(options.maxTiles) ? options.maxTiles : 240;
  const rawTiles = Array.isArray(level?.tiles) ? level.tiles : [];

  if (mode !== 'battle') issues.push('This build does not ship the race ruleset.');
  if (rawTiles.length < minTiles) issues.push(`Arena needs at least ${minTiles} tiles for a two-player battle.`);
  if (rawTiles.length > maxTiles) issues.push(`Arena exceeds the ${maxTiles}-tile launch performance budget.`);

  const tiles = [];
  const tileMap = new Map();
  let duplicateCount = 0;
  let unsupportedAbilityCount = 0;
  let outOfBoundsCount = 0;

  for (const rawTile of rawTiles) {
    const tile = normalizeTile(rawTile);
    if (!tile) {
      issues.push('Arena contains a tile with invalid coordinates or height.');
      continue;
    }
    if (Math.abs(tile.q) > 24 || Math.abs(tile.r) > 24 || Math.abs(-tile.q - tile.r) > 24) outOfBoundsCount += 1;
    if (!SUPPORTED_BATTLE_ABILITIES.has(tile.ability)) unsupportedAbilityCount += 1;
    const key = coordKey(tile.q, tile.r);
    if (tileMap.has(key)) {
      duplicateCount += 1;
      continue;
    }
    tileMap.set(key, tile);
    tiles.push(tile);
  }

  if (duplicateCount > 0) issues.push(`Arena contains ${duplicateCount} duplicate tile coordinate${duplicateCount === 1 ? '' : 's'}.`);
  if (unsupportedAbilityCount > 0) issues.push(`Arena contains ${unsupportedAbilityCount} unsupported or editor-only tile${unsupportedAbilityCount === 1 ? '' : 's'}.`);
  if (outOfBoundsCount > 0) issues.push(`Arena contains ${outOfBoundsCount} tile${outOfBoundsCount === 1 ? '' : 's'} outside the supported play area.`);

  let largestComponentSize = 0;
  const unvisited = new Set(tileMap.keys());
  while (unvisited.size > 0) {
    const startKey = unvisited.values().next().value;
    const component = connectedComponent(startKey, tileMap);
    largestComponentSize = Math.max(largestComponentSize, component.size);
    for (const key of component) unvisited.delete(key);
  }
  const connectivity = tiles.length > 0 ? largestComponentSize / tiles.length : 0;
  if (connectivity < 0.95) issues.push('At least 95% of arena tiles must form one reachable surface.');

  const spawnPair = findSpawnPair(tiles, tileMap);
  if (!spawnPair) issues.push('Arena has no safe, separated pair of opposing player spawns.');
  else if (spawnPair.distance < 5) warnings.push('Spawn separation is tight; expect immediate close-quarters play.');

  const iceRatio = tiles.length > 0 ? tiles.filter(tile => tile.ability === 'ICE').length / tiles.length : 0;
  if (iceRatio > 0.45) warnings.push('More than 45% of the arena is ice.');

  return {
    valid: issues.length === 0,
    launchReady: issues.length === 0 && mode === 'battle',
    issues: Array.from(new Set(issues)),
    warnings,
    stats: {
      mode,
      tileCount: tiles.length,
      connectivity,
      spawnDistance: spawnPair?.distance ?? 0,
      iceRatio,
    },
    recommendedSpawns: spawnPair?.coords ?? [],
  };
}
