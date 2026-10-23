import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // e2e/ holds Playwright specs (run via `bun run test:e2e`), not Vitest ones —
    // without this, vitest's default *.spec.ts glob picks them up too.
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mirrors the "@prisma/client" path override in tsconfig.json: the
      // schema uses a custom generator output, so the real client (and enums
      // like FlashcardSource) live here, not in the node_modules package.
      "@prisma/client": path.resolve(__dirname, "../packages/db/generated/client"),
    },
  },
});
