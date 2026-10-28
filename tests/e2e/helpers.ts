import { expect, test as base, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'screenshots');
export const BANNER_NB = 'Studentprototype. Syntetisk innhold. Ikke en gyldig SJA.';
export const BANNER_EN = 'Student prototype. Synthetic content. Not a valid SJA.';

/** Every test fails on a console error or an uncaught page error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      // Newer browsers return a Promise from scroll methods. A React effect that returns it crashes the
      // screen ("destroy is not a function"). The test browser is older, so imitate the newer behaviour.
      await page.addInitScript(() => {
        for (const name of ['scrollTo', 'scroll', 'scrollBy'] as const) {
          const original = window[name].bind(window) as (...a: unknown[]) => void;
          (window as any)[name] = (...a: unknown[]) => {
            original(...a);
            return Promise.resolve();
          };
        }
      });
      const errors: string[] = [];
      page.on('console', (m) => {
        // A failed model call is an expected, visible error in some tests; the browser logs the HTTP status.
        if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function noHorizontalScroll(page: Page, where: string) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll, `horizontal scrolling at ${where}`).toBeLessThanOrEqual(inner);
}

export async function expectBanner(page: Page, text = BANNER_NB) {
  await expect(page.getByTestId('prototype-banner').first()).toContainText(text);
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/** Home → Foreman → load a saved test job → continue to step 2. */
export async function startJob(page: Page, fixtureId: string) {
  await page.goto('/');
  await page.getByTestId('tab-foreman').click();
  await page.getByTestId('tile-foreman').click();
  await page.getByTestId('fixture-select').selectOption(fixtureId);
}

export async function confirmAllRechecks(page: Page) {
  await page.getByTestId('confirm-content').waitFor(); // step 3 is on screen
  const buttons = page.locator('[data-testid^="recheck-confirm-"]');
  while ((await buttons.count()) > 0) await buttons.first().click();
}

/**
 * One worker goes through the kiosk (brief v3): reads the SJA, explains it to the foreman,
 * who records the outcome, then answers the one scenario question.
 * `missed`: index of the key point the worker got wrong before the new walkthrough.
 */
export async function kioskWorker(page: Page, lang: string, opts: { wrong?: boolean; missed?: number } = {}) {
  await page.getByTestId(`kiosk-lang-${lang}`).click();
  await page.getByTestId('kiosk-read-done').click();
  await expect(page.getByTestId('kiosk-explain')).toBeVisible();
  if (opts.missed === undefined) await page.getByTestId('teach-ok').click();
  else {
    await page.getByTestId('teach-missed').click();
    await page.locator('[data-testid^="teach-point-"]').nth(opts.missed).check();
    await page.getByTestId('teach-rebriefed').click();
  }
  await page.locator(opts.wrong ? '[data-correct="no"]' : '[data-correct="yes"]').first().click();
  await expect(page.getByTestId(opts.wrong ? 'kiosk-talk' : 'kiosk-correct')).toBeVisible();
  await page.getByTestId('kiosk-next').click();
  await expect(page.getByTestId('kiosk-done')).toBeVisible();
}

/** The question set on its own, with no SJA text and no teach-back. `wrongAt` is the index of a question to answer wrongly. */
export async function standaloneWorker(page: Page, lang: string, wrongAt = -1) {
  await page.getByTestId(`kiosk-lang-${lang}`).click();
  let i = 0;
  while ((await page.getByTestId('kiosk-done').count()) === 0) {
    await page.locator(i === wrongAt ? '[data-correct="no"]' : '[data-correct="yes"]').first().click();
    if (i === wrongAt) await expect(page.getByTestId('kiosk-talk')).toBeVisible();
    else await expect(page.getByTestId('kiosk-correct')).toBeVisible();
    await page.getByTestId('kiosk-next').click();
    i += 1;
  }
  return i;
}
