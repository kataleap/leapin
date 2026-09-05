import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors the "@/*" -> "./src/*" alias in tsconfig.json, which Vitest does not
// read on its own.
const srcDir = path.resolve(import.meta.dirname, "./src");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Keep these fast and dependency-free: this suite covers pure decision
    // logic (state transitions, money arithmetic, path safety, role rules).
    // Anything needing a live Postgres belongs in a separate integration
    // suite, not here, so `pnpm test` stays runnable with no services up.
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: { "@": srcDir },
  },
});
