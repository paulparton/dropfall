import { readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

export const ARENA_PATH = '/dropfall-arena/';
const ARENA_HOST = /^dropfall\.dropfall-game\.com(?::([0-9]{1,5}))?$/i;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
};

// Validate before URL normalization so encoded dot segments cannot change the
// requested route or bypass the operator-page access checks.
export function parseRequestTarget(target = '/') {
    if (!target.startsWith('/') || target.startsWith('//') || target.includes('#')) return null;
    try {
        const pathname = decodeURIComponent(target.split('?')[0]);
        if (/[\\\u0000-\u001f\u007f]/.test(pathname)) return null;
        if (pathname.split('/').some(segment => segment === '.' || segment === '..')) return null;
        return { url: new URL(target, 'http://localhost'), pathname };
    } catch {
        return null;
    }
}

function resolveBuiltFile(frontendDir, pathname) {
    const relativePath = pathname === '/' ? 'index.html'
        : pathname === ARENA_PATH ? 'dropfall-arena/index.html'
            : pathname.replace(/^\/+/, '');

    // Never expose build metadata, hidden files, or files reached via symlinks
    // outside the frontend output directory.
    if (relativePath.split('/').some(segment => segment.startsWith('.'))) return null;
    try {
        const root = realpathSync(frontendDir);
        const candidate = resolve(root, relativePath);
        if (!candidate.startsWith(`${root}${sep}`)) return null;
        const realFile = realpathSync(candidate);
        if (!realFile.startsWith(`${root}${sep}`) || !statSync(realFile).isFile()) return null;
        return realFile;
    } catch {
        return null;
    }
}

export function serveSiteRequest(req, res, { frontendDir, pathname, search = '' }) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
    }

    // Only the dedicated game hostname redirects its root. Ignore forwarded
    // host headers and keep the destination relative to the current origin.
    const arenaHostMatch = typeof req.headers.host === 'string' ? ARENA_HOST.exec(req.headers.host) : null;
    const isArenaHost = arenaHostMatch && (!arenaHostMatch[1] || (
        Number(arenaHostMatch[1]) > 0 && Number(arenaHostMatch[1]) <= 65535
    ));
    const isArenaHostRoot = isArenaHost && (pathname === '/' || pathname === '/index.html');
    if (isArenaHostRoot || pathname === ARENA_PATH.slice(0, -1)) {
        res.writeHead(308, { Location: `${ARENA_PATH}${search}` });
        res.end();
        return;
    }

    const filePath = resolveBuiltFile(frontendDir, pathname);
    if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : 'Not Found');
        return;
    }

    try {
        const content = readFileSync(filePath);
        const extension = extname(filePath).toLowerCase();
        const headers = {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
            'Content-Length': content.length,
        };
        if (pathname === '/studio-integrations.js') headers['Access-Control-Allow-Origin'] = '*';
        if (extension === '.html' || extension === '.webmanifest') headers['Cache-Control'] = 'no-cache';
        res.writeHead(200, headers);
        res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : 'Not Found');
    }
}
