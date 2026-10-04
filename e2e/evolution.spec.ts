import { test, expect, type Page } from '@playwright/test';

async function seed(page: Page, mode: 'workshop' | 'requirements' | 'battle') {
  await page.goto('/#workshop');
  await page.evaluate(async (mode) => {
    const { createPlayer } = await import('/src/core/progression.js'); const p = createPlayer();
    p.gold = mode === 'requirements' ? 180 : 360; p.essence = mode === 'requirements' ? 45 : 90;
    p.mastery = { fire: mode === 'requirements' ? 14 : 45, water: 30, nature: 45, ice: 45 };
    if (mode === 'battle') { p.evolution.ice = 3; p.team.forEach(s => { s.elements = ['ice', 'earth']; s.priority = 'alternate'; s.abilities = []; }); }
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  }, mode);
  await page.reload();
}

test('the workshop previews exact evolution costs, retains the selected element and exposes compatible free specializations', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await seed(page, 'workshop');
  const panel = page.locator('.workshop-evolution'), selection = page.getByLabel('Element to evolve');
  await selection.selectOption('nature'); await expect(selection).toBeFocused(); await expect(panel).toContainText('Living Seed');
  await expect(panel.locator('#specialization option')).toHaveCount(3); await expect(panel).toContainText('60 gold and 15 essence');
  const evolve = panel.getByRole('button', { name: 'Evolve selected element', exact: true });
  for (let level = 1; level <= 3; level++) {
    await expect(evolve).toBeEnabled(); await evolve.focus(); await page.keyboard.press('Enter');
    await expect(panel).toHaveAttribute('data-rank', String(level)); await expect(panel).toBeFocused(); await expect(selection).toHaveValue('nature');
    if (level < 3) await expect(panel).toContainText(60 * (level + 1) + ' gold and ' + 15 * (level + 1) + ' essence');
  }
  await expect(evolve).toBeDisabled(); await expect(panel).toContainText('Maximum evolution reached');
  await panel.getByLabel('Specialization', { exact: true }).selectOption('restorative'); await panel.getByRole('button', { name: 'Set specialization', exact: true }).click();
  await expect(selection).toHaveValue('nature'); await expect(panel).toContainText('Selected: Restorative');
  const last = panel.locator('.evolution-stages li').last(); await last.evaluate(el => el.scrollIntoView({ block: 'center' })); await last.screenshot({ path: 'test-results/evolution-stage-' + info.project.name + '.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect([saved.gold, saved.essence, saved.mastery.nature, saved.evolution.nature, saved.specializations.nature]).toEqual([0, 0, 45, 3, 'restorative']);
  await selection.selectOption('fire'); await expect(panel.locator('#specialization option')).toHaveCount(6); await expect(evolve).toBeDisabled();
  await page.reload(); await selection.selectOption('nature'); await expect(panel).toHaveAttribute('data-rank', '3'); await expect(panel.getByLabel('Specialization', { exact: true })).toHaveValue('restorative');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('workshop requirements block insufficient mastery and resources and keep unrelated specializations out of the choices', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await seed(page, 'requirements');
  const panel = page.locator('.workshop-evolution'), evolve = panel.getByRole('button', { name: 'Evolve selected element', exact: true });
  await expect(panel).toContainText('14 / 15 mastery XP'); await expect(evolve).toBeDisabled(); await expect(panel.getByRole('button', { name: 'Set specialization', exact: true })).toBeDisabled();
  await page.getByLabel('Element to evolve').selectOption('water'); await expect(evolve).toBeEnabled(); await expect(panel.locator('#specialization option[value="phoenix"]')).toHaveCount(0);
  await evolve.click(); await expect(panel).toHaveAttribute('data-rank', '1'); await evolve.click(); await expect(panel).toHaveAttribute('data-rank', '2');
  await expect(evolve).toBeDisabled(); await expect(panel).toContainText('180 gold and 45 essence'); await expect(panel).toContainText('30 / 45 mastery XP');
  await panel.locator('.evolution-price').evaluate(el => el.scrollIntoView({ block: 'center' })); await panel.locator('.evolution-price').screenshot({ path: 'test-results/evolution-price-' + info.project.name + '.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect([saved.gold, saved.essence, saved.mastery.water, saved.evolution.water, saved.evolution.fire]).toEqual([0, 0, 30, 2, undefined]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('a real evolved formation exposes its active signature and battle evidence without paying replay rewards', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await seed(page, 'battle'); await page.goto('/#battle');
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click(); await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('[data-action="inspect-unit"][data-id="ally-0"]').click(); await expect(page.locator('.unit-inspector')).toContainText('Ice: Glacial Shelter');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  await expect(page.locator('.evolution-report')).toContainText('Evolution signatures'); await page.locator('.evolution-report summary').click(); await expect(page.locator('.evolution-report')).toContainText('Glacial Shelter');
  const card = page.locator('.evolution-results article').first(); await card.evaluate(el => el.scrollIntoView({ block: 'center' })); await card.screenshot({ path: 'test-results/evolution-report-' + info.project.name + '.png' });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  await page.getByRole('button', { name: 'Replay battle', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report', exact: true }).click(); await expect(page.locator('.evolution-report')).toContainText('Evolution signatures');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect([after.gold, after.essence, after.battles, after.evolution.ice]).toEqual([before.gold, before.essence, before.battles, 3]);
  await page.reload(); await page.goto('/#workshop'); await page.getByLabel('Element to evolve').selectOption('ice'); await expect(page.locator('.workshop-evolution')).toHaveAttribute('data-rank', '3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});
