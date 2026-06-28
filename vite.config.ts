import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Strip console.* and debugger from the PRODUCTION bundle only (keeps dev
  // logging intact). See the frontend section of DEPLOYMENT_CHECKLIST.md.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
}));
