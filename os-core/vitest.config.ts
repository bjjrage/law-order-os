import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['os-core/tests/**/*.test.ts'], setupFiles: ['junta-juridica/tests/setup.ts'], fileParallelism: false, testTimeout: 10_000 } });
