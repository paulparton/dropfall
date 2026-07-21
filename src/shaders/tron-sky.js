import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { SKY_VERTEX_SHADER } from './sky-vertex.js';

const STAR_CIRCUIT_SKY_FRAGMENT_SHADER = `
${COMMON_SDF_GLSL}

uniform float uTime;
varying vec3 vWorldPosition;

float starField(vec2 uv, vec2 density, float threshold, float speed) {
    vec2 grid = floor(uv * density);
    vec2 local = fract(uv * density) - 0.5;
    float gate = step(threshold, hash21(grid + density));
    float shape = 1.0 - smoothstep(0.018, 0.095, length(local));
    float twinkle = 0.42 + 0.58 * sin(uTime * speed + hash21(grid + 17.0) * TAU);
    return gate * shape * max(0.18, twinkle);
}

void main() {
    vec3 direction = normalize(vWorldPosition);
    float height = direction.y * 0.5 + 0.5;
    float azimuth = atan(direction.z, direction.x);

    // Midnight violet-to-indigo atmosphere with a hot neon horizon.
    vec3 voidColor = vec3(0.008, 0.004, 0.045);
    vec3 upperColor = vec3(0.055, 0.025, 0.19);
    vec3 horizonColor = vec3(0.32, 0.035, 0.31);
    vec3 color = mix(voidColor, upperColor, smoothstep(0.24, 0.95, height));
    float horizonGlow = exp(-abs(direction.y + 0.015) * 13.0);
    color = mix(color, horizonColor, horizonGlow * 0.72);
    color += vec3(1.0, 0.08, 0.48) * exp(-abs(direction.y - 0.01) * 38.0) * 0.22;

    // Multi-octave nebula ribbons slowly orbit the circuit.
    vec2 nebulaUV = vec2(azimuth * 0.9 + uTime * 0.012, direction.y * 3.8);
    float nebula = fbm(nebulaUV * 1.35 + vec2(8.0, 3.0), 5);
    float nebulaDetail = fbm(nebulaUV * 3.2 - vec2(uTime * 0.008, 5.0), 3);
    float nebulaMask = smoothstep(0.48, 0.76, nebula * 0.72 + nebulaDetail * 0.35);
    nebulaMask *= smoothstep(-0.05, 0.48, direction.y);
    vec3 nebulaColor = mix(vec3(0.12, 0.16, 0.72), vec3(0.95, 0.04, 0.62), noise2D(nebulaUV + 4.0));
    color += nebulaColor * nebulaMask * 0.32;

    // Three parallax-like star layers create depth and different twinkle rates.
    vec2 starUV = vec2(azimuth / TAU + 0.5, acos(clamp(direction.y, -1.0, 1.0)) / PI);
    float distantStars = starField(starUV + vec2(uTime * 0.00035, 0.0), vec2(210.0, 105.0), 0.982, 1.7);
    float midStars = starField(starUV + vec2(uTime * 0.0007, 0.0), vec2(125.0, 68.0), 0.972, 2.6);
    float heroStars = starField(starUV, vec2(72.0, 40.0), 0.978, 4.2);
    color += vec3(0.48, 0.72, 1.0) * distantStars * 0.55;
    color += vec3(0.85, 0.94, 1.0) * midStars * 0.78;
    color += mix(vec3(0.20, 1.0, 0.95), vec3(1.0, 0.24, 0.68), hash21(floor(starUV * 72.0))) * heroStars * 1.35;

    // Striped synth sun anchored just above the skyline.
    vec3 sunDirection = normalize(vec3(-0.64, 0.10, -0.76));
    float sunDot = dot(direction, sunDirection);
    float sunDisc = smoothstep(cos(0.22), cos(0.185), sunDot);
    float sunHalo = smoothstep(cos(0.34), cos(0.20), sunDot) * (1.0 - sunDisc);
    float sunStripe = smoothstep(0.18, 0.34, fract((direction.y + 0.22) * 36.0));
    vec3 sunColor = mix(vec3(1.0, 0.14, 0.55), vec3(1.0, 0.73, 0.19), smoothstep(-0.02, 0.28, direction.y));
    color += sunColor * sunDisc * sunStripe * 1.55;
    color += vec3(1.0, 0.08, 0.58) * sunHalo * 0.32;

    // Distant procedural skyline silhouettes and scattered window lights.
    float cityU = azimuth / TAU + 0.5;
    float buildingCell = floor(cityU * 210.0);
    float buildingHeight = mix(0.018, 0.095, pow(hash21(vec2(buildingCell, 4.0)), 2.1));
    buildingHeight += step(0.94, hash21(vec2(buildingCell, 12.0))) * 0.06;
    float city = step(-0.025, direction.y) * (1.0 - step(buildingHeight, direction.y));
    color = mix(color, vec3(0.008, 0.006, 0.035), city * 0.96);
    vec2 windowGrid = vec2(fract(cityU * 840.0), fract((direction.y + 0.02) * 190.0));
    float windowShape = step(0.26, windowGrid.x) * step(windowGrid.x, 0.68) * step(0.28, windowGrid.y) * step(windowGrid.y, 0.68);
    float windowGate = step(0.76, hash21(floor(vec2(cityU * 840.0, (direction.y + 0.02) * 190.0))));
    color += mix(vec3(0.05, 0.94, 1.0), vec3(1.0, 0.12, 0.62), hash21(vec2(buildingCell, 27.0))) * windowShape * windowGate * city * 0.75;

    // Lower-hemisphere perspective grid: longitude spokes plus concentric lanes.
    float groundMask = 1.0 - smoothstep(-0.20, -0.015, direction.y);
    vec2 gridPosition = direction.xz / max(0.025, -direction.y);
    vec2 squareCell = fract(gridPosition * 0.34);
    vec2 squareDistance = min(squareCell, 1.0 - squareCell);
    float squareLines = 1.0 - smoothstep(0.0, 0.028, min(squareDistance.x, squareDistance.y));
    float radialCell = fract(length(gridPosition) * 0.34 - uTime * 0.035);
    float radialLines = 1.0 - smoothstep(0.0, 0.035, min(radialCell, 1.0 - radialCell));
    float gridFade = exp(-length(gridPosition) * 0.018);
    vec3 gridColor = mix(vec3(0.07, 0.82, 1.0), vec3(1.0, 0.03, 0.60), 0.5 + 0.5 * sin(azimuth * 3.0));
    color = mix(color, vec3(0.006, 0.003, 0.03), groundMask * 0.86);
    color += gridColor * max(squareLines * 0.72, radialLines * 0.45) * groundMask * gridFade * 0.7;

    // Orbit lanes and occasional fast courier streaks make the sky feel alive.
    float orbitWave = sin(azimuth * 3.0 + uTime * 0.12) * 0.035;
    float orbitA = exp(-abs(direction.y - 0.31 - orbitWave) * 115.0);
    float orbitB = exp(-abs(direction.y - 0.48 + sin(azimuth * 2.0 - uTime * 0.08) * 0.05) * 130.0);
    color += vec3(0.08, 0.92, 1.0) * orbitA * 0.25;
    color += vec3(1.0, 0.09, 0.58) * orbitB * 0.18;

    float streakTime = fract(uTime * 0.055);
    vec2 streakStart = vec2(streakTime * 1.6 - 0.3, 0.19 + sin(uTime * 0.41) * 0.08);
    float streak = 1.0 - smoothstep(0.0, 0.006, sdSegment(starUV, streakStart, streakStart + vec2(0.13, -0.045)));
    streak *= smoothstep(0.0, 0.08, streakTime) * (1.0 - smoothstep(0.78, 1.0, streakTime));
    color += vec3(0.66, 0.94, 1.0) * streak * 1.4;

    // Gentle vignette keeps the centre of play readable.
    color *= 0.88 + 0.12 * smoothstep(-0.35, 0.35, direction.z);
    gl_FragColor = vec4(color, 1.0);
}
`;

export function createTronSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0.0 } },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: STAR_CIRCUIT_SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
}
