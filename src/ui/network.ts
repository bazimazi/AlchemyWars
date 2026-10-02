import type { createService } from '../../server/service.js';
import type { PublicUser, WorldView } from '../../server/types.js';
type Service = Awaited<ReturnType<typeof createService>>;
type ResponseOf<K extends keyof Service> = Service[K] extends (...args: never[]) => infer R ? Awaited<R> : never;
interface Routes {
  me: ResponseOf<'me'>; world: WorldView; login: ResponseOf<'login'>; register: ResponseOf<'register'>;
  logout: ResponseOf<'logout'>; command: ResponseOf<'command'>; social: ResponseOf<'social'>;
  'battle/start': ResponseOf<'startBattle'>; 'battle/finish': ResponseOf<'finishBattle'>;
}
export const network: { account: PublicUser | null; available: boolean; world: WorldView | null } = { account: null, available: false, world: null };
export async function api<K extends keyof Routes>(path: K, body?: unknown, timeout = 10000): Promise<Routes[K]> {
  const response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  let result: Routes[K] & { error?: string; account?: PublicUser | null };
  try { result = await response.json(); } catch { throw new Error('The shared world is unavailable on this host. Local play is still available.'); }
  if (!response.ok) throw new Error(result.error ?? 'The request failed.');
  if (result.account) network.account = result.account;
  return result;
}
export async function connect() {
  try { const session = await api('me', undefined, 2500); network.available = true; network.account = session.account; return session; }
  catch { network.available = false; return null; }
}
export async function refreshWorld() { network.world = await api('world'); return network.world; }
