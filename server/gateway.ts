// Model gateway: load prompt → call model → validate → log call → return.
// Modes: live · record · replay (plan 4.4). Prompts are assembled here, on the
// server, from a fixed list of fields per task (D6). Header fields have no way in.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inputSchemas, outputSchemas, TASKS } from '../src/core/schemas';
import type { ModelCall, Task } from '../src/core/types';
import { uid } from '../src/core/util';
import { ReplayStore, replayKey } from './providers/replay';
import { GatewayError, type Provider } from './providers/types';

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

export interface GatewayConfig {
  mode: Mode;
  provider: Provider | null;
  models: Partial<Record<Task, string>>;
  temperature: number | null;
  promptsDir: string;
  fixturesDir: string;
  evidenceDir: string;
  /** Origin written into fixtures in record mode. */
  recordOrigin?: 'recorded' | 'scripted';
}

export class Gateway {
  readonly prompts: Record<Task, Prompt>;
  readonly store: ReplayStore;

  constructor(readonly cfg: GatewayConfig) {
    this.prompts = loadPrompts(cfg.promptsDir);
    this.store = new ReplayStore(cfg.fixturesDir);
  }

  private logCall(call: ModelCall) {
    const dir = path.join(this.cfg.evidenceDir, 'calls');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const safe = call.runId.replace(/[^\w.-]/g, '_').slice(0, 80) || 'unknown';
    appendFileSync(path.join(dir, `${safe}.jsonl`), `${JSON.stringify(call)}\n`);
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

    // One automatic retry, then a visible error. Nothing is silently skipped (7.3).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (this.cfg.mode === 'replay') {
          const fx = this.store.get(task, prompt.version, input);
          if (!fx) {
            lastError = `Replay mode: no stored response for this input (${task}, prompt ${prompt.version}). Use one of the saved test jobs, or switch to live mode with an API key.`;
            throw new GatewayError(424, lastError, 'no_fixture');
          }
          rawOutput = fx.rawOutput;
          model = fx.model;
          fixtureOrigin = fx.origin;
        } else {
          if (!this.cfg.provider) throw new GatewayError(500, 'No model provider is configured. Set LLM_PROVIDER and LLM_API_KEY in .env.', 'not_configured');
          if (!model) throw new GatewayError(500, `No model name is configured for ${task}. Set MODEL_DEFAULT in .env.`, 'not_configured');
          rawOutput = await this.cfg.provider.complete({ system, user, model, temperature: this.cfg.temperature, task, input });
        }
        const parsed = outputSchemas[task].parse(extractJson(rawOutput));
        const call: ModelCall = { ...base, model, fixtureOrigin, rawOutput, parsed, durationMs: Date.now() - started, retries };
        if (this.cfg.mode === 'record') {
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
    this.logCall({ ...base, model, fixtureOrigin, rawOutput, parsed: null, durationMs: Date.now() - started, retries: 1, error: message });
    throw new GatewayError(502, message, 'model_failed');
  }
}
