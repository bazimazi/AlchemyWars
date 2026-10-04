import { test, expect } from '@playwright/test';

test('formation library renames, replaces, loads and deletes saved copies through reload', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#team');
  const core = page.locator('select[data-loadout="core"]').first(), library = page.locator('.formation-library');
  await library.getByLabel('Save this formation').fill('First theory');
  await library.getByRole('button', { name: 'Save formation', exact: true }).click();
  await expect(library.locator('.saved-formation')).toHaveCount(1);
  await core.selectOption('water');
  await library.getByRole('button', { name: 'Replace with current', exact: true }).click();
  await library.getByLabel('Formation name').fill('River study');
  await library.getByLabel('Formation name').press('Tab');
  await expect(library.getByRole('button', { name: 'Rename', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(library.locator('h3')).toHaveText('River study');
  await expect(library.getByLabel('Formation name')).toBeFocused();
  await core.selectOption('earth');
  await library.getByRole('button', { name: 'Load River study', exact: true }).click();
  await expect(core).toHaveValue('water');
  await page.reload(); await expect(library.locator('h3')).toHaveText('River study'); await expect(core).toHaveValue('water');
  await library.screenshot({ path: 'test-results/formation-library-' + info.project.name + '.png' });
  await library.getByRole('button', { name: 'Delete saved copy', exact: true }).click();
  await expect(library.locator('.saved-formation')).toHaveCount(0); await expect(core).toHaveValue('water');
  await page.reload(); await expect(library).toContainText('0 / 10 saved');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('a full formation library allows editing and recovers a slot after deletion', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#team');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js');
    const { saveLoadout } = await import('/src/core/formations.js');
    const p = createPlayer(); for (let i = 0; i < 10; i++) saveLoadout(p, 'Theory ' + (i + 1));
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload();
  const library = page.locator('.formation-library'), first = library.locator('.saved-formation').first();
  await expect(library.getByRole('button', { name: 'Save formation', exact: true })).toBeDisabled();
  await first.getByLabel('Formation name').fill('Theory 2'); await first.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(first.locator('h3')).toHaveText('Theory 1');
  await first.getByLabel('Formation name').fill('Full library, new name'); await first.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('select[data-loadout="core"]').first().selectOption('water');
  await first.getByRole('button', { name: 'Replace with current', exact: true }).click();
  await first.screenshot({ path: 'test-results/formation-full-' + info.project.name + '.png' });
  await library.locator('.saved-formation').last().getByRole('button', { name: 'Delete saved copy', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Save formation', exact: true })).toBeEnabled();
  await library.getByLabel('Save this formation').fill('A new question'); await library.getByRole('button', { name: 'Save formation', exact: true }).click();
  await page.reload(); await expect(library.locator('.saved-formation')).toHaveCount(10); await expect(first.locator('h3')).toHaveText('Full library, new name');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(saved.loadouts[0].team[0].elements[0]).toBe('water'); expect(saved.learning.testedBuilds).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('guardian Poison victory exposes damage, achievement progress and a once-only reward', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#battle');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js');
    const { ELEMENTS, ENCOUNTERS, REACTIONS, RESEARCH } = await import('/src/data/content.js');
    const p = createPlayer(), target = ENCOUNTERS.find(e => e.id === 'molten-throne')!;
    p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.indexOf(target)).map(e => e.id);
    p.discoveries = REACTIONS.map(r => r.id); p.owned = ELEMENTS.map(e => e.id);
    p.mastery = Object.fromEntries(p.owned.map(id => [id, 300])); p.research = RESEARCH.map(r => r.id);
    p.talents = ['deep-binding', 'reaction-scholar']; p.evolution.poison = 3;
    p.team.forEach((s, i) => { s.elements = i === 0 ? ['poison', 'water'] : ['gravity', 'storm-surge']; p.vesselXp[s.vessel] = 450; });
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload();
  await page.locator('[data-action="encounter"][data-id="molten-throne"]').click();
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  await expect(page.locator('.report')).toContainText('A theory, proven.');
  await page.locator('.status-damage-details summary').click();
  await expect(page.locator('.status-damage-details')).toContainText(/Poison dealt \d+ health damage to The Molten King/);
  await page.locator('.status-damage-details').screenshot({ path: 'test-results/poison-proof-' + info.project.name + '.png' });
  await page.goto('/#journal');
  const achievement = page.locator('[data-achievement="poison-boss"]'), builds = page.locator('[data-achievement="hundred-builds"]');
  await expect(achievement.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await expect(builds.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  const gold = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).gold);
  await achievement.getByRole('button', { name: 'Claim achievement reward', exact: true }).click();
  await expect(achievement.getByRole('button', { name: 'Reward claimed', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).gold)).toBe(gold + 100);
  await page.reload(); await expect(achievement.getByRole('button')).toHaveText('Reward claimed');
  await builds.screenshot({ path: 'test-results/achievement-progress-' + info.project.name + '.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(saved.learning.poisonBossWins).toBe(1); expect(saved.learning.testedBuilds).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('a defeated weekly trial tests its formation and replay preserves that progress', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#journal');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js');
    const p = createPlayer(); p.team.forEach(s => s.elements = ['poison', 'poison']);
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload(); await page.locator('[data-action="x-trial"][data-id="weekly"]').click();
  await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  await expect(page.locator('.report')).toContainText('Every experiment teaches us.');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(before.learning.testedBuilds).toHaveLength(1); expect(before.dailyClaims).toEqual([]); expect(before.gold).toBe(0);
  await page.getByRole('button', { name: 'Replay battle', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(after.learning).toEqual(before.learning); expect(after.gold).toBe(0);
  await page.goto('/#journal'); await expect(page.locator('[data-achievement="hundred-builds"] [role="progressbar"]')).toHaveAttribute('aria-valuenow', '1');
  expect(errors).toEqual([]);
});
