import * as THREE from 'three';
import { COMMON_SDF_GLSL } from './common-sdf.js';
import { SKY_VERTEX_SHADER } from './sky-vertex.js';

const INFERNO_SKY_FRAGMENT_SHADER = `
${COMMON_SDF_GLSL}

uniform float uTime;

varying vec3 vWorldPosition;

// FBM for smoke/clouds
float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        val += amp * noise2D(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return val;
}

void main() {
    vec3 direction = normalize(vWorldPosition);
    float height = direction.y;
    float azimuth = atan(direction.z, direction.x);
    float elevation = acos(clamp(direction.y, -1.0, 1.0));
    vec2 sphereUV = vec2(azimuth / TAU + 0.5, elevation / PI);

    // Base sky: dark smoky gradient
    vec3 zenith = vec3(0.08, 0.02, 0.01);
    vec3 midSky = vec3(0.15, 0.04, 0.02);
    vec3 horizonColor = vec3(0.4, 0.12, 0.03);
    vec3 belowColor = vec3(0.12, 0.03, 0.01);

    vec3 color;
    if (height > 0.3) {
        color = mix(midSky, zenith, smoothstep(0.3, 0.9, height));
    } else if (height > 0.0) {
        color = mix(horizonColor, midSky, smoothstep(0.0, 0.3, height));
    } else {
        color = mix(horizonColor, belowColor, smoothstep(0.0, -0.5, height));
    }

    // ===== SMOKE / ASH CLOUDS =====
    // Multiple cloud layers drifting
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float cloudHeight = 0.15 + fi * 0.2;
        float cloudScale = 3.0 + fi * 1.5;
        float cloudSpeed = 0.02 + fi * 0.01;

        vec2 cloudUV = sphereUV * vec2(cloudScale, cloudScale * 0.5);
        cloudUV.x += uTime * cloudSpeed;

        float cloud = fbm(cloudUV + vec2(fi * 3.7, fi * 1.3));
        cloud = smoothstep(0.35, 0.7, cloud);

        // Clouds lit from below by lava (warm underlight)
        float heightFade = exp(-abs(height - cloudHeight) * 8.0);
        vec3 cloudColor = mix(vec3(0.12, 0.05, 0.02), vec3(0.5, 0.15, 0.03), cloud * 0.5);
        // Red/orange underlighting
        cloudColor += vec3(0.3, 0.08, 0.01) * (1.0 - height) * 0.5;

        color += cloudColor * cloud * heightFade * 0.4;
    }

    // ===== VOLCANIC ERUPTIONS (distant) =====
    // Two eruption points on the horizon
    for (int v = 0; v < 2; v++) {
        float fv = float(v);
        float volcanoAngle = 1.5 + fv * 3.0;
        float angleDist = abs(azimuth - volcanoAngle);
        angleDist = min(angleDist, TAU - angleDist);

        // Volcano silhouette
        float volcanoShape = 0.04 + 0.06 * exp(-angleDist * angleDist * 20.0);
        float volcanoMask = smoothstep(volcanoShape + 0.005, volcanoShape, height);
        volcanoMask *= smoothstep(0.5, 0.0, angleDist);
        color = mix(color, vec3(0.03, 0.01, 0.005), volcanoMask);

        // Eruption glow above volcano
        float eruptDist = length(vec2(angleDist, height - volcanoShape));
        float eruptCycle = sin(uTime * (1.0 + fv * 0.5) + fv * 3.0) * 0.5 + 0.5;
        float eruptGlow = exp(-eruptDist * 12.0) * (0.3 + eruptCycle * 0.7);

        vec3 eruptColor = mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.7, 0.2), eruptCycle);
        color += eruptColor * eruptGlow * 0.5;

        // Lava fountain particles
        float pScale = 60.0;
        vec2 pUV = sphereUV * pScale + vec2(fv * 20.0, 0.0);
        pUV.y += uTime * 0.3;
        vec2 pCell = floor(pUV);
        vec2 pLocal = fract(pUV) - 0.5;
        float pGate = step(0.94, hash21(pCell + vec2(fv * 7.0, 3.0)));
        float pDist = length(pLocal);
        float particle = pGate * smoothstep(0.15, 0.0, pDist);
        float pMask = exp(-angleDist * 8.0) * smoothstep(volcanoShape, volcanoShape + 0.15, height)
                    * smoothstep(volcanoShape + 0.3, volcanoShape + 0.1, height);
        color += vec3(1.0, 0.5, 0.1) * particle * pMask * 0.4;
    }

    // ===== FALLING ASH =====
    for (int layer = 0; layer < 2; layer++) {
        float fl = float(layer);
        float scale = 60.0 + fl * 30.0;
        float speed = 0.05 + fl * 0.03;
        float ashSize = 0.1 - fl * 0.03;

        vec2 ashUV = sphereUV * vec2(scale, scale * 0.5);
        ashUV.y -= uTime * speed; // falling down

        vec2 ashCell = floor(ashUV);
        vec2 ashLocal = fract(ashUV) - 0.5;

        // drift
        ashLocal.x += sin(ashCell.y * 0.5 + uTime * 0.2 + fl) * 0.15;

        float ashGate = step(0.93 - fl * 0.02, hash21(ashCell + vec2(fl * 12.0, 5.0)));
        float ashDist = length(ashLocal);
        float ash = ashGate * smoothstep(ashSize, ashSize * 0.3, ashDist);

        color += ash * vec3(0.3, 0.15, 0.08) * (0.12 - fl * 0.03);
    }

    // ===== LAVA RIVERS ON GROUND (below horizon) =====
    if (height < 0.0) {
        float invY = 1.0 / max(abs(height), 0.03);
        vec2 groundUV = direction.xz * invY;
        float depthFade = 1.0 / (1.0 + length(groundUV) * 0.04);

        // Lava flow pattern
        float lava = fbm(groundUV * 0.3 + vec2(uTime * 0.03, uTime * 0.02));
        float lavaLine = smoothstep(0.4, 0.55, lava);

        vec3 lavaColor = mix(vec3(0.8, 0.2, 0.02), vec3(1.0, 0.7, 0.15), lavaLine * 0.5);
        vec3 darkGround = vec3(0.05, 0.02, 0.01);

        vec3 groundColor = mix(darkGround, lavaColor, lavaLine * 0.7);
        color = mix(color, groundColor, depthFade * 0.8);
    }

    // ===== HORIZON GLOW =====
    float horizonGlow = exp(-abs(height) * 10.0);
    color += vec3(0.5, 0.12, 0.02) * horizonGlow * 0.5;

    // ===== HEAT LIGHTNING =====
    float lightningTime = fract(uTime * 0.15);
    float lightningFlash = exp(-pow(lightningTime - 0.5, 2.0) * 200.0);
    float lightningPos = sin(uTime * 0.8) * 0.5;
    float lightningDist = abs(azimuth - lightningPos);
    lightningDist = min(lightningDist, TAU - lightningDist);
    float lightningMask = exp(-lightningDist * 5.0) * smoothstep(0.0, 0.2, height);
    color += vec3(1.0, 0.6, 0.3) * lightningFlash * lightningMask * 0.3;

    gl_FragColor = vec4(color, 1.0);
}
`;

export function createInfernoSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: INFERNO_SKY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
}
