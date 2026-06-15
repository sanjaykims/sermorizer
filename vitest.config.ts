import { defineConfig } from "vitest/config";

// Unit tests cover the pure-logic leaves only (no Next/server/DOM deps).
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
