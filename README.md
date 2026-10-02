# Alchemy Wars

A playable discovery-driven auto-battler. Experiment with elements, construct a formation, and watch its reactions interact in deterministic combat.

## Play

Requires Node.js 22 or newer; developed and verified on Node.js 24.

```sh
npm start
```

Open `http://127.0.0.1:5173`. No installation or account is required for local play. For another port in PowerShell: `$env:PORT=5175` before `npm start`.

The Assembly screen creates a separate server-backed account. Local journals remain on the device and can be exported from Settings. Online rewards, opponents, seeds and progression are validated by the server. Local journals cannot be imported into online accounts.

## Included

- 20 primordial elements, 64 reactions and 84 total usable elements; 10 starting elements.
- 15 vessels, 20 regular enemies, five distinct bosses, and 63 campaign encounters across five chapters and a prologue.
- Laboratory, contextual and mastery experiments, secrets, hints, codex, connected discovery graph and recovered story memories.
- Mastery, research, talents, equipment, relics, evolution, specialization, quests, achievements and cosmetic themes.
- Eight-floor roguelite, endless dungeon, changing Infinite Alchemy, daily drafts, procedural boss variants, daily trials, weekly guardians and seasonal festival battles.
- Account persistence, normalized asynchronous PvP, drafted PvP, friends, guild research, raids, guild competition, shared discoveries and player-authored experiment challenges.
- Deterministic replays, contribution reports, debug inspection, internal content editor, versioned content packs, balance simulator and live configuration.
- Responsive desktop/mobile UI, keyboard controls, readable status labels, text scaling, contrast and motion settings, sound/haptic controls, left-handed layouts and offline caching.

## Verify

```sh
npm ci
npx playwright install chromium
npm run verify
npm run balance -- 100 --report
```

`verify` runs engine/server tests, validates and builds `dist/`, then tests desktop and mobile browser flows. Playwright is the only development dependency; it supplies isolated browser automation. The game and server have no runtime dependencies.

`npm run balance -- 100 --all --report` includes every campaign stage. Generated findings are written to [docs/BALANCE.md](docs/BALANCE.md).

## Hosting and development

- [Implementation, architecture and operational notes](docs/IMPLEMENTATION.md)
- [Section-by-section specification coverage](docs/COVERAGE.md)
- [Original specification](docs/SPECIFICATION.md)

The implementation exceeds the specification's numerical MVP content targets. Human campaign duration, retention, long-term enjoyment and physical-device 60 FPS remain validation targets, not claims established by automated tests.
