import { DISCOVERY_REWARDS } from '../data/systems.js';
import type { Player, LearningProgress, BattleResult, ReactionDefinition, Conditions, QuestCriteria, ReactionContext } from '../types.js';
import { RESEARCH, ELEMENTS, ELEMENT_BY_ID, ENEMY_BY_ID, REACTION_BY_ID, STATUSES } from '../data/content.js';
import { formationKey, TESTED_BUILD_LIMIT } from './formations.js';

export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const TUTORIAL_STEPS = ['discovery', 'formation', 'battle', 'reflection', 'independent'] as const;
export function learningDefaults(now = Date.now()): LearningProgress {
  return { unassisted: [], freshWins: [], elementCasts: {}, elementWins: {}, tutorial: [], chainElements: 0, longestChain: 0, testedBuilds: [], firelessWins: 0, poisonBossWins: 0, daily: { day: utcDay(now), pairings: [], won: false, longestChain: 0, claims: [] } };
}
export function dailyGoals(now = Date.now()) {
  const day = Math.floor(now / 86400000), pool = ELEMENTS.filter(e => e.base && !e.unlockResearch);
  const practice = pool[day % pool.length].id, victory = pool[(day * 7 + 3) % pool.length].id;
  return { day: utcDay(now), practice, victory, goals: [
    { id: 'practice', name: 'Follow an elemental thread', description: 'Perform two distinct stable pairings involving ' + ELEMENT_BY_ID[practice].name + '.', target: 2 },
    { id: 'victory', name: 'A theory in the field', description: 'Win a battle in which ' + ELEMENT_BY_ID[victory].name + ' is actually cast.', target: 1 },
    { id: 'chain', name: 'One reaction leads to another', description: 'Trigger two successive reactions in one combat action.', target: 2 },
  ] };
}
function currentDaily(player: Player, now: number) {
  const day = utcDay(now);
  if (player.learning.daily.day !== day) player.learning.daily = learningDefaults(now).daily;
  return player.learning.daily;
}
export function recordExperimentLearning(player: Player, rule: ReactionDefinition | null, now = Date.now()) {
  if (!rule) return;
  const daily = currentDaily(player, now), pair = [...rule.inputs].sort().join('+');
  if (rule.inputs.includes(dailyGoals(now).practice) && !daily.pairings.includes(pair)) daily.pairings.push(pair);
}
export function recordBattleLearning(player: Player, battle: BattleResult, now = Date.now()) {
  const daily = currentDaily(player, now), rules = dailyGoals(now);
  const acted = Object.entries(battle.report.units).some(([id, u]) => id.startsWith('ally-') && u.elementCasts + u.abilityCasts > 0);
  if (acted && battle.config.team.length === 5 && player.learning.testedBuilds.length < TESTED_BUILD_LIMIT) {
    const team = battle.config.normalized ? battle.config.team.map(s => ({ ...s, abilities: (s.abilities ?? []).slice(0, 2) })) : battle.config.team;
    const key = formationKey(team);
    if (!player.learning.testedBuilds.includes(key)) player.learning.testedBuilds.push(key);
  }
  if (acted && battle.outcome === 'victory') {
    const fireUsed = battle.config.team.some(s => s.elements.includes('fire')) || (battle.report.elementCasts.fire ?? 0) > 0 || (battle.report.damageByElement.fire ?? 0) > 0
      || Object.keys(battle.report.reactions).some(id => REACTION_BY_ID[id]?.inputs.includes('fire') || REACTION_BY_ID[id]?.output === 'fire');
    if (!fireUsed) player.learning.firelessWins++;
    if (battle.final.units.some(u => u.side === 'enemy' && u.hp === 0 && ENEMY_BY_ID[u.definitionId]?.tags.includes('boss') && (battle.report.statusDamage[u.id]?.poison ?? 0) > 0)) player.learning.poisonBossWins++;
  }
  for (const [element, count] of Object.entries(battle.report.elementCasts)) {
    player.learning.elementCasts[element] = (player.learning.elementCasts[element] ?? 0) + count;
    if (battle.outcome === 'victory') {
      player.learning.elementWins[element] = (player.learning.elementWins[element] ?? 0) + 1;
      if (element === rules.victory) daily.won = true;
    }
  }
  player.learning.chainElements = Math.max(player.learning.chainElements, ...battle.report.chains.map(path => new Set(path.flatMap(id => [...REACTION_BY_ID[id].inputs, REACTION_BY_ID[id].output])).size), 0);
  player.learning.longestChain = Math.max(player.learning.longestChain, battle.report.highestAllyChain);
  daily.longestChain = Math.max(daily.longestChain, battle.report.highestAllyChain);
  if (battle.outcome === 'victory') for (const id of Object.keys(battle.report.reactions)) {
    if (Math.floor((player.discoveryDates[id] ?? -1) / 86400000) === Math.floor(now / 86400000) && !player.learning.freshWins.includes(id)) player.learning.freshWins.push(id);
  }
  markTutorial(player, 'battle');
}
export function dailyGoalProgress(player: Player, id: string, now = Date.now()) {
  const daily = player.learning.daily;
  if (daily.day !== utcDay(now)) return 0;
  return id === 'practice' ? daily.pairings.length : id === 'victory' ? Number(daily.won) : id === 'chain' ? daily.longestChain : 0;
}
export function claimDailyGoal(player: Player, id: string, now = Date.now()) {
  const definition = dailyGoals(now).goals.find(g => g.id === id), daily = currentDaily(player, now);
  if (!definition || daily.claims.includes(id) || dailyGoalProgress(player, id, now) < definition.target) return false;
  daily.claims.push(id);
  const reward = DISCOVERY_REWARDS.dailyGoal; player.gold += reward.gold; player.knowledge += reward.knowledge; player.essence += reward.essence; return true;
}
export function discoveryGoalProgress(player: Player, criteria: QuestCriteria) {
  switch (criteria.type) {
    case 'discovery-element': return player.discoveries.filter(id => REACTION_BY_ID[id].inputs.includes(criteria.element)).length;
    case 'discovery-tag': return player.discoveries.filter(id => REACTION_BY_ID[id].tags.includes(criteria.tag)).length;
    case 'unassisted': return player.learning.unassisted.length;
    case 'fresh-victory': return player.learning.freshWins.length;
    case 'element-victories': return player.learning.elementWins[criteria.element] ?? 0;
    case 'chain-elements': return Math.max(player.learning.chainElements, ...player.chains.map(c => new Set(c.reactions.flatMap(id => [...REACTION_BY_ID[id].inputs, REACTION_BY_ID[id].output])).size));
    case 'secret-discoveries': return player.discoveries.filter(id => REACTION_BY_ID[id].secret).length;
    case 'legendary-discoveries': return player.discoveries.filter(id => ['Legendary', 'Mythic'].includes(REACTION_BY_ID[id].rarity)).length;
    case 'fireless-victories': return player.learning.firelessWins;
    case 'poison-boss-victories': return player.learning.poisonBossWins;
    case 'longest-chain': return player.learning.longestChain;
    case 'tested-builds': return player.learning.testedBuilds.length;
  }
}
export function markTutorial(player: Player, step: string) {
  if (!(TUTORIAL_STEPS as readonly string[]).includes(step) || player.learning.tutorial.includes(step)) return false;
  player.learning.tutorial.push(step); return true;
}
export function conditionText(conditions: Conditions = {}) {
  const parts: string[] = [];
  if (conditions.environment) parts.push('atmosphere: ' + conditions.environment);
  if (conditions.statuses?.length) parts.push('target statuses: ' + conditions.statuses.map(id => STATUSES[id]?.name ?? id).join(', '));
  if (conditions.healthBelow !== undefined) parts.push('target health below ' + Math.round(conditions.healthBelow * 100) + '%');
  if (conditions.minimumEnemies !== undefined) parts.push('at least ' + conditions.minimumEnemies + ' enemies');
  if (conditions.requiredTags?.length) parts.push('target tags: ' + conditions.requiredTags.join(', '));
  if (conditions.shielded !== undefined) parts.push(conditions.shielded ? 'a shielded target' : 'an unshielded target');
  if (conditions.research?.length) parts.push('research: ' + conditions.research.map(id => RESEARCH.find(r => r.id === id)?.name ?? id).join(', '));
  if (conditions.mastery) parts.push(...Object.entries(conditions.mastery).map(([id, level]) => ELEMENT_BY_ID[id].name + ' mastery ' + level));
  return parts.length ? parts.join('; ') : 'no special conditions';
}
export function hintText(rule: ReactionDefinition, stage: number) {
  if (stage <= 1) return rule.hint;
  if (stage === 2) return 'Begin with ' + ELEMENT_BY_ID[rule.inputs[0]].name + '. ' + rule.hint;
  if (stage === 3) return 'The other ingredient is ' + ELEMENT_BY_ID[rule.inputs[1]].name + '. Consider: ' + conditionText(rule.conditions) + '.';
  return rule.inputs.map(id => ELEMENT_BY_ID[id].name).join(' + ') + ' → ' + rule.name + '. Requires ' + conditionText(rule.conditions) + '.';
}

// Laboratory scenarios never override the account's mastery or research.
export function experimentContext(value: unknown): ReactionContext {
  const raw = value as ReactionContext | null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const statuses = raw.statuses instanceof Set ? [...raw.statuses] : raw.statuses;
  return {
    environment: ['neutral', 'rain', 'storm', 'holy', 'night'].includes(raw.environment ?? '') ? raw.environment : 'neutral',
    statuses: Array.isArray(statuses) ? [...new Set(statuses.filter(id => typeof id === 'string' && Object.hasOwn(STATUSES, id)))].slice(0, 30) : [],
    ...(typeof raw.healthRatio === 'number' && Number.isFinite(raw.healthRatio) ? { healthRatio: Math.max(0, Math.min(1, raw.healthRatio)) } : {}),
    ...(typeof raw.enemyCount === 'number' && Number.isFinite(raw.enemyCount) ? { enemyCount: Math.max(0, Math.min(10, Math.floor(raw.enemyCount))) } : {}),
    ...(typeof raw.shielded === 'boolean' ? { shielded: raw.shielded } : {}),
    tags: Array.isArray(raw.tags) ? [...new Set(raw.tags.filter(tag => typeof tag === 'string' && ELEMENTS.some(e => e.tags.includes(tag))))].slice(0, 30) : [],
  };
}
export function contextFromConditions(conditions: Conditions = {}): ReactionContext {
  return experimentContext({ environment: conditions.environment, statuses: conditions.statuses,
    healthRatio: conditions.healthBelow === undefined ? undefined : Math.max(0, conditions.healthBelow - .01),
    enemyCount: conditions.minimumEnemies, shielded: conditions.shielded, tags: conditions.requiredTags });
}
