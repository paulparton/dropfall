// ============================================================================
// Ray-Marching Shader - Main Fragment Shader
// Uses SDF ray-marching to render the Dropfall arena
// ============================================================================

#version 300 es
precision highp float;

// Uniforms
uniform vec3 uCameraPos;
uniform mat4 uViewMatrix;
uniform mat4 uProjMatrix;
uniform vec2 uResolution;
uniform float uTime;

// Players (dynamic)
uniform vec3 uPlayer1Pos;
uniform vec3 uPlayer2Pos;
uniform float uPlayerRadius;
uniform vec3 uPlayer1Color;
uniform vec3 uPlayer2Color;
uniform float uPlayer1PowerUp;  // bitmask for active power-ups
uniform float uPlayer2PowerUp;

// Arena
uniform float uArenaSize;
uniform vec3 uArenaPrimaryColor;
uniform vec3 uArenaSecondaryColor;

// Tiles state
uniform sampler2D uTileStates;  // Texture containing tile states
uniform float uTileDestructionPhase;

// Effects
uniform float uShockwaveIntensity;
uniform vec3 uShockwaveCenter;
uniform float uShockwaveRadius;

// Lighting
uniform vec3 uLightDir;
uniform float uLightIntensity;
uniform vec3 uAmbientColor;

// Camera
uniform vec3 uCameraTarget;
uniform float uFOV;

// Constants
const int MAX_STEPS = 256;
const float MAX_DIST = 200.0;
const float EPSILON = 0.002;
const float PI = 3.14159265359;

// ============================================================================
// SCENE RENDERING
// ============================================================================

// Include SDF functions
#include "sdf-functions.glsl"

// Arena geometry using SDF hex tiles
float sdArenaHex(vec3 p) {
    float d = MAX_DIST;
    
    // Grid spacing for hexagonal tiles
    float gridSpacing = 8.0;
    float tileRadius = gridSpacing * 0.9;
    float tileHeight = 4.0;
    
    // Create hexagonal grid pattern
    // Simplified approach: create repeating hexagons
    vec3 q = p;
    
    // Offset for hex grid rows
    if (mod(floor(q.z / (gridSpacing * 0.866)), 2.0) > 0.5) {
        q.x += gridSpacing * 0.5;
    }
    
    q = opRep(q, vec3(gridSpacing, 0.0, gridSpacing * 0.866));
    
    // Individual hex tile
    float hexTile = sdHexPrism(q, vec2(tileRadius, tileHeight));
    
    // Add destruction effect - tiles fracture based on damage
    float destructionNoise = sin(q.x * 3.0) * sin(q.z * 3.0) * 0.3;
    hexTile = opSmoothUnion(hexTile, hexTile + destructionNoise, 0.5);
    
    return hexTile;
}

// Boundary walls (invisible collision walls)
float sdArenaWalls(vec3 p) {
    float arenaRad = uArenaSize * 8.0;
    
    // Cylindrical wall
    float wall = sdCylinder(p, arenaRad) - 1.0;
    
    // Floor and ceiling
    float floor = p.y + 10.0;
    float ceiling = 50.0 - p.y;
    
    return max(wall, max(floor, ceiling));
}

// Player 1 sphere
float sdPlayer1(vec3 p) {
    return sdSphere(p - uPlayer1Pos, uPlayerRadius);
}

// Player 2 sphere
float sdPlayer2(vec3 p) {
    return sdSphere(p - uPlayer2Pos, uPlayerRadius);
}

// Ice effect on tiles
float sdIceEffect(vec3 p) {
    float ice = MAX_DIST;
    
    // Sample tile state texture to find ice tiles
    // This creates semi-transparent ice layers
    vec2 tileUV = (p.xz / (uArenaSize * 8.0) + 0.5);
    vec4 tileState = texture(uTileStates, tileUV);
    
    if (tileState.r > 0.5) {  // Ice tile
        ice = sdArenaHex(p) - 0.1;  // Slightly offset
    }
    
    return ice;
}

// Portal effect (teleportation portals)
float sdPortals(vec3 p) {
    float portals = MAX_DIST;
    
    // Sample tile state for portal tiles
    vec2 tileUV = (p.xz / (uArenaSize * 8.0) + 0.5);
    vec4 tileState = texture(uTileStates, tileUV);
    
    if (tileState.g > 0.5) {  // Portal tile
        // Portal is a rotating torus
        vec3 q = p;
        q.y += sin(uTime * 2.0) * 0.5;
        float torus = length(vec2(length(q.xz) - 2.0, q.y)) - 0.5;
        portals = min(portals, torus);
    }
    
    return portals;
}

// Bonus tiles (power-up tiles)
float sdBonusTiles(vec3 p) {
    float bonus = MAX_DIST;
    
    vec2 tileUV = (p.xz / (uArenaSize * 8.0) + 0.5);
    vec4 tileState = texture(uTileStates, tileUV);
    
    if (tileState.b > 0.5) {  // Bonus tile
        // Rotating box
        vec3 q = p;
        q = rotateY(q, uTime * 2.0);
        bonus = min(bonus, sdBox(q, vec3(0.8, 0.8, 0.8)));
    }
    
    return bonus;
}

// Shockwave effect
float sdShockwave(vec3 p) {
    float toCenter = length(p - uShockwaveCenter);
    float waveDist = abs(toCenter - uShockwaveRadius) - 0.3;
    float wave = waveDist * (1.0 - uShockwaveIntensity);
    return wave;
}

// Combine all scene geometry
float sceneSDF(vec3 p) {
    float d = MAX_DIST;
    
    // Arena tiles (main geometry)
    d = opUnion(d, sdArenaHex(p));
    
    // Players (spheres)
    d = opUnion(d, sdPlayer1(p));
    d = opUnion(d, sdPlayer2(p));
    
    // Special tiles
    d = opUnion(d, sdIceEffect(p));
    d = opUnion(d, sdPortals(p));
    d = opUnion(d, sdBonusTiles(p));
    
    // Effects
    d = opUnion(d, sdShockwave(p));
    
    return d;
}

// ============================================================================
// RAY MARCHING
// ============================================================================

struct RayMarchResult {
    vec3 pos;
    float dist;
    int steps;
    bool hit;
    float distToSurface;
};

RayMarchResult rayMarch(vec3 ro, vec3 rd) {
    RayMarchResult result;
    result.dist = 0.0;
    result.steps = 0;
    result.hit = false;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        result.steps = i;
        vec3 p = ro + result.dist * rd;
        float d = sceneSDF(p);
        
        result.distToSurface = d;
        
        if (d < EPSILON) {
            result.hit = true;
            result.pos = p;
            break;
        }
        
        result.dist += d;
        
        if (result.dist > MAX_DIST) {
            break;
        }
    }
    
    result.pos = ro + result.dist * rd;
    return result;
}

// ============================================================================
// LIGHTING & SHADING
// ============================================================================

// Phong lighting model
vec3 phongLighting(vec3 pos, vec3 normal, vec3 rd, vec3 surfaceColor) {
    // Ambient
    vec3 ambient = uAmbientColor * surfaceColor * 0.3;
    
    // Diffuse
    vec3 lightDir = normalize(uLightDir);
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = surfaceColor * uLightIntensity * diff;
    
    // Specular
    vec3 viewDir = -rd;
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
    vec3 specular = vec3(1.0) * spec * 0.5;
    
    return ambient + diffuse + specular;
}

// Soft shadow using SDF ray marching
float calcShadow(vec3 pos) {
    vec3 lightDir = normalize(uLightDir);
    float shadow = 1.0;
    float t = 0.1;
    
    for (int i = 0; i < 32; i++) {
        float d = sceneSDF(pos + lightDir * t);
        if (d < EPSILON) {
            shadow = 0.0;
            break;
        }
        t += d * 0.5;
        if (t > 50.0) break;
    }
    
    return shadow;
}

// Ambient occlusion using SDF
float calcAO(vec3 pos, vec3 normal) {
    float ao = 0.0;
    float maxDist = 2.0;
    
    for (float i = 0.0; i < 8.0; i++) {
        float sampleDist = (i + 1.0) / 8.0 * maxDist;
        vec3 samplePos = pos + normal * sampleDist;
        float d = sceneSDF(samplePos);
        ao += (sampleDist - d) / sampleDist;
    }
    
    return 1.0 - (ao / 8.0) * 0.5;
}

// ============================================================================
// COLOR & MATERIAL ASSIGNMENT
// ============================================================================

vec3 getMaterialColor(vec3 pos, int materialId) {
    // Determine which object was hit and return its color
    
    // Check if it's player 1
    if (length(pos - uPlayer1Pos) < uPlayerRadius + EPSILON) {
        return uPlayer1Color;
    }
    
    // Check if it's player 2
    if (length(pos - uPlayer2Pos) < uPlayerRadius + EPSILON) {
        return uPlayer2Color;
    }
    
    // Arena tiles - base color
    vec3 color = uArenaPrimaryColor;
    
    // Modulate with position for grid pattern
    vec3 q = pos / 8.0;
    float pattern = sin(q.x * 3.14) * sin(q.z * 3.14);
    color = mix(color, uArenaSecondaryColor, 0.3 + 0.3 * pattern);
    
    // Check for special tiles
    vec2 tileUV = ((pos.xz) / (uArenaSize * 8.0) + 0.5);
    vec4 tileState = texture(uTileStates, tileUV);
    
    if (tileState.r > 0.5) {  // Ice
        color = vec3(0.0, 0.7, 1.0);
    }
    if (tileState.g > 0.5) {  // Portal
        color = vec3(0.0, 1.0, 1.0) * (0.5 + 0.5 * sin(uTime * 3.0));
    }
    if (tileState.b > 0.5) {  // Bonus
        color = vec3(1.0, 1.0, 0.0) * (0.5 + 0.5 * sin(uTime * 2.0));
    }
    
    return color;
}

// ============================================================================
// MAIN SHADER
// ============================================================================

void main() {
    // Normalized screen coordinates
    vec2 uv = gl_FragCoord.xy / uResolution;
    
    // Ray direction from camera through pixel
    vec3 rd = normalize(vec3(
        (uv.x - 0.5) * uResolution.x / uResolution.y,
        uv.y - 0.5,
        -1.0 / tan(uFOV / 2.0)
    ));
    
    // Camera position
    vec3 ro = uCameraPos;
    
    // Ray march
    RayMarchResult march = rayMarch(ro, rd);
    
    vec3 finalColor;
    
    if (march.hit) {
        // Calculate normal at hit point
        vec3 normal = calcNormal(march.pos, EPSILON * -1.0);
        
        // Get material color
        vec3 materialColor = getMaterialColor(march.pos, 0);
        
        // Calculate lighting
        vec3 lighting = phongLighting(march.pos, normal, rd, materialColor);
        
        // Apply shadow
        float shadow = calcShadow(march.pos);
        lighting *= mix(0.3, 1.0, shadow);
        
        // Apply ambient occlusion
        float ao = calcAO(march.pos, normal);
        lighting *= ao;
        
        // Apply fog
        float fogFactor = march.dist / MAX_DIST;
        finalColor = mix(lighting, vec3(0.01), fogFactor * 0.3);
        
        // Add glow based on material
        float glow = 0.0;
        if (length(march.pos - uPlayer1Pos) < uPlayerRadius + EPSILON) {
            glow = 0.3 * (0.5 + 0.5 * sin(uTime * 3.0));
        }
        if (length(march.pos - uPlayer2Pos) < uPlayerRadius + EPSILON) {
            glow = 0.3 * (0.5 + 0.5 * sin(uTime * 3.0 + 3.14));
        }
        finalColor += vec3(glow);
        
    } else {
        // Sky/background gradient
        finalColor = mix(
            vec3(0.0, 0.05, 0.1),
            vec3(0.0, 0.1, 0.2),
            uv.y
        );
    }
    
    // Apply bloom (simple)
    finalColor = finalColor / (1.0 + finalColor);
    
    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    
    gl_FragColor = vec4(finalColor, 1.0);
}
