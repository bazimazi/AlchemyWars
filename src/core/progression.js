import { BALANCE, ELEMENTS, ELEMENT_BY_ID, REACTION_BY_ID, VESSELS, VESSEL_BY_ID, RELICS, RELIC_BY_ID, RESEARCH, ENCOUNTERS, ENCOUNTER_BY_ID } from '../data/content.js';
import { resolveExperiment, reactionEngine } from './reactions.js';

export function createPlayer() {
  return {
    version: 1, xp: 0, gold: 0, knowledge: 6,
    owned: ELEMENTS.filter(e => e.base).map(e => e.id), discoveries: [],
    mastery: {}, reactionUsage: {}, research: [], favorites: [], history: [],
    team: VESSELS.map(v => ({ vessel: v.id, elements: [...v.elements], relic: 'none', targeting: 'front', priority: 'reaction' })),
    campaign: [], claimedBattles: [], battles: 0, wins: 0, experiments: 0,
    hints: {}, settings: { sound: false, reducedMotion: false, largeText: false, leftHanded: false, debug: false },
    lastReplay: null,
  };
}

export const playerLevel = player => 1 + Math.floor(player.xp / BALANCE.xpPerLevel);
export const masteryLevel = (player, id) => Math.floor((player.mastery[id] ?? 0) / BALANCE.masteryThreshold);
export const unlockedRelics = player => RELICS.filter(r => !r.discoveries || r.discoveries <= player.discoveries.length);

function discover(player, rule) {
  if (player.discoveries.includes(rule.id)) return false;
  player.discoveries.push(rule.id);
  if (!player.owned.includes(rule.output)) player.owned.push(rule.output);
  player.xp += BALANCE.discoveryXp;
  player.knowledge += BALANCE.discoveryKnowledge;
  return true;
}

export function experiment(player, a, b, context = {}) {
  if (!player.owned.includes(a) || !player.owned.includes(b)) return { ok: false, error: 'Choose two elements from your collection.' };
  const rule = resolveExperiment(a, b, context);
  player.experiments++;
  const isNew = rule ? discover(player, rule) : false;
  for (const id of new Set([a, b])) player.mastery[id] = (player.mastery[id] ?? 0) + BALANCE.repeatXp;
  const entry = { inputs: [a, b], result: rule?.id ?? null, environment: context.environment ?? 'neutral', frozen: context.statuses?.includes('freeze') ?? false };
  player.history = [entry, ...player.history].slice(0, 12);
  return { ok: true, rule, isNew };
}

export function requestHint(player) {
  const rule = [...reactionEngine.byPair.values()].flat().find(r => !player.discoveries.includes(r.id) && r.inputs.every(id => player.owned.includes(id)));
  if (!rule) return { ok: false, error: 'Every accessible reaction is discovered. Explore your derived elements.' };
  if (player.knowledge < BALANCE.hintCost) return { ok: false, error: 'You need 2 knowledge. Discover a reaction or win a battle.' };
  player.knowledge -= BALANCE.hintCost;
  const stage = Math.min(3, (player.hints[rule.id] ?? 0) + 1);
  player.hints[rule.id] = stage;
  return { ok: true, text: stage === 1 ? rule.hint : stage === 2 ? 'Begin with ' + ELEMENT_BY_ID[rule.inputs[0]].name + '. ' + rule.hint : rule.inputs.map(id => ELEMENT_BY_ID[id].name).join(' + ') + (rule.conditions?.environment ? ' during rain.' : rule.conditions?.statuses ? ' against a frozen target.' : '.') };
}

export function updateLoadout(player, index, patch) {
  const slot = player.team[index];
  if (!slot) return false;
  if (patch.elements && (patch.elements.length !== 2 || patch.elements.some(id => !player.owned.includes(id)))) return false;
  if (patch.relic && !unlockedRelics(player).some(r => r.id === patch.relic)) return false;
  if (patch.targeting && !['front', 'weakest', 'reaction'].includes(patch.targeting)) return false;
  if (patch.priority && !['reaction', 'alternate', 'core'].includes(patch.priority)) return false;
  Object.assign(slot, patch);
  return true;
}

export function moveVessel(player, index, direction) {
  const next = index + direction;
  if (next < 0 || next >= player.team.length) return false;
  [player.team[index], player.team[next]] = [player.team[next], player.team[index]];
  return true;
}

export function buyResearch(player, id) {
  const entry = RESEARCH.find(r => r.id === id);
  if (!entry || player.research.includes(id) || player.knowledge < entry.cost) return false;
  player.knowledge -= entry.cost;
  player.research.push(id);
  return true;
}

export function encounterUnlocked(player, id) {
  const index = ENCOUNTERS.findIndex(e => e.id === id);
  return index === 0 || (index > 0 && player.campaign.includes(ENCOUNTERS[index - 1].id));
}

// Battle IDs are generated once at launch; replaying a report cannot mint a second reward.
export function claimBattle(player, battle, battleId) {
  if (!battleId || player.claimedBattles.includes(battleId)) return { claimed: false, discoveries: [] };
  const encounter = ENCOUNTER_BY_ID[battle.config.encounterId];
  if (!encounter || !encounterUnlocked(player, encounter.id)) return { claimed: false, discoveries: [] };
  player.claimedBattles.push(battleId);
  player.battles++;
  player.lastReplay = structuredClone(battle.config);
  const discoveries = [];
  for (const [id, uses] of Object.entries(battle.report.reactions)) {
    const rule = REACTION_BY_ID[id];
    if (!rule) continue;
    if (discover(player, rule)) discoveries.push(id);
    player.reactionUsage[id] = (player.reactionUsage[id] ?? 0) + uses;
  }
  for (const id of new Set(battle.config.team.flatMap(s => s.elements))) player.mastery[id] = (player.mastery[id] ?? 0) + BALANCE.battleMastery;
  if (battle.outcome === 'victory') {
    player.wins++;
    player.gold += encounter.gold;
    player.knowledge += encounter.knowledge;
    player.xp += encounter.xp;
    if (!player.campaign.includes(encounter.id)) player.campaign.push(encounter.id);
  }
  return { claimed: true, discoveries };
}

export function validateTeam(player) {
  return player.team.length === VESSELS.length && new Set(player.team.map(s => s.vessel)).size === VESSELS.length
    && player.team.every(s => VESSEL_BY_ID[s.vessel] && s.elements.length === 2 && s.elements.every(id => player.owned.includes(id)) && RELIC_BY_ID[s.relic]);
}
