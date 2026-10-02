import type { Player } from '../types.js';
import { ELEMENT_BY_ID } from '../data/content.js';
import { reactionEngine } from '../core/reactions.js';

export function renderDiscoveryMap(player: Player) {
  const graph = reactionEngine.graph(player.discoveries, player.owned);
  type GraphRule = ReturnType<typeof reactionEngine.graph>[number];
  type MapNode = { id: string; name: string; tier: number; color: string; known: boolean; rule?: GraphRule };
  const columns = new Map<number, MapNode[]>();
  const nodes: MapNode[] = player.owned.map(id => ({ id, name: ELEMENT_BY_ID[id].name, tier: ELEMENT_BY_ID[id].tier, color: ELEMENT_BY_ID[id].color, known: true }));
  const frontier = graph.filter(r => !r.known && r.inputs.some(Boolean));
  frontier.forEach((r, i) => nodes.push({ id: 'unknown-' + i, name: 'Unwritten', tier: Math.min(5, (ELEMENT_BY_ID[r.inputs.find((id): id is string => !!id) ?? ""]?.tier ?? 1) + 1), color: '#788579', rule: r, known: false }));
  for (const node of nodes) { const col = Math.max(0, node.tier - 1); if (!columns.has(col)) columns.set(col, []); columns.get(col)!.push(node); }
  const width = (Math.max(...columns.keys()) + 1) * 200 + 40, height = Math.max(...[...columns.values()].map(c => c.length)) * 68 + 80;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [col, entries] of columns) entries.forEach((n, i) => positions.set(n.id, { x: 30 + col * 200, y: 60 + i * 68 }));
  const lines: string[] = [];
  function edge(from: string | null, to: string | null, known: boolean) { const a = positions.get(from ?? ""), b = positions.get(to ?? ""); if (!a || !b) return; lines.push('<path d="M' + (a.x + 140) + ',' + a.y + ' C' + (a.x + 180) + ',' + a.y + ' ' + (b.x - 40) + ',' + b.y + ' ' + b.x + ',' + b.y + '" class="map-edge ' + (known ? 'known' : '') + '"/>'); }
  graph.filter(r => r.known).forEach(r => r.inputs.forEach(id => edge(id, r.output, true)));
  nodes.filter(n => n.rule).forEach(n => n.rule!.inputs.filter(Boolean).forEach(id => edge(id, n.id, false)));
  return '<p class="codex-intro">Follow a line from an ingredient to its discovery. Dashed branches hide relationships you have yet to find. Scroll to explore; select a known node for its notes.</p><div class="discovery-map panel" tabindex="0" aria-label="Scrollable discovery graph"><svg role="img" aria-label="Your elemental relationships" width="' + width + '" height="' + height + '">' + lines.join('') + nodes.map(n => { const p = positions.get(n.id)!; return '<g transform="translate(' + p.x + ',' + (p.y - 20) + ')"><rect width="140" height="40" rx="9" fill="#233429" stroke="' + n.color + '"/><foreignObject width="140" height="40"><div xmlns="http://www.w3.org/1999/xhtml">' + (n.known ? '<button data-action="detail" data-id="' + n.id + '">' + n.name + '</button>' : '<span>◇ Unwritten</span>') + '</div></foreignObject></g>'; }).join('') + '</svg></div>';
}
