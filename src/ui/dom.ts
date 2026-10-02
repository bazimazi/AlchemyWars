/** Required elements fail at the render boundary with a useful selector. */
export function query<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error('Missing interface element: ' + selector);
  return element;
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
export function escapeHtml(value: unknown): string {
  const entities: Record<string,string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, c => entities[c]);
}
