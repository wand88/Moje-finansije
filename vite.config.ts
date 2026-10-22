import { defineConfig } from "vitest/config";

export default defineConfig({
  /* relativne putanje — build radi i u podfolderu (npr. GitHub Pages) i na korenu domena */
  base: "./",
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"] },
});
