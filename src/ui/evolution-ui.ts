import type { Player, BattleResult } from '../types.js';
import { evolutionState } from '../core/evolution.js';
import { EVOLUTION_TRAITS } from '../data/evolution.js';
import { ELEMENT_BY_ID, BALANCE } from '../data/content.js';
import { escapeHtml as esc } from './dom.js';

export function renderEvolutionWorkshop(player: Player, selected?: string) {
  const owned = player.owned.filter(id => ELEMENT_BY_ID[id]?.enabled);
  const state = evolutionState(player, selected && owned.includes(selected) ? selected : owned[0]);
  if (!state) return '<section class="panel content-panel workshop-evolution"><h2>Element evolution</h2><p>No available owned element to evolve.</p></section>';
  const { element, level, cost, trait, ready, specializations } = state, current = player.specializations[element.id];
  const stages = [
    ['Lasting imprint', 'When used as the core, each evolution rank extends applied statuses by one second before duration multipliers.'],
    ['Wider influence', 'Casting this evolved element also damages a second enemy for ' + Math.round(BALANCE.masterySpreadScale * 100) + '% of the strike before defenses. This shares the existing mastery splash rather than stacking another hit.'],
    [trait.name, 'Using this element as the core grants an opening ward worth 10% of vessel health. Its signature also works in the secondary slot: ' + trait.description],
  ];
  return '<section class="panel content-panel workshop-evolution" tabindex="-1" data-evolution-element="' + esc(element.id) + '" data-rank="' + level + '"><h2>Change what an element can become.</h2><p>Refine an owned element through three ranks. Each family has a distinct final signature, captured when you launch a PvE battle. Competitive battles and loaned expeditions exclude account evolution.</p><label for="evolution-element">Element to evolve</label><select id="evolution-element">' + owned.map(id => '<option value="' + esc(id) + '" ' + (id === element.id ? 'selected' : '') + '>' + esc(ELEMENT_BY_ID[id].name) + '</option>').join('') + '</select>'
    + '<h3>' + esc(element.name) + ' · evolution ' + level + ' / 3</h3><ol class="evolution-stages" aria-label="Evolution path">' + stages.map(([name, description], index) => '<li data-unlocked="' + (level > index) + '"><strong>Rank ' + ['I', 'II', 'III'][index] + ' · ' + esc(name) + '</strong><span>' + (level > index ? 'Unlocked' : level === index ? 'Next evolution' : 'Later evolution') + '</span><p>' + esc(description) + '</p></li>').join('') + '</ol>'
    + (level === 3 ? '<p class="evolution-price">Maximum evolution reached. ' + esc(trait.name) + ' is ready when this element meets its trigger in your formation.</p>' : '<p class="evolution-price">Next rank costs ' + cost.gold + ' gold and ' + cost.essence + ' essence. Requires ' + cost.mastery + ' mastery XP; mastery is retained.</p><ul class="evolution-requirements"><li>' + player.gold + ' / ' + cost.gold + ' gold</li><li>' + player.essence + ' / ' + cost.essence + ' essence</li><li>' + (player.mastery[element.id] ?? 0) + ' / ' + cost.mastery + ' mastery XP</li></ul>')
    + '<button class="button secondary" data-action="x-evolve" ' + (!ready ? 'disabled' : '') + '>Evolve selected element</button><div class="evolution-specialization"><h3>Shape its role</h3><p>Specializations unlock at rank I and can be switched freely. ' + (current ? 'Selected: ' + esc(specializations.find(s => s.id === current)?.name ?? 'None') + '.' : 'No specialization selected.') + '</p><label for="specialization">Specialization</label><select id="specialization">' + specializations.map(s => '<option value="' + esc(s.id) + '" ' + (s.id === current ? 'selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select><button class="button secondary" data-action="x-specialize" ' + (!level ? 'disabled' : '') + '>Set specialization</button><ul class="plain-list">' + specializations.map(s => '<li><strong>' + esc(s.name) + ':</strong> ' + esc(s.description ?? '') + '</li>').join('') + '</ul></div></section>';
}

export function renderEvolutionReport(battle: BattleResult) {
  const entries = Object.entries(battle.report.evolution).flatMap(([unit, elements]) => Object.entries(elements).map(([element, value]) => ({ unit, element, ...value })));
  if (!entries.length) return '';
  return '<details class="evolution-report"><summary>Evolution signatures · ' + entries.reduce((total, entry) => total + entry.activations, 0) + ' activations</summary><p>Triggered by your evolved elements. Effective damage, healing, shields and cleanses are included in vessel contributions; activations can occur without an effective gain.</p><div class="evolution-results">' + entries.map(entry => '<article class="note"><strong>' + esc(EVOLUTION_TRAITS.find(t => t.id === entry.trait)!.name) + '</strong><p>' + esc(battle.final.units.find(u => u.id === entry.unit)?.name ?? entry.unit) + ' · ' + esc(ELEMENT_BY_ID[entry.element].name) + ' · ' + entry.activations + ' activations</p></article>').join('') + '</div></details>';
}
