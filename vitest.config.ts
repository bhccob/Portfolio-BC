import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '~': '/src' } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  }
});
