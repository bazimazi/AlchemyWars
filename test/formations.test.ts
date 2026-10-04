import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, experiment } from '../src/core/progression.js';
import { executeCommand } from '../src/core/commands.js';
import { normalizeSave } from '../src/core/save.js';
import { saveLoadout, applyLoadout, renameLoadout, replaceLoadout, deleteLoadout, formationKey, normalizeTestedBuilds, validFormation, FORMATION_LIMIT } from '../src/core/formations.js';

test('formation library preserves every tactical choice and clones on save, replace and load', () => {
  const p = createPlayer(); experiment(p, 'fire', 'water');
  p.team[0] = { ...p.team[0], elements: ['steam', 'water'], abilities: ['ward'], passive: 'first-ward', reactionPriority: ['steam'], targeting: 'weakest', priority: 'alternate' };
  p.equipment = ['ember-focus']; p.team[0].equipment = { weapon: 'ember-focus' };
  const original = structuredClone(p.team);
  assert.equal(saveLoadout(p, 'Storm garden'), true);
  p.team[0].elements[0] = 'fire'; assert.deepEqual(p.loadouts[0].team, original);
  assert.equal(applyLoadout(p, 0), true); assert.deepEqual(p.team, original);
  p.team[0].priority = 'core'; assert.equal(p.loadouts[0].team[0].priority, 'alternate');
  assert.equal(replaceLoadout(p, 0), true); assert.equal(p.loadouts[0].team[0].priority, 'core');
  p.team[0].elements[0] = 'fire'; assert.equal(p.loadouts[0].team[0].elements[0], 'steam');
  assert.deepEqual(normalizeSave(p).loadouts, p.loadouts);
});

test('formation names are bounded, unique without case differences and validated before mutation', () => {
  const p = createPlayer();
  for (const name of ['', '   ', null, 12, {}]) assert.equal(saveLoadout(p, name), false);
  assert.equal(saveLoadout(p, '  Garden  '), true); assert.equal(p.loadouts[0].name, 'Garden');
  assert.equal(saveLoadout(p, 'gARDEN'), false); assert.equal(saveLoadout(p, 'Second'), true);
  const before = structuredClone(p.loadouts);
  for (const name of ['garden', ' ', null]) assert.equal(renameLoadout(p, 1, name), false);
  assert.deepEqual(p.loadouts, before);
  assert.equal(renameLoadout(p, 0, 'GARDEN'), true);
  assert.equal(renameLoadout(p, 1, 'x'.repeat(80)), true); assert.equal(p.loadouts[1].name.length, 40);
});

test('full libraries can replace, rename, delete and reuse their ten slots', () => {
  const p = createPlayer();
  for (let i = 0; i < FORMATION_LIMIT; i++) assert.equal(saveLoadout(p, 'Build ' + i), true);
  assert.equal(saveLoadout(p, 'Overflow'), false);
  p.team[0].elements = ['water', 'earth']; assert.equal(replaceLoadout(p, 4), true);
  assert.equal(renameLoadout(p, 4, 'Riverbank'), true);
  const active = structuredClone(p.team); assert.equal(deleteLoadout(p, 2), true);
  assert.deepEqual(p.team, active); assert.equal(p.loadouts[3].name, 'Riverbank');
  assert.equal(saveLoadout(p, 'New hypothesis'), true); assert.equal(p.loadouts.length, 10);
});

test('all indexed library commands reject malformed indices atomically', () => {
  const p = createPlayer(); saveLoadout(p, 'Garden'); const before = structuredClone(p);
  for (const command of ['apply-loadout', 'rename-loadout', 'replace-loadout', 'delete-loadout']) {
    for (const index of [-1, 1, 10, 1.5, NaN, Infinity, '0', '__proto__', null, []]) assert.equal(executeCommand(p, command, { index, name: 'Changed' }), false);
  }
  assert.deepEqual(p, before);
  for (const fn of [applyLoadout, replaceLoadout, deleteLoadout]) assert.equal(fn(p, -1), false);
});

test('saved formations cannot bypass vessel, element, relic, passive, equipment or recipe unlocks', () => {
  const p = createPlayer(); saveLoadout(p, 'Garden');
  const pristine = structuredClone(p.loadouts[0].team), active = structuredClone(p.team);
  const patches = [{ elements: ['steam', 'water'] }, { relic: 'genesis-thread' }, { passive: 'last-light' }, { equipment: { core: 'aegis-core' } }, { equipment: { weapon: 'aegis-core' } }, { reactionPriority: ['steam'] }, { abilities: ['renewal'] }, { targeting: 'unknown' }];
  for (const patch of patches) {
    Object.assign(p.loadouts[0].team[0], patch);
    assert.equal(applyLoadout(p, 0), false, JSON.stringify(patch)); assert.deepEqual(p.team, active);
    p.loadouts[0].team = structuredClone(pristine);
  }
  p.loadouts[0].team[1].vessel = p.loadouts[0].team[0].vessel; assert.equal(applyLoadout(p, 0), false);
});

test('invalid current formations cannot replace a healthy saved copy', () => {
  const p = createPlayer(); saveLoadout(p, 'Garden'); const before = structuredClone(p.loadouts);
  p.team[0].elements = ['__proto__', 'fire'];
  assert.equal(validFormation(p, p.team), false); assert.equal(replaceLoadout(p, 0), false); assert.equal(saveLoadout(p, 'Bad'), false);
  assert.deepEqual(p.loadouts, before);
});

test('formation migration trims names, discards blank copies and rejects inherited vessel keys', () => {
  const p = createPlayer(); saveLoadout(p, '  Garden  ');
  p.loadouts.push({ name: '   ', team: structuredClone(p.team) });
  const invalid = structuredClone(p.team); invalid[0].vessel = '__proto__';
  p.loadouts.push({ name: 'Corrupt copy', team: invalid });
  p.team = invalid;
  const restored = normalizeSave(p);
  assert.equal(restored.loadouts.length, 1); assert.equal(restored.loadouts[0].name, 'Garden');
  assert.ok(validFormation(restored, restored.team));
});

test('build identities ignore optional defaults and equipment property order, but retain tactical order', () => {
  const p = createPlayer(), original = formationKey(p.team);
  p.team[0] = { ...p.team[0], passive: 'none', abilities: [], equipment: {}, reactionPriority: [] };
  assert.equal(formationKey(p.team), original);
  p.team[0].equipment = { core: 'aegis-core', weapon: 'ember-focus' }; const geared = formationKey(p.team);
  p.team[0].equipment = { weapon: 'ember-focus', core: 'aegis-core' }; assert.equal(formationKey(p.team), geared);
  p.team[0].abilities = ['ward', 'mend']; const first = formationKey(p.team);
  p.team[0].abilities.reverse(); assert.notEqual(formationKey(p.team), first);
  const before = formationKey(p.team); p.team.reverse(); assert.notEqual(formationKey(p.team), before);
});

test('historical build normalization bounds records and rejects invalid or noncanonical identities', () => {
  const p = createPlayer(), keys: string[] = [];
  for (let i = 0; i < 120; i++) { p.team[0].elements = [p.owned[i % 10], p.owned[Math.floor(i / 10) % 10]]; p.team[1].targeting = i < 100 ? 'front' : 'weakest'; keys.push(formationKey(p.team)); }
  const bad = JSON.parse(keys[0]); bad[0][0] = '__proto__';
  assert.deepEqual(normalizeTestedBuilds([null, '{}', 'x'.repeat(5001), JSON.stringify(bad), keys[0] + ' ', keys[0], keys[0]]), [keys[0]]);
  assert.equal(normalizeTestedBuilds(keys).length, 100); assert.deepEqual(normalizeTestedBuilds({}), []);
  p.learning.testedBuilds = keys; assert.equal(normalizeSave(p).learning.testedBuilds.length, 100);
});
