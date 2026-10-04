import type { Player } from '../types.js';
import { TALENTS, TALENT_BRANCHES } from '../data/systems.js';
import { escapeHtml as esc } from './dom.js';

export function renderTalentTree(player: Player) {
  return '<section class="talent-tree spaced-heading"><h2>Paths of study</h2><p>Follow prerequisites to develop a branch. These permanent talents apply to your account; expedition drafts and competitive battles use their own rules.</p>'
    + '<nav class="research-branches" aria-label="Talent branches">' + TALENT_BRANCHES.map((branch, index) => '<button data-action="talent-branch" data-index="' + index + '">' + branch + '</button>').join('') + '</nav>'
    + TALENT_BRANCHES.map(branch => {
      const nodes = TALENTS.filter(t => t.branch === branch && t.enabled !== false);
      return '<section class="talent-branch" tabindex="-1" aria-label="' + branch + ' talents"><div class="section-heading"><div><h3>' + branch + '</h3><p>' + nodes.filter(t => player.talents.includes(t.id)).length + ' / ' + nodes.length + ' talents learned</p></div></div><div class="research-grid">' + nodes.map(t => {
        const owned = player.talents.includes(t.id), ready = !t.requires || player.talents.includes(t.requires);
        const prerequisite = TALENTS.find(node => node.id === t.requires);
        return '<article class="panel content-panel talent-card" tabindex="-1" data-talent="' + t.id + '"><span class="eyebrow">' + (owned ? 'LEARNED' : ready ? 'AVAILABLE TO LEARN' : 'PREREQUISITE NEEDED') + '</span><h4>' + esc(t.name) + '</h4><p>' + esc(t.description) + '</p>'
          + (prerequisite ? '<p class="note">Requires ' + esc(prerequisite.name) + ' (' + prerequisite.branch + ') · ' + (ready ? 'learned' : 'not learned') + '</p>' : '<p class="note">An entry to this branch.</p>')
          + '<button class="button secondary" data-action="x-talent" data-id="' + t.id + '" ' + (owned || !ready || player.knowledge < t.cost ? 'disabled' : '') + '>' + (owned ? 'Learned' : 'Learn ' + esc(t.name) + ' · ' + t.cost + ' knowledge') + '</button></article>';
      }).join('') + '</div></section>';
    }).join('') + '</section>';
}
