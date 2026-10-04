import type { Player, BattleResult } from '../types.js';
import { REACTION_BY_ID, ELEMENT_BY_ID } from '../data/content.js';
import { conditionText } from '../core/learning.js';
import { maximalChains } from '../core/codex.js';
import { escapeHtml as esc } from './dom.js';

function recipeStep(player: Player, id: string, target?: string) {
  const rule = REACTION_BY_ID[id], ready = player.discoveries.includes(id) && rule.inputs.every(id => player.owned.includes(id));
  return '<li><div><strong>' + esc(rule.name) + '</strong>' + (target ? '<span class="chain-target">Target: ' + esc(target) + '</span>' : '') + '</div><p>' + rule.inputs.map(id => esc(ELEMENT_BY_ID[id].name)).join(' + ') + ' → ' + esc(ELEMENT_BY_ID[rule.output].name) + '</p><p>' + esc(rule.description ?? '') + '</p><small class="recipe-condition">Requires ' + esc(conditionText(rule.conditions)) + '</small><button class="button secondary" data-action="prepare-chain-step" data-id="' + esc(id) + '" ' + (!ready ? 'disabled' : '') + '>Prepare this recipe</button></li>';
}
export function renderChainReport(player: Player, battle: BattleResult) {
  const trace = battle.report.longestAllyChain;
  if (!trace || trace.steps.length < 2) return '';
  const name = (id: string) => battle.final.units.find(u => u.id === id)?.name ?? 'Unknown vessel';
  return '<details class="chain-report"><summary>Your longest causal chain · ' + trace.steps.length + ' reactions</summary><p><strong>' + esc(name(trace.source)) + '</strong> began this sequence at ' + trace.time.toFixed(2) + 's. Each numbered step is a reaction in the same action, including any propagation to another target.</p><ol class="chain-steps">' + trace.steps.map(step => recipeStep(player, step.reaction, name(step.target))).join('') + '</ol><p class="subtle">Chain depth and event guards limit propagation. Separate casts and the opponent’s reactions are excluded from your chain achievement.</p></details>';
}
export function renderSavedChains(player: Player) {
  const chains = maximalChains(player.chains);
  return '<p>Follow the longest reaction sequences you have observed. Each step can become a prepared laboratory experiment; current mastery and research still apply.</p>' + (chains.length ? '<div class="codex-grid chain-codex">' + chains.map(chain => '<article class="panel content-panel recorded-chain"><h2>' + chain.reactions.length + '-reaction chain</h2><p>' + chain.reactions.map(id => esc(REACTION_BY_ID[id].name)).join(' → ') + '</p><p class="subtle">First observed ' + new Date(chain.firstSeen).toISOString().slice(0, 10) + '</p><details><summary>Explore the sequence</summary><ol class="chain-steps">' + chain.reactions.map(id => recipeStep(player, id)).join('') + '</ol></details></article>').join('') + '</div>' : '<section class="panel content-panel"><h2>No chains recorded yet</h2><p>Combine residue-producing elements in your formation to trigger successive reactions in one action.</p></section>');
}
