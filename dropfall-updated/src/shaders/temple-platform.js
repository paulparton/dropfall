import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { PLATFORM_VERTEX_SHADER } from './platform-vertex.js';

const TEMPLE_PLATFORM_FRAGMENT_SHADER = `${COMMON_SDF_GLSL}
uniform float uTime;
uniform float uPulse;
uniform int uState;
uniform float uStateTimer;
uniform vec3 uEdgeColor;
uniform vec3 uBaseColor;
uniform vec3 uIceColor;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocalPos;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

float motifSteppedPyramid(vec2 p) {
    float d = 1e5;
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float size = 5.9 - fi * 0.72;
        float ring = abs(sdBox2D(p, vec2(size))) - 0.07;
        d = min(d, ring);

        vec2 cp = abs(p) - vec2(size, size);
        float l0 = sdSegment(cp, vec2(0.0), vec2(0.46, 0.0)) - 0.055;
        float l1 = sdSegment(cp, vec2(0.0), vec2(0.0, 0.46)) - 0.055;
        d = min(d, min(l0, l1));
    }

    float peak = abs(sdCircle(p, 0.32)) - 0.07;
    d = min(d, peak);
    return d;
}

float motifSunCalendar(vec2 p) {
    float d = 1e5;
    d = min(d, abs(sdCircle(p, 1.00)) - 0.075);
    d = min(d, abs(sdCircle(p, 1.52)) - 0.06);

    for (int i = 0; i < 12; i++) {
        float a = (float(i) / 12.0) * TAU;
        vec2 rp = rotate2d(a) * p;

        vec2 t0 = vec2(0.0, 3.20);
        vec2 t1 = vec2(-0.26, 1.72);
        vec2 t2 = vec2(0.26, 1.72);
        d = min(d, abs(sdTriangle(rp, t0, t1, t2)) - 0.03);

        float aDot = a + TAU / 24.0;
        vec2 dp = rotate2d(aDot) * p;
        for (int j = 0; j < 3; j++) {
            float r = 1.95 + float(j) * 0.48;
            vec2 c = vec2(0.0, r);
            d = min(d, abs(sdCircle(dp - c, 0.08)) - 0.025);
        }

        vec2 tp = rotate2d(a + TAU / 24.0) * p;
        float tooth = abs(sdBox2D(tp - vec2(0.0, 3.95), vec2(0.13, 0.24))) - 0.03;
        d = min(d, tooth);
    }

    return d;
}

float motifFeatheredSerpent(vec2 p) {
    float d = 1e5;

    const int CNT = 11;
    vec2 pts[CNT];
    for (int i = 0; i < CNT; i++) {
        float x = -5.8 + float(i) * (11.6 / float(CNT - 1));
        float y = sin(x * 0.9) * 1.25;
        pts[i] = vec2(x, y);
    }

    for (int i = 0; i < CNT - 1; i++) {
        float body = sdSegment(p, pts[i], pts[i + 1]) - 0.20;
        d = min(d, body);
    }

    for (int i = 0; i < 14; i++) {
        float x = -5.2 + float(i) * 0.82;
        float y = sin(x * 0.9) * 1.25;
        float angle = 0.75 + sin(x * 1.7) * 0.4;
        vec2 sp = rotate2d(angle) * (p - vec2(x, y));
        float scale = abs(sdBox2D(sp, vec2(0.14, 0.27))) - 0.03;
        d = min(d, scale);

        vec2 fp = p - vec2(x, y);
        float f0 = sdSegment(fp, vec2(0.28, -0.25), vec2(0.78, -0.48)) - 0.028;
        float f1 = sdSegment(fp, vec2(0.28, 0.25), vec2(0.78, 0.48)) - 0.028;
        d = min(d, min(f0, f1));
    }

    vec2 headPos = vec2(5.75, sin(5.75 * 0.9) * 1.25);
    vec2 hp = p - headPos;
    float jaw = abs(sdTriangle(hp, vec2(0.66, 0.0), vec2(-0.38, -0.32), vec2(-0.38, 0.32))) - 0.03;
    float eye = abs(sdCircle(hp - vec2(0.08, 0.0), 0.10)) - 0.03;
    d = min(d, min(jaw, eye));

    return d;
}

float motifAztecCross(vec2 p) {
    float d = 1e5;

    float cross = abs(sdCross(p, vec2(2.15, 0.72), 0.02)) - 0.065;
    d = min(d, cross);

    for (int qy = 0; qy < 2; qy++) {
        for (int qx = 0; qx < 2; qx++) {
            vec2 s = vec2(float(qx) * 2.0 - 1.0, float(qy) * 2.0 - 1.0);
            vec2 pp = p - s * vec2(3.2, 3.2);
            for (int i = 0; i < 4; i++) {
                float sz = 1.25 - float(i) * 0.24;
                d = min(d, abs(sdBox2D(pp, vec2(sz))) - 0.05);
            }
        }
    }

    for (int i = 0; i < 4; i++) {
        float a = (float(i) / 4.0) * TAU + PI * 0.25;
        vec2 c = vec2(cos(a), sin(a)) * 1.95;
        d = min(d, abs(sdCircle(p - c, 0.12)) - 0.03);
    }

    for (int i = 0; i < 4; i++) {
        vec2 dir = vec2(0.0);
        if (i == 0) dir = vec2(1.0, 0.0);
        if (i == 1) dir = vec2(-1.0, 0.0);
        if (i == 2) dir = vec2(0.0, 1.0);
        if (i == 3) dir = vec2(0.0, -1.0);
        float link = sdSegment(p, dir * 2.2, dir * 5.1) - 0.045;
        d = min(d, link);
    }

    d = min(d, abs(sdCircle(p, 5.25)) - 0.05);
    return d;
}

float motifSkullRack(vec2 p) {
    float d = 1e5;

    d = min(d, abs(sdHexagon(p, 5.85)) - 0.055);

    d = min(d, sdSegment(p, vec2(-5.2, 1.95), vec2(5.2, 1.95)) - 0.08);
    d = min(d, sdSegment(p, vec2(-5.2, -1.95), vec2(5.2, -1.95)) - 0.08);

    for (int i = 0; i < 4; i++) {
        float x = -3.9 + float(i) * 2.6;
        vec2 sp = p - vec2(x, 0.0);

        float skull = abs(sdCircle(sp + vec2(0.0, 0.3), 0.72)) - 0.05;
        float jaw = abs(sdBox2D(sp - vec2(0.0, 0.55), vec2(0.42, 0.26))) - 0.05;
        float eyeA = abs(sdCircle(sp + vec2(-0.22, 0.28), 0.10)) - 0.025;
        float eyeB = abs(sdCircle(sp + vec2(0.22, 0.28), 0.10)) - 0.025;

        d = min(d, min(min(skull, jaw), min(eyeA, eyeB)));

        if (i < 3) {
            float postX = x + 1.3;
            float post = sdSegment(p, vec2(postX, -1.8), vec2(postX, 1.8)) - 0.05;
            d = min(d, post);
        }
    }

    return d;
}

float motifMeanderGlyph(vec2 p) {
    float d = 1e5;

    float ang = atan(p.y, p.x);
    float rad = length(p);
    float seg = floor((ang + PI) / (TAU / 24.0));
    float localAng = (fract((ang + PI) / (TAU / 24.0)) - 0.5) * 2.0;
    float parity = mod(seg, 2.0);

    vec2 uv = vec2(localAng * 0.85, rad - 5.95);
    float stairA = abs(sdBox2D(uv - vec2(-0.16, 0.00), vec2(0.17, 0.08))) - 0.03;
    float stairB = abs(sdBox2D(uv - vec2(0.02, mix(0.13, -0.13, parity)), vec2(0.17, 0.08))) - 0.03;
    float stairC = abs(sdBox2D(uv - vec2(0.20, 0.00), vec2(0.17, 0.08))) - 0.03;
    d = min(d, min(stairA, min(stairB, stairC)));

    float oct = abs(sdNgon(p, 2.15, 8)) - 0.06;
    d = min(d, oct);

    for (int i = 0; i < 8; i++) {
        float a = (float(i) / 8.0) * TAU;
        vec2 rp = rotate2d(a + PI * 0.125) * p;
        float tri = abs(sdTriangle(rp, vec2(0.0, 1.55), vec2(-0.42, 0.55), vec2(0.42, 0.55))) - 0.03;
        d = min(d, tri);
    }

    return d;
}

float motifDistance(vec2 p, float motifIndex) {
    if (motifIndex < 1.0) {
        return motifSteppedPyramid(p);
    }
    if (motifIndex < 2.0) {
        return motifSunCalendar(p);
    }
    if (motifIndex < 3.0) {
        return motifFeatheredSerpent(p);
    }
    if (motifIndex < 4.0) {
        return motifAztecCross(p);
    }
    if (motifIndex < 5.0) {
        return motifSkullRack(p);
    }
    return motifMeanderGlyph(p);
}

vec3 stonePalette(float t) {
    vec3 c0 = vec3(0.2902, 0.2706, 0.2392);
    vec3 c1 = vec3(0.4157, 0.3686, 0.3059);
    vec3 c2 = vec3(0.5412, 0.4941, 0.4314);
    vec3 c3 = vec3(0.4784, 0.3686, 0.2902);
    vec3 c4 = vec3(0.6039, 0.5569, 0.4941);

    vec3 col = mix(c0, c1, smoothstep(0.08, 0.28, t));
    col = mix(col, c2, smoothstep(0.30, 0.52, t));
    col = mix(col, c3, smoothstep(0.54, 0.72, t));
    col = mix(col, c4, smoothstep(0.74, 0.95, t));
    return col;
}

void main() {
    vec2 p = vLocalPos.xz;
    float topMask = smoothstep(0.45, 0.88, vNormal.y);

    vec2 tileId = floor(vWorldPos.xz / 16.0);
    vec2 tileUV = fract(vWorldPos.xz / 16.0) * 16.0 - 8.0;
    float tileHash = hash(tileId);
    float motifIndex = floor(tileHash * 6.0);

    vec2 stoneP = vWorldPos.xz * 0.20;
    vec2 q = stoneP + vec2(warpedFbm(stoneP, 4, 1.8)) * 2.0;
    vec2 r = q + vec2(warpedFbm(q * 0.7, 4, 1.5)) * 1.5;
    float stoneValue = fbm(r * 0.5, 5);

    vec3 baseColor = stonePalette(stoneValue);

    float grain = gradientNoise(vWorldPos.xz * 6.8 + vec2(11.3, 5.7));
    baseColor *= 1.0 + (grain - 0.5) * 0.04;

    vec3 crackCoarse = voronoiEdge(vWorldPos.xz * 0.34 + vec2(3.1, 7.2));
    vec3 crackFine = voronoiEdge(vWorldPos.xz * 1.45 + vec2(17.5, 2.4));
    float crackMask = 1.0 - smoothstep(0.012, 0.040, crackCoarse.y);
    float crackFineMask = 1.0 - smoothstep(0.004, 0.015, crackFine.y);
    crackMask = saturate(crackMask + crackFineMask * 0.55);
    baseColor *= 1.0 - crackMask * 0.42;

    float rainA = ridgeFbm(vec2(vWorldPos.x * 0.16, vWorldPos.z * 0.85) + vec2(2.8, 1.3), 5);
    float rainB = ridgeFbm(vec2(vWorldPos.x * 0.11 + 5.0, vWorldPos.z * 1.25), 4);
    float weathering = saturate(rainA * 0.65 + rainB * 0.35);
    baseColor *= 1.0 - weathering * 0.10;

    float motifDist = motifDistance(tileUV * 0.96, motifIndex);
    float edgeAA = max(fwidth(motifDist) * 1.25, 0.0012);
    float motifMask = 1.0 - smoothstep(0.0, edgeAA, motifDist);

    float erosionNoise = fbm(tileUV * 0.28 + tileId * 1.73 + vec2(13.1, 6.7), 5);
    float erosion = mix(0.28, 1.0, smoothstep(0.22, 0.90, erosionNoise));
    motifMask *= erosion;

    float grooveDepth = motifMask * topMask;
    vec3 grooveTint = vec3(0.4157, 0.3412, 0.2745);
    baseColor = mix(baseColor, grooveTint, grooveDepth * 0.20);
    baseColor *= 1.0 - grooveDepth * 0.35;

    vec2 grad = vec2(dFdx(motifDist), dFdy(motifDist));
    float innerShadow = saturate(0.5 + dot(normalize(vec2(0.9, -0.5)), grad) * 10.0);
    baseColor *= 1.0 - grooveDepth * innerShadow * 0.18;

    vec3 mossA = vec3(0.1647, 0.2902, 0.1020);
    vec3 mossB = vec3(0.2902, 0.3765, 0.1882);
    vec3 mossC = vec3(0.3529, 0.4784, 0.1569);
    vec3 lichen = vec3(0.4784, 0.5412, 0.4157);

    vec3 mossCells = voronoiEdge(tileUV * 0.58 + vec2(3.4, 9.1) + tileId * 0.31);
    float moisture = fbm(vWorldPos.xz * 0.24 + vec2(7.8, 12.2), 4);
    float mossPatch = 1.0 - smoothstep(0.035, 0.090, mossCells.y);
    float mossMask = grooveDepth * mossPatch * smoothstep(0.35, 0.88, moisture);
    vec3 mossColor = mix(mossA, mossB, mossCells.z);
    mossColor = mix(mossColor, mossC, smoothstep(0.55, 0.92, moisture));
    baseColor = mix(baseColor, mossColor, mossMask * 0.68);

    float lichenNoise = fbm(vWorldPos.xz * 1.35 + vec2(16.3, 5.8), 3);
    float lichenMask = (1.0 - grooveDepth) * smoothstep(0.72, 0.94, lichenNoise) * topMask;
    baseColor = mix(baseColor, lichen, lichenMask * 0.32);

    float sideMask = 1.0 - topMask;
    float strat = 0.5 + 0.5 * sin(vLocalPos.y * 12.0 + fbm(vLocalPos.xz * 1.1, 3) * 3.0);
    float sideDarken = mix(0.74, 0.86, strat);
    baseColor *= mix(1.0, sideDarken, sideMask);

    vec3 carvedGlow = vec3(0.0);

    // Torch-light flicker: warm shifting illumination across the stone surface.
    float torchFlicker = 0.85 + 0.15 * sin(uTime * 7.3 + tileHash * 20.0)
        * sin(uTime * 5.1 + tileHash * 14.0);
    float torchFalloff = smoothstep(8.0, 0.0, length(p - vec2(6.0 * (tileHash - 0.5), 5.0 * (hash(tileId + vec2(3.0, 1.0)) - 0.5))));
    vec3 torchWarmth = vec3(0.22, 0.10, 0.03) * torchFlicker * torchFalloff * topMask;
    baseColor += torchWarmth;

    // Ambient rune glow: carved motifs softly pulse with ancient energy.
    float runePhase = uTime * 1.2 + tileHash * TAU;
    float runePulse = 0.5 + 0.5 * sin(runePhase);
    float runePulse2 = 0.5 + 0.5 * sin(runePhase * 0.37 + 1.5);
    vec3 runeGlowColor = mix(vec3(0.35, 0.55, 0.18), vec3(0.18, 0.45, 0.35), runePulse2);
    float runeEmit = grooveDepth * runePulse * 0.08;
    baseColor += runeGlowColor * runeEmit;

    // Tiny insects / motes floating near the stone
    for (int k = 0; k < 3; k++) {
        float kf = float(k);
        float moteAngle = uTime * (0.8 + kf * 0.4) + tileHash * 12.0 + kf * 2.1;
        float moteR = 2.5 + kf * 1.5 + sin(uTime * 0.6 + kf * 1.7) * 1.0;
        vec2 motePos = vec2(cos(moteAngle), sin(moteAngle)) * moteR;
        float moteDist = length(p - motePos);
        float moteGlow = exp(-moteDist * 8.0) * topMask;
        float moteBlink = 0.5 + 0.5 * sin(uTime * (3.0 + kf * 2.0) + kf * 5.0);
        baseColor += vec3(0.55, 0.75, 0.30) * moteGlow * moteBlink * 0.15;
    }

    if (uState == 1) {
        vec3 iceTint = vec3(0.62, 0.70, 0.79);
        baseColor = mix(baseColor, iceTint, 0.88);

        float iceCracks = smoothstep(0.30, 0.95, crackMask + crackFineMask * 0.8);
        baseColor = mix(baseColor, vec3(0.93, 0.96, 1.0), iceCracks * 0.81);

        vec3 frost = voronoiEdge(vWorldPos.xz * 0.95 + vec2(uTime * 0.04, -uTime * 0.03));
        float crystal = 1.0 - smoothstep(0.012, 0.040, frost.y);
        baseColor += crystal * 0.20;

        baseColor = mix(baseColor, uIceColor, grooveDepth * 0.57);
    } else if (uState == 2) {
        float pulse = 0.45 + 0.55 * sin(uTime * 7.5 + uStateTimer * 3.2 + tileHash * TAU);
        baseColor *= 0.52;
        carvedGlow = vec3(0.95, 0.20, 0.08) * grooveDepth * (0.55 + pulse * 1.15);
        baseColor += vec3(0.16, 0.06, 0.02) * crackMask;
    } else if (uState == 3) {
        float crumble = fbm(vWorldPos.xz * 0.8 + vec2(uTime * 0.18, -uTime * 0.11), 5);
        float widenedCrack = smoothstep(0.45, 0.88, crackMask + crumble * 0.55);
        baseColor *= 0.46;
        vec3 magma = vec3(1.0, 0.39, 0.08);
        carvedGlow = magma * widenedCrack * (0.45 + 0.35 * sin(uTime * 9.0 + tileHash * 14.0));
        baseColor = mix(baseColor, baseColor * 0.72, widenedCrack * 0.45);
    } else if (uState == 4) {
        float aura = 0.5 + 0.5 * sin(uTime * 4.2 + uStateTimer * 2.0 + tileHash * TAU);
        baseColor *= 0.82;
        carvedGlow = vec3(0.12, 0.92, 0.86) * grooveDepth * (0.58 + aura * 1.3);
        float flux = fbm(vWorldPos.xz * 1.0 + vec2(0.0, uTime * 0.35), 4);
        baseColor += vec3(0.10, 0.20, 0.22) * flux * topMask;
    } else if (uState == 5) {
        float glint = 0.55 + 0.45 * sin(uTime * 6.2 + uStateTimer * 3.4 + tileHash * 12.0);
        baseColor *= 0.92;
        carvedGlow = vec3(1.0, 0.72, 0.22) * grooveDepth * (0.55 + glint * 1.3);
        baseColor += vec3(0.18, 0.11, 0.03) * grooveDepth * 0.35;
    }

    vec3 finalColor = baseColor + carvedGlow;
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export function createTemplePlatformMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uPulse: { value: 0.0 },
            uState: { value: 0 },
            uStateTimer: { value: 0.0 },
            uEdgeColor: { value: new THREE.Color(0xff4400) },
            uBaseColor: { value: new THREE.Color(0x7a7064) },
            uIceColor: { value: new THREE.Color(0x00ffff) }
        },
        vertexShader: PLATFORM_VERTEX_SHADER,
        fragmentShader: TEMPLE_PLATFORM_FRAGMENT_SHADER,
        transparent: false,
        side: THREE.FrontSide,
        lights: false
    });
}