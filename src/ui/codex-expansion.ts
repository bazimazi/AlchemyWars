import { renderRecoveredScenes } from './story-ui.js';
import { renderCreatureMechanics } from './guardian-ui.js';
import type { Player } from '../types.js';
import { ELEMENT_BY_ID, ENEMIES, ENCOUNTERS, RELICS, REACTION_BY_ID } from '../data/content.js';
import { EQUIPMENT } from '../data/systems.js';
import { relationshipCounts } from '../core/codex.js';
import { unlockedRelics } from '../core/progression.js';
import { escapeHtml as esc } from './dom.js';
import { creature } from './art.js';

export function relationshipLabel(player: Player, id: string) {
  const counts = relationshipCounts(player, id);
  return counts.known + ' known / ' + counts.unknown + ' unknown relationships';
}
export function renderCodexSection(player: Player, tab: string): string | null {
  if (tab === 'creatures') {
    const known = new Set([...player.creatures, ...ENCOUNTERS.filter(e => player.campaign.includes(e.id)).flatMap(e => e.enemies)]);
    return '<p>Creatures you have encountered reveal their traits and weaknesses.</p><div class="codex-grid">' + ENEMIES.map(e => known.has(e.id) ? `<article class="panel content-panel">${creature(e.shape, ELEMENT_BY_ID[e.elements[0]]?.color ?? '#aaa')}<h2>${esc(e.name)}</h2><p>${esc(e.tags.join(', '))}</p><p>Elements: ${e.elements.map(id => esc(ELEMENT_BY_ID[id].name)).join(', ')}</p><p>Health ${e.hp} · Attack ${e.attack} · Armor ${e.armor}</p><p>Immunities: ${esc(e.immunities?.join(', ') || 'none')}</p><p>Weaknesses: ${esc(e.weaknesses?.map(w => w.status).join(', ') || 'none recorded')}</p>${renderCreatureMechanics(player, e)}</article>` : '<article class="panel content-panel"><h2>Unknown creature</h2><p>Explore to fill this page.</p></article>').join('') + '</div>';
  }
  if (tab === 'artifacts') {
    const known = new Set([...player.equipment, ...unlockedRelics(player).map(r => r.id)]);
    return '<div class="codex-grid">' + [...RELICS.filter(r => r.id !== 'none'), ...EQUIPMENT].map(r => `<article class="panel content-panel"><div class="eyebrow">${known.has(r.id) ? 'COLLECTED' : 'NOT YET COLLECTED'} / ${esc(r.rarity ?? 'Common')}</div><h2>${esc(r.name)}</h2><p>${esc(r.description ?? '')}</p><p>${esc(r.tags.join(', '))}</p></article>`).join('') + '</div>';
  }
  if (tab === 'chains') return '<p>Ordered reaction sequences observed in your battles. Distinct chains stay in your journal across sessions.</p>' + (player.chains.length ? '<div class="codex-grid">' + player.chains.map(c => `<article class="panel content-panel"><h2>${c.reactions.length}-reaction chain</h2><p>${c.reactions.map(id => esc(REACTION_BY_ID[id].name)).join(' → ')}</p><p class="subtle">First observed ${new Date(c.firstSeen).toISOString().slice(0, 10)}</p></article>`).join('') + '</div>' : '<section class="panel content-panel"><h2>No chains recorded yet</h2><p>Combine residue-producing elements in your formation to trigger successive reactions in one action.</p></section>');
  if (tab === 'lore') return renderRecoveredScenes(player) + '<div class="codex-grid">' + player.owned.map(id => `<article class="panel content-panel"><h2>${esc(ELEMENT_BY_ID[id].name)}</h2><p>${esc(ELEMENT_BY_ID[id].lore)}</p></article>`).join('') + ENCOUNTERS.filter(e => player.campaign.includes(e.id)).map(e => `<article class="panel content-panel"><div class="eyebrow">${esc(e.region)}</div><h2>${esc(e.name)}</h2><p>${esc(e.story ?? e.description)}</p></article>`).join('') + '</div>';
  return null;
}
