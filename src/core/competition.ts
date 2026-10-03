import type { Player, BattleConfig } from '../types.js';
import { ELEMENTS, CONTENT_VERSION } from '../data/content.js';
import { MUTATORS } from '../data/systems.js';
import { seededRandom } from './combat.js';
import { rotation } from './modes.js';
export const COMPETITIVE_MODES = ['element-wars', 'weekly-pvp'];
export function competitionRules(now = Date.now()) {
  const week = rotation(now).week, random = seededRandom(week * 917);
  const pool = ELEMENTS.filter(e => e.base && !e.unlockResearch).map(e => e.id);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const selected = MUTATORS[1 + week % (MUTATORS.length - 1)];
  const mutator = selected.id === 'renewal' ? { ...selected, description: 'Both formations begin with regeneration.' } : selected;
  return { week, pool: pool.slice(0, 6), elementPool: pool.slice(0, 4), mutator };
}
export function competitionConfig(player: Player, mode: string, choices: string[], seed: number, now = Date.now()): BattleConfig {
  const rules = competitionRules(now), wars = mode === 'element-wars', pool = wars ? rules.elementPool : rules.pool, count = wars ? 2 : 3;
  if (!COMPETITIVE_MODES.includes(mode) || !Array.isArray(choices) || choices.length !== count || new Set(choices).size !== count || choices.some(id => !pool.includes(id))) throw new Error('Choose ' + count + ' distinct elements from this competition pool.');
  const opposing = pool.filter(id => !choices.includes(id));
  const team = (elements: string[]) => player.team.map((s,i) => ({ vessel: s.vessel, elements: [elements[i % count], elements[(i + 1) % count]], relic: 'none', passive: 'none', targeting: 'reaction', priority: 'reaction' }));
  return { contentVersion: CONTENT_VERSION, seed, encounterId: mode, team: team(choices), opponentTeam: team(opposing), research: [], mastery: {}, normalized: true, modifiers: wars ? {} : rules.mutator.modifiers,
    encounter: { id: mode, name: wars ? 'Element Wars' : 'Weekly Crucible', region: 'Competition', label: String(rules.week), description: 'Equal vessels and complementary elemental pools.', tip: wars ? 'Two elements face the other two. Adapt to the weekly pool.' : rules.mutator.description, environment: 'neutral', enemies: [], gold: 0, knowledge: 0, xp: 0 } };
}
