import type { Player, ReactionContext } from '../types.js';
import { ELEMENT_BY_ID, REACTION_BY_ID, STATUSES } from '../data/content.js';
import { experimentCapacity } from '../core/notebook.js';
import { hintText } from '../core/learning.js';
import { escapeHtml as esc } from './dom.js';

function scenario(context: ReactionContext) {
  return [context.environment ?? 'neutral',
    ...[...(context.statuses ?? [])].map(id => STATUSES[id].name),
    context.healthRatio === undefined ? '' : Math.round(context.healthRatio * 100) + '% target health',
    context.enemyCount === undefined ? '' : context.enemyCount + ' enemies',
    context.shielded === undefined ? '' : context.shielded ? 'shielded target' : 'unshielded target',
    ...(context.tags ?? []).map(tag => tag + ' target'),
  ].filter(Boolean).join(' · ');
}
export function renderExperimentNotebook(player: Player) {
  const capacity = experimentCapacity(player), full = player.experimentNotes.length >= capacity;
  return '<section class="panel content-panel experiment-notebook spaced-heading" aria-label="Laboratory notebook"><div class="section-heading"><div><h2>Prepared experiments</h2><p>' + player.experimentNotes.length + ' / ' + capacity + ' saved · Save the selected ingredients and target conditions to return to a question later.</p></div></div><div class="form-row"><label>Experiment name<input id="experiment-name" maxlength="40" placeholder="A question for later"></label><button class="button secondary" data-action="save-note" ' + (full ? 'disabled' : '') + '>Save prepared experiment</button></div><p class="subtle">Parallel Notes in the Alchemy talent branch opens a second slot. Loading a note uses your current mastery and research.</p><div class="notebook-grid">'
    + player.experimentNotes.map((note, index) => '<article class="saved-experiment"><h3>' + esc(note.name) + '</h3><p>' + note.inputs.map(id => esc(ELEMENT_BY_ID[id].name)).join(' + ') + '</p><p class="subtle">' + esc(scenario(note.context)) + '</p><div class="button-row"><button class="button secondary" data-action="load-note" data-index="' + index + '" aria-label="Load ' + esc(note.name) + '">Load experiment</button><button class="button secondary" data-action="replace-note" data-index="' + index + '">Replace with current</button><button class="button secondary" data-action="delete-note" data-index="' + index + '">Delete note</button></div></article>').join('') + '</div></section>';
}
export function renderClueJournal(player: Player) {
  const entries = Object.entries(player.hints).filter(([id, stage]) => stage > 0 && Object.hasOwn(REACTION_BY_ID, id) && !player.discoveries.includes(id));
  if (!entries.length) return '';
  return '<details class="panel content-panel clue-journal spaced-heading"><summary>Unresolved reaction clues · ' + entries.length + '</summary><p>Purchased hints and clues found on first campaign victories remain here until the reaction is discovered.</p><div class="notebook-grid">'
    + entries.map(([id, stage]) => '<article class="saved-clue"><h3>Reaction clue · stage ' + Math.min(4, stage) + ' / 4</h3><p>' + esc(hintText(REACTION_BY_ID[id], stage)) + '</p></article>').join('') + '</div></details>';
}
