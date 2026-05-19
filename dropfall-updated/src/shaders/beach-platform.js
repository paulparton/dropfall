import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { PLATFORM_VERTEX_SHADER } from './platform-vertex.js';

const BEACH_PLATFORM_FRAGMENT_SHADER = `
${COMMON_SDF_GLSL}

uniform float uTime;
uniform float uPulse;
uniform int uState;
uniform float uStateTimer;
uniform vec3 uEdgeColor;
uniform vec3 uBaseColor;
uniform vec3 uIceColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocalPos;

vec3 sampleSandBase(vec2 p, float topMask, out float wetMask, out float shorelineBand, out float wetEdge) {
    vec3 sandPale = vec3(0.9412, 0.8941, 0.7843);  // #f0e4c8
    vec3 sandTan = vec3(0.8314, 0.7216, 0.5882);   // #d4b896
    vec3 sandWet = vec3(0.6275, 0.5020, 0.3765);   // #a08060
    vec3 sandRed = vec3(0.7529, 0.5961, 0.4078);   // #c09868

    float macro = warpedFbm(p * 0.17, 5, 1.35);
    float secondary = warpedFbm(p * 0.29 + vec2(15.3, -9.8), 5, 1.1);
    vec3 base = mix(sandPale, sandTan, smoothstep(0.20, 0.70, macro));
    base = mix(base, sandRed, smoothstep(0.58, 0.90, secondary) * 0.55);

    vec2 rippleUv = rotate2d(0.261799) * p * 0.62;
    float ripple = ridgeFbm(rippleUv + vec2(0.0, uTime * 0.02), 3) * 2.0 - 1.0;
    base += ripple * 0.04;

    float grain = gradientNoise(p * 52.0) * 2.0 - 1.0;
    base += grain * 0.03;

    float wetField = warpedFbm(p * 0.10 + vec2(31.0, -17.0), 5, 1.2);
    wetMask = smoothstep(0.70, 0.88, wetField);
    wetEdge = wetField - 0.74;
    shorelineBand = 1.0 - smoothstep(0.03, 0.17, abs(wetEdge));

    vec3 wetTint = mix(sandWet, sandTan, 0.35);
    base = mix(base, wetTint, wetMask * 0.95);
    base = mix(base, uBaseColor, 0.24);

    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
    float wetSpec = pow(max(dot(normalize(vNormal), lightDir), 0.0), 16.0) * 0.15;
    base += vec3(wetSpec * wetMask * topMask);

    vec3 wetVor = voronoiEdge(p * 2.1 + vec2(uTime * 0.03, -uTime * 0.02));
    float foamTrace = shorelineBand * (1.0 - smoothstep(0.016, 0.05, wetVor.y));
    base += vec3(1.0) * foamTrace * 0.28 * topMask;

    return base;
}

vec3 applyShellScatter(vec2 p, vec3 sand) {
    vec2 shellGrid = p * 1.7;
    vec2 cell = floor(shellGrid);
    vec2 local = fract(shellGrid) - 0.5;
    float cellHash = hash21(cell + vec2(9.3, 3.7));
    float shellChance = step(cellHash, 0.08);

    vec2 jitter = vec2(
        hash21(cell + vec2(2.1, 4.3)),
        hash21(cell + vec2(8.7, 1.9))
    ) - 0.5;
    vec2 shellP = local - jitter * 0.34;
    shellP = rotate2d((hash21(cell + vec2(11.2, 6.6)) - 0.5) * 1.2) * shellP;
    shellP *= vec2(1.35, 0.85);

    float shellDist = sdBox2D(shellP, vec2(0.11, 0.045));
    float shellCore = sdBox2D(shellP + vec2(0.025, 0.0), vec2(0.065, 0.025));
    float shellMask = (1.0 - smoothstep(0.0, 0.018, shellDist)) * shellChance;
    float shellRidge = (1.0 - smoothstep(0.0, 0.012, shellCore)) * shellChance;

    vec3 shellColor = vec3(0.93, 0.89, 0.83);
    sand = mix(sand, shellColor, shellMask * 0.7);
    sand += vec3(0.06, 0.05, 0.04) * shellRidge;

    // Starfish scattered on sand
    vec2 starGrid = p * 0.95;
    vec2 starCell = floor(starGrid);
    vec2 starLocal = fract(starGrid) - 0.5;
    float starHash = hash21(starCell + vec2(31.7, 14.2));
    float starChance = step(starHash, 0.035);
    vec2 starJitter = vec2(
        hash21(starCell + vec2(5.8, 22.1)),
        hash21(starCell + vec2(18.4, 7.3))
    ) - 0.5;
    vec2 starP = starLocal - starJitter * 0.3;
    float starAngle = hash21(starCell + vec2(44.1, 9.9)) * TAU;
    starP = rotate2d(starAngle) * starP;
    // Five-armed star via angular SDF
    float starA = atan(starP.y, starP.x);
    float starR = length(starP);
    float armWave = cos(starA * 5.0) * 0.06 + 0.08;
    float starDist = starR - armWave;
    float starMask = (1.0 - smoothstep(0.0, 0.02, starDist)) * starChance;
    vec3 starColor = mix(vec3(0.85, 0.35, 0.18), vec3(0.92, 0.55, 0.25), hash21(starCell + vec2(6.6, 1.1)));
    float starBump = (1.0 - smoothstep(0.0, 0.04, abs(starDist + 0.01))) * starChance;
    sand = mix(sand, starColor, starMask * 0.75);
    sand += vec3(0.04) * starBump;

    // Tiny pebbles and coral fragments
    vec2 pebGrid = p * 4.5;
    vec2 pebCell = floor(pebGrid);
    vec2 pebLocal = fract(pebGrid) - 0.5;
    float pebHash = hash21(pebCell + vec2(77.1, 23.4));
    float pebChance = step(pebHash, 0.06);
    vec2 pebOff = vec2(hash21(pebCell + vec2(3.3, 8.1)), hash21(pebCell + vec2(12.4, 5.5))) - 0.5;
    float pebDist = length(pebLocal - pebOff * 0.4) - (0.03 + hash21(pebCell + vec2(9.0, 1.0)) * 0.02);
    float pebMask = (1.0 - smoothstep(0.0, 0.012, pebDist)) * pebChance;
    vec3 pebColor = mix(vec3(0.75, 0.72, 0.68), vec3(0.60, 0.55, 0.50), hash21(pebCell));
    sand = mix(sand, pebColor, pebMask * 0.5);

    return sand;
}

float grassBladeLayer(vec2 p, float freq, float width, float swayAmp, float speed, float seedShift, float density) {
    vec2 q = rotate2d(0.12 + seedShift * 0.03) * p;
    float sway = sin(uTime * speed + q.y * 0.55 + q.x * 0.18 + seedShift) * swayAmp;
    vec2 bladeUv = vec2(q.x * freq + sway, q.y * freq * 0.23 + seedShift);

    vec2 cell = fract(bladeUv) - 0.5;
    float blade = 1.0 - smoothstep(width, width + 0.14, abs(cell.x));
    float tip = smoothstep(0.46, -0.44, cell.y + abs(cell.x) * 1.9);

    float clumpNoise = voronoiEdge(q * 0.42 + vec2(seedShift, 1.7)).z;
    float clump = smoothstep(0.20, 0.86, density + clumpNoise * 0.35 + fbm(q * 0.28 + seedShift, 3) * 0.4);
    return blade * tip * clump;
}

vec3 edgeVegetation(vec2 p, float topMask, float hexDistAbs) {
    float edgeBase = 1.0 - smoothstep(0.2, 1.5, hexDistAbs);
    float boundaryNoise = warpedFbm(p * 0.24 + vec2(5.0, -8.0), 4, 1.0);
    float reachIn = mix(0.55, 1.45, boundaryNoise);
    float organicEdge = 1.0 - smoothstep(0.0, reachIn, hexDistAbs);
    float zone = edgeBase * organicEdge * topMask;

    vec3 backGreen = vec3(0.2275, 0.4706, 0.1569); // #3a7828
    vec3 midGreen = vec3(0.3529, 0.5961, 0.2196);  // #5a9838
    vec3 tipGreen = vec3(0.5412, 0.7843, 0.2824);  // #8ac848

    float back = grassBladeLayer(p, 3.9, 0.31, 0.05, 0.8, 0.4, 0.42);
    float mid = grassBladeLayer(p, 5.1, 0.22, 0.09, 1.3, 2.1, 0.50);
    float front = grassBladeLayer(p, 6.7, 0.14, 0.14, 1.8, 4.7, 0.58);

    float barePatch = smoothstep(0.34, 0.82, voronoiEdge(p * 0.46 + vec2(13.0, -2.0)).z);
    back *= zone * barePatch;
    mid *= zone * barePatch;
    front *= zone * barePatch;

    float tipMask = clamp(front * 1.4 + mid * 0.7, 0.0, 1.0);
    vec3 veg = vec3(0.0);
    veg += backGreen * back * 0.8;
    veg += mix(backGreen, midGreen, 0.65) * mid * 1.0;
    veg += mix(midGreen, tipGreen, 0.75) * front * 1.2;
    veg += tipGreen * tipMask * 0.12;

    return veg;
}

vec3 sideSand(vec2 p, float yLocal) {
    vec2 sideUv = vec2(p.x * 0.25 + p.y * 0.08, yLocal * 0.95);
    float layers = fbm(sideUv * 1.9, 4);
    float strat = sin(yLocal * 8.0 + layers * 6.0) * 0.5 + 0.5;
    float compact = warpedFbm(sideUv * 0.65 + vec2(2.0, 3.0), 4, 0.9);

    vec3 lightLayer = vec3(0.80, 0.70, 0.55);
    vec3 darkLayer = vec3(0.50, 0.39, 0.30);
    vec3 c = mix(darkLayer, lightLayer, strat * 0.55 + compact * 0.45);
    c += (gradientNoise(sideUv * 32.0) * 2.0 - 1.0) * 0.02;
    return c * 0.86;
}

vec3 portalWater(vec2 p, float hexInside) {
    vec2 flowA = p * 0.95 + vec2(uTime * 0.23, -uTime * 0.16);
    vec2 flowB = p * 1.65 + vec2(-uTime * 0.13, uTime * 0.21);

    vec3 va = voronoiEdge(flowA);
    vec3 vb = voronoiEdge(flowB);

    float cA = 1.0 - smoothstep(0.010, 0.070, va.y);
    float cB = 1.0 - smoothstep(0.012, 0.085, vb.y);
    float caustics = clamp(cA * 0.75 + cB * 0.65, 0.0, 1.0);

    float centerDepth = smoothstep(0.0, 1.0, hexInside);
    vec3 shallow = vec3(0.20, 0.74, 0.66);
    vec3 deep = vec3(0.03, 0.24, 0.39);
    vec3 water = mix(shallow, deep, centerDepth);

    float wave = warpedFbm(p * 0.30 + vec2(-uTime * 0.08, uTime * 0.04), 4, 1.0);
    water = mix(water, water + vec3(0.05, 0.10, 0.12), smoothstep(0.35, 0.82, wave));
    water += vec3(0.85, 0.95, 1.0) * caustics * 0.30;
    return water;
}

void main() {
    vec2 p = vLocalPos.xz;
    float topMask = smoothstep(0.5, 0.8, vNormal.y);

    float hexSdf = sdHexagon(p, 7.8);
    float hexDistAbs = abs(hexSdf);
    float hexInside = clamp(-hexSdf / 7.8, 0.0, 1.0);

    float wetMask;
    float shorelineBand;
    float wetEdge;
    vec3 topSand = sampleSandBase(p, topMask, wetMask, shorelineBand, wetEdge);
    topSand = applyShellScatter(p, topSand);

    vec3 vegetation = edgeVegetation(p, topMask, hexDistAbs);
    topSand += vegetation;

    // Tide pools - small reflective water pockets in wet areas
    vec3 tideVor = voronoiEdge(p * 1.8 + vec2(3.8, -2.1));
    float tidePool = (1.0 - smoothstep(0.02, 0.06, tideVor.y)) * wetMask * topMask;
    float tideDepth = smoothstep(0.0, 0.15, tideVor.x);
    vec3 tideColor = mix(vec3(0.18, 0.52, 0.48), vec3(0.08, 0.30, 0.38), tideDepth);
    // Animated caustics in tide pools
    vec2 caustUv = p * 3.5 + vec2(uTime * 0.15, -uTime * 0.11);
    vec3 caustVor = voronoiEdge(caustUv);
    float caustic = (1.0 - smoothstep(0.01, 0.06, caustVor.y)) * tidePool;
    tideColor += vec3(0.6, 0.8, 0.9) * caustic * 0.4;
    // Specular highlight on tide pool surface
    vec3 tideReflDir = normalize(vec3(0.3, 1.0, 0.2));
    float tideSpec = pow(max(dot(normalize(vNormal), tideReflDir), 0.0), 24.0);
    tideColor += vec3(1.0, 0.98, 0.9) * tideSpec * 0.35;
    topSand = mix(topSand, tideColor, tidePool * 0.85);

    // Enhanced wet-sand specular with Fresnel-like rim shine
    float rimAngle = 1.0 - max(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)), 0.0);
    float rimShine = pow(rimAngle, 3.0) * wetMask * topMask * 0.12;
    topSand += vec3(0.9, 0.92, 0.95) * rimShine;

    vec3 side = sideSand(p, vLocalPos.y);
    vec3 color = mix(side, topSand, topMask);

    if (uState == 1) {
        float freezeSpread = clamp(uStateTimer * 0.55, 0.0, 1.0);
        vec3 crystal = voronoiEdge(p * 1.25 + vec2(uTime * 0.02, -uTime * 0.03));
        float crystalRim = 1.0 - smoothstep(0.012, 0.075, crystal.y);
        float frostNoise = warpedFbm(p * 0.35 + vec2(8.0, -11.0), 4, 1.0);
        float iceThickness = smoothstep(0.28, 0.86, frostNoise);
        float frost = freezeSpread * clamp(iceThickness * 0.85 + crystalRim * 0.6, 0.0, 1.0);

        vec3 iceBase = mix(vec3(0.70, 0.82, 0.92), uIceColor, 0.65);
        vec3 iceHighlight = vec3(0.92, 0.97, 1.0);
        vec3 iceColor = mix(iceBase, iceHighlight, crystalRim * 0.7 + iceThickness * 0.3);
        color = mix(color, iceColor, frost * (0.78 + 0.22 * topMask));
        color += vec3(0.16, 0.25, 0.31) * (crystalRim * 1.4) * frost * topMask;
    } else if (uState == 2) {
        vec2 hazeP = p + vec2(
            sin(p.y * 2.2 + uTime * 8.0),
            cos(p.x * 2.0 + uTime * 7.2)
        ) * 0.08;
        float heat = fbm(hazeP * 1.8 + uTime * 0.25, 3);
        float pulse = 0.5 + 0.5 * sin(uTime * 11.0);
        vec3 warningBase = color * mix(0.88, 0.62, heat);
        warningBase += vec3(0.55, 0.08, 0.03) * (0.30 + 0.45 * pulse);
        color = mix(color, warningBase, 0.88);
    } else if (uState == 3) {
        vec2 crumbleWarp = p + (vec2(
            gradientNoise(p * 4.8 + uTime * 2.1),
            gradientNoise(p * 4.8 - uTime * 1.8)
        ) - 0.5) * 0.22;
        float crumble = smoothstep(0.40, 0.88, fbm(crumbleWarp * 2.4 + uTime * 0.9, 4));
        float grainBurst = step(0.965, gradientNoise(p * 48.0 + uTime * 2.3));
        vec3 brittle = color * vec3(0.92, 0.78, 0.58);
        brittle -= vec3(0.30, 0.22, 0.16) * crumble;
        brittle += vec3(0.22, 0.18, 0.12) * grainBurst * crumble;
        color = mix(color, brittle, 0.82);
    } else if (uState == 4) {
        vec3 water = portalWater(p, hexInside);
        color = mix(color, water, 0.95 * topMask + 0.70 * (1.0 - topMask));
        float portalPulse = 0.5 + 0.5 * sin(uTime * 3.5);
        color += vec3(0.0, 0.18, 0.25) * portalPulse;
    } else if (uState == 5) {
        float shimmer = gradientNoise(p * 24.0 + vec2(uTime * 0.7, -uTime * 0.55));
        float sparkle = step(0.982, gradientNoise(p * 63.0 + vec2(uTime * 1.3, uTime * 1.1)));
        vec3 goldTone = vec3(0.95, 0.78, 0.40);
        color = mix(color, color + goldTone * (0.29 + shimmer * 0.35), 0.82);

        vec2 gemGrid = p * 2.3;
        vec2 gemCell = floor(gemGrid);
        vec2 gemLocal = fract(gemGrid) - 0.5;
        float gemChance = step(hash21(gemCell + vec2(1.2, 9.4)), 0.05);
        gemLocal = rotate2d((hash21(gemCell + vec2(7.5, 2.6)) - 0.5) * 0.9) * gemLocal;
        float gemShape = sdNgon(gemLocal * 2.1, 0.16, 4);
        float gemMask = (1.0 - smoothstep(0.0, 0.02, gemShape)) * gemChance;
        vec3 gemColor = mix(vec3(0.95, 0.85, 0.45), vec3(1.0, 0.95, 0.70), shimmer);
        color += gemColor * gemMask * (0.77 + 0.63 * sparkle);
        float bonusPulse = 0.5 + 0.5 * sin(uTime * 4.0);
        color += vec3(0.18, 0.12, 0.0) * bonusPulse;
    }

    float microShade = mix(0.70, 1.0, topMask);
    color *= microShade;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createBeachPlatformMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPulse: { value: 0.0 },
            uState: { value: 0 },
            uStateTimer: { value: 0.0 },
            uEdgeColor: { value: new THREE.Color(0x00ffff) },
            uBaseColor: { value: new THREE.Color(0xe6d2b5) },
            uIceColor: { value: new THREE.Color(0x0000ff) }
        },
        vertexShader: PLATFORM_VERTEX_SHADER,
        fragmentShader: BEACH_PLATFORM_FRAGMENT_SHADER,
        transparent: false,
        side: THREE.FrontSide,
        lights: false
    });
}
