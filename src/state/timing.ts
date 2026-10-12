// Step-transition timing (F-13; plan SC-14). There are no timers inside the foreman
// flow: time is taken from step changes. Machine time is split out while a blocking
// model or rule step runs, so waiting is counted as machine time, not foreman time.
import type { TimeCategory } from '../core/types';
import { useLog, useSjas } from './stores';

interface Segment {
  runId: string;
  category: TimeCategory;
  step?: string;
  started: number;
}

let segment: Segment | null = null;
let paused: Omit<Segment, 'started'> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function emit(seg: Segment) {
  const durationMs = Date.now() - seg.started;
  if (durationMs < 1) return;
  const sja = useSjas.getState().sjas[seg.runId];
  useLog.getState().add({
    runId: seg.runId,
    testId: sja?.testId,
    arm: 'flagship',
    actor: seg.category === 'machine' ? 'system' : seg.category === 'understanding' ? 'worker' : 'foreman',
    type: 'time',
    step: seg.step,
    timeCategory: seg.category,
    durationMs,
    packVersion: sja?.packVersion ?? 0,
  });
}

export const timing = {
  enter(runId: string, category: TimeCategory, step?: string) {
    if (paused) {
      paused = { runId, category, step };
      return;
    }
    if (segment && segment.runId === runId && segment.category === category && segment.step === step) return;
    if (segment) emit(segment);
    segment = { runId, category, step, started: Date.now() };
    notify();
  },
  close() {
    if (segment) emit(segment);
    segment = null;
    paused = null;
    notify();
  },
  /** Run a blocking machine step. Its duration is logged as machine time. */
  async machine<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    const prev = segment ? { ...segment } : null;
    timing.enter(runId, 'machine', prev?.step);
    try {
      return await fn();
    } finally {
      if (prev && !paused) timing.enter(prev.runId, prev.category, prev.step);
      else if (!paused) timing.close();
    }
  },
  /** The observer can mark a pause, so idle time does not inflate a category. */
  pause() {
    if (!segment) return;
    emit(segment);
    paused = { runId: segment.runId, category: segment.category, step: segment.step };
    segment = null;
    notify();
  },
  resume() {
    if (!paused) return;
    segment = { ...paused, started: Date.now() };
    paused = null;
    notify();
  },
  isPaused: () => paused !== null,
  current: () => segment,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
