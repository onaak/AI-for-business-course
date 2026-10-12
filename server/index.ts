// One small server process, run locally. It exists for three reasons only: to keep
// the API key out of the browser, to keep the prompts in one place, and to write
// evidence files to disk (plan 1.8). In development it also serves the interface
// through Vite, so the whole prototype is one process on one port.
import 'dotenv/config';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS } from '../src/core/schemas';
import type { Task } from '../src/core/types';
import { loadFixtures, loadHazards, loadPack, resetPack, savePack } from './data';
import { Evidence } from './evidence';
import { Gateway, type Mode } from './gateway';
import { anthropicProvider } from './providers/anthropic';
import { openAiCompatibleProvider } from './providers/openai-compatible';
import { GatewayError, type Provider } from './providers/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.SJA_DATA_DIR ? path.resolve(process.env.SJA_DATA_DIR) : path.join(root, 'data');
const evidenceDir = process.env.SJA_EVIDENCE_DIR ? path.resolve(process.env.SJA_EVIDENCE_DIR) : path.join(root, 'evidence');
const isProd = process.argv.includes('--prod');
const port = Number(process.env.PORT ?? 5173);

function buildGateway(): Gateway {
  const mode = (['live', 'record', 'replay'].includes(process.env.GATEWAY_MODE ?? '') ? process.env.GATEWAY_MODE : 'replay') as Mode;
  const key = process.env.LLM_API_KEY ?? '';
  const name = process.env.LLM_PROVIDER ?? 'anthropic';
  let provider: Provider | null = null;
  if (mode !== 'replay' && key) {
    provider =
      name === 'openai-compatible'
        ? openAiCompatibleProvider(key, process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1')
        : anthropicProvider(key, process.env.LLM_BASE_URL_ANTHROPIC ?? 'https://api.anthropic.com');
  }
  const def = process.env.MODEL_DEFAULT ?? '';
  const models = {} as Record<Task, string>;
  for (const t of TASKS) models[t] = process.env[`MODEL_${t}`] || (t === 'P5' ? process.env.MODEL_BACKTRANSLATE || def : def);
  const temp = process.env.LLM_TEMPERATURE;
  return new Gateway({
    mode,
    provider,
    models,
    temperature: temp === undefined || temp === '' ? null : Number(temp),
    promptsDir: path.join(root, 'prompts'),
    fixturesDir: path.join(dataDir, 'fixtures', 'llm'),
    evidenceDir,
  });
}

const gateway = buildGateway();
const evidence = new Evidence(evidenceDir);
const app = express();
app.use(express.json({ limit: '10mb' }));

const wrap = (fn: (req: express.Request, res: express.Response) => unknown) => async (req: express.Request, res: express.Response) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err instanceof GatewayError ? err.status : 500;
    const code = err instanceof GatewayError ? err.code : 'server_error';
    res.status(status).json({ error: err instanceof Error ? err.message : String(err), code });
  }
};

// ---- /api/config: what the interface needs to label its output honestly ----
app.get(
  '/api/config',
  wrap((_req, res) => {
    const cfg = gateway.cfg;
    res.json({
      mode: cfg.mode,
      provider: cfg.provider?.name ?? (cfg.mode === 'replay' ? 'replay' : 'none'),
      configured: cfg.mode === 'replay' || Boolean(cfg.provider),
      models: cfg.mode === 'replay' ? {} : cfg.models,
      backTranslationUsesSameModel: cfg.models.P5 === cfg.models.P4,
      promptVersions: Object.fromEntries(TASKS.map((t) => [t, gateway.prompts[t].version])),
      fixtures: gateway.store.count(),
    });
  }),
);

// ---- /api/llm: the only way to a model ----
app.post(
  '/api/llm',
  wrap(async (req, res) => {
    const { task, input, runId } = req.body ?? {};
    const call = await gateway.call(task as Task, input, typeof runId === 'string' && runId ? runId : 'no-run');
    res.json({ parsed: call.parsed, call });
  }),
);

app.get(
  '/api/prompts',
  wrap((_req, res) => {
    const changelog = path.join(root, 'prompts', 'CHANGELOG.md');
    res.json({
      prompts: TASKS.map((t) => {
        const p = gateway.prompts[t];
        return { id: p.id, version: p.version, title: p.title, capability: p.capability, file: p.file, raw: p.raw };
      }),
      changelog: existsSync(changelog) ? readFileSync(changelog, 'utf8') : '',
    });
  }),
);

// ---- /api/data: seed data pack, working data pack, fixtures ----
app.get('/api/data/pack', wrap((_req, res) => res.json(loadPack(dataDir))));
app.put('/api/data/pack', wrap((req, res) => res.json(savePack(dataDir, req.body))));
app.post('/api/data/pack/reset', wrap((_req, res) => res.json(resetPack(dataDir))));
app.get('/api/data/hazards', wrap((_req, res) => res.json(loadHazards(dataDir))));
app.get('/api/data/fixtures', wrap((_req, res) => res.json(loadFixtures(dataDir))));

// ---- /api/evidence: runs, call logs and exports on disk ----
app.get('/api/evidence/runs', wrap((_req, res) => res.json(evidence.listRuns())));
app.get(
  '/api/evidence/runs/:runId',
  wrap((req, res) => {
    const run = evidence.getRun(String(req.params.runId));
    // `?optional=1`: "is there a saved file yet?" is an ordinary question, not an error.
    if (!run) return req.query.optional ? res.json(null) : res.status(404).json({ error: 'No such run.' });
    res.json(run);
  }),
);
app.put(
  '/api/evidence/runs/:runId',
  wrap((req, res) => {
    evidence.saveRun(String(req.params.runId), req.body);
    res.json({ ok: true });
  }),
);
app.get('/api/evidence/calls/:runId', wrap((req, res) => res.json(evidence.getCalls(String(req.params.runId)))));
app.post(
  '/api/evidence/exports',
  wrap((req, res) => {
    const { name, content } = req.body ?? {};
    if (typeof name !== 'string' || typeof content !== 'string') return res.status(400).json({ error: 'name and content are required' });
    res.json({ file: evidence.saveExport(name, content) });
  }),
);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

async function start() {
  const server = http.createServer(app);
  if (isProd) {
    const dist = path.join(root, 'dist');
    if (!existsSync(dist)) throw new Error('dist/ not found. Run "npm run build" first.');
    app.use(express.static(dist));
    app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    // Hot reload shares this server's port, so two copies of the prototype can run side by side.
    const vite = await createServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the other process, or set PORT in .env.` : err);
    process.exit(1);
  });
  server.listen(port, () => {
    const n = gateway.store.count();
    console.log(`\n  SJA Forstått prototype: http://localhost:${port}`);
    console.log(`  Model gateway mode: ${gateway.cfg.mode}${gateway.cfg.mode === 'replay' ? ` (${n.total} stored responses: ${n.scripted} scripted, ${n.recorded} recorded)` : ` via ${gateway.cfg.provider?.name ?? 'NO PROVIDER – set LLM_API_KEY'}`}`);
    console.log('  Student prototype. Synthetic content. Not a valid SJA.\n');
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
