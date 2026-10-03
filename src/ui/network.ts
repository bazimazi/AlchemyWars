import { applyRelease } from '../core/releases.js';
import { CONTENT_VERSION } from '../data/content.js';
import type { createService } from '../../server/service.js';
import type { PublicUser, WorldView } from '../../server/types.js';
type Service = Awaited<ReturnType<typeof createService>>;
type ResponseOf<K extends keyof Service> = Service[K] extends (...args: never[]) => infer R ? Awaited<R> : never;
interface Routes {
  content: ResponseOf<'content'>;
  me: ResponseOf<'me'>; world: WorldView; login: ResponseOf<'login'>; register: ResponseOf<'register'>;
  logout: ResponseOf<'logout'>; command: ResponseOf<'command'>; social: ResponseOf<'social'>;
  'battle/start': ResponseOf<'startBattle'>; 'battle/finish': ResponseOf<'finishBattle'>;
}
export const network: { account: PublicUser | null; available: boolean; world: WorldView | null } = { account: null, available: false, world: null };
export async function api<K extends keyof Routes>(path: K, body?: unknown, timeout = 10000): Promise<Routes[K]> {
  if (body && path !== 'battle/finish') await syncContent();
  const response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  let result: Routes[K] & { error?: string; account?: PublicUser | null };
  try { result = await response.json(); } catch { throw new Error('The shared world is unavailable on this host. Local play is still available.'); }
  if (!response.ok) throw new Error(result.error ?? 'The request failed.');
  if (result.account) network.account = result.account;
  return result;
}
export async function connect() {
  const deadline = Date.now() + 2500;
  try { await syncContent(2500); const session = await api('me', undefined, Math.max(1, deadline - Date.now())); network.available = true; network.account = session.account; return session; }
  catch { network.available = false; return null; }
}
export async function refreshWorld() { network.world = await api('world'); return network.world; }

export async function syncContent(timeout = 10000) {
  const content = await api('content', undefined, timeout);
  for (const release of content.releases) applyRelease(release);
  if (CONTENT_VERSION !== content.version) throw new Error('A new game distribution is available. Reload the page before continuing.');
  try { localStorage.setItem('alchemy-wars.content.v1', JSON.stringify({ base: CONTENT_VERSION.split('+')[0], releases: content.releases })); } catch { /* Online play remains available when storage is full. */ }
}
export function restoreCachedContent() {
  try {
    const raw = localStorage.getItem('alchemy-wars.content.v1');
    if (!raw || raw.length > 7_000_000) return;
    const cached = JSON.parse(raw);
    if (cached.base !== CONTENT_VERSION.split('+')[0] || !Array.isArray(cached.releases) || cached.releases.length > 100) return;
    for (const release of cached.releases) applyRelease(release);
  } catch { /* A damaged cache cannot prevent opening a local journal. */ }
}
