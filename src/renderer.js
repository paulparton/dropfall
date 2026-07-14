import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { isInVR } from './vr/VRSession.js';

export let scene, camera, renderer, composer, ambientLight, directionalLight;

let isMobileRuntime = false;
let basePixelRatio = 1;
let currentPixelRatio = 1;
let performanceWindowStartedAt = 0;
let performanceFrameCount = 0;
let lowFpsWindows = 0;
let highFpsWindows = 0;
const performanceMetrics = {
    fps: 60,
    frameTimeMs: 16.7,
    pixelRatio: 1,
    quality: 'high',
};

function isMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent) 
        || window.innerWidth < 768;
}

export function isMacOS() {
    return /macintosh|mac os x|macos/i.test(navigator.userAgent);
}

export function initRenderer() {
    if (renderer) return; // Prevent multiple initializations

    const isMobile = isMobileDevice();
    isMobileRuntime = isMobile;
    
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = null; // Let Arena set the skybox based on theme

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 20);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: isMobile ? "low-power" : "high-performance", alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    basePixelRatio = isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, 2);
    currentPixelRatio = basePixelRatio;
    renderer.setPixelRatio(currentPixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // PERFORMANCE: 1024 is sufficient for this game, 2048 is overkill
    const shadowResolution = isMobile ? new THREE.Vector2(512, 512) : new THREE.Vector2(1024, 1024);
    renderer.shadowMap.resolution = shadowResolution;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    
    // Append to DOM
    const app = document.getElementById('app');
    if (app) {
        app.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }

    // Post-processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    
    if (isMobile) {
        // PERFORMANCE: Skip bloom entirely on mobile
        bloomPass.strength = 0;
    } else {
        // Get initial bloom level from store
        import('./store.js').then(module => {
            const settings = module.useGameStore.getState().settings;
            const defaultBloom = settings.bloomLevel !== undefined ? settings.bloomLevel : 2.0;
            bloomPass.strength = defaultBloom;
        });
        bloomPass.radius = 0.5;
    }

    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.setPixelRatio(currentPixelRatio);
    composer.addPass(renderScene);
    
    // PERFORMANCE: Only add bloom on desktop
    if (!isMobile) {
        composer.addPass(bloomPass);
    }
    
    composer.addPass(outputPass);

    // 4. Lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    // PERFORMANCE: 1024 is sufficient for gameplay
    const shadowMapSize = isMobile ? 512 : 1024;
    directionalLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.05;
    scene.add(directionalLight);

    // Handle Resize
    window.addEventListener('resize', onWindowResize);
    performanceWindowStartedAt = performance.now();
}

function onWindowResize() {
    if (camera && renderer && composer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        basePixelRatio = isMobileRuntime ? 1.0 : Math.min(window.devicePixelRatio || 1, 2);
        currentPixelRatio = Math.min(currentPixelRatio, basePixelRatio);
        renderer.setPixelRatio(currentPixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setPixelRatio(currentPixelRatio);
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

function applyPixelRatio(nextRatio) {
    if (!renderer || !composer) return;
    const clampedRatio = Math.max(0.75, Math.min(basePixelRatio, nextRatio));
    if (Math.abs(clampedRatio - currentPixelRatio) < 0.04) return;

    currentPixelRatio = clampedRatio;
    renderer.setPixelRatio(currentPixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setPixelRatio(currentPixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
    performanceMetrics.pixelRatio = Number(currentPixelRatio.toFixed(2));
    performanceMetrics.quality = currentPixelRatio >= basePixelRatio - 0.05
        ? 'high'
        : currentPixelRatio >= Math.max(1, basePixelRatio * 0.7)
            ? 'balanced'
            : 'performance';
}

function samplePerformance() {
    const now = performance.now();
    performanceFrameCount += 1;
    const elapsed = now - performanceWindowStartedAt;
    if (elapsed < 2000) return;

    const fps = (performanceFrameCount * 1000) / elapsed;
    performanceMetrics.fps = Number(fps.toFixed(1));
    performanceMetrics.frameTimeMs = Number((1000 / Math.max(fps, 1)).toFixed(1));
    performanceMetrics.pixelRatio = Number(currentPixelRatio.toFixed(2));
    performanceFrameCount = 0;
    performanceWindowStartedAt = now;

    // Mobile starts at a conservative 1x buffer. Desktop can trade a small
    // amount of internal resolution for stable frame pacing under load.
    if (isMobileRuntime || document.hidden) return;

    if (fps < 50) {
        lowFpsWindows += 1;
        highFpsWindows = 0;
        if (lowFpsWindows >= 2) {
            applyPixelRatio(currentPixelRatio - 0.15);
            lowFpsWindows = 0;
        }
    } else if (fps > 58) {
        highFpsWindows += 1;
        lowFpsWindows = 0;
        if (highFpsWindows >= 3 && currentPixelRatio < basePixelRatio) {
            applyPixelRatio(currentPixelRatio + 0.1);
            highFpsWindows = 0;
        }
    } else {
        lowFpsWindows = 0;
        highFpsWindows = 0;
    }
}

export function updateRenderer() {
    if (renderer && scene && camera && isInVR()) {
        renderer.render(scene, camera);
    } else if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    samplePerformance();
}

export function getPerformanceMetrics() {
    return { ...performanceMetrics };
}

export function setBloomLevel(level) {
    if (composer) {
        const bloomPass = composer.passes.find(pass => pass instanceof UnrealBloomPass);
        if (bloomPass) {
            bloomPass.strength = level;
        }
    }
}
