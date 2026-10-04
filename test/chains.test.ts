import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, buyResearch, experiment, claimBattle } from '../src/core/progression.js';
import { claimAchievement, questProgress } from '../src/core/meta.js';
import { recordBattleLearning, discoveryGoalProgress } from '../src/core/learning.js';
import { normalizeSave } from '../src/core/save.js';
import { normalizeReplay } from '../src/core/replay.js';
import { makeBattleConfig, simulateBattle } from '../src/core/combat.js';
import { ReactionEngine } from '../src/core/reactions.js';
import { maximalChains } from '../src/core/codex.js';
import { BALANCE, ELEMENTS, ENCOUNTERS, REACTIONS, REACTION_BY_ID, RESEARCH } from '../src/data/content.js';
import { TALENTS, ACHIEVEMENTS } from '../src/data/systems.js';
import { STORM_CATALYSIS_RECIPES, STORM_CYCLE } from '../src/data/storm-catalysis.js';

function stormPlayer() {
  const p = createPlayer(), encounter = ENCOUNTERS.find(e => e.id === 'stormlands-1')!;
  p.research = RESEARCH.map(r => r.id); p.talents = TALENTS.map(t => t.id); p.discoveries = REACTIONS.filter(r => !STORM_CYCLE.includes(r.id)).map(r => r.id);
  p.owned = ELEMENTS.map(e => e.id); p.mastery = { water: 90, lightning: 90 }; p.equipment = ['echo-catalyst'];
  p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.indexOf(encounter)).map(e => e.id);
  p.team.forEach(s => { s.elements = ['water', 'lightning']; s.relic = 'genesis-thread'; s.equipment = { catalyst: 'echo-catalyst' }; s.abilities = []; s.reactionPriority = STORM_CYCLE.filter(id => p.discoveries.includes(id)); });
  return p;
}
const chainAchievement = ACHIEVEMENTS.find(a => a.id === 'ten-reaction-chain')!;

test('Storm Catalysis requires both studies and introduces nine recipes without new element identities', () => {
  const p = createPlayer(); p.knowledge = 1000; assert.equal(buyResearch(p, 'storm-catalysis'), false);
  for (const id of ['resonance', 'reaction-science']) assert.equal(buyResearch(p, id), true);
  assert.equal(buyResearch(p, 'storm-catalysis'), false); assert.equal(buyResearch(p, 'catalyst-study'), true); assert.equal(buyResearch(p, 'storm-catalysis'), true);
  assert.equal(STORM_CATALYSIS_RECIPES.length, 9); assert.equal(REACTIONS.length, 137); assert.equal(ELEMENTS.length, 87);
  for (const rule of STORM_CATALYSIS_RECIPES) assert.ok(ELEMENTS.some(e => e.id === rule.output));
});

test('catalysis lab discoveries enforce actual research, mastery, Wet and storm conditions', () => {
  const p = createPlayer(); experiment(p, 'water', 'lightning');
  const scenario = { environment: 'storm', statuses: ['wet'], mastery: { water: 10, lightning: 10 }, research: ['storm-catalysis'] };
  assert.equal(experiment(p, 'conductive', 'water', scenario).rule, null);
  p.research = RESEARCH.map(r => r.id); assert.equal(experiment(p, 'conductive', 'water', scenario).rule, null);
  p.mastery.water = p.mastery.lightning = 90;
  assert.equal(experiment(p, 'conductive', 'water', { environment: 'rain', statuses: ['wet'] }).rule, null);
  assert.equal(experiment(p, 'conductive', 'water', { environment: 'storm' }).rule, null);
  for (const id of STORM_CYCLE.slice(1)) { const rule = REACTION_BY_ID[id]; const result = experiment(p, ...rule.inputs, scenario); assert.equal(result.rule?.id, id); assert.equal(result.isNew, true); }
  assert.ok(p.discoveries.includes('liquid-lens')); assert.ok(p.achievements.includes('first-secret'));
});

test('a valid campaign formation triggers ten actual allied reactions and earns the achievement on settlement', () => {
  const p = stormPlayer(), config = makeBattleConfig(p, 'stormlands-1', 42), battle = simulateBattle(config);
  assert.equal(battle.report.highestAllyChain, 10); assert.deepEqual(battle.report.longestAllyChain!.steps.map(s => s.reaction), STORM_CYCLE);
  assert.equal(battle.report.longestAllyChain!.source, 'ally-1'); assert.equal(battle.report.longestAllyChain!.time, .75);
  assert.ok(battle.report.longestAllyChain!.steps.every(s => battle.final.units.some(u => u.side === 'enemy' && u.id === s.target)));
  assert.equal(claimAchievement(p, chainAchievement.id), false); assert.equal(claimBattle(p, battle, 'storm-proof').claimed, true);
  assert.equal(p.learning.longestChain, 10); assert.equal(questProgress(p, chainAchievement), 10); assert.ok(p.achievements.includes(chainAchievement.id));
  assert.ok(STORM_CYCLE.every(id => p.discoveries.includes(id)));
  const before = structuredClone(p); assert.equal(claimBattle(p, battle, 'storm-proof').claimed, false); assert.deepEqual(p, before);
  const rewards = [p.gold, p.knowledge]; assert.equal(claimAchievement(p, chainAchievement.id), true); assert.deepEqual([p.gold, p.knowledge], [rewards[0] + 200, rewards[1] + 25]); assert.equal(claimAchievement(p, chainAchievement.id), false);
  assert.deepEqual(simulateBattle(normalizeReplay(config)!).report, battle.report);
});

test('chain depth is required and captured upgrades cannot change a launched storm cycle', () => {
  const p = stormPlayer(), config = makeBattleConfig(p, 'stormlands-1', 42);
  p.talents = []; p.research = []; p.team.forEach(s => { s.relic = 'none'; s.equipment = {}; });
  assert.equal(simulateBattle(config).report.highestAllyChain, 10);
  const shallow = { ...config, talents: config.talents!.filter(id => id !== 'recursive-binding') };
  assert.ok(simulateBattle(shallow).report.highestAllyChain < 10);
  const noResearch = { ...config, research: config.research.filter(id => id !== 'storm-catalysis') }; assert.ok(simulateBattle(noResearch).report.highestAllyChain < 10);
  const normalized = { ...config, normalized: true }; assert.ok(simulateBattle(normalized).report.highestAllyChain < 10);
});

test('longest-chain evidence survives clipped events, frame-free simulation and pruned chain history', () => {
  const p = stormPlayer(), config = makeBattleConfig(p, 'stormlands-1', 42), limit = BALANCE.maxLogEvents;
  let battle;
  try { BALANCE.maxLogEvents = 2; battle = simulateBattle(config, { captureFrames: false }); } finally { BALANCE.maxLogEvents = limit; }
  assert.equal(battle.events.length, 2); assert.equal(battle.report.longestAllyChain!.steps.length, 10);
  battle.report.chains = []; claimBattle(p, battle, 'clipped-storm');
  assert.ok(p.chains.some(c => c.reactions.join('|') === STORM_CYCLE.join('|')));
  p.chains = []; p.analytics = [];
  assert.equal(normalizeSave(p).learning.longestChain, 10); assert.equal(discoveryGoalProgress(normalizeSave(p), { type: 'longest-chain' }), 10);
});

test('propagation depth does not inflate reaction counts or event step numbers', () => {
  const p = createPlayer(); p.team = [{ ...p.team[0], elements: ['lightning', 'lightning'] }];
  const config = makeBattleConfig(p, ENCOUNTERS[0].id, 42); config.encounter = { ...ENCOUNTERS[0], id: 'propagation', environment: 'rain', enemies: ['sentinel'], scale: 1 };
  const engine = new ReactionEngine([
    { ...REACTION_BY_ID.conductive, effects: [{ type: 'applyElement', element: 'fire' }] },
    { ...REACTION_BY_ID.steam, effects: [{ type: 'status', status: 'wet', duration: 6, intensity: 1 }] },
  ]);
  const battle = simulateBattle(config, { engine });
  assert.equal(battle.report.highestAllyChain, 2); assert.equal(battle.report.highestChain, 2); assert.equal(battle.report.longestAllyChain!.steps.length, 2);
  assert.ok(battle.events.filter(e => e.type === 'reaction' && e.source?.startsWith('ally-')).every(e => e.depth === (e.id === 'conductive' ? 1 : 2)));
  assert.ok(Object.values(battle.report.reactions).reduce((sum, n) => sum + n, 0) > 10);
  recordBattleLearning(p, battle); assert.equal(questProgress(p, chainAchievement), 2); assert.equal(claimAchievement(p, chainAchievement.id), false);
});

test('enemy ten-reaction chains cannot advance allied achievements or daily chain facts', () => {
  const p = createPlayer(); p.team = [{ ...p.team[0], elements: ['earth', 'earth'] }];
  const config = makeBattleConfig(p, ENCOUNTERS[0].id, 42); config.normalized = true; config.modifiers = { chainDepth: 6 };
  config.encounter = { ...ENCOUNTERS[0], id: 'enemy-cycle', environment: 'rain', enemies: ['stormling'], scale: .5 };
  const engine = new ReactionEngine(STORM_CYCLE.map(id => ({ ...REACTION_BY_ID[id], conditions: {} })));
  const battle = simulateBattle(config, { engine }); assert.equal(battle.report.highestChain, 10); assert.equal(battle.report.highestAllyChain, 0); assert.equal(battle.report.longestAllyChain, null);
  recordBattleLearning(p, battle); assert.equal(p.learning.longestChain, 0); assert.equal(p.learning.daily.longestChain, 0); assert.equal(claimAchievement(p, chainAchievement.id), false);
});

test('migration preserves verified allied chains without inferring an enemy-inclusive legacy high score', () => {
  const p = createPlayer(); p.highestChain = 80; const old = { ...p, learning: { ...p.learning, longestChain: undefined } };
  assert.equal(normalizeSave(old).learning.longestChain, 0);
  old.chains = [{ reactions: ['conductive', 'chain-lightning'], firstSeen: 1 }]; assert.equal(normalizeSave(old).learning.longestChain, 2);
  assert.equal(normalizeSave({ ...old, learning: { ...old.learning, longestChain: NaN } }).learning.longestChain, 2);
  const raw = { ...old, learning: { ...old.learning, longestChain: Infinity } }; assert.equal(normalizeSave(raw).learning.longestChain, 2);
});

test('chain browsing hides prefixes, retains branching paths and sorts longest first without mutation', () => {
  const chains = [
    { reactions: ['steam', 'storm-cloud'], firstSeen: 1 }, { reactions: ['steam', 'storm-cloud', 'thunderstorm'], firstSeen: 2 },
    { reactions: ['steam', 'storm-cloud', 'pressure-current'], firstSeen: 3 }, { reactions: ['conductive', 'chain-lightning'], firstSeen: 4 },
  ];
  const before = structuredClone(chains), result = maximalChains(chains); assert.equal(result.length, 3); assert.deepEqual(chains, before);
  assert.deepEqual(result.map(c => c.reactions.length), [3, 3, 2]); assert.deepEqual(result.map(c => c.firstSeen), [2, 3, 4]);
});
