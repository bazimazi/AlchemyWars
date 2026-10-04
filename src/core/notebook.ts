import type { Player, ExperimentNote } from '../types.js';
import { experimentContext } from './learning.js';
import { talentPerk } from './talents.js';

export const experimentCapacity = (player: Pick<Player, 'talents'>) => Math.min(2, 1 + talentPerk(player, 'experimentSlots'));
const nameOf = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 40) : '';
function note(player: Player, name: unknown, a: unknown, b: unknown, context: unknown): ExperimentNote | null {
  const title = nameOf(name);
  if (!title || typeof a !== 'string' || typeof b !== 'string' || !player.owned.includes(a) || !player.owned.includes(b)) return null;
  return { name: title, inputs: [a, b], context: experimentContext(context) };
}
const validIndex = (player: Player, index: unknown): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < player.experimentNotes.length;
export function saveExperimentNote(player: Player, name: unknown, a: unknown, b: unknown, context: unknown) {
  const prepared = note(player, name, a, b, context);
  if (!prepared || player.experimentNotes.length >= experimentCapacity(player) || player.experimentNotes.some(n => n.name.toLowerCase() === prepared.name.toLowerCase())) return false;
  player.experimentNotes.push(prepared); return true;
}
export function replaceExperimentNote(player: Player, index: unknown, a: unknown, b: unknown, context: unknown) {
  if (!validIndex(player, index)) return false;
  const prepared = note(player, player.experimentNotes[index].name, a, b, context);
  if (!prepared) return false;
  player.experimentNotes[index] = prepared; return true;
}
export function deleteExperimentNote(player: Player, index: unknown) {
  if (!validIndex(player, index)) return false;
  player.experimentNotes.splice(index, 1); return true;
}
export function normalizeExperimentNotes(player: Player, value: unknown): ExperimentNote[] {
  if (!Array.isArray(value)) return [];
  const result: ExperimentNote[] = [];
  for (const raw of value.slice(0, 100)) {
    if (!raw || !Array.isArray(raw.inputs) || raw.inputs.length !== 2) continue;
    const prepared = note(player, raw.name, raw.inputs[0], raw.inputs[1], raw.context);
    if (prepared && !result.some(n => n.name.toLowerCase() === prepared.name.toLowerCase())) result.push(prepared);
    if (result.length === experimentCapacity(player)) break;
  }
  return result;
}
