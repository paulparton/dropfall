import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { SKY_VERTEX_SHADER } from './sky-vertex.js';

const TRON_SKY_FRAGMENT_SHADER = `
${COMMON_SDF_GLSL}

uniform float uTime;

varying vec3 vWorldPosition;

float gridLine(vec2 p, float scale, float width) {
    vec2 g = abs(fract(p * scale) - 0.5);
    float d = min(g.x, g.y);
    return 1.0 - smoothstep(width, width + 0.015, d);
}

void main() {
    vec3 direction = normalize(vWorldPosition);

    // Deep digital void base.
    vec3 color = vec3(0.0, 0.0, 0.07);

    float invY = 1.0 / max(abs(direction.y), 0.025);
    vec2 proj = direction.xz * invY;
    float depthFade = 1.0 / (1.0 + length(proj) * 0.06);

    // TRON-style infinite grid on floor and ceiling.
    float floorMask = step(direction.y, 0.0);
    float ceilingMask = 1.0 - floorMask;

    float gridNear = gridLine(proj, 3.0, 0.02);
    float gridFar = gridLine(proj, 1.2, 0.012);
    float gridMix = (gridNear * 0.65 + gridFar * 0.35) * depthFade;
    vec3 gridColor = vec3(0.0, 0.13, 0.27);
    color += gridColor * gridMix * (floorMask * 1.05 + ceilingMask * 0.85);

    // Digital particles distributed over spherical coordinates.
    float azimuth = atan(direction.z, direction.x);
    float elevation = acos(clamp(direction.y, -1.0, 1.0));
    vec2 sphereUV = vec2(azimuth / TAU + 0.5, elevation / PI);
    vec2 driftUV = sphereUV + vec2(uTime * 0.004, -uTime * 0.0025);

    vec2 starCell = floor(driftUV * vec2(210.0, 120.0));
    vec2 starLocal = fract(driftUV * vec2(210.0, 120.0)) - 0.5;
    float starGate = step(0.988, hash21(starCell + vec2(7.0, 19.0)));
    float starDist = length(starLocal + vec2(
        hash21(starCell + vec2(1.3, 2.1)) - 0.5,
        hash21(starCell + vec2(9.7, 4.4)) - 0.5
    ) * 0.55);
    float star = starGate * (1.0 - smoothstep(0.03, 0.085, starDist));
    vec3 starColor = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 0.2, 0.9), hash21(starCell + vec2(17.0, 3.0)));
    color += starColor * star * 0.8;

    // Neon horizon glow where direction.y ~= 0.
    float horizon = exp(-abs(direction.y) * 38.0);
    float horizonPulse = 0.78 + 0.22 * sin(uTime * 1.7);
    vec3 horizonColor = mix(vec3(0.0, 0.78, 1.0), vec3(0.95, 0.1, 0.95), 0.5 + 0.5 * sin(azimuth * 3.0 + uTime * 0.4));
    color += horizonColor * horizon * horizonPulse * 0.85;

    // Subtle vertical CRT-like scanlines.
    float scan = 0.5 + 0.5 * sin((azimuth / TAU + 0.5) * 720.0);
    color += vec3(0.0, 0.05, 0.08) * scan * 0.035;

    // Falling data rain streams.
    float rainCol = floor((azimuth / TAU + 0.5) * 280.0);
    float rainHash = hash21(vec2(rainCol, 7.77));
    float rainActive = step(0.65, rainHash);
    float rainSpeed = 0.6 + rainHash * 0.8;
    float rainY = fract(-uTime * rainSpeed * 0.12 + rainHash * 10.0);
    float rainElev = elevation / PI;
    float rainTrail = exp(-abs(rainElev - rainY) * 18.0) * smoothstep(0.0, 0.05, rainY - rainElev);
    float rainHead = exp(-pow((rainElev - rainY) * 35.0, 2.0));
    float rainBright = hash21(vec2(rainCol, floor(uTime * 6.0)));
    vec3 rainColor = mix(vec3(0.0, 0.4, 0.2), vec3(0.0, 1.0, 0.5), rainHead);
    color += rainColor * (rainTrail * 0.12 + rainHead * 0.35) * rainActive;
    color += vec3(0.8, 1.0, 0.8) * rainHead * step(0.92, rainBright) * rainActive * 0.2;

    // Pulsing digital aurora bands across the sky.
    float auroraY = direction.y * 3.0;
    float auroraWave = sin(azimuth * 4.0 + uTime * 0.3) * 0.3
                     + sin(azimuth * 7.0 - uTime * 0.5) * 0.15;
    float auroraBand1 = exp(-pow((auroraY - 0.6 - auroraWave) * 6.0, 2.0));
    float auroraBand2 = exp(-pow((auroraY - 0.35 - auroraWave * 0.7) * 8.0, 2.0));
    float auroraFlicker = 0.7 + 0.3 * sin(uTime * 2.3 + azimuth * 5.0);
    vec3 aurora1 = vec3(0.0, 0.6, 1.0) * auroraBand1 * auroraFlicker * 0.18;
    vec3 aurora2 = vec3(0.7, 0.0, 1.0) * auroraBand2 * auroraFlicker * 0.12;
    color += aurora1 + aurora2;

    // Distant electrical discharges / lightning flashes.
    float boltSeed = floor(uTime * 0.4);
    float boltAz = hash21(vec2(boltSeed, 3.3)) * TAU - PI;
    float boltActive = step(0.85, hash21(vec2(boltSeed, 17.1)));
    float boltFade = exp(-fract(uTime * 0.4) * 6.0);
    float boltDist = abs(azimuth - boltAz);
    boltDist = min(boltDist, TAU - boltDist);
    float boltGlow = exp(-boltDist * 8.0) * exp(-abs(direction.y + 0.05) * 12.0);
    color += vec3(0.5, 0.7, 1.0) * boltGlow * boltFade * boltActive * 0.4;

    // Distant digital city silhouette near the horizon.
    float skylineCoord = floor((azimuth / TAU + 0.5) * 160.0);
    float blockHeight = 0.008 + hash21(vec2(skylineCoord, 12.0)) * 0.05;
    float skylineBand = 1.0 - smoothstep(0.0, 0.06, abs(direction.y));
    float skyline = step(abs(direction.y), blockHeight) * skylineBand * step(0.35, hash21(vec2(skylineCoord, 5.0)));
    color = mix(color, color * 0.45, skyline * 0.65);
    color += vec3(0.0, 0.22, 0.3) * skyline * 0.2;

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createTronSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: TRON_SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
}
