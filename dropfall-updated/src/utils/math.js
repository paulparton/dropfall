// Flat-topped hex math

export function hexToPixel(q, r, size) {
    const x = size * (3/2 * q);
    const z = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
    return { x, z };
}

export function pixelToHex(x, z, size) {
    const q = (2/3 * x) / size;
    const r = (-1/3 * x + Math.sqrt(3)/3 * z) / size;
    return hexRound({ q, r });
}

export function hexRound(hex) {
    let q = Math.round(hex.q);
    let r = Math.round(hex.r);
    let s = Math.round(-hex.q - hex.r);

    const q_diff = Math.abs(q - hex.q);
    const r_diff = Math.abs(r - hex.r);
    const s_diff = Math.abs(s - (-hex.q - hex.r));

    if (q_diff > r_diff && q_diff > s_diff) {
        q = -r - s;
    } else if (r_diff > s_diff) {
        r = -q - s;
    }

    return { q, r };
}

export function generateHexGrid(radius) {
    const hexes = [];
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            hexes.push({ q, r });
        }
    }
    return hexes;
}

export function hexDistance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

const hexDirections = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

export function hexNeighbor(hex, direction) {
    const dir = hexDirections[direction];
    return { q: hex.q + dir.q, r: hex.r + dir.r };
}
