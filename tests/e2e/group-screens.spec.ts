// Reviewer, library, test bench, baseline and replay screens (J3–J6), in replay mode.
import { readFileSync } from 'node:fs';
import { BANNER_EN, expect, expectBanner, shot, standaloneWorker, test } from './helpers';

test.use({ viewport: { width: 1180, height: 860 } });

test('library: with the seed data as delivered, nothing is verified (AC-01)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-reviewer').click();
  await page.getByTestId('tile-library').click();
  await expectBanner(page, BANNER_EN); // group and reviewer screens are in English only
  await expect(page.getByTestId('review-template').locator('option')).toHaveCount(4); // work at height, lifting, painting, concrete
  const states = await page.locator('[data-testid^="state-"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state));
  expect(states.length).toBe(22 * 4); // every target-language line (pl, lt, ru, en) shows a state
  expect(new Set(states)).toEqual(new Set(['draft']));
  await expect(page.getByTestId('lib-line-h-01')).toContainText('unsourced'); // a value from step 1 has no source (CR-21)
  await expect(page.getByTestId('lib-line-h-07')).toContainText('source: hh-11'); // Q1: every rule line now has a source or a "firm practice" mark
  await expect(page.getByTestId('lib-line-h-09')).toContainText('source: hh-06');
  await expect(page.locator('[data-testid^="approve-"]')).toHaveCount(0); // read-only
  await page.getByTestId('tab-glossary').click();
  expect(await page.getByTestId('glossary-list').locator('> li').count()).toBeGreaterThanOrEqual(40);
  await page.getByTestId('glossary-search').fill('szelki');
  await expect(page.getByTestId('glossary-list').locator('> li')).toHaveCount(1);
  await expect(page.getByTestId('glossary-list')).toContainText('fall-arrest harness');
  await page.getByTestId('tab-summary').click();
  for (const k of ['lines.pl', 'lines.lt', 'glossary.pl', 'glossary.lt', 'questions.pl', 'questions.lt']) {
    await expect(page.getByTestId(`counts-${k}`)).toHaveAttribute('data-verified', '0');
  }
  await shot(page, '21-library-summary');
});

test('review: two keys make "Verified"; an edit clears keys; version raise (AC-20, SC-04, SC-10)', async ({ page }) => {
  await page.goto('/review');
  // Language reviewer, Lithuanian, outside the group
  await page.getByTestId('reviewer-role').selectOption('language');
  await page.getByTestId('reviewer-lang').selectOption('lt');
  await page.getByTestId('reviewer-outside').check();
  await page.getByTestId('reviewer-start').click();
  await expect(page.getByTestId('reviewer-session')).toContainText('language reviewer, Lithuanian, outside the group');
  const state = (line: string, lang: string) => page.getByTestId(`state-${line}-${lang}`);
  // Approving does not reload the page or jump to the top: the reviewer continues where they are.
  let loads = 0;
  page.on('load', () => (loads += 1));
  await page.getByTestId('approve-work-at-height/h-10|lt').scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(500);
  await page.getByTestId('approve-work-at-height/h-10|lt').click();
  await expect(state('h-10', 'lt')).toHaveAttribute('data-state', 'languageChecked'); // exactly one key
  await page.waitForTimeout(1500); // time for a reload, if the save caused one
  expect(loads).toBe(0);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(400);
  await expect(page.getByTestId('lib-line-h-10-lt')).toContainText('outside the group');

  // Technical reviewer, inside the group
  await page.getByRole('button', { name: 'Stop reviewing' }).click();
  await page.getByTestId('reviewer-role').selectOption('technical');
  await page.getByTestId('reviewer-outside').uncheck();
  await page.getByTestId('reviewer-start').click();
  await page.getByTestId('approve-work-at-height/h-10').click();
  await expect(state('h-10', 'lt')).toHaveAttribute('data-state', 'verified');
  await expect(state('h-10', 'pl')).toHaveAttribute('data-state', 'technicallyChecked'); // the technical key covers all languages
  await shot(page, '22-review-verified');

  await page.getByTestId('tab-summary').click();
  await expect(page.getByTestId('counts-lines.lt')).toHaveAttribute('data-verified', '1');
  await expect(page.getByText('Keys given: 2, of which outside the group: 1.')).toBeVisible();
  await expect(page.getByTestId('pack-version')).toContainText('version 1');
  await page.getByTestId('raise-version').click();
  await expect(page.getByTestId('pack-version')).toContainText('version 2');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-verification').click()]);
  const md = readFileSync(await dl.path(), 'utf8');
  expect(md).toContain(BANNER_EN);
  expect(md).toContain('| line | work-at-height/h-10 | lt | language | yes |');

  // Editing the Norwegian source clears the technical key and every language key.
  await page.getByTestId('tab-templates').click();
  await page.getByTestId('correct-work-at-height/h-10').click();
  await page.getByTestId('review-editor').fill('Sperr av hele området under arbeidsstedet.');
  await page.getByTestId('review-editor-save').click();
  await expect(state('h-10', 'lt')).toHaveAttribute('data-state', 'draft');
  await expect(state('h-10', 'pl')).toHaveAttribute('data-state', 'draft');

  // A correction by the language reviewer is itself an approval, and triggers a re-check.
  await page.getByRole('button', { name: 'Stop reviewing' }).click();
  await page.getByTestId('reviewer-role').selectOption('language');
  await page.getByTestId('reviewer-lang').selectOption('pl');
  await page.getByTestId('reviewer-start').click();
  await page.getByTestId('correct-work-at-height/h-10|pl').click();
  await page.getByTestId('review-editor').fill('Wygrodź cały teren pod miejscem pracy.');
  await page.getByTestId('review-editor-save').click();
  await expect(state('h-10', 'pl')).toHaveAttribute('data-state', 'languageChecked');
  await expect(page.getByTestId('lib-line-h-10-pl')).toContainText('Re-check (rules D1, D2): clean');

  // The working pack on disk holds the change; the seed data is untouched; reset restores it.
  const pack = await (await page.request.get('/api/data/pack')).json();
  expect(pack.version).toBe(2);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('tab-summary').click();
  await page.getByTestId('reset-pack').click();
  await expect(page.getByTestId('pack-version')).toContainText('version 1');
  await expect(page.getByTestId('counts-lines.pl')).toHaveAttribute('data-verified', '0');
});

test('test bench: T6 counts by layer, false-alarm verdict, edge cases, Appendix A export (AC-09, AC-21, AC-23, AC-24)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-project').click();
  await page.getByTestId('tile-bench').click();
  await expect(page.getByText('Replay mode: nothing on this screen is a test result.')).toBeVisible();
  await expect(page.getByText('Unconfirmed fixtures.')).toBeVisible();

  await page.getByTestId('bench-run-t6').click();
  await expect(page.getByTestId('bench-t6-result')).toBeVisible({ timeout: 30_000 });
  for (const lang of ['pl', 'lt']) {
    await expect(page.getByTestId(`caught-rules-${lang}`)).toHaveText('5 of 10'); // rules alone
    await expect(page.getByTestId(`caught-all-${lang}`)).toHaveText('9 of 10'); // rules plus back-translation
    await expect(page.getByTestId(`false-flags-${lang}`)).toHaveText('0');
    await expect(page.getByTestId(`missed-${lang}`)).toHaveText(`${lang}-s10`);
  }
  await expect(page.getByTestId('bench-row-pl-s01')).toContainText('FORBIDDEN_TERM · D1');
  await expect(page.getByTestId('bench-row-pl-s05')).toContainText('NUMBER_UNIT_MISMATCH · D2');
  await expect(page.getByTestId('bench-row-pl-s06')).toContainText('MEANING_SHIFT · P6');
  await expect(page.getByTestId('bench-row-pl-c01')).toContainText('no flag');
  await shot(page, '23-bench-t6');

  // Without a language-reviewer session nobody can mark a false alarm.
  await expect(page.getByTestId('bench-false-alarm')).toHaveCount(0);
  await page.goto('/review');
  await page.getByTestId('reviewer-role').selectOption('language');
  await page.getByTestId('reviewer-lang').selectOption('pl');
  await page.getByTestId('reviewer-start').click();
  await page.goto('/bench');
  // The reviewer judges the "dźwig" flag a false alarm → the counts change (AC-21).
  await page.getByTestId('bench-row-pl-s01').getByTestId('bench-false-alarm').click();
  await page.getByTestId('bench-fa-reason').fill('On site everybody says "dźwig" for a crane.');
  await page.getByTestId('bench-fa-save').click();
  await expect(page.getByTestId('caught-rules-pl')).toHaveText('4 of 10');
  await expect(page.getByTestId('caught-all-pl')).toHaveText('8 of 10');
  await expect(page.getByTestId('false-flags-pl')).toHaveText('1');
  await expect(page.getByTestId('bench-row-lt-s01').getByTestId('bench-false-alarm')).toHaveCount(0); // not this reviewer's language

  // The exported result is marked as replay.
  const [benchFile] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bench-export').click()]);
  const benchMd = readFileSync(await benchFile.path(), 'utf8');
  expect(benchMd).toContain(BANNER_EN);
  expect(benchMd).toContain('REPLAY – NOT A TEST RESULT');
  expect(benchMd).toContain('Unconfirmed fixtures');

  // Pasted pair from any other tool: changed direction → flagged by the comparison.
  await page.getByTestId('paste-run').click();
  await expect(page.getByTestId('paste-result')).toContainText('MEANING_SHIFT · P6');
  // A pasted pair in an unsupported language raises that flag and nothing else (AC-09).
  await page.getByTestId('paste-pairs').fill('Minst 2 personer skal være til stede. | Cel puțin 3 persoane trebuie să fie prezente.');
  await page.getByTestId('paste-lang').fill('ro');
  await page.getByTestId('paste-run').click();
  await expect(page.getByTestId('paste-result')).toContainText('UNSUPPORTED_LANGUAGE · D4');
  await expect(page.getByTestId('paste-result')).not.toContainText('NUMBER_UNIT_MISMATCH');

  // T4, T7, T3
  await page.getByTestId('bench-run-edge').click();
  await expect(page.getByTestId('bench-edge-result')).toContainText('UNSUPPORTED_LANGUAGE · D4');
  await expect(page.getByTestId('bench-edge-result')).toContainText('TERM_NOT_IN_GLOSSARY · P4');
  await page.getByTestId('bench-run-ambiguity').click();
  await expect(page.getByTestId('bench-ambiguity-result')).toContainText('SOURCE_AMBIGUOUS · unclear_actor');
  await expect(page.getByTestId('bench-ambiguity-result')).toContainText('SOURCE_AMBIGUOUS · undefined_condition');
  await page.getByTestId('bench-run-slang').click();
  await expect(page.getByTestId('bench-slang-result')).toContainText('Clarifying questions: 2');
  await expect(page.getByTestId('bench-slang-result')).toContainText('unclear: not guessed');

  // Appendix A: exactly six columns; observed result and learning stay empty until a person types (AC-24).
  await page.getByTestId('testlog-add').click();
  await expect(page.getByTestId('testlog-table').locator('tbody tr')).toHaveCount(9); // T1–T8 and U4
  for (const box of await page.getByTestId('testlog-observed').all()) await expect(box).toHaveValue('');
  for (const box of await page.getByTestId('testlog-learning').all()) await expect(box).toHaveValue('');
  const [csvFile] = await Promise.all([page.waitForEvent('download'), page.getByTestId('testlog-export-csv').click()]);
  const csv = readFileSync(await csvFile.path(), 'utf8').trim().split('\n');
  expect(csv[0]).toBe('"Number","Case type","Scenario or input","Expected outcome","Observed result","Learning or revision"');
  expect(csv).toHaveLength(10); // header, T1–T8 and U4
  expect(csv[1].endsWith(',"",""')).toBe(true);
  await page.getByTestId('testlog-observed').first().fill('Typed by the observer.');
  const [mdFile] = await Promise.all([page.waitForEvent('download'), page.getByTestId('testlog-export-md').click()]);
  const md = readFileSync(await mdFile.path(), 'utf8');
  expect(md).toContain(BANNER_EN);
  expect(md).toContain('| Number | Case type | Scenario or input | Expected outcome | Observed result | Learning or revision |');
  expect(md).toContain('Typed by the observer.');

  // Appendix B helpers
  const [aiUse] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-ai-use').click()]);
  const ai = readFileSync(await aiUse.path(), 'utf8');
  expect(ai).toContain('Which step each model served');
  expect(ai).toContain('prompts/P5_backtranslate.md');
  const [prompts] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-prompts').click()]);
  const pm = readFileSync(await prompts.path(), 'utf8');
  expect(pm).toContain('## P6 – Compare original with back-translation (version 1.0.0)');
  expect(pm).toContain('# Prompt changelog');
});

test('baseline arm: category timer and the question set without the SJA (F-19, AC-17)', async ({ page }) => {
  await page.goto('/baseline');
  await expectBanner(page, BANNER_EN);
  await page.getByTestId('baseline-label').fill('T8 (i) blank form by hand');
  await page.getByTestId('baseline-input').click();
  await page.waitForTimeout(1100);
  await page.getByTestId('baseline-flagResolution').click(); // switching stops one category and starts the next
  await page.waitForTimeout(1100);
  await page.getByTestId('baseline-stop').click();
  const row = page.getByTestId('baseline-table').locator('tbody tr').first();
  await expect(row).toContainText('baseline');
  await expect(row).toContainText('T8 (i) blank form by hand');
  await expect(row.getByTestId('baseline-total')).toHaveText('0:02'); // drafting + checking + correction (brief v3, measure 1)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('baseline-export').click()]);
  expect(readFileSync(await dl.path(), 'utf8')).toContain('"baseline","T8","T8 (i) blank form by hand"');

  // Standalone question set: no SJA text is shown, no name is asked, counts only.
  await expect(page.getByText('Time both methods from drafting through checking and correction')).toBeVisible();
  await page.getByRole('link', { name: 'Question set: Work at height' }).click();
  await page.getByTestId('standalone-start').click();
  await page.getByTestId('kiosk-lang-pl').click();
  await expect(page.getByTestId('kiosk-read')).toHaveCount(0);
  await expect(page.getByTestId('kiosk-question')).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await page.goBack();
  await page.getByRole('link', { name: 'Question set: Work at height' }).click();
  await page.getByTestId('standalone-start').click();
  expect(await standaloneWorker(page, 'pl', 0)).toBe(4);
  await page.getByTestId('kiosk-next-worker').click();
  expect(await standaloneWorker(page, 'lt')).toBe(4);
  await page.getByTestId('kiosk-exit').click();
  const table = page.getByTestId('standalone-table');
  await expect(table).toContainText('T5 baseline');
  await expect(table).toContainText('q-h1: 1 of 2');
  await expect(table).toContainText('q-h2: 2 of 2');
});
