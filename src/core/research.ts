import { RESEARCH } from '../data/content.js';

export const hasResearch = (owned: readonly string[], required: readonly string[] = []) => required.every(id => owned.includes(id));
export function abilitySlots(research: readonly string[], normalized = false) {
  return normalized ? 2 : Math.min(3, Math.max(2, ...RESEARCH.filter(r => research.includes(r.id)).map(r => r.abilitySlots ?? 2)));
}
