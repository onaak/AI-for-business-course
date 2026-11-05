// Everything the browser asks of the local server. The browser never holds an API
// key and never builds a prompt: it sends a task name and allow-listed data.
import type { DataPack, HazardList, ModelCall, ModelClient, RunRecord, Task } from './core/types';

export interface ServerConfig {
  mode: 'live' | 'record' | 'replay';
  provider: string;
  configured: boolean;
  /** lab: every screen. field: the clean version (V1). */
  appMode?: 'lab' | 'field';
  /** True while shared through a tunnel: keys and corrections cannot be saved. */
  packReadOnly?: boolean;
  rateLimitWaits?: number;
  backTranslationProvider?: string | null;
  models: Partial<Record<Task, string>>;
  backTranslationUsesSameModel: boolean;
  promptVersions: Record<Task, string>;
  fixtures: { total: number; scripted: number; recorded: number };
}

export interface RunSummary {
  runId: string;
  savedAt: string;
  templateId: string;
  status: string;
  testId?: string;
  fixtureId?: string;
  mode?: string;
  fixtureOrigins: string[];
  languages: string[];
  note?: string;
}

export interface PromptFile {
  id: Task;
  version: string;
  title: string;
  capability: string;
  file: string;
  raw: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
  } catch {
    throw new Error('No connection to the local server.');
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw Object.assign(new Error(json?.error ?? `Server answered ${res.status}`), { status: res.status });
  return json as T;
}

export const api = {
  config: () => request<ServerConfig>('/api/config'),
  /** Which inputs can be answered now; in replay mode, which have a stored answer. */
  available: (items: { task: Task; input: unknown }[]) => request<{ available: boolean[] }>('/api/llm/available', { method: 'POST', body: JSON.stringify({ items }) }),
  pack: () => request<DataPack>('/api/data/pack'),
  savePack: (pack: DataPack) => request<DataPack>('/api/data/pack', { method: 'PUT', body: JSON.stringify(pack) }),
  resetPack: () => request<DataPack>('/api/data/pack/reset', { method: 'POST' }),
  hazards: () => request<HazardList[]>('/api/data/hazards'),
  fixtures: () => request<Record<string, any>>('/api/data/fixtures'),
  prompts: () => request<{ prompts: PromptFile[]; changelog: string }>('/api/prompts'),
  runs: () => request<RunSummary[]>('/api/evidence/runs'),
  run: (runId: string) => request<RunRecord>(`/api/evidence/runs/${encodeURIComponent(runId)}`),
  /** The saved file, or null when the run has not been saved yet. */
  runIfSaved: (runId: string) =>
    request<RunRecord | null>(`/api/evidence/runs/${encodeURIComponent(runId)}?optional=1`).catch((e) => {
      // A server process started before this route existed answers 404 for "not saved yet". That is still "no file".
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }),
  saveRun: (record: RunRecord) => request<{ ok: boolean }>(`/api/evidence/runs/${encodeURIComponent(record.runId)}`, { method: 'PUT', body: JSON.stringify(record) }),
  calls: (runId: string) => request<ModelCall[]>(`/api/evidence/calls/${encodeURIComponent(runId)}`),
  saveExport: (name: string, content: string) => request<{ file: string }>('/api/evidence/exports', { method: 'POST', body: JSON.stringify({ name, content }) }),
};

export const modelClient: ModelClient = {
  async call<T>(task: Task, input: unknown, meta: { runId: string }) {
    return request<{ parsed: T; call: ModelCall }>('/api/llm', { method: 'POST', body: JSON.stringify({ task, input, runId: meta.runId }) });
  },
};
