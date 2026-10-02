import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, REACTIONS, ENCOUNTERS, BALANCE, CONTENT_VERSION, validateContent } from '../src/data/content.js';
import { ReactionEngine, reactionEngine, resolveExperiment } from '../src/core/reactions.js';
import { createPlayer, experiment, updateLoadout, moveVessel, buyResearch, requestHint, claimBattle, encounterUnlocked, validateTeam } from '../src/core/progression.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { normalizeSave, parseSave, exportSave, loadPlayer, savePlayer, SAVE_KEY, BACKUP_KEY } from '../src/core/save.js';

test('all content references are valid', () => assert.deepEqual(validateContent(), []));
for (const rule of REACTIONS) test('recipe is deterministic and unordered: ' + rule.id, () => {
  const context = { environment: rule.conditions?.environment, statuses: rule.conditions?.statuses, mastery: rule.conditions?.mastery };
  assert.equal(resolveExperiment(...rule.inputs, context)?.output, rule.output);
  assert.deepEqual(resolveExperiment(rule.inputs[1], rule.inputs[0], context)?.effects, rule.effects);
});
test('conditional reactions take precedence only in matching contexts', () => {
  assert.equal(resolveExperiment('fire', 'water')!.id, 'steam');
  assert.equal(resolveExperiment('fire', 'water', { statuses: ['freeze'] })!.id, 'thermal-shock');
  assert.equal(resolveExperiment('water', 'lightning')!.id, 'conductive');
  assert.equal(resolveExperiment('water', 'lightning', { environment: 'rain' })!.id, 'storm-surge');
});
test('unknown and disabled recipes are safe', () => {
  assert.equal(resolveExperiment('missing', 'water'), null);
  assert.equal(new ReactionEngine([{ ...REACTIONS[0], enabled: false }]).resolve('fire', 'water'), null);
});
test('undiscovered graph entries conceal their output and complete recipe', () => {
  const graph = reactionEngine.graph([], ELEMENTS.map(e => e.id));
  assert.ok(graph.every(n => n.output === null && n.inputs.includes(null)));
});
test('cycle and depth guards reject repeated reactions', () => {
  assert.equal(reactionEngine.canTrigger(REACTIONS[0], { triggered: new Set([REACTIONS[0].id]) }), false);
  assert.equal(reactionEngine.canTrigger(REACTIONS[0], { depth: BALANCE.maxChainDepth }), false);
});
test('experiments reward a discovery once and unlock derived chains', () => {
  const p = createPlayer(); const first = experiment(p, 'fire', 'water');
  assert.equal(first.isNew, true); assert.ok(p.owned.includes('steam'));
  const knowledge = p.knowledge; experiment(p, 'water', 'fire');
  assert.equal(p.knowledge, knowledge);
  assert.equal(experiment(p, 'steam', 'wind').rule!.id, 'storm-cloud');
  assert.equal(experiment(p, 'storm-cloud', 'lightning').rule!.id, 'thunderstorm');
});
test('failed experiments do not consume or corrupt inventory', () => {
  const p = createPlayer(); const owned = [...p.owned];
  experiment(p, 'fire', 'fire'); assert.deepEqual(p.owned, owned);
  assert.equal(experiment(p, 'not-owned', 'fire').ok, false);
});
test('loadouts enforce ownership, valid strategies and relic unlocks', () => {
  const p = createPlayer();
  assert.equal(updateLoadout(p, 0, { elements: ['steam', 'water'] }), false);
  assert.equal(updateLoadout(p, 0, { relic: 'storm-core' }), false);
  assert.equal(updateLoadout(p, 0, { targeting: 'invalid' }), false);
  assert.equal(moveVessel(p, 0, -1), false);
  assert.equal(moveVessel(p, 0, 1), true);
  assert.equal(validateTeam(p), true);
});
test('research and hints spend only available knowledge', () => {
  const p = createPlayer(); p.knowledge = 20;
  assert.equal(buyResearch(p, 'resonance'), true); assert.equal(p.knowledge, 5);
  assert.equal(buyResearch(p, 'resonance'), false);
  assert.equal(requestHint(p).ok, true); assert.equal(p.knowledge, 3);
  assert.equal(requestHint(p).ok, true); assert.equal(requestHint(p).ok, false);
});
test('seed and configuration reproduce the entire battle', () => {
  const config = makeBattleConfig(createPlayer(), ENCOUNTERS[0].id, 34821);
  const copy = structuredClone(config);
  assert.deepEqual(simulateBattle(config), simulateBattle(config));
  assert.deepEqual(config, copy);
});
test('every frame preserves health, shield and finite-duration invariants', () => {
  const battle = simulateBattle(makeBattleConfig(createPlayer(), ENCOUNTERS[0].id, 42));
  const dead = new Set();
  for (const frame of battle.frames) for (const unit of frame.units) {
    assert.ok(Number.isFinite(unit.hp) && unit.hp >= 0 && unit.hp <= unit.maxHp);
    assert.ok(unit.shield >= 0 && unit.shield <= unit.maxHp);
    if (dead.has(unit.id)) assert.equal(unit.hp, 0);
    if (!unit.hp) dead.add(unit.id);
    assert.ok(unit.statuses.every(s => s.remaining >= 0 && Number.isFinite(s.remaining)));
  }
  assert.ok(battle.duration <= BALANCE.maxTime);
  assert.ok(Object.keys(battle.report.reactions).length > 0);
});
test('boss immunity and phase rules execute from content', () => {
  const battle = simulateBattle(makeBattleConfig(createPlayer(), 'molten-throne', 42));
  assert.ok(!battle.events.some(e => e.type === 'status' && e.target === 'enemy-0' && e.status === 'burn'));
  assert.ok(battle.events.some(e => e.type === 'phase'));
});
test('captureFrames does not change simulation results', () => {
  const config = makeBattleConfig(createPlayer(), ENCOUNTERS[0].id, 123);
  const a = simulateBattle(config), b = simulateBattle(config, { captureFrames: false });
  assert.deepEqual(a.report, b.report); assert.deepEqual(a.final, b.final); assert.equal(b.frames.length, 0);
});
test('a malicious cyclic content rule still terminates', () => {
  const engine = new ReactionEngine([{ ...REACTIONS[0], id: 'cycle', inputs: ['fire', 'water'], output: 'water', cooldown: 0, effects: [{ type: 'applyElement', element: 'fire' }] }]);
  const battle = simulateBattle(makeBattleConfig(createPlayer(), ENCOUNTERS[0].id, 3), { engine, captureFrames: false });
  assert.ok(battle.duration <= BALANCE.maxTime);
  assert.ok(battle.events.length <= BALANCE.maxLogEvents);
});
test('campaign rewards are idempotent and unlock the next encounter', () => {
  const p = createPlayer(); const b = simulateBattle(makeBattleConfig(p, ENCOUNTERS[0].id, 42));
  assert.equal(b.outcome, 'victory');
  assert.equal(claimBattle(p, b, 'battle-1').claimed, true);
  const before = structuredClone(p);
  assert.equal(claimBattle(p, b, 'battle-1').claimed, false); assert.deepEqual(p, before);
  assert.equal(encounterUnlocked(p, ENCOUNTERS[1].id), true);
});
test('wrong content versions and malformed teams cannot replay', () => {
  const config = makeBattleConfig(createPlayer(), ENCOUNTERS[0].id, 42);
  assert.throws(() => simulateBattle({ ...config, contentVersion: 'old' }), /version/);
  assert.throws(() => simulateBattle({ ...config, team: [config.team[0], config.team[0]] }), /duplicate/);
});
test('save round trip retains discoveries, team, progression and replay', () => {
  const p = createPlayer(); experiment(p, 'fire', 'water'); p.settings.largeText = true;
  const config = makeBattleConfig(p, ENCOUNTERS[0].id, 5);
  claimBattle(p, simulateBattle(config), 'save-battle');
  assert.deepEqual(parseSave(exportSave(p)), p);
  assert.equal(p.lastReplay!.contentVersion, CONTENT_VERSION);
});
test('save normalization removes stale content and repairs malformed slots', () => {
  const p = createPlayer(); p.discoveries.push('missing'); p.mastery.missing = 10;
  p.team[0].elements = ['missing', 'fire']; p.team[1].vessel = p.team[0].vessel;
  p.knowledge = -100; p.gold = Infinity;
  const fixed = normalizeSave(p);
  assert.equal(validateTeam(fixed), true); assert.equal(fixed.knowledge, 0); assert.equal(fixed.gold, 0);
  assert.ok(!fixed.owned.includes('missing')); assert.ok(!('missing' in fixed.mastery));
});
test('bad imports are rejected without mutating current progress', () => {
  const p = createPlayer(); const before = structuredClone(p);
  for (const raw of ['null', '[]', '{', '{"version":999}']) assert.throws(() => parseSave(raw));
  assert.deepEqual(p, before);
});
test('storage recovers a valid backup and handles denied writes', () => {
  const data = new Map<string,string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) };
  const p = createPlayer(); savePlayer(storage, p); experiment(p, 'fire', 'water'); savePlayer(storage, p);
  assert.ok(data.has(BACKUP_KEY)); data.set(SAVE_KEY, '{broken');
  assert.ok(loadPlayer(storage).notice.includes('backup'));
  assert.equal(savePlayer({ getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); } }, p), false);
});
