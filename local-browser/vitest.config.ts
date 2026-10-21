import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["local-browser/tests/**/*.test.{ts,mjs}"],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
