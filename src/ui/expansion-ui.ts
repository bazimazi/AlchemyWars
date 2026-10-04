import { hasResearch } from '../core/research.js';
import { renderDailyGoals } from './learning-ui.js';
import { renderFormationLibrary } from './formation-ui.js';
import { renderAchievements } from './achievement-ui.js';
import { network } from './network.js';
import { renderUnitTools } from './unit-tools.js';
import { highestBoss } from '../core/codex.js';
import { query, escapeHtml } from './dom.js';
import type { Player, CommandPayload, CommandResult } from '../types.js';
import { challengeDefinition } from '../core/challenges.js';
import { ELEMENT_BY_ID, REACTION_BY_ID, VESSEL_BY_ID, ENCOUNTERS, RESEARCH } from '../data/content.js';
import { TALENTS, EQUIPMENT, PASSIVES, SPECIALIZATIONS, QUESTS, COSMETICS } from '../data/systems.js';
import { availableVessels, questProgress, analyticsReport } from '../core/meta.js';
import { rotation } from '../core/modes.js';

const esc = escapeHtml;
const btn = (label: string, action: string, extra = '', disabled = false) => '<button class="button secondary" data-action="x-' + action + '" ' + extra + (disabled ? ' disabled' : '') + '>' + label + '</button>';
const options = (ids: string[], selected?: string) => ids.map(id => '<option value="' + id + '" ' + (selected === id ? 'selected' : '') + '>' + ELEMENT_BY_ID[id].name + '</option>').join('');
const heading = (title: string, description: string) => '<div class="page-heading"><div><div class="eyebrow">THE WORK OF AN ALCHEMIST</div><h1>' + title + '</h1><p>' + description + '</p></div></div>';

export function renderWorkshop(player: Player) {
  return heading('The Artificer’s Workshop', 'Craft tools, refine elements, and shape the way your formation fights.')
    + '<div class="resource-banner"><span>' + player.gold + ' gold</span><span>' + player.essence + ' essence</span><span>' + player.shards + ' relic shards</span><span>' + player.knowledge + ' knowledge</span></div>'
    + '<div class="button-row spaced-heading">' + btn('Craft all affordable tools', 'craft-all') + '</div>'
    + '<h2>Tools with a purpose</h2><div class="research-grid">' + EQUIPMENT.map(e => '<article class="panel content-panel"><div class="eyebrow">' + e.slot + ' · ' + e.rarity + '</div><h2>' + e.name + '</h2><p>' + e.description + '</p>' + (e.requiresResearch ? '<p class="note">Requires research: ' + e.requiresResearch.map(id => RESEARCH.find(r => r.id === id)!.name).join(', ') + '. <a href="#research">Visit research</a></p>' : '') + '<p class="subtle">' + e.gold + ' gold · ' + e.essence + ' essence · ' + e.shards + ' shards</p>' + btn(player.equipment.includes(e.id) ? 'Crafted' : 'Craft ' + e.name, 'craft', 'data-id="' + e.id + '"', player.equipment.includes(e.id) || !hasResearch(player.research, e.requiresResearch) || player.gold < e.gold || player.essence < e.essence || player.shards < e.shards) + '</article>').join('') + '</div>'
    + '<section class="panel content-panel workshop-evolution"><h2>Change what an element can become.</h2><p>Evolution I extends statuses. Evolution II adds splash damage. Evolution III grants a protective opening ward. Specialization changes behavior, and can be switched freely.</p><div class="form-row"><label>Element<select id="evolution-element">' + options(player.owned) + '</select></label><label>Specialization<select id="specialization">' + SPECIALIZATIONS.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('') + '</select></label></div><div class="button-row">' + btn('Evolve selected element', 'evolve') + btn('Set specialization', 'specialize') + '</div><p class="subtle">Evolution costs 60/120/180 gold and 15/30/45 essence, with 15/30/45 mastery XP. Current evolutions: ' + (Object.entries(player.evolution).map(([id, n]) => ELEMENT_BY_ID[id].name + ' ' + n).join(', ') || 'none') + '.</p><ul class="plain-list">' + SPECIALIZATIONS.map(s => '<li><strong>' + s.name + ':</strong> ' + s.description + (s.tags ? ' Requires: ' + s.tags.join(' or ') + '.' : '') + '</li>').join('') + '</ul></section>'
    + '<h2>Paths of study</h2><div class="research-grid">' + TALENTS.map(t => '<article class="panel content-panel"><div class="eyebrow">' + t.branch + '</div><h2>' + t.name + '</h2><p>' + t.description + '</p>' + (t.requires ? '<p class="subtle">Requires ' + TALENTS.find(x => x.id === t.requires)!.name + '</p>' : '') + btn(player.talents.includes(t.id) ? 'Learned' : 'Learn · ' + t.cost + ' knowledge', 'talent', 'data-id="' + t.id + '"', player.talents.includes(t.id) || player.knowledge < t.cost || Boolean(t.requires && !player.talents.includes(t.requires))) + '</article>').join('') + '</div>'
    + '<h2 class="spaced-heading">A laboratory of your own</h2><div class="research-grid">' + COSMETICS.map(c => '<article class="panel content-panel"><h2 style="color:' + c.color + '">' + c.name + '</h2><p>A cosmetic laboratory palette.</p>' + btn(player.theme === c.id ? 'Selected' : player.cosmetics.includes(c.id) ? 'Apply theme' : c.cost + ' gold', 'cosmetic', 'data-id="' + c.id + '"', player.theme === c.id) + '</article>').join('') + '</div>';
}

export function renderFormationTools(player: Player) {
  return renderFormationLibrary(player) + '<section class="panel content-panel spaced-heading"><h2>Vessels, passives & equipment</h2><p>New vessels unlock through victories. Passives unlock through discoveries. Every vessel is a home for your elements.</p><div class="advanced-formation">' + player.team.map((slot, i) => '<article><h3>Position ' + (i + 1) + ' · ' + VESSEL_BY_ID[slot.vessel].name + '</h3><label>Vessel<select data-x-select="vessel" data-index="' + i + '">' + availableVessels(player).map(v => '<option value="' + v.id + '" ' + (slot.vessel === v.id ? 'selected' : '') + ' ' + (player.team.some((s, n) => n !== i && s.vessel === v.id) ? 'disabled' : '') + '>' + v.name + '</option>').join('') + '</select></label><label>Passive<select data-x-select="passive" data-index="' + i + '">' + PASSIVES.filter(p => (p.unlockDiscoveries ?? 0) <= player.discoveries.length).map(p => '<option value="' + p.id + '" ' + ((slot.passive ?? 'none') === p.id ? 'selected' : '') + '>' + p.name + '</option>').join('') + '</select></label><p class="subtle">' + (PASSIVES.find(p => p.id === slot.passive)?.description ?? 'Choose a passive triggered by combat events.') + '</p><label>Crafted equipment<select data-x-select="equip" data-index="' + i + '"><option value="">Choose a crafted item</option>' + EQUIPMENT.filter(e => player.equipment.includes(e.id)).map(e => '<option value="' + e.id + '">' + e.name + ' (' + e.slot + ')</option>').join('') + '</select></label><p class="subtle">Equipped: ' + (Object.values(slot.equipment ?? {}).map(id => EQUIPMENT.find(e => e.id === id)?.name).join(', ') || 'none') + '</p>' + renderUnitTools(player, i) + [0, 1, 2].map(rank => '<label>Reaction priority ' + (rank + 1) + '<select data-x-select="reaction-priority" data-rank="' + rank + '" data-index="' + i + '"><option value="">Automatic</option>' + player.discoveries.map(id => '<option value="' + id + '" ' + (slot.reactionPriority?.[rank] === id ? 'selected' : '') + '>' + REACTION_BY_ID[id].name + '</option>').join('') + '</select></label>').join('') + '</article>').join('') + '</div></section>';
}

export function renderJournal(player: Player) {
  const current = rotation();
  return heading('Your Field Journal', 'A record of questions, milestones, and the things you are beginning to understand.')
    + '<section class="panel content-panel"><div class="eyebrow">' + current.seasonName + ' · ' + current.season + '</div><h2>This week: ' + current.mutator.name + '</h2><p>' + current.mutator.description + ' Enter Infinite Alchemy to explore the changing rules.</p><a class="text-link" href="#runs">Enter the Unwritten Path →</a><h3>Daily experiment · ' + current.day + ' (UTC)</h3><p>' + current.puzzle.hint + '</p>' + btn(player.dailyClaims.includes('puzzle:' + current.day) ? 'Reward claimed' : 'Claim daily discovery reward', 'daily', '', player.dailyClaims.includes('puzzle:' + current.day) || !player.discoveries.includes(current.puzzle.id)) + '</section>'
    + '<div class="research-grid spaced-heading">' + ['daily', 'weekly', 'festival'].map(kind => { const d = challengeDefinition(kind); return '<article class="panel content-panel"><h2>' + d.name + '</h2><p>' + d.description + '</p><p>' + d.gold + ' gold · ' + d.knowledge + ' knowledge · ' + d.essence + ' essence</p>' + btn(player.dailyClaims.includes(d.key) ? 'Completed this period' : 'Enter trial', 'trial', 'data-id="' + kind + '"', player.dailyClaims.includes(d.key)) + '</article>'; }).join('') + '</div><div class="button-row spaced-heading">' + btn('Claim completed quests', 'claim-all') + '</div>'
    + renderDailyGoals(player)
    + '<h2 class="spaced-heading">Questions worth pursuing</h2><div class="research-grid">' + QUESTS.map(q => '<article class="panel content-panel"><h2>' + q.name + '</h2><p>' + q.description + '</p><div class="meter"><i style="width:' + Math.min(100, questProgress(player, q) / q.target * 100) + '%"></i></div><p class="subtle">' + Math.min(q.target, questProgress(player, q)) + ' / ' + q.target + ' · ' + q.gold + ' gold · ' + q.knowledge + ' knowledge</p>' + btn(player.quests.includes(q.id) ? 'Completed' : 'Claim reward', 'quest', 'data-id="' + q.id + '"', player.quests.includes(q.id) || questProgress(player, q) < q.target) + '</article>').join('') + '</div>'
    + '<h2 class="spaced-heading">Your alchemical identity</h2><div class="stat-grid"><div class="panel stat"><span>Total discoveries</span><strong>' + player.discoveries.length + '</strong></div><div class="panel stat"><span>PvP rating</span><strong>' + (network.account?.rating ?? 'Offline') + '</strong></div><div class="panel stat"><span>Highest reaction chain</span><strong>' + player.highestChain + '</strong></div><div class="panel stat"><span>Highest boss defeated</span><strong class="profile-word">' + esc(highestBoss(player)?.name ?? 'None yet') + '</strong></div><div class="panel stat"><span>Runs completed</span><strong>' + player.runsWon + '</strong></div><div class="panel stat"><span>Deepest endless floor</span><strong>' + player.endlessBest + '</strong></div></div><div class="stat-grid"><div class="panel stat"><span>Rare discoveries</span><strong>' + player.discoveries.filter(id => ['Rare', 'Epic', 'Legendary', 'Mythic'].includes(REACTION_BY_ID[id].rarity)).length + '</strong></div><div class="panel stat"><span>Mastered elements</span><strong>' + Object.values(player.mastery).filter(n => n >= 300).length + '</strong></div><div class="panel stat"><span>Builds tested</span><strong>' + player.learning.testedBuilds.length + '</strong></div><div class="panel stat"><span>Favorite element</span><strong class="profile-word">' + (ELEMENT_BY_ID[player.favorites[0]]?.name ?? 'Undecided') + '</strong></div></div>' + renderAchievements(player)
    + '<details class="panel content-panel spaced-heading"><summary>Recovered memories · ' + player.campaign.length + '</summary>' + ENCOUNTERS.filter(e => player.campaign.includes(e.id)).map(e => '<article><h3>' + e.region + ' · ' + e.name + '</h3><p>' + e.description + '</p></article>').join('') + '</details>'
    + '<details class="panel content-panel spaced-heading"><summary>Local discovery analytics</summary><p class="subtle">These events remain in this journal. Online accounts store their own gameplay events on your server.</p><pre class="data-preview">' + esc(JSON.stringify(analyticsReport(player), null, 2)) + '</pre></details>';
}

export { renderRuns } from './run-ui.js';

export async function handleExpansionAction(player: Player, action: string, target: HTMLElement, helpers: { command: (name: string, payload?: CommandPayload) => Promise<CommandResult>; toast: (text: string) => void; refresh: () => void; runBattle: () => Promise<void>; trial: (kind: string) => Promise<void> }) {
  const id = target.dataset.id ?? "", index = Number(target.dataset.index);
  const value = (selector: string) => query<HTMLInputElement>(selector).value;
  let result;
  switch (action) {
    case 'trial': await helpers.trial(id); return;
    case 'achievement': case 'daily-goal': case 'claim-all': case 'craft-all': case 'craft': case 'talent': case 'quest': case 'cosmetic': result = await helpers.command(action, { id }); break;
    case 'evolve': result = await helpers.command('evolve', { id: value('#evolution-element') }); break;
    case 'specialize': result = await helpers.command('specialize', { id: value('#evolution-element'), specialization: value('#specialization') }); break;
    case 'save-loadout': result = await helpers.command(action, { name: value('#loadout-name') }); break;
    case 'apply-loadout': case 'replace-loadout': case 'delete-loadout': result = await helpers.command(action, { index }); break;
    case 'rename-loadout': result = await helpers.command(action, { index, name: value('#formation-name-' + index) }); break;
    case 'start-run': { const mode = target.dataset.mode; result = await helpers.command(action, { mode, elements: [...new Set([value('#start-a-' + mode), value('#start-b-' + mode)])] }); break; }
    case 'run-reward': result = await helpers.command(action, { index }); break;
    case 'run-experiment': { const rule = await helpers.command(action, { a: value('#run-a'), b: value('#run-b') }); helpers.toast(rule && typeof rule === 'object' && 'name' in rule ? 'Discovered ' + rule.name + ' for this run.' : 'No stable reaction. Try a different pairing.'); helpers.refresh(); return; }
    case 'retire-run': case 'daily': result = await helpers.command(action); break;
    case 'run-battle': await helpers.runBattle(); return;
    default: return;
  }
  helpers.toast(result ? 'Your journal has been updated.' : 'The requirements are not met yet.'); helpers.refresh();
  if (['save-loadout', 'apply-loadout', 'rename-loadout', 'replace-loadout', 'delete-loadout'].includes(action)) {
    const selector = action === 'save-loadout' ? '#loadout-name' : action === 'rename-loadout' ? '#formation-name-' + index : '[data-action="x-' + (action === 'delete-loadout' ? 'apply-loadout' : action) + '"][data-index="' + index + '"]';
    const control = document.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>('.saved-formation:last-child [data-action="x-apply-loadout"]') ?? document.querySelector<HTMLElement>('#loadout-name');
    control?.focus({ preventScroll: true });
  }
}
