import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/xhs/**/*.spec.ts'] },
});
