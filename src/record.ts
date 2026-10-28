// The traceable record (F-11) and the evidence exports (F-15). Every export starts
// with the prototype banner (AC-26) and reads on its own, with no link needed (CR-16).
import type { ServerConfig, PromptFile } from './api';
import { activeLines, allFlags } from './core/flags';
import { benchSummary, feedbackEvents, FOREMAN_CATEGORIES, fmtDuration, foremanTime, judgedCounts, misunderstandingCounts, PHASE_OF, reuseRate, TIME_CATEGORIES, timeByCategory, TOTAL_CATEGORIES, totalTime, unverifiedReuse, type PairFixture } from './core/metrics';
import { BANNER_EN, BANNER_NB, type DataPack, type HazardList, type LogEvent, type RunRecord, type Sja, type SjaLineLang, type Template } from './core/types';
import { LANG_NAMES, nowIso } from './core/util';
import { verificationSummary } from './core/verification';
import { translate, type UiLang } from './i18n';
import { useApp, useLog, useSjas, type BenchRun, type TestLogRow } from './state/stores';

export function buildRunRecord(sja: Sja, note?: string): RunRecord {
  const events = useLog.getState().events.filter((e) => e.runId === sja.sjaId);
  const trace = useSjas.getState().traces[sja.sjaId] ?? [];
  const template = useApp.getState().pack?.templates.find((t) => t.templateId === sja.templateId);
  return {
    runId: sja.sjaId,
    savedAt: nowIso(),
    banner: BANNER_EN,
    sja,
    templateJobType: template?.jobType ?? {},
    events,
    trace,
    timings: timeByCategory(events),
    metrics: { reuseRate: reuseRate(sja) },
    note,
  };
}

/** What the record says about one line in one language. Never "verified" unless both keys exist. */
export function lineLangLabel(entry: SjaLineLang | undefined, lang: UiLang, clean = false): string {
  const t = (k: string) => translate(lang, k);
  if (!entry) return t('rec.noText');
  if (entry.oralFallback) return t('rec.oral');
  if (entry.checkState === 'error') return t('rec.notChecked');
  if (entry.checkState === 'pending' || entry.checkState === 'blocked') return t('rec.notChecked');
  if (entry.source === 'reviewerCorrected') return t('rec.reviewerCorrected');
  if (entry.source === 'memory') return t('rec.fromMemory');
  if (entry.source === 'machineNew') return entry.flags.some((f) => f.status === 'open') ? t('rec.machineFlagged') : t('rec.machineChecked');
  // The clean view does not say a line was reused (no template behind it): only its state.
  return clean ? t(`verif.${entry.verification}`) : `${t('rec.reusedAs')} ${t(`verif.${entry.verification}`)}`;
}

const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: unknown[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

export function modeLabel(sja: Sja, lang: UiLang): string {
  const o = sja.versions.fixtureOrigins;
  if (o.length === 0) return translate(lang, 'rec.noModel');
  return o
    .map((x) => (x === 'replay:scripted' ? translate(lang, 'rec.modeScripted') : x === 'replay:recorded' ? translate(lang, 'rec.modeRecorded') : x === 'record' ? translate(lang, 'rec.modeLive') : translate(lang, 'rec.modeLive')))
    .join('; ');
}

export function recordToMarkdown(rec: RunRecord, lang: UiLang, hazards?: HazardList, template?: Template): string {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const { sja } = rec;
  const lines = sja.lines;
  const flags = allFlags(sja);
  const langs = sja.languages;
  const u = sja.understanding;
  const out: string[] = [];
  out.push(`> **${lang === 'nb' ? BANNER_NB : BANNER_EN}**`, '');
  out.push(`# ${t('rec.title')}: ${rec.templateJobType[lang] ?? sja.templateId}`, '');
  out.push(t('rec.statement'), '');
  out.push(`## ${t('rec.identity')}`, '');
  out.push(
    table(
      [t('rec.field'), t('rec.value')],
      [
        [t('rec.runId'), rec.runId],
        [t('rec.status'), t(`status.${sja.status}`)],
        [t('rec.signedBy'), sja.signoff ? `${sja.signoff.role} · ${sja.signoff.at}` : '–'],
        [t('rec.template'), `${sja.templateId} · ${t('rec.packVersion')} ${sja.packVersion} · hash ${sja.packHash}`],
        [t('rec.mode'), modeLabel(sja, lang)],
        [t('rec.test'), [sja.testId, sja.fixtureId].filter(Boolean).join(' · ') || '–'],
        [t('rec.headerLocal'), `${sja.header.siteLabel || '–'} · ${sja.header.date || '–'} · ${sja.header.foremanRole || '–'}`],
        [t('rec.saved'), rec.savedAt],
      ],
    ),
    '',
  );
  out.push(`## ${t('rec.inputs')}`, '');
  out.push(`- ${t('rec.parameters')}: ${Object.entries(sja.parameterValues).map(([k, v]) => `${k} = ${v}`).join(', ')}`);
  out.push(`- ${t('rec.languages')}: ${langs.map((l) => LANG_NAMES[l]?.[lang] ?? l).join(', ')}`);
  out.push(`- ${t('rec.freeText')}: ${sja.freeText || '–'}`);
  if (sja.products?.length) out.push(`- ${t('s1.products')}: ${sja.products.map((id) => template?.products?.find((p) => p.productId === id)?.name[lang] ?? id).join(', ')}`);
  out.push(`- ${t('rec.specifics')}: ${sja.specifics.map((s) => s.text).join(' / ') || '–'}`);
  out.push(`- ${t('s1.newWorker')}: ${sja.crewFlags.newWorker ? t('common.yes') : t('common.no')}; ${t('s1.firstTime')}: ${sja.crewFlags.firstTimeJobType ? t('common.yes') : t('common.no')}`, '');
  const rr = reuseRate(sja);
  out.push(`${t('rec.reuseRate')}: ${rr.reused} ${t('common.of')} ${rr.total} ${t('rec.reuseLines')}`, '');
  const vr = unverifiedReuse(sja);
  out.push(`${t('rec.verifiedTemplate')}: ${vr.total === 0 ? '–' : vr.unverified === 0 ? t('common.yes') : t('rec.verifiedTemplateNo', { n: vr.total - vr.unverified, total: vr.total })}`, '');

  out.push(`## ${t('rec.lines')}`, '');
  out.push(
    table(
      ['#', t('rec.section'), t('rec.origin'), t('line.critical'), t('rec.norwegian'), t('line.source')],
      lines.map((l) => {
        const h = hazards?.entries.find((e) => e.hazardId === l.hazardRef);
        const src = h ? (h.sourceId === 'FIRMA' ? t('line.firmPractice') : `${hazards?.sources.find((x) => x.sourceId === h.sourceId)?.title.split(',')[0] ?? h.sourceId}${h.paragraph ? ` ${h.paragraph}` : `: ${h.sourceDetail}`}`) : t('line.unsourced');
        return [l.lineId, t(`section.${l.section}`), t(`origin.${l.origin}`), l.critical ? t('common.yes') : '', l.textNb + (l.removalReason ? ` (${t('rec.removalReason')}: ${l.removalReason})` : ''), src];
      }),
    ),
    '',
  );
  for (const l of langs) {
    const unsupported = sja.sjaFlags.some((f) => f.lang === l && f.type === 'UNSUPPORTED_LANGUAGE');
    out.push(`### ${LANG_NAMES[l]?.[lang] ?? l}`, '');
    if (unsupported) {
      out.push(t('rec.interpreterRequired'), '');
      continue;
    }
    out.push(table(['#', t('rec.text'), t('rec.state')], activeLines(sja).map((line) => [line.lineId, line.byLang[l]?.oralFallback ? `(${t('rec.oral')})` : (line.byLang[l]?.text ?? ''), lineLangLabel(line.byLang[l], lang)])), '');
  }

  out.push(`## ${t('rec.flags')}`, '');
  out.push(
    flags.length
      ? table(
          [t('flag.line'), t('rec.language'), t('rec.type'), t('rec.severity'), t('flag.raisedBy'), t('rec.route'), t('rec.resolvedBy'), t('rec.verdict'), t('rec.reason')],
          flags.map((r) => [
            r.flag.lineId,
            LANG_NAMES[r.lang]?.[lang] ?? r.lang,
            r.flag.type,
            r.flag.severity,
            r.flag.raisedBy,
            r.flag.route ? t(`route.${r.flag.route}`) : r.flag.status === 'open' ? t('rec.open') : t('flag.settled'),
            r.flag.resolvedBy ? t(`actor.${r.flag.resolvedBy}`) : '',
            r.flag.reviewerVerdict ? t(`verdict.${r.flag.reviewerVerdict.kind}`) : '',
            r.flag.reason ?? r.flag.reviewerVerdict?.reason ?? '',
          ]),
        )
      : t('rec.noFlags'),
    '',
  );
  const recheck = lines.filter((l) => l.techRecheck !== 'none');
  out.push(`${t('rec.techRecheck')}: ${recheck.length ? recheck.map((l) => `${l.lineId} (${t(`recheck.${l.techRecheck}`)})`).join(', ') : '–'}`, '');
  const oral = activeLines(sja).flatMap((line) => Object.entries(line.byLang).filter(([l, e]) => langs.includes(l) && e.oralFallback).map(([l]) => `${line.lineId} (${LANG_NAMES[l]?.[lang] ?? l}): ${line.textNb}`));
  out.push(`## ${t('rec.oralLines')}`, '', oral.length ? oral.map((o) => `- ${o}`).join('\n') : t('rec.none'), '');

  out.push(`## ${t('rec.understanding')}`, '');
  const lineText = (id: string) => `${id}: ${sja.lines.find((x) => x.lineId === id)?.textNb ?? ''}`;
  if (!u.required) out.push(t('rec.understandingNotRequired'), '');
  else {
    out.push(`${t('s5.why')}: ${u.reason.map((r) => t(`reason.${r}`)).join('; ')}. ${t('s5.respondents')}: ${u.respondents}. ${t('rec.noNames')}`, '');
    if (u.legacyTeachBack) out.push(`${t('rec.legacy')}${u.legacyTeachBack.length ? ` ${u.legacyTeachBack.map((x) => `${x.lineId}: ${t(`legacy.${x.outcome}`)}`).join('; ')}.` : ''}`, '');
    else {
      out.push(`${t('rec.teachBack')}: ${t('s5.teachCounts', { ok: u.teachBack.ok, rebriefed: u.teachBack.rebriefed })}`, '');
      out.push(`${t('s5.keyTitle')}:`, '', ...u.keyLineIds.map((id) => `- ${lineText(id)}`), '');
      if (u.misunderstood.length) out.push(`${t('s5.misunderstoodTitle')}:`, '', ...u.misunderstood.map((m) => `- ${lineText(m.lineId)} (${m.count})`), '');
    }
    if (u.paths) out.push(`${t('rec.paths')}: ${t('s5.pathCounts', { conversation: u.paths.conversation, written: u.paths.written, questionsOnly: u.paths.questionsOnly })}`, '');
    if (u.fallbackReasons && Object.keys(u.fallbackReasons).length) out.push(`${t('rec.reasons')}: ${Object.entries(u.fallbackReasons).map(([r, n]) => `${t(`reason.${r}`)} (${n})`).join('; ')}`, '');
    out.push(table([t('s5.questionTitle'), t('s5.rightFirst'), t('s5.rebrief')], u.perQuestion.filter((p) => p.respondents > 0).map((p) => [template?.questions.find((q) => q.questionId === p.questionId)?.byLang[lang === 'nb' ? 'nb' : 'en']?.text ?? p.questionId, `${p.correctFirst} ${t('common.of')} ${p.respondents}`, p.respondents - p.correctFirst > 0 ? (p.rebriefConfirmed ? t('rec.rebriefDone') : t('rec.open')) : '–'])), '');
    const o = sja.observation;
    out.push(`${t('rec.observation')}: ${!o && u.legacyTeachBack ? '–' : !o ? t('rec.observationPending') : o.lineIds.length === 0 ? `${t('obsv.none')} (${o.at})` : `${o.lineIds.length === 1 ? t('obsv.noted.one') : t('obsv.noted', { n: o.lineIds.length })} (${o.at})`}`, '');
    if (o?.lineIds.length) out.push(...o.lineIds.map((id) => `- ${lineText(id)}`), '');
    if (o?.notFollowed?.length) out.push(`${t('obsv.notFollowedTitle')}:`, '', ...o.notFollowed.map((id) => `- ${lineText(id)}`), '');
    out.push(t('rec.understandingNote'), '');
  }

  out.push(`## ${t('rec.timings')}`, '');
  const ordered = [...TOTAL_CATEGORIES, ...TIME_CATEGORIES.filter((c) => !TOTAL_CATEGORIES.includes(c))];
  out.push(table([t('rec.phase'), t('rec.category'), 'min:s'], ordered.map((c) => [t(`phase.${PHASE_OF[c]}`), t(`cat.${c}`), fmtDuration(rec.timings[c] ?? 0)])), '');
  const assists = rec.events.filter((e) => e.type === 'assist').length;
  out.push(`${t('rec.totalTime')}: ${fmtDuration(totalTime(rec.timings))}. ${t('rec.totalTimeNote')}`, '');
  out.push(`${t('rec.foremanTime')} (${FOREMAN_CATEGORIES.map((c) => t(`cat.${c}`)).join(' + ')}): ${fmtDuration(foremanTime(rec.timings))}.`, '');
  out.push(`${t('rec.withoutHelp')}: ${assists === 0 ? t('common.yes') : t('common.no')} (${t('rec.assists')}: ${assists}).`, '');

  if (rec.judgements) {
    const j = judgedCounts(sja, rec.judgements);
    out.push(`## ${t('rec.judgements')}`, '');
    out.push(`- ${t('rec.termAccuracy')}: ${j.termAccuracy.n} ${t('common.of')} ${j.termAccuracy.of}`);
    out.push(`- ${t('rec.residual')}: ${j.residualCritical.n} ${t('common.of')} ${j.residualCritical.of}`);
    out.push(`- ${t('rec.correctRoute')}: ${j.correctRoute.n} ${t('common.of')} ${j.correctRoute.of}`, '');
  }

  out.push(`## ${t('rec.versions')}`, '');
  out.push(table(['', t('rec.promptVersion'), t('rec.model')], Object.keys(sja.versions.prompts).sort().map((k) => [k, sja.versions.prompts[k], sja.versions.models[k]])), '');

  out.push(`## ${t('rec.trace')}`, '');
  for (const e of rec.trace) {
    const c = e.call;
    out.push(`${e.seq}. **[${e.kind}] ${e.title}**${e.detail ? ` — ${e.detail}` : ''}${c ? ` (prompt ${c.promptVersion}, ${c.model}, ${c.mode}${c.fixtureOrigin ? `:${c.fixtureOrigin}` : ''}, ${c.durationMs} ms)` : ''}`);
    if (c) out.push(`   - in: \`${JSON.stringify(c.input).slice(0, 600)}\``, `   - out: \`${c.rawOutput.replace(/\s+/g, ' ').slice(0, 600)}\``);
  }
  out.push('', `> ${lang === 'nb' ? BANNER_NB : BANNER_EN}`, '');
  return out.join('\n');
}

// ---------- Appendix A: exactly six columns (CR-14, AC-24) ----------

export const APPENDIX_A_COLUMNS = ['Number', 'Case type', 'Scenario or input', 'Expected outcome', 'Observed result', 'Learning or revision'];

export function testLogMarkdown(rows: TestLogRow[]): string {
  return [`> **${BANNER_EN}**`, '', '# Appendix A: test log', '', 'Observed results and learnings are typed by a person. The tool never fills them in.', '', table(APPENDIX_A_COLUMNS, rows.map((r) => [r.number, r.caseType, r.scenario, r.expected, r.observed, r.learning])), ''].join('\n');
}

export function testLogCsv(rows: TestLogRow[]): string {
  const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return [APPENDIX_A_COLUMNS.map(q).join(','), ...rows.map((r) => [r.number, r.caseType, r.scenario, r.expected, r.observed, r.learning].map(q).join(','))].join('\n') + '\n';
}

// ---------- Appendix B helpers: AI-use summary, prompts, verification ----------

export function aiUseSummary(records: RunRecord[], benchRuns: BenchRun[], config: ServerConfig | null, prompts: PromptFile[]): string {
  const rows = new Map<string, { task: string; promptVersion: string; model: string; mode: string; calls: number; first: string; last: string }>();
  for (const rec of records) {
    for (const e of rec.trace) {
      const c = e.call;
      if (!c) continue;
      const mode = c.mode === 'replay' ? `replay (${c.fixtureOrigin ?? 'recorded'})` : c.mode;
      const key = `${c.task}|${c.promptVersion}|${c.model}|${mode}`;
      const row = rows.get(key) ?? { task: c.task, promptVersion: c.promptVersion, model: c.model, mode, calls: 0, first: c.at, last: c.at };
      row.calls += 1;
      if (c.at < row.first) row.first = c.at;
      if (c.at > row.last) row.last = c.at;
      rows.set(key, row);
    }
  }
  const out = [`> **${BANNER_EN}**`, '', '# AI-use summary (for Appendix B)', ''];
  out.push(`Generated ${nowIso()}. Gateway mode now: ${config?.mode ?? '?'}${config?.mode !== 'replay' ? `, provider ${config?.provider}` : ''}.`, '');
  out.push('## Which step each model served', '');
  out.push(table(['Task', 'What it does', 'Capability', 'Prompt file', 'Prompt version'], prompts.map((p) => [p.id, p.title, p.capability, `prompts/${p.file}`, p.version])), '');
  out.push('## Model calls in the saved runs', '');
  out.push(
    rows.size
      ? table(['Task', 'Prompt version', 'Model', 'Mode', 'Calls', 'First use', 'Last use'], [...rows.values()].sort((a, b) => a.task.localeCompare(b.task)).map((r) => [r.task, r.promptVersion, r.model, r.mode, r.calls, r.first, r.last]))
      : 'No saved runs with model calls yet.',
    '',
  );
  out.push('Rows with mode "replay (scripted)" are not model output. They are stored answers written by the builder so the prototype can be shown without an API key. They are not evidence.', '');
  if (config && config.mode !== 'replay' && config.backTranslationUsesSameModel) {
    out.push('Limitation: back-translation (P5) used the same model as translation (P4), in a separate call that never receives the source text.', '');
  }
  out.push('## Test-bench runs', '');
  out.push(benchRuns.length ? table(['When', 'Kind', 'Languages', 'Pack version', 'Prompt versions', 'Mode', 'Response origins'], benchRuns.map((b) => [b.at, b.kind, b.langs.join(', '), b.packVersion, Object.entries(b.promptVersions).map(([k, v]) => `${k} ${v}`).join(', '), b.mode, b.origins.join(', ') || 'none (rules only)'])) : 'None yet.', '');
  out.push('## How outputs were checked', '', '- Every model output is validated against a schema; one retry, then a visible error.', '- Deterministic rules D1 (glossary), D2 (numbers) and D4 (language support) run in code and cannot be overridden by a model.', '- A person resolves every flag, confirms the Norwegian content and signs. Reviewer keys are recorded per item.', '');
  return out.join('\n');
}

export function promptsExport(prompts: PromptFile[], changelog: string): string {
  return [`> **${BANNER_EN}**`, '', '# Prompts as used (for Appendix B)', '', ...prompts.flatMap((p) => [`## ${p.id} – ${p.title} (version ${p.version})`, '', `File: prompts/${p.file}`, '', '```', p.raw.trim(), '```', '']), changelog].join('\n');
}

export function verificationSummaryMarkdown(pack: DataPack, events: LogEvent[] = []): string {
  const { rows, counts } = verificationSummary(pack);
  const out = [`> **${BANNER_EN}**`, '', '# Verification summary', '', `Data pack version ${pack.version}, hash ${pack.hash}. Generated ${nowIso()}.`, ''];
  out.push('"Verified" means both keys exist. The language key: a language reviewer, who speaks Norwegian and the crew language and knows construction terms, confirms that each line says the same in both languages. The technical key: a technical reviewer (the foreman or the firm\'s HMS lead) confirms that the hazards and measures fit the job and that the Norwegian is not ambiguous. A template counts as verified only when both reviewers have approved it; the foreman then signs each job\'s SJA. A key held by a group member is valid but is not an outside perspective.', '');
  out.push('## States', '');
  out.push(table(['Items', 'Draft', 'Language-checked', 'Technically checked', 'Verified'], Object.entries(counts).map(([k, c]) => [k, c.draft, c.languageChecked, c.technicallyChecked, c.verified])), '');
  out.push('## Who holds which key', '');
  out.push(rows.length ? table(['Kind', 'Item', 'Language', 'Key', 'Outside the group', 'Date'], rows.map((r) => [r.kind, r.id, r.lang, r.role, r.outsideGroup ? 'yes' : 'no', r.date])) : 'No keys have been given. Every item is a draft.', '');
  const outside = rows.filter((r) => r.outsideGroup).length;
  out.push(`Keys given by someone outside the group: ${outside} of ${rows.length}.`, '');
  out.push('## Misunderstandings fed back from use', '');
  out.push('Points a worker got wrong in the teach-back, or that the foreman saw misunderstood when the job started. Logged without names, per template line, on this device.', '');
  const fed = misunderstandingCounts(feedbackEvents(events, useSjas.getState().sjas));
  const fedRows = Object.entries(fed).flatMap(([templateId, byLine]) => Object.entries(byLine).map(([lineId, n]) => [templateId, lineId, lineId === 'job-specific' ? '(lines written for one job, not in the template)' : (pack.templates.find((t) => t.templateId === templateId)?.lines.find((l) => l.lineId === lineId)?.textNb ?? ''), n]));
  out.push(fedRows.length ? table(['Template', 'Line', 'Norwegian text', 'Times misunderstood'], fedRows) : 'None logged.', '');
  return out.join('\n');
}

export function benchMarkdown(run: BenchRun, fixtures: PairFixture[], confirmed: boolean): string {
  const replay = run.mode === 'replay';
  const out = [`> **${BANNER_EN}**`, '', `# Test bench result: ${run.kind}`, ''];
  if (replay) out.push(`> **REPLAY – NOT A TEST RESULT.** The back-translation and comparison answers came from stored responses (${run.origins.join(', ')}). Only the rules layer (D1, D2, D4) was computed. Do not report these counts.`, '');
  if (!confirmed) out.push('> **Unconfirmed fixtures.** No native speaker has confirmed the seeded errors and the controls yet.', '');
  out.push(`Run ${run.benchId} at ${run.at}. Data pack version ${run.packVersion} (hash ${run.packHash}). Prompt versions: ${Object.entries(run.promptVersions).map(([k, v]) => `${k} ${v}`).join(', ')}. Mode: ${run.mode}.`, '');
  for (const lang of run.langs) {
    const s = benchSummary(fixtures, run.results, lang);
    out.push(`## ${LANG_NAMES[lang]?.en ?? lang}`, '');
    out.push(`- Seeded errors flagged, rules alone (D1, D2): ${s.caughtRulesOnly} of ${s.seeded}`);
    out.push(`- Seeded errors flagged, rules plus back-translation: ${s.caughtAll} of ${s.seeded}`);
    out.push(`- Non-glossary errors flagged: ${s.nonGlossaryCaught} of ${s.nonGlossary}`);
    out.push(`- Controls flagged red: ${s.controlsFlaggedRed} of ${s.controls}`);
    out.push(`- False flags (controls flagged red, plus pairs with a reviewer false-alarm verdict): ${s.falseFlags}`);
    out.push(`- Missed: ${s.missed.join(', ') || 'none'}`, '');
    out.push(table(['Pair', 'Kind', 'Seeded error', 'Source', 'Target', 'Back-translation', 'Flags (type, layer)'], fixtures.filter((f) => f.lang === lang).map((f) => [f.id, f.kind, f.errorType ?? '', f.source, f.target, run.results[f.id]?.backTranslation ?? '', (run.results[f.id]?.flags ?? []).map((x) => `${x.type} ${x.raisedBy}${x.reviewerVerdict ? ` [${x.reviewerVerdict.kind}]` : ''}`).join('; ') || (run.results[f.id]?.error ? `ERROR: ${run.results[f.id]?.error}` : 'none')])), '');
  }
  return out.join('\n');
}
