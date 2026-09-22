import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import WebSocket from 'ws';
import { GameServer } from '../server/server.js';
import { applyBaseSecurityHeaders } from '../server/security.js';
import { DROPFALL_PROTOCOL_VERSION } from '../shared/protocolVersion.js';

const PUBLIC_TEST_LEVEL_PATH = resolve('server/levels/test_public_unreachable.json');

function policyDirectives(value: string | null) {
  return new Map((value || '').split(';').map(directive => {
    const [name = '', ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
}

describe('analytics content security policy scope', () => {
  const tagScript = 'https://www.googletagmanager.com/gtag/js';
  const adScript = 'https://pagead2.googlesyndication.com';
  const collectionOrigins = ['https://www.google-analytics.com', 'https://region1.google-analytics.com'];
  const adOrigins = [
    'https://pagead2.googlesyndication.com',
    'https://*.googlesyndication.com',
    'https://*.doubleclick.net',
    'https://*.adtrafficquality.google',
    'https://fundingchoicesmessages.google.com',
  ];

  function headersFor(options: { editorPage?: boolean; analyticsPage?: boolean } = {}) {
    const headers = new Map<string, string>();
    applyBaseSecurityHeaders({ setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); } }, options);
    return headers;
  }

  it('permits only the selected tag path and two collection origins on analytics pages', () => {
    const headers = headersFor({ analyticsPage: true });
    const policy = policyDirectives(headers.get('content-security-policy') || null);
    expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", tagScript, adScript, 'https://*.adtrafficquality.google']);
    expect(policy.get('connect-src')).toEqual(["'self'", 'ws:', 'wss:', ...collectionOrigins, ...adOrigins]);
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:', ...collectionOrigins, ...adOrigins]);
    expect(policy.get('frame-src')).toEqual(["'self'", ...adOrigins, 'https://www.google.com']);
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect([...policy.values()].flat()).not.toContain("'unsafe-eval'");
    expect([...policy.values()].flat()).not.toContain('*');
  });

  it.each([{}, { analyticsPage: false }])('leaves baseline pages without Google analytics permission: %j', options => {
    const headers = headersFor(options);
    const policy = policyDirectives(headers.get('content-security-policy') || null);
    expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(policy.get('connect-src')).toEqual(["'self'", 'ws:', 'wss:']);
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(headers.get('content-security-policy')).not.toMatch(/googletagmanager|google-analytics/);
    expect(headers.get('referrer-policy')).toBe('no-referrer');
  });

  it.each([false, true])('editor policy wins over analyticsPage=%s without permitting Google', analyticsPage => {
    const headers = headersFor({ editorPage: true, analyticsPage });
    const policy = policyDirectives(headers.get('content-security-policy') || null);
    expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com']);
    expect(headers.get('content-security-policy')).not.toMatch(/googletagmanager|google-analytics/);
    expect([...policy.values()].flat()).not.toContain("'unsafe-eval'");
    expect(headers.get('referrer-policy')).toBe('no-referrer');
  });
});

function waitForMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for WebSocket message')), 2000);
    socket.once('message', data => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('production server boundaries', () => {
  let server: GameServer;
  let baseUrl: string;
  let wsUrl: string;

  beforeEach(async () => {
    server = new GameServer();
    const address = await server.start(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${address.port}`;
    wsUrl = `ws://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await server.stop();
    if (existsSync(PUBLIC_TEST_LEVEL_PATH)) unlinkSync(PUBLIC_TEST_LEVEL_PATH);
  });

  it('sets baseline security headers and rejects untrusted CORS origins', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('x-frame-options')).toBe('DENY');
    expect(health.headers.get('referrer-policy')).toBe('no-referrer');
    const contentSecurityPolicy = health.headers.get('content-security-policy');
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policyDirectives(contentSecurityPolicy).get('script-src')).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy).not.toMatch(/googletagmanager|google-analytics/);

    const rejected = await fetch(`${baseUrl}/api/network-info`, {
      headers: { Origin: 'https://attacker.example' },
    });
    expect(rejected.status).toBe(403);
  });

  it.each(['/', '/index.html', '/dropfall-arena/', '/dropfall-arena/index.html'])('adds the narrow analytics policy to public entrypoint %s', async path => {
    const response = await fetch(`${baseUrl}${path}`);
    const policy = policyDirectives(response.headers.get('content-security-policy'));
    expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", 'https://www.googletagmanager.com/gtag/js', 'https://pagead2.googlesyndication.com', 'https://*.adtrafficquality.google']);
    expect(policy.get('connect-src')).toContain('https://www.google-analytics.com');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it.each(['/health', '/api/games', '/privacy.html', '/assets/not-present.js', '/missing-page', '/admin', '/editor', '/admin.html', '/editor-3d.html'])('does not widen analytics permissions on %s', async path => {
    const response = await fetch(`${baseUrl}${path}`);
    const contentSecurityPolicy = response.headers.get('content-security-policy');
    expect(contentSecurityPolicy).not.toBeNull();
    expect(contentSecurityPolicy).not.toMatch(/googletagmanager|google-analytics/);
    expect(policyDirectives(contentSecurityPolicy).get('script-src')).toContain("'wasm-unsafe-eval'");
    expect(policyDirectives(contentSecurityPolicy).get('script-src')).not.toContain("'unsafe-eval'");
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('allows public publishing of unreachable maps without gameplay validation', async () => {
    const response = await fetch(`${baseUrl}/api/levels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test_public_unreachable',
        name: 'Test Arena',
        active: true,
        tiles: [{ coord: { q: 0, r: 0 }, ability: 'NORMAL', height: 4 }],
      }),
    });
    expect(response.status).toBe(201);
    const result = await response.json() as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.active).toBe(true);
    expect(result.launchReady).toBe(false);

    const deleteResponse = await fetch(`${baseUrl}/api/levels/not-a-real-level`, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(503);
  });

  it('keeps legacy custom arenas visible as experimental catalogue entries', async () => {
    const response = await fetch(`${baseUrl}/api/levels`);
    expect(response.status).toBe(200);
    const levels = await response.json() as Array<Record<string, unknown>>;
    const legacy = levels.find(level => level.id === 'level_1775555541868_53d3dfad');

    expect(legacy?.active).toBe(true);
    expect(legacy?.launchReady).toBe(false);
    expect(Array.isArray(legacy?.tiles)).toBe(true);

    const detailResponse = await fetch(`${baseUrl}/api/levels/level_1775555541868_53d3dfad`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as Record<string, unknown>;
    expect(detail.active).toBe(true);
  });

  it('negotiates the protocol and rejects privilege fields from clients', async () => {
    const socket = new WebSocket(wsUrl, {
      headers: { Origin: 'http://localhost:5173' },
    });
    const connected = await waitForMessage(socket);
    expect(connected.type).toBe('connected');
    expect(connected.protocolVersion).toBe(DROPFALL_PROTOCOL_VERSION);

    socket.send(JSON.stringify({
      type: 'set_name',
      name: 'Attacker',
      isAdmin: true,
    }));
    const error = await waitForMessage(socket);
    expect(error.type).toBe('error');
    expect(error.code).toBe('INVALID_MESSAGE');
    socket.close();
  });

  it('rejects WebSocket handshakes from untrusted browser origins', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(wsUrl, {
        headers: { Origin: 'https://attacker.example' },
      });
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        resolve(response.statusCode || 0);
      });
      socket.once('open', () => reject(new Error('Untrusted origin connected')));
      socket.once('error', () => {
        // `unexpected-response` is the assertion path for the rejected upgrade.
      });
    });
    expect(status).toBe(403);
  });
});
