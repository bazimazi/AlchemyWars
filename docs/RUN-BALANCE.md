# Seeded run report

Content 0.11.0. 20 seeds per scenario, with reload normalization between battles. Draft pool and expedition rule use 2026-10-03 UTC. Endless scenarios stop at floor 16; a capped run is not a completed endless mode.

Rest always chooses recovery. Draft chooses a build upgrade/tool when every vessel has at least 60% health, otherwise recovery; it equips the first drafted relic/passive and seeks reactions. These fixed policies explore reproducible routes, not optimal play or human pacing. Account upgrades are absent.

```json
{
  "content": "0.11.0",
  "runs": 280,
  "battles": 2384,
  "elapsedSeconds": 6.28,
  "ceiling": 16
}
```

| Mode | Starting elements | Policy | Clear % | Defeat % | Mean victories | Runs capped | Rest picks | Tool picks | Floor rules seen |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| roguelite | fire + water | Rest | 45 | 55 | 6.7 | 0 | 125 | 0 | 1 |
| roguelite | fire + water | Draft | 40 | 60 | 6.6 | 0 | 98 | 25 | 1 |
| roguelite | light + shadow | Rest | 60 | 40 | 7 | 0 | 128 | 0 | 1 |
| roguelite | light + shadow | Draft | 65 | 35 | 6.9 | 0 | 9 | 83 | 1 |
| endless | fire + water | Rest | - | 100 | 7.4 | 0 | 148 | 0 | 5 |
| endless | fire + water | Draft | - | 100 | 7.4 | 0 | 122 | 25 | 5 |
| endless | light + shadow | Rest | - | 100 | 9 | 0 | 180 | 0 | 5 |
| endless | light + shadow | Draft | - | 100 | 9.3 | 0 | 12 | 122 | 5 |
| infinite-alchemy | fire + water | Rest | - | 100 | 8 | 0 | 160 | 0 | 4 |
| infinite-alchemy | fire + water | Draft | - | 100 | 7.8 | 0 | 128 | 28 | 4 |
| infinite-alchemy | light + shadow | Rest | - | 100 | 8.4 | 0 | 168 | 0 | 4 |
| infinite-alchemy | light + shadow | Draft | - | 100 | 8.9 | 0 | 14 | 115 | 4 |
| draft | wind + ice | Rest | 90 | 10 | 7.8 | 0 | 138 | 0 | 1 |
| draft | wind + ice | Draft | 90 | 10 | 7.8 | 0 | 82 | 51 | 1 |
