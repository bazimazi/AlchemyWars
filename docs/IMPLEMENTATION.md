# Playable prototype plan

This milestone implements the first priority in sections 101 and 129 of the supplied specification. The repository starts empty, with no engine or platform prescribed. A dependency-free browser client makes the mobile discovery loop immediately playable. The simulation uses plain ES modules and can be reused in a different renderer.

1. **Foundation:** versioned content definitions, indexed reaction resolution, composable effects, seeded fixed-step combat, loop guards, and tests.
2. **Discovery:** a tap/drag laboratory, contextual experiments, reveal feedback, reusable derived elements, hints, history, favorites, and a fogged codex graph.
3. **Construction and combat:** five customizable vessels, formation, targeting, reaction priorities, relics, three encounters including a boss, battle playback and reports.
4. **Persistence and progression:** validated versioned saves, backup recovery, export/import, discovery rewards, mastery, and three mechanical research unlocks.
5. **Review:** run engine/save/content tests, production build, seeded balance simulations, browser playthrough, and mobile/accessibility inspection. Record any scope limitations.

## Module boundaries

- `src/data/content.js`: elements, reaction rules, statuses, vessels, enemies, relics, research, encounters, and all balance values.
- `src/core/reactions.js`: indexed unordered-pair resolution and context evaluation. No DOM or persistence.
- `src/core/combat.js`: fixed-step deterministic simulation, event queue, effect primitives, targeting, bounded chains, replay frames and reports. No DOM or storage.
- `src/core/progression.js`: experiments, reward claims, mastery, research, and team validation.
- `src/core/save.js`: schema normalization, migrations, resilient storage, import/export.
- `src/ui/`: presentation, semantic controls, animation, SVG artwork and audio feedback.
- `scripts/`: dependency-free local server, validated production build and balance tool.

## Scope

This is an offline playable prototype, not the final MVP or the later vertical slice. It contains 10 base elements, 20 reactions/derived elements, 5 vessels, 3 enemy archetypes, 1 boss, and 3 campaign encounters in one arena. Research and relics are deliberately small. Roguelite, accounts, online authority, PvP, guilds, live operations, equipment/talents and monetization belong to later milestones. No runtime or development dependencies are needed.
