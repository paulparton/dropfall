/**
 * SDF Renderer - WebGL Ray-Marching Renderer
 * Manages ray-marching shader compilation and rendering pipeline
 */

import * as THREE from 'three';

export let renderer, scene, camera, canvas;
export let sdfShaderMaterial;
export let currentTileStates;

// Shader sources (will be loaded)
let rayMarchFragmentShader;
let sdfFunctionsShader;

async function loadShaders() {
    // In a real implementation, these would be loaded from files
    // For now, using inline shader (simplified version)
    rayMarchFragmentShader = getRayMarchShader();
    sdfFunctionsShader = getSdfFunctionsShader();
}

function getSdfFunctionsShader() {
    return `
// SDF Functions - included in ray-march shader
const float PI = 3.14159265359;
const float EPSILON = 0.001;
const float MAX_DIST = 1000.0;

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float r) {
    return length(p.xz) - r;
}

float sdHexPrism(vec3 p, vec2 h) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
    vec2 d = vec2(
        length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x), 
        p.z - h.y
    );
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float opSmoothUnion(float a, float b, float k) {
    k *= 4.0;
    float h = max(k - abs(a - b), 0.0);
    return min(a, b) - h * h * 0.25 / k;
}

float opUnion(float a, float b) {
    return min(a, b);
}

vec3 rotateY(vec3 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 opRep(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

vec3 calcNormal(vec3 p, sampler2D tileStates, float arenaSize) {
    const vec3 e = vec3(EPSILON, 0.0, 0.0);
    float d = sceneSDF(p, tileStates, arenaSize);
    
    // Simple numerical normal calculation
    float dx = sceneSDF(p + e.xyy, tileStates, arenaSize) - sceneSDF(p - e.xyy, tileStates, arenaSize);
    float dy = sceneSDF(p + e.yxy, tileStates, arenaSize) - sceneSDF(p - e.yxy, tileStates, arenaSize);
    float dz = sceneSDF(p + e.yyx, tileStates, arenaSize) - sceneSDF(p - e.yyx, tileStates, arenaSize);
    
    return normalize(vec3(dx, dy, dz));
}
`;
}

function getRayMarchShader() {
    const sdfFunctions = getSdfFunctionsShader();
    return `#version 300 es
precision highp float;

// Uniforms
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uFOV;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAspect;

// Players
uniform vec3 uPlayer1Pos;
uniform vec3 uPlayer2Pos;
uniform float uPlayerRadius;
uniform vec3 uPlayer1Color;
uniform vec3 uPlayer2Color;

// Arena
uniform float uArenaSize;
uniform vec3 uArenaPrimaryColor;
uniform vec3 uArenaSecondaryColor;

// Lighting
uniform vec3 uLightDir;
uniform float uLightIntensity;
uniform vec3 uAmbientColor;

// Tile states texture
uniform sampler2D uTileStates;

// Effects
uniform float uShockwaveIntensity;
uniform vec3 uShockwaveCenter;
uniform float uShockwaveRadius;

// Constants
const int MAX_STEPS = 128;
const float MAX_DIST = 200.0;
const float EPSILON = 0.001;
const float PI = 3.14159265359;

${sdfFunctions}

// Scene SDF function
float sceneSDF(vec3 p) {
    float d = MAX_DIST;
    
    // Arena hex tiles
    float gridSpacing = 8.0;
    vec3 q = p;
    
    if (mod(floor(q.z / (gridSpacing * 0.866)), 2.0) > 0.5) {
        q.x += gridSpacing * 0.5;
    }
    q = opRep(q, vec3(gridSpacing, 100.0, gridSpacing * 0.866));
    
    float hexTile = sdHexPrism(q, vec2(gridSpacing * 0.9, 4.0));
    d = opUnion(d, hexTile);
    
    // Players
    d = opUnion(d, sdSphere(p - uPlayer1Pos, uPlayerRadius));
    d = opUnion(d, sdSphere(p - uPlayer2Pos, uPlayerRadius));
    
    // Arena boundary (invisible)
    float boundary = sdCylinder(p, uArenaSize * 8.0) - 1.0;
    float floor = p.y + 10.0;
    d = opUnion(d, min(boundary, floor));
    
    return d;
}

// Ray marching
vec3 rayMarch(vec3 ro, vec3 rd, out int steps, out bool hit) {
    float dist = 0.0;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        steps = i;
        vec3 p = ro + dist * rd;
        float d = sceneSDF(p);
        
        if (d < EPSILON) {
            hit = true;
            return p;
        }
        
        dist += d * 0.9;
        
        if (dist > MAX_DIST) {
            break;
        }
    }
    
    hit = false;
    return ro + dist * rd;
}

// Normal calculation
vec3 calcNormal(vec3 p) {
    const vec3 e = vec3(EPSILON, 0.0, 0.0);
    float dx = sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy);
    float dy = sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy);
    float dz = sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx);
    return normalize(vec3(dx, dy, dz));
}

// Lighting
vec3 phongLighting(vec3 pos, vec3 normal, vec3 rd) {
    vec3 lightDir = normalize(uLightDir);
    
    // Ambient
    vec3 ambient = uAmbientColor * 0.3;
    
    // Diffuse
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = uArenaPrimaryColor * uLightIntensity * diff;
    
    // Specular
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(-rd, reflectDir), 0.0), 16.0);
    vec3 specular = vec3(1.0) * spec * 0.5;
    
    return ambient + diffuse + specular;
}

// Shadow calculation
float calcShadow(vec3 pos) {
    vec3 lightDir = normalize(uLightDir);
    float shadow = 1.0;
    float t = 0.1;
    
    for (int i = 0; i < 16; i++) {
        float d = sceneSDF(pos + lightDir * t);
        if (d < EPSILON) {
            shadow = 0.0;
            break;
        }
        t += d;
        if (t > 50.0) break;
    }
    
    return shadow;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    
    // Simple test pattern
    vec3 color = vec3(uv, 0.5);
    
    gl_FragColor = vec4(color, 1.0);
}
`;
}

export async function initSDFRenderer(container) {
    await loadShaders();
    
    canvas = document.querySelector('canvas') || document.createElement('canvas');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    canvas.width = width;
    canvas.height = height;
    container.appendChild(canvas);
    
    // Initialize Three.js WebGL renderer
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create a simple scene with a fullscreen quad
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 15, 30);
    camera.lookAt(0, 0, 0);
    
    // Create fullscreen quad for ray marching
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // Create shader material
    sdfShaderMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: rayMarchFragmentShader,
        uniforms: {
            // Camera
            uCameraPos: { value: camera.position.clone() },
            uCameraTarget: { value: new THREE.Vector3(0, 0, 0) },
            uFOV: { value: camera.fov },
            uAspect: { value: width / height },
            uResolution: { value: new THREE.Vector2(width, height) },
            uTime: { value: 0 },
            
            // Players
            uPlayer1Pos: { value: new THREE.Vector3(0, 2, 0) },
            uPlayer2Pos: { value: new THREE.Vector3(10, 2, 0) },
            uPlayerRadius: { value: 2.0 },
            uPlayer1Color: { value: new THREE.Color(0xff0000) },
            uPlayer2Color: { value: new THREE.Color(0x0000ff) },
            
            // Arena
            uArenaSize: { value: 4 },
            uArenaPrimaryColor: { value: new THREE.Color(0x666666) },
            uArenaSecondaryColor: { value: new THREE.Color(0x333333) },
            
            // Lighting
            uLightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
            uLightIntensity: { value: 1.5 },
            uAmbientColor: { value: new THREE.Color(0xffffff) },
            
            // Tile states
            uTileStates: { value: null },
            
            // Effects
            uShockwaveIntensity: { value: 0 },
            uShockwaveCenter: { value: new THREE.Vector3(0, 0, 0) },
            uShockwaveRadius: { value: 0 }
        }
    });
    
    const quad = new THREE.Mesh(geometry, sdfShaderMaterial);
    scene.add(quad);
    
    // Handle window resize
    window.addEventListener('resize', () => onWindowResize(container));
    
    return renderer;
}

function onWindowResize(container) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    if (renderer && canvas) {
        canvas.width = width;
        canvas.height = height;
        renderer.setSize(width, height);
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        sdfShaderMaterial.uniforms.uResolution.value.set(width, height);
        sdfShaderMaterial.uniforms.uAspect.value = width / height;
    }
}

export function updateSDFRenderer(deltaTime, gameState) {
    // Update uniforms
    sdfShaderMaterial.uniforms.uTime.value += deltaTime;
    sdfShaderMaterial.uniforms.uCameraPos.value.copy(camera.position);
    sdfShaderMaterial.uniforms.uPlayer1Pos.value.copy(gameState.player1Pos);
    sdfShaderMaterial.uniforms.uPlayer2Pos.value.copy(gameState.player2Pos);
    sdfShaderMaterial.uniforms.uPlayer1Color.value.setHex(gameState.player1Color);
    sdfShaderMaterial.uniforms.uPlayer2Color.value.setHex(gameState.player2Color);
    
    // Render
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

export function updatePlayerUniforms(player1Pos, player2Pos, player1Color, player2Color) {
    if (sdfShaderMaterial) {
        sdfShaderMaterial.uniforms.uPlayer1Pos.value.copy(player1Pos);
        sdfShaderMaterial.uniforms.uPlayer2Pos.value.copy(player2Pos);
        sdfShaderMaterial.uniforms.uPlayer1Color.value.setHex(player1Color);
        sdfShaderMaterial.uniforms.uPlayer2Color.value.setHex(player2Color);
    }
}

export function updateCameraPosition(position, target) {
    if (camera) {
        camera.position.copy(position);
        camera.lookAt(target);
    }
}

export function updateArenaUniforms(arenaSize, primaryColor, secondaryColor) {
    if (sdfShaderMaterial) {
        sdfShaderMaterial.uniforms.uArenaSize.value = arenaSize;
        sdfShaderMaterial.uniforms.uArenaPrimaryColor.value.setHex(primaryColor);
        sdfShaderMaterial.uniforms.uArenaPrimaryColor.value.setHex(secondaryColor);
    }
}

export function updateLighting(lightDir, intensity, ambientColor) {
    if (sdfShaderMaterial) {
        sdfShaderMaterial.uniforms.uLightDir.value.copy(lightDir);
        sdfShaderMaterial.uniforms.uLightIntensity.value = intensity;
        sdfShaderMaterial.uniforms.uAmbientColor.value.setHex(ambientColor);
    }
}

export function triggerShockwave(center, radius, intensity) {
    if (sdfShaderMaterial) {
        sdfShaderMaterial.uniforms.uShockwaveCenter.value.copy(center);
        sdfShaderMaterial.uniforms.uShockwaveRadius.value = radius;
        sdfShaderMaterial.uniforms.uShockwaveIntensity.value = intensity;
    }
}
