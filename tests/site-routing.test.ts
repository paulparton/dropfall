// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request, type IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameServer } from '../server/server.js';

const LIBRARY_HTML = '<!doctype html><title>Dropfall Library</title>';
const ARENA_HTML = '<!doctype html><title>Dropfall Arena</title>';
const ARENA_MANIFEST = readFileSync(join(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8');

describe('library and arena HTTP routing', () => {
  let fixtureRoot: string;
  let frontendDir: string;
  let server: GameServer;
  let baseUrl: string;
  let port: number;

  beforeAll(async () => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'dropfall-site-routing-'));
    frontendDir = join(fixtureRoot, 'dist');
    mkdirSync(join(frontendDir, 'dropfall-arena'), { recursive: true });
    mkdirSync(join(frontendDir, 'assets'));
    writeFileSync(join(frontendDir, 'index.html'), LIBRARY_HTML);
    writeFileSync(join(frontendDir, 'dropfall-arena', 'index.html'), ARENA_HTML);
    writeFileSync(join(frontendDir, 'assets', 'game-hash.js'), 'export const ready = true;');
    writeFileSync(join(frontendDir, 'studio-integrations.js'), 'export const ready = true;');
    writeFileSync(join(frontendDir, 'assets', 'physics.wasm'), Buffer.from([0, 97, 115, 109]));
    writeFileSync(join(frontendDir, 'manifest.webmanifest'), ARENA_MANIFEST);
    writeFileSync(join(frontendDir, '.private'), 'build metadata');
    writeFileSync(join(fixtureRoot, 'outside.txt'), 'outside build');
    symlinkSync(join(fixtureRoot, 'outside.txt'), join(frontendDir, 'assets', 'escape.txt'));
    server = new GameServer({ frontendDir });
    ({ port } = await server.start(0, '127.0.0.1'));
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await server?.stop();
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  });

  function rawGet(path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
    return new Promise<{ status: number; body: string; headers: IncomingHttpHeaders }>((resolve, reject) => {
      request({ hostname: '127.0.0.1', port, path, ...options }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode || 0, body, headers: response.headers }));
      }).on('error', reject).end();
    });
  }

  it('serves separate library and arena entrypoints from the current build', async () => {
    for (const path of ['/', '/index.html']) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await response.text()).toBe(LIBRARY_HTML);
    }
    for (const path of ['/dropfall-arena/', '/dropfall-arena/index.html']) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(ARENA_HTML);
    }
  });

  it('canonicalizes the arena path without losing invitation or mode parameters', async () => {
    const response = await fetch(`${baseUrl}/dropfall-arena?mode=online&invite=abc%2B123`, { redirect: 'manual' });
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/dropfall-arena/?mode=online&invite=abc%2B123');
  });

  it('redirects only the dedicated game host root to its arena for GET and HEAD', async () => {
    for (const method of ['GET', 'HEAD']) {
      for (const path of ['/', '/index.html']) {
        const response = await rawGet(`${path}?mode=online&invite=abc%2B123`, {
          method,
          headers: { Host: 'Dropfall.Dropfall-Game.com:443' },
        });
        expect(response.status).toBe(308);
        expect(response.headers.location).toBe('/dropfall-arena/?mode=online&invite=abc%2B123');
        expect(response.body).toBe('');
      }
    }
    const arena = await rawGet('/dropfall-arena/', { headers: { Host: 'dropfall.dropfall-game.com' } });
    expect(arena.status).toBe(200);
    expect(arena.body).toBe(ARENA_HTML);
    const unsupported = await rawGet('/', { method: 'POST', headers: { Host: 'dropfall.dropfall-game.com' } });
    expect(unsupported.status).toBe(405);
  });

  it.each(['dropfall-game.com', 'localhost', 'dropfall.dropfall-game.com.attacker.test', 'dropfall.dropfall-game.com@attacker.test', 'dropfall.dropfall-game.com:99999'])('does not apply the game host redirect to %s', async host => {
    const response = await rawGet('/', {
      headers: { Host: host, 'X-Forwarded-Host': 'dropfall.dropfall-game.com' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toBe(LIBRARY_HTML);
    expect(response.headers.location).toBeUndefined();
  });

  it('keeps API, health and asset URLs available on the dedicated game hostname', async () => {
    for (const path of ['/health', '/api/games', '/assets/game-hash.js']) {
      const response = await rawGet(path, { headers: { Host: 'dropfall.dropfall-game.com' } });
      expect(response.status).toBe(200);
      expect(response.headers.location).toBeUndefined();
    }
  });

  it('serves shared root assets and the game manifest with usable MIME types', async () => {
    const script = await fetch(`${baseUrl}/assets/game-hash.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toContain('application/javascript');
    expect(await script.text()).toBe('export const ready = true;');
    const wasm = await fetch(`${baseUrl}/assets/physics.wasm`);
    expect(wasm.status).toBe(200);
    expect(wasm.headers.get('content-type')).toBe('application/wasm');
    expect(new Uint8Array(await wasm.arrayBuffer())).toEqual(new Uint8Array([0, 97, 115, 109]));
    const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
    expect(manifest.headers.get('content-type')).toContain('application/manifest+json');
    expect(await manifest.json()).toMatchObject({ start_url: '/dropfall-arena/' });
  });

  it('exposes only the shared studio module cross-origin', async () => {
    const shared = await fetch(`${baseUrl}/studio-integrations.js`);
    expect(shared.status).toBe(200);
    expect(shared.headers.get('access-control-allow-origin')).toBe('*');
    expect(await shared.text()).toContain('export const ready');
    const ordinary = await fetch(`${baseUrl}/assets/game-hash.js`);
    expect(ordinary.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('preserves the installed game identity while moving its launch and scope into the arena', async () => {
    const response = await fetch(`${baseUrl}/manifest.webmanifest`);
    const manifest = await response.json();
    // The prior manifest omitted id and used start_url '/'. A stable explicit
    // id lets installed PWAs adopt the new launch URL instead of becoming a
    // different application: developer.chrome.com/docs/capabilities/pwa-manifest-id
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/dropfall-arena/');
    expect(manifest.scope).toBe('/dropfall-arena/');
    expect(new URL(manifest.id, baseUrl).href).toBe(new URL('/', baseUrl).href);
    expect((await fetch(new URL(manifest.start_url, baseUrl))).status).toBe(200);
  });

  it('supports HEAD without returning document or asset bodies', async () => {
    for (const path of ['/', '/dropfall-arena/', '/assets/game-hash.js']) {
      const response = await fetch(`${baseUrl}${path}`, { method: 'HEAD' });
      expect(response.status).toBe(200);
      expect(Number(response.headers.get('content-length'))).toBeGreaterThan(0);
      expect(await response.text()).toBe('');
    }
  });

  it.each(['POST', 'PUT', 'DELETE'])('does not serve frontend files for %s requests', async method => {
    const response = await fetch(`${baseUrl}/dropfall-arena/`, { method });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });

  it.each(['/missing', '/dropfall-arena/missing', '/assets/missing.js', '/dropfall-arena/assets/game-hash.js', '/assets/', '/.private', '/assets/escape.txt'])('returns 404 for %s without a game fallback', async path => {
    const response = await fetch(`${baseUrl}${path}`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it.each(['/../outside.txt', '/assets/%2e%2e/%2e%2e/outside.txt', '/assets%2f..%2f..%2foutside.txt', '/assets/%5coutside.txt', '/%00', '/%ZZ', '//admin'])('rejects unsafe request paths before normalization: %s', async path => {
    const response = await rawGet(path);
    expect(response.status).toBe(400);
    expect(response.body).toBe('Bad Request');
  });

  it('preserves operator access checks for clean and encoded aliases', async () => {
    const accessCheck = vi.spyOn(server, 'canAccessDevTools').mockReturnValue(false);
    try {
      for (const path of ['/admin', '/editor', '/admin.html', '/editor-3d.html', '/adm%69n', '/admin%2ehtml']) {
        const response = await fetch(`${baseUrl}${path}`);
        expect(response.status).toBe(404);
        expect(await response.text()).toBe('Not Found');
      }
    } finally {
      accessCheck.mockRestore();
    }
  });

  it('keeps health and APIs on the origin and advertises direct arena LAN URLs', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect((await health.json()).status).toBe('ok');
    const network = await fetch(`${baseUrl}/api/network-info`);
    const networkInfo = await network.json();
    expect(networkInfo.port).toBe(port);
    expect(networkInfo.gameUrls.length).toBeGreaterThan(0);
    for (const gameUrl of networkInfo.gameUrls) {
      expect(new URL(gameUrl).pathname).toBe('/dropfall-arena/');
      expect(new URL(gameUrl).port).toBe(String(port));
    }
    const preflight = await fetch(`${baseUrl}/api/levels`, { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);
    expect((await fetch(`${baseUrl}/api/games`)).status).toBe(200);
  });

  it('does not serve stale server/public game copies when the build is missing', async () => {
    const missingBuildServer = new GameServer({ frontendDir: join(fixtureRoot, 'missing-build') });
    try {
      const address = await missingBuildServer.start(0, '127.0.0.1');
      const missingBase = `http://127.0.0.1:${address.port}`;
      for (const path of ['/', '/dropfall-arena/', '/assets/game-hash.js']) {
        expect((await fetch(`${missingBase}${path}`)).status).toBe(404);
      }
      expect((await fetch(`${missingBase}/health`)).status).toBe(200);
      expect((await fetch(`${missingBase}/admin`)).status).toBe(200);
      expect((await fetch(`${missingBase}/editor`)).status).toBe(200);
    } finally {
      await missingBuildServer.stop();
    }
  });
});
