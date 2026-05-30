import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // "@/…" → repo root (regex, so scoped packages like @next/* are untouched).
      { find: /^@\//, replacement: `${root}/` },
      // server-only must be a no-op in tests (these run server modules directly).
      { find: /^server-only$/, replacement: path.join(root, "node_modules/server-only/empty.js") },
    ],
  },
  test: {
    // Tests exercise the REAL on-disk bridge/ — run files serially to avoid races.
    fileParallelism: false,
  },
});
