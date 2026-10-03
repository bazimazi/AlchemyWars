import type { Player } from '../types.js';
import { RESEARCH, REACTIONS } from '../data/content.js';
import { RESEARCH_BRANCHES } from '../data/research.js';
import { ABILITIES } from '../data/units.js';
import { EQUIPMENT } from '../data/systems.js';
import { researchCost } from '../core/meta.js';
import { hasResearch } from '../core/research.js';
import { escapeHtml as esc } from './dom.js';
import { icon } from './art.js';

export function renderResearchTree(player: Player) {
  return '<nav class="research-branches" aria-label="Research branches">' + RESEARCH_BRANCHES.map((branch, index) => '<button data-action="research-branch" data-index="' + index + '">' + branch + '</button>').join('') + '</nav>'
    + RESEARCH_BRANCHES.map(branch => '<section class="research-branch" tabindex="-1" aria-label="' + branch + '"><div class="section-heading"><div><h2>' + branch + '</h2><p>' + RESEARCH.filter(r => r.branch === branch && player.research.includes(r.id)).length + ' / ' + RESEARCH.filter(r => r.branch === branch).length + ' studies understood</p></div></div><div class="research-grid">' + RESEARCH.filter(r => r.branch === branch).map(r => {
      const owned = player.research.includes(r.id), ready = hasResearch(player.research, r.requires), cost = researchCost(player, r);
      const unlocks = [...ABILITIES.filter(a => a.requiresResearch?.includes(r.id)).map(a => 'Ability: ' + a.name), ...EQUIPMENT.filter(e => e.requiresResearch?.includes(r.id)).map(e => 'Blueprint: ' + e.name)];
      const recipes = REACTIONS.filter(recipe => recipe.conditions?.research?.includes(r.id)).length;
      if (recipes) unlocks.push(recipes + ' experimental recipe' + (recipes === 1 ? '' : 's'));
      return '<article class="panel research-card" data-research="' + r.id + '"><span class="research-icon">' + icon(r.icon) + '</span><span class="eyebrow">' + (owned ? 'UNDERSTOOD' : ready ? 'AVAILABLE TO STUDY' : 'PREREQUISITES NEEDED') + '</span><h3>' + esc(r.name) + '</h3><p>' + esc(r.description) + '</p>'
        + (r.requires?.length ? '<ul class="research-requires" aria-label="Prerequisites">' + r.requires.map(id => '<li class="' + (player.research.includes(id) ? 'complete' : '') + '">' + icon(player.research.includes(id) ? 'check' : 'lock') + esc(RESEARCH.find(node => node.id === id)!.name) + '</li>').join('') + '</ul>' : '')
        + (unlocks.length ? '<p class="note">' + unlocks.map(esc).join(' · ') + '</p>' : '')
        + '<button class="button ' + (owned ? 'secondary' : 'primary') + '" data-action="research" data-id="' + r.id + '" ' + (owned || !ready || player.knowledge < cost ? 'disabled' : '') + '>' + (owned ? icon('check') + ' Understood' : 'Research · ' + cost + ' knowledge') + '</button></article>';
    }).join('') + '</div></section>').join('');
}
