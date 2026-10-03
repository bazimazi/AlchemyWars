import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { createPlayer } from '../src/core/progression.js';
import { simulateBattle } from '../src/core/combat.js';
import { startRun, rotation, runBattleConfig, runFloorMutator, completeRunBattle, chooseRunReward, updateRunTactics, retireRun } from '../src/core/modes.js';
import { normalizeSave } from '../src/core/save.js';
import { CONTENT_VERSION } from '../src/data/content.js';

const seeds = Number(process.argv[2] ?? 20), ceiling = 16, now = Date.UTC(2026, 9, 3);
if (!Number.isInteger(seeds) || seeds < 1 || seeds > 1000) throw new Error('Use 1-1000 seeds per scenario.');
const scenarios = ['roguelite', 'endless', 'infinite-alchemy'].flatMap(mode => [['fire', 'water'], ['light', 'shadow']].map(elements => ({ mode, elements }))).concat([{ mode: 'draft', elements: rotation(now).draft.slice(0, 2) }]);
const rows = [], before = performance.now(); let battles = 0;
for (const scenario of scenarios) for (const policy of ['Rest', 'Draft']) {
  let clears = 0, defeats = 0, wins = 0, rest = 0, tools = 0, capped = 0;
  const laws = new Set<string>();
  for (let seed = 0; seed < seeds; seed++) {
    let p = createPlayer(); startRun(p, scenario.mode, seed, scenario.elements, now);
    const runState = () => p.run!.state;
    while (runState() === 'battle' && p.run!.floor <= ceiling) {
      laws.add(runFloorMutator(p.run!).id);
      const battle = simulateBattle(runBattleConfig(p), { captureFrames: false }); battles++;
      if (!completeRunBattle(p, battle)) throw new Error('Run settlement failed.');
      if (p.run!.state === 'reward') {
        const injured = p.run!.health.some(h => h < .6);
        const build = policy === 'Draft' && !injured ? p.run!.rewards.findIndex(r => r.type !== 'rest' && r.type !== 'element') : -1;
        const index = build >= 0 ? build : p.run!.rewards.findIndex(r => r.type === 'rest');
        const reward = p.run!.rewards[index];
        rest += Number(reward.type === 'rest'); tools += Number(reward.type === 'relic' || reward.type === 'passive');
        if (!chooseRunReward(p, index)) throw new Error('Draft selection failed.');
        if (policy === 'Draft') p.run!.team.forEach((_, index) => updateRunTactics(p, index, { relic: p.run!.relics[0] ?? 'none', passive: p.run!.passives[0] ?? 'none', priority: 'reaction' }));
      }
      p = normalizeSave(p);
    }
    wins += p.run!.wins; clears += Number(p.run!.state === 'complete'); defeats += Number(p.run!.state === 'defeat');
    if (p.run!.state === 'battle') { capped++; retireRun(p); }
  }
  rows.push({ mode: scenario.mode, start: scenario.elements.join(' + '), policy, runs: seeds, clearPercent: ['roguelite', 'draft'].includes(scenario.mode) ? +(clears / seeds * 100).toFixed(1) : null, defeatPercent: +(defeats / seeds * 100).toFixed(1), meanWins: +(wins / seeds).toFixed(1), cappedRuns: capped, restPicks: rest, toolPicks: tools, floorLaws: laws.size });
}
const summary = { content: CONTENT_VERSION, runs: rows.length * seeds, battles, elapsedSeconds: +((performance.now() - before) / 1000).toFixed(2), ceiling };
console.table(rows); console.log(summary);
if (process.argv.includes('--report')) await writeFile('docs/RUN-BALANCE.md', '# Seeded run report\n\nContent ' + CONTENT_VERSION + '. ' + seeds + ' seeds per scenario, with reload normalization between battles. Draft pool and expedition rule use 2026-10-03 UTC. Endless scenarios stop at floor ' + ceiling + '; a capped run is not a completed endless mode.\n\nRest always chooses recovery. Draft chooses a build upgrade/tool when every vessel has at least 60% health, otherwise recovery; it equips the first drafted relic/passive and seeks reactions. These fixed policies explore reproducible routes, not optimal play or human pacing. Account upgrades are absent.\n\n```json\n' + JSON.stringify(summary, null, 2) + '\n```\n\n| Mode | Starting elements | Policy | Clear % | Defeat % | Mean victories | Runs capped | Rest picks | Tool picks | Floor rules seen |\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|\n' + rows.map(r => '| ' + [r.mode, r.start, r.policy, r.clearPercent ?? '-', r.defeatPercent, r.meanWins, r.cappedRuns, r.restPicks, r.toolPicks, r.floorLaws].join(' | ') + ' |').join('\n') + '\n');
