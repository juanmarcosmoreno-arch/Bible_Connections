import { expect, test } from '@playwright/test';
import { openApp, perf } from './fixtures.ts';

/**
 * Records performance figures with the full dataset (printed in the test output).
 * Thresholds are generous: CI runners render WebGL on the CPU (SwiftShader).
 */
test('performance with the full dataset', async ({ page }) => {
  await openApp(page);
  await expect.poll(async () => (await perf(page)).arcs, { timeout: 60_000 }).toBe(344799);
  const p0 = await perf(page);
  const heap = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);

  // Filter latency: from click to updated count (includes React render).
  await page.getByTestId('filters-toggle').click();
  const t0 = Date.now();
  await page.getByRole('radio', { name: 'OT ↔ NT' }).click();
  await expect(page.getByTestId('filter-count')).toContainText('73,313');
  const filterMs = Date.now() - t0;
  const t1 = Date.now();
  await page.getByRole('radio', { name: 'All' }).first().click();
  await expect(page.getByTestId('filter-count')).toContainText('344,799 of');
  const filterBackMs = Date.now() - t1;

  // Full-detail GPU frame after interaction has settled.
  await page.getByTestId('zoom-reset').click();
  await page.waitForTimeout(3000);
  const p1 = await perf(page);

  const report = {
    renderer: p0.renderer,
    dataLoadMs: p0.loadMs,
    sinceNavigationMs: p0.sinceNavigationMs,
    jsHeapMB: Math.round(heap / 1e6),
    filterToCrossMs: filterMs,
    filterToAllMs: filterBackMs,
    lastGpuFrameMs: p1.gpuMs,
    lod: p1.lod,
  };
  console.log(`[perf] ${JSON.stringify(report)}`);
  expect(p0.loadMs as number).toBeLessThan(15_000);
  expect(filterMs).toBeLessThan(5_000);
});
