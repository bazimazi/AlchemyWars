import { normalizeReplay } from './replay.js';
import { CONTENT_VERSION, ELEMENT_BY_ID, REACTION_BY_ID, VESSELS, VESSEL_BY_ID, RELIC_BY_ID, RESEARCH, ENCOUNTER_BY_ID } from '../data/content.js';
import { createPlayer, unlockedRelics } from './progression.js';
import { TALENTS, EQUIPMENT, SPECIALIZATIONS, QUESTS, ACHIEVEMENTS, PASSIVES, COSMETICS } from '../data/systems.js';
import { normalizeRun } from './modes.js';

export const SAVE_KEY = 'alchemy-wars.save.v1';
export const BACKUP_KEY = SAVE_KEY + '.backup';
const integer = (value, fallback = 0, max = 1_000_000_000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
const list = (value, predicate, limit = 10000) => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string' && predicate(v)))].slice(0, limit) : [];
const record = (value, predicate) => Object.fromEntries(Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).filter(([key]) => predicate(key)).map(([key, amount]) => [key, integer(amount)]));

export function normalizeSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This is not an Alchemy Wars save.');
  if (raw.version !== 1) throw new Error('Unsupported save version. Your current progress has not changed.');
  const player = createPlayer();
  player.createdAt = integer(raw.createdAt, player.createdAt, Number.MAX_SAFE_INTEGER);
  player.activeDays = list(raw.activeDays, day => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)), 366);
  player.run = normalizeRun(raw.run);
  for (const key of ['essence', 'shards', 'runsWon', 'endlessBest', 'highestChain']) player[key] = integer(raw[key]);
  for (const [key, definitions] of [['talents', TALENTS], ['equipment', EQUIPMENT], ['quests', QUESTS], ['achievements', ACHIEVEMENTS], ['cosmetics', COSMETICS]]) player[key] = list(raw[key], id => definitions.some(d => d.id === id));
  if (!player.cosmetics.includes('observatory')) player.cosmetics.unshift('observatory');
  player.theme = player.cosmetics.includes(raw.theme) ? raw.theme : 'observatory';
  player.dailyClaims = list(raw.dailyClaims, id => /^[a-z0-9-]+:[0-9-]+$/.test(id), 1000);
  player.analytics = Array.isArray(raw.analytics) ? raw.analytics.filter(e => e && typeof e.name === 'string' && Number.isFinite(e.at)).slice(-1000).map(e => ({ ...e, name: e.name.slice(0, 80) })) : [];
  for (const key of ['xp', 'gold', 'knowledge', 'battles', 'wins', 'experiments']) player[key] = integer(raw[key], player[key]);
  player.discoveries = list(raw.discoveries, id => Boolean(REACTION_BY_ID[id]));
  player.owned = [...player.owned, ...player.discoveries.map(id => REACTION_BY_ID[id].output)];
  player.mastery = record(raw.mastery, id => player.owned.includes(id));
  player.evolution = Object.fromEntries(Object.entries(record(raw.evolution, id => player.owned.includes(id))).map(([id, level]) => [id, Math.min(3, level)]));
  player.specializations = Object.fromEntries(Object.entries(raw.specializations ?? {}).filter(([id, value]) => player.owned.includes(id) && SPECIALIZATIONS.some(s => s.id === value)));
  player.reactionWins = record(raw.reactionWins, id => player.discoveries.includes(id));
  player.discoveryDates = Object.fromEntries(Object.entries(raw.discoveryDates ?? {}).filter(([id]) => player.discoveries.includes(id)).map(([id, at]) => [id, integer(at, 0, Number.MAX_SAFE_INTEGER)]));
  player.reactionUsage = record(raw.reactionUsage, id => player.discoveries.includes(id));
  player.research = list(raw.research, id => RESEARCH.some(r => r.id === id));
  player.owned.push(...RESEARCH.filter(r => player.research.includes(r.id) && r.unlockElement).map(r => r.unlockElement));
  player.favorites = list(raw.favorites, id => player.owned.includes(id));
  player.campaign = list(raw.campaign, id => Boolean(ENCOUNTER_BY_ID[id]));
  player.owned = [...new Set([...player.owned, ...player.campaign.map(id => ENCOUNTER_BY_ID[id].unlockElement).filter(Boolean)])];
  player.evolution = Object.fromEntries(Object.entries(record(raw.evolution, id => player.owned.includes(id))).map(([id, level]) => [id, Math.min(3, level)]));
  player.specializations = Object.fromEntries(Object.entries(raw.specializations ?? {}).filter(([id, value]) => player.owned.includes(id) && SPECIALIZATIONS.some(s => s.id === value)));
  player.favorites = list(raw.favorites, id => player.owned.includes(id));
  player.mastery = record(raw.mastery, id => player.owned.includes(id));
  player.claimedBattles = list(raw.claimedBattles, id => id.length < 100);
  player.hints = record(raw.hints, id => Boolean(REACTION_BY_ID[id]));
  for (const key of Object.keys(player.settings)) if (typeof raw.settings?.[key] === 'boolean') player.settings[key] = raw.settings[key];
  if (Array.isArray(raw.history)) player.history = raw.history.filter(h => h && Array.isArray(h.inputs) && h.inputs.length === 2 && h.inputs.every(id => player.owned.includes(id)) && (h.result === null || REACTION_BY_ID[h.result])).slice(0, 12).map(h => ({ inputs: [...h.inputs], result: h.result, environment: ['rain', 'storm', 'holy', 'night'].includes(h.environment) ? h.environment : 'neutral', frozen: h.frozen === true }));
  const allowedRelics = new Set(unlockedRelics(player).map(r => r.id));
  const used = new Set();
  const team = [];
  if (Array.isArray(raw.team)) for (const slot of raw.team) {
    if (!slot || !VESSEL_BY_ID[slot.vessel] || used.has(slot.vessel) || team.length >= 5) continue;
    used.add(slot.vessel);
    const fallback = VESSEL_BY_ID[slot.vessel];
    team.push({
      vessel: slot.vessel,
      elements: Array.isArray(slot.elements) && slot.elements.length === 2 && slot.elements.every(id => player.owned.includes(id)) ? [...slot.elements] : [...fallback.elements],
      relic: allowedRelics.has(slot.relic) ? slot.relic : 'none',
      targeting: ['front', 'weakest', 'reaction'].includes(slot.targeting) ? slot.targeting : 'front',
      priority: ['reaction', 'alternate', 'core'].includes(slot.priority) ? slot.priority : 'reaction',
      ...(slot.passive && PASSIVES.some(p => p.id === slot.passive && p.unlockDiscoveries <= player.discoveries.length) ? { passive: slot.passive } : {}),
      ...(slot.equipment ? { equipment: Object.fromEntries(Object.entries(slot.equipment).filter(([key, id]) => player.equipment.includes(id) && EQUIPMENT.some(e => e.id === id && e.slot === key))) } : {}),
      ...(Array.isArray(slot.reactionPriority) ? { reactionPriority: list(slot.reactionPriority, id => player.discoveries.includes(id), 10) } : {}),
    });
  }
  for (const slot of createPlayer().team) if (!used.has(slot.vessel) && team.length < 5) team.push(slot);
  player.team = team;
  if (Array.isArray(raw.loadouts)) player.loadouts = raw.loadouts.filter(l => typeof l?.name === 'string' && Array.isArray(l.team) && l.team.length === 5 && new Set(l.team.map(s => s?.vessel)).size === 5 && l.team.every(s => s && VESSEL_BY_ID[s.vessel] && Array.isArray(s.elements) && s.elements.length === 2 && s.elements.every(id => player.owned.includes(id)))).slice(0, 10).map(l => ({ name: l.name.slice(0, 40), team: normalizeSave({ ...raw, team: l.team, loadouts: [], lastReplay: null }).team }));
  player.lastReplay = normalizeReplay(raw.lastReplay);
  return player;
}

export function parseSave(text) {
  if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('Save files must be smaller than 1 MB.');
  try { return normalizeSave(JSON.parse(text)); }
  catch (error) { if (error instanceof SyntaxError) throw new Error('The save file is damaged or is not valid JSON.'); throw error; }
}

export function loadPlayer(storage) {
  try {
    const primary = storage.getItem(SAVE_KEY);
    if (!primary) return { player: createPlayer(), notice: '' };
    try { return { player: parseSave(primary), notice: '' }; }
    catch {
      const backup = storage.getItem(BACKUP_KEY);
      if (backup) return { player: parseSave(backup), notice: 'Recovered your progress from the backup save.' };
      return { player: createPlayer(), notice: 'The saved progress could not be read. A fresh journal is open; the original save is retained until your next action.' };
    }
  } catch { return { player: createPlayer(), notice: 'Local storage is unavailable. Use Export save in Settings to keep your progress.' }; }
}

export function savePlayer(storage, player) {
  try {
    const serialized = JSON.stringify(normalizeSave(player));
    const previous = storage.getItem(SAVE_KEY);
    if (previous) {
      try { parseSave(previous); storage.setItem(BACKUP_KEY, previous); } catch { /* Preserve the last healthy backup. */ }
    }
    storage.setItem(SAVE_KEY, serialized);
    return true;
  } catch { return false; }
}

export const exportSave = player => JSON.stringify(normalizeSave(player), null, 2);
