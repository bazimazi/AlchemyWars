import { claimDailyGoal, markTutorial, contextFromConditions } from './learning.js';
import type { Player, CommandPayload } from '../types.js';
import { experiment, requestHint, updateLoadout, moveVessel, buyResearch } from './progression.js';
import { learnTalent, craftEquipment, equipItem, evolveElement, specializeElement, claimQuest, claimAchievement, saveLoadout, applyLoadout, replaceVessel, equipPassive, buyCosmetic, track } from './meta.js';
import { startRun, chooseRunReward, runExperiment, updateRunTeam, updateRunTactics, updateRunScenario, retireRun, claimDaily } from './modes.js';
import { REACTION_BY_ID } from '../data/content.js';
import { QUESTS, ACHIEVEMENTS, EQUIPMENT } from '../data/systems.js';

// The online service and offline client execute exactly the same validated commands.
export function executeCommand(player: Player, command: string, value: unknown = {}, { seed = 0, now = Date.now() } = {}) {
  const payload = value as CommandPayload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid command payload.');
  if (['loadout', 'move', 'equip', 'apply-loadout', 'vessel', 'passive', 'run-reward', 'run-team', 'run-tactics'].includes(command) && (typeof (payload.index ?? -1) !== "number" || !Number.isInteger((payload.index ?? -1)) || (payload.index ?? -1) < 0 || (payload.index ?? -1) >= 10)) return false;
  switch (command) {
    case 'session': {
      const last = player.analytics.at(-1);
      track(player, !last || now - last.at > 1800000 || !player.analytics.some(e => e.name === 'session_started') ? 'session_started' : 'session_heartbeat', {}, now);
      return true;
    }
    case 'practice': {
      const rule = REACTION_BY_ID[(payload.id ?? '')], count = Math.min(10, Math.max(1, Math.floor(payload.count ?? 1)));
      if (!rule || !player.discoveries.includes(rule.id) || !Number.isFinite(count)) return false;
      for (let i = 0; i < count; i++) experiment(player, ...rule.inputs, contextFromConditions(rule.conditions), now);
      return true;
    }
    case 'claim-all': return QUESTS.reduce((count, q) => count + Number(claimQuest(player, q.id)), 0) + ACHIEVEMENTS.reduce((count, a) => count + Number(claimAchievement(player, a.id)), 0);
    case 'craft-all': return EQUIPMENT.reduce((count, e) => count + Number(craftEquipment(player, e.id)), 0);
    case 'favorite':
      if (!player.owned.includes((payload.id ?? ''))) return false;
      player.favorites = player.favorites.includes((payload.id ?? '')) ? player.favorites.filter(id => id !== (payload.id ?? '')) : [...player.favorites, (payload.id ?? '')]; return true;
    case 'settings':
      if (!payload.key || !Object.hasOwn(player.settings, payload.key) || typeof payload.value !== 'boolean') return false;
      player.settings[payload.key] = payload.value; return true;
    case 'experiment': return experiment(player, (payload.a ?? ''), (payload.b ?? ''), payload.context, now);
    case 'hint': return requestHint(player);
    case 'loadout': return updateLoadout(player, (payload.index ?? -1), (payload.patch ?? {}));
    case 'move': return moveVessel(player, (payload.index ?? -1), (payload.direction ?? 0));
    case 'research': return buyResearch(player, (payload.id ?? ''));
    case 'talent': return learnTalent(player, (payload.id ?? ''));
    case 'craft': return craftEquipment(player, (payload.id ?? ''));
    case 'equip': return equipItem(player, (payload.index ?? -1), (payload.id ?? ''));
    case 'evolve': return evolveElement(player, (payload.id ?? ''));
    case 'specialize': return specializeElement(player, (payload.id ?? ''), (payload.specialization ?? ''));
    case 'achievement': return claimAchievement(player, payload.id ?? '');
    case 'quest': return claimQuest(player, (payload.id ?? ''));
    case 'save-loadout': return saveLoadout(player, (payload.name ?? ''));
    case 'apply-loadout': return applyLoadout(player, (payload.index ?? -1));
    case 'vessel': return replaceVessel(player, (payload.index ?? -1), (payload.id ?? ''));
    case 'passive': return equipPassive(player, (payload.index ?? -1), (payload.id ?? ''));
    case 'cosmetic': return buyCosmetic(player, (payload.id ?? ''));
    case 'start-run': return startRun(player, (payload.mode ?? ''), seed, (payload.elements ?? []), now);
    case 'run-reward': return chooseRunReward(player, (payload.index ?? -1));
    case 'run-experiment': return runExperiment(player, (payload.a ?? ''), (payload.b ?? ''));
    case 'run-team': return updateRunTeam(player, (payload.index ?? -1), (payload.elements ?? []));
    case 'run-tactics': return updateRunTactics(player, payload.index ?? -1, payload.patch ?? {});
    case 'run-scenario': return updateRunScenario(player, payload.context);
    case 'retire-run': return retireRun(player);
    case 'daily-goal': return claimDailyGoal(player, payload.id ?? '', now);
    case 'tutorial': return payload.id === 'reflection' && player.learning.tutorial.includes('battle') ? markTutorial(player, 'reflection') : false;
    case 'daily': return claimDaily(player, now);
    default: throw new Error('Unknown game command.');
  }
}
