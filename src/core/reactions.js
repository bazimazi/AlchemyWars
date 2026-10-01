import { ELEMENT_BY_ID, REACTIONS, BALANCE } from '../data/content.js';

export const pairKey = (a, b) => [a, b].sort().join('|');

export function conditionsMet(conditions = {}, context = {}) {
  const statuses = context.statuses instanceof Set ? context.statuses : new Set(context.statuses ?? []);
  return (!conditions.environment || conditions.environment === context.environment)
    && (!conditions.statuses || conditions.statuses.every(id => statuses.has(id)));
}

export class ReactionEngine {
  constructor(definitions = REACTIONS) {
    this.byPair = new Map();
    this.byElement = new Map();
    for (const rule of definitions.filter(r => r.enabled)) {
      const key = pairKey(...rule.inputs);
      if (!this.byPair.has(key)) this.byPair.set(key, []);
      this.byPair.get(key).push(rule);
      for (const id of new Set(rule.inputs)) {
        if (!this.byElement.has(id)) this.byElement.set(id, []);
        this.byElement.get(id).push(rule);
      }
    }
    for (const rules of this.byPair.values()) rules.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  resolve(a, b, context = {}) {
    return (this.byPair.get(pairKey(a, b)) ?? []).find(rule => conditionsMet(rule.conditions, context)) ?? null;
  }

  candidates(element) { return this.byElement.get(element) ?? []; }

  // The same reaction cannot re-enter one action's chain. A separate cooldown guards new actions.
  canTrigger(rule, { depth = 0, triggered = new Set(), maxDepth = BALANCE.maxChainDepth } = {}) {
    return depth < maxDepth && !triggered.has(rule.id);
  }

  graph(discoveredIds, ownedIds) {
    const discovered = new Set(discoveredIds);
    const owned = new Set(ownedIds);
    return [...this.byPair.values()].flat().map(rule => {
      const known = discovered.has(rule.id);
      return {
        id: rule.id, known,
        name: known ? rule.name : 'Unknown reaction',
        inputs: rule.inputs.map((id, index) => known || index === 0 && owned.has(id) ? id : null),
        output: known ? rule.output : null,
        category: known ? rule.category : 'Unknown',
      };
    });
  }
}

export const reactionEngine = new ReactionEngine();

export function resolveExperiment(a, b, context = {}) {
  if (!ELEMENT_BY_ID[a]?.enabled || !ELEMENT_BY_ID[b]?.enabled) return null;
  return reactionEngine.resolve(a, b, context);
}
