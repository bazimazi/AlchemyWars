export const network = { account: null, available: false, world: null };
export async function api(path, body) {
  const response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let result;
  try { result = await response.json(); } catch { throw new Error('The shared world is unavailable on this host. Local play is still available.'); }
  if (!response.ok) throw new Error(result.error ?? 'The request failed.');
  if (result.account) network.account = result.account;
  return result;
}
export async function connect() {
  try { const session = await api('me'); network.available = true; network.account = session.account; return session; }
  catch { network.available = false; return null; }
}
export async function refreshWorld() { network.world = await api('world'); return network.world; }
