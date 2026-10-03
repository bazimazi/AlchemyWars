import { BALANCE, CONTENT_VERSION } from '../data/content.js';
import { installContentPack, validatePack } from './content-tools.js';
import type { ContentPack } from './content-tools.js';

export interface ContentRelease { pack: ContentPack; balance: Partial<typeof BALANCE> }
// Structural simulation limits stay local; remotely editable balance values have explicit bounds.
const bounds: Partial<Record<keyof typeof BALANCE, [number, number]>> = {
  residueDuration: [1, 20], reactionCooldown: [.25, 15], criticalChance: [0, .3], criticalMultiplier: [1, 2],
  armorDivisor: [20, 200], minimumDamage: [1, 5], damageVariance: [0, .2], discoveryXp: [1, 100],
  repeatXp: [1, 10], discoveryKnowledge: [1, 25], battleMastery: [1, 30], hintCost: [1, 20],
  masteryPowerPerLevel: [0, .05], healthMultiplier: [1, 5], masterySpreadScale: [0, .5], xpPerLevel: [50, 500],
};
function balanceIssues(balance: unknown): string[] {
  const issues: string[] = [];
  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) return ['Invalid balance object.'];
  for (const [key, amount] of Object.entries(balance)) {
    const range = Object.hasOwn(bounds, key) ? bounds[key as keyof typeof BALANCE] : undefined;
    if (!range || typeof amount !== 'number' || !Number.isFinite(amount) || amount < range[0] || amount > range[1]) issues.push('Balance value outside supported bounds: ' + key);
  }
  return issues;
}
export function validateRelease(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !('pack' in value) || !('balance' in value)) return ['A release needs a content pack and a balance object.'];
  return [...validatePack(value.pack), ...balanceIssues(value.balance)];
}
export function applyRelease(release: ContentRelease) {
  const issues = balanceIssues(release.balance);
  if (issues.length) throw new Error(issues.join(' '));
  const marker = '+' + release.pack.id + '.' + release.pack.version;
  if (!CONTENT_VERSION.split('+').includes(marker.slice(1))) installContentPack(release.pack);
  Object.assign(BALANCE, release.balance);
}
