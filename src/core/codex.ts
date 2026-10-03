import { recordBattleLearning } from './learning.js';
import type { Player, BattleResult, DiscoveredChain } from '../types.js';
import { ENCOUNTERS, ENEMY_BY_ID, REACTION_BY_ID } from '../data/content.js';
import { reactionEngine } from './reactions.js';

export function relationshipCounts(player: Player, element: string) {
  const recipes = reactionEngine.candidates(element);
  const known = recipes.filter(r => player.discoveries.includes(r.id)).length;
  return { known, unknown: recipes.length - known, total: recipes.length };
}
export function highestBoss(player: Player) {
  return ENCOUNTERS.filter(e => e.boss && player.campaign.includes(e.id)).at(-1) ?? null;
}
export function normalizeChains(value: unknown): DiscoveredChain[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((c): c is DiscoveredChain => {
    if (!c || !Array.isArray(c.reactions) || c.reactions.length < 2 || c.reactions.length > 12 || !c.reactions.every((id: unknown) => typeof id === 'string' && REACTION_BY_ID[id]) || !Number.isFinite(c.firstSeen)) return false;
    const key = c.reactions.join('|');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(-200).map(c => ({ reactions: [...c.reactions], firstSeen: Math.max(0, Math.min(8_640_000_000_000_000, Math.floor(c.firstSeen))) }));
}
export function recordBattleCodex(player: Player, battle: BattleResult, now = Date.now()) {
  recordBattleLearning(player, battle, now);
  player.highestChain = Math.max(player.highestChain, battle.report.highestChain);
  for (const path of battle.report.chains) if (!player.chains.some(c => c.reactions.join('|') === path.join('|'))) player.chains.push({ reactions: [...path], firstSeen: now });
  player.chains = player.chains.slice(-200);
  for (const [id, observed] of Object.entries(battle.report.mechanics)) {
    if (!ENEMY_BY_ID[id]) continue;
    const known = player.creatureKnowledge[id] ??= { phases: [], behaviors: [] };
    known.phases = [...new Set([...known.phases, ...observed.phases])];
    known.behaviors = [...new Set([...known.behaviors, ...observed.behaviors])];
  }
  player.creatures = [...new Set([...player.creatures, ...battle.final.units.filter(u => u.side === 'enemy' && ENEMY_BY_ID[u.definitionId]).map(u => u.definitionId)])];
}
