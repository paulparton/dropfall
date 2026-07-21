import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { PLATFORM_VERTEX_SHADER } from './platform-vertex.js';

// The legacy `tron` key is intentionally retained for save-game and network
// compatibility. Visually it is now Dropfall V2's signature Star Circuit stage.
const STAR_CIRCUIT_PLATFORM_FRAGMENT_SHADER = `
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

float stripe(vec2 p, float spacing, float width) {
    float line = abs(fract((p.x + p.y) / spacing) - 0.5);
    return 1.0 - smoothstep(width, width + 0.025, line);
}

void main() {
    vec2 p = vLocalPos.xz;
    float topMask = smoothstep(0.42, 0.72, vNormal.y);
    float sideMask = 1.0 - topMask;

    // Soft, toy-like base with just enough variation to keep a large arena alive.
    float tileSeed = hash21(floor(vWorldPos.xz / 8.0) + 41.0);
    vec3 cream = vec3(0.93, 0.91, 0.82);
    vec3 mint = vec3(0.39, 0.82, 0.72);
    vec3 periwinkle = vec3(0.48, 0.57, 0.91);
    vec3 base = mix(cream, mix(mint, periwinkle, tileSeed), 0.30);

    float grain = noise2D(p * 1.35 + tileSeed * 13.0) - 0.5;
    base += grain * 0.026;

    // Concentric play markings make movement and speed readable at a glance.
    float radial = length(p);
    float ring = 1.0 - smoothstep(0.035, 0.09, abs(fract(radial * 0.34) - 0.5));
    float cross = stripe(p + tileSeed, 3.8, 0.045);
    float markings = clamp(ring * 0.5 + cross * 0.26, 0.0, 1.0);
    vec3 ink = mix(vec3(0.20, 0.25, 0.39), uEdgeColor, 0.18);
    vec3 color = mix(base, ink, markings * 0.18);

    // Confetti freckles: small, fixed accents instead of noisy circuitry.
    vec2 dotGrid = floor((p + 8.0) * 1.2);
    vec2 dotLocal = fract((p + 8.0) * 1.2) - 0.5;
    float dotGate = step(0.87, hash21(dotGrid + tileSeed * 31.0));
    float confettiDot = (1.0 - smoothstep(0.06, 0.12, length(dotLocal))) * dotGate;
    vec3 dotColor = mix(vec3(1.0, 0.35, 0.43), vec3(1.0, 0.78, 0.18), hash21(dotGrid + 3.0));
    color = mix(color, dotColor, confettiDot * 0.72);

    // A traveling sheen gives the surface a premium molded finish.
    float sheenPos = fract(uTime * 0.055 + tileSeed) * 24.0 - 12.0;
    float sheen = exp(-pow((dot(p, normalize(vec2(0.8, 0.6))) - sheenPos) * 0.65, 2.0));
    color += vec3(1.0, 0.98, 0.84) * sheen * 0.10;

    if (uState == 1) {
        float frost = 0.5 + 0.5 * noise2D(p * 3.2 + uTime * 0.08);
        color = mix(color, vec3(0.52, 0.88, 1.0), 0.50 + frost * 0.18);
    } else if (uState == 2) {
        float warning = 0.5 + 0.5 * sin(uTime * 9.0 + uStateTimer * 5.0);
        float warningStripe = stripe(p, 1.5, 0.18);
        color = mix(color, vec3(1.0, 0.23, 0.28), 0.46 + warningStripe * warning * 0.38);
    } else if (uState == 3) {
        color = mix(color, vec3(1.0, 0.46, 0.16), 0.62);
    } else if (uState == 4) {
        float boostRing = 0.5 + 0.5 * sin(radial * 4.2 - uTime * 6.0);
        color = mix(color, vec3(0.24, 0.91, 0.88), 0.52 + boostRing * 0.18);
    } else if (uState == 5) {
        float bonusPulse = 0.5 + 0.5 * sin(uTime * 4.0);
        color = mix(color, vec3(1.0, 0.78, 0.12), 0.56 + bonusPulse * 0.18);
    }

    // Rounded-looking darker sides visually separate tiles while the bright
    // top remains readable. A thin rim sells each tile as a physical toy part.
    vec3 sideColor = mix(vec3(0.12, 0.16, 0.30), uEdgeColor, 0.16);
    float sideBand = 0.5 + 0.5 * sin((vLocalPos.y + 1.0) * 8.0);
    sideColor += vec3(0.05, 0.07, 0.12) * sideBand;
    color = mix(color, sideColor, sideMask);

    float rim = pow(1.0 - max(vNormal.y, 0.0), 2.2) * topMask;
    color += mix(vec3(1.0), uEdgeColor, 0.28) * rim * (0.12 + uPulse * 0.12);

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createTronPlatformMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPulse: { value: 0.0 },
            uState: { value: 0 },
            uStateTimer: { value: 0.0 },
            uEdgeColor: { value: new THREE.Color(0x7357e8) },
            uBaseColor: { value: new THREE.Color(0xeee9d5) },
            uIceColor: { value: new THREE.Color(0x76ddff) }
        },
        vertexShader: PLATFORM_VERTEX_SHADER,
        fragmentShader: STAR_CIRCUIT_PLATFORM_FRAGMENT_SHADER,
        transparent: false,
        side: THREE.FrontSide,
        lights: false
    });
}
