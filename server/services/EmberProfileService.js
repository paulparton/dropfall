import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = '/ember-and-iron/api';
const MAX_SAVE_BYTES = 12_000_000;
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;

function validUsername(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,24}$/.test(value) ? value.toLowerCase() : null;
}

function validPassword(value) {
    return typeof value === 'string' && value.length >= 8 && value.length <= 200;
}

function cookie(req, name) {
    const pair = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

export class EmberProfileService {
    constructor({ filePath, secret = process.env.EMBER_IRON_SESSION_SECRET || randomBytes(32).toString('hex') }) {
        this.filePath = filePath;
        this.secret = secret;
        mkdirSync(dirname(filePath), { recursive: true });
        this.store = this.readStore();
        this.loginAttempts = new Map();
    }

    readStore() {
        if (!existsSync(this.filePath)) return { version: 1, users: {} };
        try {
            const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
            return parsed?.version === 1 && parsed.users && typeof parsed.users === 'object'
                ? parsed : { version: 1, users: {} };
        } catch {
            return { version: 1, users: {} };
        }
    }

    writeStore() {
        const temporaryPath = `${this.filePath}.next`;
        writeFileSync(temporaryPath, JSON.stringify(this.store), { mode: 0o600 });
        renameSync(temporaryPath, this.filePath);
    }

    sign(value) {
        return createHmac('sha256', this.secret).update(value).digest('base64url');
    }

    sessionUser(req) {
        const value = cookie(req, 'ei_session');
        if (!value) return null;
        const [username, expires, signature] = value.split('.');
        if (!username || !expires || !signature || Number(expires) < Date.now()) return null;
        const expected = Buffer.from(this.sign(`${username}.${expires}`));
        const received = Buffer.from(signature);
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
        return this.store.users[username] ? username : null;
    }

    sessionCookie(username) {
        const expires = String(Date.now() + SESSION_AGE_SECONDS * 1000);
        const signed = `${username}.${expires}.${this.sign(`${username}.${expires}`)}`;
        const secure = process.env.EMBER_IRON_COOKIE_SECURE === 'false' ? '' : '; Secure';
        return `ei_session=${encodeURIComponent(signed)}; Path=/ember-and-iron; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE_SECONDS}${secure}`;
    }

    send(res, status, body, headers = {}) {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
        res.end(JSON.stringify(body));
    }

    readBody(req, res, callback) {
        let size = 0;
        let source = '';
        let finished = false;
        req.setEncoding('utf8');
        req.on('data', chunk => {
            if (finished) return;
            size += Buffer.byteLength(chunk);
            if (size > MAX_SAVE_BYTES + 4096) {
                finished = true;
                this.send(res, 413, { error: 'Request is too large.' });
                req.destroy();
                return;
            }
            source += chunk;
        });
        req.on('end', () => {
            if (finished) return;
            try { callback(JSON.parse(source || '{}')); } catch { callback(null); }
        });
    }

    saveFrom(body) {
        if (!body || typeof body.save !== 'string' || !body.save.length || Buffer.byteLength(body.save) > MAX_SAVE_BYTES) return null;
        try {
            const parsed = JSON.parse(body.save);
            return parsed?.format === 'ember-and-iron' && parsed.state ? body.save : null;
        } catch { return null; }
    }

    acceptsStateChange(req) {
        if (req.headers['x-requested-with'] !== 'ember-and-iron') return false;
        const origin = req.headers.origin;
        return !origin || origin === `https://${req.headers.host}` || (process.env.NODE_ENV !== 'production' && origin === `http://${req.headers.host}`);
    }

    attemptKey(req, username) {
        return `${req.socket.remoteAddress || 'unknown'}:${username || 'unknown'}`;
    }

    canAttempt(req, username) {
        const record = this.loginAttempts.get(this.attemptKey(req, username));
        return !record || record.until < Date.now() || record.count < 8;
    }

    failedAttempt(req, username) {
        const key = this.attemptKey(req, username);
        const existing = this.loginAttempts.get(key);
        const active = existing && existing.until >= Date.now() ? existing : { count: 0, until: Date.now() + 15 * 60 * 1000 };
        active.count += 1;
        this.loginAttempts.set(key, active);
    }

    handle(req, res, pathname) {
        if (!pathname.startsWith(`${API}/`)) return false;
        const route = pathname.slice(API.length);
        if (route === '/health' && req.method === 'GET') {
            this.send(res, 200, { ok: true });
            return true;
        }
        if (route === '/profile' && req.method === 'GET') {
            const username = this.sessionUser(req);
            this.send(res, 200, { profile: username ? { username } : null });
            return true;
        }
        if (['POST', 'PUT'].includes(req.method) && !this.acceptsStateChange(req)) {
            this.send(res, 403, { error: 'Invalid request origin.' });
            return true;
        }
        if (route === '/logout' && req.method === 'POST') {
            const secure = process.env.EMBER_IRON_COOKIE_SECURE === 'false' ? '' : '; Secure';
            this.send(res, 200, { ok: true }, { 'Set-Cookie': `ei_session=; Path=/ember-and-iron; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
            return true;
        }
        if (route === '/signup' && req.method === 'POST') {
            this.readBody(req, res, body => {
                const username = validUsername(body?.username);
                const save = this.saveFrom(body);
                if (!username) return this.send(res, 400, { error: 'Choose 3–24 letters, numbers, hyphens, or underscores.' });
                if (!validPassword(body?.password)) return this.send(res, 400, { error: 'Use a password with at least 8 characters.' });
                if (!save) return this.send(res, 400, { error: 'Your current save could not be read.' });
                if (this.store.users[username]) return this.send(res, 409, { error: 'That profile name is already taken.' });
                const passwordSalt = randomBytes(16).toString('base64url');
                this.store.users[username] = { username, passwordSalt, passwordHash: scryptSync(body.password, passwordSalt, 64).toString('base64url'), save, updatedAt: Date.now() };
                this.writeStore();
                return this.send(res, 201, { profile: { username } }, { 'Set-Cookie': this.sessionCookie(username) });
            });
            return true;
        }
        if (route === '/login' && req.method === 'POST') {
            this.readBody(req, res, body => {
                const username = validUsername(body?.username);
                const user = username && this.store.users[username];
                if (!this.canAttempt(req, username)) return this.send(res, 429, { error: 'Too many sign-in attempts. Try again in 15 minutes.' });
                if (!user || !validPassword(body?.password)) {
                    this.failedAttempt(req, username);
                    return this.send(res, 401, { error: 'Profile name or password is incorrect.' });
                }
                const expected = Buffer.from(user.passwordHash, 'base64url');
                const actual = scryptSync(body.password, user.passwordSalt, 64);
                if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
                    this.failedAttempt(req, username);
                    return this.send(res, 401, { error: 'Profile name or password is incorrect.' });
                }
                this.loginAttempts.delete(this.attemptKey(req, username));
                return this.send(res, 200, { profile: { username }, save: user.save }, { 'Set-Cookie': this.sessionCookie(username) });
            });
            return true;
        }
        const username = this.sessionUser(req);
        if (!username) {
            this.send(res, 401, { error: 'Sign in to save a profile.' });
            return true;
        }
        if (route === '/save' && req.method === 'GET') {
            const user = this.store.users[username];
            this.send(res, 200, { save: user.save, updatedAt: user.updatedAt });
            return true;
        }
        if (route === '/save' && req.method === 'PUT') {
            this.readBody(req, res, body => {
                const save = this.saveFrom(body);
                if (!save) return this.send(res, 400, { error: 'The save is invalid or too large.' });
                this.store.users[username].save = save;
                this.store.users[username].updatedAt = Date.now();
                this.writeStore();
                return this.send(res, 200, { ok: true, updatedAt: this.store.users[username].updatedAt });
            });
            return true;
        }
        this.send(res, 404, { error: 'Not found.' });
        return true;
    }
}
