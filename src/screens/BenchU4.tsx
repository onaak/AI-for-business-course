// U4 (decided 26 Oct 2026): can the foreman judge a written explanation from its machine
// translation alone? A person who does not read the language plays the foreman: for each
// sample answer they see the key points (Norwegian) and the translation (P7), and judge it.
// Only then is the intended answer shown. If the translation hides wrong answers, the written
// path cannot end in "signed", and the decision must be reversed.
import { useMemo, useState } from 'react';
import { modelClient } from '../api';
import { Button, Card, Chip, ErrorBox, Notice, Spinner } from '../components/ui';
import type { P7Output } from '../core/schemas';
import type { DataPack } from '../core/types';
import { LANG_NAMES, uid } from '../core/util';

interface Sample {
  id: string;
  lang: string;
  templateId: string;
  keyLineIds: string[];
  intended: 'correct' | 'subtlyWrong';
  hazard: string;
  measure: string;
  note: string;
}

export function BenchU4({ pack, samples, status }: { pack: DataPack; samples: Sample[]; status: string }) {
  const [runId] = useState(() => uid('bench-u4'));
  const [translations, setTranslations] = useState<Record<string, P7Output['items'] | { error: string }>>({});
  const [verdicts, setVerdicts] = useState<Record<string, 'ok' | 'missed'>>({});
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const translateAll = async () => {
    setBusy(true);
    const out: typeof translations = {};
    for (const s of samples) {
      try {
        const r = await modelClient.call<P7Output>('P7', { lang: s.lang, items: [{ key: 'hazard', text: s.hazard }, { key: 'measure', text: s.measure }] }, { runId });
        out[s.id] = r.parsed.items;
      } catch (e) {
        out[s.id] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    setTranslations(out);
    setBusy(false);
  };

  const result = useMemo(() => {
    const judged = samples.filter((s) => verdicts[s.id]);
    const right = judged.filter((s) => (verdicts[s.id] === 'ok') === (s.intended === 'correct'));
    const wrong = samples.filter((s) => s.intended === 'subtlyWrong');
    const wrongCaught = wrong.filter((s) => verdicts[s.id] === 'missed');
    return { judged: judged.length, right: right.length, wrong: wrong.length, wrongCaught: wrongCaught.length };
  }, [samples, verdicts]);

  const line = (templateId: string, id: string) => pack.templates.find((t) => t.templateId === templateId)?.lines.find((l) => l.lineId === id)?.textNb ?? id;

  return (
    <Card className="space-y-3" >
      <h2 className="text-lg font-bold">U4 Written explanations: can the foreman judge them from the translation?</h2>
      <p className="text-sm text-slate-700">
        The person at the screen plays a foreman who does <strong>not</strong> read Lithuanian, Polish or Russian. For each answer, read the key points and the machine translation, and judge it. Only then
        press "Show the intended answers". Proposed pass mark, set before testing (the builder's proposal, to be confirmed by the group): every subtly wrong answer is caught, and at least {samples.length - 1} of{' '}
        {samples.length} judgements are right.
      </p>
      {status !== 'confirmed' && <Notice tone="amber">Fixtures unconfirmed: the sample answers and their translations were written by the builder. A native speaker must confirm them before a result is reported.</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={busy} onClick={translateAll} data-testid="u4-translate">
          Translate the {samples.length} answers (P7)
        </Button>
        {busy && <Spinner label="Translating …" />}
      </div>
      {Object.keys(translations).length > 0 && (
        <ol className="space-y-3" data-testid="u4-list">
          {samples.map((s, i) => {
            const tr = translations[s.id];
            const items = tr && !('error' in tr) ? tr : null;
            return (
              <li key={s.id} className="rounded-lg border border-slate-300 p-3" data-testid={`u4-${s.id}`}>
                <p className="text-sm font-semibold">
                  {i + 1}. {pack.templates.find((t) => t.templateId === s.templateId)?.jobType.en} · {LANG_NAMES[s.lang]?.en}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-600">Listen for (key points)</p>
                <ul className="ml-5 list-disc text-sm">
                  {s.keyLineIds.map((id) => (
                    <li key={id}>{line(s.templateId, id)}</li>
                  ))}
                </ul>
                {tr && 'error' in tr && <ErrorBox message={tr.error} />}
                {items && (
                  <div className="mt-2 space-y-1 rounded bg-slate-50 p-2 text-sm">
                    <p><span className="font-semibold">Main danger:</span> {items.find((x) => x.key === 'hazard')?.textNb}</p>
                    <p><span className="font-semibold">What we do:</span> {items.find((x) => x.key === 'measure')?.textNb}</p>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant={verdicts[s.id] === 'ok' ? 'success' : 'secondary'} aria-pressed={verdicts[s.id] === 'ok'} onClick={() => setVerdicts({ ...verdicts, [s.id]: 'ok' })} data-testid={`u4-ok-${s.id}`}>
                    Explained correctly
                  </Button>
                  <Button variant={verdicts[s.id] === 'missed' ? 'primary' : 'secondary'} aria-pressed={verdicts[s.id] === 'missed'} onClick={() => setVerdicts({ ...verdicts, [s.id]: 'missed' })} data-testid={`u4-missed-${s.id}`}>
                    Something was misunderstood
                  </Button>
                </div>
                {revealed && (
                  <p className="mt-2 text-sm">
                    Intended: <Chip tone={s.intended === 'correct' ? 'green' : 'amber'}>{s.intended === 'correct' ? 'correct' : 'subtly wrong'}</Chip>{' '}
                    {verdicts[s.id] ? ((verdicts[s.id] === 'ok') === (s.intended === 'correct') ? 'Judged right.' : 'Judged wrong.') : 'Not judged.'} {s.note}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {Object.keys(translations).length > 0 && (
        <div className="space-y-2">
          <Button disabled={result.judged < samples.length} onClick={() => setRevealed(true)} data-testid="u4-reveal">
            Show the intended answers
          </Button>
          {revealed && (
            <p className="text-base font-semibold" data-testid="u4-result">
              Judged right: {result.right} of {samples.length}. Subtly wrong answers caught: {result.wrongCaught} of {result.wrong}. Type this into the U4 row of the test log yourself.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
