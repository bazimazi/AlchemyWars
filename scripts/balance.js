import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { simulateBattle, makeBattleConfig } from '../src/core/combat.js';
import { createPlayer } from '../src/core/progression.js';
import { ENCOUNTERS, ELEMENTS, RESEARCH, CONTENT_VERSION } from '../src/data/content.js';
import { TALENTS } from '../src/data/systems.js';
const runs = Number(process.argv[2] ?? 100);
if (!Number.isInteger(runs) || runs < 1 || runs > 10000) throw new Error('Use 1–10000 runs per matchup.');
const profiles = {
  Starter: null,
  Explorer: createPlayer().team.map(s => s.elements),
  Inferno: [['fire', 'earth'], ['fire', 'wind'], ['fire', 'nature'], ['ice', 'earth'], ['light', 'shadow']],
  Storm: [['water', 'lightning'], ['conductive', 'lightning'], ['thunderstorm', 'wind'], ['nature', 'earth'], ['light', 'shadow']],
  'Toxic Garden': [['poison', 'nature'], ['bloodbloom', 'earth'], ['nightshade', 'poison'], ['light', 'poison'], ['nature', 'earth']],
  'Frozen Fortress': [['ice', 'earth'], ['ice', 'wind'], ['water', 'ice'], ['light', 'shadow'], ['thermal-shock', 'fire']],
  Eclipse: [['light', 'shadow'], ['dispel', 'plasma'], ['thermal-shock', 'earth'], ['earth', 'poison'], ['storm-surge', 'nature']],
};
const encounters = process.argv.includes('--all') ? ENCOUNTERS : ENCOUNTERS.filter((e, i) => i < 3 || e.boss);
const start = performance.now(), rows = [], latencies = [];
for (const [profile, pairs] of Object.entries(profiles)) {
  const player = createPlayer();
  if (pairs) {
    player.team.forEach((s, i) => s.elements = pairs[i]);
    player.research = RESEARCH.map(r => r.id); player.talents = TALENTS.map(t => t.id);
    player.mastery = Object.fromEntries(ELEMENTS.map(e => [e.id, 90]));
  }
  for (const encounter of encounters) {
    let wins = 0, draws = 0, seconds = 0, damage = 0, reactions = 0, contribution = 0, survivors = 0, healing = 0;
    for (let seed = 0; seed < runs; seed++) {
      const before = performance.now(), battle = simulateBattle(makeBattleConfig(player, encounter.id, seed), { captureFrames: false });
      latencies.push(performance.now() - before);
      wins += Number(battle.outcome === 'victory'); draws += Number(battle.outcome === 'draw'); seconds += battle.duration;
      damage += battle.report.totalDamage; healing += battle.report.healing;
      reactions += Object.values(battle.report.reactions).reduce((a, b) => a + b, 0); contribution += battle.report.reactionDamage;
      survivors += battle.final.units.filter(u => u.side === 'ally' && u.hp > 0).length;
    }
    rows.push({ profile, encounter: encounter.id, runs, winRate: +(wins / runs * 100).toFixed(1), drawRate: +(draws / runs * 100).toFixed(1), seconds: +(seconds / runs).toFixed(1), damage: Math.round(damage / runs), healing: Math.round(healing / runs), reactions: +(reactions / runs).toFixed(1), reactionDamagePercent: +(contribution / Math.max(1, damage) * 100).toFixed(1), survivors: +(survivors / runs).toFixed(1) });
  }
}
latencies.sort((a, b) => a - b);
const performanceReport = { battles: latencies.length, elapsedSeconds: +((performance.now() - start) / 1000).toFixed(2), medianSimulationMs: +latencies[Math.floor(latencies.length / 2)].toFixed(2), p95SimulationMs: +latencies[Math.floor(latencies.length * .95)].toFixed(2) };
console.table(rows); console.log(performanceReport);
if (process.argv.includes('--report')) {
  const markdown = '# Seeded balance report\n\nContent ' + CONTENT_VERSION + '. ' + runs + ' seeds per matchup. Starter has no upgrades; other profiles have mastery 3, all research and talents, and no equipment or evolved elements. These simulations measure combat, not human playtime or device frame rate.\n\n' + '```json\n' + JSON.stringify(performanceReport, null, 2) + '\n```\n\n| Profile | Encounter | Win % | Draw % | Seconds | Reaction damage % | Survivors |\n|---|---|---:|---:|---:|---:|---:|\n' + rows.map(r => '| ' + [r.profile, r.encounter, r.winRate, r.drawRate, r.seconds, r.reactionDamagePercent, r.survivors].join(' | ') + ' |').join('\n') + '\n';
  await writeFile('docs/BALANCE.md', markdown);
}
