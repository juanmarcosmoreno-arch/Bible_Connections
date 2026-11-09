import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp, perf } from './fixtures.ts';
import { decodePng, litFraction } from './png.ts';

test.describe('Arc view', () => {
  test('loads all 344,799 references and draws the arcs', async ({ page }) => {
    const t0 = Date.now();
    const errors = await openApp(page);
    const loadMs = Date.now() - t0;
    await expect(page.getByTestId('arc-count')).toContainText('344,799');
    await expect.poll(async () => (await perf(page)).arcs, { timeout: 60_000 }).toBe(344799);
    const p = await perf(page);
    expect(['webgl', 'canvas']).toContain(p.renderer);
    await page.waitForTimeout(1500);
    const shot = decodePng(await page.getByTestId('arc-page').screenshot());
    // The upper-left corner is empty (semicircles); the middle above the axis is full of arcs.
    const lit = litFraction(shot, { x: Math.floor(shot.width * 0.3), y: Math.floor(shot.height * 0.55), w: Math.floor(shot.width * 0.4), h: Math.floor(shot.height * 0.3) }, [8, 9, 13]);
    expect(lit).toBeGreaterThan(0.3);
    console.log(`[perf] data ready in ${loadMs} ms; renderer=${p.renderer}; gpuMs=${p.gpuMs}`);
    expect(errors).toEqual([]);
  });

  test('intro screen shows the tagline and can be dismissed', async ({ page }) => {
    await openApp(page, '#/arc', { intro: true });
    await expect(page.getByRole('heading', { name: 'Discover the connections within Scripture.' })).toBeVisible();
    await expect(page.getByText('An interactive exploration of biblical cross-references.')).toBeVisible();
    await page.getByTestId('intro-dismiss').click();
    await expect(page.getByTestId('intro-dismiss')).toHaveCount(0);
  });

  test('searching "Juan 3:16" selects the verse and shows its text and connections', async ({ page }) => {
    await openApp(page, '#/arc', { lang: 'es' });
    await page.getByTestId('search-input').fill('Juan 3:16');
    await expect(page.getByTestId('search-results')).toContainText('Juan 3:16');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('selection-title')).toHaveText('Juan 3:16');
    await expect(page.getByTestId('panel-body')).toContainText('Porque de tal manera amó Dios al mundo');
    await expect(page).toHaveURL(/sel=v:John\.3\.16/);
    // Connections list lets us jump to the other end.
    await page.getByRole('radio', { name: 'Conexiones' }).click();
    const first = page.getByTestId('connection-list').locator('li').first();
    await expect(first).toContainText('Romanos 5:8');
    await first.getByRole('button', { name: /Romanos 5:8/ }).click();
    await expect(page.getByTestId('selection-title')).toHaveText('Romanos 5:8');
    await page.getByTestId('prev-passage').click();
    await expect(page.getByTestId('selection-title')).toHaveText('Romanos 5:7');
  });

  test('hovering and clicking an arc opens the connection details', async ({ page }) => {
    await openApp(page);
    const box = (await page.getByTestId('arc-overlay').boundingBox())!;
    const x = box.x + box.width * 0.5, y = box.y + box.height * 0.62;
    await page.mouse.move(x, y);
    await expect(page.getByTestId('arc-tooltip')).toContainText('→');
    await page.mouse.click(x, y);
    await expect(page.getByTestId('selection-title')).toContainText('→');
    await expect(page.getByTestId('panel-body')).toContainText(/Source|Origen/);
    await expect(page.getByTestId('reference-source')).toContainText(/Treasury of Scripture Knowledge|OpenBible/);
    await expect(page).toHaveURL(/sel=x:/);
  });

  test('clicking the axis selects a book at full zoom', async ({ page }) => {
    await openApp(page);
    const box = (await page.getByTestId('arc-overlay').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.02, box.y + box.height - 40);
    await expect(page.getByTestId('selection-title')).toHaveText('Genesis');
  });

  test('filters update the arcs and are reproducible', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('filters-toggle').click();
    await page.getByRole('radio', { name: 'OT ↔ NT' }).click();
    await expect(page.getByTestId('filter-count')).toContainText('73,313 of 344,799');
    await page.getByRole('radio', { name: '1k' }).click();
    await expect(page.getByTestId('filter-count')).toContainText('1,000 of');
    await expect(page).toHaveURL(/t=cross/);
    await expect(page).toHaveURL(/top=1000/);
    await expect.poll(async () => (await perf(page)).arcs).toBe(1000);
    await page.getByTestId('filters-reset').click();
    await expect(page.getByTestId('filter-count')).toContainText('344,799 of 344,799');
    await page.getByRole('radio', { name: 'Added', exact: true }).click();
    await expect(page.getByTestId('filter-count')).toContainText('9,775 of 344,799');
    await expect(page).toHaveURL(/src=openbible/);
    await page.getByRole('radio', { name: 'Original (TSK)' }).click();
    await expect(page.getByTestId('filter-count')).toContainText('335,024 of 344,799');
    await page.getByTestId('filters-reset').click();
    await page.getByTestId('distance-far').click();
    const far = Number((await page.getByTestId('filter-count').textContent())!.split(' of ')[0].replace(/,/g, ''));
    expect(far).toBeLessThan(344799);
  });

  test('zoom controls change the view and reset it', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('zoom-in').click();
    await expect.poll(async () => { const v = (await perf(page)).view as number[]; return v[1] - v[0]; }).toBeLessThan(0.5);
    await page.getByTestId('zoom-reset').click();
    await expect.poll(async () => { const v = (await perf(page)).view as number[]; return v[1] - v[0]; }).toBeGreaterThan(0.99);
    await page.getByTestId('zoom-NT').click();
    await expect(page.getByTestId('selection-title')).toHaveText('New Testament');
    await expect.poll(async () => ((await perf(page)).view as number[])[0]).toBeGreaterThan(0.7);
  });

  test('URL state restores a selection and supports back navigation', async ({ page }) => {
    await openApp(page, '#/arc?sel=v:Ps.23.1');
    await expect(page.getByTestId('selection-title')).toHaveText('Psalms 23:1');
    await page.getByTestId('next-passage').click();
    await expect(page.getByTestId('selection-title')).toHaveText('Psalms 23:2');
    await page.goBack();
    await expect(page.getByTestId('selection-title')).toHaveText('Psalms 23:1');
  });

  test('exports CSV of the filtered connections', async ({ page }) => {
    await openApp(page, '#/arc?b=Jonah&dir=out');
    await page.getByTestId('open-export').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
    const lines = readFileSync((await dl.path())!, 'utf8').trim().split('\n');
    expect(lines[0]).toMatch(/^rank,source,target,origin,source_book/);
    expect(lines.length - 1).toBeGreaterThan(100);
    expect(lines.slice(1).every((l) => l.split(',')[1].startsWith('Jonah.'))).toBe(true);
  });

  test('exports a PNG image of the current view', async ({ page }) => {
    await openApp(page, '#/arc?top=1000');
    await page.getByTestId('open-export').click();
    await page.getByRole('radio', { name: '1×' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.getByTestId('export-png').click()]);
    const png = decodePng(readFileSync((await dl.path())!));
    expect(png.width).toBeGreaterThan(500);
  });
});

test.describe('Other views', () => {
  test('Explore shows chapters, verse texts and connection counts', async ({ page }) => {
    await openApp(page, '#/explore?sel=v:Isa.53.5');
    await expect(page.getByTestId('explore-title')).toHaveText('Isaiah 53');
    await expect(page.getByTestId('verse-row')).toHaveCount(12);
    await expect(page.getByTestId('chapter-text')).toContainText('he was pierced for our transgressions');
    await page.getByTestId('verse-row').nth(6).click();
    await expect(page.getByTestId('selection-title')).toHaveText('Isaiah 53:7');
    await page.getByTestId('explore-next').click();
    await expect(page.getByTestId('explore-title')).toHaveText('Isaiah 54');
  });

  test('Network Explorer renders the book graph with metrics', async ({ page }) => {
    await openApp(page, '#/network');
    await expect(page.getByTestId('metrics-table').locator('tbody tr')).toHaveCount(66);
    await expect(page.getByTestId('network-side')).toContainText('Modularity');
    await page.getByTestId('metrics-table').locator('tbody tr').first().click();
    await expect(page.getByTestId('network-node')).toContainText('Psalms');
    await page.getByRole('radio', { name: 'Chapters' }).click();
    await expect(page.getByTestId('metrics-table').locator('tbody tr')).toHaveCount(60);
  });

  test('Network metrics can be recomputed for the filters in a worker', async ({ page }) => {
    await openApp(page, '#/network?t=cross');
    await page.getByRole('switch').click();
    await expect(page.getByTestId('network-side')).toContainText('73,313', { timeout: 60_000 });
  });

  test('Insights shows real statistics, the matrix and the testament comparison', async ({ page }) => {
    await openApp(page, '#/insights');
    await expect(page.getByTestId('kpis')).toContainText('344,799');
    await expect(page.getByTestId('kpis')).toContainText('31,049');
    await page.getByRole('radio', { name: 'Connection matrix' }).click();
    const hm = (await page.getByTestId('heatmap').locator('canvas').boundingBox())!;
    const cell = (hm.width - 44) / 66;
    await page.mouse.click(hm.x + 44 + cell * 40.5, hm.y + 44 + cell * 22.5);
    await expect(page.getByRole('heading', { name: 'Isaiah → Mark' })).toBeVisible();
    await expect(page.getByTestId('connection-list').locator('li')).not.toHaveCount(0);
    await page.getByRole('radio', { name: 'Testaments' }).click();
    await expect(page.getByTestId('testament-flow')).toBeVisible();
    await expect(page.getByText('Strongest links of Isaiah')).toBeVisible();
  });

  test('language and theme toggles work', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('lang-toggle').click();
    await expect(page.getByTestId('nav-explore')).toHaveText('EXPLORAR');
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('open-about').click();
    await expect(page.getByTestId('about-dialog')).toContainText('CC BY 4.0');
    await expect(page.getByTestId('about-dialog')).toContainText('Römhild');
  });
});
