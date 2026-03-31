import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { SKY_VERTEX_SHADER } from './sky-vertex.js';

const TEMPLE_SKY_FRAGMENT_SHADER = `${COMMON_SDF_GLSL}
uniform float uTime;

varying vec3 vWorldPosition;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

float silhouette(vec2 p, float freq, float amp, float stepped) {
    float n = fbm(vec2(p.x * freq + uTime * 0.01, p.y), 4);
    n = mix(n, floor(n * stepped) / stepped, 0.55);
    return n * amp;
}

void main() {
    vec3 dir = normalize(vWorldPosition);
    float y = dir.y;
    float horizon = 1.0 - smoothstep(0.05, 0.85, abs(y));

    vec3 zenithColor = vec3(0.19, 0.24, 0.23);
    vec3 midColor = vec3(0.30, 0.34, 0.36);
    vec3 horizonColor = vec3(0.45, 0.49, 0.47);

    float gradTop = smoothstep(-0.10, 0.95, y);
    vec3 color = mix(horizonColor, zenithColor, gradTop);
    color = mix(color, midColor, smoothstep(-0.35, 0.35, y) * 0.35);

    float driftA = fbm(dir.xz * 3.2 + vec2(uTime * 0.010, -uTime * 0.008), 4);
    float driftB = fbm(dir.xz * 5.4 + vec2(-uTime * 0.014, uTime * 0.011), 5);
    float driftC = fbm(dir.xz * 8.0 + vec2(uTime * 0.020, uTime * 0.004), 4);
    float driftD = fbm(dir.xz * 2.1 + vec2(-uTime * 0.007, uTime * 0.013), 4);

    float fog1 = exp(-pow((y - 0.36) * 9.0, 2.0)) * smoothstep(0.24, 0.95, driftA);
    float fog2 = exp(-pow((y - 0.20) * 12.0, 2.0)) * smoothstep(0.30, 0.98, driftB);
    float fog3 = exp(-pow((y - 0.02) * 13.0, 2.0)) * smoothstep(0.36, 0.99, driftC);
    float fog4 = exp(-pow((y + 0.16) * 14.0, 2.0)) * smoothstep(0.40, 1.0, driftD);
    float fogAmount = fog1 * 0.32 + fog2 * 0.30 + fog3 * 0.28 + fog4 * 0.20;
    color = mix(color, vec3(0.52, 0.57, 0.55), saturate(fogAmount));

    float az = atan(dir.z, dir.x);
    float ringX = az / TAU;

    float mountainNoise = fbm(vec2(ringX * 3.8 + 0.5, 2.0), 4);
    float mountainLine = -0.18 + mountainNoise * 0.14;
    float mountainMask = 1.0 - smoothstep(mountainLine - 0.02, mountainLine + 0.07, y);
    vec3 mountainColor = vec3(0.29, 0.27, 0.33);
    color = mix(color, mountainColor, mountainMask * 0.34);

    float treeBack = -0.11 + silhouette(vec2(ringX, 3.0), 10.0, 0.18, 7.0);
    float treeMid = -0.16 + silhouette(vec2(ringX + 5.7, 7.0), 18.0, 0.13, 6.0);
    float treeFront = -0.21 + silhouette(vec2(ringX + 12.4, 11.0), 25.0, 0.11, 5.0);

    float backMask = 1.0 - smoothstep(treeBack - 0.02, treeBack + 0.03, y);
    float midMask = 1.0 - smoothstep(treeMid - 0.015, treeMid + 0.025, y);
    float frontMask = 1.0 - smoothstep(treeFront - 0.015, treeFront + 0.02, y);

    color = mix(color, vec3(0.12, 0.17, 0.12), backMask * 0.55);
    color = mix(color, vec3(0.08, 0.12, 0.09), midMask * 0.70);
    color = mix(color, vec3(0.04, 0.07, 0.05), frontMask * 0.86);

    // Distant temple/pyramid silhouettes on the horizon.
    float templeCoord = floor((az / TAU + 0.5) * 40.0);
    float templeHash = hash21(vec2(templeCoord, 88.8));
    float templeActive = step(0.80, templeHash);
    float templeWidth = 0.3 + templeHash * 0.5;
    float templeLocalX = fract((az / TAU + 0.5) * 40.0) - 0.5;
    // Stepped pyramid shape
    float pyramidY = -0.15;
    float pyramidH = 0.04 + templeHash * 0.06;
    float stepsN = 3.0 + floor(templeHash * 3.0);
    float pyramidStepY = pyramidY;
    float pyramidMask = 0.0;
    for (int s = 0; s < 6; s++) {
        float sf = float(s);
        if (sf >= stepsN) break;
        float stepW = templeWidth * (1.0 - sf / stepsN) * 0.5;
        float stepTop = pyramidY + pyramidH * (sf + 1.0) / stepsN;
        float inStep = step(abs(templeLocalX), stepW) * step(y, stepTop) * step(pyramidStepY, y);
        pyramidMask = max(pyramidMask, inStep);
        pyramidStepY = stepTop;
    }
    pyramidMask *= templeActive * (1.0 - smoothstep(-0.25, -0.08, y));
    color = mix(color, vec3(0.03, 0.04, 0.03), pyramidMask * 0.75);
    // Faint torchlight glow at pyramid tops
    float torchY = pyramidY + pyramidH;
    float torchGlow = exp(-length(vec2(templeLocalX, y - torchY)) * 40.0) * templeActive;
    float torchBlink = 0.6 + 0.4 * sin(uTime * 5.5 + templeHash * 20.0);
    color += vec3(0.7, 0.35, 0.08) * torchGlow * torchBlink * 0.2;

    // Moon with halo
    vec3 moonDir = normalize(vec3(-0.5, 0.72, -0.3));
    float moonDot = max(dot(dir, moonDir), 0.0);
    float moonDisk = smoothstep(0.9985, 0.9995, moonDot);
    float moonHalo = pow(moonDot, 48.0) * 0.2;
    float moonHaloOuter = pow(moonDot, 8.0) * 0.06;
    // Crater detail on moon surface
    float moonAngle = atan(dot(dir - moonDir * moonDot, normalize(cross(moonDir, vec3(0.0, 1.0, 0.0)))),
                           dot(dir - moonDir * moonDot, cross(normalize(cross(moonDir, vec3(0.0, 1.0, 0.0))), moonDir)));
    float moonR = acos(clamp(moonDot, -1.0, 1.0)) * 1400.0;
    vec2 moonUv = vec2(moonAngle, moonR);
    float craterNoise = fbm(moonUv * 0.8, 3);
    float moonSurface = 0.85 + craterNoise * 0.15;
    vec3 moonColor = vec3(0.82, 0.85, 0.78) * moonSurface;
    color += moonColor * moonDisk + vec3(0.5, 0.55, 0.45) * moonHalo + vec3(0.2, 0.25, 0.22) * moonHaloOuter;

    // Shooting stars
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float starSeed = floor(uTime * (0.08 + fi * 0.03));
        float starActive = step(0.7, hash21(vec2(starSeed + fi * 7.7, 42.0)));
        float starTime = fract(uTime * (0.08 + fi * 0.03));
        float starFade = starTime * (1.0 - starTime) * 4.0;
        float starAz = hash21(vec2(starSeed + fi, 1.1)) * TAU - PI;
        float starEl = 0.3 + hash21(vec2(starSeed + fi, 2.2)) * 0.4;
        float starDirAz = hash21(vec2(starSeed + fi, 3.3)) * 0.6 - 0.3;
        float starDirEl = -0.15 - hash21(vec2(starSeed + fi, 4.4)) * 0.1;
        float curAz = starAz + starDirAz * starTime;
        float curEl = starEl + starDirEl * starTime;
        vec3 starPos = vec3(cos(curAz) * cos(curEl), sin(curEl), sin(curAz) * cos(curEl));
        float starDist = length(dir - starPos);
        float starGlow = exp(-starDist * 300.0) * starFade * starActive;
        // Trail behind the star
        for (int t = 1; t < 4; t++) {
            float tf = float(t) * 0.02;
            float trailAz = curAz - starDirAz * tf;
            float trailEl = curEl - starDirEl * tf;
            vec3 trailPos = vec3(cos(trailAz) * cos(trailEl), sin(trailEl), sin(trailAz) * cos(trailEl));
            float trailDist = length(dir - trailPos);
            starGlow += exp(-trailDist * 350.0) * starFade * starActive * (1.0 - tf * 15.0);
        }
        color += vec3(0.9, 0.95, 0.7) * starGlow * 0.8;
    }

    vec3 hazeColor = vec3(0.58, 0.51, 0.30);
    float haze = exp(-abs(y + 0.02) * 8.0) * (0.35 + 0.65 * horizon);
    color = mix(color, hazeColor, haze * 0.23);

    vec3 fireflyColor = vec3(0.80, 0.98, 0.42);
    float fireflies = 0.0;
    for (int i = 0; i < 44; i++) {
        float fi = float(i);
        float h0 = hash(vec2(fi, 3.17));
        float h1 = hash(vec2(fi, 9.71));
        float h2 = hash(vec2(fi, 5.43));

        float a = h0 * TAU;
        float py = -0.55 + h1 * 0.42;
        float pr = sqrt(max(0.0, 1.0 - py * py));
        vec3 p = vec3(cos(a) * pr, py, sin(a) * pr);

        float d = length(dir - p);
        float spot = smoothstep(0.030, 0.0, d);
        float blink = 0.5 + 0.5 * sin(uTime * (1.4 + h2 * 3.0) + fi * 4.17);
        blink = smoothstep(0.62, 1.0, blink);
        fireflies += spot * blink;
    }

    color += fireflyColor * fireflies * 0.95;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createTempleSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: TEMPLE_SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
}