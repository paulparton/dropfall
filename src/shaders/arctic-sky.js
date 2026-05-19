import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { SKY_VERTEX_SHADER } from './sky-vertex.js';

const ARCTIC_SKY_FRAGMENT_SHADER = `
${COMMON_SDF_GLSL}

uniform float uTime;

varying vec3 vWorldPosition;

void main() {
    vec3 direction = normalize(vWorldPosition);

    // Polar night sky — dark blue gradient
    float height = direction.y;
    vec3 zenith = vec3(0.02, 0.03, 0.12);
    vec3 horizon = vec3(0.08, 0.12, 0.22);
    vec3 belowHorizon = vec3(0.6, 0.75, 0.85); // snowy ground reflection
    vec3 color;
    if (height > 0.0) {
        color = mix(horizon, zenith, smoothstep(0.0, 0.8, height));
    } else {
        color = mix(horizon, belowHorizon, smoothstep(0.0, -0.4, height));
    }

    // ===== STARS =====
    float azimuth = atan(direction.z, direction.x);
    float elevation = acos(clamp(direction.y, -1.0, 1.0));
    vec2 sphereUV = vec2(azimuth / TAU + 0.5, elevation / PI);

    vec2 starCell = floor(sphereUV * vec2(300.0, 160.0));
    vec2 starLocal = fract(sphereUV * vec2(300.0, 160.0)) - 0.5;
    float starGate = step(0.985, hash21(starCell + vec2(7.0, 3.0)));
    float starOff = hash21(starCell + vec2(1.3, 2.1)) - 0.5;
    float starDist = length(starLocal + vec2(starOff, hash21(starCell + vec2(9.7, 4.4)) - 0.5) * 0.55);
    float star = starGate * smoothstep(0.06, 0.0, starDist);
    float twinkle = sin(uTime * (1.5 + hash21(starCell) * 3.0) + hash21(starCell * 2.0) * TAU) * 0.5 + 0.5;
    color += star * (0.5 + twinkle * 0.5) * vec3(0.8, 0.9, 1.0) * step(0.0, height);

    // ===== AURORA BOREALIS =====
    // Multiple undulating curtains
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float auroraY = 0.25 + fi * 0.15;
        float waveFreq = 3.0 + fi * 1.5;
        float waveSpeed = 0.15 + fi * 0.05;
        float phase = fi * 2.1;

        // Undulating curtain shape
        float wave = sin(azimuth * waveFreq + uTime * waveSpeed + phase)
                    + 0.5 * sin(azimuth * waveFreq * 2.3 + uTime * waveSpeed * 1.7 + phase * 1.4);
        wave *= 0.06;

        float curtainCenter = auroraY + wave;
        float curtainDist = abs(height - curtainCenter);

        // Width varies along azimuth
        float curtainWidth = 0.04 + 0.03 * sin(azimuth * 5.0 + uTime * 0.3 + fi);

        float curtainMask = smoothstep(curtainWidth, 0.0, curtainDist);

        // Vertical rays (fine structure)
        float rayPattern = sin(azimuth * 40.0 + fi * 13.0 + uTime * 0.5) * 0.5 + 0.5;
        rayPattern = pow(rayPattern, 2.0);
        curtainMask *= 0.5 + rayPattern * 0.5;

        // Color: green core, purple/blue edges
        vec3 auroraGreen = vec3(0.1, 0.9, 0.3);
        vec3 auroraPurple = vec3(0.4, 0.1, 0.8);
        vec3 auroraBlue = vec3(0.1, 0.4, 0.9);
        float colorMix = smoothstep(0.0, curtainWidth, curtainDist);
        vec3 auroraColor;
        if (i == 0) auroraColor = mix(auroraGreen, auroraPurple, colorMix);
        else if (i == 1) auroraColor = mix(auroraGreen, auroraBlue, colorMix);
        else auroraColor = mix(vec3(0.2, 0.8, 0.5), auroraPurple, colorMix);

        // Brightness variation
        float brightness = 0.3 + 0.2 * sin(uTime * 0.4 + fi * 1.7);

        // Only above horizon
        curtainMask *= smoothstep(0.0, 0.05, height);

        color += auroraColor * curtainMask * brightness;
    }

    // ===== SNOW PARTICLES =====
    // Falling snow — layered for depth
    for (int layer = 0; layer < 2; layer++) {
        float fl = float(layer);
        float scale = 80.0 + fl * 40.0;
        float speed = 0.08 + fl * 0.04;
        float snowSize = 0.12 - fl * 0.03;

        vec2 snowUV = sphereUV * vec2(scale, scale * 0.6);
        snowUV.y += uTime * speed;

        vec2 snowCell = floor(snowUV);
        vec2 snowLocal = fract(snowUV) - 0.5;

        // Horizontal drift
        float drift = sin(snowCell.y * 0.7 + uTime * 0.3 + fl) * 0.2;
        snowLocal.x += drift;

        float snowGate = step(0.92 - fl * 0.02, hash21(snowCell + vec2(fl * 10.0, 0.0)));
        float snowDist = length(snowLocal);
        float snow = snowGate * smoothstep(snowSize, snowSize * 0.3, snowDist);

        // Only in front hemisphere and mostly above/near horizon
        float snowMask = smoothstep(-0.3, 0.1, height);
        color += snow * vec3(0.8, 0.85, 0.9) * (0.15 - fl * 0.04) * snowMask;
    }

    // ===== DISTANT MOUNTAINS =====
    float mountainAngle = azimuth;
    float mountain1 = 0.05 * sin(mountainAngle * 3.0) + 0.03 * sin(mountainAngle * 7.0 + 1.0)
                     + 0.015 * sin(mountainAngle * 15.0 + 2.0);
    float mountain2 = 0.03 * sin(mountainAngle * 4.0 + 0.5) + 0.02 * sin(mountainAngle * 9.0 + 1.5)
                     + 0.01 * sin(mountainAngle * 18.0 + 3.0);

    // Back range (taller, darker)
    float backMask = smoothstep(0.005, -0.005, height - (mountain1 + 0.05));
    color = mix(color, vec3(0.12, 0.15, 0.25), backMask * 0.8);

    // Front range (shorter, lighter, snowy)
    float frontMask = smoothstep(0.005, -0.005, height - (mountain2 + 0.02));
    vec3 snowMountain = vec3(0.5, 0.55, 0.65);
    color = mix(color, snowMountain, frontMask * 0.7);

    // Snow caps on peaks
    float peakHeight = mountain2 + 0.02;
    float snowCap = smoothstep(peakHeight - 0.01, peakHeight, height) * frontMask;

    // ===== HORIZON GLOW =====
    float horizonGlow = exp(-abs(height) * 15.0);
    color += vec3(0.15, 0.2, 0.35) * horizonGlow * 0.4;

    // Subtle moonlight from upper-right
    float moonDir = dot(direction, normalize(vec3(0.5, 0.6, 0.3)));
    float moonGlow = pow(max(moonDir, 0.0), 80.0);
    color += vec3(0.9, 0.95, 1.0) * moonGlow * 0.8;
    // Moon halo
    float moonHalo = pow(max(moonDir, 0.0), 8.0);
    color += vec3(0.2, 0.25, 0.4) * moonHalo * 0.15;

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createArcticSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: ARCTIC_SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
}
