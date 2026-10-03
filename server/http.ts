import type { IncomingMessage } from 'node:http';
import type { BattleRequest } from './types.js';
interface RequestBody extends BattleRequest { name?: unknown; password?: unknown; command?: string; payload?: unknown; battleId?: string; action?: string }
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { createService, ServiceError } from './service.js';
import { installContentPack } from '../src/core/content-tools.js';
import { CONTENT_VERSION } from '../src/data/content.js';

async function readJson(request: IncomingMessage): Promise<RequestBody> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ServiceError('Use application/json.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 65536) throw new ServiceError('Request is too large.', 413); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new ServiceError('Invalid JSON request.'); }
}
const types: Record<string,string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
export async function createAppServer({ root = '.', dataDir = '.data', publicOrigin = process.env.PUBLIC_ORIGIN, secureCookies = process.env.SECURE_COOKIES === '1', adminToken = process.env.ADMIN_TOKEN } = {}) {
  for (const pack of JSON.parse(await readFile(resolve(root, 'assets/content-packs.json'), 'utf8'))) installContentPack(pack);
  const service = await createService(dataDir), base = resolve(root), rates = new Map();
  function rateLimit(request: IncomingMessage, auth = false) {
    const now = Date.now(), key = (auth ? 'auth:' : 'api:') + request.socket.remoteAddress;
    if (rates.size > 10000) for (const [id, value] of rates) if (value.until < now) rates.delete(id);
    let rate = rates.get(key);
    if (!rate || rate.until < now) { rate = { count: 0, until: now + 60000 }; rates.set(key, rate); }
    if (++rate.count > (auth ? 15 : 600)) throw new ServiceError('Please wait a minute before trying again.', 429);
  }
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'same-origin'); response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    const json = (status: number, value: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname.startsWith('/api/')) {
        rateLimit(request, ['/api/register', '/api/login'].includes(pathname));
        const token = (request.headers.cookie ?? '').split(';').map(p => p.trim()).find(p => p.startsWith('alchemy_session='))?.slice('alchemy_session='.length);
        if (request.method === 'GET') {
          if (pathname === '/api/content') return json(200, service.content());
          if (pathname === '/api/status') return json(200, { available: true, contentVersion: CONTENT_VERSION, live: service.store.data.live });
          if (pathname === '/api/me') return json(200, service.me(token));
          if (pathname === '/api/world') return json(200, service.world(token));
          return json(404, { error: 'Endpoint not found.' });
        }
        if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
        const origin = request.headers.origin;
        if (origin && origin !== (publicOrigin ?? 'http://' + request.headers.host)) throw new ServiceError('Cross-origin writes are not allowed.', 403);
        const body = await readJson(request);
        if (pathname === '/api/register' || pathname === '/api/login') {
          const result = await service[pathname === '/api/register' ? 'register' : 'login'](body.name, body.password);
          response.setHeader('Set-Cookie', 'alchemy_session=' + result.token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800' + (secureCookies ? '; Secure' : ''));
          const { token: _token, ...session } = result; return json(200, session);
        }
        if (pathname === '/api/logout') {
          await service.logout(token); response.setHeader('Set-Cookie', 'alchemy_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + (secureCookies ? '; Secure' : '')); return json(200, { ok: true });
        }
        if (pathname === '/api/command') return json(200, await service.command(token, body.command ?? "", body.payload ?? {}));
        if (pathname === '/api/battle/start') return json(200, await service.startBattle(token, body));
        if (pathname === '/api/battle/finish') return json(200, await service.finishBattle(token, body.battleId ?? ""));
        if (pathname === '/api/social') return json(200, await service.social(token, body.action ?? "", body.payload ?? {}));
        if (pathname === '/api/admin/live' || pathname === '/api/admin/analytics' || pathname === '/api/admin/content') {
          const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
          if (!adminToken || Buffer.byteLength(supplied) !== Buffer.byteLength(adminToken) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(adminToken))) throw new ServiceError('Administrator authentication required.', 403);
          if (pathname.endsWith('/content')) return json(200, await service.publishContent(body));
          return json(200, pathname.endsWith('/analytics') ? service.analytics() : await service.updateLive(body));
        }
        return json(404, { error: 'Endpoint not found.' });
      }
      if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end(); return; }
      const file = resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (file !== base && !file.startsWith(base + sep)) { response.writeHead(403).end('Forbidden'); return; }
      if (pathname.split('/').some(p => p.startsWith('.')) || (!pathname.startsWith('/src/') && !pathname.startsWith('/assets/') && !['/', '/index.html', '/manifest.webmanifest', '/sw.js'].includes(pathname))) { response.writeHead(404).end('Not found'); return; }
      if (!(await stat(file)).isFile()) { response.writeHead(404).end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
      if (error instanceof ServiceError) json(error.status, { error: error.message });
      else if ((error as NodeJS.ErrnoException).code === 'ENOENT') response.writeHead(404).end('Not found');
      else if (error instanceof TypeError || error instanceof SyntaxError) json(400, { error: 'Invalid request data.' });
      else { console.error(error); json(500, { error: 'The server could not complete this action.' }); }
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return { server, service };
}
