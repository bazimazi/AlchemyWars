import type { BattleConfig, Loadout } from '../types.js';
import { CONTENT_VERSION, ELEMENT_BY_ID, VESSEL_BY_ID, RELIC_BY_ID, ENEMY_BY_ID, ENCOUNTER_BY_ID, RESEARCH, REACTION_BY_ID, STATUSES } from '../data/content.js';
import { TALENTS, PASSIVES, EQUIPMENT, SPECIALIZATIONS, ENVIRONMENTS, BOSS_AFFIXES } from '../data/systems.js';
const numeric = (value: unknown, max = 10000) : value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
const text = (value: unknown) => typeof value === 'string' ? value.replace(/[<>"`]/g, '').slice(0, 500) : '';
function team(value: unknown): Loadout[] {
  const raw = value as Loadout[];
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 5 || new Set(raw.map(s => s?.vessel)).size !== raw.length) throw new Error();
  return raw.map(s => {
    if (!s || !VESSEL_BY_ID[s.vessel] || !RELIC_BY_ID[s.relic] || !Array.isArray(s.elements) || s.elements.length !== 2 || s.elements.some(id => !ELEMENT_BY_ID[id])) throw new Error();
    return { vessel: s.vessel, elements: [...s.elements], relic: s.relic, targeting: ['front', 'weakest', 'reaction'].includes(s.targeting) ? s.targeting : 'front', priority: ['core', 'alternate', 'reaction'].includes(s.priority) ? s.priority : 'reaction', ...(s.passive ? { passive: PASSIVES.some(p => p.id === s.passive) ? s.passive : 'none' } : {}), ...(s.equipment ? { equipment: Object.fromEntries(Object.entries(s.equipment).filter(([slot, id]) => EQUIPMENT.some(e => e.slot === slot && e.id === id))) } : {}), ...(Array.isArray(s.reactionPriority) ? { reactionPriority: s.reactionPriority.filter(id => REACTION_BY_ID[id]).slice(0, 10) } : {}) };
  });
}
export function normalizeReplay(value: unknown): BattleConfig | null {
  const raw = value as BattleConfig;
  try {
    if (!raw || raw.contentVersion !== CONTENT_VERSION || !Number.isInteger(raw.seed)) return null;
    const config: BattleConfig = { contentVersion: CONTENT_VERSION, seed: raw.seed >>> 0, encounterId: raw.encounterId, team: team(raw.team), research: RESEARCH.filter(r => raw.research?.includes(r.id)).map(r => r.id), talents: TALENTS.filter(t => raw.talents?.includes(t.id)).map(t => t.id), mastery: {}, evolution: {}, specializations: {} };
    for (const [id, n] of Object.entries(raw.mastery ?? {})) if (ELEMENT_BY_ID[id] && numeric(n, 1e9)) config.mastery[id] = n;
    for (const [id, n] of Object.entries(raw.evolution ?? {})) if (ELEMENT_BY_ID[id] && numeric(n, 3)) config.evolution![id] = n;
    for (const [id, specialization] of Object.entries(raw.specializations ?? {})) if (ELEMENT_BY_ID[id] && SPECIALIZATIONS.some(s => s.id === specialization)) config.specializations![id] = specialization;
    if (raw.encounter) {
      const e = raw.encounter;
      if (!Array.isArray(e.enemies) || e.enemies.length > 10 || e.enemies.some(id => !ENEMY_BY_ID[id]) || !numeric(e.scale ?? 1, 10000) || (e.scale ?? 1) < .1 || !ENVIRONMENTS[e.environment]) return null;
      config.encounter = { id: text(e.id), name: text(e.name), region: text(e.region), label: text(e.label), description: text(e.description), tip: text(e.tip), enemies: [...e.enemies], environment: e.environment, scale: e.scale ?? 1, boss: e.boss === true, gold: numeric(e.gold) ? e.gold : 0, knowledge: numeric(e.knowledge) ? e.knowledge : 0, xp: numeric(e.xp) ? e.xp : 0 };
      if (BOSS_AFFIXES.some(a => a.id === e.affix)) config.encounter.affix = e.affix;
      config.encounterId = config.encounter.id;
    } else if (!ENCOUNTER_BY_ID[config.encounterId]) return null;
    if (raw.opponentTeam) config.opponentTeam = team(raw.opponentTeam);
    if (raw.normalized) config.normalized = true;
    if (raw.startingHealth) {
      if (!Array.isArray(raw.startingHealth) || raw.startingHealth.length !== config.team.length || raw.startingHealth.some(n => !numeric(n, 1))) return null;
      config.startingHealth = [...raw.startingHealth];
    }
    if (raw.modifiers) {
      config.modifiers = {};
      for (const key of ['startingShield', 'chainTargets', 'chainDepth', 'healingMultiplier', 'durationMultiplier', 'enemyRegeneration'] as const) if (numeric(raw.modifiers[key], key === 'startingShield' ? 10000 : 20)) config.modifiers[key] = raw.modifiers[key];
      for (const key of ['tagPower', 'statusDuration'] as const) if (raw.modifiers[key]) config.modifiers[key] = Object.fromEntries(Object.entries(raw.modifiers[key]).filter(([id, n]) => /^[a-z][a-z-]{1,40}$/.test(id) && !['constructor', 'prototype'].includes(id) && (key !== 'statusDuration' || STATUSES[id]) && numeric(n, 60)));
      if (Array.isArray(raw.modifiers.disabledReactionTags)) config.modifiers.disabledReactionTags = raw.modifiers.disabledReactionTags.filter(t => typeof t === 'string' && /^[a-z-]{2,40}$/.test(t));
    }
    return config;
  } catch { return null; }
}
