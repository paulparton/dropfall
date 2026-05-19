import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { PLATFORM_VERTEX_SHADER } from './platform-vertex.js';

const ARCTIC_PLATFORM_FRAGMENT_SHADER = `
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

// Voronoi for ice cracks
vec2 voronoiIce(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);
    float md = 8.0;
    float md2 = 8.0;
    vec2 mg;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(17.0, 31.0)));
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) {
                md2 = md;
                md = d;
                mg = g;
            } else if (d < md2) {
                md2 = d;
            }
        }
    }
    return vec2(sqrt(md), sqrt(md2) - sqrt(md));
}

// Snowflake SDF — six-fold symmetry
float snowflakeSDF(vec2 p, float seed) {
    float r = length(p);
    float a = atan(p.y, p.x);

    // Six-fold symmetry
    a = mod(a, TAU / 6.0) - TAU / 12.0;

    vec2 sp = vec2(cos(a), abs(sin(a))) * r;

    // Main arm
    float arm = abs(sp.y) - 0.008 - 0.01 * smoothstep(0.0, 0.15, sp.x);
    arm = max(arm, sp.x - 0.15);
    arm = max(arm, -sp.x - 0.005);

    // Branch — perpendicular barb
    vec2 bp = sp - vec2(0.07, 0.0);
    bp = mat2(0.866, -0.5, 0.5, 0.866) * bp; // rotate 30 deg
    float branch = abs(bp.y) - 0.005;
    branch = max(branch, bp.x - 0.06);
    branch = max(branch, -bp.x - 0.002);

    // Second branch
    vec2 bp2 = sp - vec2(0.11, 0.0);
    bp2 = mat2(0.866, -0.5, 0.5, 0.866) * bp2;
    float branch2 = abs(bp2.y) - 0.004;
    branch2 = max(branch2, bp2.x - 0.04);
    branch2 = max(branch2, -bp2.x - 0.002);

    // Center hub
    float hub = r - 0.015;

    return min(min(arm, min(branch, branch2)), hub);
}

// Frost crystal dendrites
float frostPattern(vec2 p) {
    float val = 0.0;
    float scale = 1.0;
    for (int i = 0; i < 3; i++) {
        vec2 cell = floor(p * scale * 4.0);
        float h = hash21(cell);
        vec2 cp = fract(p * scale * 4.0) - 0.5;
        float angle = h * TAU;
        cp = rotate2d(angle) * cp;
        float d = abs(cp.x) + abs(cp.y); // diamond metric
        val += smoothstep(0.04, 0.0, abs(d - 0.25) - 0.01) * (1.0 / scale);
        scale *= 2.3;
    }
    return val;
}

void main() {
    vec2 uv = vUv;
    vec2 worldUV = vWorldPos.xz * 0.1;

    // -- Base ice color --
    // Translucent ice with depth layers
    float n1 = noise2D(worldUV * 6.0 + uTime * 0.02);
    float n2 = noise2D(worldUV * 12.0 - uTime * 0.015);
    float depth = n1 * 0.4 + n2 * 0.3;

    vec3 iceDeep = vec3(0.15, 0.35, 0.55);
    vec3 iceSurface = vec3(0.78, 0.90, 0.96);
    vec3 color = mix(iceDeep, iceSurface, 0.5 + depth * 0.5);

    // -- Voronoi ice cracks --
    vec2 vor = voronoiIce(worldUV * 8.0);
    float crackLine = smoothstep(0.04, 0.0, vor.y);
    float cellShade = vor.x * 0.15;

    // Cracks are darker with slight blue tint
    color = mix(color, vec3(0.3, 0.5, 0.7), crackLine * 0.6);
    color += cellShade * vec3(0.05, 0.08, 0.12);

    // -- Frost crystal overlay --
    float frost = frostPattern(uv);
    color += frost * vec3(0.85, 0.93, 1.0) * 0.2;

    // -- Snowflakes (2-3 per tile) --
    for (int i = 0; i < 3; i++) {
        float seed = float(i) * 47.3;
        vec2 seedVec = vec2(hash21(vWorldPos.xz + vec2(seed, seed * 1.7)),
                           hash21(vWorldPos.xz + vec2(seed * 2.3, seed * 0.8)));
        vec2 center = seedVec * 0.7 + 0.15;
        float size = 0.08 + hash21(vWorldPos.xz + vec2(seed * 3.1, 0.0)) * 0.06;
        float angle = hash21(vWorldPos.xz + vec2(0.0, seed * 4.7)) * TAU;
        vec2 p = rotate2d(angle) * (uv - center);
        float sf = snowflakeSDF(p / size, seed) * size;
        float mask = smoothstep(0.003, 0.0, sf);
        color = mix(color, vec3(0.95, 0.97, 1.0), mask * 0.7);
    }

    // -- Bubble inclusions (trapped air) --
    for (int i = 0; i < 6; i++) {
        float seed = float(i) * 23.7;
        vec2 bpos = vec2(hash21(vWorldPos.xz + vec2(seed)), hash21(vWorldPos.xz + vec2(seed, seed)));
        float bsize = 0.008 + hash21(vWorldPos.xz + vec2(seed * 2.0, 0.0)) * 0.015;
        float bd = length(uv - bpos) - bsize;
        float bubble = smoothstep(0.003, 0.0, bd);
        float rim = smoothstep(bsize * 0.5, bsize, length(uv - bpos));
        color += bubble * vec3(0.3, 0.5, 0.7) * rim * 0.4;
        // Specular highlight on bubble
        float spec = smoothstep(bsize * 0.7, bsize * 0.4, length(uv - bpos - vec2(0.003, 0.003)));
        color += bubble * spec * vec3(1.0) * 0.3;
    }

    // -- Subsurface shimmer --
    float shimmer = sin(worldUV.x * 30.0 + worldUV.y * 20.0 + uTime * 1.5) * 0.5 + 0.5;
    shimmer *= sin(worldUV.x * 15.0 - worldUV.y * 25.0 + uTime * 1.2) * 0.5 + 0.5;
    color += shimmer * vec3(0.1, 0.15, 0.25) * 0.15;

    // -- Specular glint (Fresnel-like) --
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0))), 3.0);
    color += fresnel * vec3(0.6, 0.8, 1.0) * 0.3;

    // -- Tile edge frost rim --
    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeFrost = smoothstep(0.12, 0.0, edgeDist);
    float edgeNoise = noise2D(uv * 40.0 + vWorldPos.xz * 5.0);
    edgeFrost *= 0.5 + edgeNoise * 0.5;
    color = mix(color, vec3(0.92, 0.96, 1.0), edgeFrost * 0.5);

    // ========== STATE EFFECTS ==========
    if (uState == 1) {
        // ICE state: even more frozen, pulsing crystal blue
        float icePulse = sin(uTime * 3.0) * 0.5 + 0.5;
        color = mix(color, uIceColor, 0.3 + icePulse * 0.15);
        // Frost crystals grow from edges
        float iceGrow = smoothstep(0.3, 0.0, edgeDist) * (0.6 + icePulse * 0.4);
        color = mix(color, vec3(0.7, 0.9, 1.0), iceGrow * 0.4);
    } else if (uState == 2) {
        // WARNING: Cracking ice — red glow from below
        float warnPulse = sin(uTime * 6.0) * 0.5 + 0.5;
        float warnCrack = crackLine * (0.5 + warnPulse * 0.5);
        color = mix(color, vec3(1.0, 0.2, 0.1), warnCrack * 0.8);
        // Orange glow from cracks
        color += vec3(1.0, 0.4, 0.1) * crackLine * warnPulse * 0.3;
    } else if (uState == 3) {
        // FALLING: Shattering — bright cracks, fragments separating
        float shatterTime = min(uStateTimer * 2.0, 1.0);
        color = mix(color, vec3(0.4, 0.7, 1.0), crackLine * shatterTime * 0.9);
        // Brightening as it falls
        color += vec3(0.2, 0.4, 0.8) * shatterTime * 0.3;
    } else if (uState == 4 || uState == 5) {
        // BONUS: Glowing aurora portal
        float bonusPulse = sin(uTime * 2.0 + worldUV.x * 5.0) * 0.5 + 0.5;
        vec3 aurora1 = vec3(0.1, 0.9, 0.4);
        vec3 aurora2 = vec3(0.3, 0.4, 1.0);
        vec3 auroraColor = mix(aurora1, aurora2, bonusPulse);
        color = mix(color, auroraColor, 0.4 + uPulse * 0.2);
    }

    // -- Edge color glow --
    float edgeGlow = smoothstep(0.06, 0.0, edgeDist);
    vec3 eColor = uEdgeColor;
    if (uState == 2) eColor = vec3(1.0, 0.3, 0.1);
    color = mix(color, eColor, edgeGlow * (0.3 + uPulse * 0.3));

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createArcticPlatformMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPulse: { value: 0.0 },
            uState: { value: 0 },
            uStateTimer: { value: 0.0 },
            uEdgeColor: { value: new THREE.Color(0x88ddff) },
            uBaseColor: { value: new THREE.Color(0xc8e8f8) },
            uIceColor: { value: new THREE.Color(0x00ccff) }
        },
        vertexShader: PLATFORM_VERTEX_SHADER,
        fragmentShader: ARCTIC_PLATFORM_FRAGMENT_SHADER,
        transparent: false,
        side: THREE.FrontSide,
        lights: false
    });
}
