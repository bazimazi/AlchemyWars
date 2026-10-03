import { validAbilities } from '../data/units.js';
import { recordBattleCodex } from './codex.js';
import type { Player, ReactionDefinition, ReactionContext, BattleResult, Loadout } from '../types.js';
import { BALANCE, ELEMENTS, ELEMENT_BY_ID, REACTION_BY_ID, VESSELS, VESSEL_BY_ID, RELICS, RELIC_BY_ID, RESEARCH, ENCOUNTERS, ENCOUNTER_BY_ID } from '../data/content.js';
import { resolveExperiment, reactionEngine } from './reactions.js';
import { metaDefaults, talentModifier, researchCost, refreshAchievements, track } from './meta.js';

export function createPlayer(): Player {
  return {
    ...metaDefaults(),
    version: 1, xp: 0, gold: 0, knowledge: 6,
    owned: ELEMENTS.filter(e => e.base && !e.unlockResearch).map(e => e.id), discoveries: [],
    mastery: {}, reactionUsage: {}, research: [], favorites: [], history: [],
    team: VESSELS.slice(0, 5).map(v => ({ vessel: v.id, elements: [...v.elements], relic: 'none', targeting: 'front', priority: 'reaction' })),
    campaign: [], claimedBattles: [], battles: 0, wins: 0, experiments: 0,
    hints: {}, settings: { highContrast: false, haptics: false, sound: false, reducedMotion: false, largeText: false, leftHanded: false, debug: false },
    lastReplay: null,
  };
}

export const playerLevel = (player: Player) => 1 + Math.floor(player.xp / BALANCE.xpPerLevel);
export const masteryLevel = (player: Player, id: string) => Math.min(10, Math.floor((player.mastery[id] ?? 0) / BALANCE.masteryThreshold));
export const unlockedRelics = (player: Player) => RELICS.filter(r => !r.discoveries || r.discoveries <= player.discoveries.length);

export function discover(player: Player, rule: ReactionDefinition) {
  if (player.discoveries.includes(rule.id)) return false;
  player.discoveries.push(rule.id);
  if (!player.owned.includes(rule.output)) player.owned.push(rule.output);
  player.xp += BALANCE.discoveryXp;
  player.knowledge += BALANCE.discoveryKnowledge + talentModifier(player, 'discoveryKnowledge');
  player.discoveryDates[rule.id] = Date.now();
  track(player, 'reaction_discovered', { id: rule.id });
  track(player, 'element_discovered', { id: rule.output });
  return true;
}

export function experiment(player: Player, a: string, b: string, context: ReactionContext = {}) {
  if (!player.owned.includes(a) || !player.owned.includes(b)) return { ok: false, error: 'Choose two elements from your collection.' };
  const rule = resolveExperiment(a, b, { ...context, mastery: Object.fromEntries(Object.entries(player.mastery).map(([id, xp]) => [id, Math.floor(xp / BALANCE.masteryThreshold)])) });
  player.experiments++;
  track(player, 'experiment_attempted', { inputs: [a, b] });
  if (!rule) track(player, 'experiment_failed');
  const isNew = rule ? discover(player, rule) : false;
  for (const id of new Set([a, b])) player.mastery[id] = (player.mastery[id] ?? 0) + BALANCE.repeatXp;
  const entry = { inputs: [a, b], result: rule?.id ?? null, environment: context.environment ?? 'neutral', frozen: (Array.isArray(context.statuses) ? context.statuses : [...(context.statuses ?? [])]).includes('freeze') ?? false };
  player.history = [entry, ...player.history].slice(0, 12);
  refreshAchievements(player);
  return { ok: true, rule, isNew };
}

export function requestHint(player: Player) {
  const rule = [...reactionEngine.byPair.values()].flat().find(r => !player.discoveries.includes(r.id) && r.inputs.every(id => player.owned.includes(id)));
  if (!rule) return { ok: false, error: 'Every accessible reaction is discovered. Explore your derived elements.' };
  if (player.knowledge < BALANCE.hintCost) return { ok: false, error: 'You need 2 knowledge. Discover a reaction or win a battle.' };
  player.knowledge -= BALANCE.hintCost;
  const stage = Math.min(3, (player.hints[rule.id] ?? 0) + 1);
  player.hints[rule.id] = stage;
  track(player, 'hint_used', { id: rule.id, stage });
  return { ok: true, text: stage === 1 ? rule.hint : stage === 2 ? 'Begin with ' + ELEMENT_BY_ID[rule.inputs[0]].name + '. ' + rule.hint : rule.inputs.map(id => ELEMENT_BY_ID[id].name).join(' + ') + (rule.conditions?.environment ? ' in ' + rule.conditions.environment + '.' : rule.conditions?.statuses ? ' against a frozen target.' : '.') };
}

export function updateLoadout(player: Player, index: unknown, value: unknown) {
  const patch = value as Partial<Loadout>;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= player.team.length) return false;
  const slot = player.team[index];
  if (!slot || !patch || typeof patch !== 'object' || Array.isArray(patch) || Object.values(patch).some(v => v === null) || Object.keys(patch).some(key => !['elements', 'relic', 'targeting', 'priority', 'reactionPriority', 'abilities'].includes(key))) return false;
  if ('abilities' in patch && !validAbilities(patch.abilities, player.discoveries.length)) return false;
  if (patch.reactionPriority && (!Array.isArray(patch.reactionPriority) || patch.reactionPriority.length > 10 || patch.reactionPriority.some(id => !player.discoveries.includes(id)))) return false;
  if ('elements' in patch && (!Array.isArray(patch.elements) || patch.elements.length !== 2 || patch.elements.some(id => !player.owned.includes(id)))) return false;
  if ('relic' in patch && !unlockedRelics(player).some(r => r.id === patch.relic)) return false;
  if ('targeting' in patch && !['front', 'weakest', 'reaction'].includes(patch.targeting ?? "")) return false;
  if ('priority' in patch && !['reaction', 'alternate', 'core'].includes(patch.priority ?? "")) return false;
  Object.assign(slot, patch);
  return true;
}

export function moveVessel(player: Player, index: unknown, direction: number) {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= player.team.length || ![-1, 1].includes(direction)) return false;
  const next = index + direction;
  if (next < 0 || next >= player.team.length) return false;
  [player.team[index], player.team[next]] = [player.team[next], player.team[index]];
  return true;
}

export function buyResearch(player: Player, id: string) {
  const entry = RESEARCH.find(r => r.id === id);
  if (!entry || player.research.includes(id) || player.knowledge < researchCost(player, entry) || entry.requires?.some(id => !player.research.includes(id))) return false;
  player.knowledge -= researchCost(player, entry);
  player.research.push(id);
  if (entry.unlockElement && !player.owned.includes(entry.unlockElement)) player.owned.push(entry.unlockElement);
  return true;
}

export function encounterUnlocked(player: Player, id: string) {
  const index = ENCOUNTERS.findIndex(e => e.id === id);
  if (index >= 0 && ENCOUNTERS[index].prerequisite) return player.campaign.includes(ENCOUNTERS[index].prerequisite);
  return index === 0 || (index > 0 && player.campaign.includes(ENCOUNTERS[index - 1].id));
}

// Battle IDs are generated once at launch; replaying a report cannot mint a second reward.
export function claimBattle(player: Player, battle: BattleResult, battleId: string) {
  if (!battleId || player.claimedBattles.includes(battleId)) return { claimed: false, discoveries: [] };
  const encounter = ENCOUNTER_BY_ID[battle.config.encounterId];
  if (!encounter || !encounterUnlocked(player, encounter.id)) return { claimed: false, discoveries: [] };
  player.claimedBattles.push(battleId);
  player.battles++;
  for (const slot of battle.config.team) player.vesselXp[slot.vessel] = Math.min(450, (player.vesselXp[slot.vessel] ?? 0) + (battle.outcome === 'victory' ? 10 : 3));
  recordBattleCodex(player, battle);
  player.highestChain = Math.max(player.highestChain, battle.report.highestChain);
  track(player, battle.outcome === 'victory' ? 'battle_won' : 'battle_lost', { encounter: encounter.id, duration: battle.duration });
  player.lastReplay = structuredClone(battle.config);
  const discoveries = [];
  for (const [id, uses] of Object.entries(battle.report.reactions)) {
    const rule = REACTION_BY_ID[id];
    if (!rule) continue;
    if (discover(player, rule)) discoveries.push(id);
    player.reactionUsage[id] = (player.reactionUsage[id] ?? 0) + uses;
    player.mastery[rule.output] = (player.mastery[rule.output] ?? 0) + Math.min(5, uses);
  }
  for (const id of new Set(battle.config.team.flatMap(s => s.elements))) player.mastery[id] = (player.mastery[id] ?? 0) + BALANCE.battleMastery;
  if (battle.outcome === 'victory') {
    player.wins++;
    player.gold += encounter.gold;
    player.knowledge += encounter.knowledge;
    player.xp += encounter.xp;
    player.essence += 5 + talentModifier(player, 'battleEssence');
    player.shards += 1 + talentModifier(player, 'battleShards');
    for (const id of Object.keys(battle.report.reactions)) player.reactionWins[id] = (player.reactionWins[id] ?? 0) + 1;
    if (encounter.boss) track(player, 'boss_defeated', { encounter: encounter.id });
    if (!player.campaign.includes(encounter.id)) player.campaign.push(encounter.id);
    if (encounter.unlockElement && !player.owned.includes(encounter.unlockElement)) player.owned.push(encounter.unlockElement);
  }
  refreshAchievements(player);
  return { claimed: true, discoveries };
}

export function validateTeam(player: Player) {
  return player.team.length === 5 && new Set(player.team.map(s => s.vessel)).size === 5
    && player.team.every(s => VESSEL_BY_ID[s.vessel] && s.elements.length === 2 && s.elements.every(id => player.owned.includes(id)) && RELIC_BY_ID[s.relic]);
}
