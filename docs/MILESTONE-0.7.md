# Milestone 0.7: guardians and campaign encounters

The next specification review found that guardian phases mainly changed numerical multipliers. Campaign memories have a complete narrative, but character encounters and guardian introductions need playable presentation.

Scope:

- Data-defined phases change elements, status immunities, modifiers and triggered behaviors without mutating shared content.
- Five guardians have distinct elemental phases and counterplay; the Plague Mother's infection can be suppressed through elemental statuses.
- Validate phase ordering, references, behaviors and effects before content packs are installed.
- Record effective unit damage, healing, shield grants/absorption, cleanses and reaction support independently of bounded event logs.
- Show guardian preparation notes, phase changes, a snapshot inspector and contribution reports; persist observed creature mechanics.
- Add short illustrated character scenes before and after selected campaign encounters, with optional recovered scenes in the codex.
- Verify determinism, counterplay, save/replay and authority, campaign reachability, browser flows and seeded balance. Update coverage after verification.

Completed as version 0.7.0. Strict TypeScript, content validation, production build, 245 engine/server tests and 44 desktop/mobile browser tests pass. All 63 campaign encounters retain verified winning routes, and browser tests complete all eight roguelite floors. The refreshed 5,600-battle batch reports median 8.1 ms and p95 13.32 ms simulation latency; findings are recorded in BALANCE.md. Guardian notes, unit inspection, phase/counter reports and campaign conversations were visually reviewed at both viewports. No new runtime dependency was added.

Human playtesting and real-device performance evaluation remain separate work. The seeded profiles expose late-guardian matchups requiring adaptation; this is not a claim of equal viability for every build.
