/**
 * 3D Level Editor Server
 * 
 * Serves a Three.js-based 3D level editor that matches the game's hex grid system.
 * - Real-time 3D visualization using Three.js
 * - Hex tile placement with axial coordinates (q, r)
 * - Same tile types and materials as the game
 * - Full level management (create, load, save, delete)
 * - REST API for persistence
 * 
 * Usage:
 *   npm run editor:dev
 * 
 * Access:
 *   http://localhost:3001
 */

import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_PORT = process.env.EDITOR_PORT || 3001;
const PUBLIC_DIR = join(__dirname, 'public');
const LEVELS_DIR = join(__dirname, 'levels');

if (!existsSync(LEVELS_DIR)) {
    mkdirSync(LEVELS_DIR, { recursive: true });
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
};

class Level3DEditorServer {
    constructor() {
        this.server = createServer((req, res) => this.handleRequest(req, res));
        this.stats = {
            totalRequests: 0,
            levelsSaved: 0,
            startTime: Date.now(),
        };
        this.loadLevelsFromDisk();
    }

    start() {
        this.server.listen(EDITOR_PORT, () => {
            console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
            console.log(`║          DROPFALL 3D LEVEL EDITOR                             ║`);
            console.log(`╠════════════════════════════════════════════════════════════════╣`);
            console.log(`║                                                                ║`);
            console.log(`║  📍 http://localhost:${EDITOR_PORT}                                    ║`);
            console.log(`║                                                                ║`);
            console.log(`║  🎨 3D Hex Level Editor                                         ║`);
            console.log(`║  • Real-time 3D visualization                                 ║`);
            console.log(`║  • Place hex tiles with mouse click                           ║`);
            console.log(`║  • Same materials as the game                                 ║`);
            console.log(`║  • Save/load/delete levels                                    ║`);
            console.log(`║                                                                ║`);
            console.log(`║  📁 Levels: ${LEVELS_DIR.replace(/^.*\//, '')}                        ║`);
            console.log(`║                                                                ║`);
            console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
        });
    }

    handleRequest(req, res) {
        this.stats.totalRequests++;

        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Root - serve editor HTML
        if (req.method === 'GET' && req.url === '/') {
            this.serveEditorHTML(res);
            return;
        }

        // API routes
        if (req.url.startsWith('/api/levels')) {
            this.handleLevelAPI(req, res);
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    }

    serveEditorHTML(res) {
        const html = readFileSync(join(PUBLIC_DIR, 'editor-3d.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }

    handleLevelAPI(req, res) {
        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;

        // GET /api/levels - list all
        if (req.method === 'GET' && pathname === '/api/levels') {
            try {
                const files = readdirSync(LEVELS_DIR);
                const levels = files
                    .filter(f => f.endsWith('.json'))
                    .map(f => {
                        const data = JSON.parse(readFileSync(join(LEVELS_DIR, f), 'utf-8'));
                        return {
                            id: f.replace('.json', ''),
                            name: data.name,
                            description: data.description,
                            difficulty: data.difficulty,
                            tileCount: data.tiles?.length || 0,
                            lastModified: statSync(join(LEVELS_DIR, f)).mtimeMs
                        };
                    });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(levels));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        // GET /api/levels/:id - get specific level
        if (req.method === 'GET' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            const id = pathname.split('/').pop();
            try {
                const data = readFileSync(join(LEVELS_DIR, `${id}.json`), 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } catch (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Level not found' }));
            }
            return;
        }

        // POST /api/levels - create/save level
        if (req.method === 'POST' && pathname === '/api/levels') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const level = JSON.parse(body);
                    const id = level.id || `level_${Date.now()}_${randomBytes(4).toString('hex')}`;
                    writeFileSync(join(LEVELS_DIR, `${id}.json`), JSON.stringify(level, null, 2));
                    this.stats.levelsSaved++;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ id, success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        // PUT /api/levels/:id - update level
        if (req.method === 'PUT' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            const id = pathname.split('/').pop();
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const level = JSON.parse(body);
                    level.id = id;
                    writeFileSync(join(LEVELS_DIR, `${id}.json`), JSON.stringify(level, null, 2));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ id, success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        // DELETE /api/levels/:id - delete level
        if (req.method === 'DELETE' && pathname.match(/^\/api\/levels\/[^/]+$/)) {
            const id = pathname.split('/').pop();
            try {
                unlinkSync(join(LEVELS_DIR, `${id}.json`));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Level not found' }));
            }
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    }

    loadLevelsFromDisk() {
        try {
            const files = readdirSync(LEVELS_DIR).filter(f => f.endsWith('.json'));
            console.log(`✓ Loaded ${files.length} levels from disk`);
        } catch (err) {
            console.log('✓ No levels on disk yet (levels directory will be created)');
        }
    }
}

// Start server
const server = new Level3DEditorServer();
server.start();
