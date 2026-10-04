import type { Talent } from '../types.js';
import { TALENT_BRANCHES } from './systems.js';

export function validateTalentTree(nodes: readonly Talent[]): string[] {
  const issues: string[] = [], ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) issues.push('Duplicate talent: ' + node.id);
    ids.add(node.id);
    if (!TALENT_BRANCHES.includes(node.branch) || !Number.isInteger(node.cost) || node.cost <= 0 || node.enabled === undefined || !node.version) issues.push('Invalid talent metadata or cost: ' + node.id);
    if (node.requires && !nodes.some(n => n.id === node.requires)) issues.push('Unknown talent prerequisite: ' + node.id);
    const path = new Set<string>(); let next: Talent | undefined = node;
    while (next) {
      if (path.has(next.id)) { issues.push('Talent prerequisite cycle: ' + node.id); break; }
      path.add(next.id); const required: string | undefined = next.requires; next = required ? nodes.find(n => n.id === required) : undefined;
    }
    for (const [key, value] of Object.entries(node.perks ?? {})) {
      const max = ['fieldClueChance', 'craftGoldDiscount', 'craftEssenceDiscount'].includes(key) ? 1 : 100;
      if (!Number.isFinite(value) || value < 0 || value > max) issues.push('Invalid talent perk: ' + node.id + '/' + key);
    }
    if (node.passive && (!node.passive.trigger || !Number.isFinite(node.passive.cooldown) || (node.passive.cooldown ?? 0) <= 0 || !node.passive.effects.length)) issues.push('Invalid talent passive: ' + node.id);
  }
  return issues;
}
