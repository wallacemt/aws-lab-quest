import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      // Mirrors the "@prisma/client" path override in tsconfig.json: the
      // schema uses a custom generator output, so the real client lives
      // here, not in the node_modules package.
      "@prisma/client": path.resolve(__dirname, "../packages/db/generated/client"),
    },
  },
});
