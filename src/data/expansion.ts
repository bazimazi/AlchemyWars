import { GUARDIANS } from './guardians.js';
import type { Effect, ElementRow, ReactionDraft, UnitDefinition, Encounter } from '../types.js';
import { CHAPTER_MEMORIES } from './story.js';
// Authored relationships and encounters. No executable gameplay logic lives in this file.
const s = (status: string, duration: number, intensity = 1, extra: { recipient?: Effect["recipient"]; stacks?: number } = {}): Effect => ({ type: 'status', status, duration, intensity, ...extra });
const d = (scale: number): Effect => ({ type: 'damage', scale });
const h = (scale: number): Effect => ({ type: 'heal', scale, recipient: 'weakestAlly' });
const c = (scale: number, count: number): Effect => ({ type: 'chain', scale, count, status: 'shock', element: 'lightning' });
const spread = (status: string, intensity: number, count = 2): Effect => ({ type: 'spread', status, intensity, duration: 6, count });

export const ADVANCED_ELEMENTS: ElementRow[] = [
  ['metal', 'Metal', '#c4cbd0', 'shield', ['metal', 'armor', 'conductive'], 'Defense', 'Living iron turns enemy force back on its source.', [s('reflect', 4, .18, { recipient: 'source' })]],
  ['arcane', 'Arcane', '#d5a1ee', 'burst', ['arcane', 'silence', 'magic'], 'Disruption', 'Unwritten laws silence the spells of others.', [s('silence', 1)]],
  ['crystal', 'Crystal', '#a9e7e1', 'burst', ['crystal', 'reflect', 'light'], 'Barrier', 'A lattice of light absorbs damage for an ally.', [s('barrier', 5, .25, { recipient: 'weakestAlly' })]],
  ['spirit', 'Spirit', '#d6e3b4', 'moon', ['spirit', 'life', 'heal'], 'Healing', 'Memory gives the living strength to continue.', [s('regeneration', 5, .16, { recipient: 'weakestAlly' })]],
  ['blood', 'Blood', '#d8878b', 'drop', ['blood', 'bleed', 'life'], 'Attrition', 'A bond of vitality opens wounds that resist armor.', [s('bleed', 5, .14)]],
  ['void', 'Void', '#a299c9', 'moon', ['void', 'resistance', 'dark'], 'Disruption', 'The absence between fragments erodes elemental resistance.', [s('resistance-break', 5, .18)]],
  ['time', 'Time', '#c8cc94', 'sun', ['time', 'haste', 'control'], 'Tempo', 'A borrowed second hastens the weakest ally.', [s('haste', 5, .3, { recipient: 'weakestAlly' })]],
  ['gravity', 'Gravity', '#adb4dc', 'graph', ['gravity', 'position', 'control'], 'Positioning', 'An unseen pull forces enemies to confront this vessel.', [s('taunt', 4, 1, { recipient: 'source' })]],
  ['cosmic', 'Cosmic', '#b5c4f0', 'star', ['cosmic', 'radiant', 'burst'], 'Burst', 'A fragment of the night sky reveals enemy weakness.', [s('vulnerable', 4, .18)]],
  ['chaos', 'Chaos', '#e7a8bd', 'burst', ['chaos', 'volatile', 'spread'], 'Disruption', 'Unstable potential scatters vulnerability through the enemy line.', [spread('vulnerable', .1, 1)]],
];

const rows: [string,string,string,string,string,Effect[],string[]][] = [
  ['chain-lightning', 'Chain Lightning', 'conductive', 'lightning', 'A path prepared becomes a storm unleashed.', [c(.7, 3)], ['electricity', 'chain']],
  ['living-storm', 'Living Storm', 'thunderstorm', 'nature', 'A storm takes root and learns to heal.', [c(.45, 2), h(.8)], ['weather', 'growth']],
  ['volcano', 'Volcano', 'magma', 'earth', 'Deep earth gives molten stone somewhere to rise.', [d(.9), spread('burn', .2)], ['heat', 'earth']],
  ['obsidian', 'Obsidian', 'magma', 'water', 'A sudden cooling leaves a sharper answer.', [s('bleed', 7, .2), { type: 'shield', scale: .7, recipient: 'source' }], ['earth', 'bleed']],
  ['glacial-tomb', 'Glacial Tomb', 'frost-armor', 'shadow', 'A frozen fortress becomes a prison without light.', [s('freeze', 2), s('drain', 6, .2, { recipient: 'source' })], ['cold', 'dark']],
  ['mirror', 'Mirror', 'crystal', 'light', 'Light learns to look back at its source.', [s('reflect', 6, .35, { recipient: 'weakestAlly' })], ['reflect', 'radiant']],
  ['magnetic-field', 'Magnetic Field', 'lightning', 'metal', 'A spark teaches iron to pull.', [s('taunt', 6, 1, { recipient: 'source' }), spread('slow', .25)], ['electricity', 'position']],
  ['rust', 'Rust', 'water', 'metal', 'Even the strongest iron yields to patient water.', [s('armor-break', 8, .5), s('vulnerable', 5, .15)], ['water', 'decay']],
  ['forge', 'Forge', 'metal', 'fire', 'The furnace gives iron a new purpose.', [{ type: 'shield', scale: 1.4, recipient: 'source' }, s('burn', 5, .2)], ['metal', 'heat']],
  ['razor-wind', 'Razor Wind', 'wind', 'metal', 'Air carries a thousand tiny blades.', [spread('bleed', .17), s('haste', 4, .25, { recipient: 'source' })], ['air', 'bleed']],
  ['venom-steel', 'Venom Steel', 'metal', 'poison', 'A forged edge holds a hidden sting.', [s('bleed', 6, .16), s('poison', 7, .14, { stacks: 2 })], ['metal', 'toxic']],
  ['clockwork', 'Clockwork', 'earth', 'metal', 'Stone and iron remember the rhythm of the old world.', [s('haste', 7, .3, { recipient: 'weakestAlly' }), { type: 'shield', scale: .8, recipient: 'weakestAlly' }], ['earth', 'haste']],
  ['mana-spring', 'Mana Spring', 'arcane', 'light', 'The first dawn is a source of forgotten power.', [h(1), s('haste', 4, .2, { recipient: 'weakestAlly' })], ['arcane', 'life']],
  ['dispel', 'Dispel', 'arcane', 'shadow', 'Every spell has a place where it can be unmade.', [s('silence', 2), s('resistance-break', 6, .3)], ['arcane', 'dark']],
  ['rift', 'Rift', 'arcane', 'void', 'An unwritten law opens a door to nowhere.', [d(1.2), s('resistance-break', 6, .25)], ['void', 'arcane']],
  ['supernova', 'Supernova', 'cosmic', 'fire', 'A star spends its last breath in flame.', [d(1.3), spread('burn', .18, 3)], ['cosmic', 'heat']],
  ['starlight', 'Starlight', 'cosmic', 'light', 'A distant dawn travels farther than any shadow.', [h(.6), spread('blind', .25)], ['cosmic', 'radiant']],
  ['black-hole', 'Black Hole', 'gravity', 'void', 'An absence so heavy that even light falls inward.', [spread('slow', .4, 4), s('drain', 6, .35, { recipient: 'source' })], ['gravity', 'void']],
  ['orbit', 'Orbit', 'gravity', 'earth', 'A falling stone learns never to land.', [s('barrier', 7, .3, { recipient: 'source' }), s('taunt', 5, 1, { recipient: 'source' })], ['gravity', 'armor']],
  ['meteor', 'Meteor', 'cosmic', 'earth', 'A stone carries the heat of the heavens.', [d(1), spread('armor-break', .25)], ['cosmic', 'earth']],
  ['time-stop', 'Time Stop', 'time', 'ice', 'Stillness can freeze more than water.', [s('freeze', 2.5), s('silence', 3)], ['time', 'cold']],
  ['acceleration', 'Acceleration', 'time', 'wind', 'The wind steals a second from tomorrow.', [s('haste', 8, .5, { recipient: 'source' })], ['time', 'air']],
  ['entropy', 'Entropy', 'time', 'poison', 'Decay waits for nothing when time is on its side.', [s('poison', 9, .16, { stacks: 3 }), s('resistance-break', 5, .2)], ['time', 'toxic']],
  ['bloodbloom', 'Bloodbloom', 'blood', 'nature', 'A crimson garden returns what it takes.', [h(.7), s('regeneration', 6, .2, { recipient: 'weakestAlly' }), s('bleed', 5, .1)], ['blood', 'growth']],
  ['hemotoxin', 'Hemotoxin', 'blood', 'poison', 'Venom finds a living river to follow.', [s('bleed', 7, .18), spread('poison', .14)], ['blood', 'toxic']],
  ['leech', 'Leech', 'blood', 'shadow', 'A shadow drinks from the river of life.', [s('drain', 8, .45, { recipient: 'source' }), d(.45)], ['blood', 'drain']],
  ['phoenix', 'Phoenix', 'fire', 'spirit', 'A memory survives the flame that consumed it.', [{ type: 'resurrect', scale: .25 }, h(1), s('regeneration', 8, .25, { recipient: 'weakestAlly' })], ['heat', 'spirit']],
  ['ancestral-ward', 'Ancestral Ward', 'earth', 'spirit', 'The land remembers those who protected it.', [{ type: 'shield', scale: 2, recipient: 'weakestAlly' }, s('taunt', 4, 1, { recipient: 'source' })], ['earth', 'spirit']],
  ['soulstorm', 'Soulstorm', 'spirit', 'lightning', 'Ancient voices ride the thunder.', [c(.6, 3), s('silence', 1.5)], ['spirit', 'electricity']],
  ['prism', 'Prism', 'crystal', 'water', 'A drop of water reveals the hidden colors in a stone.', [s('barrier', 6, .35, { recipient: 'weakestAlly' }), h(.5)], ['crystal', 'water']],
  ['shatter', 'Shatter', 'crystal', 'wind', 'The gentlest breath finds the fault in a crystal.', [spread('bleed', .2, 3), s('armor-break', 5, .3)], ['crystal', 'air']],
  ['singularity', 'Singularity', 'eclipse', 'gravity', 'Day and night collapse into one impossible point.', [d(1.4), spread('slow', .35, 3)], ['gravity', 'dark']],
  ['pandemonium', 'Pandemonium', 'chaos', 'wind', 'Uncertainty travels faster than the wind.', [spread('silence', 1, 2), spread('vulnerable', .2)], ['chaos', 'air']],
  ['wild-magic', 'Wild Magic', 'chaos', 'arcane', 'A law without a boundary becomes possibility.', [d(.8), spread('resistance-break', .3)], ['chaos', 'arcane']],
  ['star-forge', 'Star Forge', 'forge', 'cosmic', 'The stars were the first smiths.', [{ type: 'shield', scale: 2, recipient: 'source' }, d(.8)], ['cosmic', 'metal']],
  ['world-tree', 'World Tree', 'overgrowth', 'spirit', 'The oldest roots remember every life.', [h(1), s('regeneration', 9, .3, { recipient: 'weakestAlly' })], ['growth', 'spirit']],
  ['aurora', 'Aurora', 'ice', 'light', 'Dawn dances across a winter sky.', [spread('blind', .2), h(.7)], ['cold', 'radiant']],
  ['sandstorm', 'Sandstorm', 'earth', 'wind', 'The mountain takes flight one grain at a time.', [spread('blind', .25), spread('armor-break', .15)], ['earth', 'air']],
  ['nightshade', 'Nightshade', 'nature', 'shadow', 'Some gardens bloom only after sunset.', [s('poison', 7, .16), s('drain', 5, .25, { recipient: 'source' })], ['growth', 'dark']],
  ['steam-engine', 'Steam Engine', 'steam', 'metal', 'A captured cloud can move a mountain.', [s('haste', 7, .35, { recipient: 'source' }), { type: 'shield', scale: 1, recipient: 'source' }], ['vapor', 'metal']],
];
export const EXTRA_REACTIONS: ReactionDraft[] = rows.map(([id, name, a, b, hint, effects, tags], i) => ({ id, name, inputs: [a, b], hint, description: hint, effects, tags, category: i % 3 === 0 ? 'Transformation' : i % 3 === 1 ? 'Enhancement' : 'Behavior', color: ['#bbc8e8', '#b8d6a1', '#e0bd94', '#c6b0dc'][i % 4], icon: ['bolt', 'leaf', 'shield', 'burst'][i % 4], rarity: i > 30 ? 'Epic' : 'Rare', secret: ['singularity', 'world-tree', 'star-forge'].includes(id) }));
EXTRA_REACTIONS.push(
  { id: 'inferno', name: 'Inferno', inputs: ['fire', 'firestorm'], conditions: { mastery: { fire: 10 } }, priority: 20, category: 'Mastery', color: '#f2ac71', icon: 'flame', rarity: 'Legendary', tags: ['heat', 'spread'], hint: 'A master of flame can teach a firestorm to burn beyond its boundaries.', description: 'At Fire mastery 10, the storm becomes an inferno that strikes the entire enemy line.', effects: [{ type: 'explode', scale: .7, count: 5 }, spread('burn', .15, 4)], secret: true },
  { id: 'ionization', name: 'Ionization', inputs: ['lightning', 'metal'], conditions: { environment: 'storm' }, priority: 20, category: 'Seasonal', color: '#afc7ed', icon: 'bolt', rarity: 'Epic', tags: ['electricity', 'metal'], hint: 'A storm asks iron a question that a quiet spark cannot.', description: 'Storm-charged metal breaks resistance and carries electricity onward.', effects: [s('resistance-break', 5, .25), c(.5, 2)], season: 'Age of Storms' },
  { id: 'celestial-bloom', name: 'Celestial Bloom', inputs: ['cosmic', 'nature'], conditions: { environment: 'holy' }, priority: 20, category: 'Seasonal', color: '#e3d8aa', icon: 'star', rarity: 'Legendary', tags: ['cosmic', 'growth'], hint: 'A seed and a distant star share a moment on holy ground.', description: 'A celestial flower restores a fallen ally and shelters the living.', effects: [{ type: 'resurrect', scale: .2 }, { type: 'shield', scale: 1.5, recipient: 'weakestAlly' }], season: 'Celestial Festival', secret: true },
  { id: 'eventide', name: 'Eventide', inputs: ['spirit', 'shadow'], conditions: { environment: 'night' }, priority: 20, category: 'Seasonal', color: '#c7b4db', icon: 'moon', rarity: 'Epic', tags: ['spirit', 'dark'], hint: 'In the night, a memory finds the shadow it left behind.', description: 'An ancestral echo quiets an enemy and renews an ally.', effects: [s('silence', 2), h(.7)], season: 'Echoes of the Eclipse', secret: true },
);

export const EXTRA_VESSELS = ([
  ['hawk', 'Storm Hawk', 'Striker', 'sylph', 215, 31, 9, 1.7, ['wind', 'lightning']],
  ['beast', 'Venom Beast', 'Invoker', 'slime', 280, 28, 13, 2.2, ['poison', 'nature']],
  ['guardian', 'Dawn Guardian', 'Guardian', 'golem', 320, 23, 25, 2.5, ['light', 'earth']],
  ['fox', 'Frost Fox', 'Weaver', 'wraith', 230, 29, 11, 2, ['ice', 'water']],
  ['dryad', 'Briar Dryad', 'Mender', 'keeper', 270, 24, 15, 2.2, ['nature', 'earth']],
  ['drake', 'Ash Drake', 'Striker', 'sprite', 255, 35, 8, 2.4, ['fire', 'poison']],
  ['moth', 'Moon Moth', 'Weaver', 'wraith', 225, 28, 10, 1.9, ['shadow', 'light']],
  ['turtle', 'Reef Turtle', 'Guardian', 'golem', 360, 20, 30, 2.8, ['water', 'earth']],
  ['spirit-keeper', 'Willow Spirit', 'Mender', 'keeper', 240, 26, 13, 2, ['light', 'nature']],
  ['djinn', 'Glass Djinn', 'Invoker', 'sylph', 235, 33, 9, 2.1, ['lightning', 'ice']],
] satisfies [string,string,string,string,number,number,number,number,string[]][]).map(([id, name, role, shape, hp, attack, armor, interval, elements], i) => ({ id, name, role, shape, hp, attack, armor, interval, elements, unlockWins: i + 1 }));

export const EXTRA_ENEMIES = ([
  ['briarling', 'Briarling', 'keeper', 185, 22, 10, ['nature', 'poison']],
  ['bog-wisp', 'Bog Wisp', 'wraith', 170, 27, 6, ['poison', 'water']],
  ['ice-crab', 'Ice Crab', 'golem', 250, 21, 24, ['ice', 'earth']],
  ['rain-sylph', 'Rain Sylph', 'sylph', 180, 25, 9, ['water', 'wind']],
  ['stormling', 'Stormling', 'sprite', 190, 28, 8, ['lightning', 'wind']],
  ['shade', 'Hollow Shade', 'wraith', 205, 26, 10, ['shadow', 'poison']],
  ['dawn-moth', 'Dawn Moth', 'sylph', 190, 23, 11, ['light', 'ice']],
  ['iron-husk', 'Iron Husk', 'golem', 275, 23, 27, ['metal', 'earth']],
  ['riftling', 'Riftling', 'wraith', 215, 30, 7, ['void', 'arcane']],
  ['bloodthorn', 'Bloodthorn', 'keeper', 240, 25, 15, ['blood', 'nature']],
  ['chronomoth', 'Chronomoth', 'sylph', 190, 28, 8, ['time', 'ice']],
  ['prism-slime', 'Prism Slime', 'slime', 230, 23, 20, ['crystal', 'light']],
  ['starling', 'Fallen Starling', 'sprite', 220, 30, 12, ['cosmic', 'fire']],
  ['chaos-seed', 'Chaos Seed', 'keeper', 240, 28, 14, ['chaos', 'nature']],
  ['grave-warden', 'Grave Warden', 'golem', 280, 25, 23, ['spirit', 'shadow']],
  ['gravity-well', 'Gravity Well', 'slime', 300, 24, 25, ['gravity', 'void']],
] satisfies [string,string,string,number,number,number,string[]][]).map(([id, name, shape, hp, attack, armor, elements]) => ({ id, name, shape, hp, attack, armor, elements, interval: 2.5, tags: [elements[0]] }));

export const EXTRA_BOSSES: UnitDefinition[] = GUARDIANS;

export const REGIONS = [
  { id: 'first-flame', name: 'The First Flame', elements: ['fire', 'earth'], environment: 'forest', enemies: ['imp', 'sentinel', 'iron-husk'], boss: 'molten-king', lore: 'The furnaces never went cold. Someone is still tending them.', unlock: 'metal' },
  { id: 'drowned-kingdom', name: 'The Drowned Kingdom', elements: ['water', 'ice'], environment: 'rain', enemies: ['ice-crab', 'rain-sylph', 'prism-slime'], boss: 'tide-empress', lore: 'Beneath the tides, an archive remembers the shape of the world.', unlock: 'crystal' },
  { id: 'emerald-wild', name: 'The Emerald Wild', elements: ['nature', 'poison'], environment: 'forest', enemies: ['briarling', 'bog-wisp', 'bloodthorn'], boss: 'plague-mother', lore: 'The forest calls the catastrophe a beginning, not an ending.', unlock: 'spirit' },
  { id: 'stormlands', name: 'The Stormlands', elements: ['wind', 'lightning'], environment: 'storm', enemies: ['stormling', 'chronomoth', 'starling'], boss: 'tempest-titan', lore: 'Thunder repeats an ancient message. The intervals are deliberate.', unlock: 'time' },
  { id: 'eclipse', name: 'The Eclipse', elements: ['light', 'shadow'], environment: 'night', enemies: ['shade', 'riftling', 'grave-warden'], boss: 'eclipse-sovereign', lore: 'The fragments are not substances. They are instructions.', unlock: 'void' },
];
export const CAMPAIGN_STAGES: Encounter[] = REGIONS.flatMap((region, regionIndex) => Array.from({ length: 12 }, (_, index) => {
  const boss = index === 11;
  const elite = index === 5;
  return { id: region.id + '-' + (index + 1), name: boss ? EXTRA_BOSSES.find(b => b.id === region.boss)?.name ?? 'The Molten King' : ['The Threshold', 'Lost Footsteps', 'Fractured Path', 'The Silent Watch', 'Buried Memory', 'The Bound Sentinel', 'A Strange Current', 'Unwritten Signs', 'Echoes of Before', 'The Last Crossing', 'The Inner Gate'][index], region: region.name, regionId: region.id, stage: index + 1, label: String(index + 1).padStart(2, '0'), environment: region.environment, description: CHAPTER_MEMORIES[region.id][index], tip: boss ? 'Study this guardian’s immunities and exploit its elemental weakness.' : elite ? 'An elite formation protects this archive. Defensive reactions can buy you time.' : 'Prepare reactions across several vessels to sustain a chain.', enemies: boss ? [region.boss, region.enemies[0], region.enemies[1]] : Array.from({ length: 5 }, (_, i) => region.enemies[(i + index) % region.enemies.length]), scale: 1 + regionIndex * .07 + index * .015 + (elite ? .08 : 0), boss, elite, gold: 35 + index * 4 + regionIndex * 10, knowledge: boss ? 15 : elite ? 8 : 4, xp: boss ? 100 : 35 + index * 3, unlockElement: boss ? region.unlock : null, prerequisite: index ? region.id + '-' + index : regionIndex ? REGIONS[regionIndex - 1].id + '-12' : 'molten-throne' };
}));
