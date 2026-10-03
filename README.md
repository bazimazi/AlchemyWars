# Alchemy Wars

A playable discovery-driven auto-battler. Experiment with elements, construct a formation, and watch its reactions interact in deterministic combat.

## Play

Requires Node.js 22 or newer; developed and verified on Node.js 24.

```sh
npm ci
npm start
```

Open `http://127.0.0.1:5173`. No account is required for local play. For another port in PowerShell: `$env:PORT=5175` before `npm start`.

The Assembly screen creates a separate server-backed account. Local journals remain on the device and can be exported from Settings. Online rewards, opponents, seeds and progression are validated by the server. Local journals cannot be imported into online accounts.

## Included

- 20 primordial elements, 124 reactions and 87 total usable elements; 10 starting elements.
- 15 vessels, 20 regular enemies, five distinct bosses, and 63 campaign encounters across five chapters and a prologue.
- Laboratory, contextual and mastery experiments, secrets, hints, creature/artifact/lore codex, saved combat chains, connected discovery graph and recovered story memories.
- Configurable ability slots, capped vessel growth and individual vessel animation profiles.
- Mastery, research, talents, equipment, relics, evolution, specialization, quests, achievements and cosmetic themes.
- Eight-floor roguelite, endless dungeon, changing Infinite Alchemy, daily drafts, procedural boss variants, daily trials, weekly guardians and seasonal festival battles.
- Account persistence, normalized asynchronous PvP, drafted PvP, Element Wars, Weekly Crucible, friends, guild missions, elemental exchange, collaborative experiments, raids, guild competition, shared discoveries and player-authored experiment challenges.
- Deterministic replays, contribution reports, debug inspection, internal content editor, versioned content packs, balance simulator and live configuration.
- Responsive desktop/mobile UI, keyboard controls, readable status labels, text scaling, contrast and motion settings, sound/haptic controls, left-handed layouts and offline caching.

## Verify

```sh
npm ci
npx playwright install chromium
npm run verify
npm run balance -- 100 --report
```

`verify` compiles all source and tests with strict TypeScript, runs 192 engine/server tests, validates and builds `dist/`, then runs 20 desktop/mobile browser tests. TypeScript and Node typings provide strict checks; Playwright supplies isolated browser automation. The game and server have no runtime dependencies.

`npm run balance -- 100 --all --report` includes every campaign stage. Generated findings are written to [docs/BALANCE.md](docs/BALANCE.md).

For development, `npm run dev` recompiles source changes and restarts its server. Refresh the browser after a successful build. `npm run typecheck` checks types without generating files.

## Hosting and development

- [Implementation, architecture and operational notes](docs/IMPLEMENTATION.md)
- [Section-by-section specification coverage](docs/COVERAGE.md)
- [Original specification](docs/SPECIFICATION.md)

The implementation exceeds the specification's numerical MVP content targets. Human campaign duration, retention, long-term enjoyment and physical-device 60 FPS remain validation targets, not claims established by automated tests.
