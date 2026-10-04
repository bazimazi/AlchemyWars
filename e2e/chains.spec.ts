import { test, expect, type Page } from '@playwright/test';

async function seedStorm(page: Page, settled = false) {
  await page.goto('/#battle');
  await page.evaluate(async (settled) => {
    const { createPlayer, claimBattle } = await import('/src/core/progression.js');
    const { makeBattleConfig, simulateBattle } = await import('/src/core/combat.js');
    const { RESEARCH, REACTIONS, ELEMENTS, ENCOUNTERS } = await import('/src/data/content.js');
    const { TALENTS } = await import('/src/data/systems.js'); const { STORM_CYCLE } = await import('/src/data/storm-catalysis.js');
    const p = createPlayer(), target = ENCOUNTERS.find(e => e.id === 'stormlands-1')!;
    p.research = RESEARCH.map(r => r.id); p.talents = TALENTS.map(t => t.id); p.discoveries = REACTIONS.filter(r => !STORM_CYCLE.includes(r.id)).map(r => r.id);
    p.owned = ELEMENTS.map(e => e.id); p.mastery = { water: 90, lightning: 90 }; p.equipment = ['echo-catalyst'];
    p.campaign = ENCOUNTERS.slice(0, ENCOUNTERS.indexOf(target)).map(e => e.id);
    p.team.forEach(s => { s.elements = ['water', 'lightning']; s.relic = 'genesis-thread'; s.equipment = { catalyst: 'echo-catalyst' }; s.abilities = []; });
    if (settled) claimBattle(p, simulateBattle(makeBattleConfig(p, target.id, 42)), 'codex-chain-fixture');
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  }, settled);
  await page.reload();
}

test('a real ten-reaction battle explains its sequence, survives replay and pays its achievement once', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await seedStorm(page);
  await page.locator('[data-action="campaign-region"][data-value="stormlands"]').click();
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  await expect(page.locator('.report-heading')).toContainText('10-reaction longest allied chain');
  await page.locator('.chain-report summary').click(); const steps = page.locator('.chain-report .chain-steps li');
  await expect(steps).toHaveCount(10); await expect(steps.first()).toContainText('Conductive'); await expect(steps.last()).toContainText('Liquid Lens');
  await expect(page.locator('.chain-report')).toContainText('Ember Sprite');
  await steps.first().evaluate(el => el.scrollIntoView({ block: 'center' })); await steps.first().screenshot({ path: 'test-results/chain-step-' + info.project.name + '.png' });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect(before.learning.longestChain).toBe(10);
  await page.getByRole('button', { name: 'Replay battle', exact: true }).click(); await page.getByRole('button', { name: 'Skip to report', exact: true }).click();
  await expect(page.locator('.report')).toContainText('REPLAY COMPLETE');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect([after.gold, after.knowledge, after.learning.longestChain, after.battles]).toEqual([before.gold, before.knowledge, 10, before.battles]);
  await page.goto('/#journal'); const achievement = page.locator('[data-achievement="ten-reaction-chain"]');
  await expect(achievement.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10'); await achievement.getByRole('button', { name: 'Claim achievement reward', exact: true }).click();
  await expect(achievement).toContainText('Reward claimed'); await page.reload(); await expect(achievement.getByRole('button')).toBeDisabled();
  const claimed = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect([claimed.gold, claimed.knowledge]).toEqual([after.gold + 200, after.knowledge + 25]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('the chain codex groups prefixes and prepares a known step with its complete lab requirements', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await seedStorm(page, true);
  await page.goto('/#codex'); await page.locator('[data-action="codex-tab"][data-value="chains"]').click();
  const first = page.locator('.recorded-chain').first(); await expect(first.locator('h2')).toHaveText('10-reaction chain');
  if (info.project.name === 'mobile') expect((await first.boundingBox())!.width).toBeGreaterThan(300);
  await first.locator('summary').click(); await expect(first.locator('.chain-steps li')).toHaveCount(10);
  await first.locator('.chain-steps li').last().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await first.locator('.chain-steps li').last().screenshot({ path: 'test-results/chain-codex-' + info.project.name + '.png' });
  await first.locator('[data-action="prepare-chain-step"][data-id="liquid-lens"]').click();
  await expect(page).toHaveURL(/#lab$/); await expect(page.locator('.combine-button')).toBeFocused(); await expect(page.getByLabel('Experiment atmosphere')).toHaveValue('storm');
  await expect(page.locator('[data-lab-status="wet"]')).toBeChecked(); await expect(page.locator('#hint-area')).toContainText('Storm Catalysis'); await expect(page.locator('#hint-area')).toContainText('Water mastery 3');
  await page.getByRole('button', { name: 'Combine elements' }).click(); await expect(page.locator('.result-strip')).toContainText('Liquid Lens');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alchemy-wars.save.v1')!)); expect(saved.experiments).toBe(1); expect(saved.learning.longestChain).toBe(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('Storm Catalysis unlocks a gradual lab cycle without earning a combat chain through experiments', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/#research');
  await page.evaluate(async () => {
    const { createPlayer, experiment } = await import('/src/core/progression.js'); const p = createPlayer(); experiment(p, 'water', 'lightning'); p.knowledge = 200; p.mastery.water = p.mastery.lightning = 90;
    localStorage.setItem('alchemy-wars.save.v1', JSON.stringify(p));
  });
  await page.reload(); const study = page.locator('[data-research="storm-catalysis"]'); await expect(study.getByRole('button')).toBeDisabled();
  for (const id of ['resonance', 'reaction-science', 'catalyst-study']) await page.locator('[data-research="' + id + '"] button').click();
  await expect(study.getByRole('button')).toBeEnabled(); await expect(study).toContainText('9 experimental recipes'); await study.getByRole('button').click();
  await study.evaluate(el => el.scrollIntoView({ block: 'center' })); await study.screenshot({ path: 'test-results/storm-catalysis-' + info.project.name + '.png' });
  await page.goto('/#lab'); await page.getByLabel('Experiment atmosphere').selectOption('storm'); await page.locator('.lab-scenario summary').click(); await page.locator('[data-lab-status="wet"]').check();
  await page.getByRole('button', { name: 'Select Conductive', exact: true }).click(); await page.getByRole('button', { name: 'Select Water', exact: true }).click();
  const names = ['Flooded Current', 'Saturated Front', 'Charge Reservoir', 'Ion Rain', 'Corona Discharge', 'Flash Evaporation', 'Rapid Expansion', 'Ice Spectrum', 'Liquid Lens'];
  for (const [index, name] of names.entries()) {
    await page.getByRole('button', { name: 'Combine elements' }).click(); await expect(page.getByRole('dialog')).toContainText(name);
    if (index < names.length - 1) { await page.getByRole('button', { name: 'Keep experimenting' }).click(); await page.getByRole('button', { name: 'Select Water', exact: true }).click(); }
    else await page.getByRole('button', { name: /Close dialog/ }).click();
  }
  await page.goto('/#journal'); const achievement = page.locator('[data-achievement="ten-reaction-chain"]'); await expect(achievement.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0'); await expect(achievement.getByRole('button')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});
