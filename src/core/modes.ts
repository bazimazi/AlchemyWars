import type { Player, BattleResult, BattleConfig, Run, RunReward, Encounter } from '../types.js';
import { CONTENT_VERSION, ELEMENTS, ELEMENT_BY_ID, REACTIONS, ENEMIES, VESSELS } from '../data/content.js';
import { RUN_UPGRADES, MUTATORS, BOSS_AFFIXES } from '../data/systems.js';
import { seededRandom } from './combat.js';
import { resolveExperiment } from './reactions.js';
import { discover } from './progression.js';
import { mergeModifiers } from './modifiers.js';
import { refreshAchievements, track } from './meta.js';

const starters = ELEMENTS.filter(e => e.base && !e.unlockResearch).map(e => e.id);
export const RUN_MODES = ['roguelite', 'endless', 'infinite-alchemy', 'draft'];
function choose<T>(list: T[], random: () => number, count: number) {
  const pool = [...list], result = [];
  while (pool.length && result.length < count) result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return result;
}
export function rotation(now = Date.now()) {
  const dayNumber = Math.floor(now / 86_400_000), week = Math.floor((dayNumber + 3) / 7);
  const random = seededRandom(week);
  return { day: new Date(now).toISOString().slice(0, 10), week, season: new Date(now).toISOString().slice(0, 7), seasonName: ['Age of Storms', 'The Verdant Return', 'Echoes of the Eclipse'][Math.floor(dayNumber / 30) % 3], mutator: MUTATORS[1 + Math.floor(random() * (MUTATORS.length - 1))], puzzle: REACTIONS.filter(r => !r.conditions && r.inputs.every(id => starters.includes(id)))[dayNumber % 18] ?? REACTIONS[0], draft: choose(starters, seededRandom(dayNumber), 6) };
}
export function startRun(player: Player, mode: string, seed: number, elements: string[], now = Date.now()) {
  if (!RUN_MODES.includes(mode) || player.run && !['complete', 'defeat', 'retired'].includes(player.run.state)) return false;
  const pool = mode === 'draft' ? rotation(now).draft : starters;
  if (!Array.isArray(elements) || elements.length < 1 || elements.length > (mode === 'draft' ? 3 : 2) || new Set(elements).size !== elements.length || elements.some(id => !pool.includes(id))) return false;
  const run: Run = {
    mode, seed: seed >>> 0, floor: 1, state: 'battle', elements: [...elements], discoveries: [], upgrades: [], rewards: [],
    team: player.team.map((s, i) => ({ vessel: s.vessel, elements: [elements[i % elements.length], elements[(i + 1) % elements.length]], relic: 'none', targeting: 'front', priority: 'alternate', passive: 'none' })),
    health: [1, 1, 1, 1, 1], wins: 0, rewardClaimed: false, mutator: mode === 'infinite-alchemy' ? rotation(now).mutator.id : 'clear', period: rotation(now).week,
  };
  player.run = run; track(player, 'roguelite_started', { mode, seed }); return true;
}
export function runEncounter(run: Run): Encounter {
  const random = seededRandom(run.seed + run.floor * 733);
  const boss = run.floor % 4 === 0;
  const elite = run.floor % 4 === 3;
  const regular = ENEMIES.filter(e => !e.tags.includes('boss'));
  const bosses = ENEMIES.filter(e => e.tags.includes('boss'));
  const selected = boss ? [bosses[Math.floor(random() * bosses.length)].id] : choose(regular.map(e => e.id), random, elite ? 5 : 3);
  const infinite = ['endless', 'infinite-alchemy'].includes(run.mode);
  const affix = boss && infinite ? BOSS_AFFIXES[Math.floor(random() * BOSS_AFFIXES.length)] : null;
  const scale = boss ? .45 + run.floor * .018 : .5 + run.floor * .035;
  return { id: 'run-' + run.seed + '-' + run.floor, affix: affix?.id ?? null, name: (affix ? affix.name + ' ' : '') + (boss ? 'Guardian' : elite ? 'Elite' : 'Encounter') + ' · Floor ' + run.floor, region: 'The Unwritten Path', label: String(run.floor), environment: ['forest', 'rain', 'night', 'volcanic'][Math.floor(random() * 4)], description: 'A new configuration of the broken world.', tip: affix?.description ?? 'Your health carries between battles. Draft elements that keep your formation alive.', enemies: selected, scale: infinite ? scale * (1 + Math.max(0, run.floor - 8) * .04) : scale, boss, elite, gold: 0, knowledge: 0, xp: 0 };
}
export function runBattleConfig(player: Player): BattleConfig {
  const run = player.run;
  if (!run || run.state !== 'battle') throw new Error('Choose your reward before entering another encounter.');
  const encounter = runEncounter(run);
  return { contentVersion: CONTENT_VERSION, seed: (run.seed + run.floor * 1237) >>> 0, encounterId: encounter.id, encounter,
    team: structuredClone(run.team), research: [], mastery: {}, talents: [], evolution: {}, specializations: {}, startingHealth: [...run.health],
    modifiers: mergeModifiers(...run.upgrades.map(id => RUN_UPGRADES.find(u => u.id === id)?.modifiers), MUTATORS.find(m => m.id === run.mutator)?.modifiers),
  };
}
function rewardChoices(run: Run): RunReward[] {
  const random = seededRandom(run.seed + run.floor * 1777);
  const element = choose(starters.filter(id => !run.elements.includes(id)), random, 1)[0];
  const upgrades = choose(RUN_UPGRADES.filter(u => !run.upgrades.includes(u.id)), random, 2);
  return ([element ? { type: 'element', id: element } : { type: 'rest', id: 'rest' }, ...upgrades.map(u => ({ type: 'upgrade' as const, id: u.id })), { type: 'rest', id: 'rest' }] satisfies RunReward[]).filter((r, i, all) => all.findIndex(x => x.id === r.id) === i).slice(0, 3);
}
export function completeRunBattle(player: Player, battle: BattleResult) {
  const run = player.run;
  if (!run || run.state !== 'battle' || battle.config.encounterId !== runEncounter(run).id || battle.config.seed !== (run.seed + run.floor * 1237) >>> 0) return false;
  run.health = battle.final.units.filter(u => u.side === 'ally').slice(0, 5).map(u => u.hp / u.maxHp);
  for (const id of Object.keys(battle.report.reactions)) if (!run.discoveries.includes(id) && REACTIONS.some(r => r.id === id)) { run.discoveries.push(id); if (!run.elements.includes(id)) run.elements.push(id); }
  player.highestChain = Math.max(player.highestChain, battle.report.highestChain);
  if (battle.outcome !== 'victory') { run.state = 'defeat'; finalizeRun(player); return true; }
  run.wins++;
  if (['roguelite', 'draft'].includes(run.mode) && run.floor >= 8) { run.state = 'complete'; finalizeRun(player); }
  else { run.state = 'reward'; run.rewards = rewardChoices(run); }
  return true;
}
export function chooseRunReward(player: Player, index: number) {
  const run = player.run;
  if (!run || run.state !== 'reward' || !run.rewards[index]) return false;
  const choice = run.rewards[index];
  if (choice.type === 'element') run.elements.push(choice.id);
  if (choice.type === 'upgrade') run.upgrades.push(choice.id);
  if (choice.type === 'rest') run.health = run.health.map(h => Math.min(1, Math.max(.25, h) + .35));
  run.floor++; run.state = 'battle'; run.rewards = []; return true;
}
export function runExperiment(player: Player, a: string, b: string) {
  const run = player.run;
  if (!run || !['battle', 'reward'].includes(run.state) || !run.elements.includes(a) || !run.elements.includes(b)) return null;
  const rule = resolveExperiment(a, b, { environment: runEncounter(run).environment });
  if (rule) { if (!run.elements.includes(rule.output)) run.elements.push(rule.output); if (!run.discoveries.includes(rule.id)) run.discoveries.push(rule.id); }
  return rule;
}
export function updateRunTeam(player: Player, index: number, elements: string[]) {
  const run = player.run;
  if (!run || run.state !== 'battle' || !run.team[index] || !Array.isArray(elements) || elements.length !== 2 || elements.some(id => !run.elements.includes(id))) return false;
  run.team[index].elements = [...elements]; return true;
}
export function retireRun(player: Player) {
  if (!player.run || !['battle', 'reward'].includes(player.run.state)) return false;
  player.run.state = 'retired'; finalizeRun(player); return true;
}
function finalizeRun(player: Player) {
  const run = player.run;
  if (!run || run.rewardClaimed) return;
  run.rewardClaimed = true;
  player.gold += run.wins * 20; player.essence += run.wins * 5; player.knowledge += run.wins * 3; player.shards += Math.floor(run.wins / 2);
  if (run.state === 'complete') { player.runsWon++; player.xp += 100; }
  if (['endless', 'infinite-alchemy'].includes(run.mode)) player.endlessBest = Math.max(player.endlessBest, run.wins);
  for (const id of run.discoveries) discover(player, REACTIONS.find(r => r.id === id)!);
  track(player, 'roguelite_completed', { mode: run.mode, floor: run.floor, outcome: run.state });
  refreshAchievements(player);
}
export function claimDaily(player: Player, now = Date.now()) {
  const current = rotation(now), key = 'puzzle:' + current.day;
  if (player.dailyClaims.includes(key) || !player.discoveries.includes(current.puzzle.id)) return false;
  player.dailyClaims.push(key); player.gold += 35; player.knowledge += 5; return true;
}

export function normalizeRun(value: unknown): Run | null {
  const raw = value as Run;
  if (!raw || !RUN_MODES.includes(raw.mode) || !Number.isInteger(raw.seed) || !Number.isInteger(raw.floor) || raw.floor < 1 || raw.floor > 10000 || !['battle', 'reward', 'complete', 'defeat', 'retired'].includes(raw.state)) return null;
  if (!Array.isArray(raw.elements) || !raw.elements.length || raw.elements.some(id => !ELEMENT_BY_ID[id]) || !Array.isArray(raw.team) || raw.team.length !== 5 || raw.team.some(s => !s || !VESSELS.some(v => v.id === s.vessel) || !Array.isArray(s.elements) || s.elements.length !== 2 || s.elements.some(id => !raw.elements.includes(id)))) return null;
  if (!Array.isArray(raw.health) || raw.health.length !== 5 || raw.health.some(h => !Number.isFinite(h) || h < 0 || h > 1)) return null;
  const run = { ...structuredClone(raw), seed: raw.seed >>> 0, upgrades: [...new Set((raw.upgrades ?? []).filter(id => RUN_UPGRADES.some(u => u.id === id)))], discoveries: [...new Set((raw.discoveries ?? []).filter(id => REACTIONS.some(r => r.id === id)))], wins: Math.max(0, Math.min(raw.floor, Number(raw.wins) || 0)), rewardClaimed: raw.rewardClaimed === true, mutator: MUTATORS.some(m => m.id === raw.mutator) ? raw.mutator : 'clear' };
  if (new Set(raw.team.map(s => s.vessel)).size !== 5) return null;
  run.team = raw.team.map(s => ({ vessel: s.vessel, elements: [...s.elements], relic: 'none', passive: 'none', targeting: ['front', 'weakest', 'reaction'].includes(s.targeting) ? s.targeting : 'front', priority: ['alternate', 'reaction', 'core'].includes(s.priority) ? s.priority : 'alternate' }));
  run.rewards = run.state === 'reward' ? rewardChoices(run) : [];
  return run;
}
