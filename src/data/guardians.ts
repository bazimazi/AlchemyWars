import type { UnitDefinition, UnitBehavior } from '../types.js';

const infection = (intensity: number, count: number): UnitBehavior => ({ id: 'spore-bloom', name: 'Spore Bloom', trigger: 'OnAbilityCast', cooldown: 9, suppressedBy: ['burn', 'freeze'], description: 'Spreads poison after an elemental cast. Burn sterilizes the spores; freezing contains them.', effects: [{ type: 'spread', status: 'poison', duration: 4, intensity, count }] });
export const MOLTEN_KING: UnitDefinition = {
  id: 'molten-king', name: 'The Molten King', shape: 'king', hp: 850, attack: 43, armor: 38, interval: 2.4, elements: ['fire', 'magma'], tags: ['boss', 'heat'], immunities: ['burn'], weaknesses: [{ status: 'wet', armorMultiplier: .35 }],
  description: 'Water softens the crown. Wet or frozen conditions interrupt the final eruption; burn cannot harm him.',
  phases: [
    { below: .75, attackMultiplier: 1, intervalMultiplier: 1, label: 'The crown hardens', elements: ['fire', 'earth'] },
    { below: .5, attackMultiplier: 1.1, intervalMultiplier: .95, label: 'The core awakens', elements: ['magma', 'earth'], behaviors: [{ id: 'molten-plate', name: 'Molten Plate', trigger: 'OnAbilityCast', cooldown: 10, suppressedBy: ['wet', 'freeze'], description: 'Builds a shield after a cast unless cooled by water or ice.', effects: [{ type: 'shield', scale: .6, recipient: 'source' }] }] },
    { below: .25, attackMultiplier: 1.1, intervalMultiplier: .95, label: 'Volcanic eruption', elements: ['magma', 'fire'], modifiers: { statusDuration: { burn: 1 } }, behaviors: [{ id: 'eruption', name: 'Volcanic Eruption', trigger: 'OnAbilityCast', cooldown: 9, suppressedBy: ['wet', 'freeze'], description: 'Erupts across three opposing vessels. Water and ice contain the eruption.', effects: [{ type: 'explode', scale: .25, count: 3 }] }] },
  ],
};

export const GUARDIANS: UnitDefinition[] = [
  { id: 'plague-mother', name: 'The Plague Mother', shape: 'keeper', hp: 850, attack: 40, armor: 22, interval: 2.5, elements: ['toxic-growth', 'poison'], immunities: ['poison'], tags: ['boss', 'toxic'], description: 'Her spores spread poison through your formation. Burn or freeze suppresses Spore Bloom; light cleanses infection.', weaknesses: [{ status: 'burn', armorMultiplier: .3 }], behaviors: [infection(.06, 1)], phases: [
    { below: .6, attackMultiplier: 1.1, intervalMultiplier: .95, label: 'New roots take hold', elements: ['nature', 'poison'], effects: [{ type: 'summon', enemy: 'briarling', scale: .4 }] },
    { below: .3, attackMultiplier: 1.1, intervalMultiplier: .9, label: 'The garden hungers', elements: ['toxic-growth', 'poison'], immunities: ['poison', 'root'], behaviors: [infection(.08, 2)] },
  ] },
  { id: 'tide-empress', name: 'The Tide Empress', shape: 'sylph', hp: 800, attack: 42, armor: 28, interval: 2.2, elements: ['water', 'blizzard'], immunities: ['freeze'], tags: ['boss', 'water'], description: 'Conductivity weakens her armor. Her ice shell breaks in the middle phase; shock interrupts the rising undertow.', weaknesses: [{ status: 'conductive', armorMultiplier: .25 }], phases: [
    { below: .65, attackMultiplier: 1.1, intervalMultiplier: .95, label: 'The ice shell breaks', elements: ['ice', 'water'], immunities: [] },
    { below: .35, attackMultiplier: 1.15, intervalMultiplier: .85, label: 'The undertow rises', elements: ['blizzard', 'water'], immunities: ['freeze'], behaviors: [{ id: 'undertow', name: 'Undertow', trigger: 'OnAbilityCast', cooldown: 10, suppressedBy: ['shock'], description: 'Slows two vessels after a cast. Shock interrupts the undertow.', effects: [{ type: 'spread', status: 'slow', duration: 3, intensity: .15, count: 1 }] }] },
  ] },
  { id: 'tempest-titan', name: 'Tempest Titan', shape: 'golem', hp: 900, attack: 44, armor: 30, interval: 2.3, elements: ['thunderstorm', 'wind'], immunities: ['shock'], tags: ['boss', 'weather'], description: 'Roots ground his armor and interrupt Forked Lightning. His exposed final phase can be shocked.', weaknesses: [{ status: 'root', armorMultiplier: .2 }], phases: [
    { below: .6, attackMultiplier: 1.1, intervalMultiplier: .95, label: 'Eye of the storm', elements: ['earth', 'thunderstorm'] },
    { below: .3, attackMultiplier: 1.1, intervalMultiplier: .85, label: 'The storm breaks open', elements: ['thunderstorm', 'lightning'], immunities: [], modifiers: { chainTargets: 1 }, behaviors: [{ id: 'forked-lightning', name: 'Forked Lightning', trigger: 'OnAbilityCast', cooldown: 10, suppressedBy: ['root', 'freeze'], description: 'An extra arc seeks neighboring vessels. Roots or ice interrupt it.', effects: [{ type: 'chain', scale: .15, count: 1, status: 'shock', element: 'lightning' }] }] },
  ] },
  { id: 'eclipse-sovereign', name: 'Eclipse Sovereign', shape: 'king', hp: 950, attack: 45, armor: 32, interval: 2.5, elements: ['eclipse', 'void'], immunities: ['blind'], tags: ['boss', 'dark'], description: 'Resistance break exposes the old system and interrupts its silencing ward. The middle phase can be blinded.', weaknesses: [{ status: 'resistance-break', armorMultiplier: .2 }], phases: [
    { below: .65, attackMultiplier: 1.1, intervalMultiplier: .95, label: 'The mirror opens', elements: ['light', 'shadow'], immunities: [] },
    { below: .3, attackMultiplier: 1.15, intervalMultiplier: .85, label: 'The last light fades', elements: ['eclipse', 'void'], immunities: ['blind'], behaviors: [{ id: 'unraveling-ward', name: 'Unraveling Ward', trigger: 'OnAbilityCast', cooldown: 10, suppressedBy: ['resistance-break', 'freeze'], description: 'Briefly silences two vessels. Resistance break or ice interrupts it.', effects: [{ type: 'spread', status: 'silence', duration: 1, intensity: 1, count: 1 }] }] },
  ] },
];
