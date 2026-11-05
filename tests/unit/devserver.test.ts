import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

// The server writes the working data pack, run files and call logs while the app is used.
// If the development server watched them, every approval, model call or save would reload
// the page (reviewers lost their place; the foreman saw a white screen mid-step).
describe('development server', () => {
  it('does not watch the files the app writes while it runs', () => {
    const ignored = (config as any).server.watch.ignored as string[];
    for (const dir of ['data/working', 'evidence', 'test-results']) expect(ignored).toContain(`**/${dir}/**`);
  });
});
