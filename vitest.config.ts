import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
    exclude: [
      ...configDefaults.exclude,
      // Project-specific: keep Playwright E2E suites out of Vitest collection.
      'qa-e2e/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
