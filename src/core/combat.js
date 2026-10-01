import { BALANCE, CONTENT_VERSION, ELEMENT_BY_ID, VESSEL_BY_ID, ENEMY_BY_ID, ENCOUNTER_BY_ID, RELIC_BY_ID, RESEARCH, STATUSES } from '../data/content.js';
import { reactionEngine } from './reactions.js';

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function makeBattleConfig(player, encounterId, seed) {
  if (!ENCOUNTER_BY_ID[encounterId]) throw new Error('Unknown encounter.');
  return {
    contentVersion: CONTENT_VERSION, seed: seed >>> 0, encounterId,
    team: structuredClone(player.team), research: [...player.research],
    mastery: { ...player.mastery },
  };
}

function validateConfig(config) {
  if (config.contentVersion !== CONTENT_VERSION) throw new Error('This replay uses a different content version.');
  if (!ENCOUNTER_BY_ID[config.encounterId]) throw new Error('Unknown encounter.');
  if (!Number.isInteger(config.seed)) throw new Error('A numeric seed is required.');
  if (!Array.isArray(config.team) || config.team.length < 1 || config.team.length > 5) throw new Error('A team needs one to five vessels.');
  const ids = new Set();
  for (const slot of config.team) {
    if (!VESSEL_BY_ID[slot.vessel] || ids.has(slot.vessel)) throw new Error('Invalid or duplicate vessel.');
    ids.add(slot.vessel);
    if (!Array.isArray(slot.elements) || slot.elements.length !== 2 || slot.elements.some(id => !ELEMENT_BY_ID[id]?.enabled)) throw new Error('Invalid element loadout.');
    if (!RELIC_BY_ID[slot.relic]) throw new Error('Unknown relic.');
  }
}

// A complete simulation is independent of wall-clock time, animation and browser state.
// Playback consumes snapshots, while replay reconstructs them from this small configuration.
export function simulateBattle(config, { captureFrames = true, engine = reactionEngine } = {}) {
  validateConfig(config);
  const rng = seededRandom(config.seed);
  const encounter = ENCOUNTER_BY_ID[config.encounterId];
  const research = RESEARCH.filter(r => config.research?.includes(r.id));
  const researchValue = key => research.reduce((sum, r) => sum + (r.modifiers[key] ?? 0), 0);
  const maxDepth = BALANCE.maxChainDepth + researchValue('chainDepth');
  const units = [];
  let time = 0;
  const events = [];
  const frames = [];
  const report = { damageByElement: {}, damageByUnit: {}, reactions: {}, reactionDamage: 0, totalDamage: 0, healing: 0, highestChain: 0, decisions: 0, guardedEvents: 0 };
  const emit = (type, fields = {}) => {
    if (events.length < BALANCE.maxLogEvents) events.push({ time, type, ...fields });
  };
  function addUnit(definition, side, position, slot = {}) {
    const scale = side === 'enemy' ? encounter.scale ?? 1 : 1;
    const unit = {
      id: side + '-' + position, definitionId: definition.id, name: definition.name,
      shape: definition.shape, side, position, hp: Math.round(definition.hp * scale * BALANCE.healthMultiplier),
      maxHp: Math.round(definition.hp * scale * BALANCE.healthMultiplier), attack: definition.attack * scale,
      armor: definition.armor, interval: definition.interval,
      elements: [...(slot.elements ?? definition.elements)], relic: slot.relic ?? 'none',
      targeting: slot.targeting ?? 'front', priority: slot.priority ?? 'reaction',
      shield: side === 'ally' ? researchValue('startingShield') : 0,
      statuses: {}, residues: {}, cooldowns: {}, ready: 0.4 + position * 0.3,
      casts: 0, phase: 0, definition,
    };
    units.push(unit);
  }
  config.team.forEach((slot, i) => addUnit(VESSEL_BY_ID[slot.vessel], 'ally', i, slot));
  encounter.enemies.forEach((id, i) => addUnit(ENEMY_BY_ID[id], 'enemy', i));
  const alive = side => units.filter(u => u.side === side && u.hp > 0);
  const opposing = unit => alive(unit.side === 'ally' ? 'enemy' : 'ally');
  const modifier = (unit, key) => Object.values(unit.statuses).reduce((v, s) => v + (STATUSES[s.id][key] ?? 0) * s.intensity, 0);
  const weakest = list => [...list].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.position - b.position)[0];
  const recipient = (effect, source, target) => effect.recipient === 'source' ? source : effect.recipient === 'weakestAlly' ? weakest(alive(source.side)) : target;
  const relic = unit => RELIC_BY_ID[unit.relic].modifiers;

  function applyStatus(target, id, duration, intensity, source, stacks = 1) {
    if (!target || target.hp <= 0 || target.definition.immunities?.includes(id)) return;
    const definition = STATUSES[id];
    if (!definition) throw new Error('Unknown status: ' + id);
    const extra = (relic(source).statusDuration?.[id] ?? 0)
      + (source.side === 'ally' ? research.reduce((sum, r) => sum + (r.modifiers.statusDuration?.[id] ?? 0), 0) : 0);
    const old = target.statuses[id];
    target.statuses[id] = {
      id, expires: time + duration + extra,
      intensity: Math.max(old?.intensity ?? 0, intensity),
      stacks: Math.min(definition.maxStacks, (old?.stacks ?? 0) + stacks),
      source: source.id, power: source.attack,
    };
    emit('status', { source: source.id, target: target.id, status: id, stacks: target.statuses[id].stacks });
  }

  function dealDamage(source, target, amount, element, reaction = false) {
    if (!target || target.hp <= 0) return;
    let armor = target.armor * Math.max(0, 1 + modifier(target, 'armorMultiplier'));
    for (const weakness of target.definition.weaknesses ?? []) if (target.statuses[weakness.status]) armor *= weakness.armorMultiplier;
    let received = 1 + modifier(target, 'receivedMultiplier');
    for (const s of Object.values(target.statuses)) {
      for (const [tag, value] of Object.entries(STATUSES[s.id].elementalReceivedMultiplier ?? {})) {
        if (ELEMENT_BY_ID[element]?.tags.includes(tag)) received += value * s.intensity;
      }
    }
    const raw = Math.max(BALANCE.minimumDamage, Math.round(amount * BALANCE.armorDivisor / (BALANCE.armorDivisor + armor) * received));
    const absorbed = Math.min(target.shield, raw);
    target.shield -= absorbed;
    const dealt = Math.min(target.hp, raw - absorbed);
    target.hp -= dealt;
    if (source.side === 'ally') {
      report.totalDamage += dealt;
      report.damageByElement[element] = (report.damageByElement[element] ?? 0) + dealt;
      report.damageByUnit[source.definitionId] = (report.damageByUnit[source.definitionId] ?? 0) + dealt;
      if (reaction) report.reactionDamage += dealt;
    }
    emit('damage', { source: source.id, target: target.id, amount: dealt, absorbed, element, reaction });
    if (target.hp === 0) emit('death', { target: target.id, name: target.name });
    const phases = target.definition.phases ?? [];
    while (target.hp > 0 && target.phase < phases.length && target.hp / target.maxHp <= phases[target.phase].below) {
      const phase = phases[target.phase++];
      target.attack *= phase.attackMultiplier;
      target.interval *= phase.intervalMultiplier;
      emit('phase', { target: target.id, name: phase.label });
    }
  }

  function heal(source, target, amount) {
    if (!target || target.hp <= 0) return;
    const restored = Math.min(target.maxHp - target.hp, Math.round(amount * (relic(source).healingMultiplier ?? 1)));
    target.hp += restored;
    if (source.side === 'ally') report.healing += restored;
    if (restored) emit('heal', { source: source.id, target: target.id, amount: restored });
  }

  function applyEffects(effects, source, target, element, context, queue, isReaction = false) {
    for (const effect of effects) {
      const chosen = recipient(effect, source, target);
      switch (effect.type) {
        case 'damage': dealDamage(source, chosen, source.attack * effect.scale, element, isReaction); break;
        case 'status': applyStatus(chosen, effect.status, effect.duration, effect.intensity, source, effect.stacks); break;
        case 'heal': heal(source, chosen, source.attack * effect.scale); break;
        case 'shield':
          if (chosen?.hp > 0) {
            chosen.shield = Math.min(chosen.maxHp * 0.5, chosen.shield + Math.round(source.attack * effect.scale));
            emit('shield', { source: source.id, target: chosen.id, amount: chosen.shield });
          }
          break;
        case 'cleanse':
          if (chosen) for (const s of Object.values(chosen.statuses).filter(s => STATUSES[s.id].harmful).slice(0, effect.count)) delete chosen.statuses[s.id];
          break;
        case 'spread': {
          const targets = [target, ...opposing(source).filter(u => u.id !== target.id)].filter(u => u.hp > 0).slice(0, effect.count + 1);
          for (const other of targets) applyStatus(other, effect.status, effect.duration, effect.intensity, source);
          break;
        }
        case 'chain': {
          const targets = opposing(source).filter(u => u.id !== target.id).slice(0, effect.count + (relic(source).chainTargets ?? 0));
          for (const other of targets) {
            dealDamage(source, other, source.attack * effect.scale, effect.element, true);
            applyStatus(other, effect.status, 3, 0.2, source);
            queue.push({ source, target: other, element: effect.element, context: { ...context, depth: context.depth + 1 } });
          }
          break;
        }
        case 'applyElement': queue.push({ source, target: chosen, element: effect.element, context: { ...context, depth: context.depth + 1 } }); break;
        default: throw new Error('Unsupported effect: ' + effect.type);
      }
    }
  }

  function reactionOptions(source, target, element) {
    const context = { environment: encounter.environment, statuses: Object.keys(target.statuses) };
    const present = new Set(Object.keys(target.residues));
    // Status/element associations are content-level affinities, not individual recipe cases.
    for (const id of Object.keys(target.statuses)) {
      const affinity = STATUS_AFFINITIES[id];
      if (affinity) present.add(affinity);
    }
    const rules = [...present].map(other => engine.resolve(element, other, context)).filter(Boolean);
    return rules.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  function applyElement(source, target, element) {
    const queue = [{ source, target, element, context: { depth: 0, triggered: new Set(), maxDepth: source.side === 'ally' ? maxDepth : BALANCE.maxChainDepth } }];
    let processed = 0;
    while (queue.length && processed++ < BALANCE.maxEventsPerAction) {
      const item = queue.shift();
      const { source: actor, target: victim, element: incoming, context } = item;
      if (!victim || victim.hp <= 0) continue;
      if (context.depth >= context.maxDepth) { report.guardedEvents++; continue; }
      const rule = reactionOptions(actor, victim, incoming).find(r => engine.canTrigger(r, context) && (victim.cooldowns[r.id] ?? -1) <= time);
      victim.residues[incoming] = time + BALANCE.residueDuration;
      if (!rule) continue;
      context.triggered.add(rule.id);
      victim.cooldowns[rule.id] = time + rule.cooldown;
      for (const id of rule.inputs) delete victim.residues[id];
      victim.residues[rule.output] = time + BALANCE.residueDuration;
      const depth = context.depth + 1;
      report.highestChain = Math.max(report.highestChain, depth);
      if (actor.side === 'ally') report.reactions[rule.id] = (report.reactions[rule.id] ?? 0) + 1;
      emit('reaction', { source: actor.id, target: victim.id, id: rule.id, name: rule.name, element: rule.output, depth });
      const next = { ...context, depth };
      applyEffects(rule.effects, actor, victim, rule.output, next, queue, true);
      queue.push({ source: actor, target: victim, element: rule.output, context: next });
    }
    if (queue.length) report.guardedEvents += queue.length;
  }

  function chooseAction(source) {
    const enemies = opposing(source);
    if (!enemies.length) return null;
    let target = source.targeting === 'weakest' ? weakest(enemies) : enemies[0];
    let element = source.elements[source.casts % source.elements.length];
    if (source.priority === 'reaction') {
      let best = null;
      for (const candidate of source.targeting === 'reaction' ? enemies : [target]) {
        for (const id of source.elements) {
          const rule = reactionOptions(source, candidate, id).find(r => (candidate.cooldowns[r.id] ?? -1) <= time);
          if (rule && (!best || rule.priority > best.rule.priority)) best = { target: candidate, element: id, rule };
        }
      }
      if (best) ({ target, element } = best);
    } else if (source.priority === 'core') element = source.elements[0];
    return { target, element };
  }

  const snapshot = () => ({
    time, eventCount: events.length,
    units: units.map(u => ({ id: u.id, definitionId: u.definitionId, side: u.side, position: u.position, name: u.name, shape: u.shape, hp: u.hp, maxHp: u.maxHp, shield: u.shield, elements: u.elements, statuses: Object.values(u.statuses).map(s => ({ id: s.id, stacks: s.stacks, remaining: Math.max(0, s.expires - time) })), phase: u.phase })),
  });
  if (captureFrames) frames.push(snapshot());
  emit('start', { seed: config.seed, environment: encounter.environment });
  const steps = Math.round(BALANCE.maxTime / BALANCE.step);
  for (let tick = 1; tick <= steps; tick++) {
    time = tick * BALANCE.step;
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      for (const [id, expires] of Object.entries(unit.residues)) if (expires <= time) delete unit.residues[id];
      for (const s of Object.values(unit.statuses)) {
        if (s.expires <= time) { delete unit.statuses[s.id]; continue; }
        if (tick % Math.round(BALANCE.statusTick / BALANCE.step) === 0 && STATUSES[s.id].periodic) {
          const source = units.find(u => u.id === s.source);
          if (STATUSES[s.id].periodic === 'damage') dealDamage(source, unit, s.power * s.intensity * s.stacks, STATUS_AFFINITIES[s.id] ?? source.elements[0]);
          else heal(source, unit, s.power * s.intensity * s.stacks);
        }
      }
      if (unit.hp <= 0 || Object.values(unit.statuses).some(s => STATUSES[s.id].disables)) continue;
      unit.ready -= BALANCE.step * Math.max(0.2, 1 + modifier(unit, 'speedMultiplier'));
      if (unit.ready > 0) continue;
      const action = chooseAction(unit);
      if (!action) break;
      const { target, element } = action;
      unit.casts++;
      unit.ready += unit.interval;
      report.decisions++;
      emit('cast', { source: unit.id, target: target.id, element, priority: unit.priority });
      const masteryLevel = unit.side === 'ally' ? Math.floor((config.mastery?.[element] ?? 0) / BALANCE.masteryThreshold) : 0;
      const critical = rng() < BALANCE.criticalChance;
      const variance = 1 + (rng() * 2 - 1) * BALANCE.damageVariance;
      const power = unit.attack * ELEMENT_BY_ID[element].power * variance * (critical ? BALANCE.criticalMultiplier : 1)
        * (1 + masteryLevel * BALANCE.masteryPowerPerLevel) * Math.max(0.1, 1 + modifier(unit, 'damageMultiplier'));
      dealDamage(unit, target, power, element);
      const queue = [];
      applyEffects(ELEMENT_BY_ID[element].effects, unit, target, element, { depth: 0, triggered: new Set() }, queue);
      // Derived elements use the same effect vocabulary, including their outgoing chain applications.
      applyElement(unit, target, element);
      for (const event of queue) applyElement(event.source, event.target, event.element);
      if (masteryLevel >= BALANCE.masterySpreadLevel) {
        const extra = opposing(unit).find(u => u.id !== target.id);
        if (extra) dealDamage(unit, extra, power * BALANCE.masterySpreadScale, element);
      }
    }
    if (captureFrames) frames.push(snapshot());
    if (!alive('ally').length || !alive('enemy').length) break;
  }
  const outcome = alive('enemy').length === 0 ? 'victory' : alive('ally').length === 0 ? 'defeat' : 'draw';
  emit('end', { outcome });
  return { config: structuredClone(config), outcome, duration: time, report, events, frames, final: snapshot() };
}

// Shared semantic associations belong to data; exported separately for tooling and tests.
import { STATUS_AFFINITIES } from '../data/status-affinities.js';
