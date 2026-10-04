import type { ReactionDefinition, ReactionContext, Conditions, ChainContext } from '../types.js';
import { ELEMENT_BY_ID, REACTIONS, BALANCE } from '../data/content.js';

export const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export function conditionsMet(conditions: Conditions = {}, context: ReactionContext = {}) {
  const statuses = context.statuses instanceof Set ? context.statuses : new Set(context.statuses ?? []);
  return (!conditions.environment || conditions.environment === context.environment)
    && (!conditions.statuses || conditions.statuses.every(id => statuses.has(id)))
    && (conditions.healthBelow === undefined || (context.healthRatio ?? Infinity) < conditions.healthBelow)
    && (conditions.minimumEnemies === undefined || (context.enemyCount ?? 0) >= conditions.minimumEnemies)
    && (conditions.requiredTags === undefined || conditions.requiredTags.every(tag => context.tags?.includes(tag)))
    && (conditions.mastery === undefined || Object.entries(conditions.mastery).every(([id, level]) => (context.mastery?.[id] ?? 0) >= level))
    && (!conditions.research || conditions.research.every(id => context.research?.includes(id)))
    && (conditions.shielded === undefined || conditions.shielded === Boolean(context.shielded));
}

// Explicit player choices always precede content priorities, even in expansion packs.
export function compareReactionPriority(a: ReactionDefinition, b: ReactionDefinition, preferred: readonly string[] = []) {
  const ai = preferred.indexOf(a.id), bi = preferred.indexOf(b.id);
  if (ai >= 0 || bi >= 0) return ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
  return b.priority - a.priority || a.id.localeCompare(b.id);
}

export class ReactionEngine {
  byId = new Map<string, ReactionDefinition>();
  byPair = new Map<string, ReactionDefinition[]>();
  byElement = new Map<string, ReactionDefinition[]>();
  constructor(definitions = REACTIONS) {
    this.byPair = new Map();
    this.byElement = new Map();
    for (const rule of definitions.filter(r => r.enabled)) {
      this.byId.set(rule.id, rule);
      const key = pairKey(...rule.inputs);
      if (!this.byPair.has(key)) this.byPair.set(key, []);
      this.byPair.get(key)!.push(rule);
      for (const id of new Set(rule.inputs)) {
        if (!this.byElement.has(id)) this.byElement.set(id, []);
        this.byElement.get(id)!.push(rule);
      }
    }
    for (const rules of this.byPair.values()) rules.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  resolve(a: string, b: string, context: ReactionContext = {}) {
    return (this.byPair.get(pairKey(a, b)) ?? []).find(rule => conditionsMet(rule.conditions, context)) ?? null;
  }

  matching(a: string, b: string, context: ReactionContext = {}) {
    return (this.byPair.get(pairKey(a, b)) ?? []).filter(rule => conditionsMet(rule.conditions, context));
  }

  candidates(element: string) { return this.byElement.get(element) ?? []; }

  // The same reaction cannot re-enter one action's chain. A separate cooldown guards new actions.
  canTrigger(rule: ReactionDefinition, { depth = 0, triggered = new Set<string>(), maxDepth = BALANCE.maxChainDepth }: Partial<ChainContext> = {}) {
    return depth < maxDepth && !triggered.has(rule.id);
  }

  graph(discoveredIds: string[], ownedIds: string[]) {
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

export let reactionEngine = new ReactionEngine();
export function rebuildReactionIndex() { reactionEngine = new ReactionEngine(); }

export function resolveExperiment(a: string, b: string, context: ReactionContext = {}) {
  if (!ELEMENT_BY_ID[a]?.enabled || !ELEMENT_BY_ID[b]?.enabled) return null;
  return reactionEngine.resolve(a, b, context);
}
