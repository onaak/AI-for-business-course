// Foreman wizard, steps 5 (Understanding) and 6 (Sign), and what follows the signature.
//
// Step 5 follows service brief v3: understanding is "not a signature or a quiz score".
// Each worker explains the key hazard and the safety measure in their own words and
// answers one "what do you do if …" question. After signing, the foreman watches the
// start of the job and notes anything misunderstood.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GateChecklist } from '../../components/sja';
import { HelpEn } from '../../components/HelpEn';
import { KeyPoints, TeachBackJudge, type TeachBackResult } from '../../components/TeachBack';
import { ActionBar, Button, Card, Chip, ErrorBox, Field, Icon, inputClass, Notice } from '../../components/ui';
import { activeLines, allFlags, isBlocking } from '../../core/flags';
import * as flow from '../../core/flow';
import { supportedLangs } from '../../core/rules/diff';
import { canSign, gateConditions, hasFallback } from '../../core/rules/gate';
import { linesForQuestion, nextQuestionIds } from '../../core/rules/understanding';
import type { DataPack, Question, Sja, SjaLine, Template } from '../../core/types';
import { uid } from '../../core/util';
import { useT, useUiLang } from '../../i18n';
import { useApp, useSjas } from '../../state/stores';
import { timing } from '../../state/timing';
import { observationUnsaved, saveRun, type useWizard } from './useWizard';

type Wizard = ReturnType<typeof useWizard>;

function HowRow({ n, title, text, done }: { n: number; title: string; text: string; done?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-800'}`}>{done ? <Icon name="check" className="h-4 w-4" /> : n}</span>
      <span className="min-w-0">
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-sm text-slate-700">{text}</span>
      </span>
    </li>
  );
}

/** A worker checked at the briefing, without the phone: the foreman records the explanation and the answer. */
function OralCheck({ lines, question, onSave, onCancel, sja }: { sja: Sja; lines: SjaLine[]; question?: Question; onSave: (r: TeachBackResult, answers: { questionId: string; correct: boolean }[]) => void; onCancel: () => void }) {
  const t = useT();
  const ui = useUiLang();
  const [teach, setTeach] = useState<TeachBackResult | null>(null);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const q = question?.byLang[ui === 'nb' ? 'nb' : 'en'] ?? question?.byLang.nb;
  return (
    <div className="space-y-3 rounded-xl border-2 border-slate-300 bg-slate-50 p-3" data-testid="oral-check">
      <p className="text-base font-bold">{t('s5.oralTitle')}</p>
      <p className="text-sm text-slate-700">{t('s5.oralHint')}</p>
      <p className="text-sm font-bold">1. {t('s5.how1')}</p>
      {teach === null ? (
        <TeachBackJudge lines={lines} onDone={setTeach} sja={sja} />
      ) : (
        <Chip tone="green">
          <Icon name="check" className="h-3 w-3" /> {t(`teach.${teach.teachBack}`)}
        </Chip>
      )}
      {teach && question && q && (
        <div className="space-y-2">
          <p className="text-sm font-bold">2. {t('s5.oralAsk')}</p>
          <p className="rounded-lg border border-slate-300 bg-white p-2 text-base font-semibold">{q.text}</p>
          <p className="text-sm">
            {t('s5.oralRight')}: <strong>{q.options[question.correctIndex]}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={answer === true ? 'success' : 'secondary'} aria-pressed={answer === true} onClick={() => setAnswer(true)} data-testid="oral-answer-right">
              {t('s5.oralAnsweredRight')}
            </Button>
            <Button variant={answer === false ? 'primary' : 'secondary'} aria-pressed={answer === false} onClick={() => setAnswer(false)} data-testid="oral-answer-wrong">
              {t('s5.oralAnsweredWrong')}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!teach || (Boolean(question && q) && answer === null)} onClick={() => teach && onSave(teach, question && q && answer !== null ? [{ questionId: question.questionId, correct: answer }] : [])} data-testid="oral-save">
          {t('s5.oralSave')}
        </Button>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </div>
  );
}

export function Step5({ w, template, pack }: { w: Wizard; template: Template; pack: DataPack }) {
  const t = useT();
  const ui = useUiLang();
  const navigate = useNavigate();
  const sja = w.sja!;
  const u = sja.understanding;
  const langs = supportedLangs(sja, pack);
  const [oral, setOral] = useState(false);

  if (!u.required) {
    return (
      <div className="space-y-4">
        <Card tone="green">
          <p className="text-base font-semibold" data-testid="understanding-not-required">{t('s5.notRequired')}</p>
          <p className="mt-1 text-sm text-slate-700">{t('s5.notRequiredWhy')}</p>
        </Card>
        <ActionBar>
          <Button onClick={() => w.goStep(4)}>{t('common.back')}</Button>
          <Button variant="primary" className="flex-1" onClick={() => w.goStep(6)} data-testid="step5-continue">
            {t('s4.toSign')}
          </Button>
        </ActionBar>
      </div>
    );
  }

  const keyLines = u.keyLineIds.map((id) => sja.lines.find((l) => l.lineId === id)).filter((l): l is SjaLine => Boolean(l));
  // The oral check asks the question the fewest workers have answered so far (Q3).
  const question = template.questions.find((q) => q.questionId === nextQuestionIds(u, template, null)[0]);
  const paths = u.paths;
  const todays = sja.lines.some((l) => l.origin !== 'removed' && l.critical && (l.origin === 'changed' || l.origin === 'new'));
  const rebriefOpen = u.perQuestion.filter((p) => p.respondents - p.correctFirst > 0 && !p.rebriefConfirmed).length;

  const langSet = new Set(langs);
  const masked = allFlags(sja).filter((r) => r.line && langSet.has(r.lang as never) && isBlocking(r.flag, Boolean(r.line.critical))).length;
  const showRebrief = () => document.querySelector('[data-rebrief-open="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="space-y-4">
      {u.recheck && (
        <Notice tone="amber">
          <strong>{t('s5.recheckTitle')}</strong> {t('s5.recheckText')}
        </Notice>
      )}

      <Card tone={u.respondents > 0 ? 'green' : 'plain'} className="space-y-3">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{t('s5.why')}:</span> {u.reason.map((r) => t(`reason.${r}`)).join('; ')}.
        </p>
        <div>
          <p className="text-lg font-bold" data-testid="respondent-count">
            {t('s5.respondents')}: {u.respondents}
          </p>
          {u.respondents > 0 && (
            <p className="text-sm text-slate-800" data-testid="teach-counts">
              {t('s5.teachCounts', { ok: u.teachBack.ok, rebriefed: u.teachBack.rebriefed })}
            </p>
          )}
          {paths && u.respondents > 0 && (
            <p className="text-sm text-slate-800" data-testid="path-counts">
              {t('s5.pathCounts', { conversation: paths.conversation, written: paths.written, questionsOnly: paths.questionsOnly })}
            </p>
          )}
          {paths && paths.questionsOnly > 0 && <p className="mt-1 text-sm font-semibold text-amber-950">{t('s5.questionsOnlyNote')}</p>}
        </div>
        <Button variant="primary" className="w-full" disabled={langs.length === 0} onClick={() => navigate(`/worker/${sja.sjaId}`)} data-testid="start-kiosk">
          {u.respondents === 0 ? t('s5.startKiosk') : t('s5.continueKiosk')}
        </Button>
        {langs.length === 0 && <Notice tone="amber">{t('s5.noLang')}</Notice>}
        {masked > 0 && langs.length > 0 && (
          <Notice tone="amber">
            <span data-testid="masked-note">{masked === 1 ? t('s5.masked.one') : t('s5.masked', { n: masked })}</span>
          </Notice>
        )}
        {oral ? (
          <OralCheck
            sja={sja}
            lines={keyLines}
            question={question}
            onCancel={() => setOral(false)}
            onSave={async (r, answers) => {
              await w.act('worker', (ctx, s) => flow.recordWorkerCheck(ctx, s, '', { ...r, answers }));
              setOral(false);
            }}
          />
        ) : (
          <Button className="w-full" onClick={() => setOral(true)} data-testid="oral-open">
            {t('s5.oralOpen')}
          </Button>
        )}
        <p className="text-xs text-slate-600">{t('s5.noNames')}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-bold">{t('s5.howTitle')}</h2>
        <ol className="space-y-2">
          <HowRow n={1} title={t('s5.how1')} text={t('s5.how1Text')} done={u.respondents > 0} />
          <HowRow n={2} title={t('s5.how2')} text={t('s5.how2Text')} done={u.respondents > 0 && rebriefOpen === 0} />
          <HowRow n={3} title={t('s5.how3')} text={t('s5.how3Text')} />
        </ol>
      </Card>

      <Card tone="quiet" className="space-y-2">
        <h2 className="text-base font-bold">{t('s5.keyTitle')}</h2>
        <KeyPoints lines={keyLines} sja={sja} />
        <p className="text-sm text-slate-700">{todays ? t('s5.keyHintChanged') : t('s5.keyHintGeneral')}</p>
      </Card>

      {u.misunderstood.length > 0 && (
        <Card tone="amber" className="space-y-2" >
          <h3 className="text-base font-bold">{t('s5.misunderstoodTitle')}</h3>
          <ul className="ml-5 list-disc text-sm" data-testid="misunderstood-list">
            {u.misunderstood.map((m) => (
              <li key={m.lineId}>
                {sja.lines.find((l) => l.lineId === m.lineId)?.textNb ?? m.lineId} <strong>({m.count})</strong>
                <HelpEn nb={sja.lines.find((l) => l.lineId === m.lineId)?.textNb ?? ''} line={sja.lines.find((l) => l.lineId === m.lineId)} sja={sja} />
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-700">{t('s5.misunderstoodHint')}</p>
        </Card>
      )}

      {u.perQuestion
        .filter((p) => p.respondents > 0)
        .map((p) => {
          const q = template.questions.find((x) => x.questionId === p.questionId);
          const missed = p.respondents - p.correctFirst;
          const lines = q ? linesForQuestion(sja, q) : [];
          return (
            <Card key={p.questionId} tone={missed > 0 && !p.rebriefConfirmed ? 'red' : 'green'} className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">{t('s5.questionTitle')}</h3>
              <p className="text-base font-semibold">{q?.byLang[ui === 'nb' ? 'nb' : 'en']?.text ?? p.questionId}</p>
              <p className="text-sm" data-testid={`q-count-${p.questionId}`}>
                {t('s5.rightFirst')}: <strong>{p.correctFirst} {t('common.of')} {p.respondents}</strong>
              </p>
              {missed > 0 && (
                <div className="space-y-2 rounded-lg bg-rose-50 p-3" data-testid={`rebrief-${p.questionId}`} data-rebrief-open={!p.rebriefConfirmed}>
                  <p className="flex items-start gap-2 text-sm font-bold text-rose-950">
                    <Icon name="voice" /> {missed === 1 ? t('s5.missed.one') : t('s5.missed', { n: missed })}
                  </p>
                  <ul className="ml-5 list-disc text-sm">
                    {lines.map((l) => (
                      <li key={l.lineId}>
                        {l.textNb}
                        <HelpEn nb={l.textNb} line={l} sja={sja} />
                      </li>
                    ))}
                  </ul>
                  {p.rebriefConfirmed ? (
                    <Chip tone="green">
                      <Icon name="check" className="h-3 w-3" /> {t('s5.rebriefDone')}
                    </Chip>
                  ) : (
                    <Button variant="primary" onClick={() => w.act('rebrief', (ctx, s) => flow.confirmRebrief(ctx, s, p.questionId))} data-testid={`rebrief-confirm-${p.questionId}`}>
                      {t('s5.rebriefConfirm')}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}

      {w.error && <ErrorBox message={w.error.message} />}
      <ActionBar
        note={
          <span className={`flex items-center justify-between gap-3 font-semibold ${u.completed ? 'text-emerald-900' : 'text-amber-950'}`}>
            <span className="flex items-start gap-2" data-testid="step5-state">
              <Icon name={u.completed ? 'check' : 'info'} /> {u.completed ? t('s5.complete') : u.respondents === 0 ? t('s5.todoFirst') : t('s5.todoRebrief')}
            </span>
            {!u.completed && u.respondents > 0 && (
              <button type="button" className="shrink-0 rounded px-2 py-1 font-semibold text-blue-800 underline" onClick={showRebrief} data-testid="show-rebrief">
                {t('s3.showNext')}
              </button>
            )}
          </span>
        }
      >
        <Button onClick={() => w.goStep(4)}>{t('common.back')}</Button>
        <Button variant={u.completed ? 'primary' : 'secondary'} className="flex-1" onClick={() => w.goStep(6)} data-testid="step5-continue">
          {t('s4.toSign')}
        </Button>
      </ActionBar>
    </div>
  );
}

/** After sign-off, once the job has started: what did the foreman see? (brief v3, step 4; I4) */
type Seen = 'mis' | 'not';
function Observation({ w, sja }: { w: Wizard; sja: Sja }) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Record<string, Seen>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const keyIds = new Set(sja.understanding.keyLineIds);
  const lines = activeLines(sja);
  const first = lines.filter((l) => keyIds.has(l.lineId) || l.origin === 'changed' || l.origin === 'new' || l.section === 'ppe');
  const rest = lines.filter((l) => !first.includes(l));
  const toggle = (id: string, kind: Seen) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[id] === kind) delete next[id];
      else next[id] = kind;
      return next;
    });
  const save = async (mis: string[], not: string[]) => {
    const next = await w.act('observe', (ctx, s) => flow.recordObservation(ctx, s, mis, not));
    if (next) setSaveError(await saveRun(sja.sjaId));
  };
  // If an earlier save did not reach the file (no connection, page closed), finish it now.
  const recorded = Boolean(sja.observation);
  useEffect(() => {
    let live = true;
    if (recorded)
      void observationUnsaved(sja.sjaId).then(async (unsaved) => {
        if (!unsaved) return;
        const failed = await saveRun(sja.sjaId);
        if (live) setSaveError(failed);
      });
    return () => {
      live = false;
    };
  }, [recorded, sja.sjaId]);
  const row = (l: SjaLine) => (
    <div key={l.lineId} className="rounded-lg border border-slate-300 bg-white p-2" data-testid={`observe-row-${l.lineId}`}>
      <p className="text-[15px] leading-snug">
        {l.textNb}
        <HelpEn nb={l.textNb} line={l} sja={sja} />
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant={picked[l.lineId] === 'mis' ? 'primary' : 'secondary'} aria-pressed={picked[l.lineId] === 'mis'} className="!px-2 text-sm" onClick={() => toggle(l.lineId, 'mis')} data-testid={`observe-line-${l.lineId}`}>
          {t('obsv.kindMis')}
        </Button>
        <Button variant={picked[l.lineId] === 'not' ? 'primary' : 'secondary'} aria-pressed={picked[l.lineId] === 'not'} className="!px-2 text-sm" onClick={() => toggle(l.lineId, 'not')} data-testid={`observe-notfollowed-${l.lineId}`}>
          {t('obsv.kindNot')}
        </Button>
      </div>
    </div>
  );
  const listOf = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => (
      <li key={id}>
        {sja.lines.find((l) => l.lineId === id)?.textNb ?? id}
        <HelpEn nb={sja.lines.find((l) => l.lineId === id)?.textNb ?? ''} line={sja.lines.find((l) => l.lineId === id)} sja={sja} />
      </li>
    ));

  if (sja.observation) {
    const seen = sja.observation.lineIds;
    const not = sja.observation.notFollowed ?? [];
    return (
      <Card tone="green" className="space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-bold" data-testid="observation-status">
          <Icon name="eye" /> {seen.length === 0 && not.length === 0 ? t('obsv.none') : seen.length === 0 ? t('obsv.notFollowedOnly') : seen.length === 1 ? t('obsv.noted.one') : t('obsv.noted', { n: seen.length })}
        </h3>
        {seen.length > 0 && <ul className="ml-5 list-disc text-sm">{listOf(seen)}</ul>}
        {not.length > 0 && (
          <div data-testid="observation-not-followed">
            <p className="text-sm font-bold">{t('obsv.notFollowedTitle')}</p>
            <ul className="ml-5 list-disc text-sm">{listOf(not)}</ul>
          </div>
        )}
        {(seen.length > 0 || not.length > 0) && <p className="text-sm text-slate-700">{t('obsv.fedBack')}</p>}
        {saveError && <ErrorBox message={`${t('s6.saveFailed')} ${saveError}`} onRetry={async () => setSaveError(await saveRun(sja.sjaId))} retryLabel={t('common.retry')} />}
      </Card>
    );
  }

  const misIds = Object.entries(picked).filter(([, k]) => k === 'mis').map(([id]) => id);
  const notIds = Object.entries(picked).filter(([, k]) => k === 'not').map(([id]) => id);
  return (
    <Card tone="amber" className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Icon name="eye" /> {t('obsv.title')}
      </h3>
      <p className="text-base">{t('obsv.text')}</p>
      {!picking ? (
        <div className="grid gap-2">
          <Button disabled={Boolean(w.busy)} onClick={() => save([], [])} data-testid="observe-none">
            {t('obsv.nothing')}
          </Button>
          <Button disabled={Boolean(w.busy)} onClick={() => setPicking(true)} data-testid="observe-some">
            {t('obsv.something')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-bold">{t('obsv.which')}</p>
          <p className="text-sm text-slate-700">{t('obsv.kindHint')}</p>
          <div className="space-y-1">{first.map(row)}</div>
          {rest.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-800">{t('obsv.otherLines', { n: rest.length })}</summary>
              <div className="space-y-1">{rest.map(row)}</div>
            </details>
          )}
          <Button variant="primary" className="w-full" disabled={misIds.length + notIds.length === 0 || Boolean(w.busy)} onClick={() => save(misIds, notIds)} data-testid="observe-save">
            {t('obsv.save')}
          </Button>
          <Button variant="ghost" onClick={() => { setPicking(false); setPicked({}); }}>
            {t('common.back')}
          </Button>
        </div>
      )}
      {w.error && <ErrorBox message={w.error.message} />}
      <p className="text-xs text-slate-600">{t('obsv.noNames')}</p>
    </Card>
  );
}

export function Step6({ w, pack }: { w: Wizard; pack: DataPack }) {
  const t = useT();
  const navigate = useNavigate();
  const sja = w.sja!;
  const [agree, setAgree] = useState(false);
  const [role, setRole] = useState(sja.header.foremanRole || 'Bas');
  const [saveError, setSaveError] = useState<string | null>(null);
  const conditions = gateConditions(sja, pack);
  const ok = canSign(sja, pack);
  const missing = conditions.filter((c) => !c.ok).length;
  const signed = sja.status === 'signed' || sja.status === 'signedWithFallback';

  const doSign = async () => {
    const next = await w.act('sign', (ctx, s) => flow.sign(ctx, s, role.trim() || 'Bas'));
    if (next) {
      timing.close();
      setSaveError(await saveRun(sja.sjaId));
    }
  };

  if (signed) {
    const observe = sja.understanding.required && !sja.understanding.legacyTeachBack;
    return (
      <div className="space-y-4">
        <Card tone="green" className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-bold" data-testid="signed-status">
            <Icon name="check" /> {t(`status.${sja.status}`)}
          </h2>
          <p className="text-base">
            {t('s6.signedBy')}: {sja.signoff?.role} · {sja.signoff?.at.slice(0, 16).replace('T', ' ')}
          </p>
          {sja.status === 'signedWithFallback' && <p className="text-sm font-semibold">{t('s6.fallbackNote')}</p>}
          <p className="text-sm text-slate-700">{t('s6.notLegal')}</p>
        </Card>
        {saveError && <ErrorBox message={`${t('s6.saveFailed')} ${saveError}`} onRetry={async () => setSaveError(await saveRun(sja.sjaId))} retryLabel={t('common.retry')} />}

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">{t('s6.nextTitle')}</h2>
          <ol className="space-y-3">
            <HowRow n={1} title={t('s6.next1')} text={t('s6.next1Text')} />
            {observe && <HowRow n={2} title={t('s6.next2')} text={t('s6.next2Text')} done={Boolean(sja.observation)} />}
          </ol>
          <Link to={`/runs/${sja.sjaId}`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-base font-semibold text-white hover:bg-blue-800" data-testid="open-record">
            <Icon name="doc" /> {t('s6.openRecord')}
          </Link>
          <Link to={`/runs/${sja.sjaId}/summary`} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-2 text-base font-semibold text-blue-800" data-testid="open-summary-signed">
            {t('rec.summaryLink')}
          </Link>
        </Card>

        {observe && <Observation w={w} sja={sja} />}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(`/foreman/${uid('sja')}`)} data-testid="new-sja">
            {t('s6.newSja')}
          </Button>
          <Link to="/" className="inline-flex min-h-11 items-center px-3 text-base font-semibold text-blue-800 underline">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3" tone={ok ? 'green' : 'plain'}>
        <h2 className="text-lg font-bold" data-testid="gate-title">
          {ok ? t('s6.gateOk') : missing === 1 ? t('s6.gateMissing.one') : t('s6.gateMissing', { n: missing })}
        </h2>
        <GateChecklist conditions={conditions} onGo={w.goStep} />
        {sja.status === 'escalated' && <Notice tone="violet">{t('s6.escalated')}</Notice>}
        {ok && hasFallback(sja) && <Notice tone="amber">{t('s6.willBeFallback')}</Notice>}
      </Card>

      <Card className={`space-y-3 ${ok ? '' : 'opacity-70'}`}>
        <h2 className="text-lg font-bold">{t('s6.statementTitle')}</h2>
        <blockquote className="rounded-lg bg-slate-50 p-3 text-base">{t('s6.statement')}</blockquote>
        <Field label={t('s1.role')}>
          <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} disabled={!ok} />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-6 w-6" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={!ok} data-testid="sign-agree" />
          <span className="text-base font-semibold">{t('s6.agree')}</span>
        </label>
        <p className="text-xs text-slate-600">{t('s6.notLegal')}</p>
      </Card>

      {w.error && <ErrorBox message={w.error.message} />}
      <ActionBar
        note={
          !ok ? (
            <span className="flex items-start gap-2 font-semibold text-rose-900" data-testid="sign-blocked">
              <Icon name="lock" /> {missing === 1 ? t('s6.blocked.one') : t('s6.blocked', { n: missing })}
            </span>
          ) : !agree ? (
            <span className="font-semibold text-slate-800">{t('s6.tickFirst')}</span>
          ) : undefined
        }
      >
        <Button onClick={() => w.goStep(sja.understanding.required ? 5 : 4)}>{t('common.back')}</Button>
        <Button variant="success" className="flex-1 text-lg" disabled={!ok || !agree || Boolean(w.busy)} onClick={doSign} data-testid="sign-button">
          {t('s6.sign')}
        </Button>
      </ActionBar>
    </div>
  );
}
