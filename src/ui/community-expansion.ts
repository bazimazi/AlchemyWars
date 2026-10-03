import type { Player } from '../types.js';
import type { WorldView } from '../../server/types.js';
import { ELEMENT_BY_ID } from '../data/content.js';
import { competitionRules } from '../core/competition.js';
import { escapeHtml as esc } from './dom.js';
const button = (text: string, action: string, id = '', disabled = false) => `<button class="button secondary" data-action="net-${action}" data-id="${esc(id)}" ${disabled ? 'disabled' : ''}>${esc(text)}</button>`;
const options = (ids: string[]) => ids.map(id => `<option value="${esc(id)}">${esc(ELEMENT_BY_ID[id].name)}</option>`).join('');
export function renderCompetitions(world: WorldView) {
  const rules = competitionRules(world.rotation.week * 7 * 86400000);
  const opponents = world.players.filter(p => p.id !== world.self.id);
  return '<h2 class="spaced-heading">Weekly competitions</h2><div class="two-column">' + [
    { id: 'element-wars', name: 'Element Wars', count: 2, pool: rules.elementPool, description: 'Choose two elements to face the other two in this week\'s pool.', scores: world.standings.elementWars },
    { id: 'weekly-pvp', name: 'Weekly Crucible', count: 3, pool: rules.pool, description: rules.mutator.name + ': ' + rules.mutator.description, scores: world.standings.weekly }
  ].map(mode => `<section class="panel content-panel"><h3>${mode.name}</h3><p>${esc(mode.description)}</p><p class="subtle">Equal vessels, no account upgrades. A victory earns 3 points, a draw 1. Each opponent scores once per week.</p><label>Choose ${mode.count} elements<select id="${mode.id}-draft" multiple size="${mode.pool.length}">${options(mode.pool)}</select></label><label>Opponent<select id="${mode.id}-opponent">${opponents.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>${button('Enter ' + mode.name, mode.id, '', !opponents.length)}<h4>Standings</h4><ol>${mode.scores.slice(0, 10).map(p => `<li>${esc(p.name)} — ${p.score} points</li>`).join('')}</ol></section>`).join('') + '</div>';
}
export function renderGuildProjects(player: Player, world: WorldView) {
  const guild = world.guilds.find(g => g.id === world.self.guildId);
  if (!guild) return '';
  const activity = guild.activity, project = activity.project;
  const canDonate = player.owned.filter(id => (player.mastery[id] ?? 0) >= 30);
  const canClaim = player.owned.filter(id => (guild.elements?.[id] ?? 0) > 0);
  const contributed = activity.contributors.includes(world.self.id);
  return `<h2 class="spaced-heading">The guild laboratory</h2><div class="two-column"><section class="panel content-panel"><h3>Elemental exchange</h3><p>Donate an imprint for 30 mastery XP. A member who owns that element can study it for 15 mastery XP.</p><label>Donate an imprint<select id="guild-element-donate">${options(canDonate)}</select></label>${button('Donate imprint', 'guild-element-donate', '', !canDonate.length)}<label>Study a stored imprint<select id="guild-element-claim">${canClaim.map(id => `<option value="${id}">${esc(ELEMENT_BY_ID[id].name)} (${guild.elements![id]} stored)</option>`).join('')}</select></label>${button('Study imprint', 'guild-element-claim', '', !canClaim.length)}</section><section class="panel content-panel"><h3>Hidden reaction project</h3><p>${esc(project.hint)}</p><p>${project.progress} / ${project.goal} contributions · Your contributions: ${project.contributors[world.self.id] ?? 0}</p>${project.reaction ? `<p><strong>${esc(project.reaction.name)}</strong>: ${project.reaction.inputs.map(id => esc(ELEMENT_BY_ID[id].name)).join(' + ')}</p><p>Try the revealed pairing in your laboratory to record the discovery.</p>` : `<p>Contribute distinct stable pairings for one knowledge each. Each member can contribute a pairing once per week.</p><div class="form-row"><label>First element<select id="guild-project-a">${options(player.owned)}</select></label><label>Second element<select id="guild-project-b">${options(player.owned)}</select></label></div>${button('Contribute experiment', 'guild-experiment', '', player.knowledge < 1)}`}</section></div><section class="panel content-panel"><h3>Weekly guild missions</h3><p>Contributors can claim each completed mission once per week: 30 gold, 5 knowledge and 10 essence.</p>${[
    { id: 'donations', name: 'Share three imprints', value: activity.donations, goal: 3 },
    { id: 'experiments', name: 'Contribute ten experiments', value: activity.experiments, goal: 10 },
    { id: 'battles', name: 'Win a battle for the guild', value: activity.battles, goal: 1 },
    { id: 'project', name: 'Reveal the hidden reaction', value: project.progress, goal: project.goal }
  ].map(m => `<div class="community-row"><span>${m.name} · ${m.value} / ${m.goal}</span>${button(activity.claimed.includes(activity.week + ':' + m.id) ? 'Claimed' : 'Claim reward', 'guild-mission', m.id, !contributed || m.value < m.goal || activity.claimed.includes(activity.week + ':' + m.id))}</div>`).join('')}</section>`;
}
