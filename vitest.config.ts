import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "supabase/functions/**/*.test.ts", // edge-function pure-logic unit tests (gemini-core)
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
