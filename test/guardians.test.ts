import test from 'node:test';
import assert from 'node:assert/strict';
import type { UnitDefinition } from '../src/types.js';
import { BALANCE, ENEMIES, ENEMY_BY_ID, ENCOUNTERS, ELEMENT_BY_ID } from '../src/data/content.js';
import { STORY_SCENES, STORY_CHARACTERS } from '../src/data/scenes.js';
import { createPlayer, claimBattle } from '../src/core/progression.js';
import { simulateBattle, makeBattleConfig } from '../src/core/combat.js';
import { normalizeReplay } from '../src/core/replay.js';
import { normalizeSave } from '../src/core/save.js';
import { recordBattleCodex } from '../src/core/codex.js';
import { validatePack, contentTemplate, installContentPack } from '../src/core/content-tools.js';
import { CONTENT_VERSION } from '../src/data/content.js';
import { renderRecoveredScenes, renderStoryScene } from '../src/ui/story-ui.js';

function guardianConfig(id: string, pair = ['earth', 'earth'], seed = 13) {
  const p = createPlayer(); p.team.forEach(s => { s.elements = [...pair]; });
  const config = makeBattleConfig(p, 'whispering-grove', seed);
  config.encounter = { ...ENCOUNTERS[0], environment: 'neutral', enemies: [id], scale: .6 };
  return config;
}
function withEnemy<T>(definition: UnitDefinition, run: () => T) {
  const original = ENEMY_BY_ID[definition.id]; ENEMY_BY_ID[definition.id] = definition;
  try { return run(); } finally { ENEMY_BY_ID[definition.id] = original; }
}

test('five guardians have distinct elemental phases and explicit counterplay', () => {
  const guardians = ENEMIES.filter(e => e.tags.includes('boss'));
  assert.equal(guardians.length, 5);
  for (const g of guardians) {
    assert.ok(g.phases!.length >= 2); assert.ok(g.description);
    assert.ok(g.phases!.every(p => p.elements?.length === 2));
    assert.ok([...(g.behaviors ?? []), ...g.phases!.flatMap(p => p.behaviors ?? [])].every(b => b.suppressedBy?.length && b.cooldown > 0));
  }
});

test('Molten King changes casts across all three phases without mutating shared content', () => {
  const before = structuredClone(ENEMY_BY_ID['molten-king']);
  const config = guardianConfig('molten-king', ['water', 'lightning']);
  const first = simulateBattle(config), second = simulateBattle(config);
  assert.deepEqual(first, second); assert.deepEqual(ENEMY_BY_ID['molten-king'], before);
  assert.deepEqual(first.report.mechanics['molten-king'].phases, [1, 2, 3]);
  assert.deepEqual(first.report.phases.map(p => p.elements), [['fire', 'earth'], ['magma', 'earth'], ['magma', 'fire']]);
  for (const phase of first.report.phases) {
    const next = first.events.find(e => e.type === 'cast' && e.source === phase.unit && e.time >= phase.time);
    if (next) assert.ok(phase.elements.includes(next.element!) || first.report.phases.some(p => p.unit === phase.unit && p.time > phase.time && p.time <= next.time));
  }
});

test('one hit can cross several phase thresholds exactly once and snapshots retain current rules', () => {
  const definition: UnitDefinition = { ...ENEMY_BY_ID.slime, hp: 200, armor: 0, phases: [
    { below: .99, attackMultiplier: 1, intervalMultiplier: 1, label: 'First', elements: ['wind', 'water'] },
    { below: .98, attackMultiplier: 1, intervalMultiplier: 1, label: 'Second', elements: ['ice', 'earth'], immunities: ['wet'] },
    { below: .97, attackMultiplier: 1, intervalMultiplier: 1, label: 'Third', elements: ['fire', 'earth'], immunities: [] },
  ] };
  withEnemy(definition, () => {
    const config = guardianConfig('slime'); config.encounter!.scale = 1; config.encounter!.environment = 'rain';
    const battle = simulateBattle(config), phases = battle.report.phases;
    assert.deepEqual(phases.map(p => p.index), [1, 2, 3]); assert.equal(new Set(phases.map(p => p.time)).size, 1);
    const unit = battle.frames.find(f => f.time === phases[0].time)!.units.find(u => u.side === 'enemy')!;
    assert.equal(unit.phaseLabel, 'Third'); assert.deepEqual(unit.elements, ['fire', 'earth']); assert.deepEqual(unit.immunities, []);
    assert.equal(unit.statuses.some(s => s.id === 'wet'), false);
  });
});

test('phase immunity changes expose Tide Empress during her broken-shell phase', () => {
  const battle = simulateBattle(guardianConfig('tide-empress', ['ice', 'lightning']));
  assert.ok(battle.frames.some(f => f.units.some(u => u.definitionId === 'tide-empress' && u.phase === 1 && !u.immunities.includes('freeze'))));
  assert.ok(battle.events.some(e => e.type === 'status' && e.target === 'enemy-0' && e.status === 'freeze'));
  assert.ok(battle.frames.some(f => f.units.some(u => u.definitionId === 'tide-empress' && u.phase === 2 && u.immunities.includes('freeze') && !u.statuses.some(s => s.id === 'freeze'))));
});

test('burn suppresses Plague Mother infection while uncountered casts spread actual poison', () => {
  const ordinary = simulateBattle(guardianConfig('plague-mother'));
  assert.ok(ordinary.events.some(e => e.type === 'behavior' && e.id === 'spore-bloom'));
  assert.ok(ordinary.events.some(e => e.type === 'status' && e.source === 'enemy-0' && e.status === 'poison'));
  const cooled = simulateBattle(guardianConfig('plague-mother', ['fire', 'fire']));
  assert.ok(cooled.report.mechanics['plague-mother'].counters.burn);
  assert.equal(cooled.events.some(e => e.type === 'behavior' && e.id === 'spore-bloom'), false);
  assert.ok(cooled.events.some(e => e.type === 'counter' && e.status === 'burn'));
});

test('guardian behaviors enforce cooldowns across repeated casts and phase replacements', () => {
  const battle = simulateBattle(guardianConfig('plague-mother'));
  const casts = battle.events.filter(e => e.type === 'behavior' && e.id === 'spore-bloom');
  assert.ok(casts.length >= 2);
  for (let i = 1; i < casts.length; i++) assert.ok(casts[i].time - casts[i - 1].time >= 9);
  assert.ok(battle.events.some(e => e.type === 'summon'));
  assert.ok(battle.final.units.filter(u => u.side === 'enemy').length <= 8);
});

test('phase modifiers affect emitted status duration and phase effects apply queued elements', () => {
  const definition: UnitDefinition = { ...ENEMY_BY_ID.slime, hp: 200, armor: 0, phases: [{ below: .99, attackMultiplier: 1, intervalMultiplier: 1, label: 'Hot core', elements: ['fire', 'fire'], modifiers: { statusDuration: { burn: 3 } }, effects: [{ type: 'applyElement', element: 'fire' }] }] };
  withEnemy(definition, () => {
    const config = guardianConfig('slime'); config.encounter!.scale = 1;
    const battle = simulateBattle(config);
    assert.ok(battle.frames.some(f => f.units.some(u => u.side === 'ally' && u.statuses.some(s => s.id === 'burn' && s.remaining >= 8))));
    assert.ok(battle.events.some(e => e.type === 'element' && e.source === 'enemy-0' && e.element === 'fire' && e.time === battle.report.phases[0].time));
  });
});

test('contribution totals match actual damage, absorbed shields, effective healing and cleanses', () => {
  const p = createPlayer(); p.team[0].abilities = ['ward'];
  const battle = simulateBattle(makeBattleConfig(p, 'whispering-grove', 12));
  const allies = battle.final.units.filter(u => u.side === 'ally').map(u => battle.report.units[u.id]);
  assert.equal(allies.reduce((n, s) => n + s.damage, 0), battle.report.totalDamage);
  assert.equal(allies.reduce((n, s) => n + s.healing, 0), battle.report.healing);
  for (const unit of battle.final.units) {
    const s = battle.report.units[unit.id];
    assert.equal(s.damageTaken, battle.events.filter(e => e.type === 'damage' && e.target === unit.id).reduce((n, e) => n + e.amount!, 0));
    assert.equal(s.absorbed, battle.events.filter(e => e.type === 'damage' && e.target === unit.id).reduce((n, e) => n + e.absorbed!, 0));
    assert.equal(s.healing, battle.events.filter(e => e.type === 'heal' && e.source === unit.id).reduce((n, e) => n + e.amount!, 0));
    assert.equal(s.shield, battle.events.filter(e => e.type === 'shield' && e.source === unit.id).reduce((n, e) => n + e.amount!, 0));
    assert.equal(s.cleanses, battle.events.filter(e => e.type === 'cleanse' && e.source === unit.id).reduce((n, e) => n + e.amount!, 0));
  }
  assert.ok(battle.report.units['ally-0'].abilityCasts); assert.ok(allies.some(s => s.shield > 0));
});

test('reaction support attributes real healing and shields instead of ranking by damage alone', () => {
  const p = createPlayer(); p.team.forEach(s => { s.elements = ['ice', 'earth']; });
  const battle = simulateBattle(makeBattleConfig(p, 'whispering-grove', 12));
  assert.ok(battle.report.reactionSupport['frost-armor'].shield > 0);
  assert.equal(battle.report.damageByReaction['frost-armor'] ?? 0, 0);
  p.team.forEach(s => { s.elements = ['light', 'shadow']; });
  const healing = simulateBattle(makeBattleConfig(p, 'whispering-grove', 12));
  assert.ok(healing.report.reactionSupport.eclipse.healing > 0);
  assert.ok(healing.report.reactionSupport.eclipse.statuses > 0);
});

test('metrics and mechanic observations survive event-log truncation and captureFrames settings', () => {
  const config = guardianConfig('plague-mother'), baseline = simulateBattle(config, { captureFrames: false });
  const old = BALANCE.maxLogEvents;
  try {
    BALANCE.maxLogEvents = 2;
    const clipped = simulateBattle(config);
    assert.equal(clipped.events.length, 2); assert.deepEqual(clipped.report, baseline.report); assert.deepEqual(clipped.final.units, baseline.final.units);
  } finally { BALANCE.maxLogEvents = old; }
});

test('observed creature mechanics persist without inventing unobserved or invalid phases', () => {
  const p = createPlayer(), battle = simulateBattle(guardianConfig('plague-mother'));
  recordBattleCodex(p, battle); recordBattleCodex(p, battle);
  assert.deepEqual(p.creatureKnowledge['plague-mother'].phases, [1, 2]);
  assert.deepEqual(p.creatureKnowledge['plague-mother'].behaviors, ['spore-bloom']);
  assert.deepEqual(normalizeSave(p).creatureKnowledge, p.creatureKnowledge);
  p.creatureKnowledge['plague-mother'] = { phases: [-1, 1, 1, 3, 999], behaviors: ['missing', 'spore-bloom', 'spore-bloom'] };
  assert.deepEqual(normalizeSave(p).creatureKnowledge['plague-mother'], { phases: [1], behaviors: ['spore-bloom'] });
  const legacy = createPlayer(); delete (legacy as Partial<typeof legacy>).creatureKnowledge;
  assert.deepEqual(normalizeSave(legacy).creatureKnowledge, {});
});

test('guardian phase, behavior and contribution replay is deterministic after save normalization', () => {
  const p = createPlayer(), config = guardianConfig('molten-king', ['water', 'lightning']);
  const original = simulateBattle(config); p.lastReplay = config;
  for (const replay of [normalizeReplay(config)!, normalizeSave(p).lastReplay!]) {
    const repeated = simulateBattle(replay);
    for (const key of ['events', 'frames', 'final', 'report', 'outcome', 'duration'] as const) assert.deepEqual(repeated[key], original[key]);
  }
});

test('content packs reject malformed phase ordering, references and unbounded behaviors', () => {
  const enemy = contentTemplate('enemies'), phase = { below: .5, attackMultiplier: 1, intervalMultiplier: 1, label: 'Shift' };
  const behavior = { id: 'new-behavior', name: 'New behavior', trigger: 'OnAbilityCast', cooldown: 8, effects: [{ type: 'shield', scale: 1, recipient: 'source' }] };
  const valid = { ...enemy, phases: [{ ...phase, elements: ['fire', 'earth'], immunities: ['burn'], behaviors: [behavior] }] };
  assert.deepEqual(validatePack({ id: 'guardian-pack', version: 1, enemies: [valid] }), []);
  const invalid = [
    { phases: [phase, { ...phase, below: .6 }] }, { phases: [{ ...phase, below: 1 }] }, { phases: [{ ...phase, elements: ['missing', 'earth'] }] },
    { phases: [{ ...phase, immunities: ['missing'] }] }, { phases: [{ ...phase, modifiers: { startingShield: 10 } }] },
    { behaviors: [{ ...behavior, cooldown: 0 }] }, { behaviors: [{ ...behavior, trigger: 'unbounded' }] },
    { behaviors: [{ ...behavior, suppressedBy: ['missing'] }] }, { behaviors: [behavior, behavior] }, { behaviors: [{ ...behavior, effects: [{ type: 'summon', enemy: 'missing', scale: .5 }] }] },
  ];
  for (const patch of invalid) assert.ok(validatePack({ id: 'bad-guardian', version: 1, enemies: [{ ...enemy, ...patch }] }).length, JSON.stringify(patch));
});

test('character scenes cover every elemental chapter and expose recovered dialogue only after victory', () => {
  assert.equal(new Set(STORY_SCENES.map(s => s.encounter)).size, STORY_SCENES.length);
  for (const scene of STORY_SCENES) {
    assert.ok(ENCOUNTERS.some(e => e.id === scene.encounter)); assert.ok(STORY_CHARACTERS.some(c => c.id === scene.character));
    assert.ok(scene.before.length <= 2 && scene.after.length <= 2);
  }
  for (const c of STORY_CHARACTERS) assert.ok(ELEMENT_BY_ID[c.element]);
  const p = createPlayer(), encounter = ENCOUNTERS[0];
  assert.equal(renderRecoveredScenes(p), ''); assert.equal(renderStoryScene(p, encounter, 'after'), '');
  assert.match(renderStoryScene(p, encounter, 'before'), /Lyra/);
  const battle = simulateBattle(makeBattleConfig(p, encounter.id, 42)); claimBattle(p, battle, 'scene-test');
  assert.match(renderStoryScene(p, encounter, 'after'), /second element changes/);
  assert.match(renderRecoveredScenes(normalizeSave(p)), /People of the broken world/);
  assert.equal(renderStoryScene(p, ENCOUNTERS.find(e => e.id === 'eclipse-12')!, 'before'), '');
});

test('invalid guardian updates cannot partially replace authored enemies', () => {
  const version = CONTENT_VERSION, original = ENEMY_BY_ID.slime;
  const replacement = { ...original, version: 2, phases: [{ below: .5, attackMultiplier: 1, intervalMultiplier: 1, label: 'Shift', elements: ['missing', 'earth'] }] };
  assert.throws(() => installContentPack({ id: 'invalid-guardian', version: 1, enemies: [{ ...contentTemplate('enemies'), id: 'new-guardian' }, replacement] }));
  assert.equal(CONTENT_VERSION, version); assert.equal(ENEMY_BY_ID.slime, original); assert.equal(ENEMY_BY_ID['new-guardian'], undefined);
});
