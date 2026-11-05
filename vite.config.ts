import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Express server in server/index.ts mounts Vite as middleware in development,
// so the whole prototype runs as one process on one port.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
  // The server writes run files, call logs and the working data pack while the app is in use.
  // They are data, not code: if the dev server watched them, every save would reload the page.
  server: {
    watch: { ignored: ['**/data/working/**', '**/evidence/**', '**/test-results/**', '**/playwright-report/**', '**/dist/**'] },
    // Free tunnels for sharing localhost (V5). Without this, Vite answers "Blocked request. This host is not allowed".
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/pipeline/**/*.test.ts'],
    environment: 'node',
  },
} as any);
