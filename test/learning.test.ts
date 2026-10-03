import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, experiment, claimBattle, requestHint, updateLoadout } from '../src/core/progression.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { normalizeSave } from '../src/core/save.js';
import { executeCommand } from '../src/core/commands.js';
import { questProgress, specializeElement, track, claimAchievement } from '../src/core/meta.js';
import { dailyGoals, dailyGoalProgress, claimDailyGoal, recordBattleLearning, discoveryGoalProgress, hintText, experimentContext, contextFromConditions } from '../src/core/learning.js';
import { ELEMENT_BY_ID, REACTIONS, REACTION_BY_ID, RELICS } from '../src/data/content.js';
import { contentTemplate, validatePack } from '../src/core/content-tools.js';
import { QUESTS, ACHIEVEMENTS } from '../src/data/systems.js';

test('achievement rewards require progress, pay once and survive save normalization', () => {
  const player = createPlayer(), achievement = ACHIEVEMENTS.find(a => a.id === 'achievement-first-reaction')!;
  assert.equal(claimAchievement(player, achievement.id), false);
  experiment(player, 'fire', 'water'); const gold = player.gold;
  assert.equal(claimAchievement(player, achievement.id), true);
  assert.equal(player.gold, gold + achievement.gold);
  const restored = normalizeSave(player);
  assert.equal(claimAchievement(restored, achievement.id), false);
  executeCommand(restored, 'claim-all'); const paid = restored.gold;
  executeCommand(restored, 'claim-all'); assert.equal(restored.gold, paid);
});

test('artifacts cover every rarity with explicit synergies and reject invalid authored rarity', () => {
  assert.deepEqual([...new Set(RELICS.filter(r => r.id !== 'none').map(r => r.rarity))].sort(), ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'].sort());
  const lens = contentTemplate('relics');
  assert.ok(validatePack({ id: 'rarity-pack', version: 1, relics: [{ ...lens, rarity: 'Impossible' }] }).some(e => e.includes('rarity')));
  const { rarity: ignored, ...legacy } = lens; void ignored;
  assert.deepEqual(validatePack({ id: 'rarity-pack', version: 1, relics: [legacy] }), []);
  const player = createPlayer(); player.team.forEach(s => { s.elements = ['thunderstorm', 'thunderstorm']; });
  const config = makeBattleConfig(player, 'whispering-grove', 9);
  const withRelic = (id: string) => simulateBattle({ ...config, team: config.team.map(s => ({ ...s, relic: id })) });
  const rare = withRelic('storm-core'), mythic = withRelic('genesis-thread');
  // With no deeper causal path, an extra chain target helps this build more than extra chain depth.
  assert.ok(rare.duration < mythic.duration);
});

test('chain diversity remains available to quests after older catalog paths are pruned', () => {
  const player = createPlayer(), battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 7));
  battle.report.chains = [['thunderstorm', 'chain-lightning']]; recordBattleLearning(player, battle, day);
  const diversity = discoveryGoalProgress(player, { type: 'chain-elements' }); player.chains = [];
  assert.ok(diversity >= 4); assert.equal(discoveryGoalProgress(normalizeSave(player), { type: 'chain-elements' }), diversity);
});

const day = Date.UTC(2026, 9, 3, 12);

test('daily practice requires distinct successful pairings, persists, pays once and rolls over in UTC', () => {
  const player = createPlayer(), goal = dailyGoals(day);
  const rules = REACTIONS.filter(r => !r.conditions && r.inputs.includes(goal.practice) && r.inputs.every(id => player.owned.includes(id)));
  assert.ok(rules.length >= 2);
  experiment(player, ...rules[0].inputs, {}, day); experiment(player, ...rules[0].inputs, {}, day);
  assert.equal(dailyGoalProgress(player, 'practice', day), 1);
  assert.equal(claimDailyGoal(player, 'practice', day), false);
  experiment(player, ...rules[1].inputs, {}, day);
  const saved = normalizeSave(player), gold = saved.gold;
  assert.equal(claimDailyGoal(saved, 'practice', day), true);
  assert.equal(saved.gold, gold + 25);
  assert.equal(claimDailyGoal(saved, 'practice', day), false);
  assert.equal(dailyGoalProgress(saved, 'practice', day + 86400000), 0);
  assert.equal(claimDailyGoal(saved, 'practice', day + 86400000), false);
  assert.equal(saved.learning.daily.day, '2026-10-04');
  for (let i = 0; i < 30; i++) {
    const practice = dailyGoals(day + i * 86400000).practice;
    assert.ok(REACTIONS.filter(r => !r.conditions && r.inputs.includes(practice) && r.inputs.every(id => player.owned.includes(id))).length >= 2);
  }
});

test('learning counts actual elemental casts, ignores unused loadout elements and replayed claims', () => {
  const player = createPlayer(); player.team.forEach(s => { s.elements = ['fire', 'water']; s.priority = 'core'; });
  const battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 7));
  const casts = battle.events.filter(e => e.type === 'cast' && !e.name && e.source?.startsWith('ally-'));
  assert.equal(battle.report.elementCasts.fire, casts.length);
  assert.equal(battle.report.elementCasts.water, undefined);
  claimBattle(player, battle, 'learning-claim');
  const learning = structuredClone(player.learning);
  claimBattle(player, battle, 'learning-claim');
  assert.deepEqual(player.learning, learning);
  assert.equal(player.learning.elementWins.water, undefined);
  assert.deepEqual(normalizeSave(player).learning, learning);
  for (let i = 0; i < 1100; i++) track(player, 'noise');
  assert.deepEqual(normalizeSave(player).learning, learning);
});

test('daily victory and chain goals use winning casts and ordered causal paths', () => {
  const player = createPlayer(), goal = dailyGoals(day);
  const battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 7));
  battle.report.elementCasts = { [goal.victory]: 2 }; battle.report.chains = []; battle.report.highestChain = 8;
  battle.outcome = 'defeat'; recordBattleLearning(player, battle, day);
  assert.equal(dailyGoalProgress(player, 'victory', day), 0);
  assert.equal(dailyGoalProgress(player, 'chain', day), 0);
  battle.outcome = 'victory'; battle.report.chains = [['thunderstorm', 'chain-lightning']]; recordBattleLearning(player, battle, day);
  assert.equal(claimDailyGoal(player, 'victory', day), true);
  assert.equal(claimDailyGoal(player, 'chain', day), true);
  assert.equal(claimDailyGoal(player, 'chain', day), false);
});

test('discovery quests distinguish hints, elemental input, chain diversity and fresh victories', () => {
  const player = createPlayer();
  const hint = requestHint(player); assert.ok(hint.ok);
  const hinted = REACTION_BY_ID[Object.keys(player.hints)[0]];
  experiment(player, ...hinted.inputs, contextFromConditions(hinted.conditions), day);
  assert.equal(player.learning.unassisted.includes(hinted.id), false);
  experiment(player, 'fire', 'water', {}, day); experiment(player, 'water', 'lightning', {}, day);
  assert.ok(player.learning.unassisted.includes('conductive'));
  assert.equal(discoveryGoalProgress(player, { type: 'discovery-element', element: 'water' }), 2 + Number(hinted.inputs.includes('water') && !['steam', 'conductive'].includes(hinted.id)));
  player.chains.push({ reactions: ['thunderstorm', 'chain-lightning'], firstSeen: day });
  assert.ok(discoveryGoalProgress(player, { type: 'chain-elements' }) >= 4);
  const battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 7));
  battle.outcome = 'victory'; battle.report.reactions = { conductive: 1 };
  recordBattleLearning(player, battle, day);
  assert.ok(player.learning.freshWins.includes('conductive'));
  const stale = createPlayer(); stale.discoveryDates.conductive = day - 86400000;
  recordBattleLearning(stale, battle, day); assert.equal(stale.learning.freshWins.length, 0);
  for (const quest of QUESTS.filter(q => q.criteria)) assert.equal(questProgress(player, quest), discoveryGoalProgress(player, quest.criteria!));
});

test('guided first session persists and requires a new independent discovery after reflection', () => {
  const player = createPlayer();
  assert.equal(executeCommand(player, 'tutorial', { id: 'reflection' }), false);
  experiment(player, 'fire', 'water'); updateLoadout(player, 0, { elements: ['steam', 'fire'] });
  const battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 7)); claimBattle(player, battle, 'tutorial');
  assert.equal(executeCommand(player, 'tutorial', { id: 'reflection' }), true);
  experiment(player, 'fire', 'water'); assert.equal(player.learning.tutorial.includes('independent'), false);
  const next = REACTIONS.find(r => !r.conditions && !player.discoveries.includes(r.id) && r.inputs.every(id => player.owned.includes(id)))!;
  experiment(player, ...next.inputs);
  assert.equal(normalizeSave(player).learning.tutorial.length, 5);
  assert.ok(player.analytics.some(e => e.name === 'tutorial_completed'));
});

test('four-stage hints explain every condition and scenario preparation cannot forge mastery', () => {
  const player = createPlayer(); player.knowledge = 20;
  for (let i = 1; i <= 4; i++) { assert.ok(requestHint(player).ok); assert.equal(Object.values(player.hints)[0], i); }
  const knowledge = player.knowledge; assert.ok(requestHint(player).ok); assert.equal(player.knowledge, knowledge);
  const rule = { ...REACTION_BY_ID.steam, conditions: { environment: 'rain', statuses: ['burn'], healthBelow: .3, minimumEnemies: 3, requiredTags: ['heat'], shielded: true, mastery: { fire: 10 } } };
  assert.match(hintText(rule, 1), new RegExp(rule.hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const text = hintText(rule, 4);
  for (const word of ['rain', 'Burn', '30%', '3 enemies', 'heat', 'shielded', 'Fire mastery 10']) assert.ok(text.includes(word), word);
  const context = contextFromConditions(rule.conditions);
  assert.equal(context.mastery, undefined); assert.equal(context.healthRatio, .29);
  assert.deepEqual(experimentContext({ statuses: 'burn', tags: ['__proto__'], healthRatio: Infinity, enemyCount: NaN, mastery: { fire: 10 } }), { environment: 'neutral', statuses: [], tags: [] });
});

test('learning save migration bounds malformed values and restores complete experiment scenarios', () => {
  const player = createPlayer(); experiment(player, 'fire', 'water', { healthRatio: .2, enemyCount: 4, tags: ['heat'], shielded: true, statuses: ['burn'] });
  assert.deepEqual(normalizeSave(player).history[0].context, player.history[0].context);
  const raw: Record<string, unknown> = { ...structuredClone(player) }; delete raw.learning;
  assert.deepEqual(normalizeSave(raw).learning.unassisted, []);
  raw.learning = { unassisted: ['steam', 'made-up', 'steam'], freshWins: ['made-up'], elementCasts: { fire: Infinity, water: -4, unknown: 2 }, tutorial: ['reflection', 'unknown'], daily: { day: '2026-02-30', pairings: [], claims: [] } };
  const repaired = normalizeSave(raw).learning;
  assert.deepEqual(repaired.unassisted, ['steam']); assert.deepEqual(repaired.elementCasts, { fire: 0, water: 0 });
  assert.notEqual(repaired.daily.day, '2026-02-30');
});

test('behavior specializations validate elemental tags, execute effects and normalize away', () => {
  const player = createPlayer(); player.evolution.fire = 1; player.evolution.water = 1;
  assert.equal(specializeElement(player, 'water', 'ember'), false); assert.equal(specializeElement(player, 'fire', 'ember'), true);
  assert.ok(ELEMENT_BY_ID.fire.tags.includes('heat'));
  player.team.forEach(s => { s.elements = ['fire', 'fire']; });
  const config = makeBattleConfig(player, 'whispering-grove', 7), battle = simulateBattle(config);
  assert.ok(battle.events.some(e => e.type === 'specialization' && e.name === 'Ember'));
  assert.ok(battle.events.some(e => e.type === 'status' && e.status === 'burn' && e.stacks! > 1));
  assert.deepEqual(simulateBattle({ ...config, normalized: true }).events, simulateBattle({ ...config, specializations: {}, normalized: true }).events);
  specializeElement(player, 'fire', 'volcanic');
  const volcanic = simulateBattle(makeBattleConfig(player, 'whispering-grove', 7));
  const casts = volcanic.events.filter(e => e.type === 'specialization' && e.source === 'ally-0');
  assert.ok(casts.length); for (let i = 1; i < casts.length; i++) assert.ok(casts[i].time - casts[i - 1].time >= 6);
  assert.ok(volcanic.events.some(e => e.type === 'status' && e.status === 'root'));
});

test('Phoenix specialization revives a fallen ally through the shared effect primitive on kill', () => {
  const player = createPlayer(); player.evolution.fire = 1; specializeElement(player, 'fire', 'phoenix');
  player.team.forEach(s => { s.elements = ['fire', 'fire']; });
  const config = { ...makeBattleConfig(player, 'whispering-grove', 5), startingHealth: [0, 1, 1, 1, 1] };
  const ordinary = simulateBattle({ ...config, specializations: {} });
  assert.equal(ordinary.events.filter(e => e.type === 'resurrect').length, 0);
  const phoenix = simulateBattle(config);
  assert.ok(phoenix.events.some(e => e.type === 'resurrect' && e.target === 'ally-0'));
  assert.ok(phoenix.events.some(e => e.type === 'specialization' && e.trigger === 'OnKill' && e.name === 'Phoenix'));
});
