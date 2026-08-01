import { randomBytes, timingSafeEqual } from 'crypto';

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
];

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function createOriginAllowlist(rawValue = '') {
  const configured = String(rawValue)
    .split(',')
    .map(value => normalizeOrigin(value.trim()))
    .filter(Boolean);
  return new Set([...LOCAL_DEV_ORIGINS, ...configured]);
}

export function isOriginAllowed(origin, host, allowlist) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  if (allowlist.has(normalizedOrigin)) return true;

  try {
    const originUrl = new URL(normalizedOrigin);
    return Boolean(host) && originUrl.host.toLowerCase() === String(host).toLowerCase();
  } catch {
    return false;
  }
}

export function isLoopbackAddress(address) {
  const value = String(address || '').toLowerCase();
  return value === '127.0.0.1' ||
    value === '::1' ||
    value === '::ffff:127.0.0.1';
}

export function readBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const editorHeader = req.headers['x-dropfall-editor-token'];
  return typeof editorHeader === 'string' ? editorHeader.trim() : '';
}

export function secureTokenEqual(received, expected) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(String(received));
  const expectedBuffer = Buffer.from(String(expected));
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function createReconnectToken() {
  return randomBytes(32).toString('base64url');
}

export function consumeFixedWindow(bucket, now, maxEvents, windowMs) {
  if (!bucket.windowStartedAt || now - bucket.windowStartedAt >= windowMs) {
    bucket.windowStartedAt = now;
    bucket.events = 0;
  }
  bucket.events += 1;
  return bucket.events <= maxEvents;
}

export function applyBaseSecurityHeaders(res, { editorPage = false } = {}) {
  const scriptPolicy = editorPage
    ? "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com"
    : "script-src 'self' 'wasm-unsafe-eval'";
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' ws: wss:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
}
