import { test, expect } from '@playwright/test';

test('traveling laboratory saves conditional targets and returns discoveries on retirement', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#runs');
  await page.locator('#start-a-roguelite').selectOption('fire'); await page.locator('#start-b-roguelite').selectOption('water');
  await page.getByRole('button', { name: 'Begin The Unwritten Path', exact: true }).click();
  const lab = page.locator('.run-laboratory');
  await lab.locator('.lab-scenario summary').click(); await lab.getByRole('checkbox', { name: 'Frozen', exact: true }).check();
  await lab.locator('#run-health').fill('25'); await lab.locator('#run-health').press('Tab');
  await lab.locator('#run-enemies').fill('3'); await lab.locator('#run-enemies').press('Tab');
  await lab.getByRole('checkbox', { name: 'Shielded target', exact: true }).check();
  await lab.getByRole('button', { name: 'Experiment', exact: true }).click();
  await expect(lab.locator('.run-discoveries')).toContainText('Thermal Shock');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(saved.owned).not.toContain('thermal-shock'); expect(saved.run.elements).toContain('thermal-shock');
  await page.reload(); await lab.locator('.lab-scenario summary').click();
  await expect(lab.getByRole('checkbox', { name: 'Frozen', exact: true })).toBeChecked();
  await expect(lab.locator('#run-health')).toHaveValue('25'); await expect(lab.locator('#run-enemies')).toHaveValue('3');
  await expect(lab.getByRole('checkbox', { name: 'Shielded target', exact: true })).toBeChecked();
  await lab.screenshot({ path: 'test-results/run-laboratory-' + info.project.name + '.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Return with your discoveries', exact: true }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(saved.owned).toContain('thermal-shock'); expect(saved.run.rewardClaimed).toBe(true);
  expect(errors).toEqual([]);
});

test('real run drafts equip temporary tools and retain strategy across reload and replay', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#runs');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js'); const { startRun } = await import('/src/core/modes.js');
    const p = createPlayer(); startRun(p, 'roguelite', 42, ['light', 'shadow']); localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload();
  for (const [floor, type] of [[1, 'relic'], [2, 'passive']] as const) {
    await page.getByRole('button', { name: 'Enter floor ' + floor, exact: true }).click();
    await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
    await expect(page.locator('.report')).toContainText('A theory, proven.');
    await page.getByRole('button', { name: /Continue exploring/ }).click();
    await expect(page.locator('[data-run-reward="rest"]')).toBeVisible();
    await expect(page.locator('[data-run-slot="0"]').first()).toBeDisabled();
    await page.locator('[data-run-reward="' + type + '"] button').click();
    const id = await page.evaluate(type => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).run[type === 'relic' ? 'relics' : 'passives'][0], type);
    const first = page.locator('.run-formation article').first();
    await first.locator('.run-tools summary').click();
    await first.locator('[data-run-tactic="' + type + '"]').selectOption(id);
    await expect(first.locator('.run-tools')).toHaveAttribute('open', '');
    await first.locator('[data-run-tactic="targeting"]').selectOption('weakest');
    await first.locator('[data-run-tactic="priority"]').selectOption('reaction');
    await first.locator('[data-run-tactic="reactionPriority"][data-rank="0"]').selectOption('eclipse');
    await expect(first.locator('[data-run-tactic="reactionPriority"][data-rank="0"]')).toBeFocused();
    await page.reload(); await first.locator('.run-tools summary').click();
    await expect(first.locator('[data-run-tactic="' + type + '"]')).toHaveValue(id);
    await expect(first.locator('[data-run-tactic="targeting"]')).toHaveValue('weakest');
  }
  await page.locator('.run-formation article').first().screenshot({ path: 'test-results/run-tools-' + info.project.name + '.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Enter floor 3', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!));
  expect(saved.lastReplay.team[0].relic).toBe(saved.run.relics[0]); expect(saved.lastReplay.team[0].passive).toBe(saved.run.passives[0]);
  expect(saved.team[0].relic).toBe('none'); expect(saved.team[0].passive ?? 'none').toBe('none');
  await page.getByRole('button', { name: 'Replay battle', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).run.wins)).toBe(saved.run.wins);
  expect(errors).toEqual([]);
});

test('endless preparation explains changing floor rules and replay keeps the launched rule', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#runs');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js'); const { startRun } = await import('/src/core/modes.js');
    const p = createPlayer(); startRun(p, 'infinite-alchemy', 42, ['light', 'shadow']); localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload(); const rules = page.locator('.run-rules');
  await expect(rules).toContainText('Expedition rule:'); await expect(rules).toContainText('The floor rule changes at floor 4');
  const initial = await rules.locator('strong').nth(1).textContent();
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!); p.run.floor = 4; localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p)); });
  await page.reload(); expect(await rules.locator('strong').nth(1).textContent()).not.toBe(initial);
  await expect(rules).toContainText('The floor rule changes at floor 7');
  await rules.screenshot({ path: 'test-results/run-rules-' + info.project.name + '.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Enter floor 4', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report' }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).lastReplay);
  await page.getByRole('button', { name: 'Replay battle', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report' }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).lastReplay);
  expect(after.modifiers).toEqual(before.modifiers); expect(after.seed).toBe(before.seed);
  expect(errors).toEqual([]);
});

test('rest remains accessible in reward drafts and heals the saved party', async ({ page }) => {
  await page.goto('/#runs');
  await page.evaluate(async () => {
    const { createPlayer } = await import('/src/core/progression.js'); const { startRun, runBattleConfig, completeRunBattle } = await import('/src/core/modes.js');
    const { simulateBattle } = await import('/src/core/combat.js');
    const p = createPlayer(); startRun(p, 'roguelite', 42, ['light', 'shadow']); completeRunBattle(p, simulateBattle(runBattleConfig(p)));
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload();
  const before: number[] = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).run.health);
  const rest = page.locator('[data-run-reward="rest"] button'); await rest.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Enter floor 2', exact: true })).toBeVisible();
  await page.reload();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!).run.health);
  expect(after).toEqual(before.map(h => Math.min(1, Math.max(.25, h) + .35)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
