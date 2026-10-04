import { test, expect } from '@playwright/test';

test('talent branches enforce prerequisites, keep keyboard focus and persist purchases', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#workshop');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js'); const p = createPlayer(); p.knowledge = 600;
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload(); await expect(page.locator('.talent-card')).toHaveCount(18); await expect(page.locator('.talent-branch')).toHaveCount(6);
  const parallel = page.locator('[data-talent="parallel-notes"]'); await expect(parallel.getByRole('button')).toBeDisabled();
  await page.getByRole('button', { name: 'Alchemy', exact: true }).click(); await expect(page.getByRole('region', { name: 'Alchemy talents', exact: true })).toBeFocused();
  for (const id of ['deep-binding', 'reaction-scholar', 'parallel-notes', 'recursive-binding']) {
    const card = page.locator('[data-talent="' + id + '"]'); await card.getByRole('button').click();
    await expect(card).toBeFocused(); await expect(card.getByRole('button')).toBeDisabled();
  }
  await expect(page.getByRole('region', { name: 'Alchemy talents', exact: true })).toContainText('3 / 3 talents learned');
  await page.getByRole('region', { name: 'Alchemy talents', exact: true }).screenshot({ path: 'test-results/talent-tree-' + info.project.name + '.png' });
  await page.reload(); await expect(parallel.getByRole('button')).toBeDisabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect(saved.knowledge).toBe(505);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('prepared experiments save complete scenarios, gain a second slot and restore through reload', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#lab');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js'); const p = createPlayer(); p.knowledge = 200;
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload(); const notebook = page.locator('.experiment-notebook');
  await page.getByLabel('Experiment atmosphere').selectOption('rain'); await page.getByLabel('Frozen target', { exact: true }).check();
  await page.locator('.lab-scenario summary').click(); await page.getByLabel('Target health (%)', { exact: true }).fill('20'); await page.getByLabel('Target health (%)', { exact: true }).press('Tab');
  await page.getByLabel('Enemy count', { exact: true }).fill('3'); await page.getByLabel('Enemy count', { exact: true }).press('Tab'); await page.getByLabel('Shielded target', { exact: true }).check();
  await notebook.getByLabel('Experiment name').fill('Storm question'); await notebook.getByRole('button', { name: 'Save prepared experiment', exact: true }).click();
  await expect(notebook.locator('.saved-experiment')).toHaveCount(1); await expect(notebook.getByRole('button', { name: 'Save prepared experiment', exact: true })).toBeDisabled();
  await expect(notebook).toContainText('20% target health'); await expect(notebook).toContainText('3 enemies');
  await page.goto('/#workshop'); for (const id of ['deep-binding', 'reaction-scholar', 'parallel-notes']) await page.locator('[data-talent="' + id + '"] button').click();
  await page.goto('/#lab'); await notebook.getByLabel('Experiment name').fill('Second question'); await notebook.getByRole('button', { name: 'Save prepared experiment', exact: true }).click();
  await expect(notebook.locator('.saved-experiment')).toHaveCount(2);
  await page.getByLabel('Experiment atmosphere').selectOption('holy'); await page.getByRole('button', { name: 'Select Earth', exact: true }).click(); await page.getByRole('button', { name: 'Select Fire', exact: true }).click();
  await notebook.locator('.saved-experiment').last().getByRole('button', { name: 'Replace with current', exact: true }).click();
  await page.reload(); await notebook.getByRole('button', { name: 'Load Storm question', exact: true }).click();
  await expect(page.locator('.combine-button')).toBeFocused(); await expect(page.getByLabel('Experiment atmosphere')).toHaveValue('rain'); await expect(page.getByLabel('Frozen target', { exact: true })).toBeChecked();
  await page.locator('.lab-scenario summary').click(); await expect(page.getByLabel('Target health (%)', { exact: true })).toHaveValue('20'); await expect(page.getByLabel('Enemy count', { exact: true })).toHaveValue('3'); await expect(page.getByLabel('Shielded target', { exact: true })).toBeChecked();
  await notebook.screenshot({ path: 'test-results/experiment-notebook-' + info.project.name + '.png' });
  await notebook.locator('.saved-experiment').last().getByRole('button', { name: 'Delete note', exact: true }).click(); await expect(notebook.locator('.saved-experiment')).toHaveCount(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect(saved.experiments).toBe(0); expect(saved.experimentNotes[0].context.mastery).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('research and crafting talents display and spend the discounted shared costs', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#workshop');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js'); const { TALENTS } = await import('/src/data/systems.js');
    const p = createPlayer(); p.talents = TALENTS.map(t => t.id); p.gold = 60; p.essence = 8; p.shards = 1; p.knowledge = 100;
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload(); const craft = page.getByRole('button', { name: 'Craft Ember Focus', exact: true });
  await expect(craft.locator('..')).toContainText('60 gold'); await expect(craft.locator('..')).toContainText('8 essence'); await craft.click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect([saved.gold, saved.essence, saved.shards]).toEqual([0, 0, 0]);
  await page.goto('/#research'); const study = page.locator('[data-research="warding"]');
  const cost = await page.evaluate(async () => { const { RESEARCH } = await import('/src/data/content.js'); return Math.ceil(RESEARCH.find(r => r.id === 'warding')!.cost * .7); });
  await expect(study.getByRole('button')).toContainText(cost + ' knowledge'); await study.getByRole('button').click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect(saved.essence).toBe(3); expect(saved.knowledge).toBe(100 - cost);
  await page.reload(); await expect(study.getByRole('button')).toBeDisabled(); expect(errors).toEqual([]);
});

test('first-clear talent rewards expose a safe field clue and retain it in the laboratory journal', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#battle');
  await page.evaluate(async () => {
    const { createPlayer, uncoverFieldClue } = await import('/src/core/progression.js');
    const p = createPlayer(); p.talents = ['careful-notes', 'field-clues', 'gentle-guidance', 'field-alchemist', 'first-survey', 'deep-binding', 'reaction-conduit', 'reactive-ward'];
    p.team.forEach(s => { s.elements = ['light', 'shadow']; p.vesselXp[s.vessel] = 450; }); p.mastery.light = p.mastery.shadow = 300;
    const seed = Array.from({ length: 100 }, (_, i) => i).find(seed => uncoverFieldClue(structuredClone(p), seed))!;
    crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => { if (array instanceof Uint32Array) array.fill(seed); return array; };
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
    sessionStorage.setItem('talent-test-seed', String(seed));
  });
  await page.reload();
  await page.evaluate(() => { const seed = Number(sessionStorage.getItem('talent-test-seed')); crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => { if (array instanceof Uint32Array) array.fill(seed); return array; }; });
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  await expect(page.locator('.field-clue-reward')).toContainText('A field clue uncovered');
  await expect(page.locator('.earned-rewards')).toContainText('+8 essence');
  await page.locator('.field-clue-reward').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.locator('.field-clue-reward').screenshot({ path: 'test-results/field-clue-' + info.project.name + '.png' });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect(Object.values(before.hints)).toContain(1);
  await page.goto('/#lab'); await expect(page.locator('.hint-button')).toContainText('1'); await page.locator('.clue-journal summary').click(); await expect(page.locator('.saved-clue')).toHaveCount(Object.keys(before.hints).length);
  await page.reload(); await expect(page.locator('.clue-journal')).toBeVisible(); expect(errors).toEqual([]);
});
