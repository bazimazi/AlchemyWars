/** Shared domain contracts used by simulation, persistence, tooling and UI. */
export type NumericMap = Record<string, number>;
export type Pair = [string, string];
export interface Metadata { version?: number; enabled?: boolean; releaseDate?: string }
export interface Named { id: string; name: string; description?: string }
export interface Modifiers {
  startingShield?: number; chainDepth?: number; chainTargets?: number;
  healingMultiplier?: number; durationMultiplier?: number; enemyRegeneration?: number;
  discoveryKnowledge?: number; researchDiscount?: number; battleEssence?: number; battleShards?: number;
  tagPower?: NumericMap; statusDuration?: NumericMap; disabledReactionTags?: string[];
}
export type NumericModifier = Exclude<keyof Modifiers, 'tagPower' | 'statusDuration' | 'disabledReactionTags'>;
export interface Conditions { environment?: string; statuses?: string[]; healthBelow?: number; minimumEnemies?: number; requiredTags?: string[]; mastery?: NumericMap; shielded?: boolean; research?: string[] }
export interface ReactionContext { environment?: string; statuses?: string[] | Set<string>; healthRatio?: number; enemyCount?: number; tags?: string[]; mastery?: NumericMap; shielded?: boolean; research?: string[] }
export interface EffectBase { recipient?: 'source' | 'weakestAlly' | 'target'; }
export type Effect = EffectBase & (
  { type: 'damage' | 'heal' | 'shield' | 'resurrect'; scale: number } |
  { type: 'explode'; scale: number; count?: number } |
  { type: 'status'; status: string; duration: number; intensity: number; stacks?: number } |
  { type: 'spread'; status: string; duration: number; intensity: number; count: number } |
  { type: 'chain'; scale: number; count: number; status: string; element: string } |
  { type: 'cleanse'; count: number } |
  { type: 'summon'; enemy: string; scale?: number } |
  { type: 'transform' | 'applyElement'; element: string }
);
export type ElementRow = [string, string, string, string, string[], string, string, Effect[]];
export interface ElementDefinition extends Metadata, Named { color: string; icon: string; tags: string[]; role: string; description: string; lore: string; rarity: string; tier: number; affinity: string; power: number; effects: Effect[]; base: boolean; unlockResearch?: string }
export interface ReactionDefinition extends Metadata, Named { inputs: Pair; output: string; category: string; color: string; icon: string; tags: string[]; hint: string; description: string; rarity: string; priority: number; cooldown: number; trigger: string; secret?: boolean; season?: string; conditions?: Conditions; effects: Effect[] }
export type ReactionDraft = Omit<ReactionDefinition, 'output' | 'rarity' | 'priority' | 'cooldown' | 'trigger'> & Partial<Pick<ReactionDefinition, 'output' | 'rarity' | 'priority' | 'cooldown' | 'trigger'>>;
export interface StatusDefinition extends Metadata, Named { short: string; harmful: boolean; maxStacks: number; periodic?: 'damage' | 'heal'; disables?: boolean; suppressEffects?: boolean; taunt?: boolean; speedMultiplier?: number; damageMultiplier?: number; armorMultiplier?: number; receivedMultiplier?: number; elementalReceivedMultiplier?: NumericMap; lifesteal?: number; reflect?: number }
export type StatusModifier = 'speedMultiplier' | 'damageMultiplier' | 'armorMultiplier' | 'receivedMultiplier' | 'lifesteal' | 'reflect';
export interface UnitBehavior extends Named { trigger: 'OnAbilityCast' | 'OnLowHealth' | 'OnDamageTaken'; cooldown: number; effects: Effect[]; suppressedBy?: string[] }
export interface UnitPhase { below: number; attackMultiplier: number; intervalMultiplier: number; label: string; elements?: Pair; immunities?: string[]; modifiers?: Modifiers; behaviors?: UnitBehavior[]; effects?: Effect[] }
export interface UnitDefinition extends Metadata, Named { shape: string; role?: string; hp: number; attack: number; armor: number; interval: number; elements: string[]; tags: string[]; unlockWins?: number; immunities?: string[]; weaknesses?: { status: string; armorMultiplier: number; damageMultiplier?: number }[]; phases?: UnitPhase[]; behaviors?: UnitBehavior[] }
export interface Encounter extends Metadata, Named { region: string; label: string; environment: string; description: string; tip: string; enemies: string[]; gold: number; knowledge: number; xp: number; scale?: number; boss?: boolean; elite?: boolean; affix?: string | null; prerequisite?: string; unlockElement?: string | null; regionId?: string; stage?: number; story?: string }
export interface Relic extends Metadata, Named { rarity?: string; tags: string[]; modifiers: Modifiers; discoveries?: number }
export type ResearchBranch = 'Elemental Science' | 'Reaction Science' | 'Combat Science' | 'Creature Evolution' | 'Artifact Research' | 'Ancient Knowledge' | 'Alchemy';
export interface Research extends Metadata, Named { branch: ResearchBranch; icon: string; cost: number; modifiers: Modifiers; requires?: string[]; unlockElement?: string; abilitySlots?: number }
export interface Talent extends Metadata, Named { branch: string; tags: string[]; cost: number; requires?: string; modifiers: Modifiers }
export interface Passive extends Metadata, Named { trigger: string | null; effects: Effect[]; cooldown?: number; unlockDiscoveries?: number }
export interface Equipment extends Metadata, Named { slot: string; gold: number; essence: number; shards: number; modifiers: Modifiers; tags: string[]; rarity: string; requiresResearch?: string[] }
export interface Specialization extends Named { tags?: string[]; power?: number; received?: number; duration?: number; healing?: number; shield?: number; castEffects?: Effect[]; onKillEffects?: Effect[]; cooldown?: number }
export type QuestCriteria = { type: 'discovery-element'; element: string } | { type: 'discovery-tag'; tag: string } | { type: 'unassisted' | 'chain-elements' | 'fresh-victory' | 'secret-discoveries' | 'legendary-discoveries' | 'fireless-victories' | 'poison-boss-victories' | 'tested-builds' } | { type: 'element-victories'; element: string };
export interface Quest extends Metadata, Named { criteria?: QuestCriteria; metric?: 'discoveries' | 'experiments' | 'wins' | 'campaign' | 'runsWon' | 'endlessBest'; reaction?: string; target: number; gold: number; knowledge: number }
export interface Environment { name: string; modifiers: Modifiers; object?: string; description?: string; startStatus?: string; interaction?: { charges: number; elements: string[]; effects: Effect[] } }
export interface Loadout { abilities?: string[]; vessel: string; elements: string[]; relic: string; targeting: string; priority: string; passive?: string; equipment?: Record<string, string>; reactionPriority?: string[] }
export interface RunReward { type: 'element' | 'upgrade' | 'relic' | 'passive' | 'rest'; id: string }
export interface Run { mode: string; seed: number; floor: number; state: 'battle' | 'reward' | 'complete' | 'defeat' | 'retired'; elements: string[]; discoveries: string[]; upgrades: string[]; relics: string[]; passives: string[]; context: ReactionContext; rewards: RunReward[]; team: Loadout[]; health: number[]; wins: number; rewardClaimed: boolean; mutator: string; period: number }
export interface AnalyticsEvent { name: string; at: number; [key: string]: unknown }
export interface DiscoveredChain { reactions: string[]; firstSeen: number }
export interface LearningProgress { unassisted: string[]; freshWins: string[]; elementCasts: NumericMap; elementWins: NumericMap; tutorial: string[]; chainElements: number; testedBuilds: string[]; firelessWins: number; poisonBossWins: number; daily: { day: string; pairings: string[]; won: boolean; longestChain: number; claims: string[] } }
export interface CreatureKnowledge { phases: number[]; behaviors: string[] }
export interface MetaProgress { creatureKnowledge: Record<string, CreatureKnowledge>; learning: LearningProgress; vesselXp: NumericMap; chains: DiscoveredChain[]; creatures: string[]; activeDays: string[]; createdAt: number; essence: number; shards: number; talents: string[]; equipment: string[]; evolution: NumericMap; specializations: Record<string,string>; quests: string[]; achievements: string[]; achievementClaims: string[]; reactionWins: NumericMap; discoveryDates: NumericMap; runsWon: number; endlessBest: number; run: Run | null; loadouts: { name: string; team: Loadout[] }[]; cosmetics: string[]; theme: string; analytics: AnalyticsEvent[]; dailyClaims: string[]; highestChain: number }
export interface Player extends MetaProgress { version: number; xp: number; gold: number; knowledge: number; owned: string[]; discoveries: string[]; mastery: NumericMap; reactionUsage: NumericMap; research: string[]; favorites: string[]; history: { inputs: string[]; result: string | null; environment: string; frozen: boolean; context?: ReactionContext }[]; team: Loadout[]; campaign: string[]; claimedBattles: string[]; battles: number; wins: number; experiments: number; hints: NumericMap; settings: { highContrast: boolean; haptics: boolean; sound: boolean; reducedMotion: boolean; largeText: boolean; leftHanded: boolean; debug: boolean }; lastReplay: BattleConfig | null }
export interface BattleConfig { vesselXp?: NumericMap; contentVersion: string; seed: number; encounterId: string; encounter?: Encounter; team: Loadout[]; research: string[]; mastery: NumericMap; talents?: string[]; evolution?: NumericMap; specializations?: Record<string,string>; opponentTeam?: Loadout[] | null; normalized?: boolean; startingHealth?: number[]; modifiers?: Modifiers; challenge?: { kind: string; key: string } }
export type Side = 'ally' | 'enemy';
export interface UnitStatus { id: string; expires: number; intensity: number; stacks: number; source: string; power: number; reaction: boolean | string }
export interface CombatUnit { immunities: string[]; behaviors: UnitBehavior[]; abilities: string[]; id: string; definitionId: string; name: string; shape: string; side: Side; position: number; hp: number; maxHp: number; attack: number; armor: number; interval: number; elements: string[]; relic: string; targeting: string; priority: string; passive: string; equipment: Record<string,string>; reactionPriority: string[]; modifiers: Modifiers; shield: number; statuses: Record<string,UnitStatus>; residues: NumericMap; cooldowns: NumericMap; ready: number; casts: number; phase: number; definition: UnitDefinition; resurrected?: boolean }
export interface ChainContext { path?: string[]; depth: number; triggered: Set<string>; maxDepth?: number }
export interface ElementApplication { source: CombatUnit; target: CombatUnit | undefined; element: string; context: ChainContext }
export interface BattleEvent { time: number; type: string; source?: string; target?: string; amount?: number; absorbed?: number; element?: string; reaction?: boolean | string; status?: string; stacks?: number; name?: string; id?: string; depth?: number; trigger?: string; seed?: number; environment?: string; priority?: string; charges?: number; outcome?: string }
export interface UnitSnapshot { immunities: string[]; behaviors: string[]; phaseLabel?: string; id: string; definitionId: string; side: Side; position: number; name: string; shape: string; hp: number; maxHp: number; shield: number; elements: string[]; statuses: { id: string; stacks: number; remaining: number }[]; phase: number; residues: NumericMap; cooldowns: NumericMap; ready: number }
export interface BattleFrame { time: number; eventCount: number; object: { name: string; charges: number; description?: string } | null; units: UnitSnapshot[] }
export interface UnitContribution { damage: number; damageTaken: number; absorbed: number; healing: number; shield: number; cleanses: number; kills: number; elementCasts: number; abilityCasts: number; reactions: number }
export interface ReactionSupport { healing: number; shield: number; cleanses: number; statuses: number }
export interface ObservedMechanics extends CreatureKnowledge { counters: NumericMap }
export interface BattlePhase { unit: string; index: number; time: number; label: string; elements: string[] }
export interface BattleReport { units: Record<string, UnitContribution>; reactionSupport: Record<string, ReactionSupport>; mechanics: Record<string, ObservedMechanics>; phases: BattlePhase[]; statusDamage: Record<string, NumericMap>; elementCasts: NumericMap; chains: string[][]; damageByElement: NumericMap; damageByUnit: NumericMap; damageByReaction: NumericMap; reactions: NumericMap; reactionDamage: number; totalDamage: number; healing: number; highestChain: number; decisions: number; guardedEvents: number }
export interface BattleResult { config: BattleConfig; outcome: 'victory' | 'defeat' | 'draw'; duration: number; report: BattleReport; events: BattleEvent[]; frames: BattleFrame[]; final: BattleFrame }

export interface CommandPayload { id?: string; count?: number; key?: keyof Player['settings']; value?: boolean; a?: string; b?: string; context?: ReactionContext; index?: number; patch?: Partial<Loadout>; direction?: number; specialization?: string; name?: string; mode?: string; elements?: string[] }
export interface ExperimentResult { ok: boolean; error?: string; rule?: ReactionDefinition | null; isNew?: boolean }
export interface HintResult { ok: boolean; error?: string; text?: string }
export type CommandResult = boolean | number | ReactionDefinition | null | ExperimentResult | HintResult;
