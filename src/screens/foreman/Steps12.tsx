// Foreman wizard, steps 1 (Job) and 2 (Understood).
import { useEffect, useMemo, useState } from 'react';
import { ActionBar, Button, Card, Chip, ErrorBox, Field, Icon, inputClass, Notice, Spinner } from '../../components/ui';
import { GhsRow } from '../../components/Ghs';
import { HelpEn } from '../../components/HelpEn';
import { PrivacyPanel } from '../../components/Privacy';
import * as flow from '../../core/flow';
import { buildP1 } from '../../core/rules/payload';
import { api } from '../../api';
import { isSupported } from '../../core/rules/languages';
import type { DataPack, Sja, Template } from '../../core/types';
import { LANG_NAMES } from '../../core/util';
import { useT, useUiLang } from '../../i18n';
import { useApp, useFieldMode, useSjas } from '../../state/stores';
import type { useWizard } from './useWizard';

type Wizard = ReturnType<typeof useWizard>;
// Languages with no glossary column: the tool says "interpreter required" (T4). Russian is supported since 26 Oct 2026.
const OTHER_LANGS = ['ro', 'uk', 'tr'];
const today = () => new Date().toISOString().slice(0, 10);

interface Form {
  templateId: string;
  parameterValues: Record<string, number | string>;
  freeText: string;
  languages: string[];
  crewFlags: { newWorker: boolean; firstTimeJobType: boolean };
  /** Products for today's job (K1), for templates that list products. */
  products?: string[];
  header: Sja['header'];
  fixtureId?: string;
}

const defaults = (t: Template) => Object.fromEntries(t.parameters.map((p) => [p.key, p.default]));

const draftKey = (sjaId: string) => `sja-forstatt-draft-${sjaId}`;
/** The half-filled form survives a reload of the page. Kept in this tab only; nothing leaves the device. */
function readDraft(sjaId: string): Form | null {
  try {
    const raw = sessionStorage.getItem(draftKey(sjaId));
    return raw ? (JSON.parse(raw) as Form) : null;
  } catch {
    return null;
  }
}
function writeDraft(sjaId: string, form: Form | null) {
  try {
    if (form) sessionStorage.setItem(draftKey(sjaId), JSON.stringify(form));
    else sessionStorage.removeItem(draftKey(sjaId));
  } catch {
    /* storage blocked or full: the form still works, it just does not survive a reload */
  }
}

function initialForm(pack: DataPack, sja: Sja | undefined, fixture: any | undefined): Form {
  if (sja) {
    return { templateId: sja.templateId, parameterValues: sja.parameterValues, freeText: sja.freeText, languages: sja.languages, crewFlags: sja.crewFlags, products: sja.products ?? [], header: sja.header, fixtureId: sja.fixtureId };
  }
  const header = { siteLabel: '', date: today(), foremanRole: 'Bas' };
  if (fixture) {
    return { templateId: fixture.templateId, parameterValues: fixture.parameterValues, freeText: fixture.freeText, languages: fixture.languages, crewFlags: fixture.crewFlags, products: fixture.products ?? [], header, fixtureId: fixture.id };
  }
  const t = pack.templates[0];
  return { templateId: t.templateId, parameterValues: defaults(t), freeText: '', languages: [], crewFlags: { newWorker: false, firstTimeJobType: false }, products: [], header };
}

export function Step1({ w, sjaId, pack, testId, fixtureId }: { w: Wizard; sjaId: string; pack: DataPack; testId?: string; fixtureId?: string }) {
  const t = useT();
  const clean = useFieldMode();
  const ui = useUiLang();
  const config = useApp((s) => s.config);
  const jobs = (useApp((s) => s.fixtures)?.['job-descriptions'] ?? []) as any[];
  const [form, setForm] = useState<Form>(() => (!w.sja && readDraft(sjaId)) || initialForm(pack, w.sja, jobs.find((j) => j.id === fixtureId)));
  // Only a form that has not become an SJA yet is kept as a draft.
  const hasSja = Boolean(w.sja);
  useEffect(() => {
    if (!hasSja) writeDraft(sjaId, form);
  }, [sjaId, form, hasSja]);
  const template = pack.templates.find((x) => x.templateId === form.templateId) ?? pack.templates[0];
  const [touched, setTouched] = useState(false);

  const paramErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const p of template.parameters) {
      if (p.type !== 'number') continue;
      const v = Number(form.parameterValues[p.key]);
      if (!Number.isFinite(v) || form.parameterValues[p.key] === '' || v < p.min || v > p.max) errs[p.key] = t('s1.range', { min: p.min, max: p.max, unit: p.unitSymbol });
    }
    return errs;
  }, [form.parameterValues, template, t]);
  const noLang = form.languages.length === 0;
  const valid = Object.keys(paramErrors).length === 0 && !noLang && form.freeText.length <= 600;

  const loadFixture = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return setForm((f) => ({ ...f, fixtureId: undefined }));
    setForm((f) => ({ ...f, templateId: job.templateId, parameterValues: job.parameterValues, freeText: job.freeText, languages: job.languages, crewFlags: job.crewFlags, products: job.products ?? [], fixtureId: job.id }));
  };
  const setTemplate = (id: string) => {
    const tpl = pack.templates.find((x) => x.templateId === id)!;
    setForm((f) => ({ ...f, templateId: id, parameterValues: defaults(tpl), products: [], fixtureId: undefined }));
  };
  const toggleProduct = (id: string) =>
    setForm((f) => {
      const cur = f.products ?? [];
      const products = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // A demo job's stored answers only fit its own products.
      const job = jobs.find((j) => j.id === f.fixtureId);
      const same = job && JSON.stringify([...(job.products ?? [])].sort()) === JSON.stringify([...products].sort());
      return { ...f, products, fixtureId: same ? f.fixtureId : undefined };
    });
  const toggleLang = (l: string) => setForm((f) => ({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l] }));

  const submit = async () => {
    setTouched(true);
    if (!valid) {
      // Show the first thing that needs fixing, instead of leaving the user to look for it.
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      return;
    }
    const values = Object.fromEntries(template.parameters.map((p) => [p.key, p.type === 'number' ? Number(form.parameterValues[p.key]) : String(form.parameterValues[p.key])]));
    const products = (form.products ?? []).filter((id) => template.products?.some((p) => p.productId === id));
    const init: flow.SjaInit = { header: form.header, parameterValues: values, freeText: form.freeText.trim(), languages: form.languages, crewFlags: form.crewFlags, products, testId: w.sja?.testId ?? testId, fixtureId: form.fixtureId, cleanView: clean || w.sja?.cleanView };
    const old = w.sja;
    const unchanged =
      old &&
      old.templateId === template.templateId &&
      JSON.stringify([old.parameterValues, old.freeText, old.languages, old.crewFlags, old.products ?? []]) === JSON.stringify([init.parameterValues, init.freeText, init.languages, init.crewFlags, init.products ?? []]);
    if (old && unchanged && (old.specifics.length > 0 || old.specificsConfirmed || !old.freeText)) {
      useSjas.getState().put({ ...old, header: form.header, step: 2 });
      return;
    }
    const fresh = flow.createSja(pack, template, init, sjaId);
    fresh.assists = old?.assists ?? 0;
    useSjas.getState().put(fresh);
    writeDraft(sjaId, null);
    await w.act('normalise', (ctx, s) => flow.runNormalise(ctx, s), { machine: true, from: fresh });
  };

  const replayLabel = (j: any) => (j.replay === 'scripted' ? t('s1.fxStored') : j.replay === 'no-model' ? t('s1.fxNoModel') : t('s1.fxLive'));

  const replay = config?.mode === 'replay';
  const ownText = replay && !form.fixtureId && form.freeText.trim().length > 0;
  const otherPicked = form.languages.some((l) => OTHER_LANGS.includes(l));
  const heading = (n: number, text: string) => (
    <h2 className="flex items-center gap-2 text-base font-bold">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">{n}</span>
      {text}
    </h2>
  );
  const langBox = (l: string) => {
    const supported = isSupported(l, pack);
    return (
      <label key={l} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
        <input type="checkbox" className="h-5 w-5" checked={form.languages.includes(l)} onChange={() => toggleLang(l)} data-testid={`lang-${l}`} />
        <span className="text-base">
          {LANG_NAMES[l]?.[ui] ?? l}
          {!supported && <span className="block text-xs font-semibold text-rose-800">{t('s1.unsupported')}</span>}
        </span>
      </label>
    );
  };

  return (
    <div className="space-y-4">
      <Card tone={replay ? 'blue' : 'quiet'} className="space-y-2">
        <Field label={replay ? t('s1.demoTitle') : t('s1.loadFixture')} hint={replay ? t('s1.demoHint') : t('s1.loadFixtureHint')}>
          <select className={inputClass} value={form.fixtureId ?? ''} onChange={(e) => loadFixture(e.target.value)} data-testid="fixture-select">
            <option value="">{replay ? t('s1.demoPick') : t('s1.noFixture')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id} disabled={replay && j.replay === 'live-only'}>
                {j.id}: {j.title[ui]}
                {replay ? (j.replay === 'live-only' ? ` – ${t('s1.fxLive')}` : '') : ` [${replayLabel(j)}]`}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        {heading(1, t('s1.groupJob'))}
        <Field label={t('s1.jobType')} hint={t('s1.jobTypeHint')}>
          <select className={inputClass} value={form.templateId} onChange={(e) => setTemplate(e.target.value)} data-testid="jobtype-select">
            {pack.templates.map((tpl) => (
              <option key={tpl.templateId} value={tpl.templateId}>
                {tpl.jobType[ui] ?? tpl.jobType.nb}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          {template.parameters.map((p) => (
            <Field key={p.key} label={`${p.label[ui] ?? p.label.nb}${p.type === 'number' ? ` (${p.unitSymbol})` : ''}`} error={touched ? paramErrors[p.key] : undefined}>
              {p.type === 'number' ? (
                <input
                  className={inputClass}
                  type="number"
                  inputMode="decimal"
                  min={p.min}
                  max={p.max}
                  value={form.parameterValues[p.key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, parameterValues: { ...f.parameterValues, [p.key]: e.target.value === '' ? '' : Number(e.target.value) } }))}
                  data-testid={`param-${p.key}`}
                />
              ) : (
                <select className={inputClass} value={String(form.parameterValues[p.key] ?? p.default)} onChange={(e) => setForm((f) => ({ ...f, parameterValues: { ...f.parameterValues, [p.key]: e.target.value } }))} data-testid={`param-${p.key}`}>
                  {p.options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label[ui] ?? o.label.nb}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </div>

        {template.products && template.products.length > 0 && (
          <fieldset className="space-y-2" data-testid="products">
            <legend className="mb-1 text-sm font-semibold text-slate-800">{t('s1.products')}</legend>
            <p className="text-sm text-slate-600">{t('s1.productsHint')}</p>
            {template.products.map((p) => (
              <label key={p.productId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={(form.products ?? []).includes(p.productId)} onChange={() => toggleProduct(p.productId)} data-testid={`product-${p.productId}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base">{p.name[ui] ?? p.name.nb}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <GhsRow codes={p.ghs} lang={ui} size={30} />
                    <span className="text-xs text-slate-600">{p.hCodes.length ? p.hCodes.join(', ') : t('s1.productNoClass')}</span>
                  </span>
                </span>
              </label>
            ))}
            <p className="text-xs text-slate-600">{t('s1.productsSynthetic')}</p>
          </fieldset>
        )}
      </Card>

      <Card className="space-y-4">
        {heading(2, t('s1.groupCrew'))}
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-slate-800">{t('s1.languages')}</legend>
          <p className="mb-2 text-sm text-slate-600">{t('s1.languagesHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">{pack.languages.map(langBox)}</div>
          <details className="mt-2" open={otherPicked || undefined}>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-800">{t('s1.otherLanguages')}</summary>
            <div className="grid gap-2 sm:grid-cols-2">{OTHER_LANGS.map(langBox)}</div>
          </details>
          {touched && noLang && <p className="mt-1 text-sm font-semibold text-rose-800" data-field-error>{t('s1.pickLanguage')}</p>}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-slate-800">{t('s1.crew')}</legend>
          <p className="mb-2 text-sm text-slate-600">{t('s1.crewHint')}</p>
          {(['newWorker', 'firstTimeJobType'] as const).map((k) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
              <input type="checkbox" className="h-5 w-5" checked={form.crewFlags[k]} onChange={(e) => setForm((f) => ({ ...f, crewFlags: { ...f.crewFlags, [k]: e.target.checked } }))} data-testid={`crew-${k}`} />
              <span className="text-base">{t(k === 'newWorker' ? 's1.newWorker' : 's1.firstTime')}</span>
            </label>
          ))}
        </fieldset>
      </Card>

      <Card className="space-y-3">
        {heading(3, t('s1.specifics'))}
        <Field label={t('s1.specificsLabel')} hint={`${form.freeText.length} / 600`} error={form.freeText.length > 600 ? t('s1.tooLong') : undefined}>
          <textarea className={inputClass} rows={4} maxLength={600} value={form.freeText} onChange={(e) => setForm((f) => ({ ...f, freeText: e.target.value, fixtureId: f.fixtureId && jobs.find((j) => j.id === f.fixtureId)?.freeText === e.target.value ? f.fixtureId : undefined }))} placeholder={t('s1.specificsPlaceholder')} data-testid="free-text" />
        </Field>
        {form.freeText.trim() && <HelpEn nb={form.freeText.trim()} />}
        <Notice tone="amber">
          <Icon name="warn" className="mr-1 h-4 w-4" />
          {t('s1.noNames')}
        </Notice>
        {ownText && <Notice tone="violet">{t('s1.replayNotice')}</Notice>}
      </Card>

      <Card tone="quiet" className="space-y-3">
        {heading(4, t('s1.groupRecord'))}
        <p className="flex items-start gap-2 text-sm text-slate-800">
          <Icon name="lock" /> {t('s1.headerNote')}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('s1.site')}>
            <input className={inputClass} value={form.header.siteLabel} onChange={(e) => setForm((f) => ({ ...f, header: { ...f.header, siteLabel: e.target.value } }))} data-testid="header-site" />
          </Field>
          <Field label={t('s1.date')}>
            <input className={inputClass} type="date" value={form.header.date} onChange={(e) => setForm((f) => ({ ...f, header: { ...f.header, date: e.target.value } }))} />
          </Field>
          <Field label={t('s1.role')}>
            <input className={inputClass} value={form.header.foremanRole} onChange={(e) => setForm((f) => ({ ...f, header: { ...f.header, foremanRole: e.target.value } }))} data-testid="header-role" />
          </Field>
        </div>
      </Card>

      <PrivacyPanel compact testid="privacy-step1" />

      {w.busy && <Spinner label={t('busy.normalise')} />}
      {w.error && <ErrorBox message={w.error.message} onRetry={w.error.retry} retryLabel={t('common.retry')} />}
      <ActionBar note={touched && !valid ? <span className="font-semibold text-rose-900">{t('s1.fixAbove')}</span> : undefined}>
        <Button variant="primary" className="w-full" disabled={Boolean(w.busy)} onClick={submit} data-testid="step1-continue">
          {t('s1.continue')} <Icon name="arrow" />
        </Button>
      </ActionBar>
    </div>
  );
}

/** Every combination of the options of these questions (at most 64). */
function combos(questions: Sja['questions']): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const q of questions) out = out.flatMap((c) => q.options.map((o) => ({ ...c, [q.id]: o }))).slice(0, 64);
  return out;
}

export function Step2({ w }: { w: Wizard }) {
  const t = useT();
  const sja = w.sja!;
  const pack = useApp((s) => s.pack);
  const replay = useApp((s) => s.config?.mode === 'replay');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<{ text: string; before: Sja } | null>(null);
  const blockers = flow.specificsBlockers(sja);
  const open = sja.questions.filter((q) => !q.answer);
  const allDrafted = open.length > 0 && open.every((q) => (drafts[q.id] ?? '').trim());

  // Demo mode answers only what was stored. Find out which combinations of answers have a stored
  // answer, so the others are greyed out instead of failing after the foreman picks one.
  const openKey = open.map((q) => q.id).join('|');
  const [answerable, setAnswerable] = useState<Record<string, string>[] | null>(null);
  useEffect(() => {
    setAnswerable(null);
    const template = pack?.templates.find((x) => x.templateId === sja.templateId);
    if (!replay || !template || open.length === 0) return;
    const all = combos(open);
    const inputs = all.map((c) => buildP1(open.reduce((s, q) => flow.answerQuestion(s, q.id, c[q.id]), sja), template));
    let live = true;
    api
      .available(inputs.map((input) => ({ task: 'P1' as const, input })))
      .then((r) => live && setAnswerable(all.filter((_, i) => r.available[i])))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, openKey, sja.sjaId, pack]);
  const canPick = (qid: string, option: string) =>
    !answerable || answerable.some((c) => c[qid] === option && open.every((q) => q.id === qid || !drafts[q.id] || c[q.id] === drafts[q.id]));
  const friendly = (m: string) => (/no stored response/i.test(m) ? t('s2.noStored') : m);

  const sendAnswers = async () => {
    setRemoved(null);
    let next = sja;
    for (const q of open) next = flow.answerQuestion(next, q.id, drafts[q.id] ?? '');
    useSjas.getState().put(next);
    await w.act('normalise', (ctx, s) => flow.runNormalise(ctx, s), { machine: true, from: next });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{t('s2.title')}</h2>
        {sja.specifics.length === 0 && open.length === 0 ? (
          <p className="text-base text-slate-700">{sja.freeText ? t('s2.none') : t('s2.noFreeText')}</p>
        ) : (
          <ul className="space-y-2" data-testid="specifics">
            {sja.specifics.map((s, i) => (
              <li key={`${i}-${s.text}`} className={`flex items-start gap-2 rounded-lg border p-2 ${s.status === 'unclear' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <Icon name={s.status === 'unclear' ? 'warn' : 'check'} className={`mt-1 h-5 w-5 ${s.status === 'unclear' ? 'text-amber-800' : 'text-emerald-800'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-base">{s.text}</p>
                  <HelpEn nb={s.text} />
                  {s.status === 'unclear' && <Chip tone="amber">{t('s2.unclear')}</Chip>}
                </div>
                <Button variant="ghost" className="shrink-0 !px-2" onClick={async () => { const before = sja; if (await w.act('remove', (ctx, cur) => flow.removeSpecific(ctx, cur, i))) setRemoved({ text: s.text, before }); }} aria-label={`${t('s2.remove')}: ${s.text}`} data-testid={`remove-specific-${i}`}>
                  {t('s2.remove')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {removed && (
        <Notice tone="amber">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t('s2.removed')}: «{removed.text}»
            </span>
            <button type="button" className="rounded px-2 py-1 font-semibold text-blue-800 underline" onClick={() => { useSjas.getState().put(removed.before); setRemoved(null); }} data-testid="undo-remove-specific">
              {t('s2.undo')}
            </button>
          </span>
        </Notice>
      )}

      {open.length > 0 && (
        <Card tone="amber" className="space-y-4">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Icon name="info" /> {t('s2.questionsTitle')}
          </h3>
          <p className="text-sm text-slate-700">{t('s2.questionsHint')}</p>
          {replay && answerable && open.some((q) => q.options.some((o) => !canPick(q.id, o))) && <p className="text-sm text-slate-700">{t('s2.demoOptions')}</p>}
          {open.map((q, qi) => (
            <div key={q.id} className="space-y-2" data-testid={`question-${qi}`}>
              <p className="text-base font-semibold">{q.question}</p>
              <HelpEn nb={q.question} />
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <Button key={o} variant={drafts[q.id] === o ? 'primary' : 'secondary'} aria-pressed={drafts[q.id] === o} disabled={!canPick(q.id, o)} title={canPick(q.id, o) ? undefined : t('s2.notInDemo')} onClick={() => setDrafts((d) => ({ ...d, [q.id]: o }))} data-testid={`option-${qi}-${q.options.indexOf(o)}`}>
                    <span>
                      {o}
                      <HelpEn nb={o} />
                      {!canPick(q.id, o) && <span className="block text-xs font-normal">{t('s2.notInDemo')}</span>}
                    </span>
                  </Button>
                ))}
              </div>
              {!replay && <input className={inputClass} placeholder={t('s2.ownAnswer')} value={q.options.includes(drafts[q.id] ?? '') ? '' : (drafts[q.id] ?? '')} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} />}
            </div>
          ))}
          <Button variant="primary" disabled={!allDrafted || Boolean(w.busy)} onClick={sendAnswers} data-testid="send-answers">
            {t('s2.sendAnswers')}
          </Button>
        </Card>
      )}

      {sja.questions.some((q) => q.answer) && (
        <Card tone="quiet">
          <h3 className="text-sm font-bold">{t('s2.answered')}</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {sja.questions
              .filter((q) => q.answer)
              .map((q) => (
                <li key={q.id}>
                  {q.question} <strong>{q.answer}</strong>
                  <HelpEn nb={q.question} />
                  <HelpEn nb={q.answer ?? ''} />
                </li>
              ))}
          </ul>
          <Button variant="ghost" className="mt-1 !px-0 text-sm" disabled={Boolean(w.busy)} onClick={() => { w.setError(null); useSjas.getState().put(flow.clearAnswers(sja)); setDrafts({}); }} data-testid="change-answers">
            {t('s2.changeAnswers')}
          </Button>
        </Card>
      )}

      {(blockers.openQuestions > 0 || blockers.unclear > 0) && (
        <Notice tone="amber">
          {t('s2.blocked')}
          {blockers.unclear > 0 && open.length === 0 ? ` ${t('s2.removeUnclear')}` : ''}
        </Notice>
      )}
      {w.busy && <Spinner label={w.busy === 'adapt' ? t('busy.adapt') : t('busy.normalise')} />}
      {w.error && <ErrorBox message={friendly(w.error.message)} onRetry={/no stored response/i.test(w.error.message) ? undefined : w.error.retry} retryLabel={t('common.retry')} />}
      <ActionBar>
        <Button onClick={() => w.goStep(1)} disabled={Boolean(w.busy)}>
          {t('common.back')}
        </Button>
        <Button variant="primary" className="flex-1" disabled={Boolean(w.busy) || blockers.openQuestions > 0 || blockers.unclear > 0} onClick={() => w.act('adapt', (ctx, s) => flow.runAdapt(ctx, s), { machine: true })} data-testid="confirm-specifics">
          {t('s2.confirm')} <Icon name="arrow" />
        </Button>
      </ActionBar>
    </div>
  );
}
