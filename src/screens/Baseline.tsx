// Baseline timer (F-19): times the firm's current practice, or a human translation,
// in the same categories as the flagship flow, so both arms can be compared (CR-09,
// TR-08, TR-09). Results land in the same log with arm = baseline. English only.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Button, Card, Chip, download, inputClass, Layout, Notice } from '../components/ui';
import { fmtDuration, FOREMAN_CATEGORIES, timeByCategory, TOTAL_CATEGORIES } from '../core/metrics';
import { BANNER_EN, type TimeCategory } from '../core/types';
import { useApp, useLog, useSjas } from '../state/stores';

const CATEGORIES: { id: TimeCategory; label: string; hint: string }[] = [
  { id: 'input', label: 'Input and drafting', hint: 'Describing the job, filling in the form' },
  { id: 'contentReview', label: 'Content review', hint: 'Reading and checking the Norwegian text' },
  { id: 'reviewer', label: 'Human translation', hint: 'A person translating or explaining in the other language' },
  { id: 'flagResolution', label: 'Checking and correction', hint: 'Checking the translation, fixing mistakes' },
  { id: 'understanding', label: 'Understanding check', hint: 'Briefing, questions, re-brief' },
  { id: 'signoff', label: 'Sign-off', hint: 'Final read-through and signature' },
];
const LABELS: Record<TimeCategory, string> = { input: 'Input', machine: 'Machine', contentReview: 'Content review', flagResolution: 'Flag resolution / checking', understanding: 'Understanding check', signoff: 'Sign-off', reviewer: 'Reviewer / human translation' };
const COLS: TimeCategory[] = ['input', 'machine', 'contentReview', 'reviewer', 'flagResolution', 'understanding', 'signoff'];

export default function Baseline() {
  const pack = useApp((s) => s.pack);
  const { baseline, addBaseline, removeBaseline, standalone, events, add } = useLog();
  const sjas = useSjas((s) => s.sjas);
  const [testId, setTestId] = useState('T8');
  const [label, setLabel] = useState('T8 (i) blank form filled in by hand');
  const [active, setActive] = useState<{ category: TimeCategory; started: number } | null>(null);
  const [, tick] = useState(0);
  const ref = useRef(active);
  ref.current = active;

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const stop = () => {
    const a = ref.current;
    if (!a) return;
    const durationMs = Date.now() - a.started;
    addBaseline({ testId, label: label.trim() || 'unlabelled', category: a.category, durationMs });
    add({ runId: `baseline-${label.trim() || 'unlabelled'}`, testId, arm: 'baseline', actor: 'observer', type: 'time', timeCategory: a.category, durationMs, packVersion: pack?.version ?? 0 });
    setActive(null);
  };
  const start = (category: TimeCategory) => {
    if (ref.current?.category === category) return stop();
    stop();
    setActive({ category, started: Date.now() });
  };

  const groups = [...new Set(baseline.map((b) => `${b.testId}|${b.label}`))].map((key) => {
    const rows = baseline.filter((b) => `${b.testId}|${b.label}` === key);
    const totals = Object.fromEntries(COLS.map((c) => [c, rows.filter((r) => r.category === c).reduce((s, r) => s + r.durationMs, 0)])) as Record<TimeCategory, number>;
    return { key, arm: 'baseline', testId: rows[0].testId, label: rows[0].label, totals };
  });
  const flagship = Object.values(sjas)
    .filter((s) => s.status.startsWith('signed') || s.testId)
    .map((s) => ({ key: s.sjaId, arm: 'flagship', testId: s.testId ?? '–', label: `${s.templateId} (${s.status})`, totals: timeByCategory(events, s.sjaId) }));
  const all = [...groups, ...flagship];
  const sum = (t: Record<TimeCategory, number>, cats: TimeCategory[]) => cats.reduce((s, c) => s + (t[c] ?? 0), 0);

  const exportCsv = async () => {
    const head = ['arm', 'test', 'label', ...COLS.map((c) => `${LABELS[c]} (s)`), 'total drafting + checking + correction, to signature (s)', 'foreman only, without understanding (s)', 'all categories (s)'];
    const lines = all.map((g) => [g.arm, g.testId, g.label, ...COLS.map((c) => Math.round((g.totals[c] ?? 0) / 1000)), Math.round(sum(g.totals, TOTAL_CATEGORIES) / 1000), Math.round(sum(g.totals, FOREMAN_CATEGORIES) / 1000), Math.round(sum(g.totals, COLS) / 1000)]);
    const csv = [`"${BANNER_EN}"`, head.map((h) => `"${h}"`).join(','), ...lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n') + '\n';
    download('time-by-category.csv', csv, 'text/csv;charset=utf-8');
    await api.saveExport('time-by-category.csv', csv).catch(() => undefined);
  };

  return (
    <Layout title="Baseline timer" wide english>
      <div className="space-y-4">
        <Notice>Use this for the arm without the tool: the firm's usual oral briefing (T5), a blank form filled in by hand, or the firm's existing templates with a human translation (T8). Time both methods from drafting through checking and correction, not only drafting: the categories are the same as in the foreman flow. Hypothetical jobs only.</Notice>
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <label className="block text-sm font-semibold">
              Test
              <select className={inputClass} value={testId} onChange={(e) => setTestId(e.target.value)} data-testid="baseline-test">
                {['T5', 'T8', 'T1', 'T2', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              What is being timed (no names)
              <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} data-testid="baseline-label" />
            </label>
          </div>
          <p className="text-sm text-slate-700">Tap a category to start timing it. Tap another to switch. Tap the running one, or Stop, to end.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const on = active?.category === c.id;
              return (
                <button key={c.id} type="button" onClick={() => start(c.id)} aria-pressed={on} data-testid={`baseline-${c.id}`} className={`min-h-16 rounded-xl border-2 p-3 text-left ${on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white'}`}>
                  <span className="block text-base font-bold">{c.label}{on ? ` · ${fmtDuration(Date.now() - active!.started)}` : ''}</span>
                  <span className={`block text-sm ${on ? 'text-blue-100' : 'text-slate-600'}`}>{c.hint}</span>
                </button>
              );
            })}
          </div>
          <Button variant="danger" disabled={!active} onClick={stop} data-testid="baseline-stop">Stop</Button>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-lg font-bold">Time by category, both arms</h2>
          {all.length === 0 ? <p className="text-sm text-slate-700">Nothing timed yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm" data-testid="baseline-table">
                <thead>
                  <tr className="border-b border-slate-300"><th className="py-1 pr-2">Arm</th><th className="pr-2">Test</th><th className="pr-2">What</th>{COLS.map((c) => <th key={c} className="pr-2">{LABELS[c]}</th>)}<th className="pr-2">Total to signature*</th><th className="pr-2">Foreman only**</th></tr>
                </thead>
                <tbody>
                  {all.map((g) => (
                    <tr key={g.key} className="border-b border-slate-100">
                      <td className="py-1 pr-2"><Chip tone={g.arm === 'baseline' ? 'slate' : 'blue'}>{g.arm}</Chip></td><td className="pr-2">{g.testId}</td><td className="pr-2">{g.label}</td>
                      {COLS.map((c) => <td key={c} className="pr-2 font-mono">{fmtDuration(g.totals[c] ?? 0)}</td>)}
                      <td className="pr-2 font-mono font-bold" data-testid="baseline-total">{fmtDuration(sum(g.totals, TOTAL_CATEGORIES))}</td>
                      <td className="pr-2 font-mono">{fmtDuration(sum(g.totals, FOREMAN_CATEGORIES))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-600">* Drafting, checking and correction up to the signature: every category except the understanding check. This is the comparison the service brief asks for (pilot measure 1).</p>
          <p className="text-xs text-slate-600">** Input + content review + flag resolution + sign-off: the foreman's own time, used for the ten-minute criterion. Machine time and reviewer or translator time are left out.</p>
          <Button disabled={all.length === 0} onClick={exportCsv} data-testid="baseline-export">Export CSV</Button>
          {baseline.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Single timings ({baseline.length})</summary>
              <ul className="text-sm">
                {baseline.map((b) => (
                  <li key={b.entryId} className="flex items-center gap-2">
                    {b.testId} · {b.label} · {LABELS[b.category]} · {fmtDuration(b.durationMs)}
                    <button type="button" className="min-h-11 text-xs font-semibold text-rose-800 underline" onClick={() => removeBaseline(b.entryId)}>remove</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card className="space-y-2">
          <h2 className="text-lg font-bold">Scenario questions on their own (T5, both arms)</h2>
          <p className="text-sm text-slate-700">For test 5, run this same question set after each briefing: once after the firm's usual oral briefing and once after the briefing with the tool. That keeps the two arms comparable. The check inside the foreman flow is different: there each worker explains the hazard and the measure in their own words and answers one question. No names. Counts only.</p>
          <div className="flex flex-wrap gap-3">
            {pack?.templates.map((t) => (
              <Link key={t.templateId} to={`/worker/questions/${t.templateId}`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">Question set: {t.jobType.en}</Link>
            ))}
          </div>
          {standalone.length > 0 && (
            <table className="w-full text-left text-sm" data-testid="standalone-table">
              <thead><tr className="border-b border-slate-300"><th className="py-1 pr-2">Session</th><th className="pr-2">Arm</th><th className="pr-2">Template</th><th className="pr-2">Respondents</th><th>Right at first answer, per question</th></tr></thead>
              <tbody>
                {standalone.map((s) => (
                  <tr key={s.sessionId} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{s.label}</td><td className="pr-2">{s.arm}</td><td className="pr-2">{s.templateId}</td><td className="pr-2">{s.respondents}</td>
                    <td>{s.perQuestion.map((p) => `${p.questionId}: ${p.correctFirst} of ${p.respondents}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Layout>
  );
}
