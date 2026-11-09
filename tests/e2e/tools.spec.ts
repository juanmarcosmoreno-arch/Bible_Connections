import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './fixtures.ts';

test('path between two passages, shown on the Arc', async ({ page }) => {
  await openApp(page, '#/network');
  await page.getByRole('radio', { name: 'Path' }).click();
  await page.getByTestId('path-from').fill('Ruth 1:16');
  await page.keyboard.press('Enter');
  await page.getByTestId('path-to').fill('John 3:16');
  await page.keyboard.press('Enter');
  await page.getByTestId('path-find').click();
  const steps = page.getByTestId('path-steps');
  await expect(steps).toContainText('Ruth 1:16');
  await expect(steps).toContainText('John 3:16');
  await page.getByTestId('path-show-arc').click();
  await expect(page.getByTestId('selection-title')).toContainText('Ruth 1:16');
  await expect(page.getByTestId('panel-body').getByTestId('path-steps')).toBeVisible();
});

test('chord diagram highlights a book and lists its partners', async ({ page }) => {
  await openApp(page, '#/insights');
  await page.getByRole('radio', { name: 'Chords' }).click();
  await expect(page.getByTestId('chord-diagram')).toBeVisible();
  await page.locator('[data-book="Matt"]').click();
  await expect(page.getByText('Strongest links of Matthew')).toBeVisible();
});

test('people & places network and name details', async ({ page }) => {
  await openApp(page, '#/network');
  await page.getByRole('radio', { name: 'People & places' }).click();
  await expect(page.getByTestId('names-graph')).toBeVisible();
  await page.getByTestId('names-search').fill('David');
  await page.getByRole('button', { name: /^David/ }).first().click();
  await expect(page.getByTestId('names-title')).toHaveText('David');
  await expect(page.getByTestId('names-side')).toContainText('Saul');
  await page.getByTestId('names-verses').getByRole('button').first().click();
  await expect(page.getByTestId('explore-title')).toBeVisible();
});

test('my study: bookmark, note, export and printable sheet', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { print: () => void }).print = () => ((window as unknown as { __printed: number }).__printed = 1);
  });
  await openApp(page, '#/arc?sel=v:John.3.16');
  await page.getByTestId('study-toggle').click();
  await page.getByTestId('study-note').fill('Compare Romans 5:8');
  await page.getByTestId('open-study').click();
  await expect(page.getByTestId('study-items')).toContainText('John 3:16');
  await expect(page.getByTestId('study-items')).toContainText('Compare Romans 5:8');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('study-export').click()]);
  const json = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
  expect(json.items[0]).toMatchObject({ id: 'p:John.3.16', note: 'Compare Romans 5:8' });
  await page.getByTestId('study-print').click();
  await expect(page.getByTestId('study-sheet')).toContainText('For God so loved the world');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: number }).__printed)).toBe(1);
  // Persists across reloads (localStorage).
  await page.reload();
  await page.getByTestId('open-study').click();
  await expect(page.getByTestId('study-items')).toContainText('John 3:16');
});
