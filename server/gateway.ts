// Model gateway: load prompt → call model → validate → log call → return.
// Modes: live · record · replay (plan 4.4). Prompts are assembled here, on the
// server, from a fixed list of fields per task (D6). Header fields have no way in.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inputSchemas, outputSchemas, TASKS } from '../src/core/schemas';
import type { ModelCall, Task } from '../src/core/types';
import { uid } from '../src/core/util';
import { ReplayStore, replayKey } from './providers/replay';
import { GatewayError, RateLimitError, type Provider } from './providers/types';

export type Mode = 'live' | 'record' | 'replay';

export interface Prompt {
  id: Task;
  version: string;
  title: string;
  capability: string;
  system: string;
  user: string;
  raw: string;
  file: string;
}

const PROMPT_FILES: Record<Task, string> = {
  P1: 'P1_normalise.md',
  P2: 'P2_adapt.md',
  P3: 'P3_ambiguity.md',
  P4: 'P4_translate.md',
  P5: 'P5_backtranslate.md',
  P6: 'P6_compare.md',
  P7: 'P7_worker_answer.md',
};

export function loadPrompts(dir: string): Record<Task, Prompt> {
  const out = {} as Record<Task, Prompt>;
  for (const task of TASKS) {
    const file = PROMPT_FILES[task];
    const raw = readFileSync(path.join(dir, file), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`Prompt ${file} has no version header.`);
    const head = Object.fromEntries(
      m[1]
        .split('\n')
        .map((l) => l.match(/^(\w+):\s*(.*)$/))
        .filter((x): x is RegExpMatchArray => Boolean(x))
        .map((x) => [x[1], x[2].trim()]),
    );
    const body = m[2];
    const sys = body.match(/# System\n([\s\S]*?)\n# User\n/);
    const usr = body.match(/# User\n([\s\S]*)$/);
    if (!sys || !usr || !head.version) throw new Error(`Prompt ${file} is missing "# System", "# User" or a version.`);
    out[task] = { id: task, version: head.version, title: head.title ?? task, capability: head.capability ?? '', system: sys[1].trim(), user: usr[1].trim(), raw, file };
  }
  return out;
}

/** Fill {{field}} placeholders from the validated input. Only allow-listed fields exist at this point. */
export function renderPrompt(prompt: Prompt, input: Record<string, unknown>): { system: string; user: string } {
  const fill = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = input[key];
      if (v === undefined) return '';
      return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    });
  return { system: fill(prompt.system), user: fill(prompt.user) };
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in the model output.');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Tasks whose input is a worker's own words (U3). Outside the test bench the text is not
 * kept: the call log holds only that a call was made, and record mode stores no fixture.
 */
export const NOT_KEPT: Task[] = ['P7'];
export const keepsText = (task: Task, runId: string) => !NOT_KEPT.includes(task) || runId.startsWith('bench') || runId.startsWith('fixture');
const redact = (call: ModelCall): ModelCall =>
  keepsText(call.task, call.runId) ? call : { ...call, input: '[worker text not kept]', rawOutput: call.rawOutput ? '[not kept]' : '', parsed: call.parsed === null ? null : '[not kept]' };

const withoutExamples = (input: Record<string, unknown>) => {
  const { examples: _examples, ...rest } = input;
  return rest;
};

export interface GatewayConfig {
  mode: Mode;
  provider: Provider | null;
  /** Optional different provider for some tasks, e.g. a local model for back-translation (P5). */
  providerFor?: Partial<Record<Task, Provider>>;
  models: Partial<Record<Task, string>>;
  temperature: number | null;
  promptsDir: string;
  fixturesDir: string;
  evidenceDir: string;
  /** Origin written into fixtures in record mode. */
  recordOrigin?: 'recorded' | 'scripted';
  /** Pacing for live calls (free tiers limit requests per minute). Not used in replay. */
  limits?: Partial<CallLimits>;
}

export interface CallLimits {
  /** At most this many model calls at the same time. */
  maxParallel: number;
  /** At least this long between the starts of two model calls. 0 = no spacing. */
  minIntervalMs: number;
  /** How often to wait and try again after "too many requests". These waits are not the one retry. */
  rateLimitWaits: number;
  /** Longest single wait after "too many requests". */
  maxWaitMs: number;
  /** Replaced in tests. */
  sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_LIMITS: CallLimits = {
  maxParallel: 3,
  minIntervalMs: 0,
  rateLimitWaits: 5,
  maxWaitMs: 60_000,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Lets at most `max` calls run at once, and spaces their starts by `interval` ms. */
class Pacer {
  private running = 0;
  private queue: (() => void)[] = [];
  private nextStart = 0;
  constructor(private limits: CallLimits) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= Math.max(1, this.limits.maxParallel)) await new Promise<void>((r) => this.queue.push(r));
    this.running += 1;
    try {
      const wait = this.nextStart - Date.now();
      this.nextStart = Math.max(Date.now(), this.nextStart) + this.limits.minIntervalMs;
      if (wait > 0) await this.limits.sleep(wait);
      return await fn();
    } finally {
      this.running -= 1;
      this.queue.shift()?.();
    }
  }
}

export class Gateway {
  readonly prompts: Record<Task, Prompt>;
  readonly store: ReplayStore;
  readonly limits: CallLimits;
  private pacer: Pacer;
  /** Waits after "too many requests" since the server started (shown in /api/config). */
  rateLimitWaits = 0;

  constructor(readonly cfg: GatewayConfig) {
    this.prompts = loadPrompts(cfg.promptsDir);
    this.store = new ReplayStore(cfg.fixturesDir);
    this.limits = { ...DEFAULT_LIMITS, ...(cfg.limits ?? {}) };
    this.pacer = new Pacer(this.limits);
  }

  providerOf(task: Task): Provider | null {
    return this.cfg.providerFor?.[task] ?? this.cfg.provider;
  }

  /** One provider request, paced, waiting and trying again on "too many requests". */
  private async complete(req: Parameters<Provider['complete']>[0], waited: { ms: number }): Promise<string> {
    const provider = this.providerOf(req.task as Task)!;
    for (let wait = 0; ; wait++) {
      try {
        return await this.pacer.run(() => provider.complete(req));
      } catch (err) {
        if (!(err instanceof RateLimitError) || wait >= this.limits.rateLimitWaits) throw err;
        const ms = Math.min(this.limits.maxWaitMs, err.retryAfterMs ?? 2000 * 2 ** wait);
        this.rateLimitWaits += 1;
        waited.ms += ms;
        console.warn(`  ${req.task ?? ''}: the model provider says too many requests. Waiting ${Math.round(ms / 1000)} s (wait ${wait + 1} of ${this.limits.rateLimitWaits}).`);
        await this.limits.sleep(ms);
      }
    }
  }

  private logCall(call: ModelCall) {
    const dir = path.join(this.cfg.evidenceDir, 'calls');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const safe = call.runId.replace(/[^\w.-]/g, '_').slice(0, 80) || 'unknown';
    appendFileSync(path.join(dir, `${safe}.jsonl`), `${JSON.stringify(redact(call))}\n`);
  }

  /**
   * Replay mode: is there a stored answer for this input? Lets the interface grey out the
   * choices a demo cannot answer, instead of failing after the foreman picks one.
   * Outside replay mode every valid input can be answered.
   */
  hasStored(task: Task, rawInput: unknown): boolean {
    if (!TASKS.includes(task)) return false;
    const checked = inputSchemas[task].safeParse(rawInput);
    if (!checked.success) return false;
    if (this.cfg.mode !== 'replay') return true;
    const input = checked.data as Record<string, unknown>;
    const version = this.prompts[task].version;
    return Boolean(this.store.get(task, version, input) ?? (input.examples ? this.store.get(task, version, withoutExamples(input)) : null));
  }

  async call(task: Task, rawInput: unknown, runId: string): Promise<ModelCall> {
    if (!TASKS.includes(task)) throw new GatewayError(400, `Unknown task "${String(task)}".`, 'unknown_task');

    // D6: a fixed list of fields per task. Anything else is rejected before a prompt exists.
    const checked = inputSchemas[task].safeParse(rawInput);
    if (!checked.success) {
      throw new GatewayError(400, `D6: the payload for ${task} contains a field that is not allowed, or is malformed. ${checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, 'payload_rejected');
    }
    const input = checked.data as Record<string, unknown>;
    const prompt = this.prompts[task];
    const { system, user } = renderPrompt(prompt, input);
    const started = Date.now();
    const base = {
      callId: uid('call'),
      runId,
      task,
      promptVersion: prompt.version,
      mode: this.cfg.mode,
      input,
      at: new Date().toISOString(),
    };

    let rawOutput = '';
    let model = this.cfg.models[task] ?? '';
    let fixtureOrigin: ModelCall['fixtureOrigin'];
    let retries = 0;
    let lastError = '';
    // Time spent waiting after "too many requests" (free tiers). Part of durationMs; logged so it can be taken out.
    const waited = { ms: 0 };
    const waitInfo = () => (waited.ms > 0 ? { rateLimitWaitMs: waited.ms } : {});

    // One automatic retry, then a visible error. Nothing is silently skipped (7.3).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (this.cfg.mode === 'replay') {
          // A stored answer recorded before reviewers had verified anything has no examples (L2): fall back to it.
          const fx = this.store.get(task, prompt.version, input) ?? (input.examples ? this.store.get(task, prompt.version, withoutExamples(input)) : null);
          if (!fx) {
            lastError = `Replay mode: no stored response for this input (${task}, prompt ${prompt.version}). Use one of the saved test jobs, or switch to live mode with an API key.`;
            throw new GatewayError(424, lastError, 'no_fixture');
          }
          rawOutput = fx.rawOutput;
          model = fx.model;
          fixtureOrigin = fx.origin;
        } else {
          if (!this.providerOf(task)) throw new GatewayError(500, 'No model provider is configured. Set LLM_PROVIDER and LLM_API_KEY in .env.', 'not_configured');
          if (!model) throw new GatewayError(500, `No model name is configured for ${task}. Set MODEL_DEFAULT in .env.`, 'not_configured');
          rawOutput = await this.complete({ system, user, model, temperature: this.cfg.temperature, task, input }, waited);
        }
        const parsed = outputSchemas[task].parse(extractJson(rawOutput));
        const call: ModelCall = { ...base, model, fixtureOrigin, rawOutput, parsed, durationMs: Date.now() - started, retries, ...waitInfo() };
        if (this.cfg.mode === 'record' && keepsText(task, runId)) {
          this.store.put({
            task,
            promptVersion: prompt.version,
            inputHash: replayKey(task, prompt.version, input),
            origin: this.cfg.recordOrigin ?? 'recorded',
            model,
            recordedAt: call.at,
            input,
            rawOutput,
          });
        }
        this.logCall(call);
        return call;
      } catch (err) {
        if (err instanceof GatewayError && (err.code === 'no_fixture' || err.code === 'not_configured')) {
          this.logCall({ ...base, model, rawOutput: '', parsed: null, durationMs: Date.now() - started, retries, error: err.message });
          throw err;
        }
        lastError = err instanceof Error ? err.message : String(err);
        retries = attempt + 1;
      }
    }
    const message = `${task} failed after one retry: ${lastError.slice(0, 400)}`;
    this.logCall({ ...base, model, fixtureOrigin, rawOutput, parsed: null, durationMs: Date.now() - started, retries: 1, error: message, ...waitInfo() });
    throw new GatewayError(502, message, 'model_failed');
  }
}
