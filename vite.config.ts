/// <reference types="vite/client" />
import { defineConfig } from "vite";
import { createAppPlugins } from "./vite.plugins";

export default defineConfig(() => ({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: createAppPlugins({ isTest: Boolean(process.env.VITEST) }),
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
}));
