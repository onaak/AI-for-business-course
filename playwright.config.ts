import { defineConfig } from '@playwright/test';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The browser tests run against a private copy of data/ and a private evidence
// folder, in replay mode, so they never touch the working data pack or the real
// evidence. Replay results are never test evidence for the report.
const root = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(root, 'test-results', 'e2e-work');
if (!process.env.SJA_E2E_PREPARED) {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(path.join(root, 'data'), path.join(work, 'data'), { recursive: true });
  rmSync(path.join(work, 'data', 'working', 'pack.json'), { force: true });
  process.env.SJA_E2E_PREPARED = '1';
}
const port = 5199;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/playwright',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 375, height: 760 }, // phone width (8.4, AC-27)
  },
  webServer: {
    command: 'npx tsx server/index.ts',
    url: `http://localhost:${port}/api/config`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(port),
      GATEWAY_MODE: 'replay',
      SJA_DATA_DIR: path.join(work, 'data'),
      SJA_EVIDENCE_DIR: path.join(work, 'evidence'),
    },
  },
});
