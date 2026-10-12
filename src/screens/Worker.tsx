// Worker kiosk (F-10, as changed by service brief v3): one device is passed from worker
// to worker. No name is asked. Each worker reads the SJA, explains the key hazard and
// the safety measure to the foreman in their own words (teach-back) and answers one
// "what do you do if …" question. The tool keeps counts only. Worker text is in the
// worker's language, in large type; the foreman's part is in the foreman's language.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TeachBackJudge, type TeachBackResult } from '../components/TeachBack';
import { Button, Icon, inputClass, Layout, Notice } from '../components/ui';
import { activeLines, isBlocking } from '../core/flags';
import * as flow from '../core/flow';
import { supportedLangs } from '../core/rules/diff';
import { BANNER_EN, SECTIONS, type Question, type SjaLine } from '../core/types';
import { LANG_NAMES, uid } from '../core/util';
import { useT, workerT } from '../i18n';
import { makeFlowCtx } from '../state/ctx';
import { useApp, useLog, useSjas, type StandaloneResult } from '../state/stores';
import { timing } from '../state/timing';

function KioskFrame({ lang, children, exitTo, exitLabel, counter }: { lang: string | null; children: ReactNode; exitTo: string; exitLabel: string; counter: string }) {
  const wt = workerT(lang ?? 'en');
  return (
    <div className="min-h-screen bg-white" lang={lang ?? undefined}>
      <div className="sticky top-0 z-30">
        <div role="note" data-testid="prototype-banner" className="bg-amber-300 px-3 py-1.5 text-center text-xs font-bold leading-snug text-slate-950">
          {lang ? wt('banner') : BANNER_EN}
        </div>
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-3 py-1 text-sm">
          <span className="font-semibold text-slate-700" data-testid="kiosk-counter">{counter}</span>
          <Link to={exitTo} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline" data-testid="kiosk-exit">
            {exitLabel}
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-xl px-4 py-5 text-[19px] leading-relaxed">{children}</main>
    </div>
  );
}

function LanguagePicker({ langs, onPick }: { langs: string[]; onPick: (l: string) => void }) {
  return (
    <div className="space-y-3">
      {langs.map((l) => (
        <Button key={l} variant="primary" className="w-full !py-4 text-xl" onClick={() => onPick(l)} data-testid={`kiosk-lang-${l}`}>
          {LANG_NAMES[l]?.own ?? l}
        </Button>
      ))}
    </div>
  );
}

/** Scenario questions, one at a time. Records the first answer to each. A wrong answer never ends the flow. */
function QuestionRunner({ lang, questions, onDone, nextLabel }: { lang: string; questions: Question[]; onDone: (answers: { questionId: string; correct: boolean }[]) => void; nextLabel?: string }) {
  const wt = workerT(lang);
  const usable = questions.filter((q) => q.byLang[lang as 'pl']);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const q = usable[index];

  useEffect(() => {
    if (usable.length === 0) onDone([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!q) return null;
  const text = q.byLang[lang as 'pl']!;

  const answer = (i: number) => {
    if (feedback !== null) return;
    const correct = i === q.correctIndex;
    setAnswers((a) => [...a, { questionId: q.questionId, correct }]);
    setFeedback(correct);
  };
  const next = () => {
    setFeedback(null);
    if (index + 1 >= usable.length) onDone(answers);
    else setIndex(index + 1);
  };

  return (
    <div className="space-y-4" data-testid="kiosk-question">
      <p className="text-base font-semibold text-slate-600">{usable.length === 1 ? wt('oneQuestion') : wt('questionOf', { n: index + 1, total: usable.length })}</p>
      <h2 className="text-2xl font-bold leading-snug">{text.text}</h2>
      <div className="space-y-3">
        {text.options.map((o, i) => (
          <Button key={i} className="w-full !justify-start !py-4 text-[19px]" disabled={feedback !== null} onClick={() => answer(i)} data-testid={`kiosk-option-${i}`} data-correct={i === q.correctIndex ? 'yes' : 'no'}>
            {o}
          </Button>
        ))}
      </div>
      {feedback === true && (
        <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4" data-testid="kiosk-correct">
          <p className="flex items-center gap-2 text-xl font-bold text-emerald-900">
            <Icon name="check" className="h-6 w-6" /> {wt('correct')}
          </p>
        </div>
      )}
      {feedback === false && (
        <div className="rounded-xl border-2 border-amber-600 bg-amber-50 p-4" data-testid="kiosk-talk">
          <p className="flex items-start gap-2 text-xl font-bold text-amber-950">
            <Icon name="voice" className="mt-1 h-6 w-6" /> {wt('talkToForeman')}
          </p>
        </div>
      )}
      {feedback !== null && (
        <Button variant="primary" className="w-full !py-4 text-xl" onClick={next} data-testid="kiosk-next">
          {nextLabel ?? wt('next')}
        </Button>
      )}
    </div>
  );
}

function DonePanel({ lang, onNext, passOn, finish, talk = false }: { lang: string; onNext: () => void; passOn?: string; finish?: ReactNode; talk?: boolean }) {
  const wt = workerT(lang);
  return (
    <div className="space-y-5 text-center" data-testid="kiosk-done">
      {talk ? (
        <div className="rounded-xl border-2 border-amber-600 bg-amber-50 p-4 text-left" data-testid="kiosk-done-talk">
          <p className="flex items-start gap-2 text-xl font-bold text-amber-950">
            <Icon name="voice" className="mt-1 h-6 w-6" /> {wt('talkToForeman')}
          </p>
        </div>
      ) : (
        <>
          <Icon name="check" className="mx-auto h-16 w-16 text-emerald-700" />
          <h2 className="text-2xl font-bold">{wt('done')}</h2>
        </>
      )}
      <p className="text-xl">{passOn ?? wt('passOn')}</p>
      <Button variant="primary" className="w-full !py-4 text-xl" onClick={onNext} data-testid="kiosk-next-worker">
        {wt('nextWorker')}
      </Button>
      {finish}
    </div>
  );
}

/** One line of the SJA as the worker sees it. A line with no checked text in this language is briefed orally. */
function WorkerLine({ line, lang, strong = false }: { line: SjaLine; lang: string; strong?: boolean }) {
  const wt = workerT(lang);
  const e = line.byLang[lang];
  // A worker never reads a translation that is unchecked, or that the tool has flagged and nobody has handled yet.
  const flagged = Boolean(e?.flags.some((f) => isBlocking(f, line.critical)));
  const oral = !e || e.oralFallback || !e.text || flagged || e.checkState === 'error' || e.checkState === 'pending' || e.checkState === 'blocked';
  return (
    <li className={`rounded-lg border p-3 ${strong ? 'border-2 border-blue-600 bg-white' : line.critical ? 'border-l-8 border-rose-500' : 'border-slate-200'}`}>
      {oral ? (
        <p className="flex items-start gap-2 font-semibold text-amber-950">
          <Icon name="voice" className="mt-1 h-6 w-6" /> {wt('oralPoint')}
        </p>
      ) : (
        <p className={strong ? 'font-semibold' : ''}>{e.text}</p>
      )}
      {line.critical && !strong && (
        <p className="mt-1 flex items-center gap-1 text-sm font-bold text-rose-800">
          <Icon name="warn" className="h-4 w-4" /> {wt('important')}
        </p>
      )}
    </li>
  );
}

/** /worker/:sjaId – the understanding check inside the foreman flow. */
export function WorkerKiosk() {
  const { sjaId = '' } = useParams();
  const t = useT();
  const ui = useApp((s) => s.lang);
  const pack = useApp((s) => s.pack);
  const sja = useSjas((s) => s.sjas[sjaId]);
  const [lang, setLang] = useState<string | null>(null);
  const [phase, setPhase] = useState<'language' | 'read' | 'explain' | 'question' | 'done'>('language');
  const [teach, setTeach] = useState<TeachBackResult | null>(null);
  const [lastWrong, setLastWrong] = useState(false);

  useEffect(() => {
    timing.enter(sjaId, 'understanding', 'kiosk');
    return () => timing.close();
  }, [sjaId]);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, and React treats an effect's return value as its clean-up.
    window.scrollTo({ top: 0 });
  }, [phase]);

  if (!pack || !sja) return <Layout>{t('common.loading')}</Layout>;
  const template = pack.templates.find((x) => x.templateId === sja.templateId)!;
  const langs = supportedLangs(sja, pack);
  const u = sja.understanding;
  const closed = sja.status === 'signed' || sja.status === 'signedWithFallback' || !u.required;
  if (closed && phase !== 'done') {
    return (
      <Layout title={t('wizard.title')}>
        <div className="space-y-3" data-testid="kiosk-closed">
          <Notice tone="amber">{u.required ? t('kiosk.closedSigned') : t('kiosk.closedNotRequired')}</Notice>
          <Link to={`/foreman/${sjaId}`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">
            {t('rec.backToWizard')}
          </Link>
        </div>
      </Layout>
    );
  }
  const questions = u.questionIds.map((id) => template.questions.find((q) => q.questionId === id)).filter((q): q is Question => Boolean(q));
  const askable = lang ? questions.filter((q) => q.byLang[lang as 'pl']) : [];
  const keyLines = u.keyLineIds.map((id) => sja.lines.find((l) => l.lineId === id)).filter((l): l is SjaLine => Boolean(l));
  const todays = activeLines(sja).filter((l) => l.origin === 'changed' || l.origin === 'new');
  const wt = workerT(lang ?? 'en');

  // The worker is recorded once, at the end: the foreman's judgement of the explanation and the first answer to the question.
  const finish = (result: TeachBackResult, answers: { questionId: string; correct: boolean }[]) => {
    const current = useSjas.getState().sjas[sjaId];
    useSjas.getState().put(flow.recordWorkerCheck(makeFlowCtx(current), current, lang ?? '', { ...result, answers }));
    setTeach(null);
    setLastWrong(answers.some((a) => !a.correct));
    setPhase('done');
  };

  return (
    <KioskFrame lang={lang} exitTo={`/foreman/${sjaId}`} exitLabel={t('kiosk.exit')} counter={`${t('s5.respondents')}: ${u.respondents}`}>
      {phase === 'language' && (
        <div className="space-y-4">
          <p className="text-base font-semibold text-slate-700" lang={ui}>{t('kiosk.pickLang')}</p>
          <LanguagePicker langs={langs} onPick={(l) => { setLang(l); setPhase('read'); }} />
        </div>
      )}

      {phase === 'read' && lang && (
        <div className="space-y-4" data-testid="kiosk-read">
          <h1 className="text-2xl font-bold">{template.jobType[lang as 'pl'] ?? template.jobType.nb}</h1>
          <p className="text-slate-700">{wt('readFirst')}</p>
          {todays.length > 0 && (
            <section className="rounded-xl bg-blue-50 p-3" data-testid="kiosk-today">
              <h2 className="text-lg font-bold text-blue-950">{wt('newToday')}</h2>
              <ul className="mt-2 space-y-3">
                {todays.map((l) => (
                  <WorkerLine key={l.lineId} line={l} lang={lang} strong />
                ))}
              </ul>
            </section>
          )}
          <h2 className="pt-2 text-lg font-bold">{wt('wholeSja')}</h2>
          {SECTIONS.map((sec) => {
            const lines = activeLines(sja).filter((l) => l.section === sec);
            if (!lines.length) return null;
            return (
              <section key={sec}>
                <h3 className="mt-2 text-base font-bold uppercase tracking-wide text-slate-600">{wt(`section_${sec}`)}</h3>
                <ul className="mt-2 space-y-3">
                  {lines.map((l) => (
                    <WorkerLine key={l.lineId} line={l} lang={lang} />
                  ))}
                </ul>
              </section>
            );
          })}
          <Button variant="primary" className="w-full !py-4 text-xl" onClick={() => setPhase('explain')} data-testid="kiosk-read-done">
            {wt('readDone')}
          </Button>
        </div>
      )}

      {phase === 'explain' && lang && (
        <div className="space-y-5" data-testid="kiosk-explain">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold leading-snug">{wt('explainTitle')}</h2>
            <ol className="ml-6 list-decimal space-y-2 text-xl font-semibold">
              <li>{wt('explainHazard')}</li>
              <li>{wt('explainMeasure')}</li>
            </ol>
            <p className="text-slate-700">{wt('explainHint')}</p>
          </div>
          <section className="rounded-xl border-2 border-slate-400 bg-slate-100 p-3 text-base" lang={ui} data-testid="foreman-zone">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              <Icon name="person" className="h-4 w-4" /> {t('teach.foremanZone')}
            </p>
            <TeachBackJudge
              lines={keyLines}
              sja={sja}
              onDone={(r) => {
                if (askable.length === 0) return finish(r, []);
                setTeach(r);
                setPhase('question');
              }}
            />
          </section>
        </div>
      )}

      {phase === 'question' && lang && teach && <QuestionRunner key={`${lang}-${u.respondents}`} lang={lang} questions={askable} onDone={(answers) => finish(teach, answers)} />}
      {phase === 'done' && lang && (
        <DonePanel
          lang={lang}
          talk={lastWrong}
          passOn={wt('passBack')}
          onNext={() => { setLang(null); setPhase('language'); }}
          finish={
            <Link to={`/foreman/${sjaId}`} lang={ui} className="flex min-h-12 items-center justify-center rounded-lg border border-slate-400 bg-white px-4 py-2 text-base font-semibold text-slate-900" data-testid="kiosk-finish">
              {t('kiosk.finish')}
            </Link>
          }
        />
      )}
    </KioskFrame>
  );
}

/** /worker/questions/:templateId – the question set on its own, without the SJA (AC-17). For the baseline arm of T5. */
export function StandaloneQuestions() {
  const { templateId = '' } = useParams();
  const t = useT();
  const ui = useApp((s) => s.lang);
  const pack = useApp((s) => s.pack);
  const [label, setLabel] = useState('T5 baseline');
  const [arm, setArm] = useState<'baseline' | 'flagship'>('baseline');
  const [sessionId] = useState(() => uid('session'));
  const [started, setStarted] = useState(false);
  const [lang, setLang] = useState<string | null>(null);
  const [phase, setPhase] = useState<'language' | 'questions' | 'done'>('language');
  const result = useLog((s) => s.standalone.find((r) => r.sessionId === sessionId));

  if (!pack) return <Layout>{t('common.loading')}</Layout>;
  const template = pack.templates.find((x) => x.templateId === templateId);
  if (!template) return <Layout>{t('common.notFound')}</Layout>;

  const finish = (answers: { questionId: string; correct: boolean }[]) => {
    const prev: StandaloneResult = useLog.getState().standalone.find((r) => r.sessionId === sessionId) ?? {
      sessionId,
      at: new Date().toISOString(),
      templateId,
      label,
      arm,
      respondents: 0,
      perQuestion: template.questions.map((q) => ({ questionId: q.questionId, respondents: 0, correctFirst: 0 })),
    };
    useLog.getState().putStandalone({
      ...prev,
      respondents: prev.respondents + 1,
      perQuestion: prev.perQuestion.map((p) => {
        const a = answers.find((x) => x.questionId === p.questionId);
        return a ? { ...p, respondents: p.respondents + 1, correctFirst: p.correctFirst + (a.correct ? 1 : 0) } : p;
      }),
    });
    useLog.getState().add({ runId: sessionId, testId: 'T5', arm, actor: 'worker', type: 'standalone_respondent', step: 'understanding', languagePair: `nb-${lang}`, count: answers.filter((a) => a.correct).length, packVersion: pack.version });
    setPhase('done');
  };

  if (!started) {
    return (
      <Layout title={t('standalone.title')}>
        <div className="space-y-4">
          <p className="text-base">{t('standalone.intro')}</p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('standalone.label')}</span>
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{t('standalone.arm')}</span>
            <select className={inputClass} value={arm} onChange={(e) => setArm(e.target.value as 'baseline' | 'flagship')}>
              <option value="baseline">{t('standalone.baseline')}</option>
              <option value="flagship">{t('standalone.flagship')}</option>
            </select>
          </label>
          <p className="text-sm text-slate-700">
            {template.jobType[ui] ?? template.jobType.nb}: {template.questions.length} {t('standalone.questions')}
          </p>
          <Button variant="primary" className="w-full" onClick={() => setStarted(true)} data-testid="standalone-start">
            {t('standalone.start')}
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <KioskFrame lang={lang} exitTo="/baseline" exitLabel={t('kiosk.exitObserver')} counter={`${t('s5.respondents')}: ${result?.respondents ?? 0}`}>
      {phase === 'language' && <LanguagePicker langs={pack.languages} onPick={(l) => { setLang(l); setPhase('questions'); }} />}
      {phase === 'questions' && lang && <QuestionRunner key={`${lang}-${result?.respondents ?? 0}`} lang={lang} questions={template.questions} onDone={finish} />}
      {phase === 'done' && lang && <DonePanel lang={lang} onNext={() => { setLang(null); setPhase('language'); }} />}
    </KioskFrame>
  );
}
