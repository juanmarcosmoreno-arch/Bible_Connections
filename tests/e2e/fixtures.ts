import { expect, type Page } from '@playwright/test';

/** Opens the app (intro skipped unless asked) and waits until the full dataset is loaded. */
export async function openApp(page: Page, hash = '#/arc', opts: { lang?: 'en' | 'es'; intro?: boolean } = {}) {
  await page.addInitScript(
    ([lang, intro]) => {
      localStorage.setItem('bc.lang', lang as string);
      if (!intro) localStorage.setItem('bc.intro', '1');
    },
    [opts.lang ?? 'en', opts.intro ?? false],
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`./${hash}`);
  await expect(page.getByTestId('arc-loading')).toHaveCount(0, { timeout: 60_000 });
  return errors;
}

export async function perf(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => (window as unknown as { __bcPerf?: Record<string, unknown> }).__bcPerf ?? {});
}
