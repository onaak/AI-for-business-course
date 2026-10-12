import { modelClient } from '../api';
import type { FlowCtx } from '../core/flow';
import type { Sja } from '../core/types';
import { useApp, useLog, useSjas } from './stores';

/** Wires the pure flow functions to the browser: data pack, model client, log and trace. */
export function makeFlowCtx(sja: Pick<Sja, 'sjaId' | 'templateId' | 'testId' | 'packVersion'>, onProgress?: (done: number, total: number) => void): FlowCtx {
  const { pack, hazards } = useApp.getState();
  if (!pack) throw new Error('Data pack not loaded.');
  const template = pack.templates.find((t) => t.templateId === sja.templateId);
  if (!template) throw new Error(`Template ${sja.templateId} is not in the data pack.`);
  return {
    pack,
    template,
    hazards: hazards.find((h) => h.templateId === sja.templateId),
    client: modelClient,
    log: (e) => useLog.getState().add({ ...e, runId: sja.sjaId, testId: sja.testId, arm: 'flagship', packVersion: sja.packVersion }),
    trace: (e) => useSjas.getState().addTrace(sja.sjaId, e),
    onProgress,
  };
}
