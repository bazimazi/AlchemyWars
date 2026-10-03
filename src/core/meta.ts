import { abilitySlots, hasResearch } from './research.js';
import { validAbilities } from '../data/units.js';
import type { Player, MetaProgress, NumericModifier, Research, Quest } from '../types.js';
import { learningDefaults, discoveryGoalProgress } from './learning.js';
import { VESSELS, VESSEL_BY_ID, ELEMENT_BY_ID } from '../data/content.js';
import { TALENTS, EQUIPMENT, SPECIALIZATIONS, QUESTS, ACHIEVEMENTS, PASSIVES, COSMETICS } from '../data/systems.js';

export function metaDefaults(): MetaProgress {
  return { creatureKnowledge: {}, learning: learningDefaults(), vesselXp: {}, chains: [], creatures: [], activeDays: [new Date().toISOString().slice(0, 10)], createdAt: Date.now(), essence: 0, shards: 0, talents: [], equipment: [], evolution: {}, specializations: {}, quests: [], achievements: [], achievementClaims: [], reactionWins: {}, discoveryDates: {}, runsWon: 0, endlessBest: 0, run: null, loadouts: [], cosmetics: ['observatory'], theme: 'observatory', analytics: [{ name: 'tutorial_started', at: Date.now() }], dailyClaims: [], highestChain: 0 };
}
export function talentModifier(player: Player, key: NumericModifier) {
  return TALENTS.filter(t => player.talents?.includes(t.id)).reduce((sum, t) => sum + (t.modifiers[key] ?? 0), 0);
}
export function researchCost(player: Player, definition: Research) { return Math.ceil(definition.cost * (1 - talentModifier(player, 'researchDiscount'))); }
export function learnTalent(player: Player, id: string) {
  const talent = TALENTS.find(t => t.id === id);
  if (!talent || player.talents.includes(id) || player.knowledge < talent.cost || talent.requires && !player.talents.includes(talent.requires)) return false;
  player.knowledge -= talent.cost; player.talents.push(id); return true;
}
export function craftEquipment(player: Player, id: string) {
  const item = EQUIPMENT.find(e => e.id === id);
  if (!item || !hasResearch(player.research, item.requiresResearch) || player.equipment.includes(id) || player.gold < item.gold || player.essence < item.essence || player.shards < item.shards) return false;
  player.gold -= item.gold; player.essence -= item.essence; player.shards -= item.shards; player.equipment.push(id); return true;
}
export function equipItem(player: Player, index: number, id: string) {
  const unit = player.team[index], item = EQUIPMENT.find(e => e.id === id);
  if (!unit || !item || !player.equipment.includes(id)) return false;
  unit.equipment = { ...unit.equipment, [item.slot]: id }; return true;
}
export function evolutionCost(player: Player, id: string) {
  const level = player.evolution[id] ?? 0;
  return { gold: 60 * (level + 1), essence: 15 * (level + 1), mastery: 15 * (level + 1) };
}
export function evolveElement(player: Player, id: string) {
  if (!player.owned.includes(id) || (player.evolution[id] ?? 0) >= 3) return false;
  const cost = evolutionCost(player, id);
  if (player.gold < cost.gold || player.essence < cost.essence || (player.mastery[id] ?? 0) < cost.mastery) return false;
  player.gold -= cost.gold; player.essence -= cost.essence; player.evolution[id] = (player.evolution[id] ?? 0) + 1; return true;
}
export function specializeElement(player: Player, id: string, specialization: string) {
  if (!player.owned.includes(id) || !player.evolution[id] || !SPECIALIZATIONS.some(s => s.id === specialization && (!s.tags || s.tags.some(tag => ELEMENT_BY_ID[id].tags.includes(tag))))) return false;
  player.specializations[id] = specialization; return true;
}
export function availableVessels(player: Player) { return VESSELS.filter(v => !v.unlockWins || player.wins >= v.unlockWins); }
export function replaceVessel(player: Player, index: number, id: string) {
  if (!player.team[index] || !availableVessels(player).some(v => v.id === id) || player.team.some(s => s.vessel === id)) return false;
  player.team[index].vessel = id; return true;
}
export function equipPassive(player: Player, index: number, id: string) {
  const passive = PASSIVES.find(p => p.id === id);
  if (!player.team[index] || !passive || player.discoveries.length < (passive.unlockDiscoveries ?? 0)) return false;
  player.team[index].passive = id; return true;
}
export function questProgress(player: Player, quest: Quest) {
  if (quest.criteria) return discoveryGoalProgress(player, quest.criteria);
  if (quest.reaction) return player.discoveries.includes(quest.reaction) ? 1 : 0;
  const metric = quest.metric ? player[quest.metric] : 0; return Array.isArray(metric) ? metric.length : Number(metric) || 0;
}
export function claimQuest(player: Player, id: string) {
  const quest = QUESTS.find(q => q.id === id);
  if (!quest || player.quests.includes(id) || questProgress(player, quest) < quest.target) return false;
  player.quests.push(id); player.gold += quest.gold; player.knowledge += quest.knowledge; return true;
}
export function claimAchievement(player: Player, id: string) {
  const achievement = ACHIEVEMENTS.find(a => a.id === id);
  if (!achievement || player.achievementClaims.includes(id) || questProgress(player, achievement) < achievement.target) return false;
  if (!player.achievements.includes(id)) player.achievements.push(id);
  player.achievementClaims.push(id); player.gold += achievement.gold; player.knowledge += achievement.knowledge; return true;
}
export function refreshAchievements(player: Player) {
  if (player.learning.tutorial.length === 5 && !player.analytics.some(e => e.name === 'tutorial_completed')) track(player, 'tutorial_completed');
  for (const a of ACHIEVEMENTS) if (!player.achievements.includes(a.id) && questProgress(player, a) >= a.target) player.achievements.push(a.id);
}
export function saveLoadout(player: Player, name: string) {
  const title = String(name).trim().slice(0, 40);
  if (!title || player.loadouts.length >= 10) return false;
  player.loadouts.push({ name: title, team: structuredClone(player.team) }); return true;
}
export function applyLoadout(player: Player, index: number) {
  const loadout = player.loadouts[index];
  if (!loadout || loadout.team.length !== 5 || loadout.team.some(s => !VESSEL_BY_ID[s.vessel] || s.elements.some(id => !player.owned.includes(id)) || s.abilities !== undefined && !validAbilities(s.abilities, player.discoveries.length, abilitySlots(player.research), player.research))) return false;
  player.team = structuredClone(loadout.team); return true;
}
export function buyCosmetic(player: Player, id: string) {
  const cosmetic = COSMETICS.find(c => c.id === id);
  if (!cosmetic || (!player.cosmetics.includes(id) && player.gold < cosmetic.cost)) return false;
  if (!player.cosmetics.includes(id)) { player.gold -= cosmetic.cost; player.cosmetics.push(id); }
  player.theme = id; return true;
}
export function track(player: Player, name: string, data: Record<string, unknown> = {}, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (!player.activeDays.includes(day)) player.activeDays.push(day);
  player.activeDays = player.activeDays.slice(-366);
  player.analytics.push({ name, at: now, ...data });
  player.analytics = player.analytics.slice(-1000);
}
export function analyticsReport(player: Player) {
  const counts: Record<string, number> = {};
  for (const event of player.analytics) counts[event.name] = (counts[event.name] ?? 0) + 1;
  const discoveries = player.analytics.filter(e => e.name === 'reaction_discovered');
  const intervals = discoveries.slice(1).map((e, i) => (e.at - discoveries[i].at) / 1000);
  const firstBattle = player.analytics.find(e => ['battle_won', 'battle_lost'].includes(e.name));
  const sessions = [...new Set(player.analytics.map(e => new Date(e.at).toISOString().slice(0, 10)))];
  const visits: { start: number; end: number }[] = [];
  for (const event of player.analytics) { const visit = visits.at(-1); if (!visit || event.at - visit.end > 1800000) visits.push({ start: event.at, end: event.at }); else visit.end = Math.max(visit.end, event.at); }
  return { counts, sessions: visits.length, averageSessionSeconds: visits.length ? visits.reduce((n, v) => n + (v.end - v.start) / 1000, 0) / visits.length : 0, experimentsPerSession: (counts.experiment_attempted ?? 0) / Math.max(1, visits.length), discoveriesPerSession: discoveries.length / Math.max(1, visits.length), battlesPerSession: ((counts.battle_won ?? 0) + (counts.battle_lost ?? 0)) / Math.max(1, visits.length), activeDays: sessions.length, tutorialCompleted: player.learning.tutorial.length === 5, firstBattleSeconds: firstBattle ? Math.max(0, (firstBattle.at - player.createdAt) / 1000) : null, firstDiscoverySeconds: discoveries.length ? Math.max(0, (discoveries[0].at - player.createdAt) / 1000) : null, averageDiscoveryIntervalSeconds: intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null, uniqueCombatReactions: Object.keys(player.reactionUsage).length, failedExperiments: counts.experiment_failed ?? 0 };
}
