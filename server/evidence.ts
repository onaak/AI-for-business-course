// Evidence writer: runs, call logs and exports as plain files in evidence/ (plan section 5).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const safe = (name: string) => name.replace(/[^\w.-]/g, '_').slice(0, 100);

export class Evidence {
  constructor(private dir: string) {
    for (const sub of ['runs', 'calls', 'exports']) mkdirSync(path.join(dir, sub), { recursive: true });
  }

  listRuns(): unknown[] {
    const dir = path.join(this.dir, 'runs');
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const r = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
          return {
            runId: r.runId,
            savedAt: r.savedAt,
            templateId: r.sja?.templateId,
            status: r.sja?.status,
            testId: r.sja?.testId,
            fixtureId: r.sja?.fixtureId,
            mode: r.sja?.versions?.mode,
            fixtureOrigins: r.sja?.versions?.fixtureOrigins ?? [],
            languages: r.sja?.languages ?? [],
            note: r.note,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  getRun(runId: string): unknown | null {
    const f = path.join(this.dir, 'runs', `${safe(runId)}.json`);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  }

  saveRun(runId: string, record: unknown): string {
    const f = path.join(this.dir, 'runs', `${safe(runId)}.json`);
    writeFileSync(f, `${JSON.stringify(record, null, 2)}\n`);
    return f;
  }

  getCalls(runId: string): unknown[] {
    const f = path.join(this.dir, 'calls', `${safe(runId)}.jsonl`);
    if (!existsSync(f)) return [];
    return readFileSync(f, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }

  saveExport(name: string, content: string): string {
    const f = path.join(this.dir, 'exports', safe(name));
    writeFileSync(f, content);
    return path.relative(path.dirname(this.dir), f);
  }
}
