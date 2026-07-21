/**
 * Uniformly samples distinct tiles without replacement. The input order is
 * deliberately irrelevant: every stable tile, including the centre, is a
 * valid destruction candidate.
 */
export function selectRandomDestructionTiles(candidates, count, random = Math.random) {
  const pool = [...candidates];
  const selected = [];
  const limit = Math.min(Math.max(0, Math.floor(count)), pool.length);

  for (let index = 0; index < limit; index += 1) {
    const randomValue = random();
    const roll = Number.isFinite(randomValue) ? randomValue : 0;
    const candidateIndex = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)));
    selected.push(pool.splice(candidateIndex, 1)[0]);
  }

  return selected;
}
