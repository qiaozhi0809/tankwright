import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Runtime assets (presets/, fish/, tex/, icons/, thumbs/) are copied into dist
// by `scripts/copy-assets.mjs` as a separate build step, not a Vite hook — see
// that file for why.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
} as any);
