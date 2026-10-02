# Alchemy Wars
## Comprehensive Implementation & Game Development Specification

## 1. Product Vision

Build a polished mobile-first game called **Alchemy Wars** combining:

- Element collection
- Experimental combination
- Auto-battler combat
- RPG progression
- Strategic team building
- Roguelite progression
- Discovery/collection
- PvE campaigns
- PvP
- Long-term live content

The player does **not** primarily collect heroes.

The player collects **Elements, Reactions, Traits, Relics, and Knowledge**.

The central fantasy is:

> **"I discovered a combination nobody taught me, and now I can build an entire strategy around it."**

The game should make experimentation itself feel rewarding.

---

# 2. Core Design Pillars

Everything implemented must reinforce these pillars.

### Pillar 1 — Discovery

Players should constantly wonder:

> "What happens if I combine these?"

Discoveries must feel meaningful rather than being simple collection milestones.

### Pillar 2 — Emergent Combat

Elements should interact dynamically during battles.

Do not create 1,000 isolated skills.

Create a relatively small number of fundamental mechanics that can interact in many ways.

### Pillar 3 — Strategic Construction

Players construct a combat build from:

- Elements
- Element combinations
- Units
- Relics
- Traits
- Passives
- Formation
- Equipment
- Research

### Pillar 4 — Long-Term Progression

The game should remain interesting after the player has discovered hundreds of combinations.

### Pillar 5 — Accessibility

A new player should understand the game within minutes.

A highly experienced player should still have enormous strategic depth.

### Pillar 6 — Content Scalability

New content should be inexpensive to add.

Adding one new element should potentially create dozens of new interactions automatically.

---

# 3. Core Gameplay Loop

The fundamental loop is:

```text
EXPLORE
   ↓
COLLECT ELEMENTS
   ↓
EXPERIMENT
   ↓
DISCOVER REACTIONS
   ↓
BUILD TEAM
   ↓
AUTO-BATTLE
   ↓
EARN RESOURCES
   ↓
UPGRADE / RESEARCH
   ↓
UNLOCK NEW ELEMENTS
   ↓
DISCOVER MORE COMBINATIONS
   ↓
ENTER HARDER CONTENT
```

Secondary loop:

```text
Battle
 ↓
Loot
 ↓
Craft
 ↓
Research
 ↓
Modify build
 ↓
Experiment
 ↓
Battle again
```

The game should constantly alternate between:

**Thinking → Experimenting → Watching → Discovering → Optimizing**

---

# 4. The Most Important System: Elements

Create a data-driven Element system.

An element is not simply:

```text
Fire = damage
```

Instead it contains multiple properties.

Example:

```text
Fire

Primary Affinity:
    FIRE

Tags:
    Heat
    Burning
    Aggressive
    Volatile

Base Effects:
    Apply Burn
    Increase temperature
    Ignite flammable effects

Interaction Properties:
    Reacts with Water
    Reacts with Nature
    Reacts with Earth
    Reacts with Ice
    Reacts with Poison

Combat Roles:
    Damage
    DoT
    Area damage

Rarity:
    Common
```

Every element should therefore be described through reusable properties.

---

# 5. Initial Element Families

Start with approximately 10 fundamental elements:

```text
Fire
Water
Earth
Wind
Lightning
Ice
Nature
Poison
Light
Shadow
```

Eventually expand into families such as:

```text
Metal
Arcane
Void
Blood
Crystal
Spirit
Time
Gravity
Steam
Magma
Storm
Plasma
Chaos
Cosmic
```

Do NOT begin development with hundreds of elements.

The initial vertical slice should use approximately:

- 10 base elements
- 20–30 derived elements/reactions
- 10–20 combat effects

The architecture must support thousands.

---

# 6. Element Identity

Each element should have:

```text
ElementId
DisplayName
Description
Icon
VisualTheme
Rarity
Tier
Affinity
Tags[]
BasePower
OffensiveProperties[]
DefensiveProperties[]
StatusEffects[]
ReactionRules[]
CombatModifiers[]
CollectionMetadata
UnlockRequirements
Lore
```

Everything should be data-driven.

Avoid hardcoding element behavior throughout combat code.

---

# 7. Combination System

The combination engine is the heart of the game.

Basic example:

```text
Fire + Water = Steam
```

But the system should support different reaction categories.

### Category A — Transformation

```text
Fire + Water → Steam
Fire + Earth → Magma
Ice + Wind → Blizzard
```

### Category B — Enhancement

```text
Fire + Lightning → Plasma
Water + Lightning → Conductive
```

### Category C — Status Creation

```text
Poison + Nature → Toxic Growth
Ice + Poison → Frozen Venom
```

### Category D — Environmental Effects

```text
Water + Earth → Mud
Fire + Wind → Firestorm
Lightning + Metal → Magnetic Field
```

### Category E — Combat Behaviors

```text
Shadow + Light → Eclipse
Nature + Earth → Overgrowth
Wind + Lightning → Chain Storm
```

---

# 8. Reactions Should Be Composable

Do not make every combination a manually programmed special case.

Use a reaction vocabulary.

For example:

```text
Burn
Freeze
Wet
Shock
Poison
Bleed
Root
Slow
Haste
Blind
Silence
Shield
Vulnerable
Expose
Ignite
Conductive
Spread
Explode
Chain
Reflect
Absorb
Drain
Split
Transform
```

Then combine these primitives.

Example:

```text
Fire
    → Burn

Water
    → Wet

Fire + Wet
    → Steam

Lightning + Wet
    → Conductive

Lightning + Conductive
    → Chain Lightning
```

This allows emergent behavior.

---

# 9. Reaction Graph

Represent combinations internally as a graph.

Example:

```text
Fire
 ├── + Water → Steam
 ├── + Earth → Magma
 ├── + Wind → Firestorm
 ├── + Nature → Wildfire
 ├── + Ice → Melt
 └── + Poison → Toxic Flame
```

Each discovered reaction becomes a node or edge in the player's personal discovery graph.

This graph powers:

- Encyclopedia
- Collection
- Discovery UI
- Quests
- Achievements
- Research
- Hints
- Progression
- Content generation

---

# 10. Hidden vs Known Reactions

Players should NOT initially see every recipe.

The encyclopedia should display:

### Discovered

```text
Fire + Water
✓ Steam
```

### Partially discovered

```text
Fire + ???
Unknown
```

### Completely unknown

```text
???
```

Players can use experimentation to discover them.

---

# 11. Discovery Quality

A discovery should trigger a satisfying sequence:

```text
Combination
   ↓
Reaction animation
   ↓
Name reveal
   ↓
Element card
   ↓
Short description
   ↓
"NEW DISCOVERY"
   ↓
Added to Codex
   ↓
Possible reward
```

The animation should be one of the game's strongest emotional moments.

The player should immediately understand:

> "I just discovered something."

---

# 12. Multi-Step Reactions

Eventually support chains.

Example:

```text
Fire + Water
→ Steam

Steam + Wind
→ Storm Cloud

Storm Cloud + Lightning
→ Thunderstorm

Thunderstorm + Nature
→ Living Storm
```

This is critical for long-term discovery.

The game should contain:

- 2-element reactions
- 3-step chains
- conditional reactions
- environmental reactions
- combat-only reactions
- rare secret reactions

---

# 13. Reaction Conditions

Reactions should sometimes depend on context.

Example:

```text
Fire + Water
→ Steam
```

But:

```text
Fire + Water
while enemy is Frozen
→ Thermal Shock
```

Or:

```text
Lightning + Water
during Rain
→ Storm Surge
```

This creates strategic depth.

---

# 14. Combat System

Combat should be an **auto-battler**, but the player should have substantial strategic influence before combat.

Player controls:

- Team composition
- Element loadout
- Formation
- Roles
- Synergies
- Relics
- Passive effects
- Reaction priorities
- Targeting preferences
- Pre-battle strategy

Combat itself should primarily execute automatically.

---

# 15. Combat Structure

Recommended battle format:

```text
5 vs 5
```

Later support:

```text
3 vs 3
5 vs 5
Boss fights
Large encounters
Endless battles
Raid encounters
PvP
```

Avoid making battles too long.

Target:

```text
Normal battle:
30–90 seconds

Boss:
1–3 minutes
```

---

# 16. Units

Although the game does not focus on collecting heroes, units still need battlefield representation.

Possible implementation:

### Option A — Elemental Creatures

Examples:

```text
Flame Sprite
Stone Golem
Storm Hawk
Venom Beast
Shadow Wraith
Light Guardian
```

The player's collection is still fundamentally based on elements.

Units act as **vessels for elemental builds**.

---

# 17. Unit Architecture

Each unit has:

```text
UnitId
BaseStats
Role
ElementSlots
AbilitySlots
PassiveSlots
GrowthStats
Visual
AnimationSet
AIProfile
```

Example:

```text
Flame Sprite

Role:
    Damage

Affinity:
    Fire

Slots:
    Core Element
    Secondary Element
    Passive
    Relic
```

---

# 18. Element Loadouts

The important customization happens here.

Example:

```text
Flame Sprite

Fire Core
+
Lightning Secondary
+
Burn Relic
+
Chain Reaction Passive
```

This creates a different combat identity than:

```text
Flame Sprite

Fire Core
+
Nature Secondary
+
Regeneration Relic
+
Burning Growth Passive
```

Same unit.

Different build.

---

# 19. Build Archetypes

The combination system should naturally produce archetypes.

Examples:

### Inferno

```text
Fire
Burn
Explosion
Area damage
```

### Storm

```text
Wind
Lightning
Chain
Speed
```

### Toxic Garden

```text
Nature
Poison
Growth
Root
DoT
```

### Frozen Fortress

```text
Ice
Earth
Shield
Freeze
Defense
```

### Eclipse

```text
Light
Shadow
Blind
Drain
Burst
```

Do not force players into these archetypes.

Let them emerge from the system.

---

# 20. Reaction Combos During Combat

This is the feature that differentiates Alchemy Wars from a normal auto-battler.

Example:

```text
Mage casts Water
        ↓
Enemy becomes Wet
        ↓
Lightning unit attacks
        ↓
Conductive reaction
        ↓
Electricity chains
        ↓
Nearby enemy receives Shock
```

Another:

```text
Nature attack
↓
Root
↓
Poison
↓
Toxic Growth
↓
Plant spreads
↓
Multiple enemies become infected
```

---

# 21. Reaction Priority

Players should eventually be able to configure reaction behavior.

Example:

```text
Priority:

1. Freeze Boss
2. Spread Poison
3. Trigger Lightning Chain
4. Apply Burn
5. Basic attack
```

This creates meaningful optimization without requiring manual combat.

---

# 22. Reaction AI

Implement a lightweight decision system.

Example:

```text
if enemy.isWet:
    prioritize Lightning

if enemy.isFrozen:
    prioritize Fire

if enemy.isBurning:
    prioritize Wind

if enemy.isPoisoned:
    prioritize Nature

if enemy.hasShield:
    prioritize EarthBreak
```

Do not make this a giant hardcoded decision tree.

Use data-driven priorities and tags.

---

# 23. Combat Effects

Create a reusable status framework.

Initial effects:

```text
Burn
Wet
Freeze
Shock
Poison
Root
Slow
Haste
Bleed
Blind
Silence
Shield
Barrier
Vulnerable
Armor Break
Resistance Break
Regeneration
Drain
Reflect
Taunt
```

Every effect should support:

```text
Duration
Stacks
Intensity
Source
Target
Trigger
Expiration
Interactions
```

---

# 24. Reaction Trigger Types

Support:

```text
OnHit
OnCritical
OnStatusApplied
OnStatusExpired
OnDamageTaken
OnDeath
OnKill
OnAbilityCast
OnElementApplied
OnReaction
OnReactionChain
OnLowHealth
OnBattleStart
OnBattleEnd
```

This will dramatically increase the number of possible builds.

---

# 25. Chain Reactions

Implement a reaction event pipeline.

Example:

```text
Attack
 ↓
Apply Water
 ↓
WaterApplied event
 ↓
Lightning detected
 ↓
Conductive reaction
 ↓
ConductiveApplied
 ↓
ChainLightning
 ↓
Secondary enemy hit
 ↓
Shock
 ↓
Shock triggers passive
 ↓
Explosion
```

The system should prevent infinite loops using:

```text
ReactionContext
ChainDepth
TriggeredReactionIds
Cooldowns
```

---

# 26. Element Mastery

Every element should have mastery.

Example:

```text
Fire Mastery 17
```

Mastery unlocks:

- Better scaling
- New reactions
- Cosmetic variants
- Passive bonuses
- Lore
- Special experiments

But avoid simply giving:

> +10% damage

for every level.

Mix numerical and mechanical rewards.

Example:

```text
Fire Mastery 5
→ Burn unlocked

Fire Mastery 10
→ Burn can spread

Fire Mastery 20
→ Burning enemies explode on death

Fire Mastery 30
→ Unlock Inferno reaction
```

---

# 27. Discovery Mastery

Track more than element ownership.

Track:

```text
Element discovered
Reaction discovered
Reaction used
Reaction mastered
Reaction used in victory
Reaction chain discovered
Secret interaction discovered
```

This produces a deeper collection system.

---

# 28. The Alchemy Codex

Create a beautiful encyclopedia.

Sections:

```text
Elements
Reactions
Creatures
Status Effects
Artifacts
Lore
Discovered Combos
Unknown Combos
Mastery
```

Every entry should feel collectible.

---

# 29. Discovery Map

Provide a visual graph.

Example:

```text
             Fire
            /    \
         Steam   Magma
          /        \
      Storm       Volcano
        |
   Thunderstorm
```

Players should be able to see their intellectual progress.

Unknown branches should create curiosity.

---

# 30. Research System

Introduce a long-term research tree.

Research categories:

```text
Elemental Science
Reaction Science
Combat Science
Alchemy
Creature Evolution
Artifact Research
Ancient Knowledge
```

Research should unlock:

- new elements
- new reaction rules
- new slots
- new experiments
- new content
- new crafting possibilities

---

# 31. Roguelite Mode

Add a mode specifically designed around experimentation.

Structure:

```text
Enter run
 ↓
Choose starting elements
 ↓
Battle
 ↓
Choose reward
 ↓
Discover temporary reactions
 ↓
Build run
 ↓
Elite
 ↓
Boss
 ↓
Final boss
```

Each run should encourage unusual combinations.

Example:

```text
Start:
Fire

First reward:
Water

Second reward:
Lightning

Third reward:
"Reactions occur twice"
```

Now the player can construct a completely different build.

---

# 32. Endless Mode

Create an infinite mode.

Every stage increases difficulty.

Players gain:

```text
Power
Research
Materials
Rare discoveries
Leaderboard score
```

Introduce mutators:

```text
Enemies regenerate
Fire is amplified
Water reactions are disabled
All reactions spread
Status effects expire faster
Critical reactions explode
```

Theoretically infinite combinations of:

```text
Build + Enemy + Mutator
```

keep the mode fresh.

---

# 33. Campaign

The campaign should not simply be:

```text
Level 1
Level 2
Level 3
...
```

Instead structure it around elemental regions.

Example:

### Chapter 1 — The First Flame

Fire / Earth

### Chapter 2 — The Drowned Kingdom

Water / Ice

### Chapter 3 — The Emerald Wild

Nature / Poison

### Chapter 4 — The Stormlands

Wind / Lightning

### Chapter 5 — The Eclipse

Light / Shadow

Later:

```text
Void
Time
Gravity
Chaos
Cosmic
```

Each region introduces new mechanics.

---

# 34. Story

The story should explain why combinations exist.

Potential premise:

> The world was shattered into primordial forces after an ancient alchemical catastrophe.

The player is an **Alchemist**, capable of binding elemental forces.

Different civilizations have developed incompatible theories about how reality works.

The player gradually discovers that:

> the elements are not merely substances.

They are fragments of an ancient system.

This creates a long-term mystery.

---

# 35. Story Structure

Do not dump lore through walls of text.

Use:

- Short dialogue
- Illustrated scenes
- Battle events
- Codex entries
- Environmental storytelling
- Character encounters
- Discovery animations
- Boss introductions
- Optional lore

Every major element family should eventually have its own story.

---

# 36. Boss Design

Bosses should test combinations rather than raw statistics.

Example:

## The Molten King

Permanent:

```text
Burn immunity
```

But:

```text
Water → Armor Softening
Water + Lightning → Conductive Core
Ice → Temporary stun
```

The player is encouraged to experiment.

Another boss:

## The Plague Mother

```text
Poison spreads between allies
```

Counterplay:

```text
Fire sterilization
Light purification
Ice containment
```

---

# 37. Boss Phases

Bosses should change elemental rules.

Example:

```text
Phase 1:
Fire

Phase 2:
Fire + Earth

Phase 3:
Magma

Phase 4:
Volcanic eruption
```

The player must adapt.

---

# 38. PvP

PvP should be asynchronous initially.

Player A creates a team.

Player B fights the recorded/AI-controlled team.

This avoids requiring both players to be online simultaneously.

Modes:

```text
Arena
Ranked
Element Wars
Weekly Challenge
Guild Wars
```

---

# 39. PvP Fairness

Do not make PvP purely dependent on spending.

Use:

```text
Normalized Power
```

or separate competitive rules.

For example:

```text
Ranked PvP:
Normalized stats
Strategy determines most of the outcome
```

Collection remains meaningful through:

- build diversity
- experimentation
- reaction knowledge
- customization

---

# 40. Element Draft Mode

Create a PvP mode where players draft elements.

Example:

```text
Available:

Fire
Water
Lightning
Earth
Nature
Ice
```

Player selects:

```text
Fire
Lightning
Nature
```

Opponent gets different choices.

This creates competitive experimentation.

---

# 41. Guild System

Eventually support guilds.

Guild features:

```text
Guild research
Guild missions
Guild bosses
Guild discovery projects
Guild leaderboard
Element donations
Guild laboratory
```

### Guild Laboratory

Players collectively work toward discovering a global reaction.

Example:

```text
Community Experiment:

???
+
???

10,000 experiments required
```

The community gradually discovers the answer.

---

# 42. Social Discovery

Allow players to share discoveries.

Example:

> "I discovered Thunderstorm!"

The player can share:

```text
Fire + Water → Steam
Steam + Wind → Storm Cloud
Storm Cloud + Lightning → Thunderstorm
```

Do not reveal undiscovered combinations automatically.

Sharing should create social curiosity.

---

# 43. Player-Created Experiments

Later add:

```text
Experiment Challenges
```

A player creates:

```text
Target:
Create Plasma

Allowed:
Fire
Lightning
Water

Restrictions:
No Earth
No Nature
```

Other players solve it.

Reward:

```text
Creator XP
Solver XP
Discovery currency
```

---

# 44. Economy

Keep the economy understandable.

Suggested currencies:

### Gold

General upgrades.

### Essence

Element upgrades.

### Research Points

Permanent progression.

### Catalyst

Combination experiments.

### Relic Shards

Artifacts.

### Premium Currency

Cosmetics/convenience/optional acquisition.

Do not create 15 currencies at launch.

---

# 45. Resource Sources

Resources should come from:

```text
Campaign
Daily challenges
Roguelite
Bosses
PvP
Guilds
Exploration
Achievements
Events
Discovery
```

Every important activity should have a reason to exist.

---

# 46. Avoid Energy-First Design

Do not make the primary loop:

```text
Play 5 battles
→ Energy depleted
→ Wait
```

The player should always have something interesting to do.

When the player runs out of optimal progression resources, they can still:

- Experiment
- Complete Codex entries
- Practice builds
- Play endless
- Solve challenges
- Review reactions

---

# 47. Relic System

Relics provide another build layer.

Examples:

```text
Flame Crown
Burn lasts +1 turn

Storm Core
Lightning reactions can chain one additional time

Frozen Heart
Frozen enemies take increased damage

Venom Chalice
Poison can stack one additional time

World Seed
Nature reactions have a chance to spread
```

Relics should interact with elements rather than merely provide raw stats.

---

# 48. Artifact Rarity

Use:

```text
Common
Uncommon
Rare
Epic
Legendary
Mythic
```

But rarity should not be the primary source of power.

A lower-rarity artifact with perfect synergy should sometimes outperform a higher-rarity artifact.

---

# 49. Equipment

Keep equipment relatively simple.

Possible slots:

```text
Weapon
Core
Relic
Catalyst
Charm
```

Equipment can modify:

```text
Element affinity
Reaction chance
Reaction intensity
Cooldown
Status duration
Critical reactions
Chain length
```

---

# 50. Talent System

Each player has a permanent talent tree.

Branches:

```text
Alchemy
Combat
Discovery
Exploration
Research
Economy
```

Examples:

```text
Alchemy:
+1 experimental slot

Combat:
+reaction energy

Discovery:
higher chance of discovering hints

Research:
faster research

Exploration:
additional expedition reward
```

Avoid excessive raw-stat inflation.

---

# 51. Element Evolution

Elements can eventually evolve.

Example:

```text
Fire
 ↓
Greater Fire
 ↓
Inferno
 ↓
Solar Flame
 ↓
Celestial Fire
```

Evolution should change behavior, not just numbers.

---

# 52. Element Specialization

Let players specialize an element.

Example:

### Fire

```text
Inferno specialization
→ damage

Ember specialization
→ DoT

Phoenix specialization
→ resurrection

Volcanic specialization
→ area control
```

This makes duplicate elemental ownership meaningful.

---

# 53. Duplicate Elements

Duplicates should never feel useless.

Possible system:

```text
Duplicate Fire
→ Fire Essence
→ Fire Mastery
→ Evolution material
→ Alternative specialization
```

Players can also maintain multiple builds using the same element.

---

# 54. Collection Philosophy

Do not make collection simply:

```text
Owned / Not Owned
```

Instead:

```text
Discovered
Mastered
Evolved
Specialized
Used in Combat
Used in Winning Build
Used in Reaction Chain
```

---

# 55. Daily Content

Daily activities should encourage experimentation.

Examples:

### Daily Reaction

```text
Discover a reaction involving Fire.
```

### Daily Element

```text
Win using Water.
```

### Daily Restriction

```text
No Fire allowed.
```

### Daily Puzzle

```text
Create a chain of 3 reactions.
```

---

# 56. Weekly Content

Examples:

```text
Weekly elemental mutation
Weekly boss
Weekly roguelite modifier
Weekly PvP season
Weekly discovery challenge
Weekly guild experiment
```

---

# 57. Live Events

New elements can be introduced through events.

Example:

### Celestial Festival

New:

```text
Star
Moon
Cosmic Dust
Gravity
```

New reactions:

```text
Star + Fire
Moon + Shadow
Gravity + Earth
```

Events should add actual mechanics, not merely skins.

---

# 58. Content Generation Strategy

The system should allow designers to define an element using data.

Example:

```json
{
  "id": "fire",
  "tags": ["fire", "heat", "burn"],
  "effects": ["burn"],
  "affinities": {
    "water": "steam",
    "earth": "magma",
    "wind": "firestorm"
  }
}
```

The engine interprets these definitions.

Do not require programmers to implement every reaction.

---

# 59. Reaction Definition

Use a data structure similar to:

```json
{
  "id": "steam",
  "inputs": ["fire", "water"],
  "output": "steam",
  "tags": ["heat", "vapor"],
  "effects": [
    "create_steam_cloud",
    "apply_wet",
    "reduce_visibility"
  ]
}
```

Eventually support conditions:

```json
{
  "conditions": [
    "target_is_wet",
    "temperature_above_threshold"
  ]
}
```

---

# 60. Reaction Engine Architecture

Recommended pipeline:

```text
Combat Event
     ↓
Element Detector
     ↓
Reaction Resolver
     ↓
Condition Evaluator
     ↓
Reaction Result
     ↓
Effect Generator
     ↓
Combat Event Queue
     ↓
Next Reaction
```

Use an event-driven architecture.

---

# 61. Determinism

Combat simulation should be deterministic.

Given:

```text
Same Team
Same Enemy
Same Seed
Same Rules
```

the result should be identical.

This is extremely important for:

- Replays
- PvP
- Debugging
- Leaderboards
- Battle reports
- Automated testing

Use seeded RNG.

---

# 62. Battle Replay

Store a compact battle seed plus relevant configuration rather than recording every frame.

Replay:

```text
Team configuration
Enemy configuration
Game version
Random seed
Battle rules
```

This allows deterministic reconstruction.

---

# 63. Battle Report

After every battle show:

```text
Victory

Damage:
Fire 42%
Lightning 31%
Poison 27%

Reactions:
Steam × 7
Conductive × 4
Chain Lightning × 9

Most valuable reaction:
Conductive

New discovery:
Storm Surge
```

This teaches players.

---

# 64. Post-Battle Learning

The battle result should answer:

> "Why did I win?"

and:

> "What could I experiment with next?"

Example:

```text
Your Water attacks triggered
7 Lightning reactions.

Try:
Lightning + Water + Wind
```

This turns the game into a continuous tutorial.

---

# 65. Experiment Laboratory

Create a dedicated screen:

```text
┌─────────────────────────────┐
│        ALCHEMY LAB          │
│                             │
│     🔥      +      💧       │
│                             │
│          [ COMBINE ]        │
│                             │
│      Result: ???            │
│                             │
│     Recent discoveries      │
└─────────────────────────────┘
```

Support:

- Drag and drop
- Tap-to-select
- Search
- Favorites
- Recent combinations
- Auto-complete
- History
- Discovery hints

---

# 66. Experiment UX

Combining must be extremely fast.

Target:

```text
Select element
+
Select element
=
Result
```

Ideally:

< 2 seconds from selection to result.

The player should be able to perform dozens of experiments quickly.

---

# 67. Discovery Feedback

Use:

- particles
- screen shake
- elemental sound
- color transformation
- icon transformation
- card reveal
- short animation
- haptic feedback

Do not overdo it.

Rare discoveries should have stronger presentation.

---

# 68. Discovery Rarity

Not every reaction should be equally difficult.

Use:

```text
Common
Uncommon
Rare
Epic
Legendary
Secret
Mythic
```

Example:

```text
Fire + Water
→ Steam
Common

Fire + Lightning
→ Plasma
Rare

Light + Shadow + Eclipse condition
→ Singularity
Mythic
```

---

# 69. Hint System

Never completely frustrate players.

Hints should progressively reveal information.

Level 1:

```text
"This reaction involves Fire."
```

Level 2:

```text
"The second element is related to storms."
```

Level 3:

```text
"Try Lightning."
```

Level 4:

```text
Reveal recipe
```

Hints should cost a resource or have limited availability.

---

# 70. Anti-Brute-Force Design

Do not allow players to solve everything by blindly trying every pair.

Use:

- thematic clues
- lore
- visual hints
- reaction categories
- partial recipes
- quests
- NPC suggestions
- elemental relationships

Example:

NPC:

> "Lightning behaves strangely around water."

This teaches:

```text
Lightning + Water
```

without explicitly giving the answer.

---

# 71. Discovery Quests

Examples:

```text
Create your first weather reaction.

Create three reactions involving Fire.

Discover a reaction without using a hint.

Create a chain containing three elements.

Defeat an enemy using a reaction you discovered today.
```

---

# 72. Element Relationships

Create an affinity matrix.

Example:

| Element | Strong Against | Weak Against | Special |
|---|---|---|---|
| Fire | Nature, Ice | Water | Burn |
| Water | Fire | Lightning | Wet |
| Lightning | Water | Earth | Shock |
| Ice | Water | Fire | Freeze |
| Nature | Earth | Fire | Growth |
| Earth | Lightning | Nature | Armor |
| Wind | Fire | Earth | Spread |
| Poison | Nature | Light | Toxic |
| Light | Shadow | Void | Purify |
| Shadow | Light | Nature | Drain |

This is only the starting framework.

Do not make the matrix deterministic enough that every battle becomes a rock-paper-scissors puzzle.

---

# 73. Environmental Combat

Eventually arenas should contain environmental states.

Examples:

```text
Rain
Snow
Volcanic
Forest
Desert
Night
Storm
Corrupted
Holy
Void
```

Environmental states modify reactions.

Example:

```text
Rain:
Water reactions +50%

Volcanic:
Fire reactions spread more easily

Night:
Shadow reactions stronger

Holy:
Light reactions purify faster
```

---

# 74. Battlefield Objects

Add interactive objects:

```text
Water pools
Oil pools
Explosive crystals
Trees
Ice walls
Lightning rods
Poison clouds
Stone pillars
```

Elements can interact with them.

This creates more visual variety without requiring complicated environments.

---

# 75. Automation

Players should eventually automate repetitive systems.

Examples:

```text
Auto-collect
Auto-experiment known recipes
Auto-craft
Quick battle
Battle simulation
Auto-claim
```

But discovery itself should never be fully automated.

---

# 76. Long-Term Endgame

The game must not have a traditional:

> "You completed everything."

state.

Endgame systems:

```text
Infinite Dungeon
Infinite Alchemy
Seasonal Reactions
Procedural Bosses
Competitive PvP
Guild Wars
Weekly Mutations
Element Mastery
Build Optimization
Collection Completion
Secret Discoveries
Community Experiments
```

---

# 77. Infinite Alchemy Mode

An endgame mode where the rules constantly change.

Example:

```text
This week:

Fire reactions can chain twice.

Water is unstable.

Shadow has a 10% chance to duplicate.

Nature grows every 10 seconds.
```

Players must adapt their builds.

---

# 78. Procedural Challenges

Generate challenges from rules.

Example:

```text
Win with:
Fire + Water

while:
No healing

against:
Ice enemies

using:
Maximum 3 relics
```

Because the underlying systems are composable, thousands of challenges can be generated.

---

# 79. Meta Progression

The player account should have:

```text
Alchemy Level
Research Level
Discovery Level
Combat Level
Mastery
Collection Score
```

But avoid turning everything into meaningless numbers.

Every progression system must unlock something tangible.

---

# 80. Player Profile

Display:

```text
Total discoveries
Rare discoveries
Elements mastered
Favorite element
Highest reaction chain
Highest boss defeated
PvP rank
Longest roguelite run
```

This creates identity.

---

# 81. Achievements

Examples:

```text
First Reaction
100 Discoveries
500 Discoveries
First Secret
10 Reaction Chain
Win Without Fire
Defeat Boss With Poison
Discover 5 Legendary Reactions
Create 100 Different Builds
```

---

# 82. Mobile UX

Design for one-handed play.

Primary navigation:

```text
Home
Battle
Alchemy
Collection
Research
Shop
```

Use large touch targets.

Avoid tiny controls.

---

# 83. Home Screen

Show:

```text
Current objective
Latest discovery
Campaign progress
Available rewards
Quick Battle
Alchemy shortcut
Daily experiment
```

The home screen should immediately communicate:

> "There is something interesting to discover."

---

# 84. Collection UI

Use cards.

Each element card:

```text
Icon
Name
Rarity
Tier
Mastery
Known reactions
Unknown reactions
```

Tap → detailed page.

---

# 85. Element Detail Page

Display:

```text
Element

Lore

Mastery:
██████░░░░

Combat properties

Known reactions

Possible interactions

Used by:

[Teams]

Discoveries involving this element
```

---

# 86. Accessibility

Implement:

- scalable text
- color-independent status indicators
- high contrast
- readable icons
- reduced animation mode
- reduced screen shake
- haptic toggle
- sound controls
- left/right-handed options
- screen-reader labels where applicable

Never communicate an important gameplay state through color alone.

---

# 87. Performance Requirements

Mobile performance is critical.

Target:

```text
60 FPS
```

on mid-range supported devices.

Avoid:

- unnecessary allocations
- excessive particle systems
- uncontrolled object creation
- giant UI hierarchies
- per-frame LINQ
- expensive reflection in combat
- excessive network calls

Use:

- object pooling
- cached data
- event queues
- compact battle state
- deterministic simulation

---

# 88. Technical Architecture

Use a modular architecture.

Recommended modules:

```text
AlchemyWars.Core
AlchemyWars.Elements
AlchemyWars.Reactions
AlchemyWars.Combat
AlchemyWars.Units
AlchemyWars.Progression
AlchemyWars.Inventory
AlchemyWars.Campaign
AlchemyWars.Roguelite
AlchemyWars.PvP
AlchemyWars.Guilds
AlchemyWars.UI
AlchemyWars.Audio
AlchemyWars.Save
AlchemyWars.Network
```

Keep core game logic independent from UI.

---

# 89. Data-Driven Content

All game content should be represented through data.

Examples:

```text
ElementDefinition
ReactionDefinition
UnitDefinition
AbilityDefinition
StatusEffectDefinition
RelicDefinition
EnemyDefinition
BossDefinition
QuestDefinition
RewardDefinition
ResearchDefinition
```

Avoid embedding balance numbers directly in gameplay code.

---

# 90. Versioned Content

Every content definition should support:

```text
Id
Version
Enabled
ReleaseDate
Tags
BalanceData
```

This allows live updates.

---

# 91. Save System

Save:

```text
PlayerId
AccountProgress
Elements
Discoveries
Masteries
Research
Inventory
Teams
Relics
Campaign
Achievements
Settings
```

Discovery data should be authoritative on the server for online play.

---

# 92. Server Architecture

If online functionality is implemented, separate:

### Client

Responsible for:

- rendering
- input
- animations
- UI
- local simulation

### Server

Responsible for:

- account
- progression
- inventory
- PvP validation
- leaderboard
- rewards
- purchases
- authoritative discovery state

---

# 93. Battle Validation

For competitive modes:

```text
Client submits:
Team
Configuration
Seed/request

Server validates:
Ownership
Rules
Stats
Loadout
```

The server should not blindly trust client-provided results.

---

# 94. Analytics

Instrument important actions.

Track:

```text
tutorial_started
tutorial_completed
element_discovered
reaction_discovered
experiment_attempted
hint_used
battle_started
battle_won
battle_lost
boss_defeated
roguelite_started
roguelite_completed
pvp_started
pvp_finished
```

Especially track:

```text
time_to_first_discovery
time_between_discoveries
failed_experiment_count
hint_usage
reaction_usage
```

These metrics tell whether the discovery loop works.

---

# 95. Important Product Metrics

Monitor:

```text
D1 retention
D7 retention
D30 retention

Average session length

Experiments/session

Discoveries/session

Battles/session

Reaction usage diversity

Players reaching campaign milestones

Players returning after discovering new content
```

Do not optimize solely around monetization.

The primary metric should be whether the game remains interesting.

---

# 96. Monetization Philosophy

Monetization should not destroy experimentation.

Avoid:

```text
Pay to discover combinations
Pay to use elements
Energy walls everywhere
Hard PvP power selling
Aggressive forced ads
```

Possible monetization:

```text
Cosmetics
Battle pass
Optional rewarded ads
Convenience
Extra loadout slots
Cosmetic laboratory themes
Animated element skins
Profile cosmetics
Optional premium progression track
```

---

# 97. Gacha

If a randomized acquisition system is eventually used, do not make it the core identity.

The central collection should remain:

> discovery + experimentation.

Players should be able to obtain important gameplay systems through normal play.

---

# 98. Tutorial

The first 10 minutes should teach the entire core loop.

### Minute 0–2

Introduce:

```text
Fire
Water
```

Combine:

```text
Fire + Water → Steam
```

### Minute 2–4

Introduce combat.

### Minute 4–6

Introduce reaction effects.

### Minute 6–8

Introduce team construction.

### Minute 8–10

Let the player discover something independently.

The player should perform their first **self-directed experiment** as early as possible.

---

# 99. Tutorial Philosophy

Do not explain every system.

Teach:

```text
Experiment
Observe
Understand
Apply
```

Then let the player discover the rest.

---

# 100. Vertical Slice

Before implementing the complete game, build a vertical slice containing:

### Elements

```text
Fire
Water
Earth
Wind
Lightning
Ice
Nature
Poison
Light
Shadow
```

### Reactions

Approximately 25.

### Units

10–15.

### Enemies

10.

### Bosses

2.

### Modes

```text
Campaign
Alchemy Lab
Roguelite
```

### Progression

```text
Element Mastery
Player Level
Research
Relics
```

### UI

```text
Home
Battle
Alchemy
Collection
Research
Post-battle
```

The vertical slice must already feel like a real game.

---

# 101. Prototype Milestone

First playable prototype:

```text
10 Elements
10 Reactions
3 Units
3 Enemies
1 Boss
1 Arena
1 Alchemy Lab
1 Battle
1 Discovery Codex
```

No monetization.

No PvP.

No guilds.

No massive content.

Goal:

> Determine whether combining + watching reactions + building teams is genuinely fun.

---

# 102. Phase 1 — Core Foundation

Implement:

```text
Project architecture
Data system
Element definitions
Reaction engine
Status system
Combat simulation
Unit system
Basic AI
Save system
Basic UI
```

Deliverable:

> Fully playable combat prototype.

---

# 103. Phase 2 — Discovery

Implement:

```text
Alchemy Lab
Combination UX
Reaction graph
Codex
Discovery animations
Hints
Discovery quests
Mastery
```

Deliverable:

> Complete discovery loop.

---

# 104. Phase 3 — RPG Progression

Implement:

```text
Player progression
Element mastery
Research
Relics
Talent tree
Element evolution
Equipment
```

Deliverable:

> A build can meaningfully become stronger and more specialized.

---

# 105. Phase 4 — PvE

Implement:

```text
Campaign
Regions
Enemies
Elite enemies
Bosses
Environmental effects
Battle modifiers
```

Deliverable:

> 5–10 hours of meaningful PvE progression.

---

# 106. Phase 5 — Roguelite

Implement:

```text
Run generation
Temporary upgrades
Drafting
Mutators
Elite encounters
Bosses
End-of-run rewards
Leaderboards
```

Deliverable:

> Repeatable experimentation mode.

---

# 107. Phase 6 — Social

Implement:

```text
Accounts
Friends
Async PvP
Guilds
Leaderboards
Discovery sharing
Challenges
```

---

# 108. Phase 7 — Live Operations

Implement:

```text
Season framework
Events
New elements
New reactions
New bosses
New regions
Weekly challenges
Balance configuration
Remote content configuration
```

---

# 109. Phase 8 — Endgame

Implement:

```text
Infinite Dungeon
Infinite Alchemy
High-level research
Mastery
Advanced PvP
Guild content
Procedural challenges
Secret reactions
Mythic discoveries
```

---

# 110. Testing Strategy

The combination engine requires unusually extensive automated testing.

For every reaction test:

```text
Input A
Input B
Expected reaction
Expected output
Expected effects
```

Example:

```text
Fire + Water
→ Steam

Lightning + Water
→ Conductive

Fire + Earth
→ Magma
```

---

# 111. Property-Based Testing

Test properties such as:

```text
Combining the same pair should always produce the same result
unless the reaction explicitly depends on context.

Reaction chains must terminate.

Reaction loops must not produce infinite recursion.

Unknown combinations must never corrupt inventory.

Removing an element must correctly update dependent systems.

Battle replay must remain deterministic.
```

---

# 112. Balance Simulation

Build developer tools that simulate thousands of battles.

For each build calculate:

```text
Win rate
Average damage
Average survival
Reaction frequency
Reaction contribution
Time to victory
```

This will be essential once hundreds of combinations exist.

---

# 113. Reaction Balance

Do not balance every reaction independently.

Balance the primitives.

For example:

```text
Burn
Freeze
Shock
Poison
Chain
Explosion
Spread
```

Then derived reactions inherit predictable behavior.

This makes hundreds/thousands of combinations manageable.

---

# 114. Content Scaling

The architecture should eventually support:

```text
100+ base elements
1,000+ reactions
100+ status interactions
100+ relics
100+ units
100+ enemies
50+ bosses
```

But do not build all of these manually before validating the game.

---

# 115. Procedural Combination Generation

Create developer tooling capable of proposing possible reactions.

Example:

```text
Input:
Fire
Lightning

Existing tags:
Heat
Electricity

Candidate:
Plasma
```

The tool should flag:

```text
Duplicate concepts
Overpowered combinations
Unused elements
Dead-end elements
Missing counterplay
```

The final designer still approves reactions.

---

# 116. Reaction Quality Rules

Every new reaction should satisfy at least one:

```text
Creates a new strategic option
Creates a new build archetype
Creates an interesting counter
Creates a new chain
Creates environmental interaction
Creates a meaningful discovery
```

Avoid combinations that exist merely because:

```text
A + B = C
```

with no gameplay consequence.

---

# 117. Dead-End Prevention

Every element should ideally have:

```text
Multiple inputs
Multiple outputs
Multiple combat applications
At least one strategic niche
```

Avoid elements that only participate in one reaction.

---

# 118. Build Diversity

The system should support builds such as:

```text
Pure damage
DoT
Control
Tank
Healing
Shield
Reaction chain
Crit
Summoning
Poison
Burn
Freeze
Lightning
Reflect
Resource generation
Glass cannon
Slow defensive scaling
```

No single archetype should dominate.

---

# 119. Discovery vs Optimization

The game should have two different player fantasies.

### Explorer

> "What can I discover?"

### Optimizer

> "How can I make this build stronger?"

Both must be equally supported.

Explorer progression:

```text
Codex
Discovery
Lore
Secret reactions
Collection
```

Optimizer progression:

```text
Mastery
Relics
Talents
Equipment
PvP
Endgame
```

---

# 120. Anti-Power-Creep Strategy

When adding new elements, do not simply create:

```text
Fire 2.0
```

Instead introduce:

```text
new mechanics
new interactions
new strategies
```

Example:

Old:

```text
Fire = damage
```

New:

```text
Gravity = positioning
```

This creates new gameplay rather than replacing old content.

---

# 121. Content Expansion Model

Every new element should ideally generate:

```text
1 element
+
5–15 reactions
+
1–3 relic interactions
+
1–2 enemies
+
1 quest
+
1 lore entry
+
1 challenge
```

Therefore one content release can generate substantial new gameplay.

---

# 122. Seasonal Example

Season:

## The Age of Storms

Add:

```text
Storm
Cloud
Thunder
Pressure
```

New mechanics:

```text
Weather
Lightning chains
Air pressure
Conductivity
```

New boss:

```text
Tempest Titan
```

New roguelite modifier:

```text
Every Lightning reaction increases storm intensity.
```

This is substantially more meaningful than adding a cosmetic event.

---

# 123. Developer Tools

Build an internal:

## Alchemy Editor

Capabilities:

```text
Create element
Create reaction
Create status
Create enemy
Create relic
Preview interaction
Test reaction
Simulate combat
Inspect event chain
```

Also include:

```text
Reaction Graph Viewer
```

and:

```text
Combat Simulation Tool
```

These tools will dramatically accelerate content creation.

---

# 124. Debug Mode

Implement a developer overlay showing:

```text
Current battle state

Active effects

Element applications

Reaction events

Reaction chain depth

Damage sources

Cooldowns

AI decisions

RNG seed
```

Example:

```text
[12.42]
Lightning Hit
Target: Slime

Wet detected

REACTION:
Conductive

Damage:
142

Chain:
1/3
```

---

# 125. AI Agent Development Rules

The coding agent must follow these rules.

### Rule 1

Do not implement giant systems in one pass.

### Rule 2

Every major system must have tests.

### Rule 3

Keep gameplay data separate from logic.

### Rule 4

Never hardcode individual reactions inside unrelated combat classes.

### Rule 5

Prefer composable systems.

### Rule 6

Do not add dependencies without justification.

### Rule 7

Do not prematurely build online features.

### Rule 8

Always keep the game playable after each milestone.

---

# 126. Agent Workflow

For every feature:

```text
1. Inspect architecture
2. Identify affected systems
3. Write implementation plan
4. Implement smallest complete version
5. Write tests
6. Run tests
7. Run build
8. Play/test the feature
9. Fix issues
10. Refactor
11. Document
```

Never skip testing.

---

# 127. Iterative Review Loop

After every major milestone, perform:

```text
Architecture review
Gameplay review
UX review
Performance review
Balance review
Accessibility review
Code quality review
```

Repeat up to 10 iterations or until no significant issues remain.

---

# 128. Definition of Done

A feature is complete only when:

```text
✓ Implemented
✓ Integrated
✓ Tested
✓ Error handled
✓ Saved correctly
✓ Loaded correctly
✓ Mobile friendly
✓ Accessible
✓ Performant
✓ Data-driven
✓ Documented
✓ No major warnings/errors
```

---

# 129. First Implementation Priority

Do NOT begin by building:

- shop
- login
- guilds
- PvP
- battle pass
- hundreds of elements

Instead implement this:

```text
10 Elements
        ↓
Reaction Engine
        ↓
10–20 Reactions
        ↓
3–5 Units
        ↓
Auto Combat
        ↓
Reaction Visualization
        ↓
Alchemy Lab
        ↓
Discovery Codex
```

Then play it.

If this core loop is not fun, additional systems will not save it.

---

# 130. Final MVP

The first serious MVP should contain:

## Elements

10–20

## Reactions

50+

## Units

15+

## Enemies

20+

## Bosses

5+

## Campaign

3 regions

## Roguelite

1 complete mode

## Progression

```text
Element Mastery
Research
Relics
Talents
Evolution
```

## Discovery

```text
Alchemy Lab
Codex
Reaction Graph
Hints
Secret reactions
```

## Social

Optional asynchronous PvP prototype.

---

# 131. The Ultimate Design Goal

The game should eventually reach this experience:

A player sees:

```text
🔥 Fire
💧 Water
⚡ Lightning
🌱 Nature
```

They think:

> "I wonder what happens if..."

They experiment.

They discover:

```text
Fire + Water → Steam
```

Then realize:

```text
Steam + Wind → Storm
```

Then:

```text
Storm + Lightning → Thunderstorm
```

Then discover that their Thunderstorm build can:

```text
Wet enemies
→ Conductive
→ Chain Lightning
→ Shock
→ Stun
→ Trigger Relic
→ Create another Storm
```

They then build an entire team around that discovery.

They enter a boss fight.

The boss destroys them.

They realize:

> "I need a way to keep the Storm alive."

They return to the laboratory.

They discover another interaction.

That interaction creates a new build.

They return to the boss.

They win.

Then a new region introduces an entirely different elemental rule.

That is the intended long-term loop:

```text
CURIOSITY
   ↓
EXPERIMENT
   ↓
DISCOVERY
   ↓
UNDERSTANDING
   ↓
BUILD
   ↓
BATTLE
   ↓
FAILURE
   ↓
ADAPTATION
   ↓
NEW DISCOVERY
   ↓
MASTERY
   ↓
NEW CONTENT
   ↓
CURIOSITY
```

**Do not make the game about collecting 1,000 things.**

Make it about **discovering 1,000 relationships between things.**

That distinction should remain the central design principle throughout development.