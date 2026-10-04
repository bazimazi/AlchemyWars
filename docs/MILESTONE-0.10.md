# Talent branches and prepared experiments

Version 0.10.0 expands the permanent talent system from one node per branch to eighteen nodes across all six branches in specification section 50.

- Alchemy: Reaction Scholar, Parallel Notes and Recursive Binding. Prepared laboratory experiments gain a second saved slot; reaction chains gain additional depth.
- Combat: Deep Binding, Reaction Conduit and Reactive Ward. Chain effects reach another target, and a vessel triggering a reaction gains a shield worth half its attack once every six seconds.
- Discovery: Careful Notes, Field Clues and Gentle Guidance. First campaign victories have a seeded 35% chance to uncover an accessible stage-one clue; paid hints become one knowledge cheaper.
- Research: Patient Scholar, Focused Study and Applied Research. Research receives a total 30% knowledge discount, and newly completed studies award three essence after the talent is learned.
- Exploration: Field Alchemist, First Survey and Guardian Bounty. First campaign victories award three additional knowledge; first guardian victories award two additional shards.
- Economy: Salvager, Careful Crafting and Material Steward. Gold and essence crafting costs fall by 15% and 20%, rounded up; shard and blueprint requirements remain enforced.

Existing talent IDs, costs and prerequisites remain compatible. The workshop presents branch navigation, completion counts, prerequisite status and keyboard focus after purchases. Production validation rejects missing prerequisites, cycles, duplicate IDs and invalid costs/perks. Imported saves retain complete prerequisite paths; orphan advanced nodes are removed without granting their parents.

The laboratory notebook stores one named prepared experiment by default, or two with Parallel Notes. Save, replace and delete use the same validated commands online and offline. Loading restores both ingredients and the complete sanitized target scenario without performing an experiment or granting discoveries. Actual experiments always use current account research/mastery. Save migration enforces earned capacity, owned ingredients, unique bounded names and deep copies.

The laboratory clue journal retains unresolved hints at their earned stages. Field clues spend no knowledge and do not expose later stages. First-clear rewards/clues cannot repeat for retries or replays. Campaign reports show actual settled gold, knowledge, XP, essence and shards. Combat talents are captured at launch and excluded from normalized competition and loaned runs; progression perks use the account at settlement. Unit inspection recognizes the Reactive Ward cooldown, and contribution reports include its effective shield grants.

Verification: strict TypeScript, content validation and production build; 301 engine/server tests and 68 desktop/mobile browser checks. All 63 campaign encounters retain a winning route, and browser play completes all eight roguelite floors. New browser checks cover prerequisites and keyboard focus, notebook capacity/scenario restoration, discounted spending, research essence, first-clear clues and reloads. Talent branches, notebooks and clue rewards were visually inspected at both viewports.

The refreshed campaign report covers 5,600 seeded battles: 30.49 seconds total, 5.15 ms median simulation and 8.70 ms p95 on this development machine. Developed profiles now include all eighteen talents. Toxic Garden's Eclipse guardian wins rise from 5% to 34%, with draws rising from 32% to 56%; most other win rates retain prior values, with Storm/Tempest and Eclipse/Tempest draw shifts recorded in the report. These results test fixed formations, not optimal play or physical-device frame rate. The run report covers 280 runs / 2,384 battles with reload normalization and a sixteen-floor ceiling; outcomes are unchanged because these runs omit account talents.

Recursive Binding makes the developed account PvE depth ceiling ten when combined with Chain Resonance, Genesis Thread and Echo Catalyst. An earnable ten-link achievement still requires a verified authored route. The illustrative 500-discovery target remains beyond the 128-recipe catalog. Human campaign pacing, assistive-technology accessibility, long-term enjoyment, physical-device performance and hosted community operations remain separate validation work.
