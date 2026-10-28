// J1 alternative paths, in replay mode at 375 px width.
import { confirmAllRechecks, expect, kioskWorker, noHorizontalScroll, shot, startJob, test } from './helpers';

test('parameters only: pure reuse, no model, understanding check skipped with a logged reason (AC-05, AC-14)', async ({ page }) => {
  await startJob(page, 'jd-09');
  await page.getByTestId('step1-continue').click();
  await expect(page.getByText('Du skrev ingen detaljer.')).toBeVisible();
  await page.getByTestId('confirm-specifics').click();
  await expect(page.getByTestId('summary-bar')).toContainText('19 linjer gjenbrukt');
  await expect(page.getByTestId('summary-bar')).toContainText('3 verdier fra steg 1');
  await expect(page.getByTestId('summary-lead')).toContainText('Alle 22 linjer kommer rett fra malen.');
  await expect(page.getByTestId('line-h-01')).toContainText('Arbeidshøyde: 7 m');
  await confirmAllRechecks(page);
  await page.getByTestId('confirm-content').click();
  await expect(page.getByTestId('check-summary')).toContainText('0 endrede eller nye linjer');
  await expect(page.getByTestId('step4-continue')).toHaveText('Videre til signering');
  await page.getByTestId('step4-continue').click();
  await expect(page.getByTestId('gate-understanding-ok')).toBeVisible();
  await page.getByTestId('sign-agree').check();
  await page.getByTestId('sign-button').click();
  await expect(page.getByTestId('signed-status')).toContainText('Signert');
  await expect(page.getByTestId('observe-none')).toHaveCount(0); // no understanding check, so no observation is asked for
  await page.getByTestId('open-record').click();
  await expect(page.getByTestId('record-understanding')).toContainText('Ikke påkrevd');
  await expect(page.getByTestId('record-reuse')).toHaveText('22 av 22');
  // Reused lines are byte-identical to the template in every language.
  await expect(page.getByTestId('record-line-h-10')).toContainText('Wygrodź teren pod miejscem pracy.');
  await expect(page.getByTestId('record-line-h-10')).toContainText('Aptverkite zoną po darbo vieta.');
  await expect(page.getByTestId('record-line-h-01')).toContainText('Wysokość robocza: 7 m');
  const runId = page.url().split('/').pop()!;
  const saved = await (await page.request.get(`/api/evidence/runs/${runId}`)).json();
  expect(saved.events.some((e: any) => e.type === 'understanding_not_required')).toBe(true);
  expect(saved.trace.filter((e: any) => e.kind === 'model')).toHaveLength(0);
  expect(await (await page.request.get(`/api/evidence/calls/${runId}`)).json()).toHaveLength(0);
});

test('slang input: clarifying questions in place of a guess (T3, AC-04)', async ({ page }) => {
  await startJob(page, 'jd-03');
  await page.getByTestId('step1-continue').click();
  await expect(page.getByText('Verktøyet må spørre før det går videre')).toBeVisible();
  await expect(page.getByTestId('specifics')).toContainText('Uklart – ikke gjettet');
  await expect(page.locator('[data-testid^="question-"]')).toHaveCount(2); // never more than three
  await expect(page.getByTestId('confirm-specifics')).toBeDisabled(); // the flow does not continue on a guess
  // Every answer works in the demo (29 Oct): nothing is greyed out.
  await expect(page.getByText('I demoen finnes det lagrede svar bare for noen av valgene.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /De er ikke kontrollert ennå/ })).toBeEnabled();
  await shot(page, '14-clarifying-questions');
  await page.getByRole('button', { name: /^Over gjerdet/ }).click();
  await page.getByRole('button', { name: /De er ikke kontrollert ennå/ }).click();
  await page.getByTestId('send-answers').click();
  await expect(page.getByTestId('specifics')).toContainText('Løftestroppene er ikke kontrollert ennå.');
  await expect(page.getByTestId('confirm-specifics')).toBeEnabled();
  await page.getByTestId('change-answers').click();
  await page.getByRole('button', { name: /^Gjennom porten/ }).click();
  await page.getByRole('button', { name: /^Anhukeren kontrollerer løftestroppene før bruk/ }).click();
  await page.getByTestId('send-answers').click();
  await expect(page.getByTestId('specifics')).toContainText('Lasten tas gjennom porten, ikke over gjerdet.');
  // The answers can be changed: the questions come back.
  await page.getByTestId('change-answers').click();
  await expect(page.locator('[data-testid^="question-"]')).toHaveCount(2);
  await page.getByRole('button', { name: /^Gjennom porten/ }).click();
  await page.getByRole('button', { name: /^Anhukeren kontrollerer løftestroppene før bruk/ }).click();
  await page.getByTestId('send-answers').click();
  await expect(page.getByTestId('specifics')).toContainText('Lasten tas gjennom porten, ikke over gjerdet.');
  await expect(page.getByTestId('confirm-specifics')).toBeEnabled();
  await page.getByTestId('confirm-specifics').click();
  await expect(page.getByTestId('summary-bar')).toContainText('1 linje endret');
});

test('typed text with no stored response: visible error with a retry, nothing skipped (AC-28)', async ({ page }) => {
  await startJob(page, 'jd-01');
  await page.getByTestId('free-text').fill('Vi skal løfte noe helt annet i dag.');
  await page.getByTestId('step1-continue').click();
  await expect(page.getByRole('alert')).toContainText('no stored response');
  await expect(page.getByRole('alert').getByRole('button', { name: 'Prøv igjen' })).toBeVisible();
  await expect(page.getByTestId('step-title')).toContainText('Steg 1 av 6');
});

test('AI suggestion, meaning shift, two failed attempts, reviewer verdict, oral fallback (jd-02)', async ({ page }) => {
  await startJob(page, 'jd-02');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();

  // An AI-added line with no hazard-list reference must be accepted or deleted (AC-06).
  await expect(page.getByTestId('ai-suggestion-ny-1')).toContainText('KI-forslag uten kilde');
  await expect(page.getByTestId('line-ny-1')).toContainText('Uten kilde');
  await expect(page.getByTestId('confirm-content')).toBeDisabled();
  await shot(page, '15-ai-suggestion');
  await page.getByTestId('ai-accept-ny-1').click();
  await confirmAllRechecks(page);
  await page.getByTestId('confirm-content').click();

  // Back-translation finds what the glossary cannot: "before" became "after".
  const shift = page.getByTestId('flag-MEANING_SHIFT-pl').first();
  await expect(shift).toBeVisible();
  await expect(page.getByText('Originalen sier «før arbeidet starter». Tilbakeoversettelsen sier «etter at arbeidet har startet».')).toBeVisible();
  await expect(page.locator('ins.diff').first()).toBeVisible(); // the difference is highlighted
  await noHorizontalScroll(page, 'step 4 with three flags');
  await shot(page, '16-meaning-shift');

  // Lithuanian glossary flag: after two failed attempts the automatic route is disabled, the others remain (AC-12).
  const ltCard = page.locator('section', { has: page.getByTestId('flag-GLOSSARY_MISMATCH-lt') });
  await ltCard.getByTestId('route-approvedTerm').click();
  await expect(ltCard).toContainText('Automatiske forsøk: 1 av 2.');
  await ltCard.getByTestId('route-approvedTerm').click();
  await expect(ltCard).toContainText('Automatiske forsøk: 2 av 2.');
  await expect(ltCard.getByTestId('route-approvedTerm')).toBeDisabled();
  await expect(ltCard.getByTestId('route-approvedTerm')).toContainText('Ikke tilgjengelig etter to mislykkede forsøk.');
  for (const r of ['rewrite', 'reviewer', 'oral']) await expect(ltCard.getByTestId(`route-${r}`)).toBeEnabled();
  await shot(page, '17-route-disabled');

  // Send to reviewer → the SJA waits and cannot be signed as checked.
  await ltCard.getByTestId('route-reviewer').click();
  await expect(ltCard).toContainText('Venter på kontrollør');
  await expect(page.getByTestId('open-flag-count')).toContainText('1 gult flagg hindrer ikke signering'); // one sentence about what blocks and what does not
  await expect(page.getByTestId('step4-open-note')).toContainText('du kan ikke signere før flaggene som hindrer signering, er håndtert');
  await page.getByTestId('step4-continue').click();

  // Flags are still open. A worker is never shown a translation the tool has flagged: the foreman explains that line.
  await expect(page.getByTestId('masked-note')).toContainText('Arbeiderne får ikke se den teksten på telefonen.');
  await page.getByTestId('start-kiosk').click();
  await page.getByTestId('kiosk-lang-pl').click();
  await expect(page.getByTestId('kiosk-read')).toContainText('Ten punkt wyjaśni ci brygadzista.');
  await expect(page.getByTestId('kiosk-read')).not.toContainText('po rozpoczęciu pracy'); // the flagged Polish text
  await page.getByTestId('kiosk-exit').click();

  await page.getByTestId('step5-continue').click();
  await expect(page.getByTestId('step-pill-4')).toHaveAttribute('data-state', 'open'); // a passed step with open flags is not ticked
  await expect(page.getByTestId('step-pill-3')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('gate-flags-open')).toBeVisible();
  await expect(page.getByText('Minst én linje venter på kontrollør.')).toBeVisible();
  await expect(page.getByTestId('sign-button')).toBeDisabled();
  const sjaUrl = page.url();

  // Reviewer: a Lithuanian language reviewer from outside the group marks a false alarm, with a reason.
  await page.goto('/review');
  await page.getByTestId('reviewer-role').selectOption('language');
  await page.getByTestId('reviewer-lang').selectOption('lt');
  await page.getByTestId('reviewer-outside').check();
  await page.getByTestId('reviewer-start').click();
  await page.getByTestId('tab-queue').click();
  await expect(page.getByTestId('review-queue')).toContainText('GLOSSARY_MISMATCH');
  await expect(page.getByTestId('review-queue')).toContainText('A hole in a floor or deck'); // the glossary definition is shown
  await expect(page.getByTestId('queue-false-alarm')).toBeDisabled(); // a reason is required
  await page.getByTestId('queue-reason').fill('"Skylė" is an everyday word for the same thing.');
  await page.getByTestId('queue-false-alarm').click();
  await expect(page.getByTestId('review-queue')).toContainText('No lines are waiting');

  // Back with the foreman: Polish meaning shift → brief orally. Amber flag on a non-critical line → acknowledge with a reason.
  await page.goto(sjaUrl);
  await page.getByText('Gå til steg 4').first().click();
  const plCard = page.locator('section', { has: page.getByTestId('flag-MEANING_SHIFT-pl') }).filter({ hasText: 'før arbeidet starter' });
  await plCard.getByTestId('route-oral').click();
  const amber = page.locator('section', { has: page.getByTestId('flag-MEANING_SHIFT-pl') }).filter({ hasText: 'Gult flagg' });
  await amber.getByTestId('route-acknowledged').click();
  await expect(amber.getByTestId('ack-save')).toBeDisabled(); // a reason is required
  await amber.locator('input').fill('Kurset er obligatorisk for alle uansett.');
  await amber.getByTestId('ack-save').click();
  await expect(page.getByTestId('open-flag-count')).toContainText('Ingen flagg hindrer signering');
  await page.getByTestId('step4-continue').click();

  // Understanding: one Polish worker; the Polish text of the orally briefed line is not shown to him.
  await page.getByTestId('start-kiosk').click();
  await page.getByTestId('kiosk-lang-pl').click();
  await expect(page.getByTestId('kiosk-read')).toContainText('Ten punkt wyjaśni ci brygadzista.');
  await expect(page.getByTestId('kiosk-read')).not.toContainText('po rozpoczęciu pracy');
  await page.getByTestId('kiosk-read-done').click();
  await page.getByTestId('teach-ok').click();
  await page.locator('[data-correct="yes"]').click();
  await page.getByTestId('kiosk-next').click();
  await page.getByTestId('kiosk-exit').click();
  await expect(page.getByTestId('respondent-count')).toContainText('1');
  await page.getByTestId('step5-continue').click();
  await expect(page.getByText('Statusen blir «Signert med reserveløsning».')).toBeVisible();
  await page.getByTestId('sign-agree').check();
  await page.getByTestId('sign-button').click();
  await expect(page.getByTestId('signed-status')).toContainText('Signert med reserveløsning');

  // The record lists the line briefed orally, the routes and who resolved each flag (AC-19).
  await page.getByTestId('open-record').click();
  await expect(page.getByTestId('record-status')).toHaveText('Signert med reserveløsning');
  await expect(page.getByTestId('record-oral')).toContainText('Polsk: Sperr av fortauet under stillaset før arbeidet starter.');
  const flags = page.getByTestId('record-flags');
  await expect(flags).toContainText('Gjennomgå linjen muntlig');
  await expect(flags).toContainText('falsk alarm');
  await expect(flags).toContainText('kontrollør');
  await expect(flags).toContainText('Jeg har sett det');
  await expect(page.getByTestId('record-line-ny-1')).toContainText('KI-forslag godtatt av bas');
  await shot(page, '18-record-fallback');
});

test('ambiguous critical line, missing glossary term, unsupported language (jd-04; T4, T7)', async ({ page }) => {
  await startJob(page, 'jd-04');
  await expect(page.getByText('Støttes ikke: tolk kreves')).toHaveCount(3);
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();

  // T7: flagged before translation; content cannot be confirmed until the line is reworded (AC-07).
  await expect(page.getByTestId('ambiguous-ny-1')).toContainText('«Ved behov» sier ikke når selen skal brukes.');
  await expect(page.getByTestId('ambiguous-ny-1')).toContainText('må skrives om før den kan oversettes');
  await page.getByTestId('ai-accept-ny-2').click();
  await confirmAllRechecks(page);
  await expect(page.getByTestId('confirm-content')).toBeDisabled();
  await expect(page.getByText('1 sikkerhetskritisk linje er tvetydig og må skrives om')).toBeVisible();
  await shot(page, '19-ambiguous-line');
  await page.getByTestId('use-suggestion-ny-1').click();
  await expect(page.getByTestId('line-ny-1')).toContainText('Bruk fallsikringssele festet til forankringspunkt hele tiden du er utenfor stillaset.');
  await page.getByTestId('confirm-content').click();

  // T4a: unsupported language → no worker text, interpreter required.
  const unsupported = page.locator('section', { has: page.getByTestId('flag-UNSUPPORTED_LANGUAGE-ro') });
  await expect(unsupported).toContainText('Rumensk støttes ikke.');
  await expect(unsupported.getByTestId('route-oral')).toContainText('Tolk kreves');
  // T4b: safety concept with no glossary entry → red; the line cannot be signed as checked.
  await expect(page.getByTestId('flag-TERM_NOT_IN_GLOSSARY-pl')).toBeVisible();
  await expect(page.getByTestId('flag-TERM_NOT_IN_GLOSSARY-lt')).toBeVisible();
  await expect(page.getByText('Sikkerhetsbegrepet «vinsj» finnes ikke i ordlisten.').first()).toBeVisible();
  await expect(page.getByTestId('open-flag-count')).toContainText('3 flagg må håndteres');
  await shot(page, '20-unsupported-and-missing-term');
  for (let i = 0; i < 3; i++) await page.getByTestId('route-oral').first().click();
  await expect(page.getByTestId('open-flag-count')).toContainText('Ingen flagg hindrer signering');
  await page.getByTestId('step4-continue').click();

  // The kiosk offers supported languages only.
  await expect(page.getByText('ny arbeider på laget')).toBeVisible();
  await page.getByTestId('start-kiosk').click();
  await expect(page.getByTestId('kiosk-lang-ro')).toHaveCount(0);
  await kioskWorker(page, 'lt');
  await page.getByTestId('kiosk-exit').click();
  await expect(page.getByTestId('respondent-count')).toContainText('1');
  // The Romanian speaker cannot read on the phone: checked orally, through an interpreter. Nothing changed that
  // has an approved question, so the foreman listens for the two new safety-critical lines.
  await page.getByTestId('oral-open').click();
  await expect(page.getByTestId('oral-check').getByTestId('key-points').locator('li')).toHaveCount(2);
  await page.getByTestId('oral-check').getByTestId('teach-missed').click();
  await page.getByTestId('teach-point-ny-2').check();
  await page.getByTestId('teach-rebriefed').click();
  await page.getByTestId('oral-answer-right').click();
  await page.getByTestId('oral-save').click();
  await expect(page.getByTestId('respondent-count')).toContainText('2');
  await expect(page.getByTestId('teach-counts')).toContainText('1 forklarte riktig med en gang · 1 etter ny gjennomgang');
  await page.getByTestId('step5-continue').click();
  await page.getByTestId('sign-agree').check();
  await page.getByTestId('sign-button').click();
  await expect(page.getByTestId('signed-status')).toContainText('Signert med reserveløsning');
  await page.getByTestId('open-record').click();
  await expect(page.getByTestId('record')).toContainText('Rumensk: Språket støttes ikke. Ingen tekst til arbeiderne er laget. Tolk kreves for hele SJA-en.');
});

test('removing a safety-critical line, editing and adding lines', async ({ page }) => {
  await startJob(page, 'jd-09');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();
  // Remove a critical line → red flag; restore or give a reason.
  await page.getByTestId('line-h-20').click();
  await page.getByTestId('remove-h-20').click();
  await expect(page.getByTestId('removed-critical-h-20')).toContainText('En sikkerhetskritisk linje fra malen er fjernet.');
  await expect(page.getByTestId('summary-bar')).toContainText('1 rødt flagg');
  await expect(page.getByTestId('confirm-content')).toBeDisabled();
  await page.getByTestId('restore-h-20').click();
  await expect(page.getByTestId('removed-critical-h-20')).toHaveCount(0);
  // Edit a reused line → it becomes "changed"; editing it back makes it "reused" again (origin is computed from text).
  await page.getByTestId('line-h-16').click();
  await page.getByTestId('edit-h-16').click();
  await page.getByTestId('edit-text-h-16').fill('Bruk vernesko, hansker og vernebriller.');
  await page.getByTestId('edit-save-h-16').click();
  await expect(page.getByTestId('line-h-16')).toContainText('Endret');
  await page.getByTestId('edit-h-16').click();
  await page.getByTestId('edit-text-h-16').fill('Bruk vernesko og hansker.');
  await page.getByTestId('edit-save-h-16').click();
  await expect(page.getByTestId('summary-bar')).toContainText('19 linjer gjenbrukt');
  // Add a line by hand
  await page.getByTestId('add-line-text').fill('Ingen går ut på taket uten sele.');
  await page.getByTestId('add-line').click();
  await expect(page.getByTestId('line-egen-1')).toContainText('Lagt til av bas');
  await expect(page.getByTestId('summary-bar')).toContainText('1 ny linje');
});

test('demo mode is honest about text it cannot check: a rewrite is not applied, and an own line says why', async ({ page }) => {
  await startJob(page, 'jd-01');
  await page.getByTestId('step1-continue').click();
  await page.getByTestId('confirm-specifics').click();
  await expect(page.getByText('Demomodus: tekst du skriver selv')).toBeVisible();
  await expect(page.getByTestId('template-draft-note')).toContainText('Malen er et utkast.'); // nothing is verified with the seed data, and the foreman is told
  await expect(page.getByTestId('was-l-12')).toContainText('I malen: «Sperr av faresonen rundt løftet.»'); // a changed line shows what the template said
  await confirmAllRechecks(page);
  await page.getByTestId('confirm-content').click();

  // Step 4: rewriting needs a new ambiguity check. With no stored answer the rewrite is refused, and nothing changes.
  await page.getByTestId('route-rewrite').click();
  await expect(page.getByText('Demomodus: en ny formulering kan ikke kontrolleres')).toBeVisible();
  await page.locator('textarea').fill('Sperr av hele området rundt løftet og gangveien.');
  await page.getByTestId('rewrite-save').click();
  await expect(page.getByRole('alert')).toContainText('The new wording could not be checked, so it was not saved.');
  await expect(page.getByTestId('flag-GLOSSARY_MISMATCH-lt')).toBeVisible(); // the flag and the line are as they were
  await expect(page.getByText('Sperr av faresonen rundt løftet, også gangveien ved inngangen.').first()).toBeVisible();
  await expect(page.getByTestId('open-flag-count')).toContainText('1 flagg må håndteres');
});
