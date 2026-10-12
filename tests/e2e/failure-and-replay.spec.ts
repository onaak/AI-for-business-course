// Model failure in the browser (AC-28), reviewer corrections, reviewer judgements,
// and reopening a saved run with no external network (AC-25, F-18).
import { confirmAllRechecks, expect, kioskWorker, shot, startJob, test } from './helpers';

test('model connection cut during the language check: error, retry control, line stays blocking (AC-28)', async ({ page }) => {
  await startJob(page, 'jd-01');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();
  await confirmAllRechecks(page);

  // Cut the connection for translation calls only.
  let cut = true;
  await page.route('**/api/llm', async (route) => {
    const body = route.request().postDataJSON();
    if (cut && body.task === 'P4') await route.abort('connectionfailed');
    else await route.continue();
  });
  await page.getByTestId('confirm-content').click();
  await expect(page.locator('[data-testid^="line-error-"]')).toHaveCount(6); // 3 lines × 2 languages
  await expect(page.getByText('Linjen kunne ikke kontrolleres').first()).toBeVisible();
  await expect(page.getByText('No connection to the local server.').first()).toBeVisible();
  await shot(page, '24-model-failure');

  // Nothing is silently skipped: the gate lists the unchecked lines and the sign button stays disabled.
  await page.getByTestId('step4-continue').click();
  await page.getByTestId('step5-continue').click();
  await expect(page.getByTestId('gate-languageCheck-open')).toContainText('(6)');
  await expect(page.getByTestId('sign-button')).toBeDisabled();
  await page.getByText('Gå til steg 4').first().click();

  // Connection back: retry each line.
  cut = false;
  for (let i = 0; i < 6; i++) await page.getByTestId('retry-line').first().click();
  await expect(page.locator('[data-testid^="line-error-"]')).toHaveCount(0);
  await expect(page.getByTestId('flag-GLOSSARY_MISMATCH-lt')).toBeVisible();
});

test('reviewer corrects a line and rejects another; judgements feed the reviewer-judged metrics', async ({ page }) => {
  await startJob(page, 'jd-02');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();
  await page.getByTestId('ai-accept-ny-1').click();
  await confirmAllRechecks(page);
  await page.getByTestId('confirm-content').click();
  await expect(page.getByTestId('check-summary')).toBeVisible();
  const sjaUrl = page.url();

  // Send the Polish meaning shift and the Lithuanian glossary flag to a reviewer.
  const pl = page.locator('section', { has: page.getByTestId('flag-MEANING_SHIFT-pl') }).filter({ hasText: 'før arbeidet starter' });
  await pl.getByTestId('route-reviewer').click();
  const lt = page.locator('section', { has: page.getByTestId('flag-GLOSSARY_MISMATCH-lt') });
  await lt.getByTestId('route-reviewer').click();

  // Polish language reviewer corrects the text. The Lithuanian item is not his to decide.
  await page.goto('/review');
  await page.getByTestId('reviewer-role').selectOption('language');
  await page.getByTestId('reviewer-lang').selectOption('pl');
  await page.getByTestId('reviewer-start').click();
  await page.getByTestId('tab-queue').click();
  await expect(page.getByText('Only a language reviewer for Lithuanian can decide this item.')).toBeVisible();
  await page.getByTestId('queue-correct').click();
  await page.getByTestId('review-editor').fill('Wygrodź chodnik pod rusztowaniem przed rozpoczęciem pracy.');
  await page.getByTestId('review-editor-save').click();
  await expect(page.getByTestId('queue-correct')).toHaveCount(0);

  // Lithuanian reviewer rejects: a real error, back to the foreman.
  await page.getByRole('button', { name: 'Stop reviewing' }).click();
  await page.getByTestId('reviewer-lang').selectOption('lt');
  await page.getByTestId('reviewer-start').click();
  await page.getByTestId('tab-queue').click();
  await page.getByTestId('queue-reason').fill('"Skylė" is too vague here.');
  await page.getByTestId('queue-reject').click();
  await expect(page.getByTestId('review-queue')).toContainText('No lines are waiting');
  await page.getByTestId('tab-summary').click();
  await expect(page.getByTestId('reviewer-time')).toContainText('checking');
  await expect(page.getByTestId('reviewer-time')).toContainText('over 2 decisions');

  // Foreman: the corrected line shows as corrected; the rejected flag is back with the reviewer's reason.
  await page.goto(sjaUrl);
  await expect(page.getByText('Kontrolløren bekreftet feilen: "Skylė" is too vague here.')).toBeVisible();
  const back = page.locator('section', { has: page.getByTestId('flag-GLOSSARY_MISMATCH-lt') });
  await back.getByTestId('route-oral').click();
  const amber = page.locator('section', { has: page.getByTestId('flag-MEANING_SHIFT-pl') }).filter({ hasText: 'Gult flagg' });
  await amber.getByTestId('route-oral').click();
  await page.getByTestId('step4-continue').click();
  await page.getByTestId('start-kiosk').click();
  await kioskWorker(page, 'pl');
  await page.getByTestId('kiosk-exit').click();
  await page.getByTestId('step5-continue').click();
  await page.getByTestId('sign-agree').check();
  await page.getByTestId('sign-button').click();
  await page.getByTestId('open-record').click();
  await expect(page.getByTestId('record-line-h-10')).toContainText('Wygrodź chodnik pod rusztowaniem przed rozpoczęciem pracy.');
  await expect(page.getByTestId('record-line-h-10')).toContainText('rettet av språkkontrollør');
  await expect(page.getByTestId('record-flags')).toContainText('feil bekreftet');
  expect(Number(await page.getByTestId('timing-reviewer').getAttribute('data-ms'))).toBeGreaterThan(0);

  // Reviewer judgement after the run: term accuracy, residual errors, correct routes.
  await page.getByTestId('record-judgements-toggle').click();
  const judge = page.getByTestId('judgements');
  await judge.getByRole('button', { name: 'Riktig', exact: true }).first().click();
  await judge.getByRole('button', { name: 'Feil', exact: true }).nth(1).click();
  await page.getByTestId('save-judgements').click();
  await expect(page.getByText('Lagret i evidence/runs.')).toBeVisible();
  const runId = page.url().split('/').pop()!;
  const saved = await (await page.request.get(`/api/evidence/runs/${runId}`)).json();
  expect(Object.values(saved.judgements.terms)).toEqual([true, false]);
  expect(saved.judgements.by).toMatchObject({ role: 'language', lang: 'lt' });
});

test('a saved run reopens from its file with no external network and no model call (AC-25, F-18)', async ({ page, context }) => {
  // Make a run to reopen.
  await startJob(page, 'jd-09');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();
  await confirmAllRechecks(page);
  await page.getByTestId('confirm-content').click();
  await page.getByTestId('step4-continue').click();
  await page.getByTestId('sign-agree').check();
  await page.getByTestId('sign-button').click();
  await expect(page.getByTestId('signed-status')).toBeVisible();

  // A fresh browser profile: nothing in local storage. Block every request that is not to this machine,
  // and every model call.
  const fresh = await context.browser()!.newContext({ viewport: { width: 375, height: 760 } });
  const p2 = await fresh.newPage();
  const external: string[] = [];
  const llm: string[] = [];
  await p2.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/llm') llm.push(url.pathname);
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await p2.goto(`${new URL(page.url()).origin}/runs`);
  await p2.getByTestId('run-link').first().click();
  await expect(p2.getByTestId('record-status')).toContainText('Signert');
  await expect(p2.getByTestId('record-line-h-10')).toContainText('Aptverkite zoną po darbo vieta.');
  await p2.getByTestId('record-time-toggle').click();
  await expect(p2.getByTestId('record-timings')).toBeVisible();
  await p2.getByTestId('record-trace-toggle').click();
  await p2.getByTestId('trace-step-toggle').click();
  await p2.getByTestId('trace-next').click();
  await expect(p2.getByTestId('trace-position')).toContainText('2 /');
  expect(external, 'requests to other machines').toEqual([]);
  expect(llm, 'model calls while viewing a saved run').toEqual([]);
  await fresh.close();
});
