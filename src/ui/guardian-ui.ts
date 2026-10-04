import type { Player, Encounter, BattleResult, BattleFrame, UnitDefinition } from '../types.js';
import { ELEMENT_BY_ID, ENEMY_BY_ID, VESSEL_BY_ID, STATUSES, REACTION_BY_ID } from '../data/content.js';
import { ABILITIES } from '../data/units.js';
import { PASSIVES, MASTERY_REWARDS } from '../data/systems.js';
import { escapeHtml as esc } from './dom.js';

const statusNames = (ids: string[] = []) => ids.map(id => STATUSES[id].name).join(', ') || 'none';
const elements = (ids: string[]) => ids.map(id => ELEMENT_BY_ID[id].name).join(' + ');
const behaviors = (definition: UnitDefinition) => [...new Map([...(definition.behaviors ?? []), ...(definition.phases ?? []).flatMap(p => p.behaviors ?? [])].map(b => [b.id, b])).values()];

export function renderGuardianNotes(encounter: Encounter) {
  const guardians = encounter.enemies.map(id => ENEMY_BY_ID[id]).filter(e => e.tags.includes('boss'));
  return guardians.map(definition => '<details class="panel guardian-notes"><summary>Guardian field notes: ' + esc(definition.name) + '</summary><p>' + esc(definition.description) + '</p><p>Opening elements: ' + esc(elements(definition.elements)) + '. Immunities: ' + esc(statusNames(definition.immunities)) + '.</p>'
    + '<p>Armor openings: ' + (definition.weaknesses?.map(w => esc(STATUSES[w.status].name) + ' leaves ' + Math.round(w.armorMultiplier * 100) + '% armor').join('; ') || 'none recorded') + '.</p>'
    + '<ol class="guardian-phases">' + (definition.phases ?? []).map(p => '<li><strong>At ' + Math.round(p.below * 100) + '% health: ' + esc(p.label) + '</strong><p>' + esc(elements(p.elements ?? definition.elements)) + (p.immunities ? ' · immunities: ' + esc(statusNames(p.immunities)) : '') + '</p></li>').join('') + '</ol>'
    + behaviors(definition).map(b => '<p class="note"><strong>' + esc(b.name) + '</strong>: ' + esc(b.description ?? '') + ' Cooldown ' + b.cooldown + 's. Interrupted by ' + esc(statusNames(b.suppressedBy)) + '.</p>').join('') + '</details>').join('');
}

export function renderCreatureMechanics(player: Player, definition: UnitDefinition) {
  const known = player.creatureKnowledge[definition.id];
  return '<p>' + esc(definition.description ?? '') + '</p>'
    + (definition.phases?.map((phase, i) => '<p class="note"><strong>' + (known?.phases.includes(i + 1) ? 'Observed phase' : 'Unobserved phase') + ' ' + (i + 1) + ': ' + esc(phase.label) + '</strong><br>At ' + Math.round(phase.below * 100) + '% health · ' + esc(elements(phase.elements ?? definition.elements)) + (phase.immunities ? ' · immunities: ' + esc(statusNames(phase.immunities)) : '') + '</p>').join('') ?? '')
    + behaviors(definition).map(b => '<p><strong>' + esc(b.name) + (known?.behaviors.includes(b.id) ? ' · observed' : '') + '</strong><br>' + esc(b.description ?? '') + '</p>').join('');
}

export function renderUnitInspector(frame: BattleFrame, id: string) {
  const unit = frame.units.find(u => u.id === id);
  if (!unit) return '';
  const definition = ENEMY_BY_ID[unit.definitionId] ?? VESSEL_BY_ID[unit.definitionId];
  const allBehaviors = behaviors(definition);
  const labels = [...ABILITIES, ...PASSIVES, MASTERY_REWARDS.passive, ...allBehaviors];
  const cooldowns = Object.entries(unit.cooldowns).filter(([, expires]) => expires > frame.time).map(([key, expires]) => {
    const id = key.split(':').at(-1)!;
    return (labels.find(a => a.id === id)?.name ?? REACTION_BY_ID[id]?.name ?? 'Elemental effect') + ' · ' + (expires - frame.time).toFixed(1) + 's';
  });
  return '<div class="unit-inspector"><span class="eyebrow">BATTLE SNAPSHOT · ' + frame.time.toFixed(2) + 's</span><h2>' + esc(unit.name) + '</h2><p>' + (unit.side === 'ally' ? 'Your formation' : 'Opposition') + ' · position ' + (unit.position + 1) + '</p><p>Health ' + unit.hp + ' / ' + unit.maxHp + ' · shield ' + unit.shield + '</p><h3>Current elements</h3><p>' + esc(elements(unit.elements)) + '</p><p>Phase: ' + esc(unit.phaseLabel ?? 'Opening phase') + ' · Immunities: ' + esc(statusNames(unit.immunities)) + '</p><h3>Active statuses</h3><p>' + (unit.statuses.map(s => esc(STATUSES[s.id].name) + ' × ' + s.stacks + ' · ' + s.remaining.toFixed(1) + 's').join('<br>') || 'None') + '</p><h3>Elemental residues</h3><p>' + (Object.entries(unit.residues).filter(([, expires]) => expires > frame.time).map(([element, expires]) => esc(ELEMENT_BY_ID[element].name) + ' · ' + (expires - frame.time).toFixed(1) + 's').join('<br>') || 'None') + '</p><h3>Ready again in</h3><p>' + (cooldowns.map(esc).join('<br>') || 'No active cooldowns') + '</p>'
    + unit.behaviors.map(id => { const b = allBehaviors.find(b => b.id === id)!; return '<p class="note"><strong>' + esc(b.name) + '</strong><br>' + esc(b.description ?? '') + '</p>'; }).join('') + '</div>';
}

export function renderContributionReport(battle: BattleResult) {
  const allies = battle.final.units.filter(u => u.side === 'ally');
  const support = Object.entries(battle.report.reactionSupport).filter(([, s]) => s.healing || s.shield || s.cleanses || s.statuses);
  const lingering = Object.entries(battle.report.statusDamage).flatMap(([id, damage]) => Object.entries(damage).map(([status, amount]) => '<p class="note">' + esc(STATUSES[status].name) + ' dealt ' + Math.round(amount) + ' health damage to ' + esc(battle.final.units.find(u => u.id === id)?.name ?? id) + '.</p>'));
  return '<section class="contribution-report"><h3>What each vessel contributed</h3><p>Effective healing excludes overheal. Granted shields and absorbed damage are shown separately; support can matter without dealing damage.</p><div class="table-scroll" role="region" aria-label="Vessel contributions" tabindex="0"><table><thead><tr><th scope="col">Vessel</th><th scope="col">Damage</th><th scope="col">Healing</th><th scope="col">Shield granted</th><th scope="col">Absorbed</th><th scope="col">Cleanses</th></tr></thead><tbody>' + allies.map(unit => {
    const s = battle.report.units[unit.id];
    return '<tr><th scope="row">' + esc(unit.name) + '</th><td>' + Math.round(s.damage) + '</td><td>' + Math.round(s.healing) + '</td><td>' + Math.round(s.shield) + '</td><td>' + Math.round(s.absorbed) + '</td><td>' + s.cleanses + '</td></tr>';
  }).join('') + '</tbody></table></div>'
    + '<p class="table-scroll-hint subtle">Scroll the table to compare all contributions.</p>'
    + (lingering.length ? '<details class="status-damage-details"><summary>Lingering status damage</summary><p>Damage from your statuses after shields and armor, included in the vessel totals above.</p>' + lingering.join('') + '</details>' : '')
    + (support.length ? '<details class="support-details"><summary>Support from your reactions</summary><div class="reaction-support">' + support.map(([id, s]) => '<article class="note"><strong>' + esc(REACTION_BY_ID[id]?.name ?? id) + '</strong><p>' + [s.healing ? Math.round(s.healing) + ' healing' : '', s.shield ? Math.round(s.shield) + ' shield granted' : '', s.cleanses ? s.cleanses + ' effects cleansed' : '', s.statuses ? s.statuses + ' statuses applied' : ''].filter(Boolean).join(' · ') + '</p></article>').join('') + '</div></details>' : '') + '</section>';
}

export function renderGuardianReport(battle: BattleResult) {
  if (!battle.report.phases.length && !Object.values(battle.report.mechanics).some(m => Object.keys(m.counters).length)) return '';
  return '<section class="guardian-report"><h3>How guardian rules changed</h3><ol class="guardian-phases">' + battle.report.phases.map(p => '<li><strong>' + p.time.toFixed(1) + 's · ' + esc(battle.final.units.find(u => u.id === p.unit)!.name) + ': ' + esc(p.label) + '</strong><p>' + esc(elements(p.elements)) + '</p></li>').join('') + '</ol>'
    + Object.entries(battle.report.mechanics).flatMap(([id, m]) => Object.entries(m.counters).map(([status, count]) => '<p class="note">' + esc(STATUSES[status].name) + ' interrupted ' + esc(ENEMY_BY_ID[id].name) + '’s triggered behaviors ' + count + ' time' + (count === 1 ? '' : 's') + '.</p>')).join('') + '</section>';
}
