import type { Player, TalentPerks, Equipment } from '../types.js';
import { TALENTS } from '../data/systems.js';

// Imported saves retain only nodes whose prerequisite path is also present.
export function normalizeTalents(value: unknown): string[] {
  const requested = new Set(Array.isArray(value) ? value.slice(0, 10000).filter(id => typeof id === 'string') : []);
  const result: string[] = [];
  for (let pass = 0; pass < TALENTS.length; pass++) {
    const before = result.length;
    for (const node of TALENTS) if (node.enabled !== false && requested.has(node.id) && !result.includes(node.id) && (!node.requires || result.includes(node.requires))) result.push(node.id);
    if (result.length === before) break;
  }
  return result;
}

export function talentPerk(player: Pick<Player, 'talents'>, key: keyof TalentPerks): number {
  return TALENTS.filter(t => t.enabled !== false && player.talents.includes(t.id)).reduce((sum, t) => sum + (t.perks?.[key] ?? 0), 0);
}

export function craftCost(player: Pick<Player, 'talents'>, item: Equipment) {
  return {
    gold: Math.ceil(item.gold * (1 - Math.min(.5, talentPerk(player, 'craftGoldDiscount')))),
    essence: Math.ceil(item.essence * (1 - Math.min(.5, talentPerk(player, 'craftEssenceDiscount')))),
    shards: item.shards,
  };
}
