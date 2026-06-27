import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` to znacznik bundlera Next — w node/vitest nie istnieje, więc stub.
      "server-only": path.resolve(__dirname, "src/lib/__tests__/server-only-stub.ts"),
    },
  },
});
