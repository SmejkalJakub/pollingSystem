import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});
const apiPort = process.env.API_PORT ?? '3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
