import type { Effect } from '../types.js';
export interface Ability { id: string; name: string; description: string; cooldown: number; discoveries: number; requiresResearch?: string[]; condition?: 'wounded' | 'unshielded'; effects: Effect[] }
export const ABILITIES: Ability[] = [
  { id: 'ward', name: 'Personal Ward', description: 'Spend a cast shielding yourself when unshielded.', cooldown: 9, discoveries: 0, condition: 'unshielded', effects: [{ type: 'shield', scale: 1.5, recipient: 'source' }] },
  { id: 'mend', name: 'Mending Pulse', description: 'Spend a cast healing the most wounded ally below 70% health.', cooldown: 10, discoveries: 2, condition: 'wounded', effects: [{ type: 'heal', scale: 1.4, recipient: 'weakestAlly' }] },
  { id: 'fracture', name: 'Fracturing Strike', description: 'Spend a cast damaging a target and breaking its armor.', cooldown: 12, discoveries: 4, effects: [{ type: 'damage', scale: .9 }, { type: 'status', status: 'armor-break', duration: 4, intensity: .2 }] },
  { id: 'purge', name: 'Restoring Light', description: 'Spend a cast cleansing and healing a wounded ally.', cooldown: 14, discoveries: 8, condition: 'wounded', effects: [{ type: 'cleanse', count: 2, recipient: 'weakestAlly' }, { type: 'heal', scale: .8, recipient: 'weakestAlly' }] },
  { id: 'renewal', name: 'Renewal Pulse', description: 'Spend a cast healing and regenerating the most wounded ally below 70% health.', cooldown: 16, discoveries: 0, requiresResearch: ['vessel-forms'], condition: 'wounded', effects: [{ type: 'heal', scale: .8, recipient: 'weakestAlly' }, { type: 'status', status: 'regeneration', duration: 5, intensity: .12, recipient: 'weakestAlly' }] },
];
export interface VesselProfile { growth: { hp: number; attack: number; armor: number }; animation: { idle: 'sway' | 'hover' | 'pulse'; duration: number; lift: number; cast: number } }
// Per-level growth is capped at level ten; normalized competitive battles ignore it.
export const VESSEL_PROFILES: Record<string, VesselProfile> = Object.fromEntries(([
  ['golem', 8, .25, .6, 'sway', 3.1, 2, 3], ['sprite', 3, .8, .1, 'pulse', 1.3, 4, 12],
  ['sylph', 4, .5, .2, 'hover', 2.1, 8, 6], ['keeper', 6, .35, .3, 'sway', 3.5, 3, 4],
  ['wraith', 3, .7, .15, 'hover', 2.8, 6, 10], ['hawk', 3, .6, .1, 'hover', 1.5, 10, 14],
  ['beast', 7, .5, .25, 'pulse', 2.2, 3, 8], ['guardian', 8, .3, .5, 'sway', 3.8, 2, 5],
  ['fox', 4, .5, .2, 'sway', 1.8, 5, 11], ['dryad', 6, .35, .35, 'sway', 3.2, 4, 6],
  ['drake', 5, .8, .1, 'pulse', 1.7, 5, 13], ['moth', 3, .55, .15, 'hover', 2.4, 9, 7],
  ['turtle', 10, .2, .7, 'sway', 4.5, 1, 2], ['spirit-keeper', 5, .4, .2, 'hover', 3.6, 7, 5],
  ['djinn', 4, .65, .15, 'pulse', 2.6, 6, 9],
] satisfies [string, number, number, number, VesselProfile['animation']['idle'], number, number, number][]).map(([id, hp, attack, armor, idle, duration, lift, cast]) => [id, { growth: { hp, attack, armor }, animation: { idle, duration, lift, cast } }]));
export const vesselLevel = (xp = 0) => Math.min(10, 1 + Math.floor(Math.max(0, xp) / 50));
export function validAbilities(value: unknown, discoveries = Infinity, slots = 2, research?: readonly string[]): value is string[] {
  return Array.isArray(value) && value.length <= slots && new Set(value).size === value.length && value.every(id => ABILITIES.some(a => a.id === id && discoveries >= a.discoveries && (research === undefined || a.requiresResearch?.every(id => research.includes(id)) !== false)));
}
