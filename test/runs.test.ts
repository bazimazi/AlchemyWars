import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/core/progression.js';
import { simulateBattle } from '../src/core/combat.js';
import { startRun, runBattleConfig, runEncounter, runFloorMutator, completeRunBattle, chooseRunReward, updateRunTactics, updateRunScenario, runExperiment, normalizeRun, retireRun } from '../src/core/modes.js';
import { normalizeSave } from '../src/core/save.js';
import { normalizeReplay } from '../src/core/replay.js';
import { executeCommand } from '../src/core/commands.js';
import { RELICS } from '../src/data/content.js';
import { MUTATORS, PASSIVES, RUN_UPGRADES } from '../src/data/systems.js';
import { mergeModifiers } from '../src/core/modifiers.js';

function expedition(mode = 'roguelite', elements = ['light', 'shadow']) {
  const p = createPlayer(); assert.ok(startRun(p, mode, 42, elements, Date.UTC(2026, 9, 3))); return p;
}
function winFloor(p: ReturnType<typeof createPlayer>) {
  const battle = simulateBattle(runBattleConfig(p), { captureFrames: false });
  assert.equal(battle.outcome, 'victory'); assert.ok(completeRunBattle(p, battle)); return battle;
}

test('continuing victories offer reproducible element, tool and rest drafts', () => {
  const p = expedition(), account = structuredClone(p.team), types: string[] = [];
  for (let floor = 1; floor <= 3; floor++) {
    winFloor(p); const run = p.run!;
    assert.equal(run.rewards.length, 3); assert.equal(run.rewards[2].type, 'rest');
    assert.deepEqual(normalizeRun(run)!.rewards, run.rewards);
    assert.equal(chooseRunReward(p, -1), false); assert.equal(chooseRunReward(p, 3), false);
    const choice = run.rewards[1]; types.push(choice.type);
    assert.ok(chooseRunReward(p, 1)); assert.equal(chooseRunReward(p, 1), false);
    if (choice.type === 'relic') assert.ok(run.relics.includes(choice.id));
    if (choice.type === 'passive') assert.ok(run.passives.includes(choice.id));
    if (choice.type === 'upgrade') assert.ok(run.upgrades.includes(choice.id));
  }
  assert.deepEqual(types, ['relic', 'passive', 'upgrade']); assert.deepEqual(p.team, account);
});

test('rest heals and revives when every other run reward has been collected', () => {
  const p = expedition(), run = p.run!;
  run.elements = [...createPlayer().owned];
  run.upgrades = RUN_UPGRADES.map(u => u.id); run.relics = RELICS.filter(r => r.id !== 'none').map(r => r.id); run.passives = PASSIVES.filter(x => x.id !== 'none').map(x => x.id);
  run.state = 'reward'; run.health = [0, .1, .5, .9, 1];
  p.run = normalizeRun(run)!;
  assert.deepEqual(p.run.rewards, [{ type: 'rest', id: 'rest' }]);
  assert.ok(chooseRunReward(p, 0)); assert.deepEqual(p.run.health, [.6, .6, .85, 1, 1]); assert.equal(p.run.floor, 2);
});

test('run tactics reject unearned tools and invalid patches atomically', () => {
  const p = expedition(), before = structuredClone(p.run!.team);
  for (const patch of [{ relic: 'storm-core' }, { passive: 'last-light' }, { targeting: 'all' }, { priority: null }, { abilities: ['ward'] }, { equipment: { core: 'aegis-core' } }, { reactionPriority: ['missing'] }, { relic: 'none', passive: 'missing' }]) {
    assert.equal(executeCommand(p, 'run-tactics', { index: 0, patch }), false); assert.deepEqual(p.run!.team, before);
  }
  for (const index of [-1, 6, 1.5, '__proto__']) assert.equal(executeCommand(p, 'run-tactics', { index, patch: { relic: 'none' } }), false);
  p.run!.relics.push('world-seed'); p.run!.passives.push('first-ward');
  assert.ok(updateRunTactics(p, 0, { relic: 'world-seed', passive: 'first-ward', targeting: 'weakest', priority: 'reaction' }));
  p.run!.state = 'reward'; assert.equal(updateRunTactics(p, 0, { relic: 'none' }), false);
});

test('loaned relics and passives affect combat while account upgrades stay outside the run', () => {
  const p = expedition(); p.mastery.light = 300; p.research = ['warding']; p.talents = ['deep-binding']; p.vesselXp[p.team[0].vessel] = 450;
  p.run!.relics = ['world-seed']; p.run!.passives = ['first-ward'];
  updateRunTactics(p, 0, { relic: 'world-seed', passive: 'first-ward' });
  const config = runBattleConfig(p), battle = simulateBattle(config);
  assert.deepEqual(config.mastery, {}); assert.deepEqual(config.research, []); assert.deepEqual(config.talents, []); assert.equal(config.vesselXp, undefined);
  assert.equal(config.team[0].relic, 'world-seed'); assert.equal(config.team[0].passive, 'first-ward');
  assert.ok(battle.frames[0].units[0].statuses.some(s => s.id === 'barrier'));
  assert.equal(battle.frames[0].units[0].shield, 0); assert.ok(battle.report.healing > 0);
});

test('traveling laboratory models frozen targets and defers permanent discovery until retirement', () => {
  const p = expedition('roguelite', ['fire', 'water']);
  assert.ok(updateRunScenario(p, { statuses: ['freeze'], healthRatio: .25, enemyCount: 3, shielded: true, tags: ['heat'] }));
  assert.equal(runExperiment(p, 'fire', 'water')!.id, 'thermal-shock');
  assert.ok(p.run!.elements.includes('thermal-shock')); assert.ok(p.run!.discoveries.includes('thermal-shock'));
  assert.ok(!p.owned.includes('thermal-shock')); assert.ok(!p.discoveries.includes('thermal-shock'));
  assert.ok(retireRun(p)); assert.ok(p.owned.includes('thermal-shock')); assert.ok(p.discoveries.includes('thermal-shock'));
  const after = structuredClone(p); assert.equal(retireRun(p), false); assert.deepEqual(p, after);
  assert.equal(updateRunScenario(p, {}), false); assert.equal(runExperiment(p, 'fire', 'water'), null);
});

test('run scenarios cannot forge mastery, research or the floor environment', () => {
  const p = expedition('roguelite', ['fire', 'water']); p.research = ['reaction-science']; p.mastery.fire = 300;
  runExperiment(p, 'fire', 'water'); p.run!.elements.push('wind');
  assert.ok(executeCommand(p, 'run-scenario', { context: { research: ['reaction-science'], mastery: { fire: 10 }, environment: 'holy', statuses: ['missing', 'burn', 'burn'], healthRatio: -1, enemyCount: 100, tags: ['missing', 'heat'] } }));
  assert.equal(p.run!.context.environment, undefined);
  assert.deepEqual(p.run!.context, { statuses: ['burn'], healthRatio: 0, enemyCount: 10, tags: ['heat'] });
  assert.equal(runExperiment(p, 'steam', 'wind')!.id, 'storm-cloud');
  assert.ok(!p.run!.discoveries.includes('pressure-current'));
  assert.equal(updateRunScenario(p, []), false);
});

test('run scenarios do not alter the real battle target or health', () => {
  const p = expedition(), before = runBattleConfig(p);
  updateRunScenario(p, { healthRatio: 0, shielded: true, statuses: ['freeze'], enemyCount: 0 });
  assert.deepEqual(runBattleConfig(p), before);
});

test('traveling experiments honor suppressed rule tags and retain eligible alternate recipes', () => {
  const p = expedition('infinite-alchemy', ['fire', 'water']); p.run!.mutator = 'drought';
  assert.equal(runExperiment(p, 'fire', 'water'), null);
  assert.deepEqual(p.run!.discoveries, []);
  updateRunScenario(p, { statuses: ['freeze'] });
  assert.equal(runExperiment(p, 'fire', 'water')!.id, 'thermal-shock');
});

test('run reaction priorities require discovered recipes and survive normalization', () => {
  const p = expedition('roguelite', ['fire', 'water']); runExperiment(p, 'fire', 'water');
  assert.ok(updateRunTactics(p, 0, { reactionPriority: ['steam'] }));
  assert.equal(updateRunTactics(p, 0, { reactionPriority: ['steam', 'steam'] }), false);
  assert.deepEqual(normalizeSave(p).run!.team[0].reactionPriority, ['steam']);
});

test('run tools, target scenario and reward drafts survive reload', () => {
  const p = expedition(); p.run!.relics = ['world-seed']; p.run!.passives = ['first-ward'];
  updateRunTactics(p, 0, { relic: 'world-seed', passive: 'first-ward' }); updateRunScenario(p, { statuses: ['freeze'], shielded: true });
  assert.deepEqual(normalizeSave(p).run, p.run);
  winFloor(p); assert.deepEqual(normalizeSave(p).run, p.run);
});

test('old run saves gain empty tool collections and retain their floor, health and discoveries', () => {
  const p = expedition(); runExperiment(p, 'light', 'shadow');
  const { relics, passives, context, ...legacy } = p.run!;
  assert.ok(relics && passives && context);
  const restored = normalizeRun(legacy)!;
  assert.deepEqual(restored.relics, []); assert.deepEqual(restored.passives, []); assert.deepEqual(restored.context, { statuses: [], tags: [] });
  assert.equal(restored.floor, legacy.floor); assert.deepEqual(restored.health, legacy.health); assert.deepEqual(restored.discoveries, legacy.discoveries);
});

test('malformed loan collections and stale equipment are repaired without a crash', () => {
  const p = expedition(), raw = structuredClone(p.run!);
  raw.team[0].relic = 'genesis-thread'; raw.team[0].passive = 'first-ward'; raw.team[0].reactionPriority = ['missing'];
  const restored = normalizeRun({ ...raw, relics: 'not-an-array', passives: ['missing', 'first-ward', 'first-ward'], upgrades: {}, discoveries: null, context: 'bad' })!;
  assert.deepEqual(restored.relics, []); assert.deepEqual(restored.passives, ['first-ward']);
  assert.equal(restored.team[0].relic, 'none'); assert.equal(restored.team[0].passive, 'first-ward'); assert.deepEqual(restored.team[0].reactionPriority, []);
});

test('endless floor laws advance every three floors and never duplicate the expedition rule', () => {
  for (const mode of ['endless', 'infinite-alchemy']) {
    const p = expedition(mode), run = p.run!, initial = runFloorMutator(run);
    for (const floor of [2, 3]) { run.floor = floor; assert.equal(runFloorMutator(run).id, initial.id); }
    run.floor = 4; assert.notEqual(runFloorMutator(run).id, initial.id); assert.notEqual(runFloorMutator(run).id, run.mutator);
    assert.deepEqual(runFloorMutator(normalizeRun(run)!), runFloorMutator(run));
    const expected = mergeModifiers(MUTATORS.find(m => m.id === run.mutator)!.modifiers, runFloorMutator(run).modifiers);
    assert.deepEqual(runBattleConfig(p).modifiers, expected);
  }
  assert.equal(runFloorMutator(expedition().run!).id, 'clear');
});

test('launched endless rules and loaned equipment reconstruct identically from replay', () => {
  const p = expedition('infinite-alchemy'); p.run!.floor = 4; p.run!.relics = ['world-seed']; p.run!.passives = ['first-ward'];
  updateRunTactics(p, 0, { relic: 'world-seed', passive: 'first-ward' });
  const config = runBattleConfig(p), first = simulateBattle(config); p.lastReplay = config;
  p.run!.floor = 7;
  assert.notDeepEqual(runBattleConfig(p).modifiers, config.modifiers);
  for (const replay of [normalizeReplay(config)!, normalizeSave(p).lastReplay!]) {
    const second = simulateBattle(replay);
    for (const key of ['events', 'frames', 'report', 'final', 'outcome', 'duration'] as const) assert.deepEqual(second[key], first[key]);
  }
  assert.equal(runEncounter(p.run!).id, 'run-42-7');
});

test('retirement settles discoveries and resources once while leaving the account formation intact', () => {
  const p = expedition(), team = structuredClone(p.team), gold = p.gold;
  p.run!.relics = ['world-seed']; p.run!.passives = ['first-ward']; updateRunTactics(p, 0, { relic: 'world-seed', passive: 'first-ward' });
  winFloor(p); const learned = [...p.run!.discoveries]; assert.ok(retireRun(p));
  assert.equal(p.gold, gold + 20); assert.ok(learned.every(id => p.discoveries.includes(id))); assert.deepEqual(p.team, team);
  const restored = normalizeSave(p); assert.equal(retireRun(restored), false); assert.equal(restored.gold, p.gold);
});
