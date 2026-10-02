import { ENVIRONMENTS } from '../data/systems.js';
import type { ElementDefinition, ReactionDefinition, StatusDefinition, UnitDefinition, Relic, Encounter } from '../types.js';
import { ELEMENTS, ELEMENT_BY_ID, REACTIONS, REACTION_BY_ID, STATUSES, ENEMIES, ENEMY_BY_ID, RELICS, RELIC_BY_ID, ENCOUNTERS, ENCOUNTER_BY_ID, CONTENT_VERSION, setContentVersion, validateContent } from '../data/content.js';
import { rebuildReactionIndex } from './reactions.js';
const idPattern = /^(?!(?:constructor|prototype)$)[a-z][a-z0-9-]{1,59}$/;
const kinds = ['elements', 'reactions', 'statuses', 'enemies', 'relics', 'encounters'] as const;
export type ContentKind = typeof kinds[number];
interface ContentTypes { elements: ElementDefinition; reactions: ReactionDefinition; statuses: StatusDefinition; enemies: UnitDefinition; relics: Relic; encounters: Encounter }
export type ContentPack = { id: string; version: number } & { [K in ContentKind]?: ContentTypes[K][] };

const collections = () => ({ elements: ELEMENTS, reactions: REACTIONS, statuses: Object.values(STATUSES), enemies: ENEMIES, relics: RELICS, encounters: ENCOUNTERS });
const indexes = () => ({ elements: ELEMENT_BY_ID, reactions: REACTION_BY_ID, statuses: STATUSES, enemies: ENEMY_BY_ID, relics: RELIC_BY_ID, encounters: ENCOUNTER_BY_ID });
export const CONTENT_KINDS = kinds;

export function contentTemplate<K extends ContentKind>(kind: K): ContentTypes[K];
export function contentTemplate(kind: string): ContentTypes[ContentKind];
export function contentTemplate(kind: string): ContentTypes[ContentKind] {
  const meta = { id: 'new-' + (({ enemies: 'enemy', statuses: 'status' } as Record<string,string>)[kind] ?? kind.replace(/s$/, '')), version: 1, enabled: true, releaseDate: '2026-10-01', tags: ['experimental'] };
  if (kind === 'elements') return { ...meta, name: 'Aether', description: 'An experimental primordial force.', lore: 'A new fragment of the ancient system.', color: '#b8d2df', icon: 'burst', rarity: 'Rare', tier: 2, affinity: 'arcane', power: 1, role: 'Disruption', base: false, effects: [{ type: 'status', status: 'vulnerable', duration: 4, intensity: .2 }] };
  if (kind === 'reactions') return { ...meta, name: 'A New Relationship', inputs: ['wind', 'light'], output: 'new-element', category: 'Transformation', description: 'A new path through the reaction graph.', hint: 'Dawn catches a moving breeze.', color: '#b8d2df', icon: 'burst', rarity: 'Rare', priority: 0, cooldown: 3, trigger: 'OnElementApplied', effects: [{ type: 'damage', scale: .6 }] };
  if (kind === 'statuses') return { ...meta, name: 'Aether Mark', short: 'AETH', harmful: true, maxStacks: 2, receivedMultiplier: 1 };
  if (kind === 'enemies') return { ...meta, name: 'Aether Wisp', shape: 'wraith', hp: 210, attack: 24, armor: 12, interval: 2.4, elements: ['arcane', 'wind'] };
  if (kind === 'relics') return { ...meta, name: 'Aether Lens', description: 'Slows linger for two extra seconds.', discoveries: 12, rarity: 'Rare', modifiers: { statusDuration: { slow: 2 } } };
  if (kind === 'encounters') return { ...meta, name: 'The Aether Gate', region: 'The Eclipse', label: '01', environment: 'night', description: 'A new door in the old world.', tip: 'Look for an elemental weakness.', enemies: ['new-enemy', 'shade', 'shade'], scale: 1, gold: 50, knowledge: 5, xp: 50, prerequisite: 'molten-throne' };
  throw new Error('Unknown content kind.');
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
const identifier = (value: unknown): value is string => typeof value === 'string' && idPattern.test(value);
const number = (value: unknown, min = 0, max = 100000): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string');
export function validatePack(input: unknown): string[] {
  const pack = object(input), issues: string[] = [];
  if (!pack || !identifier(pack.id) || !number(pack.version, 1) || !Number.isInteger(pack.version)) return ['A pack needs a lowercase id and a positive integer version.'];
  const maps = indexes();
  const definitions = new Map<ContentKind, ObjectValue[]>();
  for (const kind of kinds) {
    const value = pack[kind];
    if (value === undefined) { definitions.set(kind, []); continue; }
    if (!Array.isArray(value) || value.length > 5000) { issues.push(kind + ' must be an array of at most 5000 entries.'); continue; }
    const entries: ObjectValue[] = [], seen = new Set<string>();
    definitions.set(kind, entries);
    for (const candidate of value) {
      const entry = object(candidate);
      if (!entry || !identifier(entry.id)) { issues.push('Invalid id in ' + kind); continue; }
      entries.push(entry);
      if (seen.has(entry.id)) issues.push('Duplicate ' + entry.id); seen.add(entry.id);
      if (!number(entry.version, 1) || !Number.isInteger(entry.version) || typeof entry.enabled !== 'boolean') issues.push(entry.id + ': version and enabled are required.');
      if (maps[kind][entry.id] && Number(entry.version) <= (maps[kind][entry.id].version ?? 0)) issues.push(entry.id + ': updates must increase the version.');
      if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 80) issues.push(entry.id + ': name must contain 1-80 characters.');
      if (!strings(entry.tags) || !entry.tags.every(identifier)) issues.push(entry.id + ': tags must be lowercase identifiers.');
      const stack: unknown[] = [entry]; let visited = 0;
      while (stack.length && visited++ < 1000) {
        const item = stack.pop();
        if (typeof item === 'string' && (item.length > 3000 || /[<>"`\x00-\x08]/.test(item))) issues.push(entry.id + ': text contains unsupported markup or control characters.');
        else if (item && typeof item === 'object') {
          if (Object.keys(item).some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) issues.push(entry.id + ': unsafe property name.');
          stack.push(...Object.values(item));
        }
      }
      if (stack.length) issues.push(entry.id + ': definition is too complex.');
    }
  }
  if (issues.length) return [...new Set(issues)];
  const has = (kind: ContentKind, id: unknown) => typeof id === 'string' && (definitions.get(kind)!.some(e => e.id === id) || Object.hasOwn(maps[kind], id));
  function effects(value: unknown, id: unknown) {
    if (!Array.isArray(value) || value.length > 12) { issues.push(id + ': use at most twelve effects.'); return; }
    for (const raw of value) {
      const e = object(raw);
      if (!e || typeof e.type !== 'string' || !['damage', 'status', 'shield', 'heal', 'cleanse', 'chain', 'spread', 'applyElement', 'summon', 'resurrect', 'explode', 'transform'].includes(e.type)) { issues.push(id + ': unsupported effect.'); continue; }
      if (e.status !== undefined && !has('statuses', e.status)) issues.push(id + ': unknown status.');
      if (e.element !== undefined && !has('elements', e.element)) issues.push(id + ': unknown applied element.');
      if (e.enemy !== undefined && !has('enemies', e.enemy)) issues.push(id + ': unknown summon.');
      if (e.recipient !== undefined && !['source', 'weakestAlly', 'target'].includes(String(e.recipient))) issues.push(id + ': unknown effect recipient.');
      for (const key of ['scale', 'duration', 'intensity', 'count', 'stacks']) if (e[key] !== undefined && !number(e[key], 0, 60)) issues.push(id + ': invalid effect ' + key);
      if (['damage', 'heal', 'shield', 'chain', 'explode', 'resurrect', 'summon'].includes(e.type) && !number(e.scale, 0, 60)) issues.push(id + ': scale is required.');
      if (['status', 'spread'].includes(e.type) && (!has('statuses', e.status) || !number(e.duration, 0, 60) || !number(e.intensity, 0, 60))) issues.push(id + ': status, duration and intensity are required.');
      if (['chain', 'spread', 'cleanse'].includes(e.type) && (!number(e.count, 1, 10) || !Number.isInteger(e.count))) issues.push(id + ': count must be an integer from 1 to 10.');
      if (['chain', 'applyElement', 'transform'].includes(e.type) && !has('elements', e.element)) issues.push(id + ': an element is required.');
      if (e.type === 'chain' && !has('statuses', e.status)) issues.push(id + ': a chain status is required.');
      if (e.type === 'summon' && !has('enemies', e.enemy)) issues.push(id + ': a summon enemy is required.');
    }
  }
  function modifiers(value: unknown, id: unknown) {
    const m = object(value);
    if (!m) { issues.push(id + ': invalid modifiers.'); return; }
    const numeric = ['startingShield', 'chainDepth', 'chainTargets', 'healingMultiplier', 'durationMultiplier', 'enemyRegeneration', 'discoveryKnowledge', 'researchDiscount', 'battleEssence', 'battleShards'];
    for (const [key, v] of Object.entries(m)) {
      if (numeric.includes(key)) { if (!number(v, 0, key === 'startingShield' ? 10000 : 20)) issues.push(id + ': invalid modifier ' + key); }
      else if (key === 'statusDuration' || key === 'tagPower') { const record = object(v); if (!record || Object.entries(record).some(([k, n]) => !identifier(k) || !number(n, 0, 60) || key === 'statusDuration' && !has('statuses', k))) issues.push(id + ': invalid modifier ' + key); }
      else if (key === 'disabledReactionTags') { if (!strings(v) || !v.every(identifier)) issues.push(id + ': invalid disabled tags.'); }
      else issues.push(id + ': unknown modifier ' + key);
    }
  }
  for (const kind of kinds) for (const e of definitions.get(kind)!) {
    if (kind === 'elements' || kind === 'reactions') {
      effects(e.effects, e.id);
      for (const key of ['description', 'icon', 'rarity']) if (typeof e[key] !== 'string') issues.push(e.id + ': missing ' + key);
      if (typeof e.color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(e.color)) issues.push(e.id + ': invalid color.');
    }
    if (kind === 'elements' && (!number(e.power, 0, 5) || !number(e.tier, 1, 100) || !Number.isInteger(e.tier) || typeof e.base !== 'boolean' || typeof e.role !== 'string' || typeof e.lore !== 'string' || typeof e.affinity !== 'string')) issues.push(e.id + ': invalid element metadata, power or tier.');
    if (kind === 'reactions') {
      if (e.id !== e.output) issues.push(e.id + ': reaction id must match its derived output element.');
      if (!strings(e.inputs) || e.inputs.length !== 2 || e.inputs.some(id => !has('elements', id)) || !has('elements', e.output)) issues.push(e.id + ': recipe inputs/output must reference defined elements.');
      if (!number(e.priority, 0) || !number(e.cooldown, 0, 90) || typeof e.hint !== 'string' || typeof e.category !== 'string' || e.trigger !== 'OnElementApplied') issues.push(e.id + ': priority, cooldown, hint, category and trigger are required.');
      if (e.conditions !== undefined) {
        const c = object(e.conditions);
        if (!c) issues.push(e.id + ': invalid conditions.');
        else for (const [key, v] of Object.entries(c)) {
          const valid = key === 'environment' ? typeof v === 'string' && Object.hasOwn(ENVIRONMENTS, v) : key === 'statuses' ? strings(v) && v.every(id => has('statuses', id)) : key === 'requiredTags' ? strings(v) && v.every(identifier) : key === 'mastery' ? object(v) && Object.entries(object(v)!).every(([id, n]) => has('elements', id) && number(n, 0, 10) && Number.isInteger(n)) : key === 'healthBelow' ? number(v, 0, 1) : key === 'minimumEnemies' ? number(v, 0, 10) && Number.isInteger(v) : key === 'shielded' ? typeof v === 'boolean' : false;
          if (!valid) issues.push(e.id + ': invalid condition ' + key);
        }
      }
    }
    if (kind === 'statuses') {
      if (!number(e.maxStacks, 1, 20) || !Number.isInteger(e.maxStacks) || typeof e.harmful !== 'boolean' || typeof e.short !== 'string') issues.push(e.id + ': invalid status limits.');
      for (const key of ['speedMultiplier', 'damageMultiplier', 'armorMultiplier', 'receivedMultiplier', 'lifesteal', 'reflect']) if (e[key] !== undefined && !number(e[key], -5, 5)) issues.push(e.id + ': invalid status modifier.');
      if (e.periodic !== undefined && e.periodic !== 'damage' && e.periodic !== 'heal') issues.push(e.id + ': invalid periodic effect.');
      for (const key of ['disables', 'suppressEffects', 'taunt']) if (e[key] !== undefined && typeof e[key] !== 'boolean') issues.push(e.id + ': invalid status flag.');
      if (e.elementalReceivedMultiplier !== undefined && (!object(e.elementalReceivedMultiplier) || Object.entries(object(e.elementalReceivedMultiplier)!).some(([id,n]) => !identifier(id) || !number(n,-5,5)))) issues.push(e.id + ': invalid elemental resistance.');
    }
    if (kind === 'enemies') {
      if (!['hp', 'attack', 'armor', 'interval'].every(k => number(e[k], k === 'armor' ? 0 : .01)) || !strings(e.elements) || e.elements.length !== 2 || e.elements.some(id => !has('elements', id)) || typeof e.shape !== 'string') issues.push(e.id + ': invalid enemy stats or loadout.');
      if (e.immunities !== undefined && (!strings(e.immunities) || e.immunities.some(id => !has('statuses', id)))) issues.push(e.id + ': invalid immunities.');
      if (e.weaknesses !== undefined) { if (!Array.isArray(e.weaknesses) || e.weaknesses.some(w => !object(w) || !has('statuses', w.status) || !number(w.armorMultiplier,0,5) || w.damageMultiplier !== undefined && !number(w.damageMultiplier,0,5))) issues.push(e.id + ': invalid weaknesses.'); }
      if (e.phases !== undefined) {
        if (!Array.isArray(e.phases) || e.phases.length > 10) issues.push(e.id + ': invalid phases.');
        else for (const raw of e.phases) { const phase = object(raw); if (!phase || !number(phase.below, 0, 1) || !number(phase.attackMultiplier, .1, 5) || !number(phase.intervalMultiplier, .1, 5) || typeof phase.label !== 'string') issues.push(e.id + ': invalid phase.'); else if (phase.effects !== undefined) effects(phase.effects, e.id); }
      }
    }
    if (kind === 'relics') { modifiers(e.modifiers, e.id); if (!number(e.discoveries) || !Number.isInteger(e.discoveries) || typeof e.description !== 'string') issues.push(e.id + ': invalid relic unlock.'); }
    if (kind === 'encounters') {
      if (!strings(e.enemies) || !e.enemies.length || e.enemies.length > 10 || e.enemies.some(id => !has('enemies', id)) || !['gold', 'knowledge', 'xp'].every(k => number(e[k])) || typeof e.environment !== 'string' || !Object.hasOwn(ENVIRONMENTS, e.environment) || e.scale !== undefined && !number(e.scale,.1,100)) issues.push(e.id + ': invalid encounter or rewards.');
      for (const key of ['region','label','description','tip']) if (typeof e[key] !== 'string') issues.push(e.id + ': missing ' + key);
      if (e.prerequisite !== undefined && !has('encounters', e.prerequisite)) issues.push(e.id + ': unknown prerequisite.');
      if (e.unlockElement !== undefined && e.unlockElement !== null && !has('elements', e.unlockElement)) issues.push(e.id + ': unknown unlock element.');
    }
  }
  return [...new Set(issues)];
}
export function installContentPack(input: unknown) {
  const issues = validatePack(input);
  if (issues.length) throw new Error(issues.join('\n'));
  const pack = input as ContentPack;
  const all = collections(), maps = indexes();
  function install<K extends ContentKind>(kind: K) {
    const list = all[kind] as ContentTypes[K][], index = maps[kind] as Record<string,ContentTypes[K]>;
    for (const definition of pack[kind] ?? []) {
      const entry = structuredClone(definition) as ContentTypes[K], old = list.findIndex(e => e.id === entry.id);
      if (old >= 0) list[old] = entry; else list.push(entry);
      index[entry.id] = entry;
    }
  }
  for (const kind of kinds) install(kind);
  setContentVersion(CONTENT_VERSION + '+' + pack.id + '.' + pack.version);
  rebuildReactionIndex();
  return { version: CONTENT_VERSION, added: kinds.reduce((n, k) => n + (pack[k]?.length ?? 0), 0) };
}
export function contentAudit() {
  const edges = new Map(ELEMENTS.map(e => [e.id, { inputs: 0, outputs: 0 }]));
  const concepts = new Map(), duplicateConcepts = [];
  for (const rule of REACTIONS) {
    for (const id of rule.inputs) if (edges.has(id)) edges.get(id)!.outputs++;
    if (edges.has(rule.output)) edges.get(rule.output)!.inputs++;
    const name = rule.name.toLowerCase().replace(/[^a-z]/g, '');
    if (concepts.has(name)) duplicateConcepts.push([concepts.get(name), rule.id]); else concepts.set(name, rule.id);
  }
  return { errors: validateContent(), duplicateConcepts, unused: [...edges].filter(([, n]) => n.inputs + n.outputs === 0).map(([id]) => id), deadEnds: [...edges].filter(([, n]) => n.outputs === 0).map(([id]) => id), highPower: REACTIONS.filter(r => r.effects.reduce((sum, e) => sum + ('scale' in e ? e.scale ?? 0 : 0) * ('count' in e ? e.count ?? 1 : 1), 0) > 3).map(r => r.id), missingCounterplay: ENEMIES.filter(e => e.tags.includes('boss') && !e.weaknesses?.length).map(e => e.id) };
}
export function proposeReaction(a: string, b: string) {
  const first = ELEMENT_BY_ID[a], second = ELEMENT_BY_ID[b];
  if (!first || !second) return null;
  const sharedTags = first.tags.filter(t => second.tags.includes(t));
  const vocabulary = [...new Set([...first.tags, ...second.tags])];
  return { inputs: [a, b], proposedName: first.name + 'bound ' + second.name, sharedTags, tags: vocabulary, existing: REACTIONS.filter(r => r.inputs.includes(a) && r.inputs.includes(b)).map(r => r.name), effects: [...first.effects, ...second.effects].slice(0, 4), designerApprovalRequired: true };
}
