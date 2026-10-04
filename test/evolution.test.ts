import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/core/progression.js';
import { evolveElement, specializeElement, evolutionCost } from '../src/core/meta.js';
import { evolutionLevel, evolutionState } from '../src/core/evolution.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { normalizeReplay } from '../src/core/replay.js';
import { normalizeSave } from '../src/core/save.js';
import { ReactionEngine } from '../src/core/reactions.js';
import { startRun, runBattleConfig } from '../src/core/modes.js';
import { EVOLUTION_TRAITS, evolutionTrait, validateEvolutionTraits } from '../src/data/evolution.js';
import { ELEMENTS, ELEMENT_BY_ID, ENCOUNTERS, REACTION_BY_ID, STATUSES, BALANCE, validateContent } from '../src/data/content.js';
import { ENVIRONMENTS } from '../src/data/systems.js';
import { renderUnitInspector } from '../src/ui/guardian-ui.js';
import { renderEvolutionReport, renderEvolutionWorkshop } from '../src/ui/evolution-ui.js';

function configuration(element = 'fire', secondary = element) {
  const p = createPlayer(); p.evolution = { [element]: 3 }; p.owned.push(element, secondary);
  p.team = [{ ...p.team[0], elements: [element, secondary], priority: 'core', abilities: [] }];
  const config = makeBattleConfig(p, ENCOUNTERS[0].id, 42);
  config.encounter = { ...ENCOUNTERS[0], id: 'evolution-proof', environment: 'rain', enemies: ['sentinel', 'sentinel'], scale: .5 };
  return { p, config };
}
function catalyticEngine(element: string, output = element) {
  return new ReactionEngine([{ ...REACTION_BY_ID.steam, inputs: [element, 'water'], output, effects: [{ type: 'status', status: 'wet', duration: 6, intensity: 1 }] }]);
}

test('eleven evolution signatures cover every element and mixed elements follow their first matching tag', () => {
  assert.equal(EVOLUTION_TRAITS.length, 11);
  assert.deepEqual(validateEvolutionTraits(EVOLUTION_TRAITS, id => typeof id === 'string' && Object.hasOwn(STATUSES, id)), []);
  for (const element of ELEMENTS) assert.ok(EVOLUTION_TRAITS.includes(evolutionTrait(element)));
  assert.equal(evolutionTrait(ELEMENT_BY_ID.fire).id, 'kindling-trail'); assert.equal(evolutionTrait(ELEMENT_BY_ID.water).id, 'tidal-rinse');
  assert.equal(evolutionTrait(ELEMENT_BY_ID.nature).id, 'living-seed'); assert.equal(evolutionTrait(ELEMENT_BY_ID.eclipse).id, 'dawn-window');
  assert.equal(evolutionTrait({ tags: ['dark', 'radiant'] }).id, 'night-reserve'); assert.equal(evolutionTrait({ tags: ['unclassified'] }).id, 'echo-shelter');
  assert.deepEqual(validateContent(), []);
});

test('evolution validation rejects duplicate identities/tags, missing fallbacks and unsafe effects or cooldowns', () => {
  const check = (value: unknown) => validateEvolutionTraits(value, id => typeof id === 'string' && Object.hasOwn(STATUSES, id));
  for (const patch of [{ id: 'constructor' }, { tags: ['heat', 'heat'] }, { trigger: 'OnDeath' }, { cooldown: 0 }, { cooldown: Infinity }, { effects: [{ type: 'status', status: 'imaginary', duration: 3, intensity: .1 }] }, { effects: [{ type: 'summon', enemy: 'sentinel', scale: 1 }] }, { effects: [{ type: 'cleanse', count: 4 }] }, { effects: [{ type: 'shield', scale: NaN }] }]) assert.ok(check([{ ...EVOLUTION_TRAITS[0], ...patch }, EVOLUTION_TRAITS.at(-1)]).length);
  assert.ok(check([EVOLUTION_TRAITS[0], EVOLUTION_TRAITS[0], EVOLUTION_TRAITS.at(-1)]).length);
  assert.ok(check([EVOLUTION_TRAITS[0]]).length); assert.ok(check([EVOLUTION_TRAITS.at(-1), EVOLUTION_TRAITS.at(-1)]).length);
});

test('evolution spending follows each next rank, preserves mastery and rejects unowned, disabled and unaffordable choices', () => {
  const p = createPlayer(); p.gold = 360; p.essence = 90; p.mastery.fire = 44;
  assert.deepEqual(evolutionCost(p, 'fire'), { gold: 60, essence: 15, mastery: 15 });
  assert.equal(evolveElement(p, 'arcane'), false); assert.equal(specializeElement(p, 'fire', 'phoenix'), false);
  assert.equal(evolveElement(p, 'fire'), true); assert.equal(p.evolution.fire, 1); assert.equal(specializeElement(p, 'fire', 'phoenix'), true);
  assert.deepEqual(evolutionCost(p, 'fire'), { gold: 120, essence: 30, mastery: 30 }); assert.equal(evolveElement(p, 'fire'), true);
  const before = structuredClone(p); assert.equal(evolveElement(p, 'fire'), false); assert.deepEqual(p, before);
  p.mastery.fire = 45; assert.equal(evolveElement(p, 'fire'), true); assert.deepEqual([p.gold, p.essence, p.mastery.fire, p.evolution.fire], [0, 0, 45, 3]);
  assert.equal(evolveElement(p, 'fire'), false); assert.equal(specializeElement(p, 'water', 'phoenix'), false);
  const enabled = ELEMENT_BY_ID.water.enabled;
  try { ELEMENT_BY_ID.water.enabled = false; assert.equal(evolutionState(p, 'water'), null); assert.equal(evolveElement(p, 'water'), false); } finally { ELEMENT_BY_ID.water.enabled = enabled; }
});

for (const element of ['fire', 'water', 'earth', 'wind', 'lightning', 'ice', 'nature', 'poison', 'light', 'shadow', 'arcane']) test(element + ' tier-three signature triggers through the interpreted combat pipeline', () => {
  const { config } = configuration(element), trait = evolutionTrait(ELEMENT_BY_ID[element]);
  const battle = simulateBattle(config, { engine: catalyticEngine(element) });
  assert.ok(battle.report.evolution['ally-0']?.[element]?.activations > 0);
  assert.equal(battle.report.evolution['ally-0'][element].trait, trait.id);
  const events = battle.events.filter(e => e.type === 'evolution' && e.element === element);
  assert.equal(events.length, battle.report.evolution['ally-0'][element].activations);
  assert.ok(events.every(e => e.id === trait.id && e.trigger === trait.trigger && e.source === 'ally-0'));
  for (let i = 1; i < events.length; i++) assert.ok(events[i].time - events[i - 1].time >= trait.cooldown);
  assert.equal(battle.frames[0].units[0].evolutionTraits.length, 1); // Two identical slots never double-register a trait.
});

test('cast signatures require a real elemental cast, not a slotted ability or an unused evolved element', () => {
  const { config } = configuration(); config.team[0].abilities = ['fracture']; config.evolution!.ice = 3;
  const battle = simulateBattle(config), firstCast = battle.events.find(e => e.type === 'cast' && e.source === 'ally-0' && !e.name)!;
  assert.ok(battle.events.some(e => e.type === 'cast' && e.name));
  assert.ok(battle.events.filter(e => e.type === 'evolution').every(e => e.time >= firstCast.time && e.element === 'fire'));
  assert.equal(battle.report.evolution['ally-0']?.ice, undefined);
  const lower = simulateBattle({ ...config, evolution: { fire: 2 } }); assert.deepEqual(lower.report.evolution, {});
});

test('reaction signatures require an actual matching ingredient/output and work from an equipped secondary', () => {
  const { config } = configuration('water', 'ice'); config.evolution!.ice = 3;
  const unrelated = simulateBattle(config, { engine: catalyticEngine('water') }); assert.equal(unrelated.report.evolution['ally-0']?.ice, undefined);
  const matched = simulateBattle(config, { engine: catalyticEngine('water', 'ice') }); assert.ok(matched.report.evolution['ally-0'].ice.activations > 0);
  assert.equal(matched.report.elementCasts.ice, undefined); assert.ok(matched.report.units['ally-0'].shield > 0);
  assert.ok(matched.frames.some(frame => Object.keys(frame.units[0].cooldowns).includes('evolution:ice:glacial-shelter')));
  const html = renderUnitInspector(matched.frames.find(frame => frame.units[0].cooldowns['evolution:ice:glacial-shelter'])!, 'ally-0'); assert.match(html, /Ice: Glacial Shelter/);
});

test('family signature effects create real status and support changes beyond the existing generic evolution bonuses', () => {
  const fire = configuration(); fire.config.encounter!.environment = 'neutral';
  const battle = simulateBattle(fire.config, { engine: new ReactionEngine([]) });
  assert.ok(battle.frames.some(frame => frame.units.find(u => u.id === 'enemy-1')!.statuses.some(s => s.id === 'burn')));
  const old = simulateBattle({ ...fire.config, evolution: { fire: 2 } }, { engine: new ReactionEngine([]) });
  const firstCast = battle.events.find(event => event.type === 'cast' && !event.name)!.time;
  assert.ok(battle.frames.find(frame => frame.time === firstCast)!.units.find(u => u.id === 'enemy-1')!.statuses.some(s => s.id === 'burn'));
  assert.ok(!old.frames.find(frame => frame.time === firstCast)!.units.find(u => u.id === 'enemy-1')!.statuses.some(s => s.id === 'burn'));
  const water = configuration('water'), rinsed = simulateBattle(water.config, { engine: new ReactionEngine([]) });
  assert.ok(rinsed.report.units['ally-0'].cleanses > 0);
  const stone = simulateBattle(configuration('earth').config); assert.ok(stone.frames.some(frame => frame.units[0].statuses.some(s => s.id === 'taunt')));
  const nature = simulateBattle(configuration('nature').config); assert.ok(nature.frames.some(frame => frame.units[0].statuses.some(s => s.id === 'regeneration')));
});

test('Silence suppresses evolution signatures until it expires without consuming their cooldown', () => {
  const { config } = configuration(), previous = ENVIRONMENTS.neutral.startStatus; config.encounter!.environment = 'neutral';
  let battle;
  try { ENVIRONMENTS.neutral.startStatus = 'silence'; battle = simulateBattle(config); } finally { ENVIRONMENTS.neutral.startStatus = previous; }
  const first = battle.events.find(e => e.type === 'evolution')!; assert.ok(first); assert.ok(first.time >= 9);
  assert.ok(battle.frames.filter(frame => frame.time < 9).every(frame => !frame.units[0].cooldowns['evolution:fire:kindling-trail']));
});

test('competitive normalization and loaned runs exclude every account signature', () => {
  const { p, config } = configuration(); const normalized = { ...config, normalized: true };
  const battle = simulateBattle(normalized); assert.deepEqual(battle.report.evolution, {}); assert.ok(battle.final.units.every(u => !u.evolutionTraits.length));
  assert.deepEqual(simulateBattle({ ...normalized, evolution: {}, specializations: {} }).report, battle.report);
  startRun(p, 'roguelite', 42, ['fire', 'water']); const loan = simulateBattle(runBattleConfig(p)); assert.deepEqual(loan.report.evolution, {});
  const opponent = simulateBattle({ ...config, opponentTeam: structuredClone(config.team) }); assert.ok(opponent.final.units.filter(u => u.side === 'enemy').every(u => !u.evolutionTraits.length));
});

test('launched evolution is immutable and its report/inspector evidence survives clipped logs and frame-free replay', () => {
  const { p, config } = configuration(), battle = simulateBattle(config); assert.ok(Object.keys(battle.report.evolution).length);
  p.evolution = {}; p.specializations = { fire: 'phoenix' }; p.team[0].elements = ['water', 'earth'];
  assert.deepEqual(simulateBattle(normalizeReplay(config)!).report, battle.report);
  const limit = BALANCE.maxLogEvents;
  let clipped;
  try { BALANCE.maxLogEvents = 2; clipped = simulateBattle(config, { captureFrames: false }); } finally { BALANCE.maxLogEvents = limit; }
  assert.equal(clipped.events.length, 2); assert.deepEqual(clipped.report.evolution, battle.report.evolution);
  assert.match(renderEvolutionReport(clipped), /Kindling Trail/); assert.match(renderEvolutionReport(clipped), /activations can occur without an effective gain/);
});

test('migration keeps earned evolution and repairs malformed levels without inventing ownership or purchases', () => {
  const p = createPlayer(); p.evolution = { fire: 3, water: 2.9, earth: Infinity, wind: NaN, arcane: 3 };
  const saved = normalizeSave(p); assert.deepEqual(saved.evolution, { fire: 3, water: 2, earth: 0, wind: 0 });
  assert.equal(evolutionLevel(-3), 0); assert.equal(evolutionLevel(99), 3); assert.equal(evolutionLevel('3'), 0);
  const raw = configuration().config; raw.evolution = { fire: 2.9, water: NaN }; assert.deepEqual(normalizeReplay(raw)!.evolution, { fire: 2 });
  assert.match(renderEvolutionWorkshop(saved, 'water'), /Glacial|Tidal Rinse/); assert.match(renderEvolutionWorkshop(saved, 'fire'), /Maximum evolution reached/);
});
