import { ELEMENTS, ELEMENT_BY_ID, REACTIONS, REACTION_BY_ID, STATUSES, ENEMIES, ENEMY_BY_ID, RELICS, RELIC_BY_ID, ENCOUNTERS, ENCOUNTER_BY_ID, CONTENT_VERSION, setContentVersion, validateContent } from '../data/content.js';
import { rebuildReactionIndex } from './reactions.js';
const idPattern = /^(?!(?:constructor|prototype)$)[a-z][a-z0-9-]{1,59}$/;
const kinds = ['elements', 'reactions', 'statuses', 'enemies', 'relics', 'encounters'];
const collections = () => ({ elements: ELEMENTS, reactions: REACTIONS, statuses: Object.values(STATUSES), enemies: ENEMIES, relics: RELICS, encounters: ENCOUNTERS });
const indexes = () => ({ elements: ELEMENT_BY_ID, reactions: REACTION_BY_ID, statuses: STATUSES, enemies: ENEMY_BY_ID, relics: RELIC_BY_ID, encounters: ENCOUNTER_BY_ID });
export const CONTENT_KINDS = kinds;

export function contentTemplate(kind) {
  const meta = { id: 'new-' + ({ enemies: 'enemy', statuses: 'status' }[kind] ?? kind.replace(/s$/, '')), version: 1, enabled: true, releaseDate: '2026-10-01', tags: ['experimental'] };
  if (kind === 'elements') return { ...meta, name: 'Aether', description: 'An experimental primordial force.', lore: 'A new fragment of the ancient system.', color: '#b8d2df', icon: 'burst', rarity: 'Rare', tier: 2, affinity: 'arcane', power: 1, role: 'Disruption', base: false, effects: [{ type: 'status', status: 'vulnerable', duration: 4, intensity: .2 }] };
  if (kind === 'reactions') return { ...meta, name: 'A New Relationship', inputs: ['wind', 'light'], output: 'new-element', category: 'Transformation', description: 'A new path through the reaction graph.', hint: 'Dawn catches a moving breeze.', color: '#b8d2df', icon: 'burst', rarity: 'Rare', priority: 0, cooldown: 3, effects: [{ type: 'damage', scale: .6 }] };
  if (kind === 'statuses') return { ...meta, name: 'Aether Mark', short: 'AETH', harmful: true, maxStacks: 2, receivedMultiplier: 1 };
  if (kind === 'enemies') return { ...meta, name: 'Aether Wisp', shape: 'wraith', hp: 210, attack: 24, armor: 12, interval: 2.4, elements: ['arcane', 'wind'] };
  if (kind === 'relics') return { ...meta, name: 'Aether Lens', description: 'Slows linger for two extra seconds.', discoveries: 12, rarity: 'Rare', modifiers: { statusDuration: { slow: 2 } } };
  if (kind === 'encounters') return { ...meta, name: 'The Aether Gate', region: 'The Eclipse', label: '01', environment: 'night', description: 'A new door in the old world.', tip: 'Look for an elemental weakness.', enemies: ['new-enemy', 'shade', 'shade'], scale: 1, gold: 50, knowledge: 5, xp: 50, prerequisite: 'molten-throne' };
  throw new Error('Unknown content kind.');
}
export function validatePack(pack) {
  const issues = [];
  if (!pack || typeof pack !== 'object' || !idPattern.test(pack.id ?? '') || !Number.isInteger(pack.version) || pack.version < 1) return ['A pack needs a lowercase id and a positive integer version.'];
  const all = collections(), maps = indexes();
  if (kinds.some(kind => pack[kind] !== undefined && !Array.isArray(pack[kind]))) return ['Content collections must be arrays.'];
  for (const kind of kinds) {
    if (pack[kind] !== undefined && (!Array.isArray(pack[kind]) || pack[kind].length > 5000)) issues.push(kind + ' must be an array of at most 5000 entries.');
    if (!Array.isArray(pack[kind])) continue;
    const seen = new Set();
    for (const entry of pack[kind]) {
      if (!entry || typeof entry !== 'object' || !idPattern.test(entry.id ?? '')) { issues.push('Invalid id in ' + kind); continue; }
      if (seen.has(entry.id)) issues.push('Duplicate ' + entry.id); seen.add(entry.id);
      if (!Number.isInteger(entry.version) || entry.version < 1 || typeof entry.enabled !== 'boolean') issues.push(entry.id + ': version and enabled are required.');
      if (maps[kind][entry.id] && entry.version <= maps[kind][entry.id].version) issues.push(entry.id + ': updates must increase the version.');
      if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 80) issues.push(entry.id + ': name must contain 1–80 characters.');
      if (!Array.isArray(entry.tags) || entry.tags.some(t => typeof t !== 'string' || !idPattern.test(t))) issues.push(entry.id + ': tags must be lowercase identifiers.');
      const stack = [entry];
      let visited = 0;
      while (stack.length && visited++ < 1000) {
        const value = stack.pop();
        if (typeof value === 'string' && (value.length > 3000 || /[<>"`\x00-\x08]/.test(value))) issues.push(entry.id + ': text contains unsupported markup or control characters.');
        else if (value && typeof value === 'object') stack.push(...Object.values(value));
      }
      if (stack.length) issues.push(entry.id + ': definition is too complex.');
    }
    all[kind] = [...all[kind].filter(e => !pack[kind].some(x => x?.id === e.id)), ...pack[kind].filter(Boolean)];
  }
  if (issues.length) return [...new Set(issues)];
  const has = (kind, id) => all[kind].some(e => e.id === id);
  for (const entry of [...(pack.elements ?? []), ...(pack.reactions ?? [])]) {
    if (!Array.isArray(entry.effects) || entry.effects.length > 12) { issues.push(entry.id + ': use at most twelve effects.'); continue; }
    for (const effect of entry.effects) {
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) { issues.push(entry.id + ': effects must be objects.'); continue; }
      if (!['damage', 'status', 'shield', 'heal', 'cleanse', 'chain', 'spread', 'applyElement', 'summon', 'resurrect', 'explode', 'transform'].includes(effect.type)) issues.push(entry.id + ': unsupported effect.');
      if (effect.status && !has('statuses', effect.status)) issues.push(entry.id + ': unknown status.');
      if (effect.element && !has('elements', effect.element)) issues.push(entry.id + ': unknown applied element.');
      if (effect.enemy && !has('enemies', effect.enemy)) issues.push(entry.id + ': unknown summon.');
      if (effect.recipient && !['source', 'weakestAlly', 'target'].includes(effect.recipient)) issues.push(entry.id + ': unknown effect recipient.');
      for (const key of ['scale', 'duration', 'intensity', 'count', 'stacks']) if (effect[key] !== undefined && (!Number.isFinite(effect[key]) || effect[key] < 0 || effect[key] > 60)) issues.push(entry.id + ': invalid effect ' + key);
      if (['damage', 'heal', 'shield', 'chain', 'explode', 'resurrect', 'summon'].includes(effect.type) && !Number.isFinite(effect.scale)) issues.push(entry.id + ': scale is required.');
      if (['status', 'spread'].includes(effect.type) && (!effect.status || !Number.isFinite(effect.duration) || !Number.isFinite(effect.intensity))) issues.push(entry.id + ': status, duration and intensity are required.');
    }
  }
  for (const e of pack.elements ?? []) if (!/^#[a-fA-F0-9]{6}$/.test(e.color ?? '') || !Number.isFinite(e.power) || e.power < 0 || e.power > 5 || !Number.isInteger(e.tier)) issues.push(e.id + ': invalid color, power or tier.');
  for (const r of pack.reactions ?? []) {
    if (r.id !== r.output) issues.push(r.id + ': reaction id must match its derived output element.');
    if (!Array.isArray(r.inputs) || r.inputs.length !== 2 || r.inputs.some(id => !has('elements', id)) || !has('elements', r.output)) issues.push(r.id + ': recipe inputs/output must reference defined elements.');
    if (!Number.isFinite(r.priority) || !Number.isFinite(r.cooldown) || r.cooldown < 0) issues.push(r.id + ': priority and cooldown are required.');
    if (r.conditions && (typeof r.conditions !== 'object' || Array.isArray(r.conditions) || r.conditions.statuses && (!Array.isArray(r.conditions.statuses) || r.conditions.statuses.some(id => !has('statuses', id))))) issues.push(r.id + ': invalid conditions.');
  }
  for (const s of pack.statuses ?? []) if (!Number.isInteger(s.maxStacks) || s.maxStacks < 1 || s.maxStacks > 20 || typeof s.harmful !== 'boolean') issues.push(s.id + ': invalid status limits.');
  for (const e of pack.enemies ?? []) if (!['hp', 'attack', 'armor', 'interval'].every(k => Number.isFinite(e[k]) && e[k] > 0 && e[k] <= 100000) || !Array.isArray(e.elements) || e.elements.length !== 2 || e.elements.some(id => !has('elements', id))) issues.push(e.id + ': invalid enemy stats or loadout.');
  for (const r of pack.relics ?? []) if (!r.modifiers || typeof r.modifiers !== 'object' || !Number.isInteger(r.discoveries)) issues.push(r.id + ': invalid relic modifiers or unlock.');
  for (const e of pack.encounters ?? []) if (!Array.isArray(e.enemies) || !e.enemies.length || e.enemies.length > 10 || e.enemies.some(id => !has('enemies', id)) || !['gold', 'knowledge', 'xp'].every(k => Number.isFinite(e[k]) && e[k] >= 0)) issues.push(e.id + ': invalid encounter or rewards.');
  return [...new Set(issues)];
}

export function installContentPack(pack) {
  const issues = validatePack(pack);
  if (issues.length) throw new Error(issues.join('\n'));
  const all = collections(), maps = indexes();
  for (const kind of kinds) for (const definition of pack[kind] ?? []) {
    const entry = structuredClone(definition), old = all[kind].findIndex(e => e.id === entry.id);
    if (old >= 0) all[kind][old] = entry; else all[kind].push(entry);
    maps[kind][entry.id] = entry;
  }
  setContentVersion(CONTENT_VERSION + '+' + pack.id + '.' + pack.version);
  rebuildReactionIndex();
  return { version: CONTENT_VERSION, added: kinds.reduce((n, k) => n + (pack[k]?.length ?? 0), 0) };
}
export function contentAudit() {
  const edges = new Map(ELEMENTS.map(e => [e.id, { inputs: 0, outputs: 0 }]));
  const concepts = new Map(), duplicateConcepts = [];
  for (const rule of REACTIONS) {
    for (const id of rule.inputs) if (edges.has(id)) edges.get(id).outputs++;
    if (edges.has(rule.output)) edges.get(rule.output).inputs++;
    const name = rule.name.toLowerCase().replace(/[^a-z]/g, '');
    if (concepts.has(name)) duplicateConcepts.push([concepts.get(name), rule.id]); else concepts.set(name, rule.id);
  }
  return { errors: validateContent(), duplicateConcepts, unused: [...edges].filter(([, n]) => n.inputs + n.outputs === 0).map(([id]) => id), deadEnds: [...edges].filter(([, n]) => n.outputs === 0).map(([id]) => id), highPower: REACTIONS.filter(r => r.effects.reduce((sum, e) => sum + (e.scale ?? 0) * (e.count ?? 1), 0) > 3).map(r => r.id), missingCounterplay: ENEMIES.filter(e => e.tags.includes('boss') && !e.weaknesses?.length).map(e => e.id) };
}
export function proposeReaction(a, b) {
  const first = ELEMENT_BY_ID[a], second = ELEMENT_BY_ID[b];
  if (!first || !second) return null;
  const sharedTags = first.tags.filter(t => second.tags.includes(t));
  const vocabulary = [...new Set([...first.tags, ...second.tags])];
  return { inputs: [a, b], proposedName: first.name + 'bound ' + second.name, sharedTags, tags: vocabulary, existing: REACTIONS.filter(r => r.inputs.includes(a) && r.inputs.includes(b)).map(r => r.name), effects: [...first.effects, ...second.effects].slice(0, 4), designerApprovalRequired: true };
}
