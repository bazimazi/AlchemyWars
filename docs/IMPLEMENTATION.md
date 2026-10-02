# Implementation and operation

## Architecture

All authored game, server, tool, service-worker and test code is TypeScript. `tsconfig.json` enables strict checking, unused-import checking and no emit on errors; `tsconfig.worker.json` checks the service worker with browser-worker globals. Shared contracts live in `src/types.ts` and `server/types.ts`. Combat effects use a discriminated union. Untrusted save and pack inputs are validated at runtime. [TypeScript NodeNext modules](https://www.typescriptlang.org/docs/handbook/modules/reference) preserve `.js` import specifiers for emitted ES modules. The compiler and `@types/node` are build-only dependencies.

`npm run compile` writes private build output to `.build/`. `npm run build` publishes only compiled browser modules, CSS, assets, HTML and the service worker to `dist/`, then generates its offline asset manifest. The service worker registers as a module. `npm run dev` watches source, styles and content, recompiles changes serially and restarts only its own server process. Type errors prevent publishing a new build.

`src/data/` contains versioned element, reaction, unit, enemy, boss, status, relic, progression, environment, seasonal and story definitions. `src/core/` implements deterministic combat, indexed reactions, progression commands, runs, trials, replay validation, content authoring and saves. `src/ui/` renders the game using browser APIs and original SVG artwork. `server/` provides authenticated, authoritative progression and community operations with an atomic file-backed store.

The simulation runs at a fixed quarter-second timestep with seeded randomness. Playback consumes snapshots independently of simulation speed. Replays retain the seed, content version, formation, progression modifiers, opponent/generated encounter, arena rules and starting health. Chain depth, passive cooldowns, per-action event limits, summon limits and the 90-second battle limit bound execution. The recipe index is tested with 10,000 rules.

Effects compose through damage, statuses, healing, shields, cleanse, chain, spread, element application, explosion, resurrection, summons and transformation. Fourteen event categories can trigger passives. Conditions support status, environment, health, neighboring enemy count, target tags, shielding and mastery. No individual recipe is hardcoded into the combat engine.

The client and server call the same validated progression commands. The client never submits an authoritative battle outcome, damage figure, reward amount or chosen online seed. The server snapshots an issued battle and computes its result before paying. Concurrent claims pay once. Ranked account mastery, research, talents and evolution are normalized. Drafted PvP loans both participants complementary pools and equal starting vessels. Guild-war claims are recorded on the account as well as the guild, preventing repeated weekly points or gold after changing guilds. Season leaderboards display reset ratings immediately, including accounts that have not played their first new-season duel.

## Local and online saves

Local schema version 1 saves are normalized on import and load. Old prototype saves receive defaults for new features. The previous healthy journal is retained as a backup. Export/import is limited to 1 MB. Invalid or stale references are repaired or removed. Active runs and campaign, run, trial and PvP replay configurations survive saving.

Account-service startup is bounded to 2.5 seconds so local play still opens when that service is unreachable. Online requests have a 10-second timeout; retrying battle settlement uses the original idempotent battle ID.

Online data lives in `DATA_DIR/world.json`, with a previous healthy `.backup`. A transaction clones state, writes a temporary file, then atomically renames it. Failed mutations never replace the database. If the primary file is damaged, the server recovers from the backup without overwriting it with the damaged primary. Both unreadable files cause startup to stop, preserving the evidence for recovery.

This storage adapter is intended for one server process and modest communities. Do not start multiple processes against the same data directory. Back up the directory while the process is stopped. For larger deployment, replace Store with a transactional database adapter before adding multiple replicas. No deployment or public service has been provisioned by this repository.

Passwords use salted scrypt hashes. Sessions use random tokens, only their hashes are stored, and cookies are HttpOnly/SameSite Strict. The HTTP boundary enforces origin checks, request limits, rate limits, a static-file allowlist and a content security policy. Administrative endpoints require a bearer secret. There is no email collection or password-reset email service; accounts are name/password accounts on the operator's server.

## Serve the production build

Run `npm run build`, then `node .build/scripts/serve.js --dist` from the repository root. A static host can serve `dist/` for offline/local play; Assembly functionality requires the Node server.

Configuration variables:

| Variable | Default | Purpose |
|---|---|---|
| HOST | 127.0.0.1 | Listening interface |
| PORT | 5173 | HTTP port |
| DATA_DIR | .data | Persistent private world directory |
| PUBLIC_ORIGIN | request host over HTTP | Exact accepted origin behind a proxy |
| SECURE_COOKIES | unset | Set to 1 with HTTPS |
| ADMIN_TOKEN | unset | Long random secret enabling admin endpoints |

Use HTTPS at the reverse proxy for an internet deployment, set PUBLIC_ORIGIN to its exact origin, and set SECURE_COOKIES=1. Keep the private data directory outside the published static tree. `.env.example` documents the settings; Node can read a configured file with `node --env-file=.env .build/scripts/serve.js`.

`GET /api/status` is a public health/configuration check. `POST /api/admin/live` accepts `{ "enabled": true, "seasonName": "Age of Storms", "mutator": "conducting", "announcements": ["The storm has arrived."] }` with `Authorization: Bearer <ADMIN_TOKEN>`. Maintenance disables new online battles; an already-issued battle can still be settled. Rules are captured at battle launch so configuration changes cannot alter an in-progress result. `POST /api/admin/analytics` with an empty object returns aggregate metrics using the same authentication.

Raw gameplay events are bounded to the last 1,000 per account. Daily activity retains 366 days for retention cohorts. Session duration is an estimate based on gameplay and minute heartbeats, excluding gaps over 30 minutes. Empty D1/D7/D30 cohorts report null rates. These are instrumentation outputs, not measured commercial retention claims.

## Content authoring and releases

Enable the battle journal/debug setting to expose the Alchemy Editor in navigation, or visit `/#editor`. Create element, reaction, status, enemy, relic or encounter templates, inspect effects, test an interaction, simulate a formation and inspect the complete event chain. The audit reports invalid references, duplicate concepts, dead ends, unused elements, unusually high effect power and bosses missing counterplay.

Preview installs a validated pack in the current local browser session. Online accounts cannot preview modified rules. Export a reviewed pack and append it to the array in `assets/content-packs.json`; validate with `npm run build`, run tests, and restart the server. Client and server install the same ordered packs. Pack validation checks every effect primitive, nested reaction condition, boss phase effect, status modifier, relic modifier and encounter reference before making any changes. Pack entry IDs are stable, updates increase entry versions, and a reaction's ID matches its derived output element. This convention keeps discovery, collection and progression references stable.

Candidate generation combines tags and effect vocabulary and explicitly marks proposals as requiring designer approval. It does not automatically publish generated reactions. Original hand-authored content remains the default; the 10,000-rule test verifies lookup scale rather than padding the game with filler recipes.

A release's content version is part of every replay. Old progression is migrated, but incompatible historical replays and pending battles are rejected/cleared instead of silently replaying different rules. Archive the old application build and data backup if historical replay playback is required. Remote mutators change runtime battle configuration, while new definitions require a reviewed content release.

## Verification and interpretation

The current suite has 122 unit/integration tests and 14 browser tests. Unit/integration tests cover recipes, conditions, composition, deterministic replay, loop guards, HP/shield invariants, boss phases/immunities, ownership validation, progression spending, malformed saves and commands, recovery, idempotency, authenticated accounts, ranked/drafted PvP, guilds, live settings, social challenges, procedural runs and content scaling.

Browser tests run in isolated Chromium desktop and Pixel 7 emulation contexts. They cover discovery -> equip -> combat -> rewards -> replay -> reload; all screens and horizontal overflow; all eight roguelite floors with reloads; online registration, guild creation, server rewards and sign-in; connected graph; content editor validation; offline reload. CI repeats tests, build and a smaller balance run using the official [setup-node](https://github.com/actions/setup-node) and [checkout](https://github.com/actions/checkout) actions. [Playwright](https://playwright.dev/docs/intro) is justified by these browser checks.

Campaign tests find winning routes through all 63 encounters using three developed compositions; this demonstrates reachability, not that every build wins. The seeded balance report compares seven profiles across 5,600 battles. Mastery power caps at level 10; deeper progression adds mechanics, specialization and collection choices.

The 5-10-hour campaign pacing, 60 FPS on physical mid-range devices, accessibility with actual assistive technologies, long-term build diversity, retention and fun require real-device and human playtesting. There are no purchased cosmetics, premium currency sales, payment integrations or gacha: those branches are optional in the specification, and cosmetic themes use earned gold. Operating ongoing seasons and a hosted multiplayer community requires an operator; release tooling and the local server are implemented here.
