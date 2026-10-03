import type { Player, Run, RunReward } from '../types.js';
import { ELEMENT_BY_ID, VESSEL_BY_ID, RELICS, RELIC_BY_ID, REACTION_BY_ID } from '../data/content.js';
import { MUTATORS, RUN_UPGRADES, PASSIVES } from '../data/systems.js';
import { rotation, runEncounter, runFloorMutator } from '../core/modes.js';
import { conditionText } from '../core/learning.js';
import { renderTargetConditions } from './learning-ui.js';
import { renderGuardianNotes } from './guardian-ui.js';
import { escapeHtml as esc } from './dom.js';

const button = (label: string, action: string, extra = '') => '<button class="button secondary" data-action="x-' + action + '" ' + extra + '>' + esc(label) + '</button>';
const options = (ids: string[], selected: string | undefined, name = (id: string) => ELEMENT_BY_ID[id].name) => ids.map(id => '<option value="' + id + '" ' + (selected === id ? 'selected' : '') + '>' + esc(name(id)) + '</option>').join('');
const heading = (title: string, text: string) => '<div class="page-heading"><div><div class="eyebrow">THE UNWRITTEN PATH</div><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div></div>';

function rewardDescription(reward: RunReward) {
  if (reward.type === 'element') return { name: ELEMENT_BY_ID[reward.id].name, description: 'Add this element to your temporary collection.' };
  if (reward.type === 'upgrade') return RUN_UPGRADES.find(u => u.id === reward.id)!;
  if (reward.type === 'relic') return { ...RELIC_BY_ID[reward.id], description: RELIC_BY_ID[reward.id].description + ' Equip it on your run formation.' };
  if (reward.type === 'passive') { const passive = PASSIVES.find(p => p.id === reward.id)!; return { ...passive, description: passive.description + ' Equip it on your run formation.' }; }
  return { name: 'A Moment of Rest', description: 'Heal the party by 35% and revive fallen vessels at 60%.' };
}
function renderRules(run: Run) {
  const weekly = MUTATORS.find(m => m.id === run.mutator)!, floor = runFloorMutator(run);
  return '<section class="panel content-panel run-rules"><h2>The rules of this descent</h2>'
    + (run.mode === 'infinite-alchemy' ? '<p><strong>Expedition rule: ' + esc(weekly.name) + '</strong><br>' + esc(weekly.description) + '</p>' : '')
    + (floor.id !== 'clear' ? '<p><strong>Floor rule: ' + esc(floor.name) + '</strong><br>' + esc(floor.description) + '</p><p class="subtle">The floor rule changes at floor ' + (Math.floor((run.floor - 1) / 3) * 3 + 4) + '. Each launched battle keeps its rules.</p>' : '<p>Familiar elemental rules. Your drafted tools shape the formation.</p>') + '</section>';
}
function renderFormation(run: Run) {
  const disabled = run.state === 'battle' ? '' : 'disabled';
  const tactic = (index: number, kind: string, label: string, values: string[], selected: string | undefined, name: (id: string) => string, rank?: number) => '<label>' + esc(label) + '<select data-run-tactic="' + kind + '" data-index="' + index + '" ' + (rank !== undefined ? 'data-rank="' + rank + '"' : '') + ' ' + disabled + '>' + options(values, selected, name) + '</select></label>';
  return '<div class="advanced-formation run-formation spaced-heading">' + run.team.map((slot, i) => '<article class="panel content-panel"><h3>' + esc(VESSEL_BY_ID[slot.vessel].name) + ' · ' + Math.round(run.health[i] * 100) + '% health</h3><label>Core<select data-run-slot="0" data-index="' + i + '" ' + disabled + '>' + options(run.elements, slot.elements[0]) + '</select></label><label>Secondary<select data-run-slot="1" data-index="' + i + '" ' + disabled + '>' + options(run.elements, slot.elements[1]) + '</select></label>'
    + '<p class="subtle">' + esc(RELIC_BY_ID[slot.relic].name) + ' · ' + esc(PASSIVES.find(p => p.id === slot.passive)?.name ?? 'No passive') + '</p><details class="run-tools"><summary>Battle tools and strategy</summary>'
    + tactic(i, 'relic', 'Run relic', ['none', ...run.relics], slot.relic, id => RELIC_BY_ID[id].name)
    + (slot.relic !== 'none' ? '<p class="note">' + esc(RELIC_BY_ID[slot.relic].description) + '</p>' : '')
    + tactic(i, 'passive', 'Run passive', ['none', ...run.passives], slot.passive ?? 'none', id => PASSIVES.find(p => p.id === id)!.name)
    + (slot.passive && slot.passive !== 'none' ? '<p class="note">' + esc(PASSIVES.find(p => p.id === slot.passive)!.description) + '</p>' : '')
    + tactic(i, 'targeting', 'Target', ['front', 'weakest', 'reaction'], slot.targeting, id => ({ front: 'Front enemy', weakest: 'Lowest health', reaction: 'Best reaction' })[id]!)
    + tactic(i, 'priority', 'Casting priority', ['alternate', 'reaction', 'core'], slot.priority, id => ({ alternate: 'Alternate elements', reaction: 'Seek reactions', core: 'Core element only' })[id]!)
    + (run.discoveries.length ? [0, 1, 2].map(rank => tactic(i, 'reactionPriority', 'Reaction priority ' + (rank + 1), ['', ...run.discoveries], slot.reactionPriority?.[rank] ?? '', id => id ? REACTION_BY_ID[id].name : 'Default ordering', rank)).join('') : '') + '</details></article>').join('') + '</div>';
}
export function renderRuns(player: Player) {
  const run = player.run, current = rotation();
  if (!run || ['complete', 'defeat', 'retired'].includes(run.state)) return heading('The Unwritten Path', 'A fresh set of elements. A different theory. A world that changes with every run.')
    + (run ? '<section class="panel content-panel"><h2>' + (run.state === 'complete' ? 'A remarkable journey.' : run.state === 'defeat' ? 'A lesson from the depths.' : 'Your discoveries return with you.') + '</h2><p>' + run.wins + ' victories · ' + run.discoveries.length + ' reactions learned · ' + run.wins * 20 + ' gold · ' + run.wins * 5 + ' essence · ' + run.wins * 3 + ' knowledge · ' + Math.floor(run.wins / 2) + ' shards.</p><p>Rewards and learned reactions have been added to your journal. Drafted tools belong to this expedition.</p></section>' : '')
    + '<div class="research-grid spaced-heading">' + [['roguelite', 'The Unwritten Path', 'Eight encounters, a build draft and rest option after each victory, and two guardians. Health carries between battles.'], ['endless', 'The Infinite Dungeon', 'Descend until your formation falls. Enemies grow stronger and floor rules change every three encounters.'], ['infinite-alchemy', 'Infinite Alchemy', 'An endless descent with changing floor rules and this expedition rule: ' + current.mutator.description], ['draft', 'Element Draft', 'Build a run from today\'s limited pool: ' + current.draft.map(id => ELEMENT_BY_ID[id].name).join(', ') + '.']].map(([id, title, description]) => {
      const pool = id === 'draft' ? current.draft : player.owned.filter(element => ELEMENT_BY_ID[element].base && !ELEMENT_BY_ID[element].unlockResearch);
      return '<article class="panel content-panel"><div class="eyebrow">' + id + '</div><h2>' + esc(title) + '</h2><p>' + esc(description) + '</p><label>First element<select id="start-a-' + id + '">' + options(pool, pool[0]) + '</select></label><label>Second element<select id="start-b-' + id + '">' + options(pool, id === 'draft' ? current.draft[1] : 'water') + '</select></label>' + button('Begin ' + title, 'start-run', 'data-mode="' + id + '"') + '</article>';
    }).join('') + '</div>';
  const encounter = runEncounter(run);
  return heading('Floor ' + run.floor + ' · ' + encounter.name, 'Your expedition and laboratory scenario are saved automatically. Your formation\'s health carries forward.')
    + '<div class="resource-banner"><span>' + esc(run.mode) + '</span><span>' + run.wins + ' victories</span><span>' + run.upgrades.length + ' upgrades</span><span>' + (run.relics.length + run.passives.length) + ' drafted tools</span></div>' + renderRules(run)
    + (run.state === 'reward' ? '<h2>What will you bring with you?</h2><div class="research-grid run-rewards">' + run.rewards.map((reward, i) => { const info = rewardDescription(reward); return '<article class="panel content-panel" data-run-reward="' + reward.type + '"><div class="eyebrow">' + reward.type + '</div><h2>' + esc(info.name) + '</h2><p>' + esc(info.description) + '</p>' + button('Choose reward', 'run-reward', 'data-index="' + i + '"') + '</article>'; }).join('') + '</div>' : '<section class="panel content-panel"><div class="eyebrow">' + esc(encounter.environment) + ' · ' + (encounter.boss ? 'GUARDIAN' : encounter.elite ? 'ELITE' : 'EXPLORATION') + '</div><h2>Prepare the next experiment.</h2><p>' + esc(encounter.tip) + '</p>' + button('Enter floor ' + run.floor, 'run-battle') + '</section>' + renderGuardianNotes(encounter))
    + renderFormation(run)
    + '<section class="panel content-panel spaced-heading run-laboratory"><h2>A traveling laboratory</h2><p>Discoveries stay in your temporary collection until you finish or retire. This floor\'s environment: ' + esc(encounter.environment) + '.</p><div class="form-row"><label>First element<select id="run-a">' + options(run.elements, run.elements[0]) + '</select></label><label>Second element<select id="run-b">' + options(run.elements, run.elements[1]) + '</select></label>' + button('Experiment', 'run-experiment') + '</div>' + renderTargetConditions(run.elements, run.context, 'run')
    + '<p>Upgrades: ' + esc(run.upgrades.map(id => RUN_UPGRADES.find(u => u.id === id)!.name).join(', ') || 'none yet') + '</p><p>Drafted relics: ' + esc(RELICS.filter(r => run.relics.includes(r.id)).map(r => r.name).join(', ') || 'none yet') + '</p><p>Drafted passives: ' + esc(PASSIVES.filter(p => run.passives.includes(p.id)).map(p => p.name).join(', ') || 'none yet') + '</p>'
    + (run.discoveries.length ? '<details class="run-discoveries"><summary>Run discoveries · ' + run.discoveries.length + '</summary>' + run.discoveries.map(id => '<p><strong>' + esc(REACTION_BY_ID[id].name) + '</strong><br>' + esc(REACTION_BY_ID[id].inputs.map(input => ELEMENT_BY_ID[input].name).join(' + ')) + ' · ' + esc(conditionText(REACTION_BY_ID[id].conditions)) + '</p>').join('') + '</details>' : '') + '</section><div class="button-row spaced-heading">' + button('Return with your discoveries', 'retire-run') + '</div>';
}
