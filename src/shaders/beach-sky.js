import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { SKY_VERTEX_SHADER } from './sky-vertex.js';

const BEACH_SKY_FRAGMENT_SHADER = `
${COMMON_SDF_GLSL}

uniform float uTime;

varying vec3 vWorldPosition;

void main() {
    vec3 direction = normalize(vWorldPosition);

    vec3 zenithColor = vec3(0.5294, 0.8078, 0.9216);   // #87CEEB
    vec3 horizonSky = vec3(0.8784, 0.9412, 1.0000);    // #E0F0FF

    float aboveHorizon = smoothstep(-0.03, 0.45, direction.y);
    float skyGrad = smoothstep(0.0, 0.95, max(direction.y, 0.0));

    vec3 color = mix(horizonSky, zenithColor, skyGrad);

    vec3 sunDir = normalize(vec3(0.4, 0.6, 0.3));
    float sunDot = max(dot(direction, sunDir), 0.0);
    float sunDisk = smoothstep(0.995, 0.9994, sunDot);
    float sunHalo = pow(sunDot, 12.0) * 0.55;

    vec3 sunCore = vec3(1.0, 0.98, 0.88) * sunDisk;
    vec3 sunGlow = vec3(1.0, 0.78, 0.48) * sunHalo;

    vec2 cloudUv = direction.xz / (max(direction.y, 0.04) + 0.45);
    cloudUv += vec2(uTime * 0.012, uTime * 0.008);

    float cloudNoise = fbm(cloudUv * 2.2, 3);
    float cloudMask = smoothstep(0.53, 0.74, cloudNoise) * smoothstep(-0.02, 0.18, direction.y);
    vec3 cloudColor = vec3(1.0, 1.0, 1.0) * (0.35 + 0.45 * cloudMask);

    // Second cloud layer at different speed and scale for depth.
    vec2 cloudUv2 = direction.xz / (max(direction.y, 0.04) + 0.55);
    cloudUv2 += vec2(-uTime * 0.006, uTime * 0.004);
    float cloudNoise2 = fbm(cloudUv2 * 3.5 + vec2(5.0, 8.0), 4);
    float cloudMask2 = smoothstep(0.58, 0.78, cloudNoise2) * smoothstep(-0.02, 0.22, direction.y);

    // Whispy cirrus clouds high up
    vec2 cirrusUv = direction.xz / (max(direction.y, 0.1) + 0.3);
    cirrusUv += vec2(uTime * 0.018, -uTime * 0.005);
    float cirrus = fbm(cirrusUv * 6.0, 3);
    float cirrusMask = smoothstep(0.55, 0.80, cirrus) * smoothstep(0.15, 0.6, direction.y) * 0.3;

    float oceanMask = smoothstep(0.06, -0.2, direction.y);
    float oceanWave = fbm(direction.xz * 7.0 + vec2(uTime * 0.045, -uTime * 0.035), 3);

    vec3 oceanDeep = vec3(0.0, 0.4118, 0.5804);      // #006994
    vec3 oceanShallow = vec3(0.0784, 0.5686, 0.7059);
    vec3 ocean = mix(oceanDeep, oceanShallow, smoothstep(0.25, 0.8, oceanWave));

    // Ocean foam streaks
    float foamNoise = fbm(direction.xz * 25.0 + vec2(uTime * 0.03, -uTime * 0.02), 3);
    float foam = smoothstep(0.72, 0.82, foamNoise) * oceanMask;
    ocean += vec3(0.85, 0.92, 0.95) * foam * 0.2;

    float horizonSpec = exp(-abs(direction.y) * 28.0) * pow(max(dot(normalize(vec3(direction.x, abs(direction.y), direction.z)), sunDir), 0.0), 16.0);
    ocean += vec3(1.0, 0.9, 0.7) * horizonSpec * 0.85;

    float horizonGlowMask = exp(-abs(direction.y) * 16.0);
    vec3 horizonGlow = vec3(1.0, 0.62, 0.55) * horizonGlowMask * 0.35;

    // God rays radiating from the sun.
    vec2 sunScreen = direction.xz / (max(direction.y, 0.04) + 0.4);
    vec2 sunCenter = sunDir.xz / (sunDir.y + 0.4);
    vec2 rayOffset = sunScreen - sunCenter;
    float rayAngle = atan(rayOffset.y, rayOffset.x);
    float rayDist = length(rayOffset);
    float rays = 0.0;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float a = fi * 1.047 + 0.3;
        float rayWidth = 0.12 + fi * 0.02;
        float angleDiff = abs(mod(rayAngle - a + PI, TAU) - PI);
        float ray = exp(-angleDiff * angleDiff / (rayWidth * rayWidth));
        ray *= exp(-rayDist * (0.3 + fi * 0.1));
        rays += ray;
    }
    float rayVisMask = smoothstep(-0.03, 0.25, direction.y) * smoothstep(0.85, 0.0, abs(direction.y));
    vec3 godRayColor = vec3(1.0, 0.88, 0.6) * rays * rayVisMask * 0.08;

    color += sunCore + sunGlow + godRayColor;
    color = mix(color, color + cloudColor, cloudMask);
    color = mix(color, color + vec3(0.9, 0.92, 0.95) * 0.25, cloudMask2);
    color += vec3(0.95, 0.97, 1.0) * cirrusMask;
    color = mix(color, ocean, oceanMask);
    color += horizonGlow * (0.4 + 0.6 * aboveHorizon);

    // Seagull silhouettes
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float bAz = hash21(vec2(fi, 1.23)) * TAU - PI;
        float bElev = 0.12 + hash21(vec2(fi, 5.67)) * 0.25;
        float bSpeed = 0.015 + hash21(vec2(fi, 9.01)) * 0.01;
        float bPhase = hash21(vec2(fi, 13.45)) * TAU;
        float currentAz = bAz + uTime * bSpeed;
        vec3 birdDir = vec3(cos(currentAz) * cos(bElev), sin(bElev), sin(currentAz) * cos(bElev));
        float birdDot = dot(direction, birdDir);
        float birdDist = acos(clamp(birdDot, -1.0, 1.0));
        // Wing shape approximation
        vec3 bRight = normalize(cross(birdDir, vec3(0.0, 1.0, 0.0)));
        vec3 bUp = cross(bRight, birdDir);
        vec2 birdLocal = vec2(dot(direction - birdDir, bRight), dot(direction - birdDir, bUp)) * 200.0;
        float wingFlap = sin(uTime * 4.0 + bPhase) * 0.4;
        float wing = exp(-abs(birdLocal.y - wingFlap * abs(birdLocal.x)) * 6.0)
                    * (1.0 - smoothstep(0.0, 1.8, abs(birdLocal.x)));
        float birdMask = wing * step(birdDist, 0.04);
        color = mix(color, vec3(0.08, 0.06, 0.05), birdMask * 0.7);
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createBeachSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: BEACH_SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
}
