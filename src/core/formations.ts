import type { Player, Loadout } from '../types.js';
import { ELEMENT_BY_ID, VESSEL_BY_ID, RELIC_BY_ID, REACTION_BY_ID } from '../data/content.js';
import { PASSIVES, EQUIPMENT } from '../data/systems.js';
import { validAbilities } from '../data/units.js';
import { abilitySlots } from './research.js';

export const FORMATION_LIMIT = 10;
export const TESTED_BUILD_LIMIT = 100;
const indexValid = (player: Player, index: number) => Number.isInteger(index) && index >= 0 && index < player.loadouts.length;
const title = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 40) : '';
function uniqueName(player: Player, name: string, index = -1) {
  return Boolean(name) && !player.loadouts.some((l, i) => i !== index && l.name.toLowerCase() === name.toLowerCase());
}

// This representation records choices, not account power, names, dates or seeds.
export function formationKey(team: Loadout[]): string {
  return JSON.stringify(team.map(s => [s.vessel, s.elements, s.relic, s.targeting, s.priority, s.passive ?? 'none', s.abilities ?? [], Object.entries(s.equipment ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0), s.reactionPriority ?? []]));
}

function structurallyValid(team: unknown): team is Loadout[] {
  if (!Array.isArray(team) || team.length !== 5 || new Set(team.map(s => s?.vessel)).size !== 5) return false;
  return team.every(s => s && typeof s.vessel === 'string' && Object.hasOwn(VESSEL_BY_ID, s.vessel)
    && Array.isArray(s.elements) && s.elements.length === 2 && s.elements.every((id: unknown) => typeof id === 'string' && Object.hasOwn(ELEMENT_BY_ID, id))
    && typeof s.relic === 'string' && Object.hasOwn(RELIC_BY_ID, s.relic)
    && ['front', 'weakest', 'reaction'].includes(s.targeting) && ['reaction', 'alternate', 'core'].includes(s.priority)
    && PASSIVES.some(p => p.id === (s.passive ?? 'none'))
    && (s.abilities === undefined || validAbilities(s.abilities, Infinity, 3))
    && (s.equipment === undefined || s.equipment && typeof s.equipment === 'object' && !Array.isArray(s.equipment) && Object.entries(s.equipment).every(([slot, id]) => EQUIPMENT.some(e => e.slot === slot && e.id === id)))
    && (s.reactionPriority === undefined || Array.isArray(s.reactionPriority) && s.reactionPriority.length <= 10 && new Set(s.reactionPriority).size === s.reactionPriority.length && s.reactionPriority.every((id: unknown) => typeof id === 'string' && Object.hasOwn(REACTION_BY_ID, id))));
}

export function validFormation(player: Player, team: unknown): team is Loadout[] {
  return structurallyValid(team) && team.every(s => player.wins >= (VESSEL_BY_ID[s.vessel].unlockWins ?? 0)
    && s.elements.every(id => player.owned.includes(id) && ELEMENT_BY_ID[id].enabled)
    && player.discoveries.length >= (RELIC_BY_ID[s.relic].discoveries ?? 0)
    && player.discoveries.length >= (PASSIVES.find(p => p.id === (s.passive ?? 'none'))?.unlockDiscoveries ?? 0)
    && (s.abilities === undefined || validAbilities(s.abilities, player.discoveries.length, abilitySlots(player.research), player.research))
    && Object.values(s.equipment ?? {}).every(id => player.equipment.includes(id))
    && (s.reactionPriority ?? []).every(id => player.discoveries.includes(id)));
}

export function normalizeTestedBuilds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const key of value) {
    if (keys.length >= TESTED_BUILD_LIMIT) break;
    if (typeof key !== 'string' || key.length > 5000 || keys.includes(key)) continue;
    try {
      const rows: unknown = JSON.parse(key);
      if (!Array.isArray(rows) || rows.length !== 5 || rows.some(r => !Array.isArray(r) || r.length !== 9 || !Array.isArray(r[7]) || r[7].some((e: unknown) => !Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || typeof e[1] !== 'string'))) continue;
      const team: Loadout[] = rows.map(r => ({ vessel: r[0], elements: r[1], relic: r[2], targeting: r[3], priority: r[4], passive: r[5], abilities: r[6], equipment: Object.fromEntries(r[7]), reactionPriority: r[8] }));
      if (structurallyValid(team) && formationKey(team) === key) keys.push(key);
    } catch { /* Damaged historical records do not invalidate the journal. */ }
  }
  return keys;
}

export function saveLoadout(player: Player, name: unknown) {
  const nameValue = title(name);
  if (player.loadouts.length >= FORMATION_LIMIT || !uniqueName(player, nameValue) || !validFormation(player, player.team)) return false;
  player.loadouts.push({ name: nameValue, team: structuredClone(player.team) }); return true;
}
export function applyLoadout(player: Player, index: number) {
  if (!indexValid(player, index) || !validFormation(player, player.loadouts[index].team)) return false;
  player.team = structuredClone(player.loadouts[index].team); return true;
}
export function renameLoadout(player: Player, index: number, name: unknown) {
  const nameValue = title(name);
  if (!indexValid(player, index) || !uniqueName(player, nameValue, index)) return false;
  player.loadouts[index].name = nameValue; return true;
}
export function replaceLoadout(player: Player, index: number) {
  if (!indexValid(player, index) || !validFormation(player, player.team)) return false;
  player.loadouts[index].team = structuredClone(player.team); return true;
}
export function deleteLoadout(player: Player, index: number) {
  if (!indexValid(player, index)) return false;
  player.loadouts.splice(index, 1); return true;
}
