import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export let scene, camera, renderer, composer, ambientLight, directionalLight;

function isMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent) 
        || window.innerWidth < 768;
}

export function initRenderer() {
    if (renderer) return; // Prevent multiple initializations

    const isMobile = isMobileDevice();
    
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Dark void

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 20);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: isMobile ? "low-power" : "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // PERFORMANCE: 1024 is sufficient for this game, 2048 is overkill
    const shadowResolution = isMobile ? new THREE.Vector2(512, 512) : new THREE.Vector2(1024, 1024);
    renderer.shadowMap.resolution = shadowResolution;
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
}

function onWindowResize() {
    if (camera && renderer && composer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

export function updateRenderer() {
    if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

export function setBloomLevel(level) {
    if (composer) {
        const bloomPass = composer.passes.find(pass => pass instanceof UnrealBloomPass);
        if (bloomPass) {
            bloomPass.strength = level;
        }
    }
}
