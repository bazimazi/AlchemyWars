import { test, expect } from '@playwright/test';
test('discover, equip, battle, save and replay without console errors', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Alchemy Lab' })).toBeVisible();
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await expect(page.getByRole('dialog')).toContainText('NEW DISCOVERY');
  await expect(page.getByRole('dialog')).toContainText('Steam');
  await page.getByRole('button', { name: 'Keep experimenting' }).click();
  await page.getByRole('button', { name: 'Select Wind', exact: true }).click();
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await expect(page.getByRole('dialog')).toContainText('Storm Cloud');
  await page.getByRole('button', { name: 'Build with this discovery' }).click();
  await expect(page.getByRole('heading', { name: 'Your Formation', exact: true })).toBeVisible();
  await page.locator('select[data-loadout="core"]').first().selectOption('storm-cloud');
  await page.goto('/#battle');
  await page.getByRole('button', { name: 'Begin expedition' }).click();
  await expect(page.locator('.arena')).toBeVisible();
  await page.getByRole('button', { name: 'Skip to report' }).click();
  await expect(page.locator('.report')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(saved.battles).toBe(1); expect(saved.discoveries).toContain('steam');
  await page.getByRole('button', { name: 'Replay battle', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to report' }).click();
  const replayed = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(replayed.battles).toBe(1); expect(replayed.gold).toBe(saved.gold);
  await page.reload();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(restored.team[0].elements[0]).toBe('storm-cloud');
  await page.goto('/#lab');
  await page.screenshot({ path: 'test-results/laboratory-' + info.project.name + '.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('all views render with no horizontal overflow', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const view of ['home', 'lab', 'team', 'battle', 'codex', 'research', 'workshop', 'runs', 'journal', 'community', 'editor']) {
    await page.goto('/#' + view);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), view).toBe(true);
    if (view === 'journal') await page.screenshot({ path: 'test-results/journal-' + info.project.name + '.png', fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('roguelite completes all eight floors through the interface', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#runs');
  // Pin only the run seed; commands, combat, reward draft and persistence remain real.
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js');
    const { startRun } = await import('/src/core/modes.js');
    const player = createPlayer(); startRun(player, 'roguelite', 42, ['light', 'shadow']);
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(player));
  });
  await page.reload();
  for (let floor = 1; floor <= 8; floor++) {
    await page.getByRole('button', { name: 'Enter floor ' + floor, exact: true }).click();
    await page.getByRole('button', { name: 'Skip to report' }).click();
    await expect(page.locator('.report')).toContainText('A theory, proven.');
    await page.getByRole('button', { name: /Continue exploring/ }).click();
    if (floor < 8) {
      const rest = page.locator('article').filter({ has: page.getByRole('heading', { name: 'A Moment of Rest' }) });
      if (await rest.count()) await rest.getByRole('button', { name: 'Choose reward' }).click();
      else await page.getByRole('button', { name: 'Choose reward' }).first().click();
      await page.reload();
    }
  }
  await expect(page.getByRole('heading', { name: 'A remarkable journey.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('online account, discovery, guild and server battle survive sign-in', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const name = 'Test' + info.project.name[0] + Date.now().toString(36);
  await page.goto('/#community');
  await page.locator('#account-name').fill(name);
  await page.locator('#account-password').fill('Synthetic-test-password-42');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.locator('#guild-name').fill(name + 'Guild');
  await page.getByRole('button', { name: 'Create guild', exact: true }).click();
  await expect(page.getByRole('heading', { name: name + 'Guild', exact: true })).toBeVisible();
  await page.goto('/#lab');
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await expect(page.getByRole('dialog')).toContainText('Steam');
  await page.getByRole('button', { name: /Close dialog/ }).click();
  await page.goto('/#battle');
  await page.getByRole('button', { name: 'Begin expedition' }).click();
  await page.getByRole('button', { name: 'Skip to report' }).click();
  await expect(page.locator('.report')).toBeVisible();
  const session = await page.request.get('/api/me');
  const before = await session.json();
  expect(before.player.battles).toBe(1); expect(before.player.discoveries).toContain('steam');
  await page.goto('/#community');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.locator('#account-name').fill(name);
  await page.locator('#account-password').fill('Synthetic-test-password-42');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: name + 'Guild', exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/me')).json()).player.gold).toBe(before.player.gold);
  expect(errors).toEqual([]);
});

test('discovery map, content editor and offline journal work', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await page.getByRole('button', { name: /Close dialog/ }).click();
  await page.goto('/#codex');
  await page.getByRole('button', { name: 'Discovery map', exact: true }).click();
  await expect(page.locator('.map-edge.known')).toHaveCount(2);
  await page.goto('/#editor');
  await page.getByRole('button', { name: 'Create template', exact: true }).click();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.locator('#editor-output')).toContainText('Valid pack');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.goto('/#lab');
  await expect(page.getByRole('heading', { name: 'The Alchemy Lab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Steam', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard discovery and accessibility preferences persist', async ({ page }) => {
  await page.goto('/');
  const combine = page.getByRole('button', { name: 'Combine elements' });
  await combine.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Steam');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Settings, Alchemist level/ }).click();
  for (const key of ['reducedMotion', 'largeText', 'highContrast', 'leftHanded']) await page.locator('[data-setting="' + key + '"]').check();
  await page.keyboard.press('Escape');
  await page.reload();
  for (const name of ['reduced-motion', 'large-text', 'high-contrast', 'left-handed']) await expect(page.locator('html')).toHaveClass(new RegExp(name));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('local play starts when the account service never responds', async ({ page }) => {
  await page.route('**/api/me', () => {});
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Alchemy Lab' })).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'Combine elements' }).click();
  await expect(page.getByRole('dialog')).toContainText('Steam');
});
