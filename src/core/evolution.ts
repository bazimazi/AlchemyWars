import type { Player } from '../types.js';
import { ELEMENT_BY_ID } from '../data/content.js';
import { SPECIALIZATIONS } from '../data/systems.js';
import { evolutionTrait } from '../data/evolution.js';

export function evolutionLevel(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0;
}
export function evolutionCost(player: Player, id: string) {
  const level = evolutionLevel(player.evolution[id]);
  return { gold: 60 * (level + 1), essence: 15 * (level + 1), mastery: 15 * (level + 1) };
}
export function evolutionState(player: Player, id: string) {
  const element = Object.hasOwn(ELEMENT_BY_ID, id) ? ELEMENT_BY_ID[id] : undefined;
  if (!element || element.enabled === false || !player.owned.includes(id)) return null;
  const level = evolutionLevel(player.evolution[id]), cost = evolutionCost(player, id);
  return { element, level, cost, trait: evolutionTrait(element), ready: level < 3 && player.gold >= cost.gold && player.essence >= cost.essence && (player.mastery[id] ?? 0) >= cost.mastery,
    specializations: SPECIALIZATIONS.filter(s => !s.tags || s.tags.some(tag => element.tags.includes(tag))) };
}
