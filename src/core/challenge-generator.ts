import type { Modifiers } from '../types.js';
import { ELEMENT_BY_ID, ENEMIES, REACTIONS } from '../data/content.js';
import { seededRandom } from './combat.js';

const restrictions: { name: string; modifiers: Modifiers }[] = [
  { name: 'No healing', modifiers: { healingMultiplier: 0 } },
  { name: 'Brief residues', modifiers: { durationMultiplier: .6 } },
  { name: 'Sheltered opening', modifiers: { startingShield: 40 } },
  { name: 'Long echoes', modifiers: { durationMultiplier: 1.4 } },
  { name: 'Branching reactions', modifiers: { chainDepth: 1, chainTargets: 1 } },
  { name: 'Unaltered laws', modifiers: {} },
];
/** Compose independent loan, rule, environment and enemy choices from a reproducible seed. */
export function composeChallenge(seed: number, options: { enemyCount?: number; scale?: number } = {}) {
  const count = options.enemyCount ?? 3, scale = options.scale ?? .7;
  if (!Number.isInteger(seed) || !Number.isInteger(count) || count < 1 || count > 5 || !Number.isFinite(scale) || scale < .2 || scale > 3) throw new Error('Invalid challenge composition options.');
  const random = seededRandom(seed), choose = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const pair = choose(REACTIONS.filter(r => !r.conditions && r.inputs.every(id => ELEMENT_BY_ID[id].base && !ELEMENT_BY_ID[id].unlockResearch)));
  // Healing-dependent loans never receive a rule that disables their primary effect.
  const healing = pair.effects.some(e => e.type === 'heal' || e.type === 'resurrect');
  const rule = choose(restrictions.filter(r => !healing || r.modifiers.healingMultiplier !== 0));
  const environment = choose(['neutral', 'rain', 'storm', 'night']);
  const pool = ENEMIES.filter(e => !e.tags.includes('boss'));
  const enemies = Array.from({ length: count }, () => choose(pool).id);
  return { elements: [...pair.inputs], modifiers: structuredClone(rule.modifiers), environment, enemies, scale,
    name: rule.name, description: 'Loaned ' + pair.inputs.map(id => ELEMENT_BY_ID[id].name).join(' and ') + ' formation in ' + environment + '. ' + rule.name + '. Defeat ' + count + ' enemies. Account upgrades and artifacts are disabled.' };
}
