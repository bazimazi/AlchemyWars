import type { Player, BattleResult } from '../types.js';
import { CONTENT_VERSION, ENEMIES, ENCOUNTERS } from '../data/content.js';
import { rotation } from './modes.js';
import { makeBattleConfig, seededRandom } from './combat.js';
import { track } from './meta.js';

export function challengeDefinition(kind = 'daily', now = Date.now()) {
  const current = rotation(now), day = Math.floor(now / 86400000), random = seededRandom(day);
  if (kind === 'daily') {
    const restrictions = [
      { name: 'No healing', modifiers: { healingMultiplier: 0 }, elements: ['fire', 'water'] },
      { name: 'A fleeting world', modifiers: { durationMultiplier: .5 }, elements: ['ice', 'wind'] },
      { name: 'The patient garden', modifiers: { tagPower: { toxic: 1.3 } }, elements: ['nature', 'poison'] },
      { name: 'Three relics at most', modifiers: {}, elements: ['light', 'shadow'] },
    ];
    const restriction = restrictions[day % restrictions.length], pool = ENEMIES.filter(e => !e.tags.includes('boss'));
    return { key: 'challenge:' + current.day, seed: day, name: 'Daily Trial · ' + restriction.name, description: 'Use the loaned formation with ' + restriction.elements.join(' and ') + '. ' + restriction.name + '. Same trial for every alchemist today.', elements: restriction.elements, modifiers: restriction.modifiers, enemies: Array.from({ length: 3 }, () => pool[Math.floor(random() * pool.length)].id), environment: 'neutral', scale: .7, gold: 40, knowledge: 6, essence: 8 };
  }
  const weekly = kind === 'weekly', bosses = ENEMIES.filter(e => e.tags.includes('boss'));
  const boss = bosses[(weekly ? current.week : new Date(now).getUTCMonth()) % bosses.length];
  return { key: (weekly ? 'weekly:' + current.week : 'festival:' + current.season), seed: weekly ? current.week : day - new Date(now).getUTCDate(), name: weekly ? 'Weekly Guardian · ' + boss.name : current.seasonName + ' · Celestial Festival', description: weekly ? 'Defeat a guardian under this week’s mutation: ' + current.mutator.description : 'The Observatory aligns with the stars. A guardian protects the celestial archive.', enemies: [boss.id], environment: weekly ? 'storm' : 'holy', scale: 1.1, modifiers: weekly ? current.mutator.modifiers : { tagPower: { cosmic: 1.3, radiant: 1.2 } }, gold: 100, knowledge: 15, essence: 20 };
}
export function challengeConfig(player: Player, kind: string, now = Date.now()) {
  if (!['daily', 'weekly', 'festival'].includes(kind)) throw new Error('Unknown trial.');
  const definition = challengeDefinition(kind, now), config = makeBattleConfig(player, ENCOUNTERS[0].id, definition.seed);
  if (definition.elements) config.team.forEach((slot, index) => { slot.elements = [...definition.elements]; if (index > 2) slot.relic = 'none'; });
  return { ...config, contentVersion: CONTENT_VERSION, encounterId: definition.key, challenge: { kind, key: definition.key }, encounter: { region: "Trials", label: kind, id: definition.key, ...definition, tip: definition.description, xp: 50 }, modifiers: definition.modifiers };
}
export function claimChallenge(player: Player, battle: BattleResult, now = Date.now()) {
  const marker = battle.config.challenge;
  if (!marker) return false;
  const definition = challengeDefinition(marker.kind, now);
  if (marker.key !== definition.key || battle.config.seed !== definition.seed || battle.outcome !== 'victory' || player.dailyClaims.includes(definition.key)) return false;
  player.dailyClaims.push(definition.key); player.gold += definition.gold; player.knowledge += definition.knowledge; player.essence += definition.essence; player.xp += 50;
  track(player, 'challenge_completed', { kind: marker.kind }); return true;
}
