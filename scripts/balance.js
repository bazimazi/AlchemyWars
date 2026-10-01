import { performance } from 'node:perf_hooks';
import { simulateBattle, makeBattleConfig } from '../src/core/combat.js';
import { createPlayer } from '../src/core/progression.js';
import { ENCOUNTERS } from '../src/data/content.js';
const runs = Number(process.argv[2] ?? 100);
if (!Number.isInteger(runs) || runs < 1 || runs > 10000) throw new Error('Use 1–10000 runs per encounter.');
const player = createPlayer();
const start = performance.now();
const rows = [];
for (const encounter of ENCOUNTERS) {
  let wins = 0, seconds = 0, damage = 0, reactions = 0, contribution = 0, survivors = 0;
  for (let seed = 0; seed < runs; seed++) {
    const battle = simulateBattle(makeBattleConfig(player, encounter.id, seed), { captureFrames: false });
    wins += battle.outcome === 'victory' ? 1 : 0;
    seconds += battle.duration;
    damage += battle.report.totalDamage;
    reactions += Object.values(battle.report.reactions).reduce((a, b) => a + b, 0);
    contribution += battle.report.reactionDamage;
    survivors += battle.final.units.filter(u => u.side === 'ally' && u.hp > 0).length;
  }
  rows.push({ encounter: encounter.name, runs, winRate: (wins / runs * 100).toFixed(1) + '%', seconds: (seconds / runs).toFixed(1), damage: Math.round(damage / runs), reactions: (reactions / runs).toFixed(1), reactionDamage: (contribution / damage * 100).toFixed(1) + '%', survivors: (survivors / runs).toFixed(1) });
}
console.table(rows);
console.log('Elapsed: ' + ((performance.now() - start) / 1000).toFixed(2) + 's');
