// Replay adapter: returns a stored response. Keyed by task, prompt version and a
// hash of the input (architectural rule 5). Fails visibly if none exists.
// One JSON file per task in data/fixtures/llm, so the fixtures stay readable and diffable.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TASKS } from '../../src/core/schemas';
import type { Task } from '../../src/core/types';
import { canonicalJson } from '../../src/core/util';

export interface ReplayFixture {
  task: Task;
  promptVersion: string;
  inputHash: string;
  /** 'recorded' from a live model call, or 'scripted' (written by the builder; not model output). */
  origin: 'recorded' | 'scripted';
  model: string;
  recordedAt: string;
  input: unknown;
  rawOutput: string;
}

export function replayKey(task: Task, promptVersion: string, input: unknown): string {
  return createHash('sha256').update(`${task}\n${promptVersion}\n${canonicalJson(input)}`).digest('hex').slice(0, 24);
}

export class ReplayStore {
  private cache = new Map<Task, { mtime: number; items: Record<string, ReplayFixture> }>();

  constructor(private dir: string) {}

  private file(task: Task) {
    return path.join(this.dir, `${task}.json`);
  }

  private load(task: Task): Record<string, ReplayFixture> {
    const f = this.file(task);
    if (!existsSync(f)) return {};
    const mtime = statSync(f).mtimeMs;
    const hit = this.cache.get(task);
    if (hit && hit.mtime === mtime) return hit.items;
    const items = JSON.parse(readFileSync(f, 'utf8')) as Record<string, ReplayFixture>;
    this.cache.set(task, { mtime, items });
    return items;
  }

  get(task: Task, promptVersion: string, input: unknown): ReplayFixture | null {
    return this.load(task)[replayKey(task, promptVersion, input)] ?? null;
  }

  put(fixture: ReplayFixture): void {
    const items = { ...this.load(fixture.task), [fixture.inputHash]: fixture };
    this.write(fixture.task, items);
  }

  private write(task: Task, items: Record<string, ReplayFixture>) {
    mkdirSync(this.dir, { recursive: true });
    const sorted = Object.fromEntries(Object.keys(items).sort().map((k) => [k, items[k]]));
    writeFileSync(this.file(task), `${JSON.stringify(sorted, null, 1)}\n`);
    this.cache.delete(task);
  }

  /** Remove every fixture of one origin (used before regenerating the scripted demo set). */
  removeByOrigin(origin: ReplayFixture['origin']): number {
    let removed = 0;
    for (const task of TASKS) {
      const items = this.load(task);
      const kept = Object.fromEntries(Object.entries(items).filter(([, fx]) => fx.origin !== origin));
      removed += Object.keys(items).length - Object.keys(kept).length;
      if (existsSync(this.file(task))) this.write(task, kept);
    }
    return removed;
  }

  count(): { total: number; scripted: number; recorded: number } {
    const out = { total: 0, scripted: 0, recorded: 0 };
    for (const task of TASKS) {
      for (const fx of Object.values(this.load(task))) {
        out.total += 1;
        if (fx.origin === 'scripted') out.scripted += 1;
        else out.recorded += 1;
      }
    }
    return out;
  }
}
