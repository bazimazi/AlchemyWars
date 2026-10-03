# Milestone 0.8: run experimentation and build drafts

The next review found that runs have temporary elements but no drafted relics or passives. Their traveling laboratory cannot model conditional targets, and rest choices are frequently cut off by the three-card draft limit. Endless modes retain one rule for an entire descent.

Scope:

- Draft temporary relics and passives, equip them within the run, and configure run targeting and reaction priorities.
- Offer rest after every continuing victory alongside reproducible build choices.
- Model conditional targets in the traveling laboratory, persist its scenario and keep account mastery/research separate.
- Change deterministic floor rules in endless modes, display the current rule and preserve launched battle snapshots.
- Normalize old and malformed run saves, protect authoritative commands during issued battles, and verify deterministic replay and once-only retirement rewards.
- Verify full campaign/run reachability, desktop/mobile flows and seeded simulation evidence before updating coverage.

Completed as version 0.8.0. Strict TypeScript, content validation, production build, 262 engine/server tests and 52 desktop/mobile browser checks pass. All 63 campaign encounters retain winning routes, and browser tests complete an eight-floor roguelite. The 5,600-battle campaign batch reports median 4.69 ms and p95 6.89 ms simulation latency. A dedicated run batch covers 280 runs and 2,384 battles, normalizing saves between encounters. Conditional experiments honor suppressed rule tags and retain eligible alternate recipes. Run tools, laboratory scenarios and mutation explanations were visually reviewed at both viewports. CI includes a run simulation sample; no new runtime dependency was added.

Human playtesting and physical-device performance remain separate validation work. Fixed benchmark policies have losses and do not claim optimal play or equal build viability.
