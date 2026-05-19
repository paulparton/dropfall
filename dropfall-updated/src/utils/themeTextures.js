import * as THREE from 'three';
import { createSphereTexture, createDiamondPlateTexture } from './textures.js';
import { createPlatformMaterial, createSkyboxMaterial, resolveThemeName } from '../shaders/index.js';

// Cache for generated textures so we don't recreate them every time
const textureCache = {};

function createTextureSet(drawFn, size = 1024) {
    const canvases = {
        map: document.createElement('canvas'),
        bumpMap: document.createElement('canvas'),
        emissiveMap: document.createElement('canvas'),
        roughnessMap: document.createElement('canvas')
    };
    const ctxs = {};
    const texs = {};
    for(let key in canvases) {
        canvases[key].width = size;
        canvases[key].height = size;
        ctxs[key] = canvases[key].getContext('2d');
        if(key === 'bumpMap') { ctxs[key].fillStyle = '#808080'; ctxs[key].fillRect(0,0,size,size); }
        if(key === 'emissiveMap') { ctxs[key].fillStyle = '#000000'; ctxs[key].fillRect(0,0,size,size); }
        if(key === 'roughnessMap') { ctxs[key].fillStyle = '#808080'; ctxs[key].fillRect(0,0,size,size); }
    }
    
    drawFn(ctxs, size);
    
    for(let key in canvases) {
        texs[key] = new THREE.CanvasTexture(canvases[key]);
        // texs[key].anisotropy = 4; // Optional, skip if renderer not available
        texs[key].wrapS = THREE.RepeatWrapping;
        texs[key].wrapT = THREE.RepeatWrapping;
    }
    return texs;
}

function drawHex(ctx, x, y, radius, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + rotation;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function addNoise(ctx, size, amount, color='rgba(0,0,0,0.1)') {
    ctx.fillStyle = color;
    for(let i=0; i<amount; i++) {
        ctx.fillRect(Math.random()*size, Math.random()*size, Math.random()*3+1, Math.random()*3+1);
    }
}

function generateBeachTheme() {
    return {
        tile: createTextureSet((ctxs, size) => {
            // Sand base
            ctxs.map.fillStyle = '#e6d2b5'; ctxs.map.fillRect(0,0,size,size);
            ctxs.bumpMap.fillStyle = '#808080'; ctxs.bumpMap.fillRect(0,0,size,size);
            ctxs.roughnessMap.fillStyle = '#dddddd'; ctxs.roughnessMap.fillRect(0,0,size,size);
            
            // Sand grains
            addNoise(ctxs.map, size, 40000, 'rgba(0,0,0,0.05)');
            addNoise(ctxs.map, size, 40000, 'rgba(255,255,255,0.1)');
            addNoise(ctxs.bumpMap, size, 40000, 'rgba(255,255,255,0.2)');
            addNoise(ctxs.bumpMap, size, 40000, 'rgba(0,0,0,0.2)');

            // Sand ripples (bump)
            ctxs.bumpMap.fillStyle = 'rgba(255,255,255,0.1)';
            for(let i=0; i<size; i+=60) {
                ctxs.bumpMap.beginPath();
                ctxs.bumpMap.moveTo(0, i);
                for(let x=0; x<=size; x+=20) {
                    ctxs.bumpMap.lineTo(x, i + Math.sin(x*0.05)*15);
                }
                ctxs.bumpMap.lineTo(size, i+30);
                ctxs.bumpMap.lineTo(0, i+30);
                ctxs.bumpMap.fill();
            }
        }),
        sphere: createTextureSet((ctxs, size) => {
            // Beachball
            ctxs.roughnessMap.fillStyle = '#444444'; ctxs.roughnessMap.fillRect(0,0,size,size); // Shiny plastic
            ctxs.bumpMap.fillStyle = '#808080'; ctxs.bumpMap.fillRect(0,0,size,size);
            
            const colors = ['#ff0000', '#ffffff', '#0000ff', '#ffffff', '#ffff00', '#ffffff'];
            const stripeWidth = size / colors.length;
            
            for(let i=0; i<colors.length; i++) {
                ctxs.map.fillStyle = colors[i];
                ctxs.map.fillRect(i * stripeWidth, 0, stripeWidth, size);
                
                // Indentation at seams
                ctxs.bumpMap.fillStyle = '#404040';
                ctxs.bumpMap.fillRect(i * stripeWidth - 2, 0, 4, size);
            }
            
            // Top and bottom white circles (poles)
            ctxs.map.fillStyle = '#ffffff';
            ctxs.map.fillRect(0, 0, size, size * 0.1);
            ctxs.map.fillRect(0, size * 0.9, size, size * 0.1);
        })
    };
}

function generateCrackedStoneTheme() {
    const texs = createTextureSet((ctxs, size) => {
        const cx = size/2, cy = size/2;
        ctxs.map.fillStyle = '#7a7a7a'; ctxs.map.fillRect(0,0,size,size);
        ctxs.roughnessMap.fillStyle = '#eeeeee'; ctxs.roughnessMap.fillRect(0,0,size,size); // Very rough
        
        // Hex Border (Carved)
        ctxs.bumpMap.strokeStyle = '#000000'; ctxs.bumpMap.lineWidth = 20;
        drawHex(ctxs.bumpMap, cx, cy, size*0.45, Math.PI/6); ctxs.bumpMap.stroke();
        ctxs.bumpMap.strokeStyle = '#ffffff'; ctxs.bumpMap.lineWidth = 4;
        drawHex(ctxs.bumpMap, cx, cy, size*0.4, Math.PI/6); ctxs.bumpMap.stroke();

        // Stone noise
        addNoise(ctxs.bumpMap, size, 80000, 'rgba(255,255,255,0.15)');
        addNoise(ctxs.bumpMap, size, 80000, 'rgba(0,0,0,0.15)');
        addNoise(ctxs.map, size, 60000, 'rgba(0,0,0,0.2)');
        addNoise(ctxs.map, size, 60000, 'rgba(255,255,255,0.1)');
        
        // Cracks
        ctxs.bumpMap.strokeStyle = '#000000';
        ctxs.bumpMap.lineCap = 'round'; ctxs.bumpMap.lineJoin = 'round';
        ctxs.map.strokeStyle = '#333333';
        ctxs.map.lineCap = 'round'; ctxs.map.lineJoin = 'round';
        
        for(let i=0; i<15; i++) {
            let x = Math.random()*size, y = Math.random()*size;
            ctxs.bumpMap.beginPath(); ctxs.map.beginPath();
            ctxs.bumpMap.moveTo(x, y); ctxs.map.moveTo(x, y);
            
            const crackWidth = Math.random()*8 + 2;
            ctxs.bumpMap.lineWidth = crackWidth;
            ctxs.map.lineWidth = crackWidth * 0.8;
            
            for(let j=0; j<10; j++) {
                x += (Math.random()-0.5)*80; y += (Math.random()-0.5)*80;
                ctxs.bumpMap.lineTo(x, y); ctxs.map.lineTo(x, y);
                
                // Branching cracks
                if(Math.random() > 0.7) {
                    ctxs.bumpMap.stroke(); ctxs.map.stroke();
                    let bx = x, by = y;
                    ctxs.bumpMap.beginPath(); ctxs.map.beginPath();
                    ctxs.bumpMap.moveTo(bx, by); ctxs.map.moveTo(bx, by);
                    ctxs.bumpMap.lineWidth = crackWidth * 0.5;
                    ctxs.map.lineWidth = crackWidth * 0.4;
                    for(let k=0; k<5; k++) {
                        bx += (Math.random()-0.5)*50; by += (Math.random()-0.5)*50;
                        ctxs.bumpMap.lineTo(bx, by); ctxs.map.lineTo(bx, by);
                    }
                    ctxs.bumpMap.stroke(); ctxs.map.stroke();
                    
                    // Reset for main branch
                    ctxs.bumpMap.beginPath(); ctxs.map.beginPath();
                    ctxs.bumpMap.moveTo(x, y); ctxs.map.moveTo(x, y);
                    ctxs.bumpMap.lineWidth = crackWidth;
                    ctxs.map.lineWidth = crackWidth * 0.8;
                }
            }
            ctxs.bumpMap.stroke(); ctxs.map.stroke();
        }
    });
    return { tile: texs, sphere: texs };
}

function generateArcticTheme() {
    return {
        tile: createTextureSet((ctxs, size) => {
            // Ice base — pale blue-white
            ctxs.map.fillStyle = '#c8e8f8'; ctxs.map.fillRect(0, 0, size, size);
            ctxs.bumpMap.fillStyle = '#808080'; ctxs.bumpMap.fillRect(0, 0, size, size);
            ctxs.roughnessMap.fillStyle = '#333333'; ctxs.roughnessMap.fillRect(0, 0, size, size); // Very smooth/glossy

            // Ice grain noise
            addNoise(ctxs.map, size, 30000, 'rgba(255,255,255,0.15)');
            addNoise(ctxs.map, size, 20000, 'rgba(100,150,200,0.08)');
            addNoise(ctxs.bumpMap, size, 40000, 'rgba(255,255,255,0.1)');
            addNoise(ctxs.bumpMap, size, 40000, 'rgba(0,0,0,0.1)');

            // Frost cracks
            ctxs.map.strokeStyle = 'rgba(180,210,240,0.6)';
            ctxs.bumpMap.strokeStyle = 'rgba(0,0,0,0.3)';
            ctxs.map.lineWidth = 1;
            ctxs.bumpMap.lineWidth = 2;
            for (let i = 0; i < 12; i++) {
                let x = Math.random() * size, y = Math.random() * size;
                ctxs.map.beginPath(); ctxs.bumpMap.beginPath();
                ctxs.map.moveTo(x, y); ctxs.bumpMap.moveTo(x, y);
                for (let j = 0; j < 8; j++) {
                    x += (Math.random() - 0.5) * 60;
                    y += (Math.random() - 0.5) * 60;
                    ctxs.map.lineTo(x, y); ctxs.bumpMap.lineTo(x, y);
                }
                ctxs.map.stroke(); ctxs.bumpMap.stroke();
            }

            // Subtle blue tint patches
            for (let i = 0; i < 8; i++) {
                const x = Math.random() * size, y = Math.random() * size;
                const r = 50 + Math.random() * 100;
                const grad = ctxs.map.createRadialGradient(x, y, 0, x, y, r);
                grad.addColorStop(0, 'rgba(150,200,240,0.12)');
                grad.addColorStop(1, 'rgba(150,200,240,0)');
                ctxs.map.fillStyle = grad;
                ctxs.map.fillRect(x - r, y - r, r * 2, r * 2);
            }
        }),
        sphere: createTextureSet((ctxs, size) => {
            // Snowball texture — white with packed snow grain
            ctxs.map.fillStyle = '#eef4f8'; ctxs.map.fillRect(0, 0, size, size);
            ctxs.roughnessMap.fillStyle = '#cccccc'; ctxs.roughnessMap.fillRect(0, 0, size, size); // Rough snow
            ctxs.bumpMap.fillStyle = '#808080'; ctxs.bumpMap.fillRect(0, 0, size, size);

            // Snow grain
            addNoise(ctxs.map, size, 60000, 'rgba(255,255,255,0.2)');
            addNoise(ctxs.map, size, 40000, 'rgba(180,200,220,0.1)');
            addNoise(ctxs.bumpMap, size, 60000, 'rgba(255,255,255,0.15)');
            addNoise(ctxs.bumpMap, size, 60000, 'rgba(0,0,0,0.15)');

            // Slight blue shadow in recesses
            for (let i = 0; i < 5; i++) {
                const x = Math.random() * size, y = Math.random() * size;
                const r = 30 + Math.random() * 60;
                const grad = ctxs.map.createRadialGradient(x, y, 0, x, y, r);
                grad.addColorStop(0, 'rgba(160,190,220,0.15)');
                grad.addColorStop(1, 'rgba(160,190,220,0)');
                ctxs.map.fillStyle = grad;
                ctxs.map.fillRect(x - r, y - r, r * 2, r * 2);
            }
        })
    };
}

function generateInfernoTheme() {
    return {
        tile: createTextureSet((ctxs, size) => {
            // Obsidian base — very dark
            ctxs.map.fillStyle = '#1a0a00'; ctxs.map.fillRect(0, 0, size, size);
            ctxs.bumpMap.fillStyle = '#808080'; ctxs.bumpMap.fillRect(0, 0, size, size);
            ctxs.roughnessMap.fillStyle = '#999999'; ctxs.roughnessMap.fillRect(0, 0, size, size);

            // Rock texture noise
            addNoise(ctxs.map, size, 50000, 'rgba(40,20,5,0.15)');
            addNoise(ctxs.map, size, 30000, 'rgba(80,30,10,0.1)');
            addNoise(ctxs.bumpMap, size, 60000, 'rgba(255,255,255,0.12)');
            addNoise(ctxs.bumpMap, size, 60000, 'rgba(0,0,0,0.12)');

            // Lava cracks (bright orange/yellow veins)
            ctxs.emissiveMap.fillStyle = '#000000'; ctxs.emissiveMap.fillRect(0, 0, size, size);
            const crackColors = ['rgba(255,120,20,0.9)', 'rgba(255,80,10,0.8)', 'rgba(255,160,30,0.7)'];
            for (let i = 0; i < 10; i++) {
                let x = Math.random() * size, y = Math.random() * size;
                const crackColor = crackColors[i % crackColors.length];
                ctxs.emissiveMap.strokeStyle = crackColor;
                ctxs.emissiveMap.lineWidth = 2 + Math.random() * 4;
                ctxs.bumpMap.strokeStyle = '#000000';
                ctxs.bumpMap.lineWidth = 3 + Math.random() * 5;
                ctxs.emissiveMap.beginPath(); ctxs.bumpMap.beginPath();
                ctxs.emissiveMap.moveTo(x, y); ctxs.bumpMap.moveTo(x, y);
                for (let j = 0; j < 8; j++) {
                    x += (Math.random() - 0.5) * 70;
                    y += (Math.random() - 0.5) * 70;
                    ctxs.emissiveMap.lineTo(x, y); ctxs.bumpMap.lineTo(x, y);
                }
                ctxs.emissiveMap.stroke(); ctxs.bumpMap.stroke();
            }

            // Ash deposits
            addNoise(ctxs.map, size, 20000, 'rgba(60,50,40,0.2)');
        }),
        sphere: createTextureSet((ctxs, size) => {
            // Molten rock — dark crust with glowing cracks
            ctxs.map.fillStyle = '#2a1a0a'; ctxs.map.fillRect(0, 0, size, size);
            ctxs.roughnessMap.fillStyle = '#aaaaaa'; ctxs.roughnessMap.fillRect(0, 0, size, size);
            ctxs.bumpMap.fillStyle = '#808080'; ctxs.bumpMap.fillRect(0, 0, size, size);

            // Rocky texture
            addNoise(ctxs.map, size, 50000, 'rgba(60,30,10,0.15)');
            addNoise(ctxs.bumpMap, size, 50000, 'rgba(255,255,255,0.15)');
            addNoise(ctxs.bumpMap, size, 50000, 'rgba(0,0,0,0.15)');

            // Lava crack veins on sphere
            ctxs.emissiveMap.fillStyle = '#000000'; ctxs.emissiveMap.fillRect(0, 0, size, size);
            for (let i = 0; i < 8; i++) {
                let x = Math.random() * size, y = Math.random() * size;
                ctxs.emissiveMap.strokeStyle = 'rgba(255,100,20,0.8)';
                ctxs.emissiveMap.lineWidth = 2 + Math.random() * 3;
                ctxs.emissiveMap.beginPath();
                ctxs.emissiveMap.moveTo(x, y);
                for (let j = 0; j < 6; j++) {
                    x += (Math.random() - 0.5) * 60;
                    y += (Math.random() - 0.5) * 60;
                    ctxs.emissiveMap.lineTo(x, y);
                }
                ctxs.emissiveMap.stroke();
            }
        })
    };
}

export function getThemeMaterials(themeName) {
    // Map new theme names to legacy names for texture generation
    if (themeName === 'tron') themeName = 'default';
    if (themeName === 'temple') themeName = 'cracked_stone';

    if (themeName === 'default') {
        if (!textureCache.default) {
            textureCache.default = {
                tile: { map: createDiamondPlateTexture() },
                sphere: { map: createSphereTexture() }
            };
        }
        return {
            tileMaterialParams: {
                map: textureCache.default.tile.map,
                bumpMap: textureCache.default.tile.map,
                bumpScale: 0.1,
                color: 0x666666,
                metalness: 0.9,
                roughness: 0.5
            },
            sphereMaterialParams: {
                map: textureCache.default.sphere.map,
                metalness: 0.8,
                roughness: 0.2
            }
        };
    }

    if (!textureCache[themeName]) {
        if (themeName === 'beach') {
            textureCache[themeName] = generateBeachTheme();
        } else if (themeName === 'cracked_stone') {
            textureCache[themeName] = generateCrackedStoneTheme();
        } else if (themeName === 'arctic') {
            textureCache[themeName] = generateArcticTheme();
        } else if (themeName === 'inferno') {
            textureCache[themeName] = generateInfernoTheme();
        }
    }

    const design = textureCache[themeName];
    
    const tileMatParams = {
        map: design.tile.map,
        bumpMap: design.tile.bumpMap,
        bumpScale: 0.4,
        emissiveMap: design.tile.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 2.0,
        roughnessMap: design.tile.roughnessMap,
        metalness: 0.8,
        color: 0xffffff // Reset color so map shows properly
    };

    const sphereMatParams = {
        map: design.sphere.map,
        bumpMap: design.sphere.bumpMap,
        bumpScale: 0.4,
        emissiveMap: design.sphere.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 2.0,
        roughnessMap: design.sphere.roughnessMap,
        metalness: 0.8,
        color: 0xffffff // Reset color so map shows properly
    };

    if (themeName === 'cracked_stone') {
        tileMatParams.metalness = 0.1;
        sphereMatParams.metalness = 0.1;
    }
    if (themeName === 'beach') {
        tileMatParams.metalness = 0.0;
        sphereMatParams.metalness = 0.1;
    }
    if (themeName === 'arctic') {
        tileMatParams.metalness = 0.3;
        tileMatParams.bumpScale = 0.2;
        sphereMatParams.metalness = 0.0;
    }
    if (themeName === 'inferno') {
        tileMatParams.metalness = 0.2;
        tileMatParams.emissiveIntensity = 3.0;
        sphereMatParams.metalness = 0.3;
        sphereMatParams.emissiveIntensity = 3.0;
    }

    return {
        tileMaterialParams: tileMatParams,
        sphereMaterialParams: sphereMatParams
    };
}

export function getThemeShaderMaterials(themeName) {
    const resolved = resolveThemeName(themeName);
    const platformMaterial = createPlatformMaterial(resolved);
    const skyboxMaterial = createSkyboxMaterial(resolved);
    return { platformMaterial, skyboxMaterial };
}

export function getThemeColors(themeName) {
    const resolved = resolveThemeName(themeName);
    switch (resolved) {
        case 'beach':
            return { edgeColor: 0x00ffff, baseColor: 0xe6d2b5, iceColor: 0x0000ff };
        case 'temple':
            return { edgeColor: 0xff4400, baseColor: 0x7a7064, iceColor: 0x00ffff };
        case 'arctic':
            return { edgeColor: 0x88ddff, baseColor: 0xc8e8f8, iceColor: 0x00ccff };
        case 'inferno':
            return { edgeColor: 0xff4400, baseColor: 0x1a0a00, iceColor: 0x00ffff };
        case 'tron':
        default:
            return { edgeColor: 0xff00ff, baseColor: 0x0a0a0a, iceColor: 0x00ffff };
    }
}
