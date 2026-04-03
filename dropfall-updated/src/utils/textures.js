import * as THREE from 'three';

export function createSphereTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Metallic grid
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    
    for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Rivets
    ctx.fillStyle = '#aaa';
    for (let x = 0; x < canvas.width; x += 64) {
        for (let y = 0; y < canvas.height; y += 64) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

export function createDiamondPlateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#444'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#888';
    for(let x=0; x<256; x+=32) {
        for(let y=0; y<256; y+=32) {
            ctx.save();
            ctx.translate(x+16, y+16);
            ctx.rotate((x+y)%64 === 0 ? Math.PI/4 : -Math.PI/4);
            ctx.fillRect(-2, -8, 4, 16);
            ctx.restore();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
}
