import { ELEMENTS, ELEMENT_BY_ID, REACTIONS, REACTION_BY_ID, VESSEL_BY_ID, RESEARCH, RELICS, ENCOUNTERS, ENCOUNTER_BY_ID, STATUSES, BALANCE } from '../data/content.js';
import { reactionEngine } from '../core/reactions.js';
import { createPlayer, experiment, requestHint, updateLoadout, moveVessel, buyResearch, encounterUnlocked, claimBattle, playerLevel, masteryLevel, unlockedRelics } from '../core/progression.js';
import { loadPlayer, savePlayer, parseSave, exportSave } from '../core/save.js';
import { simulateBattle, makeBattleConfig } from '../core/combat.js';
import { icon, sigil, creature, landscape } from './art.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error(); }, setItem() { throw new Error(); } }; }
const loaded = loadPlayer(storage);
let player = loaded.player;
const pages = { home: ['home', 'Observatory'], lab: ['lab', 'Alchemy Lab'], team: ['team', 'Your Formation'], battle: ['swords', 'Expeditions'], codex: ['book', 'Discovery Codex'], research: ['research', 'Research'] };
const ui = {
  page: pages[location.hash.slice(1)] ? location.hash.slice(1) : 'lab', slots: ['fire', 'water'], active: 0,
  query: '', filter: 'all', codexTab: 'elements', result: null, hint: '', environment: 'neutral', frozen: false,
  encounter: ENCOUNTERS[0].id, battle: null, frame: 0, playing: false, speed: 1, rewarded: false, replay: false, battleId: '', newDiscoveries: [],
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const elementName = id => ELEMENT_BY_ID[id]?.name ?? 'Unknown';
const glyph = (id, className = '') => '<span class="element-glyph ' + className + '" style="--element:' + (ELEMENT_BY_ID[id]?.color ?? '#b9c2b5') + '">' + icon(ELEMENT_BY_ID[id]?.icon ?? 'burst') + '</span>';
const button = (text, action, className = 'button', extra = '') => '<button class="' + className + '" data-action="' + action + '" ' + extra + '>' + text + '</button>';
let toastTimer;
function toast(message) {
  const area = document.querySelector('#toast');
  area.textContent = message;
  area.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => area.classList.remove('visible'), 4500);
}
function persist() {
  if (!savePlayer(storage, player)) toast('Progress is in memory only. Export a save from Settings to keep it.');
  updateResources();
}
function updateResources() {
  const area = document.querySelector('#resources');
  if (area) area.innerHTML = '<span title="Knowledge · earned through discoveries and victories">' + icon('research') + '<b>' + player.knowledge + '</b><span>Knowledge</span></span><span title="Gold earned in expeditions">' + icon('coin') + '<b>' + player.gold + '</b><span>Gold</span></span><button class="profile" data-action="settings" aria-label="Settings, Alchemist level ' + playerLevel(player) + '">A<span>' + playerLevel(player) + '</span></button>';
}
function settingsClasses() {
  document.documentElement.classList.toggle('reduced-motion', player.settings.reducedMotion);
  document.documentElement.classList.toggle('large-text', player.settings.largeText);
  document.documentElement.classList.toggle('left-handed', player.settings.leftHanded);
}
function sound() {
  if (!player.settings.sound) return;
  try {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    const context = new Audio();
    [440, 554, 660].forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.045, context.currentTime + i * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.09 + 0.7);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(context.currentTime + i * 0.09); oscillator.stop(context.currentTime + 1);
    });
    setTimeout(() => context.close(), 1300);
  } catch { /* Sound is optional; discovery is always visible. */ }
}

function render() {
  settingsClasses();
  app.innerHTML = '<aside class="sidebar"><a class="brand" href="#home"><span class="brand-mark">' + icon('burst') + '</span><span>ALCHEMY<span>W A R S</span></span></a><div class="sidebar-caption">THE OBSERVATORY</div><nav aria-label="Main navigation">' + Object.entries(pages).map(([id, [symbol, name]]) => '<a href="#' + id + '" class="nav-link ' + (ui.page === id ? 'active' : '') + '" ' + (ui.page === id ? 'aria-current="page"' : '') + '>' + icon(symbol) + '<span>' + name + '</span>' + (id === 'lab' ? '<i>✦</i>' : '') + '</a>').join('') + '</nav><div class="sidebar-bottom"><div class="journal-mark">' + sigil() + '</div><p>Everything is connected.<br><em>You just have to look closer.</em></p><span class="prototype-tag">THE FIRST CHAPTER · v0.1</span>' + button(icon('settings') + ' Settings & save', 'settings', 'settings-button') + '</div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">The Observatory <span>/</span> <strong>' + pages[ui.page][1] + '</strong></div><div id="resources" class="resources"></div></header><main id="main" tabindex="-1">' + renderPage() + '</main><footer class="page-footer"><span>✦ &nbsp; Knowledge is the rarest element.</span><span>Progress saved on this device</span></footer></div><nav class="mobile-nav" aria-label="Mobile navigation">' + ['home', 'lab', 'team', 'battle', 'codex'].map(id => '<a href="#' + id + '" ' + (ui.page === id ? 'aria-current="page"' : '') + '>' + icon(pages[id][0]) + '<span>' + ({ home: 'Home', lab: 'Alchemy', team: 'Team', battle: 'Battle', codex: 'Codex' }[id]) + '</span></a>').join('') + '</nav>';
  updateResources();
}
function heading(kicker, title, text, action = '') {
  return '<div class="page-heading"><div><div class="eyebrow">' + kicker + '</div><h1>' + title + '</h1><p>' + text + '</p></div>' + action + '</div>';
}
function renderPage() {
  return ({ home: renderHome, lab: renderLab, team: renderTeam, battle: renderBattle, codex: renderCodex, research: renderResearch }[ui.page])();
}

function renderHome() {
  const latest = player.discoveries.at(-1);
  const next = ENCOUNTERS.find(e => !player.campaign.includes(e.id)) ?? ENCOUNTERS[2];
  return heading('WELCOME BACK, ALCHEMIST', 'The world is full of <em>what ifs.</em>', 'Your next discovery could change everything.')
    + '<section class="home-hero panel">' + landscape() + '<div class="home-hero-copy"><span class="eyebrow">A WORLD WAITING TO BE UNDERSTOOD</span><h2>Ten fragments.<br>Endless possibilities.</h2><p>The world was shattered. Its secrets weren’t.<br>Find the relationships that hold it together.</p><a class="button primary" href="#lab">Enter the laboratory ' + icon('arrow') + '</a></div></section>'
    + '<div class="stat-grid"><div class="panel stat"><span>Relationships discovered</span><strong>' + player.discoveries.length + '<small> / ' + REACTIONS.length + '</small></strong><div class="meter"><i style="width:' + player.discoveries.length / REACTIONS.length * 100 + '%"></i></div></div><div class="panel stat"><span>Expeditions won</span><strong>' + player.wins + '</strong><small>' + player.campaign.length + ' of 3 locations explored</small></div><div class="panel stat"><span>Alchemist level</span><strong>' + playerLevel(player) + '</strong><small>' + (100 - player.xp % 100) + ' XP to the next level</small></div></div>'
    + '<div class="two-column"><section class="panel content-panel"><div class="eyebrow">YOUR NEXT EXPEDITION</div><h2>' + next.name + '</h2><p>' + next.description + '</p><p class="note">' + next.tip + '</p><a href="#battle" class="text-link">Prepare your formation ' + icon('arrow') + '</a></section><section class="panel content-panel"><div class="eyebrow">' + (latest ? 'LATEST DISCOVERY' : 'YOUR FIRST QUESTION') + '</div><h2>' + (latest ? elementName(latest) : 'What happens when fire meets water?') + '</h2><p>' + (latest ? ELEMENT_BY_ID[latest].description : 'Place two elements in the alchemy circle. Every relationship begins with a little curiosity.') + '</p><a href="#' + (latest ? 'codex' : 'lab') + '" class="text-link">' + (latest ? 'Open your codex' : 'Try your first experiment') + ' ' + icon('arrow') + '</a></section></div>';
}

function renderLab() {
  return heading('EXPERIMENT. DISCOVER. UNDERSTAND.', 'The Alchemy Lab', 'Great discoveries begin with a simple question: what happens if…', '<a class="quiet-link" href="#codex">' + icon('book') + ' Open codex ' + icon('arrow') + '</a>')
    + '<div class="lab-layout"><section class="panel experiment-panel"><div class="panel-top"><span>EXPERIMENT <b>№ ' + String(player.experiments + 1).padStart(3, '0') + '</b></span><span class="live-label"><i></i> Ready for a little wonder</span></div><div id="lab-stage">' + renderLabStage() + '</div><div class="lab-context"><label>Atmosphere <select id="environment" aria-label="Experiment atmosphere"><option value="neutral" ' + (ui.environment === 'neutral' ? 'selected' : '') + '>Still air</option><option value="rain" ' + (ui.environment === 'rain' ? 'selected' : '') + '>Rain</option></select></label><label class="check-label"><input id="frozen" type="checkbox" ' + (ui.frozen ? 'checked' : '') + '> Frozen target</label><span>Experiments are always free</span></div></section><aside class="panel field-notes"><div class="eyebrow">' + icon('book') + ' FIELD NOTES</div><h2>Follow your<br><em>curiosity.</em></h2><p>Elements are only the beginning. Discover the relationships between them.</p><ol class="objective-list"><li class="' + (player.discoveries.length ? 'done' : '') + '"><span>' + (player.discoveries.length ? '✓' : '1') + '</span>Discover your first reaction</li><li class="' + (player.team.some(s => s.elements.some(id => !ELEMENT_BY_ID[id].base)) ? 'done' : '') + '"><span>2</span>Bind it to a vessel</li><li class="' + (player.wins ? 'done' : '') + '"><span>3</span>See your theory in battle</li></ol><div class="notes-bottom"><div><span>YOUR DISCOVERY JOURNAL</span><b>' + player.discoveries.length + '<small> / ' + REACTIONS.length + '</small></b></div><div class="meter"><i style="width:' + player.discoveries.length / REACTIONS.length * 100 + '%"></i></div></div></aside></div>'
    + '<section class="collection-section"><div class="section-heading"><div><h2>Your elements <span class="count">' + player.owned.length + '</span></h2><p>Choose an element to place in the highlighted circle.</p></div><label class="search">' + icon('search') + '<input id="element-search" type="search" placeholder="Find an element…" aria-label="Search elements" value="' + escape(ui.query) + '"></label></div><div class="collection-toolbar"><div class="tabs" aria-label="Element filters">' + ['all', 'base', 'derived', 'favorites'].map(filter => button(({ all: 'All elements', base: 'Primordial', derived: 'Discovered', favorites: 'Favorites' }[filter]), 'filter', 'tab ' + (ui.filter === filter ? 'selected' : ''), 'data-value="' + filter + '" aria-pressed="' + (ui.filter === filter) + '"')).join('') + '</div>' + button(icon('research') + ' A little inspiration <span>2 ✦</span>', 'hint', 'hint-button') + '</div><div id="hint-area" class="hint-area" ' + (!ui.hint ? 'hidden' : '') + '>' + escape(ui.hint) + '</div><div id="inventory" class="element-grid">' + renderInventory() + '</div></section>'
    + '<section class="recent-section"><div class="section-heading"><h2>On your workbench</h2><span class="subtle">Your recent experiments</span></div><div class="history-grid">' + (player.history.length ? player.history.slice(0, 4).map((entry, i) => '<button class="history-card" data-action="repeat" data-index="' + i + '"><div class="history-symbols">' + glyph(entry.inputs[0]) + '<span>+</span>' + glyph(entry.inputs[1]) + '<span>→</span>' + (entry.result ? glyph(entry.result) : '<span class="unknown-glyph">?</span>') + '</div><strong>' + (entry.result ? elementName(entry.result) : 'An unanswered question') + '</strong><small>' + entry.inputs.map(elementName).join(' + ') + '</small></button>').join('') : '<div class="empty-workbench">' + icon('lab') + '<div><strong>A fresh page in your journal.</strong><p>Your experiments will appear here. Start with fire and water.</p></div></div>') + '</div></section>';
}
function renderLabStage() {
  return '<div class="alchemy-stage">' + sigil() + '<div class="stage-specks" aria-hidden="true">✦<span>·</span><i>✧</i></div><div class="ingredients">' + ui.slots.map((id, i) => '<div class="ingredient"><button class="ingredient-circle ' + (ui.active === i ? 'focused' : '') + '" data-action="slot" data-index="' + i + '" data-drop-slot="' + i + '" style="--element:' + (ELEMENT_BY_ID[id]?.color ?? '#8b9a88') + '" aria-label="Ingredient ' + (i + 1) + ': ' + (id ? elementName(id) : 'empty') + '. Select to replace.">' + (id ? glyph(id, 'orb-glyph') : '<span class="plus">+</span>') + '</button><span class="ingredient-caption">' + (i === 0 ? 'THE FIRST ELEMENT' : 'A NEW POSSIBILITY') + '</span><strong>' + (id ? elementName(id) : 'Choose an element') + '</strong></div>').join('<span class="combine-plus" aria-hidden="true">+</span>') + '</div>' + button(icon('lab') + ' Combine elements ' + icon('arrow'), 'combine', 'button primary combine-button', ui.slots.some(id => !id) ? 'disabled' : '') + '<span class="stage-note">Two elements. One new possibility.</span></div><div class="result-strip ' + (ui.result?.rule ? 'has-result' : '') + '">' + (ui.result ? ui.result.rule ? glyph(ui.result.rule.output) + '<div><span>' + (ui.result.isNew ? 'NEW DISCOVERY' : 'A FAMILIAR RELATIONSHIP') + '</span><strong>' + ui.result.rule.name + '</strong><p>' + ui.result.rule.description + '</p></div>' + button(icon('arrow'), 'continue-chain', 'icon-button', 'aria-label="Use ' + ui.result.rule.name + ' in your next experiment"') : icon('research') + '<div><strong>No stable reaction. Yet.</strong><p>Nothing was consumed. Try another element or a different atmosphere.</p></div>' : '<span class="tiny-sigil">✧</span><div><strong>There’s something waiting to be discovered.</strong><p>Bring two elements together and see what unfolds.</p></div>') + '</div>';
}
function renderInventory() {
  const elements = player.owned.map(id => ELEMENT_BY_ID[id]).filter(e => (!ui.query || (e.name + ' ' + e.tags.join(' ')).toLowerCase().includes(ui.query.toLowerCase())) && (ui.filter === 'all' || ui.filter === 'base' && e.base || ui.filter === 'derived' && !e.base || ui.filter === 'favorites' && player.favorites.includes(e.id)));
  return elements.length ? elements.map(e => '<article class="element-card ' + (ui.slots.includes(e.id) ? 'in-use' : '') + '" style="--element:' + e.color + '"><button class="element-select" data-action="choose" data-id="' + e.id + '" draggable="true" aria-label="Select ' + e.name + '">' + glyph(e.id) + '<strong>' + e.name + '</strong><span>' + (e.base ? e.role : e.rarity + ' · Tier ' + e.tier) + '</span>' + (ui.slots.includes(e.id) ? '<i class="selection-mark">' + (ui.slots.indexOf(e.id) === 0 ? 'I' : 'II') + '</i>' : '') + '</button><div class="element-card-bottom"><button data-action="detail" data-id="' + e.id + '" aria-label="Read about ' + e.name + '">Mastery ' + masteryLevel(player, e.id) + '</button><button class="favorite ' + (player.favorites.includes(e.id) ? 'is-favorite' : '') + '" data-action="favorite" data-id="' + e.id + '" aria-label="Favorite ' + e.name + '" aria-pressed="' + player.favorites.includes(e.id) + '">' + icon('star') + '</button></div></article>').join('') : '<div class="empty-state">' + icon('search') + '<h3>No elements here yet.</h3><p>' + (ui.filter === 'derived' ? 'Your discoveries will join your collection here.' : 'Try another search or filter.') + '</p></div>';
}

function renderTeam() {
  return heading('GIVE YOUR DISCOVERIES A PURPOSE', 'Your Formation', 'Five vessels. Countless ways to bring your alchemy to life.', '<a class="button primary" href="#battle">Choose an expedition ' + icon('arrow') + '</a>')
    + '<div class="formation-note">' + icon('shield') + '<p><strong>Order matters.</strong> Enemies target the front vessel first. Pair elements for reactions, or alternate them to prepare your allies’ attacks.</p></div><div class="team-grid">' + player.team.map((slot, i) => {
      const vessel = VESSEL_BY_ID[slot.vessel];
      const options = selected => player.owned.map(id => '<option value="' + id + '" ' + (id === selected ? 'selected' : '') + '>' + elementName(id) + '</option>').join('');
      return '<article class="panel vessel-card"><div class="vessel-top"><span class="eyebrow">' + (i === 0 ? 'FRONTLINE' : 'POSITION 0' + (i + 1)) + '</span><div>' + button('↑', 'move', 'icon-button', 'data-index="' + i + '" data-dir="-1" aria-label="Move ' + vessel.name + ' forward" ' + (i === 0 ? 'disabled' : '')) + button('↓', 'move', 'icon-button', 'data-index="' + i + '" data-dir="1" aria-label="Move ' + vessel.name + ' back" ' + (i === 4 ? 'disabled' : '')) + '</div></div><div class="vessel-art" style="--element:' + ELEMENT_BY_ID[slot.elements[0]].color + '">' + creature(vessel.shape, ELEMENT_BY_ID[slot.elements[0]].color) + '</div><h2>' + vessel.name + '</h2><span class="role-tag">' + vessel.role + '</span><div class="vessel-stats"><span><b>' + vessel.hp * BALANCE.healthMultiplier + '</b> Health</span><span><b>' + vessel.attack + '</b> Power</span><span><b>' + vessel.armor + '</b> Armor</span></div><label>Core element<select data-loadout="core" data-index="' + i + '">' + options(slot.elements[0]) + '</select></label><label>Secondary element<select data-loadout="secondary" data-index="' + i + '">' + options(slot.elements[1]) + '</select></label><label>Relic<select data-loadout="relic" data-index="' + i + '">' + unlockedRelics(player).map(r => '<option value="' + r.id + '" ' + (r.id === slot.relic ? 'selected' : '') + '>' + r.name + '</option>').join('') + '</select></label><details><summary>Battle strategy</summary><label>Target<select data-loadout="targeting" data-index="' + i + '">' + [['front', 'Front enemy'], ['weakest', 'Lowest health'], ['reaction', 'Best reaction']].map(([id, name]) => '<option value="' + id + '" ' + (slot.targeting === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label><label>Casting priority<select data-loadout="priority" data-index="' + i + '">' + [['reaction', 'Seek reactions'], ['alternate', 'Alternate elements'], ['core', 'Core element only']].map(([id, name]) => '<option value="' + id + '" ' + (slot.priority === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label></details></article>';
    }).join('') + '</div><div class="panel content-panel team-tip"><h3>Discoveries belong on the battlefield.</h3><p>Every derived element can be equipped in either slot. Reach element mastery 3 to splash 20% of its strike onto a second enemy. Relics unlock at 2, 4, and 6 discoveries.</p></div>';
}

function renderBattle() {
  if (ui.battle) return renderBattlePlayback();
  return heading('PUT YOUR THEORIES TO THE TEST', 'Beyond the Observatory', 'The world has changed. Take your discoveries out into it.', '<a class="quiet-link" href="#team">' + icon('team') + ' Edit formation ' + icon('arrow') + '</a>')
    + '<section class="expedition-banner panel">' + landscape() + '<div><span class="eyebrow">CHAPTER I · FRAGMENTS OF A BROKEN WORLD</span><h2>The first step is<br><em>always a question.</em></h2><p>Three places. Three ways to rethink your elements.</p></div></section><div class="encounter-grid">' + ENCOUNTERS.map(e => {
      const unlocked = encounterUnlocked(player, e.id);
      return '<article class="panel encounter ' + (ui.encounter === e.id ? 'chosen' : '') + ' ' + (!unlocked ? 'locked' : '') + '"><div class="encounter-number">' + e.label + '<span>' + (player.campaign.includes(e.id) ? '✓ EXPLORED' : e.boss ? 'BOSS ENCOUNTER' : e.environment.toUpperCase()) + '</span></div><h2>' + e.name + '</h2><p>' + e.description + '</p><div class="encounter-tip">' + icon(e.boss ? 'shield' : 'research') + '<span>' + e.tip + '</span></div><div class="reward-preview"><span>' + icon('coin') + e.gold + '</span><span>' + icon('research') + e.knowledge + '</span><span>' + e.xp + ' XP</span></div>' + button(unlocked ? (ui.encounter === e.id ? 'Selected ' + icon('check') : 'Explore this location ' + icon('arrow')) : icon('lock') + ' Complete the previous expedition', 'encounter', 'button ' + (ui.encounter === e.id ? 'primary' : 'secondary'), 'data-id="' + e.id + '" ' + (!unlocked ? 'disabled' : '')) + '</article>';
    }).join('') + '<section class="panel battle-launch"><div><span class="eyebrow">YOUR EXPEDITION PARTY</span><div class="mini-party">' + player.team.map(s => '<span title="' + VESSEL_BY_ID[s.vessel].name + '">' + creature(VESSEL_BY_ID[s.vessel].shape, ELEMENT_BY_ID[s.elements[0]].color) + '</span>').join('') + '</div></div><div><p>Watch the relationships unfold.</p>' + button('Begin expedition ' + icon('arrow'), 'start-battle', 'button primary') + '</div></section>' + (player.lastReplay ? '<div class="replay-link">' + button('Watch your last battle replay', 'last-replay', 'quiet-link') + '</div>' : '');
}

function renderBattlePlayback() {
  const battle = ui.battle;
  const encounter = ENCOUNTER_BY_ID[battle.config.encounterId];
  const done = ui.frame >= battle.frames.length - 1;
  return heading(ui.replay ? 'REPLAY · SAME SEED, SAME STORY' : 'EXPEDITION IN PROGRESS', encounter.name, encounter.tip)
    + '<section class="panel battle-panel"><div class="battle-toolbar"><span class="live-label"><i></i> ' + encounter.environment.toUpperCase() + '</span><strong id="battle-clock">' + battle.frames[ui.frame].time.toFixed(1) + 's</strong><div>' + button(ui.playing ? 'Pause' : 'Play', 'pause', 'small-button', done ? 'disabled' : '') + button(ui.speed + '×', 'speed', 'small-button', 'aria-label="Playback speed"') + button('Skip to report', 'skip', 'small-button', done ? 'disabled' : '') + '</div></div><div id="arena" class="arena">' + renderArena() + '</div><div id="reaction-callout" class="reaction-callout" aria-live="polite">' + (done ? 'The elements settle.' : 'Your vessels are preparing their first move…') + '</div></section><div id="battle-report">' + (done ? renderReport() : '') + '</div><details class="panel combat-journal" ' + (player.settings.debug ? 'open' : '') + '><summary>Battle journal <span>Seed ' + battle.config.seed + ' · ' + battle.config.contentVersion + '</span></summary><div id="combat-log">' + renderCombatLog() + '</div></details>';
}

function renderArena() {
  const frame = ui.battle.frames[ui.frame];
  const recent = ui.battle.events.slice(Math.max(0, frame.eventCount - 10), frame.eventCount);
  return landscape() + '<div class="arena-side allies"><span class="side-label">YOUR FORMATION</span>' + renderSide('ally') + '</div><div class="arena-divider">✧</div><div class="arena-side enemies"><span class="side-label">THE OPPOSITION</span>' + renderSide('enemy') + '</div>';
  function renderSide(side) {
    return '<div class="combat-units">' + frame.units.filter(u => u.side === side).map(u => {
      const hit = recent.findLast(e => e.target === u.id && e.type === 'damage' && frame.time - e.time < 0.5);
      return '<div class="combat-unit ' + (u.hp === 0 ? 'fallen' : '') + ' ' + (hit ? 'hit' : '') + '"><div class="unit-sprite">' + creature(u.shape, ELEMENT_BY_ID[u.elements[0]].color) + (hit ? '<span class="damage-number">−' + hit.amount + '</span>' : '') + '</div><strong>' + u.name + '</strong><div class="healthbar" role="meter" aria-label="' + u.name + ' health" aria-valuemin="0" aria-valuemax="' + u.maxHp + '" aria-valuenow="' + u.hp + '"><i style="width:' + u.hp / u.maxHp * 100 + '%"></i></div><span class="health-text">' + u.hp + ' / ' + u.maxHp + (u.shield ? ' · ◇ ' + u.shield : '') + '</span><div class="status-row">' + (u.hp === 0 ? '<span>FALLEN</span>' : u.statuses.slice(0, 5).map(s => '<span title="' + STATUSES[s.id].name + ' · ' + s.remaining.toFixed(1) + 's">' + STATUSES[s.id].short + (s.stacks > 1 ? ' ' + s.stacks : '') + '</span>').join('')) + '</div></div>';
    }).join('') + '</div>';
  }
}
function renderCombatLog() {
  const frame = ui.battle.frames[ui.frame];
  return ui.battle.events.slice(0, frame.eventCount).filter(e => ['reaction', 'phase', 'death', 'cast'].includes(e.type)).slice(-25).reverse().map(e => '<div><time>' + e.time.toFixed(2) + '</time><span>' + (e.type === 'reaction' ? '<b>' + e.name + '</b> · chain ' + e.depth + ' · ' + e.source + ' → ' + e.target : e.type === 'cast' ? elementName(e.element) + ' · ' + e.source + ' → ' + e.target + ' · ' + e.priority : escape(e.name) + (e.type === 'death' ? ' fell' : '')) + '</span></div>').join('') || '<p>The journal will record every reaction.</p>';
}
function renderReport() {
  const battle = ui.battle;
  const victory = battle.outcome === 'victory';
  const encounter = ENCOUNTER_BY_ID[battle.config.encounterId];
  const reactions = Object.entries(battle.report.reactions).sort((a, b) => b[1] - a[1]);
  const damage = Object.entries(battle.report.damageByElement).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return '<section class="panel report"><div class="report-heading"><span class="report-emblem">' + icon(victory ? 'star' : 'shield') + '</span><div><div class="eyebrow">' + (ui.replay ? 'REPLAY COMPLETE · NO REWARDS' : 'EXPEDITION COMPLETE') + '</div><h2>' + (victory ? 'A theory, proven.' : battle.outcome === 'draw' ? 'A question left open.' : 'Every experiment teaches us.') + '</h2><p>' + (victory ? 'Victory in ' : battle.outcome === 'draw' ? 'Time limit reached after ' : 'Defeated after ') + battle.duration.toFixed(1) + ' seconds · ' + battle.report.highestChain + '-step longest reaction chain</p></div></div>'
    + (victory && !ui.replay ? '<div class="earned-rewards"><span>+' + encounter.gold + ' gold</span><span>+' + encounter.knowledge + ' knowledge</span><span>+' + encounter.xp + ' XP</span></div>' : '')
    + '<div class="two-column"><div><h3>Your elemental contribution</h3>' + damage.map(([id, amount]) => '<div class="damage-stat"><span>' + elementName(id) + '</span><div class="meter"><i style="width:' + amount / battle.report.totalDamage * 100 + '%;background:' + ELEMENT_BY_ID[id].color + '"></i></div><b>' + Math.round(amount / battle.report.totalDamage * 100) + '%</b></div>').join('') + '</div><div><h3>Relationships in action</h3><div class="reaction-tags">' + (reactions.length ? reactions.map(([id, count]) => '<button data-action="detail" data-id="' + id + '">' + REACTION_BY_ID[id].name + '<b>×' + count + '</b></button>').join('') : '<p>No reactions occurred. Try complementary elements across your team.</p>') + '</div></div></div><p class="learning-note">' + icon('research') + (reactions.length ? 'Your most frequent reaction was ' + REACTION_BY_ID[reactions[0][0]].name + '. Try using its derived element as a core, then experiment with a new secondary.' : 'Water prepares enemies for lightning. Try a Tide Sylph with Water and Lightning.') + '</p>'
    + (ui.newDiscoveries.length && !ui.replay ? '<p class="discovery-report">✦ Added to your codex: ' + ui.newDiscoveries.map(elementName).join(', ') + '.</p>' : '')
    + '<div class="report-actions">' + button('Continue exploring ' + icon('arrow'), 'leave-battle', 'button primary') + '<a href="#lab" class="button secondary">Back to the laboratory</a>' + button('Replay battle', 'replay-current', 'quiet-link') + '</div></section>';
}

function renderCodex() {
  return heading('A JOURNAL OF RELATIONSHIPS', 'The Discovery Codex', 'Every page is something you learned about the world.', '<span class="codex-total">' + player.discoveries.length + ' <small>/ ' + REACTIONS.length + ' reactions</small></span>')
    + '<div class="tabs codex-tabs">' + [['elements', 'Elements'], ['reactions', 'Reactions'], ['graph', 'Discovery map'], ['statuses', 'Status effects']].map(([id, label]) => button(label, 'codex-tab', 'tab ' + (ui.codexTab === id ? 'selected' : ''), 'data-value="' + id + '" aria-pressed="' + (ui.codexTab === id) + '"')).join('') + '</div>'
    + (ui.codexTab === 'elements' ? '<div class="codex-grid">' + player.owned.map(id => {
      const e = ELEMENT_BY_ID[id];
      return '<button class="panel codex-card" data-action="detail" data-id="' + id + '">' + glyph(id) + '<span class="eyebrow">' + e.rarity + ' · TIER ' + e.tier + '</span><h2>' + e.name + '</h2><p>' + e.description + '</p><span class="codex-mastery">Mastery ' + masteryLevel(player, id) + ' <span>' + (player.mastery[id] ?? 0) + ' XP</span></span></button>';
    }).join('') + '</div>' : ui.codexTab === 'statuses' ? '<div class="codex-grid">' + Object.values(STATUSES).map(s => '<article class="panel content-panel"><span class="status-badge">' + s.short + '</span><h2>' + s.name + '</h2><p>' + ({ burn: 'Periodic fire damage. Stacks up to 3 times.', poison: 'Periodic venom damage. Stacks up to 4 times.', wet: 'Prepares water reactions, including steam and conductivity.', freeze: 'Stops a vessel from casting until it thaws.', shock: 'Disrupts the target, slowing its cast timer.', root: 'Entangles the target and slows casting.', slow: 'Reduces how quickly the next cast becomes ready.', haste: 'Accelerates the next cast.', blind: 'Reduces the power of direct strikes.', 'armor-break': 'Reduces armor before damage is calculated.', vulnerable: 'Increases damage received from every source.', conductive: 'Amplifies damage with the electricity tag.', regeneration: 'Restores health every second.' }[s.id]) + '</p></article>').join('') + '</div>' : renderReactionCollection());
}
function renderReactionCollection() {
  const graph = reactionEngine.graph(player.discoveries, player.owned);
  return '<p class="codex-intro">' + (ui.codexTab === 'graph' ? 'Follow the threads of your discoveries. Unwritten branches are invitations to experiment.' : 'Known relationships are yours to keep. Hints in the laboratory can help fill the missing pages.') + '</p><div class="' + (ui.codexTab === 'graph' ? 'graph-list' : 'recipe-grid') + '">' + graph.map(node => '<article class="panel recipe-card ' + (node.known ? 'known' : 'unknown') + '"><div class="recipe-inputs">' + node.inputs.map(id => '<span>' + (id ? glyph(id) + '<small>' + elementName(id) + '</small>' : '<i class="unknown-glyph">?</i><small>Unknown</small>') + '</span>').join('<b>+</b>') + '<b class="recipe-arrow">→</b></div>' + (node.known ? '<button class="recipe-output" data-action="detail" data-id="' + node.output + '">' + glyph(node.output) + '<span><strong>' + node.name + '</strong><small>' + node.category + ' · ' + (player.reactionUsage[node.id] ?? 0) + ' battle uses</small></span></button>' : '<div class="recipe-output"><span class="unknown-glyph">?</span><span><strong>An undiscovered relationship</strong><small>Let curiosity be your guide</small></span></div>') + '</article>').join('') + '</div>';
}

function renderResearch() {
  return heading('UNDERSTANDING CHANGES EVERYTHING', 'A deeper kind of alchemy', 'Spend knowledge to change what your entire formation can do.', '<span class="knowledge-balance">' + icon('research') + player.knowledge + ' knowledge</span>')
    + '<div class="research-grid">' + RESEARCH.map(r => '<article class="panel research-card"><span class="research-icon">' + icon(r.icon) + '</span><span class="eyebrow">ANCIENT KNOWLEDGE</span><h2>' + r.name + '</h2><p>' + r.description + '</p>' + button(player.research.includes(r.id) ? icon('check') + ' Understood' : 'Research · ' + r.cost + ' knowledge', 'research', 'button ' + (player.research.includes(r.id) ? 'secondary' : 'primary'), 'data-id="' + r.id + '" ' + (player.research.includes(r.id) || player.knowledge < r.cost ? 'disabled' : '')) + '</article>').join('') + '</div><div class="section-heading relic-heading"><div><h2>Relics of the old world</h2><p>Discover relationships to unlock relics, then equip them in your formation.</p></div></div><div class="research-grid">' + RELICS.filter(r => r.id !== 'none').map(r => '<article class="panel content-panel"><span class="eyebrow">' + (player.discoveries.length >= r.discoveries ? 'UNLOCKED' : 'UNLOCKS AT ' + r.discoveries + ' DISCOVERIES') + '</span><h2>' + r.name + '</h2><p>' + r.description + '</p><a class="text-link" href="#team">Visit your formation ' + icon('arrow') + '</a></article>').join('') + '</div>';
}

function openModal(content, className = '') {
  modal.className = className;
  modal.innerHTML = button(icon('close'), 'close-modal', 'modal-close icon-button', 'aria-label="Close dialog"') + content;
  if (!modal.open) modal.showModal();
}
function showDetail(id) {
  const e = ELEMENT_BY_ID[id];
  if (!e || !player.owned.includes(id)) return;
  const known = REACTIONS.filter(r => player.discoveries.includes(r.id) && r.inputs.includes(id));
  openModal('<div class="detail-header">' + glyph(id, 'large-glyph') + '<span class="eyebrow">' + e.rarity + ' · TIER ' + e.tier + '</span><h2>' + e.name + '</h2><p>' + e.lore + '</p></div><div class="detail-mastery"><strong>Mastery ' + masteryLevel(player, id) + '</strong><span>' + (player.mastery[id] ?? 0) + ' XP</span><div class="meter"><i style="width:' + (player.mastery[id] ?? 0) % BALANCE.masteryThreshold / BALANCE.masteryThreshold * 100 + '%"></i></div><p>At mastery 3, direct strikes splash onto a second enemy.</p></div><div class="tag-list">' + e.tags.map(t => '<span>' + t + '</span>').join('') + '</div><h3>Known relationships</h3>' + (known.length ? known.map(r => '<p class="detail-recipe">' + r.inputs.map(elementName).join(' + ') + ' → <strong>' + r.name + '</strong></p>').join('') : '<p class="subtle">There are still connections waiting to be found.</p>') + '<div class="modal-actions">' + button('Use in the laboratory', 'use-element', 'button primary', 'data-id="' + id + '"') + '</div>');
}
function showDiscovery(rule) {
  openModal('<div class="discovery-reveal" style="--element:' + rule.color + '"><div class="reveal-orbit">' + sigil() + glyph(rule.output, 'large-glyph') + '</div><div class="eyebrow">✦ NEW DISCOVERY ✦</div><h2>' + rule.name + '</h2><div class="discovery-recipe">' + rule.inputs.map(elementName).join(' + ') + '</div><p>' + rule.description + '</p><div class="discovery-rewards"><span>+' + BALANCE.discoveryKnowledge + ' knowledge</span><span>+' + BALANCE.discoveryXp + ' XP</span><span>Added to your codex</span></div><div class="modal-actions">' + button('Keep experimenting ' + icon('arrow'), 'continue-chain', 'button primary') + button('Build with this discovery', 'build-discovery', 'quiet-link') + '</div></div>', 'discovery-modal');
  sound();
}
function showSettings() {
  openModal('<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>Settings & your journal</h2><div class="settings-list">' + [['sound', 'Discovery sounds', 'A short chime when you uncover a new reaction.'], ['reducedMotion', 'Reduced motion', 'Keep the interface still and remove battle shake.'], ['largeText', 'Larger text', 'Increase the size of interface text.'], ['leftHanded', 'Left-handed navigation', 'Move mobile alchemy controls toward your left hand.'], ['debug', 'Battle journal open', 'See reaction chains, targeting decisions and the replay seed.']].map(([id, name, detail]) => '<label class="setting-row"><span><strong>' + name + '</strong><small>' + detail + '</small></span><input type="checkbox" data-setting="' + id + '" ' + (player.settings[id] ? 'checked' : '') + '></label>').join('') + '</div><h3>Keep your discoveries</h3><p class="subtle">Your journal saves automatically in this browser. Export a copy to take it with you. Import replaces the current journal and keeps a local backup.</p><div class="save-actions">' + button('Export save', 'export', 'button secondary') + '<label class="button secondary file-button">Import save<input id="import-save" type="file" accept=".json,application/json"></label></div><a href="#research" class="text-link" data-action="close-modal">Open research ' + icon('arrow') + '</a>');
}

function refreshLab() {
  document.querySelector('#lab-stage').innerHTML = renderLabStage();
  document.querySelector('#inventory').innerHTML = renderInventory();
}
function selectElement(id) {
  if (!player.owned.includes(id)) return;
  ui.slots[ui.active] = id;
  ui.active = 1 - ui.active;
  ui.result = null;
  refreshLab();
}

function startBattle(replayConfig = null) {
  if (ui.playing) return;
  try {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const config = replayConfig ?? makeBattleConfig(player, ui.encounter, seed);
    if (!replayConfig && !encounterUnlocked(player, ui.encounter)) return;
    ui.battle = simulateBattle(config);
    ui.frame = 0; ui.playing = true; ui.rewarded = false; ui.replay = Boolean(replayConfig); ui.newDiscoveries = [];
    ui.battleId = crypto.randomUUID();
    ui.page = 'battle'; location.hash = 'battle'; render();
  } catch (error) { toast(error.message); }
}
function finishBattle() {
  ui.playing = false;
  if (!ui.rewarded && !ui.replay) {
    const reward = claimBattle(player, ui.battle, ui.battleId);
    ui.newDiscoveries = reward.discoveries;
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
  document.querySelector('#arena').innerHTML = renderArena();
  document.querySelector('#battle-clock').textContent = ui.battle.frames[ui.frame].time.toFixed(1) + 's';
  const frame = ui.battle.frames[ui.frame];
  const last = ui.battle.events.slice(0, frame.eventCount).findLast(e => e.type === 'reaction' || e.type === 'phase');
  if (last) document.querySelector('#reaction-callout').innerHTML = last.type === 'reaction' ? glyph(last.element) + '<span><b>' + last.name + '</b> · chain ' + last.depth + '</span>' : '<strong>' + last.name + '</strong>';
  if (document.querySelector('.combat-journal')?.open) document.querySelector('#combat-log').innerHTML = renderCombatLog();
}, BALANCE.step * 1000);

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const { action, id, index, value } = target.dataset;
  switch (action) {
    case 'slot': ui.active = Number(index); refreshLab(); break;
    case 'choose': selectElement(id); break;
    case 'filter': ui.filter = value; render(); break;
    case 'favorite': player.favorites = player.favorites.includes(id) ? player.favorites.filter(v => v !== id) : [...player.favorites, id]; persist(); document.querySelector('#inventory').innerHTML = renderInventory(); break;
    case 'detail': showDetail(id); break;
    case 'combine': {
      const result = experiment(player, ...ui.slots, { environment: ui.environment, statuses: ui.frozen ? ['freeze'] : [] });
      if (!result.ok) { toast(result.error); break; }
      ui.result = result; persist(); render();
      if (result.isNew) showDiscovery(result.rule); else toast(result.rule ? result.rule.name + ' · a familiar discovery.' : 'No stable reaction. Nothing was consumed.');
      break;
    }
    case 'hint': {
      const hint = requestHint(player);
      if (hint.ok) { ui.hint = hint.text; persist(); const area = document.querySelector('#hint-area'); area.textContent = hint.text; area.hidden = false; }
      else toast(hint.error);
      break;
    }
    case 'repeat': {
      const entry = player.history[Number(index)];
      ui.slots = [...entry.inputs]; ui.environment = entry.environment; ui.frozen = entry.frozen; ui.result = null; render();
      document.querySelector('.combine-button').focus(); break;
    }
    case 'continue-chain':
      if (ui.result?.rule) { ui.slots = [ui.result.rule.output, null]; ui.active = 1; }
      modal.close(); ui.result = null; render(); break;
    case 'build-discovery': modal.close(); location.hash = 'team'; break;
    case 'use-element': ui.slots = [id, null]; ui.active = 1; ui.result = null; modal.close(); ui.page = 'lab'; location.hash = 'lab'; render(); break;
    case 'move': moveVessel(player, Number(index), Number(target.dataset.dir)); persist(); render(); break;
    case 'encounter': if (encounterUnlocked(player, id)) { ui.encounter = id; render(); } break;
    case 'start-battle': startBattle(); break;
    case 'last-replay': startBattle(player.lastReplay); break;
    case 'pause': ui.playing = !ui.playing; target.textContent = ui.playing ? 'Pause' : 'Play'; break;
    case 'speed': ui.speed = ui.speed === 4 ? 1 : ui.speed * 2; target.textContent = ui.speed + '×'; break;
    case 'skip': ui.frame = ui.battle.frames.length - 1; finishBattle(); break;
    case 'leave-battle': ui.battle = null; ui.playing = false; ui.encounter = ENCOUNTERS.find(e => !player.campaign.includes(e.id))?.id ?? ENCOUNTERS[2].id; render(); break;
    case 'replay-current': startBattle(ui.battle.config); break;
    case 'codex-tab': ui.codexTab = value; render(); break;
    case 'research': if (buyResearch(player, id)) { persist(); render(); toast('Research complete. Your entire formation benefits.'); } break;
    case 'settings': showSettings(); break;
    case 'close-modal': modal.close(); break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([exportSave(player)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'alchemy-wars-journal.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); break;
    }
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'element-search') { ui.query = event.target.value; document.querySelector('#inventory').innerHTML = renderInventory(); }
});
document.addEventListener('change', async event => {
  const input = event.target;
  if (input.id === 'environment') ui.environment = input.value;
  if (input.id === 'frozen') ui.frozen = input.checked;
  if (input.dataset.loadout) {
    const index = Number(input.dataset.index), type = input.dataset.loadout;
    let patch;
    if (type === 'core' || type === 'secondary') {
      const elements = [...player.team[index].elements]; elements[type === 'core' ? 0 : 1] = input.value; patch = { elements };
    } else patch = { [type]: input.value };
    if (updateLoadout(player, index, patch)) { persist(); toast('Formation updated.'); }
  }
  if (input.dataset.setting) { player.settings[input.dataset.setting] = input.checked; persist(); settingsClasses(); }
  if (input.id === 'import-save' && input.files[0]) {
    try {
      if (input.files[0].size > 1_000_000) throw new Error('Save files must be smaller than 1 MB.');
      const imported = parseSave(await input.files[0].text());
      player = imported; ui.playing = false; ui.battle = null; ui.result = null; ui.slots = ['fire', 'water']; ui.encounter = ENCOUNTERS[0].id;
      persist(); modal.close(); render(); toast('Your journal has been restored.');
    } catch (error) { toast(error.message); }
  }
});
document.addEventListener('dragstart', event => {
  const item = event.target.closest('[draggable][data-id]');
  if (item) event.dataTransfer.setData('text/plain', item.dataset.id);
});
document.addEventListener('dragover', event => { if (event.target.closest('[data-drop-slot]')) event.preventDefault(); });
document.addEventListener('drop', event => {
  const slot = event.target.closest('[data-drop-slot]');
  if (!slot) return;
  event.preventDefault(); ui.active = Number(slot.dataset.dropSlot); selectElement(event.dataTransfer.getData('text/plain'));
});
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close(); } });
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (!pages[next]) return;
  ui.page = next; modal.close(); render(); window.scrollTo(0, 0); document.querySelector('#main').focus({ preventScroll: true });
});
if (matchMedia('(prefers-reduced-motion: reduce)').matches) player.settings.reducedMotion = true;
render();
if (loaded.notice) toast(loaded.notice);
