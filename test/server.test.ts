import type { TestContext } from 'node:test';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from '../server/service.js';
import { createAppServer } from '../server/http.js';
import { simulateBattle } from '../src/core/combat.js';
import { rotation, startRun } from '../src/core/modes.js';
import { competitionRules } from '../src/core/competition.js';
import { REACTIONS, ENCOUNTERS } from '../src/data/content.js';
import { guildWeek } from '../server/guilds.js';
import { dailyGoals } from '../src/core/learning.js';
import { formationKey } from '../src/core/formations.js';
import { RESEARCH, ELEMENTS } from '../src/data/content.js';
import { claimBattle } from '../src/core/progression.js';

test('server enforces notebook capacity and persists sanitized notes and earned talents', async t => {
  const { service, directory } = await fixture(t), account = await service.register('NotebookScholar', 'test-only-password-123');
  await service.store.transaction(db => { db.users[0].player.knowledge = 1000; });
  const note = { name: 'Rain question', a: 'fire', b: 'water', context: { environment: 'rain', statuses: ['freeze'], research: ['reaction-science'], mastery: { fire: 10 } } };
  assert.equal((await service.command(account.token, 'save-note', note)).result, true);
  assert.equal((await service.command(account.token, 'save-note', { ...note, name: 'Second question' })).result, false);
  assert.equal((await service.command(account.token, 'talent', { id: 'parallel-notes' })).result, false);
  for (const id of ['deep-binding', 'reaction-scholar', 'parallel-notes']) assert.equal((await service.command(account.token, 'talent', { id })).result, true);
  assert.equal((await service.command(account.token, 'save-note', { ...note, name: 'Second question' })).result, true);
  assert.equal((await service.command(account.token, 'replace-note', { index: '__proto__', a: 'earth', b: 'fire' })).result, false);
  assert.equal((await service.command(account.token, 'replace-note', { index: 1, a: 'earth', b: 'fire', context: { shielded: true } })).result, true);
  const reopened = await createService(directory), p = reopened.me(account.token).player!;
  assert.equal(p.experimentNotes.length, 2); assert.deepEqual(p.experimentNotes[0].context, { environment: 'rain', statuses: ['freeze'], tags: [] });
  assert.deepEqual(p.experimentNotes[1].inputs, ['earth', 'fire']); assert.equal(p.experiments, 0);
  assert.equal((await reopened.command(account.token, 'delete-note', { index: 0 })).result, true);
  assert.equal(reopened.me(account.token).player!.experimentNotes[0].name, 'Second question');
});

test('server settles talent first-clear rewards and clues once using the issued combat snapshot', async t => {
  const { service, directory } = await fixture(t), account = await service.register('TalentExplorer', 'test-only-password-123');
  await service.store.transaction(db => {
    const p = db.users[0].player; p.knowledge = 1000;
    p.team.forEach(s => { s.elements = ['light', 'shadow']; p.vesselXp[s.vessel] = 450; }); p.mastery.light = p.mastery.shadow = 300;
  });
  for (const id of ['field-alchemist', 'first-survey', 'guardian-bounty', 'careful-notes', 'field-clues', 'deep-binding', 'reaction-conduit', 'reactive-ward']) assert.equal((await service.command(account.token, 'talent', { id })).result, true);
  const launch = await service.startBattle(account.token, { encounterId: ENCOUNTERS[0].id });
  const battle = simulateBattle(launch.config), snapshot = structuredClone(service.me(account.token).player!);
  assert.equal(battle.outcome, 'victory'); assert.ok(battle.events.some(e => e.name === 'Reactive Ward'));
  const expected = claimBattle(snapshot, battle, launch.battleId);
  const results = await Promise.all([service.finishBattle(account.token, launch.battleId), service.finishBattle(account.token, launch.battleId)]);
  for (const response of results) { assert.deepEqual(response.result!.rewards, expected.rewards); assert.equal(response.result!.clue, expected.clue); }
  const reopened = await createService(directory), p = reopened.me(account.token).player!;
  assert.deepEqual([p.gold, p.knowledge, p.essence, p.shards], [snapshot.gold, snapshot.knowledge, snapshot.essence, snapshot.shards]); assert.deepEqual(p.hints, snapshot.hints); assert.equal(p.wins, 1);
  await reopened.command(account.token, 'talent', { id: 'reaction-scholar' });
  assert.deepEqual(simulateBattle(p.lastReplay!).report, battle.report);
  const retry = await reopened.startBattle(account.token, { encounterId: ENCOUNTERS[0].id });
  const second = await reopened.finishBattle(account.token, retry.battleId);
  assert.equal(second.result!.rewards!.knowledge, ENCOUNTERS[0].knowledge); assert.equal(second.result!.clue, undefined);
});

test('server manages saved formations and counts the issued battle build exactly once', async t => {
  const { service, directory } = await fixture(t), account = await service.register('BuildScholar', 'test-only-password-123');
  await service.store.transaction(db => {
    const p = db.users[0].player; p.team.forEach(s => { s.elements = ['light', 'shadow']; p.vesselXp[s.vessel] = 450; });
    p.mastery.light = 300; p.mastery.shadow = 300;
  });
  assert.equal((await service.command(account.token, 'save-loadout', { name: 'Night study' })).result, true);
  const launch = await service.startBattle(account.token, { encounterId: 'whispering-grove' }), battle = simulateBattle(launch.config); assert.equal(battle.outcome, 'victory');
  await service.command(account.token, 'loadout', { index: 0, patch: { elements: ['water', 'earth'] } });
  await service.command(account.token, 'replace-loadout', { index: 0 });
  await service.command(account.token, 'rename-loadout', { index: 0, name: 'River study' });
  await Promise.all([service.finishBattle(account.token, launch.battleId), service.finishBattle(account.token, launch.battleId)]);
  const p = service.me(account.token).player!;
  assert.deepEqual(p.learning.testedBuilds, [formationKey(launch.config.team)]); assert.equal(p.learning.firelessWins, 1);
  const gold = p.gold;
  const rewards = await Promise.all([service.command(account.token, 'achievement', { id: 'win-without-fire' }), service.command(account.token, 'achievement', { id: 'win-without-fire' })]);
  assert.equal(rewards.filter(r => r.result === true).length, 1); assert.equal(service.me(account.token).player!.gold, gold + 75);
  const reopened = await createService(directory), restored = reopened.me(account.token).player!;
  assert.deepEqual(restored.learning, service.me(account.token).player!.learning); assert.equal(restored.loadouts[0].name, 'River study');
  assert.deepEqual(restored.loadouts[0].team[0].elements, ['water', 'earth']);
  assert.equal((await reopened.command(account.token, 'delete-loadout', { index: '__proto__' })).result, false);
  assert.equal((await reopened.command(account.token, 'delete-loadout', { index: 0 })).result, true);
  assert.equal(reopened.me(account.token).player!.loadouts.length, 0); assert.equal(reopened.me(account.token).player!.learning.testedBuilds.length, 1);
});

test('authoritative guardian Poison progress survives concurrent claims and restart', async t => {
  const { service, directory } = await fixture(t), account = await service.register('VenomScholar', 'test-only-password-123');
  const target = ENCOUNTERS.find(e => e.enemies.includes('molten-king'))!;
  await service.store.transaction(db => {
    const p = db.users[0].player; p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.indexOf(target)).map(e => e.id);
    p.discoveries = REACTIONS.map(r => r.id); p.owned = ELEMENTS.map(e => e.id);
    p.mastery = Object.fromEntries(p.owned.map(id => [id, 300])); p.research = RESEARCH.map(r => r.id);
    p.talents = ['deep-binding', 'reaction-scholar']; p.evolution.poison = 3;
    p.team.forEach((s, i) => { s.elements = i === 0 ? ['poison', 'water'] : ['gravity', 'storm-surge']; p.vesselXp[s.vessel] = 450; });
  });
  const launch = await service.startBattle(account.token, { encounterId: target.id }), battle = simulateBattle(launch.config);
  assert.equal(battle.outcome, 'victory'); assert.ok(battle.report.statusDamage['enemy-0'].poison > 0);
  await Promise.all([service.finishBattle(account.token, launch.battleId), service.finishBattle(account.token, launch.battleId)]);
  const restored = (await createService(directory)).me(account.token).player!;
  assert.equal(restored.learning.poisonBossWins, 1); assert.ok(restored.achievements.includes('poison-boss'));
  assert.equal(restored.learning.testedBuilds.length, 1); assert.deepEqual(simulateBattle(restored.lastReplay!).report, battle.report);
});

test('server persists drafted run tools and scenarios, blocks issued-battle edits and settles once', async t => {
  const { service, directory } = await fixture(t), account = await service.register('RunScholar', 'test-only-password-123');
  await service.store.transaction(db => { startRun(db.users[0].player, 'roguelite', 42, ['light', 'shadow']); });
  const launch = await service.startBattle(account.token, { kind: 'run' });
  assert.equal(simulateBattle(launch.config).outcome, 'victory');
  for (const command of ['run-scenario', 'run-tactics']) await assert.rejects(service.command(account.token, command, { index: 0, patch: { relic: 'none' }, context: {} }), /Finish the active run battle/);
  await Promise.all([service.finishBattle(account.token, launch.battleId), service.finishBattle(account.token, launch.battleId)]);
  assert.equal(service.me(account.token).player!.run!.wins, 1);
  const choice = service.me(account.token).player!.run!.rewards[1]; assert.equal(choice.type, 'relic');
  assert.equal((await service.command(account.token, 'run-reward', { index: 1 })).result, true);
  assert.equal((await service.command(account.token, 'run-tactics', { index: 0, patch: { relic: choice.id, priority: 'reaction' } })).result, true);
  assert.equal((await service.command(account.token, 'run-scenario', { context: { statuses: ['freeze'], shielded: true, research: ['reaction-science'] } })).result, true);
  const reopened = await createService(directory), p = reopened.me(account.token).player!;
  assert.deepEqual(p.run!.relics, [choice.id]); assert.equal(p.run!.team[0].relic, choice.id);
  assert.deepEqual(p.run!.context, { statuses: ['freeze'], shielded: true, tags: [] });
  const second = await reopened.startBattle(account.token, { kind: 'run' });
  assert.equal(second.config.team[0].relic, choice.id); assert.deepEqual(second.config.research, []);
  await reopened.finishBattle(account.token, second.battleId);
  await reopened.command(account.token, 'retire-run'); const gold = reopened.me(account.token).player!.gold;
  assert.equal((await reopened.command(account.token, 'retire-run')).result, false); assert.equal(reopened.me(account.token).player!.gold, gold);
});

test('server refuses unearned run equipment and ignores account mastery in run experiments', async t => {
  const { service } = await fixture(t), account = await service.register('RunValidator', 'test-only-password-123');
  await service.command(account.token, 'start-run', { mode: 'roguelite', elements: ['fire', 'water'] });
  assert.equal((await service.command(account.token, 'run-tactics', { index: 0, patch: { relic: 'genesis-thread', passive: 'last-light' } })).result, false);
  assert.equal((await service.command(account.token, 'run-tactics', { index: '__proto__', patch: { relic: 'none' } })).result, false);
  await service.command(account.token, 'run-scenario', { context: { statuses: ['freeze'], mastery: { fire: 10 }, research: ['reaction-science'] } });
  const response = await service.command(account.token, 'run-experiment', { a: 'fire', b: 'water' });
  assert.equal((response.result as { id: string }).id, 'thermal-shock');
  assert.ok(response.player.run!.elements.includes('thermal-shock')); assert.ok(!response.player.owned.includes('thermal-shock'));
  await service.command(account.token, 'retire-run'); assert.ok(service.me(account.token).player!.owned.includes('thermal-shock'));
});

test('server records observed guardian rules once and preserves them through restart and replay', async t => {
  const { service, directory } = await fixture(t), account = await service.register('GuardianScholar', 'test-only-password-123');
  const target = 'emerald-wild-12';
  await service.store.transaction(db => {
    const p = db.users[0].player;
    p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.findIndex(e => e.id === target)).map(e => e.id);
    p.team.forEach(s => { s.elements = ['fire', 'fire']; p.vesselXp[s.vessel] = 450; });
    p.mastery.fire = 300; p.research = ['warding', 'resonance', 'cultivation'];
  });
  const launch = await service.startBattle(account.token, { encounterId: target }), battle = simulateBattle(launch.config);
  assert.equal(battle.outcome, 'victory'); assert.ok(battle.report.mechanics['plague-mother'].counters.burn);
  await Promise.all([service.finishBattle(account.token, launch.battleId), service.finishBattle(account.token, launch.battleId)]);
  const p = service.me(account.token).player!;
  assert.equal(p.battles, 1); assert.ok(p.campaign.includes(target));
  assert.deepEqual(p.creatureKnowledge['plague-mother'].phases, battle.report.mechanics['plague-mother'].phases);
  const reopened = await createService(directory), saved = reopened.me(account.token).player!;
  assert.deepEqual(saved.creatureKnowledge, p.creatureKnowledge);
  assert.deepEqual(simulateBattle(saved.lastReplay!).report, battle.report);
  await reopened.finishBattle(account.token, launch.battleId);
  assert.equal(reopened.me(account.token).player!.battles, 1);
});

test('server rejects forged research context and persists purchased recipe and blueprint unlocks', async t => {
  const { service, directory } = await fixture(t);
  const account = await service.register('ResearchScholar', 'test-only-password-123');
  await service.store.transaction(db => { const p = db.users[0].player; p.knowledge = 200; p.gold = 500; p.essence = 100; p.shards = 10; });
  await service.command(account.token, 'experiment', { a: 'fire', b: 'water' });
  const forged = await service.command(account.token, 'experiment', { a: 'steam', b: 'wind', context: { research: ['reaction-science'] } });
  assert.equal((forged.result as { rule: { id: string } }).rule.id, 'storm-cloud');
  assert.equal((await service.command(account.token, 'research', { id: 'reaction-science' })).result, false);
  assert.equal((await service.command(account.token, 'craft', { id: 'echo-catalyst' })).result, false);
  await service.command(account.token, 'research', { id: 'resonance' });
  const before = service.me(account.token).player!.knowledge;
  const purchases = await Promise.all([service.command(account.token, 'research', { id: 'reaction-science' }), service.command(account.token, 'research', { id: 'reaction-science' })]);
  assert.equal(purchases.filter(r => r.result === true).length, 1);
  assert.equal(service.me(account.token).player!.knowledge, before - 25);
  const learned = await service.command(account.token, 'experiment', { a: 'steam', b: 'wind' });
  assert.equal((learned.result as { rule: { id: string } }).rule.id, 'pressure-current');
  await service.command(account.token, 'research', { id: 'catalyst-study' });
  const crafts = await Promise.all([service.command(account.token, 'craft', { id: 'echo-catalyst' }), service.command(account.token, 'craft', { id: 'echo-catalyst' })]);
  assert.equal(crafts.filter(r => r.result === true).length, 1);
  const reopened = await createService(directory), p = reopened.me(account.token).player!;
  assert.ok(p.discoveries.includes('pressure-current')); assert.ok(p.equipment.includes('echo-catalyst'));
  assert.ok(p.research.includes('reaction-science')); assert.equal(p.gold, 380);
});

test('server validates third-slot purchases and includes abilities in authoritative battle snapshots', async t => {
  const { service, directory } = await fixture(t), account = await service.register('TacticalScholar', 'test-only-password-123');
  await service.store.transaction(db => { db.users[0].player.knowledge = 200; });
  await service.command(account.token, 'experiment', { a: 'fire', b: 'water' });
  await service.command(account.token, 'experiment', { a: 'fire', b: 'earth' });
  await service.command(account.token, 'experiment', { a: 'fire', b: 'wind' });
  await service.command(account.token, 'experiment', { a: 'fire', b: 'nature' });
  const payload = { index: 0, patch: { abilities: ['ward', 'mend', 'fracture'] } };
  assert.equal((await service.command(account.token, 'loadout', payload)).result, false);
  await service.command(account.token, 'research', { id: 'warding' });
  await service.command(account.token, 'research', { id: 'tactical-memory' });
  assert.equal((await service.command(account.token, 'loadout', payload)).result, true);
  const launch = await service.startBattle(account.token, { encounterId: 'whispering-grove' });
  assert.deepEqual(launch.config.team[0].abilities, payload.patch.abilities);
  assert.ok(simulateBattle(launch.config).events.some(e => e.type === 'cast' && e.name === 'Fracturing Strike'));
  await service.finishBattle(account.token, launch.battleId);
  const reopened = await createService(directory);
  assert.deepEqual(reopened.me(account.token).player!.team[0].abilities, payload.patch.abilities);
  assert.equal((await reopened.command(account.token, 'loadout', { index: 0, patch: { abilities: ['renewal'] } })).result, false);
});

test('server validates daily learning rewards, serializes duplicate claims and persists counters', async t => {
  const { service, directory } = await fixture(t);
  const account = await service.register('DailyScholar', 'test-only-password-123');
  assert.equal((await service.command(account.token, 'daily-goal', { id: 'practice', count: 999 })).result, false);
  const practice = dailyGoals().practice;
  const rules = REACTIONS.filter(r => !r.conditions && r.inputs.includes(practice) && r.inputs.every(id => account.player.owned.includes(id))).slice(0, 2);
  assert.equal(rules.length, 2);
  for (const rule of rules) await service.command(account.token, 'experiment', { a: rule.inputs[0], b: rule.inputs[1] });
  const before = service.me(account.token).player!.gold;
  const claims = await Promise.all([service.command(account.token, 'daily-goal', { id: 'practice' }), service.command(account.token, 'daily-goal', { id: 'practice' })]);
  assert.equal(claims.filter(c => c.result === true).length, 1);
  assert.equal(service.me(account.token).player!.gold, before + 25);
  const reopened = await createService(directory);
  assert.deepEqual(reopened.me(account.token).player!.learning, service.me(account.token).player!.learning);
  assert.equal((await reopened.command(account.token, 'daily-goal', { id: 'practice' })).result, false);
});

test('server battle completion records elemental usage once across retries', async t => {
  const { service } = await fixture(t);
  const account = await service.register('CastScholar', 'test-only-password-123');
  const pending = await service.startBattle(account.token, { kind: 'campaign', encounterId: 'whispering-grove' });
  const battle = simulateBattle(pending.config, { captureFrames: false });
  await service.finishBattle(account.token, pending.battleId);
  assert.deepEqual(service.me(account.token).player!.learning.elementCasts, battle.report.elementCasts);
  await service.finishBattle(account.token, pending.battleId);
  assert.deepEqual(service.me(account.token).player!.learning.elementCasts, battle.report.elementCasts);
});

test('content upgrades reject stale rewards and allow a new battle without lost progression', async t => {
  const { service } = await fixture(t);
  const account = await service.register('UpgradeScholar', 'test-only-password-123');
  await service.command(account.token, 'experiment', { a: 'fire', b: 'water' });
  const pending = await service.startBattle(account.token, { kind: 'campaign', encounterId: 'whispering-grove' });
  await service.store.transaction(db => { db.battles[pending.battleId].config.contentVersion = '0.0.0'; });
  await assert.rejects(service.finishBattle(account.token, pending.battleId), /Begin a new battle/);
  const fresh = await service.startBattle(account.token, { kind: 'campaign', encounterId: 'whispering-grove' });
  assert.notEqual(fresh.battleId, pending.battleId);
  const player = service.me(account.token).player!;
  assert.equal(player.gold, 0); assert.equal(player.battles, 0); assert.ok(player.discoveries.includes('steam'));
  assert.equal(service.store.data.battles[pending.battleId], undefined);
});

test('guild exchange, hidden projects and missions persist with account-level claim limits', async t => {
  const { service, directory } = await fixture(t);
  const a = await service.register('Project_A', 'test-only-password-123'), b = await service.register('Project_B', 'test-only-password-123');
  await service.social(a.token, 'guild-create', { name: 'Research Guild' });
  const guildId = service.world(a.token).self.guildId!;
  await service.social(b.token, 'guild-join', { id: guildId });
  await service.store.transaction(db => { for (const user of db.users) { user.player.mastery.fire = 100; user.player.knowledge = 100; } });
  const hidden = service.world(a.token).guilds[0].activity.project;
  assert.equal('target' in hidden, false); assert.equal(hidden.reaction, undefined);
  for (let i = 0; i < 3; i++) await service.social(a.token, 'guild-element-donate', { id: 'fire' });
  await service.social(b.token, 'guild-element-claim', { id: 'fire' });
  assert.equal(service.me(a.token).player!.mastery.fire, 10);
  assert.equal(service.me(b.token).player!.mastery.fire, 115);
  await assert.rejects(service.social(a.token, 'guild-element-donate', { id: 'fire' }), /30 mastery/);
  await assert.rejects(service.social(b.token, 'guild-mission', { id: 'donations' }), /Contribute/);
  const claims = await Promise.allSettled([service.social(a.token, 'guild-mission', { id: 'donations' }), service.social(a.token, 'guild-mission', { id: 'donations' })]);
  assert.equal(claims.filter(r => r.status === 'fulfilled').length, 1);
  const pairs = REACTIONS.filter(r => !r.conditions && r.inputs.every(id => a.player.owned.includes(id))).slice(0, 10);
  assert.equal(pairs.length, 10);
  for (const account of [a, b]) for (const rule of pairs) await service.social(account.token, 'guild-experiment', { a: rule.inputs[0], b: rule.inputs[1] });
  const revealed = service.world(a.token).guilds[0].activity.project;
  assert.equal(revealed.progress, 20); assert.ok(revealed.reaction);
  assert.equal(revealed.contributors[a.account.id], 10);
  assert.equal((await service.social(b.token, 'guild-mission', { id: 'project' })).result.reaction!.id, revealed.reaction.id);
  const reopened = await createService(directory);
  assert.equal(reopened.world(a.token).guilds[0].activity.project.progress, 20);
  await service.social(a.token, 'guild-leave', {});
  await service.social(a.token, 'guild-create', { name: 'Another Guild' });
  await assert.rejects(service.social(a.token, 'guild-experiment', { a: pairs[0].inputs[0], b: pairs[0].inputs[1] }), /already contributed/);
  const guild = service.store.data.guilds[0];
  assert.equal(guildWeek(guild, Date.now() + 7 * 86400000).project.progress, 0);
});

test('Element Wars and Weekly Crucible use validated pools and independent once-weekly standings', async t => {
  const { service } = await fixture(t);
  const a = await service.register('Competitor_A', 'test-only-password-123'), b = await service.register('Competitor_B', 'test-only-password-123');
  const rules = competitionRules();
  for (const kind of ['element-wars', 'weekly-pvp']) {
    const count = kind === 'element-wars' ? 2 : 3, pool = kind === 'element-wars' ? rules.elementPool : rules.pool;
    await assert.rejects(service.startBattle(a.token, { kind, opponentId: b.account.id, draft: ['fire', 'fire'] }), /distinct/);
    const first = await service.startBattle(a.token, { kind, opponentId: b.account.id, draft: pool.slice(0, count) });
    assert.ok(first.config.normalized);
    assert.ok(first.config.opponentTeam!.every(s => s.elements.every(id => pool.slice(count).includes(id))));
    if (kind === 'weekly-pvp') assert.deepEqual(first.config.modifiers, rules.mutator.modifiers);
    const result = await service.finishBattle(a.token, first.battleId);
    const score = result.result!.outcome === 'victory' ? 3 : result.result!.outcome === 'draw' ? 1 : 0;
    const key = kind === 'element-wars' ? 'elementWars' : 'weekly';
    assert.equal(service.world(a.token).standings[key].find(p => p.id === a.account.id)!.score, score);
    const repeat = await service.startBattle(a.token, { kind, opponentId: b.account.id, draft: pool.slice(0, count) });
    assert.deepEqual(first.config, repeat.config);
    await service.finishBattle(a.token, repeat.battleId);
    assert.equal(service.world(a.token).standings[key].find(p => p.id === a.account.id)!.score, score);
  }
  assert.equal(service.store.data.users[0].competition!.claims.length, 2);
  await service.store.transaction(db => { db.users[0].competition!.week--; });
  assert.equal(service.world(a.token).standings.weekly.find(p => p.id === a.account.id)!.score, 0);
});

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'alchemy-wars-test-'));
  t.after(async () => { assert.ok(directory.startsWith(join(tmpdir(), 'alchemy-wars-test-'))); await rm(directory, { recursive: true, force: true }); });
  const service = await createService(directory);
  return { directory, service };
}
test('accounts hash passwords, expire sessions, and persist independently', async t => {
  const { directory, service } = await fixture(t);
  const a = await service.register('Alchemist_A', 'test-only-password-123');
  const b = await service.register('Alchemist_B', 'test-only-password-456');
  await service.command(a.token, 'experiment', { a: 'fire', b: 'water' });
  assert.equal(service.me(a.token).player!.discoveries.length, 1);
  assert.equal(service.me(b.token).player!.discoveries.length, 0);
  assert.ok(!(await readFile(join(directory, 'world.json'), 'utf8')).includes('test-only-password'));
  const reopened = await createService(directory);
  assert.equal(reopened.me(a.token).player!.discoveries.length, 1);
  await assert.rejects(service.login('Alchemist_A', 'wrong-password'), /Invalid/);
  assert.ok((await service.login('Alchemist_A', 'test-only-password-123')).token);
  await service.logout(a.token); assert.equal(service.me(a.token).account, null);
});
test('online commands reject forged ownership, unknown fields and locked encounters', async t => {
  const { service } = await fixture(t), a = await service.register('Alchemist_A', 'test-only-password-123');
  assert.equal((await service.command(a.token, 'loadout', { index: 0, patch: { elements: ['supernova', 'fire'] } })).result, false);
  assert.equal((await service.command(a.token, 'loadout', { index: 0, patch: { attack: 999999 } })).result, false);
  await assert.rejects(service.command(a.token, 'grant-currency', { amount: 999999 }), /Unknown/);
  await assert.rejects(service.startBattle(a.token, { encounterId: 'molten-throne' }), /not unlocked/);
  assert.equal(service.me(a.token).player!.gold, 0);
  for (const command of ['passive', 'vessel', 'equip', 'run-team', 'apply-loadout']) assert.equal((await service.command(a.token, command, { index: '__proto__', id: 'none' })).result, false);
  assert.equal(Reflect.get(Array.prototype, 'passive'), undefined);
});
test('drafted PvP loans complementary pools and rejects invalid drafts', async t => {
  const { service } = await fixture(t), a = await service.register('Drafter_A', 'test-only-password-123'), b = await service.register('Drafter_B', 'test-only-password-456');
  await assert.rejects(service.startBattle(a.token, { kind: 'draft-pvp', opponentId: b.account.id, draft: ['fire', 'fire', 'water'] }), /Draft three/);
  const pool = rotation().draft, battle = await service.startBattle(a.token, { kind: 'draft-pvp', opponentId: b.account.id, draft: pool.slice(0, 3) });
  assert.ok(battle.config.team.every(s => s.elements.every(id => pool.slice(0, 3).includes(id))));
  assert.ok(battle.config.opponentTeam!.every(s => s.elements.every(id => pool.slice(3).includes(id))));
  await service.finishBattle(a.token, battle.battleId);
});
test('guild war scoring is once per member/opponent/week and live maintenance blocks new battles', async t => {
  const { service } = await fixture(t), a = await service.register('Guild_A', 'test-only-password-123'), b = await service.register('Guild_B', 'test-only-password-456');
  await service.social(a.token, 'guild-create', { name: 'First Guild' }); await service.social(b.token, 'guild-create', { name: 'Second Guild' });
  const fight = await service.startBattle(a.token, { kind: 'guild-war', opponentId: b.account.id });
  await service.finishBattle(a.token, fight.battleId);
  const guild = service.world(a.token).guilds.find(g => g.owner === a.account.id);
  assert.equal(guild!.war!.claims.length, 1);
  const next = await service.startBattle(a.token, { kind: 'guild-war', opponentId: b.account.id }); await service.finishBattle(a.token, next.battleId);
  assert.equal(service.world(a.token).guilds.find(g => g.owner === a.account.id)!.war!.score, guild!.war!.score);
  await service.updateLive({ enabled: false, seasonName: 'Test Season', announcements: [] });
  await assert.rejects(service.startBattle(a.token, { encounterId: 'whispering-grove' }), /maintenance/);
  await service.updateLive({ enabled: true, mutator: 'wildfire', announcements: [] });
  assert.equal((await service.startBattle(a.token, { encounterId: 'whispering-grove' })).config.modifiers!.tagPower!.heat, 1.3);
  assert.equal(service.analytics().accounts, 2);
  assert.ok('D30' in service.analytics().retention);
});
test('database recovery preserves healthy backup until a recovered write succeeds', async t => {
  const { directory, service } = await fixture(t);
  const account = await service.register('Recovery_A', 'test-only-password-123');
  await service.command(account.token, 'experiment', { a: 'fire', b: 'water' });
  const backup = await readFile(join(directory, 'world.json.backup'), 'utf8');
  await writeFile(join(directory, 'world.json'), '{broken');
  const recovered = await createService(directory);
  await recovered.command(account.token, 'experiment', { a: 'fire', b: 'water' });
  assert.equal(await readFile(join(directory, 'world.json.backup'), 'utf8'), backup);
  assert.equal((await createService(directory)).me(account.token).player!.discoveries.length, 1);
});
test('server computes battle outcomes and concurrent reward claims pay once', async t => {
  const { service } = await fixture(t), a = await service.register('Alchemist_A', 'test-only-password-123');
  // @ts-expect-error Deliberately forged client fields must be ignored by the server.
  const started = await service.startBattle(a.token, { encounterId: 'whispering-grove', seed: 999, outcome: 'victory', gold: 999999 });
  const expected = simulateBattle(started.config, { captureFrames: false });
  const [first, duplicate] = await Promise.all([service.finishBattle(a.token, started.battleId), service.finishBattle(a.token, started.battleId)]);
  assert.equal(first.result!.outcome, expected.outcome); assert.equal(duplicate.player.battles, 1);
  assert.equal(duplicate.player.gold, first.player.gold);
  assert.equal(service.me(a.token).player!.battles, 1);
  const b = await service.register('Alchemist_B', 'test-only-password-456');
  await assert.rejects(service.finishBattle(b.token, started.battleId), /not found/);
});
test('friends, shared discoveries, guild membership and donations work across accounts', async t => {
  const { service } = await fixture(t), a = await service.register('Alchemist_A', 'test-only-password-123'), b = await service.register('Alchemist_B', 'test-only-password-456');
  await service.social(a.token, 'friend-request', { id: b.account.id });
  assert.deepEqual(service.world(b.token).requests, [a.account.id]);
  await service.social(b.token, 'friend-accept', { id: a.account.id });
  assert.ok(service.world(a.token).friends.includes(b.account.id));
  await service.command(a.token, 'experiment', { a: 'fire', b: 'water' });
  await service.social(a.token, 'share-discovery', { id: 'steam' });
  const share = service.world(b.token).shares[0]; assert.equal(Reflect.get(share, 'reaction'), undefined);
  assert.equal((await service.social(b.token, 'reveal-share', { id: share.id })).result.reaction!.id, 'steam');
  assert.equal(service.me(b.token).player!.discoveries.length, 0);
  await service.social(a.token, 'guild-create', { name: 'Curious Few' });
  const guild = service.world(a.token).guilds[0];
  await service.social(b.token, 'guild-join', { id: guild.id });
  await service.social(a.token, 'guild-donate');
  assert.equal(service.world(b.token).guilds[0].knowledge, 5);
  await service.social(a.token, 'guild-discovery', { id: 'steam' });
  assert.ok(service.world(b.token).guilds[0].discoveries.includes('steam'));
});
test('community challenges reject impossible content and validate every solution step', async t => {
  const { service } = await fixture(t), a = await service.register('Alchemist_A', 'test-only-password-123'), b = await service.register('Alchemist_B', 'test-only-password-456');
  await service.command(a.token, 'experiment', { a: 'fire', b: 'water' });
  await assert.rejects(service.social(a.token, 'challenge-create', { name: 'Impossible', target: 'steam', allowed: ['light', 'earth'] }), /cannot/);
  await service.social(a.token, 'challenge-create', { name: 'Make a cloud', target: 'steam', allowed: ['fire', 'water'] });
  const challenge = service.world(b.token).challenges[0];
  await assert.rejects(service.social(b.token, 'challenge-solve', { id: challenge.id, steps: [['storm-cloud', 'lightning']] }), /unavailable/);
  await service.social(b.token, 'challenge-solve', { id: challenge.id, steps: [['fire', 'water']] });
  const knowledge = service.me(b.token).player!.knowledge;
  await service.social(b.token, 'challenge-solve', { id: challenge.id, steps: [['fire', 'water']] });
  assert.equal(service.me(b.token).player!.knowledge, knowledge);
});

test('community challenge authors earn XP once per other solver and not for their own solution', async t => {
  const { service, directory } = await fixture(t);
  const author = await service.register('AuthorScholar', 'test-only-password-123'), solver = await service.register('SolverScholar', 'test-only-password-123');
  await service.command(author.token, 'experiment', { a: 'fire', b: 'water' });
  await service.social(author.token, 'challenge-create', { name: 'Steam study', target: 'steam', allowed: ['fire', 'water'] });
  const id = service.world(solver.token).challenges[0].id, before = service.me(author.token).player!.xp;
  const solution = { id, steps: [['fire', 'water']] };
  await Promise.all([service.social(solver.token, 'challenge-solve', solution), service.social(solver.token, 'challenge-solve', solution)]);
  assert.equal(service.me(author.token).player!.xp, before + 10);
  await service.social(author.token, 'challenge-solve', solution);
  assert.equal(service.me(author.token).player!.xp, before + 10 + 20);
  const reopened = await createService(directory), xp = reopened.me(author.token).player!.xp;
  await reopened.social(solver.token, 'challenge-solve', solution);
  assert.equal(reopened.me(author.token).player!.xp, xp);
});
test('PvP uses validated opposing teams and rewards a daily opponent once', async t => {
  const { service } = await fixture(t), a = await service.register('Alchemist_A', 'test-only-password-123'), b = await service.register('Alchemist_B', 'test-only-password-456');
  const first = await service.startBattle(a.token, { kind: 'pvp', opponentId: b.account.id });
  assert.equal(first.config.normalized, true); assert.deepEqual(first.config.opponentTeam, b.player.team);
  await service.finishBattle(a.token, first.battleId); const rating = service.me(a.token).account!.rating;
  const second = await service.startBattle(a.token, { kind: 'pvp', opponentId: b.account.id });
  await service.finishBattle(a.token, second.battleId); assert.equal(service.me(a.token).account!.rating, rating);
});
test('HTTP rejects cross-origin writes and keeps world files private', async t => {
  const { directory } = await fixture(t), { server } = await createAppServer({ dataDir: directory, adminToken: 'test-administrator-secret' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  assert.equal((await fetch(origin + '/.data/world.json')).status, 404);
  assert.equal((await fetch(origin + '/server/service.js')).status, 404);
  const rejected = await fetch(origin + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.invalid' }, body: JSON.stringify({ name: 'Attack', password: 'test-only-password-123' }) });
  assert.equal(rejected.status, 403);
  assert.equal((await fetch(origin + '/api/world')).status, 401);
  const created = await fetch(origin + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ name: 'ValidUser', password: 'test-only-password-123' }) });
  assert.equal(created.status, 200); assert.match(created.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict/);
  const update = await fetch(origin + '/api/admin/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"enabled":true}' });
  assert.equal(update.status, 403);
  assert.equal((await fetch(origin + '/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(origin + '/api/content')).status, 200);
});


test('weekly guild war rewards cannot be repeated by changing guilds', async t => {
  const { service } = await fixture(t);
  const a = await service.register('Traveller_A', 'test-only-password-123');
  const b = await service.register('Defender_B', 'test-only-password-456');
  await service.social(a.token, 'guild-create', { name: 'First Home' });
  await service.social(b.token, 'guild-create', { name: 'Rival Home' });
  const first = await service.startBattle(a.token, { kind: 'guild-war', opponentId: b.account.id });
  await service.finishBattle(a.token, first.battleId);
  const gold = service.me(a.token).player!.gold;
  await service.social(a.token, 'guild-leave');
  await service.social(a.token, 'guild-create', { name: 'Second Home' });
  const second = await service.startBattle(a.token, { kind: 'guild-war', opponentId: b.account.id });
  await service.finishBattle(a.token, second.battleId);
  const world = service.world(a.token), guild = world.guilds.find(g => g.id === world.self.guildId)!;
  assert.equal(guild.war!.score, 0);
  assert.equal(service.me(a.token).player!.gold, gold);
  assert.equal(service.store.data.users.find(u => u.id === a.account.id)!.warClaims!.length, 1);
});
test('leaderboards show the new season rating before the first duel', async t => {
  const { service } = await fixture(t), a = await service.register('Season_A', 'test-only-password-123');
  await service.store.transaction(db => { const user = db.users[0]; user.season = '2000-01'; user.rating = 1500; });
  assert.equal(service.world(a.token).self.rating, 1000);
  assert.equal(service.world(a.token).players[0].rating, 1000);
});
