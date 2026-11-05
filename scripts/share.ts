// npm run share: the safe way to show the prototype to someone outside the group (V5, V6).
//
// Builds the interface, then starts the server with
//   GATEWAY_MODE=replay  nobody with the link can use a model quota or send text to a model
//   APP_MODE=field       the clean view, fixed: no test bench, baseline timer or saved-runs list, no view switch
//   PACK_READONLY=1      nobody with the link can change or reset the reviewers' keys and corrections
// and serves the built files (no development reloads). Then, in a second terminal:
//   cloudflared tunnel --url http://localhost:5173
// and send the https://….trycloudflare.com address it prints. Stop both with Ctrl+C after the session.
import { build } from 'vite';

process.env.GATEWAY_MODE = 'replay';
process.env.APP_MODE = 'field';
process.env.PACK_READONLY = '1';
if (!process.argv.includes('--prod')) process.argv.push('--prod');

console.log('\n  Building the interface for sharing …');
await build({ logLevel: 'warn' });
await import('../server/index.ts');
const port = process.env.PORT ?? '5173';
setTimeout(() => {
  console.log('  Sharing mode: replay (no model is called), field (clean version), data pack read-only.');
  console.log('  In a second terminal run:');
  console.log(`      cloudflared tunnel --url http://localhost:${port}`);
  console.log('  and send the https://….trycloudflare.com address it prints.');
  console.log('  Anyone with that address can use the app and write runs to evidence/. Stop the tunnel after the session.\n');
}, 500);
