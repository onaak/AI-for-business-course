// P4 translation of one line, followed by the check engine. Each line is its own
// call, so a failure in one line cannot corrupt another (F-06).
import { buildP4 } from '../rules/payload';
import type { P4Output } from '../schemas';
import type { DataPack, ModelCall, ModelClient } from '../types';
import { checkLine, type CheckResult } from './checkLine';

export interface TranslateResult extends CheckResult {
  text: string;
  missingConcepts: string[];
}

export async function translateAndCheck(
  client: ModelClient,
  pack: DataPack,
  args: { lineId: string; source: string; lang: string; critical: boolean; enforce: boolean; attempt: number },
  meta: { runId: string },
): Promise<TranslateResult> {
  const calls: ModelCall[] = [];
  const p4 = await client.call<P4Output>('P4', buildP4(args.source, args.lang, pack, args.enforce, args.attempt), meta);
  calls.push(p4.call);
  const check = await checkLine(
    client,
    pack,
    {
      lineId: args.lineId,
      source: args.source,
      target: p4.parsed.text,
      lang: args.lang,
      critical: args.critical,
      missingConcepts: p4.parsed.missingConcepts,
    },
    meta,
  );
  return { ...check, calls: [...calls, ...check.calls], text: p4.parsed.text, missingConcepts: p4.parsed.missingConcepts };
}
