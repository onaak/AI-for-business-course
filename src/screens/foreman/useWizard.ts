import { useCallback, useState } from 'react';
import { api } from '../../api';
import type { FlowCtx } from '../../core/flow';
import type { RunRecord, Sja } from '../../core/types';
import { buildRunRecord } from '../../record';
import { makeFlowCtx } from '../../state/ctx';
import { useLog, useSjas } from '../../state/stores';
import { timing } from '../../state/timing';

export interface WizardError {
  message: string;
  retry?: () => void;
}

/** Runs flow functions against the stored SJA, with busy and error state. */
export function useWizard(sjaId: string) {
  const sja = useSjas((s) => s.sjas[sjaId]) as Sja | undefined;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<WizardError | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const act = useCallback(
    async (label: string, fn: (ctx: FlowCtx, sja: Sja) => Promise<Sja> | Sja, opts: { machine?: boolean; from?: Sja } = {}): Promise<Sja | null> => {
      const current = opts.from ?? useSjas.getState().sjas[sjaId];
      if (!current) return null;
      setBusy(label);
      setError(null);
      try {
        const ctx = makeFlowCtx(current, (done, total) => setProgress({ done, total }));
        const next = opts.machine ? await timing.machine(sjaId, async () => fn(ctx, current)) : await fn(ctx, current);
        useSjas.getState().put(next);
        return next;
      } catch (e) {
        setError({ message: e instanceof Error ? e.message : String(e), retry: () => void act(label, fn, opts) });
        return null;
      } finally {
        setBusy(null);
        setProgress(null);
      }
    },
    [sjaId],
  );

  const goStep = useCallback(
    (step: number) => {
      const current = useSjas.getState().sjas[sjaId];
      if (current) useSjas.getState().put({ ...current, step });
      setError(null);
    },
    [sjaId],
  );

  const assist = useCallback(() => {
    const current = useSjas.getState().sjas[sjaId];
    useLog.getState().add({ runId: sjaId, testId: current?.testId, arm: 'flagship', actor: 'observer', type: 'assist', step: String(current?.step ?? 1), packVersion: current?.packVersion ?? 0 });
    if (current) useSjas.getState().put({ ...current, assists: current.assists + 1 });
  }, [sjaId]);

  return { sja, busy, error, setError, progress, act, goStep, assist };
}

/**
 * Writes the run to evidence/runs on the server. The local copy stays whatever happens.
 *
 * After sign-off the file on disk holds the full trace and the browser keeps only what
 * was added since. So a save never rebuilds the file from the browser's copy alone: it
 * reads the file, appends the new trace entries and writes it back. If the file cannot
 * be read for any reason other than "it does not exist yet", nothing is written.
 */
export async function saveRun(sjaId: string, note?: string): Promise<string | null> {
  const sja = useSjas.getState().sjas[sjaId];
  if (!sja) return 'No such SJA on this device.';
  try {
    const local = buildRunRecord(sja, note);
    let record: RunRecord = local;
    const saved = await api.runIfSaved(sjaId); // throws if the server cannot be reached: then nothing is written
    if (saved) {
      const known = new Set(saved.trace.map((e) => `${e.at}|${e.title}`));
      const added = local.trace.filter((e) => !known.has(`${e.at}|${e.title}`));
      record = { ...local, note: note ?? saved.note, judgements: saved.judgements, trace: [...saved.trace, ...added.map((e, i) => ({ ...e, seq: saved.trace.length + i + 1 }))] };
    }
    await api.saveRun(record);
    const signed = sja.status === 'signed' || sja.status === 'signedWithFallback';
    // The file now holds the full trace; keep browser storage small.
    if (signed) useSjas.getState().dropTrace(sjaId);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** True when this device holds an observation that the saved file does not have yet. */
export async function observationUnsaved(sjaId: string): Promise<boolean> {
  const sja = useSjas.getState().sjas[sjaId];
  if (!sja?.observation) return false;
  try {
    return !(await api.runIfSaved(sjaId))?.sja.observation;
  } catch {
    return true;
  }
}
