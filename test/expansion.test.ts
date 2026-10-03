import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, claimBattle, updateLoadout } from '../src/core/progression.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { normalizeSave } from '../src/core/save.js';
import { normalizeReplay } from '../src/core/replay.js';
import { recordBattleCodex, normalizeChains, relationshipCounts, highestBoss } from '../src/core/codex.js';
import { composeChallenge } from '../src/core/challenge-generator.js';
import { ObjectPool } from '../src/core/pool.js';
import { ENCOUNTERS, VESSELS, REACTIONS } from '../src/data/content.js';
import { contentAudit } from '../src/core/content-tools.js';
import { competitionConfig, competitionRules } from '../src/core/competition.js';
import { VESSEL_PROFILES } from '../src/data/units.js';

test('codex stores actual ordered combat chains and creatures across save round trips', () => {
  const player = createPlayer();
  player.team.forEach(s => { s.elements = ['storm-cloud', 'lightning']; });
  const battle = simulateBattle(makeBattleConfig(player, 'whispering-grove', 182));
  recordBattleCodex(player, battle, 1000); recordBattleCodex(player, battle, 2000);
  assert.ok(player.creatures.length);
  assert.ok(battle.report.chains.some(c => c.join('|') === 'thunderstorm|chain-lightning'));
  assert.equal(player.chains.filter(c => c.reactions.join('|') === 'thunderstorm|chain-lightning').length, 1);
  assert.deepEqual(normalizeSave(player).chains, player.chains);
  assert.deepEqual(normalizeSave(player).creatures, player.creatures);
  assert.deepEqual(normalizeChains([{ reactions: ['steam', '__proto__'], firstSeen: 1 }, { reactions: 'steam', firstSeen: 2 }]), []);
  const before = relationshipCounts(player, 'fire'); player.discoveries.push('steam');
  assert.equal(relationshipCounts(player, 'fire').unknown, before.unknown - 1);
  const boss = ENCOUNTERS.find(e => e.boss)!; player.campaign.push(boss.id);
  assert.equal(highestBoss(player)!.id, boss.id);
});

test('ability slots enforce unlocks, cast real effects, respect cooldowns and survive replays', () => {
  const player = createPlayer();
  assert.equal(updateLoadout(player, 0, { abilities: ['mend'] }), false);
  assert.equal(updateLoadout(player, 0, { abilities: ['ward', 'ward'] }), false);
  assert.equal(updateLoadout(player, 0, { abilities: ['__proto__'] }), false);
  assert.ok(updateLoadout(player, 0, { abilities: ['ward'] }));
  const config = makeBattleConfig(player, 'whispering-grove', 13), battle = simulateBattle(config);
  const casts = battle.events.filter(e => e.type === 'cast' && e.name === 'Personal Ward');
  assert.ok(casts.length);
  assert.ok(battle.events.some(e => e.type === 'shield' && e.source === 'ally-0'));
  for (let i = 1; i < casts.length; i++) assert.ok(casts[i].time - casts[i - 1].time >= 9);
  assert.deepEqual(normalizeSave(player).team[0].abilities, ['ward']);
  assert.deepEqual(simulateBattle(normalizeReplay(config)!).events, battle.events);
});

test('vessel growth is capped, earned once and excluded from normalized combat', () => {
  const player = createPlayer();
  assert.ok(VESSELS.every(v => VESSEL_PROFILES[v.id]));
  const config = makeBattleConfig(player, 'whispering-grove', 6);
  const baseline = simulateBattle(config);
  player.vesselXp.golem = 450;
  const grownConfig = makeBattleConfig(player, 'whispering-grove', 6), grown = simulateBattle(grownConfig);
  assert.ok(grown.frames[0].units[0].maxHp > baseline.frames[0].units[0].maxHp);
  assert.deepEqual(simulateBattle({ ...grownConfig, normalized: true }).events, simulateBattle({ ...config, normalized: true }).events);
  claimBattle(player, grown, 'growth-claim'); const xp = { ...player.vesselXp };
  claimBattle(player, grown, 'growth-claim'); assert.deepEqual(player.vesselXp, xp); assert.equal(xp.golem, 450);
  assert.deepEqual(normalizeSave(player).vesselXp, xp);
});

test('procedural challenges compose varied deterministic rules and reject invalid limits', () => {
  const signatures = new Set<string>(), environments = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const composed = composeChallenge(seed);
    assert.deepEqual(composeChallenge(seed), composed);
    assert.equal(composed.elements.length, 2); assert.equal(composed.enemies.length, 3);
    signatures.add(JSON.stringify(composed)); environments.add(composed.environment);
  }
  assert.ok(signatures.size > 90); assert.equal(environments.size, 4);
  assert.throws(() => composeChallenge(2, { enemyCount: 50 }));
});

test('scratch pool reuses reset objects without retaining beyond capacity', () => {
  const pool = new ObjectPool<{ name?: string }>(() => ({}), item => { delete item.name; }, 1);
  const first = pool.acquire(); first.name = 'old'; pool.release(first);
  const reused = pool.acquire(); assert.equal(reused, first); assert.equal(reused.name, undefined);
  const extra = pool.acquire(); pool.release(reused); pool.release(extra);
  assert.equal(pool.retained, 1); assert.equal(pool.created, 2); assert.equal(pool.reused, 1);
});

test('authored continuations close dead ends and Mythic discoveries have follow-up uses', () => {
  assert.deepEqual(contentAudit().deadEnds, []);
  const mythics = REACTIONS.filter(r => r.rarity === 'Mythic');
  assert.equal(mythics.length, 3);
  for (const rule of mythics) assert.ok(REACTIONS.some(r => r.inputs.includes(rule.output)));
});

test('weekly normalized regeneration rules apply to both formations', () => {
  const player = createPlayer();
  for (let week = 0; week < 10; week++) {
    const now = week * 7 * 86400000, rules = competitionRules(now);
    if (!rules.mutator.modifiers.enemyRegeneration) continue;
    const battle = simulateBattle(competitionConfig(player, 'weekly-pvp', rules.pool.slice(0, 3), 10, now));
    assert.ok(battle.frames[0].units.every(u => u.statuses.some(s => s.id === 'regeneration')));
    return;
  }
  assert.fail('Expected a regeneration rule within ten weeks.');
});
