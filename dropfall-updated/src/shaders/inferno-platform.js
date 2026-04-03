import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { PLATFORM_VERTEX_SHADER } from './platform-vertex.js';

const INFERNO_PLATFORM_FRAGMENT_SHADER = `
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

// Voronoi for obsidian cracks
vec2 voronoiLava(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float md = 8.0;
    float md2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(23.0, 41.0)));
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) {
                md2 = md;
                md = d;
            } else if (d < md2) {
                md2 = d;
            }
        }
    }
    return vec2(sqrt(md), sqrt(md2) - sqrt(md));
}

// fbm for lava flow
float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
        val += amp * noise2D(p * freq);
        amp *= 0.5;
        freq *= 2.0;
    }
    return val;
}

void main() {
    vec2 uv = vUv;
    vec2 worldUV = vWorldPos.xz * 0.1;

    // -- Obsidian base --
    float stoneNoise = noise2D(worldUV * 15.0) * 0.5 + noise2D(worldUV * 30.0) * 0.25;
    vec3 obsidianDark = vec3(0.05, 0.04, 0.03);
    vec3 obsidianLight = vec3(0.15, 0.12, 0.10);
    vec3 color = mix(obsidianDark, obsidianLight, stoneNoise);

    // Glassy obsidian sheen
    float sheen = noise2D(worldUV * 8.0 + vec2(3.7, 1.2));
    color += vec3(0.02, 0.01, 0.03) * sheen;

    // -- Voronoi cracks with lava underneath --
    vec2 vor = voronoiLava(worldUV * 7.0);
    float crackEdge = vor.y;
    float crackLine = smoothstep(0.06, 0.0, crackEdge);
    float crackInner = smoothstep(0.03, 0.0, crackEdge);

    // Lava color in cracks — animated flow
    float lavaFlow = fbm(worldUV * 3.0 + vec2(uTime * 0.08, uTime * 0.05));
    float lavaPulse = sin(uTime * 1.5 + lavaFlow * 4.0) * 0.5 + 0.5;

    vec3 lavaHot = vec3(1.0, 0.85, 0.2);
    vec3 lavaWarm = vec3(1.0, 0.3, 0.05);
    vec3 lavaCool = vec3(0.6, 0.1, 0.02);
    vec3 lavaColor = mix(lavaCool, mix(lavaWarm, lavaHot, lavaPulse * 0.6), crackInner);

    // Apply lava in cracks
    color = mix(color, lavaColor, crackLine * 0.9);

    // -- Emissive glow around cracks (subsurface lava light) --
    float glowDist = smoothstep(0.15, 0.0, crackEdge);
    color += vec3(0.4, 0.08, 0.01) * glowDist * (0.3 + lavaPulse * 0.2);

    // -- Ash and soot deposits --
    float ash = noise2D(worldUV * 20.0 + vec2(7.3, 2.1));
    ash = smoothstep(0.4, 0.7, ash);
    color = mix(color, vec3(0.08, 0.07, 0.06), ash * 0.25);

    // -- Scorched rock texture --
    float scorch = noise2D(worldUV * 25.0 + vec2(13.0, 5.0));
    scorch = pow(scorch, 3.0);
    color = mix(color, vec3(0.2, 0.08, 0.02), scorch * 0.3);

    // -- Ember particles (tiny glowing dots) --
    for (int i = 0; i < 5; i++) {
        float seed = float(i) * 31.7;
        vec2 epos = vec2(hash21(vWorldPos.xz + vec2(seed, seed * 1.3)),
                        hash21(vWorldPos.xz + vec2(seed * 2.1, seed * 0.7)));
        // Embers drift upward over time
        epos.y = fract(epos.y + uTime * (0.02 + hash21(vWorldPos.xz + vec2(seed * 3.0, 0.0)) * 0.03));
        float eSize = 0.004 + hash21(vWorldPos.xz + vec2(seed * 4.0, 0.0)) * 0.006;
        float eDist = length(uv - epos);
        float ember = smoothstep(eSize, eSize * 0.2, eDist);
        float eBright = sin(uTime * 3.0 + seed) * 0.5 + 0.5;
        color += ember * vec3(1.0, 0.5, 0.1) * (0.3 + eBright * 0.7);
    }

    // -- Volcanic vent (rare, per-tile) --
    float ventChance = hash21(floor(vWorldPos.xz * 0.5));
    if (ventChance > 0.85) {
        vec2 ventPos = vec2(hash21(floor(vWorldPos.xz * 0.5) + vec2(1.0, 0.0)),
                           hash21(floor(vWorldPos.xz * 0.5) + vec2(0.0, 1.0))) * 0.6 + 0.2;
        float ventDist = length(uv - ventPos);
        float vent = smoothstep(0.08, 0.0, ventDist);
        float ventPulse = sin(uTime * 2.0 + ventChance * 10.0) * 0.5 + 0.5;
        color = mix(color, vec3(1.0, 0.7, 0.2), vent * (0.5 + ventPulse * 0.5));
        // Heat haze ring
        float haze = smoothstep(0.15, 0.08, ventDist) * smoothstep(0.06, 0.08, ventDist);
        color += vec3(0.3, 0.1, 0.0) * haze * ventPulse * 0.4;
    }

    // -- Heat shimmer distortion --
    float heatWave = sin(worldUV.y * 40.0 + uTime * 3.0) * sin(worldUV.x * 35.0 + uTime * 2.5);
    color += vec3(0.05, 0.02, 0.0) * heatWave * 0.1;

    // ========== STATE EFFECTS ==========
    if (uState == 1) {
        // ICE state: cooled obsidian — dark crust with blue edges
        float icePulse = sin(uTime * 3.0) * 0.5 + 0.5;
        // Lava goes dark
        color = mix(color, vec3(0.1, 0.1, 0.15), 0.5);
        // Ice crystals in cracks
        color = mix(color, uIceColor, crackLine * 0.5 * (0.6 + icePulse * 0.4));
        // Frost forming on surface
        float frostNoise = noise2D(worldUV * 20.0 + uTime * 0.1);
        color = mix(color, vec3(0.5, 0.7, 0.9), smoothstep(0.3, 0.7, frostNoise) * 0.3);
    } else if (uState == 2) {
        // WARNING: magma surging
        float warnPulse = sin(uTime * 5.0) * 0.5 + 0.5;
        color += vec3(1.0, 0.3, 0.05) * crackLine * warnPulse * 0.6;
        color += vec3(0.5, 0.1, 0.0) * (0.3 + warnPulse * 0.3);
    } else if (uState == 3) {
        // FALLING: erupting — lava everywhere
        float eruptTime = min(uStateTimer * 2.0, 1.0);
        color = mix(color, vec3(1.0, 0.5, 0.1), eruptTime * 0.6);
        color += vec3(0.5, 0.2, 0.0) * eruptTime * crackLine;
    } else if (uState == 4 || uState == 5) {
        // BONUS: fire portal
        float bonusPulse = sin(uTime * 3.0 + worldUV.x * 8.0) * 0.5 + 0.5;
        vec3 fire1 = vec3(1.0, 0.6, 0.1);
        vec3 fire2 = vec3(1.0, 0.2, 0.05);
        color = mix(color, mix(fire1, fire2, bonusPulse), 0.4 + uPulse * 0.2);
    }

    // -- Edge glow --
    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeGlow = smoothstep(0.06, 0.0, edgeDist);
    vec3 eColor = uEdgeColor;
    if (uState == 2) eColor = vec3(1.0, 0.2, 0.0);
    color = mix(color, eColor, edgeGlow * (0.4 + uPulse * 0.3));

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createInfernoPlatformMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPulse: { value: 0.0 },
            uState: { value: 0 },
            uStateTimer: { value: 0.0 },
            uEdgeColor: { value: new THREE.Color(0xff4400) },
            uBaseColor: { value: new THREE.Color(0x1a0a00) },
            uIceColor: { value: new THREE.Color(0x00ffff) }
        },
        vertexShader: PLATFORM_VERTEX_SHADER,
        fragmentShader: INFERNO_PLATFORM_FRAGMENT_SHADER,
        transparent: false,
        side: THREE.FrontSide,
        lights: false
    });
}
