import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['junta-juridica/tests/**/*.test.ts','os-core/tests/**/*.test.ts','phase2/tests/**/*.test.ts'], setupFiles:['junta-juridica/tests/setup.ts'], testTimeout: 10000, fileParallelism: false } });
