import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('./src/web', import.meta.url));
const outDir = fileURLToPath(new URL('./dist/web', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Match the /api/ namespace precisely — a bare `/api` prefix also catches
      // the client module served at /api.ts and breaks its dev transform.
      '^/api/': {target: 'http://localhost:3001', changeOrigin: true},
    },
  },
});
