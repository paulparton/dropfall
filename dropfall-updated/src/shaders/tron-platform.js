import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { PLATFORM_VERTEX_SHADER } from './platform-vertex.js';

const TRON_PLATFORM_FRAGMENT_SHADER = `
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

void traceRouteSegment(
    vec2 p,
    vec2 a,
    vec2 b,
    float powered,
    float speed,
    float seed,
    inout float routeDist,
    inout float viaRingDist,
    inout float viaCoreDist,
    inout float packetAccum
) {
    float d = sdSegment(p, a, b);
    routeDist = min(routeDist, d);

    float ringA = abs(sdCircle(p - a, 0.05)) - 0.015;
    float ringB = abs(sdCircle(p - b, 0.05)) - 0.015;
    viaRingDist = min(viaRingDist, min(ringA, ringB));
    viaCoreDist = min(viaCoreDist, min(sdCircle(p - a, 0.012), sdCircle(p - b, 0.012)));

    if (powered > 0.5) {
        vec2 ba = b - a;
        float denom = max(dot(ba, ba), 0.0001);
        float h = clamp(dot(p - a, ba) / denom, 0.0, 1.0);
        float t = fract(h - uTime * speed + seed);
        float packet = exp(-pow((t - 0.08) * 16.0, 2.0));
        packetAccum += packet * exp(-d * 220.0);
    }
}

float ledMaskAt(vec2 p, vec2 center, float radius) {
    float d = sdCircle(p - center, radius);
    return 1.0 - smoothstep(0.0, 0.012, d);
}

float ledGlowAt(vec2 p, vec2 center, float radius) {
    float d = max(sdCircle(p - center, radius), 0.0);
    return exp(-d * 45.0);
}

void main() {
    vec2 p = vLocalPos.xz;
    float topMask = smoothstep(0.45, 0.75, vNormal.y);
    float sideMask = 1.0 - topMask;

    vec3 fr4Base = vec3(0.039, 0.055, 0.039);
    vec3 color = fr4Base;

    // FR4 cross-hatch weave: two high-frequency gradient noise passes at right angles.
    vec2 weaveP1 = p * 20.0;
    vec2 weaveP2 = (rotate2d(PI * 0.5) * p) * 20.0;
    float weaveA = gradientNoise(weaveP1);
    float weaveB = gradientNoise(weaveP2 + vec2(13.1, 7.3));
    float weave = (weaveA + weaveB - 1.0);
    color += vec3(weave * 0.005) * topMask;

    vec3 copperBus = vec3(0.102, 0.071, 0.031);
    vec3 copperSignal = vec3(0.086, 0.063, 0.039);
    vec3 componentMetal = vec3(0.16, 0.15, 0.14);
    vec3 componentCopper = vec3(0.12, 0.085, 0.05);

    float poweredChance = 0.15;
    float glowIntensity = 0.19;
    float packetIntensity = 0.16;
    float flowSpeed = 0.28;
    vec3 poweredColor = uEdgeColor;

    if (uState == 1) {
        poweredColor = mix(uIceColor, vec3(0.75, 0.96, 1.0), 0.25);
        glowIntensity = 0.17;
        packetIntensity = 0.14;
    } else if (uState == 2) {
        poweredChance = 0.40;
        float warnBlink = 0.5 + 0.5 * sin(uTime * 12.0 + uStateTimer * 5.0);
        poweredColor = mix(vec3(0.45, 0.06, 0.04), vec3(0.95, 0.18, 0.1), warnBlink);
        glowIntensity = 0.24;
        packetIntensity = 0.2;
        flowSpeed = 0.42;
    } else if (uState == 3) {
        poweredColor = vec3(1.0, 0.32, 0.08);
        glowIntensity = 0.22;
        packetIntensity = 0.19;
        flowSpeed = 0.34;
    } else if (uState == 4) {
        poweredChance = 0.35;
        poweredColor = vec3(0.25, 0.95, 0.98);
        glowIntensity = 0.23;
        packetIntensity = 0.19;
        flowSpeed = 0.36;
    } else if (uState == 5) {
        poweredChance = 0.35;
        poweredColor = vec3(0.98, 0.8, 0.28);
        glowIntensity = 0.22;
        packetIntensity = 0.18;
        flowSpeed = 0.35;
    }

    // Level 1: coherent fixed power buses spanning entire tile.
    float busDist = 10.0;
    busDist = min(busDist, sdSegment(p, vec2(-8.0, -3.2), vec2(8.0, -3.2)));
    busDist = min(busDist, sdSegment(p, vec2(-8.0, 2.6), vec2(8.0, 2.6)));
    busDist = min(busDist, sdSegment(p, vec2(1.9, -8.0), vec2(1.9, 8.0)));
    float busMask = (1.0 - smoothstep(0.08, 0.11, busDist)) * topMask;

    // Level 2 and Level 4: dense signal routing with vias.
    float cellSize = 1.0;
    vec2 signalUV = (p + 8.0) / cellSize;
    vec2 signalCell = floor(signalUV);
    vec2 signalLocal = fract(signalUV) - 0.5;

    float signalDist = 10.0;
    float signalViaRingDist = 10.0;
    float signalViaCoreDist = 10.0;
    float packetAccum = 0.0;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 cid = signalCell + vec2(float(i), float(j));
            vec2 lp = signalLocal - vec2(float(i), float(j));

            float hasRoute = step(hash21(cid + vec2(3.1, 17.4)), 0.55);
            if (hasRoute < 0.5) {
                continue;
            }

            float powered = hasRoute * step(hash21(cid + vec2(22.1, 8.6)), poweredChance);
            float variant = floor(hash21(cid + vec2(11.2, 29.7)) * 8.0);
            float laneA = mix(-0.32, 0.32, hash21(cid + vec2(9.3, 2.5)));
            float laneB = mix(-0.28, 0.28, hash21(cid + vec2(13.8, 5.2)));
            float side = step(0.5, hash21(cid + vec2(4.6, 40.3))) * 2.0 - 1.0;

            if (variant < 1.0) {
                traceRouteSegment(lp, vec2(-0.5, laneA), vec2(0.5, laneA), powered, flowSpeed, hash21(cid + 1.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else if (variant < 2.0) {
                traceRouteSegment(lp, vec2(laneA, -0.5), vec2(laneA, 0.5), powered, flowSpeed, hash21(cid + 2.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else if (variant < 3.0) {
                vec2 c = vec2(laneA, laneB);
                traceRouteSegment(lp, vec2(-0.5, c.y), c, powered, flowSpeed, hash21(cid + 3.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, c, vec2(c.x, 0.5), powered, flowSpeed, hash21(cid + 3.7), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else if (variant < 4.0) {
                vec2 c0 = vec2(-0.5, laneA);
                vec2 c1 = vec2(0.0, laneA + 0.18 * side);
                vec2 c2 = vec2(0.5, laneA - 0.18 * side);
                traceRouteSegment(lp, c0, c1, powered, flowSpeed, hash21(cid + 4.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, c1, c2, powered, flowSpeed, hash21(cid + 4.8), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else if (variant < 5.0) {
                vec2 c = vec2(laneA, laneB);
                traceRouteSegment(lp, vec2(-0.5, c.y), vec2(0.5, c.y), powered, flowSpeed, hash21(cid + 5.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, c, vec2(c.x, 0.5), powered, flowSpeed, hash21(cid + 5.6), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else if (variant < 6.0) {
                vec2 a = vec2(-0.5, laneA);
                vec2 b = vec2(-0.1, laneA);
                vec2 c = vec2(-0.1, laneB);
                vec2 d = vec2(0.5, laneB);
                traceRouteSegment(lp, a, b, powered, flowSpeed, hash21(cid + 6.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, b, c, powered, flowSpeed, hash21(cid + 6.5), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, c, d, powered, flowSpeed, hash21(cid + 6.9), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else if (variant < 7.0) {
                vec2 c = vec2(laneA, laneB);
                traceRouteSegment(lp, vec2(-0.5, c.y), vec2(0.5, c.y), powered, flowSpeed, hash21(cid + 7.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, c, c + vec2(0.0, 0.25 * side), powered, flowSpeed, hash21(cid + 7.3), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            } else {
                vec2 c = vec2(laneA, laneB);
                traceRouteSegment(lp, vec2(-0.5, c.y), vec2(0.5, c.y), powered, flowSpeed, hash21(cid + 8.0), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
                traceRouteSegment(lp, vec2(c.x, -0.5), vec2(c.x, 0.5), powered, flowSpeed, hash21(cid + 8.8), signalDist, signalViaRingDist, signalViaCoreDist, packetAccum);
            }
        }
    }

    // Level 3: component footprints and packages.
    float coarseCellSize = 2.2;
    vec2 coarseUV = (p + 8.0) / coarseCellSize;
    vec2 coarseCell = floor(coarseUV);
    vec2 coarseLocal = fract(coarseUV) - 0.5;

    float compBodyDist = 10.0;
    float compPinDist = 10.0;
    float compPadDist = 10.0;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 cid = coarseCell + vec2(float(i), float(j));
            vec2 lp = coarseLocal - vec2(float(i), float(j));
            float hasComp = step(hash21(cid + vec2(33.3, 18.2)), 0.12);
            if (hasComp < 0.5) {
                continue;
            }

            float compType = floor(hash21(cid + vec2(54.1, 12.5)) * 3.0);

            if (compType < 1.0) {
                float body = sdBox2D(lp, vec2(0.23, 0.16));
                compBodyDist = min(compBodyDist, body);

                for (int k = 0; k < 4; k++) {
                    float t = mix(-0.16, 0.16, float(k) / 3.0);
                    compPinDist = min(compPinDist, sdBox2D(lp - vec2(-0.26, t), vec2(0.025, 0.012)));
                    compPinDist = min(compPinDist, sdBox2D(lp - vec2(0.26, t), vec2(0.025, 0.012)));
                    compPinDist = min(compPinDist, sdBox2D(lp - vec2(t, -0.19), vec2(0.012, 0.025)));
                    compPinDist = min(compPinDist, sdBox2D(lp - vec2(t, 0.19), vec2(0.012, 0.025)));
                }
            } else if (compType < 2.0) {
                float body = sdRoundedBox(lp, vec2(0.15, 0.06), 0.02);
                compBodyDist = min(compBodyDist, body);
                compPadDist = min(compPadDist, sdCircle(lp - vec2(-0.2, 0.0), 0.045));
                compPadDist = min(compPadDist, sdCircle(lp - vec2(0.2, 0.0), 0.045));
            } else {
                float body = sdBox2D(lp, vec2(0.2, 0.15));
                compBodyDist = min(compBodyDist, body);
                for (int by = 0; by < 3; by++) {
                    for (int bx = 0; bx < 3; bx++) {
                        vec2 gp = vec2(mix(-0.11, 0.11, float(bx) / 2.0), mix(-0.08, 0.08, float(by) / 2.0));
                        compPadDist = min(compPadDist, sdCircle(lp - gp, 0.017));
                    }
                }
            }
        }
    }

    // Scattered through-holes and mounting holes.
    float scatterViaRingDist = 10.0;
    float mountRingDist = 10.0;
    float mountHoleDist = 10.0;

    vec2 viaUV = (p + 8.0) / 0.9;
    vec2 viaCell = floor(viaUV);
    vec2 viaLocal = fract(viaUV) - 0.5;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 cid = viaCell + vec2(float(i), float(j));
            vec2 lp = viaLocal - vec2(float(i), float(j));
            float hasVia = step(hash21(cid + vec2(71.0, 3.0)), 0.2);
            if (hasVia > 0.5) {
                vec2 off = vec2(hash21(cid + 0.3), hash21(cid + 9.8)) * 0.5 - 0.25;
                float ring = abs(sdCircle(lp - off, 0.05)) - 0.015;
                scatterViaRingDist = min(scatterViaRingDist, ring);
            }
        }
    }

    vec2 mount0 = vec2(-5.9, -5.1);
    vec2 mount1 = vec2(5.9, -5.0);
    vec2 mount2 = vec2(0.0, 5.8);
    float m0 = abs(sdCircle(p - mount0, 0.24)) - 0.03;
    float m1 = abs(sdCircle(p - mount1, 0.24)) - 0.03;
    float m2 = abs(sdCircle(p - mount2, 0.24)) - 0.03;
    mountRingDist = min(m0, min(m1, m2));
    mountHoleDist = min(sdCircle(p - mount0, 0.11), min(sdCircle(p - mount1, 0.11), sdCircle(p - mount2, 0.11)));

    float signalMask = (1.0 - smoothstep(0.04, 0.065, signalDist)) * topMask;
    float signalViaRingMask = (1.0 - smoothstep(0.008, 0.02, signalViaRingDist)) * topMask;
    float signalViaCoreMask = (1.0 - smoothstep(0.0, 0.01, signalViaCoreDist)) * topMask;
    float compBodyMask = (1.0 - smoothstep(0.01, 0.03, compBodyDist)) * topMask;
    float compPinMask = (1.0 - smoothstep(0.004, 0.015, compPinDist)) * topMask;
    float compPadMask = (1.0 - smoothstep(0.004, 0.018, compPadDist)) * topMask;
    float scatterViaMask = (1.0 - smoothstep(0.008, 0.02, scatterViaRingDist)) * topMask;
    float mountRingMask = (1.0 - smoothstep(0.015, 0.04, mountRingDist)) * topMask;
    float mountHoleMask = (1.0 - smoothstep(0.0, 0.02, mountHoleDist)) * topMask;

    vec3 dimCopperBus = copperBus * 0.75;
    vec3 dimCopperSignal = copperSignal * 0.8;
    color = mix(color, color + dimCopperBus * busMask, topMask);
    color += dimCopperSignal * signalMask * 0.85;
    color += componentCopper * compBodyMask * 0.55;
    color += componentMetal * compPinMask * 0.35;
    color += componentMetal * compPadMask * 0.45;
    color += copperSignal * signalViaRingMask * 0.7;
    color += copperSignal * scatterViaMask * 0.45;
    color += copperBus * mountRingMask * 0.55;
    color *= 1.0 - mountHoleMask * 0.18;

    float packet = clamp(packetAccum, 0.0, 1.0);
    float poweredTraceMask = signalMask * clamp((poweredChance + 0.02) * 2.2, 0.25, 0.95);
    color += poweredColor * poweredTraceMask * glowIntensity;
    color += poweredColor * signalViaCoreMask * (glowIntensity * 0.65);
    color += mix(poweredColor, vec3(1.0), 0.2) * packet * packetIntensity;

    // Solder mask directional specular on top face.
    vec3 lightDir = normalize(vec3(0.35, 0.9, 0.25));
    vec3 viewDir = normalize(vec3(0.0, 1.0, 0.35));
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normalize(vNormal), halfVec), 0.0), 32.0) * 0.04;
    color += vec3(spec) * topMask;

    // Diagnostic LEDs: tiny and intentionally the only bright element in normal state.
    vec2 ledA = vec2(-6.1, 5.6);
    vec2 ledB = vec2(-5.4, 5.0);
    vec2 ledC = vec2(5.7, -5.4);

    vec3 ledColorA = vec3(0.12, 0.6, 0.2);
    vec3 ledColorB = vec3(0.25, 0.05, 0.04);
    vec3 ledColorC = vec3(0.08, 0.16, 0.08);
    float ledBlink = 1.0;

    if (uState == 2) {
        ledColorA = vec3(0.95, 0.12, 0.08);
        ledColorB = vec3(0.95, 0.12, 0.08);
        ledColorC = vec3(0.75, 0.08, 0.06);
        ledBlink = 0.2 + 0.8 * step(0.0, sin(uTime * 13.0));
    } else if (uState == 4) {
        ledColorA = vec3(0.2, 0.95, 1.0);
        ledColorB = vec3(0.2, 0.95, 1.0);
        ledColorC = vec3(0.16, 0.8, 0.9);
    }

    float ledMaskA = ledMaskAt(p, ledA, 0.05) * topMask;
    float ledMaskB = ledMaskAt(p, ledB, 0.05) * topMask;
    float ledMaskC = ledMaskAt(p, ledC, 0.045) * topMask;
    float ledGlowA = ledGlowAt(p, ledA, 0.05) * topMask;
    float ledGlowB = ledGlowAt(p, ledB, 0.05) * topMask;
    float ledGlowC = ledGlowAt(p, ledC, 0.045) * topMask;

    color += ledColorA * ledMaskA * 0.7 * ledBlink;
    color += ledColorB * ledMaskB * 0.5 * ledBlink;
    color += ledColorC * ledMaskC * 0.35 * ledBlink;
    color += ledColorA * ledGlowA * 0.15 * ledBlink;
    color += ledColorB * ledGlowB * 0.1 * ledBlink;
    color += ledColorC * ledGlowC * 0.08 * ledBlink;

    // State-specific overlays.
    if (uState == 1) {
        vec2 v = voronoi(p * 2.8 + vec2(uTime * 0.05, 0.0));
        float frostEdge = smoothstep(0.03, 0.08, v.y);
        float frostFill = smoothstep(0.0, 0.2, 0.2 - v.x);
        float frost = (frostEdge * 0.6 + frostFill * 0.4) * topMask;
        color = mix(color, color + vec3(0.28, 0.42, 0.45), frost * 0.24);
    } else if (uState == 3) {
        float flicker = step(0.82, hash21(floor(p * 6.0) + vec2(floor(uTime * 18.0), 19.0)));
        float spark = exp(-abs(noise2D(p * 16.0 + uTime * 9.0) - 0.5) * 22.0) * flicker * topMask;
        color += vec3(1.0, 0.45, 0.12) * spark * 0.18;
        color *= 1.0 - flicker * 0.08 * topMask;
    } else if (uState == 4) {
        float ring = sin(length(p) * 4.6 - uTime * 4.8);
        float ringMask = smoothstep(0.92, 1.0, ring) * topMask;
        color += vec3(0.06, 0.22, 0.24) * ringMask * 0.35;
    } else if (uState == 5) {
        float warm = 0.5 + 0.5 * sin(uTime * 2.0 + length(p) * 0.7);
        color += vec3(0.12, 0.09, 0.03) * warm * topMask * 0.22;
    }

    // Scanning beam sweeps diagonally across the tile.
    float scanAngle = 0.45;
    float scanCoord = dot(p, vec2(cos(scanAngle), sin(scanAngle)));
    float scanPos = fract(uTime * 0.12) * 24.0 - 12.0;
    float scanBeam = exp(-pow((scanCoord - scanPos) * 3.5, 2.0));
    color += poweredColor * scanBeam * 0.12 * topMask;

    // Holographic interference shimmer on copper traces.
    float holoPhase = dot(p, vec2(1.7, 2.3)) * 12.0 + uTime * 2.4;
    float holo = (sin(holoPhase) * 0.5 + 0.5) * (sin(holoPhase * 0.37 + 1.1) * 0.5 + 0.5);
    vec3 holoColor = mix(vec3(0.0, 0.8, 1.0), vec3(0.9, 0.1, 0.9), sin(holoPhase * 0.18) * 0.5 + 0.5);
    float traceMask = clamp(signalMask * 0.6 + busMask * 0.4, 0.0, 1.0);
    color += holoColor * holo * traceMask * 0.06 * topMask;

    // Heat-haze micro-distortion on active traces.
    float heatWarp = sin(p.x * 30.0 + uTime * 5.0) * sin(p.y * 28.0 - uTime * 4.2) * 0.006;
    color += poweredColor * abs(heatWarp) * poweredTraceMask * 80.0 * topMask;

    // Side faces: dark substrate with exposed thin copper stackup lines.
    float stackLines = 1.0 - smoothstep(0.42, 0.5, abs(fract((vLocalPos.y + 1.2) * 22.0) - 0.5));
    vec3 sideBase = fr4Base * 0.7;
    vec3 sideCopper = vec3(0.11, 0.075, 0.04);
    vec3 sideColor = sideBase + sideCopper * stackLines * 0.2;
    color = mix(color, sideColor, sideMask);

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
            uEdgeColor: { value: new THREE.Color(0xff00ff) },
            uBaseColor: { value: new THREE.Color(0x0a0a0a) },
            uIceColor: { value: new THREE.Color(0x00ffff) }
        },
        vertexShader: PLATFORM_VERTEX_SHADER,
        fragmentShader: TRON_PLATFORM_FRAGMENT_SHADER,
        transparent: false,
        side: THREE.FrontSide,
        lights: false
    });
}
