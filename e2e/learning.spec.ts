import { test, expect } from '@playwright/test';

test('first-session guide completes through discovery, formation, report and independent experiment', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#lab');
  await expect(page.locator('.learning-guide')).toContainText('1 / 5');
  await expect(page.locator('#element-search')).toHaveAttribute('list', 'element-names');
  await expect(page.locator('#element-names option')).toHaveCount(10);
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await page.getByRole('button', { name: 'Build with this discovery' }).click();
  await page.locator('select[data-loadout="core"]').first().selectOption('steam');
  await page.goto('/#battle');
  await expect(page.locator('.learning-guide')).toContainText('3 / 5');
  await page.getByRole('button', { name: 'Begin expedition' }).click();
  await page.getByRole('button', { name: 'Skip to report' }).click();
  await expect(page.locator('.battle-lesson')).toBeVisible();
  await page.getByRole('button', { name: 'I have reviewed this report', exact: true }).click();
  await expect(page.locator('.learning-guide')).toContainText('5 / 5');
  const pair = await page.evaluate(async () => {
    const { REACTIONS, ELEMENT_BY_ID } = await import('/src/data/content.js');
    const player = JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!);
    const rule = REACTIONS.find(r => !r.conditions && !player.discoveries.includes(r.id) && r.inputs.every(id => player.owned.includes(id)))!;
    return rule.inputs.map(id => ELEMENT_BY_ID[id].name);
  });
  await page.goto('/#lab');
  await page.getByRole('button', { name: 'Select ' + pair[0], exact: true }).click();
  await page.getByRole('button', { name: 'Select ' + pair[1], exact: true }).click();
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await page.getByRole('button', { name: /Close dialog/ }).click();
  await expect(page.locator('.learning-guide')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.learning-guide')).toHaveCount(0);
  await page.getByRole('button', { name: 'Read about Fire', exact: true }).click();
  await expect(page.locator('.element-learning')).toContainText('elemental casts');
  await page.screenshot({ path: 'test-results/learning-detail-' + info.project.name + '.png' });
  expect(errors).toEqual([]);
});

test('laboratory scenarios repeat accurately and known recipe preparation resets target conditions', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#lab');
  await page.locator('.lab-scenario summary').click();
  await page.locator('#lab-health').fill('20'); await page.locator('#lab-health').blur();
  await page.locator('#lab-enemies').fill('4'); await page.locator('#lab-enemies').blur();
  await page.locator('#lab-shielded').check();
  await page.locator('[data-lab-status="burn"]').check(); await page.locator('[data-lab-tag="heat"]').check();
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await page.getByRole('button', { name: /Close dialog/ }).click();
  const context = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).history[0].context);
  expect(context).toMatchObject({ healthRatio: .2, enemyCount: 4, shielded: true, statuses: ['burn'], tags: ['heat'] });
  await page.reload(); await page.locator('.history-card').first().click();
  await page.locator('.lab-scenario summary').click();
  await expect(page.locator('#lab-health')).toHaveValue('20'); await expect(page.locator('#lab-shielded')).toBeChecked();
  await expect(page.locator('[data-lab-status="burn"]')).toBeChecked();
  await page.getByRole('button', { name: 'Prepare known recipe', exact: true }).click();
  await page.locator('.lab-scenario summary').click();
  await expect(page.locator('#lab-health')).toHaveValue('100'); await expect(page.locator('#lab-shielded')).not.toBeChecked();
  await expect(page.locator('[data-lab-status="burn"]')).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/lab-scenario-' + info.project.name + '.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('daily learning goals can be earned and claimed once through the journal', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#lab');
  await expect(page.getByRole('heading', { name: 'The Alchemy Lab', exact: true })).toBeVisible();
  const pairs = await page.evaluate(async () => {
    const { dailyGoals } = await import('/src/core/learning.js');
    const { REACTIONS, ELEMENT_BY_ID } = await import('/src/data/content.js');
    const player = JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!), practice = dailyGoals().practice;
    return REACTIONS.filter(r => !r.conditions && r.inputs.includes(practice) && r.inputs.every(id => player.owned.includes(id))).slice(0, 2).map(r => r.inputs.map(id => ELEMENT_BY_ID[id].name));
  });
  for (const pair of pairs) {
    await page.getByRole('button', { name: /Ingredient 1:/ }).click();
    await page.getByRole('button', { name: 'Select ' + pair[0], exact: true }).click();
    await page.getByRole('button', { name: 'Select ' + pair[1], exact: true }).click();
    await page.getByRole('button', { name: 'Combine elements' }).click();
    if (await page.getByRole('dialog').isVisible()) await page.getByRole('button', { name: /Close dialog/ }).click();
  }
  await page.goto('/#journal');
  const card = page.locator('[data-goal="practice"]'); await expect(card).toContainText('2 / 2');
  await card.getByRole('button', { name: 'Claim daily goal', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Reward claimed', exact: true })).toBeDisabled();
  await page.reload(); await expect(card.getByRole('button', { name: 'Reward claimed', exact: true })).toBeDisabled();
  const gold = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).gold);
  expect(gold).toBe(25);
  const achievement = page.locator('[data-action="x-achievement"][data-id="achievement-first-reaction"]');
  await achievement.click(); await expect(achievement).toHaveText('Reward claimed'); await expect(achievement).toBeDisabled();
  await page.goto('/#codex'); await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await expect(page.locator('.codex-grid').getByText(/Mythic/)).toBeVisible();
  await page.goto('/#journal');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.achievement-list').screenshot({ path: 'test-results/achievement-rewards-' + info.project.name + '.png' });
  await page.screenshot({ path: 'test-results/daily-goals-' + info.project.name + '.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('rare discovery presentation supports elemental audio and reduced motion', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#lab');
  await page.getByRole('button', { name: /Settings, Alchemist level/ }).click();
  await page.locator('[data-setting="sound"]').check(); await page.locator('[data-setting="reducedMotion"]').check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Select Fire', exact: true }).click();
  await page.getByRole('button', { name: 'Select Lightning', exact: true }).click();
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await expect(page.getByRole('dialog')).toContainText('Plasma');
  await expect(page.locator('.discovery-reveal')).toHaveAttribute('data-grade', 'rare');
  await expect(page.locator('.discovery-rarity')).toHaveText('Rare');
  expect(await page.locator('.reveal-orbit .sigil').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.screenshot({ path: 'test-results/rare-discovery-' + info.project.name + '.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
