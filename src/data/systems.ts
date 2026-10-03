import type { Talent, Passive, Equipment, Specialization, Quest, Modifiers, Environment } from '../types.js';
const meta = { version: 1, enabled: true, releaseDate: '2026-10-01' };
export const DISCOVERY_REWARDS = { dailyGoal: { gold: 25, knowledge: 3, essence: 5 }, challengeSolver: { xp: 20, knowledge: 3 }, challengeCreatorXp: 10 };
export const MASTERY_REWARDS = { spreadLevel: 3, variantLevel: 5, durationLevel: 5, durationBonus: 1, passiveLevel: 7, experimentLevel: 10, maximumLevel: 10, passive: { id: 'mastery-echo', name: 'Mastery Echo', trigger: 'OnKill', cooldown: 8, effects: [{ type: 'explode', scale: .35, count: 3 }] } satisfies Passive };
export const TALENTS: Talent[] = [
  { id: 'careful-notes', branch: 'Discovery', name: 'Careful Notes', cost: 10, description: 'Discoveries award 2 extra knowledge.', modifiers: { discoveryKnowledge: 2 } },
  { id: 'patient-scholar', branch: 'Research', name: 'Patient Scholar', cost: 15, requires: 'careful-notes', description: 'Research costs 20% less knowledge.', modifiers: { researchDiscount: .2 } },
  { id: 'field-alchemist', branch: 'Exploration', name: 'Field Alchemist', cost: 10, description: 'Victories award 3 additional essence.', modifiers: { battleEssence: 3 } },
  { id: 'salvager', branch: 'Economy', name: 'Salvager', cost: 15, requires: 'field-alchemist', description: 'Victories award an additional relic shard.', modifiers: { battleShards: 1 } },
  { id: 'deep-binding', branch: 'Combat', name: 'Deep Binding', cost: 15, description: 'Each vessel begins battle with 50 shield.', modifiers: { startingShield: 50 } },
  { id: 'reaction-scholar', branch: 'Alchemy', name: 'Reaction Scholar', cost: 20, requires: 'deep-binding', description: 'Reaction chains can travel one additional level.', modifiers: { chainDepth: 1 } },
].map(x => ({ ...meta, tags: [x.branch.toLowerCase()], ...x }));
export const PASSIVES: Passive[] = ([
  { id: 'none', name: 'No passive', description: 'An open passive slot.', trigger: null, effects: [] },
  { id: 'first-ward', name: 'First Ward', description: 'Gain a barrier when battle begins.', trigger: 'OnBattleStart', cooldown: 90, effects: [{ type: 'status', status: 'barrier', duration: 8, intensity: .25, recipient: 'source' }] },
  { id: 'chain-heart', name: 'Chain Heart', description: 'A reaction chain heals the weakest ally.', trigger: 'OnReactionChain', cooldown: 6, effects: [{ type: 'heal', scale: .8, recipient: 'weakestAlly' }] },
  { id: 'last-light', name: 'Last Light', description: 'At low health, gain a strong protective shield.', trigger: 'OnLowHealth', cooldown: 30, effects: [{ type: 'shield', scale: 4, recipient: 'source' }] },
  { id: 'ember-echo', name: 'Ember Echo', description: 'Critical strikes apply a stacking burn.', trigger: 'OnCritical', cooldown: 2, effects: [{ type: 'status', status: 'burn', duration: 6, intensity: .2 }] },
  { id: 'victory-bloom', name: 'Victory Bloom', description: 'A kill restores the weakest allied vessel.', trigger: 'OnKill', cooldown: 3, effects: [{ type: 'heal', scale: 1.5, recipient: 'weakestAlly' }] },
  { id: 'thorns', name: 'Thorns', description: 'Taking damage grants a brief reflection ward.', trigger: 'OnDamageTaken', cooldown: 8, effects: [{ type: 'status', status: 'reflect', duration: 3, intensity: .25, recipient: 'source' }] },
  { id: 'afterglow', name: 'Afterglow', description: 'When a status expires, restore a little health.', trigger: 'OnStatusExpired', cooldown: 5, effects: [{ type: 'heal', scale: .4, recipient: 'source' }] },
  { id: 'parting-gift', name: 'Parting Gift', description: 'On death, shield the weakest surviving ally.', trigger: 'OnDeath', cooldown: 90, effects: [{ type: 'shield', scale: 3, recipient: 'weakestAlly' }] },
] satisfies Passive[]).map((x, i) => ({ ...meta, unlockDiscoveries: Math.max(0, i - 1) * 2, ...x }));
export const EQUIPMENT: Equipment[] = ([
  { id: 'ember-focus', name: 'Ember Focus', slot: 'weapon', gold: 70, essence: 10, shards: 1, description: 'Burn persists for 2 extra seconds.', modifiers: { statusDuration: { burn: 2 } } },
  { id: 'storm-lens', name: 'Storm Lens', slot: 'core', gold: 90, essence: 15, shards: 2, description: 'Chain effects reach one additional target.', modifiers: { chainTargets: 1 } },
  { id: 'living-charm', name: 'Living Charm', slot: 'charm', gold: 70, essence: 12, shards: 1, description: 'Healing is 20% stronger.', modifiers: { healingMultiplier: 1.2 } },
  { id: 'winter-catalyst', name: 'Winter Catalyst', slot: 'catalyst', gold: 100, essence: 18, shards: 2, description: 'Slow persists for 3 extra seconds.', modifiers: { statusDuration: { slow: 3 } } },
  { id: 'aegis-core', name: 'Aegis Core', slot: 'core', gold: 90, essence: 15, shards: 2, description: 'Begin battle with 75 shield.', modifiers: { startingShield: 75 } },
  { id: 'venom-focus', name: 'Venom Focus', slot: 'weapon', gold: 70, essence: 10, shards: 1, description: 'Poison persists for 3 extra seconds.', modifiers: { statusDuration: { poison: 3 } } },
  { id: 'echo-catalyst', name: 'Echo Catalyst', slot: 'catalyst', gold: 120, essence: 18, shards: 2, requiresResearch: ['catalyst-study'], description: 'This vessel can sustain reaction chains one level deeper.', modifiers: { chainDepth: 1 } },
] satisfies Omit<Equipment, 'tags' | 'rarity'>[]).map<Equipment>(x => ({ ...meta, tags: [x.slot], rarity: x.shards > 1 ? 'Rare' : 'Uncommon', ...x, modifiers: x.modifiers as Modifiers }));
export const SPECIALIZATIONS: Specialization[] = [
  { id: 'volatile', name: 'Volatile', description: 'Strikes deal 15% more damage; the vessel takes 10% more damage.', power: 1.15, received: 1.1 },
  { id: 'enduring', name: 'Enduring', description: 'Applied statuses last 2 seconds longer.', duration: 2 },
  { id: 'restorative', name: 'Restorative', description: 'Healing and shields are 25% stronger.', healing: 1.25, shield: 1.25 },
  { id: 'ember', name: 'Ember', tags: ['heat'], description: 'Heat elements deal 15% less strike damage and apply an additional stacking burn on each elemental cast.', power: .85, castEffects: [{ type: 'status', status: 'burn', duration: 6, intensity: .15 }] },
  { id: 'phoenix', name: 'Phoenix', tags: ['heat', 'spirit'], description: 'Heat or spirit elements deal 10% less strike damage. On a kill, revive one fallen ally at 20% health and heal the weakest ally. 20-second cooldown.', power: .9, cooldown: 20, onKillEffects: [{ type: 'resurrect', scale: .2 }, { type: 'heal', scale: .5, recipient: 'weakestAlly' }] },
  { id: 'volcanic', name: 'Volcanic', tags: ['heat', 'earth'], description: 'Heat or earth elements deal 10% less strike damage and briefly root the target on a cast. 6-second cooldown.', power: .9, cooldown: 6, castEffects: [{ type: 'status', status: 'root', duration: 1.25, intensity: 1 }] },
];
export const QUESTS: Quest[] = ([
  { id: 'first-reaction', name: 'The First Relationship', description: 'Discover one reaction.', metric: 'discoveries', target: 1, gold: 25, knowledge: 3 },
  { id: 'curiosity', name: 'A Curious Mind', description: 'Perform ten experiments.', metric: 'experiments', target: 10, gold: 40, knowledge: 5 },
  { id: 'connections', name: 'Everything Is Connected', description: 'Discover ten reactions.', metric: 'discoveries', target: 10, gold: 100, knowledge: 15 },
  { id: 'first-victory', name: 'A Theory Proven', description: 'Win an expedition.', metric: 'wins', target: 1, gold: 40, knowledge: 5 },
  { id: 'explorer', name: 'Past the Horizon', description: 'Complete twelve campaign locations.', metric: 'campaign', target: 12, gold: 150, knowledge: 20 },
  { id: 'weather-maker', name: 'Weather Maker', description: 'Discover Thunderstorm.', reaction: 'thunderstorm', target: 1, gold: 75, knowledge: 10 },
  { id: 'run-scholar', name: 'An Unlikely Theory', description: 'Complete a roguelite run.', metric: 'runsWon', target: 1, gold: 150, knowledge: 15 },
  { id: 'water-scholar', name: 'Water Remembers', description: 'Discover five distinct reactions involving Water.', criteria: { type: 'discovery-element', element: 'water' }, target: 5, gold: 90, knowledge: 12 },
  { id: 'chain-scholar', name: 'Follow the Current', description: 'Discover three chain-tagged reactions.', criteria: { type: 'discovery-tag', tag: 'chain' }, target: 3, gold: 80, knowledge: 12 },
  { id: 'own-theory', name: 'Your Own Theory', description: 'Discover five relationships without purchasing their hints.', criteria: { type: 'unassisted' }, target: 5, gold: 80, knowledge: 10 },
  { id: 'diverse-chain', name: 'A Wider Connection', description: 'Observe a causal combat chain connecting at least four different elements.', criteria: { type: 'chain-elements' }, target: 4, gold: 100, knowledge: 15 },
  { id: 'fresh-theory', name: 'Freshly Proven', description: 'Use a reaction in a victory on the UTC day you discover it.', criteria: { type: 'fresh-victory' }, target: 1, gold: 65, knowledge: 8 },
  { id: 'fire-practice', name: 'Keep the Flame', description: 'Win three battles in which Fire actually casts.', criteria: { type: 'element-victories', element: 'fire' }, target: 3, gold: 80, knowledge: 10 },
] satisfies Quest[]).map(x => ({ ...meta, ...x }));
export const ACHIEVEMENTS: Quest[] = [
  ...QUESTS.map(q => ({ ...q, id: 'achievement-' + q.id, gold: Math.max(10, Math.floor(q.gold / 2)), knowledge: Math.max(1, Math.floor(q.knowledge / 2)) })),
  { ...meta, id: 'master-alchemist', name: 'Master Alchemist', description: 'Discover fifty reactions.', metric: 'discoveries', target: 50, gold: 150, knowledge: 20 },
  { ...meta, id: 'depths', name: 'Into the Depths', description: 'Reach endless floor ten.', metric: 'endlessBest', target: 10, gold: 100, knowledge: 15 },
];
export const RUN_UPGRADES: { id: string; name: string; description: string; modifiers: Modifiers }[] = [
  { id: 'ward', name: 'Glass Aegis', description: 'Begin each battle with 100 shield.', modifiers: { startingShield: 100 } },
  { id: 'echo', name: 'Echo Chamber', description: 'Reaction chains travel one level deeper.', modifiers: { chainDepth: 1 } },
  { id: 'pulse', name: 'Storm Pulse', description: 'Lightning chains reach one extra enemy.', modifiers: { chainTargets: 1 } },
  { id: 'roots', name: 'Ancient Roots', description: 'Healing is 30% stronger.', modifiers: { healingMultiplier: 1.3 } },
  { id: 'embers', name: 'Undying Embers', description: 'Burn lasts 3 seconds longer.', modifiers: { statusDuration: { burn: 3 } } },
  { id: 'venom', name: 'Patient Venom', description: 'Poison lasts 3 seconds longer.', modifiers: { statusDuration: { poison: 3 } } },
];
export const MUTATORS: { id: string; name: string; description: string; modifiers: Modifiers }[] = [
  { id: 'clear', name: 'Quiet Skies', description: 'The elements follow their familiar rules.', modifiers: {} },
  { id: 'wildfire', name: 'Wildfire Season', description: 'Heat damage is 30% stronger.', modifiers: { tagPower: { heat: 1.3 } } },
  { id: 'fleeting', name: 'Fleeting Magic', description: 'All statuses last half as long.', modifiers: { durationMultiplier: .5 } },
  { id: 'renewal', name: 'Restless Growth', description: 'Enemies begin with regeneration.', modifiers: { enemyRegeneration: .15 } },
  { id: 'drought', name: 'Drought', description: 'Water reactions are suppressed.', modifiers: { disabledReactionTags: ['water', 'wet'] } },
  { id: 'conducting', name: 'Living Lightning', description: 'Every chain reaches an extra target.', modifiers: { chainTargets: 1 } },
];
export const ENVIRONMENTS: Record<string, Environment> = {
  neutral: { name: 'Still Air', modifiers: {} },
  forest: { name: 'Ancient Forest', object: 'Worldroot', interaction: { charges: 3, elements: ['nature', 'fire'], effects: [{ type: 'heal', scale: 1.5, recipient: 'weakestAlly' }] }, description: 'Living roots strengthen healing by 10%.', modifiers: { healingMultiplier: 1.1 } },
  rain: { name: 'Rain', object: 'Water Pools', description: 'Pools wet every combatant at the start of battle.', startStatus: 'wet', modifiers: { tagPower: { water: 1.15 } } },
  volcanic: { name: 'Volcanic', object: 'Ember Crystals', interaction: { charges: 3, elements: ['fire', 'lightning'], effects: [{ type: 'explode', scale: .5, count: 5 }] }, description: 'Crystals amplify heat damage by 15%.', modifiers: { tagPower: { heat: 1.15 } } },
  storm: { name: 'Storm', object: 'Lightning Rods', description: 'Rods carry each chain to one extra target.', modifiers: { chainTargets: 1 } },
  night: { name: 'Night', object: 'Moon Obelisk', description: 'The obelisk strengthens dark damage by 15%.', modifiers: { tagPower: { dark: 1.15 } } },
  holy: { name: 'Holy Ground', object: 'Dawn Shrine', description: 'Healing is 25% stronger.', modifiers: { healingMultiplier: 1.25 } },
  snow: { name: 'Snow', object: 'Ice Wall', interaction: { charges: 2, elements: ['fire'], effects: [{ type: 'spread', status: 'wet', duration: 5, intensity: 1, count: 4 }] }, description: 'Cold damage is 20% stronger.', modifiers: { tagPower: { cold: 1.2 } } },
};
export const AFFINITIES: Record<string, string[]> = { fire: ['nature', 'ice'], water: ['fire'], earth: ['lightning'], wind: ['fire'], lightning: ['water'], ice: ['water'], nature: ['earth'], poison: ['nature'], light: ['shadow'], shadow: ['light'] };
export const COSMETICS = [
  { id: 'observatory', name: 'The Observatory', cost: 0, color: '#d9c394' },
  { id: 'moonlit', name: 'Moonlit Laboratory', cost: 250, color: '#c5b7e7' },
  { id: 'verdant', name: 'Verdant Study', cost: 250, color: '#accb99' },
  { id: 'tidal', name: 'Tidal Archive', cost: 250, color: '#a0d7e5' },
];

export const BOSS_AFFIXES = [
  { id: 'restless', name: 'Restless', description: 'Casts 10% faster, with 10% less health.', interval: .9, health: .9, attack: 1, armor: 1 },
  { id: 'crystalbound', name: 'Crystalbound', description: 'Has 20% more armor, but casts 10% slower.', interval: 1.1, health: 1, attack: 1, armor: 1.2 },
  { id: 'hollow', name: 'Hollow', description: 'Deals 10% more damage, with 10% less health.', interval: 1, health: .9, attack: 1.1, armor: 1 },
  { id: 'ancient', name: 'Ancient', description: 'Has 10% more health, but deals 10% less damage.', interval: 1, health: 1.1, attack: .9, armor: 1 },
];
