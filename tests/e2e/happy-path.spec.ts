// J1: reuse a template for today's job, through to a signed record.
// Runs in replay mode at 375 px width. Shows that the software works as planned.
// It is not evidence for any claim about translation quality.
import { readFileSync } from 'node:fs';
import { BANNER_EN, confirmAllRechecks, expect, expectBanner, kioskWorker, noHorizontalScroll, shot, startJob, test } from './helpers';

test('J1 happy path: from today’s job to a signed, traceable record', async ({ page }) => {
  await page.goto('/');
  await expectBanner(page);
  await expect(page.getByTestId('tile-foreman')).toContainText('Lag dagens SJA'); // one main thing to do
  await expect(page.getByText('Slik går det til')).toBeVisible();
  await noHorizontalScroll(page, 'home');
  await shot(page, '01-home');

  // Step 1: job
  await startJob(page, 'jd-01');
  await expectBanner(page);
  await expect(page.getByTestId('step-title')).toHaveText('Steg 1 av 6: Dagens jobb');
  await expect(page.getByTestId('step-help')).toContainText('Fortell hva som er spesielt med jobben i dag.'); // every step says what to do
  await expect(page.getByText('Ikke skriv navn på personer, firmaer, kunder eller adresser.')).toBeVisible(); // F-02 notice
  await expect(page.getByText('De sendes aldri til KI.')).toBeVisible();
  await page.getByTestId('header-site').fill('HEMMELIG-BYGGEPLASS-77');
  await expect(page.getByTestId('param-weight')).toHaveValue('850');
  await noHorizontalScroll(page, 'step 1');
  await shot(page, '02-step1-job');

  // Validation: a parameter outside its range, and no language
  await page.getByTestId('param-weight').fill('5');
  await page.getByTestId('lang-pl').uncheck();
  await page.getByTestId('lang-lt').uncheck();
  await page.getByTestId('step1-continue').click();
  await expect(page.getByText('Må være mellom 50 og 20000 kg.')).toBeVisible();
  await expect(page.getByText('Velg minst ett språk.')).toBeVisible();
  await page.getByTestId('param-weight').fill('850');
  await page.getByTestId('lang-pl').check();
  await page.getByTestId('lang-lt').check();
  await page.getByTestId('step1-continue').click();

  // Step 2: understood
  await expect(page.getByTestId('specifics')).toContainText('Løftet går over gangveien ved inngangen.');
  // Removing a detail by mistake can be undone.
  await page.getByTestId('remove-specific-1').click();
  await expect(page.getByTestId('specifics')).not.toContainText('Løftet går over gangveien ved inngangen.');
  await page.getByTestId('undo-remove-specific').click();
  await expect(page.getByTestId('specifics')).toContainText('Løftet går over gangveien ved inngangen.');
  await noHorizontalScroll(page, 'step 2');
  await shot(page, '03-step2-understood');
  await page.getByTestId('confirm-specifics').click();

  // Step 3: content. Most lines reused, three changed or new, two technical re-check markers.
  await expect(page.getByTestId('summary-bar')).toContainText('19 linjer gjenbrukt');
  await expect(page.getByTestId('summary-bar')).toContainText('4 verdier fra steg 1');
  await expect(page.getByTestId('summary-lead')).toContainText('23 av 26 linjer kommer rett fra malen. Les de 3 som er nye eller endret i dag.');
  await expect(page.getByTestId('action-bar')).toContainText('2 ting må avgjøres først.'); // the next action says why it is not available yet
  await expect(page.getByTestId('summary-bar')).toContainText('1 linje endret');
  await expect(page.getByTestId('summary-bar')).toContainText('2 nye linjer');
  await expect(page.locator('[data-testid^="recheck-confirm-"]')).toHaveCount(2);
  await expect(page.getByTestId('confirm-content')).toBeDisabled(); // AC-13
  await noHorizontalScroll(page, 'step 3');
  await shot(page, '04-step3-content');

  // English toggle changes the foreman-facing strings (AC-27)
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByTestId('summary-bar')).toContainText('19 lines reused');
  // With English on, each Norwegian line gets an English help line, marked as not part of the SJA.
  await expect(page.getByTestId('help-en-note')).toContainText('not part of the SJA');
  await expect(page.getByTestId('line-l-12')).toContainText('Help translation: Cordon off the danger zone around the lift, including the walkway at the entrance.');
  await expect(page.getByTestId('confirm-content')).toHaveText('Confirm the Norwegian content');
  await expectBanner(page, BANNER_EN);
  await page.getByRole('button', { name: 'NO', exact: true }).click();
  await expect(page.getByTestId('help-en')).toHaveCount(0); // never in Norwegian

  await confirmAllRechecks(page);
  await page.getByTestId('confirm-content').click();

  // Step 4: language check. One red glossary flag in Lithuanian, on a changed line.
  await expect(page.getByTestId('check-summary')).toContainText('3 endrede eller nye linjer oversatt og kontrollert på 2 språk');
  await expect(page.getByTestId('open-flag-count')).toContainText('1 flagg må håndteres');
  const flag = page.getByTestId('flag-GLOSSARY_MISMATCH-lt');
  await expect(flag).toBeVisible();
  await expect(page.getByText('Fant ikke det godkjente ordet for «faresone»')).toBeVisible(); // explained in Norwegian (CH-02)
  await expect(page.getByText('Tilbakeoversettelsen', { exact: true })).toBeVisible();
  // The four routes are there, and there is no control that dismisses the red flag (AC-11).
  for (const r of ['approvedTerm', 'rewrite', 'reviewer', 'oral']) await expect(page.getByTestId(`route-${r}`)).toBeVisible();
  await expect(page.getByTestId('route-acknowledged')).toHaveCount(0);
  await noHorizontalScroll(page, 'step 4');
  await shot(page, '05-step4-flag');
  await page.getByTestId('route-approvedTerm').click();
  await expect(page.getByTestId('open-flag-count')).toContainText('Ingen flagg hindrer signering');

  // Step 5 (brief v3): required because a safety-critical line changed. Each worker explains the
  // hazard and the measure in their own words, and answers ONE scenario question.
  await page.getByTestId('step4-continue').click();
  await expect(page.getByText('en sikkerhetskritisk linje er endret eller ny')).toBeVisible();
  await expect(page.getByTestId('key-points')).toContainText('Sperr av faresonen rundt løftet, også gangveien ved inngangen.');
  await expect(page.getByTestId('step5-state')).toContainText('Sjekk minst én arbeider før du kan signere.');
  await shot(page, '06-step5-understanding');
  await page.getByTestId('start-kiosk').click();

  // Kiosk: Polish worker. Worker text is in the worker's language.
  await expectBanner(page, 'Student prototype');
  await page.getByTestId('kiosk-lang-pl').click();
  await expectBanner(page, 'Prototyp studencki');
  await expect(page.getByTestId('kiosk-today')).toContainText('Wygrodź strefę niebezpieczną wokół miejsca podnoszenia, również chodnik przy wejściu.'); // what is new today comes first
  await expect(page.getByTestId('kiosk-today').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('kiosk-read')).not.toContainText('Sperr av faresonen');
  const fontSize = await page.getByTestId('kiosk-read').locator('li p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(18); // 8.4
  await expect(page.locator('input[type="text"], input:not([type])')).toHaveCount(0); // no field asks for a name (AC-16)
  await noHorizontalScroll(page, 'kiosk');
  await shot(page, '07-kiosk-read');
  await page.getByTestId('kiosk-read-done').click();

  // Teach-back: the worker is asked in Polish; the foreman's part is in Norwegian and lists what to listen for.
  await expect(page.getByTestId('kiosk-explain')).toContainText('Wyjaśnij brygadziście własnymi słowami:');
  await expect(page.getByTestId('foreman-zone')).toContainText('Lytt etter dette:');
  await expect(page.getByTestId('foreman-zone').getByTestId('key-points').locator('li')).toHaveCount(3);
  await expect(page.locator('input[type="text"], input:not([type])')).toHaveCount(0);
  await noHorizontalScroll(page, 'kiosk teach-back');
  await shot(page, '07b-kiosk-teach-back');
  await page.getByTestId('teach-ok').click();
  // One question, not three.
  await expect(page.getByTestId('kiosk-question')).toContainText('Jedno pytanie');
  await shot(page, '08-kiosk-question');
  await page.locator('[data-correct="yes"]').click();
  await page.getByTestId('kiosk-next').click();
  await expect(page.getByTestId('kiosk-done')).toContainText('Oddaj telefon brygadziście.');
  await page.getByTestId('kiosk-next-worker').click();

  // Lithuanian worker: one point misunderstood in the explanation, and the question answered wrongly (AC-15).
  await kioskWorker(page, 'lt', { missed: 1, wrong: true });
  await page.getByTestId('kiosk-finish').click();

  // Foreman sees counts only. Sign-off stays closed until the wrong answer has been briefed again.
  await expect(page.getByTestId('respondent-count')).toContainText('2');
  await expect(page.getByTestId('teach-counts')).toContainText('1 forklarte riktig med en gang · 1 etter ny gjennomgang');
  await expect(page.getByTestId('misunderstood-list')).toContainText('Sperr av faresonen rundt løftet, også gangveien ved inngangen. (1)');
  await expect(page.locator('[data-testid^="rebrief-q-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="rebrief-q-"]')).toContainText('1 svarte feil');
  await shot(page, '09-step5-rebrief');
  await page.getByTestId('step5-continue').click();
  await expect(page.getByTestId('sign-button')).toBeDisabled(); // AC-18
  await expect(page.getByTestId('gate-title')).toHaveText('Én ting mangler før du kan signere');
  await expect(page.getByTestId('gate-understanding-open')).toBeVisible();
  await expect(page.getByTestId('sign-blocked')).toContainText('Du kan ikke signere ennå');
  await shot(page, '10-step6-gate-closed');
  await page.getByText('Gå til steg 5').click();
  await page.locator('[data-testid^="rebrief-confirm-"]').click();
  await expect(page.getByTestId('step5-state')).toContainText('Sjekken er i orden.');

  // A third worker is checked at the briefing, without the phone: the foreman records the explanation and the answer.
  await page.getByTestId('oral-open').click();
  await expect(page.getByTestId('oral-save')).toBeDisabled();
  await page.getByTestId('oral-check').getByTestId('teach-ok').click();
  await expect(page.getByTestId('oral-check')).toContainText('Riktig svar: Jeg sier stopp høyt, og løftet stanses.');
  await page.getByTestId('oral-answer-right').click();
  await page.getByTestId('oral-save').click();
  await expect(page.getByTestId('respondent-count')).toContainText('3');
  await page.getByTestId('step5-continue').click();

  // Step 6: sign
  await expect(page.getByTestId('gate-title')).toHaveText('Alt er i orden. Du kan signere.');
  await expect(page.getByTestId('gate-understanding-ok')).toBeVisible();
  await expect(page.getByTestId('sign-button')).toBeDisabled(); // the statement is not yet confirmed
  await page.getByTestId('observer-toggle').click();
  await page.getByTestId('assist-button').click();
  await page.getByTestId('observer-toggle').click();
  await page.getByTestId('sign-agree').check();
  await noHorizontalScroll(page, 'step 6');
  await page.getByTestId('sign-button').click();
  await expect(page.getByTestId('signed-status')).toContainText('Signert');
  await expect(page.getByText('Hva gjør du nå?')).toBeVisible(); // the signed screen says what comes next
  await shot(page, '11-signed');

  // After sign-off (brief v3): the foreman watches the start of the job and notes what was misunderstood.
  await page.goto('/');
  await expect(page.getByTestId('home-observe')).toContainText('Noter det du så ved oppstart'); // Home reminds the foreman
  await page.getByTestId('home-observe').click();
  await page.getByTestId('observe-some').click();
  await expect(page.getByTestId('observe-save')).toBeDisabled();
  await page.getByTestId('observe-line-ny-1').check();
  await page.getByTestId('observe-save').click();
  await expect(page.getByTestId('observation-status')).toContainText('Observert ved oppstart: 1 linje ble misforstått');
  await shot(page, '11b-observation');
  // Once signed, the worker screens are closed: nothing more can be recorded.
  const signedUrl = page.url();
  await page.goto(signedUrl.replace('/foreman/', '/worker/'));
  await expect(page.getByTestId('kiosk-closed')).toContainText('SJA-en er signert.');
  await page.goto(signedUrl);

  // Record (AC-19)
  await page.getByTestId('open-record').click();
  const record = page.getByTestId('record');
  await expect(page.getByTestId('record-status')).toHaveText('Signert');
  await expectBanner(page);
  await expect(page.getByTestId('record-reuse')).toHaveText('23 av 26');
  await expect(page.getByTestId('record-versions')).toContainText('P4 v1.0.0');
  await expect(page.getByTestId('record-line-l-12')).toContainText('Endret');
  await expect(page.getByTestId('record-line-l-12')).toContainText('maskinkontrollert, ikke verifisert av kontrollør');
  await expect(page.getByTestId('record-line-l-11')).toContainText('gjenbrukt – Utkast: ikke verifisert');
  await expect(record).not.toContainText('gjenbrukt – Verifisert'); // nothing is called verified (CR-18)
  await expect(page.getByTestId('record-flags')).toContainText('Bruk det godkjente ordet');
  await expect(page.getByTestId('record-flags')).toContainText('bas');
  await expect(page.getByTestId('record-understanding')).toContainText('Arbeidere som er sjekket: 3');
  await expect(page.getByTestId('record-understanding')).toContainText('2 forklarte riktig med en gang · 1 etter ny gjennomgang');
  await expect(page.getByTestId('record-understanding')).toContainText('Forståelse er ikke en signatur eller en poengsum.');
  await expect(page.getByTestId('record-observation')).toContainText('1 linje ble misforstått');
  await expect(page.getByTestId('record-summary')).toContainText('Gjennomført uten hjelp');
  await expect(page.getByTestId('record-verified-template')).toContainText('Nei. 0 av 23 linjer fra malen er verifisert av begge kontrollører.'); // honest: the seed template is a draft
  await expect(page.getByTestId('record-summary')).toContainText('Total tid til signering');
  await expect(page.getByTestId('record-assists')).toHaveText('1');
  // A duration for every time category that occurred in the run (AC-22)
  for (const c of ['input', 'machine', 'contentReview', 'flagResolution', 'understanding', 'signoff']) {
    expect(Number(await page.getByTestId(`timing-${c}`).getAttribute('data-ms')), `time for ${c}`).toBeGreaterThan(0);
  }
  await expect(record).toContainText('lagrede svar skrevet for demonstrasjon'); // replay is labelled as replay
  await noHorizontalScroll(page, 'record');
  await shot(page, '12-record');

  // The long sections open on a tap. Trace panel: step through the run (F-17, F-18)
  await expect(page.getByTestId('trace-panel')).toBeHidden();
  await page.getByTestId('record-trace-toggle').click();
  await expect(page.getByTestId('trace-panel')).toBeVisible();
  await page.getByTestId('trace-step-toggle').click();
  await expect(page.getByTestId('trace-position')).toContainText('1 /');
  await page.getByTestId('trace-next').click();
  await page.getByTestId('trace-next').click();
  await expect(page.getByTestId('trace-position')).toContainText('3 /');
  await shot(page, '13-trace');
  await page.getByTestId('trace-step-toggle').click();
  expect(await page.locator('[data-testid="trace-model"]').count()).toBeGreaterThan(20);
  expect(await page.locator('[data-testid="trace-human"]').count()).toBeGreaterThan(5);
  expect(await page.locator('[data-testid="trace-rule"]').count()).toBeGreaterThan(3);

  // Export: the evidence file reads on its own and carries the banner (AC-25, AC-26)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-md').click()]);
  const md = readFileSync(await download.path(), 'utf8');
  expect(md.startsWith('> **Studentprototype. Syntetisk innhold. Ikke en gyldig SJA.')).toBe(true);
  for (const part of ['## Inndata', '## SJA-en linje for linje', '## Flagg', '## Tid per kategori', '## Slik virket kjøringen', 'Polsk', 'Litauisk', 'GLOSSARY_MISMATCH', 'Forklaring med egne ord: 2 forklarte riktig med en gang · 1 etter ny gjennomgang', 'Observasjon ved oppstart: Observert ved oppstart: 1 linje ble misforstått', 'Total tid til signering', 'Gjennomført uten hjelp: Nei']) expect(md).toContain(part);

  // AC-03: the site label typed in the header never reached a model request.
  const runId = page.url().split('/').pop()!;
  const calls = await (await page.request.get(`/api/evidence/calls/${runId}`)).json();
  expect(calls.length).toBeGreaterThan(20);
  expect(JSON.stringify(calls.map((c: any) => c.input))).not.toContain('HEMMELIG-BYGGEPLASS-77');
  // AC-10: back-translation requests hold the target text only.
  for (const c of calls.filter((x: any) => x.task === 'P5')) expect(Object.keys(c.input).sort()).toEqual(['lang', 'text']);
  // AC-08: exactly three lines per language were sent for translation (plus one re-translation for the flag).
  const p4 = calls.filter((x: any) => x.task === 'P4');
  expect(p4.filter((c: any) => c.input.targetLang === 'pl')).toHaveLength(3);
  expect(p4.filter((c: any) => c.input.targetLang === 'lt' && c.input.attempt === 0)).toHaveLength(3);
  expect(p4.filter((c: any) => c.input.enforceApprovedTerms)).toHaveLength(1);

  // AC-22: the anonymous event log holds no free text and no names.
  const saved = await (await page.request.get(`/api/evidence/runs/${runId}`)).json();
  const eventsText = JSON.stringify(saved.events);
  expect(eventsText).not.toContain('HEMMELIG');
  expect(eventsText).not.toContain('gangveien');
  expect(saved.events.some((e: any) => e.type === 'signed')).toBe(true);
  // Brief v3: misunderstandings are logged without names, and the observation is added to the saved run without losing its trace.
  expect(saved.events.filter((e: any) => e.type === 'misunderstanding').map((e: any) => [e.lineId, e.route, e.templateId])).toEqual([['l-12', 'teachBack', 'lifting'], ['job-specific', 'observation', 'lifting']]);
  expect(saved.sja.observation.lineIds).toEqual(['ny-1']);
  expect(saved.sja.understanding).toMatchObject({ respondents: 3, teachBack: { ok: 2, rebriefed: 1 }, questionIds: ['q-l3'] });
  expect(saved.trace.at(-1).title).toBe('Foreman watched the start of the job');
  expect(saved.events.filter((e: any) => e.type === 'respondent_done').every((e: any) => e.languagePair === undefined)).toBe(true); // no per-person result by language
  expect(saved.trace.every((e: any, i: number) => e.seq === i + 1)).toBe(true);
  expect(saved.trace.filter((e: any) => e.kind === 'model').length).toBeGreaterThan(20);

  // The saved run is listed and can be reopened (J6)
  await page.goto('/runs');
  await expect(page.getByTestId('run-link').first()).toContainText('lifting');
  await page.getByTestId('run-link').first().click();
  await expect(page.getByTestId('record-status')).toHaveText('Signert');

  // What was misunderstood comes back to the people who maintain the template (brief v3).
  await page.goto('/review');
  await page.getByTestId('review-template').selectOption('lifting');
  await expect(page.getByTestId('misunderstood-summary')).toContainText('workers misunderstood 1 line(s) of this template');
  await expect(page.getByTestId('lib-line-l-12')).toContainText('misunderstood on site: 1×');
  await page.getByTestId('only-misunderstood').check();
  await expect(page.getByTestId('library-lines').locator('> li')).toHaveCount(1);
});

