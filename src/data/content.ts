import { validateUnitMechanics } from './unit-rules.js';
import { MOLTEN_KING } from './guardians.js';
import { RESEARCH_UNLOCKS, RESEARCH_RECIPES } from './research.js';
import { MYTHIC_REACTIONS, CONTINUATIONS } from './continuations.js';
import type { ElementRow, Effect, ReactionDefinition, ReactionDraft, ElementDefinition, StatusDefinition, UnitDefinition, Relic, Research, Encounter } from '../types.js';
// Content is separate from the engine. Every effect is interpreted by a reusable primitive.
import { ADVANCED_ELEMENTS, EXTRA_REACTIONS, EXTRA_VESSELS, EXTRA_ENEMIES, EXTRA_BOSSES, CAMPAIGN_STAGES } from './expansion.js';
const meta = { version: 1, enabled: true, releaseDate: '2026-10-01' };
const status = (id: string, duration: number, intensity = 1, extra: { recipient?: Effect["recipient"]; stacks?: number } = {}): Effect => ({ type: 'status', status: id, duration, intensity, ...extra });
const damage = (scale: number, extra: { recipient?: Effect["recipient"]; stacks?: number } = {}): Effect => ({ type: 'damage', scale, ...extra });
const chain = (scale: number, count = 2): Effect => ({ type: 'chain', scale, count, status: 'shock', element: 'lightning' });

export let CONTENT_VERSION = '0.9.0';
export function setContentVersion(version: string) { CONTENT_VERSION = version; }
export const BALANCE = {
  step: 0.25, maxTime: 90, maxChainDepth: 4, maxEventsPerAction: 80,
  residueDuration: 7, reactionCooldown: 2.5, criticalChance: 0.08, criticalMultiplier: 1.5,
  armorDivisor: 80, minimumDamage: 1, damageVariance: 0.08,
  statusTick: 1, maxLogEvents: 1800, masteryThreshold: 30,
  discoveryXp: 20, repeatXp: 2, discoveryKnowledge: 5, battleMastery: 8,
  hintCost: 2, masteryPowerPerLevel: 0.015, masterySpreadLevel: 3,
  healthMultiplier: 3,
  masterySpreadScale: 0.2, xpPerLevel: 100,
};

const baseElements: ElementRow[] = [
  ['fire', 'Fire', '#f79462', 'flame', ['heat', 'burn', 'volatile'], 'Damage', 'A restless spark. Leaves a burn that lingers after the strike.', [status('burn', 5, 0.13)]],
  ['water', 'Water', '#75bffa', 'drop', ['water', 'wet', 'flow'], 'Support', 'Soaks enemies, preparing them for heat and electricity.', [status('wet', 6)]],
  ['earth', 'Earth', '#d2b37e', 'mountain', ['earth', 'armor', 'stable'], 'Defense', 'A patient force. Builds a protective barrier around its vessel.', [{ type: 'shield', scale: 0.6, recipient: 'source' }]],
  ['wind', 'Wind', '#9dd9cc', 'wind', ['air', 'spread', 'swift'], 'Speed', 'Air in motion. Quickens its vessel and scatters elemental forces.', [status('haste', 3, 0.2, { recipient: 'source' })]],
  ['lightning', 'Lightning', '#e6ce77', 'bolt', ['electricity', 'shock', 'chain'], 'Burst', 'A brilliant impulse. Disrupts attacks and seeks wet targets.', [status('shock', 3, 0.2)]],
  ['ice', 'Ice', '#a4e5ee', 'snow', ['cold', 'freeze', 'control'], 'Control', 'Stillness made solid. Briefly freezes an enemy in place.', [status('freeze', 0.75)]],
  ['nature', 'Nature', '#a3cd88', 'leaf', ['growth', 'root', 'life'], 'Healing', 'Life always finds a way. Restores the weakest allied vessel.', [{ type: 'heal', scale: 0.5, recipient: 'weakestAlly' }]],
  ['poison', 'Poison', '#b5a1df', 'venom', ['toxic', 'poison', 'decay'], 'Damage over time', 'Quiet, inevitable decay. Venom becomes stronger with each dose.', [status('poison', 6, 0.1)]],
  ['light', 'Light', '#eee4aa', 'sun', ['radiant', 'purify', 'shield'], 'Purification', 'A fragment of the first dawn. Clears harmful effects from an ally.', [{ type: 'cleanse', recipient: 'weakestAlly', count: 1 }, { type: 'heal', scale: 0.3, recipient: 'weakestAlly' }]],
  ['shadow', 'Shadow', '#bba6d7', 'moon', ['dark', 'drain', 'blind'], 'Drain', 'The space between stars. Draws life from an enemy.', [{ type: 'heal', scale: 0.25, recipient: 'source' }, status('blind', 3, 0.15)]],
];

export const REACTIONS: ReactionDefinition[] = ([
  { id: 'steam', name: 'Steam', inputs: ['fire', 'water'], category: 'Transformation', color: '#becfd9', icon: 'cloud', tags: ['vapor', 'wet'], hint: 'Heat gives water a new way to travel.', description: 'A veil of hot vapor wets and blinds the enemy.', effects: [damage(0.45), status('wet', 5), status('blind', 4, 0.25)] },
  { id: 'magma', name: 'Magma', inputs: ['fire', 'earth'], category: 'Transformation', color: '#ee8c62', icon: 'mountain', tags: ['heat', 'molten'], hint: 'Even stone remembers how to flow.', description: 'Molten rock burns through armor.', effects: [damage(0.65), status('armor-break', 5, 0.35), status('burn', 5, 0.15)] },
  { id: 'firestorm', name: 'Firestorm', inputs: ['fire', 'wind'], category: 'Environment', color: '#f8ae6f', icon: 'wind', tags: ['heat', 'spread'], hint: 'A flame grows hungry when the air moves.', description: 'A rushing inferno spreads burn to nearby enemies.', effects: [damage(0.45), { type: 'spread', status: 'burn', duration: 5, intensity: 0.12, count: 2 }] },
  { id: 'wildfire', name: 'Wildfire', inputs: ['fire', 'nature'], category: 'Enhancement', color: '#dfa77b', icon: 'flame', tags: ['heat', 'growth'], hint: 'The forest can feed more than its creatures.', description: 'Living fuel creates a fierce, stacking burn.', effects: [damage(0.35), status('burn', 7, 0.2, { stacks: 2 })] },
  { id: 'melt', name: 'Melt', inputs: ['fire', 'ice'], category: 'Transformation', color: '#e5c3b2', icon: 'drop', tags: ['heat', 'water'], hint: 'Two opposites meet at the edge of winter.', description: 'Shatters cold defenses and exposes the target.', effects: [damage(0.7), status('vulnerable', 5, 0.25)] },
  { id: 'toxic-flame', name: 'Toxic Flame', inputs: ['fire', 'poison'], category: 'Status', color: '#d7a39c', icon: 'venom', tags: ['toxic', 'heat'], hint: 'Some fires leave a more sinister smoke.', description: 'Venom and flame strike together over time.', effects: [status('burn', 6, 0.15), status('poison', 6, 0.12)] },
  { id: 'plasma', name: 'Plasma', inputs: ['fire', 'lightning'], category: 'Enhancement', rarity: 'Rare', color: '#ddacf0', icon: 'bolt', tags: ['heat', 'electricity'], hint: 'A spark of heat meets a spark from the sky.', description: 'Superheated energy bursts through defenses.', effects: [damage(1), status('shock', 3, 0.3)] },
  { id: 'conductive', name: 'Conductive', inputs: ['water', 'lightning'], category: 'Enhancement', color: '#92d8e3', icon: 'bolt', tags: ['wet', 'electricity'], hint: 'Electricity is always looking for a path.', description: 'Water conducts electricity to two more enemies.', effects: [status('conductive', 6, 0.2), chain(0.4)] },
  { id: 'blizzard', name: 'Blizzard', inputs: ['ice', 'wind'], category: 'Environment', color: '#c1e8e9', icon: 'snow', tags: ['cold', 'air'], hint: 'Winter takes flight.', description: 'Freezing winds slow the entire enemy line.', effects: [{ type: 'spread', status: 'slow', duration: 5, intensity: 0.3, count: 4 }, status('freeze', 1.5)] },
  { id: 'toxic-growth', name: 'Toxic Growth', inputs: ['poison', 'nature'], category: 'Status', color: '#b8c88f', icon: 'leaf', tags: ['growth', 'toxic'], hint: 'Not everything that grows gives life.', description: 'Venomous vines root a foe and infect nearby enemies.', effects: [status('root', 2), { type: 'spread', status: 'poison', duration: 6, intensity: 0.12, count: 2 }] },
  { id: 'frozen-venom', name: 'Frozen Venom', inputs: ['ice', 'poison'], category: 'Status', color: '#c5b9e0', icon: 'venom', tags: ['cold', 'toxic'], hint: 'Cold preserves even the most dangerous things.', description: 'Contained venom slows a target and stacks poison.', effects: [status('slow', 6, 0.25), status('poison', 8, 0.13, { stacks: 2 })] },
  { id: 'mud', name: 'Mud', inputs: ['water', 'earth'], category: 'Environment', color: '#bbae93', icon: 'mountain', tags: ['earth', 'water'], hint: 'Rain changes the ground beneath your feet.', description: 'Heavy ground slows enemies and weakens their armor.', effects: [status('slow', 5, 0.25), status('armor-break', 5, 0.2)] },
  { id: 'eclipse', name: 'Eclipse', inputs: ['light', 'shadow'], category: 'Behavior', rarity: 'Rare', color: '#d9c9e6', icon: 'moon', tags: ['radiant', 'dark'], hint: 'The brightest light has a hidden side.', description: 'Blinds an enemy while restoring an allied vessel.', effects: [damage(0.6), status('blind', 5, 0.3), { type: 'heal', scale: 0.75, recipient: 'weakestAlly' }] },
  { id: 'overgrowth', name: 'Overgrowth', inputs: ['nature', 'earth'], category: 'Behavior', color: '#afc98d', icon: 'leaf', tags: ['growth', 'earth'], hint: 'Roots seek a place to call home.', description: 'Ancient roots hold an enemy and regenerate an ally.', effects: [status('root', 2), status('regeneration', 6, 0.18, { recipient: 'weakestAlly' })] },
  { id: 'purify', name: 'Purify', inputs: ['light', 'poison'], category: 'Behavior', color: '#e8dfb0', icon: 'sun', tags: ['radiant', 'cleanse'], hint: 'Dawn can wash away the darkest corruption.', description: 'Cleanses two harmful effects and heals an ally.', effects: [{ type: 'cleanse', recipient: 'weakestAlly', count: 2 }, { type: 'heal', scale: 0.8, recipient: 'weakestAlly' }] },
  { id: 'frost-armor', name: 'Frost Armor', inputs: ['ice', 'earth'], category: 'Enhancement', color: '#b9d7d7', icon: 'shield', tags: ['cold', 'armor'], hint: 'Winter builds a fortress from the mountain.', description: 'Encases the weakest ally in a resilient shield.', effects: [{ type: 'shield', scale: 1.7, recipient: 'weakestAlly' }] },
  { id: 'storm-cloud', name: 'Storm Cloud', inputs: ['steam', 'wind'], category: 'Transformation', rarity: 'Uncommon', color: '#a9bdde', icon: 'cloud', tags: ['vapor', 'weather'], hint: 'Let rising vapor ride the wind.', description: 'A gathering cloud wets the entire enemy formation.', effects: [{ type: 'spread', status: 'wet', duration: 7, intensity: 1, count: 4 }] },
  { id: 'thunderstorm', name: 'Thunderstorm', inputs: ['storm-cloud', 'lightning'], category: 'Environment', rarity: 'Rare', color: '#b7b5f1', icon: 'bolt', tags: ['weather', 'chain'], hint: 'A cloud waits for the sky to speak.', description: 'Lightning leaps between three enemies and disrupts them.', effects: [damage(0.55), chain(0.6, 3)] },
  { id: 'thermal-shock', name: 'Thermal Shock', inputs: ['fire', 'water'], category: 'Conditional', rarity: 'Rare', color: '#e9bdb0', icon: 'burst', tags: ['heat', 'cold'], conditions: { statuses: ['freeze'] }, priority: 10, hint: 'What happens when a frozen foe meets sudden heat?', description: 'When the target is frozen, sudden heat shatters it for heavy damage.', effects: [damage(1.5), status('vulnerable', 5, 0.35)] },
  { id: 'storm-surge', name: 'Storm Surge', inputs: ['lightning', 'water'], category: 'Conditional', rarity: 'Rare', color: '#abcaee', icon: 'bolt', tags: ['weather', 'electricity'], conditions: { environment: 'rain' }, priority: 10, hint: 'Rain gives a wandering spark a thousand paths.', description: 'During rain, electricity reaches three additional enemies.', effects: [damage(0.3), chain(0.65, 3)] },
  ...EXTRA_REACTIONS, ...MYTHIC_REACTIONS,
] satisfies ReactionDraft[]).map(r => ({ ...meta, output: r.id, rarity: 'Common', priority: 0, cooldown: BALANCE.reactionCooldown, trigger: 'OnElementApplied', ...r }));

export const ELEMENTS: ElementDefinition[] = [
  ...ADVANCED_ELEMENTS.map(([id, name, color, icon, tags, role, description, effects], i) => ({ ...meta, id, name, color, icon, tags, role, description, lore: description, rarity: 'Rare', tier: 2, affinity: id, power: 1, effects, base: true, unlockResearch: 'element-' + id })),
  ...baseElements.map(([id, name, color, icon, tags, role, description, effects]) => ({ ...meta, id, name, color, icon, tags, role, description, lore: `One of the ten fragments left by the Great Sundering. ${description}`, rarity: 'Common', tier: 1, affinity: id, power: 1, effects, base: true })),
  ...REACTIONS.map(r => ({ ...meta, id: r.output, name: r.name, color: r.color, icon: r.icon, tags: r.tags, role: r.category, description: r.description, lore: `A relationship between ${r.inputs.map(id => baseElements.find(e => e[0] === id)?.[1] ?? id.replaceAll('-', ' ')).join(' and ')}. ${r.description}`, rarity: r.rarity, tier: r.inputs.some(id => !baseElements.some(e => e[0] === id)) ? 3 : 2, affinity: r.inputs[0], power: 0.85, effects: r.effects, base: false })),
];
export const ELEMENT_BY_ID: Record<string, ElementDefinition> = Object.assign(Object.create(null), Object.fromEntries(ELEMENTS.map(e => [e.id, e])));
// Continuations reuse existing elemental identities while retaining unique recipe IDs.
for (const [id, a, b, output, hint] of CONTINUATIONS) {
  const element = ELEMENT_BY_ID[output];
  REACTIONS.push({ ...meta, id, name: element.name + ' (' + id.replaceAll('-', ' ') + ')', inputs: [a, b], output, category: 'Continuation', color: element.color, icon: element.icon, tags: [...element.tags], hint, description: hint, rarity: 'Rare', priority: 0, cooldown: BALANCE.reactionCooldown, trigger: 'OnElementApplied', effects: structuredClone(element.effects) });
}
REACTIONS.push(...RESEARCH_RECIPES.map(r => ({ ...meta, output: r.id, rarity: 'Rare', priority: 12, cooldown: BALANCE.reactionCooldown, trigger: 'OnElementApplied', ...r })));
export const REACTION_BY_ID: Record<string, ReactionDefinition> = Object.assign(Object.create(null), Object.fromEntries(REACTIONS.map(r => [r.id, r])));

export const STATUSES: Record<string, StatusDefinition> = Object.fromEntries(([
  ['burn', 'Burn', 'BRN', { harmful: true, maxStacks: 3, periodic: 'damage' }],
  ['poison', 'Poison', 'PSN', { harmful: true, maxStacks: 4, periodic: 'damage' }],
  ['wet', 'Wet', 'WET', { harmful: true, maxStacks: 1 }],
  ['freeze', 'Frozen', 'FRZ', { harmful: true, maxStacks: 1, disables: true }],
  ['shock', 'Shock', 'SHK', { harmful: true, maxStacks: 1, speedMultiplier: -1 }],
  ['root', 'Rooted', 'ROOT', { harmful: true, maxStacks: 1, speedMultiplier: -0.5 }],
  ['slow', 'Slow', 'SLW', { harmful: true, maxStacks: 1, speedMultiplier: -1 }],
  ['haste', 'Haste', 'HST', { harmful: false, maxStacks: 1, speedMultiplier: 1 }],
  ['blind', 'Blind', 'BLND', { harmful: true, maxStacks: 1, damageMultiplier: -1 }],
  ['armor-break', 'Armor break', 'BRK', { harmful: true, maxStacks: 1, armorMultiplier: -1 }],
  ['vulnerable', 'Vulnerable', 'VULN', { harmful: true, maxStacks: 1, receivedMultiplier: 1 }],
  ['conductive', 'Conductive', 'COND', { harmful: true, maxStacks: 1, elementalReceivedMultiplier: { electricity: 1 } }],
  ['regeneration', 'Regeneration', 'REG', { harmful: false, maxStacks: 1, periodic: 'heal' }],
  ['bleed', 'Bleed', 'BLD', { harmful: true, maxStacks: 3, periodic: 'damage' }],
  ['silence', 'Silence', 'SIL', { harmful: true, maxStacks: 1, suppressEffects: true }],
  ['barrier', 'Barrier', 'BAR', { harmful: false, maxStacks: 1, receivedMultiplier: -1 }],
  ['resistance-break', 'Resistance break', 'RES', { harmful: true, maxStacks: 1, receivedMultiplier: 1 }],
  ['drain', 'Drain', 'DRN', { harmful: false, maxStacks: 1, lifesteal: 1 }],
  ['reflect', 'Reflect', 'RFL', { harmful: false, maxStacks: 1, reflect: 1 }],
  ['taunt', 'Taunt', 'TNT', { harmful: false, maxStacks: 1, taunt: true }],
] satisfies [string, string, string, Omit<StatusDefinition, 'id' | 'name' | 'short'>][]).map(([id, name, short, properties]) => [id, { ...meta, id, name, short, ...properties }]));

export const VESSELS: UnitDefinition[] = [
  { id: 'golem', name: 'Stone Warden', role: 'Guardian', shape: 'golem', hp: 340, attack: 24, armor: 24, interval: 2.6, elements: ['earth', 'ice'] },
  { id: 'sprite', name: 'Ember Sprite', role: 'Striker', shape: 'sprite', hp: 225, attack: 34, armor: 8, interval: 2.1, elements: ['fire', 'wind'] },
  { id: 'sylph', name: 'Tide Sylph', role: 'Weaver', shape: 'sylph', hp: 245, attack: 27, armor: 12, interval: 1.9, elements: ['water', 'lightning'] },
  { id: 'keeper', name: 'Grove Keeper', role: 'Mender', shape: 'keeper', hp: 255, attack: 25, armor: 14, interval: 2.3, elements: ['nature', 'light'] },
  { id: 'wraith', name: 'Dusk Wraith', role: 'Invoker', shape: 'wraith', hp: 225, attack: 32, armor: 10, interval: 2.2, elements: ['shadow', 'poison'] },
  ...EXTRA_VESSELS,
].map(v => ({ ...meta, tags: [v.role!.toLowerCase()], ...v }));
export const VESSEL_BY_ID: Record<string, UnitDefinition> = Object.assign(Object.create(null), Object.fromEntries(VESSELS.map(v => [v.id, v])));
export const ENEMIES: UnitDefinition[] = [
  { id: 'slime', name: 'Moss Slime', shape: 'slime', hp: 190, attack: 21, armor: 8, interval: 2.5, elements: ['nature', 'water'], tags: ['growth'] },
  { id: 'imp', name: 'Cinder Imp', shape: 'sprite', hp: 175, attack: 25, armor: 6, interval: 2.3, elements: ['fire', 'wind'], tags: ['heat'] },
  { id: 'sentinel', name: 'Ruin Sentinel', shape: 'golem', hp: 245, attack: 20, armor: 20, interval: 2.7, elements: ['earth', 'ice'], tags: ['armor'] },
  MOLTEN_KING,
  ...EXTRA_ENEMIES, ...EXTRA_BOSSES,
  { id: 'ashling', name: 'Ashling', shape: 'sprite', hp: 210, attack: 25, armor: 11, interval: 2.4, elements: ['fire', 'spirit'], tags: ['heat'] },
].map(e => ({ ...meta, ...e }));
export const ENEMY_BY_ID: Record<string, UnitDefinition> = Object.assign(Object.create(null), Object.fromEntries(ENEMIES.map(e => [e.id, e])));

const relicDefinitions: Relic[] = [
  { id: 'none', name: 'No relic', rarity: 'Common', description: 'An open relic slot.', tags: [], modifiers: {} },
  { id: 'dew-glass', name: 'Dew Glass', rarity: 'Common', description: 'Wet persists for 1 extra second, giving elemental partners more time.', tags: ['water'], discoveries: 1, modifiers: { statusDuration: { wet: 1 } } },
  { id: 'flame-crown', name: 'Flame Crown', rarity: 'Uncommon', description: 'Burn lasts 2 seconds longer.', tags: ['heat'], discoveries: 2, modifiers: { statusDuration: { burn: 2 } } },
  { id: 'storm-core', name: 'Storm Core', rarity: 'Rare', description: 'Chain effects reach one extra target.', tags: ['electricity'], discoveries: 4, modifiers: { chainTargets: 1 } },
  { id: 'world-seed', name: 'World Seed', rarity: 'Epic', description: 'All healing is 25% stronger.', tags: ['growth'], discoveries: 6, modifiers: { healingMultiplier: 1.25 } },
  { id: 'eclipse-mirror', name: 'Eclipse Mirror', rarity: 'Legendary', description: 'Shadow strikes are 15% stronger. A focused artifact for an eclipse formation.', tags: ['dark'], discoveries: 20, modifiers: { tagPower: { dark: 1.15 } } },
  { id: 'genesis-thread', name: 'Genesis Thread', rarity: 'Mythic', description: 'Chains can travel one level deeper. A tool for elaborate reaction paths rather than stronger individual strikes.', tags: ['chain'], discoveries: 50, modifiers: { chainDepth: 1 } },
];
export const RELICS = relicDefinitions.map(r => ({ ...meta, ...r }));
export const RELIC_BY_ID: Record<string, Relic> = Object.assign(Object.create(null), Object.fromEntries(RELICS.map(r => [r.id, r])));
export const RESEARCH: Research[] = [
  { ...meta, id: 'resonance', branch: 'Reaction Science', name: 'Chain Resonance', icon: 'bolt', cost: 15, description: 'Reaction chains can travel one level deeper.', modifiers: { chainDepth: 1 } },
  { ...meta, id: 'warding', branch: 'Combat Science', name: 'Protective Binding', icon: 'shield', cost: 15, description: 'Every vessel enters battle with a 30-point shield.', modifiers: { startingShield: 30 } },
  { ...meta, id: 'cultivation', branch: 'Alchemy', name: 'Living Alchemy', icon: 'leaf', cost: 20, description: 'Regeneration lasts 3 seconds longer.', modifiers: { statusDuration: { regeneration: 3 } } },
  ...ADVANCED_ELEMENTS.map(([id, name, , icon], i) => ({ ...meta, id: 'element-' + id, branch: 'Elemental Science' as const, name: name + ' Theory', icon, cost: 15 + i * 3, description: 'Unlock ' + name + ' for experimentation and combat.', unlockElement: id, modifiers: {}, requires: i > 4 ? ['element-' + ADVANCED_ELEMENTS[i - 5][0]] : [] })),
  ...RESEARCH_UNLOCKS.map(r => ({ ...meta, ...r })),
];
export const ENCOUNTERS: Encounter[] = [
  { ...meta, id: 'whispering-grove', name: 'Whispering Grove', region: 'The First Flame', label: '01', environment: 'forest', description: 'Something stirs beneath the roots of the old observatory.', tip: 'Watch how the Tide Sylph combines water and lightning.', enemies: ['slime', 'slime', 'sentinel', 'imp', 'slime'], gold: 30, knowledge: 4, xp: 30 },
  { ...meta, id: 'drowned-ruins', name: 'The Drowned Ruins', region: 'The Drowned Kingdom', label: '02', environment: 'rain', description: 'Rain awakens the forgotten machines of a sunken kingdom.', tip: 'Rain changes the relationship between water and lightning.', enemies: ['sentinel', 'slime', 'sentinel', 'imp', 'slime'], scale: 1.15, gold: 45, knowledge: 6, xp: 45 },
  { ...meta, id: 'molten-throne', name: 'The Molten Throne', region: 'The First Flame', label: '03', environment: 'volcanic', boss: true, description: 'A king of living stone guards a fragment of the ancient system.', tip: 'Burn cannot harm the king. Water softens his armor; lightning exploits the opening.', enemies: ['molten-king', 'imp', 'imp'], gold: 90, knowledge: 12, xp: 80 },
  ...CAMPAIGN_STAGES.map(e => ({ ...meta, ...e })),
];
export const ENCOUNTER_BY_ID: Record<string, Encounter> = Object.assign(Object.create(null), Object.fromEntries(ENCOUNTERS.map(e => [e.id, e])));

export function validateContent() {
  const issues = [];
  for (const collection of [ELEMENTS, REACTIONS, VESSELS, ENEMIES, RELICS, RESEARCH, ENCOUNTERS]) {
    const seen = new Set();
    for (const entry of collection) {
      if (seen.has(entry.id)) issues.push(`Duplicate id: ${entry.id}`);
      seen.add(entry.id);
      if (!entry.version || typeof entry.enabled !== 'boolean') issues.push(`Missing version metadata: ${entry.id}`);
    }
  }
  const effectTypes = new Set(['damage', 'status', 'shield', 'heal', 'cleanse', 'chain', 'spread', 'applyElement', 'summon', 'resurrect', 'explode', 'transform']);
  for (const entry of [...ELEMENTS, ...REACTIONS]) {
    if (('inputs' in entry && entry.inputs.some(id => !ELEMENT_BY_ID[id])) || ('output' in entry && !ELEMENT_BY_ID[entry.output])) issues.push(`Unknown element in ${entry.id}`);
    if ('conditions' in entry && entry.conditions?.statuses?.some(id => !STATUSES[id])) issues.push(`Unknown condition in ${entry.id}`);
    if ('conditions' in entry && entry.conditions?.research?.some(id => !RESEARCH.some(r => r.id === id))) issues.push(`Unknown research condition in ${entry.id}`);
    for (const effect of entry.effects) {
      if (!effectTypes.has(effect.type)) issues.push(`Unknown effect ${effect.type} in ${entry.id}`);
      if ('status' in effect && !STATUSES[effect.status]) issues.push(`Unknown status in ${entry.id}`);
    }
  }
  for (const unit of [...VESSELS, ...ENEMIES]) {
    if (unit.elements.some(id => !ELEMENT_BY_ID[id])) issues.push(`Unknown loadout in ${unit.id}`);
    issues.push(...validateUnitMechanics(unit, { element: id => typeof id === 'string' && Boolean(ELEMENT_BY_ID[id]), status: id => typeof id === 'string' && Object.hasOwn(STATUSES, id),
      effects: value => {
        if (!Array.isArray(value) || value.length > 12) { issues.push(`Invalid mechanics effects in ${unit.id}`); return; }
        for (const e of value as Effect[]) if (!effectTypes.has(e.type) || 'status' in e && !STATUSES[e.status] || 'element' in e && !ELEMENT_BY_ID[e.element] || 'enemy' in e && !ENEMY_BY_ID[e.enemy]) issues.push(`Unknown mechanics effect in ${unit.id}`);
      }, modifiers: value => { if (!value || typeof value !== 'object' || Array.isArray(value)) issues.push(`Invalid phase modifiers in ${unit.id}`); },
    }).map(issue => `${unit.id}: ${issue}`));
  }
  for (const encounter of ENCOUNTERS) if (encounter.enemies.some(id => !ENEMY_BY_ID[id])) issues.push(`Unknown enemy in ${encounter.id}`);
  for (const r of RESEARCH) {
    if (r.requires?.some(id => !RESEARCH.some(node => node.id === id)) || r.unlockElement && !ELEMENT_BY_ID[r.unlockElement]) issues.push(`Invalid research unlock in ${r.id}`);
    if (r.abilitySlots !== undefined && r.abilitySlots !== 3) issues.push(`Invalid ability slot unlock in ${r.id}`);
    const visit = (id: string, path: string[]): boolean => path.includes(id) || Boolean(RESEARCH.find(node => node.id === id)?.requires?.some(next => visit(next, [...path, id])));
    if (visit(r.id, [])) issues.push(`Research prerequisite cycle in ${r.id}`);
  }
  return issues;
}
