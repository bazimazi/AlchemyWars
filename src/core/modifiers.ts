import type { Modifiers, NumericModifier } from '../types.js';
const numericKeys: NumericModifier[] = ['startingShield', 'chainDepth', 'chainTargets', 'healingMultiplier', 'durationMultiplier', 'enemyRegeneration', 'discoveryKnowledge', 'researchDiscount', 'battleEssence', 'battleShards'];
export function mergeModifiers(...sources: (Modifiers | undefined)[]): Modifiers {
  const result: Modifiers = {};
  for (const source of sources) {
    if (!source) continue;
    for (const key of numericKeys) {
      const value = source[key];
      if (typeof value === 'number') result[key] = key.endsWith('Multiplier') ? (result[key] ?? 1) * value : (result[key] ?? 0) + value;
    }
    if (source.disabledReactionTags) result.disabledReactionTags = [...new Set([...(result.disabledReactionTags ?? []), ...source.disabledReactionTags])];
    for (const key of ['tagPower', 'statusDuration'] as const) {
      if (!source[key]) continue;
      const target = result[key] ??= {};
      for (const [id, value] of Object.entries(source[key])) {
        if (['__proto__', 'constructor', 'prototype'].includes(id) || typeof value !== 'number') continue;
        target[id] = key === 'tagPower' ? (target[id] ?? 1) * value : (target[id] ?? 0) + value;
      }
    }
  }
  return result;
}
