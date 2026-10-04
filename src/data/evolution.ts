import type { ElementDefinition, EvolutionTrait } from '../types.js';

// The first recognized elemental tag determines the signature. Mixed elements
// retain their existing identity instead of becoming a stronger duplicate.
export const EVOLUTION_TRAITS: EvolutionTrait[] = [
  { id: 'kindling-trail', name: 'Kindling Trail', tags: ['heat', 'burn', 'molten'], trigger: 'OnElementCast', cooldown: 8, description: 'An elemental cast spreads a light Burn to up to two enemies. Once every 8 seconds for this element and vessel.', effects: [{ type: 'spread', status: 'burn', duration: 3, intensity: .08, count: 2 }] },
  { id: 'tidal-rinse', name: 'Tidal Rinse', tags: ['water', 'wet', 'vapor'], trigger: 'OnElementCast', cooldown: 8, description: 'An elemental cast cleanses one harmful status from its own vessel. Once every 8 seconds for this element and vessel.', effects: [{ type: 'cleanse', count: 1, recipient: 'source' }] },
  { id: 'stone-resolve', name: 'Stone Resolve', tags: ['earth', 'armor', 'metal', 'sand', 'crystal'], trigger: 'OnElementCast', cooldown: 10, description: 'An elemental cast grants Taunt to its own vessel for 2 seconds before duration bonuses, drawing enemy attention. Once every 10 seconds.', effects: [{ type: 'status', status: 'taunt', duration: 2, intensity: 1, recipient: 'source' }] },
  { id: 'tailwind', name: 'Tailwind', tags: ['air', 'swift', 'weather', 'spread'], trigger: 'OnElementCast', cooldown: 10, description: 'An elemental cast grants its own vessel a small Haste for 2 seconds before duration bonuses. Once every 10 seconds.', effects: [{ type: 'status', status: 'haste', duration: 2, intensity: .1, recipient: 'source' }] },
  { id: 'grounding-pulse', name: 'Grounding Pulse', tags: ['electricity', 'shock', 'chain'], trigger: 'OnReaction', cooldown: 8, description: 'A reaction using or producing this element briefly applies Resistance Break to its target. Once every 8 seconds for this element and vessel.', effects: [{ type: 'status', status: 'resistance-break', duration: 2, intensity: .1 }] },
  { id: 'glacial-shelter', name: 'Glacial Shelter', tags: ['cold', 'freeze'], trigger: 'OnReaction', cooldown: 10, description: 'A reaction using or producing this element shields the weakest ally for 60% of the vessel\'s attack. Once every 10 seconds.', effects: [{ type: 'shield', scale: .6, recipient: 'weakestAlly' }] },
  { id: 'living-seed', name: 'Living Seed', tags: ['growth', 'life', 'root'], trigger: 'OnElementCast', cooldown: 10, description: 'An elemental cast places a gentle Regeneration on the weakest ally for 4 seconds before duration bonuses. Once every 10 seconds.', effects: [{ type: 'status', status: 'regeneration', duration: 4, intensity: .06, recipient: 'weakestAlly' }] },
  { id: 'seeping-dose', name: 'Seeping Dose', tags: ['toxic', 'poison', 'decay', 'blood', 'bleed'], trigger: 'OnReaction', cooldown: 10, description: 'A reaction using or producing this element adds a light Bleed to its target for 3 seconds before duration bonuses. Once every 10 seconds.', effects: [{ type: 'status', status: 'bleed', duration: 3, intensity: .08 }] },
  { id: 'dawn-window', name: 'Dawn Window', tags: ['radiant', 'purify', 'cleanse'], trigger: 'OnReaction', cooldown: 10, description: 'A reaction using or producing this element cleanses up to two harmful statuses from the weakest ally. Once every 10 seconds.', effects: [{ type: 'cleanse', count: 2, recipient: 'weakestAlly' }] },
  { id: 'night-reserve', name: 'Night Reserve', tags: ['dark', 'drain', 'blind'], trigger: 'OnElementCast', cooldown: 10, description: 'An elemental cast grants its own vessel a gentle Drain for 3 seconds before duration bonuses. Once every 10 seconds.', effects: [{ type: 'status', status: 'drain', duration: 3, intensity: .08, recipient: 'source' }] },
  { id: 'echo-shelter', name: 'Echo Shelter', tags: [], trigger: 'OnReaction', cooldown: 10, description: 'A reaction using or producing this element shields its own vessel for 40% of its attack. Once every 10 seconds.', effects: [{ type: 'shield', scale: .4, recipient: 'source' }] },
];

export function evolutionTrait(element: Pick<ElementDefinition, 'tags'>): EvolutionTrait {
  for (const tag of element.tags) {
    const match = EVOLUTION_TRAITS.find(trait => trait.tags.includes(tag));
    if (match) return match;
  }
  return EVOLUTION_TRAITS.find(trait => !trait.tags.length)!;
}

export function validateEvolutionTraits(value: unknown, hasStatus: (id: unknown) => boolean): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 50) return ['Invalid evolution trait catalog.'];
  const issues: string[] = [], ids = new Set<string>(), tags = new Set<string>();
  const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  for (const trait of value) {
    if (!trait || typeof trait.id !== 'string' || !/^(?!(?:constructor|prototype)$)[a-z][a-z0-9-]{1,59}$/.test(trait.id) || ids.has(trait.id) || typeof trait.name !== 'string' || !trait.name.trim() || trait.name.length > 80 || typeof trait.description !== 'string' || !trait.description.trim() || trait.description.length > 600) { issues.push('Invalid evolution trait identity.'); continue; }
    ids.add(trait.id);
    if (!['OnElementCast', 'OnReaction'].includes(trait.trigger) || !finite(trait.cooldown, 4, 60)) issues.push(trait.id + ': invalid evolution trigger or cooldown.');
    if (!Array.isArray(trait.tags) || new Set(trait.tags).size !== trait.tags.length || trait.tags.some((tag: unknown) => typeof tag !== 'string' || !/^[a-z-]{2,40}$/.test(tag) || tags.has(tag))) issues.push(trait.id + ': invalid or overlapping evolution tags.');
    else trait.tags.forEach((tag: string) => tags.add(tag));
    if (!Array.isArray(trait.effects) || !trait.effects.length || trait.effects.length > 4) { issues.push(trait.id + ': invalid evolution effects.'); continue; }
    for (const effect of trait.effects) {
      if (!effect || !['status', 'spread', 'shield', 'heal', 'cleanse'].includes(effect.type) || effect.recipient !== undefined && !['source', 'weakestAlly', 'target'].includes(effect.recipient)) { issues.push(trait.id + ': invalid evolution effect.'); continue; }
      if (['status', 'spread'].includes(effect.type) && (!hasStatus(effect.status) || !finite(effect.duration, .25, 10) || !finite(effect.intensity, .01, 1))) issues.push(trait.id + ': invalid evolution status.');
      if (['shield', 'heal'].includes(effect.type) && !finite(effect.scale, 0, 2)) issues.push(trait.id + ': invalid evolution scale.');
      if (['spread', 'cleanse'].includes(effect.type) && (!Number.isInteger(effect.count) || !finite(effect.count, 1, 3))) issues.push(trait.id + ': invalid evolution count.');
    }
  }
  if (value.filter(trait => Array.isArray(trait?.tags) && trait.tags.length === 0).length !== 1) issues.push('Evolution needs exactly one fallback trait.');
  return issues;
}
