import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/actions/**/*.ts",
        "src/app/api/**/*.ts",
        "src/auth.ts",
        "src/lib/**/*.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/types/**", "src/auth.config.ts"],
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
