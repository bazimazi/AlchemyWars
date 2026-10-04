import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, buyResearch, claimBattle, hintCost, requestHint, uncoverFieldClue, experiment } from '../src/core/progression.js';
import { learnTalent, researchCost, craftEquipment } from '../src/core/meta.js';
import { executeCommand } from '../src/core/commands.js';
import { normalizeTalents, talentPerk, craftCost } from '../src/core/talents.js';
import { experimentCapacity, saveExperimentNote, replaceExperimentNote, deleteExperimentNote } from '../src/core/notebook.js';
import { normalizeSave } from '../src/core/save.js';
import { normalizeReplay } from '../src/core/replay.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { startRun, runBattleConfig } from '../src/core/modes.js';
import { TALENTS, TALENT_BRANCHES, EQUIPMENT } from '../src/data/systems.js';
import { RESEARCH, ENCOUNTERS, ELEMENTS, REACTIONS } from '../src/data/content.js';
import type { Player } from '../src/types.js';
import { validateTalentTree } from '../src/data/talent-rules.js';

test('content validation rejects cyclic talent paths, unknown prerequisites and broken perk costs', () => {
  assert.deepEqual(validateTalentTree(TALENTS), []);
  const nodes = structuredClone(TALENTS); nodes[0].requires = nodes[1].id;
  assert.ok(validateTalentTree(nodes).some(issue => issue.includes('cycle')));
  nodes[0].requires = 'missing'; nodes[0].cost = -1; nodes[0].perks = { fieldClueChance: 2 };
  const issues = validateTalentTree(nodes); assert.ok(issues.some(issue => issue.includes('prerequisite'))); assert.ok(issues.some(issue => issue.includes('cost'))); assert.ok(issues.some(issue => issue.includes('perk')));
});

function learn(player: Player, id: string) {
  const node = TALENTS.find(t => t.id === id)!;
  if (node.requires && !player.talents.includes(node.requires)) learn(player, node.requires);
  player.knowledge += node.cost; assert.equal(learnTalent(player, id), true);
}
function winningPlayer() {
  const p = createPlayer(); p.team.forEach(s => { s.elements = ['light', 'shadow']; p.vesselXp[s.vessel] = 450; });
  p.mastery.light = 300; p.mastery.shadow = 300; return p;
}

test('six three-node branches can be learned only along their prerequisite paths', () => {
  for (const branch of TALENT_BRANCHES) assert.equal(TALENTS.filter(t => t.branch === branch).length, 3);
  const p = createPlayer(); p.knowledge = 10000;
  for (const node of TALENTS.filter(t => t.requires)) { const before = p.knowledge; assert.equal(learnTalent(p, node.id), false); assert.equal(p.knowledge, before); }
  for (const node of TALENTS) { const before = p.knowledge; assert.equal(learnTalent(p, node.id), true); assert.equal(before - p.knowledge, node.cost); assert.equal(learnTalent(p, node.id), false); }
  assert.equal(p.talents.length, 18); assert.equal(learnTalent(p, '__proto__'), false);
});

test('talent migration accepts out-of-order paths and discards orphaned, duplicate and unknown nodes', () => {
  assert.deepEqual(normalizeTalents(['reactive-ward', 'deep-binding', 'reaction-conduit', 'deep-binding', '__proto__']), ['deep-binding', 'reaction-conduit', 'reactive-ward']);
  assert.deepEqual(normalizeTalents(['recursive-binding', 'patient-scholar', 'unknown']), []);
  for (const value of [null, {}, 'deep-binding', 12]) assert.deepEqual(normalizeTalents(value), []);
  const p = createPlayer(); p.talents = ['reactive-ward', 'deep-binding', 'patient-scholar'];
  assert.deepEqual(normalizeSave(p).talents, ['deep-binding']);
  const config = makeBattleConfig(p, ENCOUNTERS[0].id, 42); assert.deepEqual(normalizeReplay(config)!.talents, ['deep-binding']);
});

test('focused study charges the rounded shared discount and applied research pays once for a new study', () => {
  const p = createPlayer(); learn(p, 'applied-research'); p.knowledge = 1000;
  for (const study of RESEARCH) {
    assert.equal(researchCost(p, study), Math.ceil(study.cost * .7));
    const before = p.essence, cost = researchCost(p, study), knowledge = p.knowledge;
    assert.equal(buyResearch(p, study.id), true); assert.equal(p.essence - before, 3); assert.equal(knowledge - p.knowledge, cost);
    assert.equal(buyResearch(p, study.id), false); assert.equal(p.essence - before, 3);
  }
});

test('learning applied research gives no retroactive essence and failed research spends nothing', () => {
  const p = createPlayer(); p.knowledge = 100; assert.equal(buyResearch(p, 'warding'), true);
  learn(p, 'applied-research'); assert.equal(p.essence, 0); assert.equal(buyResearch(p, 'warding'), false);
  p.knowledge = 0; const before = structuredClone(p);
  assert.equal(buyResearch(p, 'tactical-memory'), false); assert.deepEqual(p, before);
});

test('craft discounts use exact rounded costs, retain shards and respect blueprint locks', () => {
  const p = createPlayer(); learn(p, 'material-steward'); const item = EQUIPMENT.find(e => e.id === 'ember-focus')!;
  const cost = craftCost(p, item); assert.deepEqual(cost, { gold: 60, essence: 8, shards: 1 });
  Object.assign(p, { ...cost, gold: cost.gold - 1 }); const before = structuredClone(p);
  assert.equal(craftEquipment(p, item.id), false); assert.deepEqual(p, before);
  p.gold++; assert.equal(craftEquipment(p, item.id), true); assert.deepEqual([p.gold, p.essence, p.shards], [0, 0, 0]);
  assert.equal(craftEquipment(p, item.id), false);
  p.gold = p.essence = p.shards = 1000; const locked = structuredClone(p);
  assert.equal(craftEquipment(p, 'echo-catalyst'), false); assert.deepEqual(p, locked);
});

test('gentle guidance changes actual hint cost and failure text without revealing further stages', () => {
  const p = createPlayer(); assert.equal(hintCost(p), 2); learn(p, 'gentle-guidance'); assert.equal(hintCost(p), 1);
  p.knowledge = 0; assert.match(requestHint(p).error!, /1 knowledge/); assert.equal(Object.keys(p.hints).length, 0);
  p.knowledge = 4;
  for (let stage = 1; stage <= 4; stage++) { assert.equal(requestHint(p).ok, true); assert.equal(p.knowledge, 4 - stage); assert.deepEqual(Object.values(p.hints), [stage]); }
  assert.equal(requestHint(p).ok, true); assert.equal(p.knowledge, 0);
});

test('field clues are seeded, free and restricted to accessible unknown unhinted reactions', () => {
  const p = createPlayer(); learn(p, 'field-clues'); const original = structuredClone(p);
  let successes = 0;
  for (let seed = 0; seed < 100; seed++) {
    const a = structuredClone(original), b = structuredClone(original);
    assert.equal(uncoverFieldClue(a, seed), uncoverFieldClue(b, seed)); assert.deepEqual(a.hints, b.hints);
    assert.equal(a.knowledge, original.knowledge); assert.equal(a.discoveries.length, 0);
    for (const id of Object.keys(a.hints)) { const r = REACTIONS.find(r => r.id === id)!; assert.ok(r.inputs.every(id => original.owned.includes(id))); assert.equal(r.conditions?.research, undefined); assert.equal(a.hints[id], 1); successes++; }
  }
  assert.ok(successes > 15 && successes < 55);
  const complete = structuredClone(original); complete.discoveries = REACTIONS.map(r => r.id);
  assert.equal(uncoverFieldClue(complete, 0), undefined);
  assert.equal(uncoverFieldClue(createPlayer(), 0), undefined);
});

test('first-clear exploration rewards and field clues cannot repeat for retries or replay claims', () => {
  const p = winningPlayer(); learn(p, 'guardian-bounty'); learn(p, 'field-clues');
  const encounter = ENCOUNTERS[0];
  const seed = Array.from({ length: 100 }, (_, i) => i).find(seed => uncoverFieldClue(structuredClone(p), seed))!;
  const battle = simulateBattle(makeBattleConfig(p, encounter.id, seed)); assert.equal(battle.outcome, 'victory');
  const first = claimBattle(p, battle, 'first'); assert.equal(first.rewards!.knowledge, encounter.knowledge + 3); assert.ok(first.clue);
  const hints = structuredClone(p.hints), before = structuredClone(p);
  assert.equal(claimBattle(p, battle, 'first').claimed, false); assert.deepEqual(p, before);
  const retry = claimBattle(p, battle, 'retry'); assert.equal(retry.rewards!.knowledge, encounter.knowledge); assert.equal(retry.clue, undefined); assert.deepEqual(p.hints, hints);
});

test('guardian bounty grants two shards only on a first guardian victory', () => {
  const p = winningPlayer(); learn(p, 'guardian-bounty');
  const guardian = ENCOUNTERS.find(e => e.boss)!; p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.indexOf(guardian)).map(e => e.id);
  p.discoveries = REACTIONS.map(r => r.id); p.owned = ELEMENTS.map(e => e.id); p.research = RESEARCH.map(r => r.id);
  const battle = simulateBattle(makeBattleConfig(p, guardian.id, 42)); assert.equal(battle.outcome, 'victory');
  assert.equal(claimBattle(p, battle, 'guardian-first').rewards!.shards, 3);
  assert.equal(claimBattle(p, battle, 'guardian-retry').rewards!.shards, 1);
  const defeat = { ...battle, outcome: 'defeat' as const }; assert.equal(claimBattle(p, defeat, 'defeat').rewards, undefined);
});

test('reactive ward grants shields to the reacting vessel with per-vessel six-second cooldowns', () => {
  const p = createPlayer(); learn(p, 'reactive-ward'); const config = makeBattleConfig(p, ENCOUNTERS[0].id, 42);
  const battle = simulateBattle(config), wards = battle.events.filter(e => e.type === 'passive' && e.name === 'Reactive Ward');
  assert.ok(wards.length > 0); assert.ok(wards.every(e => e.source!.startsWith('ally-')));
  for (const source of new Set(wards.map(e => e.source))) {
    const times = wards.filter(e => e.source === source).map(e => e.time);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 5.99);
    assert.ok(battle.report.units[source!].shield > 0);
    for (const ward of wards.filter(e => e.source === source)) assert.ok(battle.events.some(e => e.type === 'reaction' && e.source === source && e.time === ward.time));
  }
  assert.deepEqual(simulateBattle(config).report, battle.report);
  p.talents = []; assert.deepEqual(simulateBattle(config).report, battle.report);
});

test('account reaction talents do not enter competitive or loaned run combat', () => {
  const p = createPlayer(); learn(p, 'reactive-ward'); learn(p, 'recursive-binding');
  const normalized = makeBattleConfig(p, ENCOUNTERS[0].id, 42); normalized.normalized = true;
  const withTalents = simulateBattle(normalized); normalized.talents = [];
  assert.deepEqual(simulateBattle(normalized).report, withTalents.report); assert.ok(!withTalents.events.some(e => e.name === 'Reactive Ward'));
  startRun(p, 'roguelite', 42, ['fire', 'water']); const run = runBattleConfig(p);
  assert.deepEqual(run.talents, []); assert.ok(!simulateBattle(run).events.some(e => e.name === 'Reactive Ward'));
  assert.equal(talentPerk(p, 'experimentSlots'), 1);
});

test('prepared experiments clone target conditions without recording experiments or granting discoveries', () => {
  const p = createPlayer(), context = { environment: 'rain', statuses: ['freeze'], tags: ['organic'], healthRatio: .2, enemyCount: 3, shielded: true, mastery: { fire: 10 }, research: ['reaction-science'] };
  assert.equal(saveExperimentNote(p, '  Storm question  ', 'fire', 'water', context), true); context.statuses.push('burn');
  assert.equal(p.experiments, 0); assert.deepEqual(p.discoveries, []); assert.equal(p.experimentNotes[0].name, 'Storm question');
  assert.deepEqual(p.experimentNotes[0].context.statuses, ['freeze']); assert.equal(p.experimentNotes[0].context.mastery, undefined); assert.equal(p.experimentNotes[0].context.research, undefined);
  assert.equal(experimentCapacity(p), 1); assert.equal(saveExperimentNote(p, 'Second', 'earth', 'fire', {}), false);
  learn(p, 'parallel-notes'); assert.equal(experimentCapacity(p), 2); assert.equal(saveExperimentNote(p, 'Second', 'earth', 'fire', {}), true);
  assert.equal(saveExperimentNote(p, 'Third', 'fire', 'water', {}), false);
  assert.equal(replaceExperimentNote(p, 0, 'water', 'earth', { environment: 'holy' }), true); assert.equal(p.experimentNotes[0].name, 'Storm question');
  assert.equal(deleteExperimentNote(p, 1), true); assert.equal(saveExperimentNote(p, 'Replacement', 'fire', 'earth', {}), true);
  const before = p.experiments; const n = p.experimentNotes[0]; assert.equal(experiment(p, ...n.inputs, n.context).ok, true); assert.equal(p.experiments, before + 1);
});

test('notebook commands reject unowned inputs, duplicate names, empty names and malformed indices atomically', () => {
  const p = createPlayer(); assert.equal(executeCommand(p, 'save-note', { name: 'Question', a: 'fire', b: 'water' }), true);
  const before = structuredClone(p);
  for (const name of ['', ' ', null, {}, 4]) assert.equal(executeCommand(p, 'save-note', { name, a: 'fire', b: 'water' }), false);
  for (const command of ['replace-note', 'delete-note']) for (const index of [-1, .5, 1, NaN, Infinity, '0', null, []]) assert.equal(executeCommand(p, command, { index, a: 'earth', b: 'fire' }), false);
  assert.equal(executeCommand(p, 'replace-note', { index: 0, a: 'steam', b: 'fire' }), false); assert.deepEqual(p, before);
  learn(p, 'parallel-notes'); assert.equal(executeCommand(p, 'save-note', { name: 'qUESTION', a: 'fire', b: 'water' }), false);
});

test('old saves have an empty notebook and imported notes are bounded by earned capacity and owned ingredients', () => {
  const p = createPlayer(), note = { name: '  Question  ', inputs: ['fire', 'water'], context: { environment: 'invalid', statuses: ['__proto__', 'freeze'], mastery: { fire: 10 } } };
  const old = { ...p, experimentNotes: undefined }; assert.deepEqual(normalizeSave(old).experimentNotes, []);
  const notes = [{ ...note, name: '' }, { ...note, inputs: ['steam', 'fire'] }, note, { ...note, name: 'question' }, { ...note, name: 'Second' }];
  const raw = { ...p, experimentNotes: notes, talents: ['parallel-notes'] }; const base = normalizeSave(raw);
  assert.equal(base.experimentNotes.length, 1); assert.equal(base.experimentNotes[0].name, 'Question'); assert.equal(base.experimentNotes[0].context.environment, 'neutral'); assert.deepEqual(base.experimentNotes[0].context.statuses, ['freeze']);
  learn(p, 'parallel-notes'); const advanced = normalizeSave({ ...raw, talents: [...p.talents].reverse() }); assert.equal(advanced.experimentNotes.length, 2);
  assert.deepEqual(normalizeSave(advanced).experimentNotes, advanced.experimentNotes);
});
