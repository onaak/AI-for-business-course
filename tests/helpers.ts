import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures, loadHazards, loadSeedPack } from '../server/data';
import { Gateway, type GatewayConfig } from '../server/gateway';
import type { FlowCtx } from '../src/core/flow';
import * as flow from '../src/core/flow';
import type { LogEvent, ModelCall, ModelClient, Sja, Task, TraceEntry } from '../src/core/types';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = path.join(root, 'data');
export const seedPack = () => loadSeedPack(dataDir);
export const hazards = () => loadHazards(dataDir);
export const fixtures = () => loadFixtures(dataDir) as any;

export function makeGateway(over: Partial<GatewayConfig> = {}) {
  return new Gateway({
    mode: 'replay',
    provider: null,
    models: {},
    temperature: 0,
    promptsDir: path.join(root, 'prompts'),
    fixturesDir: path.join(dataDir, 'fixtures', 'llm'),
    evidenceDir: mkdtempSync(path.join(os.tmpdir(), 'sja-test-')),
    ...over,
  });
}

export function clientFor(gw: Gateway, calls: ModelCall[] = []): ModelClient {
  return {
    async call<T>(task: Task, input: unknown, meta: { runId: string }) {
      const call = await gw.call(task, input, meta.runId);
      calls.push(call);
      return { parsed: call.parsed as T, call };
    },
  };
}

export function makeCtx(templateId: string, client: ModelClient) {
  const pack = seedPack();
  const events: flow.LogInput[] = [];
  const trace: flow.TraceInput[] = [];
  const ctx: FlowCtx = {
    pack,
    template: pack.templates.find((t) => t.templateId === templateId)!,
    hazards: hazards().find((h) => h.templateId === templateId),
    client,
    log: (e) => events.push(e),
    trace: (e) => trace.push(e),
  };
  return { ctx, events, trace, pack };
}

export const HEADER = { siteLabel: 'HEMMELIG-BYGGEPLASS-77', date: '2026-10-05', foremanRole: 'Bas ZZTOPSECRET' };

export function startJob(ctx: FlowCtx, id: string, over: Partial<flow.SjaInit> = {}): Sja {
  const job = (fixtures()['job-descriptions'] as any[]).find((j) => j.id === id);
  return flow.createSja(
    ctx.pack,
    ctx.template,
    { header: HEADER, parameterValues: job.parameterValues, freeText: job.freeText, languages: job.languages, crewFlags: job.crewFlags, products: job.products, fixtureId: id, ...over },
    `test-${id}`,
  );
}

export function settle(ctx: FlowCtx, s: Sja): Sja {
  for (const l of s.lines.filter((x) => x.aiSuggestion === 'open')) s = flow.decideSuggestion(ctx, s, l.lineId, true);
  for (const l of s.lines.filter((x) => x.techRecheck === 'open')) s = flow.confirmTechRecheck(ctx, s, l.lineId);
  return s;
}

export type { LogEvent, TraceEntry };
