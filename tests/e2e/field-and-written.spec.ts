// Updates of 26 October 2026: the clean "field" version (V1–V3), the rules library (B1–B5),
// Russian and the painting template with products (R2, J1, K1–K5), the three ways to check a
// worker (U1–U3), "not followed" (I4), the main-contractor summary (I1) and the privacy panel (I3).
// Replay mode at 375 px. Not evidence for any claim.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, expectBanner, noHorizontalScroll, shot, startJob, test } from './helpers';

/** Serious and critical accessibility problems only (V4: a light check, not a WCAG audit). */
async function axe(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).disableRules(['region']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

test('clean view: switched in the header, a tab per role, no test pages, keeps NO/EN (V1, V2)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-project').click();
  await expect(page.getByTestId('tile-bench')).toBeVisible();
  await page.getByTestId('view-field').click(); // the eye switch in the header, like the language switch
  await expect(page.getByTestId('view-field')).toHaveAttribute('aria-pressed', 'true');
  await expectBanner(page);
  // One tab per kind of user; the project group's tab is not in the clean view, so the foreman's opens.
  await expect(page.getByTestId('tab-project')).toHaveCount(0);
  await expect(page.getByTestId('tab-foreman')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tile-foreman')).toBeVisible();
  await page.getByTestId('tab-worker').click();
  await expect(page.getByTestId('panel-worker')).toContainText('Du trenger ingen konto');
  await page.getByTestId('tab-manager').click();
  await expect(page.getByTestId('tile-rules')).toBeVisible();
  await expect(page.getByTestId('privacy-home')).toBeVisible();
  await page.getByTestId('tab-reviewer').click();
  await expect(page.getByTestId('tile-review')).toBeVisible();
  for (const id of ['tile-bench', 'tile-runs', 'tile-baseline']) await expect(page.getByTestId(id)).toHaveCount(0);
  // NO/EN stays in the clean view.
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByTestId('tab-reviewer')).toContainText('Reviewer');
  await expect(page.getByTestId('panel-reviewer')).toContainText('verified');
  await page.getByRole('button', { name: 'NO', exact: true }).click();
  await page.getByTestId('tab-foreman').click();
  await noHorizontalScroll(page, 'field home');
  await shot(page, '25-field-home');
  await axe(page, 'field home');
  // Route guard: the test pages cannot be opened by typing the address.
  for (const path of ['/bench', '/baseline', '/runs', '/worker/questions/lifting']) {
    await page.goto(path);
    await expect(page.getByTestId('field-blocked')).toBeVisible();
  }
  // The reviewer address stays open (V2).
  await page.goto('/review');
  await expect(page.getByTestId('reviewer-start')).toBeVisible();
  // Back to every tool with the same switch; the choice is kept on this device.
  await page.goto('/');
  await expect(page.getByTestId('view-field')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('view-lab').click();
  await page.getByTestId('tab-project').click();
  await expect(page.getByTestId('tile-bench')).toBeVisible();
});

test('rules library: tags, risk, sources, verification, a disclaimer and a CSV (B1–B5)', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByTestId('rules-disclaimer')).toContainText('Ikke en fullstendig regeloversikt');
  const total = Number((await page.getByTestId('rules-count').textContent())?.match(/av (\d+)/)?.[1]);
  expect(total).toBeGreaterThan(70);
  await page.getByTestId('rules-tag-chemicals').click();
  await expect(page.getByTestId('rules-list')).toContainText('Sørg for god ventilasjon hele tiden.');
  await expect(page.getByTestId('rules-list')).not.toContainText('Ingen skal oppholde seg under hengende last.');
  await page.getByTestId('rules-risk').selectOption('red');
  const row = page.getByTestId('rule-painting/p-10');
  await expect(row).toContainText('Høy risiko');
  await expect(row).toContainText('Forskrift om utførelse av arbeid § 3-8');
  await expect(row).toContainText('Russisk');
  await page.getByTestId('rules-search').fill('isocyanat');
  await expect(page.getByTestId('rule-painting/p-24').locator('[data-testid="ghs-GHS08"]')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('rules-csv').click();
  expect((await download).suggestedFilename()).toMatch(/^regler-og-tiltak-.*\.csv$/);
  await page.getByTestId('rules-search').fill('113');
  await page.getByTestId('rules-tag-chemicals').click();
  await page.getByTestId('rules-risk').selectOption('all');
  await expect(page.getByTestId('rule-lifting/l-23')).toContainText('Firmapraksis (ingen offentlig kilde)');
  await noHorizontalScroll(page, 'rules');
  await shot(page, '26-rules');
  await axe(page, 'rules');
});

test('painting with a product, a Russian crew: written explanation, multiple-choice fallback, not followed, summary (J1, K1–K5, R2, U1–U3, I1, I4)', async ({ page }) => {
  await startJob(page, 'jd-10');
  await expect(page.getByTestId('products')).toBeVisible();
  await expect(page.getByTestId('product-pr-2k-pu')).toBeChecked();
  await expect(page.getByTestId('products').getByTestId('ghs-GHS08').first()).toBeVisible();
  await expect(page.getByTestId('privacy-step1')).toBeVisible();
  await noHorizontalScroll(page, 'step 1 painting');
  await axe(page, 'step 1');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();
  await page.getByTestId('confirm-content').waitFor();
  // The picked product brings its isocyanate lines; the one not picked does not.
  await expect(page.getByTestId('line-p-24')).toBeVisible();
  await expect(page.getByTestId('line-p-23')).toHaveCount(0);
  await page.getByTestId('confirm-content').click();

  // Step 4: one Russian glossary flag (ventilation), cleared with the approved term.
  await expect(page.getByTestId('flag-GLOSSARY_MISMATCH-ru')).toBeVisible();
  await page.getByTestId('route-approvedTerm').click();
  await expect(page.getByTestId('open-flag-count')).toContainText('Ingen flagg hindrer signering');
  await page.getByTestId('step4-continue').click();
  await page.getByTestId('start-kiosk').click();

  // Worker 1, Russian: the conversation is not possible, so the worker writes. The model only translates; the foreman judges.
  await page.getByTestId('kiosk-lang-ru').click();
  await expectBanner(page, 'Студенческий прототип');
  await expect(page.getByTestId('kiosk-read')).toContainText('изоцианат');
  await expect(page.getByTestId('kiosk-read').getByTestId('ghs-GHS08').first()).toBeVisible(); // K3: pictograms on the worker screen
  await noHorizontalScroll(page, 'kiosk Russian');
  await shot(page, '27-kiosk-russian-pictograms');
  await axe(page, 'kiosk read');
  await page.getByTestId('kiosk-read-done').click();
  await page.getByTestId('kiosk-no-talk').click();
  await expect(page.getByTestId('path-written')).toBeDisabled(); // a reason first
  await page.getByTestId('reason-noCommonLanguage').check();
  await page.getByTestId('path-written').click();
  await expect(page.getByTestId('kiosk-write')).toContainText('Не пишите ничьих имён.');
  await page.getByTestId('write-samples').locator('summary').click();
  await page.getByTestId('sample-ws-04').click();
  await shot(page, '28-kiosk-written');
  await page.getByTestId('write-send').click();
  await expect(page.getByTestId('written-label')).toContainText('Maskinoversettelse av arbeiderens svar. Ikke kontrollert.');
  await expect(page.getByTestId('written-measure')).toContainText('Vi setter opp avtrekk');
  await shot(page, '29-kiosk-written-judge');
  await page.getByTestId('foreman-zone').getByTestId('teach-ok').click();
  await expect(page.getByTestId('kiosk-question')).toContainText('Один вопрос');
  await page.locator('[data-correct="yes"]').click();
  await expect(page.getByTestId('kiosk-in-sja')).toContainText('Это есть в вашем SJA:');
  await page.getByTestId('kiosk-next').click();
  await page.getByTestId('kiosk-next-worker').click();

  // Worker 2, Lithuanian: last resort, three multiple-choice questions and no explanation.
  await page.getByTestId('kiosk-lang-lt').click();
  await page.getByTestId('kiosk-read-done').click();
  await page.getByTestId('kiosk-no-talk').click();
  await page.getByTestId('reason-lateArrival').check();
  await page.getByTestId('path-questions').click();
  const asked = new Set<string>();
  for (let i = 0; i < 3; i++) {
    asked.add((await page.getByTestId('kiosk-question').getAttribute('data-question-id')) ?? '');
    await expect(page.getByTestId('kiosk-question')).toContainText(`${i + 1} klausimas iš 3`);
    await page.locator('[data-correct="yes"]').click();
    await page.getByTestId('kiosk-next').click();
  }
  expect(asked.size).toBe(3);
  await page.getByTestId('kiosk-finish').click();

  // Step 5: how each worker was checked. Multiple choice alone means "signed with fallback".
  await expect(page.getByTestId('path-counts')).toContainText('Samtale: 0 · Skriftlig forklaring: 1 · Bare flervalgsspørsmål: 1');
  await page.getByTestId('step5-continue').click();
  await page.getByTestId('sign-agree').check();
  await page.getByTestId('sign-button').click();
  await expect(page.getByTestId('signed-status')).toContainText('reserve');

  // I4: understood but not followed (protective equipment taken off), kept apart from "misunderstood".
  await page.getByTestId('observe-some').click();
  await page.getByTestId('observe-notfollowed-p-16').click();
  await page.getByTestId('observe-save').click();
  await expect(page.getByTestId('observation-not-followed')).toContainText('Bruk tette hansker av nitril');

  // I1: one page for the main contractor.
  await page.getByTestId('open-summary-signed').click();
  await expect(page.getByTestId('summary-status')).toContainText('reserve');
  await expect(page.getByTestId('summary-understanding')).toContainText('Skriftlig forklaring: 1');
  await expect(page.getByTestId('summary')).toContainText('2-komponent polyuretanlakk (eksempel)');
  await noHorizontalScroll(page, 'summary');
  await shot(page, '30-summary');
  await axe(page, 'summary');

  // The record: the paths, the reasons, and the privacy panel (I3).
  await page.goBack();
  await page.getByTestId('open-record').click();
  await expect(page.getByTestId('record-paths')).toContainText('Ingen her snakker språket hans (1)');
  await page.getByTestId('record-privacy-toggle').click();
  await expect(page.getByTestId('privacy-record')).toContainText('Sendes aldri:');

  // The rules library counts what was not followed on site.
  await page.goto('/rules');
  await page.getByTestId('rules-site').check();
  await expect(page.getByTestId('rule-painting/p-16')).toContainText('Ikke fulgt på byggeplassen: 1×');
});
