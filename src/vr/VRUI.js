import * as THREE from 'three';

function createTextSprite(initialText, options = {}) {
    const width = options.width || 512;
    const height = options.height || 128;
    const fontSize = options.fontSize || 56;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(options.scaleX || 8, options.scaleY || 2, 1);

    const uiItem = {
        canvas,
        ctx,
        texture,
        sprite,
        fontSize,
        lastText: ''
    };

    drawText(uiItem, initialText);

    return uiItem;
}

function drawText(uiItem, text) {
    if (!uiItem || !uiItem.ctx) return;
    if (uiItem.lastText === text) return;

    const ctx = uiItem.ctx;
    const canvas = uiItem.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `bold ${uiItem.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    uiItem.texture.needsUpdate = true;
    uiItem.lastText = text;
}

function buildStatusText(gameState) {
    if (!gameState) return '';

    if (gameState.gameState === 'COUNTDOWN') return 'GET READY';
    if (gameState.gameState === 'PLAYING') return '';
    if (gameState.gameState === 'ROUND_OVER') {
        if (gameState.winner === 'Draw') return 'ROUND DRAW';
        return `${gameState.winner || ''} WINS ROUND`;
    }
    if (gameState.gameState === 'GAME_OVER') {
        if (gameState.winner === 'Draw') return 'GAME OVER - DRAW';
        return `GAME OVER - ${gameState.winner || ''}`;
    }

    return gameState.gameState || '';
}

export function createVRUI(scene) {
    if (!scene) {
        throw new Error('[VRUI] createVRUI requires a scene');
    }

    const p1Score = createTextSprite('P1: 0', { scaleX: 6, scaleY: 1.5, fontSize: 52 });
    p1Score.sprite.position.set(-8, 11, -2);

    const p2Score = createTextSprite('P2: 0', { scaleX: 6, scaleY: 1.5, fontSize: 52 });
    p2Score.sprite.position.set(8, 11, -2);

    const status = createTextSprite('', { scaleX: 10, scaleY: 2, fontSize: 50 });
    status.sprite.position.set(0, 13, -5);

    scene.add(p1Score.sprite);
    scene.add(p2Score.sprite);
    scene.add(status.sprite);

    return {
        p1Score,
        p2Score,
        status,
        lastP1Score: null,
        lastP2Score: null,
        lastStatus: null
    };
}

export function updateVRUI(uiElements, gameState) {
    if (!uiElements || !gameState) return;

    const p1 = Number.isFinite(gameState.p1Score) ? gameState.p1Score : 0;
    const p2 = Number.isFinite(gameState.p2Score) ? gameState.p2Score : 0;

    if (uiElements.lastP1Score !== p1) {
        drawText(uiElements.p1Score, `P1: ${p1}`);
        uiElements.lastP1Score = p1;
    }

    if (uiElements.lastP2Score !== p2) {
        drawText(uiElements.p2Score, `P2: ${p2}`);
        uiElements.lastP2Score = p2;
    }

    const statusText = buildStatusText(gameState);
    if (uiElements.lastStatus !== statusText) {
        drawText(uiElements.status, statusText);
        uiElements.lastStatus = statusText;
    }

    const showStatus = statusText.length > 0;
    uiElements.status.sprite.visible = showStatus;
    uiElements.p1Score.sprite.visible = true;
    uiElements.p2Score.sprite.visible = true;
}
