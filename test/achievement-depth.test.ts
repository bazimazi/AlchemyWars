import test from 'node:test';
import assert from 'node:assert/strict';
import type { BattleResult } from '../src/types.js';
import { createPlayer, claimBattle, discover } from '../src/core/progression.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { recordBattleLearning } from '../src/core/learning.js';
import { normalizeSave } from '../src/core/save.js';
import { claimAchievement, questProgress, refreshAchievements, track } from '../src/core/meta.js';
import { formationKey, saveLoadout, renameLoadout } from '../src/core/formations.js';
import { challengeConfig, settleChallengeBattle } from '../src/core/challenges.js';
import { ACHIEVEMENTS } from '../src/data/systems.js';
import { BALANCE, ELEMENTS, ENCOUNTERS, REACTIONS } from '../src/data/content.js';

const achievement = (id: string) => ACHIEVEMENTS.find(a => a.id === id)!;
function fireless() {
  const p = createPlayer(); p.team.forEach(s => s.elements = ['light', 'shadow']);
  const battle = simulateBattle(makeBattleConfig(p, 'whispering-grove', 42));
  assert.equal(battle.outcome, 'victory'); return { p, battle };
}
function poisonedGuardian() {
  const p = createPlayer(), target = ENCOUNTERS.find(e => e.enemies.includes('molten-king'))!;
  p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.indexOf(target)).map(e => e.id);
  p.discoveries = REACTIONS.map(r => r.id); p.owned = ELEMENTS.map(e => e.id);
  p.mastery = Object.fromEntries(ELEMENTS.map(e => [e.id, 300])); p.research = ['warding', 'resonance', 'cultivation'];
  p.team.forEach((s, i) => { s.elements = i === 0 ? ['poison', 'water'] : ['gravity', 'storm-surge']; p.vesselXp[s.vessel] = 450; });
  const battle = simulateBattle(makeBattleConfig(p, target.id, 42));
  assert.equal(battle.outcome, 'victory'); assert.ok(battle.report.statusDamage['enemy-0'].poison > 0);
  return { p, battle };
}

test('secret and high-rarity achievements use discovered recipe definitions and reachable targets', () => {
  const p = createPlayer(), secret = REACTIONS.find(r => r.secret)!, legends = REACTIONS.filter(r => ['Legendary', 'Mythic'].includes(r.rarity));
  assert.ok(REACTIONS.length >= 100); assert.ok(legends.length >= 5);
  assert.equal(claimAchievement(p, 'first-secret'), false);
  discover(p, secret); refreshAchievements(p); assert.equal(questProgress(p, achievement('first-secret')), 1);
  for (const r of legends.slice(0, 5)) discover(p, r);
  assert.equal(questProgress(p, achievement('five-legends')), 5);
  assert.ok(claimAchievement(p, 'five-legends')); assert.equal(claimAchievement(p, 'five-legends'), false);
  for (const r of REACTIONS.slice(0, 100)) discover(p, r);
  assert.ok(questProgress(p, achievement('century-of-discoveries')) >= 100);
  assert.ok(claimAchievement(normalizeSave(p), 'century-of-discoveries'));
});

test('fireless victories require actual actions and exclude Fire in formations, damage and recipes', () => {
  const { p, battle } = fireless();
  recordBattleLearning(p, battle); assert.equal(p.learning.firelessWins, 1);
  const variants: Partial<BattleResult>[] = [
    { outcome: 'defeat' as const },
    { config: { ...battle.config, team: battle.config.team.map((s, i) => i === 0 ? { ...s, elements: ['light', 'fire'] } : s) } },
    { report: { ...battle.report, elementCasts: { fire: 1 } } },
    { report: { ...battle.report, damageByElement: { fire: 10 } } },
    { report: { ...battle.report, reactions: { steam: 1 } } },
    { report: { ...battle.report, units: {} } },
  ];
  for (const patch of variants) {
    const before: number = p.learning.firelessWins; recordBattleLearning(p, { ...battle, ...patch }); assert.equal(p.learning.firelessWins, before);
  }
});

test('poison achievement requires health damage from allied Poison ticks on a defeated guardian', () => {
  const { p, battle } = poisonedGuardian(); claimBattle(p, battle, 'poison-achievement');
  assert.equal(p.learning.poisonBossWins, 1); assert.ok(p.achievements.includes('poison-boss'));
  assert.ok(claimAchievement(p, 'poison-boss')); const paid = p.gold;
  claimBattle(p, battle, 'poison-achievement'); assert.equal(p.learning.poisonBossWins, 1); assert.equal(p.gold, paid);
  const baseline = fireless().p;
  const variants: Partial<BattleResult>[] = [
    { outcome: 'defeat' as const },
    { report: { ...battle.report, statusDamage: {} } },
    { report: { ...battle.report, statusDamage: { 'enemy-0': { poison: 0 }, 'enemy-1': { poison: 50 } } } },
    { final: { ...battle.final, units: battle.final.units.map(u => ({ ...u, hp: Math.max(1, u.hp) })) } },
  ];
  for (const patch of variants) recordBattleLearning(baseline, { ...battle, ...patch });
  assert.equal(baseline.learning.poisonBossWins, 0);
});

test('status damage attribution uses actual enemy health loss and remains independent of log clipping', () => {
  const { battle } = poisonedGuardian();
  const ticks = battle.events.filter(e => e.type === 'damage' && e.status === 'poison' && e.source?.startsWith('ally-') && e.target === 'enemy-0');
  assert.equal(battle.report.statusDamage['enemy-0'].poison, ticks.reduce((n, e) => n + (e.amount ?? 0), 0));
  const before = BALANCE.maxLogEvents;
  try {
    BALANCE.maxLogEvents = 1;
    const clipped = simulateBattle(battle.config);
    assert.equal(clipped.events.length, 1); assert.deepEqual(clipped.report.statusDamage, battle.report.statusDamage);
    assert.equal(clipped.outcome, battle.outcome);
  } finally { BALANCE.maxLogEvents = before; }
  assert.deepEqual(simulateBattle(battle.config).report, battle.report);
});

test('shield absorption and poison-immune guardians cannot supply Poison health damage', () => {
  const { battle } = poisonedGuardian();
  const immune = simulateBattle({ ...battle.config, encounter: { ...ENCOUNTERS[0], id: 'immune-test', enemies: ['plague-mother'], scale: .3 } });
  assert.equal(immune.report.statusDamage['enemy-0']?.poison, undefined);
  const shielded = simulateBattle({ ...battle.config, normalized: true, modifiers: { startingShield: 10000 }, encounter: { ...ENCOUNTERS[0], id: 'shield-test', enemies: ['molten-king'], scale: .1 } });
  assert.equal(shielded.report.statusDamage['enemy-0']?.poison, undefined);
});

test('tested build progress uses settled formations once and ignores names, seeds and account power', () => {
  const { p, battle } = fireless();
  assert.equal(p.learning.testedBuilds.length, 0); saveLoadout(p, 'Theory'); renameLoadout(p, 0, 'Another name');
  assert.equal(p.learning.testedBuilds.length, 0);
  claimBattle(p, battle, 'first-build'); claimBattle(p, battle, 'first-build');
  claimBattle(p, simulateBattle({ ...battle.config, seed: 27, mastery: { light: 300 } }), 'same-build');
  assert.equal(p.learning.testedBuilds.length, 1);
  p.team[0].priority = 'core'; claimBattle(p, simulateBattle(makeBattleConfig(p, 'whispering-grove', 28)), 'next-build');
  assert.equal(p.learning.testedBuilds.length, 2); assert.equal(questProgress(p, achievement('hundred-builds')), 2);
});

test('a hundred tested builds stay bounded, persist and can earn their reward only once', () => {
  const { p, battle } = fireless();
  for (let i = 0; i < 110; i++) {
    const team = structuredClone(battle.config.team);
    team[0].elements = [p.owned[i % 10], p.owned[Math.floor(i / 10) % 10]];
    team[1].targeting = i < 100 ? 'front' : 'weakest';
    recordBattleLearning(p, { ...battle, config: { ...battle.config, team } });
  }
  assert.equal(p.learning.testedBuilds.length, 100);
  const restored = normalizeSave(p); assert.deepEqual(restored.learning.testedBuilds, p.learning.testedBuilds);
  assert.ok(claimAchievement(restored, 'hundred-builds')); const gold = restored.gold;
  assert.equal(claimAchievement(normalizeSave(restored), 'hundred-builds'), false); assert.equal(restored.gold, gold);
});

test('competitive builds count the two active ability slots rather than an unused third slot', () => {
  const { p, battle } = fireless();
  const team = structuredClone(battle.config.team); team[0].abilities = ['ward', 'mend', 'strike'];
  recordBattleLearning(p, { ...battle, config: { ...battle.config, team, normalized: true } });
  team[0].abilities = ['ward', 'mend']; assert.equal(p.learning.testedBuilds[0], formationKey(team));
  team[0].abilities.push('renewal'); recordBattleLearning(p, { ...battle, config: { ...battle.config, team, normalized: true } });
  assert.equal(p.learning.testedBuilds.length, 1);
});

test('new learning facts survive pruned analytics and migrate without inventing past victories', () => {
  const { p, battle } = fireless(); claimBattle(p, battle, 'learning-persistence');
  for (let i = 0; i < 1100; i++) track(p, 'noise');
  assert.deepEqual(normalizeSave(p).learning, p.learning);
  const raw = structuredClone(p) as unknown as Record<string, unknown>;
  delete raw.learning; const old = normalizeSave(raw);
  assert.equal(old.learning.firelessWins, 0); assert.equal(old.learning.poisonBossWins, 0); assert.deepEqual(old.learning.testedBuilds, []);
  raw.learning = { firelessWins: Infinity, poisonBossWins: -8, testedBuilds: ['bad'] };
  const repaired = normalizeSave(raw); assert.equal(repaired.learning.firelessWins, 0); assert.equal(repaired.learning.poisonBossWins, 0); assert.deepEqual(repaired.learning.testedBuilds, []);
});

test('settled trial defeats test their formation once without awarding a victory or period reward', () => {
  const p = createPlayer(), now = Date.UTC(2026, 9, 3); p.team.forEach(s => s.elements = ['poison', 'poison']);
  const battle = simulateBattle(challengeConfig(p, 'weekly', now)); assert.equal(battle.outcome, 'defeat');
  const gold = p.gold; assert.equal(settleChallengeBattle(p, battle, 'trial-defeat', now), false);
  assert.equal(p.learning.testedBuilds.length, 1); assert.equal(p.learning.poisonBossWins, 0); assert.equal(p.learning.firelessWins, 0);
  assert.equal(p.gold, gold); assert.deepEqual(p.dailyClaims, []);
  const facts = structuredClone(p.learning), restored = normalizeSave(p);
  assert.equal(settleChallengeBattle(restored, battle, 'trial-defeat', now), false); assert.deepEqual(restored.learning, facts);
});

test('invalid trial tickets cannot add build facts or block a subsequent valid settlement', () => {
  const { p } = fireless(), now = Date.UTC(2026, 9, 3), battle = simulateBattle(challengeConfig(p, 'weekly', now));
  for (const config of [{ ...battle.config, seed: battle.config.seed + 1 }, { ...battle.config, contentVersion: 'old' }, { ...battle.config, challenge: { kind: 'unknown', key: 'weekly:0' } }]) {
    assert.equal(settleChallengeBattle(p, { ...battle, config }, 'invalid-trial', now), false);
  }
  assert.deepEqual(p.claimedBattles, []); assert.equal(p.learning.testedBuilds.length, 0);
  settleChallengeBattle(p, battle, 'invalid-trial', now); assert.deepEqual(p.claimedBattles, ['invalid-trial']); assert.equal(p.learning.testedBuilds.length, 1);
});
