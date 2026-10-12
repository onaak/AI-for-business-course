import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractJson, loadPrompts, renderPrompt } from '../../server/gateway';
import { anthropicProvider } from '../../server/providers/anthropic';
import { openAiCompatibleProvider } from '../../server/providers/openai-compatible';
import { replayKey, type ReplayFixture } from '../../server/providers/replay';
import { outputSchemas, TASKS } from '../../src/core/schemas';
import { dataDir, makeGateway, root } from '../helpers';

const fixtureFiles = () => TASKS.map((t) => JSON.parse(readFileSync(path.join(dataDir, 'fixtures', 'llm', `${t}.json`), 'utf8')) as Record<string, ReplayFixture>);

describe('Prompt files', () => {
  it('each of P1–P6 has a version header, a system part and a user part', () => {
    const prompts = loadPrompts(path.join(root, 'prompts'));
    for (const t of TASKS) {
      expect(prompts[t].version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(prompts[t].system.length).toBeGreaterThan(100);
      expect(prompts[t].system).toContain('Return only a JSON object');
    }
  });
  it('the back-translation prompt is built from the target text alone', () => {
    const p5 = loadPrompts(path.join(root, 'prompts')).P5;
    const { user } = renderPrompt(p5, { lang: 'pl', text: 'Wygrodź teren.' });
    expect(user).toContain('Wygrodź teren.');
    expect(p5.user).not.toMatch(/\{\{source\}\}/);
  });
});

describe('Contract: every stored response validates against its schema', () => {
  it('replay fixtures are well-formed and correctly keyed', () => {
    let n = 0;
    for (const file of fixtureFiles()) {
      for (const [key, fx] of Object.entries(file)) {
        n += 1;
        expect(replayKey(fx.task, fx.promptVersion, fx.input)).toBe(key);
        expect(() => outputSchemas[fx.task].parse(extractJson(fx.rawOutput))).not.toThrow();
        expect(['scripted', 'recorded']).toContain(fx.origin);
      }
    }
    expect(n).toBeGreaterThan(100);
  });
});

describe('Gateway', () => {
  it('replay returns the stored response and marks it as replay', async () => {
    const gw = makeGateway();
    const fx = Object.values(fixtureFiles()[4])[0]; // a P5 fixture
    const call = await gw.call('P5', fx.input, 'run-a');
    expect(call.mode).toBe('replay');
    expect(call.fixtureOrigin).toBe('scripted');
    expect(call.parsed).toEqual(JSON.parse(fx.rawOutput));
    const log = readFileSync(path.join(gw.cfg.evidenceDir, 'calls', 'run-a.jsonl'), 'utf8').trim().split('\n');
    expect(JSON.parse(log[0])).toMatchObject({ task: 'P5', promptVersion: gw.prompts.P5.version, mode: 'replay' });
  });

  it('replay fails visibly when no response is stored', async () => {
    const gw = makeGateway();
    await expect(gw.call('P5', { lang: 'pl', text: 'Tego zdania nie ma w nagraniach.' }, 'run-b')).rejects.toThrow(/no stored response/i);
    const log = readFileSync(path.join(gw.cfg.evidenceDir, 'calls', 'run-b.jsonl'), 'utf8');
    expect(JSON.parse(log.trim()).error).toMatch(/no stored response/i);
  });

  it('D6: rejects a payload with a field that is not on the allow-list, before any prompt is built', async () => {
    const gw = makeGateway();
    await expect(gw.call('P1', { jobType: 'x', parameters: [], freeText: 'y', answers: [], siteLabel: 'Byggeplass 7' }, 'run-c')).rejects.toThrow(/D6/);
    await expect(gw.call('P5', { lang: 'pl', text: 'x', source: 'the original' }, 'run-c')).rejects.toThrow(/D6/);
    expect(readdirSync(gw.cfg.evidenceDir)).not.toContain('calls'); // nothing was sent or logged
  });

  it('malformed model output: one retry, then a visible error (AC-28)', async () => {
    let n = 0;
    const gw = makeGateway({ mode: 'live', models: { P5: 'm' }, provider: { name: 'bad', complete: async () => `not json ${++n}` } });
    await expect(gw.call('P5', { lang: 'pl', text: 'x' }, 'run-d')).rejects.toThrow(/failed after one retry/);
    expect(n).toBe(2);
    const logged = JSON.parse(readFileSync(path.join(gw.cfg.evidenceDir, 'calls', 'run-d.jsonl'), 'utf8').trim());
    expect(logged).toMatchObject({ retries: 1, parsed: null });
  });

  it('a malformed stored response takes the same retry-then-error path', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'sja-fx-'));
    const gw0 = makeGateway();
    const input = { lang: 'pl', text: 'x' };
    const key = replayKey('P5', gw0.prompts.P5.version, input);
    writeFileSync(path.join(dir, 'P5.json'), JSON.stringify({ [key]: { task: 'P5', promptVersion: gw0.prompts.P5.version, inputHash: key, origin: 'recorded', model: 'm', recordedAt: '', input, rawOutput: '{"tekst": 1}' } }));
    const gw = makeGateway({ fixturesDir: dir });
    await expect(gw.call('P5', input, 'run-e')).rejects.toThrow(/failed after one retry/);
  });

  it('second attempt succeeds: the call is returned with retries = 1', async () => {
    let n = 0;
    const gw = makeGateway({ mode: 'live', models: { P5: 'm' }, provider: { name: 'flaky', complete: async () => (++n === 1 ? 'oops' : '```json\n{"text":"Sperr av området."}\n```') } });
    const call = await gw.call('P5', { lang: 'pl', text: 'x' }, 'run-f');
    expect(call.retries).toBe(1);
    expect(call.parsed).toEqual({ text: 'Sperr av området.' });
  });

  it('record mode stores the response as a replay fixture that replay mode then finds', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'sja-rec-'));
    const rec = makeGateway({ mode: 'record', fixturesDir: dir, models: { P5: 'model-x' }, provider: { name: 'ok', complete: async () => '{"text":"Hei"}' } });
    await rec.call('P5', { lang: 'pl', text: 'Cześć' }, 'run-g');
    const replay = makeGateway({ fixturesDir: dir });
    const call = await replay.call('P5', { lang: 'pl', text: 'Cześć' }, 'run-g');
    expect(call).toMatchObject({ mode: 'replay', fixtureOrigin: 'recorded', model: 'model-x', parsed: { text: 'Hei' } });
  });

  it('live mode without a provider or model fails with a clear message', async () => {
    await expect(makeGateway({ mode: 'live' }).call('P5', { lang: 'pl', text: 'x' }, 'r')).rejects.toThrow(/No model provider is configured/);
  });
});

describe('Provider adapters against a local stand-in server (no real model)', () => {
  let server: http.Server;
  let base = '';
  const seen: { url: string; headers: http.IncomingHttpHeaders; body: any }[] = [];
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw);
        seen.push({ url: req.url ?? '', headers: req.headers, body });
        res.setHeader('content-type', 'application/json');
        if (req.url === '/v1/messages') res.end(JSON.stringify({ content: [{ type: 'text', text: '{"text":"fra anthropic-format"}' }] }));
        else if (req.url === '/v1/chat/completions') res.end(JSON.stringify({ choices: [{ message: { content: '{"text":"fra openai-format"}' } }] }));
        else {
          res.statusCode = 500;
          res.end('{"error":"nope"}');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(() => server.close());

  it('Anthropic format: sends key header, system, user and temperature; reads the text block', async () => {
    const gw = makeGateway({ mode: 'live', models: { P5: 'some-model' }, temperature: 0, provider: anthropicProvider('k-123', base) });
    const call = await gw.call('P5', { lang: 'pl', text: 'Wygrodź teren.' }, 'run-h');
    expect(call.parsed).toEqual({ text: 'fra anthropic-format' });
    const req = seen.find((s) => s.url === '/v1/messages')!;
    expect(req.headers['x-api-key']).toBe('k-123');
    expect(req.body).toMatchObject({ model: 'some-model', temperature: 0 });
    expect(req.body.messages[0].content).toContain('Wygrodź teren.');
  });
  it('OpenAI-compatible format: sends bearer key and messages; reads the first choice', async () => {
    const gw = makeGateway({ mode: 'live', models: { P5: 'other-model' }, temperature: null, provider: openAiCompatibleProvider('k-456', `${base}/v1`) });
    const call = await gw.call('P5', { lang: 'lt', text: 'Aptverkite zoną.' }, 'run-i');
    expect(call.parsed).toEqual({ text: 'fra openai-format' });
    const req = seen.find((s) => s.url === '/v1/chat/completions')!;
    expect(req.headers.authorization).toBe('Bearer k-456');
    expect(req.body.temperature).toBeUndefined();
    expect(req.body.messages.map((m: any) => m.role)).toEqual(['system', 'user']);
  });
  it('a provider error becomes a retry and then a visible error', async () => {
    const gw = makeGateway({ mode: 'live', models: { P5: 'm' }, provider: openAiCompatibleProvider('k', `${base}/nowhere`) });
    await expect(gw.call('P5', { lang: 'pl', text: 'x' }, 'run-j')).rejects.toThrow(/failed after one retry/);
  });
});
