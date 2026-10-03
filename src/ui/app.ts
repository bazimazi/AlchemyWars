import { renderStoryScene } from './story-ui.js';
import { renderGuardianNotes, renderUnitInspector, renderContributionReport, renderGuardianReport } from './guardian-ui.js';
import { renderResearchTree } from './research-ui.js';
import { renderHomeObjectives } from './home-objectives.js';
import { discoveryFeedback } from '../data/feedback.js';
import { renderFirstSteps, renderLabConditions, renderKnownRecipes, renderElementLearning, renderBattleLearning, recipeRequirements } from './learning-ui.js';
import { contextFromConditions, experimentContext } from '../core/learning.js';
import { unitAnimation, vesselStats } from './unit-tools.js';
import { renderCodexSection, relationshipLabel } from './codex-expansion.js';
import type { WorldView, SocialPayload } from '../../server/types.js';
import type { SaveStorage } from '../core/save.js';
import { query, errorMessage, escapeHtml } from './dom.js';
import type { Player, ReactionDefinition, BattleConfig, BattleResult, ExperimentResult, HintResult, CommandPayload, CommandResult, Pair, ReactionContext } from '../types.js';
import { track } from '../core/meta.js';
import { challengeConfig, claimChallenge } from '../core/challenges.js';
import { ELEMENT_BY_ID, REACTIONS, REACTION_BY_ID, VESSEL_BY_ID, RELICS, ENCOUNTERS, ENCOUNTER_BY_ID, STATUSES, BALANCE, CONTENT_VERSION } from '../data/content.js';
import { reactionEngine } from '../core/reactions.js';
import { encounterUnlocked, claimBattle, playerLevel, masteryLevel, unlockedRelics } from '../core/progression.js';
import { loadPlayer, savePlayer, parseSave, exportSave } from '../core/save.js';
import { simulateBattle, makeBattleConfig } from '../core/combat.js';
import { icon, sigil, creature, landscape } from './art.js';
import { COSMETICS } from '../data/systems.js';
import { REGIONS } from '../data/expansion.js';
import { executeCommand } from '../core/commands.js';
import { runBattleConfig, completeRunBattle } from '../core/modes.js';
import { renderWorkshop, renderFormationTools, renderJournal, renderRuns, handleExpansionAction } from './expansion-ui.js';
import { network, api, connect, refreshWorld, restoreCachedContent } from './network.js';
import { renderCommunity } from './community.js';
import { renderDiscoveryMap } from './discovery-map.js';
import { renderEditor, editorAction } from './editor.js';
import { installContentPack } from '../core/content-tools.js';
import { resolveExperiment } from '../core/reactions.js';

const app = query('#app');
const modal = query<HTMLDialogElement>('#modal');
let storage: SaveStorage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error(); }, setItem() { throw new Error(); } }; }
try { const response = await fetch('./assets/content-packs.json', { signal: AbortSignal.timeout(2500) }); if (response.ok) for (const pack of await response.json()) installContentPack(pack); } catch (error) { console.error('Content pack load failed:', error); }
restoreCachedContent();
const session = await connect();
const loaded = loadPlayer(storage);
let player = session?.player ?? loaded.player;
const pages: Record<string, [string,string]> = { home: ['home', 'Observatory'], lab: ['lab', 'Alchemy Lab'], team: ['team', 'Your Formation'], battle: ['swords', 'Expeditions'], codex: ['book', 'Discovery Codex'], research: ['research', 'Research'] };
Object.assign(pages, { workshop: ['shield', 'Workshop'], runs: ['graph', 'The Unwritten Path'], journal: ['star', 'Field Journal'] });
pages.community = ['team', 'The Assembly'];
pages.editor = ['settings', 'Alchemy Editor'];
interface UIState {
  page: string; slots: (string | null)[]; active: number; query: string; filter: string; codexTab: string;
  result: ExperimentResult | null; hint: string; environment: string; frozen: boolean; context: ReactionContext; encounter: string;
  battle: BattleResult | null; frame: number; playing: boolean; launching: boolean; speed: number; rewarded: boolean; replay: boolean;
  battleId: string; newDiscoveries: string[]; region: string; battleKind: string;
  challenge?: WorldView['challenges'][number] & { available: string[]; steps: Pair[] };
}
const ui: UIState = {
  page: pages[location.hash.slice(1)] ? location.hash.slice(1) : 'lab', slots: ['fire', 'water'], active: 0,
  query: '', filter: 'all', codexTab: 'elements', result: null, hint: '', environment: 'neutral', frozen: false, context: {},
  encounter: ENCOUNTERS[0].id, battle: null, frame: 0, playing: false, launching: false, speed: 1, rewarded: false, replay: false, battleId: '', newDiscoveries: [],
  region: 'prologue', battleKind: 'campaign',
};
const escape = escapeHtml;
const elementName = (id: string) => (REACTION_BY_ID[id]?.name ?? ELEMENT_BY_ID[id ?? ""]?.name) ?? 'Unknown';
const glyph = (id: string | null | undefined, className = '') => '<span class="element-glyph ' + className + (masteryLevel(player, id ?? "") >= 5 ? ' mastery-variant' : '') + '" style="--element:' + (ELEMENT_BY_ID[id ?? ""]?.color ?? '#b9c2b5') + '">' + icon(ELEMENT_BY_ID[id ?? ""]?.icon ?? 'burst') + '</span>';
const button = (text: string, action: string, className = 'button', extra = '') => '<button class="' + className + '" data-action="' + action + '" ' + extra + '>' + text + '</button>';
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string | undefined) {
  const area = query('#toast');
  area.textContent = message ?? "";
  area.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => area.classList.remove('visible'), 4500);
}
function persist() {
  if (!network.account && !savePlayer(storage, player)) toast('Progress is in memory only. Export a save from Settings to keep it.');
  updateResources();
}
function updateResources() {
  const area = query('#resources');
  if (area) area.innerHTML = '<span title="Knowledge · earned through discoveries and victories">' + icon('research') + '<b>' + player.knowledge + '</b><span>Knowledge</span></span><span title="Gold earned in expeditions">' + icon('coin') + '<b>' + player.gold + '</b><span>Gold</span></span><button class="profile" data-action="settings" aria-label="Settings, Alchemist level ' + playerLevel(player) + '">A<span>' + playerLevel(player) + '</span></button>';
}
function settingsClasses() {
  document.documentElement.style.setProperty('--gold', COSMETICS.find(c => c.id === player.theme)?.color ?? '#d9c394');
  document.documentElement.classList.toggle('reduced-motion', player.settings.reducedMotion);
  document.documentElement.classList.toggle('large-text', player.settings.largeText);
  document.documentElement.classList.toggle('high-contrast', player.settings.highContrast);
  document.documentElement.classList.toggle('left-handed', player.settings.leftHanded);
}
function sound(rule: ReactionDefinition) {
  const feedback = discoveryFeedback(rule);
  if (player.settings.haptics && navigator.vibrate) navigator.vibrate(feedback.haptics);
  if (!player.settings.sound) return;
  try {
    const Audio = window.AudioContext;
    const context = new Audio();
    feedback.notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = feedback.wave; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime + i * 0.09);
      gain.gain.linearRampToValueAtTime(feedback.gain, context.currentTime + i * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.09 + 0.7);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(context.currentTime + i * 0.09); oscillator.stop(context.currentTime + 1);
    });
    setTimeout(() => context.close(), 1300);
  } catch { /* Sound is optional; discovery is always visible. */ }
}

function render() {
  settingsClasses();
  app.innerHTML = '<aside class="sidebar"><a class="brand" href="#home"><span class="brand-mark">' + icon('burst') + '</span><span>ALCHEMY<span>W A R S</span></span></a><div class="sidebar-caption">THE OBSERVATORY</div><nav aria-label="Main navigation">' + Object.entries(pages).filter(([id]) => id !== 'editor' || player.settings.debug).map(([id, [symbol, name]]) => '<a href="#' + id + '" class="nav-link ' + (ui.page === id ? 'active' : '') + '" ' + (ui.page === id ? 'aria-current="page"' : '') + '>' + icon(symbol) + '<span>' + name + '</span>' + (id === 'lab' ? '<i>✦</i>' : '') + '</a>').join('') + '</nav><div class="sidebar-bottom"><div class="journal-mark">' + sigil() + '</div><p>Everything is connected.<br><em>You just have to look closer.</em></p><span class="prototype-tag">THE SHATTERED WORLD - ' + CONTENT_VERSION + '</span>' + button(icon('settings') + ' Settings & save', 'settings', 'settings-button') + '</div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">The Observatory <span>/</span> <strong>' + pages[ui.page][1] + '</strong></div><div id="resources" class="resources"></div></header><main id="main" tabindex="-1">' + renderPage() + '</main><footer class="page-footer"><span>✦ &nbsp; Knowledge is the rarest element.</span><span>' + (network.account ? 'Online journal · ' + escape(network.account!.name) : 'Progress saved on this device') + '</span></footer></div><nav class="mobile-nav" aria-label="Mobile navigation">' + ['home', 'lab', 'team', 'battle', 'codex'].map(id => '<a href="#' + id + '" ' + (ui.page === id ? 'aria-current="page"' : '') + '>' + icon(pages[id][0]) + '<span>' + (({ home: 'Home', lab: 'Alchemy', team: 'Team', battle: 'Battle', codex: 'Codex' } as Record<string,string>)[id]) + '</span></a>').join('') + '</nav>';
  updateResources();
}
function heading(kicker: string, title: string, text: string, action = '') {
  return '<div class="page-heading"><div><div class="eyebrow">' + kicker + '</div><h1>' + title + '</h1><p>' + text + '</p></div>' + action + '</div>';
}
function renderPage() {
  const renderers: Record<string, () => string> = { home: renderHome, lab: renderLab, team: renderTeam, battle: renderBattle, codex: renderCodex, research: renderResearch, workshop: () => renderWorkshop(player), runs: () => renderRuns(player), journal: () => renderJournal(player), community: () => renderCommunity(player), editor: renderEditor };
  const content = (['home', 'lab', 'team', 'battle', 'codex'].includes(ui.page) ? renderFirstSteps(player) : '') + renderers[ui.page]();
  if (ui.page === 'team') return content + renderFormationTools(player);
  if (ui.page === 'home') return content + '<div class="room-links spaced-heading">' + Object.entries(pages).filter(([id]) => !['home', 'lab', 'team', 'battle', 'codex'].includes(id) && (id !== 'editor' || player.settings.debug)).map(([id, [symbol, name]]) => '<a class="panel room-link" href="#' + id + '">' + icon(symbol) + '<span>' + name + '</span>' + icon('arrow') + '</a>').join('') + '</div>';
  return content;
}

async function command(name: 'experiment', payload?: CommandPayload): Promise<ExperimentResult>;
async function command(name: 'hint', payload?: CommandPayload): Promise<HintResult>;
async function command(name: 'run-experiment', payload?: CommandPayload): Promise<ReactionDefinition | null>;
async function command(name: string, payload?: CommandPayload): Promise<CommandResult>;
async function command(name: string, payload: CommandPayload = {}): Promise<CommandResult> {
  if (network.account) { const response = await api('command', { command: name, payload }); player = response.player; updateResources(); return response.result; }
  const result = executeCommand(player, name, payload, { seed: crypto.getRandomValues(new Uint32Array(1))[0] });
  persist(); return result;
}

function renderHome() {
  const latest = player.discoveries.at(-1);
  const next = ENCOUNTERS.find(e => !player.campaign.includes(e.id) && encounterUnlocked(player, e.id)) ?? ENCOUNTERS[0];
  return heading('WELCOME BACK, ALCHEMIST', 'The world is full of <em>what ifs.</em>', 'Your next discovery could change everything.')
    + '<section class="home-hero panel">' + landscape() + '<div class="home-hero-copy"><span class="eyebrow">A WORLD WAITING TO BE UNDERSTOOD</span><h2>Ten fragments.<br>Endless possibilities.</h2><p>The world was shattered. Its secrets weren’t.<br>Find the relationships that hold it together.</p><a class="button primary" href="#lab">Enter the laboratory ' + icon('arrow') + '</a></div></section>'
    + renderHomeObjectives(player)
    + '<div class="stat-grid"><div class="panel stat"><span>Relationships discovered</span><strong>' + player.discoveries.length + '<small> / ' + REACTIONS.length + '</small></strong><div class="meter"><i style="width:' + player.discoveries.length / REACTIONS.length * 100 + '%"></i></div></div><div class="panel stat"><span>Expeditions won</span><strong>' + player.wins + '</strong><small>' + player.campaign.length + ' of ' + ENCOUNTERS.length + ' locations explored</small></div><div class="panel stat"><span>Alchemist level</span><strong>' + playerLevel(player) + '</strong><small>' + (100 - player.xp % 100) + ' XP to the next level</small></div></div>'
    + '<div class="two-column"><section class="panel content-panel"><div class="eyebrow">YOUR NEXT EXPEDITION</div><h2>' + next.name + '</h2><p>' + next.description + '</p><p class="note">' + next.tip + '</p><div class="button-row"><button class="button primary" data-action="quick-battle">Quick battle</button></div><p class="subtle">Resolve this expedition with your current formation and open its report.</p><a href="#battle" class="text-link">Prepare your formation ' + icon('arrow') + '</a></section><section class="panel content-panel"><div class="eyebrow">' + (latest ? 'LATEST DISCOVERY' : 'YOUR FIRST QUESTION') + '</div><h2>' + (latest ? elementName(latest) : 'What happens when fire meets water?') + '</h2><p>' + (latest ? REACTION_BY_ID[latest].description : 'Place two elements in the alchemy circle. Every relationship begins with a little curiosity.') + '</p><a href="#' + (latest ? 'codex' : 'lab') + '" class="text-link">' + (latest ? 'Open your codex' : 'Try your first experiment') + ' ' + icon('arrow') + '</a></section></div>';
}

function labContext() { return experimentContext({ ...ui.context, environment: ui.environment, statuses: [...new Set([...[...(ui.context.statuses ?? [])].filter(id => id !== 'freeze'), ...(ui.frozen ? ['freeze'] : [])])] }); }
function renderLab() {
  return heading('EXPERIMENT. DISCOVER. UNDERSTAND.', 'The Alchemy Lab', 'Great discoveries begin with a simple question: what happens if…', '<a class="quiet-link" href="#codex">' + icon('book') + ' Open codex ' + icon('arrow') + '</a>')
    + '<div class="lab-layout"><section class="panel experiment-panel"><div class="panel-top"><span>EXPERIMENT <b>№ ' + String(player.experiments + 1).padStart(3, '0') + '</b></span><span class="live-label"><i></i> Ready for a little wonder</span></div><div id="lab-stage">' + renderLabStage() + '</div><div class="lab-context"><label>Atmosphere <select id="environment" aria-label="Experiment atmosphere">' + [['neutral', 'Still air'], ['rain', 'Rain'], ['storm', 'Storm'], ['holy', 'Holy ground'], ['night', 'Night']].map(([id, name]) => '<option value="' + id + '" ' + (ui.environment === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label><label class="check-label"><input id="frozen" type="checkbox" ' + (ui.frozen ? 'checked' : '') + '> Frozen target</label><span>Experiments are always free</span></div>' + renderLabConditions(player, labContext()) + '</section><aside class="panel field-notes"><div class="eyebrow">' + icon('book') + ' FIELD NOTES</div><h2>Follow your<br><em>curiosity.</em></h2><p>Elements are only the beginning. Discover the relationships between them.</p><ol class="objective-list"><li class="' + (player.discoveries.length ? 'done' : '') + '"><span>' + (player.discoveries.length ? '✓' : '1') + '</span>Discover your first reaction</li><li class="' + (player.team.some(s => s.elements.some(id => !ELEMENT_BY_ID[id].base)) ? 'done' : '') + '"><span>2</span>Bind it to a vessel</li><li class="' + (player.wins ? 'done' : '') + '"><span>3</span>See your theory in battle</li></ol><div class="notes-bottom"><div><span>YOUR DISCOVERY JOURNAL</span><b>' + player.discoveries.length + '<small> / ' + REACTIONS.length + '</small></b></div><div class="meter"><i style="width:' + player.discoveries.length / REACTIONS.length * 100 + '%"></i></div></div></aside></div>'
    + '<datalist id="element-names">' + player.owned.map(id => '<option value="' + escape(ELEMENT_BY_ID[id].name) + '"></option>').join('') + '</datalist>' + renderKnownRecipes(player)
    + '<section class="collection-section"><div class="section-heading"><div><h2>Your elements <span class="count">' + player.owned.length + '</span></h2><p>Choose an element to place in the highlighted circle.</p></div><label class="search">' + icon('search') + '<input id="element-search" type="search" list="element-names" placeholder="Find an element…" aria-label="Search elements" value="' + escape(ui.query) + '"></label></div><div class="collection-toolbar"><div class="tabs" aria-label="Element filters">' + ['all', 'base', 'derived', 'favorites'].map(filter => button(({ all: 'All elements', base: 'Primordial', derived: 'Discovered', favorites: 'Favorites' }[filter] ?? filter), 'filter', 'tab ' + (ui.filter === filter ? 'selected' : ''), 'data-value="' + filter + '" aria-pressed="' + (ui.filter === filter) + '"')).join('') + '</div>' + button(icon('research') + ' A little inspiration <span>2 ✦</span>', 'hint', 'hint-button') + '</div><div id="hint-area" class="hint-area" ' + (!ui.hint ? 'hidden' : '') + '>' + escape(ui.hint) + '</div><div id="inventory" class="element-grid">' + renderInventory() + '</div></section>'
    + '<section class="recent-section"><div class="section-heading"><h2>On your workbench</h2><span class="subtle">Your recent experiments</span></div><div class="history-grid">' + (player.history.length ? player.history.slice(0, 4).map((entry, i) => '<button class="history-card" data-action="repeat" data-index="' + i + '"><div class="history-symbols">' + glyph(entry.inputs[0]) + '<span>+</span>' + glyph(entry.inputs[1]) + '<span>→</span>' + (entry.result ? glyph(entry.result) : '<span class="unknown-glyph">?</span>') + '</div><strong>' + (entry.result ? elementName(entry.result) : 'An unanswered question') + '</strong><small>' + entry.inputs.map(elementName).join(' + ') + '</small></button>').join('') : '<div class="empty-workbench">' + icon('lab') + '<div><strong>A fresh page in your journal.</strong><p>Your experiments will appear here. Start with fire and water.</p></div></div>') + '</div></section>';
}
function renderLabStage() {
  return '<div class="alchemy-stage">' + sigil() + '<div class="stage-specks" aria-hidden="true">✦<span>·</span><i>✧</i></div><div class="ingredients">' + ui.slots.map((id, i) => '<div class="ingredient"><button class="ingredient-circle ' + (ui.active === i ? 'focused' : '') + '" data-action="slot" data-index="' + i + '" data-drop-slot="' + i + '" style="--element:' + (ELEMENT_BY_ID[id ?? ""]?.color ?? '#8b9a88') + '" aria-label="Ingredient ' + (i + 1) + ': ' + (id ? elementName(id) : 'empty') + '. Select to replace.">' + (id ? glyph(id, 'orb-glyph') : '<span class="plus">+</span>') + '</button><span class="ingredient-caption">' + (i === 0 ? 'THE FIRST ELEMENT' : 'A NEW POSSIBILITY') + '</span><strong>' + (id ? elementName(id) : 'Choose an element') + '</strong></div>').join('<span class="combine-plus" aria-hidden="true">+</span>') + '</div>' + button(icon('lab') + ' Combine elements ' + icon('arrow'), 'combine', 'button primary combine-button', ui.slots.some(id => !id) ? 'disabled' : '') + '<span class="stage-note">Two elements. One new possibility.</span></div><div class="result-strip ' + (ui.result?.rule ? 'has-result' : '') + '">' + (ui.result ? ui.result.rule ? glyph(ui.result.rule.output) + '<div><span>' + (ui.result.isNew ? 'NEW DISCOVERY' : 'A FAMILIAR RELATIONSHIP') + '</span><strong>' + ui.result.rule.name + '</strong><p>' + ui.result.rule.description + '</p></div>' + button(icon('arrow'), 'continue-chain', 'icon-button', 'aria-label="Use ' + ui.result.rule.name + ' in your next experiment"') : icon('research') + '<div><strong>No stable reaction. Yet.</strong><p>Nothing was consumed. Try another element or a different atmosphere.</p></div>' : '<span class="tiny-sigil">✧</span><div><strong>There’s something waiting to be discovered.</strong><p>Bring two elements together and see what unfolds.</p></div>') + '</div>';
}
function renderInventory() {
  const elements = player.owned.map(id => ELEMENT_BY_ID[id]).filter(e => (!ui.query || (e.name + ' ' + e.tags.join(' ')).toLowerCase().includes(ui.query.toLowerCase())) && (ui.filter === 'all' || ui.filter === 'base' && e.base || ui.filter === 'derived' && !e.base || ui.filter === 'favorites' && player.favorites.includes(e.id)));
  return elements.length ? elements.map(e => '<article class="element-card ' + (ui.slots.includes(e.id) ? 'in-use' : '') + '" style="--element:' + e.color + '"><button class="element-select" data-action="choose" data-id="' + e.id + '" draggable="true" aria-label="Select ' + e.name + '">' + glyph(e.id) + '<strong>' + e.name + '</strong><span>' + (e.rarity + ' · Tier ' + e.tier) + '</span>' + (ui.slots.includes(e.id) ? '<i class="selection-mark">' + (ui.slots.indexOf(e.id) === 0 ? 'I' : 'II') + '</i>' : '') + '</button><p class="relationship-count">' + relationshipLabel(player, e.id) + '</p><div class="element-card-bottom"><button data-action="detail" data-id="' + e.id + '" aria-label="Read about ' + e.name + '">Mastery ' + masteryLevel(player, e.id) + '</button><button class="favorite ' + (player.favorites.includes(e.id) ? 'is-favorite' : '') + '" data-action="favorite" data-id="' + e.id + '" aria-label="Favorite ' + e.name + '" aria-pressed="' + player.favorites.includes(e.id) + '">' + icon('star') + '</button></div></article>').join('') : '<div class="empty-state">' + icon('search') + '<h3>No elements here yet.</h3><p>' + (ui.filter === 'derived' ? 'Your discoveries will join your collection here.' : 'Try another search or filter.') + '</p></div>';
}

function renderTeam() {
  return heading('GIVE YOUR DISCOVERIES A PURPOSE', 'Your Formation', 'Five vessels. Countless ways to bring your alchemy to life.', '<a class="button primary" href="#battle">Choose an expedition ' + icon('arrow') + '</a>')
    + '<div class="formation-note">' + icon('shield') + '<p><strong>Order matters.</strong> Enemies target the front vessel first. Pair elements for reactions, or alternate them to prepare your allies’ attacks.</p></div><div class="team-grid">' + player.team.map((slot, i) => {
      const vessel = VESSEL_BY_ID[slot.vessel], stats = vesselStats(player, slot.vessel);
      const options = (selected: string) => player.owned.map(id => '<option value="' + id + '" ' + (id === selected ? 'selected' : '') + '>' + elementName(id) + '</option>').join('');
      return '<article class="panel vessel-card"><div class="vessel-top"><span class="eyebrow">' + (i === 0 ? 'FRONTLINE' : 'POSITION 0' + (i + 1)) + '</span><div>' + button('↑', 'move', 'icon-button', 'data-index="' + i + '" data-dir="-1" aria-label="Move ' + vessel.name + ' forward" ' + (i === 0 ? 'disabled' : '')) + button('↓', 'move', 'icon-button', 'data-index="' + i + '" data-dir="1" aria-label="Move ' + vessel.name + ' back" ' + (i === 4 ? 'disabled' : '')) + '</div></div><div class="vessel-art" style="--element:' + ELEMENT_BY_ID[slot.elements[0]].color + '">' + creature(vessel.shape, ELEMENT_BY_ID[slot.elements[0]].color) + '</div><h2>' + vessel.name + '</h2><span class="role-tag">' + vessel.role + '</span><div class="vessel-stats"><span><b>' + stats.hp + '</b> Health</span><span><b>' + stats.attack + '</b> Power</span><span><b>' + stats.armor + '</b> Armor</span></div><label>Core element<select data-loadout="core" data-index="' + i + '">' + options(slot.elements[0]) + '</select></label><label>Secondary element<select data-loadout="secondary" data-index="' + i + '">' + options(slot.elements[1]) + '</select></label><label>Relic<select data-loadout="relic" data-index="' + i + '">' + unlockedRelics(player).map(r => '<option value="' + r.id + '" ' + (r.id === slot.relic ? 'selected' : '') + '>' + escape(r.name) + ' / ' + (r.rarity ?? 'Common') + '</option>').join('') + '</select></label><details><summary>Battle strategy</summary><label>Target<select data-loadout="targeting" data-index="' + i + '">' + [['front', 'Front enemy'], ['weakest', 'Lowest health'], ['reaction', 'Best reaction']].map(([id, name]) => '<option value="' + id + '" ' + (slot.targeting === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label><label>Casting priority<select data-loadout="priority" data-index="' + i + '">' + [['reaction', 'Seek reactions'], ['alternate', 'Alternate elements'], ['core', 'Core element only']].map(([id, name]) => '<option value="' + id + '" ' + (slot.priority === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label></details></article>';
    }).join('') + '</div><div class="panel content-panel team-tip"><h3>Discoveries belong on the battlefield.</h3><p>Every derived element can be equipped in either slot. Reach element mastery 3 to splash 20% of its strike onto a second enemy. Relics unlock at 2, 4, and 6 discoveries.</p></div>';
}

function renderBattle() {
  if (ui.battle) return renderBattlePlayback();
  const encounters = ENCOUNTERS.filter(e => ui.region === 'prologue' ? !e.regionId : e.regionId === ui.region);
  return heading('PUT YOUR THEORIES TO THE TEST', 'Beyond the Observatory', 'The world has changed. Take your discoveries out into it.', '<a class="quiet-link" href="#team">' + icon('team') + ' Edit formation ' + icon('arrow') + '</a>')
    + '<div class="tabs campaign-tabs">' + [{ id: 'prologue', name: 'Prologue' }, ...REGIONS].map(r => button(r.name, 'campaign-region', 'tab ' + (ui.region === r.id ? 'selected' : ''), 'data-value="' + r.id + '"')).join('') + '</div>'
    + '<section class="expedition-banner panel">' + landscape() + '<div><span class="eyebrow">FRAGMENTS OF A BROKEN WORLD</span><h2>The first step is<br><em>always a question.</em></h2><p>Five elemental regions. A world of relationships to discover.</p></div></section>' + (encounterUnlocked(player, ui.encounter) ? renderStoryScene(player, ENCOUNTER_BY_ID[ui.encounter], 'before') + renderGuardianNotes(ENCOUNTER_BY_ID[ui.encounter]) : '') + '<div class="encounter-grid">' + encounters.map(e => {
      const unlocked = encounterUnlocked(player, e.id);
      return '<article class="panel encounter ' + (ui.encounter === e.id ? 'chosen' : '') + ' ' + (!unlocked ? 'locked' : '') + '"><div class="encounter-number">' + e.label + '<span>' + (player.campaign.includes(e.id) ? '✓ EXPLORED' : e.boss ? 'BOSS ENCOUNTER' : e.environment.toUpperCase()) + '</span></div><h2>' + e.name + '</h2><p>' + (unlocked ? e.description : 'Complete the previous expedition to uncover this memory.') + '</p><div class="encounter-tip">' + icon(e.boss ? 'shield' : 'research') + '<span>' + e.tip + '</span></div><div class="reward-preview"><span>' + icon('coin') + e.gold + '</span><span>' + icon('research') + e.knowledge + '</span><span>' + e.xp + ' XP</span></div>' + button(unlocked ? (ui.encounter === e.id ? 'Selected ' + icon('check') : 'Explore this location ' + icon('arrow')) : icon('lock') + ' Complete the previous expedition', 'encounter', 'button ' + (ui.encounter === e.id ? 'primary' : 'secondary'), 'data-id="' + e.id + '" ' + (!unlocked ? 'disabled' : '')) + '</article>';
    }).join('') + '<section class="panel battle-launch"><div><span class="eyebrow">YOUR EXPEDITION PARTY</span><div class="mini-party">' + player.team.map(s => '<span title="' + VESSEL_BY_ID[s.vessel].name + '">' + creature(VESSEL_BY_ID[s.vessel].shape, ELEMENT_BY_ID[s.elements[0]].color) + '</span>').join('') + '</div></div><div><p>Watch the relationships unfold.</p>' + button('Begin expedition ' + icon('arrow'), 'start-battle', 'button primary', encounterUnlocked(player, ui.encounter) ? '' : 'disabled') + '</div></section>' + (player.lastReplay ? '<div class="replay-link">' + button('Watch your last battle replay', 'last-replay', 'quiet-link') + '</div>' : '');
}

function renderBattlePlayback() {
  const battle = ui.battle;
  if (!battle) return "";
  const encounter = battle.config.encounter ?? ENCOUNTER_BY_ID[battle.config.encounterId];
  const done = ui.frame >= battle.frames.length - 1;
  return heading(ui.replay ? 'REPLAY · SAME SEED, SAME STORY' : 'EXPEDITION IN PROGRESS', encounter.name, encounter.tip)
    + '<section class="panel battle-panel"><div class="battle-toolbar"><span class="live-label"><i></i> ' + encounter.environment.toUpperCase() + '</span><strong id="battle-clock">' + battle.frames[ui.frame].time.toFixed(1) + 's</strong><div>' + button(ui.playing ? 'Pause' : 'Play', 'pause', 'small-button', done ? 'disabled' : '') + button(ui.speed + '×', 'speed', 'small-button', 'aria-label="Playback speed"') + button('Skip to report', 'skip', 'small-button', done ? 'disabled' : '') + '</div></div><div id="arena" class="arena">' + renderArena() + '</div><div id="reaction-callout" class="reaction-callout" aria-live="polite">' + (done ? 'The elements settle.' : 'Your vessels are preparing their first move…') + '</div></section><div id="battle-report">' + (done ? renderReport() : '') + '</div><details class="panel combat-journal" ' + (player.settings.debug ? 'open' : '') + '><summary>Battle journal <span>Seed ' + battle.config.seed + ' · ' + battle.config.contentVersion + '</span></summary><div id="combat-log">' + renderCombatLog() + '</div></details>';
}

function renderArena() {
  if (!ui.battle) return "";
  const frame = ui.battle.frames[ui.frame];
  const recent = ui.battle.events.slice(Math.max(0, frame.eventCount - 10), frame.eventCount);
  return landscape() + (frame.object ? '<div class="arena-object" title="' + escape(frame.object.description) + '">' + icon('star') + '<span>' + frame.object.name + (frame.object.charges ? ' · ' + frame.object.charges + ' charges' : '') + '</span></div>' : '') + '<div class="arena-side allies"><span class="side-label">YOUR FORMATION</span>' + renderSide('ally') + '</div><div class="arena-divider">✧</div><div class="arena-side enemies"><span class="side-label">THE OPPOSITION</span>' + renderSide('enemy') + '</div>';
  function renderSide(side: string) {
    return '<div class="combat-units">' + frame.units.filter(u => u.side === side).map(u => {
      const hit = recent.findLast(e => e.target === u.id && e.type === 'damage' && frame.time - e.time < 0.5);
      return '<div class="combat-unit ' + (u.hp === 0 ? 'fallen' : '') + ' ' + (hit ? 'hit' : '') + '"><div class="unit-sprite"' + unitAnimation(u.definitionId, recent.some(e => e.type === 'cast' && e.source === u.id && frame.time - e.time < .5), frame.time) + '>' + creature(u.shape, ELEMENT_BY_ID[u.elements[0]].color) + (hit ? '<span class="damage-number">−' + hit.amount + '</span>' : '') + '</div><button class="unit-inspect" data-action="inspect-unit" data-id="' + u.id + '" aria-label="Inspect ' + escape(u.name) + '">' + escape(u.name) + '</button>' + (u.phaseLabel ? '<span class="phase-label">' + escape(u.phaseLabel) + '</span>' : '') + '<div class="healthbar" role="meter" aria-label="' + u.name + ' health" aria-valuemin="0" aria-valuemax="' + u.maxHp + '" aria-valuenow="' + u.hp + '"><i style="width:' + u.hp / u.maxHp * 100 + '%"></i></div><span class="health-text">' + u.hp + ' / ' + u.maxHp + (u.shield ? ' · ◇ ' + u.shield : '') + '</span><div class="status-row">' + (u.hp === 0 ? '<span>FALLEN</span>' : u.statuses.slice(0, 5).map(s => '<span aria-label="' + STATUSES[s.id].name + '" title="' + STATUSES[s.id].name + ' · ' + s.remaining.toFixed(1) + 's">' + STATUSES[s.id].short + (s.stacks > 1 ? ' ' + s.stacks : '') + '</span>').join('')) + '</div></div>';
    }).join('') + '</div>';
  }
}
function renderCombatLog() {
  if (!ui.battle) return "";
  const frame = ui.battle.frames[ui.frame];
  if (player.settings.debug) return '<pre class="data-preview">' + escape(JSON.stringify({ seed: ui.battle.config.seed, state: frame, events: ui.battle.events.slice(0, frame.eventCount).slice(-35) }, null, 2)) + '</pre>';
  const unitName = (id?: string) => ui.battle!.final.units.find(u => u.id === id)?.name ?? 'The field';
  return ui.battle.events.slice(0, frame.eventCount).filter(e => ['reaction', 'phase', 'death', 'cast', 'behavior', 'counter', 'cleanse'].includes(e.type)).slice(-35).reverse().map(e => {
    const from = escape(unitName(e.source)), to = escape(unitName(e.target));
    const text = e.type === 'reaction' ? '<b>' + escape(e.name) + '</b> \u00b7 chain ' + e.depth + ' \u00b7 ' + from + ' \u2192 ' + to
      : e.type === 'cast' ? escape(e.name ?? elementName(e.element ?? '')) + ' \u00b7 ' + from + ' \u2192 ' + to
      : e.type === 'counter' ? escape(STATUSES[e.status!].name) + ' interrupted ' + escape(e.name) + ' \u00b7 ' + from
      : e.type === 'behavior' ? escape(e.name) + ' \u00b7 ' + from
      : e.type === 'cleanse' ? from + ' cleansed ' + e.amount + ' effects from ' + to
      : escape(e.name) + (e.type === 'death' ? ' fell' : ' \u00b7 ' + to);
    return '<div><time>' + e.time.toFixed(2) + '</time><span>' + text + '</span></div>';
  }).join('') || '<p>The journal will record every reaction.</p>';
}
function renderReport() {
  const battle = ui.battle;
  if (!battle) return "";
  const victory = battle.outcome === 'victory';
  const encounter = battle.config.encounter ?? ENCOUNTER_BY_ID[battle.config.encounterId];
  const reactions = Object.entries(battle.report.reactions).sort((a, b) => b[1] - a[1]);
  const valuable = Object.entries(battle.report.damageByReaction ?? {}).sort((a, b) => b[1] - a[1])[0];
  const damage = Object.entries(battle.report.damageByElement).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return '<section class="panel report"><div class="report-heading"><span class="report-emblem">' + icon(victory ? 'star' : 'shield') + '</span><div><div class="eyebrow">' + (ui.replay ? 'REPLAY COMPLETE · NO REWARDS' : 'EXPEDITION COMPLETE') + '</div><h2>' + (victory ? 'A theory, proven.' : battle.outcome === 'draw' ? 'A question left open.' : 'Every experiment teaches us.') + '</h2><p>' + (victory ? 'Victory in ' : battle.outcome === 'draw' ? 'Time limit reached after ' : 'Defeated after ') + battle.duration.toFixed(1) + ' seconds · ' + battle.report.highestChain + '-step longest reaction chain</p></div></div>'
    + (victory && !ui.replay && ['campaign', 'daily', 'weekly', 'festival'].includes(ui.battleKind) ? '<div class="earned-rewards"><span>+' + encounter.gold + ' gold</span><span>+' + encounter.knowledge + ' knowledge</span><span>+' + encounter.xp + ' XP</span></div>' : '')
    + '<div class="two-column"><div><h3>Your elemental contribution</h3>' + damage.map(([id, amount]) => '<div class="damage-stat"><span>' + elementName(id) + '</span><div class="meter"><i style="width:' + amount / battle.report.totalDamage * 100 + '%;background:' + ELEMENT_BY_ID[id].color + '"></i></div><b>' + Math.round(amount / battle.report.totalDamage * 100) + '%</b></div>').join('') + '</div><div><h3>Relationships in action</h3><div class="reaction-tags">' + (reactions.length ? reactions.map(([id, count]) => '<button data-action="detail" data-id="' + id + '">' + REACTION_BY_ID[id].name + '<b>×' + count + '</b></button>').join('') : '<p>No reactions occurred. Try complementary elements across your team.</p>') + '</div></div></div><p class="learning-note">' + icon('research') + (reactions.length ? 'Your most frequent reaction was ' + REACTION_BY_ID[reactions[0][0]].name + '. Try using its derived element as a core, then experiment with a new secondary.' : 'Water prepares enemies for lightning. Try a Tide Sylph with Water and Lightning.') + '</p>'
    + (valuable ? '<p class="note">Highest damaging reaction: ' + REACTION_BY_ID[valuable[0]].name + ' · ' + Math.round(valuable[1]) + ' damage, including lingering effects.</p>' : '')
    + (ui.newDiscoveries.length && !ui.replay ? '<p class="discovery-report">✦ Added to your codex: ' + ui.newDiscoveries.map(elementName).join(', ') + '.</p>' : '')
    + (!ui.rewarded && !ui.replay ? '<p class="note">Rewards are awaiting server confirmation.</p>' + button('Retry reward claim', 'retry-claim', 'button primary') : '')
    + renderContributionReport(battle) + renderGuardianReport(battle)
    + (victory && ui.rewarded && !ui.replay && ui.battleKind === 'campaign' ? renderStoryScene(player, encounter, 'after') : '')
    + renderBattleLearning(player, battle, ui.rewarded && !ui.replay)
    + '<div class="report-actions">' + button('Continue exploring ' + icon('arrow'), 'leave-battle', 'button primary') + '<a href="#lab" class="button secondary">Back to the laboratory</a>' + button('Replay battle', 'replay-current', 'quiet-link') + '</div></section>';
}

function renderCodex() {
  return heading('A JOURNAL OF RELATIONSHIPS', 'The Discovery Codex', 'Every page is something you learned about the world.', '<span class="codex-total">' + player.discoveries.length + ' <small>/ ' + REACTIONS.length + ' reactions</small></span>')
    + '<div class="tabs codex-tabs">' + [['elements', 'Elements'], ['reactions', 'Reactions'], ['graph', 'Discovery map'], ['statuses', 'Status effects'], ['creatures', 'Creatures'], ['artifacts', 'Artifacts'], ['chains', 'Chains'], ['lore', 'Lore']].map(([id, label]) => button(label, 'codex-tab', 'tab ' + (ui.codexTab === id ? 'selected' : ''), 'data-value="' + id + '" aria-pressed="' + (ui.codexTab === id) + '"')).join('') + '</div>'
    + (renderCodexSection(player, ui.codexTab) ?? (ui.codexTab === 'elements' ? '<div class="codex-grid">' + player.owned.map(id => {
      const e = ELEMENT_BY_ID[id];
      return '<button class="panel codex-card" data-action="detail" data-id="' + id + '">' + glyph(id) + '<span class="eyebrow">' + e.rarity + ' · TIER ' + e.tier + '</span><h2>' + e.name + '</h2><p>' + e.description + '</p><p class="subtle">' + relationshipLabel(player, id) + '</p><span class="codex-mastery">Mastery ' + masteryLevel(player, id ?? "") + ' <span>' + (player.mastery[id] ?? 0) + ' XP</span></span></button>';
    }).join('') + '</div>' : ui.codexTab === 'statuses' ? '<div class="codex-grid">' + Object.values(STATUSES).map(s => '<article class="panel content-panel"><span class="status-badge">' + s.short + '</span><h2>' + s.name + '</h2><p>' + ({ burn: 'Periodic fire damage. Stacks up to 3 times.', poison: 'Periodic venom damage. Stacks up to 4 times.', wet: 'Prepares water reactions, including steam and conductivity.', freeze: 'Stops a vessel from casting until it thaws.', shock: 'Disrupts the target, slowing its cast timer.', root: 'Entangles the target and slows casting.', slow: 'Reduces how quickly the next cast becomes ready.', haste: 'Accelerates the next cast.', blind: 'Reduces the power of direct strikes.', 'armor-break': 'Reduces armor before damage is calculated.', vulnerable: 'Increases damage received from every source.', conductive: 'Amplifies damage with the electricity tag.', regeneration: 'Restores health every second.', bleed: 'Physical damage over time that stacks.', silence: 'Suppresses the base effects of elemental casts.', barrier: 'Reduces incoming damage.', 'resistance-break': 'Increases damage received.', drain: 'Restores health when dealing damage.', reflect: 'Returns part of incoming damage to the attacker.', taunt: 'Draws enemy attacks toward this vessel.' }[s.id] ?? s.description ?? 'A configurable combat status.') + '</p></article>').join('') + '</div>' : renderReactionCollection()));
}
function renderReactionCollection() {
  if (ui.codexTab === 'graph') return renderDiscoveryMap(player);
  const graph = reactionEngine.graph(player.discoveries, player.owned);
  return '<p class="codex-intro">' + (ui.codexTab === 'graph' ? 'Follow the threads of your discoveries. Unwritten branches are invitations to experiment.' : 'Known relationships are yours to keep. Hints in the laboratory can help fill the missing pages.') + '</p><div class="' + (ui.codexTab === 'graph' ? 'graph-list' : 'recipe-grid') + '">' + graph.map(node => '<article class="panel recipe-card ' + (node.known ? 'known' : 'unknown') + '"><div class="recipe-inputs">' + node.inputs.map(id => '<span>' + (id ? glyph(id) + '<small>' + elementName(id) + '</small>' : '<i class="unknown-glyph">?</i><small>Unknown</small>') + '</span>').join('<b>+</b>') + '<b class="recipe-arrow">→</b></div>' + (node.known ? '<button class="recipe-output" data-action="detail" data-id="' + node.output + '">' + glyph(node.output) + '<span><strong>' + node.name + '</strong><small>' + node.category + ' · ' + (player.reactionUsage[node.id] ?? 0) + ' battle uses</small></span></button>' : '<div class="recipe-output"><span class="unknown-glyph">?</span><span><strong>An undiscovered relationship</strong><small>Let curiosity be your guide</small></span></div>') + '</article>').join('') + '</div>';
}

function renderResearch() {
  return heading('UNDERSTANDING CHANGES EVERYTHING', 'A deeper kind of alchemy', 'Spend knowledge to change what your entire formation can do.', '<span class="knowledge-balance">' + icon('research') + player.knowledge + ' knowledge</span>')
    + renderResearchTree(player) + '<div class="section-heading relic-heading"><div><h2>Relics of the old world</h2><p>Discover relationships to unlock relics, then equip them in your formation.</p></div></div><div class="research-grid">' + RELICS.filter(r => r.id !== 'none').map(r => '<article class="panel content-panel"><span class="eyebrow">' + (player.discoveries.length >= (r.discoveries ?? 0) ? 'UNLOCKED' : 'UNLOCKS AT ' + r.discoveries + ' DISCOVERIES') + ' / ' + (r.rarity ?? 'Common') + '</span><h2>' + r.name + '</h2><p>' + r.description + '</p><a class="text-link" href="#team">Visit your formation ' + icon('arrow') + '</a></article>').join('') + '</div>';
}

function openModal(content: string, className = '') {
  modal.className = className;
  modal.innerHTML = button(icon('close'), 'close-modal', 'modal-close icon-button', 'aria-label="Close dialog"') + content;
  if (!modal.open) modal.showModal();
}
function showDetail(id: string) {
  id = REACTION_BY_ID[id]?.output ?? id;
  const e = ELEMENT_BY_ID[id];
  if (!e || !player.owned.includes(id)) return;
  const recipe = REACTIONS.find(r => r.output === id && player.discoveries.includes(r.id));
  const known = REACTIONS.filter(r => player.discoveries.includes(r.id) && r.inputs.includes(id));
  openModal('<div class="detail-header">' + glyph(id, 'large-glyph') + '<span class="eyebrow">' + e.rarity + ' · TIER ' + e.tier + '</span><h2>' + e.name + '</h2><p>' + e.lore + '</p></div><div class="detail-mastery"><strong>Mastery ' + masteryLevel(player, id ?? "") + '</strong><span>' + (player.mastery[id] ?? 0) + ' XP</span><div class="meter"><i style="width:' + (player.mastery[id] ?? 0) % BALANCE.masteryThreshold / BALANCE.masteryThreshold * 100 + '%"></i></div><p>Mastery 3 adds splash. Mastery 5 unlocks a visual variant, remembered lore, and longer statuses. Mastery 7 grants an explosion on kills. Mastery 10 unlocks special experiments.</p></div><div class="tag-list">' + e.tags.map(t => '<span>' + t + '</span>').join('') + '</div>' + (masteryLevel(player, id ?? "") >= 5 ? '<p class="note">Remembered lore: ' + e.name + ' was never a thing to possess. It was a relationship you learned to recognize.</p>' : '') + renderElementLearning(player, id) + '<h3>Battle role</h3><p>' + e.role + ' · ' + e.description + '</p><h3>Used by</h3><p>' + (player.team.filter(s => s.elements.includes(id)).map(s => VESSEL_BY_ID[s.vessel].name).join(', ') || 'No vessel in your current formation') + '</p><h3>Known relationships</h3>' + (known.length ? known.map(r => '<p class="detail-recipe">' + r.inputs.map(elementName).join(' + ') + ' → <strong>' + r.name + '</strong><small class="recipe-condition">' + escape(recipeRequirements(r.id)) + '</small></p>').join('') : '<p class="subtle">There are still connections waiting to be found.</p>') + '<div class="modal-actions">' + button('Use in the laboratory', 'use-element', 'button primary', 'data-id="' + id + '"') + (recipe ? button('Practice known recipe ×10', 'practice', 'button secondary', 'data-id="' + recipe.id + '"') : '') + '</div>');
}
function showDiscovery(rule: ReactionDefinition) {
  openModal('<div class="discovery-reveal" data-grade="' + discoveryFeedback(rule).grade + '" style="--element:' + rule.color + '"><div class="reveal-orbit">' + sigil() + glyph(rule.output, 'large-glyph') + '</div><div class="eyebrow">✦ NEW DISCOVERY ✦</div><h2>' + rule.name + '</h2><span class="discovery-rarity">' + escape(rule.rarity) + '</span><div class="discovery-recipe">' + rule.inputs.map(elementName).join(' + ') + '</div><p>' + rule.description + '</p><div class="discovery-rewards"><span>+' + BALANCE.discoveryKnowledge + ' knowledge</span><span>+' + BALANCE.discoveryXp + ' XP</span><span>Added to your codex</span></div><div class="modal-actions">' + button('Keep experimenting ' + icon('arrow'), 'continue-chain', 'button primary') + button('Build with this discovery', 'build-discovery', 'quiet-link') + '</div></div>', 'discovery-modal');
  sound(rule);
}
function showSettings() {
  openModal('<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>Settings & your journal</h2><div class="settings-list">' + [['haptics', 'Discovery vibration', 'A brief tap on supported mobile devices.'], ['sound', 'Discovery sounds', 'A short chime when you uncover a new reaction.'], ['reducedMotion', 'Reduced motion', 'Keep the interface still and remove battle shake.'], ['highContrast', 'High contrast', 'Brighter text and stronger outlines for controls.'], ['largeText', 'Larger text', 'Increase the size of interface text.'], ['leftHanded', 'Left-handed navigation', 'Move mobile alchemy controls toward your left hand.'], ['debug', 'Battle journal open', 'See reaction chains, targeting decisions and the replay seed.']].map(([id, name, detail]) => '<label class="setting-row"><span><strong>' + name + '</strong><small>' + detail + '</small></span><input type="checkbox" data-setting="' + id + '" ' + (player.settings[id as keyof Player["settings"]] ? 'checked' : '') + '></label>').join('') + '</div><h3>Keep your discoveries</h3><p class="subtle">Your journal saves automatically in this browser. Export a copy to take it with you. Import replaces the current journal and keeps a local backup.</p><div class="save-actions">' + button('Export save', 'export', 'button secondary') + '<label class="button secondary file-button">Import save<input id="import-save" type="file" accept=".json,application/json"></label></div><a href="#research" class="text-link" data-action="close-modal">Open research ' + icon('arrow') + '</a>');
}

function refreshLab() {
  query('#lab-stage').innerHTML = renderLabStage();
  query('#inventory').innerHTML = renderInventory();
}
function selectElement(id: string) {
  if (!player.owned.includes(id)) return;
  ui.slots[ui.active] = id;
  ui.active = 1 - ui.active;
  ui.result = null;
  refreshLab();
}

async function startBattle(replayConfig: BattleConfig | null = null, kind = replayConfig ? 'replay' : 'campaign', opponentId: string | null = null, draft: string[] | null = null) {
  if (ui.playing || ui.launching) return;
  ui.launching = true;
  try {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const launch = network.account && kind !== 'replay' ? await api('battle/start', { kind, encounterId: ui.encounter, opponentId, draft }) : null;
    const config = launch?.config ?? replayConfig ?? makeBattleConfig(player, ui.encounter, seed);
    if (launch) kind = launch.kind;
    if (kind === 'campaign' && !encounterUnlocked(player, ui.encounter)) return;
    ui.battle = simulateBattle(config);
    if (!network.account && kind !== 'replay') track(player, 'battle_started', { kind });
    ui.frame = 0; ui.playing = true; ui.rewarded = false; ui.replay = kind === 'replay'; ui.battleKind = kind; ui.newDiscoveries = [];
    ui.battleId = launch?.battleId ?? crypto.randomUUID();
    if (kind === 'campaign') ui.region = ENCOUNTER_BY_ID[config.encounterId].regionId ?? 'prologue';
    ui.page = 'battle'; location.hash = 'battle'; render();
  } catch (error) { toast(errorMessage(error)); } finally { ui.launching = false; }
}
async function finishBattle() {
  if (!ui.battle) return;
  ui.playing = false;
  if (!ui.rewarded && !ui.replay) {
    if (network.account) {
      try { const response = await api('battle/finish', { battleId: ui.battleId }); player = response.player; ui.newDiscoveries = response.result?.discoveries ?? []; }
      catch (error) { toast(errorMessage(error) + ' Reopen the expedition to retry the claim.'); render(); return; }
    } else if (ui.battleKind === 'run') completeRunBattle(player, ui.battle);
    else if (['daily', 'weekly', 'festival'].includes(ui.battleKind)) claimChallenge(player, ui.battle);
    else { const reward = claimBattle(player, ui.battle, ui.battleId); ui.newDiscoveries = reward.discoveries; }
    player.lastReplay = structuredClone(ui.battle.config);
    ui.rewarded = true;
    persist();
    if (ui.page !== 'battle') toast('Expedition complete. Your battle report is ready.');
  }
  if (ui.page === 'battle') render();
}
setInterval(() => {
  if (!ui.playing || !ui.battle) return;
  ui.frame = Math.min(ui.battle.frames.length - 1, ui.frame + ui.speed);
  if (ui.frame === ui.battle.frames.length - 1) { finishBattle(); return; }
  if (ui.page !== 'battle') return;
  query('#arena').innerHTML = renderArena();
  query('#battle-clock').textContent = ui.battle.frames[ui.frame].time.toFixed(1) + 's';
  const frame = ui.battle.frames[ui.frame];
  const last = ui.battle.events.slice(0, frame.eventCount).findLast(e => e.type === 'reaction' || e.type === 'phase');
  if (last) query('#reaction-callout').innerHTML = last.type === 'reaction' ? glyph(last.element) + '<span><b>' + last.name + '</b> · chain ' + last.depth + '</span>' : '<strong>' + last.name + '</strong>';
  if (document.querySelector<HTMLDetailsElement>('.combat-journal')?.open) query('#combat-log').innerHTML = renderCombatLog();
}, BALANCE.step * 1000);

document.addEventListener('click', async event => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest<HTMLButtonElement>('[data-action]');
  if (!target || target.disabled) return;
  const { action = '', id = '', index = '', value = '' } = target.dataset;
  if (action.startsWith('editor-')) { editorAction(action.slice(7), player, Boolean(network.account)); return; }
  if (action.startsWith('net-')) { event.preventDefault(); try { await networkAction(action.slice(4), target); } catch (error) { toast(errorMessage(error)); } return; }
  if (action.startsWith('x-')) {
    try { await handleExpansionAction(player, action.slice(2), target, { command, toast, refresh: render, runBattle: () => startBattle(runBattleConfig(player), 'run'), trial: kind => startBattle(challengeConfig(player, kind), kind) }); }
    catch (error) { toast(errorMessage(error)); }
    return;
  }
  try { switch (action) {
    case 'slot': ui.active = Number(index); refreshLab(); break;
    case 'choose': selectElement(id); break;
    case 'filter': ui.filter = value; render(); break;
    case 'practice': await command('practice', { id, count: 10 }); toast('Practiced this known reaction ten times.'); modal.close(); render(); break;
    case 'favorite': await command('favorite', { id }); query('#inventory').innerHTML = renderInventory(); break;
    case 'inspect-unit': if (ui.battle) openModal(renderUnitInspector(ui.battle.frames[ui.frame], id)); break;
    case 'detail': showDetail(id); break;
    case 'combine': {
      const result = await command('experiment', { a: ui.slots[0] ?? "", b: ui.slots[1] ?? "", context: labContext() });
      if (!result.ok) { toast(result.error); break; }
      ui.result = result; persist(); render();
      if (result.isNew && result.rule) showDiscovery(result.rule); else toast(result.rule ? result.rule.name + ' · a familiar discovery.' : 'No stable reaction. Nothing was consumed.');
      break;
    }
    case 'hint': {
      const hint = await command('hint');
      if (hint.ok) { ui.hint = hint.text ?? ""; persist(); const area = query('#hint-area'); area.textContent = hint.text ?? ""; area.hidden = false; }
      else toast(hint.error);
      break;
    }
    case 'prepare-recipe': {
      const rule = REACTION_BY_ID[query<HTMLSelectElement>('#known-recipe').value];
      ui.slots = [...rule.inputs]; ui.context = contextFromConditions(rule.conditions); ui.environment = ui.context.environment ?? 'neutral'; ui.frozen = [...(ui.context.statuses ?? [])].includes('freeze'); ui.result = null; ui.hint = recipeRequirements(rule.id);
      render(); query('.combine-button').focus(); break;
    }
    case 'reflect-report': await command('tutorial', { id: 'reflection' }); render(); break;
    case 'follow-up': ui.battle = null; ui.playing = false; ui.slots = [id, null]; ui.active = 1; ui.result = null; ui.page = 'lab'; location.hash = 'lab'; render(); break;
    case 'repeat': {
      const entry = player.history[Number(index)];
      ui.slots = [...entry.inputs]; ui.environment = entry.environment; ui.frozen = entry.frozen; ui.context = experimentContext(entry.context); ui.result = null; render();
      query('.combine-button').focus(); break;
    }
    case 'continue-chain':
      if (ui.result?.rule) { ui.slots = [ui.result.rule.output, null]; ui.active = 1; }
      modal.close(); ui.result = null; render(); break;
    case 'build-discovery': modal.close(); location.hash = 'team'; break;
    case 'use-element': ui.slots = [id, null]; ui.active = 1; ui.result = null; modal.close(); ui.page = 'lab'; location.hash = 'lab'; render(); break;
    case 'move': await command('move', { index: Number(index), direction: Number(target.dataset.dir) }); render(); break;
    case 'campaign-region': ui.region = value; ui.encounter = ENCOUNTERS.find(e => (value === 'prologue' ? !e.regionId : e.regionId === value) && !player.campaign.includes(e.id) && encounterUnlocked(player, e.id))?.id ?? ENCOUNTERS.find(e => value === 'prologue' ? !e.regionId : e.regionId === value)!.id; render(); break;
    case 'encounter': if (encounterUnlocked(player, id)) { ui.encounter = id; render(); } break;
    case 'research-branch': {
      const branch = document.querySelectorAll<HTMLElement>('.research-branch')[Number(index)];
      branch?.focus({ preventScroll: true }); branch?.scrollIntoView({ behavior: player.settings.reducedMotion ? 'instant' : 'smooth', block: 'start' }); break;
    }
    case 'quick-battle': {
      if (ui.playing || ui.launching) break;
      ui.encounter = ENCOUNTERS.find(e => !player.campaign.includes(e.id) && encounterUnlocked(player, e.id))?.id ?? ENCOUNTERS[0].id;
      await startBattle();
      if (ui.playing && ui.battle) { ui.frame = ui.battle.frames.length - 1; await finishBattle(); }
      break;
    }
    case 'start-battle': startBattle(); break;
    case 'last-replay': startBattle(player.lastReplay); break;
    case 'pause': ui.playing = !ui.playing; target.textContent = ui.playing ? 'Pause' : 'Play'; break;
    case 'speed': ui.speed = ui.speed === 4 ? 1 : ui.speed * 2; target.textContent = ui.speed + '×'; break;
    case 'retry-claim': await finishBattle(); break;
    case 'skip': if (!ui.battle) break; ui.frame = ui.battle.frames.length - 1; finishBattle(); break;
    case 'leave-battle': ui.battle = null; ui.playing = false; ui.encounter = ENCOUNTERS.find(e => !player.campaign.includes(e.id) && encounterUnlocked(player, e.id))?.id ?? ENCOUNTERS[0].id; ui.region = ENCOUNTER_BY_ID[ui.encounter].regionId ?? 'prologue'; if (ui.battleKind !== 'campaign' && ui.battleKind !== 'replay') { ui.page = ui.battleKind === 'run' ? 'runs' : ['daily', 'weekly', 'festival'].includes(ui.battleKind) ? 'journal' : 'community'; location.hash = ui.page; } render(); break;
    case 'replay-current': if (ui.battle) startBattle(ui.battle.config); break;
    case 'codex-tab': ui.codexTab = value; render(); break;
    case 'research': if (await command('research', { id })) { render(); toast('Research complete. Your entire formation benefits.'); } break;
    case 'settings': showSettings(); break;
    case 'close-modal': modal.close(); break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([exportSave(player)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'alchemy-wars-journal.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); break;
    }
  } } catch (error) { toast(errorMessage(error)); }
});
document.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.id === 'element-search') { ui.query = event.target.value; query('#inventory').innerHTML = renderInventory(); }
});
document.addEventListener('change', async event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
  try {
  if (input.id === 'environment') ui.environment = input.value;
  if (input.id === 'lab-health') ui.context.healthRatio = Math.max(0, Math.min(100, Number(input.value))) / 100;
  if (input.id === 'lab-enemies') ui.context.enemyCount = Math.max(0, Math.min(10, Math.floor(Number(input.value))));
  if (input.id === 'lab-shielded') ui.context.shielded = input instanceof HTMLInputElement && input.checked;
  if (input.dataset.labStatus) ui.context.statuses = [...document.querySelectorAll<HTMLInputElement>('[data-lab-status]:checked')].map(e => e.dataset.labStatus!);
  if (input.dataset.labTag) ui.context.tags = [...document.querySelectorAll<HTMLInputElement>('[data-lab-tag]:checked')].map(e => e.dataset.labTag!);
  if (input.id === 'frozen') ui.frozen = input instanceof HTMLInputElement && input.checked;
  if (input.dataset.loadout) {
    const index = Number(input.dataset.index), type = input.dataset.loadout;
    let patch;
    if (type === 'core' || type === 'secondary') {
      const elements = [...player.team[index].elements]; elements[type === 'core' ? 0 : 1] = input.value; patch = { elements };
    } else patch = { [type]: input.value };
    if (await command('loadout', { index, patch })) toast('Formation updated.');
  }
  if (input.dataset.xSelect) {
    const index = Number(input.dataset.index), type = input.dataset.xSelect;
    const priorities = [...(player.team[index].reactionPriority ?? [])];
    if (type === 'reaction-priority') priorities[Number(input.dataset.rank ?? 0)] = input.value;
    if (type === 'ability') { const abilities = [...(player.team[index].abilities ?? [])]; abilities[Number(input.dataset.rank ?? 0)] = input.value; await command('loadout', { index, patch: { abilities: abilities.filter(Boolean) } }); render(); return; }
    const result = type === 'reaction-priority' ? await command('loadout', { index, patch: { reactionPriority: [...new Set(priorities.filter(Boolean))] } }) : await command(type, { index, id: input.value });
    toast(result ? 'Formation updated.' : 'This selection is not available.'); render();
  }
  if (input.dataset.runSlot) {
    const index = Number(input.dataset.index), elements = [...player.run!.team[index].elements];
    elements[Number(input.dataset.runSlot)] = input.value;
    await command('run-team', { index, elements });
  }
  if (input.dataset.runTactic && player.run) {
    const index = Number(input.dataset.index), kind = input.dataset.runTactic;
    const priorities = [...(player.run.team[index].reactionPriority ?? [])];
    if (kind === 'reactionPriority') priorities[Number(input.dataset.rank)] = input.value;
    await command('run-tactics', { index, patch: kind === 'reactionPriority' ? { reactionPriority: [...new Set(priorities.filter(Boolean))] } : { [kind]: input.value } });
    render();
    const tools = document.querySelector<HTMLDetailsElement>('.run-formation article:nth-child(' + (index + 1) + ') .run-tools');
    if (tools) tools.open = true;
    document.querySelector<HTMLSelectElement>('[data-run-tactic="' + kind + '"][data-index="' + index + '"]' + (input.dataset.rank !== undefined ? '[data-rank="' + input.dataset.rank + '"]' : ''))?.focus();
  }
  if (['run-health', 'run-enemies', 'run-shielded'].includes(input.id) || input.dataset.runStatus || input.dataset.runTag) {
    await command('run-scenario', { context: {
      healthRatio: Number(query<HTMLInputElement>('#run-health').value) / 100,
      enemyCount: Number(query<HTMLInputElement>('#run-enemies').value),
      shielded: query<HTMLInputElement>('#run-shielded').checked,
      statuses: [...document.querySelectorAll<HTMLInputElement>('[data-run-status]:checked')].map(s => s.dataset.runStatus!),
      tags: [...document.querySelectorAll<HTMLInputElement>('[data-run-tag]:checked')].map(s => s.dataset.runTag!),
    } });
  }
  if (input.dataset.setting) { await command('settings', { key: input.dataset.setting as keyof Player["settings"], value: input instanceof HTMLInputElement && input.checked }); settingsClasses(); }
  if (input.id === 'import-save' && input instanceof HTMLInputElement && input.files?.[0]) {
    try {
      if (network.account) throw new Error('Sign out to import a local journal. Online progression is validated by the server.');
      if (input.files[0].size > 1_000_000) throw new Error('Save files must be smaller than 1 MB.');
      const imported = parseSave(await input.files[0].text());
      player = imported; ui.playing = false; ui.battle = null; ui.result = null; ui.slots = ['fire', 'water']; ui.encounter = ENCOUNTERS[0].id;
      persist(); modal.close(); render(); toast('Your journal has been restored.');
    } catch (error) { toast(errorMessage(error)); }
  }
  } catch (error) { toast(errorMessage(error)); }
});
document.addEventListener('dragstart', event => {
  if (!(event.target instanceof Element)) return;
  const item = event.target.closest<HTMLElement>('[draggable][data-id]');
  if (item) event.dataTransfer?.setData('text/plain', item.dataset.id ?? '');
});
document.addEventListener('dragover', event => { if (event.target instanceof Element && event.target.closest('[data-drop-slot]')) event.preventDefault(); });
document.addEventListener('drop', event => {
  if (!(event.target instanceof Element)) return;
  const slot = event.target.closest<HTMLElement>('[data-drop-slot]');
  if (!slot) return;
  event.preventDefault(); ui.active = Number(slot.dataset.dropSlot); selectElement(event.dataTransfer?.getData('text/plain') ?? '');
});
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close(); } });
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (!pages[next]) return;
  ui.page = next; modal.close(); render(); window.scrollTo(0, 0); query('#main').focus({ preventScroll: true });
});
if (matchMedia('(prefers-reduced-motion: reduce)').matches) player.settings.reducedMotion = true;
render();
if (loaded.notice) toast(loaded.notice);
if (session?.account && ui.page === 'community') refreshWorld().then(render).catch(error => toast(errorMessage(error)));
command('session').catch(() => {});
setInterval(() => { if (document.visibilityState === 'visible') command('session').catch(() => {}); }, 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => {});

async function networkAction(action: string, target: HTMLElement) {
  const id = target.dataset.id;
  if (action === 'login' || action === 'register') {
    const form = query<HTMLFormElement>('#account-form'); if (!form.reportValidity()) return;
    const response = await api(action, { name: query<HTMLInputElement>('#account-name').value, password: query<HTMLInputElement>('#account-password').value });
    player = response.player; ui.battle = null; ui.playing = false; ui.result = null; ui.slots = ['fire', 'water'];
    await refreshWorld(); render(); toast('Welcome, ' + network.account!.name + '. Your online journal is open.'); return;
  }
  if (action === 'logout') { await api('logout', {}); network.account = null; network.world = null; player = loadPlayer(storage).player; ui.battle = null; ui.playing = false; render(); return; }
  if (action === 'refresh') { await refreshWorld(); render(); return; }
  if (action === 'duel' || action === 'raid' || action === 'war' || action === 'draft-duel') { await startBattle(null, action === 'duel' ? 'pvp' : action === 'war' ? 'guild-war' : action === 'draft-duel' ? 'draft-pvp' : 'guild', id, action === 'draft-duel' ? [...query<HTMLSelectElement>('#arena-draft').selectedOptions].map(o => o.value) : null); return; }
  if (action === 'element-wars' || action === 'weekly-pvp') {
    await startBattle(null, action, query<HTMLSelectElement>('#' + action + '-opponent').value, [...query<HTMLSelectElement>('#' + action + '-draft').selectedOptions].map(o => o.value)); return;
  }
  if (action === 'solve-dialog') {
    const challenge = network.world!.challenges.find(c => c.id === id);
    if (!challenge) return;
    ui.challenge = { ...challenge, available: [...challenge.allowed], steps: [] }; showChallengeDialog(); return;
  }
  if (action === 'challenge-step') {
    const a = query<HTMLInputElement>('#solve-a').value, b = query<HTMLInputElement>('#solve-b').value;
    const rule = resolveExperiment(a, b);
    if (!rule) { toast('No stable reaction. Try another pairing.'); return; }
    if (ui.challenge!.steps.length >= 12) { toast('This challenge permits twelve steps. Reopen it to start again.'); return; }
    ui.challenge!.steps.push([a, b]); if (!ui.challenge!.available.includes(rule.output)) ui.challenge!.available.push(rule.output);
    showChallengeDialog(); return;
  }
  const payload: SocialPayload = { id };
  if (action === 'guild-element-donate' || action === 'guild-element-claim') payload.id = query<HTMLSelectElement>('#' + action).value;
  if (action === 'guild-experiment') { payload.a = query<HTMLSelectElement>('#guild-project-a').value; payload.b = query<HTMLSelectElement>('#guild-project-b').value; }
  if (action === 'guild-create') payload.name = query<HTMLInputElement>('#guild-name').value;
  if (action === 'guild-discovery') payload.id = query<HTMLInputElement>('#guild-discovery').value;
  if (action === 'share-discovery') payload.id = query<HTMLInputElement>('#share-reaction').value;
  if (action === 'challenge-create') {
    payload.name = query<HTMLInputElement>('#challenge-name').value; payload.target = query<HTMLInputElement>('#challenge-target').value;
    payload.allowed = [...query<HTMLSelectElement>('#challenge-allowed').selectedOptions].map(o => o.value);
  }
  if (action === 'challenge-solve') { payload.id = ui.challenge!.id; payload.steps = ui.challenge!.steps; }
  const response = await api('social', { action, payload }); player = response.player;
  if (action === 'reveal-share') { const rule = response.result.reaction; if (!rule) return; openModal('<div class="eyebrow">A SHARED RELATIONSHIP</div><h2>' + rule.name + '</h2><p>' + rule.inputs.map(elementName).join(' + ') + ' → ' + rule.name + '</p><p>' + rule.description + '</p>'); return; }
  if (action === 'challenge-solve') modal.close();
  await refreshWorld(); render(); toast('The Assembly has been updated.');
}
function showChallengeDialog() {
  const c = ui.challenge!, options = c.available.map(id => '<option value="' + id + '">' + elementName(id) + '</option>').join('');
  openModal('<div class="eyebrow">COMMUNITY EXPERIMENT</div><h2>' + escape(c.name) + '</h2><p>Create ' + escape(c.targetName) + ' using only the starting elements and your own intermediate discoveries.</p><div class="form-row"><label>First element<select id="solve-a">' + options + '</select></label><label>Second element<select id="solve-b">' + options + '</select></label></div><div class="button-row">' + button('Combine', 'net-challenge-step', 'button secondary') + button('Submit solution', 'net-challenge-solve', 'button primary') + '</div><ol class="plain-list">' + c.steps.map(pair => '<li>' + pair.map(elementName).join(' + ') + ' → ' + resolveExperiment(...pair)!.name + '</li>').join('') + '</ol>');
}
