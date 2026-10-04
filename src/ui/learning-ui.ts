import { evolutionTrait } from '../data/evolution.js';
import type { Player, ReactionContext, BattleResult } from '../types.js';
import { dailyGoals, dailyGoalProgress, TUTORIAL_STEPS, conditionText } from '../core/learning.js';
import { reactionEngine } from '../core/reactions.js';
import { ELEMENT_BY_ID, REACTION_BY_ID, STATUSES } from '../data/content.js';
import { SPECIALIZATIONS, DISCOVERY_REWARDS } from '../data/systems.js';
import { escapeHtml as esc } from './dom.js';

export function renderFirstSteps(player: Player) {
  const steps = [
    ['Discover a relationship', 'Combine Fire and Water in the laboratory. Nothing is consumed.', 'lab'],
    ['Build with your discovery', 'Choose a discovered element as a vessel core or secondary in Your Formation.', 'team'],
    ['Observe your theory', 'Enter an expedition and watch how residues turn into reactions.', 'battle'],
    ['Read what happened', 'Read your battle report, then mark your reflection below. Reactions and lingering effects can contribute differently.', 'battle'],
    ['Ask your own question', 'Return to the lab. Discover another relationship without purchasing its hint.', 'lab'],
  ];
  const index = TUTORIAL_STEPS.findIndex(step => !player.learning.tutorial.includes(step));
  if (index < 0) return '';
  const step = steps[index];
  return `<section class="panel learning-guide" aria-label="First steps"><div><span class="eyebrow">YOUR FIRST EXPLORATION · ${index + 1} / 5</span><h2>${step[0]}</h2><p>${step[1]}</p></div><a class="button secondary" href="#${step[2]}">Open ${step[2] === 'team' ? 'formation' : step[2] === 'battle' ? 'expeditions' : 'laboratory'}</a></section>`;
}
export function renderDailyGoals(player: Player) {
  const daily = dailyGoals();
  return `<section class="spaced-heading"><h2>Today's questions</h2><p class="subtle">${daily.day} (UTC) · Each goal awards ${DISCOVERY_REWARDS.dailyGoal.gold} gold, ${DISCOVERY_REWARDS.dailyGoal.knowledge} knowledge and ${DISCOVERY_REWARDS.dailyGoal.essence} essence.</p><div class="research-grid">${daily.goals.map(g => {
    const progress = Math.min(g.target, dailyGoalProgress(player, g.id));
    const claimed = player.learning.daily.day === daily.day && player.learning.daily.claims.includes(g.id);
    return `<article class="panel content-panel daily-goal" data-goal="${g.id}"><h3>${g.name}</h3><p>${esc(g.description)}</p><p>${progress} / ${g.target}</p><button class="button secondary" data-action="x-daily-goal" data-id="${g.id}" ${claimed || progress < g.target ? 'disabled' : ''}>${claimed ? 'Reward claimed' : 'Claim daily goal'}</button></article>`;
  }).join('')}</div></section>`;
}
export function renderElementLearning(player: Player, id: string) {
  const trait = evolutionTrait(ELEMENT_BY_ID[id]);
  const spec = SPECIALIZATIONS.find(s => s.id === player.specializations[id]);
  return `<section class="element-learning"><h3>Your experience with ${esc(ELEMENT_BY_ID[id].name)}</h3><p>${player.learning.elementCasts[id] ?? 0} elemental casts · ${player.learning.elementWins[id] ?? 0} victories with an actual cast</p><p>Observed in ${player.chains.filter(c => c.reactions.some(r => REACTION_BY_ID[r].inputs.includes(id) || REACTION_BY_ID[r].output === id)).length} recorded reaction chains</p><p>Evolution ${player.evolution[id] ?? 0} / 3 · ${spec ? esc(spec.name) + ': ' + esc(spec.description) : 'No specialization selected'}</p><p>Evolution III signature: ${esc(trait.name)}${(player.evolution[id] ?? 0) === 3 ? " (unlocked)" : " (locked)"}. ${esc(trait.description)}</p><p class="subtle">Saved formations: ${esc(player.loadouts.filter(l => l.team.some(s => s.elements.includes(id))).map(l => l.name).join(', ') || 'none yet')}</p></section>`;
}
export function renderLabConditions(player: Player, context: ReactionContext) {
  return renderTargetConditions(player.owned, context, 'lab');
}
export function renderTargetConditions(elements: string[], context: ReactionContext, prefix: 'lab' | 'run') {
  const statuses = new Set(context.statuses ?? []), tags = new Set(context.tags ?? []);
  const knownTags = [...new Set(elements.flatMap(id => ELEMENT_BY_ID[id].tags))].sort();
  return `<details class="lab-scenario"><summary>Explore target conditions</summary><p class="subtle">${prefix === 'run' ? 'Model a target under this floor\'s environment. Account mastery and research do not apply.' : 'Model a target to test conditional relationships. Mastery always comes from your own progress.'}</p><div class="form-row"><label>Target health (%)<input id="${prefix}-health" type="number" min="0" max="100" value="${Math.round((context.healthRatio ?? 1) * 100)}"></label><label>Enemy count<input id="${prefix}-enemies" type="number" min="0" max="10" value="${context.enemyCount ?? 1}"></label><label class="check-label"><input id="${prefix}-shielded" type="checkbox" ${context.shielded ? 'checked' : ''}> Shielded target</label></div><fieldset><legend>Target statuses</legend><div class="scenario-options">${Object.values(STATUSES).filter(s => prefix === 'run' || s.id !== 'freeze').map(s => `<label><input type="checkbox" data-${prefix}-status="${s.id}" ${statuses.has(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}</div></fieldset><fieldset><legend>Target elemental tags</legend><div class="scenario-options">${knownTags.map(tag => `<label><input type="checkbox" data-${prefix}-tag="${tag}" ${tags.has(tag) ? 'checked' : ''}> ${esc(tag)}</label>`).join('')}</div></fieldset></details>`;
}
export function renderKnownRecipes(player: Player) {
  return player.discoveries.length ? `<section class="panel content-panel known-recipes"><h2>Revisit a known relationship</h2><p>Load the ingredients and target conditions from your notes, then experiment again.</p><div class="form-row"><label>Known recipe<select id="known-recipe">${player.discoveries.map(id => `<option value="${id}">${esc(REACTION_BY_ID[id].name)}</option>`).join('')}</select></label><button class="button secondary" data-action="prepare-recipe">Prepare known recipe</button></div></section>` : '';
}
export function renderBattleLearning(player: Player, battle: BattleResult, canReflect: boolean) {
  const mostUsed = Object.entries(battle.report.reactions).sort((a,b) => b[1] - a[1])[0];
  const output = mostUsed ? REACTION_BY_ID[mostUsed[0]].output : null;
  const candidates = output ? reactionEngine.candidates(output).filter(r => !player.discoveries.includes(r.id)) : [];
  const contributions = battle.final.units.filter(u => u.side === 'ally').map(u => battle.report.units[u.id]);
  const shield = contributions.reduce((n, s) => n + s.shield, 0), cleanses = contributions.reduce((n, s) => n + s.cleanses, 0);
  return `<section class="battle-lesson"><h3>A question for your next experiment</h3><p>${mostUsed ? esc(REACTION_BY_ID[mostUsed[0]].name) + ' triggered ' + mostUsed[1] + ' times. ' + (candidates.length ? esc(ELEMENT_BY_ID[output!].name) + ' still has ' + candidates.length + ' unknown relationships. What might it meet next?' : 'Compare its frequency with damage and support before changing your formation.') : 'No reactions triggered. Try matching a residue-producing core with a partner from a known relationship.'}</p><p class="subtle">${Math.round(battle.report.healing)} healing · ${Math.round(shield)} shield granted · ${cleanses} effects cleansed &#183; ${battle.report.chains.length} distinct causal chains observed</p>${canReflect && player.learning.tutorial.includes('battle') && !player.learning.tutorial.includes('reflection') ? '<button class="button secondary" data-action="reflect-report">I have reviewed this report</button>' : ''}${output && player.owned.includes(output) ? `<button class="button secondary" data-action="follow-up" data-id="${output}">Experiment with ${esc(ELEMENT_BY_ID[output].name)}</button>` : ''}</section>`;
}
export const recipeRequirements = (id: string) => conditionText(REACTION_BY_ID[id].conditions);
