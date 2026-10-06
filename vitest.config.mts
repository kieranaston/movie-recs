import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(root, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/{unit,integration}/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/app/**/actions.ts', 'src/app/api/**'], reporter: ['text', 'html'] },
  },
});
