import { CONTENT_VERSION, ELEMENT_BY_ID, REACTION_BY_ID, VESSELS, VESSEL_BY_ID, RELIC_BY_ID, RESEARCH, ENCOUNTER_BY_ID } from '../data/content.js';
import { createPlayer, unlockedRelics } from './progression.js';

export const SAVE_KEY = 'alchemy-wars.save.v1';
export const BACKUP_KEY = SAVE_KEY + '.backup';
const integer = (value, fallback = 0, max = 1_000_000_000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
const list = (value, predicate, limit = 10000) => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string' && predicate(v)))].slice(0, limit) : [];
const record = (value, predicate) => Object.fromEntries(Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).filter(([key]) => predicate(key)).map(([key, amount]) => [key, integer(amount)]));

export function normalizeSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This is not an Alchemy Wars save.');
  if (raw.version !== 1) throw new Error('Unsupported save version. Your current progress has not changed.');
  const player = createPlayer();
  for (const key of ['xp', 'gold', 'knowledge', 'battles', 'wins', 'experiments']) player[key] = integer(raw[key], player[key]);
  player.discoveries = list(raw.discoveries, id => Boolean(REACTION_BY_ID[id]));
  player.owned = [...player.owned, ...player.discoveries.map(id => REACTION_BY_ID[id].output)];
  player.mastery = record(raw.mastery, id => player.owned.includes(id));
  player.reactionUsage = record(raw.reactionUsage, id => player.discoveries.includes(id));
  player.research = list(raw.research, id => RESEARCH.some(r => r.id === id));
  player.favorites = list(raw.favorites, id => player.owned.includes(id));
  player.campaign = list(raw.campaign, id => Boolean(ENCOUNTER_BY_ID[id]));
  player.claimedBattles = list(raw.claimedBattles, id => id.length < 100);
  player.hints = record(raw.hints, id => Boolean(REACTION_BY_ID[id]));
  for (const key of Object.keys(player.settings)) if (typeof raw.settings?.[key] === 'boolean') player.settings[key] = raw.settings[key];
  if (Array.isArray(raw.history)) player.history = raw.history.filter(h => h && Array.isArray(h.inputs) && h.inputs.length === 2 && h.inputs.every(id => player.owned.includes(id)) && (h.result === null || REACTION_BY_ID[h.result])).slice(0, 12).map(h => ({ inputs: [...h.inputs], result: h.result, environment: h.environment === 'rain' ? 'rain' : 'neutral', frozen: h.frozen === true }));
  const allowedRelics = new Set(unlockedRelics(player).map(r => r.id));
  const used = new Set();
  const team = [];
  if (Array.isArray(raw.team)) for (const slot of raw.team) {
    if (!slot || !VESSEL_BY_ID[slot.vessel] || used.has(slot.vessel)) continue;
    used.add(slot.vessel);
    const fallback = VESSEL_BY_ID[slot.vessel];
    team.push({
      vessel: slot.vessel,
      elements: Array.isArray(slot.elements) && slot.elements.length === 2 && slot.elements.every(id => player.owned.includes(id)) ? [...slot.elements] : [...fallback.elements],
      relic: allowedRelics.has(slot.relic) ? slot.relic : 'none',
      targeting: ['front', 'weakest', 'reaction'].includes(slot.targeting) ? slot.targeting : 'front',
      priority: ['reaction', 'alternate', 'core'].includes(slot.priority) ? slot.priority : 'reaction',
    });
  }
  for (const vessel of VESSELS) if (!used.has(vessel.id)) team.push(createPlayer().team.find(s => s.vessel === vessel.id));
  player.team = team;
  const replay = raw.lastReplay;
  if (replay?.contentVersion === CONTENT_VERSION && ENCOUNTER_BY_ID[replay.encounterId] && Number.isInteger(replay.seed)
    && Array.isArray(replay.team) && replay.team.length > 0 && replay.team.length <= 5
    && new Set(replay.team.map(s => s?.vessel)).size === replay.team.length
    && replay.team.every(s => s && VESSEL_BY_ID[s.vessel] && RELIC_BY_ID[s.relic] && Array.isArray(s.elements) && s.elements.length === 2 && s.elements.every(id => Boolean(ELEMENT_BY_ID[id])))) {
    player.lastReplay = {
      contentVersion: CONTENT_VERSION, encounterId: replay.encounterId, seed: replay.seed >>> 0,
      team: replay.team.map(s => ({ vessel: s.vessel, elements: [...s.elements], relic: s.relic, targeting: ['front', 'weakest', 'reaction'].includes(s.targeting) ? s.targeting : 'front', priority: ['reaction', 'alternate', 'core'].includes(s.priority) ? s.priority : 'reaction' })),
      research: list(replay.research, id => RESEARCH.some(r => r.id === id)), mastery: record(replay.mastery, id => Boolean(ELEMENT_BY_ID[id])),
    };
  }
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
