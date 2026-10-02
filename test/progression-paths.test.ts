import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, encounterUnlocked, claimBattle, updateLoadout, moveVessel } from '../src/core/progression.js';
import { ELEMENTS, RESEARCH, ENCOUNTERS } from '../src/data/content.js';
import { TALENTS } from '../src/data/systems.js';
import { makeBattleConfig, simulateBattle, seededRandom } from '../src/core/combat.js';
import { startRun, runBattleConfig, completeRunBattle, chooseRunReward } from '../src/core/modes.js';
import { challengeConfig, claimChallenge } from '../src/core/challenges.js';
import { normalizeSave } from '../src/core/save.js';
import { normalizeReplay } from '../src/core/replay.js';

test('all 63 campaign locations have a winning route using developed compositions', () => {
  const player = createPlayer();
  player.research = RESEARCH.map(r => r.id); player.talents = TALENTS.map(t => t.id);
  player.mastery = Object.fromEntries(ELEMENTS.map(e => [e.id, 90]));
  const original = structuredClone(player.team);
  const counter = [['thermal-shock', 'earth'], ['nature', 'water'], ['dispel', 'plasma'], ['earth', 'poison'], ['storm-surge', 'nature']];
  for (const encounter of ENCOUNTERS) {
    assert.ok(encounterUnlocked(player, encounter.id), encounter.id);
    player.team = structuredClone(original);
    let battle = simulateBattle(makeBattleConfig(player, encounter.id, 42), { captureFrames: false });
    if (battle.outcome !== 'victory') { player.team.forEach((s, i) => s.elements = counter[i]); battle = simulateBattle(makeBattleConfig(player, encounter.id, 42), { captureFrames: false }); }
    if (battle.outcome !== 'victory') { const pairs = [['gravity', 'storm-surge'], ['magma', 'thunderstorm'], ['eclipse', 'metal'], ['conductive', 'firestorm'], ['fire', 'spirit']]; player.team.forEach((s, i) => s.elements = pairs[i]); battle = simulateBattle(makeBattleConfig(player, encounter.id, 42), { captureFrames: false }); }
    assert.equal(battle.outcome, 'victory', encounter.id);
    claimBattle(player, battle, encounter.id);
  }
  assert.equal(player.campaign.length, 63);
});
test('eight-floor roguelite completes, persists between every floor and pays once', () => {
  let player = createPlayer(); startRun(player, 'roguelite', 42, ['light', 'shadow']);
  for (let floor = 1; floor <= 8; floor++) {
    const battle = simulateBattle(runBattleConfig(player), { captureFrames: false });
    assert.equal(battle.outcome, 'victory', 'floor ' + floor);
    assert.ok(completeRunBattle(player, battle));
    assert.equal(completeRunBattle(player, battle), false);
    if (floor < 8) { const index = player.run!.rewards.findIndex(r => r.type === 'rest'); chooseRunReward(player, index < 0 ? 0 : index); }
    player = normalizeSave(player);
  }
  assert.equal(player.run!.state, 'complete'); assert.equal(player.runsWon, 1); assert.equal(player.gold, 160);
});
test('trials enforce date-bound rewards and no-healing restrictions', () => {
  const player = createPlayer(), now = Date.UTC(2026, 9, 1);
  const config = challengeConfig(player, 'daily', now);
  const battle = simulateBattle(config, { captureFrames: false });
  if (config.modifiers.healingMultiplier === 0) assert.equal(battle.report.healing, 0);
  if (battle.outcome === 'victory') { assert.ok(claimChallenge(player, battle, now)); assert.equal(claimChallenge(player, battle, now), false); }
  assert.equal(claimChallenge(createPlayer(), battle, now + 86400000), false);
});
test('malformed loadout and movement commands cannot corrupt a formation', () => {
  const player = createPlayer(), before = structuredClone(player.team);
  for (const patch of [{ elements: null }, { elements: 'xx' }, { relic: '' }, { priority: null }, { targeting: false }]) assert.equal(updateLoadout(player, 0, patch), false);
  for (const index of [-2, 99, '0', null, 1.5]) assert.equal(moveVessel(player, index, 1), false);
  assert.deepEqual(player.team, before);
});
test('random compositions preserve finite resources and deterministic outcomes', () => {
  const rng = seededRandom(813);
  for (let sample = 0; sample < 80; sample++) {
    const player = createPlayer();
    player.team.forEach(s => { s.elements = [0, 1].map(() => ELEMENTS[Math.floor(rng() * ELEMENTS.length)].id); });
    const config = makeBattleConfig(player, ENCOUNTERS[sample % ENCOUNTERS.length].id, sample);
    const battle = simulateBattle(config, { captureFrames: false });
    assert.ok(battle.duration <= 90);
    for (const unit of battle.final.units) { assert.ok(Number.isFinite(unit.hp) && unit.hp >= 0 && unit.hp <= unit.maxHp); assert.ok(Number.isFinite(unit.shield) && unit.shield >= 0); }
    if (sample % 10 === 0) assert.deepEqual(battle, simulateBattle(config, { captureFrames: false }));
  }
});
test('generated run and trial replays survive saves without losing modifiers', () => {
  const player = createPlayer(); startRun(player, 'infinite-alchemy', 812, ['light', 'shadow']);
  for (const config of [runBattleConfig(player), challengeConfig(player, 'weekly')]) {
    const first = simulateBattle(config, { captureFrames: false });
    player.lastReplay = config;
    const replay = normalizeSave(player).lastReplay;
    assert.ok(replay);
    const second = simulateBattle(replay, { captureFrames: false });
    assert.equal(second.outcome, first.outcome); assert.deepEqual(second.report, first.report); assert.deepEqual(second.final, first.final);
  }
  assert.equal(normalizeReplay({ ...player.lastReplay, team: [{ vessel: '__proto__' }] }), null);
});
