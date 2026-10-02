import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, contentTemplate, contentAudit, installContentPack } from '../src/core/content-tools.js';
import { resolveExperiment } from '../src/core/reactions.js';
import { ReactionEngine } from '../src/core/reactions.js';
import { CONTENT_VERSION } from '../src/data/content.js';

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
  const rules = Array.from({ length: 10000 }, (_, i) => ({ id: 'rule-' + i, inputs: ['element-' + i, 'catalyst'], output: 'result-' + i, enabled: true, priority: i % 3, effects: [] }));
  const engine = new ReactionEngine(rules);
  for (let i = 0; i < rules.length; i++) assert.equal(engine.resolve('catalyst', 'element-' + i).output, 'result-' + i);
  assert.equal(engine.resolve('missing', 'catalyst'), null);
});
test('a reviewed data pack installs a new reaction without engine changes', () => {
  const element = contentTemplate('elements'), rule = { ...contentTemplate('reactions'), id: element.id };
  const pack = { id: 'test-pack', version: 1, elements: [element], reactions: [rule] };
  assert.deepEqual(validatePack(pack), []);
  installContentPack(pack);
  assert.equal(resolveExperiment('light', 'wind').id, element.id);
  assert.match(CONTENT_VERSION, /test-pack/);
  assert.ok(validatePack(pack).some(i => i.includes('increase')));
  assert.deepEqual(contentAudit().errors, []);
});
