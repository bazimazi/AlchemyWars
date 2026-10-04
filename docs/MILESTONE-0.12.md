# Element evolution signatures and workshop

Version 0.12.0 adds eleven family signatures at evolution rank III. Every current element maps to its first recognized family tag; other identities receive Echo Shelter. Elements retain their existing IDs, recipes and effects. The three existing rank bonuses remain: longer core-applied statuses, a secondary-target strike shared with mastery splash, and an opening core ward.

| Signature | Trigger | Additional effect | Cooldown |
|---|---|---|---:|
| Kindling Trail | Elemental cast | Light Burn on up to two enemies | 8 seconds |
| Tidal Rinse | Elemental cast | Cleanse one harmful status from its vessel | 8 seconds |
| Stone Resolve | Elemental cast | Brief Taunt on its vessel | 10 seconds |
| Tailwind | Elemental cast | Brief Haste on its vessel | 10 seconds |
| Grounding Pulse | Matching reaction | Brief Resistance Break on the enemy | 8 seconds |
| Glacial Shelter | Matching reaction | Shield the weakest ally | 10 seconds |
| Living Seed | Elemental cast | Regeneration on the weakest ally | 10 seconds |
| Seeping Dose | Matching reaction | Light Bleed on the enemy | 10 seconds |
| Dawn Window | Matching reaction | Cleanse up to two harmful statuses from the weakest ally | 10 seconds |
| Night Reserve | Elemental cast | Brief Drain on its vessel | 10 seconds |
| Echo Shelter | Matching reaction | Shield its vessel | 10 seconds |

Signatures work in core and secondary slots. Cast triggers require the actual equipped element and exclude named ability casts. Reaction triggers require that the triggered recipe uses or produces that equipped element. Duplicate slots cannot duplicate a signature. Each vessel and element retains its own cooldown; Silence suppresses activation without spending that cooldown. All effects use the existing interpreted effect system and event bounds. Trait validation checks IDs, unique family tags, a single fallback, trigger/cooldown limits and effect/status references.

The workshop previews all three ranks for the selected element. Ranks I, II and III cost 60/120/180 gold and 15/30/45 essence, requiring 15/30/45 mastery XP respectively. Mastery is retained. The same shared state controls displayed prices, disabled actions and actual spending. Unowned or disabled elements cannot evolve. Purchases retain the selected element and keyboard focus; only compatible specializations appear, unlock at rank I and remain free to switch. Collection detail explains the element's signature and whether it is unlocked.

Launched battles capture the earned ranks and active signatures. Inspection shows signature descriptions and named cooldowns; reports count activations by vessel and element independently of clipped event logs or frame capture. Effective damage, healing, shields and cleanses remain in existing contribution records without double counting. An activation can have no effective gain, such as cleansing a clean vessel. Normalized competition and loaned runs exclude account signatures. Fractional saved ranks normalize to integers while valid earned ranks remain compatible. Concurrent server commands serialize exact spending; changing the account after launch cannot alter the issued battle or its replay.

Verification passed strict TypeScript compilation, content validation, production build, **344 engine/server tests and 80 desktop/mobile browser checks**. This includes 23 new unit/server checks and six new browser checks. Coverage exercises all eleven real signature effects, matching/nonmatching triggers, secondary slots, cooldowns, Silence, normalized fairness, migration, issued snapshots, concurrent purchases and restart/replay persistence. Browser checks cover prices, resource/mastery gates, compatible free specialization, keyboard focus, selection, inspection, reports and reloads. Workshop stages, costs and signature reports were visually reviewed at both viewports. The offline manifest includes all three new modules and the cache/content versions advance.

The refreshed unevolved campaign sample covers **5,600 battles** in 34.41 seconds, with 5.38 ms median simulation and 11.07 ms p95. All 56 matchup result rows retain their prior win/draw rates, durations, reaction damage shares and survivors. The separate [evolution report](EVOLUTION-BALANCE.md) covers **1,120 battles** in 6.08 seconds, with 5.16 ms median and 8.68 ms p95. All sampled matchups reached 100% wins except developed Storm against Eclipse at 85%; the starter retains no upgrades. These fixed formations are not optimal play, and this evolved sample includes existing rank bonuses alongside the new signatures, so it does not isolate their individual balance impact. Different seed counts and shared-machine timing prevent a controlled performance comparison. Simulation latency does not establish rendering frame rate.

The refreshed [run report](RUN-BALANCE.md) covers **280 runs / 2,384 battles** in 6.63 seconds, with unchanged fixed-policy outcomes and a sixteen-floor ceiling. Account evolution is absent from these loaned runs. Winning campaign routes through all 63 encounters and an eight-floor browser roguelite completion remain verified. CI includes smaller unevolved, evolved and run balance samples.

The catalog remains 137 recipes and 87 usable elements, below the illustrative 500-discovery achievement. Human campaign duration, long-term enjoyment, assistive-technology accessibility, physical-device 60 FPS and operating a hosted multiplayer community require separate validation or operation. Optional payment and gacha branches remain omitted as permitted by the specification.
