import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    reporters: "default",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/server/**/*.unit.test.ts"]
        }
      },
      {
        test: {
          name: "api",
          include: ["test/server/**/*.api.test.ts"]
        }
      },
      {
        test: {
          name: "e2e",
          environment: "jsdom",
          setupFiles: ["test/client/setup.ts"],
          include: ["test/client/**/*.e2e.test.tsx"]
        }
      }
    ]
  }
});
