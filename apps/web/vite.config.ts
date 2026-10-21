import { defineConfig } from "vite";
export default defineConfig({
  root: "apps/web",
  server: {
    host: "127.0.0.1",
    port: 4311,
    proxy: {
      "/api": "http://127.0.0.1:4310",
      "/health": "http://127.0.0.1:4310",
      "/ready": "http://127.0.0.1:4310",
    },
  },
  build: { outDir: "../../dist/web", emptyOutDir: false },
});
