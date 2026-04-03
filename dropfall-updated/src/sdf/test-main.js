/**
 * SDF Dropfall - Test Entry Point
 * Minimal test to verify SDF rendering works
 */

import '../style.css';
import * as THREE from 'three';

// Add a visual indicator that SDF loaded
const indicator = document.createElement('div');
indicator.innerHTML = '🔵 SDF SYSTEM ACTIVE 🔵';
indicator.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    background: rgba(0, 255, 255, 0.9);
    color: #000;
    padding: 10px 20px;
    border-radius: 5px;
    font-family: monospace;
    font-weight: bold;
    font-size: 16px;
    box-shadow: 0 0 20px cyan;
`;
document.body.appendChild(indicator);

console.log('%c=== SDF TEST START ===', 'color: cyan; font-weight: bold;');

// Get test scene
const container = document.getElementById('app');
console.log('Container:', container);
console.log('Container size:', container?.clientWidth, 'x', container?.clientHeight);

if (!container) {
    console.error('FATAL: No #app container found!');
    indicator.innerHTML = '❌ ERROR: No app container ❌';
    indicator.style.background = 'rgba(255, 0, 0, 0.9)';
    throw new Error('No #app container found');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x001010);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);

console.log('Renderer:', renderer);
console.log('Adding canvas to container...');
container.appendChild(renderer.domElement);
console.log('Canvas added, domElement:', renderer.domElement);

// Create a simple test shader
const fragmentShader = `
varying vec2 vUv;
uniform float uTime;

void main() {
    vec3 color = vec3(
        0.5 + 0.5 * sin(vUv.x * 10.0 + uTime),
        0.5 + 0.5 * cos(vUv.y * 10.0 + uTime * 0.7),
        0.5 + 0.5 * sin((vUv.x + vUv.y) * 5.0 + uTime * 1.3)
    );
    gl_FragColor = vec4(color, 1.0);
}
`;

const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const uniforms = {
    uTime: { value: 0 }
};

const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms
});

const geometry = new THREE.PlaneGeometry(2, 2);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

camera.position.z = 1;

let frameCount = 0;
let lastTime = Date.now();

function animate() {
    requestAnimationFrame(animate);
    
    frameCount++;
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    
    uniforms.uTime.value += elapsed;
    
    if (frameCount % 60 === 0) {
        console.log('Frame:', frameCount, 'FPS:', Math.round(frameCount / (elapsed * frameCount)));
    }
    
    lastTime = now;
    renderer.render(scene, camera);
}

console.log('%c=== SDF TEST RENDERING ===', 'color: lime; font-weight: bold;');
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Global access for debugging
window.sdfTest = {
    renderer,
    scene,
    camera,
    frameCount: () => frameCount
};

console.log('%c=== SDF TEST READY ===', 'color: lime; font-weight: bold;');
console.log('Access debug via window.sdfTest');

