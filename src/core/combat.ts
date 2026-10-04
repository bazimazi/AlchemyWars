import { ObjectPool } from './pool.js';
import { abilitySlots } from './research.js';
import { ABILITIES, VESSEL_PROFILES, vesselLevel, validAbilities } from '../data/units.js';
import type { Player, BattleConfig, CombatUnit, BattleEvent, BattleFrame, BattleReport, BattleResult, Effect, UnitDefinition, Loadout, Side, StatusModifier, Specialization, ChainContext, ElementApplication, ReactionDefinition } from '../types.js';
import { BALANCE, CONTENT_VERSION, ELEMENT_BY_ID, VESSEL_BY_ID, ENEMY_BY_ID, ENCOUNTER_BY_ID, RELIC_BY_ID, RESEARCH, STATUSES } from '../data/content.js';
import { compareReactionPriority, reactionEngine } from './reactions.js';
import { TALENTS, PASSIVES, EQUIPMENT, SPECIALIZATIONS, ENVIRONMENTS, AFFINITIES, MASTERY_REWARDS, BOSS_AFFIXES } from '../data/systems.js';
import { mergeModifiers } from './modifiers.js';

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function makeBattleConfig(player: Player, encounterId: string, seed: number): BattleConfig {
  if (!ENCOUNTER_BY_ID[encounterId]) throw new Error('Unknown encounter.');
  return {
    contentVersion: CONTENT_VERSION, seed: seed >>> 0, encounterId,
    team: structuredClone(player.team), research: [...player.research],
    mastery: { ...player.mastery }, vesselXp: { ...player.vesselXp },
    talents: [...player.talents], evolution: { ...player.evolution }, specializations: { ...player.specializations },
  };
}

function validateConfig(config: BattleConfig) {
  if (config.contentVersion !== CONTENT_VERSION) throw new Error('This replay uses a different content version.');
  if (!ENCOUNTER_BY_ID[config.encounterId] && !config.encounter) throw new Error('Unknown encounter.');
  if (config.encounter && (!Array.isArray(config.encounter.enemies) || config.encounter.enemies.length > 10 || config.encounter.enemies.some(id => !ENEMY_BY_ID[id]) || !Number.isFinite(config.encounter.scale ?? 1) || (config.encounter.scale ?? 1) < .1)) throw new Error('Invalid generated encounter.');
  if (!Number.isInteger(config.seed)) throw new Error('A numeric seed is required.');
  if (!Array.isArray(config.team) || config.team.length < 1 || config.team.length > 5) throw new Error('A team needs one to five vessels.');
  const ids = new Set();
  for (const slot of config.team) {
    if (!VESSEL_BY_ID[slot.vessel] || ids.has(slot.vessel)) throw new Error('Invalid or duplicate vessel.');
    ids.add(slot.vessel);
    if (!Array.isArray(slot.elements) || slot.elements.length !== 2 || slot.elements.some(id => !ELEMENT_BY_ID[id]?.enabled)) throw new Error('Invalid element loadout.');
    if (slot.abilities !== undefined && !validAbilities(slot.abilities, Infinity, config.normalized ? 3 : abilitySlots(config.research), config.normalized ? undefined : config.research)) throw new Error('Invalid ability slots.');
    if (!RELIC_BY_ID[slot.relic]) throw new Error('Unknown relic.');
  }
}

// A complete simulation is independent of wall-clock time, animation and browser state.
// Playback consumes snapshots, while replay reconstructs them from this small configuration.
export function simulateBattle(config: BattleConfig, { captureFrames = true, engine = reactionEngine } = {}): BattleResult {
  validateConfig(config);
  const rng = seededRandom(config.seed);
  const encounter = config.encounter ?? ENCOUNTER_BY_ID[config.encounterId];
  const environment = ENVIRONMENTS[encounter.environment] ?? ENVIRONMENTS.neutral;
  const accountModifiers = config.normalized ? mergeModifiers(config.modifiers) : mergeModifiers(...RESEARCH.filter(r => config.research?.includes(r.id)).map(r => r.modifiers), ...TALENTS.filter(t => config.talents?.includes(t.id)).map(t => t.modifiers), config.modifiers);
  const masteryLevels = config.normalized ? {} : Object.fromEntries(Object.entries(config.mastery ?? {}).map(([id, xp]) => [id, Math.min(10, Math.floor(xp / BALANCE.masteryThreshold))]));
  const evolution = (id: string) => config.normalized ? 0 : config.evolution?.[id] ?? 0;
  const emptySpecialization: Partial<Specialization> = {};
  const specializations = Object.fromEntries(Object.entries(config.normalized ? {} : config.specializations ?? {}).flatMap(([id, selected]) => {
    const definition = evolution(id) && SPECIALIZATIONS.find(s => s.id === selected && (!s.tags || s.tags.some(tag => ELEMENT_BY_ID[id]?.tags.includes(tag))));
    return definition ? [[id, definition]] : [];
  }));
  const specialization = (id: string): Partial<Specialization> => specializations[id] ?? emptySpecialization;
  const units: CombatUnit[] = [];
  let time = 0;
  const events: BattleEvent[] = [];
  const frames: BattleFrame[] = [];
  const triggerPool = new ObjectPool<Partial<BattleEvent>>(() => ({}), value => { for (const key of Object.keys(value) as (keyof BattleEvent)[]) delete value[key]; });
  const triggerQueue: Partial<BattleEvent>[] = [];
  const triggerNames: Record<string, string> = { start: 'OnBattleStart', end: 'OnBattleEnd', cast: 'OnAbilityCast', critical: 'OnCritical', hit: 'OnHit', status: 'OnStatusApplied', expired: 'OnStatusExpired', damage: 'OnDamageTaken', death: 'OnDeath', kill: 'OnKill', element: 'OnElementApplied', reaction: 'OnReaction', reactionChain: 'OnReactionChain', lowHealth: 'OnLowHealth' };
  const report: BattleReport = { units: {}, reactionSupport: {}, mechanics: {}, phases: [], statusDamage: {}, chains: [], elementCasts: {}, damageByElement: {}, damageByUnit: {}, damageByReaction: {}, reactions: {}, reactionDamage: 0, totalDamage: 0, healing: 0, highestChain: 0, decisions: 0, guardedEvents: 0 };
  const emit = (type: string, fields: Partial<BattleEvent> = {}) => {
    if (events.length < BALANCE.maxLogEvents) events.push({ time, type, ...fields });
    if (triggerNames[type]) triggerQueue.push(Object.assign(triggerPool.acquire(), { trigger: triggerNames[type], type }, fields));
  };
  function addUnit(definition: UnitDefinition, side: Side, position: number, slot: Partial<Loadout> = {}): CombatUnit {
    const scale = side === 'enemy' ? encounter.scale ?? 1 : 1;
    const unit: CombatUnit = {
      id: side + '-' + position, definitionId: definition.id, name: definition.name,
      shape: definition.shape, side, position, hp: Math.round(definition.hp * scale * BALANCE.healthMultiplier),
      maxHp: Math.round(definition.hp * scale * BALANCE.healthMultiplier), attack: definition.attack * scale,
      armor: definition.armor, interval: definition.interval,
      elements: [...(slot.elements ?? definition.elements)], relic: slot.relic ?? 'none',
      targeting: slot.targeting ?? 'front', priority: slot.priority ?? 'reaction',
      immunities: [...(definition.immunities ?? [])], behaviors: [...(definition.behaviors ?? [])],
      abilities: (slot.abilities ?? []).slice(0, abilitySlots(config.research, config.normalized)), passive: slot.passive ?? 'none', equipment: slot.equipment ?? {}, reactionPriority: slot.reactionPriority ?? [],
      modifiers: mergeModifiers(environment.modifiers, side === 'ally' ? accountModifiers : config.normalized ? accountModifiers : {}, RELIC_BY_ID[slot.relic ?? 'none'].modifiers, ...EQUIPMENT.filter(e => Object.values(slot.equipment ?? {}).includes(e.id)).map(e => e.modifiers)),
      shield: 0,
      statuses: {}, residues: {}, cooldowns: {}, ready: 0.4 + position * 0.3,
      casts: 0, phase: 0, definition,
    };
    const growth = VESSEL_PROFILES[definition.id]?.growth, level = side === 'ally' && !config.normalized ? vesselLevel(config.vesselXp?.[definition.id]) - 1 : 0;
    if (growth && level) { unit.hp = unit.maxHp += growth.hp * level * BALANCE.healthMultiplier; unit.attack += growth.attack * level; unit.armor += growth.armor * level; }
    const affix = side === 'enemy' && definition.tags?.includes('boss') ? BOSS_AFFIXES.find(a => a.id === encounter.affix) : null;
    if (affix) { unit.hp = unit.maxHp = Math.round(unit.maxHp * affix.health); unit.attack *= affix.attack; unit.interval *= affix.interval; unit.armor *= affix.armor; }
    unit.shield = unit.modifiers.startingShield ?? 0;
    if (side === 'ally' && evolution(unit.elements[0]) >= 3) unit.shield += Math.round(unit.maxHp * .1);
    if (side === 'ally' && config.startingHealth) unit.hp = Math.round(unit.maxHp * Math.min(1, Math.max(0, config.startingHealth[position] ?? 1)));
    report.units[unit.id] = { damage: 0, damageTaken: 0, absorbed: 0, healing: 0, shield: 0, cleanses: 0, kills: 0, elementCasts: 0, abilityCasts: 0, reactions: 0 };
    if (side === 'enemy') report.mechanics[unit.definitionId] ??= { phases: [], behaviors: [], counters: {} };
    units.push(unit);
    return unit;
  }
  config.team.forEach((slot, i) => addUnit(VESSEL_BY_ID[slot.vessel], 'ally', i, slot));
  if (config.opponentTeam) {
    validateConfig({ ...config, team: config.opponentTeam, opponentTeam: null });
    config.opponentTeam.forEach((slot, i) => addUnit(VESSEL_BY_ID[slot.vessel], 'enemy', i, slot));
  } else encounter.enemies.forEach((id, i) => addUnit(ENEMY_BY_ID[id], 'enemy', i));
  const alive = (side: Side) => units.filter(u => u.side === side && u.hp > 0);
  const opposing = (unit: CombatUnit) => alive(unit.side === 'ally' ? 'enemy' : 'ally');
  const modifier = (unit: CombatUnit, key: StatusModifier) => Object.values(unit.statuses).reduce((v, s) => v + (STATUSES[s.id][key] ?? 0) * s.intensity, 0);
  const weakest = (list: CombatUnit[]) => [...list].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.position - b.position)[0];
  const recipient = (effect: Effect, source: CombatUnit, target: CombatUnit | undefined) => effect.recipient === 'source' ? source : effect.recipient === 'weakestAlly' ? weakest(alive(source.side)) : target;
  const relic = (unit: CombatUnit) => unit.modifiers;

  const reactionSupport = (id: string) => report.reactionSupport[id] ??= { healing: 0, shield: 0, cleanses: 0, statuses: 0 };

  function applyStatus(target: CombatUnit | undefined, id: string, duration: number, intensity: number, source: CombatUnit, stacks = 1, reaction: boolean | string = false) {
    if (!target || target.hp <= 0 || target.immunities.includes(id)) return;
    const definition = STATUSES[id];
    if (!definition) throw new Error('Unknown status: ' + id);
    const masteryBonus = source.side === 'ally' && !config.normalized && (config.mastery?.[source.elements[0]] ?? 0) >= MASTERY_REWARDS.durationLevel * BALANCE.masteryThreshold ? MASTERY_REWARDS.durationBonus : 0;
    const extra = masteryBonus + (relic(source).statusDuration?.[id] ?? 0) + (source.side === 'ally' ? evolution(source.elements[0]) + (specialization(source.elements[0]).duration ?? 0) : 0);
    const old = target.statuses[id];
    target.statuses[id] = {
      id, expires: time + (duration + extra) * (source.modifiers.durationMultiplier ?? 1),
      intensity: Math.max(old?.intensity ?? 0, intensity),
      stacks: Math.min(definition.maxStacks, (old?.stacks ?? 0) + stacks),
      source: source.id, power: source.attack, reaction,
    };
    if (source.side === 'ally' && typeof reaction === 'string') reactionSupport(reaction).statuses++;
    emit('status', { source: source.id, target: target.id, status: id, stacks: target.statuses[id].stacks });
  }

  function dealDamage(source: CombatUnit, target: CombatUnit | undefined, amount: number, element: string, reaction: boolean | string = false, reflected = false, status?: string) {
    if (!target || target.hp <= 0) return;
    let armor = target.armor * Math.max(0, 1 + modifier(target, 'armorMultiplier'));
    for (const weakness of target.definition.weaknesses ?? []) if (target.statuses[weakness.status]) { armor *= weakness.armorMultiplier; amount *= weakness.damageMultiplier ?? 1.25; }
    let received = Math.max(.1, 1 + modifier(target, 'receivedMultiplier')) * (target.side === 'ally' ? specialization(target.elements[0]).received ?? 1 : 1);
    if (AFFINITIES[element]?.includes(target.elements[0])) received *= 1.1;
    for (const tag of ELEMENT_BY_ID[element]?.tags ?? []) received *= source.modifiers.tagPower?.[tag] ?? 1;
    for (const s of Object.values(target.statuses)) {
      for (const [tag, value] of Object.entries(STATUSES[s.id].elementalReceivedMultiplier ?? {})) {
        if (ELEMENT_BY_ID[element]?.tags.includes(tag)) received += value * s.intensity;
      }
    }
    const raw = Math.max(BALANCE.minimumDamage, Math.round(amount * BALANCE.armorDivisor / (BALANCE.armorDivisor + armor) * received));
    const absorbed = Math.min(target.shield, raw);
    target.shield -= absorbed;
    const previousHp = target.hp;
    const dealt = Math.min(target.hp, raw - absorbed);
    target.hp -= dealt;
    report.units[source.id].damage += dealt; report.units[target.id].damageTaken += dealt; report.units[target.id].absorbed += absorbed;
    if (source.side === 'ally') {
      if (status && target.side === 'enemy' && dealt > 0) {
        const damage = report.statusDamage[target.id] ??= {};
        damage[status] = (damage[status] ?? 0) + dealt;
      }
      report.totalDamage += dealt;
      report.damageByElement[element] = (report.damageByElement[element] ?? 0) + dealt;
      report.damageByUnit[source.definitionId] = (report.damageByUnit[source.definitionId] ?? 0) + dealt;
      if (reaction) report.reactionDamage += dealt;
      if (typeof reaction === 'string') report.damageByReaction[reaction] = (report.damageByReaction[reaction] ?? 0) + dealt;
    }
    emit('damage', { source: source.id, target: target.id, amount: dealt, absorbed, element, reaction, status });
    if (!reflected && dealt > 0) {
      const drain = modifier(source, 'lifesteal');
      if (drain > 0) heal(source, source, dealt * drain);
      const reflect = modifier(target, 'reflect');
      if (reflect > 0 && source.hp > 0) dealDamage(target, source, dealt * reflect, element, false, true);
    }
    if (target.hp === 0) { report.units[source.id].kills++; emit('death', { source: source.id, target: target.id, name: target.name }); emit('kill', { source: source.id, target: target.id, element }); }
    else if (previousHp > target.maxHp * .3 && target.hp <= target.maxHp * .3) emit('lowHealth', { source: source.id, target: target.id });
    const phases = target.definition.phases ?? [];
    while (target.hp > 0 && target.phase < phases.length && target.hp / target.maxHp <= phases[target.phase].below) {
      const phase = phases[target.phase++];
      target.attack *= phase.attackMultiplier;
      target.interval *= phase.intervalMultiplier;
      if (phase.elements) { target.elements = [...phase.elements]; target.casts = 0; }
      if (phase.immunities) { target.immunities = [...phase.immunities]; for (const id of target.immunities) if (target.statuses[id]) { delete target.statuses[id]; emit('expired', { target: target.id, status: id }); } }
      if (phase.modifiers) target.modifiers = mergeModifiers(target.modifiers, phase.modifiers);
      if (phase.behaviors) target.behaviors = [...phase.behaviors];
      report.phases.push({ unit: target.id, index: target.phase, time, label: phase.label, elements: [...target.elements] });
      if (target.side === 'enemy' && !report.mechanics[target.definitionId].phases.includes(target.phase)) report.mechanics[target.definitionId].phases.push(target.phase);
      emit('phase', { target: target.id, name: phase.label, depth: target.phase, element: target.elements[0] });
      if (phase.effects) {
        const applications: ElementApplication[] = [];
        applyEffects(phase.effects, target, source, target.elements[0], { depth: 0, triggered: new Set() }, applications);
        for (const application of applications) applyElement(application.source, application.target, application.element);
      }
    }
  }

  function heal(source: CombatUnit, target: CombatUnit | undefined, amount: number, reaction: boolean | string = false) {
    if (!target || target.hp <= 0) return;
    const restored = Math.min(target.maxHp - target.hp, Math.round(amount * (relic(source).healingMultiplier ?? 1) * (source.side === 'ally' ? specialization(source.elements[0]).healing ?? 1 : 1)));
    target.hp += restored; report.units[source.id].healing += restored;
    if (source.side === 'ally' && typeof reaction === 'string') reactionSupport(reaction).healing += restored;
    if (source.side === 'ally') report.healing += restored;
    if (restored) emit('heal', { source: source.id, target: target.id, amount: restored });
  }

  function applyEffects(effects: Effect[], source: CombatUnit, target: CombatUnit | undefined, element: string, context: ChainContext, queue: ElementApplication[], isReaction: boolean | string = false) {
    for (const effect of effects) {
      const chosen = recipient(effect, source, target);
      switch (effect.type) {
        case 'damage': dealDamage(source, chosen, source.attack * effect.scale, element, isReaction); break;
        case 'status': applyStatus(chosen, effect.status, effect.duration, effect.intensity, source, effect.stacks, isReaction); break;
        case 'heal': heal(source, chosen, source.attack * effect.scale, isReaction); break;
        case 'shield':
          if (chosen && chosen.hp > 0) {
            const before = chosen.shield;
            chosen.shield = Math.max(before, Math.min(chosen.maxHp * 0.5, chosen.shield + Math.round(source.attack * effect.scale * (source.side === 'ally' ? specialization(source.elements[0]).shield ?? 1 : 1))));
            const granted = chosen.shield - before; report.units[source.id].shield += granted;
            if (source.side === 'ally' && typeof isReaction === 'string') reactionSupport(isReaction).shield += granted;
            if (granted) emit('shield', { source: source.id, target: chosen.id, amount: granted, reaction: isReaction });
          }
          break;
        case 'cleanse':
          if (chosen) {
            const removed = Object.values(chosen.statuses).filter(s => STATUSES[s.id].harmful).slice(0, effect.count);
            for (const s of removed) delete chosen.statuses[s.id];
            report.units[source.id].cleanses += removed.length;
            if (source.side === 'ally' && typeof isReaction === 'string') reactionSupport(isReaction).cleanses += removed.length;
            if (removed.length) emit('cleanse', { source: source.id, target: chosen.id, amount: removed.length, reaction: isReaction });
          }
          break;
        case 'explode':
          for (const other of opposing(source).slice(0, effect.count ?? 5)) dealDamage(source, other, source.attack * effect.scale, element, isReaction);
          break;
        case 'resurrect': {
          const fallen = units.find(u => u.side === source.side && u.hp <= 0 && !u.resurrected);
          if (fallen) { fallen.resurrected = true; fallen.hp = Math.round(fallen.maxHp * Math.min(.5, effect.scale)); fallen.statuses = {}; fallen.ready = 2; emit('resurrect', { source: source.id, target: fallen.id }); }
          break;
        }
        case 'summon': {
          if (units.filter(u => u.side === source.side).length >= 8) break;
          const definition = ENEMY_BY_ID[effect.enemy];
          if (!definition) break;
          const summoned = addUnit(definition, source.side, units.filter(u => u.side === source.side).length);
          summoned.hp = summoned.maxHp = Math.round(summoned.maxHp * Math.min(1, effect.scale ?? .5));
          summoned.attack *= Math.min(1, effect.scale ?? .5);
          emit('summon', { source: source.id, target: summoned.id, name: summoned.name });
          break;
        }
        case 'transform':
          if (chosen && ELEMENT_BY_ID[effect.element]) { chosen.elements = [effect.element, chosen.elements[1]]; emit('transform', { source: source.id, target: chosen.id, element: effect.element }); }
          break;
        case 'spread': {
          const targets = [target, ...opposing(source).filter(u => u.id !== target?.id)].filter((u): u is CombatUnit => !!u && u.hp > 0).slice(0, effect.count + 1);
          for (const other of targets) applyStatus(other, effect.status, effect.duration, effect.intensity, source, 1, isReaction);
          break;
        }
        case 'chain': {
          const targets = opposing(source).filter(u => u.id !== target?.id).slice(0, effect.count + (relic(source).chainTargets ?? 0));
          for (const other of targets) {
            dealDamage(source, other, source.attack * effect.scale, effect.element, isReaction || true);
            applyStatus(other, effect.status, 3, 0.2, source);
            queue.push({ source, target: other, element: effect.element, context: { ...context, depth: context.depth + 1 } });
          }
          break;
        }
        case 'applyElement': queue.push({ source, target: chosen, element: effect.element, context: { ...context, depth: context.depth + 1 } }); break;
        default: throw new Error('Unsupported effect');
      }
    }
  }

  function reactionOptions(source: CombatUnit, target: CombatUnit, element: string) {
    const context = { research: source.side === 'ally' && !config.normalized ? config.research : [], environment: encounter.environment, statuses: Object.keys(target.statuses), healthRatio: target.hp / target.maxHp, enemyCount: opposing(source).length, shielded: target.shield > 0, tags: target.elements.flatMap(id => ELEMENT_BY_ID[id].tags), mastery: source.side === 'ally' && !config.normalized ? masteryLevels : {} };
    const present = new Set(Object.keys(target.residues));
    // Status/element associations are content-level affinities, not individual recipe cases.
    for (const id of Object.keys(target.statuses)) {
      const affinity = STATUS_AFFINITIES[id];
      if (affinity) present.add(affinity);
    }
    const rules = [...present].flatMap(other => engine.matching(element, other, context));
    return rules.filter(r => !r.tags.some(tag => source.modifiers.disabledReactionTags?.includes(tag))).sort((a, b) => compareReactionPriority(a, b, source.reactionPriority));
  }

  function applyElement(source: CombatUnit, target: CombatUnit | undefined, element: string) {
    const queue: ElementApplication[] = [{ source, target, element, context: { depth: 0, triggered: new Set(), maxDepth: BALANCE.maxChainDepth + (source.modifiers.chainDepth ?? 0) } }];
    let processed = 0;
    while (queue.length && processed++ < BALANCE.maxEventsPerAction) {
      const item = queue.shift()!;
      const { source: actor, target: victim, element: incoming, context } = item;
      if (!victim || victim.hp <= 0) continue;
      if (context.depth >= (context.maxDepth ?? BALANCE.maxChainDepth)) { report.guardedEvents++; continue; }
      emit('element', { source: actor.id, target: victim.id, element: incoming });
      const rule = reactionOptions(actor, victim, incoming).find(r => engine.canTrigger(r, context) && (victim.cooldowns[r.id] ?? -1) <= time);
      victim.residues[incoming] = time + BALANCE.residueDuration;
      if (!rule) continue;
      context.triggered.add(rule.id);
      victim.cooldowns[rule.id] = time + rule.cooldown;
      for (const id of rule.inputs) delete victim.residues[id];
      victim.residues[rule.output] = time + BALANCE.residueDuration;
      const depth = context.depth + 1;
      report.highestChain = Math.max(report.highestChain, depth);
      report.units[actor.id].reactions++;
      if (actor.side === 'ally') report.reactions[rule.id] = (report.reactions[rule.id] ?? 0) + 1;
      emit('reaction', { source: actor.id, target: victim.id, id: rule.id, name: rule.name, element: rule.output, depth });
      if (depth > 1) emit('reactionChain', { source: actor.id, target: victim.id, depth, element: rule.output });
      const path = [...(context.path ?? []), rule.id];
      if (actor.side === 'ally' && path.length > 1 && report.chains.length < 100 && !report.chains.some(p => p.join('|') === path.join('|'))) report.chains.push(path);
      const next = { ...context, depth, path };
      applyEffects(rule.effects, actor, victim, rule.output, next, queue, rule.id);
      queue.push({ source: actor, target: victim, element: rule.output, context: next });
    }
    if (queue.length) report.guardedEvents += queue.length;
  }

  function processTriggers() {
    const triggered = new Set();
    let count = 0;
    while (triggerQueue.length && count++ < BALANCE.maxEventsPerAction) {
      const event = triggerQueue.shift()!;
      const ownerId = ['damage', 'expired', 'death', 'lowHealth'].includes(event.type ?? '') ? event.target : event.source;
      for (const unit of ownerId ? units.filter(u => u.id === ownerId) : units) {
        if (unit.hp <= 0 && event.trigger !== 'OnDeath') continue;
        const spec = unit.side === 'ally' && event.trigger === 'OnKill' && event.element ? specialization(event.element) : emptySpecialization;
        if (spec.onKillEffects) {
          const specKey = unit.id + ':specialization:' + spec.id + ':kill';
          if (!triggered.has(specKey) && (unit.cooldowns[specKey] ?? -1) <= time) {
            triggered.add(specKey); unit.cooldowns[specKey] = time + (spec.cooldown ?? 0);
            const applications: ElementApplication[] = [];
            applyEffects(spec.onKillEffects, unit, opposing(unit)[0], event.element!, { depth: 1, triggered: new Set() }, applications);
            emit('specialization', { source: unit.id, name: spec.name, element: event.element, trigger: event.trigger });
            for (const application of applications) applyElement(application.source, application.target, application.element);
          }
        }
        for (const behavior of unit.behaviors) {
          if (behavior.trigger !== event.trigger) continue;
          const key = unit.id + ':behavior:' + behavior.id;
          if (triggered.has(key) || (unit.cooldowns[key] ?? -1) > time) continue;
          const counter = behavior.suppressedBy?.find(id => unit.statuses[id]) ?? Object.keys(unit.statuses).find(id => STATUSES[id].suppressEffects);
          if (counter) {
            if (unit.side === 'enemy') { const counts = report.mechanics[unit.definitionId].counters; counts[counter] = (counts[counter] ?? 0) + 1; }
            emit('counter', { source: unit.id, name: behavior.name, status: counter }); continue;
          }
          triggered.add(key); unit.cooldowns[key] = time + behavior.cooldown;
          const target = units.find(u => u.id === event.target && u.side !== unit.side && u.hp > 0) ?? opposing(unit)[0];
          const applications: ElementApplication[] = [];
          applyEffects(behavior.effects, unit, target, unit.elements[0], { depth: 1, triggered: new Set() }, applications);
          if (unit.side === 'enemy' && !report.mechanics[unit.definitionId].behaviors.includes(behavior.id)) report.mechanics[unit.definitionId].behaviors.push(behavior.id);
          emit('behavior', { source: unit.id, name: behavior.name, id: behavior.id, trigger: event.trigger });
          for (const application of applications) applyElement(application.source, application.target, application.element);
        }
        const learned = PASSIVES.find(p => p.id === unit.passive && p.trigger === event.trigger);
        const masteryPassive = unit.side === 'ally' && !config.normalized && (config.mastery?.[unit.elements[0]] ?? 0) >= MASTERY_REWARDS.passiveLevel * BALANCE.masteryThreshold && MASTERY_REWARDS.passive.trigger === event.trigger ? MASTERY_REWARDS.passive : null;
        for (const passive of [learned, masteryPassive].filter(Boolean)) {
        if (!passive) continue;
        const key = unit.id + ':' + passive.id;
        if (triggered.has(key) || (unit.cooldowns[key] ?? -1) > time) continue;
        triggered.add(key); unit.cooldowns[key] = time + (passive.cooldown ?? 0);
        const target = units.find(u => u.id === event.target && u.side !== unit.side && u.hp > 0) ?? opposing(unit)[0];
        const applications: ElementApplication[] = [];
        applyEffects(passive.effects, unit, target, unit.elements[0], { depth: 1, triggered: new Set() }, applications);
        emit('passive', { source: unit.id, name: passive.name, trigger: event.trigger });
        for (const application of applications) applyElement(application.source, application.target, application.element);
        }
      }
      triggerPool.release(event);
    }
    if (triggerQueue.length) { report.guardedEvents += triggerQueue.length; for (const event of triggerQueue) triggerPool.release(event); triggerQueue.length = 0; }
  }

  function chooseAction(source: CombatUnit) {
    const enemies = opposing(source);
    if (!enemies.length) return null;
    const taunting = enemies.find(u => Object.values(u.statuses).some(s => STATUSES[s.id].taunt));
    let target = taunting ?? (source.targeting === 'weakest' ? weakest(enemies) : enemies[0]);
    let element = source.elements[source.casts % source.elements.length];
    if (source.priority === 'reaction') {
      let best: { target: CombatUnit; element: string; rule: ReactionDefinition } | null = null;
      for (const candidate of source.targeting === 'reaction' && !taunting ? enemies : [target]) {
        for (const id of source.elements) {
          const rule = reactionOptions(source, candidate, id).find(r => (candidate.cooldowns[r.id] ?? -1) <= time);
          if (rule && (!best || compareReactionPriority(rule, best.rule, source.reactionPriority) < 0)) best = { target: candidate, element: id, rule };
        }
      }
      if (best) ({ target, element } = best);
    } else if (source.priority === 'core') element = source.elements[0];
    return { target, element };
  }

  const snapshot = (): BattleFrame => ({
    time, eventCount: events.length,
    object: environment.object ? { name: environment.object, charges: objectCharges, description: environment.description } : null,
    units: units.map(u => ({ id: u.id, definitionId: u.definitionId, side: u.side, position: u.position, name: u.name, shape: u.shape, hp: u.hp, maxHp: u.maxHp, shield: u.shield, elements: [...u.elements], statuses: Object.values(u.statuses).map(s => ({ id: s.id, stacks: s.stacks, remaining: Math.max(0, s.expires - time) })), phase: u.phase, ...(u.phase ? { phaseLabel: u.definition.phases![u.phase - 1].label } : {}), immunities: [...u.immunities], behaviors: u.behaviors.map(b => b.id), residues: { ...u.residues }, cooldowns: { ...u.cooldowns }, ready: u.ready })),
  });
  let objectCharges = environment.interaction?.charges ?? 0;
  if (environment.startStatus) for (const unit of units) applyStatus(unit, environment.startStatus, 6, 1, unit);
  if (config.modifiers?.enemyRegeneration) for (const unit of (config.normalized ? units.filter(u => u.hp > 0) : alive('enemy'))) applyStatus(unit, 'regeneration', BALANCE.maxTime, config.modifiers.enemyRegeneration, unit);
  emit('start', { seed: config.seed, environment: encounter.environment });
  processTriggers();
  if (captureFrames) frames.push(snapshot());
  const steps = Math.round(BALANCE.maxTime / BALANCE.step);
  for (let tick = 1; tick <= steps; tick++) {
    time = tick * BALANCE.step;
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      for (const [id, expires] of Object.entries(unit.residues)) if (expires <= time) delete unit.residues[id];
      for (const s of Object.values(unit.statuses)) {
        if (s.expires <= time) { delete unit.statuses[s.id]; emit('expired', { target: unit.id, status: s.id }); continue; }
        if (tick % Math.round(BALANCE.statusTick / BALANCE.step) === 0 && STATUSES[s.id].periodic) {
          const source = units.find(u => u.id === s.source);
          if (!source) continue;
          if (STATUSES[s.id].periodic === 'damage') dealDamage(source, unit, s.power * s.intensity * s.stacks, STATUS_AFFINITIES[s.id] ?? source.elements[0], s.reaction, false, s.id);
          else heal(source, unit, s.power * s.intensity * s.stacks, s.reaction);
        }
      }
      if (unit.hp <= 0 || Object.values(unit.statuses).some(s => STATUSES[s.id].disables)) continue;
      unit.ready -= BALANCE.step * Math.max(0.2, 1 + modifier(unit, 'speedMultiplier'));
      if (unit.ready > 0) continue;
      const action = chooseAction(unit);
      if (!action) break;
      const { target, element } = action;
      const ability = Object.values(unit.statuses).some(s => STATUSES[s.id].suppressEffects) ? undefined : unit.abilities.map(id => ABILITIES.find(a => a.id === id)!).find(a => (unit.cooldowns['ability:' + a.id] ?? 0) <= time && (a.condition !== 'wounded' || alive(unit.side).some(u => u.hp / u.maxHp < .7)) && (a.condition !== 'unshielded' || unit.shield === 0));
      if (ability) {
        report.units[unit.id].abilityCasts++;
        unit.cooldowns['ability:' + ability.id] = time + ability.cooldown; unit.ready += unit.interval; report.decisions++;
        emit('cast', { source: unit.id, target: target.id, element, name: ability.name });
        const applications: ElementApplication[] = [];
        applyEffects(ability.effects, unit, target, element, { depth: 0, triggered: new Set() }, applications);
        for (const item of applications) applyElement(item.source, item.target, item.element);
        processTriggers(); continue;
      }
      if (unit.side === 'ally') report.elementCasts[element] = (report.elementCasts[element] ?? 0) + 1;
      report.units[unit.id].elementCasts++;
      unit.casts++;
      unit.ready += unit.interval;
      report.decisions++;
      emit('cast', { source: unit.id, target: target.id, element, priority: unit.priority });
      if (objectCharges > 0 && environment.interaction && environment.interaction.elements.includes(element)) {
        objectCharges--;
        const applications: ElementApplication[] = [];
        applyEffects(environment.interaction.effects, unit, target, element, { depth: 0, triggered: new Set() }, applications);
        for (const item of applications) applyElement(item.source, item.target, item.element);
        emit('object', { source: unit.id, name: environment.object, charges: objectCharges, element });
      }
      const masteryLevel = unit.side === 'ally' && !config.normalized ? Math.min(10, Math.floor((config.mastery?.[element] ?? 0) / BALANCE.masteryThreshold)) : 0;
      const critical = rng() < BALANCE.criticalChance;
      const variance = 1 + (rng() * 2 - 1) * BALANCE.damageVariance;
      const power = unit.attack * ELEMENT_BY_ID[element].power * variance * (critical ? BALANCE.criticalMultiplier : 1)
        * (1 + masteryLevel * BALANCE.masteryPowerPerLevel) * Math.max(0.1, 1 + modifier(unit, 'damageMultiplier')) * (unit.side === 'ally' ? specialization(element).power ?? 1 : 1);
      dealDamage(unit, target, power, element);
      emit('hit', { source: unit.id, target: target.id, element });
      if (critical) emit('critical', { source: unit.id, target: target.id, element });
      const queue: ElementApplication[] = [];
      if (!Object.values(unit.statuses).some(s => STATUSES[s.id].suppressEffects)) applyEffects(ELEMENT_BY_ID[element].effects, unit, target, element, { depth: 0, triggered: new Set() }, queue);
      const spec = unit.side === 'ally' ? specialization(element) : emptySpecialization;
      if (spec.castEffects) {
        const specKey = 'specialization:' + spec.id + ':cast';
        if ((unit.cooldowns[specKey] ?? -1) <= time && !Object.values(unit.statuses).some(s => STATUSES[s.id].suppressEffects)) {
          unit.cooldowns[specKey] = time + (spec.cooldown ?? 0);
          applyEffects(spec.castEffects, unit, target, element, { depth: 0, triggered: new Set() }, queue);
          emit('specialization', { source: unit.id, name: spec.name, element });
        }
      }
      // Derived elements use the same effect vocabulary, including their outgoing chain applications.
      applyElement(unit, target, element);
      for (const event of queue) applyElement(event.source, event.target, event.element);
      if (masteryLevel >= BALANCE.masterySpreadLevel || unit.side === 'ally' && evolution(element) >= 2) {
        const extra = opposing(unit).find(u => u.id !== target.id);
        if (extra) dealDamage(unit, extra, power * BALANCE.masterySpreadScale, element);
      }
      processTriggers();
    }
    processTriggers();
    if (captureFrames) frames.push(snapshot());
    if (!alive('ally').length || !alive('enemy').length) break;
  }
  const outcome = alive('enemy').length === 0 ? 'victory' : alive('ally').length === 0 ? 'defeat' : 'draw';
  emit('end', { outcome });
  processTriggers();
  return { config: structuredClone(config), outcome, duration: time, report, events, frames, final: snapshot() };
}

// Shared semantic associations belong to data; exported separately for tooling and tests.
import { STATUS_AFFINITIES } from '../data/status-affinities.js';
