import { expect, test } from '@playwright/test';
import { openApp } from './fixtures.ts';

for (const route of ['arc', 'explore', 'network', 'insights']) {
  test(`no horizontal overflow on mobile: ${route}`, async ({ page }) => {
    await openApp(page, `#/${route}`);
    await page.waitForTimeout(1000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('mobile search opens a bottom sheet with the passage', async ({ page }) => {
  await openApp(page, '#/arc', { lang: 'es' });
  await page.getByTestId('search-toggle').click();
  await page.locator('[data-testid=search-input]:visible').fill('Romanos 8:28');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('selection-title')).toHaveText('Romanos 8:28');
  const panel = (await page.getByTestId('detail-panel').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(panel.y).toBeGreaterThan(vp.height * 0.3);
});
