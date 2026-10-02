import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, contentTemplate, contentAudit, installContentPack } from '../src/core/content-tools.js';
import { resolveExperiment } from '../src/core/reactions.js';
import { ReactionEngine } from '../src/core/reactions.js';
import { CONTENT_VERSION, REACTIONS } from '../src/data/content.js';

test('content pack rejects malformed collections, markup and unknown references', () => {
  assert.ok(validatePack({ id: 'bad-pack', version: 1, elements: {} }).length);
  const element = contentTemplate('elements');
  assert.deepEqual(validatePack({ id: 'valid-pack', version: 1, elements: [element] }), []);
  element.name = '<script>alert(1)</script>';
  assert.ok(validatePack({ id: 'bad-pack', version: 1, elements: [element] }).length);
  const rule = contentTemplate('reactions');
  assert.ok(validatePack({ id: 'bad-pack', version: 1, reactions: [rule] }).length);
});
test('indexed reaction lookup supports ten thousand definitions', () => {
  const rules = Array.from({ length: 10000 }, (_, i) => ({ ...REACTIONS[0], id: 'rule-' + i, inputs: ['element-' + i, 'catalyst'] as [string,string], output: 'result-' + i, enabled: true, priority: i % 3, effects: [] }));
  const engine = new ReactionEngine(rules);
  for (let i = 0; i < rules.length; i++) assert.equal(engine.resolve('catalyst', 'element-' + i)!.output, 'result-' + i);
  assert.equal(engine.resolve('missing', 'catalyst'), null);
});
test('a reviewed data pack installs a new reaction without engine changes', () => {
  const element = contentTemplate('elements'), rule = { ...contentTemplate('reactions'), id: element.id };
  const pack = { id: 'test-pack', version: 1, elements: [element], reactions: [rule] };
  assert.deepEqual(validatePack(pack), []);
  installContentPack(pack);
  assert.equal(resolveExperiment('light', 'wind')!.id, element.id);
  assert.match(CONTENT_VERSION, /test-pack/);
  assert.ok(validatePack(pack).some(i => i.includes('increase')));
  assert.deepEqual(contentAudit().errors, []);
});


test('content packs reject incomplete effect primitives before installation', () => {
  for (const effects of [[{ type: 'chain', scale: .5 }], [{ type: 'spread', status: 'wet', intensity: 1, duration: 2 }], [{ type: 'transform' }], [{ type: 'summon', scale: .5 }], [{ type: 'cleanse', count: 1.5 }]]) {
    const element = { ...contentTemplate('elements'), effects };
    assert.ok(validatePack({ id: 'broken-effects', version: 1, elements: [element] }).length, JSON.stringify(effects));
  }
});
test('content packs validate nested conditions and effect modifiers', () => {
  for (const conditions of [{ mastery: { fire: 11 } }, { healthBelow: 2 }, { requiredTags: 7 }, { environment: 'missing' }, { injected: true }]) {
    const element = contentTemplate('elements'), reaction = { ...contentTemplate('reactions'), id: element.id, conditions };
    assert.ok(validatePack({ id: 'broken-condition', version: 1, elements: [element], reactions: [reaction] }).length);
  }
  for (const modifiers of [{ healingMultiplier: 'many' }, { statusDuration: { missing: 3 } }, { tagPower: { heat: Infinity } }, { arbitrary: 4 }]) {
    assert.ok(validatePack({ id: 'broken-modifier', version: 1, relics: [{ ...contentTemplate('relics'), modifiers }] }).length);
  }
});
test('boss phase effects, statuses and encounter references are validated', () => {
  const enemy = contentTemplate('enemies');
  assert.ok(validatePack({ id: 'broken-boss', version: 1, enemies: [{ ...enemy, phases: [{ below: .5, attackMultiplier: 1.2, intervalMultiplier: .9, label: 'Shift', effects: [{ type: 'summon', enemy: 'missing', scale: .5 }] }] }] }).length);
  assert.ok(validatePack({ id: 'broken-status', version: 1, statuses: [{ ...contentTemplate('statuses'), receivedMultiplier: Infinity }] }).length);
  assert.ok(validatePack({ id: 'broken-region', version: 1, encounters: [{ ...contentTemplate('encounters'), enemies: ['slime'], environment: 'missing' }] }).length);
});
test('rejected packs never partially mutate the catalog or content version', () => {
  const before = CONTENT_VERSION, element = contentTemplate('elements');
  assert.throws(() => installContentPack({ id: 'partial-pack', version: 1, elements: [{ ...element, id: 'partial-element' }], enemies: [{ ...contentTemplate('enemies'), elements: ['missing','fire'] }] }));
  assert.equal(CONTENT_VERSION, before);
  assert.equal(resolveExperiment('partial-element', 'fire'), null);
});
