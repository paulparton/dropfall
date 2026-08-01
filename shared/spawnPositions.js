/**
 * Online spawn positions.
 *
 * The server is authoritative, so the client has to create its predicted
 * entities exactly where the server created its own. When the two disagree the
 * very first snapshot of every round arrives as a large correction, which the
 * player sees as the ball being dragged across the arena at the start of play.
 * Both sides import this.
 */

// Horizontal separation of the two spawns, in world units.
export const SPAWN_OFFSET_X = 12;
// Tiles are 4 units tall and centred on y=0, so their surface sits here.
export const TILE_SURFACE_Y = 2;
// Balls are dropped slightly above the surface so the round opens with a bounce.
export const SPAWN_DROP_OFFSET = 2;

/**
 * @param {number} slot 1 or 2.
 * @param {{ sphereSize?: number }} [settings]
 */
export function getOnlineSpawnPosition(slot, settings = {}) {
    const sphereSize = Number(settings.sphereSize) || 2;
    return {
        x: slot === 2 ? SPAWN_OFFSET_X : -SPAWN_OFFSET_X,
        y: TILE_SURFACE_Y + sphereSize + SPAWN_DROP_OFFSET,
        z: 0,
    };
}
