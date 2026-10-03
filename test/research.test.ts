import test from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH, REACTION_BY_ID, REACTIONS, BALANCE } from '../src/data/content.js';
import { RESEARCH_BRANCHES } from '../src/data/research.js';
import { ABILITIES } from '../src/data/units.js';
import { createPlayer, buyResearch, experiment, requestHint, updateLoadout } from '../src/core/progression.js';
import { craftEquipment, researchCost, applyLoadout } from '../src/core/meta.js';
import { executeCommand } from '../src/core/commands.js';
import { abilitySlots } from '../src/core/research.js';
import { normalizeSave } from '../src/core/save.js';
import { normalizeReplay } from '../src/core/replay.js';
import { simulateBattle, makeBattleConfig } from '../src/core/combat.js';
import { ReactionEngine, compareReactionPriority, conditionsMet } from '../src/core/reactions.js';
import { conditionText, experimentContext } from '../src/core/learning.js';
import { validatePack } from '../src/core/content-tools.js';

test('all seven research branches have studies and tangible unlocks', () => {
  assert.deepEqual([...new Set(RESEARCH.map(r => r.branch))].sort(), [...RESEARCH_BRANCHES].sort());
  assert.equal(RESEARCH.length, 19);
  assert.equal(REACTIONS.filter(r => r.conditions?.research?.length).length, 4);
  assert.ok(ABILITIES.some(a => a.requiresResearch?.length));
});

test('research purchases require prerequisites, charge discounted cost and cannot repeat', () => {
  const p = createPlayer(); p.knowledge = 200; p.talents = ['careful-notes', 'patient-scholar'];
  assert.equal(buyResearch(p, 'tactical-memory'), false); assert.equal(p.knowledge, 200);
  assert.ok(buyResearch(p, 'warding')); const before = p.knowledge;
  assert.ok(buyResearch(p, 'tactical-memory'));
  assert.equal(before - p.knowledge, researchCost(p, RESEARCH.find(r => r.id === 'tactical-memory')!));
  assert.equal(buyResearch(p, 'tactical-memory'), false); assert.equal(abilitySlots(p.research), 3);
  p.knowledge = 0; assert.equal(buyResearch(p, 'cultivation'), false);
});

test('laboratory research conditions use account state rather than supplied context', () => {
  const p = createPlayer(); p.knowledge = 100; experiment(p, 'fire', 'water');
  const context = { research: ['reaction-science'] };
  assert.equal(experiment(p, 'steam', 'wind', context).rule!.id, 'storm-cloud');
  assert.equal(experimentContext(context).research, undefined);
  assert.ok(buyResearch(p, 'resonance')); assert.ok(buyResearch(p, 'reaction-science'));
  assert.equal(experiment(p, 'steam', 'wind').rule!.id, 'pressure-current');
  assert.equal(experiment(p, 'steam', 'wind').isNew, false);
  assert.match(conditionText(REACTION_BY_ID['pressure-current'].conditions), /Pressure Dynamics/);
});

test('hints omit research-locked recipes and reveal them once their study is owned', () => {
  const p = createPlayer(); p.knowledge = 100; experiment(p, 'fire', 'water');
  p.discoveries = REACTIONS.filter(r => !r.conditions?.research).map(r => r.id);
  assert.equal(requestHint(p).ok, false);
  assert.ok(buyResearch(p, 'resonance')); assert.ok(buyResearch(p, 'reaction-science'));
  assert.ok(requestHint(p).ok); assert.equal(p.hints['pressure-current'], 1);
});

test('new recipes retain target health, shield, enemy count and mastery requirements', () => {
  const mineral = REACTION_BY_ID['mineral-mirror'], recovery = REACTION_BY_ID['living-recovery'], secret = REACTION_BY_ID['forgotten-collapse'];
  assert.equal(conditionsMet(mineral.conditions, { research: ['laboratory-methods'] }), false);
  assert.ok(conditionsMet(mineral.conditions, { research: ['laboratory-methods'], shielded: true }));
  assert.equal(conditionsMet(recovery.conditions, { research: ['vessel-forms'], healthRatio: .7 }), false);
  assert.ok(conditionsMet(recovery.conditions, { research: ['vessel-forms'], healthRatio: .69 }));
  const context = { research: ['forgotten-formulas'], enemyCount: 2, mastery: { arcane: 2 } };
  assert.ok(conditionsMet(secret.conditions, context));
  assert.equal(conditionsMet(secret.conditions, { ...context, mastery: { arcane: 1 } }), false);
  assert.equal(conditionsMet(secret.conditions, { ...context, enemyCount: 1 }), false);
});

test('research blueprints gate crafting, including craft-all, and persist equipment', () => {
  const p = createPlayer(); p.gold = 1000; p.essence = 200; p.shards = 20; p.knowledge = 100;
  assert.equal(craftEquipment(p, 'echo-catalyst'), false); assert.equal(p.gold, 1000);
  executeCommand(p, 'craft-all'); assert.equal(p.equipment.includes('echo-catalyst'), false);
  assert.ok(buyResearch(p, 'resonance')); assert.ok(buyResearch(p, 'catalyst-study'));
  const before = p.gold; assert.ok(craftEquipment(p, 'echo-catalyst')); assert.equal(p.gold, before - 120);
  assert.equal(craftEquipment(p, 'echo-catalyst'), false);
  assert.ok(normalizeSave(p).equipment.includes('echo-catalyst'));
  p.research = []; assert.equal(normalizeSave(p).equipment.includes('echo-catalyst'), false);
});

test('third abilities and researched abilities enforce independent unlocks and saved formations', () => {
  const p = createPlayer(); p.knowledge = 200; p.discoveries = REACTIONS.slice(0, 10).map(r => r.id);
  assert.equal(updateLoadout(p, 0, { abilities: ['ward', 'mend', 'fracture'] }), false);
  assert.equal(updateLoadout(p, 0, { abilities: ['renewal'] }), false);
  buyResearch(p, 'warding'); buyResearch(p, 'tactical-memory');
  assert.ok(updateLoadout(p, 0, { abilities: ['ward', 'mend', 'fracture'] }));
  assert.equal(updateLoadout(p, 0, { abilities: ['renewal'] }), false);
  buyResearch(p, 'cultivation'); buyResearch(p, 'vessel-forms');
  assert.ok(updateLoadout(p, 0, { abilities: ['ward', 'mend', 'renewal'] }));
  assert.deepEqual(normalizeSave(p).team[0].abilities, ['ward', 'mend', 'renewal']);
  p.loadouts = [{ name: 'Test', team: structuredClone(p.team) }]; p.research = [];
  assert.equal(applyLoadout(p, 0), false);
  assert.equal(normalizeSave(p).team[0].abilities, undefined);
});

test('third PvE ability casts actual effects and survives replay; competitive battle clips both teams', () => {
  const p = createPlayer(); p.research = ['warding', 'tactical-memory'];
  p.team.forEach(s => { s.abilities = ['ward', 'mend', 'fracture']; });
  const config = makeBattleConfig(p, 'whispering-grove', 13), battle = simulateBattle(config);
  assert.ok(battle.events.some(e => e.type === 'cast' && e.name === 'Fracturing Strike'));
  assert.ok(battle.events.some(e => e.type === 'status' && e.status === 'armor-break'));
  assert.deepEqual(simulateBattle(normalizeReplay(config)!).events, battle.events);
  config.normalized = true; config.opponentTeam = structuredClone(config.team);
  config.team.forEach(s => { s.abilities = ['ward', 'mend', 'renewal']; });
  const competitive = simulateBattle(config);
  assert.equal(competitive.events.some(e => e.type === 'cast' && ['Renewal Pulse', 'Fracturing Strike'].includes(e.name ?? '')), false);
  const twoSlots = structuredClone(config); twoSlots.research = []; [...twoSlots.team, ...twoSlots.opponentTeam!].forEach(s => { s.abilities = s.abilities!.slice(0, 2); });
  assert.deepEqual(simulateBattle(twoSlots).events, competitive.events);
  assert.deepEqual(simulateBattle(normalizeReplay(config)!).events, competitive.events);
});

test('Renewal Pulse applies healing and regeneration with a bounded cooldown', () => {
  const p = createPlayer(); p.research = ['cultivation', 'vessel-forms']; p.team[0].abilities = ['renewal'];
  const battle = simulateBattle(makeBattleConfig(p, 'whispering-grove', 13));
  const casts = battle.events.filter(e => e.type === 'cast' && e.name === 'Renewal Pulse');
  assert.ok(casts.length); assert.ok(battle.events.some(e => e.type === 'heal' && e.source === 'ally-0'));
  assert.ok(battle.events.some(e => e.type === 'status' && e.status === 'regeneration' && e.source === 'ally-0'));
  for (let i = 1; i < casts.length; i++) assert.ok(casts[i].time - casts[i - 1].time >= 16);
});

test('research recipes execute in PvE and account research is omitted from normalized combat', () => {
  const p = createPlayer(); p.team.forEach(s => { s.elements = ['steam', 'wind']; });
  p.research = ['resonance', 'reaction-science'];
  const config = makeBattleConfig(p, 'whispering-grove', 7);
  assert.ok(simulateBattle(config).report.reactions['pressure-current']);
  config.normalized = true; assert.equal(simulateBattle(config).report.reactions['pressure-current'], undefined);
});

function priorityFixture(cooldown = 90) {
  const base = { ...REACTIONS[0], priority: 1000, cooldown: 0, conditions: undefined, effects: [] };
  const alternate = { ...base, id: 'preferred-steam', priority: 0, cooldown, tags: ['alternate-test'] };
  const p = createPlayer(); p.team.forEach(s => { s.elements = ['fire', 'water']; s.reactionPriority = [alternate.id]; });
  return { base, alternate, config: makeBattleConfig(p, 'whispering-grove', 1), engine: new ReactionEngine([base, alternate]) };
}

test('player priorities beat any default priority and select same-pair alternate recipes in combat', () => {
  const { config, base, alternate, engine } = priorityFixture();
  assert.deepEqual(engine.matching('fire', 'water').map(r => r.id), [base.id, alternate.id]);
  assert.equal(engine.resolve('water', 'fire')!.id, base.id);
  assert.ok(compareReactionPriority(alternate, base, [alternate.id]) < 0);
  const battle = simulateBattle(config, { engine });
  assert.equal(battle.events.find(e => e.type === 'reaction' && e.source?.startsWith('ally'))!.id, alternate.id);
  assert.ok(battle.report.reactions[base.id], 'lower-priority rule remains eligible while preferred recipe cools down');
  assert.ok(battle.report.reactions[alternate.id]);
  for (const target of battle.final.units) {
    const events = battle.events.filter(e => e.type === 'reaction' && e.id === alternate.id && e.target === target.id);
    for (let i = 1; i < events.length; i++) assert.ok(events[i].time - events[i - 1].time >= 90);
  }
});

test('disabled recipe tags allow an eligible alternate from the same ingredient pair', () => {
  const { config, base, alternate, engine } = priorityFixture();
  config.modifiers = { disabledReactionTags: ['alternate-test'] };
  const battle = simulateBattle(config, { engine });
  assert.equal(battle.report.reactions[alternate.id], undefined); assert.ok(battle.report.reactions[base.id]);
});

test('chain guards choose another eligible same-pair rule without re-entering a reaction', () => {
  const { config, base, alternate } = priorityFixture(0);
  const loop = { ...alternate, output: 'water', effects: [{ type: 'applyElement' as const, element: 'fire' }] };
  const fallback = { ...base, output: 'water', effects: [{ type: 'applyElement' as const, element: 'fire' }] };
  const battle = simulateBattle(config, { engine: new ReactionEngine([fallback, loop]) });
  assert.ok(battle.report.chains.some(c => c.join('|') === alternate.id + '|' + base.id));
  assert.ok(battle.report.chains.every(c => c.length <= BALANCE.maxChainDepth && new Set(c).size === c.length));
  assert.ok(battle.events.length < BALANCE.maxLogEvents);
});

test('replays reject invalid or inaccessible ability sets instead of silently changing their battle', () => {
  const config = makeBattleConfig(createPlayer(), 'whispering-grove', 1);
  for (const abilities of [['missing'], ['ward', 'ward'], ['ward', 'mend', 'fracture'], ['renewal']]) {
    config.team[0].abilities = abilities; assert.equal(normalizeReplay(config), null);
  }
});

test('content packs validate research conditions against authored study IDs', () => {
  const rule = { ...REACTIONS[0], id: 'research-example', conditions: { research: ['reaction-science'] } };
  assert.deepEqual(validatePack({ id: 'research-pack', version: 1, reactions: [rule] }), []);
  rule.conditions.research = ['missing-research'];
  assert.ok(validatePack({ id: 'research-pack', version: 1, reactions: [rule] }).some(i => i.includes('invalid condition research')));
});
