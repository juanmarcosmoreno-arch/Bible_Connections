import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the project at https://<owner>.github.io/<repo>/.
// The repository is juanmarcosmoreno-arch/Bible_Connections (from `git remote -v`); the
// base can be overridden with BASE_PATH (the deploy workflow sets it from the repo name).
const base = process.env.BASE_PATH ?? '/Bible_Connections/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? base : '/',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
}));
