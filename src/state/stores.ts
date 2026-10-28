// Browser state. Kept on the device (browser storage) and exportable as files.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api, type ServerConfig } from '../api';
import type { PairResult } from '../core/metrics';
import { upgradeSja } from '../core/rules/understanding';
import type { DataPack, HazardList, LogEvent, ReviewerSession, Sja, TimeCategory, TraceEntry } from '../core/types';
import { nowIso, uid } from '../core/util';

/** Browser storage that never throws: a full or blocked store must not break a test session. */
export const storageProblem = { message: '' };
const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
      storageProblem.message = '';
    } catch (e) {
      storageProblem.message = e instanceof Error ? e.message : String(e);
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing to do */
    }
  },
}));

// ---------- app: language, reviewer session, data from the server ----------

interface AppState {
  lang: 'nb' | 'en';
  /** Chosen with the eye switch in the header (full or clean view). The server's APP_MODE=field always wins. */
  viewMode: 'lab' | 'field';
  /** The role tab open on Home. */
  homeTab: HomeTab;
  setHomeTab: (tab: HomeTab) => void;
  reviewer: ReviewerSession | null;
  config: ServerConfig | null;
  pack: DataPack | null;
  hazards: HazardList[];
  fixtures: Record<string, any> | null;
  loadError: string | null;
  setLang: (lang: 'nb' | 'en') => void;
  setViewMode: (mode: 'lab' | 'field') => void;
  setReviewer: (r: ReviewerSession | null) => void;
  load: () => Promise<void>;
  setPack: (pack: DataPack) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: 'nb',
      viewMode: 'lab',
      homeTab: 'foreman',
      setHomeTab: (homeTab) => set({ homeTab }),
      reviewer: null,
      config: null,
      pack: null,
      hazards: [],
      fixtures: null,
      loadError: null,
      setLang: (lang) => set({ lang }),
      setViewMode: (viewMode) => set({ viewMode }),
      setReviewer: (reviewer) => set({ reviewer }),
      setPack: (pack) => set({ pack }),
      load: async () => {
        try {
          const [config, pack, hazards, fixtures] = await Promise.all([api.config(), api.pack(), api.hazards(), api.fixtures()]);
          set({ config, pack, hazards, fixtures, loadError: null });
        } catch (e) {
          set({ loadError: e instanceof Error ? e.message : String(e) });
        }
      },
    }),
    { name: 'sja-forstatt-app', storage: safeStorage, partialize: (s) => ({ lang: s.lang, reviewer: s.reviewer, viewMode: s.viewMode, homeTab: s.homeTab }) as AppState },
  ),
);

/**
 * Field mode (V1): the clean version for people outside the group. No test bench, baseline
 * timer, saved-runs list, observer link, trace panel, English toggle or technical status.
 * Forced by the server (APP_MODE=field), or chosen with the eye switch in the header.
 */
export type HomeTab = 'foreman' | 'worker' | 'manager' | 'reviewer' | 'project';

export function isFieldMode(s: Pick<AppState, 'config' | 'viewMode'>): boolean {
  return s.config?.appMode === 'field' || s.viewMode === 'field';
}
export const useFieldMode = () => useApp(isFieldMode);

// ---------- SJAs and their traces ----------

interface SjaState {
  sjas: Record<string, Sja>;
  traces: Record<string, TraceEntry[]>;
  put: (sja: Sja) => void;
  remove: (sjaId: string) => void;
  addTrace: (sjaId: string, entry: Omit<TraceEntry, 'seq' | 'at'>) => void;
  dropTrace: (sjaId: string) => void;
  clear: () => void;
}

export const useSjas = create<SjaState>()(
  persist(
    (set) => ({
      sjas: {},
      traces: {},
      put: (sja) => set((s) => ({ sjas: { ...s.sjas, [sja.sjaId]: sja } })),
      remove: (sjaId) =>
        set((s) => {
          const sjas = { ...s.sjas };
          const traces = { ...s.traces };
          delete sjas[sjaId];
          delete traces[sjaId];
          return { sjas, traces };
        }),
      addTrace: (sjaId, entry) =>
        set((s) => {
          const list = s.traces[sjaId] ?? [];
          return { traces: { ...s.traces, [sjaId]: [...list, { ...entry, seq: list.length + 1, at: nowIso() }] } };
        }),
      dropTrace: (sjaId) =>
        set((s) => {
          const traces = { ...s.traces };
          delete traces[sjaId];
          return { traces };
        }),
      clear: () => set({ sjas: {}, traces: {} }),
    }),
    {
      name: 'sja-forstatt-sjas',
      storage: safeStorage,
      // Version 2: the understanding check of brief v3. SJAs stored by the earlier version are brought into the new shape.
      version: 2,
      migrate: (state) => {
        const old = (state ?? {}) as Partial<SjaState>;
        return { ...old, sjas: Object.fromEntries(Object.entries(old.sjas ?? {}).map(([id, sja]) => [id, upgradeSja(sja)])), traces: old.traces ?? {} } as SjaState;
      },
    },
  ),
);

// ---------- anonymous event log, bench results, test log, baseline ----------

export interface TestLogRow {
  rowId: string;
  number: string; // T1 … T8, with a round suffix where needed
  caseType: string;
  scenario: string;
  expected: string;
  observed: string; // typed by a person, never generated
  learning: string; // typed by a person, never generated
}

export interface BenchRun {
  benchId: string;
  at: string;
  kind: 'pairs' | 'pasted' | 'edge' | 'ambiguity' | 'slang';
  packVersion: number;
  packHash: string;
  promptVersions: Record<string, string>;
  mode: string;
  origins: string[];
  langs: string[];
  results: Record<string, PairResult>;
  extra?: unknown;
}

export interface BaselineEntry {
  entryId: string;
  at: string;
  testId: string;
  label: string;
  category: TimeCategory;
  durationMs: number;
}

export interface StandaloneResult {
  sessionId: string;
  at: string;
  templateId: string;
  label: string;
  arm: 'baseline' | 'flagship';
  respondents: number;
  perQuestion: { questionId: string; respondents: number; correctFirst: number }[];
}

interface LogState {
  events: LogEvent[];
  testLog: TestLogRow[];
  benchRuns: BenchRun[];
  baseline: BaselineEntry[];
  standalone: StandaloneResult[];
  add: (e: Omit<LogEvent, 'eventId' | 'at'>) => void;
  setTestLog: (rows: TestLogRow[]) => void;
  addBenchRun: (run: BenchRun) => void;
  updateBenchRun: (run: BenchRun) => void;
  addBaseline: (e: Omit<BaselineEntry, 'entryId' | 'at'>) => void;
  removeBaseline: (entryId: string) => void;
  putStandalone: (r: StandaloneResult) => void;
  clear: () => void;
}

export const useLog = create<LogState>()(
  persist(
    (set) => ({
      events: [],
      testLog: [],
      benchRuns: [],
      baseline: [],
      standalone: [],
      add: (e) => set((s) => ({ events: [...s.events, { ...e, eventId: uid('ev'), at: nowIso() }] })),
      setTestLog: (testLog) => set({ testLog }),
      addBenchRun: (run) => set((s) => ({ benchRuns: [run, ...s.benchRuns].slice(0, 30) })),
      updateBenchRun: (run) => set((s) => ({ benchRuns: s.benchRuns.map((b) => (b.benchId === run.benchId ? run : b)) })),
      addBaseline: (e) => set((s) => ({ baseline: [...s.baseline, { ...e, entryId: uid('bl'), at: nowIso() }] })),
      removeBaseline: (entryId) => set((s) => ({ baseline: s.baseline.filter((b) => b.entryId !== entryId) })),
      putStandalone: (r) => set((s) => ({ standalone: [...s.standalone.filter((x) => x.sessionId !== r.sessionId), r] })),
      clear: () => set({ events: [], testLog: [], benchRuns: [], baseline: [], standalone: [] }),
    }),
    { name: 'sja-forstatt-log', storage: safeStorage },
  ),
);
