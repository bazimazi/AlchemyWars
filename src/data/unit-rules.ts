/** Shared structural rules for authored units and incoming content packs. */
export function validateUnitMechanics(value: unknown, refs: { element: (id: unknown) => boolean; status: (id: unknown) => boolean; effects: (value: unknown) => void; modifiers: (value: unknown) => void }) {
  const issues: string[] = [];
  const object = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
  const number = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const statuses = (v: unknown) => Array.isArray(v) && v.length <= 20 && new Set(v).size === v.length && v.every(refs.status);
  const unit = object(value);
  if (!unit) return ['Invalid unit mechanics.'];
  if (unit.immunities !== undefined && !statuses(unit.immunities)) issues.push('Invalid immunities.');
  function behaviors(v: unknown) {
    if (!Array.isArray(v) || v.length > 8) { issues.push('Use at most eight behaviors.'); return; }
    const ids = new Set<string>();
    for (const raw of v) {
      const b = object(raw);
      if (!b || typeof b.id !== 'string' || !/^(?!(?:constructor|prototype)$)[a-z][a-z0-9-]{1,59}$/.test(b.id) || ids.has(b.id) || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 80 || !['OnAbilityCast', 'OnLowHealth', 'OnDamageTaken'].includes(String(b.trigger)) || !number(b.cooldown, .25, 90)) { issues.push('Invalid behavior identity, trigger or cooldown.'); continue; }
      ids.add(b.id);
      if (b.suppressedBy !== undefined && !statuses(b.suppressedBy)) issues.push('Invalid behavior counter statuses.');
      refs.effects(b.effects);
    }
  }
  if (unit.behaviors !== undefined) behaviors(unit.behaviors);
  if (unit.phases !== undefined) {
    if (!Array.isArray(unit.phases) || unit.phases.length > 10) return [...issues, 'Use at most ten phases.'];
    let previous = 1;
    for (const raw of unit.phases) {
      const phase = object(raw);
      if (!phase || !number(phase.below, .001, .999) || phase.below >= previous || !number(phase.attackMultiplier, .1, 5) || !number(phase.intervalMultiplier, .1, 5) || typeof phase.label !== 'string' || !phase.label.trim() || phase.label.length > 120) { issues.push('Invalid phase or descending health thresholds.'); continue; }
      previous = phase.below;
      if (phase.elements !== undefined && (!Array.isArray(phase.elements) || phase.elements.length !== 2 || !phase.elements.every(refs.element))) issues.push('Invalid phase elements.');
      if (phase.immunities !== undefined && !statuses(phase.immunities)) issues.push('Invalid phase immunities.');
      if (phase.effects !== undefined) refs.effects(phase.effects);
      if (phase.behaviors !== undefined) behaviors(phase.behaviors);
      if (phase.modifiers !== undefined) {
        const m = object(phase.modifiers);
        if (!m || Object.keys(m).some(k => !['chainDepth', 'chainTargets', 'healingMultiplier', 'durationMultiplier', 'tagPower', 'statusDuration', 'disabledReactionTags'].includes(k))) issues.push('Unsupported phase modifiers.');
        refs.modifiers(phase.modifiers);
      }
    }
  }
  return issues;
}
