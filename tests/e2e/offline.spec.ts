import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve('dist-offline/bible-connections.html');

test.describe('single-file offline version', () => {
  test.skip(!existsSync(FILE), 'run npm run build:offline first');

  test('works from file:// with the network disabled', async ({ browser }) => {
    const ctx = await browser.newContext({ offline: true, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('bc.intro', '1'));
    await page.goto(`file://${FILE}#/arc?sel=v:John.3.16`);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __bcPerf?: { arcs?: number } }).__bcPerf?.arcs), { timeout: 60_000 }).toBe(344799);
    await expect(page.getByTestId('panel-body')).toContainText(/For God so loved the world|Porque de tal manera/);
    await page.goto(`file://${FILE}#/insights`);
    await expect(page.getByTestId('kpis')).toContainText(/344[,.]799/);
    await page.goto(`file://${FILE}#/network`);
    await expect(page.getByTestId('metrics-table').locator('tbody tr')).toHaveCount(66);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
