import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, buyResearch, experiment } from '../src/core/progression.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { craftEquipment, equipItem, evolveElement, specializeElement, learnTalent, claimQuest, saveLoadout, applyLoadout, replaceVessel, equipPassive, buyCosmetic } from '../src/core/meta.js';
import { startRun, runBattleConfig, completeRunBattle, chooseRunReward, retireRun, runExperiment, rotation, claimDaily } from '../src/core/modes.js';
import { parseSave, exportSave } from '../src/core/save.js';
import { ELEMENTS, REACTIONS, VESSELS, ENEMIES, ENCOUNTERS, STATUSES } from '../src/data/content.js';
import { conditionsMet } from '../src/core/reactions.js';

test('authored content meets MVP counts with bounded starting collection', () => {
  assert.equal(createPlayer().owned.length, 10);
  assert.ok(ELEMENTS.filter(e => e.base).length >= 20);
  assert.ok(REACTIONS.length >= 50); assert.ok(VESSELS.length >= 15);
  assert.ok(ENEMIES.filter(e => !e.tags.includes('boss')).length >= 20);
  assert.ok(ENEMIES.filter(e => e.tags.includes('boss')).length >= 5);
  assert.ok(Object.keys(STATUSES).length >= 20); assert.ok(ENCOUNTERS.length >= 60);
});
test('mastery unlocks special experiments and cannot be forged through laboratory context', () => {
  const player = createPlayer(); experiment(player, 'fire', 'wind');
  assert.equal(experiment(player, 'fire', 'firestorm', { mastery: { fire: 10 } }).rule, null);
  player.mastery.fire = 300;
  assert.equal(experiment(player, 'fire', 'firestorm').rule.id, 'inferno');
  player.team[0].elements = ['fire', 'earth'];
  const battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 42));
  assert.ok(battle.events.some(e => e.type === 'passive' && e.name === 'Mastery Echo'));
});
test('environment objects interact with elements and consume bounded charges', () => {
  const player = createPlayer(), battle = simulateBattle(makeBattleConfig(player, 'molten-throne', 1));
  const events = battle.events.filter(e => e.type === 'object');
  assert.ok(events.length > 0 && events.length <= 3);
  assert.equal(battle.final.object.charges, 0);
});
test('data conditions evaluate health, shield, tags and neighboring enemies', () => {
  const conditions = { healthBelow: .5, minimumEnemies: 2, requiredTags: ['cold'], shielded: true };
  const context = { healthRatio: .4, enemyCount: 3, tags: ['cold'], shielded: true };
  assert.ok(conditionsMet(conditions, context));
  assert.equal(conditionsMet(conditions, { ...context, healthRatio: .8 }), false);
  assert.equal(conditionsMet(conditions, { ...context, enemyCount: 1 }), false);
});
test('research unlocks advanced elements and survives save', () => {
  const p = createPlayer(); p.knowledge = 100;
  assert.equal(buyResearch(p, 'element-metal'), true);
  assert.ok(parseSave(exportSave(p)).owned.includes('metal'));
  assert.equal(experiment(p, 'metal', 'fire').rule.id, 'forge');
});
test('crafting, evolution and talents enforce resources and prerequisites', () => {
  const p = createPlayer(); assert.equal(craftEquipment(p, 'ember-focus'), false);
  p.gold = 500; p.essence = 100; p.shards = 10; p.knowledge = 100; p.mastery.fire = 100;
  assert.equal(craftEquipment(p, 'ember-focus'), true); assert.equal(craftEquipment(p, 'ember-focus'), false);
  assert.equal(equipItem(p, 0, 'ember-focus'), true);
  assert.equal(evolveElement(p, 'fire'), true); assert.equal(specializeElement(p, 'fire', 'enduring'), true);
  assert.equal(learnTalent(p, 'patient-scholar'), false); assert.equal(learnTalent(p, 'careful-notes'), true); assert.equal(learnTalent(p, 'patient-scholar'), true);
  assert.deepEqual(parseSave(exportSave(p)), p);
});
test('quests and cosmetics cannot be claimed for free repeatedly', () => {
  const p = createPlayer(); assert.equal(claimQuest(p, 'first-reaction'), false);
  experiment(p, 'fire', 'water'); assert.equal(claimQuest(p, 'first-reaction'), true); assert.equal(claimQuest(p, 'first-reaction'), false);
  assert.equal(buyCosmetic(p, 'moonlit'), false); p.gold = 300; assert.equal(buyCosmetic(p, 'moonlit'), true);
  assert.equal(p.gold, 50); assert.equal(buyCosmetic(p, 'moonlit'), true); assert.equal(p.gold, 50);
});
test('roster replacements, saved formations and passives are usable', () => {
  const p = createPlayer(); assert.equal(replaceVessel(p, 0, 'hawk'), false); p.wins = 2;
  assert.equal(saveLoadout(p, 'Original'), true); assert.equal(replaceVessel(p, 0, 'hawk'), true); assert.equal(applyLoadout(p, 0), true);
  assert.equal(p.team[0].vessel, 'golem'); assert.equal(equipPassive(p, 0, 'first-ward'), true);
  const battle = simulateBattle(makeBattleConfig(p, 'whispering-grove', 42));
  assert.ok(battle.events.some(e => e.type === 'passive' && e.name === 'First Ward'));
});
test('equipment and research affect actual combat', () => {
  const p = createPlayer(), plain = simulateBattle(makeBattleConfig(p, 'whispering-grove', 42));
  p.research.push('warding'); p.team[0].equipment = { core: 'aegis-core' };
  const upgraded = simulateBattle(makeBattleConfig(p, 'whispering-grove', 42));
  assert.equal(upgraded.frames[0].units[0].shield, 105); assert.notDeepEqual(plain.events, upgraded.events);
});
test('run starts with drafted elements, saves, and prevents overlapping runs', () => {
  const p = createPlayer(); assert.equal(startRun(p, 'roguelite', 42, ['fire', 'water']), true);
  assert.equal(startRun(p, 'roguelite', 43, ['fire']), false);
  assert.equal(runExperiment(p, 'fire', 'water').id, 'steam'); assert.ok(!p.owned.includes('steam'));
  assert.deepEqual(parseSave(exportSave(p)).run, p.run);
  assert.equal(retireRun(p), true); assert.ok(p.owned.includes('steam')); assert.equal(retireRun(p), false);
});
test('run encounter results are bound to the active floor and reward choice', () => {
  const p = createPlayer(); startRun(p, 'roguelite', 21, ['water', 'lightning']);
  const config = runBattleConfig(p), battle = simulateBattle(config);
  assert.equal(completeRunBattle(p, { ...battle, config: { ...config, seed: 22 } }), false);
  assert.equal(completeRunBattle(p, battle), true); assert.equal(completeRunBattle(p, battle), false);
  if (p.run.state === 'reward') {
    assert.throws(() => runBattleConfig(p), /reward/);
    assert.equal(chooseRunReward(p, 99), false); assert.equal(chooseRunReward(p, 0), true);
    assert.equal(p.run.floor, 2); assert.equal(chooseRunReward(p, 0), false);
  }
});
test('daily rotation is deterministic and claims are idempotent', () => {
  const now = Date.UTC(2026, 9, 1), p = createPlayer(), current = rotation(now);
  assert.deepEqual(current, rotation(now + 3000)); assert.notEqual(current.day, rotation(now + 86400000).day);
  assert.equal(claimDaily(p, now), false); experiment(p, ...current.puzzle.inputs);
  assert.equal(claimDaily(p, now), true); assert.equal(claimDaily(p, now), false);
});
test('normalized PvP ignores mastery, evolution and account research', () => {
  const p = createPlayer(), config = { ...makeBattleConfig(p, 'whispering-grove', 42), normalized: true, opponentTeam: structuredClone(p.team) };
  const a = simulateBattle(config); config.mastery.fire = 10000; config.research = ['warding', 'resonance']; config.evolution.fire = 3;
  const b = simulateBattle(config); assert.deepEqual(a.events, b.events);
});
